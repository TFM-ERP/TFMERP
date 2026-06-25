import type { CanonFactCore, CanonKind } from './canon.types';

const KINDS: CanonKind[] = ['CHARACTER', 'WORLD', 'LORE', 'TIMELINE', 'RELATIONSHIP', 'PLOT'];

/**
 * The canon a staged change contributes on render: the facts already extracted +
 * continuity-checked at stage time (`spec.facts`), normalized to CanonFactCore,
 * stamped ACTIVE, and anchored to the change's OWN scene (`sourceSceneId`). The
 * anchor is the key to non-destructive re-rendering — `factsExcludingScenes` keys
 * on `sourceSceneId`, so a later pass that rewrites the same scene supersedes its
 * own prior facts instead of self-conflicting.
 *
 * Returns [] when the change carries no staged facts (the caller may then fall
 * back to AI extraction from the change's resulting prose). Pure, fail-safe.
 */
export function stagedCandidates(change: any): CanonFactCore[] {
  const sceneId = change?.sceneId ? String(change.sceneId) : null;
  const order = Number(change?.spec?.sceneOrder ?? 0) || 0;
  const raw = Array.isArray(change?.spec?.facts) ? change.spec.facts : [];
  const out: CanonFactCore[] = [];
  for (const f of raw) {
    if (!f || !f.subject || !f.predicate || !f.object) continue;
    const kindUpper = String(f.kind || '').trim().toUpperCase() as CanonKind;
    out.push({
      kind: KINDS.includes(kindUpper) ? kindUpper : 'PLOT',
      subject: String(f.subject).trim().toUpperCase(),
      predicate: String(f.predicate).trim().toLowerCase(),
      object: String(f.object).trim(),
      statement: String(f.statement || '').slice(0, 400),
      validFrom: Number(f.validFrom ?? order),
      validTo: f.validTo ?? null,
      status: 'ACTIVE',
      sourceSceneId: sceneId,
    });
  }
  return out;
}
