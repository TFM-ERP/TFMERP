// Pure logic for the ScripON Doctor single-canvas dashboard — no React/API/DOM.
// Derives the verdict banner, 5-tile coverage scorecard, scene-flow bars,
// emotional-arc points and diagnostics tags from the existing scripton API
// shapes (latestCoverage / analytics / diagnostics). Unit-tested.

export type ScoreTile = { key: string; label: string; grade: string; color: string; pct: number };
export type Verdict = { grade: string; gradeColor: string; rec: string; recColor: string; logline: string; comps: string[]; hasData: boolean };
export type FlowBar = { pct: number; color: string };
export type DiagRow = { scene: string; slug: string; note: string; tag: string; tagColor: string };
export type TransformTile = { key: string; name: string; desc: string; dot: string; action: string };

const GRADE: Record<string, { v: string; c: string; p: number }> = {
  EXCELLENT: { v: 'A', c: 'var(--green)', p: 92 }, GOOD: { v: 'B', c: 'var(--gold2)', p: 78 },
  FAIR: { v: 'C', c: 'var(--amber)', p: 55 }, POOR: { v: 'D', c: 'var(--red)', p: 35 },
};
const NEUTRAL = { v: '—', c: 'var(--faint)', p: 0 };
const REC: Record<string, string> = { RECOMMEND: 'var(--green)', CONSIDER: 'var(--amber)', PASS: 'var(--red)' };
const gradeOf = (g?: string) => GRADE[String(g || '').toUpperCase()] || NEUTRAL;

// Verdict letter chip from a 0–10 overall score.
export function letterFromScore(v: number): string {
  if (!(v > 0)) return '—';
  if (v >= 8.5) return 'A'; if (v >= 8) return 'A-'; if (v >= 7.5) return 'B+';
  if (v >= 6.5) return 'B'; if (v >= 6) return 'B-'; if (v >= 5) return 'C';
  if (v >= 4) return 'C-'; return 'D';
}
const colorFromScore = (v: number) => v >= 8 ? 'var(--green)' : v >= 6 ? 'var(--gold2)' : v >= 4 ? 'var(--amber)' : 'var(--red)';

// 5 scorecard tiles — Plot · Characters · Dialogue · Structure · Market.
const SCORECARD_CATS: [string, string][] = [
  ['plot', 'Plot'], ['characters', 'Characters'], ['dialogue', 'Dialogue'], ['structure', 'Structure'], ['marketability', 'Market'],
];
export function scorecardTiles(grades: Record<string, string> | null | undefined): ScoreTile[] {
  return SCORECARD_CATS.map(([key, label]) => { const gr = gradeOf(grades?.[key]); return { key, label, grade: gr.v, color: gr.c, pct: gr.p }; });
}

// Verdict banner from a coverage report (null → neutral, no broken widget).
export function verdictBanner(coverage: any): Verdict {
  if (!coverage) return { grade: '—', gradeColor: 'var(--faint)', rec: '', recColor: 'var(--faint)', logline: '', comps: [], hasData: false };
  const rec = String(coverage.recommendation || coverage.verdict || '').toUpperCase();
  const overall = Number(coverage.scores?.overall);
  let grade = '—', gradeColor = 'var(--faint)';
  if (isFinite(overall) && overall > 0) { grade = letterFromScore(overall); gradeColor = colorFromScore(overall); }
  const comps = (coverage.comps || []).map((x: any) => x?.title || x).filter(Boolean);
  return { grade, gradeColor, rec, recColor: REC[rec] || 'var(--faint)', logline: coverage.logline || '', comps, hasData: true };
}

// Scene-flow mini bar chart — per-scene health, normalised to the peak.
export function sceneFlowBars(perScene: any): FlowBar[] {
  const arr = (Array.isArray(perScene) ? perScene : []).map((x) => Number(x)).filter((x) => isFinite(x));
  if (!arr.length) return [];
  const peak = Math.max(0.1, ...arr.map((x) => x || 0));
  return arr.map((v) => {
    const pct = Math.max(4, Math.round((v / peak) * 100));
    const color = pct >= 66 ? 'var(--green)' : pct >= 33 ? 'var(--gold2)' : 'var(--red)';
    return { pct, color };
  });
}

// Emotional-arc polyline points (the "current" line) from a per-scene series.
// Returns an SVG points string fitted to a `w`×`h` box, or '' when no data.
export function arcPoints(series: any, w = 220, h = 40): string {
  const arr = (Array.isArray(series) ? series : []).map((x) => Number(x)).filter((x) => isFinite(x));
  if (arr.length < 2) return '';
  const peak = Math.max(0.1, ...arr);
  return arr.map((p, i) => `${((i / (arr.length - 1)) * w).toFixed(1)},${(h - (p / peak) * (h - 6)).toFixed(1)}`).join(' ');
}

// Diagnostics rows → scene + note + KEEP/CONSIDER/CUT tag.
const DIAG_TAG: Record<string, string> = { KEEP: 'var(--green)', CONSIDER: 'var(--amber)', CUT: 'var(--red)' };
export function diagRows(scenes: any): DiagRow[] {
  return (Array.isArray(scenes) ? scenes : []).map((s) => {
    const tag = String(s.verdict || '').toUpperCase();
    const note = [s.objective, s.obstacle].filter(Boolean).join(' · ') || s.note || '';
    return { scene: `S${s.sceneNumber || '—'}`, slug: s.slugline || '', note, tag: tag || 'NOTE', tagColor: DIAG_TAG[tag] || 'var(--faint)' };
  });
}

// The 2×4 transforms grid. `action` maps to the existing page onAction()/rewrite
// kinds; tiles with no built transform fall through to the page's "coming soon".
export const TRANSFORM_TILES: TransformTile[] = [
  { key: 'tighten', name: 'Tighten', desc: 'trim the fat', dot: 'var(--gold)', action: 'rewrite' },
  { key: 'punchup', name: 'Punch-up', desc: 'sharpen lines', dot: 'var(--blue)', action: 'punchup' },
  { key: 'genre', name: 'Genre transpose', desc: 'shift the tone', dot: 'var(--violet)', action: 'format' },
  { key: 'ending', name: 'Re-engineer ending', desc: '10 ending types', dot: 'var(--pink)', action: 'ending' },
  { key: 'budgetfit', name: 'Budget-fit', desc: 'hit a target', dot: 'var(--green)', action: 'budgetfit' },
  { key: 'emotion', name: 'Emotion re-key', desc: 'reshape the arc', dot: 'var(--amber)', action: 'emotion' },
  { key: 'humour', name: 'Humour injection', desc: 'by culture', dot: 'var(--teal)', action: 'humour' },
  { key: 'character', name: 'Add / remove character', desc: 'redistribute', dot: 'var(--blue)', action: 'character' },
];
