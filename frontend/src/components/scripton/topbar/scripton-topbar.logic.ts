/**
 * Pure helpers for the unified ScriptON top bar — initials, the continuity-ring
 * gate (no fake numbers: the ring only shows for a real score), the ring geometry,
 * and the active-version pick. No React, no fetches; tested with node:test.
 */

export type TopVersion = { id: string; n: number; label: string; active?: boolean; passId?: string | null; continuity?: number | null };

/** 1–2 char initials from a name or email. '?' when empty. */
export function initials(nameOrEmail?: string | null): string {
  const s = String(nameOrEmail || '').trim();
  if (!s) return '?';
  if (s.includes('@')) return (s[0] + (s[1] || '')).toUpperCase();
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '';
  const b = parts[1]?.[0] || parts[0]?.[1] || '';
  return ((a + b) || '?').toUpperCase();
}

/** The ring shows ONLY for a real numeric score in [0,100] — never a fake/placeholder %. */
export function showRing(continuity: number | null | undefined): continuity is number {
  return typeof continuity === 'number' && Number.isFinite(continuity) && continuity >= 0 && continuity <= 100;
}

/** stroke-dashoffset for a progress ring of the given circumference at pct (0–100). */
export function ringOffset(pct: number, circumference: number): number {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return circumference * (1 - p / 100);
}

/** The active version (by active flag, else highest n). null when there are none. */
export function activeVersion(versions: TopVersion[] | null | undefined): TopVersion | null {
  const list = Array.isArray(versions) ? versions : [];
  if (!list.length) return null;
  return list.find((v) => v.active) || list.slice().sort((a, b) => (b.n || 0) - (a.n || 0))[0] || null;
}
