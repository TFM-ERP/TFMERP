/**
 * C1 — WHICH UPSTREAM VERSIONS BUILT THIS ONE.
 *
 * No stage version recorded what it was written from. On 20 Sep the only way to establish that
 * STEP_OUTLINE had consumed SCENES v6 was to capture the composed prompt at run time and compare
 * forty sluglines by hand; a day later it would have been unanswerable, because `currentVersionId`
 * is mutable and the row reads identically whichever way it points.
 *
 * THE STAMP IS TAKEN FROM THE RESOLUTION THE PROMPT BUILDER USED, NEVER RE-DERIVED.
 *
 * `pipeline()` resolves each stage once, at scripton.service.ts:781:
 *
 *     current: versions.find(v => v.id === s.currentVersionId) || versions[versions.length - 1] || null
 *
 * Note the fallback. When `currentVersionId` is NULL the consumed version is the LAST version, not
 * null — so a stamp re-derived from `currentVersionId` after the fact would name the wrong row (or
 * nothing) in exactly the case where the question is hardest to answer later. This function is
 * therefore given the resolved stage objects and reads `current.id` off them. It never looks at
 * `currentVersionId`, and there is a test that fails if it does.
 *
 * ONLY WHAT ACTUALLY REACHED THE PROMPT. `carried` is the list of kinds the block builder really
 * emitted — developmentSoFar's `parts`, or the parts buildSpine/buildFeatureCtx composed. A stage
 * the budget named as omitted did NOT reach the prompt and must not appear in the stamp, or the
 * stamp becomes a claim about what was available rather than a record of what was read.
 *
 * Pure; never throws.
 */

export interface ResolvedStage {
  kind: string;
  /** The resolved version — pipeline()'s `current`, fallback included. */
  current?: { id?: string | null } | null;
  /** Present on the row and deliberately UNUSED here. See the doc comment. */
  currentVersionId?: string | null;
}

export type ConsumedStamp = Record<string, string>;

export function consumedStamp(carried: Array<string | { kind: string }>, stages: ResolvedStage[]): ConsumedStamp {
  const out: ConsumedStamp = {};
  const list = Array.isArray(stages) ? stages : [];
  for (const c of Array.isArray(carried) ? carried : []) {
    const kind = typeof c === 'string' ? c : String((c && c.kind) || '');
    if (!kind || out[kind]) continue;
    const st = list.find((s) => s && s.kind === kind);
    const id = st && st.current && st.current.id;
    if (id) out[kind] = String(id);
  }
  return out;
}

/** True when the stamp names something — callers store it only then, so an empty object is never written. */
export function hasConsumed(stamp: ConsumedStamp | null | undefined): boolean {
  return !!stamp && Object.keys(stamp).length > 0;
}
