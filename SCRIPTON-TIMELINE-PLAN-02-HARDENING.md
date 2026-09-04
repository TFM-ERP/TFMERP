# ScriptON Timeline Axis — Implementation Plan 02: Hardening the Era Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the era core's interpolated-regex phrase matcher with one tokenizer and one grammar, bind the 91-row era map to the form's own labels so a rename cannot silently date a story to the present year, and close the smaller items the whole-branch review carried.

**Architecture:** Plan 01 built three pure modules and a review loop found eighteen real defects in them. Every single defect in the phrase matcher was a *disambiguation* bug — "twenty-five years ago" read as a range, "Jason vanished about seven years ago" not detected at all, "the filming of the video" matching "the film" — and none was a missing word. Two reviewers independently traced that to the structure: the same concept was spelled in several places that had to stay isomorphic by hand. This plan reads the text **once** into typed tokens and walks those tokens, so a connector is classified from its neighbours rather than by a lookaround guessing at characters, and a hit's span **is** the tokens it matched.

**Tech Stack:** TypeScript, Node 20+, `node:test` + `node:assert/strict`. No new dependencies.

**Source of truth:** `SCRIPTON-TIMELINE-SPEC.md` at the repo root, and the carried-findings list at the end of Plan 01's execution.

**Status of the code below:** the entire port was written and RUN before this document was assembled. **All 39 era tests pass unchanged**, 280 across the scripton directory, `tsc --strict` clean, and the taxonomy guard was verified to fail when a label is renamed. The code blocks are copied out of the files that passed.

## Global Constraints

- **This is a behaviour-preserving port. All 39 existing era tests must pass with no assertion edited.** That is the contract, and it is what makes the swap safe. A test that has to be weakened to accommodate the new matcher means the port is wrong.
- **No public signature changes.** `era.util.ts` exports exactly what it exported before, so `age.util.ts`, `era-map.util.ts` and every future caller are untouched.
- **No new dependencies.** `package.json` is frozen.
- **PURE, and NEVER THROWS**, in every module here. A test file may use `fs`; a module may not.
- **REFUSES rather than approximates.** A confident wrong year is worse than an honest gap.
- **PowerShell 5 on the build machine has no `&&`.** One command per block, every path absolute.
- **Maximum 3 files altered per turn.** Every task below touches at most 2.
- *A test that passes with the feature deleted is not a test.*

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/production/scripton/era-days.util.ts` | **NEW.** `DAYS_PER_YEAR`, `EraOffset`, `yearsToDays`, `daysToYears`. Its own file purely to break a cycle: both `era.util.ts` and the tokenizer need it. |
| `backend/src/production/scripton/era-tokens.util.ts` | **NEW.** The tokenizer and the grammar — every vocabulary table, lifted unchanged, plus one walk that replaces five regexes. |
| `backend/src/production/scripton/era-tokens.util.spec.ts` | **NEW.** Its tests. |
| `backend/src/production/scripton/era.util.ts` | **MODIFIED.** Keeps its whole public surface; `parseEraPhrase`, `parseYear` and `sweepEras` become thin walks over the shared grammar, and fourteen constants disappear. |
| `backend/src/production/scripton/era-taxonomy.spec.ts` | **NEW.** The cross-boundary guard binding the 91 map rows to the form's labels. |
| `backend/src/production/scripton/era-map.util.ts` | **MODIFIED.** `midpointYear` stops hand-copying the rounding rule. |

---

### Task 1: Move the day arithmetic out, so the tokenizer does not import its own importer

**Files:**
- Create: `backend/src/production/scripton/era-days.util.ts`
- Modify: `backend/src/production/scripton/era.util.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `DAYS_PER_YEAR`, `interface EraOffset`, `yearsToDays`, `daysToYears` — re-exported by `era.util.ts`, so its public surface is unchanged

- [ ] **Step 1: Create the new file**

`era-tokens.util.ts` needs `yearsToDays`, and `era.util.ts` will import the tokenizer. That is a cycle: it happens to resolve under CommonJS because function declarations hoist, and it would not survive a bundler or a change of module target. Move the day arithmetic first, before anything depends on the cycle existing.

Create `backend/src/production/scripton/era-days.util.ts`:

```ts
/**
 * DAYS — the unit the whole timeline axis is measured in, and the one rounding rule.
 *
 * Its own file because both `era.util.ts` and `era-tokens.util.ts` need it, and having the
 * tokenizer import from the module that imports the tokenizer is a cycle: it happens to resolve
 * under CommonJS because function declarations hoist, and it would not survive a bundler or a
 * change of module target. One constant, one rounding rule, no cycle.
 *
 * PURE. NEVER THROWS.
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
```

- [ ] **Step 2: Cut those declarations from `era.util.ts` and import them back**

Delete `DAYS_PER_YEAR`, `EraOffset`, `yearsToDays` and `daysToYears` from `era.util.ts`, and put this at the top instead so every existing caller and test still imports them from `era.util`:

