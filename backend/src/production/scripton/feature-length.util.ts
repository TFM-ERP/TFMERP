/**
 * Feature length budgeting — the arithmetic that decides how long a generated script actually is.
 *
 * WHY THIS EXISTS. The generator used to size a feature with `Math.min(90, Math.max(55, beatN * 1.5))`
 * — 60 scenes by default, capped at 90 — and told the scene writer that one page was "roughly 8 to 16
 * short lines". Both are wrong, and they compound:
 *
 *   - Across 12,000+ produced screenplays the average feature holds ~110 scenes against a median of
 *     106 pages (action ~131, comedy ~98). A ceiling of 90 sits below the average feature.
 *   - A standard 12pt Courier page is 55 lines, which is exactly what `paginate()` counts. Eight to
 *     sixteen lines is a FIFTH of a page.
 *
 *   60 scenes x ~15 lines (heading + blanks included) ~= 900 lines ~= 16 pages, filed as DONE.
 *
 * THE FIX. Budget PAGES, not scenes. A page target (from the brief, or the genre default) drives the
 * scene count; every planned scene carries an explicit page allocation that sums back to the target;
 * the scene writer is told how many lines that allocation buys. Real features are not uniform one-page
 * scenes — they run from quarter-page cutaways to three-page set pieces — so a flat per-scene length is
 * wrong even at the right count.
 *
 * Pure functions only: no Nest, no Prisma, no AI. Tested directly in feature-length.util.spec.ts.
 */

/** Lines on a standard 12pt Courier screenplay page. MUST stay equal to ScripOnService.paginate()'s `per`. */
import { normalizeFamily } from './knowledge/formats';

export const LINES_PER_PAGE = 55;

/** Visual wrap width used by paginate() when converting a raw line into page lines. */
export const WRAP_CHARS = 58;

/**
 * THE FEATURE BAND: 90 to 115 pages. A stated product constraint, not a guideline.
 *
 * The ceiling was 120, which let MAX_COMPLETION_RATIO file a 105-page target as complete at 121 —
 * six pages outside the band. isLengthOver now enforces MAX_TARGET_PAGES absolutely, so no ratio
 * against any target can produce a draft above it.
 */
export const DEFAULT_TARGET_PAGES = 105;
export const MIN_TARGET_PAGES = 90;
export const MAX_TARGET_PAGES = 115;

/** A finished draft below this fraction of its page target is NOT complete, whatever the ending says. */
export const MIN_COMPLETION_RATIO = 0.9;

/** ...and above this fraction it is not a feature either. 105 pages * 1.15 = ~121. */
export const MAX_COMPLETION_RATIO = 1.15;

/**
 * Words on a standard screenplay page.
 *
 * WHY THIS EXISTS: the scene writer was told to hit a LINE count and missed it by ~50% every time
 * (126 scenes budgeted at ~0.8 pages each came back at 1.5). Models count words far better than they
 * count lines — lines depend on wrapping they cannot see. The line figure is still reported because
 * paginate() thinks in lines, but the instruction the model is given now leads with words.
 *
 * MEASURED, not guessed. The 31 Aug MINUTEMEN draft: 203,837 characters over 207 rendered pages =
 * 985 chars/page (inside the verified 900-1,100 band for 12pt Courier), and 6.11 chars per word.
 * 985 / 6.11 = 161 words per page. The previous value of 190 was an 18% overshoot baked into the
 * arithmetic: converting a page allocation into a word budget at 190 handed out nearly a fifth more
 * words than a page can physically hold, before the model wrote anything wrong. 165 is the measured
 * figure rounded up slightly, since a more dialogue-heavy script (dialogue is indented and narrow,
 * so it holds FEWER words per page) will sit below this, not above.
 *
 * ── 2 SEP: RE-FITTED FOR US LETTER ──────────────────────────────────────────────────────────────
 *
 * The 985 chars/page above was measured on an A4 export. The export is now US Letter, which has a
 * shorter text column — 9in against A4's 9.96in — and the figure scales with it and nothing else:
 *
 *     985 chars/page x (9 / 9.96) = 890 chars/page
 *     890 / 6.11 chars per word   = 146 words per page
 *
 * 149 keeps the same slight rounding up as before, for the same reason: a dialogue-heavy script
 * holds fewer words per page than the average, so the budget should sit at the top of the range
 * rather than the middle. PAGE_BUDGET in scripton.service.ts moved from 61 to 55 in the same
 * change. These two describe one physical page between them — move them together or the word
 * budget and the page budget drift apart, which is the arithmetic that produced 190 in the first
 * place.
 */
export const WORDS_PER_PAGE = 149;

/** The page allocations a scene may be given. Anything else is snapped to the nearest of these. */
export const PAGE_WEIGHTS: number[] = [0.25, 0.5, 1, 1.5, 2, 3];

/** Never ask for fewer lines than this — below it the model returns a fragment, not a scene. */
export const MIN_SCENE_LINES = 6;

