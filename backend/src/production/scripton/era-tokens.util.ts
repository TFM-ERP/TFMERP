/**
 * ERA TOKENS — one reading of temporal language, so nothing can disagree with itself.
 *
 * `era.util.ts` used to find phrases with a stack of interpolated regexes. Two reviewers reached
 * the same verdict independently, and the file's own history is the argument: EVERY defect found in
 * it was a DISAMBIGUATION bug rather than a missing word. "twenty-five years ago" read as a range
 * from twenty to five. "Jason vanished about seven years ago" matched from "Jason" and then refused
 * the whole thing. "the filming of the video" matched "the film". A wrong reading and a right one
 * agree on every input where the ambiguity does not arise, so tests written against a deterministic
 * walk never exercise them, and each was found by a constructed counterexample rather than by
 * reading the code.
 *
 * The cause was structural. The same concept was spelled in several places that had to stay
 * isomorphic by hand:
 *
 *   - "a written year" three times — `parseYear`'s own regex, `YEAR_RE`, and pass two's fallback
 *   - "a number phrase" twice, and the two DISAGREED about what a number is: the sweep used a
 *     strict vocabulary while the parser used a loose `[\w\s,-]{1,40}?` capture
 *   - the hedge list twice, with different contents — which is why "at least twenty years ago"
 *     silently became "twenty years ago"
 *
 * So the text is read ONCE into typed tokens, and everything downstream walks tokens. Three things
 * that needed guards before are now unreachable by construction:
 *
 *   1. A hit's span IS the tokens it matched, so it cannot swallow the narration around it.
 *   2. A connector is classified as a range or a compound joiner from its NEIGHBOURS' KINDS at
 *      tokenization time — not by a lookaround guessing from raw characters — so "twenty-five" and
 *      "10-15" are decided once, by the same rule, in one place.
 *   3. The sweep and the parser share this reading, so they cannot drift apart again.
 *
 * PURE. NEVER THROWS. Tokens carry their own source span, so a caller can always point at the page.
 */
import { yearsToDays } from './era-days.util';

export type TokenKind =
  | 'NUMBER'     // a numeral, word or digit, already summed
  | 'UNIT'       // days, weeks, months, years, decades, centuries
  | 'TAIL'       // ago, before, later - carries direction, and whether it can take an object
  | 'HEDGE'      // about, roughly - and the comparatives, which carry a bound
  | 'CONNECTOR'  // to, dashes - classified range or compound from its neighbours
  | 'YEAR'       // 1994, 500 BC - already converted to an astronomical year
  | 'CUE'        // in, circa, set in - what licenses a BARE year to be read as one
  | 'STORY'      // the film, the present, now - what an object-taking tail may point at
  | 'TERM'       // , . ; : and the dashes, when they end a clause
  | 'WORD';      // everything else, carried so spans and neighbours stay honest

export interface Token {
  kind: TokenKind;
  text: string;
  /** Offsets into the ORIGINAL string, so a hit's span needs no reconstruction. */
  start: number;
  end: number;
  /** NUMBER: its value. YEAR: the astronomical year (1 BC is 0, 2 BC is -1). */
  value?: number;
  /** UNIT: the key into `UNIT_DAYS`. */
  unit?: string;
  /** TAIL: -1 into the past, +1 into the future. */
  sign?: -1 | 1;
  /** TAIL: `before`/`after`/`prior`/`ahead`/`on` take an object, so they do not always date. */
  takesObject?: boolean;
  /** HEDGE: `about` is exact; `at least` and `more than` are bounds a range can carry. */
  bound?: 'exact' | 'atLeast' | 'atMost';
  /** CONNECTOR: whether it joins two numbers into a range, or one numeral to itself. */
  link?: 'range' | 'compound';
  /** STORY: this one IS the present ("now", "today"), not merely a pointer at the work. */
  present?: boolean;
}

