/**
 * Pure logic for the Render→Compare view — the V{prev}↔V{new} line diff and the
 * auto-fix bridge note. No React, no kernel calls; tested with node:test so the
 * diff that paints the two columns is provably correct.
 */

export type DiffLine = { t: string; cls: '' | 'del' | 'add' };
export type SceneDiff = { key: string; sceneNumber: number | string | null; head: string; prev: DiffLine[]; next: DiffLine[] };

const splitLines = (s: string): string[] => String(s ?? '').replace(/\r/g, '').split('\n');

/**
 * LCS line diff: lines common to both are plain; lines only in `before` are `del`
 * (struck red in the previous column), lines only in `after` are `add` (green in
 * the rendered column). Each column keeps its own lines in order — alignment is at
 * the scene level (one block per changed scene), not line-for-line.
 */
export function lineDiff(before: string, after: string): { prev: DiffLine[]; next: DiffLine[] } {
  const a = splitLines(before);
  const b = splitLines(after);
  const m = a.length;
  const n = b.length;
  // dp[i][j] = LCS length of a[i:] and b[j:]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const prev: DiffLine[] = [];
  const next: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { prev.push({ t: a[i], cls: '' }); next.push({ t: b[j], cls: '' }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { prev.push({ t: a[i], cls: 'del' }); i++; }
    else { next.push({ t: b[j], cls: 'add' }); j++; }
  }
  while (i < m) { prev.push({ t: a[i], cls: 'del' }); i++; }
  while (j < n) { next.push({ t: b[j], cls: 'add' }); j++; }
  return { prev, next };
}

const SLUG_RE = /^\s*\d+[A-Za-z]?[.)]?\s+(INT|EXT|INT\.?\/EXT|I\/E|EST)\b/i;
export const isSlugLine = (line: string): boolean => SLUG_RE.test(String(line || ''));

/** First non-empty line of a block — used to label the scene when the change carries no slug. */
const firstLine = (s: string): string => splitLines(s).find((l) => l.trim()) || '';

/** Build one diff block per applied change (the changed scenes). */
export function toSceneDiffs(applied: any[]): SceneDiff[] {
  if (!Array.isArray(applied)) return [];
  return applied.map((c, idx) => {
    const before = c?.before ?? '';
    const after = c?.after ?? '';
    const { prev, next } = lineDiff(before, after);
    const slug = isSlugLine(firstLine(before)) ? firstLine(before) : isSlugLine(firstLine(after)) ? firstLine(after) : '';
    const head = slug || [c?.sceneNumber != null ? 'Scene ' + c.sceneNumber : '', c?.label].filter(Boolean).join(' · ');
    // Always suffix the index so multiple changes on the same scene get unique keys.
    return { key: (c?.sceneId || 'c') + ':' + idx, sceneNumber: c?.sceneNumber ?? null, head, prev, next };
  });
}

/**
 * The auto-fix bridge note (a light continuity affordance, not a kernel write in P0):
 * a re-ending that opens on DAWN after a night scene needs a time-bridge. Returns
 * the note + count, or { count: 0 } when no bridge is implied.
 */
export function detectBridge(applied: any[]): { count: number; note: string | null } {
  if (!Array.isArray(applied)) return { count: 0, note: null };
  const hasDawn = (lines: string[]) => lines.some((l) => /^\s*DAWN\b/.test(l));
  for (const c of applied) {
    // A DAWN opener present in the rendered scene but not in the previous one =
    // the render moved this scene to dawn, so a night→dawn bridge was inserted.
    const dawnAdded = hasDawn(splitLines(String(c?.after ?? ''))) && !hasDawn(splitLines(String(c?.before ?? '')));
    const n = Number(c?.sceneNumber);
    if (dawnAdded && Number.isFinite(n) && n > 1) {
      return { count: 1, note: `DAWN time-bridge inserted (S${n - 1} night → S${n} dawn)` };
    }
  }
  return { count: 0, note: null };
}
