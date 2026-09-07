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

/** Where a profile's `sceneDensity` came from. Never let a constant ship without one. */
export type Provenance = 'measured' | 'derived' | 'default' | 'blended' | 'overridden';

export interface GenreLengthProfile {
  key: string;
  /** Scenes per page. See `provenance` — only four of these were ever measured. */
  sceneDensity: number;
  /** Pages per minute of screen time. Measured mean 1.1 (a page runs ~55 seconds). */
  pagesPerMinute: number;
  /** Page target when the brief does not state one. */
  defaultPages: number;
  /** measured = a corpus says so. derived = inherited wholesale from `parent`. */
  provenance: Provenance;
  /** The measured genre this one takes its density from. Empty when measured. */
  parent: string;
  /** The citation, for the settings UI and for audit. A constant must be able to say where it came from. */
  source: string;
  /** Present only on a BLENDED profile: the keys it was built from, base first. A blend has to be
   *  able to name its ingredients for the same reason a constant has to name its source. */
  blendOf?: string[];
  /** Present only on an OVERRIDDEN profile: exactly what the table said before a human changed it.
   *  THE TABLE IS NEVER EDITED. An override sits on top and carries the original with it, so the
   *  citation stays attached to the number it actually describes and a reset is always possible. */
  overrodeFrom?: { sceneDensity: number; pagesPerMinute: number; defaultPages: number; provenance: Provenance; source: string };
}

/** A human's change to one genre row. Every field optional — override only what you mean to. */
export interface GenreOverride {
  key: string;
  sceneDensity?: number;
  pagesPerMinute?: number;
  defaultPages?: number;
  /** Why. Optional, and the panel should ask for it — an unexplained override is the thing this
   *  whole provenance scheme exists to prevent. */
  note?: string;
}

/**
 * Genre profiles — one for every genre the intake offers, and each one able to say where it came from.
 *
 * ONLY FOUR ARE MEASURED. ScriptBase (Gorinski & Lapata, NAACL 2015, Figure 2) publishes exactly four
 * genres over 1,276 produced films: Drama 79.77 scenes (n=665), Thriller 91.84 (n=451), Comedy 66.13
 * (n=378), Action 101.82 (n=288). There is no fifth row. Stephen Follows' 12,309-script corpus is
 * spec, not produced, and publishes only endpoints in public. No corpus anywhere gives scene counts
 * for Western, Adventure, Mystery, Family, Animation, Sport, Disaster, Survival, Coming-of-age,
 * Superhero, Psychological or Road movie.
 *
 * So every unmeasured genre INHERITS A MEASURED PARENT'S DENSITY EXACTLY. No interpolated midpoints:
 * the previous table carried six invented decimals (horror 1.06, fantasy/sci-fi 1.10, romance 0.98,
 * musical 1.00) that no corpus supports and no one could audit, and twelve genres had no profile at
 * all and silently collected the generic fallback. A mapping that is wrong is now corrected by
 * changing a PARENT, not by inventing a number — and `blendProfiles` (artifact §03, not built) is
 * what will eventually express the hybrids properly.
 *
 * `pagesPerMinute` and `defaultPages` are deliberately UNCHANGED for every genre that already had
 * them. Note also what the research says about length: across those same four measured genres, scene
 * count spreads 54% (66.1 → 101.8) while script length spreads only 5% (4,255 → 4,485 lines). Length
 * is close to genre-independent; scene count is not. Our defaultPages spread of 98–115 is therefore
 * the weaker half of this table and is a separate, open question.
 */