/** How many days a run of `n` of this unit is. Months go through the year so one rule rounds. */
export const UNIT_DAYS: Record<string, (n: number) => number> = {
  day: (n) => Math.round(n),
  week: (n) => Math.round(n * 7),
  month: (n) => yearsToDays(n / 12),
  year: (n) => yearsToDays(n),
  decade: (n) => yearsToDays(n * 10),
  century: (n) => yearsToDays(n * 100),
};

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALE: Record<string, number> = { hundred: 100, thousand: 1000 };

/** ONE hedge table. Two lists that disagreed is why a comparative was silently discarded. */
const HEDGES: Record<string, 'exact' | 'atLeast' | 'atMost'> = {
  'about': 'exact', 'roughly': 'exact', 'around': 'exact', 'approximately': 'exact',
  'approx': 'exact', 'nearly': 'atMost', 'almost': 'atMost', 'some': 'exact',
  'maybe': 'exact', 'perhaps': 'exact', 'a good': 'exact', 'a full': 'exact',
  'over': 'atLeast', 'more than': 'atLeast', 'at least': 'atLeast',
  'under': 'atMost', 'less than': 'atMost', 'at most': 'atMost',
};

const TAILS: Record<string, { sign: -1 | 1; takesObject: boolean }> = {
  before: { sign: -1, takesObject: true }, earlier: { sign: -1, takesObject: false },
  ago: { sign: -1, takesObject: false }, prior: { sign: -1, takesObject: true },
  back: { sign: -1, takesObject: false }, previously: { sign: -1, takesObject: false },
  later: { sign: 1, takesObject: false }, after: { sign: 1, takesObject: true },
  hence: { sign: 1, takesObject: false }, ahead: { sign: 1, takesObject: true },
  on: { sign: 1, takesObject: true }, 'from now': { sign: 1, takesObject: false },
};

/** What an object-taking tail may point at and still be dating the story's own present. */
const STORY_WORDS = [
  'the film', 'the movie', 'the story', 'the series', 'the present', 'the events', 'the event',
  'the action', 'the day', 'now', 'today', 'that', 'this', 'present day', 'the present day',
  'current day',
];
/** The subset that IS the present, rather than merely pointing at the work. */
const PRESENT_WORDS = new Set(['the present', 'the present day', 'present day', 'now', 'today', 'current day']);

/**
 * The narrower subset that emits a present-day stratum ON ITS OWN, wherever it stands in prose.
 *
 * Bare `now` and `today` are deliberately absent. They stay STORY tokens carrying `present`,
 * because `tailDatesAt` needs them — "seven years before now" must still date — but they are two
 * of the commonest words in English, and emitting a confident {0,0} for every occurrence put a
 * present-day stratum into "Every now and then he returns", "It is now or never" and "By now the
 * harbour has silted", and THREE into one paragraph of "Today ... Today ... Today". Two spurious
 * strata raise ERA_ANCHOR_CONFLICT deterministically before a word is generated, which is exactly
 * the false-positive class the year-cue rule exists to prevent. The old matcher's sweep pattern
 * read `the present day|the present|present day` and never a bare `now` or `today`; this is that
 * list, plus the `current day` spelling the token tables already treat as its equivalent.
 */
const STANDALONE_PRESENT = new Set(['the present', 'the present day', 'present day', 'current day']);

/** What licenses a BARE four-digit number to be read as a year. An era mark needs no cue. */
const YEAR_CUES = [
  'in', 'since', 'by the year', 'by', 'the year', 'c.', 'ca.', 'circa', 'around', 'about',
  'summer of', 'winter of', 'spring of', 'autumn of', 'fall of', 'back in', 'set in',
  'before', 'after', 'prior to', 'ahead of', 'until', 'from', 'between',
];
/** The same entries as a set, so a HEDGE can ask in O(1) whether it is ALSO a cue. */
const YEAR_CUE_SET = new Set(YEAR_CUES);

const UNIT_ALIASES: Record<string, string> = {
  day: 'day', days: 'day', week: 'week', weeks: 'week', month: 'month', months: 'month',
  year: 'year', years: 'year', decade: 'decade', decades: 'decade',
  century: 'century', centuries: 'century',
};

const TERMINATORS = new Set([',', '.', ';', ':', '—', '–', '-', '!', '?']);
const CONNECTOR_TEXT = new Set(['to', '-', '–', '—']);
const ERA_MARKS = new Set(['bc', 'bce', 'ad', 'ce']);

