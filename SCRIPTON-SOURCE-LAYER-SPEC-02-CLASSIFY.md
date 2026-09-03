# ScriptON — Source Layer ② · Classify and the Source Bible

**Status:** spec · **Date:** 3 Sep 2026
**Depends on:** ① Ingest (shipped — `source-ingest.util.ts`, 35 tests, 534/534 green)
**Parent:** `SCRIPTON-SOURCE-LAYER-SPEC.md` §4 · **Restore point:** tag `scripton-pre-source-layer`

---

## 0 · Why ② exists — the three places the system is wrong today

① made the material *reach* the builder. It did nothing about the fact that the builder cannot tell
one kind of material from another. Three code paths read the corpus as one undifferentiated blob,
and each is wrong in a different way. These are not hypotheticals; they are the current lines.

### 0.1 · `develop()` — `scripton.service.ts:944`

```ts
const sourceMat = String(opts?.seed || (intakeRow && intakeRow.sourceText) || '').slice(0, 6000);
const srcBlock = (sourceMat && [...].indexOf(kind) >= 0)
  ? ('\nSOURCE MATERIAL (the work to adapt - stay faithful to it unless the brief overrides):\n' + sourceMat)
  : '';
```

The **first 6,000 characters of whatever the user attached**, labelled *"the work to adapt — stay
faithful to it"*, carried into LOGLINE, SYNOPSIS, TREATMENT, BEATS, PREMISE, STORY_ENGINE,
SEASON_ARC and THESIS.

If the user's first upload is a comp screenplay, the system is instructed to stay faithful to another
film. **This is the mechanism by which two pages of THE TRUMAN SHOW reached scene 32 of the delivered
Jason Quick draft.** `findSecondDocument` catches that on the output side. Nothing catches it here.

### 0.2 · `fullSourceFor()` → `extractCanon()` — `scripton.service.ts:1927, 1947`

```ts
return [ intake.sourceText, bodyOf('LOGLINE'), ... ].filter(Boolean).join('\n\n').slice(0, 60000);
```

…fed to a prompt that says *"the hard facts the script must never contradict"* and *"Include ONLY
facts the material actually STATES"*.

The material states plenty. It states that Truman Burbank lives in Seahaven. It states that a
Minuteman III has a 13,000 km range. It states *"make the ending ambiguous."* All three become
CANON — facts carried on every one of ~130 scene prompts as things the script may not contradict.
Research becomes binding. A reference film's protagonist becomes a fact. **An instruction becomes a
thing to dramatise.**

The prompt's own guard — *"Do NOT invent or infer anything: a missing fact is harmless, an invented
one is a bug"* — is correctly written and cannot help, because none of these facts are invented. They
are accurately extracted from material that should never have been in scope.

### 0.3 · `adapt()` — the logline gate

Fixed by ① to the extent that it now *sees* the files. It still cannot tell the novel from the
research folder, so the logline can be drawn from either.

### 0.4 · What ② is, in one line

**② tells the difference.** Everything downstream — ③ and ④ — is a consumer of that one distinction.

---

## 1 · Scope

| In | Out |
|---|---|
| Segmenting each ingested source into addressable passages | Changing any existing consumer (that is ③) |
| One AI pass assigning role + subjects + confidence | New API endpoints, new UI, new lifecycle |
| A **deterministic** distiller producing the Source Bible | Embeddings, vector stores, semantic retrieval |
| Storage with **no schema migration** | Storing the bible (see §5.2 — it is never stored) |
| The structural REFERENCE quarantine | OCR, EPUB, any new dependency |

**New file:** `backend/src/production/scripton/source-classify.util.ts` (+ `.spec.ts`)
Pure — no Nest, no Prisma, no filesystem, no network, and **no AI client**. The one AI call is made
by the service and its result is *passed in*, exactly as `checkDraftContinuity` is handed scenes
rather than fetching them. That is what makes the whole module testable without a model.

---

## 2 · Segmentation — pure, deterministic, offset-based

```ts
export interface Passage {
  id: string;        // "<docId>#<ordinal>" — stable, greppable in logs
  docId: string;
  start: number;     // char offset into that document's own text
  end: number;
  chars: number;
}
export const PASSAGE_TARGET_CHARS = 900;
export const PASSAGE_MAX_CHARS = 2400;
export function segmentPassages(docs: SourceDoc[]): Passage[];
```

Rules:

1. Split on blank lines into paragraphs. Never split a paragraph — a paragraph is the smallest unit
   whose role is knowable.
