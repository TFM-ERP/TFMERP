# ScriptON — The Source Layer

**Status:** design agreed, not built · **Date:** 2 Sep 2026
**Restore point before this work:** tag `scripton-pre-source-layer` (commit `3b99318`)
**Companion docs:** `SCRIPTON-BUILDER-COMPLETE-REFERENCE.md`, artifact §02/§03

---

## 0 · Why this exists

A build was created with **two uploaded files and an empty paste box**. It stalled at 75% with
*"Paste a synopsis or excerpt of the source work to adapt."* Then, pushed through manually, it wrote
this logline:

> *Stranded in the Alaskan backcountry by a bush-plane crash, a trauma paramedic must drag her
> broken-legged pilot sixty miles to the coast before hypothermia kills them both.*

The film was a missile-silo thriller. The logline is coherent, specific and well-formed — which is
the tell. **The model was never shown the source.** It wrote competently from genre and tone alone.

### The defect, exactly

`ScriptOnIntake.tsx:254`

```js
const aggregate = [f.sourceText].concat(pastes).filter((x) => x && x.trim()).join('\n\n');
```

The main paste box plus extra paste boxes. **Files and URLs are excluded by construction.** They are
carried as `sourceFileUrl` (a URL string) and `sources: [{kind:'file', value:<url>}]`, and nothing
anywhere in the backend opens them. `adapt()` (`scripton.service.ts:346`) then reads only
`opts.sourceText`, finds it empty, and throws.

The UI meanwhile advertises `Accepts PDF, FDX, Fountain, Word, EPUB, HTML`. This is a broken promise,
not a missing feature.

### Why the fix is bigger than the bug

Reading the files unblocks the build. But the material a user supplies is not one undifferentiated
lump — it is research, concept, acts, characters, world, themes, facts, constraints, existing pages,
and **instructions about what the script should become**. Treating all of that as one blob of "source
text" is how a reference gets copied into a scene and an instruction gets dramatised.

Precedent, from this codebase: the delivered Jason Quick draft **shipped two pages of THE TRUMAN SHOW
inside scene 32**. `findSecondDocument` catches that on the output side. This spec prevents it on the
input side, which is where it should have been stopped.

---

## 1 · The four roles

A role earns its place only by changing what the builder does with the passage.

| Role | Into scene prose? | Into canon? | What travels to a stage |
|---|---|---|---|
| **CANON** | yes | yes | bible entry + fetchable body |
| **RESEARCH** | only through a canon fact the writer chose to use | **never automatically** | subject index always; body fetchable |
| **REFERENCE** | **never — structurally unfetchable** | no | name + why only, never the text |
| **INSTRUCTION** | no — becomes a **rule** | no | verbatim, every stage |

Mapping from the user's material kinds:

    CANON        acts · sequences · plot points · characters & relationships ·
                 setting & worldbuilding · existing script pages · treatments · outlines
    RESEARCH     factual information · real-world events · history · reference research
    REFERENCE    comps · examples · visual references · "like this film"
    INSTRUCTION  what the user wants the script to become · production requirements ·
                 limitations · budget considerations · tone directives

**INSTRUCTION is the subtle one.** *"Make the ending ambiguous"* is not material — it is a command.
Today it lands in `sourceText` and the model may reasonably dramatise it: a scene in which someone is
ambiguous. It belongs on the same channel as `spineDirective` and the canon block, which is how this
system already tells a writer what it may not contradict.

**REFERENCE quarantine must be structural.** "Do not copy this" in a prompt is a request. Making
reference passages *unreachable* by the retrieval layer is a guarantee. Given the contamination has
shipped once, build the guarantee.

---

## 2 · Architecture