/** A raw lexeme before it is classified: a word, a digit run, or one punctuation mark. */
interface Atom { text: string; start: number; end: number; space: boolean }

const ATOM_RE = /\d{1,3}(?:,\d{3})+|\d+|[A-Za-z]+\.?|[^\sA-Za-z\d]/g;

function lex(s: string): Atom[] {
  const out: Atom[] = [];
  ATOM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let prevEnd = 0;
  while ((m = ATOM_RE.exec(s)) !== null) {
    // `c.` and `ca.` are cues; every other trailing dot is a terminator in its own right.
    let text = m[0], end = m.index + m[0].length;
    if (/^[A-Za-z]+\.$/.test(text) && !/^(?:c|ca)\.$/i.test(text)) { text = text.slice(0, -1); end -= 1; }
    out.push({ text, start: m.index, end, space: m.index > prevEnd });
    prevEnd = end;
    if (end < m.index + m[0].length) { out.push({ text: '.', start: end, end: end + 1, space: false }); prevEnd = end + 1; }
  }
  return out;
}

/** Is this atom part of a numeral? Digits, number words, and the joiner `and`. */
function numeralValue(text: string): number | null {
  const t = text.toLowerCase();
  if (/^\d{1,3}(?:,\d{3})+$/.test(t)) return parseInt(t.replace(/,/g, ''), 10);
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (UNITS[t] !== undefined) return UNITS[t];
  if (TENS[t] !== undefined) return TENS[t];
  if (SCALE[t] !== undefined) return SCALE[t];
  return null;
}

/**
 * `a` and `an` are the number one ONLY in front of a unit — "a decade before". Everywhere else
 * they are the article, and reading "a city" as the number one put a NUMBER token in the middle
 * of ordinary prose.
 */
function articleIsOne(atoms: Atom[], i: number): boolean {
  const t = atoms[i].text.toLowerCase();
  if (t !== 'a' && t !== 'an') return false;
  const nxt = atoms[i + 1];
  return !!nxt && UNIT_ALIASES[nxt.text.toLowerCase()] !== undefined;
}
const isBareDigits = (t: string) => /^\d/.test(t);
const isNumeralAtom = (t: string) => numeralValue(t) !== null || t.toLowerCase() === 'and';

/** Longest multi-word entry starting at `i`, or null. Entries are lowercase, space-separated. */
function phraseAt(atoms: Atom[], i: number, table: Iterable<string>): { text: string; len: number } | null {
  let best: { text: string; len: number } | null = null;
  for (const entry of table) {
    const words = entry.split(' ');
    if (i + words.length > atoms.length) continue;
    let ok = true;
    for (let k = 0; k < words.length; k++) {
      if (atoms[i + k].text.toLowerCase() !== words[k]) { ok = false; break; }
    }
    if (ok && (!best || words.length > best.len)) best = { text: entry, len: words.length };
  }
  return best;
}

/**
 * `about` and `around` sit in BOTH tables, and the hedge branch runs first — so the two entries
 * those words have in YEAR_CUES were unreachable, and every one of them was dead code. "circa 1650"
 * kept its year while "about 1994" silently lost one, a real and correctly-dated year dropped from
 * the timeline.
 *
 * A hedge that is also a cue therefore reads as the CUE when a four-digit number follows it
 * IMMEDIATELY, and as the HEDGE everywhere else: "about 1994" points at a date, "about twenty
 * years ago" softens a count. Only the two words in both tables can flip — "at least 1994 people"
 * and "over 1500 dollars" were never year cues and must not become them.
 *
 * The unit guard is the old matcher's own. Its year pattern carried
 * `(?!\s*(?:days?|weeks?|months?|years?|decades?|centur))`, so "about 1994 years ago" was a hedged
 * COUNT and never a year; without the guard the hedge would fall out of that phrase's span and the
 * hit would start at the number instead of at "about".
 */
