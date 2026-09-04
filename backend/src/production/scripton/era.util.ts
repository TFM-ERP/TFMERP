/**
 * ERA NORMALISATION — turning temporal language into a signed offset from the story's present.
 *
 * `sceneOrder` is the order of TELLING. The engine has been reading it as the order of HAPPENING,
 * which is why a flashback drifts: a memory of twenty years ago is checked against the props, ages
 * and promises of the scene printed before it. This module supplies the missing axis.
 *
 * An era is a signed offset in DAYS from the build's frozen `storyYear`. Days, because one unit has
 * to serve "eighteen months before" and "two thousand years ago" without a second representation,
 * and a signed one because a flash-FORWARD is the same shape as a flashback with the sign flipped.
 *
 * PURE. No Nest, no Prisma, no AI client, no I/O — the model never emits a number on this path; it
 * only labels which stratum a passage belongs to, choosing from the list this file produced.
 *
 * NEVER THROWS, and REFUSES rather than approximates. An expression this file cannot resolve
 * returns null: the stratum survives with its label, can still be named on the page, contributes no
 * arithmetic and produces no findings. A confident wrong year is worse than an honest gap.
 */

/** Julian year. One constant, used for every conversion, so two code paths cannot disagree. */
export const DAYS_PER_YEAR = 365.25;

/** A resolved offset in days. `from` is the earlier (more negative) bound; `to` the later. */
export interface EraOffset { from: number; to: number }

/**
 * Years to days, rounding HALF AWAY FROM ZERO.
 *
 * A decade is exactly 3652.5 days, so the rounding rule decides. `Math.round` breaks ties toward
 * +Infinity, which sends -10y to -3652 and +10y to +3653 — so "ten years before" and "ten years
 * after" would land 1 day apart from symmetric input, and two identical phrases in one script could
 * normalise to two different timelines. Ten years, thirty years and fifty years are all ties — the
 * round numbers a history actually uses.
 */
export function yearsToDays(years: number): number {
  if (!Number.isFinite(years)) return 0;
  const d = years * DAYS_PER_YEAR;
  return d < 0 ? -Math.round(-d) : Math.round(d);
}

/** Days back to years. The inverse nobody exported, so every consumer wrote its own. */
export function daysToYears(days: number): number {
  if (!Number.isFinite(days)) return 0;
  const y = days / DAYS_PER_YEAR;
  return y < 0 ? -Math.round(-y) : Math.round(y);
}

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/**
 * "twenty-seven" -> 27. Digits pass through. An unknown token REFUSES the whole phrase rather than
 * scoring the part it understood, because "seven-odd years" must not silently become 7.
 */
export function wordsToNumber(input: string): number | null {
  const s = String(input == null ? '' : input).toLowerCase().trim();
  if (!s) return null;
  const toks = s.split(/[\s\-‐-―]+/).filter((t) => t && t !== 'and');
  if (!toks.length) return null;
  let total = 0, current = 0, seen = false, lastWasDigits = false;
  for (const t of toks) {
    const digits = /^\d{1,3}(?:,\d{3})+$/.test(t) ? t.replace(/,/g, '') : (/^\d+$/.test(t) ? t : null);
    if (digits !== null) {
      // "2 500 years ago" is a thousands separator a writer typed as a space, or two numbers run
      // together - either way we cannot tell, and summing them said 502. Refuse instead: the digit
      // form is ordinary typography for any number over a thousand, and the sum of "10 000" was 10,
      // which normalises to the SAME offset as "the present day".
      if (lastWasDigits) return null;
      current += parseInt(digits, 10); seen = true; lastWasDigits = true; continue;
    }
    lastWasDigits = false;
    if (UNITS[t] !== undefined) { current += UNITS[t]; seen = true; continue; }
    if (TENS[t] !== undefined) { current += TENS[t]; seen = true; continue; }
    if (t === 'hundred') { current = (current || 1) * 100; seen = true; continue; }
    if (t === 'thousand') { total += (current || 1) * 1000; current = 0; seen = true; continue; }
    if (t === 'a' || t === 'an') { current += 1; seen = true; continue; }
    return null;
  }
  return seen ? total + current : null;
}

/** Words a writer uses to soften a number. Discarded: §3.2 makes "about seven" and "seven" one. */
const HEDGE = /\b(?:about|roughly|around|approximately|approx|nearly|almost|some|maybe|perhaps|over|under|more than|less than|at least|at most|a good|a full)\b/gi;

/**
 * A bare hyphen separates a RANGE only between digits, because between words it is a compound
 * numeral's own joiner: "twenty-five" is one number, not twenty to five. Without this the
 * commonest compound in English resolved to a confident range of -7305..-1826 instead of the
 * single -9131 it means. `to`, an en dash, an em dash and a SPACED hyphen all still range.
 */
