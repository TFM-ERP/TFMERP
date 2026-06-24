/**
 * ScripON development-package → document model (pure, dependency-free).
 *
 * buildPackageDocModel() turns the developmentPackage() service payload into a plain-JS
 * document tree (title/eyebrow/logline + ordered sections of typed blocks). It is a faithful
 * server-side mirror of the frontend dossierHtml() so the Word (.docx) export matches the PDF
 * dossier section-for-section. Keeping it pure (no `docx` dependency, no I/O) makes it unit
 * testable; the thin packDocx() adapter renders this tree into a real .docx buffer.
 *
 * i18n: pass `labels` (section headings / meta keys / stage titles) so the localized UI and the
 * exported document stay in parity. Anything omitted falls back to the English defaults.
 */

export type MetaTableBlock = { kind: 'metaTable'; rows: Array<[string, string]> };
export type SpineBlock = { kind: 'spine'; rungs: Array<{ title: string; body: string }> };
export type CharactersBlock = { kind: 'characters'; items: Array<{ name: string; role: string; tagline: string; coreIdentity: string; arc: string }> };
export type ListBlock = { kind: 'list'; items: string[] };
export type ParagraphBlock = { kind: 'paragraph'; text: string };
export type DocBlock = MetaTableBlock | SpineBlock | CharactersBlock | ListBlock | ParagraphBlock;
export type DocSection = { heading: string; blocks: DocBlock[] };
export interface PackageDoc {
  title: string;
  eyebrow: string;
  logline: string;
  sections: DocSection[];
}

export interface PackageDocLabels {
  sections?: Partial<Record<'overview' | 'spine' | 'characters' | 'market' | 'coverage', string>>;
  meta?: Partial<Record<'format' | 'length' | 'periodLocale' | 'languageMarket' | 'framework' | 'budgetTier' | 'scenesLocations' | 'status', string>>;
  stages?: Record<string, string>;
  misc?: Partial<Record<'pages' | 'contemporary' | 'verdict' | 'draft' | 'promoted' | 'dash', string>>;
}

const FMT_LABEL: Record<string, string> = { MOVIE: 'Feature', FEATURE: 'Feature', FILM: 'Feature', TV_SERIES: 'Series', SERIES: 'Series', LIMITED: 'Limited series', VERTICAL: 'Vertical', SHORT: 'Short', TVC: 'Commercial' };
const FW_LABEL: Record<string, string> = { vogler: "The Hero's Journey", hero: "The Hero's Journey", heros_journey: "The Hero's Journey", save_the_cat: 'Save the Cat', stc: 'Save the Cat', three_act: '3-Act', dan_harmon: 'Story Circle', story_circle: 'Story Circle', sequence: 'Sequence Method', truby: 'Truby 22 Steps', kishotenketsu: 'Kishōtenketsu', sequence_method: 'Sequence Method' };
const STAGE_TITLES: Record<string, string> = { LOGLINE: 'Logline', SYNOPSIS: 'Synopsis', SEASON_ARC: 'Season arc', EPISODE_MAP: 'Episode map', PREMISE: 'Premise', STORY_ENGINE: 'Story engine', BEAT_ENGINE: 'Beat engine', TREATMENT: 'Treatment', BEATS: 'Beats', SCENES: 'Scenes', STEP_OUTLINE: 'Step outline', DRAFT: 'Draft', THESIS: 'Thesis', RESEARCH_PLAN: 'Research plan', RIGHTS_PLAN: 'Rights plan', INTERVIEW_OUTLINE: 'Interview outline', PAPER_EDIT: 'Paper edit', NARRATION: 'Narration', COVERAGE: 'Coverage' };

const DEFAULT_LABELS = {
  sections: { overview: 'Overview', spine: 'Development spine', characters: 'Characters', market: 'Market & Comps', coverage: 'Coverage' },
  meta: { format: 'Format', length: 'Length', periodLocale: 'Period · Locale', languageMarket: 'Language · Market', framework: 'Framework', budgetTier: 'Budget tier', scenesLocations: 'Scenes · Locations', status: 'Status' },
  misc: { pages: 'pages', contemporary: 'Contemporary', verdict: 'Verdict', draft: 'Draft', promoted: 'Promoted', dash: '—' },
};

const arr = (v: any): any[] => (Array.isArray(v) ? v : []);
const txt = (v: any): string => (typeof v === 'string' ? v : '');

