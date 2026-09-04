/**
 * BRIEF RECOMMENDATIONS — read the attached material, pre-select the Brief.
 *
 * The user attaches two PDFs and a link, hits Continue, and the Brief opens already filled in with
 * whatever the material evidences: genre, setting, era, rating, market, language, tone, comps, spine.
 * Every one of them is a SOFT selection — changeable, addable, never locked, and nothing is ever
 * blocked waiting for one. A field the material does not evidence is simply left EMPTY for the user
 * to choose, never silently defaulted.
 *
 * PURE. No Nest, no Prisma, no AI client, no I/O. The one model call is made by the service and its
 * parsed reply is passed to `coerceRecommendations` — so every rule below is unit-testable without a
 * model, which is the only way to know the safety rules actually hold.
 *
 * THE TWO RULES THAT MAKE AN UNVALIDATED MODEL SAFE HERE:
 *
 *   1. THE FORM SENDS ITS OWN OPTION LISTS, and a value that is not in them is DROPPED. The model
 *      cannot invent a 33rd genre or a rating the picker has never heard of. The lists are not
 *      duplicated in the backend — they arrive with the request from the form that will display the
 *      result, so the two can never drift apart.
 *   2. NO REASON, NO RECOMMENDATION. Every value must arrive with the reasoning behind it. An
 *      unexplained field is dropped.
 *
 *      This is NOT a rule against inference. The analysis is meant to READ — a silo procedural on a
 *      countdown is a thriller whether or not the word appears anywhere in the material, and an
 *      analysis that will only repeat words already on the page fills nothing, which is exactly what
 *      the first version of this did. The line is grounded-in-the-material versus
 *      invented-from-convention, and `why` is what draws it: a reason that points at the material is
 *      a judgement; one that can only point at what such projects usually look like is a guess.
 *
 * NEVER THROWS. A failed analysis leaves the Brief exactly as it would have been without one.
 */

export type FieldKind = 'enum' | 'enumList' | 'text' | 'textList' | 'number' | 'flags';

export interface FieldSpec {
  kind: FieldKind;
  /** enum/enumList/flags: the key in the caller-supplied options map. */
  options?: string;
  /** text/textList: hard character cap, so a model cannot pour an essay into a one-line field. */
  max?: number;
  /** enumList/textList: how many entries survive. */
  maxItems?: number;
  /** number: inclusive bounds. Anything outside is dropped, never clamped — a clamped guess is a lie. */
  min?: number;
  maxNum?: number;
}

export interface Recommendation {
  field: string;
  value: any;
  /** The evidence, in the model's words. Required — a recommendation without one is dropped. */
  why: string;
}

export interface ApplyResult<T> {
  form: T;
  applied: Recommendation[];
  /** Recommendations refused because the user had already touched that field. */
  skipped: Recommendation[];
}

/**
 * The evidence must EXIST. It is not length-gated.
 *
 * This was 12 characters, which was a number I made up — and this project has a doctrine about
 * exactly that: pick a threshold where the data has a gap, and if there is no data, do not invent
 * one. "p. 12" is six characters and is a perfectly good reason. The RULE (no reason, no
 * recommendation) is the safety property and it stays; the arbitrary length was never part of it.
 */
export const MIN_WHY_CHARS = 1;
export const MAX_WHY_CHARS = 240;
/** A single analysis may not fill more of the form than this — a wall of guesses is not a head start. */
export const MAX_RECOMMENDATIONS = 24;

/**
 * Every field the analysis is allowed to touch, and the shape it must arrive in.
 *
 * A field absent from this table can never be written by an analysis, whatever the model returns.
 * That is deliberate: the table is the allow-list, so adding a field is a decision someone makes
 * here rather than something a prompt can do on its own.
 */