```
   SOURCES   paste · URL · file
      │
      ▼
 ┌──────────────────────────────────────────────┐
 │ ① INGEST            files & URLs → text      │  no AI · pure · testable
 │   source-ingest.util.ts                      │
 └──────────────────────────────────────────────┘
      │
      ▼
 ┌──────────────────────────────────────────────┐
 │ ② CLASSIFY + DISTIL       → Source Bible     │  one AI pass +
 │   passages tagged CANON/RESEARCH/            │  a DETERMINISTIC distiller
 │   REFERENCE/INSTRUCTION                      │
 └──────────────────────────────────────────────┘
      │                              │
      ▼                              ▼
 ┌──────────────────────┐   ┌────────────────────────────┐
 │ ④ RECOMMEND          │   │ ③ SERVE THE BUILDER        │
 │   evidence-gated     │   │   bible in every stage     │
 │   pre-fill, marked   │   │   lookup by subject        │
 │   manual always wins │   │   REFERENCE quarantine     │
 └──────────────────────┘   └────────────────────────────┘
```

Numbering is build order. **③ before ④** — ③ makes the scripts better, ④ makes the setup faster.

---

## 3 · ① Ingest

**New file:** `backend/src/production/scripton/source-ingest.util.ts` (+ `.spec.ts`)

Pure, no Nest, no Prisma, no AI — same shape as `provider-health.util.ts` and `continuity.util.ts`.

```ts
export type SourceKind = 'pdf' | 'docx' | 'fountain' | 'fdx' | 'html' | 'text' | 'unknown';
export function kindOf(filename: string): SourceKind;
export async function extractText(buf: Buffer, filename: string): Promise<ExtractResult>;
export interface ExtractResult { kind: SourceKind; text: string; chars: number; note?: string }
```

Dispatch, using dependencies **already in `package.json`** — the freeze holds:

| Kind | Extractor | Source |
|---|---|---|
| `.pdf` | `pdf-parse` | already a dependency (`^1.1.1`) |
| `.docx` | `mammoth` | already a dependency (`^1.8.0`) |
| `.html` / `.htm` | existing `htmlToText()` | already in `scripton.service.ts` |
| `.fountain` / `.txt` / `.md` | native — plain text | — |
| `.fdx` | strip XML tags, keep `<Text>` bodies | native |

**Service side:** `materialiseSources(intake)` in `scripton.service.ts`

- walks `sources[]`
- `kind:'file'` → resolve the stored URL to a path under `<cwd>/uploads` (multer's `UPLOAD_DIR`,
  `script.controller.ts:12`) and read from disk. **Filesystem read — no fetch, no SSRF surface.**
- `kind:'url'` → the existing `ingestUrl()`, which already has DNS blocklist, `redirect:'error'`,
  8s timeout and a content-type check
- `kind:'paste'` → verbatim
- writes `sourceDocs: [{ id, kind, name, chars, text }]` on the intake, and keeps `sourceText` as the
  paste-only aggregate for backward compatibility

**Runs at intake save**, so every existing consumer (`adapt`, the ladder, `sourceMat`, the canon
extractor) sees real material without being changed.

**`adapt()`'s gate changes** from `opts.sourceText` to the materialised total.

### Failure handling

A file that yields no text — a scanned PDF with no text layer — is **reported by name**, never
silently dropped:

> `contract-notes.pdf — no readable text (looks like a scan)`

Ingestion failure of any single source is never fatal to the build.

---

## 4 · ② Classify and distil

**New file:** `backend/src/production/scripton/source-classify.util.ts` (+ `.spec.ts`)

1. **Segment** each `sourceDoc` into passages — paragraph blocks, capped in length, with stable ids.
2. **Classify** — one AI pass per doc (batched where small) returning per passage:
   `{ id, role, subjects[], confidence }`. Role from the four. `subjects` are proper nouns and topic
   keys used later by lookup.
3. **Distil** — **deterministic, no second AI call**, so the Source Bible is reproducible and
   snapshot-testable. Builds a role-partitioned bible of ~2–3k words:

```
CANON BIBLE        characters · places · the world's rules · act structure if present
INSTRUCTION BLOCK  verbatim, deduplicated, never paraphrased
RESEARCH INDEX     one line per subject — the subject, not the body
REFERENCE LEDGER   names and why they were cited. NEVER the text.
```

**Stored on the build:** `sourceBible` (the assembled text) and `sourcePassages` (the tagged
passages, addressable by id and subject).

### Failure handling