2. Accrete consecutive paragraphs until the block reaches `PASSAGE_TARGET_CHARS`.
3. A single paragraph over `PASSAGE_MAX_CHARS` is split on sentence boundaries; if it has none
   (minified HTML, a table), on a hard char boundary. Never throws, never loses a character.
4. Whitespace-only regions are skipped, but offsets remain absolute — `text.slice(start, end)`
   always returns the exact passage.

**A passage stores offsets, not text.** The body is fetched by slicing the source's stored `text`.
Three reasons, in order of importance:

- **The quarantine becomes structural.** There is exactly one function that turns a passage into
  words. Quarantine it there and REFERENCE is unreachable — not deprioritised, unreachable. A design
  where passages carry their own bodies has as many leak paths as it has consumers.
- A 300 KB corpus does not become a 600 KB Json column.
- Passages stay valid under re-save without a second copy drifting from the first.

### 2.1 · What counts as a document

`materialiseSources` leaves `sources[]` with a `text` on each entry, plus the assembled corpus on
`sourceText`. The main paste box is *not* its own source record (the frontend pre-merges it — see
`ScriptOnIntake.tsx:253`), so the doc list is:

    docId "paste"  ← intake.sourceText        (the assembled corpus, includes the main box)
    docId "0".."n" ← sources[i].text          (files, URLs, extra paste boxes)

`"paste"` therefore **overlaps** the extra-paste-box sources. That is deliberate and harmless: the
overlapping passages classify identically and the distiller deduplicates (§4.2). The clean fix —
having the frontend send the main box as a `kind:'paste'` source and stop pre-aggregating — belongs
to ④, where the intake form is already being changed. Do not do it here; ② must not need a frontend
release to ship.

---

## 3 · Classification — one AI pass, batched

### 3.1 · The contract

```ts
export type Role = 'CANON' | 'RESEARCH' | 'REFERENCE' | 'INSTRUCTION';
export type StoredRole = Role | 'UNCLASSIFIED';
export type SubjectKind = 'CHARACTER' | 'PLACE' | 'RULE' | 'EVENT' | 'OTHER';

export interface Verdict {
  id: string;
  role: Role;
  subjects: Array<{ name: string; kind: SubjectKind }>;
  confidence: number;   // 0..1
}
```

`SubjectKind` reuses the vocabulary `mapAiFactsToCore` already speaks (CHARACTER / WORLD / LORE /
TIMELINE / RELATIONSHIP / PLOT), narrowed to what a distiller can bucket deterministically. **No new
taxonomy is invented** — that is the difference between a distiller that groups and a distiller that
interprets.

### 3.2 · Batching

```ts
export const CLASSIFY_BATCH_CHARS = 24000;
export const MAX_CLASSIFY_BATCHES = 12;
export function batchPassages(docs, passages, maxChars?): Passage[][];
```

Batches never straddle documents — a document is a strong prior for its own role, and splitting one
across calls throws that away for nothing. `MAX_CLASSIFY_BATCHES` caps a build at ~288 KB of
classified material; everything past it stays `UNCLASSIFIED`, which is a defined, safe state (§3.4).

The service issues one `this.ai.json({ task: 'scripton.source.classify', ... })` per batch. The util
gets the parsed replies back.

### 3.3 · The prompt's job, and the one thing it must not do

The pass returns a role for a passage. It does **not** summarise, rewrite, or extract facts. Nothing
it emits is ever shown to a writer. Its whole output is four enum values, a subject list, and a
number — which is why a hallucination here degrades gracefully instead of contaminating prose.

INSTRUCTION is the class worth spelling out in the prompt, because it is the one a reader
mis-sorts: *"make the ending ambiguous"*, *"keep it under 20 speaking roles"*, *"no drone shots — we
can't afford them"* are commands about the script, not material in it.

### 3.4 · `UNCLASSIFIED` is the safe state, and the whole failure design

An unclassified passage behaves **exactly as today**: it stays in `sourceText`, every existing
consumer still reads it, nothing changes. The bible is built only from classified passages.

So the failure ladder is:

| Failure | Result |
|---|---|
| One batch throws | Its passages are UNCLASSIFIED; the rest classify |
| Every batch throws | Zero passages classified; **the build is byte-for-byte what it is today** |
| Model returns unknown ids | Ignored |
| Model omits ids | Those passages are UNCLASSIFIED |
| Model returns a role outside the four | That verdict is dropped → UNCLASSIFIED |

**② can never make a build worse than the build it replaces.** That is the same doctrine that governs
every check in this system — *a check that reports nine defects in a draft containing none is worse
than no check* — applied to classification instead of detection.