```ts
import { DAYS_PER_YEAR, EraOffset, yearsToDays, daysToYears } from './era-days.util';

/** Re-exported so this module's public surface is exactly what it always was. */
export { DAYS_PER_YEAR, yearsToDays, daysToYears };
export type { EraOffset };
```

- [ ] **Step 3: Run the era suite — it must be untouched**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: 39 tests, `# fail 0`. This step moves code and changes no behaviour; one failure means a declaration was dropped or a re-export missed.

- [ ] **Step 4: Type-check**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
npx tsc --noEmit --target ES2021 --module commonjs --skipLibCheck --strict src/production/scripton/era-days.util.ts src/production/scripton/era.util.ts
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era-days.util.ts backend/src/production/scripton/era.util.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "refactor(scripton): the day arithmetic gets its own file, so nothing imports its own importer"
```

---

### Task 2: The tokenizer — read the text once

**Files:**
- Create: `backend/src/production/scripton/era-tokens.util.ts`

**Interfaces:**
- Consumes: `yearsToDays` from `era-days.util.ts`
- Produces: `type TokenKind`, `interface Token`, `UNIT_DAYS`, `tokenize(input: string): Token[]`

- [ ] **Step 1: Create the file**

This is the module the plan exists for. Read its header before the code — it is the argument, and every table in it is lifted from `era.util.ts` unchanged, so no vocabulary changes hands.

Create `backend/src/production/scripton/era-tokens.util.ts`:

```ts
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

/** What licenses a BARE four-digit number to be read as a year. An era mark needs no cue. */
const YEAR_CUES = [
  'in', 'since', 'by the year', 'by', 'the year', 'c.', 'ca.', 'circa', 'around', 'about',
  'summer of', 'winter of', 'spring of', 'autumn of', 'fall of', 'back in', 'set in',
  'before', 'after', 'prior to', 'ahead of', 'until', 'from', 'between',
];

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
  if (t === 'a' || t === 'an') return 1;
  return null;
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
 * Fold a run of numeral atoms into one value. Two ADJACENT bare-digit runs refuse: "2 500" is
 * either a thousands separator typed as a space or two numbers run together, and nothing on the
 * page says which. Summing them said 502, and summing "10 000" said 10 — which normalises to the
 * same offset as "the present day", the worst value this module can emit.
 */
