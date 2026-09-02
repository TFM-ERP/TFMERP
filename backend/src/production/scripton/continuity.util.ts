/**
 * Continuity checking for a generated screenplay — the DETERMINISTIC half of the final
 * verification pass.
 *
 * WHY THIS EXISTS. The 1 Sep Jason Quick draft killed Callum and Moira on pages 21-22, then had
 * Callum answer a telephone on page 58, call again on page 76, and described both mentors as alive
 * on page 78. The same draft dramatised its courthouse climax three times in a row with different
 * names and facts. Neither failure is a writing problem. The scene writer's whole continuity memory
 * is `storySoFar.slice(-1600)` — about ten scene briefs — so by page 58 the deaths were forty scenes
 * out of view; and the planner's continuation pass appends to the scene array without ever comparing
 * what it appended against what was already there.
 *
 * WHY NO MODEL LIVES IN THIS FILE. The obvious design is to hand the finished draft to an AI and ask
 * it to find the continuity errors. That has been built and measured. Re3 (Yang et al., EMNLP 2022)
 * maintains an attribute dictionary per character and flags contradictions with an entailment model:
 * ROC-AUC 0.684, and removing the module entirely made a negligible difference to coherence — its
 * own authors note the survivors "could be fixed by an attentive human editor". Huang et al. (ICLR
 * 2024) found that models asked to self-correct without external feedback sometimes get WORSE.
 *
 * We escape both results for exactly one reason: we do not infer. The plan declares who exits and
 * in which scene; the classifier below extracts who actually speaks; "does CALLUM speak after scene
 * 25" is set membership, not entailment. That makes the checker close to exact — and an exact
 * checker is precisely the external signal a repair loop requires in order to work at all.
 *
 * So: every function here returns a definite answer. Anything needing judgement belongs in a report,
 * not in this file. Pure functions only — no Nest, no Prisma, no AI. Tested in continuity.util.spec.ts.
 *
 * ONE import, and it is deliberate: `CanonFactCore` from ./canon. The story-memory graph in that
 * folder is bi-temporal and already models "true from scene N until scene M" properly, so the exits
 * this file derives are expressed in ITS shape rather than a parallel one.
 */

import type { CanonFactCore } from './canon/canon.types';

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE SHARED LINE CLASSIFIER
//
// Lifted out of ScripOnService.paginate(), where it had been doing this job for pagination alone.
// paginate() now consumes it, so the checker and the page count can never disagree about what a
// line is — two copies of the same geometry drifting apart is the bug that rendered a 168-page
// script as 303 pages.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export type LineKind = 'blank' | 'slug' | 'trans' | 'cue' | 'paren' | 'dialogue' | 'action';

/** A scene heading, with or without a leading scene number. */
export const SLUG_RE = /^(\d+[A-Z]?[.)]?\s+)?(INT|EXT|INT\.?\/EXT|I\/E|EST)[.\s]/i;
/** The Arabic scene heading forms ScripOn emits. */
export const AR_SLUG_RE = /^\s*(?:\d+\s+)?(?:مشهد|المشهد|داخلي|خارجي)/u;
/** Transitions, which occupy their own line and their own vertical space. */
export const TRANS_RE = /^(FADE (OUT|IN|TO)|CUT TO:|SMASH CUT|MATCH CUT|DISSOLVE TO:|JUMP CUT|BACK TO:|THE END)/i;

/**
 * Does this line LOOK like a character cue — short, unpunctuated, uppercase?
 *
 * Deliberately unchanged from the version inside paginate(), because PAGE_BUDGET was calibrated
 * against exactly this behaviour and a page count that shifts is a regression. It is a loose test:
 * an all-caps action beat ("BANG") satisfies it. For pagination that costs a fraction of a line.
 * For a continuity check it would invent a speaker, which is why `classifyScript` runs the
 * lookahead below before anything is treated as a SPEAKER.
 */
export function looksLikeCue(t: string): boolean {
  return t.length <= 30 && !/[.!?]$/.test(t) && t === t.toUpperCase() && /[A-Z؀-ۿ]/.test(t);
}

/** Classify ONE trimmed line. `inSpeech` is the caller's running state — see classifyScript. */
export function classifyLine(t: string, inSpeech: boolean): LineKind {
  if (!t) return 'blank';
  if (SLUG_RE.test(t) || AR_SLUG_RE.test(t)) return 'slug';
  if (TRANS_RE.test(t)) return 'trans';
  if (t.charAt(0) === '(') return 'paren';
  if (!inSpeech && looksLikeCue(t)) return 'cue';
  return inSpeech ? 'dialogue' : 'action';
}

/** How `inSpeech` moves after a line of the given kind. Shared so paginate cannot drift from here. */
export function nextInSpeech(kind: LineKind, inSpeech: boolean): boolean {
  if (kind === 'blank') return false;
  if (kind === 'cue') return true;
  if (kind === 'slug' || kind === 'trans' || kind === 'action') return false;
  return inSpeech;
}

export interface ClassifiedLine {
  raw: string;
  text: string;
  kind: LineKind;
  /** Cue lines only. True when a speech actually follows, i.e. this is a real SPEAKER. */
  speaks: boolean;
}

/**
 * Classify a whole block of screenplay text, then resolve which cues are real speakers.
 *
 * The second pass is the refinement pagination never needed: a cue is only a speaker when the next
 * non-blank line is dialogue or a parenthetical. "BANG" followed by a blank line and an action
 * paragraph is an action beat, not a character called BANG.
 */
