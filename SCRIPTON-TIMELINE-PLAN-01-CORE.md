# ScriptON Timeline Axis — Implementation Plan 01: The Pure Era Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three pure modules the whole timeline axis rests on — era normalisation, the era → year map, and the personal-time age calculator — with nothing yet wired into the service, the planner or the page.

**Architecture:** Three new files under `backend/src/production/scripton/`, in the house pattern of `brief-recommend.util.ts` and `source-classify.util.ts`: pure functions, no Nest, no Prisma, no AI client, no I/O, never throwing, refusing rather than approximating. `era.util.ts` turns temporal language into a signed offset in days from the build's frozen `storyYear`. `era-map.util.ts` says what year a named historical period means — and, for 29 of its 91 rows, refuses to say. `age.util.ts` computes a character's age as proper time along their own worldline, so a time traveller stops raising a false finding on every scene he appears in. Nothing in this plan changes existing behaviour: no existing file is modified, and no caller yet exists.

**Tech Stack:** TypeScript, Node 20+, `node:test` + `node:assert/strict` run by `node --require ts-node/register --test`. No new dependencies — the dependency set is frozen.

**Source of truth:** `SCRIPTON-TIMELINE-SPEC.md` at the repo root — sections 2, 3.1–3.3, 3.6, 7.4 and 7.5.

**Status of the code below:** every implementation and every test in this plan was written and RUN before this document was assembled — **59 tests passing** and a clean `tsc --strict` pass across the three modules. The code blocks are copied out of the files that passed, not composed here. Following this plan reproduces a verified result rather than attempting an unverified one.

## Global Constraints

- **No new dependencies.** `package.json` is frozen. Solve everything with the language and what is already installed.
- **Maximum 3 files altered per turn.** Every task below touches at most 2.
- **No placeholders, no ellipses, no partial implementations.** Every function is written out, including its error handling.
- **PURE.** These three modules import nothing from Nest, Prisma, the AI client, `fs` or the network. `era-map.util.ts` and `age.util.ts` may import from `era.util.ts`; nothing else.
- **NEVER THROWS.** Every exported function tolerates `null`, `undefined` and junk, because an unreadable date must leave a build exactly as it would have been without one.
- **REFUSES rather than approximates.** An expression that does not resolve returns `null`. A constant that cannot say where it came from does not go in.
- **PowerShell 5 on the build machine has no `&&`.** One command per block, every path absolute.
- **Test command:**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
npm run test:unit
```

- **The doctrines these tests are written against**, from the spec:
  - *A check that reports nine defects in a draft containing none is worse than no check.*
  - *A test that passes with the feature deleted is not a test.*
  - *A constant that cannot say where it came from is a constant nobody can audit.*
  - *No number in this system may have a single AI pass as its only witness.*

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/production/scripton/era.util.ts` | **Language → offset.** Word and digit numerals, relative phrases, ranges, absolute years and BC, the sweep over a body of material, and the second pass for expressions anchored to an event. Owns `DAYS_PER_YEAR` and the rounding rule the other files borrow. |
| `backend/src/production/scripton/era.util.spec.ts` | Its tests. |
| `backend/src/production/scripton/era-map.util.ts` | **Period → year.** 91 sourced country rows across 26 countries, 9 generic bands, and the graded refusal that stops an unsound label producing a confident wrong anchor. |
| `backend/src/production/scripton/era-map.util.spec.ts` | Its tests. |
| `backend/src/production/scripton/age.util.ts` | **Worldline → age.** Step classification and integration, the drift and impossibility findings, and the re-anchoring that stops one wrong number becoming a hundred. |
| `backend/src/production/scripton/age.util.spec.ts` | Its tests. |

Three modules rather than one because they fail independently and are read independently: a bad regex in the sweep should not put the era map's sourcing in doubt, and the age calculator is the only one of the three with a real decision in it. `era-map.util.ts` and `age.util.ts` each import exactly one symbol from `era.util.ts` (`yearsToDays`), and that is the whole of the coupling.

**Why the map lives in the backend, when the labels live in the frontend.** `brief-recommend.util.ts` documents the rule that option lists are not duplicated in the backend — they travel with the request, so the two cannot drift. The era → year map is not an option list; it is an annotation on labels, and it needs tests. The frontend has no test runner (there is not one `.spec.ts` anywhere under `frontend/src`), so a 91-row map with 29 refusal rows would be entirely unverified there. It goes in the backend, keyed by the exact label strings — and the drift risk is already absorbed by the design, because a label the map does not know MISSES, and a miss falls through to the generic band and then to the current year. That is the spec's *"unmapped is a supported state"*, and Task 8 tests it directly.

---

### Task 1: The day, and the rounding rule that decides a decade

**Files:**
- Create: `backend/src/production/scripton/era.util.ts`
- Create: `backend/src/production/scripton/era.util.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `DAYS_PER_YEAR = 365.25`, `interface EraOffset { from: number; to: number }`, `yearsToDays(years: number): number`

- [ ] **Step 1: Write the failing test**

Create `backend/src/production/scripton/era.util.spec.ts`:

```ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { yearsToDays, wordsToNumber, DAYS_PER_YEAR } from './era.util';

test('a decade is 3652.5 days, so every even decade is a tie — and ties round AWAY from zero', () => {
  assert.equal(DAYS_PER_YEAR, 365.25);
  assert.equal(yearsToDays(10), 3653);
  assert.equal(yearsToDays(-10), -3653);
  assert.equal(yearsToDays(30), 10958);
  assert.equal(yearsToDays(-30), -10958);
  assert.equal(yearsToDays(20), 7305);
  assert.equal(yearsToDays(-20), -7305);
  assert.equal(yearsToDays(-7), -2557);
  assert.equal(yearsToDays(-15), -5479);
  assert.equal(yearsToDays(1.5), 548);
  assert.equal(yearsToDays(-1.5), -548);
  assert.equal(yearsToDays(0), 0);
});

test('Math.round alone would split a symmetric pair — the guard is the sign handling', () => {
  assert.equal(Math.round(-10 * DAYS_PER_YEAR), -3652);
  assert.notEqual(yearsToDays(-10), Math.round(-10 * DAYS_PER_YEAR));
  assert.equal(Math.abs(yearsToDays(10)), Math.abs(yearsToDays(-10)));
});

