import type { CanonFactCore, CanonConflict } from './canon.types';

const overlaps = (a: CanonFactCore, b: CanonFactCore): boolean => {
  const aTo = a.validTo ?? Number.POSITIVE_INFINITY;
  const bTo = b.validTo ?? Number.POSITIVE_INFINITY;
  return a.validFrom < bTo && b.validFrom < aTo;
};

/**
 * Candidates that contradict established canon. Pure, fail-safe.
 *
 * KNOWN P0 LIMITATION: facts are stored open-ended (validTo: null), so two same-subject+predicate
 * facts with different objects always overlap. This means a LEGITIMATE later state change in a NEW
 * scene (e.g. a character dies at scene 30 after being alive at scene 12) is conservatively flagged
 * as a conflict — the detector cannot distinguish death from resurrection. This is non-destructive
 * (it only lowers continuityScore and is logged for human review). P2 (Living-Canon) refinement:
 * close the prior fact's validTo at supersede time so the windows stop overlapping.
 */
export function detectConflicts(
  established: CanonFactCore[],
  candidates: CanonFactCore[],
): CanonConflict[] {
  if (!Array.isArray(established) || !Array.isArray(candidates)) return [];
  const out: CanonConflict[] = [];
  for (const c of candidates) {
    if (!c || (c.status ?? 'ACTIVE') !== 'ACTIVE') continue;
    for (const e of established) {
      if (!e || (e.status ?? 'ACTIVE') !== 'ACTIVE') continue;
      // Skip if one supersedes the other (only when both IDs are defined)
      if (
        (e.supersedesId && c.id && e.supersedesId === c.id) ||
        (c.supersedesId && e.id && c.supersedesId === e.id)
      ) {
        continue;
      }
      if (e.subject !== c.subject || e.predicate !== c.predicate) continue;
      if (e.object === c.object) continue;
      if (!overlaps(e, c)) continue;
      out.push({
        a: e,
        b: c,
        reason: `${c.subject}.${c.predicate}: canon says "${e.object}" but the new draft asserts "${c.object}".`,
      });
    }
  }
  return out;
}

/** Drop facts sourced from any of `sceneIds` (a re-rendered scene supersedes its own prior facts). Pure, fail-safe. */
export function factsExcludingScenes(facts: CanonFactCore[], sceneIds: string[]): CanonFactCore[] {
  if (!Array.isArray(facts)) return [];
  const drop = new Set(sceneIds || []);
  return facts.filter((x) => x && !(x.sourceSceneId && drop.has(x.sourceSceneId)));
}
