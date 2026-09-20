# ScriptON Source Layer — Subsystem ② CLASSIFY + DISTIL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the builder able to tell one kind of submitted material from another, so a comp screenplay stops being read as "the work to adapt", a Wikipedia page stops becoming binding canon, and "make the ending ambiguous" stops being something to dramatise.

**Architecture:** A new pure utility, `source-classify.util.ts`, segments each ingested document into offset-addressed passages, merges one AI pass's role verdicts onto them, and distils a **deterministic** Source Bible. No Nest, no Prisma, no filesystem, no network, and **no AI client** — the single model call is made by the service and its parsed reply is passed in, exactly as `checkDraftContinuity` is handed scenes rather than fetching them. The service gains `sourceBibleFor(projectId)`, which runs the classification lazily from the build path and **logs what it found without using it**.

**Tech Stack:** TypeScript · NestJS · `node:test` · **no new dependencies** — `normaliseForCompare`, `jaccard` and `trimToSentence` are reused from `continuity.util.ts`.

**Spec:** `SCRIPTON-SOURCE-LAYER-SPEC-02-CLASSIFY.md`
**Depends on:** ① Ingest (shipped) · **Restore point:** tag `scripton-pre-source-layer` (commit `3b99318`)

---

## ② ships REPORT-ONLY. This is the most important line in the plan.

When this plan is done, **not one byte of a generated script changes.** `sourceBibleFor` runs, logs its verdict counts and its quarantine list, and returns a bible that nothing reads. The consumers flip over in ③ — and they flip over only once a real build's log line shows the roles are right on real material.

That is the project's own doctrine, applied to classification instead of detection: *report-only until validated against real drafts*, because *a check that reports nine defects in a draft containing none is worse than no check*. A classifier that calls your treatment a reference and quarantines it would be strictly worse than no classifier at all. So it reports first, and earns its consumers in ③.

---

## Global Constraints

- **DEPENDENCY FREEZE.** No package added, upgraded or installed. This module imports only from `continuity.util.ts`.
- **NO NEW TAXONOMY.** `SubjectKind` narrows the vocabulary `mapAiFactsToCore` already speaks. The distiller **groups**; it does not interpret.
- **THE DISTILLER MAKES NO AI CALL.** One pass, for roles only. If you find yourself adding a second model call to summarise the bible, stop — the reproducibility and the snapshot tests both die there.
- **CLASSIFICATION FAILURE IS NEVER FATAL.** Every failure path ends in `UNCLASSIFIED`, which behaves exactly as the material behaves today.
- **NO SCHEMA MIGRATION — and in fact no storage change at all.** See the revision note below.
- **Tests are `node:test`.** `import { test } from 'node:test'` and `import { strict as assert } from 'node:assert'` — the **named** `strict as assert` form. Run with `npm run test:unit`, never `npm test`.
- **Maximum 3 files altered per commit** (project working rule). This plan touches exactly three.
- Current suite: **536 passing**. It must never go down.

### Revision to the spec: no persistence in v1

`SCRIPTON-SOURCE-LAYER-SPEC-02-CLASSIFY.md` §5.1 said passages would be stored in `sources[i].passages`. **Implementing it exposed a flaw in that decision and this plan changes it.**

The main paste box is not a `sources[]` record — the intake form pre-merges it into `sourceText` (`ScriptOnIntake.tsx:253`) — so the `paste` document has no row of its own to be stored against, and every way of giving it one either corrupts what the next `saveIntake` writes or contorts the column.

The classification is needed **once per build**, by two or three call sites within one generation. An in-memory cache keyed by `projectId` + a corpus fingerprint covers that completely, costs nothing, and needs no column. The precedent is already in this service: `genProgress` is an in-memory map for exactly this kind of per-run state.

So v1 stores **nothing**. Persistence arrives in ④, when the Brief page needs the evidence across a page load and the frontend has stopped pre-aggregating the paste box anyway. `canReuseClassification` is still built and tested here, because ④ needs it and it is three lines.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/production/scripton/source-classify.util.ts` | **Create.** Segment · batch · merge verdicts · quarantine · distil. Pure. |
| `backend/src/production/scripton/source-classify.util.spec.ts` | **Create.** 38 tests, including the quarantine tests that must fail before the quarantine exists. |
| `backend/src/production/scripton/scripton.service.ts` | **Modify.** `sourceDocsFrom`, `classifyBatch`, `sourceBibleFor`, and one report-only call. |

---

## The five tasks

    1  Segmentation      pure, offset-based. The decision that makes the quarantine structural.
    2  Batching          a batch never straddles documents. The cost cap.
    3  Verdict merge     the entire failure design lives here.
    4  Quarantine + distil   THE ONE THAT MATTERS. Write its tests first.
    5  Wire it in        one AI pass, an in-memory cache, and a log line that uses nothing.

---

### Task 1: Segmentation — the module, its types, and passage offsets

**Files:**
- Create: `backend/src/production/scripton/source-classify.util.ts`
- Test: `backend/src/production/scripton/source-classify.util.spec.ts`

**Interfaces:**
- Consumes: `normaliseForCompare`, `jaccard`, `trimToSentence` from `./continuity.util`.
- Produces: `SourceDoc`, `Passage`, `StoredPassage`, `Verdict`, `Subject`, `SourceBible`, the constants, and `segmentPassages(docs, target?, max?): Passage[]`.

**A passage stores offsets, never text.** Three reasons, in order of importance:

1. It leaves **exactly one function** that turns a passage into words, so the REFERENCE quarantine can be made structural rather than promised. A design where passages carry their own bodies has as many leak paths as it has consumers.
2. A 300 KB corpus does not become a 600 KB payload.
3. No second copy can drift from the first.

- [ ] **Step 1: Write the failing test**

Create `backend/src/production/scripton/source-classify.util.spec.ts`:

```ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  segmentPassages, batchPassages, applyVerdicts, quarantinedDocs, passageBody,
  buildSourceBible, canReuseClassification,
  PASSAGE_TARGET_CHARS, PASSAGE_MAX_CHARS, CLASSIFY_BATCH_CHARS, MAX_CLASSIFY_BATCHES,
  SourceDoc, Passage, StoredPassage,
} from './source-classify.util';

const para = (n: number, word: string) => Array.from({ length: n }, () => word).join(' ');

// ---------------------------------------------------------------------------------------------
// Segmentation
// ---------------------------------------------------------------------------------------------

test('a passage slices back to exactly the text it points at', () => {
  const text = 'First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.';
  const [p] = segmentPassages([{ id: 'd', name: 'd.txt', text }], 20, 200);
  assert.equal(text.slice(p.start, p.end), 'First paragraph here.');
  assert.equal(p.chars, p.end - p.start);
  assert.equal(p.id, 'd#0');
  assert.equal(p.docId, 'd');
});

test('segmentPassages loses no words — the passages reconstruct the document', () => {
  const text = [para(40, 'alpha'), para(40, 'beta'), para(120, 'gamma'), para(10, 'delta')].join('\n\n');
  const out = segmentPassages([{ id: 'd', name: 'd.txt', text }]);
  const rebuilt = out.map((p) => text.slice(p.start, p.end)).join(' ').replace(/\s+/g, ' ').trim();
  assert.equal(rebuilt, text.replace(/\s+/g, ' ').trim());
});

test('passages accrete to the target and never exceed the maximum', () => {
  const text = Array.from({ length: 30 }, (_, i) => para(30, 'word' + i)).join('\n\n');
  const out = segmentPassages([{ id: 'd', name: 'd.txt', text }]);
  assert.ok(out.length > 1, 'a long document must produce more than one passage');
  for (const p of out) assert.ok(p.chars <= PASSAGE_MAX_CHARS, 'passage ' + p.id + ' is ' + p.chars + ' chars');
  // Every passage but the last reached the target — that is what "accrete to the target" means.
  for (const p of out.slice(0, -1)) assert.ok(p.chars >= PASSAGE_TARGET_CHARS * 0.5, p.id + ' is only ' + p.chars);
});

test('a single paragraph far over the maximum is split, not truncated', () => {
  const text = para(2000, 'relentless');
  const out = segmentPassages([{ id: 'd', name: 'd.txt', text }]);
  assert.ok(out.length > 1);
  for (const p of out) assert.ok(p.chars <= PASSAGE_MAX_CHARS);
  const rebuilt = out.map((p) => text.slice(p.start, p.end)).join('').replace(/\s+/g, ' ').trim();
  assert.equal(rebuilt, text.replace(/\s+/g, ' ').trim());
});

test('a paragraph with no sentences and no spaces still splits without losing a character', () => {
  const text = 'x'.repeat(6000);
  const out = segmentPassages([{ id: 'd', name: 'd.txt', text }]);
  assert.ok(out.length >= 3);
  assert.equal(out.map((p) => text.slice(p.start, p.end)).join(''), text);
});

test('segmentPassages is fail-safe on every empty and junk shape', () => {
  assert.deepEqual(segmentPassages(null), []);
  assert.deepEqual(segmentPassages([]), []);
  assert.deepEqual(segmentPassages([{ id: '', name: '', text: 'body' } as SourceDoc]), []);
  assert.deepEqual(segmentPassages([{ id: 'd', name: 'd', text: '   \n\n  \n ' } as SourceDoc]), []);
  assert.deepEqual(segmentPassages([null as any, undefined as any]), []);
  assert.equal(segmentPassages([{ id: 'd', name: 'd', text: 'x' } as SourceDoc]).length, 1);
});

