# ScriptON Timeline Axis — Implementation Plan 03: The Wiring

**Status:** written from the spec, not built · **Date:** 12 Sep 2026
**Spec:** `SCRIPTON-TIMELINE-SPEC.md` · **Built already:** `PLAN-01-CORE` (the pure era core), `PLAN-02-HARDENING` (the tokenizer, the grammar, one rounding rule)

Plans 01 and 02 built six modules and never called them. Nothing in `src` outside the era family
imports any of them, and no commit in the repo's history ever did — so this is not a wiring that was
attempted and reverted, it is a wiring that was never attempted. Everything below connects what
exists to the build, in the order the spec's own deferrals imply.

---

## What is already built, and is not rewritten here

| Module | Exports this plan consumes |
|---|---|
| `era-days.util.ts` | `DAYS_PER_YEAR`, `yearsToDays`, `daysToYears`, `roundHalfAwayFromZero`, `EraOffset` |
| `era-tokens.util.ts` | `tokenize`, `matchPhrases`, `matchYears` |
| `era.util.ts` | `wordsToNumber`, `parseEraPhrase`, `parseYear`, `sweepEras` → `EraHit[]`, `resolveEventAnchored` |
| `era-map.util.ts` | `ERA_BANDS`, `COUNTRY_ERA_YEARS`, `findEraRow`, `anchorYearForEra` → `AnchorVerdict`, `anchorYearForBand`, `describeRange`, `midpointYear` |
| `age.util.ts` | `classifySteps`, `ages`, `AGE_TOLERANCE_DAYS` |
| `world-events.util.ts` | `datedWorldEvents`, `findWorldEvent` |

**No second parser is written.** Any temporal reading in this plan goes through `sweepEras`,
`parseYear` or `wordsToNumber`. A regex over a year in a new file would be the defect Plan 02 spent
a whole task removing.

---

## Task 1 — `storyYear` resolution: the §7.2 ladder, with provenance

New pure module `story-year.util.ts` + spec. Nothing else in this task.

```ts
export type StoryYearProvenance = 'COMPUTED' | 'ERA_MIDPOINT' | 'DEFAULTED_PRESENT' | 'ASK';

export interface StoryYearResult {
  year: number | null;            // null only when provenance is 'ASK'
  provenance: StoryYearProvenance;
  /** What produced it, in the user's words. '' when nothing needs saying. */
  note: string;
  /** The pairs, the row or the band the answer came from — never empty except on ASK. */
  evidence: string[];
  /** Present only when two pairs disagree: the ERA_ANCHOR_CONFLICT payload. */
  conflict?: { years: number[]; pairs: string[] };
}

export function resolveStoryYear(input: {
  material: string;               // the build's source text
  settingEra?: string | null;     // free prose — see below
  settingCountry?: string | null;
  currentYear: number;            // injected, never read from the clock inside the function
}): StoryYearResult;
```

### The ladder, in the spec's order (§7.2), and nothing else

**1 · COMPUTED — an absolute and a relative dating of the same event.**
`storyYear = absoluteYear − eraOffsetYears` (§7.0). Mechanically:

- `sweepEras(material, currentYear)` gives `EraHit[]` with character spans. A hit whose `offset` is
  non-null and non-zero is a **relative** dating; `matchYears(tokenize(material))` gives the
  **absolute** years with their spans.
- A pair is formed only when the two spans sit in the **same sentence** — a thing the material has,
  rather than a character count nobody can defend.

  **This is deliberately conservative, and it refuses real pairs.** *"He vanished in 1994. Seven
  years later, Sophie…"* is one event dated twice, and this rule will not pair it; so is the spec's
  own §7.0 example when its two statements are separate sentences. Every such case degrades to `ASK`
  — the user is asked for a year — rather than to a wrong year computed from two unrelated mentions.
  The sentence window is the dial: widening it to a paragraph is a one-constant change with its own
  test, and it should be turned only on evidence of refused pairs, not on taste.
