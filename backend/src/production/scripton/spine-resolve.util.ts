/**
 * Which spine value a build's generation uses — the BUILD's own, with the workspace as fallback.
 *
 * WHY THIS EXISTS. A build's brief carries its own spine (framework, ending), chosen when the build
 * was made. Generation read neither: the framework and the ending came from the workspace intake
 * row — one row per project, shared by every build, last written by whichever build was created
 * most recently. On Jason Quick (cmtvse1hu) the build said sequence8 and "Poetic justice + Resolved";
 * every stage was written on savecat and "Resolved + Twist". Same rule as the direction (b7e6280):
 * the build's own value first, the workspace only when the build has none.
 *
 * FIELD BY FIELD, NEVER THE WHOLE OBJECT. A build that set its framework but not its ending must
 * still get the workspace's ending — taking the build's spine wholesale would drop it.
 *
 * Pure: no Prisma, no service. The caller hands over the rows it already loaded.
 */

export type SpineSource = 'request' | 'build' | 'workspace' | null;
export interface SpineValue { value: string | undefined; from: SpineSource }

/** A value counts only if it is a non-blank string — '' and whitespace are "not set". */
function given(v: any): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function spineOf(row: any): any {
  const s = row && row.spine;
  return s && typeof s === 'object' ? s : {};
}

/**
 * Resolve one spine field. Precedence: the request (only a BEATS re-pick sends a framework), then the
 * build's brief, then the workspace intake row.
 */
export function resolveSpineField(key: 'framework' | 'ending', buildBrief: any, intake: any, request?: any): SpineValue {
  const r = given(request);
  if (r) return { value: r, from: 'request' };
  const b = given(spineOf(buildBrief)[key]);
  if (b) return { value: b, from: 'build' };
  const w = given(spineOf(intake)[key]);
  if (w) return { value: w, from: 'workspace' };
  return { value: undefined, from: null };
}