export const FIELD_SPECS: Record<string, FieldSpec> = {
  // THE CREATIVE DNA PANEL. These are the fields the picker actually binds to.
  //
  // `genres` and `tone` are NOT here, deliberately: they are DERIVED. ScriptOnIntake's reDna()
  // computes `genres` as [...baseGenres, ...blendLayers] and `tone` by joining tones and moods, so
  // writing to either produces nothing a user can see and is overwritten the moment they touch a
  // chip. Recommending into a computed field is how an analysis can succeed completely and leave a
  // form that looks untouched.
  baseGenres: { kind: 'enumList', options: 'baseGenres', maxItems: 3 },
  blendLayers: { kind: 'enumList', options: 'blendLayers', maxItems: 6 },
  tones: { kind: 'enumList', options: 'tones', maxItems: 4 },
  moods: { kind: 'enumList', options: 'moods', maxItems: 4 },
  treatment: { kind: 'enum', options: 'treatment' },
  projectType: { kind: 'enum', options: 'projectType' },
  language: { kind: 'enum', options: 'language' },
  country: { kind: 'enum', options: 'country' },
  rating: { kind: 'enum', options: 'rating' },
  framework: { kind: 'enum', options: 'framework' },
  loreDensity: { kind: 'enum', options: 'loreDensity' },
  settingEra: { kind: 'text', max: 120 },
  settingCountry: { kind: 'text', max: 120 },
  settingWorld: { kind: 'textList', max: 80, maxItems: 6 },
  // `cultureEra` and `settingPlace` are ABSENT for the same reason as `genres` and `tone`: reDna()
  // computes cultureEra as [settingCountry, settingEra] joined and settingPlace as [settingCountry].
  // Filling either lights up nothing and is erased on the user's next keystroke. Five derived fields
  // have now been found in this one form; every one of them is pinned by a test below.
  projectIntent: { kind: 'text', max: 160 },
  budgetTier: { kind: 'text', max: 60 },
  comps: { kind: 'textList', max: 120, maxItems: 8 },
  researchSubject: { kind: 'number', min: 0, maxNum: 1 },
  realBased: { kind: 'number', min: 0, maxNum: 1 },
  researchAmount: { kind: 'number', min: 0, maxNum: 100 },
  researchDepth: { kind: 'number', min: 0, maxNum: 100 },
  // RESEARCH SCOPE is six lanes, all ON by default, and the panel says so. Not all six are
  // applicable to every story: a two-hander in one flat needs no box-office comps lane, and an
  // invented world needs no real-subject-and-history lane. So this is the one field the analysis
  // NARROWS rather than fills — it names the lanes this material actually needs and the rest go off.
  //
  // 'flags' exists because the form stores this as an OBJECT of booleans, not a list. Coercion
  // returns every option key with an explicit true/false, so the chips render exactly what was
  // decided and nothing is left to a merge on the other side.
  researchScope: { kind: 'flags', options: 'researchScope' },
  targetPages: { kind: 'number', min: 90, maxNum: 115 },
  episodes: { kind: 'number', min: 1, maxNum: 200 },
  minutesPerEp: { kind: 'number', min: 1, maxNum: 180 },
  seasons: { kind: 'number', min: 1, maxNum: 20 },
  'spine.want': { kind: 'text', max: 200 },
  'spine.need': { kind: 'text', max: 200 },
  'spine.opposing': { kind: 'text', max: 200 },
  'spine.theme': { kind: 'text', max: 200 },
  // ENDING is chosen as ids, and `spine.ending` is COMPOSED from them by composeEnding() — another
  // derived field, and writing it would be the genres/tone mistake a second time.
  'spine.endingIds': { kind: 'enumList', options: 'endings', maxItems: 2 },
  // STYLE & VOICE and SUB-GENRES are craft choices, not facts about the material. They are in the
  // allow-list so they CAN be filled, and the prompt tells the reader to leave them alone unless the
  // material makes the choice for it. An unasked-for style is a note the writer has to undo.
  styles: { kind: 'enumList', options: 'styles', maxItems: 2 },
  subgenres: { kind: 'enumList', options: 'subgenres', maxItems: 4 },
};