### 3.5 · No confidence threshold

There is no calibration data for one, so inventing a cut-off would be exactly the mistake §02 of the
artifact records. `confidence` is stored, used for ordering inside the bible and for the "why" text
④ will show, and **gated on nowhere.**

The asymmetry that replaces a threshold:

> **Quarantine is inclusive. Canon is exclusive.**
> A passage tagged REFERENCE at *any* confidence is quarantined — the cost of over-quarantining is
> one lost paragraph; the cost of under-quarantining has already shipped once.
> A passage becomes hard canon only if it is tagged CANON **and** its document is not a reference
> document (§4.3).

No magic number, and both errors point the safe way.

---

## 4 · The distiller — deterministic, no second AI call

```ts
export interface SourceBible {
  brief: string;      // <= ~1800 chars — rides on EVERY scene prompt
  full: string;       // <= ~12000 chars — read ONCE, by planning and canon extraction
  canonText: string;  // CANON passage bodies, in document order — the extractCanon input
  instructions: string[];
  research: Array<{ subject: string; passages: number; docs: string[] }>;
  references: Array<{ doc: string; why: string }>;
  counts: Record<StoredRole, number>;
}
export function buildSourceBible(docs: SourceDoc[], passages: StoredPassage[]): SourceBible;
```

Deterministic means: same inputs, same string, every time — so it is snapshot-tested, and a change
to the bible always shows up as a diff in a test rather than as a mysteriously different script.

### 4.1 · The four sections

```
CANON BIBLE        subjects from CANON passages, bucketed by SubjectKind, ordered by
                   (passage count desc, first appearance asc). Each carries the FIRST SENTENCE of
                   the passage where it is most prominent — an extract via trimToSentence(), not a
                   paraphrase. Cap ~40 subjects.

INSTRUCTION BLOCK  the verbatim text of INSTRUCTION passages, trimmed and deduplicated.
                   NEVER paraphrased, never summarised, never truncated mid-rule. Cap ~600 words.

RESEARCH INDEX     one line per subject: "SUBJECT — 3 passages · minuteman-history.pdf".
                   The subject, never the body. The body stays fetchable by ③ on demand.

REFERENCE LEDGER   "truman-show.pdf — cited as a tonal reference."
                   Names and why. NEVER the text.
```

`brief` = the INSTRUCTION block plus the top canon subjects, budgeted to sit alongside
`buildFeatureCtx`'s existing 2,600-char treatment slice without displacing it. `full` = all four
sections, for the once-per-build readers.

### 4.2 · Deduplication

Doc `"paste"` overlaps the extra-paste sources (§2.1), so identical passages reach the distiller
twice. Dedupe with `normaliseForCompare` + `jaccard` from `continuity.util.ts` at ≥ 0.9 — the same
pair the duplicate-scene detector already uses, at a threshold well above the 0.55/0.75 it uses for
prose, because this is looking for *the same text twice*, not two similar scenes. No new dependency,
no new comparison primitive.

### 4.3 · Document-plurality escalation — the structural guarantee

> **If a document's plurality role is REFERENCE, every passage in it is quarantined, whatever its own
> tag.**

Computed deterministically in the distiller from the stored roles. This is the rule that would have
stopped the shipped contamination: a comp screenplay is *wholly* a reference, and one stray CANON tag
on page 40 of it must not be able to leak two pages of another film into scene 32.

The guarantee is made structural in three ways, not one:

1. `buildSourceBible` builds the REFERENCE LEDGER **from document metadata only**. There is no code
   path inside the distiller that reads a quarantined body — not a filtered one, not a truncated
   one. The leak is impossible rather than prevented.
2. The single body-fetch function (§2) refuses quarantined passages at the query layer.
3. `canonText` is assembled from the non-quarantined CANON set only, and is the *only* string ②
   hands to `extractCanon`.

### 4.4 · The bible is a pure function of the passages

Which is why §5.2 does not store it.

---

## 5 · Storage — no migration

### 5.1 · Passages ride in the existing `sources` Json column

`IntakeProfile.sources` is `Json?` (schema.prisma) and already holds
`{ kind, value, name, text, chars, note }` per entry after ①. ② adds one key:

```ts
sources[i].passages = [{ id, start, end, role, subjects, confidence }]
```

~70 bytes per passage; a 300 KB corpus yields ~330 passages ≈ 23 KB of Json. Same precedent as ①:
**no migration, no new column, no Prisma client regeneration, nothing to coordinate with a deploy.**