test('CRLF paragraphs segment the same as LF ones', () => {
  const lf = 'One paragraph.\n\nTwo paragraph.';
  const crlf = 'One paragraph.\r\n\r\nTwo paragraph.';
  assert.equal(segmentPassages([{ id: 'd', name: 'd', text: lf }], 10, 100).length,
    segmentPassages([{ id: 'd', name: 'd', text: crlf }], 10, 100).length);
});

test('ids are stable and per document, so two documents never collide', () => {
  // Target 5 so every paragraph closes a passage on its own; the accretion rule is tested above.
  const out = segmentPassages([
    { id: '0', name: 'a.txt', text: 'Alpha one.\n\nAlpha two.' },
    { id: '1', name: 'b.txt', text: 'Beta one.\n\nBeta two.' },
  ], 5, 100);
  assert.deepEqual(out.map((p) => p.id), ['0#0', '0#1', '1#0', '1#1']);
  assert.deepEqual(out.map((p) => p.docId), ['0', '0', '1', '1']);
});

test('a paragraph under the target accretes with the next rather than standing alone', () => {
  // 'Beta one.' is nine characters against a ten-character target: it must NOT close a passage.
  const out = segmentPassages([{ id: '1', name: 'b.txt', text: 'Beta one.\n\nBeta two.' }], 10, 100);
  assert.equal(out.length, 1);
  assert.equal(out[0].chars, 20);
});
```

- [ ] **Step 2: Run it and confirm it fails**

```
cd C:\Projects\TFM-System\backend
```

```
node --require ts-node/register --test src/production/scripton/source-classify.util.spec.ts
```

Expected: FAIL — `Cannot find module './source-classify.util'`.

- [ ] **Step 3: Write the module**

Create `backend/src/production/scripton/source-classify.util.ts`:

```ts
/**
 * SOURCE CLASSIFICATION — telling one kind of material from another.
 *
 * The system reads everything a user attaches as one undifferentiated blob. `develop()` labels the
 * first 6,000 characters of it "the work to adapt - stay faithful to it" and carries that into eight
 * ladder stages; `extractCanon()` reads a 60,000-character prefix as "the hard facts the script must
 * never contradict". So a comp screenplay becomes the work to adapt, a Wikipedia page becomes binding
 * canon, and "make the ending ambiguous" becomes something to dramatise. Two pages of THE TRUMAN SHOW
 * reached scene 32 of a delivered draft through exactly this path.
 *
 * This module is PURE: no Nest, no Prisma, no filesystem, no network, and NO AI CLIENT. The single
 * model call is made by the service and its parsed reply is passed to `applyVerdicts` — the same
 * shape as `checkDraftContinuity`, which is handed scenes rather than fetching them. That is what
 * makes the whole module testable without a model.
 *
 * NEVER THROWS. Every entry point tolerates null, junk and truncated input, because an unclassified
 * corpus must behave exactly as it does today rather than failing a build.
 */
import { normaliseForCompare, jaccard, trimToSentence } from './continuity.util';

export type Role = 'CANON' | 'RESEARCH' | 'REFERENCE' | 'INSTRUCTION';
export type StoredRole = Role | 'UNCLASSIFIED';
export type SubjectKind = 'CHARACTER' | 'PLACE' | 'RULE' | 'EVENT' | 'OTHER';

export interface SourceDoc { id: string; name: string; text: string }
export interface Subject { name: string; kind: SubjectKind }
export interface Passage { id: string; docId: string; start: number; end: number; chars: number }
export interface StoredPassage extends Passage { role: StoredRole; subjects: Subject[]; confidence: number }
export interface Verdict { id: string; role: Role; subjects: Subject[]; confidence: number }

export interface SourceBible {
  brief: string;
  full: string;
  canonText: string;
  instructions: string[];
  research: Array<{ subject: string; passages: number; docs: string[] }>;
  references: Array<{ doc: string; why: string }>;
  counts: Record<string, number>;
}

/** A passage accretes paragraphs until it reaches this, then closes. */
export const PASSAGE_TARGET_CHARS = 900;
/** No passage may exceed this. A single paragraph over it is split on sentence boundaries. */
export const PASSAGE_MAX_CHARS = 2400;
/** Material sent to the model in one classification call. */
export const CLASSIFY_BATCH_CHARS = 24000;
/** Hard ceiling on model calls per build. Passages beyond it stay UNCLASSIFIED, which is safe. */
export const MAX_CLASSIFY_BATCHES = 12;
/** Token overlap above which two passages are the same text, not two similar ones. */
export const DEDUPE_SIMILARITY = 0.9;

export const ROLES: Role[] = ['CANON', 'RESEARCH', 'REFERENCE', 'INSTRUCTION'];
export const SUBJECT_KINDS: SubjectKind[] = ['CHARACTER', 'PLACE', 'RULE', 'EVENT', 'OTHER'];

/**
 * Tie-break order when a document's passages split evenly between roles.
 *
 * REFERENCE first, deliberately. The cost of over-quarantining is one paragraph the writer never
 * sees; the cost of under-quarantining has already shipped once.
 */
const PLURALITY_ORDER: Role[] = ['REFERENCE', 'INSTRUCTION', 'RESEARCH', 'CANON'];

// ---------------------------------------------------------------------------------------------
// Segmentation — pure, deterministic, offset-based
// ---------------------------------------------------------------------------------------------

/** Push [from,to) onto `spans` with surrounding whitespace trimmed off, skipping empty regions. */
function pushSpan(spans: Array<[number, number]>, text: string, from: number, to: number): void {
  let s = from;
  let e = to;
  while (s < e && /\s/.test(text.charAt(s))) s++;
  while (e > s && /\s/.test(text.charAt(e - 1))) e--;
  if (e > s) spans.push([s, e]);
}

/** Paragraph spans: blank-line separated, each trimmed, offsets absolute into `text`. */
function paragraphSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const re = /\n[ \t]*\r?\n/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    pushSpan(spans, text, cursor, m.index);
    cursor = m.index + m[0].length;
    re.lastIndex = cursor;
  }
  pushSpan(spans, text, cursor, text.length);
  return spans;
}

/**
 * Split one over-long paragraph on sentence boundaries, then on whitespace, then hard.
 *
 * A cut is only accepted past 30% of the window so a paragraph opening with "Mr." does not produce a
 * four-character passage. The hard cut is a last resort for text with no sentences and no spaces
 * (minified HTML, a table dump) — it never drops a character, so reconstruction stays exact.
 */
