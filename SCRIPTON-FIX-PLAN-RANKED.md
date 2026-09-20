# ScriptON — the fix plan, ranked by what reaches the page

Written 15 Sep 2026 by Desktop Claude (spec-keeper). Companion to the generation-architecture
notes. Ranked by **effect on the screenplay**, not by how interesting the defect is to diagnose.

F0 was described in chat as "one line". That was wrong — see F0.2 below. Corrected here.

---

## F0 — Fix the recommender's type declarations. Two wins.

### What is wrong

`brief-recommend.util.ts:112` declares `realBased: { kind: 'number', min: 0, maxNum: 1 }`.
Everything else in the system says Boolean:

| place | says |
|---|---|
| `prisma/schema.prisma` | `realBased Boolean @default(false)` / `researchSubject Boolean @default(true)` |
| `scripton.service.ts:2312`, `:1591`, `knowledge/index.ts:33` | bare truthy tests |
| `ScriptOnIntake.tsx:136` | `realBased: true, realityLevel: 'INSPIRED', researchSubject: true` |
| `brief-recommend.util.ts:112` | `{ kind: 'number', min: 0, maxNum: 1 }` |

**Consequence one — the intake screen saves nothing.** Measured 15 Sep: 0 of 60 columns changed,
`updatedAt` frozen. The build survives only because `createBuild` copies the brief into jsonb,
which accepts anything.

**Consequence two — the model is told the story is real.** `0.25` is truthy, so
`'Based on a real story/subject; reality level = INSPIRED'` rides every prompt of an invented
thriller. `realityLevel` is not in the recommender's field list at all, so it defaults to the
middle claim. `researchAmount` is absent too and falls to the form default of 55, the middle band.
Two of the three dials feeding `realPersonDirective()` were never chosen by anything.

### F0.1 — Which fields can actually reject the row

Checked against the schema, for every field the 15 Sep save filled:

```
REJECTING (type mismatch, values actually emitted)
  realBased        Boolean   <- recommender emitted 0.25
  researchSubject  Boolean   <- recommender emitted 0.7

LATENT (Int column, 'number' kind with no integer constraint)
  researchAmount   Int
  researchDepth    Int       a fractional emission rejects the row the same way

PERMISSIVE (cannot have caused it)
  genres comps spine constraints researchScope blendLayers settingPlace settingWorld   Json?
  tone language country rating length treatment settingEra cultureEra
  projectIntent budgetTier realityLevel                                                String?
```

So the float-into-Boolean is not merely the strongest candidate — among the fields that were
filled it is the **only** type mismatch. Every other emitted value targets `Json?` or `String?`.

That still is not proof: a rejection could come from a constraint or a length rather than a type.
**The acceptance run settles it. Do not write "the §72 cause" into the commit message until the
re-save passes.** That caution is correct and it is yours.

### F0.2 — `kind: 'boolean'` does not exist

The kinds present are `enum`, `enumList`, `flags`, `number`, `text`, `textList`. There is no
boolean. So F0 is a declaration change **plus a new kind**, not one line. Add `boolean` to the
kind system properly — parser, validator, whatever coerces — rather than smuggling it through
`enum` with `['true','false']`, which would put strings into a Boolean column and reproduce the
defect in a new costume.

### F0.3 — The change

1. Add a `boolean` kind to the recommender's kind system.
2. `realBased`, `researchSubject` → `{ kind: 'boolean' }`.
3. `realityLevel` joins the field list as `{ kind: 'enum', options: ['FAITHFUL','INSPIRED','LOOSE'] }`
   — the column's own comment is `String? // FAITHFUL|INSPIRED|LOOSE`, so no new kind is needed.
   Map what the analysis means: mostly invented → `LOOSE`, essence-and-turning-points → `INSPIRED`,
   documented record → `FAITHFUL`. **`0.25` is not a weaker `true`; it is `LOOSE`.**
4. `researchAmount` joins the field list so the second fidelity dial is chosen rather than
   defaulted. Constrain it and `researchDepth` to integers — both columns are `Int`.
5. Log 4xx on the intake save route. A write that fails below the ≥500 logging floor is a write
   nobody can know failed.

### F0.4 — Acceptance

- §72's measurement run in reverse, on the same instrument: snapshot the whole `intake_profiles`
  row, re-save the Jason Quick intake, diff. **`updatedAt` moves and columns-changed > 0.**
- `realPersonDirective()` on that build emits the LOOSE text, not the INSPIRED text.
- **Negative control:** revert the declaration only, re-run, and the save must be rejected again
  with columns-changed back to 0. Without that, the test is measuring the save route, not the fix.

---

## F1 — The three stages that write the film are the starved ones

LOGLINE / SYNOPSIS / TREATMENT / BEATS get the 6,000-char excerpt **plus** canon facts **plus**
the register. **SCENES, STEP_OUTLINE and DRAFT get the register only** — ~3,000 tokens, no
excerpt, no canon facts.

The register is *rules*: names, prohibitions, ordering. It is not *texture*. A scene card composed
from rules alone is factually correct and generically written. The stages that determine every
line of the finished script work from the least material. **Largest quality lever in the system.**

