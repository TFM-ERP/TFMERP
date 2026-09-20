import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { taxOn, filingDeadline, SMALL_PROFIT_BAND } from './corporate-tax.util';

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('taxOn — the 0% band and the 9% rate', () => {
  test('charges nothing within the small profit band', () => {
    assert.equal(taxOn(0), 0);
    assert.equal(taxOn(1), 0);
    assert.equal(taxOn(SMALL_PROFIT_BAND), 0);
  });

  test('charges 9 per cent on the excess only, never on the whole', () => {
    assert.equal(taxOn(SMALL_PROFIT_BAND + 100_000), 9_000);
    assert.equal(taxOn(1_000_000), 56_250); // (1,000,000 - 375,000) x 9%
  });

  test('never charges on a loss', () => {
    assert.equal(taxOn(-50_000), 0);
  });
});

describe('filingDeadline — nine months after the period end', () => {
  /**
   * The case that caught a real bug. Adding nine months to 31 December with
   * Date.setMonth overflows into 1 October, one day past the deadline, because
   * September has 30 days. On a tax deadline that is the difference between
   * compliant and an AED 10,000 penalty.
   */
  test('puts a 31 December year end on 30 September, not 1 October', () => {
    assert.equal(iso(filingDeadline(new Date('2025-12-31'))), '2026-09-30');
  });

  test('handles a 31 March year end', () => {
    assert.equal(iso(filingDeadline(new Date('2025-03-31'))), '2025-12-31');
  });

  test('handles a 30 June year end', () => {
    assert.equal(iso(filingDeadline(new Date('2025-06-30'))), '2026-03-31');
  });

  test('handles a 31 January year end, where the target month is October', () => {
    assert.equal(iso(filingDeadline(new Date('2025-01-31'))), '2025-10-31');
  });

  test('lands on 29 February in a leap year', () => {
    assert.equal(iso(filingDeadline(new Date('2027-05-31'))), '2028-02-29');
  });
});