- `years = daysToYears(offset.from)`; the implied present is `absoluteYear − years`, rounded with
  `roundHalfAwayFromZero` so a pair never lands on two answers.
- **All** pairs are computed, not the first. Identical results → `COMPUTED`, `evidence` naming each
  pair. Differing results → `provenance: 'ASK'` with `conflict` populated: this is
  `ERA_ANCHOR_CONFLICT`, raised before a word is written (§5, §7.0).

**2 · ERA_MIDPOINT — `settingEra` derives the anchor.**
`anchorYearForEra(settingCountry, settingEra, currentYear)` and its `AnchorVerdict.status` is
obeyed exactly as `era-map.util` documents it:

| status | Meaning | This plan does |
|---|---|---|
| `ok` | a year was named | `ERA_MIDPOINT`, note carried through (a `disputed` row discloses) |
| `refused` | the row exists and will not anchor (`±±`, or no sourced start) | `ASK`, with the row's own reason. **Never** fall through — falling through manufactures the approximation the row exists to refuse |
| `missing` | not in the map | fall through to the band, then step 3 |

**`settingEra` IS FREE PROSE, AND THAT IS THE HAZARD OF THIS STEP.** `FIELD_SPECS` declares
`settingEra: { kind: 'text', max: 120 }`, so it is not drawn from a list and usually will not equal
a map label. Live example, cmtx3i3pw's brief: `"Present day — contemporary software development"`.
So:

- Match is **exact on the trimmed string**, first against `COUNTRY_ERA_YEARS` for `settingCountry`,
  then against the nine band labels.
- The band labels live in the frontend taxonomy (`SETTING_ERAS`) and the band ids live in
  `ERA_BANDS`. This plan adds the label→id table **in the backend**, with Plan 02 Task 6's
  cross-boundary guard: a renamed label is a red build, not a silent miss.
- Anything else is **unrecognised prose**, and it does **not** become the current year. It is `ASK`.
  Step 3 exists for "Contemporary or unset" (§7.2) — prose we cannot read is neither.

#### The concession, and the two rules that stop it swallowing the ladder

One declared list — `contemporary`, `present day`, `modern day`, `today` — recognised as
contemporary. It is **not equality and not a substring test**, because both fail on real prose:
equality misses the live example, and a substring makes *"a contemporary retelling of the 1920s"*
contemporary when the material plainly says 1920s.

1. **LEADING-PHRASE.** The normalised prose (trimmed, lowercased, whitespace collapsed) must
   **begin** with one of the four phrases, followed by end-of-string or a separator — whitespace, a
   hyphen, en or em dash, colon, comma, semicolon, slash or bracket.
2. **HARD NEGATIVE GUARD, checked first.** Any of these **anywhere** in the prose disqualifies the
   concession outright, whatever it begins with: a 4-digit year (`1994`), a decade (`1920s`, `90s`),
   the word `century`/`centuries`, or an era token (`BC`, `BCE`, `AD`, `CE`). Material that dates
   itself is not answered with "now".

| Prose | Outcome |
|---|---|
| `"Present day — contemporary software development"` | `DEFAULTED_PRESENT` (leads with the phrase, separator follows, no date token) |
| `"a contemporary retelling of the 1920s"` | **not** present — disqualified by `1920s`, and it does not lead with the phrase either. Rung 1 if the material pairs, otherwise `ASK` |
| `"seven years before present day"` | **not** the concession — the phrase is not leading |
| `"Contemporary"` | `DEFAULTED_PRESENT` (this is also the exact band label, so it never reaches the list) |

Isolated in one exported constant and one exported predicate, so **deleting the list flips every row
above to `ASK`** and the tests say so by name.

**3 · DEFAULTED_PRESENT — the current calendar year**, only when the era resolved to the
`contemporary` band or `settingEra` is blank/absent, or the concession above applied.

#### Printability — a year reaches a prompt only when the material said it