/** Unwrap an AI body that was stored as `{ "output": "..." }` JSON; otherwise return the trimmed text. */
function clean(body: any): string {
  let s = String(body == null ? '' : body).trim();
  if (/^[[{]/.test(s)) {
    try { const j: any = JSON.parse(s); if (typeof j.output === 'string') return j.output; } catch { /* not JSON — keep as-is */ }
  }
  return s;
}

function fwName(v: any): string {
  const k = String(v || '').toLowerCase().replace(/[\s-]+/g, '_');
  return v ? (FW_LABEL[k] || String(v)) : '';
}

export function buildPackageDocModel(pkg: any, labels?: PackageDocLabels): PackageDoc {
  const p: any = pkg || {};
  const L = {
    sections: { ...DEFAULT_LABELS.sections, ...(labels?.sections || {}) },
    meta: { ...DEFAULT_LABELS.meta, ...(labels?.meta || {}) },
    stages: { ...STAGE_TITLES, ...(labels?.stages || {}) },
    misc: { ...DEFAULT_LABELS.misc, ...(labels?.misc || {}) },
  };
  const dash = L.misc.dash;

  const build: any = p.build || null;
  const project: any = p.project || {};
  const script: any = p.script || {};
  const brief: any = p.brief || {};
  const sp: any = brief.spine || {};
  const cov: any = p.coverage || {};
  const stages: any = p.stages || {};
  const st = (k: string): any => stages[k] || {};

  const title = (build && build.name) || project.title || 'Development package';

  // ── eyebrow + meta wiring (mirrors the frontend's "robust meta" block) ──
  const fmtLabel = FMT_LABEL[String(brief.projectType || '').toUpperCase()] || brief.projectType || 'Feature';
  const isFeature = /feature|movie|film/i.test(String(fmtLabel));
  const pageCount = script.pageCount;
  const actsLabel = isFeature ? '3-act' : txt(brief.format);
  const fmtCell = [fmtLabel, actsLabel].filter(Boolean).join(' · ');
  const eyebrow = [fmtLabel, actsLabel, pageCount ? '~' + pageCount + ' pp' : ''].filter(Boolean).join(' · ');

  const setting = Array.isArray(brief.settingPlace) ? brief.settingPlace.join(', ') : txt(brief.settingPlace);
  const framework = fwName(sp.framework || st('BEATS').framework || st('STEP_OUTLINE').framework || brief.framework || brief.beatsFramework) || dash;
  const period = cov.time || brief.settingEra || brief.cultureEra || '';
  const locale = cov.locale || setting || txt(brief.settingCountry) || '';
  const periodLocale = [period, locale].filter(Boolean).join(' · ') || (brief.projectType ? L.misc.contemporary : dash);
  const langMarket = [brief.language, brief.country].filter(Boolean).join(' · ') || dash;
  const facts: any = cov.facts || {};
  const scenes = arr(st('SCENES').data && st('SCENES').data.scenes);

  const metaRows: Array<[string, string]> = [
    [L.meta.format, fmtCell || dash],
    [L.meta.length, pageCount ? '~' + pageCount + ' ' + L.misc.pages : (clean(st('DRAFT').body) ? L.misc.draft : dash)],
    [L.meta.periodLocale, periodLocale],
    [L.meta.languageMarket, langMarket],
    [L.meta.framework, framework],
    [L.meta.budgetTier, brief.budgetTier || dash],
    [L.meta.scenesLocations, (facts.sceneCount || scenes.length || dash) + ' · ' + (facts.locationCount || dash)],
    [L.meta.status, (build && build.status) || L.misc.promoted],
  ];

  const logline = clean(st('LOGLINE').body) || cov.logline || '';

  const sections: DocSection[] = [
    { heading: L.sections.overview, blocks: [{ kind: 'metaTable', rows: metaRows }] },
  ];

  // ── development spine (only ladder stages that actually have a body) ──
  const ladder: string[] = Array.isArray(p.ladder) && p.ladder.length ? p.ladder : Object.keys(stages);
  const rungs = ladder
    .map((k) => ({ k, body: clean(st(k).body) }))
    .filter((r) => r.body)
    .map((r) => ({ title: L.stages[r.k] || r.k, body: r.body.slice(0, 1600) + (r.body.length > 1600 ? '…' : '') }));
  if (rungs.length) sections.push({ heading: L.sections.spine, blocks: [{ kind: 'spine', rungs }] });

  // ── characters (bible preferred over coverage characters; cap 9) ──
  const bible: any[] = arr(p.characterBible);
  const chars = (bible.length ? bible : arr(cov.characters)).slice(0, 9).map((c: any) => ({
    name: txt(c.name), role: txt(c.role), tagline: txt(c.tagline), coreIdentity: txt(c.coreIdentity), arc: txt(c.arc),
  }));
  if (chars.length) sections.push({ heading: L.sections.characters, blocks: [{ kind: 'characters', items: chars }] });

  // ── market & comps (coverage preferred over brief; cap 8) ──
  const compsSrc = arr(cov.comps).length ? arr(cov.comps) : arr(brief.comps).map((c: any) => (typeof c === 'string' ? { title: c } : c));
  const comps = compsSrc.slice(0, 8).map((c: any) => {
    const yr = c.year ? ' (' + c.year + ')' : '';
    const why = c.reason || c.rationale ? ' — ' + (c.reason || c.rationale) : '';
    return txt(c.title) + yr + why;
  }).filter((s: string) => s.trim());
  if (comps.length) sections.push({ heading: L.sections.market, blocks: [{ kind: 'list', items: comps }] });

  // ── coverage (verdict + synopsis/note) ──
  const covBody = clean(cov.synopsis) || clean(cov.note) || '';
  if (covBody) {
    const verdict = cov.recommendation ? L.misc.verdict + ': ' + cov.recommendation + '. ' : '';
    sections.push({ heading: L.sections.coverage, blocks: [{ kind: 'paragraph', text: verdict + covBody }] });
  }

  return { title, eyebrow, logline, sections };
}
