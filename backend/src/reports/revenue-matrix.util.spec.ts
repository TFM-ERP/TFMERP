import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { Prisma } from '@prisma/client';
import {
  buildRevenueMatrix,
  netRevenue,
  reconcile,
  toReportRows,
  MatrixInvoice,
} from './revenue-matrix.util';
import { revenueAccountFor, POSTABLE_INVOICE_STATUSES } from '../accounting/revenue-mapping.util';

const D = Prisma.Decimal;

/** Invented fixtures only — no production client, supplier or TRN values. */
const inv = (o: Partial<MatrixInvoice> & { clientId: string }): MatrixInvoice => ({
  clientName: 'Client ' + o.clientId,
  activity: 'RENTAL',
  total: '105.00',
  vatAmount: '5.00',
  invoiceType: 'TAX_INVOICE',
  ...o,
});

describe('revenueAccountFor — the mapping the GL posts on', () => {
  test('every Activity enum value maps to a revenue account', () => {
    assert.equal(revenueAccountFor('RENTAL'), '4000');
    assert.equal(revenueAccountFor('PRODUCTION'), '4100');
    assert.equal(revenueAccountFor('PRODUCTION_SERVICE'), '4100');
    assert.equal(revenueAccountFor('BOTH'), '4150');
    assert.equal(revenueAccountFor('BOOK_DESIGN'), '4200');
    assert.equal(revenueAccountFor('WEB_DESIGN'), '4200');
    assert.equal(revenueAccountFor('EVENTS'), '4200');
  });

  test('an unknown or missing activity falls to Other rather than throwing', () => {
    // revenueByActivity in finance-reports.service.ts indexes a 3-key object and
    // throws on BOOK_DESIGN. This mapping must never do that.
    assert.equal(revenueAccountFor(undefined), '4200');
    assert.equal(revenueAccountFor(null), '4200');
    assert.equal(revenueAccountFor('SOMETHING_ADDED_LATER'), '4200');
  });

  test('the posted-status set is exactly what postAll filters on', () => {
    assert.deepEqual([...POSTABLE_INVOICE_STATUSES], ['SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']);
  });
});

describe('netRevenue — net of VAT, signed', () => {
  test('revenue is total minus VAT, not the total', () => {
    assert.equal(netRevenue(inv({ clientId: 'a', total: '105.00', vatAmount: '5.00' })).toString(), '100');
  });

  test('a credit note reverses revenue', () => {
    const cn = inv({ clientId: 'a', total: '105.00', vatAmount: '5.00', invoiceType: 'CREDIT_NOTE' });
    assert.equal(netRevenue(cn).toString(), '-100');
  });

  test('uses total - vat, so a discounted invoice does not use the pre-discount subtotal', () => {
    // subtotal 1000, discount 100 => taxable 900, VAT 45, total 945.
    // Revenue must be 900 (what postAll credits), never 1000.
    assert.equal(netRevenue(inv({ clientId: 'a', total: '945.00', vatAmount: '45.00' })).toString(), '900');
  });

  test('a zero-rated invoice is all revenue', () => {
    assert.equal(netRevenue(inv({ clientId: 'a', total: '500.00', vatAmount: '0.00' })).toString(), '500');
  });
});