const SB = 'ScriptBase 1,276 produced films (Gorinski & Lapata, NAACL 2015, Fig. 2)';
const GENRE_PROFILES: GenreLengthProfile[] = [
  // ---- ACTION family -------------------------------------------------------------------------
  { key: 'SUPERHERO', sceneDensity: 1.25, pagesPerMinute: 0.99, defaultPages: 110, provenance: 'derived', parent: 'ACTION', source: 'no corpus; inherits ACTION' },
  { key: 'MARTIAL_ARTS', sceneDensity: 1.25, pagesPerMinute: 0.99, defaultPages: 100, provenance: 'derived', parent: 'ACTION', source: 'no corpus; inherits ACTION' },
  { key: 'HEIST', sceneDensity: 1.25, pagesPerMinute: 0.99, defaultPages: 102, provenance: 'derived', parent: 'ACTION', source: 'no corpus; inherits ACTION' },
  { key: 'WAR', sceneDensity: 1.25, pagesPerMinute: 0.99, defaultPages: 110, provenance: 'derived', parent: 'ACTION', source: 'no corpus; inherits ACTION' },
  { key: 'DISASTER', sceneDensity: 1.25, pagesPerMinute: 0.99, defaultPages: 105, provenance: 'derived', parent: 'ACTION', source: 'no corpus; inherits ACTION' },
  { key: 'ADVENTURE', sceneDensity: 1.25, pagesPerMinute: 0.99, defaultPages: 105, provenance: 'derived', parent: 'ACTION', source: 'no corpus; inherits ACTION' },
  { key: 'ACTION', sceneDensity: 1.25, pagesPerMinute: 0.99, defaultPages: 102, provenance: 'measured', parent: '', source: SB + ': 101.82 scenes, n=288 — replicated by Follows spec corpus (131.2), both corpora put Action highest' },
  // ---- THRILLER family -----------------------------------------------------------------------
  { key: 'SLASHER', sceneDensity: 1.15, pagesPerMinute: 1.05, defaultPages: 95, provenance: 'derived', parent: 'THRILLER', source: 'no corpus; inherits THRILLER' },
  { key: 'FILM_NOIR', sceneDensity: 1.15, pagesPerMinute: 1.02, defaultPages: 100, provenance: 'derived', parent: 'THRILLER', source: 'no corpus; inherits THRILLER' },
  { key: 'SPY', sceneDensity: 1.15, pagesPerMinute: 1.02, defaultPages: 105, provenance: 'derived', parent: 'THRILLER', source: 'no corpus; inherits THRILLER' },
  { key: 'CRIME', sceneDensity: 1.15, pagesPerMinute: 1.02, defaultPages: 100, provenance: 'derived', parent: 'THRILLER', source: 'no corpus; inherits THRILLER' },
  { key: 'MYSTERY', sceneDensity: 1.15, pagesPerMinute: 1.02, defaultPages: 100, provenance: 'derived', parent: 'THRILLER', source: 'no corpus; inherits THRILLER' },
  { key: 'HORROR', sceneDensity: 1.15, pagesPerMinute: 1.05, defaultPages: 98, provenance: 'derived', parent: 'THRILLER', source: 'density inherits THRILLER; PAGES measured — Follows 12,309 spec scripts, 98.6, the shortest of any genre' },
  { key: 'PSYCHOLOGICAL', sceneDensity: 1.15, pagesPerMinute: 1.02, defaultPages: 105, provenance: 'derived', parent: 'THRILLER', source: 'no corpus; inherits THRILLER' },
  { key: 'THRILLER', sceneDensity: 1.15, pagesPerMinute: 1.02, defaultPages: 100, provenance: 'measured', parent: '', source: SB + ': 91.84 scenes, n=451' },
  // ---- DRAMA family --------------------------------------------------------------------------
  { key: 'SURVIVAL', sceneDensity: 1.04, pagesPerMinute: 1.12, defaultPages: 100, provenance: 'derived', parent: 'DRAMA', source: 'no corpus; inherits DRAMA' },
  { key: 'COMING_OF_AGE', sceneDensity: 1.04, pagesPerMinute: 1.12, defaultPages: 100, provenance: 'derived', parent: 'DRAMA', source: 'no corpus; inherits DRAMA' },
  { key: 'ROAD_MOVIE', sceneDensity: 1.04, pagesPerMinute: 1.12, defaultPages: 100, provenance: 'derived', parent: 'DRAMA', source: 'no corpus; inherits DRAMA' },
  { key: 'SPORT', sceneDensity: 1.04, pagesPerMinute: 1.12, defaultPages: 105, provenance: 'derived', parent: 'DRAMA', source: 'no corpus; inherits DRAMA' },
  { key: 'WESTERN', sceneDensity: 1.04, pagesPerMinute: 1.12, defaultPages: 105, provenance: 'derived', parent: 'DRAMA', source: 'no scene-count corpus; inherits DRAMA. Follows measures Western as the most exterior genre (64.4%), which is a shooting fact, not a length one' },
  { key: 'BIOPIC', sceneDensity: 1.04, pagesPerMinute: 1.10, defaultPages: 110, provenance: 'derived', parent: 'DRAMA', source: 'no corpus; inherits DRAMA' },
  { key: 'EPIC', sceneDensity: 1.04, pagesPerMinute: 1.10, defaultPages: 115, provenance: 'derived', parent: 'DRAMA', source: 'no corpus; inherits DRAMA. Pages at the top of the band is craft convention, not measurement' },
  { key: 'HISTORICAL', sceneDensity: 1.04, pagesPerMinute: 1.10, defaultPages: 110, provenance: 'derived', parent: 'DRAMA', source: 'no corpus; inherits DRAMA. Follows measures Historical as the most populated (45.7 speaking roles) and least nocturnal (28.9% night)' },
  { key: 'DRAMA', sceneDensity: 1.04, pagesPerMinute: 1.12, defaultPages: 108, provenance: 'measured', parent: '', source: SB + ': 79.77 scenes, n=665 — the largest sample in the corpus' },
  // ---- SPECULATIVE ---------------------------------------------------------------------------
  // Both inherit ACTION and both are the WEAKEST assignments in this table: the genre spans 2001 and
  // Star Wars, and one density cannot be right for both. blendProfiles is the fix, not a new number.
  { key: 'SCIFI', sceneDensity: 1.25, pagesPerMinute: 1.05, defaultPages: 110, provenance: 'derived', parent: 'ACTION', source: 'no corpus; inherits ACTION — WEAK, the genre spans set-piece and chamber film alike' },
  { key: 'FANTASY', sceneDensity: 1.25, pagesPerMinute: 1.05, defaultPages: 110, provenance: 'derived', parent: 'ACTION', source: 'no corpus; inherits ACTION — WEAK, the genre spans set-piece and chamber film alike' },
  // ---- COMEDY family -------------------------------------------------------------------------
  { key: 'MUSICAL', sceneDensity: 0.93, pagesPerMinute: 0.90, defaultPages: 105, provenance: 'derived', parent: 'COMEDY', source: 'no corpus; inherits COMEDY' },
  { key: 'ANIMATION', sceneDensity: 0.93, pagesPerMinute: 1.15, defaultPages: 95, provenance: 'derived', parent: 'COMEDY', source: 'no corpus; inherits COMEDY' },
  { key: 'FAMILY', sceneDensity: 0.93, pagesPerMinute: 1.15, defaultPages: 100, provenance: 'derived', parent: 'COMEDY', source: 'no corpus; inherits COMEDY' },
  { key: 'SATIRE', sceneDensity: 0.93, pagesPerMinute: 1.15, defaultPages: 106, provenance: 'derived', parent: 'COMEDY', source: 'no corpus; inherits COMEDY' },
  { key: 'COMEDY', sceneDensity: 0.93, pagesPerMinute: 1.15, defaultPages: 106, provenance: 'measured', parent: '', source: SB + ': 66.13 scenes, n=378 — replicated by Follows (98.5). BOTH corpora put Comedy LOWEST, which kills the "action and comedy are the fast-cutting genres" folklore' },
  // ---- ROMANCE (after COMEDY: "romantic comedy" is a comedy, and reaches COMEDY first) ---------
  { key: 'ROMANCE', sceneDensity: 1.04, pagesPerMinute: 1.12, defaultPages: 100, provenance: 'derived', parent: 'DRAMA', source: 'no corpus; inherits DRAMA' },
];

