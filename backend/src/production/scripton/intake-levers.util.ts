/**
 * Intake brief-lever resolution (pure, dependency-free).
 *
 * These levers were promoted from the DevelopmentBuild.brief JSON blob into typed IntakeProfile
 * columns (migration 20260624084500_add_intake_typed_levers). To keep existing builds working,
 * reads resolve TYPED-FIRST then fall back to the JSON brief; writes persist the typed columns
 * via the IntakeProfile upsert allowlist. This module is the single sanctioned place that knows
 * which keys are promoted and how the fallback is ordered.
 */

export const LEVER_KEYS = ['scriptVariety', 'dialogueRegister', 'accents', 'styleMix', 'conflict', 'conflictId', 'politicalArc'] as const;
export type LeverKey = (typeof LEVER_KEYS)[number];

/** A value counts as "absent" if it is null/undefined or a blank string (typed columns may store ''). */
function present(v: any): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  return true;
}

/** Typed column wins when present; otherwise fall back to the JSON brief; else null. */
export function resolveLever(profile: any, brief: any, key: string): any {
  const typed = profile ? profile[key] : undefined;
  if (present(typed)) return typed;
  const fallback = brief ? brief[key] : undefined;
  return fallback === undefined ? null : fallback;
}

/** Resolve all promoted levers into a flat object (typed-first, brief fallback). */
export function resolveLevers(profile: any, brief: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of LEVER_KEYS) out[k] = resolveLever(profile, brief, k);
  return out;
}

/** Extract only the promoted lever keys that are defined on a brief-like object (for persistence). */
export function pickLevers(src: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!src) return out;
  for (const k of LEVER_KEYS) if (src[k] !== undefined) out[k] = src[k];
  return out;
}