**The cap argument does not forbid this.** `source-excerpt.util.ts` rejects widening the excerpt,
correctly — 105k chars × 8 stages × 130 scene calls. That is about the *whole source*. This is
not that. SCENES is **one call**, measured at 15,504 output tokens for 40 cards. Adding the canon
fact block — already built, already budgeted per stage — costs one block on one call.

**Design.**
- Promote `SCENES` and `STEP_OUTLINE` into the canon-fed class, keeping the per-stage quota and
  `UNDROPPABLE_KINDS` behaviour unchanged.
- `DRAFT` stays per-scene, but each call gets canon facts **filtered to the characters and
  location named in that scene card** — the card already carries `characters`. ~5 facts, not 169,
  and the cost is bounded by the card rather than by the source.

**Acceptance — REWRITTEN 17 Sep.** Primary: **Gideon's want reaches a SCENES prompt.** The canon row
exists and is named — F2 extracted 23 MOTIVE rows across 13 characters — so this is binary and
traceable to a specific row rather than arguable. The clause was originally written as F2's second
criterion; it belongs here, because F2 puts motive INTO the canon and F1 is what carries the canon to
the stage that writes the film. Measured before F1 lands: **the composed SCENES prompt contains
MOTIVE zero times and no canon facts at all.**

Secondary: a SCENES run whose cards contain at least one concrete detail traceable to a canon fact
absent from the register. **Negative control:** the same run with the canon block removed must fail
both checks, or the test is measuring the register.

---

## F2 — Nothing in the canon can hold what a character wants

`CanonKind` has no kind for motive. A bible section headed "His desire" / "His need" has nowhere
to land, and motive reaches a prompt only through `spine.want` / `spine.need` — **one character,
and an intake field rather than an extraction.**

Gideon, Alexander, Nora, Musa and the MacRaes have motives written on the page that the extractor
has no slot for. An ensemble whose antagonist has no stated want writes as a plot function.

**Design.** Add `MOTIVE` to `CanonKind`; extract per named character; one sentence of want and one
of need per principal. On a 6–9 principal bible that is under twenty lines, so it can be
undroppable for characters present in the stage without disturbing the quota.

**Acceptance — CORRECTED 17 Sep, and the correction is the spec-keeper's error, not the builder's.**
The original second clause — *"Gideon's want present in a SCENES prompt"* — asked for a delivery path
that **this same document's F1 section says does not exist**. The criterion contradicted the plan two
sections earlier. Same class as the `updatedAt` criterion misruled on 14 Sep: a test that assumes a
data path that is not there. Mis-specified, not failed; the clause now lives in F1.

F2's acceptance is **extraction** — MOTIVE extracted, kinded, quota'd, requested in the prompt and
stored. **PASSED:** 23 rows across 13 characters, all four named principals present.

Two results worth keeping. The pre-registered partial outcome was **refuted** — Alexander returned
two wants, so the extractor does not favour characters who act; it reads stated wants out of
exposition. And the extraction gave wants to exactly the three characters a reading of the V2.9 prose
had already flagged as playing like functions: Gideon, Vex, Musa. Vex's need — *"to include her own
conduct in the evidence she gives up"* — is the climax turn called under-motivated. The motivation
was in the bible the whole time; the system had nowhere to put it. Two independent routes, same three
names.

---

## F3 — The creative brief can carry another project's tone

`briefFor` was scoped to the build at `a169208`. `intakeSteer` was not — it still reads the shared
workspace row, so genres, tone, market and setting in the CREATIVE BRIEF block of **every** prompt
may belong to a different build. Twenty-six builds share that row.

Not hypothetical: on V2.6 a 770-char paste of a browser error message produced
`settingEra: "Present day — contemporary software development"` on a maritime thriller.

**Design.** `intakeSteer` resolves through the same path as `briefFor` — build brief first, never
the workspace when a `buildId` is present, field by field in the manner of `resolveSpineField`.

**Acceptance.** Two builds on one project with different genres; each stage prompt gets its own
build's genres, and a build missing the field gets nothing rather than its neighbour's value.

---

## F4 — One number unlocks 170 KB that is already built

**CORRECTED 17 Sep — the premise below was stale and F4 is roughly half built.** "No call site
outside the era family" was true when the architecture notes were written on 12 Sep; `sweepEras`
acquired one at `scripton.service.ts:3270` when the era check landed. And `story-year.util.ts`
already implements the whole get-the-number ladder: `resolveStoryYear` with provenance
`COMPUTED | ERA_MIDPOINT | DEFAULTED_PRESENT | ASK`, persistence with an `inputsSha` staleness key,
`storyYearForPrompt` (COMPUTED only) and `storyYearForCheck`, wired at `:3215`.

What remains is two things, not a 170 KB wiring job: (1) `storyYear` is not in `FIELD_SPECS`, so the
recommender never emits it and `COMPUTED` can only arrive from `datingPairs` finding an absolute year
in the prose — which on this material has never happened (ten bodies, four builds, zero absolute
years; V2.9 resolved `DEFAULTED_PRESENT` even carrying real era prose); and (2) nothing composes the
stratum table into any prompt, which is the payoff.