/** Everything the analysis may be asked for, for the prompt to enumerate. */
export function recommendableFields(): string[] { return Object.keys(FIELD_SPECS); }

/**
 * What a model calls a field, mapped to what this form calls it.
 *
 * The prompt names every field exactly and a model still answers with `genre`, `era` or `want` —
 * naming is the single most likely reason a good analysis produces an empty form. These are exact
 * aliases, deliberately: a name not listed here is still dropped rather than guessed at, so the
 * allow-list keeps its meaning.
 */
export const FIELD_ALIASES: Record<string, string> = {
  genre: 'baseGenres', genres: 'baseGenres', basegenre: 'baseGenres',
  blend: 'blendLayers', blendlayer: 'blendLayers', layers: 'blendLayers',
  tone: 'tones', mood: 'moods',
  type: 'projectType', format: 'projectType', projecttype: 'projectType',
  market: 'country', territory: 'country', audience: 'country',
  era: 'settingEra', period: 'settingEra', timeperiod: 'settingEra', time: 'settingEra',
  setting: 'settingCountry', location: 'settingCountry', place: 'settingCountry',
  places: 'settingCountry', locations: 'settingCountry', world: 'settingWorld', worlds: 'settingWorld',
  culture: 'settingCountry', narrativestyle: 'treatment', narrativemethod: 'treatment', structure: 'treatment',
  comp: 'comps', comparables: 'comps', references: 'comps',
  intent: 'projectIntent', budget: 'budgetTier', pages: 'targetPages', pagecount: 'targetPages',
  want: 'spine.want', need: 'spine.need', opposing: 'spine.opposing', antagonist: 'spine.opposing',
  theme: 'spine.theme',
  ending: 'spine.endingIds', endings: 'spine.endingIds', endingids: 'spine.endingIds',
  style: 'styles', voice: 'styles', craftvoice: 'styles', stylepack: 'styles',
  subgenre: 'subgenres', subgenres: 'subgenres',
  lore: 'loreDensity', loredensity: 'loreDensity',
  scope: 'researchScope', scopes: 'researchScope', researchlanes: 'researchScope',
  depth: 'researchDepth', researchlevel: 'researchAmount', realdetail: 'researchAmount',
};

/** Resolve a model-supplied field name to one this form knows, or null. */
export function canonicalField(name: any): string | null {
  const raw = String(name == null ? '' : name).trim();
  if (!raw) return null;
  if (FIELD_SPECS[raw]) return raw;
  const key = raw.toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (FIELD_ALIASES[key]) return FIELD_ALIASES[key];
  for (const f of Object.keys(FIELD_SPECS)) {
    if (f.toLowerCase().replace(/[^a-z0-9.]/g, '') === key) return f;
  }
  // "spine.want" arriving as "spinewant"
  for (const f of Object.keys(FIELD_SPECS)) {
    if (f.indexOf('.') >= 0 && f.toLowerCase().replace(/[^a-z0-9]/g, '') === key.replace(/\./g, '')) return f;
  }
  return null;
}

/**
 * Pull the rows out of whatever shape the reply arrived in.
 *
 * Four shapes are accepted because all four are things models actually return: a bare array,
 * {fields:[...]}, a differently-named wrapper, and the object-map form {genres:{value,why}}. This
 * is tolerance about PACKAGING only — every row still has to survive the allow-list, the option
 * lists and the reason rule below.
 */