export const DEFAULT_GENRE_PROFILE: GenreLengthProfile = {
  key: 'DEFAULT', sceneDensity: 1.04, pagesPerMinute: 1.10, defaultPages: DEFAULT_TARGET_PAGES,
  provenance: 'default', parent: 'DRAMA',
  source: 'the corpus-wide baseline — Follows 110 scenes over a 106-page median gives 1.04 exactly',
};

/** Every profile, for the settings UI and for tests that assert the table's own coherence. */
export function genreProfiles(): GenreLengthProfile[] { return GENRE_PROFILES.slice(); }

/**
 * The scene counts ScriptBase actually published, and the sample behind each.
 *
 * Four genres. That is the entire published table (Gorinski & Lapata, NAACL 2015, Fig. 2) over 1,276
 * produced films. They are reported RAW, against the corpus's own ~110-page average, rather than
 * rescaled to our page target — a rescaled figure looks like a measurement and is an arithmetic
 * result, and this table's whole purpose is that a reader can tell those apart.
 */
export const MEASURED_CORPUS_SCENES: Record<string, { scenes: number; sample: number }> = {
  ACTION: { scenes: 101.82, sample: 288 },
  THRILLER: { scenes: 91.84, sample: 451 },
  DRAMA: { scenes: 79.77, sample: 665 },
  COMEDY: { scenes: 66.13, sample: 378 },
};
/** The page average the ScriptBase figures above sit on. Stated so nobody has to guess the basis. */
export const MEASURED_CORPUS_PAGES = 110;