test('yearsToDays never throws on junk', () => {
  assert.equal(yearsToDays(NaN), 0);
  assert.equal(yearsToDays(Infinity), 0);
  assert.equal(yearsToDays(null as any), 0);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: FAIL — `Cannot find module './era.util'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/production/scripton/era.util.ts`:

```ts
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
 * normalise to two different timelines. Every even decade is a tie, and even decades are exactly
 * what a history uses.
 */
export function yearsToDays(years: number): number {
  if (!Number.isFinite(years)) return 0;
  const d = years * DAYS_PER_YEAR;
  return d < 0 ? -Math.round(-d) : Math.round(d);
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era.util.ts backend/src/production/scripton/era.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): era offsets in days, rounding half away from zero"
```

---

### Task 2: Word numerals, and the refusal built into them

**Files:**
- Modify: `backend/src/production/scripton/era.util.ts` (append)
- Modify: `backend/src/production/scripton/era.util.spec.ts` (append)

**Interfaces:**
- Consumes: `DAYS_PER_YEAR` from Task 1
- Produces: `wordsToNumber(input: string): number | null`

- [ ] **Step 1: Write the failing test**

Append to `backend/src/production/scripton/era.util.spec.ts`:

```ts
test('word numbers, including tens+unit and hundreds', () => {
  assert.equal(wordsToNumber('seven'), 7);
  assert.equal(wordsToNumber('Seventeen'), 17);
  assert.equal(wordsToNumber('twenty-seven'), 27);
  assert.equal(wordsToNumber('twenty seven'), 27);
  assert.equal(wordsToNumber('three hundred'), 300);
  assert.equal(wordsToNumber('three hundred and fifty'), 350);
  assert.equal(wordsToNumber('two thousand'), 2000);
  assert.equal(wordsToNumber('a'), 1);
  assert.equal(wordsToNumber('18'), 18);
});

test('an unknown token refuses the whole phrase rather than scoring the part it understood', () => {
  assert.equal(wordsToNumber('seven-odd'), null);
  assert.equal(wordsToNumber('several'), null);
  assert.equal(wordsToNumber(''), null);
  assert.equal(wordsToNumber(null as any), null);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: FAIL — `wordsToNumber is not a function`

- [ ] **Step 3: Write the implementation**

Append to `backend/src/production/scripton/era.util.ts`:

```ts
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
  let total = 0, current = 0, seen = false;
  for (const t of toks) {
    if (/^\d+$/.test(t)) { current += parseInt(t, 10); seen = true; continue; }
    if (UNITS[t] !== undefined) { current += UNITS[t]; seen = true; continue; }
    if (TENS[t] !== undefined) { current += TENS[t]; seen = true; continue; }
    if (t === 'hundred') { current = (current || 1) * 100; seen = true; continue; }
    if (t === 'thousand') { total += (current || 1) * 1000; current = 0; seen = true; continue; }
    if (t === 'a' || t === 'an') { current += 1; seen = true; continue; }
    return null;
  }
  return seen ? total + current : null;
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era.util.ts backend/src/production/scripton/era.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): word numerals, refusing the phrase on an unknown token"
```

---

### Task 3: Relative phrases — ranges before singles, and the duration trap

**Files:**
- Modify: `backend/src/production/scripton/era.util.ts` (append)
- Modify: `backend/src/production/scripton/era.util.spec.ts` (append)

**Interfaces:**
- Consumes: `yearsToDays`, `wordsToNumber`, `EraOffset`
- Produces: `parseEraPhrase(phrase: string, following?: string): EraOffset | null`

- [ ] **Step 1: Write the failing test**

Append to `backend/src/production/scripton/era.util.spec.ts`:

```ts
import { parseEraPhrase } from './era.util';

test('the spec table, phrase by phrase', () => {
  assert.deepEqual(parseEraPhrase('Twenty years before the film'), { from: -7305, to: -7305 });
  assert.deepEqual(parseEraPhrase('Fifteen to ten years before the film'), { from: -5479, to: -3653 });
  assert.deepEqual(parseEraPhrase('about seven years ago'), { from: -2557, to: -2557 });
  assert.deepEqual(parseEraPhrase('18 months before the story'), { from: -548, to: -548 });
  assert.deepEqual(parseEraPhrase('the present'), { from: 0, to: 0 });
  assert.deepEqual(parseEraPhrase('now'), { from: 0, to: 0 });
});

test('a range is tried BEFORE a single, or the span silently narrows to its later bound', () => {
  const r = parseEraPhrase('fifteen to ten years ago');
  assert.deepEqual(r, { from: -5479, to: -3653 });
  assert.notDeepEqual(r, parseEraPhrase('ten years ago'));
  assert.deepEqual(parseEraPhrase('10-15 years ago'), { from: -5479, to: -3653 });
});

test('hedges are discarded, so "about seven" and "seven" are ONE timeline', () => {
  assert.deepEqual(parseEraPhrase('about seven years ago'), parseEraPhrase('seven years ago'));
  assert.deepEqual(parseEraPhrase('roughly seven years ago'), parseEraPhrase('seven years ago'));
  assert.deepEqual(parseEraPhrase('some seven years ago'), parseEraPhrase('seven years ago'));
});

test('"seven" and "eight" stay two timelines — merging is the author\'s call, not ours', () => {
  assert.notDeepEqual(parseEraPhrase('seven years ago'), parseEraPhrase('eight years ago'));
});

test('flash-forwards are the same shape with the sign flipped', () => {
  assert.deepEqual(parseEraPhrase('three years later'), { from: 1096, to: 1096 });
  assert.deepEqual(parseEraPhrase('two decades hence'), { from: 7305, to: 7305 });
});

test('every unit converts through the one constant', () => {
  assert.deepEqual(parseEraPhrase('ten days ago'), { from: -10, to: -10 });
  assert.deepEqual(parseEraPhrase('three weeks ago'), { from: -21, to: -21 });
  assert.deepEqual(parseEraPhrase('three centuries ago'), { from: -109575, to: -109575 });
});

test('a measured wait is a duration, not a date — "before" must point at the story', () => {
  assert.equal(parseEraPhrase('seven years before speaking'), null);
  assert.equal(parseEraPhrase('two years before the wedding'), null);
  assert.deepEqual(parseEraPhrase('seven years before the film'), { from: -2557, to: -2557 });
  assert.deepEqual(parseEraPhrase('seven years before, in Cairo'), { from: -2557, to: -2557 });
  assert.deepEqual(parseEraPhrase('seven years ago in Cairo'), { from: -2557, to: -2557 });
});

test('an unresolvable phrase returns null and never a confident number', () => {
  assert.equal(parseEraPhrase('several years ago'), null);
  assert.equal(parseEraPhrase('a long time ago'), null);
  assert.equal(parseEraPhrase('in the old days'), null);
  assert.equal(parseEraPhrase(''), null);
  assert.equal(parseEraPhrase(null as any), null);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: FAIL — `parseEraPhrase is not a function`

- [ ] **Step 3: Write the implementation**

Append to `backend/src/production/scripton/era.util.ts`:

```ts
/** Words a writer uses to soften a number. Discarded: §3.2 makes "about seven" and "seven" one. */
const HEDGE = /\b(?:about|roughly|around|approximately|approx|nearly|almost|some|maybe|perhaps|over|under|more than|less than|at least|at most|a good|a full)\b/gi;

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

function unitKey(word: string): string {
  const w = word.toLowerCase();
  if (w.startsWith('centur')) return 'century';
  return w.replace(/s$/, '');
}

/**
 * `before` and `after` take an object, so "he waited seven years before speaking" is a DURATION, not
 * a date. Only a tail that terminates, or points at the story's own present, dates anything. The
 * other tails (`ago`, `earlier`, `prior`, `back`, `later`, `hence`) cannot take an object and are
 * always accepted. Without this rule every measured wait in the dialogue becomes a timeline.
 */
const OBJECT_TAIL = /^(?:before|after|on)$/i;
const DATING_OBJECT = /^\s*(?:the\s+(?:film|movie|story|series|present|events?|action)|now|today|the\s+day|that|this|,|\.|;|:|—|-|$)/i;

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
    `^([\\w\\s-]{1,40}?)\\s*(?:to|[-\u2013\u2014])\\s*([\\w\\s-]{1,40}?)\\s+(${UNIT_WORD})\\s+(${PAST_TAIL}|${FUTURE_TAIL})\\b(.*)$`, 'i',
  ).exec(raw);
  if (range) {
    const a = wordsToNumber(range[1]), b = wordsToNumber(range[2]);
    if (a === null || b === null) return null;
    if (!tailDates(range[4], restOf(range[5]))) return null;
    const sign = new RegExp(`^(?:${PAST_TAIL})$`, 'i').test(range[4]) ? -1 : 1;
    const conv = UNIT_DAYS[unitKey(range[3])];
    const x = sign * conv(a), y = sign * conv(b);
    return { from: Math.min(x, y), to: Math.max(x, y) };
  }

  const single = new RegExp(
    `^([\\w\\s-]{1,40}?)\\s+(${UNIT_WORD})\\s+(${PAST_TAIL}|${FUTURE_TAIL})\\b(.*)$`, 'i',
  ).exec(raw);
  if (single) {
    const n = wordsToNumber(single[1]);
    if (n === null) return null;
    if (!tailDates(single[3], restOf(single[4]))) return null;
    const sign = new RegExp(`^(?:${PAST_TAIL})$`, 'i').test(single[3]) ? -1 : 1;
    const v = sign * UNIT_DAYS[unitKey(single[2])](n);
    return { from: v, to: v };
  }
  return null;
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era.util.ts backend/src/production/scripton/era.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): relative era phrases, ranges first, durations excluded"
```

---

### Task 4: Absolute years, and the missing year zero

**Files:**
- Modify: `backend/src/production/scripton/era.util.ts` (append)
- Modify: `backend/src/production/scripton/era.util.spec.ts` (append)

**Interfaces:**
- Consumes: `yearsToDays`, `EraOffset`
- Produces: `parseYear(text: string, storyYear: number): EraOffset | null`

- [ ] **Step 1: Write the failing test**

Append to `backend/src/production/scripton/era.util.spec.ts`:

```ts
import { parseYear } from './era.util';

test('a bare year becomes an offset from the frozen present', () => {
  assert.deepEqual(parseYear('2019', 2026), { from: -2557, to: -2557 });
  assert.deepEqual(parseYear('2026', 2026), { from: 0, to: 0 });
  assert.deepEqual(parseYear('2030', 2026), { from: 1461, to: 1461 });
});

test('BC is stored astronomically (1 - n) — there is no year zero', () => {
  assert.deepEqual(parseYear('1 BC', 1), { from: -365, to: -365 });   // 1 BC is ONE year before AD 1
  assert.deepEqual(parseYear('2 BC', 1), { from: -731, to: -731 });   // and 2 BC is two, not three
  assert.deepEqual(parseYear('500 BC', 500), { from: -364885, to: -364885 });
  assert.deepEqual(parseYear('500 BCE', 500), parseYear('500 BC', 500));
  assert.deepEqual(parseYear('500 AD', 500), { from: 0, to: 0 });
});

test('a number that is not a plausible year is refused rather than dated', () => {
  assert.equal(parseYear('300', 2026), null);
  assert.equal(parseYear('9999', 2026), null);
  assert.equal(parseYear('', 2026), null);
  assert.equal(parseYear('2019', NaN), null);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: FAIL — `parseYear is not a function`

- [ ] **Step 3: Write the implementation**

Append to `backend/src/production/scripton/era.util.ts`:

```ts
/**
 * A written year to an offset. BC is stored ASTRONOMICALLY (`1 - n`), because there is no year zero
 * and the arithmetic needs one: without the shift every date before Christ is one year out, and
 * every ancient marker prints wrong. `eraLabel` puts the BC back on the way to the page.
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
    if (n < 1000 || n > 2999) return null; // a bare 4-digit number outside this band is not a year
    astro = n;
  }
  if (astro === null) return null;
  const v = yearsToDays(astro - storyYear);
  return { from: v, to: v };
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era.util.ts backend/src/production/scripton/era.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): absolute years, BC stored astronomically"
```

---

### Task 5: The sweep — pass one over a body of material

**Files:**
- Modify: `backend/src/production/scripton/era.util.ts` (append)
- Modify: `backend/src/production/scripton/era.util.spec.ts` (append)

**Interfaces:**
- Consumes: `parseEraPhrase`, `parseYear`
- Produces: `interface EraHit { text: string; start: number; end: number; offset: EraOffset | null }`, `sweepEras(text: string, storyYear: number): EraHit[]`

- [ ] **Step 1: Write the failing test**

Append to `backend/src/production/scripton/era.util.spec.ts`:

```ts
import { sweepEras } from './era.util';

test('the sweep finds every stratum in a real passage, in order', () => {
  const material = [
    'Twenty years before the film, Vex buys the boy.',
    'Fifteen to ten years before, he is educated in Cairo.',
    'About seven years ago Jason vanished.',
    'The present day: Jason walks into the bar.',
  ].join('\n');
  const hits = sweepEras(material, 2026);
  const offs = hits.map((h) => h.offset);
  assert.deepEqual(offs, [
    { from: -7305, to: -7305 },
    { from: -5479, to: -3653 },
    { from: -2557, to: -2557 },
    { from: 0, to: 0 },
  ]);
  assert.ok(hits.every((h) => material.slice(h.start, h.end).trim() === h.text));
});

test('a phrase anchored to a DATE is captured unresolved, beside the date it needs', () => {
  const hits = sweepEras('Seven years before 1994 he left.', 2026);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].text, 'Seven years before');   // the span is the dating words, nothing more
  assert.equal(hits[0].offset, null);                 // "before 1994" is not "before the present"
  assert.deepEqual(hits[1].offset, { from: -11688, to: -11688 });  // 1994, which pass two will use
});

test('a phrase and the bare year it sits beside never overlap', () => {
  const hits = sweepEras('Seven years ago, in 1994, he left.', 2026);
  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0].offset, { from: -2557, to: -2557 });
  assert.deepEqual(hits[1].offset, { from: -11688, to: -11688 });
});

test('material with no temporal language yields nothing — the commonest case costs nothing', () => {
  assert.deepEqual(sweepEras('INT. SILO - DAY\n\nCROSS waits. Nothing happens.', 2026), []);
  assert.deepEqual(sweepEras('', 2026), []);
  assert.deepEqual(sweepEras(null as any, 2026), []);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: FAIL — `sweepEras is not a function`

- [ ] **Step 3: Write the implementation**

Append to `backend/src/production/scripton/era.util.ts`:

```ts
/** One temporal expression found in the material, with the span it occupied. */
export interface EraHit { text: string; start: number; end: number; offset: EraOffset | null }

const HEDGE_WORD = 'about|roughly|around|approximately|nearly|almost|some';
const NUM = `[\\w-]+(?:[\\s-][\\w-]+){0,3}?`;
const PHRASE_RE = new RegExp(
  `\\b((?:(?:${HEDGE_WORD})\\s+)?${NUM}\\s*(?:to|[\u2013\u2014-])\\s*${NUM}\\s+(?:${UNIT_WORD})\\s+(?:${PAST_TAIL}|${FUTURE_TAIL})` +
  `|(?:(?:${HEDGE_WORD})\\s+)?${NUM}\\s+(?:${UNIT_WORD})\\s+(?:${PAST_TAIL}|${FUTURE_TAIL})` +
  `|the\\s+present\\s+day|the\\s+present|present\\s+day)\\b`,
  'gi',
);
const YEAR_RE = /\b(\d{1,4}\s*(?:BC|BCE|AD|CE)|\d{4})\b(?!\s*(?:days?|weeks?|months?|years?|decades?|centur))/gi;

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
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era.util.ts backend/src/production/scripton/era.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): sweep material for temporal expressions"
```

---

### Task 6: Pass two — expressions anchored to an event

**Files:**
- Modify: `backend/src/production/scripton/era.util.ts` (append)
- Modify: `backend/src/production/scripton/era.util.spec.ts` (append)

**Interfaces:**
- Consumes: `EraHit`, `parseEraPhrase`, `yearsToDays`
- Produces: `interface DatedEvent { name: string; offset: number }`, `resolveEventAnchored(text: string, hits: EraHit[], events?: DatedEvent[]): EraHit[]`

- [ ] **Step 1: Write the failing test**

Append to `backend/src/production/scripton/era.util.spec.ts`:

```ts
import { resolveEventAnchored, yearsToDays } from './era.util';

test('yearsToDays never throws on junk', () => {
  assert.equal(yearsToDays(NaN), 0);
  assert.equal(yearsToDays(Infinity), 0);
  assert.equal(yearsToDays(null as any), 0);
});

test('a phrase measured from a DATE resolves in the second pass, not the first', () => {
  const text = 'Seven years before 1994 he left.';
  const pass1 = sweepEras(text, 2026);
  assert.equal(pass1[0].offset, null);
  const pass2 = resolveEventAnchored(text, pass1, []);
  assert.deepEqual(pass2[0].offset, { from: yearsToDays(-39), to: yearsToDays(-39) });
  assert.equal(yearsToDays(-39), -14245);   // 1987, seven years before 1994
});

test('a phrase measured from an EVENT resolves against that event own era', () => {
  const text = 'Two years before Jason vanished, Vex bought the boy.';
  const pass1 = sweepEras(text, 2026);
  assert.equal(pass1[0].offset, null);
  const pass2 = resolveEventAnchored(text, pass1, [{ name: 'Jason vanished', offset: yearsToDays(-7) }]);
  assert.deepEqual(pass2[0].offset, { from: yearsToDays(-7) + yearsToDays(-2), to: yearsToDays(-7) + yearsToDays(-2) });
});

test('the longest event name wins, so a prefix cannot steal the anchor', () => {
  const text = 'One year before Jason vanished in Cairo, it began.';
  const pass1 = sweepEras(text, 2026);
  const pass2 = resolveEventAnchored(text, pass1, [
    { name: 'Jason vanished', offset: yearsToDays(-7) },
    { name: 'Jason vanished in Cairo', offset: yearsToDays(-20) },
  ]);
  assert.deepEqual(pass2[0].offset, { from: yearsToDays(-21), to: yearsToDays(-21) });
});

test('an event nobody dated leaves the hit null - unresolvable stays unresolvable', () => {
  const text = 'Two years before Jason vanished, Vex bought the boy.';
  const pass1 = sweepEras(text, 2026);
  const pass2 = resolveEventAnchored(text, pass1, []);
  assert.equal(pass2[0].offset, null);
  assert.deepEqual(resolveEventAnchored(text, pass1, [{ name: 'x', offset: NaN }])[0].offset, null);
});

test('already-resolved hits are never touched by the second pass', () => {
  const text = 'About seven years ago Jason vanished.';
  const pass1 = sweepEras(text, 2026);
  const pass2 = resolveEventAnchored(text, pass1, [{ name: 'Jason vanished', offset: yearsToDays(-99) }]);
  assert.deepEqual(pass2[0].offset, { from: yearsToDays(-7), to: yearsToDays(-7) });
});

test('never throws on junk', () => {
  assert.deepEqual(resolveEventAnchored(null as any, null as any, null as any), []);
  assert.deepEqual(resolveEventAnchored('', [], undefined as any), []);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: FAIL — `resolveEventAnchored is not a function`

- [ ] **Step 3: Write the implementation**

Append to `backend/src/production/scripton/era.util.ts`:

```ts
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
    .filter((e) => e && typeof e.name === 'string' && Number.isFinite(e.offset))
    .sort((a, b) => b.name.length - a.name.length); // longest name first, so a prefix cannot win
  return list.map((h) => {
    if (h.offset !== null) return h;
    // The magnitude and direction survive in the phrase itself; only its BASE was missing.
    const rel = parseEraPhrase(h.text, ',');
    if (!rel) return h;
    const after = s.slice(h.end, h.end + 64);
    let base: number | null = null;
    for (const e of known) {
      if (after.toLowerCase().includes(e.name.toLowerCase())) { base = e.offset; break; }
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
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era.util.spec.ts"
```

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era.util.ts backend/src/production/scripton/era.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): resolve event-anchored era phrases in a second pass"
```

---

### Task 7: The era → year map — 91 sourced rows and 9 bands

**Files:**
- Create: `backend/src/production/scripton/era-map.util.ts`
- Create: `backend/src/production/scripton/era-map.util.spec.ts`

**Interfaces:**
- Consumes: `yearsToDays` from `era.util.ts`
- Produces: `type EraFlag = '' | 'disputed' | 'unsound'`, `interface EraRow`, `interface BandRow`, `ERA_BANDS: BandRow[]`, `COUNTRY_ERA_YEARS: EraRow[]`

- [ ] **Step 1: Write the failing test**

Create `backend/src/production/scripton/era-map.util.spec.ts`:

```ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as map from './era-map.util';
import {
  COUNTRY_ERA_YEARS, ERA_BANDS, midpointYear, findEraRow,
  anchorYearForEra, anchorYearForBand, eraOffsetForEra, describeRange,
} from './era-map.util';

test('the inventory is the whole inventory - 91 rows, 26 countries, and the flag counts', () => {
  assert.equal(COUNTRY_ERA_YEARS.length, 91);
  assert.equal(new Set(COUNTRY_ERA_YEARS.map((r) => r.country)).size, 26);
  assert.equal(ERA_BANDS.length, 9);
  const n = (f: string) => COUNTRY_ERA_YEARS.filter((r) => r.flag === f).length;
  assert.equal(n(''), 41);
  assert.equal(n('disputed'), 21);
  assert.equal(n('unsound'), 29);
});

test('every row is orderly and every row says where it came from', () => {
  for (const r of COUNTRY_ERA_YEARS) {
    assert.ok(r.end === null || r.start < r.end, r.country + ' / ' + r.label + ': start is not before end');
    assert.ok(r.basis.length > 10, r.country + ' / ' + r.label + ': no basis');
    assert.ok(['', 'disputed', 'unsound'].includes(r.flag), r.country + ' / ' + r.label + ': bad flag');
  }
});

test('no country lists the same label twice', () => {
  const seen = new Set<string>();
  for (const r of COUNTRY_ERA_YEARS) {
    const k = r.country + ' | ' + r.label;
    assert.ok(!seen.has(k), 'duplicate row: ' + k);
    seen.add(k);
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era-map.util.spec.ts"
```

Expected: FAIL — `Cannot find module './era-map.util'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/production/scripton/era-map.util.ts`:

```ts
/**
 * ERA -> YEAR — what year a named period means, and when to refuse to say.
 *
 * `settingEra` can derive the build's present year only if the chosen period HAS a year. This file
 * is that map, and the standing rule applies: a constant that cannot say where it came from is a
 * constant nobody can audit, so every row carries the clause that fixes its boundary.
 *
 * TWO THINGS THIS FILE DELIBERATELY WILL NOT DO.
 *
 *   1. IT WILL NOT ANCHOR AN UNSOUND LABEL. 29 of the 91 rows name more than one polity, or name
 *      something whose identification is not established. "Ibadi Imamate" is eight discontinuous
 *      imamates over 1,200 years, and its midpoint — 1355 — falls inside the Nabhani gap, a year in
 *      which no imamate existed. Such a row returns NO year and a reason. Offsets are relative, so
 *      everything else still works; only the printed year waits for the user.
 *   2. IT WILL NOT BE READ BACKWARDS. The era list is a creative MENU of evocative periods, not a
 *      calendar: it has 34 gaps (2,430 unlabelled years between the UAE's Bronze Age and its
 *      Islamic era) and 2 overlaps. So era -> year only. A year -> era lookup would be undefined
 *      across the gaps and ambiguous across the overlaps, and nothing in the design needs one.
 *
 * The keys are the exact option labels the form shows. A renamed label simply misses, and a miss is
 * a SUPPORTED STATE — the anchor falls through to the generic band and then to the current year.
 *
 * PURE. NEVER THROWS.
 */
import { yearsToDays } from './era.util';

/** '' = uncontroversial · 'disputed' = a boundary scholars move by more than ~50 years ·
 *  'unsound' = the LABEL will not carry an anchor at all. */
export type EraFlag = '' | 'disputed' | 'unsound';

export interface EraRow {
  country: string;
  /** The exact label string the form displays. */
  label: string;
  start: number;
  /** null means "the story's own present" — so a modern-era anchor never goes stale. */
  end: number | null;
  flag: EraFlag;
  basis: string;
}

/** The nine generic bands, for a country with no deep timeline. Six state their own range in the
 *  label the user already reads, so those rows record what the UI has always claimed. */
export interface BandRow { id: string; start: number | null; end: number | null; offset?: number }
export const ERA_BANDS: BandRow[] = [
  { id: 'ancient', start: -3000, end: 500 },
  { id: 'medieval', start: 500, end: 1500 },
  { id: 'early-modern', start: 1500, end: 1800 },
  { id: '19c', start: 1800, end: 1900 },
  { id: 'early-20c', start: 1900, end: 1940 },
  { id: 'mid-20c', start: 1940, end: 1979 },
  { id: 'contemporary', start: null, end: null, offset: 0 },
  { id: 'near-future', start: null, end: null, offset: 25 },
  { id: 'far-future', start: null, end: null, offset: 150 },
];

export const COUNTRY_ERA_YEARS: EraRow[] = [
  { country: 'Egypt', label: 'Pharaonic', start: -3100, end: -332, flag: 'disputed', basis: 'Unification / 1st Dynasty to Alexander\'s conquest' },
  { country: 'Egypt', label: 'Ptolemaic / Greco-Roman', start: -332, end: 641, flag: 'unsound', basis: 'Alexander through Ptolemaic and Roman/Byzantine rule to the Arab conquest' },
  { country: 'Egypt', label: 'Coptic', start: 300, end: 641, flag: 'disputed', basis: 'Christianisation of Egypt to the Arab conquest' },
  { country: 'Egypt', label: 'Arab-Islamic', start: 641, end: 1517, flag: '', basis: 'Arab conquest 639–642 to Selim I\'s conquest 1517' },
  { country: 'Egypt', label: 'Ottoman', start: 1517, end: 1798, flag: 'disputed', basis: 'Ottoman conquest to Napoleon\'s invasion' },
  { country: 'Egypt', label: 'Modern Egyptian', start: 1805, end: null, flag: '', basis: 'Accession of Muhammad Ali' },
  { country: 'Iraq', label: 'Sumer / Akkad / Babylon', start: -4000, end: -539, flag: 'unsound', basis: 'Uruk-period Sumer to Cyrus\'s capture of Babylon' },
  { country: 'Iraq', label: 'Abbasid Baghdad', start: 762, end: 1258, flag: '', basis: 'al-Manṣūr founds Baghdad to Hülegü\'s sack' },
  { country: 'Iraq', label: 'Modern Iraq', start: 1920, end: null, flag: '', basis: 'British Mandate / creation of the Iraqi state' },
  { country: 'Greece', label: 'Classical', start: -480, end: -323, flag: '', basis: 'End of the Persian Wars to Alexander\'s death' },
  { country: 'Greece', label: 'Hellenistic / Koine', start: -323, end: -30, flag: 'disputed', basis: 'Alexander\'s death to Rome\'s conquest of Egypt' },
  { country: 'Greece', label: 'Modern Greece', start: 1821, end: null, flag: '', basis: 'War of Independence 1821, sovereignty 1830' },
  { country: 'Britain', label: 'Anglo-Saxon', start: 410, end: 1066, flag: '', basis: 'End of Roman Britain to the Norman Conquest' },
  { country: 'Britain', label: 'Norman / Medieval', start: 1066, end: 1485, flag: 'unsound', basis: 'Norman Conquest to Bosworth' },
  { country: 'Britain', label: 'Tudor / Early Modern', start: 1485, end: 1750, flag: 'unsound', basis: 'Accession of Henry VII to the conventional early-modern close' },
  { country: 'Britain', label: 'Modern Britain', start: 1750, end: null, flag: 'disputed', basis: 'Conventional early-modern / modern divide' },
  { country: 'Mexico', label: 'Mesoamerican (Aztec/Maya)', start: -1800, end: 1521, flag: 'unsound', basis: 'Earliest Maya Preclassic to the fall of Tenochtitlán' },
  { country: 'Mexico', label: 'New Spain (Colonial)', start: 1521, end: 1821, flag: '', basis: 'Fall of Tenochtitlán to the Treaty of Córdoba' },
  { country: 'Mexico', label: 'Modern Mexico', start: 1821, end: null, flag: '', basis: 'Independence under the Treaty of Córdoba' },
  { country: 'Japan', label: 'Heian', start: 794, end: 1185, flag: '', basis: 'Capital moved to Heian-kyō to the fall of the Taira' },
  { country: 'Japan', label: 'Edo / Tokugawa', start: 1603, end: 1867, flag: '', basis: 'Ieyasu made shogun to the shogunate\'s surrender of power' },
  { country: 'Japan', label: 'Modern Japan', start: 1868, end: null, flag: '', basis: 'Meiji Restoration' },
  { country: 'Saudi Arabia', label: 'Pre-Islamic Arabia (Jāhiliyya)', start: -500, end: 610, flag: 'unsound', basis: 'Ends at the first Qur\'anic revelation; no sourced start exists' },
  { country: 'Saudi Arabia', label: 'Early Islamic Hijaz', start: 610, end: 661, flag: 'disputed', basis: 'Revelation / Hijra to the end of Rashidun rule from Medina' },
  { country: 'Saudi Arabia', label: 'Saudi states (Diriyah onward)', start: 1727, end: 1932, flag: 'unsound', basis: 'Muhammad bin Saud rules Diriyah to the Kingdom\'s proclamation' },
  { country: 'Saudi Arabia', label: 'Modern Saudi Arabia', start: 1932, end: null, flag: '', basis: 'Royal decree of 23 Sept 1932 unifying Hejaz and Najd' },
  { country: 'Yemen', label: 'Sabaean / Himyarite', start: -800, end: 570, flag: 'unsound', basis: 'Saba to the Aksumite and Sasanian conquests' },
  { country: 'Yemen', label: 'Islamic Yemen (Rasulid / Zaydi)', start: 897, end: 1962, flag: 'unsound', basis: 'Zaydi imamate at Saʿda to the 1962 republic' },
  { country: 'Yemen', label: 'Modern Yemen', start: 1990, end: null, flag: 'disputed', basis: 'North–South unification, 22 May 1990' },
  { country: 'UAE', label: 'Magan (Bronze Age)', start: -2500, end: -1800, flag: 'disputed', basis: 'Umm an-Nar period; Magan named in cuneiform from c. −2300' },
  { country: 'UAE', label: 'Islamic era', start: 630, end: 1820, flag: 'unsound', basis: 'Muhammad\'s envoys reach the region to the General Maritime Treaty' },
  { country: 'UAE', label: 'Trucial States (pearling)', start: 1820, end: 1971, flag: 'disputed', basis: 'General treaty of peace to federation' },
  { country: 'UAE', label: 'Modern UAE', start: 1971, end: null, flag: '', basis: 'Federation established 2 Dec 1971' },
  { country: 'Qatar', label: 'Pearling / Bedouin Qatar', start: 1766, end: 1939, flag: 'disputed', basis: 'Al-Zubārah founded to the discovery of oil' },
  { country: 'Qatar', label: 'Modern Qatar', start: 1971, end: null, flag: '', basis: 'Independence declared 3 Sept 1971' },
  { country: 'Kuwait', label: 'Pre-oil Kuwait (Bani Utub, pearling/trade)', start: 1752, end: 1946, flag: 'disputed', basis: 'Bani Utub choose a Ṣabāḥ sheikh to the first crude export' },
  { country: 'Kuwait', label: 'Modern Kuwait', start: 1961, end: null, flag: '', basis: 'Britain recognises independence, 19 June 1961' },
  { country: 'Bahrain', label: 'Dilmun (Bronze Age)', start: -2200, end: -1600, flag: 'disputed', basis: 'Early Dilmun; Qalʿat al-Bahrain occupied from c. −2300' },
  { country: 'Bahrain', label: 'Islamic Bahrain', start: 628, end: 1783, flag: 'unsound', basis: 'Conversion of al-Mundhir ibn Sāwā to Āl Khalīfah rule' },
  { country: 'Bahrain', label: 'Modern Bahrain', start: 1971, end: null, flag: '', basis: 'Independence declared 15 Aug 1971' },
  { country: 'Oman', label: 'Magan (copper kingdom)', start: -2500, end: -1800, flag: 'disputed', basis: 'Umm an-Nar period; Magan the principal copper source' },
  { country: 'Oman', label: 'Ibadi Imamate', start: 750, end: 1959, flag: 'unsound', basis: 'First imamate after the Umayyad fall to the 1959 surrender' },
  { country: 'Oman', label: 'Omani Empire (Zanzibar)', start: 1650, end: 1856, flag: 'disputed', basis: 'Yaʿrubids retake Muscat to the split on Saʿīd\'s death' },
  { country: 'Oman', label: 'Modern Oman', start: 1970, end: null, flag: '', basis: 'Accession of Qaboos bin Said — Oman was never formally colonised' },
  { country: 'Syria', label: 'Aramean / Classical antiquity', start: -1200, end: 636, flag: 'unsound', basis: 'Aramean emergence to the Byzantine defeat at Yarmūk' },
  { country: 'Syria', label: 'Umayyad Damascus', start: 661, end: 750, flag: '', basis: 'The Umayyad caliphate ruled from Damascus' },
  { country: 'Syria', label: 'Ottoman Syria', start: 1516, end: 1918, flag: '', basis: 'Marj Dābiq to the Ottoman withdrawal from Damascus' },
  { country: 'Syria', label: 'Modern Syria', start: 1946, end: null, flag: '', basis: 'French withdrawal completed April 1946' },
  { country: 'Lebanon', label: 'Phoenician city-states', start: -1200, end: -332, flag: 'disputed', basis: 'Iron Age independence of Tyre / Sidon / Byblos to Alexander\'s siege' },
  { country: 'Lebanon', label: 'Mount Lebanon (Maronite / Druze)', start: 1516, end: 1918, flag: 'unsound', basis: 'Maʿnid emirate through the Mutasarrifate' },
  { country: 'Lebanon', label: 'French Mandate', start: 1920, end: 1943, flag: '', basis: 'Greater Lebanon proclaimed to independence, 22 Nov 1943' },
  { country: 'Lebanon', label: 'Modern Lebanon', start: 1943, end: null, flag: '', basis: 'Independence proclaimed 22 Nov 1943' },
  { country: 'Jordan', label: 'Nabataean (Petra)', start: -312, end: 106, flag: '', basis: 'Nabataeans attested to Trajan\'s annexation' },
  { country: 'Jordan', label: 'Islamic era', start: 636, end: 1918, flag: 'unsound', basis: 'Arab conquest to the end of Ottoman rule' },
  { country: 'Jordan', label: 'Modern Jordan', start: 1946, end: null, flag: '', basis: 'Treaty of London, independence 25 May 1946' },
  { country: 'Palestine', label: 'Canaanite / Philistine antiquity', start: -2000, end: -604, flag: 'unsound', basis: 'Middle Bronze city-states to the destruction of Philistia' },
  { country: 'Palestine', label: 'Islamic Jerusalem', start: 638, end: 1516, flag: 'unsound', basis: 'ʿUmar\'s capture of Jerusalem to the Ottoman conquest' },
  { country: 'Palestine', label: 'Ottoman / British Mandate', start: 1516, end: 1948, flag: 'unsound', basis: 'Marj Dābiq to the Mandate\'s expiry' },
  { country: 'Palestine', label: 'Modern Palestine', start: 1948, end: null, flag: 'disputed', basis: 'Dating convention: the end of the British Mandate' },
  { country: 'Morocco', label: 'Amazigh / Mauretania', start: -225, end: 44, flag: 'unsound', basis: 'Mauretanian kingdom to annexation by Claudius' },
  { country: 'Morocco', label: 'Idrisid (Islamization)', start: 788, end: 974, flag: 'disputed', basis: 'Idris I to the Idrisid expulsion' },
  { country: 'Morocco', label: 'Almoravid / Almohad', start: 1062, end: 1269, flag: 'unsound', basis: 'Almoravid rise to the fall of Almohad Marrakech' },
  { country: 'Morocco', label: 'Modern Morocco', start: 1956, end: null, flag: 'unsound', basis: 'End of the French and Spanish protectorates' },
  { country: 'Algeria', label: 'Numidia / Carthage-Rome', start: -814, end: 429, flag: 'unsound', basis: 'Traditional founding of Carthage to the Vandal crossing' },
  { country: 'Algeria', label: 'Ottoman Regency of Algiers', start: 1516, end: 1830, flag: '', basis: 'Aruj invited to Algiers to the French capture' },
  { country: 'Algeria', label: 'French Algeria', start: 1830, end: 1962, flag: '', basis: 'French conquest to independence' },
  { country: 'Algeria', label: 'Modern Algeria', start: 1962, end: null, flag: '', basis: 'Independence 1962' },
  { country: 'Tunisia', label: 'Carthage (Punic)', start: -814, end: -146, flag: '', basis: 'Founding to destruction in the Third Punic War' },
  { country: 'Tunisia', label: 'Ifriqiya (Aghlabid / Kairouan)', start: 800, end: 909, flag: '', basis: 'The Aghlabid dynasty at Kairouan' },
  { country: 'Tunisia', label: 'Ottoman / Husainid Beylik', start: 1574, end: 1881, flag: 'unsound', basis: 'Ottoman incorporation to the Treaty of Bardo' },
  { country: 'Tunisia', label: 'Modern Tunisia', start: 1956, end: null, flag: '', basis: 'Independence 1956, republic 1957' },
  { country: 'Libya', label: 'Garamantes / Greco-Roman', start: -1000, end: 700, flag: 'unsound', basis: 'Envelope of the Fazzan Garamantian and the coastal Greco-Roman sequences' },
  { country: 'Libya', label: 'Ottoman / Karamanli (Tripoli)', start: 1551, end: 1911, flag: 'unsound', basis: 'Ottoman capture of Tripoli to the Italian occupation' },
  { country: 'Libya', label: 'Italian Libya', start: 1911, end: 1943, flag: '', basis: 'Italian occupation to the Allied expulsion of the Axis' },
  { country: 'Libya', label: 'Modern Libya', start: 1951, end: null, flag: '', basis: 'Independence declared 24 Dec 1951' },
  { country: 'Mauritania', label: 'Sanhaja Berber / trans-Saharan', start: 700, end: 1040, flag: 'disputed', basis: 'Regular camel caravans to the start of the Sanhaja reform' },
  { country: 'Mauritania', label: 'Almoravid reform', start: 1040, end: 1147, flag: '', basis: 'Ibn Yasin\'s movement to the Almohad capture of Marrakesh' },
  { country: 'Mauritania', label: 'Modern Mauritania', start: 1960, end: null, flag: '', basis: 'Independence declared 28 Nov 1960' },
  { country: 'Sudan', label: 'Kush / Meroë (Nubian)', start: -780, end: 350, flag: 'disputed', basis: 'Napatan emergence at el-Kurru to the last Meroitic royal burials' },
  { country: 'Sudan', label: 'Christian Nubia (Makuria)', start: 569, end: 1317, flag: 'disputed', basis: 'Makuria\'s conversion to the mosque conversion at Dongola' },
  { country: 'Sudan', label: 'Funj Sultanate (Sennar)', start: 1504, end: 1821, flag: '', basis: 'Foundation under Amara Dunqas to the submission of Badi VII' },
  { country: 'Sudan', label: 'Modern Sudan', start: 1956, end: null, flag: '', basis: 'End of the Condominium, independence 1 Jan 1956' },
  { country: 'Somalia', label: 'Land of Punt / antiquity', start: -2500, end: -1160, flag: 'unsound', basis: 'Span of attested Egyptian contact with Punt — not a claim about Somali territory' },
  { country: 'Somalia', label: 'Islamic sultanates (Adal / Ajuran)', start: 1250, end: 1700, flag: 'unsound', basis: 'Ajuran attested to its collapse; Adal flourished 1415–1577' },
  { country: 'Somalia', label: 'Modern Somalia', start: 1960, end: null, flag: '', basis: 'Union as the Somali Republic, 1 July 1960' },
  { country: 'Djibouti', label: 'Adal / Afar-Somali sultanates', start: 1285, end: 1862, flag: 'unsound', basis: 'Walashma Ifat through Adal, Aussa and Tadjoura to the purchase of Obock' },
  { country: 'Djibouti', label: 'French Somaliland', start: 1896, end: 1967, flag: 'disputed', basis: 'Côte française des Somalis to its 1967 renaming' },
  { country: 'Djibouti', label: 'Modern Djibouti', start: 1977, end: null, flag: '', basis: 'Independence 27 June 1977' },
  { country: 'Comoros', label: 'Shirazi / Swahili sultanates', start: 1200, end: 1886, flag: 'unsound', basis: 'Attested sultanate towns to the French protectorate treaties' },
  { country: 'Comoros', label: 'French colonial', start: 1886, end: 1975, flag: '', basis: 'Protectorate treaties to independence, 6 July 1975' },
  { country: 'Comoros', label: 'Modern Comoros', start: 1975, end: null, flag: '', basis: 'Independence declared 6 July 1975' },
];
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era-map.util.spec.ts"
```

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era-map.util.ts backend/src/production/scripton/era-map.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): the sourced era to year map, 91 rows across 26 countries"
```

---

### Task 8: The graded refusal, and the direction the map may not be read in

**Files:**
- Modify: `backend/src/production/scripton/era-map.util.ts` (append)
- Modify: `backend/src/production/scripton/era-map.util.spec.ts` (append)

**Interfaces:**
- Consumes: `COUNTRY_ERA_YEARS`, `ERA_BANDS`, `EraRow`, `yearsToDays`
- Produces: `midpointYear(start, end): number`, `interface AnchorVerdict { year: number | null; note: string }`, `findEraRow(country, label): EraRow | null`, `anchorYearForEra(country, label, presentYear): AnchorVerdict`, `anchorYearForBand(bandId, presentYear): number | null`, `describeRange(row, presentYear): string`, `eraOffsetForEra(country, label, storyYear, presentYear): number | null` — and, deliberately, NO inverse lookup

- [ ] **Step 1: Write the failing test**

Append to `backend/src/production/scripton/era-map.util.spec.ts`:

```ts
test('midpoints round half AWAY FROM ZERO, matching yearsToDays', () => {
  assert.equal(midpointYear(1940, 1979), 1960);
  assert.equal(midpointYear(-3100, -332), -1716);
  assert.equal(midpointYear(0, 1), 1);
  assert.equal(midpointYear(-1, 0), -1);
});

test('a clean row anchors silently', () => {
  const v = anchorYearForEra('Japan', 'Edo / Tokugawa', 2026);
  assert.equal(v.year, 1735);
  assert.equal(v.note, '');
});

test('a disputed row anchors AND discloses', () => {
  const v = anchorYearForEra('Britain', 'Modern Britain', 2026);
  assert.equal(v.year, 1888);
  assert.match(v.note, /disputed/);
});

test('an unsound row REFUSES the year and says why - the refusal is the feature', () => {
  const v = anchorYearForEra('Oman', 'Ibadi Imamate', 2026);
  assert.equal(v.year, null);
  assert.match(v.note, /covers more than one period/);
  assert.match(v.note, /Set the year you mean/);
  assert.equal(anchorYearForEra('Mexico', 'Mesoamerican (Aztec/Maya)', 2026).year, null);
  assert.equal(anchorYearForEra('Palestine', 'Ottoman / British Mandate', 2026).year, null);
});

test('an open-ended modern row closes on the caller present, so it never goes stale', () => {
  assert.equal(anchorYearForEra('Egypt', 'Modern Egyptian', 2026).year, 1916);
  assert.equal(anchorYearForEra('Egypt', 'Modern Egyptian', 2126).year, 1966);
});

test('a label the map does not know MISSES - a supported state, never a guess', () => {
  assert.deepEqual(anchorYearForEra('Egypt', 'Pharaonic Renamed', 2026), { year: null, note: '' });
  assert.deepEqual(anchorYearForEra('Atlantis', 'Golden Age', 2026), { year: null, note: '' });
  assert.deepEqual(anchorYearForEra('', '', 2026), { year: null, note: '' });
  assert.deepEqual(anchorYearForEra('Egypt', 'Coptic', NaN), { year: null, note: '' });
  assert.equal(findEraRow(null as any, null as any), null);
});

test('the generic bands anchor, and the forward ones are offsets from the present', () => {
  assert.equal(anchorYearForBand('medieval', 2026), 1000);
  assert.equal(anchorYearForBand('mid-20c', 2026), 1960);
  assert.equal(anchorYearForBand('ancient', 2026), -1250);
  assert.equal(anchorYearForBand('contemporary', 2026), 2026);
  assert.equal(anchorYearForBand('near-future', 2026), 2051);
  assert.equal(anchorYearForBand('far-future', 2026), 2176);
  assert.equal(anchorYearForBand('nonsense', 2026), null);
});

test('BC prints by 1 - astronomicalYear, because there is no year zero', () => {
  const pharaonic = findEraRow('Egypt', 'Pharaonic')!;
  assert.equal(describeRange(pharaonic, 2026), '3101 BC–333 BC');
  const modern = findEraRow('Egypt', 'Modern Egyptian')!;
  assert.equal(describeRange(modern, 2026), '1805–2026');
});

test('an era offset is days from the frozen storyYear, and a refused row gives none', () => {
  assert.equal(eraOffsetForEra('Japan', 'Edo / Tokugawa', 1735, 2026), 0);
  assert.equal(eraOffsetForEra('Japan', 'Edo / Tokugawa', 1745, 2026), -3653);
  assert.equal(eraOffsetForEra('Oman', 'Ibadi Imamate', 2026, 2026), null);
});

test('the map is ONE-DIRECTIONAL - asserting the absence of a year to era lookup IS the test', () => {
  // The era list is a creative menu, not a calendar: 34 gaps and 2 overlaps across the 91 rows.
  // A year -> era lookup would be undefined across the gaps and ambiguous across the overlaps, so
  // this module must never grow one. Adding it would otherwise fail silently for most years.
  const exported = Object.keys(map).filter((k) => typeof (map as any)[k] === 'function');
  const inverse = exported.filter((k) => /^(eraFor|eraAt|periodFor|periodAt|lookupYear|yearTo)/i.test(k));
  assert.deepEqual(inverse, [], 'a year -> era lookup was added: ' + inverse.join(', '));
  assert.deepEqual(exported.sort(), [
    'anchorYearForBand', 'anchorYearForEra', 'describeRange', 'eraOffsetForEra', 'findEraRow', 'midpointYear',
  ]);
});

test('the gaps the one-directional rule exists for are really there', () => {
  const uae = map.COUNTRY_ERA_YEARS.filter((r) => r.country === 'UAE').sort((a, b) => a.start - b.start);
  const magan = uae.find((r) => r.label === 'Magan (Bronze Age)')!;
  const islamic = uae.find((r) => r.label === 'Islamic era')!;
  assert.equal(islamic.start - (magan.end as number), 2430);

  let gaps = 0, overlaps = 0;
  const byCountry = new Map<string, typeof map.COUNTRY_ERA_YEARS>();
  for (const r of map.COUNTRY_ERA_YEARS) {
    if (!byCountry.has(r.country)) byCountry.set(r.country, []);
    byCountry.get(r.country)!.push(r);
  }
  for (const rows of byCountry.values()) {
    const v = rows.slice().sort((a, b) => a.start - b.start);
    for (let i = 1; i < v.length; i++) {
      const prevEnd = v[i - 1].end === null ? 2026 : (v[i - 1].end as number);
      if (v[i].start - prevEnd > 25) gaps++;
      if (v[i].start < prevEnd - 25) overlaps++;
    }
  }
  assert.equal(gaps, 34);
  assert.equal(overlaps, 2);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era-map.util.spec.ts"
```

Expected: FAIL — `anchorYearForEra is not a function` (the Task 7 import line already names it)

- [ ] **Step 3: Write the implementation**

Append to `backend/src/production/scripton/era-map.util.ts`:

```ts

/** The same half-away-from-zero rule `yearsToDays` uses, so a boundary year cannot land on two
 *  different anchors depending on which code path computed it. */
export function midpointYear(start: number, end: number): number {
  const m = (start + end) / 2;
  return m < 0 ? -Math.round(-m) : Math.round(m);
}

export interface AnchorVerdict {
  /** The year to use, or null when this file refuses to name one. */
  year: number | null;
  /** Empty when nothing needs saying. Otherwise the sentence shown beside the Present year box. */
  note: string;
}

const NOT_FOUND: AnchorVerdict = { year: null, note: '' };

export function findEraRow(country: string, label: string): EraRow | null {
  const c = String(country == null ? '' : country).trim();
  const l = String(label == null ? '' : label).trim();
  if (!c || !l) return null;
  return COUNTRY_ERA_YEARS.find((r) => r.country === c && r.label === l) || null;
}

/**
 * The anchor year for a chosen country + era, or a refusal with its reason.
 * `presentYear` is the current calendar year, used only to close an open-ended modern row.
 */
export function anchorYearForEra(country: string, label: string, presentYear: number): AnchorVerdict {
  if (!Number.isFinite(presentYear)) return NOT_FOUND;
  const row = findEraRow(country, label);
  if (!row) return NOT_FOUND;
  if (row.flag === 'unsound') {
    return {
      year: null,
      note: `"${row.label}" covers more than one period, so there is no typical year for it. `
        + `Set the year you mean. (${describeRange(row, presentYear)})`,
    };
  }
  const year = midpointYear(row.start, row.end === null ? presentYear : row.end);
  if (row.flag === 'disputed') {
    return { year, note: `Dated ${describeRange(row, presentYear)}; that boundary is disputed. Change it if you mean otherwise.` };
  }
  return { year, note: '' };
}

/** The band fallback, for a country with no deep timeline. */
export function anchorYearForBand(bandId: string, presentYear: number): number | null {
  if (!Number.isFinite(presentYear)) return null;
  const b = ERA_BANDS.find((x) => x.id === String(bandId || '').trim());
  if (!b) return null;
  if (b.offset !== undefined) return presentYear + b.offset;
  if (b.start === null || b.end === null) return null;
  return midpointYear(b.start, b.end);
}

/** "1750-2026", with BC printed by `1 - astronomicalYear` because there is no year zero. */
export function describeRange(row: EraRow, presentYear: number): string {
  const one = (y: number) => (y <= 0 ? `${1 - y} BC` : String(y));
  return `${one(row.start)}\u2013${row.end === null ? String(presentYear) : one(row.end)}`;
}

/** An era offset in days for a scene dated by period rather than by phrase. Refused rows give null. */
export function eraOffsetForEra(country: string, label: string, storyYear: number, presentYear: number): number | null {
  const v = anchorYearForEra(country, label, presentYear);
  if (v.year === null || !Number.isFinite(storyYear)) return null;
  return yearsToDays(v.year - storyYear);
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/era-map.util.spec.ts"
```

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/era-map.util.ts backend/src/production/scripton/era-map.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): refuse an anchor for an era label that names more than one period"
```

---

### Task 9: Step classification — where the traveller flag lives, and nowhere else

**Files:**
- Create: `backend/src/production/scripton/age.util.ts`
- Create: `backend/src/production/scripton/age.util.spec.ts`

**Interfaces:**
- Consumes: `yearsToDays` from `era.util.ts`
- Produces: `interface Appearance { scene: number; era: number }`, `type StepKind = 'JUMP' | 'LIVED' | 'AMBIGUOUS'`, `interface AgeInput`, `type AgeFinding`, `interface AgeResult`, `AGE_TOLERANCE_DAYS = 366`, `classifySteps(appearances, jumpArrivals, traveller): StepKind[]`

- [ ] **Step 1: Write the failing test**

Create `backend/src/production/scripton/age.util.spec.ts`:

```ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ages, classifySteps, AGE_TOLERANCE_DAYS } from './age.util';
import { yearsToDays } from './era.util';

const y = yearsToDays;
/** Ages come back in days; the cases are written in years. */
const inYears = (r: Record<number, number | null>) => {
  const out: Record<number, number | null> = {};
  for (const k of Object.keys(r)) {
    const v = r[Number(k)];
    out[Number(k)] = v === null ? null : Math.round(v / 365.25);
  }
  return out;
};
const app = (pairs: [number, number][]) => pairs.map(([scene, yrs]) => ({ scene, era: y(yrs) }));
const stat = (o: Record<number, number>) => {
  const out: Record<number, number> = {};
  for (const k of Object.keys(o)) out[Number(k)] = y(o[Number(k)]);
  return out;
};

test('classifySteps consults the traveller flag and nothing else', () => {
  const a = app([[1, 0], [2, -20], [3, 0]]);
  assert.deepEqual(classifySteps(a, [], false), ['LIVED', 'LIVED']);
  assert.deepEqual(classifySteps(a, [], true), ['JUMP', 'AMBIGUOUS']);
  assert.deepEqual(classifySteps(a, [3], true), ['JUMP', 'JUMP']);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/age.util.spec.ts"
```

Expected: FAIL — `Cannot find module './age.util'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/production/scripton/age.util.ts`:

```ts
/**
 * PERSONAL TIME — how old a character is, in a story whose scenes are not in chronological order.
 *
 * Age was never a function of era. It only looked like one because, in a story without travel, the
 * two coincide: `age = anchorAge + (era - anchorEra)` is right for every ordinary script and wrong
 * for every travelled scene. Applied to a traveller it reports a defect on every scene he appears
 * in — dozens of findings in a draft containing none, which is worse than no check at all.
 *
 * So age is computed as PROPER TIME along the character's own worldline: the time he has lived,
 * accumulated over his own appearances in `sceneOrder`, rather than read off the year of the scene
 * he is standing in. Two passes — classify every step, then integrate from each stated age.
 *
 * PURE. NEVER THROWS. For a character with no traveller flag every step is LIVED, the accumulation
 * telescopes to `era - anchorEra`, and the answer is bit-for-bit what it is today.
 */

/** One appearance of one character: the scene, and that scene's era offset in days. */
export interface Appearance { scene: number; era: number }

export type StepKind = 'JUMP' | 'LIVED' | 'AMBIGUOUS';

export interface AgeInput {
  /** That character's appearances, in sceneOrder. */
  appearances: Appearance[];
  /** Only ages the SCRIPT STATES, by scene. An age nobody stated is never inferred. */
  stated: Record<number, number>;
  /** Declared, never derived — see `classifySteps`. */
  traveller?: boolean;
  /** Scenes the plan marks as arrival-by-travel. */
  jumpArrivals?: number[];
  /** Days of life a jump costs. 0 unless the story says otherwise. */
  travelCost?: number;
}

export type AgeFinding =
  | { code: 'ERA_AGE_DRIFT'; scene: number; predicted: number; stated: number }
  | { code: 'ERA_AGE_IMPOSSIBLE'; scene: number; lived: number; jumped: number; stated: number }
  | { code: 'ERA_SELF_REFUTING'; scene: number; predicted: number };

export interface AgeResult {
  /** Age in DAYS by scene. `null` where the worldline cannot be read — never a guess. */
  ageByScene: Record<number, number | null>;
  /**
   * The same ages keyed by APPEARANCE, parallel to `appearances`. A traveller meeting himself is
   * two appearances in one scene at two personal ages: expressible here, and collapsed in
   * `ageByScene`, which keeps the last. v1 does not CHECK an undeclared duplicate — that is the
   * natural next finding — but the shape does not have to change when it does.
   */
  ageByAppearance: (number | null)[];
  findings: AgeFinding[];
}

/** A birthday inside the year is not drift, so the tolerance is one year — in days. */
export const AGE_TOLERANCE_DAYS = 366;

/**
 * Classify every step of one worldline. One forward pass, anchor-free, so it runs once and serves
 * every anchor.
 *
 * THE TRAVELLER FLAG IS DECLARED, NEVER DERIVED, and this is the whole design. The same backwards
 * step means opposite things: for a non-traveller it is the NARRATIVE jumping — the audience is
 * shown an earlier year and the character is simply younger in it — and for a traveller it is the
 * PERSON jumping, because ordinary time does not run backwards for a person. Nothing in the era
 * sequence distinguishes those, so nothing here tries.
 */
export function classifySteps(appearances: Appearance[], jumpArrivals: number[], traveller: boolean): StepKind[] {
  const marked = new Set(jumpArrivals || []);
  const kinds: StepKind[] = [];
  let pending: number | null = null; // an era he left and is still displaced below
  for (let i = 1; i < appearances.length; i++) {
    const { scene, era } = appearances[i];
    const prev = appearances[i - 1].era;
    if (!traveller) { kinds.push('LIVED'); continue; }
    if (marked.has(scene) || era < prev) {
      kinds.push('JUMP');
      if (era < prev) pending = pending === null ? prev : Math.max(pending, prev);
      else if (pending !== null && era >= pending) pending = null; // home again
    } else if (pending !== null && era >= pending) {
      // Displaced, and this step reaches what he left from. He may have jumped home, or he may
      // have lived the years to get back. Both are real stories, so we refuse to pick.
      kinds.push('AMBIGUOUS');
    } else {
      kinds.push('LIVED');
    }
  }
  return kinds;
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/age.util.spec.ts"
```

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/age.util.ts backend/src/production/scripton/age.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): classify a character worldline into jumps, lived steps and refusals"
```

---

### Task 10: Integration and re-anchoring — one wrong number is one finding

**Files:**
- Modify: `backend/src/production/scripton/age.util.ts` (append)
- Modify: `backend/src/production/scripton/age.util.spec.ts` (append)

**Interfaces:**
- Consumes: `classifySteps`, `AgeInput`, `AgeResult`, `AgeFinding`, `AGE_TOLERANCE_DAYS`
- Produces: `ages(input: AgeInput): AgeResult`

- [ ] **Step 1: Write the failing test**

Append to `backend/src/production/scripton/age.util.spec.ts`:

```ts
test('1 non-traveller flashback, anchor first — age is a pure function of era', () => {
  const r = ages({ appearances: app([[3, -7], [5, 0], [9, -20], [12, 0]]), stated: stat({ 3: 27 }) });
  assert.deepEqual(inYears(r.ageByScene), { 3: 27, 5: 34, 9: 14, 12: 34 });
  assert.deepEqual(r.findings, []);
});

test('2 non-traveller, anchor in the middle — the walk runs backwards too', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 9: 14 }) });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 14, 12: 34 });
  assert.deepEqual(r.findings, []);
});

test('3 traveller, both jumps marked — a jump costs no life, so NOTHING fires', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 5: 34 }), traveller: true, jumpArrivals: [9, 12] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 12: 34 });
  assert.deepEqual(r.findings, []);
});

test('4 traveller who STAYS five years in the past ages five years', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [10, -15], [12, 0]]), stated: stat({ 5: 34 }), traveller: true, jumpArrivals: [9, 12] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 10: 39, 12: 39 });
  assert.deepEqual(r.findings, []);
});

test('5 an unmarked return is refused, not accused', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 5: 34 }), traveller: true, jumpArrivals: [9] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 12: null });
  assert.deepEqual(r.findings, []);
});

test('9 home again, then ordinary years at home — pending must CLEAR on the return', () => {
  const r = ages({ appearances: app([[1, 0], [2, -20], [3, 0], [4, 3]]), stated: stat({ 1: 34 }), traveller: true, jumpArrivals: [2, 3] });
  assert.deepEqual(inYears(r.ageByScene), { 1: 34, 2: 34, 3: 34, 4: 37 });
  assert.deepEqual(r.findings, []);
});

test('10 a twenty-year saga with nobody travelling ages everyone correctly', () => {
  const r = ages({ appearances: app([[1, 0], [2, 10], [3, 20]]), stated: stat({ 1: 30 }) });
  assert.deepEqual(inYears(r.ageByScene), { 1: 30, 2: 40, 3: 50 });
  assert.deepEqual(r.findings, []);
});

test('11 two co-equal eras that agree — the Godfather II case raises nothing', () => {
  const r = ages({ appearances: app([[1, 0], [2, -40], [3, 0]]), stated: stat({ 1: 65, 2: 25 }) });
  assert.deepEqual(inYears(r.ageByScene), { 1: 65, 2: 25, 3: 65 });
  assert.deepEqual(r.findings, []);
});

test('12 two co-equal eras that disagree — ONE finding, and no cascade after it', () => {
  const r = ages({ appearances: app([[1, 0], [2, -40], [3, 0]]), stated: stat({ 1: 65, 2: 30 }) });
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].code, 'ERA_AGE_DRIFT');
  assert.equal(r.findings[0].scene, 2);
  assert.deepEqual(inYears(r.ageByScene), { 1: 65, 2: 30, 3: 70 });
});

test('14 a character nobody dated is never reported', () => {
  const r = ages({ appearances: app([[1, 0], [2, -7]]), stated: {} });
  assert.deepEqual(r.ageByScene, { 1: null, 2: null });
  assert.deepEqual(r.findings, []);
});

test('15 stranded, living forward through his own present, stays honest', () => {
  const r = ages({ appearances: app([[1, 0], [2, -20], [3, -10], [4, 0]]), stated: stat({ 1: 34 }), traveller: true, jumpArrivals: [2] });
  assert.deepEqual(inYears(r.ageByScene), { 1: 34, 2: 34, 3: 44, 4: null });
  assert.deepEqual(r.findings, []);
});

test('the tolerance is one year, so a birthday inside the year is not drift', () => {
  assert.equal(AGE_TOLERANCE_DAYS, 366);
  const r = ages({ appearances: app([[1, 0], [2, 10]]), stated: { 1: y(30), 2: y(40) + 300 } });
  assert.deepEqual(r.findings, []);
});

test('never throws on junk', () => {
  assert.deepEqual(ages({ appearances: [], stated: {} }).ageByScene, {});
  assert.deepEqual(ages(null as any).ageByScene, {});
  assert.deepEqual(ages({ appearances: null as any, stated: null as any }).findings, []);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/age.util.spec.ts"
```

Expected: FAIL — `ages is not a function`

- [ ] **Step 3: Write the implementation**

Append to `backend/src/production/scripton/age.util.ts`:

```ts
function stepDelta(kind: StepKind, era: number, prev: number, travelCost: number): number | null {
  if (kind === 'JUMP') return travelCost;
  if (kind === 'LIVED') return era - prev;
  return null;
}

/** Age at every appearance, plus what the arithmetic falsifies. */
export function ages(input: AgeInput): AgeResult {
  const appearances = Array.isArray(input?.appearances) ? input.appearances : [];
  const stated = input?.stated || {};
  const travelCost = Number.isFinite(input?.travelCost as number) ? (input.travelCost as number) : 0;
  const ageByScene: Record<number, number | null> = {};
  const ageByAppearance: (number | null)[] = appearances.map(() => null);
  const findings: AgeFinding[] = [];
  for (const a of appearances) ageByScene[a.scene] = null;
  if (!appearances.length) return { ageByScene, ageByAppearance, findings };

  const anchors: number[] = [];
  appearances.forEach((a, i) => { if (stated[a.scene] !== undefined) anchors.push(i); });
  // A character nobody dated is never reported. Absence of evidence is not a defect.
  if (!anchors.length) return { ageByScene, ageByAppearance, findings };

  const kinds = classifySteps(appearances, input?.jumpArrivals || [], !!input?.traveller);

  /** Age at index `to` given the age at index `from`. Either direction. null if unreadable. */
  const walk = (from: number, age: number, to: number): number | null => {
    const step = to > from ? 1 : -1;
    for (let k = from; k !== to; k += step) {
      const a = step === 1 ? k : k - 1;
      const d = stepDelta(kinds[a], appearances[a + 1].era, appearances[a].era, travelCost);
      if (d === null) return null;
      age += step === 1 ? d : -d;
    }
    return age;
  };

  // Anchor k predicts anchor k+1; a mismatch is the finding, and then k+1 BECOMES the new anchor.
  // One wrong number is one finding rather than a finding on every scene after it.
  for (let j = 0; j + 1 < anchors.length; j++) {
    const a = anchors[j], b = anchors[j + 1];
    const pred = walk(a, stated[appearances[a].scene], b);
    if (pred === null) continue; // an ambiguity sits between them; refuse rather than accuse
    const got = stated[appearances[b].scene];
    if (Math.abs(pred - got) > AGE_TOLERANCE_DAYS) {
      findings.push({ code: 'ERA_AGE_DRIFT', scene: appearances[b].scene, predicted: pred, stated: got });
    }
  }

  for (let i = 0; i < appearances.length; i++) {
    const sc = appearances[i].scene;
    if (stated[sc] !== undefined) { ageByScene[sc] = stated[sc]; ageByAppearance[i] = stated[sc]; continue; }
    let base = anchors[0];
    for (const a of anchors) if (a < i) base = a;
    const v = walk(base, stated[appearances[base].scene], i);
    ageByScene[sc] = v;
    ageByAppearance[i] = v;
  }

  // A step we could not read, whose arrival states an age, is resolved BY that age — and an age
  // fitting neither reading is a defect the old model could not even express.
  for (let k = 1; k < appearances.length; k++) {
    if (kinds[k - 1] !== 'AMBIGUOUS') continue;
    const { scene, era } = appearances[k];
    if (stated[scene] === undefined) continue;
    const before = ageByAppearance[k - 1];
    if (before === null || before === undefined) continue;
    const lived = before + (era - appearances[k - 1].era);
    const jumped = before + travelCost;
    const got = stated[scene];
    if (Math.abs(got - lived) > AGE_TOLERANCE_DAYS && Math.abs(got - jumped) > AGE_TOLERANCE_DAYS) {
      findings.push({ code: 'ERA_AGE_IMPOSSIBLE', scene, lived, jumped, stated: got });
    }
  }

  // A PREDICTED age below zero falsifies the map: he is in a scene set before he was born. A
  // STATED one is the author's and is not ours to contradict.
  appearances.forEach(({ scene }, i) => {
    const v = ageByAppearance[i];
    if (v !== null && v < 0 && stated[scene] === undefined) {
      findings.push({ code: 'ERA_SELF_REFUTING', scene, predicted: v });
    }
  });
  return { ageByScene, ageByAppearance, findings };
}
```

- [ ] **Step 4: Run it and watch it pass**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/age.util.spec.ts"
```

Expected: PASS, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/age.util.ts backend/src/production/scripton/age.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "feat(scripton): age as proper time along a character worldline"
```

---

### Task 11: The three things only this model can express

**Files:**
- Modify: `backend/src/production/scripton/age.util.spec.ts` (append)

**Interfaces:**
- Consumes: `ages`, and the `ERA_AGE_IMPOSSIBLE`, `ERA_SELF_REFUTING` and `ageByAppearance` branches written in Task 10
- Produces: nothing new — this task proves the branches Task 10 introduced actually fire

- [ ] **Step 1: Write the tests**

Append to `backend/src/production/scripton/age.util.spec.ts`:

```ts
test('6 a stated age at the arrival resolves it as a jump', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 5: 34, 12: 34 }), traveller: true, jumpArrivals: [9] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 12: 34 });
  assert.deepEqual(r.findings, []);
});

test('7 ...or as twenty years lived', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 5: 34, 12: 54 }), traveller: true, jumpArrivals: [9] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 12: 54 });
  assert.deepEqual(r.findings, []);
});

test('8 ...and an age fitting NEITHER reading is a real finding', () => {
  const r = ages({ appearances: app([[5, 0], [9, -20], [12, 0]]), stated: stat({ 5: 34, 12: 41 }), traveller: true, jumpArrivals: [9] });
  assert.deepEqual(inYears(r.ageByScene), { 5: 34, 9: 34, 12: 41 });
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].code, 'ERA_AGE_IMPOSSIBLE');
  assert.equal(r.findings[0].scene, 12);
});

test('13 a character in a scene set before he was born', () => {
  const r = ages({ appearances: app([[1, 0], [2, -40]]), stated: stat({ 1: 30 }) });
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].code, 'ERA_SELF_REFUTING');
  assert.equal(r.findings[0].scene, 2);
});

test('a traveller meeting himself is two ages in one scene — expressible, not yet checked', () => {
  // Scene 12 holds him twice: the man who jumped back (still 34) and the older self already there.
  const r = ages({
    appearances: [{ scene: 1, era: y(0) }, { scene: 12, era: y(-20) }, { scene: 12, era: y(-20) }],
    stated: { 1: y(34), 12: y(34) },
    traveller: true,
    jumpArrivals: [12],
  });
  assert.equal(r.ageByAppearance.length, 3);
  assert.equal(inYears({ 0: r.ageByAppearance[1] })[0], 34);
  assert.equal(inYears({ 0: r.ageByAppearance[2] })[0], 34);
  assert.deepEqual(r.findings, []);          // v1 does not flag an undeclared duplicate
  assert.equal(inYears(r.ageByScene)[12], 34); // the scene map keeps one of them
});
```

- [ ] **Step 2: Run them**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
node --require ts-node/register --test "src/production/scripton/age.util.spec.ts"
```

Expected: PASS. These five cases exercise branches already present in the Task 10 implementation; if any FAILS, that implementation was transcribed incompletely — fix `age.util.ts` rather than weakening the test.

- [ ] **Step 3: Commit**

```bash
git -C C:\Projects\TFM-System add backend/src/production/scripton/age.util.spec.ts
```

```bash
git -C C:\Projects\TFM-System commit -m "test(scripton): an impossible traveller age, a scene before birth, a duplicate self"
```

---

### Task 12: Prove the tests would notice if the features were deleted

**Files:**
- Modify: `backend/src/production/scripton/era.util.ts`, `era-map.util.ts`, `age.util.ts` — temporarily, one at a time, each reverted before the next

**Interfaces:**
- Consumes: everything Tasks 1–11 produced
- Produces: nothing. This task commits no code; it is the gate that decides whether the suite is worth having.

*A test that passes with the feature deleted is not a test.* Each row below is a one-line edit that removes exactly one guard. Make the edit, run the suite, confirm the named test FAILS, revert, and confirm green again before the next row. Any row that does NOT fail is a hole in the suite: write the missing test before continuing.

- [ ] **Step 1: Work through the break table, reverting after each row**

| # | File | Change | Must fail |
|---|---|---|---|
| 1 | `era.util.ts` | `yearsToDays` returns `Math.round(d)` for every sign | "a decade is 3652.5 days…" and "Math.round alone would split a symmetric pair" |
| 2 | `era.util.ts` | `wordsToNumber`'s `return null` on an unknown token becomes `continue` | "an unknown token refuses the whole phrase…" |
| 3 | `era.util.ts` | in `parseEraPhrase`, move the single-pattern block ABOVE the range block | "a range is tried BEFORE a single…" |
| 4 | `era.util.ts` | `HEDGE` replaced with `/(?!)/g`, which matches nothing | "hedges are discarded…" |
| 5 | `era.util.ts` | `tailDates` returns `true` unconditionally | "a measured wait is a duration, not a date…" |
| 6 | `era.util.ts` | `parseYear`'s BC branch uses `-n` instead of `1 - n` | "BC is stored astronomically…" |
| 7 | `era.util.ts` | in `sweepEras`, drop the overlap guard inside `take` | "a phrase and the bare year it sits beside never overlap" |
| 8 | `era.util.ts` | `resolveEventAnchored` sorts events shortest-name-first | "the longest event name wins…" |
| 9 | `era.util.ts` | `resolveEventAnchored` returns `h` unchanged when `base` is found | "a phrase measured from a DATE resolves in the second pass…" |
| 10 | `era-map.util.ts` | `midpointYear` returns `Math.round(m)` for every sign | "midpoints round half AWAY FROM ZERO…" |
| 11 | `era-map.util.ts` | `anchorYearForEra` drops the `flag === 'unsound'` branch | "an unsound row REFUSES the year…" |
| 12 | `era-map.util.ts` | `anchorYearForEra` drops the `flag === 'disputed'` note | "a disputed row anchors AND discloses" |
| 13 | `era-map.util.ts` | `describeRange` prints `-y` instead of `1 - y` for BC | "BC prints by 1 - astronomicalYear…" |
| 14 | `era-map.util.ts` | add `export function eraForYear(y: number) { return null; }` | "the map is ONE-DIRECTIONAL…" |
| 15 | `age.util.ts` | in `classifySteps`, `if (!traveller)` becomes `if (false)` | "1 non-traveller flashback…" and "2 non-traveller, anchor in the middle…" |
| 16 | `age.util.ts` | the `AMBIGUOUS` branch condition becomes just `pending !== null` | "4 traveller who STAYS five years in the past…" |
| 17 | `age.util.ts` | the `AMBIGUOUS` branch is deleted, so the step falls through to `LIVED` | "5 an unmarked return is refused, not accused" |
| 18 | `age.util.ts` | `pending = null` on the return jump is removed | "9 home again, then ordinary years at home…" |
| 19 | `age.util.ts` | in `ages`, `base` is always `anchors[0]` | "12 two co-equal eras that disagree…" |
| 20 | `age.util.ts` | `stepDelta` returns `travelCost + 366` for a `JUMP` | "3 traveller, both jumps marked…" and "4 traveller who STAYS…" |
| 21 | `age.util.ts` | the `if (!anchors.length) return` guard is removed | "14 a character nobody dated is never reported" |
| 22 | `age.util.ts` | the `ERA_AGE_IMPOSSIBLE` push is removed | "8 ...and an age fitting NEITHER reading is a real finding" |
| 23 | `age.util.ts` | `ageByAppearance` is assigned only for the last appearance of each scene | "a traveller meeting himself is two ages in one scene…" |

- [ ] **Step 2: Confirm the tree is clean after the last revert**

```bash
git -C C:\Projects\TFM-System status --porcelain
```

Expected: no output. If any file is still modified, a break was not reverted.

- [ ] **Step 3: Run the whole backend suite, not only the three new files**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
npm run test:unit
```

Expected: the pre-existing count plus 59, with `# fail 0`. Nothing in this plan modifies an existing file, so any pre-existing test that changes result is a real regression and must be investigated before the plan is called done.

- [ ] **Step 4: Type-check under strict, which the ordinary build does not do**

```bash
cd C:\Projects\TFM-System\backend
```

```bash
npx tsc --noEmit --target ES2021 --module commonjs --experimentalDecorators --skipLibCheck --strict src/production/scripton/era.util.ts src/production/scripton/era-map.util.ts src/production/scripton/age.util.ts
```

Expected: no output.

- [ ] **Step 5: Commit the green state**

```bash
git -C C:\Projects\TFM-System commit --allow-empty -m "test(scripton): era core verified by deliberate break, 23 guards"
```

---

## What this plan deliberately does NOT do

Everything below is real work in the spec and belongs to a later plan. Naming it here is what keeps this plan's scope honest.

| Deferred | Spec | Why not now |
|---|---|---|
| `storyYear` as a stored, frozen build field | §2, §7 | a schema and intake change. Here it is a parameter every function takes. |
| The AI's labelling pass — which stratum a passage belongs to | §3.4 | belongs to `scripton.service.ts` and the prompt, and it chooses from the list this plan's sweep produces |
| Assigning an era to a scene, by id, from the map | §3.5 | needs the planner, and the planner needs what this plan builds |
| Partitioning the state ledgers by era, and removing `if (recalled) continue` | §4 | modifies `continuity.util.ts` and `scripton.service.ts` — a separate blast radius |
| `ERA_FACT_OUT_OF_WINDOW`, `ERA_INVENTED`, `ERA_MARKER_MISMATCH`, `ERA_MARKER_INCONSISTENT`, `ERA_ANCHOR_CONFLICT` | §5 | every one needs scenes that already carry an era |
| Page markers, and the `spineDirective` era line | §6 | the frontend and the plan shape |
| Deriving the anchor from an absolute/relative pair (`storyYear = absoluteYear − eraOffset`) | §7.0 | the recommendation path; it consumes this plan's `sweepEras` output |
| The Timelines settings block, the recommendation rows, the review panel | §7, §7.0, §7.1 | frontend, and it recommends FROM the analysis this plan makes possible |
| Invented calendars and story-years | §7.3 | a display and settings concern; nothing in the three modules blocks it |
| The degradation test — with era null everywhere, output byte-identical to today's | §9 | it is an integration test, and there is nothing yet integrated to compare |

`ERA_AGE_DRIFT`, `ERA_AGE_IMPOSSIBLE` and `ERA_SELF_REFUTING` are *produced* by `ages()` in this plan, because they are arithmetic over data `ages()` already holds. But nothing calls `ages()` yet, so nothing reaches a user. That is the point: the module can be wrong here at no cost to a build, and it is cheapest to be certain of it now.

## Definition of done

- [ ] Six files exist, three of them tests. No existing file modified.
- [ ] `npm run test:unit` is green, with 59 more tests than before.
- [ ] `tsc --strict` is clean on the three new modules.
- [ ] All 23 deliberate breaks were tried, and all 23 were caught.
- [ ] `git diff --stat` against this plan's starting commit shows only the six new files.