| Provenance | To a writing prompt | To a check |
|---|---|---|
| `COMPUTED` | **the year** | yes |
| `ERA_MIDPOINT` | **null** — a band midpoint is an approximation, not a fact about this story | yes, stating the provenance |
| `DEFAULTED_PRESENT` | **null** | yes, stating that the anchor was assumed |
| `ASK` | null | no year to reason from; the check says so |

Two helpers, so a caller cannot get this wrong by accident:

```ts
export function storyYearForPrompt(r: StoryYearResult): number | null;   // COMPUTED only
export function storyYearForCheck(r: StoryYearResult): { year: number | null; provenance: StoryYearProvenance };
```

A check that reasons from a year must name the provenance in what it stores. Both are pure, both are
tested with a break: make `storyYearForPrompt` return the `ERA_MIDPOINT` year and the test fails.

### Tests (spec §9, plus the breaks)

- `2019` + `"seven years before the film"` in one sentence → **2026**, `COMPUTED`.
- A second pair implying 2025 → `ASK` with `conflict.years = [2026, 2025]`.
- The two in different paragraphs → not paired.
- Medieval setting, no pair → **1000**, `ERA_MIDPOINT` (the spec's own row: not the current year).
- `Oman` + `Ibadi Imamate` → `ASK`, note quoting the row's refusal.
- `Britain` + `Modern Britain` (a `~` row) → a year **and** the disclosure.
- `"Present day — contemporary software development"` → `DEFAULTED_PRESENT` via the concession.
- `"a contemporary retelling of the 1920s"` → **not** `DEFAULTED_PRESENT`.
- `"seven years before present day"` → the concession does not apply (not leading).
- Delete the concession list → all three become `ASK`, and the test asserts that by name.
- `"Sometime after the war"` → `ASK`, never the current year.
- `storyYearForPrompt` returns a year for `COMPUTED` and `null` for `ERA_MIDPOINT`,
  `DEFAULTED_PRESENT` and `ASK`; `storyYearForCheck` returns all four with the provenance.
- **Breaks that must be caught:** treat `refused` as `missing` (a `±±` row silently anchors);
  pair across paragraphs (a stray year hijacks the anchor); take the first pair instead of all
  (the conflict disappears); default on unrecognised prose (a Medieval story gets 2026); make the
  concession a substring test (the 1920s row goes contemporary); let `storyYearForPrompt` print an
  `ERA_MIDPOINT` year (an approximation reaches the page as fact).

---

## Task 2 — `brief.storyYear`, frozen, no migration

`storyYear` is a **Json key on `DevelopmentBuild.brief`**, exactly as `spine.want` is. No schema
change, no migration.

```jsonc
brief.storyYear = {
  "year": 2026,                 // or null when ASK
  "provenance": "COMPUTED",
  "note": "…",                  // what the user was told
  "evidence": ["1994 … seven years before"],
  "at": "2026-09-12T…Z"
}
```

**RESOLVED LAZILY, AND PERSISTED ON FIRST RESOLUTION** — not only at creation. All 32 existing
builds have no `brief.storyYear`, and a creation-only write would leave every one of them
permanently anchorless. So:

- Read `brief.storyYear`. **Present → use it, never recompute.** That is the freeze (§2: a build
  made today and re-run in January must not shift every era by a year).
- **Absent → resolve once, persist, then use it.** The write merges that one key atomically —
  `brief = brief || jsonb_build_object('storyYear', …)`, the same pattern `keepCheck` uses — so it
  cannot clobber a concurrent write to another key. It is a production-data write on an existing
  build, so it is a **merge, never a replace**, and it writes nothing else.
- **`ASK` is persisted too**, with its reason. Otherwise every generation re-runs the same failed
  resolution and the user is asked nothing, repeatedly.
- The record carries **`inputsSha`** — a hash of **every** resolution input: the material, plus
  `settingEra` and `settingCountry`. Not `sourceSha`: a writer who corrects `settingEra` from prose
  to "Medieval (500–1500)" changes no material, so a source-only hash would keep the stale `ASK`
  for ever. The name says what it covers. Recompute when the hash differs; otherwise never.
  **Test: change only `settingEra` and the anchor recomputes.**
- Changed afterwards **only** through the scoped brief-field edit route (Task 6), which records the
  old value. That is how an `ASK` is answered.
- Absence stays a supported state everywhere: a consumer that finds no key treats it as no anchor,
  which is today's behaviour.

#### Where the material actually comes from — measured 13 Sep, across all 35 builds

1. **The workspace intake row is empty for all 27 builds of the main project** (`brief.sourceText`
   lengths run 0–105,179; the intake row is 0 characters for every one of them). So the A7 fallback
   from the project's intake row can never supply anything there: **source is build-only in
   practice**, whatever the fallback's code says.
2. **Five June builds hold 0 on the build and 115 or 7,090 on their project's intake row**
   (`cmqmzqhdb`, `cmqmpr30e`, `cmqmmsx89`, `cmqmj91w9`, `cmqmhoss3`). `storyYearFor` reads the build
   only, which is correct per a169208 — a build must not inherit another build's material — and it
   changes no answer here, since those anchors resolve by era or default either way. But it is a
   **decision not to read available material**, and it should read as one rather than as an oversight.
3. All 14 empty builds were created **7 Sep or earlier**; every build from 8 Sep onward carries
   source. Legacy and from-scratch, not a live defect.

#### Who reads an `ASK` — named before Task 1 is built

A fourth state whose only consumer is Plan 04 is an unread report. Its reader is **`data.eraCheck`
on every stage version** (Task 3): when the anchor is `ASK`, the era check stores **NOT RUN with that
reason** rather than computing against a year nobody has. That is where the Keep check was read on
V2.6 — on the stage, where the writing is.

**A log line is not a reader.** §52 is 81 correctly-written empty-output events in a log nobody read.
The resolver still logs once per build at first resolution, because a log is where you look after
the fact, but it does not count toward this requirement and the acceptance does not mention it: the
acceptance is that the `ASK` reason appears in `data.eraCheck`.

`ERA_MIDPOINT` and `DEFAULTED_PRESENT` are also named in what the check stores, per the printability
table above, so a reader can tell an assumed anchor from a computed one without opening the brief.

---

## Task 3 — the era check: report-only, before any injection

The spec's §5 findings need scenes that carry an era, and nothing assigns one yet. But the sweep can
already read a finished stage body, and reading it costs nothing and risks nothing. So the first
thing wired is a **check**, not an injection — the same order the Keep work took.

- After a stage version is created, `sweepEras(body, storyYear)` over the body.
- Stored as `data.eraCheck`, in the **same three-state shape as `keepCheck`**: `NO FINDINGS` /
  `FINDINGS` / `NOT RUN` with a reason, written as `NOT RUN` with the version and replaced by the
  result. No score, no fraction — the ruling that produced `keepCheck`'s shape applies unchanged.
- **It is the reader for `ASK`.** With no anchor, the check stores `NOT RUN` and the resolver's own
  reason, on the stage, where the writing is. With `ERA_MIDPOINT` or `DEFAULTED_PRESENT` it runs and
  **names the provenance in what it stores**, so an assumed anchor is never mistaken for a computed
  one.
- v1 findings are the two that need no scene assignment:
  - `ERA_ANCHOR_CONFLICT` — two datings implying different presents (from Task 1, recomputed
    against the body). **The code must be a single exported constant**, imported by the emitter and
    by anything that reads it — never a string retyped at each site. A finding code that exists in
    two spellings is a finding nobody can filter for, and the checker that reads it would silently
    match nothing.
  - `ERA_SELF_REFUTING` — arithmetic that falsifies itself (a stated age implying a negative age,
    via `ages()`), only for characters with a stated anchor.
- Everything else in §5 is deferred to Task 4, by name, in the plan's own deferral table.
- **No model call.** This check is arithmetic. It is the first check in the system that needs no AI
  at all, and that is the point.

**Acceptance — the key on the row, not the method invoked.** `storyYearFor` has exactly one hit in
the tree today: its own definition. Task 3 is what gives it a caller, so its acceptance is that a
REAL build, after a REAL stage generation, has `brief.storyYear` carrying its `inputsSha` — read back
from the row. "The method was called" is not the test.

Two states the check must report rather than assume:
- **`stored: false`** — the anchor resolved but the persist failed, so the freeze does not exist and
  the next call will resolve again. `data.eraCheck` says *anchor not persisted*.
- **empty material** — 14 of the 35 builds have no `sourceText` at all and one has 115 characters, so
  rung 1 can never fire for them and every anchor there is ERA_MIDPOINT, DEFAULTED_PRESENT or ASK.
  That is not a fault, but a check that never says so invites the reading that the material was
  examined and found silent. `inputsSha` covers the material, so adding a source later recomputes.

---

### Task 3a — where `DatedEvent[]` comes from, and what the check says when it has none

`resolveEventAnchored(text, hits, events)` takes a `DatedEvent[]` and **nothing in the codebase
produces a story's own events**. Real material is mostly event-anchored — "before the war", "after
the inquiry", "the year Jason vanished" — so the era check's first run against the Jason Quick bible
would return a page of unresolved phrases, which is correct and indistinguishable from a broken
feature. That is §42 exactly, and the answer is two sources and one disclosure.

**Source 1 — real-world events: `world-events.util.datedWorldEvents(presentYear)`. It exists, it is
orphaned, and it is already the right shape.** 56 events, each with label and aliases, converted to
offsets against the build's own present. It refuses on purpose: an `unsound` event (several episodes
under one name) and any name more than one event answers to are both left out, because a wrong base
is worse than an unresolved phrase. So "the Black Death" resolves and a bare "the war" does not —
`ambiguousEventNames()` is the list of names it will not choose between. **Wiring this is one line
and it is the only producer that needs no new extraction.**