function hedgeCuesYear(atoms: Atom[], i: number, hedge: { text: string; len: number }): boolean {
  if (!YEAR_CUE_SET.has(hedge.text)) return false;
  const year = atoms[i + hedge.len];
  if (!year || !/^\d{4}$/.test(year.text)) return false;
  const after = atoms[i + hedge.len + 1];
  return !after || UNIT_ALIASES[after.text.toLowerCase()] === undefined;
}

/**
 * Fold a run of numeral atoms into one value. Two ADJACENT bare-digit runs refuse: "2 500" is
 * either a thousands separator typed as a space or two numbers run together, and nothing on the
 * page says which. Summing them said 502, and summing "10 000" said 10 — which normalises to the
 * same offset as "the present day", the worst value this module can emit.
 */
function foldNumeral(atoms: Atom[], from: number, to: number): number | null {
  let total = 0, current = 0, seen = false, lastDigits = false;
  for (let i = from; i <= to; i++) {
    const t = atoms[i].text.toLowerCase();
    if (t === 'and' || t === '-') {
      // `and` does NOT clear the bare-digit refusal three lines below when it sits BETWEEN two
      // bare digit runs. WORD numerals legitimately need it - "three hundred and fifty" is 350 -
      // but digits never do: nobody writes "300 and 50" meaning 350. Clearing `lastDigits` for
      // them made "10 and 15 years ago" a confident 25, turning this module's own refusal into an
      // answer, which is the one direction the doctrine forbids. Only `and` is narrowed; a hyphen
      // between two bare digits is already a RANGE and never reaches this fold.
      const nxt = i + 1 <= to ? atoms[i + 1] : undefined;
      if (t === 'and' && lastDigits && nxt && isBareDigits(nxt.text)) return null;
      lastDigits = false;
      continue;
    }
    const v = articleIsOne(atoms, i) ? 1 : numeralValue(t);
    if (v === null) return null;
    if (isBareDigits(t)) {
      if (lastDigits) return null;
      current += v; seen = true; lastDigits = true; continue;
    }
    lastDigits = false;
    if (t === 'hundred') { current = (current || 1) * 100; seen = true; continue; }
    if (t === 'thousand') { total += (current || 1) * 1000; current = 0; seen = true; continue; }
    current += v; seen = true;
  }
  return seen ? total + current : null;
}

/**
 * Read text once into tokens. Never throws; an unreadable input yields an empty list.
 */