export interface GenreProfileRow {
  key: string;
  /** The picker's own label — 'Sci-fi' rather than 'SCIFI'. */
  label: string;
  sceneDensity: number;
  defaultPages: number;
  /** Scenes this genre's own page default buys, at the given texture. The ceiling, not a quota. */
  scenes: number;
  /** What that means to a reader: how long the average scene runs. */
  pagesPerScene: number;
  pagesPerMinute: number;
  /** Approximate screen time at this genre's page default. */
  minutes: number;
  provenance: Provenance;
  parent: string;
  source: string;
  /** The published corpus figure, raw, or null where none exists — which is most of them. */
  corpusScenes: number | null;
  corpusSample: number | null;
  /**
   * What the TABLE said, present only on a row an override moved. This is what makes the override a
   * layer rather than an edit: the settings panel renders the live figure in the box and the table's
   * own figure underneath it, so nobody has to trust that Reset will find something to restore.
   * Absent on every unoverridden row - an absent field reads as "nothing was covered up".
   */
  overrodeFrom?: { sceneDensity: number; pagesPerMinute: number; defaultPages: number; provenance: Provenance; source: string };
}

const GENRE_LABELS: Record<string, string> = {
  SCIFI: 'Sci-fi', FILM_NOIR: 'Film-noir', COMING_OF_AGE: 'Coming-of-age',
  ROAD_MOVIE: 'Road movie', MARTIAL_ARTS: 'Martial arts',
};
function labelFor(key: string): string {
  if (GENRE_LABELS[key]) return GENRE_LABELS[key];
  return key.charAt(0) + key.slice(1).toLowerCase();
}

/**
 * The whole genre table, computed — for the settings panel, and so a writer can see what a genre
 * choice actually does to their build before they make it.
 *
 * Every row can say where its density came from. That is the point of the table: six of these
 * numbers used to be interpolated midpoints no corpus supported, and twelve genres had no profile at
 * all. A constant that cannot say where it came from is a constant nobody can audit.
 */
export function genreProfileTable(texture: Texture = 'PRODUCED', overrides?: GenreOverride[] | null): GenreProfileRow[] {
  return GENRE_PROFILES.map((row) => {
    const p = applyGenreOverrides(row, overrides);
    const corpus = MEASURED_CORPUS_SCENES[p.key];
    return {
      key: p.key,
      label: labelFor(p.key),
      sceneDensity: p.sceneDensity,
      defaultPages: p.defaultPages,
      scenes: sceneCeilingFor(p.defaultPages, p.sceneDensity, texture),
      pagesPerScene: Math.round(pagesPerSceneFloor(p.sceneDensity, texture) * 100) / 100,
      pagesPerMinute: p.pagesPerMinute,
      minutes: Math.round(p.defaultPages / (p.pagesPerMinute || 1)),
      provenance: p.provenance,
      parent: p.parent,
      source: p.source,
      corpusScenes: corpus ? corpus.scenes : null,
      corpusSample: corpus ? corpus.sample : null,
      // Carried through verbatim, never reconstructed. `applyGenreOverrides` is the only thing that
      // sets it, and it sets it from the untouched table row - so what a reader sees under the box is
      // the table, not a second opinion about the table.
      ...(p.overrodeFrom ? { overrodeFrom: p.overrodeFrom } : {}),
    };
  });
}

