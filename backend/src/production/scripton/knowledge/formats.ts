/**
 * ScripON knowledge · FORMAT ENGINE
 * ---------------------------------
 * Project type (+ market) re-wires the whole develop pipeline. This file is the contract the
 * generator consumes: stageLadderFor(brief) decides WHICH stages exist; formatDirective(brief)
 * tells the writer the episode/length/act/arc shape. Guideline: docs/knowledge-base/scripon/
 * 00-format-engine.md and 02-episode-formats.md.
 *
 * Pure + defensive: unknown inputs resolve to the FEATURE shape, never throw.
 */

export type StageKind =
  | 'LOGLINE' | 'SYNOPSIS' | 'TREATMENT' | 'BEATS' | 'SCENES' | 'STEP_OUTLINE' | 'DRAFT' | 'COVERAGE'
  // series
  | 'SEASON_ARC' | 'EPISODE_MAP'
  // vertical
  | 'PREMISE' | 'STORY_ENGINE' | 'BEAT_ENGINE'
  // documentary
  | 'THESIS' | 'RESEARCH_PLAN' | 'RIGHTS_PLAN' | 'INTERVIEW_OUTLINE' | 'PAPER_EDIT' | 'NARRATION';

/** The classic feature ladder — also used for SHORT. */
export const FEATURE_LADDER: StageKind[] = ['LOGLINE', 'SYNOPSIS', 'TREATMENT', 'BEATS', 'SCENES', 'STEP_OUTLINE', 'DRAFT', 'COVERAGE'];
/** Series adds a season arc + an episode map before per-episode beats/scenes. */
export const SERIES_LADDER: StageKind[] = ['LOGLINE', 'SYNOPSIS', 'SEASON_ARC', 'EPISODE_MAP', 'TREATMENT', 'BEATS', 'SCENES', 'STEP_OUTLINE', 'DRAFT', 'COVERAGE'];
/** Vertical: a pre-loaded premise + story engine, a long episode map, and a per-episode beat engine. */
export const VERTICAL_LADDER: StageKind[] = ['PREMISE', 'STORY_ENGINE', 'EPISODE_MAP', 'BEAT_ENGINE', 'SCENES', 'DRAFT', 'COVERAGE'];
/** Documentary is written in the edit — no dialogue beats; narration comes LAST. */
export const DOC_LADDER: StageKind[] = ['THESIS', 'TREATMENT', 'RESEARCH_PLAN', 'RIGHTS_PLAN', 'INTERVIEW_OUTLINE', 'PAPER_EDIT', 'NARRATION', 'COVERAGE'];

export interface FormatPreset {
  id: string;
  family: 'FEATURE' | 'SHORT' | 'SERIES' | 'VERTICAL' | 'DOCUMENTARY';
  label: string;
  ladder: StageKind[];
  episodes?: number | [number, number];
  lengthLabel: string;
  actTemplate: string;
  arcModel: string;
  terminology?: string;
  notes?: string;
}

/** Feature / short / generic documentary defaults (market-agnostic). */
export const BASE_PRESETS: Record<string, FormatPreset> = {
  FEATURE: { id: 'FEATURE', family: 'FEATURE', label: 'Feature film', ladder: FEATURE_LADDER, episodes: 1, lengthLabel: '~90–120 min (one continuous story, NOT episodic)', actTemplate: '3-act', arcModel: 'single protagonist arc' },
  SHORT: { id: 'SHORT', family: 'SHORT', label: 'Short film', ladder: FEATURE_LADDER, episodes: 1, lengthLabel: 'under ~40 min, single story', actTemplate: 'compressed 3-act / single-turn', arcModel: 'one decisive change' },
  DOCUMENTARY: { id: 'DOCUMENTARY', family: 'DOCUMENTARY', label: 'Documentary', ladder: DOC_LADDER, lengthLabel: 'feature ~70–110 min or series', actTemplate: 'thesis-driven, written in the edit', arcModel: 'argument / investigation, not dialogue beats', notes: 'see documentary.ts for subgenre × mode' },
};

/**
 * Series presets keyed by MARKET. Each carries the real-world episode count, length, act
 * template, arc model and terminology. Sources: docs/knowledge-base/scripon/02-episode-formats.md
 */
