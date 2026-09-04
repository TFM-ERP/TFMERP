/**
 * DAYS — the unit the whole timeline axis is measured in, and the one rounding rule.
 *
 * Its own file because both `era.util.ts` and `era-tokens.util.ts` need it, and having the
 * tokenizer import from the module that imports the tokenizer is a cycle: it happens to resolve
 * under CommonJS because function declarations hoist, and it would not survive a bundler or a
 * change of module target. One constant, one rounding rule, no cycle.
 *
 * PURE. NEVER THROWS.
 */

/** Julian year. One constant, used for every conversion, so two code paths cannot disagree. */
export const DAYS_PER_YEAR = 365.25;

/** A resolved offset in days. `from` is the earlier (more negative) bound; `to` the later. */
export interface EraOffset { from: number; to: number }

/**
 * Round half AWAY FROM ZERO. `Math.round` breaks ties toward +Infinity, so a symmetric pair comes
 * out one apart — and a decade is exactly 3652.5 days, so every ten-year step is a tie. Exported
 * because `era-map.util.ts` needs the same rule for its midpoints, and a second hand-written copy
 * is a guarantee that lives in a comment rather than in the code.
 */
export function roundHalfAwayFromZero(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

/**
 * Years to days, rounding HALF AWAY FROM ZERO.
 *
 * A decade is exactly 3652.5 days, so the rounding rule decides. `Math.round` breaks ties toward
 * +Infinity, which sends -10y to -3652 and +10y to +3653 — so "ten years before" and "ten years
 * after" would land 1 day apart from symmetric input, and two identical phrases in one script could
 * normalise to two different timelines. Ten years, thirty years and fifty years are all ties — the
 * round numbers a history actually uses.
 */
export function yearsToDays(years: number): number {
  if (!Number.isFinite(years)) return 0;
  return roundHalfAwayFromZero(years * DAYS_PER_YEAR);
}

/** Days back to years. The inverse nobody exported, so every consumer wrote its own. */
export function daysToYears(days: number): number {
  if (!Number.isFinite(days)) return 0;
  return roundHalfAwayFromZero(days / DAYS_PER_YEAR);
}
