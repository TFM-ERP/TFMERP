import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  arSettlementNotice,
  collectArSettlementFacts,
  ArSettlementFacts,
} from './ar-settlement-notice.util';

/** Reconciled and fully evidenced — the state everything should end up in. */
const clean = (o: Partial<ArSettlementFacts> = {}): ArSettlementFacts => ({
  paymentCount: 40,
  glReceivable: 52500,
  subLedgerOpen: 52500,
  assertedSettlement: 0,
  assertedInvoiceCount: 0,
  ...o,
});

describe('arSettlementNotice — silence when there is nothing to warn about', () => {
  test('reconciled and evidenced returns null', () => {
    assert.equal(arSettlementNotice(clean()), null);
  });

  test('zero on every side returns null', () => {
    assert.equal(arSettlementNotice(clean({ paymentCount: 0, glReceivable: 0, subLedgerOpen: 0 })), null);
  });

  test('a sub-fils rounding difference does not raise a warning', () => {
    assert.equal(arSettlementNotice(clean({ glReceivable: 100.001, subLedgerOpen: 100 })), null);
  });
});

describe('arSettlementNotice — asserted settlement (the live case)', () => {
  // import-history.js hardcoded status:'PAID' and amountPaid:total for 18 rows
  // imported from filed VAT returns, creating no Payment record.
  const live = () =>
    arSettlementNotice({
      paymentCount: 0,
      glReceivable: 641678.75,
      subLedgerOpen: 52500,
      assertedSettlement: 589178.75,
      assertedInvoiceCount: 18,
    })!;

  test('is classified as asserted, not merely unreconciled', () => {
    assert.equal(live().kind, 'asserted');
    assert.equal(live().level, 'warning');
  });

  test('says receivables may be UNDERstated — the opposite of the obvious reading', () => {
    const n = live();
    assert.match(n.headline, /asserted, not evidenced/);
    assert.match(n.headline, /understated/);
    assert.doesNotMatch(n.detail, /overstate/);
  });

  test('names the script, the count and the amount so the warning is actionable', () => {
    const n = live();
    assert.match(n.detail, /backend\/tools\/import-history\.js/);
    assert.match(n.detail, /18 invoice\(s\)/);
    assert.match(n.detail, /589178\.75/);
    assert.match(n.detail, /641678\.75/);
  });

  test('explains that a VAT return is not evidence of collection', () => {
    assert.match(live().detail, /supplies made, not cash collected/);
  });

  test('mentions the empty Payment table only when it is actually empty', () => {
    assert.match(live().detail, /the Payment table is empty/);
    const withSome = arSettlementNotice({
      paymentCount: 5, glReceivable: 641678.75, subLedgerOpen: 52500,
      assertedSettlement: 589178.75, assertedInvoiceCount: 18,
    })!;
    assert.doesNotMatch(withSome.detail, /the Payment table is empty/);
    assert.equal(withSome.kind, 'asserted');
  });

  test('asserted settlement wins even when the ledger happens to tie', () => {
    // A gap of zero must not silence this: the issue is the missing evidence,
    // not the arithmetic.
    const n = arSettlementNotice({
      paymentCount: 0, glReceivable: 52500, subLedgerOpen: 52500,
      assertedSettlement: 589178.75, assertedInvoiceCount: 18,
    })!;
    assert.ok(n);
    assert.equal(n.kind, 'asserted');
    assert.equal(n.unpostedSettlement, 0);
  });
});

describe('arSettlementNotice — a plain reconciliation gap', () => {
  test('reports unreconciled when payments exist and nothing is merely asserted', () => {
    const n = arSettlementNotice(clean({ paymentCount: 12, glReceivable: 100000, subLedgerOpen: 90000 }))!;
    assert.equal(n.kind, 'unreconciled');
    assert.match(n.headline, /do not reconcile to the ledger/);
    assert.doesNotMatch(n.headline, /asserted/);
    assert.equal(n.unpostedSettlement, 10000);
  });

  test('a one-fils gap still counts', () => {
    const n = arSettlementNotice(clean({ glReceivable: 100.01, subLedgerOpen: 100 }))!;
    assert.equal(n.unpostedSettlement, 0.01);
  });

  test('a negative gap is surfaced rather than hidden', () => {
    assert.equal(arSettlementNotice(clean({ glReceivable: 1000, subLedgerOpen: 1500 }))!.unpostedSettlement, -500);
  });
});

describe('the notice is derived, so it clears itself', () => {
  test('entering the payments removes it entirely', () => {
    const before = arSettlementNotice({
      paymentCount: 0, glReceivable: 641678.75, subLedgerOpen: 52500,
      assertedSettlement: 589178.75, assertedInvoiceCount: 18,
    });
    const after = arSettlementNotice({
      paymentCount: 18, glReceivable: 52500, subLedgerOpen: 52500,
      assertedSettlement: 0, assertedInvoiceCount: 0,
    });
    assert.ok(before);
    assert.equal(after, null);
  });
});

describe('collectArSettlementFacts', () => {
  const stub = (over: any = {}) => ({
    payment: { count: async () => over.paymentCount ?? 0 },
    invoice: { findMany: async () => over.assertedRows ?? [{ amountPaid: '10.00' }, { amountPaid: '5.50' }] },
    // `?? ` would swallow an intentional null, so test for the key instead.
    glAccount: { findUnique: async () => ('arAccount' in over ? over.arAccount : { id: 'gl-1100' }) },
    journalLine: { aggregate: async () => ({ _sum: { debit: over.debit ?? '900.00', credit: over.credit ?? '100.00' } }) },
  });

  test('receivable is debit minus credit on posted lines', async () => {
    const f = await collectArSettlementFacts(stub() as any, 250);
    assert.equal(f.glReceivable, 800);
    assert.equal(f.subLedgerOpen, 250);
  });

  test('asserted settlement sums amountPaid over invoices with no Payment row', async () => {
    const f = await collectArSettlementFacts(stub() as any, 0);
    assert.equal(f.assertedSettlement, 15.5);
    assert.equal(f.assertedInvoiceCount, 2);
  });

  test('a missing 1100 account yields zero rather than throwing', async () => {
    const f = await collectArSettlementFacts(stub({ arAccount: null }) as any, 0);
    assert.equal(f.glReceivable, 0);
  });

  test('no asserted rows reports zero, not NaN', async () => {
    const f = await collectArSettlementFacts(stub({ assertedRows: [] }) as any, 0);
    assert.equal(f.assertedSettlement, 0);
    assert.equal(f.assertedInvoiceCount, 0);
  });
});