export const SERIES_PRESETS: Record<string, FormatPreset> = {
  US_STREAMING: { id: 'US_STREAMING', family: 'SERIES', label: 'US streaming drama', ladder: SERIES_LADDER, episodes: [6, 13], lengthLabel: '45–75 min/ep', actTemplate: 'continuous (no commercial acts)', arcModel: 'serialized season arc', terminology: 'Season' },
  US_NETWORK: { id: 'US_NETWORK', family: 'SERIES', label: 'US network hour', ladder: SERIES_LADDER, episodes: 22, lengthLabel: '~44 min/ep', actTemplate: 'Teaser + 5 acts (ABC = 6)', arcModel: 'episodic-of-the-week + light serialization', terminology: 'Season; act-outs before breaks' },
  UK: { id: 'UK', family: 'SERIES', label: 'UK / BBC drama', ladder: SERIES_LADDER, episodes: [3, 8], lengthLabel: '~58 min/ep', actTemplate: 'continuous', arcModel: 'tight serialized', terminology: 'Series (not Season)' },
  KDRAMA: { id: 'KDRAMA', family: 'SERIES', label: 'K-drama', ladder: SERIES_LADDER, episodes: [12, 16], lengthLabel: '60–70 min/ep', actTemplate: 'per-episode arc + mid-episode hook', arcModel: 'romance/melodrama spine, finite', terminology: 'live-shoot (later eps mutable) vs pre-produced (locked)' },
  TURKISH_DIZI: { id: 'TURKISH_DIZI', family: 'SERIES', label: 'Turkish dizi', ladder: SERIES_LADDER, episodes: 36, lengthLabel: '120–150 min/ep (home cut)', actTemplate: 'novelistic, multi-strand', arcModel: 'expansive family/romance saga', terminology: 'export re-cut ×3 @ ~45 min' },
  TELENOVELA: { id: 'TELENOVELA', family: 'SERIES', label: 'Telenovela', ladder: SERIES_LADDER, episodes: [80, 200], lengthLabel: '~45 min daily', actTemplate: 'daily cliffhanger', arcModel: 'finite melodrama with a definite END', terminology: 'capítulos' },
  ANIME: { id: 'ANIME', family: 'SERIES', label: 'Anime', ladder: SERIES_LADDER, episodes: [12, 13], lengthLabel: '~24 min/ep', actTemplate: 'OP/ED + eyecatch (A/B parts)', arcModel: 'per-cour arc', terminology: '1 cour = 12–13; 2 cours = 24–26' },
  RAMADAN_MUSALSAL: { id: 'RAMADAN_MUSALSAL', family: 'SERIES', label: 'Ramadan musalsal (MENA)', ladder: SERIES_LADDER, episodes: 30, lengthLabel: '30–45 min/ep, nightly', actTemplate: 'nightly closed beat + season hook', arcModel: 'closed 30-episode arc across the month', terminology: 'حلقة/ḥalqa; airs nightly in Ramadan' },
  NORDIC_NOIR: { id: 'NORDIC_NOIR', family: 'SERIES', label: 'Nordic noir', ladder: SERIES_LADDER, episodes: [8, 10], lengthLabel: '~58 min/ep', actTemplate: 'continuous, slow-burn', arcModel: 'single investigation across the season', terminology: 'Series' },
};

/** Vertical presets — global default vs the MENA Verticals model. See vertical.ts for the craft. */
export const VERTICAL_PRESETS: Record<string, FormatPreset> = {
  GLOBAL: { id: 'GLOBAL', family: 'VERTICAL', label: 'Vertical micro-drama (global)', ladder: VERTICAL_LADDER, episodes: [60, 100], lengthLabel: '60–90 s/ep (cap ~2 min)', actTemplate: 'per-episode Beat Engine: Hook · Friction · Spike · Button', arcModel: 'paywall-aware; reversal engine; mandatory per-episode cliffhanger', terminology: '9:16 face-first framing' },
  MENA: { id: 'MENA', family: 'VERTICAL', label: 'Vertical micro-drama (MENA)', ladder: VERTICAL_LADDER, episodes: [40, 80], lengthLabel: '60–90 s/ep (→120 when needed)', actTemplate: 'scenic objective + power/info shift + escalation + final hook', arcModel: 'Addiction Loop (yes-but / no-also); Arabic-first; romance within social constraints', terminology: '8 episode templates · 8 story engines (see vertical.ts)' },
};

const lc = (v: any) => String(v == null ? '' : v).trim().toLowerCase();
const up = (v: any) => String(v == null ? '' : v).trim().toUpperCase();