/**
 * SALVAGE A TRUNCATED REPLY.
 *
 * On 3 Sep a 33-field analysis came back cut off mid-word inside the fifteenth `why` string. The
 * fourteen complete rows before it were perfect — right fields, real evidence — and every one was
 * discarded, because extractJson() takes the first `{` to the last `}` and JSON.parse rejects the
 * broken object at the end. Zero fields, from a reply that had already done the work.
 *
 * A bigger output budget makes that rarer; it cannot make it impossible, because the budget is
 * finite and the field list grows. So the reply is read row by row: every COMPLETE `{...}` object
 * is parsed on its own, and an incomplete tail is dropped rather than taking the whole answer with
 * it. Same doctrine as the second-document repair on the output side — keep what finished.
 *
 * The scan is string-aware: a brace inside a quoted string, and a quote escaped inside one, must
 * not move the depth, or a `why` containing punctuation would split a row in half.
 */
export function salvageRows(text: string): any[] {
  const s = String(text == null ? '' : text);
  const out: any[] = [];
  const starts: number[] = [];
  let inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') { starts.push(i); continue; }
    if (c === '}') {
      const from = starts.pop();
      if (from === undefined) continue;               // a stray closer, never a row
      // A row is recognised by carrying `field`, at WHATEVER depth it sits. Depth is the whole
      // point: rows live inside {"fields":[ ... ]}, and in a truncated reply that envelope brace
      // never closes — so anything that waits for the outermost object to complete recovers
      // nothing, which is what the first version of this did.
      try {
        const o = JSON.parse(s.slice(from, i + 1));
        if (o && typeof o === 'object' && !Array.isArray(o) && (o as any).field !== undefined) out.push(o);
      } catch { /* an object that will not parse alone is not a row */ }
    }
  }
  return out;
}

export function rowsFrom(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  for (const k of ['fields', 'recommendations', 'suggestions', 'brief', 'result']) {
    const v = (raw as any)[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = rowsFrom(v);
      if (nested.length) return nested;
    }
  }
  // Object-map form: { genres: {value:[...], why:"..."}, tone: "cold" }
  const rows: any[] = [];
  for (const k of Object.keys(raw)) {
    const v = (raw as any)[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && ('value' in v || 'why' in v || 'reason' in v)) {
      rows.push({ field: k, value: (v as any).value, why: (v as any).why || (v as any).reason });
    }
  }
  return rows;
}