function clamp(n: number, lo: number, hi: number): number {
  if (!isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

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
 * Keyword aliases, keyed by profile. Scanned in GENRE_PROFILES order, so a sub-genre always sits
 * ahead of its parent and wins: "slasher" reaches SLASHER before HORROR, "heist thriller" reaches
 * HEIST before THRILLER. A genre with no entry here is still matched by its own key (see
 * `keyForm`), which is what makes every one of the intake's thirty-two options resolvable.
 *
 * The separator variants are not decoration. "Rom-Com", "Sci-Fi" and "Coming-of-age" are exactly
 * what the picker sends, and before this list every one of them matched NOTHING and collected the
 * generic fallback.
 */
const GENRE_ALIASES: Record<string, string[]> = {
  SUPERHERO: ['superhero', 'super hero', 'comic book movie'],
  MARTIAL_ARTS: ['martial art', 'martial-art', 'martialarts', 'kung fu', 'wuxia', 'فنون قتالية'],
  HEIST: ['heist', 'caper'],
  WAR: ['war', 'wartime', 'حرب'],
  DISASTER: ['disaster'],
  ADVENTURE: ['adventure', 'مغامرة'],
  ACTION: ['action', 'اكشن', 'أكشن'],
  SLASHER: ['slasher'],
  FILM_NOIR: ['film noir', 'film-noir', 'filmnoir', 'noir'],
  SPY: ['spy', 'espionage', 'تجسس'],
  CRIME: ['crime', 'gangster', 'جريمة'],
  MYSTERY: ['mystery', 'whodunit', 'detective', 'غموض'],
  HORROR: ['horror', 'رعب'],
  PSYCHOLOGICAL: ['psychological'],
  THRILLER: ['thriller', 'suspense', 'اثارة', 'إثارة'],
  SURVIVAL: ['survival'],
  COMING_OF_AGE: ['coming of age', 'coming-of-age', 'comingofage'],
  ROAD_MOVIE: ['road movie', 'road-movie', 'roadmovie', 'road trip'],
  SPORT: ['sport', 'رياضي'],
  WESTERN: ['western'],
  BIOPIC: ['biopic', 'biographical', 'سيرة'],
  EPIC: ['epic', 'ملحمي'],
  HISTORICAL: ['historical', 'history', 'period', 'تاريخي'],
  DRAMA: ['drama', 'dramatic', 'دراما', 'درامي'],
  SCIFI: ['sci-fi', 'scifi', 'sci fi', 'science fiction', 'خيال علمي'],
  FANTASY: ['fantasy', 'mythic', 'mythological', 'fairy', 'خيال', 'أسطوري', 'اسطوري'],
  MUSICAL: ['musical', 'موسيقي', 'استعراضي'],
  ANIMATION: ['animation', 'animated', 'anime', 'رسوم متحركة'],
  FAMILY: ['family', 'عائلي'],
  SATIRE: ['satire', 'satirical'],
  COMEDY: ['comedy', 'comic', 'sitcom', 'rom-com', 'romcom', 'rom com', 'كوميدي', 'كوميديا'],
  ROMANCE: ['romance', 'romantic', 'رومانسي', 'رومانسية'],
};

/** "Coming-of-age" and "Sci-fi" become COMING_OF_AGE and SCI_FI — the picker's label, as a key. */
function keyForm(term: any): string {
  return String(term == null ? '' : term).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Two decimals, matching the precision every figure in the table is written to. */
const dp2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * BLEND A BASE GENRE WITH ITS LAYERS.
 *
 * The intake models a story as ONE base genre plus any number of blend layers - the noun the story
 * IS, and what is laid over it. `resolveGenreProfile` used to ignore that entirely: it scanned the
 * table and returned the FIRST row whose alias appeared anywhere in the brief, so TABLE ORDER
 * decided, not the writer. Jason Quick, tagged Action / Drama / Thriller, was planned purely as an
 * action film at 1.25 scenes per page, and a Drama with a Comedy layer was planned as whichever of
 * the two happened to sit higher in the table.
 *
 * THE RULE, and it is one sentence so it can be audited: A BLEND LANDS HALFWAY BETWEEN THE BASE AND
 * THE CENTRE OF ITS LAYERS. The base carries weight equal to the number of layers, each layer
 * carries one, so however many layers are added they can never move the story more than half the
 * distance from its base. No invented decimal: the only number here is a half, and it is stated.
 *
 * ONLY `sceneDensity` BLENDS. `pagesPerMinute` and `defaultPages` are deliberately left at the
 * base's values, because this file already says they were "deliberately UNCHANGED for every genre
 * that already had them" - they are craft conventions about length, not measurements about texture,
 * and scene density is the figure the table itself calls its weakest.
 *
 * With no layers this returns the base row UNCHANGED, by identity - so every single-genre brief
 * behaves exactly as it did.
 *
 * PURE. NEVER THROWS.
 */
export function blendProfiles(base: GenreLengthProfile, layers: GenreLengthProfile[]): GenreLengthProfile {
  if (!base) return DEFAULT_GENRE_PROFILE;
  const use = (Array.isArray(layers) ? layers : [])
    .filter((l) => l && typeof l.sceneDensity === 'number' && isFinite(l.sceneDensity) && l.key !== base.key);
  if (!use.length) return base;
  const centre = use.reduce((t, l) => t + l.sceneDensity, 0) / use.length;
  const blended = dp2((base.sceneDensity + centre) / 2);
  const names = use.map((l) => l.key);
  return {
    ...base,
    sceneDensity: blended,
    provenance: 'blended',
    blendOf: [base.key, ...names],
    source: base.key + ' base at ' + base.sceneDensity + ', layered with ' + names.join(' + ')
      + ' (centre ' + dp2(centre) + '); a blend lands halfway between the base and the centre of its layers',
  };
}

/**
 * THE ACCEPTABLE RANGE FOR AN OVERRIDE, derived from the table rather than invented.
 *
 * Half the lowest value the table carries to twice the highest. A number outside that is not a
 * craft decision, it is a typo — 12 scenes per page is not a thriller, it is a mistake — and this
 * file drops what it cannot believe rather than clamping it, because a clamped guess reads as a
 * measurement. Computed from GENRE_PROFILES, so it can never drift away from the table it bounds.
 */
const overrideBand = (pick: (p: GenreLengthProfile) => number): { lo: number; hi: number } => {
  const vals = GENRE_PROFILES.map(pick).filter((v) => typeof v === 'number' && isFinite(v) && v > 0);
  return { lo: Math.min(...vals) / 2, hi: Math.max(...vals) * 2 };
};
const DENSITY_BAND = overrideBand((p) => p.sceneDensity);
const PPM_BAND = overrideBand((p) => p.pagesPerMinute);
const PAGES_BAND = overrideBand((p) => p.defaultPages);

const inBand = (v: any, b: { lo: number; hi: number }): boolean =>
  typeof v === 'number' && isFinite(v) && v >= b.lo && v <= b.hi;

/**
 * Lay a human's override over a profile.
 *
 * THE TABLE IS READ-ONLY AND STAYS READ-ONLY. `measured` rows carry a corpus citation - DRAMA's is
 * "79.77 scenes, n=665" - and editing the number under a citation turns that citation into a lie.
 * So an override never mutates a row: it produces a new profile whose provenance is 'overridden',
 * whose `overrodeFrom` carries exactly what the table said, and whose source names both.
 *
 * A field outside the acceptable band is DROPPED, not clamped. A field not mentioned is untouched.
 * With nothing usable to apply, the profile comes back UNCHANGED BY IDENTITY.
 *
 * PURE. NEVER THROWS.
 */
export function applyGenreOverrides(
  profile: GenreLengthProfile,
  overrides: GenreOverride[] | null | undefined,
): GenreLengthProfile {
  if (!profile) return DEFAULT_GENRE_PROFILE;
  const list = Array.isArray(overrides) ? overrides : [];
  const o = list.filter((x) => x && typeof x.key === 'string' && keyForm(x.key) === profile.key).pop();
  if (!o) return profile;

  const took: string[] = [];
  const next: any = { ...profile };
  if (inBand(o.sceneDensity, DENSITY_BAND) && o.sceneDensity !== profile.sceneDensity) {
    next.sceneDensity = o.sceneDensity; took.push('scene density ' + profile.sceneDensity + ' -> ' + o.sceneDensity);
  }
  if (inBand(o.pagesPerMinute, PPM_BAND) && o.pagesPerMinute !== profile.pagesPerMinute) {
    next.pagesPerMinute = o.pagesPerMinute; took.push('pages per minute ' + profile.pagesPerMinute + ' -> ' + o.pagesPerMinute);
  }
  if (inBand(o.defaultPages, PAGES_BAND) && o.defaultPages !== profile.defaultPages) {
    next.defaultPages = Math.round(o.defaultPages as number); took.push('default pages ' + profile.defaultPages + ' -> ' + Math.round(o.defaultPages as number));
  }
  if (!took.length) return profile;

  next.provenance = 'overridden';
  next.overrodeFrom = {
    sceneDensity: profile.sceneDensity,
    pagesPerMinute: profile.pagesPerMinute,
    defaultPages: profile.defaultPages,
    provenance: profile.provenance,
    source: profile.source,
  };
  const why = typeof o.note === 'string' && o.note.trim() ? ' - "' + o.note.trim().slice(0, 160) + '"' : '';
  next.source = 'Overridden by hand: ' + took.join(', ') + why + '. The table still says: ' + profile.source;
  return next as GenreLengthProfile;
}

/**
 * The base genre and its layers, as the intake models them.
 *
 * `reDna()` computes `genres = [...baseGenres, ...blendLayers]`, so in the legacy flat array the
 * FIRST entry is the base and the rest are layers - a real convention, not a guess. An explicit
 * `baseGenre` / `blendLayers` pair wins over it when the brief carries one.
 */
export function briefGenreParts(brief: any): { base: string | null; layers: string[] } {
  if (!brief || typeof brief !== 'object') return { base: null, layers: [] };
  const one = (v: any): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const many = (v: any): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()) : []);
  let base = one(brief.baseGenre) || many(brief.baseGenres)[0] || null;
  let layers = many(brief.blendLayers);
  if (!base) {
    const flat = many(brief.genres);
    if (flat.length) { base = flat[0]; if (!layers.length) layers = flat.slice(1); }
  }
  return { base, layers };
}

/** The table row a single genre term resolves to, or null when nothing matches. */
function profileForTerm(term: string): GenreLengthProfile | null {
  const t = String(term == null ? '' : term).trim().toLowerCase();
  if (!t) return null;
  const key = keyForm(t);
  for (const p of GENRE_PROFILES) {
    if (p.key === key) return p;
    const words = GENRE_ALIASES[p.key];
    if (words && words.some((w) => t.includes(w))) return p;
  }
  return null;
}

/**
 * Which length profile governs this brief.
 *
 * Profiles are scanned in declaration order and the first that matches wins, so precedence is a
 * property of the table you can read top to bottom rather than of the order the user happened to
 * tick boxes in. Each profile matches on its own key (so every intake option resolves exactly) or on
 * any of its aliases (so free text in `tone` and `subGenre` still lands somewhere sensible).
 *
 * ONE genre still wins outright and the rest are discarded — which is why Jason Quick, tagged
 * ["Action","Drama","Thriller"], is planned purely as an action film. `blendProfiles` (artifact §03)
 * is the fix and is not built.
 */
export function resolveGenreProfile(brief: any): GenreLengthProfile {
  const { base, layers } = briefGenreParts(brief);
  const baseProfile = base ? profileForTerm(base) : null;
  if (baseProfile) {
    const layerProfiles: GenreLengthProfile[] = [];
    for (const l of layers) {
      const lp = profileForTerm(l);
      if (lp && lp.key !== baseProfile.key && !layerProfiles.some((x) => x.key === lp.key)) layerProfiles.push(lp);
    }
    return applyGenreOverrides(blendProfiles(baseProfile, layerProfiles), brief && brief.genreOverrides);
  }
  // No usable base: fall back to the old whole-brief scan, which also reads subGenre, tone and
  // projectIntent. A brief that names a genre only in its tone still lands somewhere sensible.
  const terms = briefGenreTerms(brief);
  if (!terms.length) return DEFAULT_GENRE_PROFILE;
  const hay = terms.join(' | ');
  const keys = terms.map(keyForm);
  for (const p of GENRE_PROFILES) {
    if (keys.indexOf(p.key) >= 0) return applyGenreOverrides(p, brief && brief.genreOverrides);
    const words = GENRE_ALIASES[p.key];
    if (words && words.some((w) => hay.includes(w))) return applyGenreOverrides(p, brief && brief.genreOverrides);
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