### 5.2 · The bible is never stored

It is `buildSourceBible(docs, passages)` — pure, cheap, and reproducible. Storing it would buy
nothing and cost the one thing that matters: a stored bible can drift from the passages it was built
from, and then no test can tell you which one is true. Recompute it at every read.

### 5.3 · Reuse

```ts
export function canReuseClassification(src, prev): boolean;
```

Reuse `prev.passages` when it exists and `prev.text === src.text`. Keyed on the **text**, not the
`value` — a URL's content changes under a stable value, and ① already re-extracts on that path.
Deliberately conservative in the same way `canReuseExtraction` is: any doubt re-classifies.

### 5.4 · When classification runs

**v1: lazily, from the build path**, immediately before `extractCanon` needs it, with the result
written back to `sources[].passages` in a fail-open `try/catch`.

Not at `saveIntake` — that runs on every keystroke-level form save and would spend AI calls on a form
the user is still filling in. Not behind a new endpoint — ② must ship with **zero new surface area**,
exactly as ① did. The eager background pass with the progress banner belongs to ④, which is already
changing that screen.

---

## 6 · What ③ will do with it — contract only, built later

Recorded here so the shape of ②'s output is not decided twice.

| Today | After ③ |
|---|---|
| `sourceMat = sourceText.slice(0, 6000)` labelled *"stay faithful to it"* | `bible.canonText`, correctly labelled |
| `fullSourceFor()` → 60,000-char prefix → `extractCanon` | `bible.canonText` — role-selected instead of truncated |
| Instructions dramatised as material | `bible.instructions` joins `intakeSteer`'s existing *"CREATIVE BRIEF (honour throughout)"* channel — **no new channel** |
| Research binding as canon | RESEARCH INDEX in `full`; bodies fetched on demand |
| References copyable | Unreachable |

Every one of those is a substitution at a call site that already exists. ② adds no consumer of its
own; that is why it can ship without changing a single existing behaviour.

---

## 7 · Testing

| Area | Test |
|---|---|
| `segmentPassages` | offsets reconstruct the source exactly; a 40 KB single paragraph; CRLF; blank-only doc; a doc of one character |
| `batchPassages` | never straddles documents; respects `CLASSIFY_BATCH_CHARS`; caps at `MAX_CLASSIFY_BATCHES` |
| Verdict merge | unknown ids ignored · omitted ids → UNCLASSIFIED · bad role → UNCLASSIFIED · a thrown batch leaves every other batch intact |
| `buildSourceBible` | snapshot over a fixture passage set |
| Dedup | the `"paste"`/source overlap yields one instruction, not two |
| **The quarantine** | **the one that matters** — assert the bible contains **no substring ≥ 8 words of any REFERENCE body**, over a fixture where the reference shares vocabulary with canon; and that a document whose plurality is REFERENCE contributes zero bodies **even when one of its passages is tagged CANON** |
| Degradation | with every verdict removed, the bible is empty and `canonText` falls back to today's corpus |

The quarantine test is written **first**, and it must fail before the quarantine exists. Given this
contamination has shipped once, a test that passes on an unbuilt guarantee is worse than no test.

---

## 8 · Open, and deliberately deferred

- **Frontend main-paste-box separation** (§2.1) — ④.
- **Eager background classification + progress banner** — ④.
- **Per-passage citation back to the user** (*"canon, from treatment.pdf p.4"*) — needs page offsets
  ① does not currently keep. Out of ②.
- **Re-classifying when only the brief changes** — a genre change does not change what a document
  *is*. No.

---

## 9 · Decisions taken

| Question | Decision | Because |
|---|---|---|
| Passage bodies stored, or offsets? | **Offsets** | One fetch function ⇒ the quarantine is structural |
| Confidence threshold | **None** | No calibration data; asymmetric rule instead (§3.5) |
| Unclassified passages | **Behave exactly as today** | ② can never make a build worse than today's |
| One stray CANON tag in a comp screenplay | **Document plurality wins** | The exact shape of the shipped contamination |
| Where the bible is stored | **Nowhere — recomputed** | A stored copy of a pure function can only drift |
| Where passages are stored | `sources[i].passages` | No migration, same precedent as ① |
| When classification runs | **Lazily, from the build path** | Zero new surface area; ships alone |
| New taxonomy for subjects | **No** — reuse `mapAiFactsToCore`'s vocabulary | A distiller that groups, not one that interprets |
| Dedup primitive | `normaliseForCompare` + `jaccard` ≥ 0.9 | Already in `continuity.util.ts` |
