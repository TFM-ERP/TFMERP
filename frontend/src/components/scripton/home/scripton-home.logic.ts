// Pure logic for the ScriptON Home screen — no React, no API, no DOM.
// Everything here is deterministic and unit-tested (scripton-home.logic.test.ts).
// The component layer feeds it raw API rows + Date.now() and renders the result.

export type SxCard = {
  id: string; title: string; type: string; typeColor: string;
  rev: string; revColor: string; pages: string; grade: string;
  gradeColor: string; updated: string; cover: string;
  _ts: number; // raw updatedAt ms — for sorting / recency; not rendered
};

export type HeroVM = {
  id: string; title: string; type: string; cover: string;
  eyebrow: string; version: string; format: string; pages: string;
  grade: string; gradeColor: string;
  continuity?: number; // canon continuity % — undefined when the kernel is inert
  lastWorkspace: string;
};

export type ActivityItem = { text: string; when: string; color: string; kind: 'revision' | 'coverage' };
export type HomeCounts = { active: number; rendering?: number; notes: number };

// ── Cinematic card palette (matches ScriptOnLibrary) ──
export const COVERS = [
  'linear-gradient(150deg,#243046,#141821)', 'linear-gradient(150deg,#3a2730,#151016)',
  'linear-gradient(150deg,#2a1f2e,#120f15)', 'linear-gradient(150deg,#3a2336,#15101a)',
  'linear-gradient(150deg,#262046,#131020)', 'linear-gradient(150deg,#332c1c,#151209)',
  'linear-gradient(150deg,#1f3329,#101713)',
];

export const typeColor = (t: string): string => {
  const u = (t || '').toUpperCase();
  return /SERIES|PILOT/.test(u) ? '#c3b6f5' : /TVC|COMMERCIAL/.test(u) ? '#E6D2A2'
    : /VERTICAL|MICRO/.test(u) ? '#e7a6c6' : /HORROR/.test(u) ? '#f0a3a0'
    : /ADAPT/.test(u) ? '#9fe3c0' : '#a9c4f7';
};

export const gradeColor = (g: string): string => {
  const u = (g || '').toUpperCase();
  return u === 'RECOMMEND' ? 'var(--green)' : u === 'CONSIDER' ? 'var(--amber)'
    : u === 'PASS' ? 'var(--red)' : 'var(--faint)';
};

// ── Greeting + identity ──
export function greeting(date: Date): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function firstNameOf(user: { fullName?: string; preferredName?: string } | null | undefined): string {
  const name = (user?.preferredName || user?.fullName || '').trim();
  const first = name.split(/\s+/)[0];
  return first || 'there';
}

// ── Relative time (mirrors the library's `rel`) ──
export function relTime(iso: string | undefined | null, now: number = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t) return '';
  const days = Math.round((now - t) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d';
  if (days < 7) return days + 'd';
  if (days < 30) return Math.round(days / 7) + 'w';
  return new Date(iso).toLocaleDateString();
}

// ── Sub-line under the greeting ──
export function subLine(c: HomeCounts): string {
  const parts: string[] = [];
  parts.push(`${c.active} active ${c.active === 1 ? 'script' : 'scripts'}`);
  if (typeof c.rendering === 'number') parts.push(`${c.rendering} rendering`);
  parts.push(`${c.notes} ${c.notes === 1 ? 'note needs' : 'notes need'} you`);
  return parts.join(' · ');
}

// ── Slate mapping ──
const ms = (iso?: string): number => { const t = iso ? new Date(iso).getTime() : 0; return Number.isFinite(t) ? t : 0; };

function mapMaster(m: any, i: number, now: number): SxCard {
  const type = String(m.genre || m.format || m.type || m.projectType || 'Feature');
  const latest = (m.revisions || [])[0] || {};
  const rec = m.coverageRecommendation || m.recommendation || '';
  const _ts = ms(m.updatedAt || m.createdAt);
  return {
    id: m.id || ('m' + i), title: m.title || m.name || 'Untitled',
    type: type.toUpperCase().slice(0, 12), typeColor: typeColor(type),
    rev: (latest.revisionLabel || m.status || 'DRAFT').toString().toUpperCase(),
    revColor: latest.colorCode || '#9aa1ab',
    pages: (m.pageCount || latest.pageCount) ? `${m.pageCount || latest.pageCount} pp` : '—',
    grade: rec || '—', gradeColor: gradeColor(rec),
    updated: relTime(m.updatedAt || m.createdAt, now), cover: COVERS[i % COVERS.length], _ts,
  };
}