function splitLongParagraph(text: string, from: number, to: number, max: number): Array<[number, number]> {
  if (to - from <= max) return [[from, to]];
  const out: Array<[number, number]> = [];
  let cur = from;
  while (to - cur > max) {
    const window = text.slice(cur, cur + max);
    let cut = -1;
    const re = /[.!?]["'’”)\]]?\s/g;
    let mm: RegExpExecArray | null;
    let last = -1;
    while ((mm = re.exec(window)) !== null) last = mm.index + mm[0].length;
    if (last > max * 0.3) cut = cur + last;
    if (cut < 0) {
      const ws = window.lastIndexOf(' ');
      cut = ws > max * 0.3 ? cur + ws + 1 : cur + max;
    }
    out.push([cur, cut]);
    cur = cut;
  }
  if (to > cur) out.push([cur, to]);
  return out;
}

/**
 * Segment every document into addressable passages.
 *
 * A passage stores OFFSETS, never text. Three reasons, in order of importance: it leaves exactly one
 * function that turns a passage into words, so the REFERENCE quarantine is structural rather than
 * promised; a 300 KB corpus does not become a 600 KB Json column; and no second copy can drift from
 * the first across re-saves.
 *
 * Ids are `<docId>#<ordinal>` — stable under re-save while the text is unchanged, and greppable in a
 * log line, which matters when a classification looks wrong and you need the passage it came from.
 */
export function segmentPassages(
  docs: SourceDoc[] | null | undefined,
  target = PASSAGE_TARGET_CHARS,
  max = PASSAGE_MAX_CHARS,
): Passage[] {
  const out: Passage[] = [];
  const lo = Math.max(1, Number(target) || PASSAGE_TARGET_CHARS);
  const hi = Math.max(lo, Number(max) || PASSAGE_MAX_CHARS);
  for (const doc of Array.isArray(docs) ? docs : []) {
    const docId = String(doc && doc.id != null ? doc.id : '');
    const text = String((doc && doc.text) || '');
    if (!docId || !text.trim()) continue;
    const paras: Array<[number, number]> = [];
    for (const [s, e] of paragraphSpans(text)) {
      for (const span of splitLongParagraph(text, s, e, hi)) paras.push(span);
    }
    let ordinal = 0;
    let curS = -1;
    let curE = -1;
    for (const [s, e] of paras) {
      if (curS < 0) { curS = s; curE = e; }
      else if (e - curS <= hi) { curE = e; }
      else {
        out.push({ id: docId + '#' + ordinal, docId, start: curS, end: curE, chars: curE - curS });
        ordinal++;
        curS = s; curE = e;
      }
      if (curE - curS >= lo) {
        out.push({ id: docId + '#' + ordinal, docId, start: curS, end: curE, chars: curE - curS });
        ordinal++;
        curS = -1; curE = -1;
      }
    }
    if (curS >= 0) {
      out.push({ id: docId + '#' + ordinal, docId, start: curS, end: curE, chars: curE - curS });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run and confirm green**

```
node --require ts-node/register --test src/production/scripton/source-classify.util.spec.ts
```

Expected: **10 passing.**

**Watch for:** the accretion rule is *"close the passage once it reaches the target"*, so a paragraph shorter than the target joins the next one. That is correct and the test named `a paragraph under the target accretes with the next rather than standing alone` pins it — do not "fix" it into one-passage-per-paragraph, which would send hundreds of one-line passages to the model.

---

### Task 2: Batching

**Files:**
- Modify: `source-classify.util.ts`, `source-classify.util.spec.ts`

**Interfaces:**
- Consumes: `Passage` from Task 1.
- Produces: `batchPassages(passages, maxChars?, maxBatches?): Passage[][]`.

**A batch never straddles documents.** The document is the strongest prior available for its own passages' role — a file called `truman-show.pdf` is a reference from its first page to its last — and splitting one across calls throws that prior away for no saving.

**`MAX_CLASSIFY_BATCHES` is a cost cap, not an error.** Passages past it are simply not returned; they stay `UNCLASSIFIED`, which is a defined safe state. A 400-page novel costs twelve calls, not forty.

- [ ] **Step 1: Write the failing test**

Append to `source-classify.util.spec.ts`, and add `batchPassages` to the import block:

```ts
// ---------------------------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------------------------

const mkPassages = (docId: string, n: number, chars: number): Passage[] =>
  Array.from({ length: n }, (_, i) => ({ id: docId + '#' + i, docId, start: i * chars, end: (i + 1) * chars, chars }));

test('a batch never straddles documents — the document is a prior worth keeping', () => {
  const batches = batchPassages([...mkPassages('0', 2, 100), ...mkPassages('1', 2, 100)]);
  assert.equal(batches.length, 2);
  assert.deepEqual(batches[0].map((p) => p.docId), ['0', '0']);
  assert.deepEqual(batches[1].map((p) => p.docId), ['1', '1']);
});

test('a batch closes at the character budget', () => {
  const batches = batchPassages(mkPassages('0', 10, 1000), 2500);
  for (const b of batches) assert.ok(b.reduce((n, p) => n + p.chars, 0) <= 2500);
  assert.equal(batches.reduce((n, b) => n + b.length, 0), 10);
});

test('THE COST CAP: passages past the batch ceiling are dropped, never crammed in', () => {
  const batches = batchPassages(mkPassages('0', 100, 1000), 2000, 3);
  assert.equal(batches.length, 3);
  for (const b of batches) assert.ok(b.reduce((n, p) => n + p.chars, 0) <= 2000);
});

test('batchPassages is fail-safe', () => {
  assert.deepEqual(batchPassages(null), []);
  assert.deepEqual(batchPassages([]), []);
  assert.deepEqual(batchPassages([null as any, { id: '', docId: 'd', start: 0, end: 0, chars: 0 } as Passage]), []);
});
```

- [ ] **Step 2: Run and confirm failure**

```
node --require ts-node/register --test src/production/scripton/source-classify.util.spec.ts
```

Expected: FAIL — `batchPassages is not a function`.

- [ ] **Step 3: Add it to the module**

Append to `source-classify.util.ts`:

```ts
// ---------------------------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------------------------

/**
 * Group passages into model calls.
 *
 * A batch NEVER straddles documents. The document is the strongest prior available for its own
 * passages' role — a file called `truman-show.pdf` is a reference from its first page to its last —
 * and splitting one across calls throws that prior away for no saving.
 *
 * Passages past `maxBatches` are simply not returned. They stay UNCLASSIFIED, which is a defined,
 * safe state: they remain in the corpus and every existing consumer still reads them.
 */
export function batchPassages(
  passages: Passage[] | null | undefined,
  maxChars = CLASSIFY_BATCH_CHARS,
  maxBatches = MAX_CLASSIFY_BATCHES,
): Passage[][] {
  const cap = Math.max(1, Number(maxChars) || CLASSIFY_BATCH_CHARS);
  const limit = Math.max(1, Number(maxBatches) || MAX_CLASSIFY_BATCHES);
  const batches: Passage[][] = [];
  let cur: Passage[] = [];
  let curChars = 0;
  let curDoc = '';
  for (const p of Array.isArray(passages) ? passages : []) {
    if (!p || !p.id) continue;
    const chars = Math.max(0, Number(p.chars) || 0);
    if (cur.length && (String(p.docId) !== curDoc || curChars + chars > cap)) {
      batches.push(cur);
      if (batches.length >= limit) return batches;
      cur = []; curChars = 0;
    }
    cur.push(p);
    curChars += chars;
    curDoc = String(p.docId);
  }
  if (cur.length && batches.length < limit) batches.push(cur);
  return batches;
}
```

- [ ] **Step 4: Run and confirm green**

Expected: **14 passing.**

---

### Task 3: Verdict merge — the whole failure design

**Files:**
- Modify: `source-classify.util.ts`, `source-classify.util.spec.ts`

**Interfaces:**
- Consumes: `Passage`, `Verdict`, `ROLES`, `SUBJECT_KINDS`.
- Produces: `applyVerdicts(passages, verdicts): StoredPassage[]`.

This is the task that decides what ② costs when it goes wrong, so read the ladder before writing the code:

| Failure | Result |
|---|---|
| One batch throws | Its passages are UNCLASSIFIED; every other batch is unaffected |
| **Every** batch throws | Zero passages classified — **the build is byte-for-byte the build it would have been** |
| The model returns ids that do not exist | Ignored |
| The model omits ids it was given | Those passages are UNCLASSIFIED |
| The model returns a role outside the four | That verdict is dropped → UNCLASSIFIED |
| The model returns a subject kind it invented | Degrades to `OTHER`; the passage keeps its role |
| `confidence` missing, NaN, or out of range | Clamped to `[0,1]`, defaulting to `0.5` |

**There is no confidence threshold, deliberately.** No calibration data exists for one, and inventing a cut-off is precisely the mistake §02 of the artifact records. `confidence` is stored, used for ordering and for the "why" text ④ will show, and gated on nowhere. What replaces it is an asymmetry:

> **Quarantine is inclusive. Canon is exclusive.**
> A passage tagged REFERENCE at *any* confidence is quarantined — the cost of over-quarantining is one paragraph the writer never sees; the cost of under-quarantining has already shipped once.

- [ ] **Step 1: Write the failing test**

Append to `source-classify.util.spec.ts`, adding `applyVerdicts` to the import block:

```ts
// ---------------------------------------------------------------------------------------------
// Verdict merge — the failure design
// ---------------------------------------------------------------------------------------------

const P: Passage[] = mkPassages('0', 3, 100);

test('a verdict lands on its passage, normalised', () => {
  const out = applyVerdicts(P, [{ id: '0#1', role: 'canon', subjects: [{ name: 'Elena Cross', kind: 'character' }], confidence: 0.8 }]);
  assert.equal(out[1].role, 'CANON');
  assert.deepEqual(out[1].subjects, [{ name: 'Elena Cross', kind: 'CHARACTER' }]);
  assert.equal(out[1].confidence, 0.8);
});

test('a passage the model did not answer for is UNCLASSIFIED, which behaves exactly as today', () => {
  const out = applyVerdicts(P, [{ id: '0#0', role: 'CANON', subjects: [], confidence: 1 }]);
  assert.equal(out[1].role, 'UNCLASSIFIED');
  assert.equal(out[2].role, 'UNCLASSIFIED');
  assert.deepEqual(out[2].subjects, []);
});

test('a role outside the four is refused rather than trusted', () => {
  const out = applyVerdicts(P, [{ id: '0#0', role: 'CANONICAL', subjects: [], confidence: 1 }]);
  assert.equal(out[0].role, 'UNCLASSIFIED');
});

test('ids the model invented are ignored', () => {
  const out = applyVerdicts(P, [{ id: '9#9', role: 'CANON', subjects: [], confidence: 1 }]);
  assert.equal(out.length, 3);
  for (const p of out) assert.equal(p.role, 'UNCLASSIFIED');
});

test('a subject kind the model made up degrades to OTHER; duplicates collapse', () => {
  const out = applyVerdicts(P, [{ id: '0#0', role: 'CANON', confidence: 0.5, subjects: [{ name: 'Silo', kind: 'LOCATION' }, { name: 'silo', kind: 'PLACE' }] }]);
  assert.deepEqual(out[0].subjects, [{ name: 'Silo', kind: 'OTHER' }]);
});

test('confidence is clamped and a missing one does not become NaN', () => {
  const out = applyVerdicts(P, [
    { id: '0#0', role: 'CANON', subjects: [], confidence: 5 },
    { id: '0#1', role: 'CANON', subjects: [], confidence: -2 },
    { id: '0#2', role: 'CANON', subjects: [] },
  ]);
  assert.equal(out[0].confidence, 1);
  assert.equal(out[1].confidence, 0);
  assert.equal(out[2].confidence, 0.5);
});

test('THE WHOLE FAILURE DESIGN: no verdicts at all leaves every passage exactly as it started', () => {
  for (const junk of [null, undefined, [], 'nonsense', {}, [null], [{}]]) {
    const out = applyVerdicts(P, junk as any);
    assert.equal(out.length, 3);
    for (const p of out) { assert.equal(p.role, 'UNCLASSIFIED'); assert.equal(p.confidence, 0); }
  }
});
```

- [ ] **Step 2: Run and confirm failure**

Expected: FAIL — `applyVerdicts is not a function`.

- [ ] **Step 3: Add it to the module**

Append to `source-classify.util.ts`:

```ts
// ---------------------------------------------------------------------------------------------
// Verdict merge — the whole failure design lives here
// ---------------------------------------------------------------------------------------------

/**
 * Merge model verdicts onto passages. Anything the model did not answer for, or answered badly, is
 * UNCLASSIFIED — which behaves exactly as the material behaves today.
 *
 * So: one batch throwing costs that batch. Every batch throwing costs nothing at all — the build is
 * byte-for-byte the build it would have been without this module. Classification can never make a
 * draft worse than the draft it replaces, which is the same doctrine that governs every check in
 * this system: a check that reports nine defects in a clean draft is worse than no check.
 */
export function applyVerdicts(
  passages: Passage[] | null | undefined,
  verdicts: any,
): StoredPassage[] {
  const byId = new Map<string, Verdict>();
  for (const v of Array.isArray(verdicts) ? verdicts : []) {
    if (!v) continue;
    const id = String(v.id == null ? '' : v.id).trim();
    if (!id) continue;
    const role = String(v.role || '').trim().toUpperCase();
    if (ROLES.indexOf(role as Role) < 0) continue;
    const subjects: Subject[] = [];
    const seen = new Set<string>();
    for (const s of Array.isArray(v.subjects) ? v.subjects : []) {
      const name = String((s && typeof s === 'object' ? s.name : s) || '').trim().slice(0, 80);
      if (!name) continue;
      const key = name.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const kind = String((s && typeof s === 'object' && s.kind) || '').trim().toUpperCase();
      subjects.push({ name, kind: (SUBJECT_KINDS.indexOf(kind as SubjectKind) >= 0 ? kind : 'OTHER') as SubjectKind });
      if (subjects.length >= 12) break;
    }
    let confidence = Number(v.confidence);
    if (!isFinite(confidence)) confidence = 0.5;
    confidence = Math.max(0, Math.min(1, confidence));
    byId.set(id, { id, role: role as Role, subjects, confidence });
  }
  const out: StoredPassage[] = [];
  for (const p of Array.isArray(passages) ? passages : []) {
    if (!p || !p.id) continue;
    const v = byId.get(String(p.id));
    out.push(v
      ? { ...p, role: v.role as StoredRole, subjects: v.subjects, confidence: v.confidence }
      : { ...p, role: 'UNCLASSIFIED', subjects: [], confidence: 0 });
  }
  return out;
}
```

- [ ] **Step 4: Run and confirm green**

Expected: **21 passing.**

---

### Task 4: THE QUARANTINE and the distiller — the task that matters

**Files:**
- Modify: `source-classify.util.ts`, `source-classify.util.spec.ts`

**Interfaces:**
- Consumes: `StoredPassage`, `SourceDoc`, `normaliseForCompare`, `jaccard`, `trimToSentence`.
- Produces: `quarantinedDocs`, `passageBody`, `buildSourceBible`, `residualPaste`, `canReuseClassification`.

**Write the tests first and confirm they fail. This is not a formality here.** Two pages of THE TRUMAN SHOW shipped inside scene 32 of a delivered draft. A quarantine test that passes against an unbuilt quarantine is worse than no test, because it retires the concern without discharging it.

Three mechanisms, independent by design:

1. **Document plurality wins over any single passage's tag.** A comp screenplay is a reference cover to cover; one stray CANON tag on its page 40 must not open a door. Ties resolve to REFERENCE — the safe direction.
2. **`passageBody` is the single body-fetch function**, and it refuses on two separate grounds: the passage's own REFERENCE tag, and its document's quarantine.
3. **The REFERENCE LEDGER is built from document metadata only.** There is no code path inside `buildSourceBible` that reads a quarantined body — not a filtered one, not a truncated one. The leak is impossible rather than prevented.

The distiller is **deterministic**: same inputs, same string, every time. That is what makes it snapshot-testable, and it is why a change to the bible shows up as a test diff instead of as a mysteriously different script.

#### `residualPaste`, and the leak that made it necessary

The spec (§2.1) claimed the `paste` document's overlap with the source records was *"deliberate and harmless"*. **It was wrong, and the fix belongs in this task.**

After ①, `intake.sourceText` is the whole assembled corpus — the main paste box **plus every file and URL**. Treating that aggregate as its own document puts a copy of every comp screenplay inside a document whose plurality is decided by the mixed corpus around it. So the comp is quarantined under its own file name and readable under `paste`. Demonstrated, not theorised:

```
quarantined docs: [ '1' ]                        ← truman-show.pdf correctly quarantined
canonText contains "Seahaven": true              ← and its text reached canon anyway
```

`residualPaste` makes the paste document the **residue**: the aggregate with each source's own text removed once, longest first. If any source's text survives the removal — a shape `assembleCorpus` should never produce — the residue is refused entirely rather than trusted. Losing the main paste box costs one UNCLASSIFIED document, which is the defined safe state.

- [ ] **Step 1: Write the failing tests**

Append to `source-classify.util.spec.ts`. The import block at the top of the file is now, in full:

```ts
import {
  segmentPassages, batchPassages, applyVerdicts, quarantinedDocs, passageBody,
  buildSourceBible, canReuseClassification, residualPaste,
  PASSAGE_TARGET_CHARS, PASSAGE_MAX_CHARS, CLASSIFY_BATCH_CHARS, MAX_CLASSIFY_BATCHES,
  SourceDoc, Passage, StoredPassage,
} from './source-classify.util';
```

Then the tests:

```ts
// ---------------------------------------------------------------------------------------------
// THE QUARANTINE
// ---------------------------------------------------------------------------------------------

const TRUMAN = 'Truman walks the perfect street of Seahaven, waving at neighbours who are paid to wave back at him.';
const CANON_BODY = 'Elena Cross walks the long corridor of the silo, nodding at technicians who are paid to nod back at her.';

const QDOCS: SourceDoc[] = [
  { id: '0', name: 'treatment.pdf', text: CANON_BODY },
  { id: '1', name: 'truman-show.pdf', text: TRUMAN + '\n\n' + TRUMAN.replace('Truman', 'He') + '\n\n' + TRUMAN.replace('Truman', 'The man') },
];

const qPassages = (): StoredPassage[] => {
  const segs = segmentPassages(QDOCS, 10, 400);
  return segs.map((p) => ({
    ...p,
    // Document 1 is a comp screenplay: two REFERENCE and ONE STRAY CANON, the exact shape that
    // shipped. Document 0 is the real treatment.
    role: (p.docId === '0' ? 'CANON' : (p.id === '1#1' ? 'CANON' : 'REFERENCE')) as any,
    subjects: [{ name: p.docId === '0' ? 'ELENA CROSS' : 'TRUMAN', kind: 'CHARACTER' as any }],
    confidence: 0.9,
  }));
};

/** Every 8-word window of `body`, normalised — the unit a plagiarism check actually cares about. */
const windows8 = (body: string): string[] => {
  const w = body.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + 8 <= w.length; i++) out.push(w.slice(i, i + 8).join(' '));
  return out;
};

test('THE QUARANTINE: no eight-word run of a reference body can appear anywhere in the bible', () => {
  const bible = buildSourceBible(QDOCS, qPassages());
  const haystack = [bible.brief, bible.full, bible.canonText, bible.instructions.join(' '),
    JSON.stringify(bible.research), JSON.stringify(bible.references)]
    .join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
  const runs = windows8(TRUMAN);
  assert.ok(runs.length >= 5, 'the fixture must be long enough to test');
  for (const run of runs) assert.ok(!haystack.includes(run), 'REFERENCE text leaked into the bible: ' + run);
});

test('THE QUARANTINE: a stray CANON tag inside a reference document leaks nothing', () => {
  const stored = qPassages();
  assert.ok(stored.some((p) => p.docId === '1' && p.role === 'CANON'), 'the fixture must contain the stray tag');
  const q = quarantinedDocs(stored);
  assert.ok(q.has('1'), 'the comp screenplay must be quarantined by plurality');
  assert.ok(!q.has('0'), 'the treatment must NOT be quarantined');
  const stray = stored.find((p) => p.docId === '1' && p.role === 'CANON') as StoredPassage;
  assert.equal(passageBody(QDOCS, stray, q), '', 'the stray CANON passage must still be unreadable');
  const bible = buildSourceBible(QDOCS, stored);
  assert.ok(!bible.canonText.toLowerCase().includes('seahaven'));
  assert.ok(bible.canonText.includes('Elena Cross'), 'real canon must survive the quarantine');
});

test('THE QUARANTINE: the ledger names the reference document without quoting a word of it', () => {
  const bible = buildSourceBible(QDOCS, qPassages());
  assert.deepEqual(bible.references, [{ doc: 'truman-show.pdf', why: 'cited as a reference; its text is never used' }]);
  assert.ok(bible.full.includes('truman-show.pdf'));
  assert.ok(!bible.full.toLowerCase().includes('seahaven'));
});

test('passageBody refuses a REFERENCE passage even in a document that is not quarantined', () => {
  const docs: SourceDoc[] = [{ id: '0', name: 'mixed.txt', text: 'Alpha body.\n\nBeta body.' }];
  const p = { docId: '0', start: 0, end: 11, role: 'REFERENCE' };
  assert.equal(passageBody(docs, p), '');
  assert.equal(passageBody(docs, { ...p, role: 'CANON' }), 'Alpha body.');
});

test('passageBody is fail-safe against junk offsets and missing documents', () => {
  const docs: SourceDoc[] = [{ id: '0', name: 'a.txt', text: 'Alpha body.' }];
  assert.equal(passageBody(docs, null), '');
  assert.equal(passageBody(null, { docId: '0', start: 0, end: 5, role: 'CANON' }), '');
  assert.equal(passageBody(docs, { docId: '9', start: 0, end: 5, role: 'CANON' }), '');
  assert.equal(passageBody(docs, { docId: '0', start: -50, end: 9999, role: 'CANON' }), 'Alpha body.');
  assert.equal(passageBody(docs, { docId: '0', start: 8, end: 2, role: 'CANON' }), '');
});

test('a tie between roles inside one document resolves to REFERENCE, the safe direction', () => {
  const stored: StoredPassage[] = [
    { id: '0#0', docId: '0', start: 0, end: 5, chars: 5, role: 'CANON', subjects: [], confidence: 1 },
    { id: '0#1', docId: '0', start: 5, end: 10, chars: 5, role: 'REFERENCE', subjects: [], confidence: 1 },
  ];
  assert.ok(quarantinedDocs(stored).has('0'));
});

test('UNCLASSIFIED passages never decide a document\'s plurality', () => {
  const stored: StoredPassage[] = [
    { id: '0#0', docId: '0', start: 0, end: 5, chars: 5, role: 'UNCLASSIFIED', subjects: [], confidence: 0 },
    { id: '0#1', docId: '0', start: 5, end: 10, chars: 5, role: 'UNCLASSIFIED', subjects: [], confidence: 0 },
    { id: '0#2', docId: '0', start: 10, end: 15, chars: 5, role: 'REFERENCE', subjects: [], confidence: 1 },
  ];
  assert.ok(quarantinedDocs(stored).has('0'));
  assert.deepEqual(Array.from(quarantinedDocs([])), []);
});

// ---------------------------------------------------------------------------------------------
// The distiller
// ---------------------------------------------------------------------------------------------

const BDOCS: SourceDoc[] = [
  { id: 'paste', name: 'Pasted text', text: 'Make the ending ambiguous.' },
  { id: '0', name: 'treatment.pdf', text: 'Elena Cross has run Echo-01 for eleven years.\n\nThe capsule sits sixty feet under Montana wheat.' },
  { id: '1', name: 'minuteman-history.pdf', text: 'The LGM-30G entered service in 1970.\n\nEach wing held fifty flights of ten silos.' },
  { id: '2', name: 'notes.txt', text: 'Make the ending ambiguous.' },
];

const bStored = (): StoredPassage[] => {
  const segs = segmentPassages(BDOCS, 10, 400);
  return segs.map((p) => {
    if (p.docId === 'paste' || p.docId === '2') return { ...p, role: 'INSTRUCTION' as any, subjects: [], confidence: 0.9 };
    if (p.docId === '0') return { ...p, role: 'CANON' as any, confidence: 0.9, subjects: [p.id === '0#0' ? { name: 'Elena Cross', kind: 'CHARACTER' as any } : { name: 'Echo-01', kind: 'PLACE' as any }] };
    return { ...p, role: 'RESEARCH' as any, confidence: 0.7, subjects: [{ name: 'Minuteman III', kind: 'EVENT' as any }] };
  });
};

test('the distiller is deterministic — the same inputs give byte-identical output', () => {
  const a = buildSourceBible(BDOCS, bStored());
  const b = buildSourceBible(BDOCS, bStored());
  assert.equal(a.full, b.full);
  assert.equal(a.brief, b.brief);
  assert.equal(a.canonText, b.canonText);
});

test('the instruction block is verbatim and deduplicated across the paste overlap', () => {
  const bible = buildSourceBible(BDOCS, bStored());
  assert.deepEqual(bible.instructions, ['Make the ending ambiguous.']);
  assert.equal((bible.full.match(/Make the ending ambiguous\./g) || []).length, 1);
});

test('the research index carries the subject and its documents, never the body', () => {
  const bible = buildSourceBible(BDOCS, bStored());
  assert.deepEqual(bible.research, [{ subject: 'MINUTEMAN III', passages: 2, docs: ['minuteman-history.pdf'] }]);
  assert.ok(bible.full.includes('MINUTEMAN III'));
  assert.ok(!bible.full.includes('LGM-30G'), 'a research BODY must not reach the bible');
});

test('canonText carries the canon bodies and nothing else', () => {
  const bible = buildSourceBible(BDOCS, bStored());
  assert.ok(bible.canonText.includes('Elena Cross has run Echo-01'));
  assert.ok(bible.canonText.includes('sixty feet under Montana wheat'));
  assert.ok(!bible.canonText.includes('LGM-30G'));
  assert.ok(!bible.canonText.includes('Make the ending ambiguous'));
});

test('canon subjects are bucketed by kind and carry a first sentence, not a paraphrase', () => {
  const bible = buildSourceBible(BDOCS, bStored());
  assert.ok(/CHARACTERS\n· ELENA CROSS — Elena Cross has run Echo-01 for eleven years\./.test(bible.full));
  assert.ok(/PLACES\n· ECHO-01 — The capsule sits sixty feet under Montana wheat\./.test(bible.full));
});

test('the brief rides on every scene prompt, so it is bounded and instructions come first', () => {
  const bible = buildSourceBible(BDOCS, bStored(), 300);
  assert.ok(bible.brief.length <= 300, 'brief was ' + bible.brief.length);
  assert.ok(bible.brief.indexOf('INSTRUCTION BLOCK') === 0);
  assert.ok(bible.brief.includes('Make the ending ambiguous.'));
});

test('counts report the EFFECTIVE roles, after quarantine escalation', () => {
  const bible = buildSourceBible(QDOCS, qPassages());
  assert.equal(bible.counts.REFERENCE, 3, 'the stray CANON must be counted as REFERENCE');
  assert.equal(bible.counts.CANON, 1);
});

test('an unclassified corpus produces an empty bible and blocks nothing', () => {
  const plain = applyVerdicts(segmentPassages(BDOCS), null);
  const bible = buildSourceBible(BDOCS, plain);
  assert.equal(bible.full, '');
  assert.equal(bible.brief, '');
  assert.equal(bible.canonText, '');
  assert.deepEqual(bible.instructions, []);
  assert.deepEqual(bible.references, []);
  assert.ok(bible.counts.UNCLASSIFIED > 0);
});

test('buildSourceBible is fail-safe on every junk shape', () => {
  for (const [d, p] of [[null, null], [[], []], [BDOCS, null], [null, bStored()]] as any[]) {
    const b = buildSourceBible(d, p);
    assert.equal(typeof b.full, 'string');
    assert.ok(Array.isArray(b.instructions));
  }
});

// ---------------------------------------------------------------------------------------------
// Reuse
// ---------------------------------------------------------------------------------------------

test('a classification is reused only when the source text is byte-identical', () => {
  const prev = { text: 'Body.', passages: [{ id: '0#0' }] };
  assert.equal(canReuseClassification({ text: 'Body.' }, prev), true);
  assert.equal(canReuseClassification({ text: 'Body!' }, prev), false);
  assert.equal(canReuseClassification({ text: '' }, prev), false);
  assert.equal(canReuseClassification({ text: 'Body.' }, { text: 'Body.', passages: [] }), false);
  assert.equal(canReuseClassification({ text: 'Body.' }, null), false);
  assert.equal(canReuseClassification(null, prev), false);
});

test('THE AGGREGATE LEAK: the paste document is the residue, not the whole corpus', () => {
  // After (1), sourceText is the assembled corpus — main box PLUS every source. Treating that as its
  // own document puts a copy of every comp screenplay inside a document the plurality rule will not
  // quarantine. The residue is the main box alone.
  const treatment = 'Elena Cross has run Echo-01 for eleven years.';
  const truman = 'Truman walks the perfect street of Seahaven.';
  const mainBox = 'A thriller set in a decommissioned silo.';
  const aggregate = [mainBox, treatment, truman].join('\n\n');
  const sources = [{ text: treatment }, { text: truman }];
  assert.equal(residualPaste(aggregate, sources), mainBox);
});

test('THE AGGREGATE LEAK: with the residue as the paste document, a quarantined body cannot reach canon', () => {
  const treatment = 'Elena Cross has run Echo-01 for eleven years.';
  const truman = 'Truman walks the perfect street of Seahaven, waving at neighbours paid to wave back.';
  const aggregate = [treatment, truman].join('\n\n');
  const sources = [{ text: treatment }, { text: truman }];
  const residue = residualPaste(aggregate, sources);
  assert.equal(residue, '', 'nothing is left once both sources are accounted for');
  const docs: SourceDoc[] = [
    { id: '0', name: 'treatment.pdf', text: treatment },
    { id: '1', name: 'truman-show.pdf', text: truman },
  ];
  const segs = segmentPassages(docs, 10, 400);
  const stored = applyVerdicts(segs, segs.map((p) => ({
    id: p.id, role: p.docId === '1' ? 'REFERENCE' : 'CANON', subjects: [], confidence: 0.9,
  })));
  const bible = buildSourceBible(docs, stored);
  assert.ok(!bible.canonText.includes('Seahaven'), 'the comp screenplay must not reach canon');
  assert.ok(bible.canonText.includes('Elena Cross'));
});

test('residualPaste refuses the residue rather than trust it when a source text survives removal', () => {
  // A shape assembleCorpus should never produce. Losing the main box is safe; keeping a reference is not.
  assert.equal(residualPaste('Body. Body.', [{ text: 'Body.' }]), '');
  assert.equal(residualPaste('Standalone note.', []), 'Standalone note.');
  assert.equal(residualPaste('', [{ text: 'x' }]), '');
  assert.equal(residualPaste(null, null), '');
});

test('residualPaste removes the longest source first so nested texts do not strand a remainder', () => {
  const long = 'The capsule sits sixty feet under Montana wheat.';
  const short = 'Montana';
  assert.equal(residualPaste(['Main box.', long].join('\n\n'), [{ text: short }, { text: long }]), 'Main box.');
});

test('the constants are the ones the spec fixed, not placeholders', () => {
  assert.equal(PASSAGE_TARGET_CHARS, 900);
  assert.equal(PASSAGE_MAX_CHARS, 2400);
  assert.equal(CLASSIFY_BATCH_CHARS, 24000);
  assert.equal(MAX_CLASSIFY_BATCHES, 12);
});
```

- [ ] **Step 2: Run and confirm failure**

Expected: FAIL — `quarantinedDocs is not a function`.

- [ ] **Step 3: Add it to the module**

Append to `source-classify.util.ts`:

```ts
// ---------------------------------------------------------------------------------------------
// The quarantine
// ---------------------------------------------------------------------------------------------

/**
 * Which documents are references, wholesale.
 *
 * A document's plurality role wins over any single passage's own tag. A comp screenplay IS a
 * reference from cover to cover, and one stray CANON tag on its page 40 must not be able to leak two
 * pages of another film into scene 32 — which is the exact shape of the contamination that shipped.
 */
export function quarantinedDocs(passages: StoredPassage[] | null | undefined): Set<string> {
  const tally = new Map<string, Map<string, number>>();
  for (const p of Array.isArray(passages) ? passages : []) {
    if (!p || !p.docId) continue;
    const role = String(p.role || '');
    if (ROLES.indexOf(role as Role) < 0) continue;
    const docId = String(p.docId);
    if (!tally.has(docId)) tally.set(docId, new Map());
    const m = tally.get(docId) as Map<string, number>;
    m.set(role, (m.get(role) || 0) + 1);
  }
  const out = new Set<string>();
  tally.forEach((m, docId) => {
    let best: Role | null = null;
    let bestN = 0;
    for (const role of PLURALITY_ORDER) {
      const n = m.get(role) || 0;
      if (n > bestN) { best = role; bestN = n; }
    }
    if (best === 'REFERENCE') out.add(docId);
  });
  return out;
}

/**
 * THE SINGLE BODY-FETCH FUNCTION. A passage becomes words here and nowhere else.
 *
 * It refuses on two independent grounds — the passage's own REFERENCE tag, and its document's
 * quarantine — so the guarantee is structural. A REFERENCE passage is not deprioritised in a ranking
 * that some future caller could re-sort; it is unreachable.
 */
export function passageBody(
  docs: SourceDoc[] | null | undefined,
  p: { docId?: any; start?: any; end?: any; role?: any } | null | undefined,
  quarantined?: Set<string> | null,
): string {
  if (!p) return '';
  const docId = String(p.docId == null ? '' : p.docId);
  if (!docId) return '';
  if (String(p.role || '') === 'REFERENCE') return '';
  if (quarantined && quarantined.has(docId)) return '';
  let text = '';
  for (const d of Array.isArray(docs) ? docs : []) {
    if (d && String(d.id) === docId) { text = String(d.text || ''); break; }
  }
  if (!text) return '';
  const s = Math.max(0, Math.min(text.length, Math.floor(Number(p.start) || 0)));
  const e = Math.max(s, Math.min(text.length, Math.floor(Number(p.end) || 0)));
  return text.slice(s, e);
}

// ---------------------------------------------------------------------------------------------
// The distiller — deterministic, no second AI call
// ---------------------------------------------------------------------------------------------

function docName(docs: SourceDoc[] | null | undefined, docId: string): string {
  for (const d of Array.isArray(docs) ? docs : []) {
    if (d && String(d.id) === String(docId)) return String(d.name || d.id || docId);
  }
  return String(docId);
}

/** Drop near-identical strings, keeping the first. Doc "paste" overlaps the extra-paste sources. */
function dedupeTexts(list: string[], threshold = DEDUPE_SIMILARITY): string[] {
  const kept: string[] = [];
  const keptTokens: string[][] = [];
  for (const raw of list) {
    const t = String(raw || '').trim();
    if (!t) continue;
    const tokens = normaliseForCompare(t);
    let dup = false;
    for (let i = 0; i < kept.length; i++) {
      if (kept[i] === t) { dup = true; break; }
      if (tokens.length && jaccard(tokens, keptTokens[i]) >= threshold) { dup = true; break; }
    }
    if (dup) continue;
    kept.push(t);
    keptTokens.push(tokens);
  }
  return kept;
}

function capLines(lines: string[], budget: number): string[] {
  const out: string[] = [];
  let used = 0;
  for (const l of lines) {
    const cost = l.length + 1;
    if (used + cost > budget) break;
    out.push(l);
    used += cost;
  }
  return out;
}

/**
 * Build the Source Bible. DETERMINISTIC — same inputs, same string, every time, so it is
 * snapshot-testable and a change to it shows up as a test diff rather than as a mysteriously
 * different script.
 *
 * The REFERENCE LEDGER is assembled from document METADATA ONLY. There is no code path in this
 * function that reads a quarantined body — not a filtered one, not a truncated one. The leak is
 * impossible rather than prevented.
 */
export function buildSourceBible(
  docs: SourceDoc[] | null | undefined,
  passages: StoredPassage[] | null | undefined,
  briefBudget = 1800,
  fullBudget = 12000,
): SourceBible {
  const list = (Array.isArray(passages) ? passages : []).filter((p) => p && p.docId);
  const quarantined = quarantinedDocs(list);
  const counts: Record<string, number> = { CANON: 0, RESEARCH: 0, REFERENCE: 0, INSTRUCTION: 0, UNCLASSIFIED: 0 };

  const canonBodies: string[] = [];
  const instructionBodies: string[] = [];
  const researchBySubject = new Map<string, { subject: string; passages: number; docs: Set<string> }>();
  const canonSubjects = new Map<string, { subject: string; kind: SubjectKind; hits: number; first: number; line: string }>();
  const referenceDocs = new Map<string, string>();

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const own = String(p.role || 'UNCLASSIFIED');
    const eff = quarantined.has(String(p.docId)) ? 'REFERENCE' : own;
    counts[eff] = (counts[eff] || 0) + 1;

    if (eff === 'REFERENCE') {
      const id = String(p.docId);
      if (!referenceDocs.has(id)) referenceDocs.set(id, docName(docs, id));
      continue;
    }
    // Every read below goes through passageBody, which refuses quarantined material on its own.
    const body = passageBody(docs, p, quarantined);
    if (!body.trim()) continue;

    if (eff === 'CANON') {
      canonBodies.push(body.trim());
      for (const s of p.subjects || []) {
        const key = String(s.name || '').trim().toUpperCase();
        if (!key) continue;
        const prev = canonSubjects.get(key);
        if (prev) prev.hits++;
        else canonSubjects.set(key, { subject: key, kind: s.kind || 'OTHER', hits: 1, first: i, line: trimToSentence(body, 160) });
      }
    } else if (eff === 'INSTRUCTION') {
      instructionBodies.push(body.trim());
    } else if (eff === 'RESEARCH') {
      for (const s of p.subjects || []) {
        const key = String(s.name || '').trim().toUpperCase();
        if (!key) continue;
        const prev = researchBySubject.get(key);
        if (prev) { prev.passages++; prev.docs.add(docName(docs, String(p.docId))); }
        else researchBySubject.set(key, { subject: key, passages: 1, docs: new Set([docName(docs, String(p.docId))]) });
      }
    }
  }

  const instructions = dedupeTexts(instructionBodies);
  const canonText = dedupeTexts(canonBodies).join('\n\n');

  const research = Array.from(researchBySubject.values())
    .sort((a, b) => (b.passages - a.passages) || a.subject.localeCompare(b.subject))
    .map((r) => ({ subject: r.subject, passages: r.passages, docs: Array.from(r.docs).sort() }));

  const references = Array.from(referenceDocs.entries())
    .map(([, name]) => ({ doc: name, why: 'cited as a reference; its text is never used' }))
    .sort((a, b) => a.doc.localeCompare(b.doc));

  const subjectsRanked = Array.from(canonSubjects.values())
    .sort((a, b) => (b.hits - a.hits) || (a.first - b.first) || a.subject.localeCompare(b.subject))
    .slice(0, 40);

  const canonLines: string[] = [];
  for (const kind of SUBJECT_KINDS) {
    const inKind = subjectsRanked.filter((s) => s.kind === kind);
    if (!inKind.length) continue;
    canonLines.push(kind + 'S');
    for (const s of inKind) canonLines.push('· ' + s.subject + ' — ' + s.line);
  }
  const instructionLines = instructions.map((t) => '· ' + t.replace(/\s+/g, ' ').trim());
  const researchLines = research.map((r) => '· ' + r.subject + ' — ' + r.passages + ' passage' + (r.passages === 1 ? '' : 's') + ' · ' + r.docs.join(', '));
  const referenceLines = references.map((r) => '· ' + r.doc + ' — ' + r.why);

  const section = (title: string, lines: string[]) => (lines.length ? [title, ...lines, ''] : []);

  const fullParts: string[] = ([] as string[])
    .concat(section('CANON BIBLE', canonLines))
    .concat(section('INSTRUCTION BLOCK', instructionLines))
    .concat(section('RESEARCH INDEX', researchLines))
    .concat(section('REFERENCE LEDGER', referenceLines));
  const full = capLines(fullParts, Math.max(0, Number(fullBudget) || 0)).join('\n').trim();

  // The brief rides on EVERY scene prompt beside buildFeatureCtx's existing slices, so instructions
  // come first and take their budget before canon subjects: a rule the writer breaks is worse than a
  // name the writer had to be reminded of by the canon block instead.
  const instructionBudget = Math.min(Math.floor(briefBudget * 0.45), instructionLines.reduce((n, l) => n + l.length + 1, 0));
  const briefInstr = capLines(instructionLines, instructionBudget);
  const briefCanon = capLines(canonLines, Math.max(0, briefBudget - briefInstr.reduce((n, l) => n + l.length + 1, 0) - 40));
  const brief = ([] as string[])
    .concat(section('INSTRUCTION BLOCK', briefInstr))
    .concat(section('CANON BIBLE', briefCanon))
    .join('\n').trim();

  return { brief, full, canonText, instructions, research, references, counts };
}

/**
 * The part of the assembled corpus that no source record accounts for — the main paste box.
 *
 * THIS FUNCTION EXISTS TO CLOSE A LEAK, and the leak is worth stating because it is not obvious.
 * After (1), `intake.sourceText` is the WHOLE corpus: the main paste box plus every file and URL,
 * joined by assembleCorpus. Treating that aggregate as its own document puts a copy of every comp
 * screenplay inside a document whose plurality is decided by the mixed corpus around it — so the
 * comp is quarantined under its own file name and readable under `paste`. Demonstrated: with
 * truman-show.pdf correctly quarantined, its text still reached canonText through the aggregate.
 *
 * So the paste document is the RESIDUE: the aggregate with each source's own text removed once. If
 * any source's text survives the removal — a shape assembleCorpus should never produce — the residue
 * is refused entirely rather than trusted. Losing the main paste box from classification costs one
 * UNCLASSIFIED document, which is the defined safe state; keeping a reference in it costs a lawsuit.
 */
export function residualPaste(sourceText: any, sources: Array<{ text?: any }> | null | undefined): string {
  let rest = String(sourceText == null ? '' : sourceText);
  if (!rest.trim()) return '';
  const texts: string[] = [];
  for (const s of Array.isArray(sources) ? sources : []) {
    const t = String((s && s.text) || '').trim();
    if (t) texts.push(t);
  }
  // Longest first: a short source whose text is a substring of a longer one must not consume the
  // longer one's occurrence and leave the remainder stranded in the residue.
  texts.sort((a, b) => b.length - a.length);
  for (const t of texts) {
    const i = rest.indexOf(t);
    if (i >= 0) rest = rest.slice(0, i) + rest.slice(i + t.length);
  }
  rest = rest.trim();
  if (!rest) return '';
  for (const t of texts) if (rest.indexOf(t) >= 0) return '';
  return rest;
}

/** Reuse a stored classification only when the source's TEXT is byte-identical. */
export function canReuseClassification(
  incoming: { text?: any } | null | undefined,
  previous: { text?: any; passages?: any } | null | undefined,
): boolean {
  if (!incoming || !previous) return false;
  if (!Array.isArray(previous.passages) || !previous.passages.length) return false;
  const cur = String(incoming.text == null ? '' : incoming.text);
  if (!cur.trim()) return false;
  return cur === String(previous.text == null ? '' : previous.text);
}
```

- [ ] **Step 4: Run and confirm green**

Expected: **42 passing.**

- [ ] **Step 5: PROVE THE QUARANTINE BINDS — break it deliberately, three times**

A test that passes with the feature deleted is not a test. ①'s PDF happy-path test passed with the whole PDF branch removed. Do not skip this step.

**Break 1** — disable the plurality escalation. In `quarantinedDocs`, change:

```ts
    if (best === 'REFERENCE') out.add(docId);
```

to:

```ts
    if (false && best === 'REFERENCE') out.add(docId);
```

Expected: **6 failures**, including `THE QUARANTINE: no eight-word run of a reference body can appear anywhere in the bible`. Restore the line.

**Break 2** — disable both refusals inside `passageBody`. Comment out these two lines:

```ts
  if (String(p.role || '') === 'REFERENCE') return '';
  if (quarantined && quarantined.has(docId)) return '';
```

Expected: **2 failures** — `a stray CANON tag inside a reference document leaks nothing` and `passageBody refuses a REFERENCE passage even in a document that is not quarantined`. Restore the lines.

**Break 3** — remove `residualPaste`'s survivor check. Delete this line:

```ts
  for (const t of texts) if (rest.indexOf(t) >= 0) return '';
```

Expected: **1 failure** — `residualPaste refuses the residue rather than trust it when a source text survives removal`. Restore it.

**Read the difference between the breaks — it is the point of the design.** Break 2 does *not* fail the eight-word-run test, because `buildSourceBible` skips quarantined passages before it ever calls `passageBody`. Three independent mechanisms guard the same thing, and each break reaches only the tests belonging to its own mechanism. If a break ever fails *nothing*, that mechanism is decorative and must be removed or given a test.

- [ ] **Step 6: Typecheck under the project's own strictness**

```
npx tsc --noEmit --target ES2021 --module commonjs --experimentalDecorators --skipLibCheck --strict src/production/scripton/source-classify.util.ts
```

Expected: only `TS2307` (module resolution on a single-file check). Any `TS1xxx` or type error is real.

---

### Task 5: Wire it in — one AI pass, an in-memory cache, and a log line that uses nothing

**Files:**
- Modify: `backend/src/production/scripton/scripton.service.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4, plus the existing `this.ai.json(...)` helper and `this.prisma.intakeProfile`.
- Produces: `sourceDocsFrom`, `classifyBatch`, `sourceBibleFor`, and one report-only call inside `extractCanon`.

**Nothing in a generated script changes.** `sourceBibleFor` runs, logs, caches, and returns a bible no consumer reads. ③ flips the consumers over, and only after a real build's log shows the roles are right.

- [ ] **Step 1: Add the import**

At the top of `scripton.service.ts`, beside the existing `source-ingest.util` import:

```ts
import {
  segmentPassages, batchPassages, applyVerdicts, buildSourceBible, passageBody, residualPaste,
  SourceDoc, Passage, SourceBible,
} from './source-classify.util';
```

- [ ] **Step 2: Add the four members**

Add to the `ScripOnService` class, beside `materialiseSources`:

```ts
  /**
   * The per-build Source Bible cache. In-memory and per-process, deliberately: a build needs the
   * bible two or three times, and a restart mid-build is already a bigger problem than a lost
   * cache — the same reasoning `genProgress` runs on. Nothing is persisted in ②; ④ adds that when
   * the Brief page needs the evidence across a page load.
   */
  private readonly sourceBibles = new Map<string, { key: string; bible: SourceBible }>();

  /**
   * A cheap fingerprint of the corpus. Not a hash for security — a cache key that changes when the
   * material changes. Sampling every 97th character plus the total length is enough to catch an
   * edit, and costs nothing on a 300 KB corpus.
   */
  private static corpusKey(docs: SourceDoc[]): string {
    let h = 5381;
    let n = 0;
    for (const d of docs) {
      const t = String(d.text || '');
      n += t.length;
      for (let i = 0; i < t.length; i += 97) h = (((h << 5) + h) ^ t.charCodeAt(i)) >>> 0;
    }
    return docs.length + ':' + n + ':' + h.toString(36);
  }

  /**
   * The documents a build has, in a stable order.
   *
   * `paste` is the assembled corpus on `sourceText`, which after ① already contains the main paste
   * box AND every source's text. It therefore OVERLAPS the extra-paste-box source records. That is
   * deliberate and harmless: the overlapping passages classify identically and the distiller
   * deduplicates them. The clean fix — the intake form sending the main box as its own `kind:'paste'`
   * source instead of pre-merging (`ScriptOnIntake.tsx:253`) — belongs to (4), where that form is
   * already being changed. (2) must not need a frontend release to ship.
   */
  private sourceDocsFrom(intake: any): SourceDoc[] {
    const docs: SourceDoc[] = [];
    const sources: any[] = Array.isArray(intake && intake.sources) ? intake.sources : [];
    const pasted = residualPaste(intake && intake.sourceText, sources);
    if (pasted.trim()) docs.push({ id: 'paste', name: 'Pasted text', text: pasted });
    for (let i = 0; i < sources.length; i++) {
      const s: any = sources[i] || {};
      const text = String(s.text || '');
      if (!text.trim()) continue;
      docs.push({ id: String(i), name: String(s.name || s.kind || ('source ' + (i + 1))), text });
    }
    return docs;
  }

  /**
   * One classification call for one batch of passages from ONE document.
   *
   * The pass returns a role, subjects and a number. It does NOT summarise, rewrite or extract facts,
   * and nothing it emits is ever shown to a writer — which is why a hallucination here degrades into
   * a mis-sorted paragraph instead of contaminated prose.
   */
  private async classifyBatch(projectId: string, docs: SourceDoc[], batch: Passage[]): Promise<any[]> {
    if (!batch.length) return [];
    const docId = String(batch[0].docId);
    let name = docId;
    for (const d of docs) if (d.id === docId) { name = d.name; break; }
    const sys = 'You are sorting a filmmaker\'s submitted material before a screenplay is written from it.'
      + ' For EACH passage return exactly one role. Return ONLY JSON {passages:[{id,role,subjects,confidence}]}.'
      + '\nCANON - the story itself: treatment, outline, acts, plot, characters, relationships, setting,'
      + ' world rules, existing script pages. The film is MADE of this.'
      + '\nRESEARCH - factual or historical information about the real world. It informs the film; it is'
      + ' not the film.'
      + '\nREFERENCE - another work cited as a comparison or an example: a comp title, a scene from'
      + ' another film, "make it feel like X". Its text will never be used.'
      + '\nINSTRUCTION - a COMMAND ABOUT THE SCRIPT rather than material in it: "make the ending'
      + ' ambiguous", "keep it under twenty speaking roles", "no drone shots, we cannot afford them".'
      + ' If a passage tells the writer what to DO, it is INSTRUCTION and never CANON.'
      + '\nsubjects = up to 6 proper nouns or topic keys, each {name, kind} with kind one of'
      + ' CHARACTER|PLACE|RULE|EVENT|OTHER. confidence = 0..1.'
      + ' Do NOT summarise, rewrite or quote the passages. Return every id you were given, and no others.';
    // No quarantine is passed: nothing has a role yet, so nothing can be quarantined yet. This is the
    // one place passageBody is called on an unclassified passage, and it is correct here.
    const user = 'DOCUMENT: ' + name + '\n\n'
      + batch.map((p) => '[' + p.id + ']\n' + passageBody(docs, p)).join('\n\n');
    const r: any = await this.ai.json({
      task: 'scripton.source.classify', system: sys, user,
      maxTokens: 2000, timeoutMs: 90000, projectId, refType: 'Project', refId: projectId,
    });
    return Array.isArray(r && r.passages) ? r.passages : [];
  }

  /**
   * Classify this build's material and distil the Source Bible.
   *
   * REPORT-ONLY in (2): the result is logged and cached, and no consumer reads it until (3). Until a
   * real build's log shows the roles are right on real material, none should - a classifier that
   * called your treatment a reference would be strictly worse than no classifier.
   *
   * FAIL-OPEN at every level. One batch failing costs that batch; all of them failing costs nothing
   * at all, because an unclassified corpus behaves exactly as it does today.
   */
  private async sourceBibleFor(projectId: string): Promise<SourceBible | null> {
    if (!projectId) return null;
    try {
      const intake: any = await (this.prisma as any).intakeProfile
        .findUnique({ where: { projectId }, select: { sourceText: true, sources: true } })
        .catch(() => null);
      const docs = this.sourceDocsFrom(intake);
      if (!docs.length) return null;

      const key = ScripOnService.corpusKey(docs);
      const hit = this.sourceBibles.get(projectId);
      if (hit && hit.key === key) return hit.bible;

      const passages = segmentPassages(docs);
      const batches = batchPassages(passages);
      const verdicts: any[] = [];
      let failed = 0;
      for (const batch of batches) {
        try {
          const one = await this.classifyBatch(projectId, docs, batch);
          for (const v of one) verdicts.push(v);
        } catch (e) {
          failed++;
          this.log.warn('classify: a batch failed; its passages stay unclassified - ' + this.why(e));
        }
      }
      const stored = applyVerdicts(passages, verdicts);
      const bible = buildSourceBible(docs, stored);
      this.log.log('sourceBible: ' + docs.length + ' doc(s), ' + passages.length + ' passage(s), '
        + batches.length + ' call(s)' + (failed ? ' (' + failed + ' failed)' : '') + ' - '
        + Object.keys(bible.counts).map((k) => k.toLowerCase() + ' ' + bible.counts[k]).join(' | ')
        + (bible.references.length ? ' - QUARANTINED: ' + bible.references.map((r) => r.doc).join(', ') : '')
        + (bible.instructions.length ? ' - ' + bible.instructions.length + ' instruction(s)' : ''));
      this.sourceBibles.set(projectId, { key, bible });
      return bible;
    } catch (e) {
      this.log.warn('sourceBible: failed - continuing with the corpus unclassified. ' + this.why(e));
      return null;
    }
  }

```

- [ ] **Step 3: Make the one report-only call**

In `extractCanon`, insert the call as the first statement inside the `try`:

```ts
  private async extractCanon(projectId: string, stages: any[]): Promise<CanonFactCore[]> {
    try {
      // (2) runs REPORT-ONLY here: classify the material and log what it found, while the extractor
      // keeps reading the unchanged corpus. This is the call site (3) will flip — `fullSourceFor`
      // becomes `bible.canonText` — but not until a real build's log shows the roles are right on
      // real material. Doctrine: report-only until validated.
      await this.sourceBibleFor(projectId).catch(() => null);
      const src = await this.fullSourceFor(projectId, stages);
      if (src.length < 400) return [];
```

- [ ] **Step 4: Build and run the whole suite**

```
cd C:\Projects\TFM-System\backend
```

```
npm run build
```

```
npm run test:unit
```

Expected: a clean `nest build`, and **578 passing** (536 + 42).

- [ ] **Step 5: Validate against a real build — this is the deliverable, not the tests**

Generate a script from material that has all four roles in it: a treatment, a research PDF, a comp screenplay, and a typed instruction. Then read one line in the backend log:

```
sourceBible: 4 doc(s), 61 passage(s), 5 call(s) - canon 38 | research 14 | reference 8 | instruction 1 | unclassified 0 - QUARANTINED: truman-show.pdf - 1 instruction(s)
```

**Read it against what you actually submitted.** The three things that matter:

1. **Is the comp screenplay in `QUARANTINED`?** If it is not, the plurality rule is not firing on real material and ③ must not proceed.
2. **Did your treatment stay out of `QUARANTINED`?** A false quarantine is the failure that would make ② worse than nothing.
3. **Is `unclassified` near zero?** A high count means batches are failing — check the `WARN classify:` lines.

If the counts are wrong, ② is doing its job by telling you so cheaply, before ③ trusts it. Tune the prompt in `classifyBatch`, not the thresholds — there are no thresholds.

---

## After this plan

**③ SERVE THE BUILDER** is now four substitutions at call sites that already exist:

| Today | After ③ |
|---|---|
| `sourceMat = sourceText.slice(0, 6000)` labelled *"stay faithful to it"* (`:944`) | `bible.canonText` |
| `fullSourceFor()` → 60,000-char prefix → `extractCanon` (`:1927`) | `bible.canonText` — role-selected instead of truncated |
| Instructions dramatised as material | `bible.instructions` joins `intakeSteer`'s existing *"CREATIVE BRIEF (honour throughout)"* — **no new channel** |
| `buildFeatureCtx` per-scene prompt | `bible.brief` alongside the existing slices |

**④ RECOMMEND** additionally needs: passage persistence (`canReuseClassification` is already built for it), the eager background pass with the progress banner, and the frontend change that stops pre-aggregating the paste box — which would let `residualPaste` be deleted rather than merely trusted.

### Carried findings

- **`residualPaste` is a workaround for a frontend defect.** `ScriptOnIntake.begin()` sends `sourceText` as `[mainBox, ...extraPasteBoxes].join('\n\n')` while the extra boxes *also* go in `sources[]`. Every bug in this area — the dropped main paste box in ①, the aggregate leak here — comes from that one line. ④ should send the main box as its own `kind:'paste'` source and delete both workarounds.
- **`sourceBibleFor` has no automated test**, for the same reason `materialiseSources` has none: it is a private method with Prisma and AI dependencies. It was verified by a standalone shape-probe driving a fake `ai.json` through the real utility functions, which caught the aggregate leak. An injectable seam is the follow-up for both.
- **Batch size is untuned.** `CLASSIFY_BATCH_CHARS = 24000` and `MAX_CLASSIFY_BATCHES = 12` are reasoned, not measured. Read the `call(s)` figure on a real build before changing either.