export function tokenize(input: string): Token[] {
  const s = String(input == null ? '' : input);
  if (!s) return [];
  const atoms = lex(s);
  const out: Token[] = [];

  for (let i = 0; i < atoms.length;) {
    const a = atoms[i];
    const lower = a.text.toLowerCase();

    // A numeral run, greedily, so "three hundred and fifty" and "twenty-five" are ONE number.
    if (numeralValue(a.text) !== null || articleIsOne(atoms, i)) {
      let j = i;
      while (j + 1 < atoms.length) {
        const nxt = atoms[j + 1];
        // A hyphen belongs to the NUMERAL only when it is unspaced and does not sit between two
        // bare digit runs — "twenty-five" is one number, "10-15" is a range. Same rule the
        // connector classifier uses, applied here so the run does not swallow a range separator.
        const after = j + 2 < atoms.length ? atoms[j + 2] : null;
        const compoundHyphen = nxt.text === '-' && !nxt.space && after && !after.space
          && isNumeralAtom(after.text) && !(isBareDigits(atoms[j].text) && isBareDigits(after.text));
        if (compoundHyphen) { j += 2; continue; }
        if (isNumeralAtom(nxt.text) && numeralValue(nxt.text) !== null && !(isBareDigits(nxt.text) && isBareDigits(atoms[j].text) && nxt.space)) { j += 1; continue; }
        if (nxt.text.toLowerCase() === 'and' && j + 2 < atoms.length && numeralValue(atoms[j + 2].text) !== null) { j += 2; continue; }
        break;
      }
      const value = foldNumeral(atoms, i, j);
      const start = a.start, end = atoms[j].end;
      out.push(value === null
        ? { kind: 'WORD', text: s.slice(start, end), start, end }
        : { kind: 'NUMBER', text: s.slice(start, end), start, end, value });
      i = j + 1;
      continue;
    }

    // An explicit era mark binds to the number before it, which is already a NUMBER token.
    if (ERA_MARKS.has(lower)) {
      const prev = out[out.length - 1];
      if (prev && prev.kind === 'NUMBER' && prev.value !== undefined && prev.value > 0) {
        const astro = /^b/.test(lower) ? 1 - prev.value : prev.value;
        out[out.length - 1] = { kind: 'YEAR', text: s.slice(prev.start, a.end), start: prev.start, end: a.end, value: astro };
        i += 1;
        continue;
      }
    }

    // A hedge that is also a year cue, with a year behind it, falls through to the CUE branch.
    const hedge = phraseAt(atoms, i, Object.keys(HEDGES));
    if (hedge && !hedgeCuesYear(atoms, i, hedge)) {
      const end = atoms[i + hedge.len - 1].end;
      out.push({ kind: 'HEDGE', text: s.slice(a.start, end), start: a.start, end, bound: HEDGES[hedge.text] });
      i += hedge.len;
      continue;
    }

    const story = phraseAt(atoms, i, STORY_WORDS);
    if (story) {
      const end = atoms[i + story.len - 1].end;
      out.push({ kind: 'STORY', text: s.slice(a.start, end), start: a.start, end, present: PRESENT_WORDS.has(story.text) });
      i += story.len;
      continue;
    }

    const tail = phraseAt(atoms, i, Object.keys(TAILS));
    if (tail) {
      const end = atoms[i + tail.len - 1].end;
      const t = TAILS[tail.text];
      out.push({ kind: 'TAIL', text: s.slice(a.start, end), start: a.start, end, sign: t.sign, takesObject: t.takesObject });
      i += tail.len;
      continue;
    }

    if (UNIT_ALIASES[lower]) {
      out.push({ kind: 'UNIT', text: a.text, start: a.start, end: a.end, unit: UNIT_ALIASES[lower] });
      i += 1;
      continue;
    }

    const cue = phraseAt(atoms, i, YEAR_CUES);
    if (cue) {
      const end = atoms[i + cue.len - 1].end;
      out.push({ kind: 'CUE', text: s.slice(a.start, end), start: a.start, end });
      i += cue.len;
      continue;
    }

    if (CONNECTOR_TEXT.has(lower)) {
      out.push({ kind: 'CONNECTOR', text: a.text, start: a.start, end: a.end });
      i += 1;
      continue;
    }

    out.push({ kind: TERMINATORS.has(a.text) ? 'TERM' : 'WORD', text: a.text, start: a.start, end: a.end });
    i += 1;
  }

  return classifyConnectors(out, s);
}

/**
 * A connector is a RANGE or a compound joiner, and its neighbours decide — not a lookaround
 * guessing from raw characters. `to` and the long dashes always range. A bare hyphen ranges only
 * when it is spaced, or when both sides are bare digits: between words it belongs to the numeral
 * itself, which is why "twenty-five" was read as twenty-to-five and resolved to a confident range.
 */
function classifyConnectors(tokens: Token[], s: string): Token[] {
  return tokens.map((t, i) => {
    if (t.kind !== 'CONNECTOR') return t;
    const prev = tokens[i - 1], next = tokens[i + 1];
    const between = prev && next && prev.kind === 'NUMBER' && next.kind === 'NUMBER';
    if (!between) return { ...t, kind: 'WORD' as TokenKind };
    if (t.text.toLowerCase() === 'to' || t.text === '–' || t.text === '—') return { ...t, link: 'range' as const };
    const spaced = s[t.start - 1] === ' ' && s[t.end] === ' ';
    const digitBoth = /\d$/.test(prev.text) && /^\d/.test(next.text);
    return { ...t, link: (spaced || digitBoth ? 'range' : 'compound') as 'range' | 'compound' };
  });
}

