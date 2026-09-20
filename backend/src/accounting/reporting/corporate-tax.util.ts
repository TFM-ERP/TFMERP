/**
 * UAE Corporate Tax rules, expressed once, with the authority for each number.
 *
 * No Nest or Prisma imports, so it is unit-testable on its own. Every threshold
 * here is a legal figure, not a preference — if the law changes, it changes here
 * and nowhere else.
 *
 * Federal Decree-Law No. 47 of 2022 and the Ministerial Decisions made under it.
 */

/** Taxable income up to this amount is taxed at 0%. Art. 3(1)(a). */
export const SMALL_PROFIT_BAND = 375_000;

/** The headline rate applied to taxable income above the band. Art. 3(1)(b). */
export const HEADLINE_RATE = 0.09;

/**
 * Revenue ceiling for Small Business Relief. Ministerial Decision No. 73 of 2023.
 * The test is on REVENUE, not profit, and it must be met in the current tax
 * period and in every previous one.
 */
export const SMALL_BUSINESS_RELIEF_REVENUE_CAP = 3_000_000;

/**
 * Last tax period for which Small Business Relief may be elected.
 * Extended from 31 December 2026 by Ministerial Decision No. 131 of 2026.
 */
export const SMALL_BUSINESS_RELIEF_LAST_PERIOD_END = '2029-12-31';

/** Months after the end of a tax period by which the return and payment fall due. */
export const FILING_WINDOW_MONTHS = 9;

/** Proportion of qualifying entertainment expenditure that is deductible. Art. 32. */
export const ENTERTAINMENT_DEDUCTIBLE_FRACTION = 0.5;

/** Tax payable on a given taxable income, ignoring reliefs and credits. */
export function taxOn(taxableIncome: number): number {
  if (taxableIncome <= SMALL_PROFIT_BAND) return 0;
  return round2((taxableIncome - SMALL_PROFIT_BAND) * HEADLINE_RATE);
}

/**
 * The filing and payment deadline for a tax period ending on the given date.
 *
 * Nine months after the period end, landing on the last day of that month. A
 * 31 December year end is therefore due on 30 September, not 1 October.
 *
 * Computed by moving to the first of the month before adding, then stepping back
 * one day from the following month. Adding nine months to the 31st directly
 * overflows in JavaScript whenever the target month is shorter — `setMonth` on
 * 31 December 2025 yields 1 October 2026, a day late, which on a tax deadline is
 * the difference between compliant and a AED 10,000 penalty.
 */
export function filingDeadline(periodEnd: Date): Date {
  const y = periodEnd.getUTCFullYear();
  const m = periodEnd.getUTCMonth();
  // Day 0 of month n+1 is the last day of month n.
  return new Date(Date.UTC(y, m + FILING_WINDOW_MONTHS + 1, 0));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