/**
 * Tokens per word for screenplay text. MEASURED on the 31 Aug MINUTEMEN draft: 203,837 chars /
 * 33,349 words = 6.11 chars per word, and screenplay text tokenizes at roughly 3.5 chars/token
 * (uppercase cues, short lines and heavy punctuation all tokenize worse than running prose).
 * 6.11 / 3.5 = 1.75. Prose would be nearer 1.3 — do not substitute the prose figure here.
 */
export const TOKENS_PER_WORD = 1.75;

/**
 * How far above the intended output the cap sits.
 *
 * THIS IS A RUNAWAY GUARD, NOT A LENGTH CONTROL. Do not lower it to force scenes shorter.
 * `max_tokens` is not a budget the model negotiates with — it is the point where the API stops
 * emitting, mid-word if that is where the count lands. A cap tight enough to squeeze a 236-word
 * scene down to 138 words does not produce a shorter scene; it produces a scene that stops in the
 * middle of a speech. A truncated scene is worse than a long one: the draft is unreadable at that
 * point and the story loses its turn.
 *
 * So the value is set from what the model ACTUALLY writes, not from what we asked for. Measured
 * delivery on the 31 Aug draft was OBSERVED_OVERRUN (1.67x the word budget); 2.5x the intended
 * output leaves ~50% margin above that, which is loose enough that ordinary writing never reaches
 * it and tight enough to stop a genuine runaway from burning the run's budget.
 *
 * Length is controlled by the PLAN (how many scenes, at what page weight) and, where a scene still
 * overruns, by asking the model to compress it in a second pass — both of which let the model close
 * the scene itself. Never by the ceiling.
 */
export const CAP_HEADROOM = 2.5;

/**
 * What the model actually delivered against its word budget on the 31 Aug MINUTEMEN draft:
 * 236 words/scene against 141 budgeted. Recorded so CAP_HEADROOM can be reasoned about against
 * real behaviour instead of intent, and so the guard is provably above it.
 */
export const OBSERVED_OVERRUN = 1.67;

/**
 * How much MORE than the requested word count the model actually delivers.
 *
 * This is the whole remaining length defect, and it is a calibration problem, not a discipline
 * problem. Measured on the 31 Aug MINUTEMEN draft: 105 pages were planned at the then-current
 * 190 words/page = 19,950 words budgeted; 32,132 words came back. 32,132 / 19,950 = 1.61.
 *
 * Crucially the model is NOT ignoring the instruction — it tracks it. Scene word counts came back
 * cleanly bimodal (99 scenes clustered at ~134 words, 40 at ~464, and only 3 scenes in the whole
 * 200-349 gap between them), which is exactly the two page allocations the planner handed out. It
 * follows the direction and overshoots the magnitude, by a roughly constant factor.
 *
 * So the fix is to ask for less, not to cap harder: request budget / DELIVERY_FACTOR and the scene
 * lands on budget. Nothing is truncated, no second pass is needed, and it costs nothing.
 *
 * MEASURED, 31 Aug, 65 scenes of scene.len telemetry from a run at DELIVERY_FACTOR = 1.6:
 *
 *   weight    n   ask  budget  got   got/ask
 *     0.25   13    45      60   54      1.21
 *     0.5    36    52      83   68      1.31
 *     1.5    16   155     248  213      1.38
 *   ------------------------------------------------
 *   all 65 scenes: asked 4937, budgeted 7736, delivered 6579
 *     delivered / asked  = 1.333
 *     delivered / budget = 0.850   (the draft ran 15% short)
 *
 * 1.6 asked for too little. Correcting linearly, 1.6 x 0.850 = 1.36 — and an independent fit against
 * the earlier uncorrected run (ask 141 -> got 228, versus ask 57 -> got 71, implying a mildly
 * super-linear response) lands on 1.36 as well. Two methods, one answer, so 1.36 it is.
 *
 * The factor rises gently with ask size (1.21 -> 1.38 across a 3.4x range), so it is very nearly a
 * constant rather than a curve; a single divisor is the right shape. If a future run shows the
 * spread widening, that is the signal to make it a function of wordsBudget.
 *
 * KEEP MEASURING. writeScene logs every scene; after a run, group scene.len by w= and check that
 * delivered/budget sits near 1.00. Prefer erring high (short draft) over low: expandShortScenes can
 * top a short draft up, and nothing trims a long one.
 */
export const DELIVERY_FACTOR = 1.36;

/**
 * Never ask for fewer words than this, however small the allocation. Dividing a 60-word budget by
 * DELIVERY_FACTOR gives 38, and below roughly this figure the model stops writing a scene and
 * starts writing a fragment. The observed floor on the 31 Aug draft was a 46-word scene.
 */
export const MIN_ASK_WORDS = 45;

/**
 * Absolute floor for the cap — a safety net, not a policy. The derived formula already exceeds it
 * at every allowed page weight, so this only catches a future change that drives the word budget
 * near zero. Keep it BELOW the smallest derived value: a floor that binds is a silent truncator.
 */
export const MIN_SCENE_TOKENS = 160;