const RANGE_SEP = `(?:\\s*(?:to|[–—])\\s*|(?<=\\d)\\s*-\\s*(?=\\d)|\\s+-\\s+)`;

const UNIT_DAYS: Record<string, (n: number) => number> = {
  day: (n) => Math.round(n),
  week: (n) => Math.round(n * 7),
  month: (n) => yearsToDays(n / 12),
  year: (n) => yearsToDays(n),
  decade: (n) => yearsToDays(n * 10),
  century: (n) => yearsToDays(n * 100),
};
const UNIT_WORD = 'days?|weeks?|months?|years?|decades?|centur(?:y|ies)';
const PAST_TAIL = 'before|earlier|ago|prior|back|previously';
const FUTURE_TAIL = 'later|after|hence|ahead|on|from now';
/** Hoisted so the sign check is compiled once, not rebuilt on every `parseEraPhrase` call. */
const PAST_TAIL_RE = new RegExp(`^(?:${PAST_TAIL})$`, 'i');

function unitKey(word: string): string {
  const w = word.toLowerCase();
  if (w.startsWith('centur')) return 'century';
  return w.replace(/s$/, '');
}

/** `sign * 0` yields -0, and assert.strict distinguishes -0 from 0. One moment, one value. */
function noNegZero(n: number): number { return n === 0 ? 0 : n; }

/**
 * `before` and `after` take an object, so "he waited seven years before speaking" is a DURATION, not
 * a date. So do `prior` (to X) and `ahead` (of X). Only a tail that terminates, or points at the
 * story's own present, dates anything. The other tails (`ago`, `earlier`, `back`, `later`, `hence`)
 * cannot take an object and are always accepted. Without this rule every measured wait in the
 * dialogue becomes a timeline. A story-referring word only dates when the clause ENDS there —
 * "before the film" dates, "before the filming of the video" does not, because the clause keeps
 * going past the word that merely happens to look like a match.
 */
const OBJECT_TAIL = /^(?:before|after|on|prior|ahead)$/i;
const DATING_OBJECT = /^\s*(?:(?:to|of)\s+)?(?:(?:the\s+(?:film|movie|story|series|present|events?|action)|now|today|the\s+day|that|this)\b\s*(?:[,.;:—–-]|$)|[,.;:—–-]|$)/i;

function tailDates(tail: string, rest: string): boolean {
  if (!OBJECT_TAIL.test(tail)) return true;
  return DATING_OBJECT.test(rest);
}

/**
 * Parse ONE isolated phrase. `following` is the text that came immediately after it in the
 * material and is consulted only by the object-tail rule above — the phrase itself is never
 * widened by it, so a hit's span stays exactly the words that dated something.
 *
 * Returns null when it does not resolve.
 */
