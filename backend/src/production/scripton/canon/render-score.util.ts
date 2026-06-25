/** 1 = clean; each conflict subtracts proportionally to the pass size. Clamped [0,1]. */
export function continuityScore(conflictCount: number, changeCount: number): number {
  if (!changeCount) return 1;
  const penalty = conflictCount / (changeCount + conflictCount);
  return Math.max(0, Math.min(1, 1 - penalty));
}
