/**
 * Finance document totals — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit
 * Shared by invoices and quotations. Key rule: a manual fixed deduction is applied BEFORE VAT,
 * reducing the taxable base, so VAT is recomputed proportionally on the reduced base.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { sumLineItems, resolveDiscount, computeDocumentTotals } from './totals.util';

// ── sumLineItems ──────────────────────────────────────────────────────────────
test('sumLineItems folds qty × days × price × (1 - discountPct) and sums raw VAT', () => {
  const r = sumLineItems([
    { quantity: 2, unitPrice: 100, taxAmount: 10 },                          // 200
    { quantity: 1, days: 3, unitPrice: 50, discountPct: 10, taxAmount: 13.5 }, // 150 * 0.9 = 135
  ]);
  assert.equal(r.subtotal, 335);
  assert.equal(r.rawVat, 23.5);
});

test('sumLineItems defaults days=1, discountPct=0, taxAmount=0; empty list is zero', () => {
  assert.deepEqual(sumLineItems([{ quantity: 4, unitPrice: 25 }]), { subtotal: 100, rawVat: 0 });
  assert.deepEqual(sumLineItems([]), { subtotal: 0, rawVat: 0 });
});

// ── resolveDiscount ─────────────────────────────────────────────────────────────
test('resolveDiscount handles PERCENT, FIXED, and none', () => {
  assert.equal(resolveDiscount(1000, 'PERCENT', 10), 100);
  assert.equal(resolveDiscount(1000, 'FIXED', 250), 250);
  assert.equal(resolveDiscount(1000, undefined, undefined), 0);
  assert.equal(resolveDiscount(1000, 'PERCENT', 0), 0); // falsy value → no discount
});

// ── computeDocumentTotals ───────────────────────────────────────────────────────
test('computeDocumentTotals with no discount/deduction passes full VAT through', () => {
  assert.deepEqual(computeDocumentTotals({ subtotal: 335, rawVat: 23.5 }), {
    subtotal: 335, discountAmount: 0, deductionAmount: 0, vatAmount: 23.5, total: 358.5,
  });
});

test('a deduction reduces the taxable base and scales VAT proportionally', () => {
  // base 1000, deduct 200 → vatRatio 0.8 → VAT 40; total 1000 - 200 + 40
  assert.deepEqual(computeDocumentTotals({ subtotal: 1000, rawVat: 50, deductionAmount: 200 }), {
    subtotal: 1000, discountAmount: 0, deductionAmount: 200, vatAmount: 40, total: 840,
  });
});

test('discount and deduction combine; VAT is on (subtotal - discount - deduction)/(subtotal - discount)', () => {
  // base = 1000 - 100 = 900; deduct 300 → ratio 600/900; VAT 50 * 0.6667 = 33.33
  assert.deepEqual(computeDocumentTotals({ subtotal: 1000, rawVat: 50, discountAmount: 100, deductionAmount: 300 }), {
    subtotal: 1000, discountAmount: 100, deductionAmount: 300, vatAmount: 33.33, total: 633.33,
  });
});

test('a deduction larger than the taxable base is clamped to it (VAT → 0)', () => {
  assert.deepEqual(computeDocumentTotals({ subtotal: 500, rawVat: 25, deductionAmount: 999 }), {
    subtotal: 500, discountAmount: 0, deductionAmount: 500, vatAmount: 0, total: 0,
  });
});

test('a negative deduction is clamped to 0; full VAT applies', () => {
  assert.deepEqual(computeDocumentTotals({ subtotal: 200, rawVat: 10, deductionAmount: -50 }), {
    subtotal: 200, discountAmount: 0, deductionAmount: 0, vatAmount: 10, total: 210,
  });
});

test('when discount wipes the taxable base, vatRatio is 0 (no divide-by-zero)', () => {
  assert.deepEqual(computeDocumentTotals({ subtotal: 100, rawVat: 5, discountAmount: 100 }), {
    subtotal: 100, discountAmount: 100, deductionAmount: 0, vatAmount: 0, total: 0,
  });
});