**RULING on provenance, because the fix can launder it.** Asked for a year on a source that says
"present day", the recommender will INFER the current year — and that inference must not arrive as
`COMPUTED`. `COMPUTED` means the material stated it. An inference routed through the recommender is
`DEFAULTED_PRESENT` wearing a better badge: the `realBased: 0.25` shape again, a value that looks
better-attested than it is because of the path it travelled. **Provenance describes what the MATERIAL
said, never which component supplied the number.**

For Jason Quick, `DEFAULTED_PRESENT` is the correct and sufficient answer — the story is present-day
and its strata are relative to now. **The number does not need to be extracted, it needs to be
stated.** Once 2026 exists, 2019 and 2018 resolve and the table can be composed. That is the whole
dependency.

**Get the number, in order.**
1. The recommender emits `storyYear: number` beside its `settingEra` prose — the same inference,
   typed instead of narrated. Provenance `COMPUTED`.
2. Fallback: `parseYear` / `parseEraPhrase` over the prose. Provenance `ERA_MIDPOINT`.
3. Last resort: current year, provenance `DEFAULTED_PRESENT`, said on the build's face.

**Then the payoff, which is larger than report-only wiring.** With a year, `sweepEras` resolves
every relative phrase to an absolute one. Compose a **stratum table** into the prompts of the
stages that write time:

```
PRESENT    2026
STRATUM A  2019   seven years earlier   the dock betrayal
STRATUM B  2018   eight years earlier   <as the source states>
```

…with the instruction: *slug a scene with its stratum label; never compute the offset yourself.*

This removes the arithmetic from the model rather than checking it afterwards. The V2.6 defect —
a flashback slugged `(EIGHT YEARS EARLIER)` that should read seven — happened with all 81 register
lines in the prompt, including the one stating the arithmetic in words. More checking would not
have caught it. Not asking the model to subtract will. It also matches professional practice for
multi-stratum scripts: one fixed label per stratum, established once, rather than recomputing at
each cut.

**Keep** report-only `sweepEras` over finished stages as the backstop, in the three-state shape
(FINDINGS / NO FINDINGS / NOT RUN) the register and keep checks already use.

**Acceptance.** `storyYear` present with provenance; the stratum table in the SCENES prompt; a
deliberately contradictory body produces a FINDINGS row. **Negative control:** a build with no
resolvable year reports `NOT RUN` with a reason, not silence.

---

## Tier 3 — plumbing

| | |
|---|---|
| Nothing guards stage **order** | `startStage` keys on `(projectId, buildId, kind)` — refuses a concurrent *same* stage, knows nothing about two different ones. SCENES has been generated against a build with no BEATS; afterwards the ladder looks ordinary. |
| `subMix` never reaches the backend | The Subgenre "how much, and how intense" mixer is inert. |
| Ending and Style unset at intake | Both are written into the brief and honoured at the climax; both default empty, so fixed material the draft could be held to is simply absent. |
| `ERROR` is an attempt count | Provider failover writes one row per attempt; a failure rate read off that column is wrong. |
| No Cape Breton, no Boston | The accent list covers neither place this story lives in. |

---

## Order of execution

**Amended 17 Sep, after the V2.9 pages came back. Supersedes the order above.**

**F0 → F3 → F2 → F1 → F4.** F2 and F1 have swapped.

F0 and F3 are done and committed locally (`3a5a1e1`, `76b8e57`), unpushed.

**Why F2 moved ahead of F1.** Not a code finding — a reading of the first complete ladder this
system has produced. In the V2.9 output Gideon, Vex and Musa all read as functions rather than
people, and Vex's entire climax turn rests on paperwork she reads off-screen. That is the missing
`MOTIVE` kind showing up as a craft problem before it was fixed as a code one. F1 changes **who
receives** the canon; F2 changes **what is in it**. Feeding richer material to the writing stages
lands harder when the material includes what people want, so F2 goes first.

**F3 and the §67 pair regeneration are demoted, not cancelled.** F3 is landed. The pair
regeneration buys *proof* that direction helps; V2.9 with FAITHFUL set from the first stage has
already shown that in pages. It is not worth blocking F1 and F2 behind ten stage calls. §67's
corrections in the findings document stand without a rerun.

**Half B of F0's acceptance runs itself.** The next time any build is begun, `saveIntake` fires
with a boolean `realBased`. Snapshot `intake_profiles` before and diff after — no build is made
for the test.

### The extractorVersion bump, ruled 17 Sep

F2 changes three of the four things `canon-prompt.util.ts:97` says require a version bump, so the
bump is correct. But state the reason accurately: **stored canons are not wrong, they are
MOTIVE-less.** Re-extraction is the feature arriving, not a tax.

**Capture before bumping, and capture wider than the pair.** Export **every** `source_canons` row
for the workspace verbatim to `captures/` first — not only the §67 pair's two. The bump is a
one-way door: once `extractorVersion` moves, the old rows are unreachable by key and §67's 81-line
register can never be re-read, nor can the canon behind the V2.9 pages that have just been
reviewed. One query preserves all of it as evidence even though none of it can be re-run.