**Source 2 — the story's own events: a deterministic index built by the sweep, which does not yet
exist.** "The year Jason vanished" can only be dated if the material dates that event somewhere
else: *"Jason vanished in 2019"*, or *"Jason vanished seven years before the film"*. So the index is
built by pairing an event NAME with a dated expression **in the same sentence** — the same window,
and the same conservatism, as Task 1's anchor pairing.

**THE NAME SIDE IS CONSTRAINED TO A REGISTERED ENTITY, or there is no event.** Free text beside a
date is not a name: *"She told Hale, seven years before, that…"* must not mint the event "She told
Hale". A candidate name is admitted only when it is already an entity in `entity-registry.util`
(`EntityKind` — `TIME_ANCHOR`, `ORG`, `OBJECT`, `PLACE`, `VESSEL`, `PERSON`) or a canon subject.
Anything else is dropped, exactly as `matchOption` drops an off-list genre, and the phrase stays
unresolved with its label — which §8 already says is a supported state. The registry is the same
second witness the traveller flag uses: a name the model proposes and the registry does not know is
not an event. The register and the canon are not sources:
they hold rules and statements, not a name→offset index, and mining them would need this same
extraction anyway.

**The model's part is labelling only (§3.4).** It may say which event a phrase refers to, choosing
from the list the sweep produced. It never emits a number, so it can never date an event — the
standing rule, unchanged.

