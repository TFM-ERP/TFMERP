/**
 * Revenue matrix calculation — client (rows) x GL revenue line (columns).
 *
 * Pure: no Nest, no PrismaService, no database. It takes already-fetched invoice
 * rows and folds them, so every rule below is unit-testable against hand-computed
 * values. Contract: `src/reports/revenue-matrix.contract.md`.
 *
 * Money stays on Decimal for the whole fold and is converted to `number` exactly
 * once, at the JSON response boundary in `toReportRows()`. Summing hundreds of
 * invoices in float is what makes a report fail to reconcile to the ledger by a
 * few fils, which is precisely the invariant this report exists to prove.
 */

import { Prisma } from '@prisma/client';
import { REVENUE_LINES, RevenueCode, revenueAccountFor } from '../accounting/revenue-mapping.util';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;

/** One invoice, as the matrix needs it. Amounts accept anything Decimal can take. */
export interface MatrixInvoice {
  clientId: string;
  clientName: string;
  activity?: string | null;
  /** VAT-inclusive document total. */
  total: Prisma.Decimal.Value;
  /** Tax on the document. Revenue is `total - vatAmount`. */
  vatAmount: Prisma.Decimal.Value;
  /** `CREDIT_NOTE` is stored positive and subtracted here, not in the query. */
  invoiceType?: string | null;
}

export interface MatrixRow {
  clientId: string;
  client: string;
  invoices: number;
  /** Keyed by revenue account code. */
  byLine: Record<RevenueCode, Dec>;
  total: Dec;
}

export interface RevenueMatrix {
  rows: MatrixRow[];
  columnTotals: Record<RevenueCode, Dec>;
  grandTotal: Dec;
}

const zeroLines = (): Record<RevenueCode, Dec> =>
  REVENUE_LINES.reduce((o, l) => ({ ...o, [l.code]: new D(0) }), {} as Record<RevenueCode, Dec>);

/**
 * Revenue recognised for one invoice, net of VAT and signed.
 *
 * `total - vatAmount`, NOT `subtotal`: `subtotal` is struck before
 * `discountAmount` and `deductionAmount`, while `postAll()` credits revenue as
 * `total - vat`. They coincide only while every discount and deduction is zero,
 * so using `subtotal` would break the ledger invariant on the first discounted
 * invoice rather than at a visible moment.
 */
export function netRevenue(inv: MatrixInvoice): Dec {
  const net = new D(inv.total).minus(new D(inv.vatAmount));
  // A credit note reverses revenue. Amounts are stored positive, so the sign is
  // applied in the calculation — never in the query, which would hide it.
  return inv.invoiceType === 'CREDIT_NOTE' ? net.negated() : net;
}

/**
 * Fold invoices into the matrix.
 *
 * Row order is descending by total revenue with `clientName` then `clientId` as
 * tiebreakers, so the output is deterministic and diffable across runs even when
 * two clients bill the same amount.
 */
export function buildRevenueMatrix(invoices: MatrixInvoice[]): RevenueMatrix {
  const byClient = new Map<string, MatrixRow>();

  for (const inv of invoices) {
    let row = byClient.get(inv.clientId);
    if (!row) {
      row = { clientId: inv.clientId, client: inv.clientName, invoices: 0, byLine: zeroLines(), total: new D(0) };
      byClient.set(inv.clientId, row);
    }
    const code = revenueAccountFor(inv.activity);
    const net = netRevenue(inv);
    row.byLine[code] = row.byLine[code].plus(net);
    row.total = row.total.plus(net);
    row.invoices += 1;
  }

  const rows = [...byClient.values()].sort(
    (a, b) =>
      b.total.comparedTo(a.total) ||
      a.client.localeCompare(b.client) ||
      a.clientId.localeCompare(b.clientId),
  );

  const columnTotals = zeroLines();
  let grandTotal = new D(0);
  for (const r of rows) {
    for (const l of REVENUE_LINES) columnTotals[l.code] = columnTotals[l.code].plus(r.byLine[l.code]);
    grandTotal = grandTotal.plus(r.total);
  }

  return { rows, columnTotals, grandTotal };
}

/**
 * The invariant, as a function rather than a comment.
 *
 * Exact Decimal equality — not an epsilon. The whole point of the report is that
 * it ties to the ledger to the fils; a tolerance would hide the drift it exists
 * to detect.
 */
export function reconcile(matrix: RevenueMatrix, glRevenue: Prisma.Decimal.Value) {
  const gl = new D(glRevenue);
  const variance = matrix.grandTotal.minus(gl);
  return { reconciled: variance.isZero(), glRevenue: gl, variance };
}

/** Convert to the JSON row shape. The single Decimal -> number boundary. */
export function toReportRows(matrix: RevenueMatrix) {
  return matrix.rows.map(r => ({
    client: r.client,
    invoices: r.invoices,
    ...REVENUE_LINES.reduce((o, l) => ({ ...o, [l.code]: r.byLine[l.code].toNumber() }), {}),
    total: r.total.toNumber(),
  }));
}
