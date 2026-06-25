import type { CanonFactCore } from './canon.types';

/** Facts that are true at story-order point `at`. Half-open window [validFrom, validTo).
 *  Later recordedAt wins per subject+predicate. Pure, fail-safe. */
export function resolveCanonAt(facts: CanonFactCore[], at: number): CanonFactCore[] {
  if (!Array.isArray(facts) || !facts.length) return [];
  const live = facts.filter(
    (x) =>
      x &&
      (x.status ?? 'ACTIVE') === 'ACTIVE' &&
      x.validFrom <= at &&
      (x.validTo == null || x.validTo > at),
  );
  const winner = new Map<string, CanonFactCore>();
  for (const x of live) {
    const key = x.subject + ' ' + x.predicate;
    const prev = winner.get(key);
    if (!prev || (x.recordedAt ?? 0) >= (prev.recordedAt ?? 0)) winner.set(key, x);
  }
  return [...winner.values()];
}
