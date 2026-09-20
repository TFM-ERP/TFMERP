# Proposed lines for the findings document — V2.7 audit night, 14 Sep 2026

Three findings, written to be pasted into the one document. Numbers deliberately left off; the
document assigns them. Each states what was measured, on which row, and what it does not establish.

---

## A. A naive timestamp column compared against `now()` is four hours wrong, silently

`development_builds."createdAt"` — and every `createdAt` in this schema — is
`timestamp without time zone` holding UTC. The database session runs `TimeZone = Asia/Dubai`. So
`now()`, and any JavaScript `Date` passed as a parameter, arrives as +04 wall time and the comparison
skews by four hours in the direction that **hides recent rows**:

```
WHERE "createdAt" >= now() - interval '3 hours'                     → 0 rows
WHERE "createdAt" >= (now() AT TIME ZONE 'UTC') - interval '3 hours' → 2 rows
```

Same predicate, same instant, same table. The four-hour window that vanishes is exactly the window a
person asks about when they are investigating something that just happened.

**What it cost here.** Asked whether a second build row existed, the first form returned zero and I
came within one sentence of publishing *"there is no second build"* as a finding. The second build
existed, was nine minutes old, and was the row the whole question was about. A skew that hides only
the most recent rows is invisible to every query except the one that matters.

**Scope, checked rather than assumed.** No raw query in the service carries a date predicate, so
production is not affected today; Prisma's typed queries convert consistently and are not at risk.
This is a rule for anything hand-written against these columns — harness, migration, one-off, console
— and the correct form is `(now() AT TIME ZONE 'UTC')`, or an explicit UTC literal.

**A correction inside the correction.** The first diagnosis of this was "Prisma does not bind `Date`
parameters here" — tested by consequence (the query returned nothing) rather than by mechanism. That
is wrong and would have sent the next reader looking at the driver. The mechanism is the column type
and the session timezone.

---

## B. PROHIBITION's undroppability sits below the variance it exists to prevent

Two canon extractions of the same bible, four days apart, same extractor version 2, same
`CANON_FACT_CAP = 120`, sources differing by **one character**:

| | 10 Sep 11:44 | 14 Sep 20:11 |
|---|---|---|
| source chars | 105,179 | 105,177 |
| facts kept | 208 | 210 |
| register lines | 81 | 81 |
| **PROHIBITION** | **90** | **80** |
| ORDERING · CAUSATION · OUTCOME | 22 · 19 · 19 | 25 · 21 · 20 |
| RELATIONSHIP · LORE | 2 · 1 | 6 · 3 |

**Ten prohibitions differ, and the quota dropped nothing in either run** (`kept 208 / dropped 0`,
`kept 210 / dropped 0`). So the §36 guarantee held perfectly and bought nothing: PROHIBITION was made
undroppable so the quota could not discard it, and the loss is happening one level lower, in what the
extractor returns at all. A protection placed above the variance it exists to prevent is a guarantee
about the wrong stage of the pipeline.

**The account cannot tell the two apart.** `kept 210, dropped 0, shortfall ""` reads identically
whether 80 prohibitions exist in the material or 90 exist and 10 were missed. Nothing in the stored
account distinguishes *extracted everything there was* from *extracted everything it happened to
notice*, so the number cannot be used as evidence of coverage — only of what one pass produced.

This is not the ±2 noise of §34's 23/20/22. It is 11% of the largest category, from a source edit of
one character, in the category the register treats as undroppable.

---

## C. The canon key is the whole-source digest, so a one-character edit is a paid re-extraction

`sourceCanonFor` keys stored canon on a sha256 of the trimmed source text. Two builds whose bibles
differ by one character therefore hash differently, find no stored row, and extract from scratch.

Measured on 14 Sep: build `cmu1ocawn` (105,177 chars) created at 20:07:11, canon `ready` at 20:11:41
— **4m 30s and one 107,763-char / 29,103-token call**, while `cmu1o0xeh` (105,179 chars) reused the
10 Sep row in milliseconds with **zero** model calls.

**This is correct behaviour and should not be filed as a bug.** It is the price of fixing §34's
360-character key, which collided across genuinely different sources. The whole-digest key cannot
produce a false hit; what it cannot do is recognise that two sources are nearly the same. Anyone
editing a bible should expect the next build to pay for a fresh extraction, and any measurement
comparing fact counts across builds must check the digest first — the two rows above look like a
stability measurement and are not one.

---

## §48 — the control exists, and the defect did not fire. LATENT, not disproved

The recommender **did** run for `cmu1ocawn`: it runs on the FORM, before `createBuild`, which is why
its ledger row necessarily predates every build it shapes and cannot be attributed to one by
timestamp. That is its own small finding — a step whose output lands on a build but whose audit row
precedes the build's existence is untraceable to it by construction.

What the build's own brief holds, from that same save:

```
brief.researchSubject   0.75     (number)   — the recommender emits fractions, and jsonb keeps them
brief.realBased         false    (boolean)  — beside it, in the same object, from the same save
```

Because the jsonb brief demonstrably preserves a fraction when one is emitted, `realBased` sitting at
boolean `false` means **no fraction was ever offered for that field on this form**. The declarations
at `brief-recommend.util.ts:111-112` are identical in kind, so something upstream is typing two
identical declarations differently — and that asymmetry is the thing worth finding. §48 is recorded
**LATENT**: the control is established, the defect did not fire, and the flag was never put to the test.

The literal `"Based on a real story/subject"` (`:2312`) is absent from every captured prompt on both
builds. That is the correct behaviour for a falsy flag; it is not evidence that a fraction would have
been rejected.

## §45 — a second instance, on the typed columns beside it

The `intake_profiles` row for the workspace carries `realBased false` and `researchSubject true`
where the build's brief carries `false` and `0.75`. Those two column values are **exactly the schema
defaults** — `realBased Boolean @default(false)`, `researchSubject Boolean @default(true)` — which is
what a REJECTED save looks like, not a coerced one. Coercion and never-written cannot be told apart
from those two values alone, and the defaults are the simpler explanation. `updatedAt` does not decide
it: §51 established that the intake save and the research-notes write land on that same row with
different failure modes, so the timestamp proves a write, not which one.

An earlier draft of this line read the pair as coercion caught in the act. That was wrong; the schema
settles it, and this is the second instance of §45 with a stronger case than the first.

## Scope note on the Mystery result

`Mystery` is in `cmu1ocawn`'s genres, absent from the bible, appears **2× in all three stage prompts**
and **0× in all three bodies** — capital and lowercase, verified independently from the stored bodies.

That measures **delivery and echo**, and nothing else. A genre can shape prose without its name ever
appearing, so this is not a measurement of effect; establishing effect needs a paired run with the
chip removed and nothing else changed. Recorded as delivered-and-not-echoed.
