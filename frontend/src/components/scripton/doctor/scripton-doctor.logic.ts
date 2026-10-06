// Pure logic for the ScriptON Doctor single-canvas dashboard — no React/API/DOM.
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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLAN 01 TASK 7 — THE CHECKS, AS A READER SEES THEM.
//
// Pure, and here rather than inline in the component for one reason: this directory already has a
// logic module with a node:test suite beside it (scripton-doctor.logic.test.ts, run with
// `npx tsx --test`). The first version of task 7 put these maps in the .tsx and reported "there is
// no frontend test runner" — which is true of package.json and false of this folder.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The .sx palette, by variable name. Needed because a CSS custom property cannot be concatenated
 * into a colour: `'var(--red)' + '29'` is `var(--red)29`, which is not a colour at all, so the
 * element gets NO background. The tag tints in this file have had that bug since they were written.
 */
export const SX_HEX: Record<string, string> = {
  'var(--red)': '#e5635f',
  'var(--green)': '#57b368',
  'var(--amber)': '#e0a23b',
  'var(--blue)': '#5b8def',
  'var(--faint)': '#6b727d',
  'var(--violet)': '#8b7cf0',
};

/**
 * A translucent wash of a colour, valid whether it arrives as a var() name or a hex.
 * Unknown input falls back to a neutral rather than producing an invalid value, because an
 * invisible tag is how this went unnoticed.
 */
export function tint(color: string, alpha = '29'): string {
  const c = String(color || '');
  const hex = SX_HEX[c] || (/^#[0-9a-fA-F]{6}$/.test(c) ? c : '');
  return hex ? hex + alpha : 'rgba(255,255,255,.06)';
}

export type CheckDisplay = 'FINDINGS' | 'CLEAN' | 'INFO' | 'NOT_RUN' | 'STALE' | 'ABSENT';

/**
 * SIX STATES, SEPARATED IN WORDS AND NOT ONLY IN COLOUR. CLEAN must not be the quiet default: on
 * the 2 Oct revision nine of eleven checks had never written a row and one had abstained, and the
 * page showed a finished 122-page script with no sign of either. A colour alone reads as decoration.
 */
export const CHECK_STATE: Record<CheckDisplay, { word: string; color: string; note: string }> = {
  FINDINGS: { word: 'found something', color: 'var(--red)', note: 'ran and found something' },
  CLEAN: { word: 'clean', color: 'var(--green)', note: 'ran and found nothing' },
  INFO: { word: 'for information', color: 'var(--blue)', note: 'an observation, not a verdict' },
  NOT_RUN: { word: 'DID NOT RUN', color: 'var(--amber)', note: 'this is NOT a pass' },
  STALE: { word: 'OUT OF DATE', color: 'var(--amber)', note: 'the pages changed after this verdict' },
  ABSENT: { word: 'NEVER RECORDED', color: 'var(--faint)', note: 'nothing ever wrote a result' },
};

export const CHECK_LABEL: Record<string, string> = {
  ending: 'Ending reached', planEnding: 'Plan reaches the ending', planState: 'Plan state read',
  nameDrift: 'Name drift', ledger: 'Identity & state', writtenDeaths: 'Deaths written on the page',
  clock: 'Story clock', flashback: 'Flashbacks', density: 'Shape of the draft',
  echo: 'Repeated phrases', register: 'Against the source register',
};

export type CheckRowView = {
  kind: string; label: string; word: string; color: string; bg: string;
  reason: string; items: Array<{ scene: number | null; kind: string; detail: string }>;
};

/** One row, ready to render. An unknown display degrades to ABSENT, never to CLEAN. */
export function checkRowView(row: any): CheckRowView {
  const kind = String((row && row.kind) || 'unknown');
  const display = (CHECK_STATE as any)[row && row.display] ? (row.display as CheckDisplay) : 'ABSENT';
  const st = CHECK_STATE[display];
  return {
    kind,
    label: CHECK_LABEL[kind] || kind,
    word: st.word,
    color: st.color,
    bg: tint(st.color),
    reason: String((row && row.reason) || st.note),
    items: Array.isArray(row && row.items) ? row.items : [],
  };
}

/**
 * The one line a writer sees where a run ends.
 *
 * WHAT WAS NOT CHECKED LEADS whenever anything was not. "0 findings" over ten checks nobody ran is
 * the rental/logistics "Alerts 0" defect — an all-clear asserted on an unread board. The clean
 * verdict is printed only when the backend's own allClear is true, which is false while anything is
 * unchecked, so this cannot claim something nobody computed. `null` is no record at all, which is
 * not the same as nothing found.
 */
export function checkSummaryLine(sum: any): { text: string; color: string } | null {
  if (!sum || typeof sum !== 'object') return null;
  const findings = Number(sum.findings) || 0;
  const notRun = Number(sum.notRun) || 0;
  if (sum.allClear === true) {
    return { text: '✓ every check ran, nothing found', color: 'var(--green)' };
  }
  if (notRun > 0) {
    return {
      text: notRun + ' not checked' + (findings ? ' · ' + findings + ' finding(s)' : ''),
      color: 'var(--amber)',
    };
  }
  return { text: findings + ' finding(s)', color: findings ? 'var(--red)' : 'var(--faint)' };
}

/**
 * Does this package read describe the revision we are waiting for?
 *
 * WHY THE QUESTION EXISTS. regenerateFeature returns the NEW revision's id, but the run reports
 * status DONE and only THEN materialises its scenes and switches scriptDocument.activeRevisionId
 * (service :5712-5717). developmentPackage reads the active revision, so a read fired the moment
 * DONE appears can describe the PREVIOUS revision — and on an 85-scene script materialiseScenes is
 * not instant. Showing that read is worse than showing nothing: it reports the old draft's checks
 * under the new draft's pages, and nothing on screen says which.
 *
 * With no expected id (the ordinary page load) whatever is active is the right answer.
 */
export function isRevisionReady(script: any, expectRev?: string | null): boolean {
  const want = String(expectRev || '').trim();
  if (!want) return true;
  const got = String((script && script.revisionId) || '').trim();
  return !!got && got === want;
}
