/**
 * Invoice lifecycle rules — pure-logic unit tests (node:test + ts-node).
 * Run: npm run test:unit
 *
 * The line these rules draw: an invoice that has touched the ledger can never
 * be deleted, only voided. Every accounting system draws it in the same place
 * (Xero, QuickBooks, Oracle, Dynamics), and the FTA's five-year record rule
 * assumes it.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canDelete, canVoid, canArchive, buildReversalLines, LifecycleState } from './invoice-lifecycle.rules';

const state = (over: Partial<LifecycleState> = {}): LifecycleState => ({
  status: 'DRAFT',
  hasJournal: false,
  clearedReceipts: 0,
  archivedAt: null,
  ...over,
});

// ── canDelete ────────────────────────────────────────────────────────────────
test('canDelete allows a DRAFT with no journal and no receipts', () => {
  assert.deepEqual(canDelete(state()), { allowed: true });
});

test('canDelete allows a CANCELLED invoice that never posted', () => {
  assert.deepEqual(canDelete(state({ status: 'CANCELLED' })), { allowed: true });
});

test('canDelete refuses anything with a posted journal, and suggests voiding', () => {
  const v = canDelete(state({ hasJournal: true }));
  assert.equal(v.allowed, false);
  assert.equal(v.allowed === false && v.suggest, 'VOID');
  assert.match(v.allowed === false ? v.reason : '', /journal/i);
});

test('canDelete refuses when a cleared receipt exists, and says how many', () => {
  const v = canDelete(state({ clearedReceipts: 2 }));
  assert.equal(v.allowed, false);
  assert.match(v.allowed === false ? v.reason : '', /2 .*receipt/i);
});

test('canDelete refuses a SENT invoice even with nothing posted against it', () => {
  const v = canDelete(state({ status: 'SENT' }));
  assert.equal(v.allowed, false);
  assert.equal(v.allowed === false && v.suggest, 'VOID');
});

test('canDelete refuses PAID, PARTIALLY_PAID, OVERDUE and VOIDED', () => {
  for (const status of ['PAID', 'PARTIALLY_PAID', 'OVERDUE', 'VOIDED']) {
    assert.equal(canDelete(state({ status })).allowed, false, status);
  }
});

// ── canVoid ──────────────────────────────────────────────────────────────────
test('canVoid allows a SENT invoice with no cleared receipts', () => {
  assert.deepEqual(canVoid(state({ status: 'SENT', hasJournal: true })), { allowed: true });
});

test('canVoid refuses when cleared receipts exist and names the count', () => {
  const v = canVoid(state({ status: 'PAID', hasJournal: true, clearedReceipts: 3 }));
  assert.equal(v.allowed, false);
  assert.match(v.allowed === false ? v.reason : '', /3 .*receipt/i);
});

test('canVoid refuses an already VOIDED invoice', () => {
  const v = canVoid(state({ status: 'VOIDED', hasJournal: true }));
  assert.equal(v.allowed, false);
  assert.match(v.allowed === false ? v.reason : '', /already/i);
});

test('canVoid allows a DRAFT but suggests deleting instead', () => {
  const v = canVoid(state({ status: 'DRAFT' }));
  assert.equal(v.allowed, true);
});

// ── canArchive ───────────────────────────────────────────────────────────────
test('canArchive allows any status', () => {
  for (const status of ['DRAFT', 'SENT', 'PAID', 'VOIDED']) {
    assert.deepEqual(canArchive(state({ status })), { allowed: true }, status);
  }
});

test('canArchive refuses an invoice already archived', () => {
  const v = canArchive(state({ archivedAt: new Date('2026-09-20') }));
  assert.equal(v.allowed, false);
  assert.match(v.allowed === false ? v.reason : '', /already archived/i);
});

// ── buildReversalLines ──────────────────────────────────────────────────────
const totals = (lines: Array<{ debit: number; credit: number }>) => ({
  debit: lines.reduce((s, l) => s + l.debit, 0),
  credit: lines.reduce((s, l) => s + l.credit, 0),
});

test('buildReversalLines swaps debit and credit on every line', () => {
  const original = [
    { accountId: 'ar', debit: 1050, credit: 0, description: 'Accounts Receivable' },
    { accountId: 'rev', debit: 0, credit: 1000, description: 'Revenue' },
    { accountId: 'vat', debit: 0, credit: 50, description: 'Output VAT' },
  ];
  const reversed = buildReversalLines(original);
  assert.deepEqual(
    reversed.map((l) => [l.accountId, l.debit, l.credit]),
    [
      ['ar', 0, 1050],
      ['rev', 1000, 0],
      ['vat', 50, 0],
    ],
  );
});

test('buildReversalLines produces an entry that balances whenever the original balanced', () => {
  const original = [
    { accountId: 'ar', debit: 1050, credit: 0, description: 'AR' },
    { accountId: 'rev', debit: 0, credit: 1000, description: 'Revenue' },
    { accountId: 'vat', debit: 0, credit: 50, description: 'Output VAT' },
  ];
  const before = totals(original);
  assert.equal(before.debit, before.credit, 'fixture sanity: original must balance');

  const reversed = buildReversalLines(original);
  const after = totals(reversed);
  assert.equal(after.debit, after.credit, 'reversal must balance');
  // And it is not a coincidental balance — it exactly mirrors the original.
  assert.equal(after.debit, before.credit);
  assert.equal(after.credit, before.debit);
});

test('buildReversalLines swaps totals for any input, balanced or not (algebraic identity, not a lucky case)', () => {
  const lopsided = [
    { accountId: 'a', debit: 300, credit: 0, description: null },
    { accountId: 'b', debit: 0, credit: 120, description: 'partial' },
  ];
  const before = totals(lopsided);
  const after = totals(buildReversalLines(lopsided));
  assert.equal(after.debit, before.credit);
  assert.equal(after.credit, before.debit);
});

test('buildReversalLines prefixes the description with "Reversal —" and handles a missing one', () => {
  const [withDesc, withoutDesc] = buildReversalLines([
    { accountId: 'a', debit: 10, credit: 0, description: 'Revenue' },
    { accountId: 'b', debit: 0, credit: 10, description: null },
  ]);
  assert.equal(withDesc.description, 'Reversal — Revenue');
  assert.equal(withoutDesc.description, 'Reversal —');
});

test('buildReversalLines assigns sortOrder by position', () => {
  const reversed = buildReversalLines([
    { accountId: 'a', debit: 1, credit: 0 },
    { accountId: 'b', debit: 0, credit: 1 },
  ]);
  assert.deepEqual(reversed.map((l) => l.sortOrder), [0, 1]);
});
