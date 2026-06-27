/**
 * Pick the workspace's "current" rendered script for the shared top bar (continuity ring + V chip).
 *
 * A ScriptON workspace draft doc carries NO link to the build/script that actually holds the kernel
 * renders, and "عنترة" can exist as several builds (tatweel-elongated draft title vs the rendered
 * one) — so title/order can't disambiguate. The only honest selector is "the build's linked script
 * has a RENDERED pass". Among the workspace's build-linked scripts, return the one whose most recent
 * rendered pass is newest. null → no build has rendered → the ring hides uniformly (no fake number).
 */
export function pickRenderedScriptId(
  linkedScriptIds: string[],
  renderedPasses: { scriptId: string; createdAt: Date | string }[],
): string | null {
  const inWorkspace = new Set(linkedScriptIds || []);
  let best: { scriptId: string; t: number } | null = null;
  for (const p of renderedPasses || []) {
    if (!inWorkspace.has(p.scriptId)) continue;
    const t = new Date(p.createdAt).getTime();
    if (!best || t > best.t) best = { scriptId: p.scriptId, t };
  }
  return best ? best.scriptId : null;
}