export function parseEraPhrase(phrase: string, following = ''): EraOffset | null {
  const raw = String(phrase == null ? '' : phrase).replace(HEDGE, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const given = String(following == null ? '' : following);
  /** The caller may hand us the object inline ("...before the film") or separately. Both work. */
  const restOf = (captured: string) => (given || captured);

  if (/^(?:the\s+)?(?:present(?:\s+day)?|now|today|current\s+day)$/i.test(raw)) return { from: 0, to: 0 };

  // RANGE FIRST. Try the single pattern first and it matches the second number alone, silently
  // narrowing a fifteen-to-ten-year span to ten years with no error anywhere.
  const range = new RegExp(
    `^([\\w\\s,-]{1,40}?)${RANGE_SEP}([\\w\\s,-]{1,40}?)\\s+(${UNIT_WORD})\\s+(${PAST_TAIL}|${FUTURE_TAIL})\\b(.*)$`, 'i',
  ).exec(raw);
  if (range) {
    const a = wordsToNumber(range[1]), b = wordsToNumber(range[2]);
    if (a === null || b === null) return null;
    if (!tailDates(range[4], restOf(range[5]))) return null;
    const sign = PAST_TAIL_RE.test(range[4]) ? -1 : 1;
    const conv = UNIT_DAYS[unitKey(range[3])];
    const x = sign * conv(a), y = sign * conv(b);
    return { from: noNegZero(Math.min(x, y)), to: noNegZero(Math.max(x, y)) };
  }

  const single = new RegExp(
    `^([\\w\\s,-]{1,40}?)\\s+(${UNIT_WORD})\\s+(${PAST_TAIL}|${FUTURE_TAIL})\\b(.*)$`, 'i',
  ).exec(raw);
  if (single) {
    const n = wordsToNumber(single[1]);
    if (n === null) return null;
    if (!tailDates(single[3], restOf(single[4]))) return null;
    const sign = PAST_TAIL_RE.test(single[3]) ? -1 : 1;
    const v = noNegZero(sign * UNIT_DAYS[unitKey(single[2])](n));
    return { from: v, to: v };
  }
  return null;
}

/**
 * A written year to an offset. BC is stored ASTRONOMICALLY (`1 - n`), because there is no year zero
 * and the arithmetic needs one: without the shift every date before Christ is one year out, and
 * every ancient marker prints wrong. The BC form is restored when a year is printed for the page.
 */
export function parseYear(text: string, storyYear: number): EraOffset | null {
  const s = String(text == null ? '' : text).trim();
  if (!Number.isFinite(storyYear)) return null;
  const era = /^(\d{1,4})\s*(bc|bce|ad|ce)$/i.exec(s);
  let astro: number | null = null;
  if (era) {
    const n = parseInt(era[1], 10);
    if (!n) return null;
    astro = /^b/i.test(era[2]) ? 1 - n : n;
  } else if (/^\d{4}$/.test(s)) {
    const n = parseInt(s, 10);
    // A bare number needs a band to disambiguate (e.g. `300` is far more likely a count than a date);
    // but a number explicitly marked BC/AD/BCE/CE is unambiguously a year, so it needs no guard.
    if (n < 1000 || n > 2999) return null;
    astro = n;
  }
  if (astro === null) return null;
  const v = yearsToDays(astro - storyYear);
  return { from: v, to: v };
}

/** One temporal expression found in the material, with the span it occupied. */
export interface EraHit { text: string; start: number; end: number; offset: EraOffset | null }

const HEDGE_WORD = 'about|roughly|around|approximately|nearly|almost|some';
/**
 * A number token is NUMBER VOCABULARY, never any word. With `[\w-]+` the sweep reached backwards
 * into the narration ahead of a phrase — "Jason vanished about seven years ago" matched from
 * "Jason", and `wordsToNumber` then refused the whole thing, so the commonest phrasing in a
 * treatment was not detected at all. Built from the same
 * tables `wordsToNumber` reads. The longest-first sort is defensive ordering, not a guard: JS
 * backtracking already recovers "nineteen" after "nine" fails to complete the match, verified by
 * deliberate break. It stays because a deterministic-looking alternation is easier to reason about.
 */
const NUM_WORD = [
  ...Object.keys(UNITS), ...Object.keys(TENS), 'hundred', 'thousand', 'and', 'an', 'a',
].sort((x, y) => y.length - x.length).join('|');
/** The first token may not be `and` — that joins two numbers, it never opens one. */
const NUM_HEAD = [
  ...Object.keys(UNITS), ...Object.keys(TENS), 'hundred', 'thousand', 'an', 'a',
].sort((x, y) => y.length - x.length).join('|');
const DIGITS = `\\d{1,3}(?:,\\d{3})+|\\d{1,4}`;
const NUM = `(?:${DIGITS}|${NUM_HEAD})(?:[\\s-](?:${DIGITS}|${NUM_WORD})){0,3}?`;
const PHRASE_RE = new RegExp(
  `\\b((?:(?:${HEDGE_WORD})\\s+)?${NUM}${RANGE_SEP}${NUM}\\s+(?:${UNIT_WORD})\\s+(?:${PAST_TAIL}|${FUTURE_TAIL})` +
  `|(?:(?:${HEDGE_WORD})\\s+)?${NUM}\\s+(?:${UNIT_WORD})\\s+(?:${PAST_TAIL}|${FUTURE_TAIL})` +
  `|the\\s+present\\s+day|the\\s+present|present\\s+day)\\b`,
  'gi',
);
/**
 * A bare four-digit number is only a YEAR when something says so. The 1000-2999 band answers "is
 * this plausibly a year"; it does not answer "is this a year HERE". Without a cue, one ordinary
 * paragraph - "At 1900 hours... it cost 1500 dollars... Room 1408... he ran 2000 metres" - produced
 * five spurious strata, and two of those are enough to raise ERA_ANCHOR_CONFLICT deterministically
 * before a word is generated. An explicit era mark needs no cue; a bare number needs one in front
 * or a terminator behind.
 */
const YEAR_CUE = 'in|since|by|by\\s+the\\s+year|the\\s+year|c\\.|ca\\.|circa|around|about|summer\\s+of|winter\\s+of|spring\\s+of|autumn\\s+of|fall\\s+of|back\\s+in|set\\s+in|before|after|prior\\s+to|ahead\\s+of|until|from|between';
const YEAR_RE = new RegExp(
  `\\b(\\d{1,4}\\s*(?:BC|BCE|AD|CE))\\b` +
  `|(?<=\\b(?:${YEAR_CUE})\\s)(\\d{4})\\b(?!\\s*(?:days?|weeks?|months?|years?|decades?|centur))`,
  'gi',
);

/** How much of the following text the object-tail rule may look at. */
const LOOKAHEAD = 24;

/**
 * Sweep a body of material for temporal expressions. Phrases are matched before bare years so that
 * "seven years before 1994" is read as the phrase it is rather than as the year it contains, and
 * overlapping later hits are dropped.
 */
export function sweepEras(text: string, storyYear: number): EraHit[] {
  const s = String(text == null ? '' : text);
  if (!s) return [];
  const hits: EraHit[] = [];
  const take = (m: RegExpExecArray, offset: EraOffset | null) => {
    const start = m.index, end = m.index + m[0].length;
    if (hits.some((h) => start < h.end && end > h.start)) return;
    hits.push({ text: m[0].trim(), start, end, offset });
  };
  let m: RegExpExecArray | null;
  PHRASE_RE.lastIndex = 0;
  while ((m = PHRASE_RE.exec(s)) !== null) take(m, parseEraPhrase(m[0], s.slice(m.index + m[0].length, m.index + m[0].length + LOOKAHEAD)));
  YEAR_RE.lastIndex = 0;
  while ((m = YEAR_RE.exec(s)) !== null) take(m, parseYear(m[0].replace(/\s+/g, ' ').trim(), storyYear));
  return hits.sort((a, b) => a.start - b.start);
}

/** How far past a hit this pass will look for the event that anchors it. */
const EVENT_LOOKAHEAD = 64;

/** Event names come from the material, so they can carry regex metacharacters. */
function escapeRe(text: string): string { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Does `text` NAME this event? A plain substring test is not enough: an event called "War" would
 * match inside "Warehouse" and anchor a hit to something that never happened. The lookarounds are
 * used rather than \b because an event name may begin or end with punctuation, where \b inverts.
 */
function namedIn(text: string, name: string): boolean {
  const n = name.trim();
  if (!n) return false;
  try {
    return new RegExp(`(?<![A-Za-z0-9_])${escapeRe(n)}(?![A-Za-z0-9_])`, 'i').test(text);
  } catch {
    return false;
  }
}

/** An event the first pass has already dated: the phrase that names it, and its offset in days. */
export interface DatedEvent { name: string; offset: number }

/**
 * SECOND PASS — expressions anchored to an EVENT rather than to the present.
 *
 * "the year Jason vanished" and "seven years before 1994" measure from something else, so neither
 * can be resolved until that something has an era. Hence two passes: place every numeric expression
 * first, then resolve the event-anchored ones against what pass one produced. Deterministic;
 * unresolvable stays null, exactly as before.
 *
 * Returns a NEW array. Hits already resolved are untouched.
 */
export function resolveEventAnchored(text: string, hits: EraHit[], events: DatedEvent[] = []): EraHit[] {
  const s = String(text == null ? '' : text);
  const list = Array.isArray(hits) ? hits : [];
  const known = (Array.isArray(events) ? events : [])
    .filter((e) => e && typeof e.name === 'string' && e.name.trim().length > 0 && Number.isFinite(e.offset))
    .sort((a, b) => b.name.length - a.name.length); // longest name first, so a prefix cannot win
  return list.map((h) => {
    // `!=` (not `!==`) is deliberate: a hit round-tripped through JSON or a database row often
    // comes back with `offset` absent (`undefined`) rather than `null`, and `!==` skipped it.
    if (h.offset != null) return h;
    // The ',' stands in for the dating object: the magnitude and direction are in the phrase
    // itself, and only its BASE was missing. It satisfies DATING_OBJECT's bare-terminator branch,
    // which is the coupling that lets pass two read a phrase pass one conservatively refused.
    const rel = parseEraPhrase(h.text, ',');
    if (!rel) return h;
    const after = s.slice(h.end, h.end + EVENT_LOOKAHEAD);
    let base: number | null = null;
    for (const e of known) {
      if (namedIn(after, e.name)) { base = e.offset; break; }
    }
    if (base === null) {
      const m = /^[\s,]*(?:in\s+|the\s+year\s+)?(\d{1,4}\s*(?:BC|BCE|AD|CE)|\d{4})\b/i.exec(after);
      const seen = m ? list.find((x) => x.text.replace(/\s+/g, ' ') === m[1].replace(/\s+/g, ' ') && x.offset !== null) : undefined;
      if (seen && seen.offset) base = seen.offset.from;
    }
    if (base === null) return h;
    return { ...h, offset: { from: base + rel.from, to: base + rel.to } };
  });
}
