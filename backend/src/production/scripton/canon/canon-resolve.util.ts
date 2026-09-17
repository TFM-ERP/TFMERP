import type { CanonFactCore } from './canon.types';

/** Facts that are true at story-order point `at`. Half-open window [validFrom, validTo).
 *  Later recordedAt wins per subject+predicate — except MOTIVE, see below. Pure, fail-safe. */
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
    /**
     * SUPERSESSION IS FOR FACTS THAT CAN ONLY HAVE ONE VALUE. A character has one age and one
     * father, so a later fact about either replaces the earlier one — that is what this key is for.
     *
     * A CHARACTER CAN WANT TWO THINGS, AND USUALLY DOES. Gideon wants to survive the exposure AND to
     * be seen as the executive who found the corruption; Alexander wants to preserve the company AND
     * to restore his son on condition of silence. Under a subject+predicate key the second of each
     * pair silently replaced the first, so 23 extracted MOTIVE rows arrived at the prompt as 21 —
     * after the quota had correctly kept all 23. Not a budget loss: a collapse at injection.
     *
     * Fixed HERE rather than filtered at the call site, because a predicate in one caller leaves
     * this function wrong about MOTIVE for the other four — and the day one of them surfaces motive
     * it would get the collapsed version with nothing to say so. For the twelve other kinds the key
     * is byte-identical, so no caller sees a behavioural change and no legacy behaviour can depend
     * on MOTIVE collapsing: the kind did not exist until this week.
     */
    const key = x.kind === 'MOTIVE'
      ? x.subject + ' ' + x.predicate + ' ' + x.object
      : x.subject + ' ' + x.predicate;
    const prev = winner.get(key);
    if (!prev || (x.recordedAt ?? 0) >= (prev.recordedAt ?? 0)) winner.set(key, x);
  }
  return [...winner.values()];
}