**MEASURED 13 Sep, and it narrows Task 3a's scope: `sweepEras` does not find a bare event reference
at all.** "Before the war" and "The year Jason vanished" carry no number, so they produce no hit —
only a phrase with a distance and a missing base ("seven years before [the war]") comes back with
`offset: null`. So Task 3a is not merely *dating* known phrases: it must FIND them too, and the era
check's note can only speak for the ones the sweep returns. The note says exactly that and no more.

**What the check reports when the list is empty or a phrase stays unresolved.** Not silence, and not
a finding:

> *"Nine temporal expressions are anchored to events — 'before the war', 'the year Jason vanished' —
> and this build has no dated events for them, so they carry no offset."*

A **note**, in `data.eraCheck`, counted and quoted. An unresolvable phrase is not a defect in the
material (§8: it keeps its label, contributes no arithmetic, produces no findings) — but a check that
returned "no findings" while nine expressions went unread would be reporting silence as health, and
this system has already paid for that once.

---

## Task 4 — the ledgers partition by era (§4)

The blast radius Plan 01 named: `continuity.util.ts` and `scripton.service.ts`.

- `extractPlanState`'s `if (recalled) continue;` is **removed**; prop events, opened promises and
  state facts are keyed by `(era, scene)`.
- `propStateAt(events, scene, era)` filters to the scene's own era before folding.
- A fact carries an era **interval**; a scene at era E sees facts whose interval contains E; a null
  era is visible from every era (today's behaviour, and the safe default).
- Scene era assignment is **by id from the map** (§3.5); an id not in the map drops to null.
- The degradation test is the one that matters (§9): with era null everywhere, output is
  **byte-identical** to today's. That test is written first, before a line of Task 4.

---

## Task 5 — the page and the directive (§6), and the settings block (§7)

Deferred to Plan 04 and named here so this plan's scope stays honest: page markers, the
`spineDirective` era line, the Timelines settings block, the recommendation rows, the review panel
and its actions. All of them are frontend-and-prompt work that consumes Tasks 1–4.

**The naming rule binds from the first line of UI work:** the interface never says "era". The block
is **Timelines**; its anchor is **Present year**. `settingEra` remains a separate, orthogonal field
(§7.2) and `era` remains an internal name the user never meets.

---

## Task 6 — the scoped brief-field edit route (after Tasks 1–4)

- Allow-listed keys **only**, and the list is `FIELD_SPECS` from `brief-recommend.util.ts` — no
  second field list, for the same reason there is no second parser.
- Writes **only** `DevelopmentBuild.brief` for that `buildId`. Never the workspace intake row.
- Merges, never replaces; records the old value.
- `storyYear` is editable through it, which is how an `ASK` is answered.

---

## What this plan deliberately does NOT do

| Deferred | Why |
|---|---|
| The AI labelling pass (§3.4) | it chooses from the list the sweep produces; the sweep must be wired first |
| Page markers, `spineDirective` era line, settings block, review panel (§6, §7, §7.1) | Plan 04 — frontend, and they consume Tasks 1–4 |
| Invented calendars and story-years (§7.3) | display and settings; nothing here blocks it |
| Duplicate selves (§7.5) | expressible, not checked in v1, by the spec's own decision |
| `AgeResult` carrying "this scene was duplicated" (Plan 02's deferral) | a shape change with no consumer until Task 4 |

**Documentation drift to fold in (Plan 02's deferral):** the spec says `SETTING_ERAS` /
`COUNTRY_ERA_TIMELINES`; the code says `ERA_BANDS` / `COUNTRY_ERA_YEARS`. The spec claims a source
URL per row; `basis` is prose. Behaviour is unaffected — the names in the spec are corrected to the
code's, in the spec, in its own commit.

---

## Definition of done, Task 1 only

- [ ] `story-year.util.ts` + `story-year.util.spec.ts` exist. No existing file modified.
- [ ] Every ladder outcome has a test, including the two that must refuse rather than answer.
- [ ] The concession's three declared rows behave as tabled, and deleting the list flips all three
      to `ASK`.
- [ ] `storyYearForPrompt` returns a year for `COMPUTED` only; `ERA_MIDPOINT` returns null to a
      prompt and a year to a check.
- [ ] All six deliberate breaks tried, all six caught.
- [ ] `tsc --noEmit` clean; the suite's total rises by the number of new tests and `fail` stays at 2
      (the two PDF fixture failures, fixed in their own commit).
- [ ] Pushed alone.