function foldNumeral(atoms: Atom[], from: number, to: number): number | null {
  let total = 0, current = 0, seen = false, lastDigits = false;
  for (let i = from; i <= to; i++) {
    const t = atoms[i].text.toLowerCase();
    if (t === 'and' || t === '-') { lastDigits = false; continue; }
    const v = numeralValue(t);
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
    if (numeralValue(a.text) !== null) {
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

    const hedge = phraseAt(atoms, i, Object.keys(HEDGES));
    if (hedge) {
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
```

- [ ] **Step 2: Check it reads the hard cases**

Task 4 proves this against the existing 39 tests, which is stronger than anything written now. For your own confidence, run a scratch script:

```ts
// scratch.ts — delete after running
import { tokenize } from './src/production/scripton/era-tokens.util';
for (const s of ['Twenty-five years ago', '10-15 years ago', '15 - 20 years ago', 'at least twenty years ago', 'three hundred and fifty years ago', '500 BC', '10,000 years ago']) {
  console.log(s.padEnd(34), tokenize(s).map((t) => t.kind + (t.value !== undefined ? '(' + t.value + ')' : '') + (t.link ? ':' + t.link : '')).join(' '));
}
```

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register scratch.ts
```

Expected, exactly:

```
Twenty-five years ago              NUMBER(25) UNIT TAIL
10-15 years ago                    NUMBER(10) CONNECTOR:range NUMBER(15) UNIT TAIL
15 - 20 years ago                  NUMBER(15) CONNECTOR:range NUMBER(20) UNIT TAIL
at least twenty years ago          HEDGE NUMBER(20) UNIT TAIL
three hundred and fifty years ago  NUMBER(350) UNIT TAIL
500 BC                             YEAR(-499)
10,000 years ago                   NUMBER(10000) UNIT TAIL
```

The first three lines are the point: `twenty-five` is ONE number and `10-15` is TWO, decided by one rule in one place. Delete `scratch.ts` before committing.

- [ ] **Step 3: Type-check**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
npx tsc --noEmit --target ES2021 --module commonjs --skipLibCheck --strict src/production/scripton/era-tokens.util.ts
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era-tokens.util.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): read temporal language once, into typed tokens"
```

---

### Task 3: The grammar — walk the tokens

**Files:**
- Modify: `backend/src/production/scripton/era-tokens.util.ts` (append)

**Interfaces:**
- Consumes: `Token`, `TokenKind`, `UNIT_DAYS` from Task 2
- Produces: `interface PhraseMatch`, `matchPhrases(tokens: Token[]): PhraseMatch[]`, `matchYears(tokens: Token[]): { start: number; end: number; year: number }[]`

- [ ] **Step 1: Append the grammar**

Append to `backend/src/production/scripton/era-tokens.util.ts`:

```ts
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

const isEnd = (t: Token | undefined) => t === undefined || t.kind === 'TERM';

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
 * Walk the tokens once, matching `[HEDGE] NUMBER [range NUMBER] UNIT TAIL`, plus a bare present
 * marker. Returns every phrase in order; spans never overlap, because the walk consumes.
 */
export function matchPhrases(tokens: Token[]): PhraseMatch[] {
  const out: PhraseMatch[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    if (t.kind === 'STORY' && t.present) {
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
export function matchYears(tokens: Token[]): { start: number; end: number; year: number }[] {
  const out: { start: number; end: number; year: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
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
```

- [ ] **Step 2: Check the behaviours that used to need guards**

Scratch script:

```ts
// scratch.ts — delete after running
import { tokenize, matchPhrases } from './src/production/scripton/era-tokens.util';
for (const s of ['He waited three years before speaking.', 'two years before the wedding', 'ten years before the filming of the wedding video', 'Seven years before 1994 he left.', 'Twenty years before the film', '2 500 years before the film']) {
  console.log(JSON.stringify(s).padEnd(52), JSON.stringify(matchPhrases(tokenize(s)).map((m) => [s.slice(m.start, m.end), m.from, m.anchored])));
}
```

```bash
node --require ts-node/register scratch.ts
```

The first three must come back UNANCHORED — a duration, not a date. The fourth unanchored too: its base is a year, which pass two supplies. The fifth anchored at -7305. The sixth must produce NOTHING, because two numerals side by side are unreadable. Delete `scratch.ts` afterwards.

- [ ] **Step 3: Type-check**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
npx tsc --noEmit --target ES2021 --module commonjs --skipLibCheck --strict src/production/scripton/era-tokens.util.ts
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era-tokens.util.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): a token grammar for temporal phrases and years"
```

---

### Task 4: The swap — and the fourteen constants that die with it

**Files:**
- Modify: `backend/src/production/scripton/era.util.ts`

**Interfaces:**
- Consumes: `tokenize`, `matchPhrases`, `matchYears` from Task 3
- Produces: no change to any public signature — that is the contract

- [ ] **Step 1: Import the grammar**

Add to the imports at the top of `backend/src/production/scripton/era.util.ts`, beside the `era-days.util` import from Task 1:

```ts
import { tokenize, matchPhrases, matchYears } from './era-tokens.util';
```

- [ ] **Step 2: Replace `parseEraPhrase`**

Replace the whole of `parseEraPhrase`, doc comment included, with:

```ts
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
```

- [ ] **Step 3: Replace `sweepEras`**

Replace the whole of `sweepEras`, doc comment included, with:

```ts
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
```

- [ ] **Step 4: Delete the dead vocabulary**

Everything between `wordsToNumber` and `parseEraPhrase` is now unreachable. Delete `HEDGE`, `RANGE_SEP`, `UNIT_DAYS`, `UNIT_WORD`, `PAST_TAIL`, `FUTURE_TAIL`, `PAST_TAIL_RE`, `unitKey`, `noNegZero`, `OBJECT_TAIL`, `DATING_OBJECT`, `tailDates` — and after `sweepEras`, down to `EVENT_LOOKAHEAD`: `HEDGE_WORD`, `NUM_WORD`, `NUM_HEAD`, `DIGITS`, `NUM`, `PHRASE_RE`, `YEAR_CUE`, `YEAR_RE`, `LOOKAHEAD`.

KEEP `UNITS`, `TENS`, `wordsToNumber` (public and tested), and `EVENT_LOOKAHEAD`, `escapeRe`, `namedIn`, `DatedEvent`, `EraHit`, `resolveEventAnchored` untouched.

Every one of `PHRASE_RE`, `YEAR_RE`, `RANGE_SEP`, `DATING_OBJECT` and the two disagreeing hedge lists was the site of a real confident-wrong-number defect. This step is the payoff.

- [ ] **Step 5: Run all 39 era tests, unchanged**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: 39 tests, `# fail 0`. **No assertion may be edited to make this pass.** These encode behaviour that took twenty review passes to settle; a failure means the port is wrong, not the test.

- [ ] **Step 6: Run the directory and type-check**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/*.spec.ts"
```

Expected: 280 tests, `# fail 0`.

```bash
npx tsc --noEmit --target ES2021 --module commonjs --skipLibCheck --strict src/production/scripton/era-days.util.ts src/production/scripton/era-tokens.util.ts src/production/scripton/era.util.ts src/production/scripton/era-map.util.ts src/production/scripton/age.util.ts
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era.util.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "refactor(scripton): the phrase matcher walks tokens, and fourteen regexes go"
```

---

### Task 5: The tokenizer's own tests — including two defects it found

**Files:**
- Create: `backend/src/production/scripton/era-tokens.util.spec.ts`
- Modify: `backend/src/production/scripton/era-tokens.util.ts`

**Interfaces:**
- Consumes: everything Tasks 2 and 3 produced
- Produces: nothing new — this task proves the new module directly rather than only through `era.util`

- [ ] **Step 1: Create the spec file**

Task 4 proved the port preserves behaviour. This proves the module on its own terms, which is what a future change to the grammar will be reviewed against.

Create `backend/src/production/scripton/era-tokens.util.spec.ts`:

```ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { tokenize, matchPhrases, matchYears } from './era-tokens.util';

const kinds = (s: string) => tokenize(s).map((t) => t.kind);
const values = (s: string) => tokenize(s).filter((t) => t.value !== undefined).map((t) => t.value);
const spans = (s: string) => matchPhrases(tokenize(s)).map((m) => s.slice(m.start, m.end));

test('a numeral is one token however it is written', () => {
  assert.deepEqual(values('twenty-five years ago'), [25]);
  assert.deepEqual(values('twenty five years ago'), [25]);
  assert.deepEqual(values('three hundred and fifty years ago'), [350]);
  assert.deepEqual(values('two thousand years back'), [2000]);
  assert.deepEqual(values('10,000 years ago'), [10000]);
  assert.deepEqual(values('a decade before'), [1]);
});

test('a hyphen joins a numeral or separates a range, decided by its NEIGHBOURS', () => {
  // The old rule was a lookaround guessing from raw characters, and it read "twenty-five years
  // ago" as a range from twenty to five - a confident wrong answer on the commonest compound in
  // English. Here the kinds of the tokens on either side decide, in one place.
  assert.deepEqual(kinds('twenty-five years ago'), ['NUMBER', 'UNIT', 'TAIL']);
  assert.deepEqual(kinds('10-15 years ago'), ['NUMBER', 'CONNECTOR', 'NUMBER', 'UNIT', 'TAIL']);
  assert.deepEqual(kinds('15 - 20 years ago'), ['NUMBER', 'CONNECTOR', 'NUMBER', 'UNIT', 'TAIL']);
  assert.equal(tokenize('10-15 years ago')[1].link, 'range');
  assert.deepEqual(kinds('fifteen to ten years before'), ['NUMBER', 'CONNECTOR', 'NUMBER', 'UNIT', 'TAIL']);
  // A dash with nothing numeric on both sides is not a connector at all.
  assert.deepEqual(kinds('Cairo - a city'), ['WORD', 'WORD', 'WORD', 'WORD']);
});

test('two bare digit runs side by side are unreadable, and refuse', () => {
  // "2 500" is a thousands separator typed as a space, or two numbers run together, and nothing
  // on the page says which. Summing them said 502; summing "10 000" said 10, which normalises to
  // the same offset as "the present day" - the worst value this module can emit.
  assert.deepEqual(matchPhrases(tokenize('2 500 years before the film')), []);
  assert.deepEqual(matchPhrases(tokenize('10 000 years ago')), []);
});

test('an era mark binds to the number before it and stores the astronomical year', () => {
  assert.deepEqual(kinds('500 BC'), ['YEAR']);
  assert.deepEqual(values('500 BC'), [-499]);   // there is no year zero
  assert.deepEqual(values('1 BC'), [0]);
  assert.deepEqual(values('500 AD'), [500]);
  assert.deepEqual(values('500 bce'), [-499]);
});

test('a tail carries its direction and whether it can take an object', () => {
  const before = tokenize('before')[0];
  assert.equal(before.kind, 'TAIL');
  assert.equal(before.sign, -1);
  assert.equal(before.takesObject, true);
  const ago = tokenize('ago')[0];
  assert.equal(ago.sign, -1);
  assert.equal(ago.takesObject, false);
  assert.equal(tokenize('later')[0].sign, 1);
});

test('an object-taking tail dates only when the clause ends there or points at the story', () => {
  // A regex needed a word boundary AND a clause boundary AND an optional preposition, and three
  // review rounds, to say this. On tokens it is: the next token is the end, or the story.
  assert.deepEqual(spans('Twenty years before the film'), ['Twenty years before']);
  assert.equal(matchPhrases(tokenize('Twenty years before the film'))[0].anchored, true);
  assert.equal(matchPhrases(tokenize('three years prior to the film'))[0].anchored, true);
  assert.equal(matchPhrases(tokenize('seven years before, in Cairo'))[0].anchored, true);
  // Durations keep their span but are not anchored to the present.
  assert.equal(matchPhrases(tokenize('He waited three years before speaking.'))[0].anchored, false);
  assert.equal(matchPhrases(tokenize('two years before the wedding'))[0].anchored, false);
  // "the filming" is not "the film" - a prefix match was a real defect, and is now unreachable.
  assert.equal(matchPhrases(tokenize('ten years before the filming of the video'))[0].anchored, false);
  assert.equal(matchPhrases(tokenize('seven years before that morning'))[0].anchored, false);
});

test('a phrase measured from a DATE keeps its span for the second pass', () => {
  const m = matchPhrases(tokenize('Seven years before 1994 he left.'));
  assert.equal(m.length, 1);
  assert.equal(m[0].anchored, false);   // the magnitude is real; only the base is missing
});

test('a comparative BOUNDS the number rather than softening it', () => {
  // Two hedge lists that disagreed is why "at least twenty years ago" and "twenty years ago"
  // produced the identical offset with nothing able to tell them apart.
  assert.equal(matchPhrases(tokenize('at least twenty years ago'))[0].bound, 'atLeast');
  assert.equal(matchPhrases(tokenize('more than twenty years ago'))[0].bound, 'atLeast');
  assert.equal(matchPhrases(tokenize('nearly twenty years ago'))[0].bound, 'atMost');
  assert.equal(matchPhrases(tokenize('about twenty years ago'))[0].bound, undefined);
  // The offset itself is unchanged, so nothing downstream shifts.
  assert.equal(matchPhrases(tokenize('at least twenty years ago'))[0].from, -7305);
});

test('a hit span is the tokens it matched, so it cannot swallow the narration', () => {
  assert.deepEqual(spans('Jason vanished about seven years ago.'), ['about seven years ago']);
  assert.deepEqual(spans('It happened three years ago on a rainy night.'), ['three years ago']);
  assert.deepEqual(spans('INT. SILO - DAY. CROSS waits.'), []);
});

test('a bare four-digit number is a year only when something says so', () => {
  assert.deepEqual(matchYears(tokenize('At 1900 hours. It cost 1500 dollars. Room 1408.')), []);
  assert.deepEqual(matchYears(tokenize('in 1994')).map((y) => y.year), [1994]);
  assert.deepEqual(matchYears(tokenize('circa 1650')).map((y) => y.year), [1650]);
  assert.deepEqual(matchYears(tokenize('500 BC')).map((y) => y.year), [-499]);   // a mark needs no cue
  assert.deepEqual(matchYears(tokenize('before 1994')).map((y) => y.year), [1994]);
  assert.deepEqual(matchYears(tokenize('in 9999')), []);   // outside the plausible band
});

test('never throws on junk', () => {
  assert.deepEqual(tokenize(null as any), []);
  assert.deepEqual(tokenize(undefined as any), []);
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(12345 as any).map((t) => t.kind), ['NUMBER']);
  assert.deepEqual(matchPhrases([]), []);
  assert.deepEqual(matchYears([]), []);
  assert.deepEqual(matchPhrases(null as any), []);
});
```

- [ ] **Step 2: Run it, and expect TWO failures**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era-tokens.util.spec.ts"
```

Expected: **9 pass, 2 fail** — `a hyphen joins a numeral or separates a range` and `never throws on junk`. These are real defects the spec found in Task 2's tokenizer; do NOT weaken the assertions. Fix the module in the next step.

- [ ] **Step 3: Fix both**

`a` and `an` are the number one only in front of a UNIT — "a decade before". Everywhere else they are the article, and reading "a city" as the number one put a NUMBER token in the middle of ordinary prose. And `matchPhrases`/`matchYears` throw on a null list, in a module whose header says NEVER THROWS.

In `era-tokens.util.ts`, delete the `if (t === 'a' || t === 'an') return 1;` line from `numeralValue`, and add this helper immediately below that function:

```ts
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
```

Then change the numeral-run test in `tokenize` from `if (numeralValue(a.text) !== null) {` to:

```ts
    if (numeralValue(a.text) !== null || articleIsOne(atoms, i)) {
```

and inside `foldNumeral`, change `const v = numeralValue(t);` to:

```ts
    const v = articleIsOne(atoms, i) ? 1 : numeralValue(t);
```

Finally give both walks a junk guard — change each signature and add one line:

```ts
export function matchPhrases(input: Token[]): PhraseMatch[] {
  const tokens = Array.isArray(input) ? input : [];
```

```ts
export function matchYears(input: Token[]): { start: number; end: number; year: number }[] {
  const tokens = Array.isArray(input) ? input : [];
```

- [ ] **Step 4: Run again**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era-tokens.util.spec.ts"
```

Expected: 11 tests, `# fail 0`.

Then the whole directory:

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/*.spec.ts"
```

Expected: 291 tests, `# fail 0`. The era suite must be untouched by the article fix; if one of its 39 breaks, stop and report.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era-tokens.util.ts backend/src/production/scripton/era-tokens.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "test(scripton): the tokenizer's own spec, and the article it read as a number"
```

---

### Task 6: The cross-boundary guard — a renamed label becomes a red build

**Files:**
- Create: `backend/src/production/scripton/era-taxonomy.spec.ts`

**Interfaces:**
- Consumes: `COUNTRY_ERA_YEARS` from `era-map.util.ts`
- Produces: nothing — this is the only thing standing between a renamed label and a silently wrong year

- [ ] **Step 1: Understand what this defends**

`findEraRow` matches country and label by strict equality, and those labels come from the form: `eraOptionsFor(country)` in `frontend/src/components/scripton/taxonomy.ts`, written verbatim onto `settingEra`. A mismatch is SILENT BY DESIGN — a miss falls through to the generic band and then to the current year — so a renamed label, a different dash, or a decomposed accent would date a Heian story to the present with no error, no note and no failing test.

The two lists live on opposite sides of the repo, so no module can protect this. A test can. It reads the taxonomy as TEXT rather than importing it, so the backend suite takes no build dependency on the frontend.

- [ ] **Step 2: Create the test**

Create `backend/src/production/scripton/era-taxonomy.spec.ts`:

```ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { COUNTRY_ERA_YEARS } from './era-map.util';

/**
 * THE CROSS-BOUNDARY GUARD.
 *
 * `findEraRow` matches `country` and `label` by strict equality, and the labels come from the
 * form: `eraOptionsFor(country)` in the frontend taxonomy, set verbatim onto `settingEra`. A
 * mismatch is SILENT BY DESIGN — a miss falls through to the generic band and then to the current
 * year — so a renamed label, a different dash, or a decomposed accent would quietly date a Heian
 * story to the present, with no error, no note and no failing test.
 *
 * Nothing in the module can protect that, because the two lists live on opposite sides of the
 * repo. This test is the only thing that can. It reads the taxonomy as TEXT rather than importing
 * it, so the backend suite takes no build dependency on the frontend.
 */
const TAXONOMY = join(__dirname, '../../../../frontend/src/components/scripton/taxonomy.ts');

test('every era row is a label the form actually offers, and every label has a row', () => {
  if (!existsSync(TAXONOMY)) {
    assert.fail(`the frontend taxonomy is not at ${TAXONOMY} — if it moved, fix this path rather than deleting the test: it is the only thing standing between a renamed label and a story silently dated to the present year`);
  }
  const src = readFileSync(TAXONOMY, 'utf8');
  const block = src.slice(src.indexOf('COUNTRY_ERA_TIMELINES'), src.indexOf('eraOptionsFor'));

  const offered = new Set<string>();
  let country = '';
  for (const line of block.split('\n')) {
    const c = /^\s*'?([A-Za-z][A-Za-z ]*?)'?:\s*\[/.exec(line);
    if (c) country = c[1].trim();
    for (const m of line.matchAll(/\{ label: '(.*?)', ar:/g)) if (country) offered.add(`${country} | ${m[1]}`);
  }
  const mapped = new Set(COUNTRY_ERA_YEARS.map((r) => `${r.country} | ${r.label}`));

  const unmapped = [...offered].filter((k) => !mapped.has(k));
  const orphaned = [...mapped].filter((k) => !offered.has(k));
  assert.deepEqual(unmapped, [], 'the form offers an era with no row, so choosing it dates the story to the present year');
  assert.deepEqual(orphaned, [], 'the map has a row no form offers, so it can never be reached');
  assert.equal(offered.size, 91);

  // Unicode normalisation is the silent one: Jahiliyya and Meroe carry diacritics, and NFC vs NFD
  // compare unequal while looking identical on screen.
  for (const k of mapped) assert.equal(k, k.normalize('NFC'), `${k} is not in NFC`);
  for (const k of offered) assert.equal(k, k.normalize('NFC'), `${k} is not in NFC`);
});
```

- [ ] **Step 3: Run it**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era-taxonomy.spec.ts"
```

Expected: 1 test, `# fail 0`. If it fails on the PATH, fix the path — do not delete the test. If it fails on a LABEL, you have just found the drift this exists for: report it rather than editing either list.

- [ ] **Step 4: Prove it actually catches a rename**

In `frontend/src/components/scripton/taxonomy.ts`, temporarily change Japan's `{ label: 'Heian'` to `{ label: 'Heian period'`. Re-run the test.

Expected: FAIL, naming `Japan | Heian period` as offered-but-unmapped and `Japan | Heian` as mapped-but-not-offered. **Revert the taxonomy edit** and confirm the test passes again, and that `git -C C:\Projects\TFM-System status --porcelain` shows only the new spec file.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era-taxonomy.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "test(scripton): bind the era map to the labels the form actually offers"
```

---

### Task 7: One rounding rule, in one place

**Files:**
- Modify: `backend/src/production/scripton/era-days.util.ts`
- Modify: `backend/src/production/scripton/era-map.util.ts`

**Interfaces:**
- Consumes: `yearsToDays` from Task 1
- Produces: `roundHalfAwayFromZero(n: number): number`, exported from `era-days.util.ts`

- [ ] **Step 1: Extract the rule**

`midpointYear` hand-copies `yearsToDays`'s rounding, and its own comment claims the two cannot disagree — a guarantee that lives in a comment rather than in the code. In `era-days.util.ts`, replace `yearsToDays` with:

```ts
/**
 * Round half AWAY FROM ZERO. `Math.round` breaks ties toward +Infinity, so a symmetric pair comes
 * out one apart — and a decade is exactly 3652.5 days, so every ten-year step is a tie. Exported
 * because `era-map.util.ts` needs the same rule for its midpoints, and a second hand-written copy
 * is a guarantee that lives in a comment rather than in the code.
 */
export function roundHalfAwayFromZero(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? -Math.round(-n) : Math.round(n);
}

export function yearsToDays(years: number): number {
  if (!Number.isFinite(years)) return 0;
  return roundHalfAwayFromZero(years * DAYS_PER_YEAR);
}
```

- [ ] **Step 2: Point `midpointYear` at it**

In `era-map.util.ts`, add to the imports:

```ts
import { roundHalfAwayFromZero } from './era-days.util';
```

and replace `midpointYear`'s body with:

```ts
export function midpointYear(start: number, end: number): number {
  return roundHalfAwayFromZero((start + end) / 2);
}
```

- [ ] **Step 3: Run the directory**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/*.spec.ts"
```

Expected: 291 tests, `# fail 0`. Both existing rounding tests — the decade ties in `era.util.spec.ts` and `midpointYear(1940, 1979) === 1960` in `era-map.util.spec.ts` — must still pass; they are now testing the same function.

- [ ] **Step 4: Type-check**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
npx tsc --noEmit --target ES2021 --module commonjs --skipLibCheck --strict src/production/scripton/era-days.util.ts src/production/scripton/era-map.util.ts
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era-days.util.ts backend/src/production/scripton/era-map.util.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "refactor(scripton): one rounding rule, shared, instead of a comment promising two agree"
```

---

### Task 8: Prove the tests would notice if the grammar were broken

**Files:**
- Modify: `backend/src/production/scripton/era-tokens.util.ts`, `era.util.ts`, `era-map.util.ts` — temporarily, one at a time, each reverted before the next

**Interfaces:**
- Consumes: everything Tasks 1–7 produced
- Produces: nothing. This task commits no code; it decides whether the port is trustworthy.

Plan 01's sweep found four guards that survived their own deletion out of 41. The port moved every disambiguation rule to a new place, so every one of them needs re-proving where it now lives. Make each edit, run the affected spec, confirm the named test FAILS, revert, and confirm green before the next.

- [ ] **Step 1: Work through the break table, reverting after each row**

| # | File | Change | Must fail |
|---|---|---|---|
| 1 | `era-tokens.util.ts` | in the numeral run, drop the `!(isBareDigits(...) && isBareDigits(after.text))` clause so any unspaced hyphen joins | "a hyphen joins a numeral or separates a range…" — `10-15` becomes one number |
| 2 | `era-tokens.util.ts` | in the same run, absorb a hyphen even when `after.space` is true | "a hyphen joins a numeral…" — `15 - 20` stops being a range |
| 3 | `era-tokens.util.ts` | in `foldNumeral`, `if (lastDigits) return null` becomes `continue` | "two bare digit runs side by side are unreadable, and refuse" |
| 4 | `era-tokens.util.ts` | in `tokenize`, drop the `prev.value > 0` condition on the era mark | "an era mark binds to the number before it…" — `0 BC` becomes a year |
| 5 | `era-tokens.util.ts` | in the era-mark branch, use `-prev.value` instead of `1 - prev.value` | "an era mark binds…" — every BC date one year out |
| 6 | `era-tokens.util.ts` | `articleIsOne` returns true for any `a`/`an` | "a hit span is the tokens it matched…" |
| 7 | `era-tokens.util.ts` | in `classifyConnectors`, return `range` whenever `between` | "a hyphen joins a numeral…" — `twenty-five` becomes a range |
| 8 | `era-tokens.util.ts` | in `classifyConnectors`, drop the `between` check so any dash is a connector | "a hyphen joins a numeral…" — `Cairo - a city` grows a CONNECTOR |
| 9 | `era-tokens.util.ts` | in `tailDatesAt`, return `'present'` unconditionally | "an object-taking tail dates only when the clause ends there…" |
| 10 | `era-tokens.util.ts` | in `tailDatesAt`, drop the `isEnd(tokens[k + 1])` check after a STORY | "an object-taking tail dates only…" — `the filming of the video` dates |
| 11 | `era-tokens.util.ts` | in `tailDatesAt`, return `'no'` instead of `'dated'` for a year object | "a phrase measured from a DATE keeps its span for the second pass" |
| 12 | `era-tokens.util.ts` | in `matchPhrases`, delete the adjacent-NUMBER skip | "two bare digit runs side by side…" — `2 500 years before` dates |
| 13 | `era-tokens.util.ts` | in `matchPhrases`, stop setting `bound` | "a comparative BOUNDS the number rather than softening it" |
| 14 | `era-tokens.util.ts` | in `matchPhrases`, drop `anchored: true` from the present branch | the era suite's spec-table test — `the present` stops resolving |
| 15 | `era-tokens.util.ts` | in `matchYears`, drop the `t.value >= 1000 && t.value <= 2999` band | "a bare four-digit number is a year only when something says so" |
| 16 | `era-tokens.util.ts` | in `matchYears`, drop the `cued` requirement | same test — the noise paragraph grows five strata |
| 17 | `era-tokens.util.ts` | in `matchYears`, drop the TAIL arm of `cued` | the era suite's `a phrase anchored to a DATE is captured unresolved…` |
| 18 | `era-tokens.util.ts` | `matchPhrases`'s `Array.isArray` guard removed | "never throws on junk" |
| 19 | `era.util.ts` | in `parseEraPhrase`, drop the `m.anchored` requirement | the era suite's `a measured wait is a duration, not a date` |
| 20 | `era.util.ts` | in `parseEraPhrase`, drop the `m.start !== …` start check | the era suite's `an unresolvable phrase returns null…` |
| 21 | `era.util.ts` | in `parseYear`, accept `tokens.length !== 1` | the era suite's `a number that is not a plausible year is refused` |
| 22 | `era.util.ts` | in `sweepEras`, delete the overlap guard inside `take` | the era suite's `an overlapping bare year is dropped…` |
| 23 | `era.util.ts` | in `sweepEras`, run the year loop before the phrase loop | same test — the range is swallowed |
| 24 | `era-days.util.ts` | `roundHalfAwayFromZero` returns `Math.round(n)` | the era suite's decade-tie test AND `midpointYear` rounds half away from zero — one edit, two files |
| 25 | `era-taxonomy.spec.ts` | rename one label in the frontend taxonomy | "every era row is a label the form actually offers…" |

- [ ] **Step 2: Confirm the tree is clean after the last revert**

```bash
git -C C:\Projects\TFM-System status --porcelain
```

Expected: no output.

- [ ] **Step 3: Run the whole backend suite**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
npm run test:unit
```

Expected: the pre-existing count plus 12 — 11 tokenizer tests and the taxonomy guard — with `# fail 0`. The 39 era tests, the 17 era-map tests and the 28 age tests must be unchanged in both count and result.

- [ ] **Step 4: Type-check every module under strict**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
npx tsc --noEmit --target ES2021 --module commonjs --experimentalDecorators --skipLibCheck --strict src/production/scripton/era-days.util.ts src/production/scripton/era-tokens.util.ts src/production/scripton/era.util.ts src/production/scripton/era-map.util.ts src/production/scripton/age.util.ts
```

Expected: no output.

- [ ] **Step 5: Confirm the payoff is real**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
git -C C:\Projects\TFM-System diff --stat HEAD~7 -- backend/src/production/scripton/era.util.ts
```

Expected: `era.util.ts` is **smaller** than it was before the port, despite gaining nothing but imports. If it is not, the dead vocabulary in Task 4 was not actually deleted.

- [ ] **Step 6: Commit the green state**

```bash
git -C C:\Projects\TFM-System commit --allow-empty -m "test(scripton): the token grammar verified by deliberate break, 25 guards"
```

---

## What this plan deliberately does NOT do

| Deferred | Why not now |
|---|---|
| Scene era assignment, ledger partitioning, and the `ERA_*` checks (spec §3.5, §4, §5) | Plan 03. Building them on a matcher due for replacement means porting that work twice, which is the whole reason this plan comes first. |
| Acting on a comparative's `bound` | The tokenizer now carries `atLeast` / `atMost` and the offset is unchanged, so nothing regresses. Deciding what a bounded stratum *means* on the page needs the review panel, which is Plan 04. |
| Collapsing `EraOffset` `{from,to}` to the scalar `Appearance.era` wants | Nobody owns that choice yet because nothing calls both. It belongs with scene assignment, where the caller exists. |
| `ageByScene` cannot tell a caller a scene was duplicated | A shape change to `AgeResult` with no consumer. Plan 03. |
| Spec §7.4 claims a source URL per row; `basis` is prose. Spec says `SETTING_ERAS` / `COUNTRY_ERA_TIMELINES`, code says `ERA_BANDS` / `COUNTRY_ERA_YEARS` | Documentation drift, no behaviour. Fold into Plan 03's spec pass. |

## Definition of done

- [ ] Three new files, two modified. `era.util.ts` is smaller than before.
- [ ] All 39 era tests pass **with no assertion edited** — the contract of the whole port.
- [ ] 291 tests across the scripton directory, `# fail 0`.
- [ ] `tsc --strict` clean on all five modules.
- [ ] All 25 deliberate breaks tried, all 25 caught.
- [ ] The taxonomy guard demonstrated to fail on a renamed label, and the rename reverted.
