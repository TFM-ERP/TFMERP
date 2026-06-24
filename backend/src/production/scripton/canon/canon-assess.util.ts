import { detectConflicts, factsExcludingScenes } from './canon-verify.util';
import { continuityScore } from './render-score.util';
import type { CanonConflict, CanonFactCore } from './canon.types';

/** The render loop's pure decision core: exclude changed-scene facts, detect conflicts vs the rest, score.
 *  renderPass() calls this so the wired path and this test exercise identical logic. */
export function assessPass(
  allFacts: CanonFactCore[],
  candidates: CanonFactCore[],
  changedSceneIds: string[],
  changeCount: number,
): { established: CanonFactCore[]; conflicts: CanonConflict[]; continuityScore: number } {
  const established = factsExcludingScenes(allFacts || [], changedSceneIds || []);
  const conflicts = detectConflicts(established, candidates || []);
  return { established, conflicts, continuityScore: continuityScore(conflicts.length, changeCount) };
}
