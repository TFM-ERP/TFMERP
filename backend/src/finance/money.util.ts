/**
 * The one rounding rule for the money path (no Nest/Prisma imports, so unit-testable).
 *
 * Money must not make a rounding decision in binary floating point. 80.30 × 5% is 4.015 on
 * paper, but `80.3 * 0.05` is 4.01499999999999968… in a double, and any rule that rounds that
 * double — `Math.round(n * 100) / 100`, or the same with `Number.EPSILON` added — gives 4.01.
 * Widening the epsilon only moves the failure to another value.
 *
 * So the decision is taken in INTEGER FILS, where it is exact:
 *
 *   8030 fils × 500 bp = 4,015,000  →  ÷ 10,000 = 401 remainder 5,000  →  half: up  →  402 fils = 4.02
 *
 * The rule, everywhere: to the nearest fils, a half fils away from zero (4.015 → 4.02,
 * −4.015 → −4.02).
 *
 *   toFils(n)        an amount in AED → integer fils. Exact for anything that already IS a
 *                    whole number of fils: a stored Decimal(15, 2), or a sum of them.
 *   fromFils(f)      integer fils → AED.
 *   r2(n)            toFils then fromFils: snaps an amount to the fils.
 *   rateOf(n, bp)    an amount × a rate in basis points, decided in integer fils. Use this — not
 *                    `n * 0.05` then `r2` — wherever money is COMPUTED by a rate.
 *
 * What r2 cannot do, by design: rescue a half fils that only exists on paper. `r2(80.3 * 0.05)`
 * still sees 4.01499999… and gives 4.01, because that is the number it was handed. The cure is
 * not a bigger tolerance; it is to compute the product with `rateOf` in the first place.
 */

/** Integer arithmetic stays exact up to 2^53; in fils that is AED 90 trillion. */
const MAX_SAFE_FILS = Number.MAX_SAFE_INTEGER;

/** An amount in AED as a whole number of fils, a half fils away from zero. */
export function toFils(n: number): number {
  if (!Number.isFinite(n)) throw new RangeError(`toFils: not a finite amount (${n})`);
  const fils = Math.round(Math.abs(n) * 100);
  if (fils > MAX_SAFE_FILS) throw new RangeError(`toFils: ${n} is beyond exact integer range`);
  return n < 0 && fils !== 0 ? -fils : fils;
}

/** Integer fils back to AED. */
export function fromFils(fils: number): number {
  if (!Number.isSafeInteger(fils)) throw new RangeError(`fromFils: not a whole number of fils (${fils})`);
  return fils / 100;
}

/** An amount snapped to the fils. Never returns −0. */
export function r2(n: number): number {
  return fromFils(toFils(n));
}

/**
 * `fils × bp / 10 000`, to the nearest fils, a half away from zero — in BigInt, so the product
 * is exact however large the amount (a double stops being exact at 2^53).
 */
function rateOfFils(fils: number, bp: number): number {
  const p = BigInt(Math.abs(fils)) * BigInt(bp);
  const q = p / 10_000n;
  const rem = p % 10_000n;
  const out = Number(rem * 2n >= 10_000n ? q + 1n : q);
  return out === 0 ? 0 : fils < 0 ? -out : out;
}

/**
 * An amount × a rate, rounded once, in fils. The rate is in BASIS POINTS so it is an integer
 * too: 5% is 500. `rateOf(80.30, 500)` is 4.02.
 */
export function rateOf(amount: number, bp: number): number {
  if (!Number.isSafeInteger(bp) || bp < 0) throw new RangeError(`rateOf: rate must be whole basis points, got ${bp}`);
  return fromFils(rateOfFils(toFils(amount), bp));
}