export interface GenreLengthProfile {
  key: string;
  /** Scenes per page. Measured: 1.04 overall, ~1.25 action, ~0.93 comedy. */
  sceneDensity: number;
  /** Pages per minute of screen time. Measured mean 1.1 (a page runs ~55 seconds). */
  pagesPerMinute: number;
  /** Page target when the brief does not state one. */
  defaultPages: number;
}

/**
 * Genre profiles. sceneDensity and pagesPerMinute are derived from published analyses of produced
 * screenplays; defaultPages is the genre's typical length. Genres not listed fall back to DEFAULT.
 *
 * defaultPages USED TO BE 105 for ACTION, THRILLER, DRAMA, ROMANCE and MUSICAL alike, which is how
 * two unrelated films — MINUTEMEN (thriller) and JASON QUICK — were handed the identical target and
 * delivered 103 and 100 pages. The intake collects no length for a MOVIE, so every one of those
 * builds fell through briefTargetPages to this number. Spread now, so an untouched build at least
 * varies by genre.
 *
 * The spread is the SMALLER half of that fix. Two thrillers still share a default, correctly — the
 * real repair is that the intake now asks, and an explicit targetPages always wins over this table.
 */
const GENRE_PROFILES: GenreLengthProfile[] = [
  { key: 'ACTION', sceneDensity: 1.25, pagesPerMinute: 0.99, defaultPages: 102 },
  { key: 'THRILLER', sceneDensity: 1.15, pagesPerMinute: 1.02, defaultPages: 100 },
  { key: 'COMEDY', sceneDensity: 0.93, pagesPerMinute: 1.15, defaultPages: 106 },
  { key: 'DRAMA', sceneDensity: 1.04, pagesPerMinute: 1.12, defaultPages: 108 },
  { key: 'HORROR', sceneDensity: 1.06, pagesPerMinute: 1.05, defaultPages: 98 },
  { key: 'HISTORICAL', sceneDensity: 1.04, pagesPerMinute: 1.10, defaultPages: 110 },
  { key: 'ROMANCE', sceneDensity: 0.98, pagesPerMinute: 1.12, defaultPages: 100 },
  { key: 'FANTASY', sceneDensity: 1.10, pagesPerMinute: 1.05, defaultPages: 110 },
  { key: 'SCIFI', sceneDensity: 1.10, pagesPerMinute: 1.05, defaultPages: 110 },
  { key: 'MUSICAL', sceneDensity: 1.00, pagesPerMinute: 0.90, defaultPages: 105 },
];

export const DEFAULT_GENRE_PROFILE: GenreLengthProfile = {
  key: 'DEFAULT', sceneDensity: 1.04, pagesPerMinute: 1.10, defaultPages: DEFAULT_TARGET_PAGES,
};

/** Keywords that map free-text genre labels (English or Arabic) onto a profile key. */
const GENRE_KEYWORDS: Array<[string, string[]]> = [
  ['ACTION', ['action', 'war', 'martial', 'heist', 'اكشن', 'أكشن', 'حرب']],
  ['THRILLER', ['thriller', 'crime', 'noir', 'spy', 'suspense', 'اثارة', 'إثارة', 'جريمة']],
  ['COMEDY', ['comedy', 'comic', 'sitcom', 'satire', 'كوميدي', 'كوميديا']],
  ['HORROR', ['horror', 'slasher', 'supernatural horror', 'رعب']],
  ['HISTORICAL', ['historical', 'history', 'period', 'epic', 'biopic', 'تاريخي', 'ملحمي', 'سيرة']],
  ['ROMANCE', ['romance', 'romantic', 'رومانسي', 'رومانسية']],
  ['FANTASY', ['fantasy', 'mythic', 'mythological', 'fairy', 'خيال', 'أسطوري', 'اسطوري']],
  ['SCIFI', ['sci-fi', 'scifi', 'science fiction', 'خيال علمي']],
  ['MUSICAL', ['musical', 'موسيقي', 'استعراضي']],
  ['DRAMA', ['drama', 'dramatic', 'دراما', 'درامي']],
];