export function classifyScript(text: string): ClassifiedLine[] {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out: ClassifiedLine[] = [];
  let inSpeech = false;
  for (const raw of lines) {
    const t = raw.trim();
    const kind = classifyLine(t, inSpeech);
    inSpeech = nextInSpeech(kind, inSpeech);
    out.push({ raw, text: t, kind, speaks: false });
  }
  for (let i = 0; i < out.length; i++) {
    if (out[i].kind !== 'cue') continue;
    let j = i + 1;
    while (j < out.length && out[j].kind === 'blank') j++;
    out[i].speaks = j < out.length && (out[j].kind === 'dialogue' || out[j].kind === 'paren');
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CHARACTER NAMES
// ─────────────────────────────────────────────────────────────────────────────────────────────

/** Cue suffixes and honorifics that are not part of a character's identity. */
const CUE_SUFFIX_RE = /\((?:[^)]*)\)/g;
const TITLES = new Set(['DR', 'MR', 'MRS', 'MS', 'MISS', 'SGT', 'SERGEANT', 'CAPT', 'CAPTAIN', 'DET',
  'DETECTIVE', 'OFFICER', 'PROF', 'PROFESSOR', 'FATHER', 'SISTER', 'YOUNG', 'OLD', 'THE']);

/** Uppercase, drop (V.O.) / (CONT'D) / punctuation, collapse whitespace. */
export function normaliseCharacterName(raw: any): string {
  return String(raw == null ? '' : raw)
    .replace(CUE_SUFFIX_RE, ' ')
    .toUpperCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The tokens of a normalised name, honorifics kept (they are dropped only by keyName). */
export function nameTokens(raw: any): string[] {
  const n = normaliseCharacterName(raw);
  return n ? n.split(' ').filter(Boolean) : [];
}

/**
 * The one token that identifies a character: the first non-title token of length 3 or more.
 * "DR MOIRA MACRAE" -> MOIRA. "CALLUM MACRAE" -> CALLUM. "NORA BELL" -> NORA.
 *
 * Matching on the given name rather than on any shared token is deliberate: NORA BELL and THOMAS
 * BELL share a surname, and a checker that treated them as the same person would report a
 * resurrection every time the living daughter of a departed father opened her mouth.
 */
export function keyName(raw: any): string {
  for (const t of nameTokens(raw)) {
    if (t.length >= 3 && !TITLES.has(t)) return t;
  }
  const all = nameTokens(raw);
  return all.length ? all[all.length - 1] : '';
}

/**
 * Are these two spellings the same character? Equal key names, or one name containing the other's
 * key name as a whole token — so MERCER matches VEX MERCER, while NORA BELL never matches
 * THOMAS BELL.
 */
export function sameCharacter(a: any, b: any): boolean {
  const ka = keyName(a); const kb = keyName(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  return nameTokens(a).indexOf(kb) >= 0 || nameTokens(b).indexOf(ka) >= 0;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHAT A SCENE ACTUALLY CONTAINS
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface SceneSpeech {
  /** Distinct speakers, in the order they first speak. Normalised, cue suffixes removed. */
  speakers: string[];
  /** Every uppercase name-shaped token appearing in ACTION lines — first appearances live here. */
  actionNames: string[];
  dialogueWords: number;
  actionWords: number;
  parentheticals: number;
}

const wordsIn = (s: string): number => (String(s || '').match(/\S+/g) || []).length;

/**
 * Read one scene's text into the facts a checker can act on. No inference: a speaker is a cue line
 * with a speech under it, and nothing else counts.
 */
export function readScene(text: string): SceneSpeech {
  const lines = classifyScript(text);
  const speakers: string[] = [];
  const actionNames: string[] = [];
  let dialogueWords = 0; let actionWords = 0; let parentheticals = 0;
  for (const ln of lines) {
    if (ln.kind === 'cue' && ln.speaks) {
      const n = normaliseCharacterName(ln.text);
      if (n && !speakers.some((s) => s === n)) speakers.push(n);
    } else if (ln.kind === 'dialogue') dialogueWords += wordsIn(ln.text);
    else if (ln.kind === 'paren') parentheticals++;
    else if (ln.kind === 'action') {
      actionWords += wordsIn(ln.text);
      // An ALL-CAPS run inside action is the format's own marker for a character's first
      // appearance (and for sound effects, which is why this is reported, never acted on).
      const caps = ln.text.match(/\b[\p{Lu}][\p{Lu}'’-]{2,}(?:\s+[\p{Lu}][\p{Lu}'’-]{2,})*/gu) || [];
      for (const c of caps) {
        const n = normaliseCharacterName(c);
        if (n && actionNames.indexOf(n) < 0) actionNames.push(n);
      }
    }
  }
  return { speakers, actionNames, dialogueWords, actionWords, parentheticals };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// EXITS — who is gone, and from which scene
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface CastExit {
  /** As written in the plan. */
  name: string;
  /** 0-based index of the scene in which they die or leave. They may still appear IN that scene. */
  scene: number;
  /** "killed", "arrested", "leaves for Boston" — one short phrase, shown to the writer. */
  how: string;
}

/**
 * Collect exits from a planned scene list. The planner fills `exits: [{name, how}]` on the scene
 * where a character dies or permanently leaves the story.
 *
 * The FIRST exit for a character wins. A plan that kills someone twice has a different problem,
 * and taking the earliest is the conservative reading — it makes the unavailable window larger,
 * never smaller.
 */
export function collectExits(scenes: any[]): CastExit[] {
  const out: CastExit[] = [];
  const list = Array.isArray(scenes) ? scenes : [];
  for (let i = 0; i < list.length; i++) {
    const raw = list[i] && (list[i] as any).exits;
    const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    for (const e of arr) {
      const name = normaliseCharacterName(typeof e === 'string' ? e : (e && e.name));
      if (!name || keyName(name).length < 3) continue;
      if (out.some((x) => sameCharacter(x.name, name))) continue;
      const how = String((e && e.how) || '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'gone';
      out.push({ name, scene: i, how });
    }
  }
  return out;
}

/** Everyone unavailable by the time scene `sceneIndex` is played. */
export function unavailableAt(exits: CastExit[], sceneIndex: number): CastExit[] {
  return (Array.isArray(exits) ? exits : []).filter((e) => e && e.scene < sceneIndex);
}

/**
 * The one bounded line the scene writer is given. Capped so a story with a large body count cannot
 * crowd out the prompt — the most recent exits are the ones a scene is most likely to violate.
 */
export function unavailableLine(exits: CastExit[], sceneIndex: number, limit = 8): string {
  const gone = unavailableAt(exits, sceneIndex);
  if (!gone.length) return '';
  const shown = gone.slice(-limit);
  const head = shown.map((e) => e.name + ' (' + e.how + ', sc ' + (e.scene + 1) + ')').join(', ');
  return gone.length > shown.length ? head + ', and ' + (gone.length - shown.length) + ' more' : head;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// FINDINGS
// ─────────────────────────────────────────────────────────────────────────────────────────────

export type ContinuityKind = 'SPEAKS_AFTER_EXIT' | 'CAST_AFTER_EXIT' | 'DUPLICATE_SCENE' | 'NAME_DRIFT';

export interface ContinuityFinding {
  kind: ContinuityKind;
  /** 0-based scene index in the plan / draft. */
  sceneIndex: number;
  heading: string;
  names: string[];
  detail: string;
  /**
   * Can rewriting this ONE scene fix it? A resurrection can. A duplicated scene cannot — the fix
   * for that is deleting it from the plan before it is written, which is what dedupeScenes does.
   */
  repairable: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// MECHANISM A — ONE SCENE, ONE STORY
//
// WHY THIS EXISTS. Page 44 of the 1 Sep Jason Quick draft ends a scene on the word "Thursday" and
// then prints, verbatim, two pages of THE TRUMAN SHOW: a markdown title, a second FADE IN, Seahaven
// at sunrise, Truman Burbank at the bathroom mirror, and a FADE OUT immediately before scene 33.
//
// One writeScene call returned two documents. The model finished the scene it was asked for and then
// kept going into a different screenplay — the initiation-then-maintenance shape of verbatim
// emission, where the switch happens at something that looks, from outside, exactly like a document
// boundary. It reached the page because cleanSceneText strips code fences, markdown emphasis, inline
// parentheticals and ONE LEADING slug line, and nothing else: no markdown headings, no second
// FADE IN, no slug line after the first. The token cap never bound either — the runaway guard sits
// near 2,200 tokens for a three-page scene and the whole contamination is under 900.
//
// This is the only defect in that draft carrying a legal exposure, so it is checked lexically,
// deterministically, and before anything else looks at the scene. A scene holds exactly one story.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export type SecondDocumentKind = 'MARKDOWN_HEADING' | 'FADE_IN' | 'FADE_OUT' | 'EXTRA_SLUGS';

export interface SecondDocument {
  kind: SecondDocumentKind;
  /** The offending line, trimmed, for the log. */
  line: string;
  /** Character offset at which the second document begins. */
  index: number;
}

/**
 * An ATX markdown heading — "# The Truman Show", "## EXT. SEAHAVEN". Screenplays have no headings.
 *
 * Tested against the TRIMMED line, deliberately unlike CommonMark's three-space rule: screenplay
 * text is indented, and the real contamination arrived thirteen columns in. A hash that begins a
 * word ("LOT #4471") is not a heading — the space after the hashes is required.
 */
const MD_HEADING_RE = /^#{1,6}[ \t]+\S/;

/**
 * Where a scene's text stops being this scene and starts being another document, or null.
 *
 * Deliberately lexical and deliberately narrow, because a false positive throws away a good scene:
 *
 *   • a markdown heading anywhere — the model is writing a document, not a scene;
 *   • FADE IN / FADE OUT / THE END — the caller supplies both, once, around the whole draft, and the
 *     writer is told not to write transitions of its own;
 *   • two or more slug lines — writeScene is told the heading is already provided, and cleanSceneText
 *     removes a leading one. A single interior sub-slug ("INT. CORRIDOR") is real craft and is left
 *     alone; two or more is a second scene list.
 *
 * `index` points at the START of the offending line, so a caller can keep everything before it.
 */
export function findSecondDocument(text: string): SecondDocument | null {
  const src = String(text || '');
  if (!src.trim()) return null;
  let at = 0;
  let slugs = 0;
  let firstSlugAt = -1;
  let firstSlugLine = '';
  for (const raw of src.split('\n')) {
    const t = raw.trim();
    // A transition first, with or without a markdown prefix — the real contamination wrote
    // "### FADE OUT." — so the report names the transition rather than the hashes in front of it.
    //
    // But ONLY when something follows it. Measured against the delivered draft, a bare trailing
    // "FADE OUT." closes three perfectly good scenes and the caller appends one more to the end of
    // every screenplay: flagging those would have discarded four scenes in eighty to catch one real
    // contamination. A transition with nothing after it is a formatting slip, which cleanSceneText
    // removes. A transition with a new scene after it is a second document.
    const bare = t.replace(/^#{1,6}[ \t]*/, '').trim();
    const isTransition = /^FADE\s+IN\b/i.test(bare) || /^(FADE\s+OUT|THE END)\b/i.test(bare);
    if (isTransition) {
      if (src.slice(at + raw.length).trim()) {
        return {
          kind: /^FADE\s+IN\b/i.test(bare) ? 'FADE_IN' : 'FADE_OUT',
          line: t.slice(0, 80), index: at,
        };
      }
      // Trailing, so a slip rather than a boundary — and it must not fall through to the markdown
      // rule below, because the draft wrote one of them as "### FADE OUT.".
      at += raw.length + 1;
      continue;
    }
    if (MD_HEADING_RE.test(t)) return { kind: 'MARKDOWN_HEADING', line: t.slice(0, 80), index: at };
    if (SLUG_RE.test(bare) || AR_SLUG_RE.test(bare)) {
      slugs++;
      if (slugs === 1) { firstSlugAt = at; firstSlugLine = t.slice(0, 80); }
      else return { kind: 'EXTRA_SLUGS', line: firstSlugLine || t.slice(0, 80), index: firstSlugAt >= 0 ? firstSlugAt : at };
    }
    at += raw.length + 1;
  }
  return null;
}

/**
 * Split a scene at its second document.
 *
 * Truncating rather than rejecting outright, because in the case that produced this the Jason/Sophie
 * scene was COMPLETE — it played its beat, landed its last line, and only then did the model start
 * somebody else's film. Discarding the whole return would have cost a good scene and a retry.
 *
 * But a truncation IS a repair, and every repair here is confirmed before it is kept: what survives
 * has to still be a scene. `keep` is false when too little is left, and the caller retries instead.
 *
 * `minWords` is the real test and the caller should derive it from the scene's own word budget — a
 * short beat followed by two pages of somebody else's film is still a valid short beat, so a bare
 * proportion is the wrong standard. On the scene that produced this, 233 of 431 words were the
 * actual screenplay.
 */
export function splitAtSecondDocument(
  text: string, minWords = 40, minRatio = 0.25,
): { kept: string; dropped: string; problem: SecondDocument | null; keep: boolean } {
  const src = String(text || '');
  const problem = findSecondDocument(src);
  if (!problem) return { kept: src, dropped: '', problem: null, keep: true };
  const kept = src.slice(0, problem.index).trim();
  const dropped = src.slice(problem.index).trim();
  const total = (src.match(/\S+/g) || []).length;
  const left = (kept.match(/\S+/g) || []).length;
  return { kept, dropped, problem, keep: left >= minWords && left >= total * minRatio };
}

/**
 * Check ONE written scene against the exits. Separated from the whole-draft sweep so the repair
 * loop can re-run the identical rule on a rewrite — the external signal that decides whether a
 * repair is kept or thrown away.
 *
 * ONLY SPEAKING COUNTS. A dead character may be named freely: grieving people talk about the dead
 * constantly, and a checker that flagged every mention of Callum would demand the removal of the
 * film's best scenes. A cue with a speech under it is not a reference — it is a resurrection.
 */
/**
 * A scene set in remembered or imagined time, where the dead are supposed to speak.
 *
 * WHY THIS EXISTS. Scene 45 of the 1 Sep draft is INT. MACRAE TRAINING BARN - FLASHBACK - DAY, and
 * Callum speaks in it twenty-eight scenes after he is killed. That is correct — it is the same barn
 * as scene 5, and the whole point of the sequence. The exit check reads only cues and the exit
 * table, so on its own terms that scene is a violation, and repairScene would be asked to write a
 * murdered man out of the memory of him.
 *
 * That is worse than the bug it guards against. A dead man on the telephone is caught by any reader
 * in one line; a memory sequence quietly stripped of the person being remembered is a scene
 * destroyed by its own safety net, with nothing downstream reporting it.
 */
const RECALLED_TIME_RE = /\b(FLASH ?BACK|FLASH ?FORWARD|DREAM(?: SEQUENCE)?|MEMORY|VISION|FANTASY|IMAGINED|YEARS? (?:EARLIER|AGO|BEFORE)|MONTHS? (?:EARLIER|AGO|BEFORE)|WEEKS? (?:EARLIER|AGO|BEFORE)|DAYS? (?:EARLIER|AGO|BEFORE)|EARLIER THAT|THEN ?- ?NOW|ذكرى|فلاش ?باك|استرجاع)\b/i;

/**
 * Is this scene set outside the present? The heading carries it in almost every case; the opening
 * lines are checked too, because a writer may open on "FLASHBACK — " under a plain slug.
 */
export function isRecalledTime(heading: string, text: string): boolean {
  if (RECALLED_TIME_RE.test(String(heading || ''))) return true;
  const head = String(text || '').split('\n').slice(0, 3).join(' ');
  return RECALLED_TIME_RE.test(head);
}

export function checkScene(sceneIndex: number, heading: string, text: string, exits: CastExit[]): ContinuityFinding[] {
  const gone = unavailableAt(exits, sceneIndex);
  if (!gone.length) return [];
  // The dead are allowed to speak in the past. Checked before anything else, so no repair is ever
  // proposed for a flashback.
  if (isRecalledTime(heading, text)) return [];
  const { speakers } = readScene(text);
  const hits: CastExit[] = [];
  for (const e of gone) {
    if (speakers.some((s) => sameCharacter(s, e.name)) && !hits.some((h) => h.name === e.name)) hits.push(e);
  }
  if (!hits.length) return [];
  return [{
    kind: 'SPEAKS_AFTER_EXIT',
    sceneIndex,
    heading: String(heading || ''),
    names: hits.map((h) => h.name),
    detail: hits.map((h) => h.name + ' (' + h.how + ' in scene ' + (h.scene + 1) + ')').join('; ') + ' speak'
      + (hits.length === 1 ? 's' : '') + ' in scene ' + (sceneIndex + 1) + '.',
    repairable: true,
  }];
}

/** Sweep a whole written draft. `scenes[i]` is the text of planned scene i, heading included. */
export function checkDraftContinuity(
  written: Array<{ heading: string; text: string }>,
  exits: CastExit[],
): ContinuityFinding[] {
  const out: ContinuityFinding[] = [];
  const list = Array.isArray(written) ? written : [];
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (!w) continue;
    for (const f of checkScene(i, w.heading, w.text, exits)) out.push(f);
  }
  return out;
}

/**
 * Plan-side twin: a scene whose planned cast lists someone already gone. Caught before a single
 * word is written, and cheap enough to run on every plan.
 */
export function checkPlanCast(scenes: any[], exits: CastExit[]): ContinuityFinding[] {
  const list = Array.isArray(scenes) ? scenes : [];
  const out: ContinuityFinding[] = [];
  for (let i = 0; i < list.length; i++) {
    const gone = unavailableAt(exits, i);
    if (!gone.length) continue;
    const cast = splitCast(list[i] && (list[i] as any).characters);
    const hits = gone.filter((e) => cast.some((c) => sameCharacter(c, e.name)));
    if (!hits.length) continue;
    out.push({
      kind: 'CAST_AFTER_EXIT',
      sceneIndex: i,
      heading: String((list[i] && (list[i] as any).location) || ''),
      names: hits.map((h) => h.name),
      detail: hits.map((h) => h.name).join(', ') + ' listed in the cast of scene ' + (i + 1)
        + ' after leaving the story.',
      repairable: false,
    });
  }
  return out;
}

/** The planner's `characters` field is a comma list; tolerate an array too. */
export function splitCast(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map((x) => normaliseCharacterName(x)).filter(Boolean);
  return String(raw == null ? '' : raw)
    .split(/[,؛;/|]+/)
    .map((x) => normaliseCharacterName(x))
    .filter((x) => x.length > 0);
}

/**
 * Remove characters who have already left from a scene's planned cast. Deterministic and safe: a
 * character who is gone cannot be present, so this only ever deletes something already wrong. It
 * does not touch the brief — the brief still needs the writer to be told, which is what
 * `unavailableLine` does.
 */
export function stripExitedCast<T extends { characters?: any }>(scenes: T[], exits: CastExit[]): { scenes: T[]; removed: number } {
  const list = Array.isArray(scenes) ? scenes : [];
  let removed = 0;
  const out = list.map((sc, i) => {
    const gone = unavailableAt(exits, i);
    if (!gone.length || !sc) return sc;
    const cast = splitCast((sc as any).characters);
    if (!cast.length) return sc;
    const kept = cast.filter((c) => !gone.some((e) => sameCharacter(c, e.name)));
    if (kept.length === cast.length) return sc;
    removed += cast.length - kept.length;
    return { ...(sc as any), characters: kept.join(', ') };
  });
  return { scenes: out as T[], removed };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// DUPLICATE SCENES
// ─────────────────────────────────────────────────────────────────────────────────────────────

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'his', 'her',
  'she', 'him', 'they', 'them', 'their', 'has', 'have', 'had', 'was', 'were', 'are', 'but', 'not',
  'you', 'who', 'what', 'when', 'where', 'while', 'then', 'than', 'out', 'off', 'over', 'about',
  'scene', 'int', 'ext', 'day', 'night', 'continuous', 'later']);

/** Content tokens of a brief, lowercased, stopwords and short words dropped. */
export function normaliseForCompare(s: any): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of String(s == null ? '' : s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)) {
    if (w.length <= 2 || STOP.has(w) || seen.has(w)) continue;
    seen.add(w); out.push(w);
  }
  return out;
}

/** Set overlap of two token lists. 1 = identical content, 0 = nothing shared. */
export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a); const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((x) => { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
}

/** Same place AND mostly the same content, or overwhelmingly the same content anywhere. */
export const DUPLICATE_SAME_PLACE = 0.55;
export const DUPLICATE_ANYWHERE = 0.75;
/** Below this many content words a brief is too thin to judge; never called a duplicate. */
export const DUPLICATE_MIN_TOKENS = 4;

export interface DuplicateFinding { index: number; duplicateOf: number; score: number; brief: string }

/**
 * Find scenes that re-dramatise a scene already in the plan.
 *
 * Deliberately conservative — thresholds are high and a thin brief is never judged — because
 * dropping a legitimate scene is a worse failure than keeping a duplicate. A film returns to the
 * same boathouse three times with different business; that is not duplication, and the content
 * overlap of those briefs sits far below these numbers.
 */
export function findDuplicateScenes(scenes: any[]): DuplicateFinding[] {
  const list = Array.isArray(scenes) ? scenes : [];
  // Tolerates all three scene shapes in the codebase: the planner's {brief, location}, the SCENES
  // stage's {description, slugline}, and an imported {synopsis, setName}.
  const toks = list.map((s) => normaliseForCompare(s && ((s as any).brief ?? (s as any).synopsis ?? (s as any).description)));
  const place = list.map((s) => normaliseCharacterName((s && ((s as any).location || (s as any).setName || (s as any).slugline)) || ''));
  const out: DuplicateFinding[] = [];
  const taken = new Set<number>();
  for (let i = 0; i < list.length; i++) {
    if (toks[i].length < DUPLICATE_MIN_TOKENS || taken.has(i)) continue;
    for (let j = i + 1; j < list.length; j++) {
      if (toks[j].length < DUPLICATE_MIN_TOKENS || taken.has(j)) continue;
      const score = jaccard(toks[i], toks[j]);
      const samePlace = !!place[i] && place[i] === place[j];
      if (score >= DUPLICATE_ANYWHERE || (samePlace && score >= DUPLICATE_SAME_PLACE)) {
        taken.add(j);
        out.push({ index: j, duplicateOf: i, score: Math.round(score * 100) / 100, brief: String((list[j] as any).brief || (list[j] as any).description || '').slice(0, 120) });
      }
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * Drop duplicate scenes, keeping the FIRST occurrence.
 *
 * Runs after every `scenes.concat()` in the planner. The continuation pass is shown a tail of the
 * map and told not to repeat itself, which is not an instruction it can follow reliably; and the
 * ending-repair pass appends the scenes needed to reach the climax, which produces a second climax
 * whenever the plan already had one. Deleting the copy here costs nothing. Writing it costs a
 * two-page scene and produces the courthouse three times over.
 */
export function dedupeScenes<T>(scenes: T[]): { scenes: T[]; dropped: DuplicateFinding[] } {
  const list = Array.isArray(scenes) ? scenes : [];
  const dupes = findDuplicateScenes(list as any[]);
  if (!dupes.length) return { scenes: list, dropped: [] };
  const drop = new Set(dupes.map((d) => d.index));
  return { scenes: list.filter((_, i) => !drop.has(i)), dropped: dupes };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// REPAIR
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The constraint handed to a repair rewrite. It names the violation exactly and, just as
 * importantly, says what is still ALLOWED — a rewrite told only "remove Callum" tends to delete
 * every trace of him, including the grief that is the point of the scene.
 */
export function repairInstruction(f: ContinuityFinding, exits: CastExit[]): string {
  const gone = unavailableAt(exits, f.sceneIndex).filter((e) => f.names.some((n) => sameCharacter(n, e.name)));
  const who = gone.length ? gone : f.names.map((n) => ({ name: n, scene: -1, how: 'gone' } as CastExit));
  const list = who.map((e) => e.name + (e.scene >= 0 ? ' (' + e.how + ' in scene ' + (e.scene + 1) + ')' : '')).join('; ');
  return 'CONTINUITY ERROR TO FIX: ' + list + ' cannot be present in this scene — they have already left the story.'
    + ' Remove every line they speak here, and any action in which they are physically present, telephone, message or are met.'
    + ' Do NOT remove them from the story: the living may still name them, remember them, grieve them or argue about them,'
    + ' and if their absence is what the scene is about, say so. Give their function in the scene to a character who is'
    + ' actually available, or let the scene play without it. Keep everything else — the same beats, the same turn, the'
    + ' same location, roughly the same length.';
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// REPORTING
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * One honest sentence about what the pass did. Says what was FOUND and what was actually FIXED,
 * separately, because a report that conflates them is how a draft gets filed as clean while three
 * scenes still have a dead man on the telephone.
 */
export function summariseContinuity(found: number, repaired: number, residue: ContinuityFinding[]): string {
  if (!found) return 'Continuity checked — no character appears after leaving the story.';
  const left = Array.isArray(residue) ? residue : [];
  const head = 'Continuity: ' + found + ' issue' + (found === 1 ? '' : 's') + ' found, ' + repaired + ' repaired';
  if (!left.length) return head + '.';
  const where = left.slice(0, 4).map((f) => 'scene ' + (f.sceneIndex + 1)).join(', ');
  return head + ' — still unresolved in ' + where + (left.length > 4 ? ' and ' + (left.length - 4) + ' more' : '') + '.';
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CANON — the hard facts a script must not contradict
//
// The 1 Sep draft called its protagonist Jason Andrew Quick and then Jason Richard Quick, and put
// him in the water for four or five minutes in one scene and twenty-two in another. Neither is a
// writing failure. Every writeScene call is independent, and the 6,600-character context prefix it
// shares with all 130 of its siblings does not contain a middle name. Nothing carried the fact from
// the scene that established it to the scene that contradicted it.
//
// So the facts are extracted ONCE from the full source and carried in every scene prompt as a small
// fixed block. This is the DOC result applied at the smallest possible scale: state the constraint
// during drafting rather than hunting for violations afterwards. Detection below covers only what can
// be checked exactly — the set of full-name forms actually used. Numeric drift is prevented by the
// block and reported by a human; a fuzzy matcher near an automatic rewrite is how good scenes die.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Express plan-declared exits as canon facts.
 *
 * This is the piece the canon graph was documented as missing. `canon-verify.util.ts` records its own
 * P0 limitation: facts are stored open-ended, so a character who is alive at scene 12 and dies at
 * scene 30 looks identical to a resurrection — "the detector cannot distinguish death from
 * resurrection", because nothing ever declares WHEN the state changed. Canon learns its facts from
 * rendered scenes, after the writing; the planner's `exits` field declares the change before a word
 * is written, which is exactly the anchor `validFrom` needs.
 *
 * `validFrom` is the scene AFTER the exit: a character plays their own death, and is gone from the
 * next scene on. That matches `resolveCanonAt`'s half-open window without any special-casing.
 */
export function exitsAsCanonFacts(exits: CastExit[]): CanonFactCore[] {
  const list = Array.isArray(exits) ? exits : [];
  return list.map((e) => {
    const dead = /kill|dead|die|died|murder|shot|drown|execut/i.test(e.how || '');
    return {
      kind: 'CHARACTER' as const,
      subject: e.name,
      predicate: 'status',
      object: dead ? 'dead' : 'gone',
      statement: e.name + ' is ' + (dead ? 'dead' : 'gone from the story') + ' from scene ' + (e.scene + 1)
        + ' (' + e.how + ') and cannot appear, speak or be contacted after it.',
      validFrom: e.scene + 1,
      validTo: null,
      status: 'ACTIVE' as const,
    };
  });
}

/** Every full-name form used for one character, with how often and where it first appeared. */
export interface NameForm { form: string; count: number; firstScene: number }

/**
 * Collect the distinct full-name forms used for each tracked character across a written draft.
 *
 * A "form" is a run of two or more capitalised words whose key name matches a tracked character —
 * JASON ANDREW QUICK and Jason Richard Quick both resolve to JASON, and are then two forms of one
 * person. Single-token uses (plain "Jason") are ignored: they cannot disagree with anything.
 */
export function collectNameForms(
  written: Array<{ text: string }>,
  tracked: string[],
): Map<string, NameForm[]> {
  const keys = (Array.isArray(tracked) ? tracked : []).map((t) => keyName(t)).filter((k) => k.length >= 3);
  const byKey = new Map<string, NameForm[]>();
  if (!keys.length) return byKey;
  const RUN = /\b\p{Lu}[\p{Ll}\p{Lu}'’-]+(?:\s+\p{Lu}[\p{Ll}\p{Lu}'’-]+)+/gu;
  const list = Array.isArray(written) ? written : [];
  for (let i = 0; i < list.length; i++) {
    // Prose only. A slug line is a LOCATION, and reading it as a name is how "VALE MERIDIAN
    // EXECUTIVE FLOOR" became a spelling of a character on 1 Sep — and then how the repair rewrote
    // every heading in the screenplay. Headings are supplied by us; they are never evidence of drift.
    const text = String((list[i] && list[i].text) || '')
      .split('\n')
      .filter((ln) => { const t = ln.trim(); return !(SLUG_RE.test(t) || AR_SLUG_RE.test(t) || TRANS_RE.test(t)); })
      .join('\n');
    const runs = text.match(RUN) || [];
    for (const run of runs) {
      const norm = normaliseCharacterName(run);
      const toks = norm ? norm.split(' ') : [];
      if (toks.length < 2) continue;
      const k = keyName(norm);
      if (keys.indexOf(k) < 0) continue;
      const forms = byKey.get(k) || [];
      const hit = forms.find((f) => f.form === norm);
      if (hit) hit.count++;
      else forms.push({ form: norm, count: 1, firstScene: i });
      byKey.set(k, forms);
    }
  }
  return byKey;
}

/**
 * Whole-token containment. `hay` and `needle` are both normalised (upper case, single-spaced), so
 * padding both ends turns a substring test into a token-run test.
 *
 * WHY THIS EXISTS. The substring version of this test cost a delivered screenplay twenty lines. The
 * canon held "Gideon Vale manages the shipping arm"; normalised, that string contains "VALE MAN",
 * so a spelling seen ONCE was declared canonical over one seen forty times, and every "Vale
 * Meridian" in the draft — prose and scene headings alike — became "Vale Man".
 */
function statesName(hay: string, needle: string): boolean {
  if (!needle) return false;
  return (' ' + hay + ' ').indexOf(' ' + needle + ' ') >= 0;
}

/**
 * Which spelling wins. A form stated in the canon facts is canonical by definition; otherwise the
 * most-used form wins, and an exact tie goes to whichever appeared first. Deterministic either way —
 * a repair that picked differently on a re-run would be worse than no repair at all.
 *
 * `registered` is the project's known entities — the plan's cast, the tracked names, the canon
 * subjects. When it is supplied, THE WINNER MUST BE ONE OF THEM. A repair may move a name toward a
 * name the project knows; it may never invent one. "Vale Man" was never an entity in that project,
 * and this is the rule that would have refused it.
 */
export function canonicalForm(forms: NameForm[], facts: CanonFactCore[], registered?: Iterable<string>): string {
  const list = (Array.isArray(forms) ? forms : []).slice();
  if (!list.length) return '';
  // A name can be stated as the object of a fact ("full_name" -> "Jason Andrew Quick") or only inside
  // its human statement, so both are searched — as token runs, never as substrings.
  const canonParts = (Array.isArray(facts) ? facts : [])
    .map((f) => normaliseCharacterName(String((f && f.object) || '') + ' ' + String((f && f.statement) || '')))
    .filter(Boolean);
  const reg = registered
    ? new Set(Array.from(registered).map((r) => normaliseCharacterName(r)).filter(Boolean))
    : null;
  const known = (form: string) => canonParts.some((c) => statesName(c, form)) || (!!reg && reg.has(form));
  const stated = list.filter((f) => known(f.form));
  // With a registry and nothing recognised, we do not know which spelling is right — and guessing is
  // how the last one went wrong. Returning '' means "no repair", which is the correct answer.
  const pool = stated.length ? stated : (reg ? [] : list);
  if (!pool.length) return '';
  pool.sort((a, b) => (b.count - a.count) || (a.firstScene - b.firstScene));
  return pool[0].form;
}

/**
 * A character written under more than one full name. Exact, not inferred: two spellings resolving to
 * one key name is a contradiction whatever the story is about.
 */
export function findNameDrift(
  written: Array<{ heading: string; text: string }>,
  tracked: string[],
  facts: CanonFactCore[] = [],
): ContinuityFinding[] {
  const byKey = collectNameForms(written, tracked);
  const out: ContinuityFinding[] = [];
  // The entities this project actually has: the plan's cast and the exits (`tracked`), plus every
  // subject the canon ledger names. A drift repair may only move a spelling toward one of these.
  const registered = Array.from(new Set(
    (Array.isArray(tracked) ? tracked : []).concat(
      (Array.isArray(facts) ? facts : []).map((f) => String((f && f.subject) || '')),
    ).map((t) => normaliseCharacterName(t)).filter(Boolean),
  ));
  byKey.forEach((forms, key) => {
    if (forms.length < 2) return;
    const canonical = canonicalForm(forms, facts, registered);
    // '' means the registry recognised none of the spellings. Two unknown forms of an unknown name
    // is not a fact we can act on, and acting on it anyway is precisely the 1 Sep failure.
    if (!canonical) return;
    const wrong = forms.filter((f) => f.form !== canonical);
    if (!wrong.length) return;
    const list = Array.isArray(written) ? written : [];
    for (let i = 0; i < list.length; i++) {
      const text = String((list[i] && list[i].text) || '');
      const here = wrong.filter((w) => text.indexOf(properCase(w.form)) >= 0 || text.indexOf(w.form) >= 0);
      if (!here.length) continue;
      out.push({
        kind: 'NAME_DRIFT',
        sceneIndex: i,
        heading: String((list[i] && list[i].heading) || ''),
        names: [canonical].concat(here.map((w) => w.form)),
        detail: key + ' is written as ' + here.map((w) => '"' + w.form + '"').join(' and ')
          + ' here, but as "' + canonical + '" elsewhere.',
        repairable: true,
      });
    }
  });
  return out.sort((a, b) => a.sceneIndex - b.sceneIndex);
}

/** "JASON ANDREW QUICK" -> "Jason Andrew Quick", so a replacement matches how prose writes a name. */
export function properCase(name: string): string {
  return String(name || '').toLowerCase().replace(/(^|[\s'’-])(\p{Ll})/gu, (_m, p, c) => p + c.toUpperCase());
}

/**
 * Repair name drift WITHOUT a model. Replacing "Jason Richard Quick" with "Jason Andrew Quick" is a
 * substitution, not a rewrite — sending a two-word correction to a language model would risk the
 * whole scene to fix four characters of it. Both the uppercase (cue) and proper-case (prose) spellings
 * are handled, and nothing else in the scene is touched.
 */
export function canonicaliseNames(text: string, wrongForms: string[], canonical: string): string {
  let out = String(text || '');
  const target = canonical || '';
  if (!target) return out;
  // Anchored on both sides. The unanchored version replaced inside longer names and inside ordinary
  // words, which is half of how "Vale Meridian" became "Vale Man" across a whole screenplay.
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bounded = (x: string) => new RegExp('(?<![\\p{L}\\p{N}])' + esc(x) + '(?![\\p{L}\\p{N}])', 'gu');
  for (const w of (Array.isArray(wrongForms) ? wrongForms : [])) {
    if (!w || w === target) continue;
    out = out.replace(bounded(w), target);
    out = out.replace(bounded(properCase(w)), properCase(target));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// MESSAGE HYGIENE
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Shorten a sentence-shaped string without cutting a word in half.
 *
 * WHY THIS EXISTS. The ending check capped its verdict at a flat 200 characters, which was invisible
 * while the note only coloured a badge. The moment failHeadlessDraft put that note in front of a
 * writer it produced this, on screen, as the explanation for a rejected 95-page draft:
 *
 *   "...never dramatises the outline's final beats: Jason crossing into the US through a Baltimore
 *    freight terminal using."
 *
 * A message that stops mid-word reads as a crash. Prefer a sentence end, fall back to a word end,
 * and mark the cut so the reader knows there was more.
 */
export function trimToSentence(raw: any, max = 240): string {
  const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  // Prefer a whole sentence: a complete thought that stops early reads better in an error than a
  // longer fragment trailing an ellipsis. Only if it keeps at least half the budget, though —
  // backing off to a full stop at character 3 would discard the note instead of shortening it.
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (stop >= max * 0.5) return cut.slice(0, stop + 1);
  // Otherwise cut at a word — but the same floor applies. A single very long token (a URL, a hash)
  // leaves the last space near the start, and backing off to it would return almost nothing; in that
  // case a hard cut is the honest answer.
  const space = cut.lastIndexOf(' ');
  const kept = space > max * 0.6 ? cut.slice(0, space) : cut;
  return kept.replace(/[,;:—-]+$/, '').trim() + '…';
}

// ─────────────────────────────────────────────────────────────────────────────
// MECHANISM C · SCENE INTEGRITY — the export gate.
//
// The 1 Sep "Jason Quick" white draft shipped as a 103-page protected PDF carrying five
// scenes that were not finished sentences:
//
//   scene 78   "Black swell. Jason, twenty-nine, thrashing, l"     ← cut mid-letter
//   scene 87   "But he stops breath"                               ← cut mid-word
//   scene 132  "He stands. She watches the door swing shut"        ← cut mid-clause
//   scene 97   "(The scene continues.)"                            ← a placeholder, nothing else
//   scene 133  "(The scene continues.)"                            ← a placeholder, nothing else
//
// mostlyStub() did not fire because five of a hundred and thirty-nine is far under any stub
// threshold — and it should not have fired, because the run was healthy. A run can be healthy
// and still emit a broken scene. That is what this gate is for: it judges ONE scene on its own
// text, needs no model, no context and no other scene, and it is the cheapest check in the
// system. Every rule below was measured against all 139 scenes of that draft: three truncation
// findings, two placeholder findings, zero false positives.
// ─────────────────────────────────────────────────────────────────────────────

export type SceneDefectKind =
  | 'EMPTY_BODY'          // a numbered scene with no prose at all
  | 'PLACEHOLDER_BODY'    // the model promised the scene instead of writing it
  | 'TRUNCATED_TAIL'      // the last line stops mid-sentence
  | 'TRUNCATED_SLUG'      // the heading itself was cut (unbalanced bracket / no time-of-day)
  | 'LABEL_LEAK';         // a screenplay label became story data

export interface SceneDefect {
  kind: SceneDefectKind;
  sceneIndex: number;
  /** The exact offending text — goes straight into the log and into the repair instruction. */
  detail: string;
}

/**
 * A body that only promises a scene. The model writes these when it runs out of output budget
 * mid-scene: it closes the turn politely instead of stopping mid-word.
 */
const PLACEHOLDER_BODY_RE =
  /^\(?\s*(the\s+)?(scene|sequence)?\s*(continues|to be continued|continued)\s*\.?\s*\)?$|^\(?\s*(continues|tbc|todo|placeholder|\[?\.\.\.\]?)\s*\)?$/i;

/**
 * A finished line of a screenplay ends in terminal punctuation. An em dash counts — an interrupted
 * cue ("Do I—") is deliberate craft, not a truncation. A closing bracket or quote counts too.
 * Everything else in an action or dialogue position is a sentence that stopped being written.
 */
const TERMINAL_PUNCT_RE = /[.!?:;—–\-"'’”\)\]]$/;

/** Time-of-day terminators a well-formed slug ends with. */
const SLUG_TIME_RE =
  /\b(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|MIDDAY|NOON|CONTINUOUS|LATER|MOMENTS LATER|SAME)\s*$/i;

/**
 * Screenplay labels that describe HOW a scene is presented. They belong in cues and headings and
 * must never become story data — a name on a passport, a line of dialogue, a value in a database.
 *
 * In the same draft, the flashback cue YOUNG JASON became the protagonist's legal identity: he
 * reads it off a passport (sc 34), gives it at a police booking counter (sc 118), announces it in
 * a lobby (sc 122), and a corporate access log prints YOUNG JASON — VERIFIED (sc 123). The whole
 * third-act infiltration runs on a formatting artefact. findNameDrift() cannot see it, because
 * YOUNG JASON is a legitimately registered cue — the leak is the label escaping its own layer.
 */
export const SCENE_LABEL_PREFIXES = ['YOUNG', 'YOUNGER', 'OLD', 'OLDER', 'TEEN', 'TEENAGE', 'CHILD', 'ADULT', 'PRE-TEEN'];

/** Words that mark a line as a record, an identifier or something read aloud. */
const RECORD_CONTEXT_RE =
  /\b(passport|licence|license|badge|id|identification|name|names|log|logged|register|registry|records?|screen|monitor|terminal|database|manifest|chyron|caption|reads?|reading|verified|signature|signs?|signed|booking|warrant|file|dossier)\b|:/i;

function labelLeakRe(names: string[]): RegExp | null {
  const clean = names
    .map((n) => normaliseCharacterName(n))
    .filter((n) => n && n.length > 1)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!clean.length) return null;
  return new RegExp(
    '\\b(' + SCENE_LABEL_PREFIXES.join('|') + ')\\s+(' + Array.from(new Set(clean)).join('|') + ')\\b',
    'i',
  );
}

/**
 * A screenplay label that has escaped into the story.
 *
 * In ACTION the pattern is legitimate — "YOUNG JASON, twenty-six, tuxedo undone" is how every
 * screenplay introduces a flashback self — so an action line is only a leak when it also reads as
 * a record: a passport, a log, a screen, a name being given. In DIALOGUE it is never legitimate:
 * no character says another character's presentation label out loud.
 */
export function findLabelLeak(text: string, registeredNames: Iterable<string>): SceneDefect[] {
  const re = labelLeakRe(Array.from(registeredNames || []));
  if (!re) return [];
  const out: SceneDefect[] = [];
  const seen = new Set<string>();
  for (const line of classifyScript(String(text || ''))) {
    if (line.kind !== 'dialogue' && line.kind !== 'action') continue;
    const m = re.exec(line.text);
    if (!m) continue;
    if (line.kind === 'action' && !RECORD_CONTEXT_RE.test(line.text)) continue;
    const detail = line.text.trim().slice(0, 160);
    if (seen.has(detail)) continue;
    seen.add(detail);
    out.push({ kind: 'LABEL_LEAK', sceneIndex: -1, detail });
  }
  return out;
}

/**
 * Judge one scene's own text. No model, no other scene, no story knowledge.
 *
 * `registeredNames` is optional: pass the canon cast and the label-leak rule runs too. Everything
 * else needs nothing but the scene.
 */
export function checkSceneIntegrity(
  sceneIndex: number,
  heading: string,
  text: string,
  registeredNames?: Iterable<string>,
): SceneDefect[] {
  const out: SceneDefect[] = [];
  const head = String(heading || '').trim();

  // ── The heading ────────────────────────────────────────────────────────────
  // A slug cut mid-word leaves an unbalanced bracket or loses its time-of-day. Both are
  // mechanical and neither can happen to a heading the builder wrote whole.
  if (head) {
    const opens = (head.match(/\(/g) || []).length;
    const closes = (head.match(/\)/g) || []).length;
    if (opens > closes) out.push({ kind: 'TRUNCATED_SLUG', sceneIndex, detail: head });
    else if (SLUG_RE.test(head) && !SLUG_TIME_RE.test(head)) out.push({ kind: 'TRUNCATED_SLUG', sceneIndex, detail: head });
  }

  // ── The body ───────────────────────────────────────────────────────────────
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim().length > 0);

  if (!lines.length) {
    out.push({ kind: 'EMPTY_BODY', sceneIndex, detail: head || '(no heading)' });
    return out;
  }

  // A placeholder ANYWHERE in the body is a defect, not only a body made of nothing else.
  // Testing the first version of this rule against all 139 scenes of the Jason Quick draft caught
  // neither of the two placeholder scenes, because each also carried a stray line and so the body
  // was not "empty apart from the placeholder". A scene that promises part of itself is broken in
  // exactly the way a scene that promises all of itself is.
  const placeholder = lines.find((l) => PLACEHOLDER_BODY_RE.test(l.trim()));
  if (placeholder) {
    out.push({ kind: 'PLACEHOLDER_BODY', sceneIndex, detail: placeholder.trim().slice(0, 120) });
    return out;
  }
  const meaningful = lines;

  // Walk back past cues, parentheticals, transitions and sluglines: none of those end a scene in
  // punctuation, and flagging them would fire on every well-formed scene in the draft.
  let tail = '';
  for (let i = meaningful.length - 1; i >= 0; i--) {
    const t = meaningful[i].trim();
    const kind = classifyLine(t, false);
    if (kind === 'cue' || kind === 'paren' || kind === 'trans' || kind === 'slug') continue;
    tail = t;
    break;
  }
  if (tail && !TERMINAL_PUNCT_RE.test(tail)) {
    out.push({ kind: 'TRUNCATED_TAIL', sceneIndex, detail: tail.slice(-90) });
  }

  if (registeredNames) {
    for (const leak of findLabelLeak(text, registeredNames)) out.push({ ...leak, sceneIndex });
  }
  return out;
}

/** One line for the log and for the writer's retry instruction. */
export function sceneDefectInstruction(d: SceneDefect): string {
  switch (d.kind) {
    case 'EMPTY_BODY':
      return 'That scene came back with no prose at all. Write it in full.';
    case 'PLACEHOLDER_BODY':
      return 'You returned a placeholder ("' + d.detail + '") instead of the scene. Write the scene itself — never a note promising it.';
    case 'TRUNCATED_TAIL':
      return 'The scene stops mid-sentence at "' + d.detail + '". Finish the thought and end the scene properly.';
    case 'TRUNCATED_SLUG':
      return 'The heading "' + d.detail + '" is incomplete. Return a whole slug line ending in a time of day.';
    case 'LABEL_LEAK':
      return 'A screenplay presentation label leaked into the story here: "' + d.detail
        + '". Labels such as YOUNG/OLDER/TEEN describe how a character is SHOWN in a flashback. They are never a name on a document, in dialogue, or in a record. Use the character\'s real name.';
    default:
      return 'Rewrite the scene.';
  }
}

/**
 * Shorten a slug location WITHOUT destroying it.
 *
 * `slugOf()` used to do `.slice(0, 48)`, which cut mid-word and silently deleted the rest:
 * "MACRAE BARN — TRAINING SPACE (FLASHBACK, SIX YEARS AGO)" was rendered as
 * "MACRAE BARN — TRAINING SPACE (FLASHBACK, SIX YEA" and "RS AGO)" ceased to exist anywhere in
 * the document. Forty-one of that draft's 139 headings were damaged this way — every one of them
 * a renderer bug, not a model failure.
 *
 * The rules, in order: keep it whole if it fits; drop a whole trailing parenthetical rather than
 * cut into it; otherwise cut at a word boundary and never leave a dangling bracket or connector.
 */
export function shortenSlugLocation(raw: any, max = 58): string {
  const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;

  // A trailing parenthetical is the usual overflow — "(FLASHBACK, SIX YEARS AGO)". Losing it whole
  // is honest; losing half of it is corruption.
  const paren = s.match(/^(.*?)\s*\([^()]*\)\s*$/);
  if (paren && paren[1].trim().length <= max) return paren[1].replace(/[\s,;:—–\-]+$/, '').trim();

  const cut = s.slice(0, max + 1);
  const space = cut.lastIndexOf(' ');
  let kept = space > max * 0.5 ? cut.slice(0, space) : s.slice(0, max);
  // Never end on an unbalanced bracket.
  if ((kept.match(/\(/g) || []).length > (kept.match(/\)/g) || []).length) {
    const open = kept.lastIndexOf('(');
    if (open > 0) kept = kept.slice(0, open);
  }
  // Strip trailing whitespace AND dangling punctuation together — "…NOVA SCOTIA —" must not survive
  // as a heading that ends on a connector. Then drop a stranded preposition the cut left behind.
  return kept
    .replace(/[\s,;:—–\-]+$/, '')
    .replace(/\s+(OF|AND|THE|A|AN|AT|ON|IN|TO|FOR|WITH)$/i, '')
    .replace(/[\s,;:—–\-]+$/, '')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// MECHANISM E (first half) · THE TIME LEDGER
//
// Sophie: "Nine-fifteen. You walk in at nine-fifteen. Not a minute before I'm on the record."
// Two scenes later the lobby clock reads 8:52 and Jason walks in. The plan's whole point — that
// her filing must precede his entrance — is reversed on screen, and nothing in the pipeline could
// see it, because each scene is correct on its own.
//
// Detection needs no model: pull every clock out of the text, note whether the story SPOKE it (a
// plan) or SHOWED it (a fact), and compare.
// ─────────────────────────────────────────────────────────────────────────────

export interface TimeToken {
  sceneIndex: number;
  /** Minutes since midnight, 0-1439. */
  minutes: number;
  /** 'spoken' = a character stated it (an instruction or a plan). 'shown' = it is on screen. */
  source: 'spoken' | 'shown';
  raw: string;
}

const WORD_HOUR: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const WORD_MIN: Record<string, number> = {
  oh: 0, zero: 0, five: 5, ten: 10, fifteen: 15, twenty: 20, 'twenty-five': 25, thirty: 30,
  'thirty-five': 35, forty: 40, 'forty-five': 45, fifty: 50, 'fifty-five': 55, quarter: 15, half: 30,
};

const DIGIT_TIME_RE = /\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?/gi;
const WORD_TIME_RE = new RegExp(
  '\\b(' + Object.keys(WORD_HOUR).join('|') + ')[-\\s]?(' +
  Object.keys(WORD_MIN).join('|').replace(/-/g, '\\-') + ')?\\b\\s*(a\\.?m\\.?|p\\.?m\\.?|o\'clock)?',
  'gi',
);

function toMinutes(h: number, m: number, mer: string | undefined): number {
  let hour = h % 12;
  const suffix = String(mer || '').toLowerCase();
  if (suffix.startsWith('p')) hour += 12;
  else if (!suffix && h >= 13 && h <= 23) hour = h;   // a 24-hour clock stated plainly
  return ((hour * 60 + m) % 1440 + 1440) % 1440;
}

/**
 * Every clock in one scene. `spoken` when a character says it, `shown` when the scene shows it.
 * Word-times only count with an explicit time marker (o'clock / a.m. / p.m. / a following minute)
 * so that "Two foot passengers" and "Bay nine" are not read as times.
 */
export function findTimeTokens(sceneIndex: number, text: string): TimeToken[] {
  const out: TimeToken[] = [];
  for (const line of classifyScript(String(text || ''))) {
    if (line.kind !== 'dialogue' && line.kind !== 'action') continue;
    const source: 'spoken' | 'shown' = line.kind === 'dialogue' ? 'spoken' : 'shown';
    let m: RegExpExecArray | null;
    DIGIT_TIME_RE.lastIndex = 0;
    while ((m = DIGIT_TIME_RE.exec(line.text)) !== null) {
      const h = Number(m[1]);
      const mi = Number(m[2]);
      if (h > 23 || mi > 59) continue;
      out.push({ sceneIndex, minutes: toMinutes(h, mi, m[3]), source, raw: m[0].trim() });
    }
    WORD_TIME_RE.lastIndex = 0;
    while ((m = WORD_TIME_RE.exec(line.text)) !== null) {
      const hour = WORD_HOUR[String(m[1]).toLowerCase()];
      const minWord = m[2] ? String(m[2]).toLowerCase() : '';
      const marker = m[3];
      if (hour == null) continue;
      if (!minWord && !marker) continue;                 // bare "nine" is a number, not a time
      const mi = minWord ? (WORD_MIN[minWord] ?? 0) : 0;
      out.push({ sceneIndex, minutes: toMinutes(hour, mi, marker), source, raw: m[0].trim() });
    }
  }
  return out;
}

export interface TimelineFinding {
  planned: TimeToken;
  shown: TimeToken;
  detail: string;
}

/**
 * A plan stated in dialogue, then contradicted by a clock shown later in the same run of scenes.
 *
 * `window` bounds how far a stated time stays in force — a plan made in scene 120 governs the
 * sequence it sets up, not a clock ninety scenes away. Times within `slack` minutes are treated as
 * the same moment, so "just before nine" against 8:58 is not a finding.
 */
export function checkStatedTimeOrder(tokens: TimeToken[], window = 12, slack = 2): TimelineFinding[] {
  const out: TimelineFinding[] = [];
  const ordered = tokens.slice().sort((a, b) => a.sceneIndex - b.sceneIndex);
  for (const shown of ordered) {
    if (shown.source !== 'shown') continue;
    for (const planned of ordered) {
      if (planned.source !== 'spoken') continue;
      if (planned.sceneIndex >= shown.sceneIndex) continue;
      if (shown.sceneIndex - planned.sceneIndex > window) continue;
      if (planned.minutes - shown.minutes > slack) {
        out.push({
          planned,
          shown,
          detail: 'scene ' + (planned.sceneIndex + 1) + ' states "' + planned.raw
            + '" but scene ' + (shown.sceneIndex + 1) + ' shows "' + shown.raw
            + '" — the plan is contradicted by the clock it was made for.',
        });
        break;
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// MODEL META-COMMENTARY
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The model talking about the scene instead of writing it.
 *
 * "Word count: approximately 66" reached page 2 of a delivered draft. It is not a formatting slip
 * the reader forgives — it is the machine visible through the page, in a document whose whole value
 * is that it reads as if a person wrote it.
 *
 * Stripped rather than flagged. A stray count line is not evidence that the SCENE is wrong, and
 * rewriting a good scene to remove one line trades a page of real prose for a cosmetic fix — the
 * same bad bargain PLACE_JUMP taught. Removal is certain and free; the integrity gate then re-reads
 * the stripped text, so a scene that was nothing but meta still fails as EMPTY_BODY.
 *
 * Both shapes are anchored to a WHOLE line, and both require count vocabulary next to a number, so
 * dialogue cannot trip them: a character may say "sixty-six words" but never "Word count: 66" alone
 * on a line.
 */
const META_LABEL_RE = /^[\s\-–—>*[({]*\s*(?:total\s+|approx(?:\.|imately)?\s+|estimated\s+|est\.?\s+)?(?:word|words|line|lines|page|pages)\s*(?:count|total)?\s*[:=]\s*(?:approx(?:\.|imately)?|about|around|roughly|~|≈)?\s*\d[\d.,]*\s*(?:words?|lines?|pages?)?\s*[\])}]*\s*\.?\s*$/i;
const META_COUNT_RE = /^[\s\-–—>*[({]*\s*(?:approx(?:\.|imately)?|about|around|roughly|~|≈)\s*\d[\d.,]*\s+(?:words?|lines?|pages?)\s*[\])}]*\s*\.?\s*$/i;

/** Every whole line in `text` that is the model counting its own output. */
export function findMetaCommentary(text: string): string[] {
  const out: string[] = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (META_LABEL_RE.test(line) || META_COUNT_RE.test(line)) out.push(line);
  }
  return out;
}

/** The same text with those lines gone, and the blank they leave collapsed. */
export function stripMetaCommentary(text: string): string {
  const src = String(text || '');
  if (!findMetaCommentary(src).length) return src;
  return src
    .split('\n')
    .filter((raw) => {
      const line = raw.trim();
      return !(line && (META_LABEL_RE.test(line) || META_COUNT_RE.test(line)));
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// DEATHS THE WRITER INVENTED
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A death that happens on the PAGE rather than in the plan.
 *
 * THE GAP THIS CLOSES. Every exit the system knows about comes from the planner filling
 * `exits: [{name, how}]` on a scene. On 1 Sep the plan said KANE @ 129 — and the writer killed him
 * in scene 116 anyway, on its own initiative, then had him speak through the whole of 117. The
 * ledger could not see it: nothing reads a death out of the written prose, so as far as every check
 * in the system was concerned Kane was alive until 129 and scene 117 was correct.
 *
 * WHY THIS IS DELIBERATELY TIMID. A false positive here is not a nuisance finding — feed one
 * forward and a living lead is struck out of the third act. So:
 *   * ACTION lines only. Dialogue is where characters lie, guess and grieve prematurely, and
 *     "He's dead!" over a body that sits up is a screenwriting staple, not a fact.
 *   * A closed list of predicates, each required in the SAME sentence as the name, adjacent to it.
 *   * Any hedge or negation in that sentence voids it — almost, nearly, as if, presumed, thinks,
 *     would have, isn't, and a question mark.
 *   * Never inside a flashback, where a death may be the one already accounted for.
 * `shoots` is absent from the list on purpose: people survive being shot, and screenplays say so.
 */
export interface WrittenDeath {
  /** The registered form, as passed in. */
  name: string;
  /** 0-based index of the scene whose prose kills them. */
  sceneIndex: number;
  /** The predicate that matched — "dies", "is killed", "'s body". */
  how: string;
  /** The sentence it was read from, for the operator to judge. */
  evidence: string;
}

/** A hedge anywhere in the sentence voids the reading. */
const DEATH_HEDGE_RE = /\b(?:almost|nearly|as if|as though|like he|like she|would have|could have|might|maybe|perhaps|presumed|presumably|thinks|believes|imagines|dreams|pretend(?:s|ing)?|plays dead|not|n't|never|unless|if)\b|\?/i;

/**
 * Predicates where the name is the SUBJECT: "VALE dies.", "KANE is dead."
 *
 * PRESENT TENSE ONLY, and that is the load-bearing decision. Screenplay action is written in the
 * present, so "VALE dies" is this scene killing him. The past tense is how action carries BACKSTORY
 * — "A photograph of the boy who died", "the men who murdered his father" — and reading those as
 * deaths would strike living characters out of the film for the crime of being remembered.
 */
const DEATH_SUBJECT = '(?:dies|is dead|lies dead|falls dead|drops dead|slumps dead|bleeds out|is killed|stops breathing)';
/** Predicates where the name is the OBJECT: "JASON kills VALE." */
const DEATH_OBJECT = '(?:kills|murders|executes)';
/** Possessive remains: "VALE's body", "the corpse of VALE". */
const DEATH_REMAINS = '(?:body|corpse|remains)';

function escRe(s: string): string { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Split an action line into sentences, so a name and a predicate must actually belong together. */
function sentencesOf(line: string): string[] {
  return String(line || '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

export function findWrittenDeaths(
  sceneIndex: number,
  heading: string,
  text: string,
  registeredNames: Iterable<string>,
): WrittenDeath[] {
  const names = Array.from(registeredNames || [])
    .map((n) => normaliseCharacterName(n))
    .filter((n) => n && keyName(n).length >= 3);
  if (!names.length) return [];
  // The dead may die again in the past. A flashback is never a new death in the running order.
  if (isRecalledTime(heading, text)) return [];

  const out: WrittenDeath[] = [];
  for (const line of classifyScript(String(text || ''))) {
    if (line.kind !== 'action') continue;
    for (const sentence of sentencesOf(line.text)) {
      if (DEATH_HEDGE_RE.test(sentence)) continue;
      for (const name of names) {
        if (out.some((d) => sameCharacter(d.name, name))) continue;
        const n = escRe(name);
        // Up to three words may sit between the name and its predicate ("VALE, still gripping the
        // rail, dies.") — enough for an interruption, too few to reach the next clause's subject.
        const subj = new RegExp('\\b' + n + '\\b(?:[^.!?]{0,40}?)\\s' + DEATH_SUBJECT + '\\b', 'i');
        const obj = new RegExp('\\b' + DEATH_OBJECT + '\\s+(?:\\w+\\s+){0,2}?' + n + '\\b', 'i');
        const mine = new RegExp('\\b' + n + '(?:\'s|’s)\\s+' + DEATH_REMAINS + '\\b', 'i');
        const theirs = new RegExp('\\b' + DEATH_REMAINS + '\\s+of\\s+' + n + '\\b', 'i');
        const m = subj.exec(sentence) || obj.exec(sentence) || mine.exec(sentence) || theirs.exec(sentence);
        if (!m) continue;
        out.push({
          name,
          sceneIndex,
          how: String(m[0]).replace(new RegExp('\\b' + n + '\\b', 'ig'), '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'dies',
          evidence: sentence.slice(0, 160),
        });
      }
    }
  }
  return out;
}

/** Sweep a written draft for deaths the plan never declared. First death per character wins. */
export function collectWrittenDeaths(
  written: Array<{ heading: string; text: string }>,
  registeredNames: Iterable<string>,
): WrittenDeath[] {
  const out: WrittenDeath[] = [];
  const list = Array.isArray(written) ? written : [];
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (!w || !w.text) continue;
    for (const d of findWrittenDeaths(i, w.heading, w.text, registeredNames)) {
      if (out.some((x) => sameCharacter(x.name, d.name))) continue;
      out.push(d);
    }
  }
  return out;
}

/**
 * Written deaths in the shape the existing continuity checks already speak.
 *
 * `plan` is passed so a death the planner ALREADY declared is dropped: that one is covered by the
 * ordinary exit machinery, and reporting it twice would bury the new information.
 */
export function writtenDeathsAsExits(deaths: WrittenDeath[], plan: CastExit[] = []): CastExit[] {
  return (Array.isArray(deaths) ? deaths : [])
    .filter((d) => !(plan || []).some((p) => sameCharacter(p.name, d.name)))
    .map((d) => ({ name: d.name, scene: d.sceneIndex, how: d.how || 'dies on the page' }));
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// FIXED ATTRIBUTES
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Properties of a person that the story is not allowed to change quietly.
 *
 * THE DEFECT. Daria Kane is referred to with female pronouns for most of a draft and male pronouns
 * for the rest. Nothing in the system could see it: the ledger tracks life, place, physical, knows,
 * holds and open — six dimensions, all of them about what a character DOES or where they ARE, none
 * about what they irreducibly are. A character's pronouns, initials, handedness, accent or eye
 * colour drift with no more resistance than the writer's short-term memory.
 *
 * This is the frame for all of them, with pronouns as the first and currently only extractor. A
 * second (the signature that turns from A.Q. into R. Quick) plugs in as another evidence collector
 * feeding the same `settleFixedAttribute` verdict.
 *
 * WHY PRONOUNS ARE MEASURED IN AGGREGATE, NOT PER SENTENCE. Attributing a pronoun to a name inside
 * one sentence is guesswork — "KANE hands the guard his coat" leaves the coat's owner genuinely
 * open. Counting across a whole draft does not need any single sentence to be right: a character
 * written consistently produces a near-unanimous tally, and a character who FLIPS produces two
 * substantial piles. The finding is the two piles, not any one sentence.
 */
export type PronounGender = 'he' | 'she' | 'they';

const PRONOUN_HE = /\b(?:he|him|his|himself)\b/i;
const PRONOUN_SHE = /\b(?:she|her|hers|herself)\b/i;
const PRONOUN_THEY = /\b(?:they|them|their|theirs|themselves)\b/i;

/**
 * Unnamed people who can own a pronoun the sentence seems to hand to the named character. A
 * sentence containing one of these is discarded rather than guessed at — precision at the source
 * is worth more than any threshold applied afterwards.
 */
const OTHER_PERSON_RE = new RegExp('\\b(?:' + [
  'man', 'men', 'woman', 'women', 'boy', 'boys', 'girl', 'girls', 'kid', 'kids', 'child', 'children',
  'guard', 'guards', 'driver', 'officer', 'officers', 'cop', 'cops', 'doctor', 'nurse', 'agent', 'agents',
  'soldier', 'soldiers', 'shooter', 'shooters', 'stranger', 'figure', 'someone', 'somebody', 'father',
  'mother', 'brother', 'sister', 'son', 'daughter', 'husband', 'wife', 'partner', 'lawyer', 'clerk',
  'bartender', 'waiter', 'waitress', 'attendant', 'technician', 'contractor', 'passenger', 'pilot',
].join('|') + ')\\b', 'i');

export interface PronounEvidence {
  name: string;
  gender: PronounGender;
  sceneIndex: number;
  /** The sentence it was read from, so a disputed tally can be audited by eye. */
  sentence: string;
}

/**
 * Pronouns attributable to a registered person in one scene's ACTION.
 *
 * Action only, because dialogue is people talking ABOUT each other and getting it wrong on purpose.
 * One registered name per sentence, the pronoun after the name, and no unnamed person in the
 * sentence to steal it.
 */
export function collectPronounEvidence(
  sceneIndex: number,
  text: string,
  registeredNames: Iterable<string>,
): PronounEvidence[] {
  const names = Array.from(registeredNames || [])
    .map((n) => normaliseCharacterName(n))
    .filter((n) => n && keyName(n).length >= 3);
  if (!names.length) return [];
  const out: PronounEvidence[] = [];
  for (const line of classifyScript(String(text || ''))) {
    if (line.kind !== 'action') continue;
    for (const sentence of sentencesOf(line.text)) {
      if (OTHER_PERSON_RE.test(sentence)) continue;
      // Exactly one registered name, or the pronoun's owner is a coin toss.
      const present = names.filter((n) => new RegExp('\\b' + escRe(n) + '\\b', 'i').test(sentence));
      if (present.length !== 1) continue;
      const name = present[0];
      const at = sentence.search(new RegExp('\\b' + escRe(name) + '\\b', 'i'));
      const after = sentence.slice(at + name.length);
      if (PRONOUN_HE.test(after)) out.push({ name, gender: 'he', sceneIndex, sentence: sentence.slice(0, 160) });
      else if (PRONOUN_SHE.test(after)) out.push({ name, gender: 'she', sceneIndex, sentence: sentence.slice(0, 160) });
      else if (PRONOUN_THEY.test(after)) out.push({ name, gender: 'they', sceneIndex, sentence: sentence.slice(0, 160) });
    }
  }
  return out;
}

export interface FixedAttributeFinding {
  kind: 'ATTRIBUTE_DRIFT';
  /** Which property moved. More will follow pronouns — signature is the next one. */
  attribute: 'pronouns';
  name: string;
  /** The value the draft mostly uses. */
  settled: string;
  settledCount: number;
  /** The value that contradicts it. */
  conflicting: string;
  conflictCount: number;
  /** 1-based scene numbers where the minority value appears, for the operator to open. */
  scenes: number[];
  /** One quoted sentence from the minority pile. */
  evidence: string;
  detail: string;
}

/**
 * A character written with BOTH masculine and feminine pronouns.
 *
 * `they` is collected but never counts as a conflict, and that is a deliberate exclusion twice
 * over: a character may use singular they, and English's plural they makes "KANE watches. They
 * scatter." unattributable anyway. Only the he/she flip — the actual defect — is reported.
 *
 * The majority floor of two stops a lone ambiguous possessive from being called drift; the minority
 * floor of one means a real flip is reported the first time it happens.
 */
export function findPronounDrift(evidence: PronounEvidence[], minMajority = 2): FixedAttributeFinding[] {
  const byName = new Map<string, PronounEvidence[]>();
  for (const e of Array.isArray(evidence) ? evidence : []) {
    const k = keyName(e.name);
    if (!k) continue;
    const arr = byName.get(k) || [];
    arr.push(e);
    byName.set(k, arr);
  }
  const out: FixedAttributeFinding[] = [];
  for (const arr of byName.values()) {
    const he = arr.filter((e) => e.gender === 'he');
    const she = arr.filter((e) => e.gender === 'she');
    if (!he.length || !she.length) continue;
    // On a tie the draft has no majority, so counting cannot settle it — the EARLIER value wins,
    // because that is the one the script established and the other one is the drift away from it.
    // Deterministic either way; picking by array order would have been a coin toss with a comment.
    const first = (arr2: PronounEvidence[]) => Math.min(...arr2.map((e) => e.sceneIndex));
    const heWins = he.length !== she.length ? he.length > she.length : first(he) < first(she);
    const [major, minor] = heWins ? [he, she] : [she, he];
    if (major.length < minMajority) continue;
    const name = major[0].name;
    const scenes = Array.from(new Set(minor.map((e) => e.sceneIndex + 1))).sort((a, b) => a - b);
    out.push({
      kind: 'ATTRIBUTE_DRIFT',
      attribute: 'pronouns',
      name,
      settled: major[0].gender,
      settledCount: major.length,
      conflicting: minor[0].gender,
      conflictCount: minor.length,
      scenes,
      evidence: minor[0].sentence,
      detail: name + ' is written as "' + major[0].gender + '" in ' + major.length + ' place'
        + (major.length === 1 ? '' : 's') + ' and as "' + minor[0].gender + '" in ' + minor.length
        + ' — scene' + (scenes.length === 1 ? ' ' : 's ') + scenes.join(', ')
        + '. A person\'s pronouns are not a story event; pick one and make the other scenes match.',
    });
  }
  return out;
}

/** Sweep a whole written draft for fixed-attribute drift. */
export function checkFixedAttributes(
  written: Array<{ heading: string; text: string }>,
  registeredNames: Iterable<string>,
): FixedAttributeFinding[] {
  const list = Array.isArray(written) ? written : [];
  const evidence: PronounEvidence[] = [];
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (!w || !w.text) continue;
    for (const e of collectPronounEvidence(i, w.text, registeredNames)) evidence.push(e);
  }
  return findPronounDrift(evidence);
}