/** Canonical family from the messy projectType field. */
export function normalizeFamily(brief: any): FormatPreset['family'] {
  const t = up(brief && (brief.projectType || brief.format));
  if (/VERT|MICRO|SHORT_?FORM|REEL/.test(t)) return 'VERTICAL';
  if (/DOC/.test(t)) return 'DOCUMENTARY';
  if (/SERIES|TV|LIMITED|SEASON|EPISOD|MUSALSAL|DIZI|DRAMA_SERIES/.test(t)) return 'SERIES';
  if (/SHORT/.test(t)) return 'SHORT';
  return 'FEATURE';
}

/** Map a brief's country/market/language to a market key used by SERIES/VERTICAL presets. */
export function normalizeMarket(brief: any): string {
  const hay = lc([brief && brief.market, brief && brief.country, brief && brief.language, brief && brief.region].filter(Boolean).join(' '));
  if (/musalsal|ramadan/.test(hay)) return 'RAMADAN_MUSALSAL';
  if (/dizi|turk|türk/.test(hay)) return 'TURKISH_DIZI';
  if (/korea|k-?drama|hangul|한/.test(hay)) return 'KDRAMA';
  if (/telenovela|novela|latam|mexic|brazil|colombia/.test(hay)) return 'TELENOVELA';
  if (/anime|japan|日本|manga/.test(hay)) return 'ANIME';
  if (/nordic|sweden|denmark|norway|finland|noir/.test(hay)) return 'NORDIC_NOIR';
  if (/\buk\b|britain|british|bbc|england|ireland/.test(hay)) return 'UK';
  if (/network|broadcast|abc|nbc|cbs/.test(hay)) return 'US_NETWORK';
  if (/mena|gcc|ksa|saudi|uae|emirat|gulf|khaleej|arab|egypt|عرب|عربي/.test(hay)) return 'MENA';
  return 'US_STREAMING';
}

/** True when the brief points at the Arab/MENA market or Arabic language. */
export function isMena(brief: any): boolean {
  const hay = lc([brief && brief.market, brief && brief.country, brief && brief.language, brief && brief.region].filter(Boolean).join(' '));
  return /mena|gcc|ksa|saudi|uae|emirat|gulf|khaleej|arab|egypt|عرب|عربي|ar\b/.test(hay) || lc(brief && brief.language) === 'arabic' || lc(brief && brief.language) === 'ar';
}

/** Resolve the active preset for a brief (format family + market). */
export function pickPreset(brief: any): FormatPreset {
  const fam = normalizeFamily(brief);
  if (fam === 'SERIES') return SERIES_PRESETS[normalizeMarket(brief)] || SERIES_PRESETS.US_STREAMING;
  if (fam === 'VERTICAL') return isMena(brief) ? VERTICAL_PRESETS.MENA : VERTICAL_PRESETS.GLOBAL;
  if (fam === 'DOCUMENTARY') return BASE_PRESETS.DOCUMENTARY;
  if (fam === 'SHORT') return BASE_PRESETS.SHORT;
  return BASE_PRESETS.FEATURE;
}

/** THE LADDER — which develop stages exist for this build. Replaces the fixed STAGE_ORDER. */
export function stageLadderFor(brief: any): StageKind[] {
  return pickPreset(brief).ladder.slice();
}

function epLabel(p: FormatPreset): string {
  if (p.episodes == null) return '';
  if (Array.isArray(p.episodes)) return p.episodes[0] + '–' + p.episodes[1] + ' episodes';
  return p.episodes === 1 ? 'single' : p.episodes + ' episodes';
}

/**
 * The format steering directive — appended inside intakeSteer. Tells the writer the structural
 * shape so beats/treatment/scene plans match the real-world format, not a default feature.
 */
export function formatDirective(brief: any): string {
  const p = pickPreset(brief);
  const ep = epLabel(p);
  const bits = [
    'FORMAT: ' + p.label + '.',
    ep ? 'Structure as ' + ep + (brief && brief.episodes && !Array.isArray(p.episodes) ? '' : (brief && brief.episodes ? ' (target ' + brief.episodes + ')' : '')) + ', ' + p.lengthLabel + '.' : p.lengthLabel + '.',
    'Act template: ' + p.actTemplate + '.',
    'Arc model: ' + p.arcModel + '.',
  ];
  if (p.terminology) bits.push('Terminology / production note: ' + p.terminology + '.');
  if (p.family !== 'FEATURE' && p.family !== 'SHORT') bits.push('Do NOT shape this like a single feature film — honour the episodic/format structure above end-to-end.');
  return bits.join(' ');
}