describe('buildRevenueMatrix', () => {
  test('splits one client across the four revenue lines', () => {
    const m = buildRevenueMatrix([
      inv({ clientId: 'c1', activity: 'RENTAL', total: '105.00', vatAmount: '5.00' }),
      inv({ clientId: 'c1', activity: 'PRODUCTION', total: '210.00', vatAmount: '10.00' }),
      inv({ clientId: 'c1', activity: 'BOTH', total: '315.00', vatAmount: '15.00' }),
      inv({ clientId: 'c1', activity: 'EVENTS', total: '420.00', vatAmount: '20.00' }),
    ]);
    assert.equal(m.rows.length, 1);
    const r = m.rows[0];
    assert.equal(r.byLine['4000'].toString(), '100');
    assert.equal(r.byLine['4100'].toString(), '200');
    assert.equal(r.byLine['4150'].toString(), '300');
    assert.equal(r.byLine['4200'].toString(), '400');
    assert.equal(r.total.toString(), '1000');
    assert.equal(r.invoices, 4);
  });

  test('a row total equals the sum of its own columns', () => {
    const m = buildRevenueMatrix([
      inv({ clientId: 'c1', activity: 'BOTH', total: '1050.00', vatAmount: '50.00' }),
      inv({ clientId: 'c2', activity: 'RENTAL', total: '210.00', vatAmount: '10.00' }),
    ]);
    for (const r of m.rows) {
      const across = Object.values(r.byLine).reduce((s, v) => s.plus(v), new D(0));
      assert.equal(across.toString(), r.total.toString());
    }
  });

  test('grand total equals both the column totals and the row totals', () => {
    const m = buildRevenueMatrix([
      inv({ clientId: 'c1', activity: 'RENTAL', total: '105.00', vatAmount: '5.00' }),
      inv({ clientId: 'c2', activity: 'BOTH', total: '2100.00', vatAmount: '100.00' }),
      inv({ clientId: 'c3', activity: 'BOOK_DESIGN', total: '52500.00', vatAmount: '2500.00' }),
    ]);
    const downColumns = Object.values(m.columnTotals).reduce((s, v) => s.plus(v), new D(0));
    const downRows = m.rows.reduce((s, r) => s.plus(r.total), new D(0));
    assert.equal(downColumns.toString(), m.grandTotal.toString());
    assert.equal(downRows.toString(), m.grandTotal.toString());
    assert.equal(m.grandTotal.toString(), '52100');
  });

  test('credit notes reduce the client and the column they belong to', () => {
    const m = buildRevenueMatrix([
      inv({ clientId: 'c1', activity: 'BOTH', total: '1050.00', vatAmount: '50.00' }),
      inv({ clientId: 'c1', activity: 'BOTH', total: '210.00', vatAmount: '10.00', invoiceType: 'CREDIT_NOTE' }),
    ]);
    assert.equal(m.rows[0].byLine['4150'].toString(), '800');
    assert.equal(m.grandTotal.toString(), '800');
  });

  test('a client fully credited nets to zero rather than disappearing', () => {
    const m = buildRevenueMatrix([
      inv({ clientId: 'c1', activity: 'RENTAL', total: '105.00', vatAmount: '5.00' }),
      inv({ clientId: 'c1', activity: 'RENTAL', total: '105.00', vatAmount: '5.00', invoiceType: 'CREDIT_NOTE' }),
    ]);
    assert.equal(m.rows.length, 1);
    assert.equal(m.rows[0].total.toString(), '0');
    assert.equal(m.rows[0].invoices, 2);
  });

  test('no invoices yields an empty matrix with zeroed columns, not a crash', () => {
    const m = buildRevenueMatrix([]);
    assert.equal(m.rows.length, 0);
    assert.equal(m.grandTotal.toString(), '0');
    assert.equal(m.columnTotals['4150'].toString(), '0');
  });

  test('row order is deterministic — value desc, then name, then id', () => {
    const mk = (id: string, name: string, total: string) =>
      ({ ...inv({ clientId: id }), clientName: name, total, vatAmount: '0.00' });
    const a = buildRevenueMatrix([mk('z', 'Bravo', '100'), mk('a', 'Bravo', '100'), mk('m', 'Alpha', '100')]);
    const b = buildRevenueMatrix([mk('m', 'Alpha', '100'), mk('z', 'Bravo', '100'), mk('a', 'Bravo', '100')]);
    assert.deepEqual(a.rows.map(r => r.clientId), b.rows.map(r => r.clientId));
    assert.deepEqual(a.rows.map(r => r.clientId), ['m', 'a', 'z']);
  });

  test('exact under float-hostile amounts — the reason this is Decimal', () => {
    // 0.1 + 0.2 in float is 0.30000000000000004. Three hundred such invoices
    // accumulate visible drift; Decimal does not.
    const rows = Array.from({ length: 300 }, () =>
      inv({ clientId: 'c1', activity: 'BOTH', total: '0.30', vatAmount: '0.10' }),
    );
    const m = buildRevenueMatrix(rows);
    assert.equal(m.grandTotal.toString(), '60');
    assert.equal(m.grandTotal.equals(new D('60.00')), true);
  });
});

describe('reconcile — the contract invariant', () => {
  const matrix = () =>
    buildRevenueMatrix([
      inv({ clientId: 'c1', activity: 'BOTH', total: '589178.75', vatAmount: '28056.13' }),
      inv({ clientId: 'c2', activity: 'BOOK_DESIGN', total: '52500.00', vatAmount: '2500.00' }),
    ]);

  test('matrix grand total must equal GL revenue to the fils', () => {
    const m = matrix();
    assert.equal(m.grandTotal.toString(), '611122.62');
    const ok = reconcile(m, '611122.62');
    assert.equal(ok.reconciled, true);
    assert.equal(ok.variance.toString(), '0');
  });

  test('a one-fils difference is a failure, not a rounding tolerance', () => {
    const off = reconcile(matrix(), '611122.61');
    assert.equal(off.reconciled, false);
    assert.equal(off.variance.toString(), '0.01');
  });

  test('variance is signed so the direction of the break is visible', () => {
    assert.equal(reconcile(matrix(), '611122.63').variance.toString(), '-0.01');
  });
});

describe('toReportRows — the single Decimal to number boundary', () => {
  test('emits one numeric field per revenue line plus a total', () => {
    const rows = toReportRows(
      buildRevenueMatrix([inv({ clientId: 'c1', activity: 'BOTH', total: '1050.00', vatAmount: '50.00' })]),
    );
    assert.deepEqual(rows, [
      { client: 'Client c1', invoices: 1, '4000': 0, '4100': 0, '4150': 1000, '4200': 0, total: 1000 },
    ]);
  });
});