/** One phrase the grammar recognised, with the exact token span it occupied. */
export interface PhraseMatch {
  start: number;
  end: number;
  from: number;
  to: number;
  /**
   * False when the phrase is measured from a DATE rather than from the story's present —
   * "seven years before 1994". The magnitude is real; only the base is missing, and pass two
   * supplies it. `from`/`to` then hold the magnitude relative to that base, not to the present.
   */
  anchored: boolean;
  /** `atLeast` / `atMost` where a comparative bounded the number rather than softening it. */
  bound?: 'atLeast' | 'atMost';
  /** The index one past the last token consumed, so a sweep can continue without overlap. */
  next: number;
}

/**
 * The three dashes. They are NOT re-kinded to end a clause: a dash between two numbers is a range
 * connector ("10-15"), and between two words it is ordinary prose that must stay a WORD, so that
 * "Cairo - a city" keeps a dash no one has to explain. The clause-end test asks the TEXT instead.
 */
const DASHES = new Set(['-', '–', '—']);

/**
 * The end of a clause: nothing left, a terminator, or a bare dash.
 *
 * The dash matters because an em dash is ordinary screenplay-treatment punctuation, and every dash
 * is caught as a CONNECTOR before the TERMINATORS branch can see it — so a non-ranging one is
 * demoted to WORD and `isEnd` was never true for it. "seven years before — the boy is bought"
 * dates a scene and was returning null. The old matcher's clause-boundary class was `[,.;:—–-]`,
 * which is exactly TERM plus these three.
 *
 * A RANGING dash can never reach here: `classifyConnectors` only keeps `link` when both neighbours
 * are NUMBER, and every token this is asked about follows a TAIL, a `to`/`of`, or a STORY.
 */
const isEnd = (t: Token | undefined) => t === undefined || t.kind === 'TERM' || DASHES.has(t.text);

/**
 * Does an object-taking tail actually date anything here? `before` and `after` take an object, so
 * "he waited seven years before speaking" is a DURATION. Only a clause that ENDS at the tail, or
 * points at the story itself, dates a scene. Tails that cannot take an object always date.
 *
 * Expressed on TOKENS, this is one line: the next token is the end of the clause, or the story.
 * As a regex over raw text it needed a word boundary AND a clause boundary AND an optional
 * preposition, and three review rounds to get right.
 */
function tailDatesAt(tokens: Token[], tail: Token, i: number): 'present' | 'dated' | 'no' {
  if (!tail.takesObject) return 'present';
  let k = i;
  // `prior TO the film`, `ahead OF the film` — skip the preposition the tail requires.
  if (tokens[k] && tokens[k].kind === 'WORD' && /^(?:to|of)$/i.test(tokens[k].text)) k += 1;
  const t = tokens[k];
  if (isEnd(t)) return 'present';
  if (t.kind === 'STORY' && isEnd(tokens[k + 1])) return 'present';
  // Measured from a DATE, not from the present: real, but pass two must supply the base.
  if (t.kind === 'YEAR' || (t.kind === 'NUMBER' && /^\d{4}$/.test(t.text))) return 'dated';
  return 'no';
}

/**
 * Does this present-marking token emit a stratum ON ITS OWN? The explicit forms always do. A bare
 * `now` or `today` does so only when it is the WHOLE reading — which is the single caller that
 * ever asks: `parseEraPhrase('now')` hands the grammar nothing else, and the old code answered it
 * with an anchored whole-string test, `^(?:the )?(?:present(?: day)?|now|today|current day)$`,
 * that its sweep pattern never shared. In prose there is always another token, so it emits
 * nothing and "Now, the thing about Vex is that he lies" dates nothing, as it should.
 */
function emitsStandalone(t: Token, tokens: Token[]): boolean {
  if (tokens.length === 1) return true;
  return STANDALONE_PRESENT.has(t.text.toLowerCase().replace(/\s+/g, ' '));
}

/**
 * Walk the tokens once, matching `[HEDGE] NUMBER [range NUMBER] UNIT TAIL`, plus a bare present
 * marker. Returns every phrase in order; spans never overlap, because the walk consumes.
 */