function mapDev(m: any, i: number, now: number): SxCard {
  const latest = (m.revisions || [])[0] || {};
  const type = String(m.kind || 'SCRIPT');
  const _ts = ms(m.updatedAt || m.createdAt);
  return {
    id: m.id || ('d' + i), title: m.title || 'Untitled',
    type: (type === 'SCRIPT' ? 'FEATURE' : type).toUpperCase().slice(0, 12), typeColor: typeColor(type),
    rev: String(m.activeRevisionLabel || latest.revisionLabel || 'WHITE').toUpperCase(),
    revColor: latest.colorCode || '#cfd3da',
    pages: (m.pageCount || latest.pageCount) ? `${m.pageCount || latest.pageCount} pp` : '—',
    grade: '—', gradeColor: 'var(--faint)',
    updated: relTime(m.updatedAt || m.createdAt, now), cover: COVERS[i % COVERS.length], _ts,
  };
}

/** Dev scripts win over same-id master rows; result sorted most-recent first. */
export function buildSlate(args: { master: any[]; dev: any[]; now?: number }): { cards: SxCard[] } {
  const now = args.now ?? Date.now();
  const dev = (args.dev || []).map((m, i) => mapDev(m, i, now));
  const devIds = new Set(dev.map((d) => d.id));
  const master = (args.master || []).map((m, i) => mapMaster(m, i, now)).filter((c) => !devIds.has(c.id));
  const cards = [...dev, ...master].sort((a, b) => b._ts - a._ts);
  return { cards };
}

/** The Continue hero = the most-recently-touched script, or null when the slate is empty. */
export function pickContinue(slate: { cards: SxCard[] }, lastWorkspace = 'Write'): HeroVM | null {
  const c = slate.cards[0];
  if (!c) return null;
  return {
    id: c.id, title: c.title, type: c.type, cover: c.cover,
    eyebrow: `CONTINUE WHERE YOU LEFT OFF · ${lastWorkspace}`,
    version: c.rev, format: c.type, pages: c.pages, grade: c.grade, gradeColor: c.gradeColor,
    continuity: undefined, // kernel inert on this branch — no canon continuity yet
    lastWorkspace,
  };
}

// ── Counts ──
export function deriveCounts(a: { scriptCount: number; notesCount: number; rendering?: number; kernelInert: boolean }): HomeCounts {
  const out: HomeCounts = { active: a.scriptCount, notes: a.notesCount };
  if (!a.kernelInert && typeof a.rendering === 'number') out.rendering = a.rendering;
  return out;
}

// ── Activity feed ──
export function toActivity(a: { revisions?: any[]; coverage?: any[]; now?: number }): ActivityItem[] {
  const now = a.now ?? Date.now();
  const items: (ActivityItem & { _ts: number })[] = [];
  for (const r of a.revisions || []) {
    if (!r?.createdAt) continue;
    const who = r.scriptTitle ? ` on ${r.scriptTitle}` : '';
    items.push({ kind: 'revision', text: `Revision ${r.revisionLabel || ''}${who} added`.replace(/\s+/g, ' ').trim(), when: relTime(r.createdAt, now), color: r.colorCode || 'var(--blue)', _ts: ms(r.createdAt) });
  }
  for (const c of a.coverage || []) {
    if (!c?.createdAt) continue;
    const rec = c.recommendation || c.verdict;
    if (!rec) continue;
    const who = c.title ? ` on ${c.title}` : '';
    items.push({ kind: 'coverage', text: `Coverage ${rec}${who}`, when: relTime(c.createdAt, now), color: 'var(--gold)', _ts: ms(c.createdAt) });
  }
  return items.sort((x, y) => y._ts - x._ts).map(({ _ts, ...rest }) => rest);
}