function tidy(v: any, max: number): string {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Strip everything that is not a letter or digit, for a last-resort option match. */
function loose(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

/**
 * Resolve a model-supplied value to one of the form's OWN options, or null.
 *
 * Three passes, each stricter than a human would need and looser than nothing: exact, then
 * case-insensitive, then alphanumeric-only (so "Sci Fi", "sci-fi" and "SciFi" all reach the option
 * spelled "Sci-fi"). If none of them lands, the value is DROPPED. It is never approximated to the
 * nearest neighbour — a wrong genre silently selected is worse than an empty one.
 */
export function matchOption(value: any, options: string[] | null | undefined): string | null {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return null;
  const list = (Array.isArray(options) ? options : []).filter((o) => typeof o === 'string' && o.trim());
  if (!list.length) return null;
  for (const o of list) if (o === raw) return o;
  const lower = raw.toLowerCase();
  for (const o of list) if (o.toLowerCase() === lower) return o;
  const tight = loose(raw);
  if (!tight) return null;
  for (const o of list) if (loose(o) === tight) return o;
  return null;
}

/**
 * Turn a model reply into recommendations the form can safely receive.
 *
 * `options` is the form's own lists, sent with the request. `raw` is whatever the model returned.
 * Everything that does not survive both rules at the top of this file is dropped in silence — a
 * dropped field simply stays empty, which is the designed outcome, not a failure.
 */
export function coerceRecommendations(
  raw: any,
  options: Record<string, string[]> | null | undefined,
  limit = MAX_RECOMMENDATIONS,
): Recommendation[] {
  const opts = (options && typeof options === 'object') ? options : {};
  const rows: any[] = rowsFrom(raw);
  const out: Recommendation[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const field = canonicalField(r.field);
    const spec = field ? FIELD_SPECS[field] : null;
    if (!field || !spec || seen.has(field)) continue;
    const why = tidy(r.why != null ? r.why : (r as any).reason, MAX_WHY_CHARS);
    if (why.length < MIN_WHY_CHARS) continue;

    let value: any = null;
    if (spec.kind === 'enum') {
      value = matchOption(r.value, opts[spec.options || field]);
    } else if (spec.kind === 'enumList') {
      const list = Array.isArray(r.value) ? r.value : [r.value];
      const picked: string[] = [];
      for (const v of list) {
        const m = matchOption(v, opts[spec.options || field]);
        if (m && picked.indexOf(m) < 0) picked.push(m);
        if (picked.length >= (spec.maxItems || 4)) break;
      }
      value = picked.length ? picked : null;
    } else if (spec.kind === 'text') {
      const t = tidy(r.value, spec.max || 200);
      value = t ? t : null;
    } else if (spec.kind === 'textList') {
      const list = Array.isArray(r.value) ? r.value : [r.value];
      const picked: string[] = [];
      for (const v of list) {
        const t = tidy(v, spec.max || 120);
        if (t && picked.indexOf(t) < 0) picked.push(t);
        if (picked.length >= (spec.maxItems || 6)) break;
      }
      value = picked.length ? picked : null;
    } else if (spec.kind === 'flags') {
      const keys = (opts[spec.options || field] || []).filter((k) => typeof k === 'string' && k.trim());
      const wanted = new Set<string>();
      if (keys.length) {
        const rv: any = r.value;
        if (Array.isArray(rv)) {
          for (const v of rv) { const m = matchOption(v, keys); if (m) wanted.add(m); }
        } else if (rv && typeof rv === 'object') {
          // {subject:true, comps:false} — a shape models return as readily as a list.
          for (const k of Object.keys(rv)) { if (!(rv as any)[k]) continue; const m = matchOption(k, keys); if (m) wanted.add(m); }
        } else {
          const m = matchOption(rv, keys); if (m) wanted.add(m);
        }
      }
      // Every lane off is not a narrowing, it is a disable, and nobody asked for that. Dropped, so
      // the panel keeps the on-by-default state it would have had without an analysis at all.
      if (!wanted.size) value = null;
      else { const o: Record<string, boolean> = {}; for (const k of keys) o[k] = wanted.has(k); value = o; }
    } else if (spec.kind === 'number') {
      const n = Number(r.value);
      // Out of range is DROPPED, not clamped. A clamped guess reads as a measurement.
      value = (isFinite(n) && n >= (spec.min as number) && n <= (spec.maxNum as number)) ? n : null;
    }
    if (value === null) continue;
    seen.add(field);
    out.push({ field, value, why });
    if (out.length >= Math.max(1, limit)) break;
  }
  return out;
}

function getPath(form: any, field: string): any {
  if (field.indexOf('.') < 0) return form ? form[field] : undefined;
  const [a, b] = field.split('.');
  const inner = form ? form[a] : undefined;
  return inner && typeof inner === 'object' ? inner[b] : undefined;
}

function setPath<T>(form: T, field: string, value: any): T {
  if (field.indexOf('.') < 0) return { ...(form as any), [field]: value };
  const [a, b] = field.split('.');
  const inner = (form as any)[a];
  return { ...(form as any), [a]: { ...(inner && typeof inner === 'object' ? inner : {}), [b]: value } };
}

/** A field the user has genuinely filled in. Empty string, empty array and null are all "untouched". */
export function hasUserValue(form: any, field: string): boolean {
  // A 'flags' field ships fully switched ON — that is a default, not a decision, exactly like the
  // checkbox case below. Presence can therefore never protect it; only `touched` can, which is
  // right: the user has to have actually clicked a lane for their choice to be theirs.
  if (FIELD_SPECS[field] && FIELD_SPECS[field].kind === 'flags') return false;
  const v = getPath(form, field);
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'number') return true;
  if (typeof v === 'boolean') return false;   // a default checkbox is not a decision
  return true;
}

/**
 * Apply recommendations to the form in ONE step, and never over a field the user has touched.
 *
 * `touched` is every field the user has interacted with, whether or not they left a value in it —
 * clearing a field is a decision too, and an analysis landing afterwards must not undo it. A field
 * that already holds a value is also left alone even if it was never explicitly touched, which
 * covers the case of a draft resumed from localStorage.
 *
 * Pure and returns a NEW form, so the React layer keeps no logic worth testing: everything that
 * decides whether a value lands is here, under test.
 */
export function applyRecommendations<T extends Record<string, any>>(
  form: T,
  recs: Recommendation[] | null | undefined,
  touched?: Iterable<string> | null,
): ApplyResult<T> {
  const touchedSet = new Set<string>(touched ? Array.from(touched).map((s) => String(s)) : []);
  let next: T = form && typeof form === 'object' ? ({ ...(form as any) } as T) : ({} as T);
  const applied: Recommendation[] = [];
  const skipped: Recommendation[] = [];
  for (const r of Array.isArray(recs) ? recs : []) {
    if (!r || !r.field || !FIELD_SPECS[r.field]) continue;
    if (touchedSet.has(r.field) || hasUserValue(next, r.field)) { skipped.push(r); continue; }
    next = setPath(next, r.field, r.value);
    applied.push(r);
  }
  return { form: next, applied, skipped };
}

/**
 * Undo exactly what an analysis wrote, and nothing else.
 *
 * Only fields still holding the recommended value are cleared — anything the user has since edited
 * is theirs and stays. This is what makes "Undo all" safe to press at any moment.
 */
export function undoRecommendations<T extends Record<string, any>>(
  form: T,
  applied: Recommendation[] | null | undefined,
): T {
  let next: T = form && typeof form === 'object' ? ({ ...(form as any) } as T) : ({} as T);
  for (const r of Array.isArray(applied) ? applied : []) {
    if (!r || !r.field) continue;
    const spec = FIELD_SPECS[r.field];
    if (!spec) continue;
    const cur = getPath(next, r.field);
    let same: boolean;
    if (spec.kind === 'flags') {
      // Compare lane by lane. The form rebuilds this object on every render, so reference equality
      // would report "the user changed it" on a form nobody has touched.
      const a = (r.value && typeof r.value === 'object') ? r.value : {};
      const b = (cur && typeof cur === 'object') ? cur : null;
      same = !!b && Object.keys(a).length === Object.keys(b).length
        && Object.keys(a).every((k) => !!(a as any)[k] === !!(b as any)[k]);
    } else if (Array.isArray(r.value) && Array.isArray(cur)) {
      same = cur.length === r.value.length && cur.every((v: any, i: number) => v === r.value[i]);
    } else {
      same = cur === r.value;
    }
    if (!same) continue;
    if (spec.kind === 'flags') {
      // Undo restores the DEFAULT, which for these lanes is every one of them on — not an empty
      // object, which would silently leave the story with no research at all.
      const back: Record<string, boolean> = {};
      for (const k of Object.keys((r.value && typeof r.value === 'object') ? r.value : {})) back[k] = true;
      next = setPath(next, r.field, back);
      continue;
    }
    const empty = (spec.kind === 'enumList' || spec.kind === 'textList') ? [] : (spec.kind === 'number' ? null : '');
    next = setPath(next, r.field, empty);
  }
  return next;
}

/** One line per recommendation, for the banner's "See why". */
export function explainRecommendations(recs: Recommendation[] | null | undefined): string[] {
  return (Array.isArray(recs) ? recs : []).filter((r) => r && r.field).map((r) => {
    const v = Array.isArray(r.value) ? r.value.join(', ') : String(r.value);
    return r.field + ' = ' + v + ' — ' + r.why;
  });
}