function clamp(n: number, lo: number, hi: number): number {
  if (!isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/** Pull every genre-ish string off a build brief, lowercased. Handles the Json `genres` array. */
export function briefGenreTerms(brief: any): string[] {
  const out: string[] = [];
  const push = (v: any) => {
    if (typeof v === 'string' && v.trim()) out.push(v.trim().toLowerCase());
    else if (Array.isArray(v)) for (const x of v) push(x);
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) push(v[k]);
  };
  if (brief && typeof brief === 'object') {
    push(brief.genres); push(brief.genre); push(brief.subGenre); push(brief.tone); push(brief.projectIntent);
  }
  return out;
}

/**
 * Which length profile governs this brief. The FIRST matching keyword wins, scanning profiles in
 * declaration order, so a "historical action epic" resolves to ACTION (its scene volume dominates
 * the page maths) rather than to whichever term happened to be typed first.
 */
export function resolveGenreProfile(brief: any): GenreLengthProfile {
  const terms = briefGenreTerms(brief);
  if (!terms.length) return DEFAULT_GENRE_PROFILE;
  const hay = terms.join(' | ');
  for (const [key, words] of GENRE_KEYWORDS) {
    if (words.some((w) => hay.includes(w))) {
      const p = GENRE_PROFILES.find((g) => g.key === key);
      if (p) return p;
    }
  }
  return DEFAULT_GENRE_PROFILE;
}

export interface FeatureLengthPlan {
  genreKey: string;
  /** FEATURE, SHORT or DOCUMENTARY — which page band governed this plan. */
  formatKey: string;
  /** Pages the finished draft should reach. */
  targetPages: number;
  /** Screen-time estimate for display. Always present it as "approximately". */
  targetMinutes: number;
  /**
   * Scenes the page budget will carry. A CEILING derived from the pages-per-scene floor — NOT a
   * quota to fill. The planner may come in under it; it may not sail past it.
   */
  targetScenes: number;
  /** Pages a scene should average. The constraint `targetScenes` is derived from. */
  pagesPerScene: number;
  /** SPEC or PRODUCED. Decides whether the spec-corpus densities are used raw or damped. */
  texture: Texture;
  /**
   * Beats per scene implied by the developed outline. 0 when there is no outline yet.
   *
   * The outline used to FORCE the scene count — `max(fromPages, beatN)` — so a 130-beat outline
   * produced 130 scenes whatever the page budget said, and the prompt then asked for 1-3 scenes per
   * beat on top. Beats now share scenes instead: this number tells the planner how many to fold
   * together, and the page budget keeps its authority.
   */
  beatsPerScene: number;
  /** Upper bound on scenes accepted back from the planner (headroom over the target). */
  planCap: number;
  /** Lower bound the finished draft must clear to be filed as complete. */
  minPages: number;
  sceneDensity: number;
  pagesPerMinute: number;
}

/** Read an explicit page target off the brief, in any of the shapes the intake can produce. */
export function briefTargetPages(brief: any, pagesPerMinute: number): number | null {
  if (!brief || typeof brief !== 'object') return null;
  const direct = Number(brief.targetPages);
  if (isFinite(direct) && direct > 0) return direct;
  const mins = Number(brief.targetMinutes ?? brief.runtimeMinutes ?? brief.minutes);
  if (isFinite(mins) && mins > 0) return Math.round(mins * pagesPerMinute);
  // `length` is a free String on IntakeProfile — it may hold "110", "110 pages" or "~100 min".
  const raw = String(brief.length || '').trim();
  if (raw) {
    const n = Number((raw.match(/\d+/) || [])[0]);
    if (isFinite(n) && n > 0) {
      if (/min|minute|دقيقة|دقائق/i.test(raw)) return Math.round(n * pagesPerMinute);
      return n;
    }
  }
  return null;
}

/**
 * The whole length budget for one feature.
 *
 * `beatN` is NEITHER the driver NOR a floor any more. It was a floor — "every beat still has to be
 * dramatised, so a 130-beat outline forces at least 130 scenes" — which is true about COVERAGE and
 * false about SCENE COUNT: beats can share a scene, and over a fixed page budget they must. It is
 * now reported as `beatsPerScene` so the planner knows how much to fold, and the pages decide.
 */
export function planFeatureLength(brief: any, beatN = 0): FeatureLengthPlan {
  const g = resolveGenreProfile(brief);
  const band = resolveFormatBand(brief);
  const texture = resolveTexture(brief);
  const asked = briefTargetPages(brief, g.pagesPerMinute);
  // The band decides the range AND, for anything that is not a feature, the default. A short film
  // has no business collecting a feature's genre default and then being clamped up to ninety pages.
  const targetPages = Math.round(clamp(asked ?? (band.defaultPages ?? g.defaultPages), band.minPages, band.maxPages));
  const targetScenes = sceneCeilingFor(targetPages, g.sceneDensity, texture);
  const beats = Math.max(0, Math.round(beatN));
  return {
    genreKey: g.key,
    formatKey: band.key,
    targetPages,
    targetMinutes: Math.round(targetPages / g.pagesPerMinute),
    targetScenes,
    pagesPerScene: pagesPerSceneFloor(g.sceneDensity, texture),
    texture,
    // Reported, never enforced: how much folding the outline implies. 1 or below means the beats fit
    // one to a scene; 1.8 means the planner should expect to carry two beats in most scenes.
    beatsPerScene: beats > 0 && targetScenes > 0 ? Math.round((beats / targetScenes) * 100) / 100 : 0,
    // Headroom was 30%, which on a quota model meant a 131-scene ask could be answered with 170 and
    // accepted. Against a ceiling the headroom is a parser tolerance, not a licence.
    planCap: Math.ceil(targetScenes * 1.1),
    minPages: Math.round(targetPages * MIN_COMPLETION_RATIO),
    sceneDensity: g.sceneDensity,
    pagesPerMinute: g.pagesPerMinute,
  };
}

/**
 * FORMAT BANDS — a feature is not the only thing this system writes.
 *
 * The band used to be 90–115 for EVERYTHING, so a twenty-minute short was silently planned as a
 * ninety-page feature. The knowledge layer already knew better — `normalizeFamily` gives the family
 * and the format preset says "under ~40 min, single story" — and `knowledgeDirective` was already
 * telling the model "short film, under ~40 min" while the page budget contradicted it in the same
 * prompt. This makes the two agree.
 *
 * DOCUMENTARY is here for completeness only: that family routes to `generateDocumentaryAsync`, which
 * never calls this function. SERIES and VERTICAL likewise have their own writers, and fall back to
 * the feature band if they ever arrive here.
 */
export interface FormatBand {
  key: string;
  minPages: number;
  maxPages: number;
  /** null = let the genre profile decide, which is what a feature does. */
  defaultPages: number | null;
}

export const FORMAT_BANDS: Record<string, FormatBand> = {
  FEATURE: { key: 'FEATURE', minPages: MIN_TARGET_PAGES, maxPages: MAX_TARGET_PAGES, defaultPages: null },
  SHORT: { key: 'SHORT', minPages: 3, maxPages: 40, defaultPages: 12 },
  DOCUMENTARY: { key: 'DOCUMENTARY', minPages: 40, maxPages: 120, defaultPages: 90 },
};

export function resolveFormatBand(brief: any): FormatBand {
  let fam = 'FEATURE';
  try { fam = String(normalizeFamily(brief) || 'FEATURE'); } catch { fam = 'FEATURE'; }
  return FORMAT_BANDS[fam] || FORMAT_BANDS.FEATURE;
}

/**
 * TEXTURE — the single most consequential number in this file, and it used to be invisible.
 *
 * Every sceneDensity in the table below is measured against the FOLLOWS corpus: 12,309 SPEC scripts,
 * competition and query material. The other corpus, ScriptBase, measured 1,276 PRODUCED films:
 *
 *     Follows (spec):      110 scenes / 106 pages = 0.96 pages per scene
 *     ScriptBase (produced): ~80 scenes / ~110 pages = 1.4 pages per scene
 *
 * Produced screenplays run roughly 40% FEWER scenes per page than the corpus our constants came
 * from. Shipping the spec numbers as the default meant `sceneDensity 1.25 x defaultPages 105 = 131`
 * — and the planner then executed perfectly against a television number. 139 scenes came back and 93
 * of them ran under half a page. The planner was never broken. The target was.
 *
 * So texture is a SWITCH, not a silent edit, and PRODUCED is the default because a screenplay meant
 * to be shot should read like one that was.
 *
 * The 0.7 factor is not fitted to our drafts — it is the cross-corpus ratio — and it lands the scene
 * counts almost exactly on the produced corpus, which is the strongest evidence available that it is
 * the right number:
 *
 *     genre     ceiling at 105pp   ScriptBase produced (scaled to 105pp)
 *     ACTION    91                 97
 *     THRILLER  84                 88
 *     DRAMA     76                 76
 *     COMEDY    68                 63
 */
export type Texture = 'PRODUCED' | 'SPEC';

/** Produced films run ~30% fewer scenes per page than spec scripts. Multiplies scenes-per-page. */
export const PRODUCED_TEXTURE_FACTOR = 0.7;

/** SPEC only when the brief asks for it by name. Everything else is a film meant to be shot. */
export function resolveTexture(brief: any): Texture {
  const raw = String((brief && (brief.texture ?? brief.sceneTexture)) || '').trim().toUpperCase();
  return raw === 'SPEC' ? 'SPEC' : 'PRODUCED';
}

/** Scenes per page after texture. The number the planner is actually held to. */
export function effectiveSceneDensity(sceneDensity: number, texture: Texture): number {
  const d = Number(sceneDensity);
  const base = isFinite(d) && d > 0 ? d : DEFAULT_GENRE_PROFILE.sceneDensity;
  return base * (texture === 'SPEC' ? 1 : PRODUCED_TEXTURE_FACTOR);
}

/**
 * THE FLOOR. Density inverted: the pages a scene should average, not the scenes a page should hold.
 *
 * This is the whole point of the change. `targetScenes` was a QUOTA the planner was told to fill —
 * "expand the outline into 131-147 scenes ... do NOT compress it into fewer, longer ones" — and a
 * quota over a fixed page count is an instruction to fragment. Stated as a floor it becomes a
 * constraint on scene LENGTH, which is what a reader actually experiences, and the scene count falls
 * out of it as a ceiling rather than being aimed at.
 */
export function pagesPerSceneFloor(sceneDensity: number, texture: Texture): number {
  const d = effectiveSceneDensity(sceneDensity, texture);
  return Math.round((1 / d) * 100) / 100;
}

/** Below this a "plan" is not a story, whatever the arithmetic says. */
export const MIN_PLANNED_SCENES = 3;

/** Scenes the page budget will carry at this texture. A CEILING — floored, never rounded up. */
export function sceneCeilingFor(targetPages: number, sceneDensity: number, texture: Texture): number {
  const pages = Math.max(0, Number(targetPages) || 0);
  return Math.max(MIN_PLANNED_SCENES, Math.floor(pages * effectiveSceneDensity(sceneDensity, texture)));
}

/** Snap any number to the nearest allowed page allocation. Junk becomes 1 (a normal one-page scene). */
export function snapPageWeight(raw: any): number {
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return 1;
  let best = PAGE_WEIGHTS[0];
  let bestDist = Math.abs(n - best);
  for (const w of PAGE_WEIGHTS) {
    const d = Math.abs(n - w);
    if (d < bestDist) { best = w; bestDist = d; }
  }
  return best;
}

/**
 * Give every scene a page allocation whose total lands on the page target.
 *
 * The planner is asked for a `pageWeight` per scene, but models drift on arithmetic across a hundred
 * items, so the totals are rescaled here rather than trusted. Scenes with no usable weight start at 1.
 * After rescaling, any residual is spread one notch at a time over the scenes furthest from an extreme,
 * so the sum lands on target without pushing every scene to the same value.
 */
export function applyPageWeights<T extends { pageWeight?: any }>(scenes: T[], targetPages: number): T[] {
  const list = Array.isArray(scenes) ? scenes : [];
  if (!list.length) return list;
  const raw = list.map((s) => {
    const n = Number(s && s.pageWeight);
    return isFinite(n) && n > 0 ? n : 1;
  });
  const rawTotal = raw.reduce((a, b) => a + b, 0) || list.length;
  const scale = targetPages / rawTotal;
  const snapped = raw.map((n) => snapPageWeight(n * scale));

  // Nudge toward the target: repeatedly step the best candidate up or down one notch.
  const idxOf = (w: number) => PAGE_WEIGHTS.indexOf(w);
  let total = snapped.reduce((a, b) => a + b, 0);
  let guard = list.length * 4;
  while (Math.abs(total - targetPages) >= 0.25 && guard-- > 0) {
    const up = total < targetPages;
    let pick = -1;
    for (let i = 0; i < snapped.length; i++) {
      const k = idxOf(snapped[i]);
      if (up ? k < PAGE_WEIGHTS.length - 1 : k > 0) {
        // prefer mid-range scenes so cutaways stay cutaways and set pieces stay set pieces
        if (pick < 0 || Math.abs(idxOf(snapped[i]) - 2) < Math.abs(idxOf(snapped[pick]) - 2)) pick = i;
      }
    }
    if (pick < 0) break;
    const k = idxOf(snapped[pick]);
    const next = PAGE_WEIGHTS[up ? k + 1 : k - 1];
    total += next - snapped[pick];
    snapped[pick] = next;
  }

  return list.map((s, i) => ({ ...(s as any), pageWeight: snapped[i] }));
}

export interface LineBudget {
  pages: number;
  /** Lines — what paginate() counts. */
  target: number; min: number; max: number;
  /** Words this scene should actually COME OUT at — pages x WORDS_PER_PAGE. Used for the guard and the log. */
  wordsBudget: number;
  /** Words the model is ASKED for — the budget divided by DELIVERY_FACTOR, because it delivers ~1.6x. */
  wordsAsk: number; wordsMin: number; wordsMax: number;
  /** Hard output ceiling. Derived from `words`, so it can never drift away from the budget it enforces. */
  maxTokens: number;
}

/**
 * What a page allocation buys, in both currencies.
 *
 * `maxTokens` is the only HARD lever. The prompt asks for a word count politely and the model
 * ignores it; max_tokens stops the stream. So the cap has to sit just above the intended output or
 * it is decoration.
 *
 * Two earlier attempts both failed to bind:
 *   1. `max * 34 + 600` — ~2,844 tokens for a one-page scene needing ~330. Five times the headroom.
 *   2. `Math.max(700, w * 700 + 300)` — better at the top end, but the FLOOR was the problem: a
 *      half-page beat budgeted at 95 words was handed 700 tokens, room for ~400 words. Seven times
 *      the target. The 31 Aug draft duly came in at 236 words/scene against a 141-word budget —
 *      1.67x over, uniformly — and landed at 207 pages against a 105-page target.
 *
 * The cap is now derived from the budget itself: words x TOKENS_PER_WORD x CAP_HEADROOM, so it
 * tracks every change to the word budget instead of drifting away from it. But it is deliberately
 * a RUNAWAY GUARD sitting well above what the model actually writes — see CAP_HEADROOM. Length is
 * controlled by the plan and by a compress pass, never by truncating the stream mid-speech.
 */
export function lineBudgetFor(pageWeight: any): LineBudget {
  const w = snapPageWeight(pageWeight);
  const target = Math.max(MIN_SCENE_LINES, Math.round(w * LINES_PER_PAGE));
  const wordsBudget = Math.max(60, Math.round(w * WORDS_PER_PAGE));
  // Ask for less than we want, because the model reliably delivers more. See DELIVERY_FACTOR.
  const wordsAsk = Math.max(MIN_ASK_WORDS, Math.round(wordsBudget / DELIVERY_FACTOR));
  return {
    pages: w,
    target,
    min: Math.max(MIN_SCENE_LINES, Math.round(target * 0.8)),
    max: Math.round(target * 1.2),
    wordsBudget,
    wordsAsk,
    // The bounds quoted in the prompt must bracket the ASK, not the budget — telling the model
    // "aim for 103 but do not exceed 206" hands back the headroom the division just removed.
    wordsMin: Math.round(wordsAsk * 0.8),
    wordsMax: Math.round(wordsAsk * 1.25),
    // The runaway guard is sized against the BUDGET, i.e. what the scene actually comes out at,
    // not the reduced ask — sizing it off the ask would make it a truncating cap again.
    maxTokens: Math.max(MIN_SCENE_TOKENS, Math.round(wordsBudget * TOKENS_PER_WORD * CAP_HEADROOM) + 48),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLANNER SLICE BUDGET
//
// WHY THIS EXISTS. On 1 Sep the planner was asked for 131 scenes and returned 80. Not a stall, and
// not a timeout — it finished the story early and then had nothing left to say, so two consecutive
// passes came back empty and the loop exited. It was doing exactly what we told it: the continuation
// prompt read "If the story's climax and final resolution fall inside this slice, dramatise them and
// stop there." Slice two accepted the invitation.
//
// The cost is not the missing scenes, it is the SHAPE. 105 pages across 80 scenes is 1.31 pages per
// scene; the same film across its planned 131 is 0.80 — and the produced-screenplay corpora put an
// action feature near 1.25 scenes per page, not 0.76. A short plan does not make a short film, it
// makes a film of long scenes, because the live budget controller stretches whatever it is given to
// fill the page target.
//
// So each continuation slice is now given the same accounting the scene writer already gets: where
// it is in the story, how much is left, which scenes this slice owns — and, decisively, whether it
// is allowed to end the film. Only the slice that reaches the target may carry the climax. Every
// slice before it is told, in as many words, to stop mid-story on an unresolved beat.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Never ask for fewer than this in one slice — a 2-scene ask reads as an afterthought and is answered like one. */
export const MIN_PLAN_SLICE = 8;

/**
 * Overshoot allowed on the last slice, so a map never ends on a 3-scene tail. Carried over from the
 * old inline `lo - scenes.length + 8`; the ending gate and the plan cap both tolerate a few extra.
 */
export const PLAN_SLICE_HEADROOM = 8;

export interface PlanSlice {
  /** Scenes already on the map. */
  mapped: number;
  /** Scenes the finished map should reach. */
  targetScenes: number;
  /** 1-based number of the first scene this slice must produce. */
  from: number;
  /** Scenes to ask for in this slice. */
  ask: number;
  /** Scenes still unmapped after this slice, if it delivers in full. */
  after: number;
  /** Pages the mapped scenes account for, from their pageWeights. */
  pagesSoFar: number;
  /** The whole film's page target. 0 when no length plan applies (a series pilot). */
  totalPages: number;
  /** Fraction of the planned scene count already mapped, 0-1. */
  progress: number;
  /** Fraction this slice should reach, 0-1. */
  progressAfter: number;
  /** Is this the slice that must carry the climax and the resolution? Nothing before it may. */
  isFinal: boolean;
}

/** The budget for one planning slice. Pure arithmetic — the wording lives in `planSliceInstruction`. */
export function planSliceBudget(mapped: any, targetScenes: any, chunk: any, pagesSoFar: any, targetPages: any): PlanSlice {
  const done = Math.max(0, Math.round(Number(mapped) || 0));
  const total = Math.max(0, Math.round(Number(targetScenes) || 0));
  const size = Math.max(MIN_PLAN_SLICE, Math.round(Number(chunk) || 0) || MIN_PLAN_SLICE);
  const pages = Math.max(0, Number(pagesSoFar) || 0);
  const totalPages = Math.max(0, Number(targetPages) || 0);
  const remaining = Math.max(0, total - done);
  const ask = Math.max(MIN_PLAN_SLICE, Math.min(size, remaining + PLAN_SLICE_HEADROOM));
  const frac = (n: number) => (total > 0 ? Math.min(1, Math.max(0, n / total)) : 1);
  return {
    mapped: done,
    targetScenes: total,
    from: done + 1,
    ask,
    after: Math.max(0, total - done - ask),
    pagesSoFar: Math.round(pages * 10) / 10,
    totalPages,
    progress: frac(done),
    progressAfter: frac(done + ask),
    isFinal: total <= 0 || done + ask >= total,
  };
}

/**
 * What the planner is told about this slice.
 *
 * Kept here rather than in the service because it is a statement about LENGTH and PACING, which is
 * this file's subject, and because the one sentence that matters — whether the story may end here —
 * has to be testable. `stalled` is set when the previous pass added nothing: rather than counting
 * that as one strike toward giving up, the next ask says plainly that the film is not finished.
 */
export function planSliceInstruction(s: PlanSlice, stalled = false): string {
  const pct = (n: number) => Math.round(n * 100) + '%';
  const last = s.from + s.ask - 1;
  const head = 'STORY POSITION: ' + s.mapped + ' of ' + s.targetScenes + ' scenes mapped — '
    + pct(s.progress) + ' of the film'
    + (s.totalPages > 0 ? ', accounting for about ' + s.pagesSoFar + ' of its ' + s.totalPages + ' pages' : '')
    + '.';
  const stall = stalled
    ? ' Your previous answer added NO new scenes. The film is NOT finished: ' + Math.max(0, s.targetScenes - s.mapped)
      + ' scenes of it are still unmapped, and the outline above still contains beats you have not covered.'
      + ' Do not repeat what is already listed — continue past it.'
    : '';
  if (s.isFinal) {
    return head + stall
      + ' This is the LAST slice: scenes ' + s.from + '-' + last + '.'
      + ' It MUST dramatise the climax AND the final resolution, and it MUST end the film.'
      + (s.totalPages > 0 ? ' About ' + Math.max(0, Math.round(s.totalPages - s.pagesSoFar)) + ' pages remain for it.' : '');
  }
  return head + stall
    + ' This slice is scenes ' + s.from + '-' + last + ' — it carries the story from about '
    + pct(s.progress) + ' to about ' + pct(s.progressAfter) + ' of the outline, and no further.'
    + ' This is NOT the end of the film: ' + s.after + ' more scenes come after this slice.'
    + ' Do NOT dramatise the climax, do NOT resolve the story and do NOT write an ending here —'
    + ' finish this slice mid-story, on an unresolved beat, and you will be asked to continue.';
}

/**
 * Proportional budget controller — the fix for a draft that runs long.
 *
 * Allocating pages up front and hoping the model complies does not work: it overshot by ~50% on
 * every scene, so a 105-page plan across 126 scenes was heading for 190 pages. Instead, re-derive
 * the budget after every scene from what is ACTUALLY on the page: divide the pages still available
 * by the pages still planned, and scale the next scene's allocation by that.
 *
 * A run that is 40% hot at scene 50 tightens the remaining 76 scenes automatically and lands on
 * target. A run already over target returns the floor, so it stops digging rather than compounding.
 * Clamped to [0.25, 2] so one anomalous scene cannot whipsaw the whole back half.
 */
export function remainingBudgetScale(targetPages: number, actualPagesSoFar: number, remainingPlannedPages: number): number {
  if (!(remainingPlannedPages > 0) || !(targetPages > 0)) return 1;
  const left = targetPages - Math.max(0, actualPagesSoFar);
  if (left <= 0) return 0.25;
  return Math.min(2, Math.max(0.25, left / remainingPlannedPages));
}

/**
 * Is this draft longer than a feature should be?
 *
 * Two ceilings, and a draft has to clear BOTH. The ratio is relative — a short target tolerates a
 * proportionally smaller overrun — while MAX_TARGET_PAGES is absolute, because 115 pages is the top
 * of the band whatever the target was. Without the second test a 105-page target filed as complete
 * at 120, and a 115-page target would have filed at 132.
 */
export function isLengthOver(
  actualPages: number, targetPages: number, maxRatio = MAX_COMPLETION_RATIO, hardCap = MAX_TARGET_PAGES,
): boolean {
  const actual = Math.max(0, Number(actualPages) || 0);
  if (hardCap > 0 && actual > hardCap) return true;
  return completionRatio(actual, targetPages) > maxRatio;
}

/** Count a block of text the way paginate() does, so budgets and page counts agree. */
export function countVisualLines(text: string, wrapAt = WRAP_CHARS): number {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let n = 0;
  for (const ln of lines) n += Math.max(1, Math.ceil((ln.length || 1) / wrapAt));
  return n;
}

/** How much of the page target a draft actually reached. 1 = on target. */
export function completionRatio(actualPages: number, targetPages: number): number {
  if (!targetPages || targetPages <= 0) return 1;
  return Math.max(0, Number(actualPages) || 0) / targetPages;
}

/** Is this draft long enough to file as complete? */
export function isLengthComplete(actualPages: number, targetPages: number, minRatio = MIN_COMPLETION_RATIO): boolean {
  return completionRatio(actualPages, targetPages) >= minRatio;
}

export interface ShortScene { index: number; wrote: number; budget: number; shortfall: number }

/**
 * Which scenes came in furthest under their allocation, worst first. These are what an expansion pass
 * should rewrite — a draft that is short is short because specific scenes underdelivered, not because
 * every scene needs to grow.
 */
export function expansionCandidates(
  written: Array<{ text: string; pageWeight?: any }>,
  limit = 20,
): ShortScene[] {
  const rows: ShortScene[] = [];
  for (let i = 0; i < written.length; i++) {
    const w = written[i];
    if (!w) continue;
    const budget = lineBudgetFor(w.pageWeight).target;
    const wrote = countVisualLines(w.text);
    const shortfall = budget - wrote;
    if (shortfall > 0) rows.push({ index: i, wrote, budget, shortfall });
  }
  rows.sort((a, b) => b.shortfall - a.shortfall);
  return rows.slice(0, Math.max(0, limit));
}