export function matchPhrases(input: Token[]): PhraseMatch[] {
  const tokens = Array.isArray(input) ? input : [];
  const out: PhraseMatch[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) continue;

    if (t.kind === 'STORY' && t.present && emitsStandalone(t, tokens)) {
      out.push({ start: t.start, end: t.end, from: 0, to: 0, anchored: true, next: i + 1 });
      continue;
    }
    if (t.kind !== 'HEDGE' && t.kind !== 'NUMBER') continue;
    // Two numerals side by side with nothing joining them is unreadable — "2 500" is a thousands
    // separator typed as a space, or two numbers run together, and the page does not say which.
    // Without this the walk simply restarted at the second one and dated "500 years before".
    if (t.kind === 'NUMBER' && tokens[i - 1] && tokens[i - 1].kind === 'NUMBER') continue;

    let k = i;
    const hedge = tokens[k].kind === 'HEDGE' ? tokens[k] : null;
    if (hedge) k += 1;
    const first = tokens[k];
    if (!first || first.kind !== 'NUMBER' || first.value === undefined) continue;
    k += 1;

    let second: Token | null = null;
    if (tokens[k] && tokens[k].kind === 'CONNECTOR' && tokens[k].link === 'range'
      && tokens[k + 1] && tokens[k + 1].kind === 'NUMBER' && tokens[k + 1].value !== undefined) {
      second = tokens[k + 1];
      k += 2;
    }

    const unit = tokens[k];
    if (!unit || unit.kind !== 'UNIT' || !unit.unit) continue;
    k += 1;
    const tail = tokens[k];
    if (!tail || tail.kind !== 'TAIL' || tail.sign === undefined) continue;
    k += 1;
    // The phrase is ALWAYS emitted once the shape matches; only whether it is ANCHORED to the
    // story's present depends on what the tail points at. A duration keeps its span with no
    // offset — a stratum with a label and no arithmetic, which §3.1 supports — and pass two may
    // still anchor it against a date or a named event.
    const dating = tailDatesAt(tokens, tail, k);

    const conv = UNIT_DAYS[unit.unit];
    const a = tail.sign * conv(first.value);
    const b = second ? tail.sign * conv(second.value as number) : a;
    let from = Math.min(a, b), to = Math.max(a, b);

    // A comparative BOUNDS the number rather than softening it: "at least twenty years ago" is not
    // "twenty years ago". The old code stripped both alike, so the two produced the identical
    // offset and nothing could tell them apart. The offset stays the stated value — an unbounded
    // end is not a day count and has no place in EraOffset — but the bound travels with the match
    // so a consumer can disclose it instead of the module quietly pretending it was exact.
    const bound = hedge && (hedge.bound === 'atLeast' || hedge.bound === 'atMost') ? hedge.bound : undefined;

    const start = (hedge || first).start;
    out.push({ start, end: tail.end, from: from === 0 ? 0 : from, to: to === 0 ? 0 : to,
      anchored: dating === 'present', bound, next: k });
    i = k - 1;
  }
  return out;
}

/** A bare four-digit number only reads as a year when a cue says so; an era mark needs none. */
export function matchYears(input: Token[]): { start: number; end: number; year: number }[] {
  const tokens = Array.isArray(input) ? input : [];
  const out: { start: number; end: number; year: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) continue;
    if (t.kind === 'YEAR' && t.value !== undefined) { out.push({ start: t.start, end: t.end, year: t.value }); continue; }
    if (t.kind !== 'NUMBER' || t.value === undefined) continue;
    if (!/^\d{4}$/.test(t.text) || t.value < 1000 || t.value > 2999) continue;
    if (tokens[i + 1] && tokens[i + 1].kind === 'UNIT') continue;
    // A CUE licenses it, and so does an object-taking tail: "before 1994" points at a date as
    // plainly as "in 1994" does, and the tail is consumed by the phrase walk before this runs.
    const prev = tokens[i - 1];
    const cued = prev && (prev.kind === 'CUE' || (prev.kind === 'TAIL' && prev.takesObject === true)
      || (prev.kind === 'WORD' && /^(?:to|of)$/i.test(prev.text) && tokens[i - 2] && tokens[i - 2].kind === 'TAIL'));
    if (!cued) continue;
    out.push({ start: t.start, end: t.end, year: t.value });
  }
  return out;
}
