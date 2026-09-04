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

import { DAYS_PER_YEAR, EraOffset, yearsToDays, daysToYears } from './era-days.util';
import { tokenize, matchPhrases, matchYears } from './era-tokens.util';

/** Re-exported so this module's public surface is exactly what it always was. */
export { DAYS_PER_YEAR, yearsToDays, daysToYears };
export type { EraOffset };

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

/**
 * Parse ONE isolated phrase. `following` is the text that came immediately after it in the
 * material, consulted only by the object-tail rule — the phrase itself is never widened by it, so
 * a hit's span stays exactly the words that dated something.
 *
 * Now a thin wrapper over the shared token grammar. It used to carry two regexes of its own, and
 * they disagreed with the sweep's about what a number is, which is where the drift lived.
 *
 * Returns null when it does not resolve.
 */
export function parseEraPhrase(phrase: string, following = ''): EraOffset | null {
  const head = String(phrase == null ? '' : phrase);
  if (!head.trim()) return null;
  const matches = matchPhrases(tokenize(`${head} ${String(following == null ? '' : following)}`));
  const m = matches[0];
  if (!m || !m.anchored || m.start !== head.length - head.trimStart().length) return null;
  return { from: m.from, to: m.to };
}

/**
 * A written year to an offset. BC is stored ASTRONOMICALLY (`1 - n`) by the tokenizer, because
 * there is no year zero and the arithmetic needs one: without the shift every date before Christ
 * is one year out. The 1000-2999 band answers "is this bare number a year AT ALL" — 300 in a
 * screenplay is far likelier a count than a date — and a number the writer marked BC or AD has
 * already answered that, so it needs no band.
 */
export function parseYear(text: string, storyYear: number): EraOffset | null {
  if (!Number.isFinite(storyYear)) return null;
  const tokens = tokenize(String(text == null ? '' : text));
  if (tokens.length !== 1) return null;
  const t = tokens[0];
  let astro: number | null = null;
  if (t.kind === 'YEAR' && t.value !== undefined) astro = t.value;
  else if (t.kind === 'NUMBER' && t.value !== undefined && /^\d{4}$/.test(t.text)
    && t.value >= 1000 && t.value <= 2999) astro = t.value;
  if (astro === null) return null;
  const v = yearsToDays(astro - storyYear);
  return { from: v, to: v };
}

/** One temporal expression found in the material, with the span it occupied. */
export interface EraHit { text: string; start: number; end: number; offset: EraOffset | null }

/**
 * Sweep a body of material for temporal expressions. ONE reading of the text: the tokenizer runs
 * once, the phrase grammar walks it, and bare years are picked up from the same tokens. Phrases
 * are placed first so "seven years before 1994" is read as the phrase it is rather than as the
 * year it contains, and a later hit that overlaps an accepted one is dropped.
 *
 * A phrase measured from a DATE rather than from the present keeps its span and gets `offset:
 * null` — the magnitude is real, only its base is missing, and `resolveEventAnchored` supplies it.
 */
export function sweepEras(text: string, storyYear: number): EraHit[] {
  const s = String(text == null ? '' : text);
  if (!s) return [];
  const tokens = tokenize(s);
  const hits: EraHit[] = [];
  const take = (start: number, end: number, offset: EraOffset | null) => {
    if (hits.some((h) => start < h.end && end > h.start)) return;
    hits.push({ text: s.slice(start, end), start, end, offset });
  };
  for (const m of matchPhrases(tokens)) {
    take(m.start, m.end, m.anchored ? { from: m.from, to: m.to } : null);
  }
  if (Number.isFinite(storyYear)) {
    for (const y of matchYears(tokens)) {
      const v = yearsToDays(y.year - storyYear);
      take(y.start, y.end, { from: v, to: v });
    }
  }
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