Classification failure leaves the corpus intact and unclassified. No bible, no recommendations,
nothing blocks. The build proceeds exactly as it does today.

---

## 5 · ③ Serve the builder

The bible joins `buildFeatureCtx` and travels to **every one of the eleven stages**.

- **INSTRUCTION** rides the existing directive channel beside `spineDirective`, `knowledgeDirective`
  and the canon block — verbatim, every scene.
- **Lookup by subject** reuses `normaliseForCompare` and `jaccard` from `continuity.util.ts`. No new
  dependency, no embeddings (none exist in the dependency set, and semantic retrieval is out of
  scope).
- **The quarantine:** lookup filters to `CANON | RESEARCH` **at the query layer**. A REFERENCE
  passage is not merely deprioritised — it cannot be returned by any query, ever.

Worked example. Scene 47 is set in the Montana silo:

    fetched → 3 CANON passages about that place
              2 RESEARCH notes on 1980s silo procedure
    carried → the INSTRUCTION block, in full
    never   → the REFERENCE passage quoting another film's bunker scene

---

## 6 · ④ Recommend

A **deterministic mapper** from bible → field values. Evidence-gated.

The Brief form carries ~35 settable fields across a large option space — 32 genres, 7 project types,
48 ratings, 35 markets, 40 languages, 6 lore-density steps, sub-genre presence × intensity matrices,
style mixes, framework, endings, budget tier, intent, setting country/era/world/place. The mapper
must consider subtypes, not only top-level categories.

### The empty rule

**Unevidenced means unselected, not defaulted.** Today's form ships defaults (`projectType: 'MOVIE'`,
`researchAmount: 55`, `loreDensity: 'ACCENT'`). Those become genuinely unset unless evidenced or
chosen.

- `researchScope` stays **on** by default.
- `projectType` has no legal empty state. If unevidenced it stays unselected and **Begin the Build is
  blocked** until chosen.

That block is a feature. A blocked button beats a silent wrong default — the same doctrine that
governs every check in this system.

**This is the riskiest part of the build.** The backend already tolerates nulls; the UI does not.

### Behaviour

- Continue opens the Brief page **immediately**. A slim banner reports progress.
- Results apply in **one atomic step** to fields the user has not touched. Nothing shifts under their
  hands mid-edit.
- A `touched` set records every field the user has interacted with. Touched fields are never written,
  by this pass or any later one.
- The banner becomes the evidence summary: `9 fields set from your source · See why · Undo all`, plus
  an explicit list of what was skipped and why.

---

## 7 · Testing

| Subsystem | Test |
|---|---|
| ① Ingest | one fixture per format; a scanned-PDF fixture asserting the named-failure path |
| ② Distil | deterministic → snapshot tests. Classifier gets a fixture corpus with known roles |
| ③ Serve | **the quarantine test: assert REFERENCE can never be returned by lookup, under any query.** This is the one that matters |
| ④ Recommend | evidenced → set · unevidenced → untouched · touched → never overwritten |

---

## 8 · Out of scope

- **EPUB** — no zip library in the dependency set, and the freeze holds. Remove it from the UI's
  `Accepts …` line rather than keep promising it.
- **Semantic retrieval** — no embeddings, no vector store, no langchain. Lexical only.
- **OCR** for scanned PDFs — reported as unreadable, not solved.

---

## 9 · Build order

    ① Ingest        unblocks builds today · no AI · fully testable · foundation
    ② Classify      the heart · everything else depends on it
    ③ Serve         makes the SCRIPTS better
    ④ Recommend     makes the SETUP faster

Each subsystem gets its own implementation plan. ① is independently shippable and should ship first.

---

## 10 · Decisions taken

| Question | Decision |
|---|---|
| Fields the source doesn't evidence | Left **unselected/empty** for the user to choose |
| Where the user pays the analysis wait | Background; **applied atomically** when ready |
| Provenance model | **Four roles**, each with different downstream behaviour |
| Carrying a novel through eleven stages | **Distilled bible + lookup on demand** |
| Which consumer first | **③ Serve the builder** before ④ Recommend |
| Spec location | Repo root, matching the existing `SCRIPTON-*.md` convention |
