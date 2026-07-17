import type { CanonFactCore, CanonKind } from './canon.types';

const KINDS: CanonKind[] = ['CHARACTER', 'WORLD', 'LORE', 'TIMELINE', 'RELATIONSHIP', 'PLOT'];

/**
 * Pure: normalize raw AI rows into CanonFactCore anchored to the scene's story order.
 * Non-array input or rows missing subject/predicate/object are silently dropped.
 */
export function mapAiFactsToCore(
  raw: any,
  scene: { id: string; order: number },
): CanonFactCore[] {
  if (!Array.isArray(raw)) return [];
  const out: CanonFactCore[] = [];
  for (const r of raw) {
    if (!r || !r.subject || !r.predicate || !r.object) continue;
    const kindUpper = String(r.kind || '').trim().toUpperCase() as CanonKind;
    out.push({
      kind: KINDS.includes(kindUpper) ? kindUpper : 'PLOT',
      subject: String(r.subject).trim().toUpperCase(),
      predicate: String(r.predicate).trim().toLowerCase(),
      object: String(r.object).trim(),
      statement: String(r.statement || '').slice(0, 400),
      validFrom: scene.order,
      validTo: null,
      status: 'ACTIVE',
      sourceSceneId: scene.id,
    });
  }
  return out;
}
