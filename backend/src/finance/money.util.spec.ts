/**
 * THE EXACT FAILURE THIS CATCHES: a VAT figure one fils short because the rounding decision was
 * taken on a binary double instead of on whole fils. 80.30 × 5% = 4.015 must be 4.02; both rules
 * this replaces give 4.01.
 *
 * The rule: to the nearest fils, a half fils away from zero, decided in integers.
 * Run: npm run test:unit
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { toFils, fromFils, r2, rateOf } from './money.util';

const VAT_BP = 500; // 5%

/** The exact answer, from integers only: fils × 5 / 100, a half away from zero. */
function expectedVatFils(fils: number): number {
  const p = Math.abs(fils) * 5;
  const q = Math.floor(p / 100);
  const out = (p % 100) * 2 >= 100 ? q + 1 : q;
  return fils < 0 ? -out : out;
}

test('THE SIX NETS from the batch 1 test: 5% of each lands on half a fils and rounds UP', () => {
  for (const [net, vat] of [[80.3, 4.02], [82.1, 4.11], [85.3, 4.27], [87.1, 4.36], [90.3, 4.52], [161.7, 8.09]]) {
    assert.equal(rateOf(net, VAT_BP), vat, `5% of ${net}`);
  }
});

test('THE SWEEP: every half-fils net from 0.10 to 5,000,000.00 — zero one-fils errors', () => {
  // A net lands 5% on exactly half a fils when its fils count ends in 10, 30, 50, 70 or 90.
  let wrong = 0;
  const first: string[] = [];
  for (let fils = 10; fils <= 500_000_000; fils += 20) {
    const got = rateOf(fromFils(fils), VAT_BP);
    const want = fromFils(expectedVatFils(fils));
    if (got !== want) { wrong++; if (first.length < 5) first.push(`5% of ${fromFils(fils)}: ${got}, want ${want}`); }
  }
  assert.deepEqual(first, []);
  assert.equal(wrong, 0);
});

test('THE SWEEP, every fils: 5% of each net from 0.00 to 200,000.00 is exact', () => {
  for (let fils = 0; fils <= 20_000_000; fils++) {
    const got = rateOf(fromFils(fils), VAT_BP);
    if (got !== fromFils(expectedVatFils(fils))) assert.fail(`5% of ${fromFils(fils)} gave ${got}`);
  }
});

test('NEGATIVES round away from zero the same way: −80.30 × 5% = −4.02', () => {
  for (const [net, vat] of [[-80.3, -4.02], [-161.7, -8.09], [-100.1, -5.01], [-100, -5], [-0.1, -0.01]]) {
    assert.equal(rateOf(net, VAT_BP), vat, `5% of ${net}`);
  }
  for (let fils = 10; fils <= 2_000_000; fils += 20) {
    assert.equal(rateOf(fromFils(-fils), VAT_BP), -rateOf(fromFils(fils), VAT_BP), `−${fromFils(fils)}`);
  }
});

test('r2 / toFils on an exact half fils (one a double CAN hold, like 0.125) go away from zero both ways', () => {
  assert.equal(r2(0.125), 0.13);
  assert.equal(r2(-0.125), -0.13);
  assert.equal(toFils(-0.125), -13);
  assert.equal(r2(-1234.375), -1234.38);
  assert.equal(r2(-0.005), -0.01); // −0.005 × 100 is exactly −0.5
});

test('BELOW AND ABOVE THE HALF: 4.014 down, 4.016 up', () => {
  assert.equal(rateOf(80.28, VAT_BP), 4.01); // 4.014
  assert.equal(rateOf(80.32, VAT_BP), 4.02); // 4.016
  assert.equal(rateOf(99.9, VAT_BP), 5); // 4.995 → 5.00
});

test('ZERO is zero, never −0', () => {
  assert.ok(Object.is(rateOf(0, VAT_BP), 0));
  assert.ok(Object.is(rateOf(-0, VAT_BP), 0));
  assert.ok(Object.is(rateOf(-0.09, VAT_BP), 0)); // −0.0045 → 0
  assert.ok(Object.is(r2(-0), 0));
  assert.ok(Object.is(r2(-0.004), 0));
  assert.ok(Object.is(toFils(-0.004), 0));
});

test('VERY LARGE amounts stay exact: 5% of 999,999,999,999.90 is 49,999,999,999.995 → 50,000,000,000.00', () => {
  assert.equal(rateOf(999_999_999_999.9, VAT_BP), 50_000_000_000);
  assert.equal(rateOf(123_456_789_012.3, VAT_BP), 6_172_839_450.62); // .615 → .62
  assert.equal(r2(999_999_999_999.99), 999_999_999_999.99);
});

test('OUT OF RANGE is refused, not rounded wrong', () => {
  assert.throws(() => toFils(Number.NaN), RangeError);
  assert.throws(() => toFils(Number.POSITIVE_INFINITY), RangeError);
  assert.throws(() => toFils(1e17), RangeError);
  assert.throws(() => rateOf(100, 0.5), RangeError); // a rate must be whole basis points
  assert.throws(() => rateOf(100, -500), RangeError);
  assert.throws(() => fromFils(1.5), RangeError);
});

test('OTHER RATES decide the same way: 100% is the amount, 0% is zero, 2.5% of 0.20 is 0.005 → 0.01', () => {
  assert.equal(rateOf(80.3, 10_000), 80.3);
  assert.equal(rateOf(80.3, 0), 0);
  assert.equal(rateOf(0.2, 250), 0.01);
  assert.equal(rateOf(0.6, 250), 0.02); // 0.015 → 0.02
});

test('r2 snaps a sum of stored amounts to the fils, cleaning binary dust', () => {
  let s = 0;
  for (let i = 0; i < 1000; i++) s += 0.1; // 99.9999999999986
  assert.equal(r2(s), 100);
  assert.equal(r2(0.1 + 0.2), 0.3);
  assert.equal(r2(-(0.1 + 0.2)), -0.3);
  assert.equal(r2(1234.5), 1234.5);
});

test('r2 rounds the double it is GIVEN: a half fils that exists only on paper is not rescued — use rateOf', () => {
  // 80.3 * 0.05 is 4.01499999999999968… in binary. r2 has no tolerance, by design: the cure for
  // a computed half fils is to compute it in fils, not to guess what the double meant.
  assert.equal(80.3 * 0.05 * 100 < 401.5, true); // 401.49999999999994
  assert.equal(r2(80.3 * 0.05), 4.01);
  assert.equal(rateOf(80.3, VAT_BP), 4.02);
});

test('toFils / fromFils round-trip every stored amount exactly', () => {
  for (let fils = -100_000; fils <= 100_000; fils++) {
    if (toFils(fromFils(fils)) !== fils) assert.fail(`${fils} fils did not round-trip`);
  }
});
