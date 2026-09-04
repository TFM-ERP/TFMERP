# ScriptON — The Timeline Axis

**Status:** design agreed, not built · **Date:** 3 Sep 2026
**Companion docs:** `SCRIPTON-SOURCE-LAYER-SPEC.md`, project memory `scripton_plan_spine.md`, artifact §02/§03
**Supersedes:** the boolean `recalled` flag introduced with the plan-time state spine (2 Sep)

---

## 0 · Why this exists

A screenplay runs on two clocks and this engine has only ever had one.

Narratology separates **fabula** — the order events happened in the story world — from **syuzhet**,
the order they are told in. Every state fact in ScriptON is anchored in `sceneOrder`: `validFrom`,
`validTo`, `propStateAt`, the clock. That is syuzhet. It has been standing in for fabula, and that
substitution *is* the flashback defect, stated in one sentence.

The 2 Sep spine papered over it with a boolean. `recalled` says a scene is a memory; it cannot say
*which* memory. Three guards read it and all three simply stand down:

| Guard | Behaviour when `recalled` |
|---|---|
| `checkClockRegression(tokens, recalledScenes)` | the scene is skipped entirely |
| `spineDirective(..., recalled)` | vocabulary only — no clock, no props, no facts |
| `extractPlanState` | `if (recalled) continue;` — no prop events, no opened promises |

That was the right first fix: it stopped a real false positive, where a flashback showing an object
destroyed eighty scenes later read as a contradiction. But it bought correctness with coverage.

### The measured shape of the problem

A four-stratum history — twenty years before, fifteen to ten, seven, and the present — collapses
into one flag. Consequences, exactly:

- **No checking inside the backstory at all.** Two scenes both set seven years ago may contradict
  each other freely. An object destroyed in one and intact in the other is invisible.
- **No ordering.** Nothing knows −20 is earlier than −7.
- **No arithmetic.** A character stated as 27 at −7 is 34 in the present and 14 at −20. A scene
  putting the adult at the −20 table passes in silence. This is the drift the feature is named for.
- **Thin flashbacks.** This one is not a checking failure. `spineFor` hands a memory *vocabulary
  only*, so backstory scenes are written with no clock, no props and no facts. The era axis is a
  generation-quality change first and a detection change second.

### The insight the design rests on

**The false positive came from comparing a memory against PRESENT-DAY state.** Era is exactly the
distinction that was missing. Scope the comparison to an era and the checks return without the
false positive returning with them.

---

## 1 · Prior art, and what was taken from it

| Source | Taken | Refused |
|---|---|---|
| [ISO-TimeML](https://timeml.github.io/site/publications/timeMLdocs/timeml_1.1b.htm) | `anchorTimeID` — a relative expression resolved against one declared reference time. This is `storyYear`. Also `TIMEX3`'s treatment of DURATION and INTERVAL as first-class. | `SLINK` (modality/factives). "Presumed dead" is a belief, not a fact, and modelling that properly is a separate subsystem. Out of scope. |
| [Allen's interval algebra](https://en.wikipedia.org/wiki/Allen%27s_interval_algebra) | The interval framing — a fact holds over a span, not at a point — and three relations: before, after, during. | The other ten relations and the composition table. Allen infers an *unknown* ordering from constraints; NP-hard in general, 2.2M relations at n=5. **The timeline document states the order.** Paying for machinery that derives an answer we were given is over-engineering. |
| [SUTime](https://nlp.stanford.edu/pubs/lrec2012-sutime.pdf) (Chang & Manning) | The finding that *"most temporal patterns can be captured effectively with rules"*, with probabilistic models needed only for disambiguation. This is the whole justification for §3. | SUTime itself — Java, and the dependency freeze holds. We implement the model, not the library. |
| [Story Sense format guide](https://www.storysense.com/format/flashbacks.htm) | The two accepted page forms: `(FLASHBACK)` on a single heading, `BEGIN FLASHBACK:` / `END FLASHBACK.` around a sequence. | Nothing — but note the guide covers no notation for *which* of several eras. Hence §6: the era lives in the plan; the page gets a marker. |
| [Sudowrite multi-timeline guidance](https://sudowrite.com/blog/writing-multiple-timelines-ai/) | "One Story Bible entry per timeline, **not per character**" — organise state by era. Independent corroboration of §4. | — |

---

## 2 · The model

```
    syuzhet ──────────────────────────────────────────────►   sceneOrder, unchanged
      1    2    3    4    5    6    7    8    9   10   11

    fabula  ─────────────────────────────────────────────►   era, new
      0   -7    0    0  -20  -20    0  -7    0    0    0
```

**`era`** — a signed offset in **days** from the story's present, or `null` when unresolved.

- Days, not years, because the unit must serve a story whose strands are a week and a day as well as
  one whose strands are decades. One number, no unit vocabulary, precise from minutes to centuries.
- **Conversion is `days = round(years × 365.25)`, rounding half AWAY FROM ZERO.** This is not
  pedantry: a decade is exactly 3652.5 days, so every even decade lands on a half and the rounding
  rule decides the value. Left unstated, one implementation gives −3653 and another −3652 for the
  same phrase, two timelines appear where the writer wrote one, and the feature quietly fails at
  precisely the round numbers a history is most likely to use. Away-from-zero also keeps the axis
  symmetric, so a flash-forward of ten years is +3653 against a flashback's −3653.
  This spec's own draft had −3653 and −3652 in different places; the self-review caught it.
- **Signed**, so flash-forwards are expressible. The 2 Sep model could not represent one.
- `null` behaves exactly as `recalled: true` does today, so every failure path degrades to the
  current, known-safe behaviour.

**`storyYear`** — the anchor. What the present *is*.

- Set in the Timelines block; **defaults to the current calendar year**.
- **Frozen into the build's brief at creation.** If it were recomputed, a build made today and
  re-run in January would shift every era by a year — the exact drift being fixed. A number that
  cannot say where it came from is a number nobody can audit.

**`place`** — each timeline also carries a location, because the absolute page marker is not a year
but a **place and a year**: `LONDON, 2019`. This needs no new extraction. `extractPlanState`
already emits a `region` per scene, so once era exists the marker composes from data that is
already there.

- A timeline's `place` is the **plurality region** of the scenes assigned to it, or a place stated
  in the material for that period. It is the period's home: *"the −20 years live in Montevideo."*
- A scene whose own region differs from its timeline's uses **its own** — a stratum may travel.
- The place is for **markers, the review map and the directive**. It is never a check: periods move,
  and flagging a scene for leaving its period's home would be a false positive by construction.

**Derived, never stored twice:** the absolute year (`storyYear + era/365.25`), the page marker, and
"is this a flashback" (`era < 0`). **`recalled` is retired as a stored flag.**

**Scenes carry an era POINT. Facts, props and promises carry an era INTERVAL.** A fact true from −15
to −10 is not true at −20. Point-eras cannot express that, and the source material is full of it
("Fifteen to ten years before the film…").

**Inside a timeline, `sceneOrder` still rules.** Two scenes both at −7 are not simultaneous. Era
governs only comparisons *across* timelines.

---

## 3 · Extraction — rules find numbers, the model only labels

Three stages, in this order. The ordering is the reliability argument.

### 3.1 Deterministic sweep (no AI)

`era.util.ts` scans the material for temporal expressions and normalises each to an offset:

```
"Twenty years before the film"       → { from: -7305, to: -7305 }   (-20y)
"Fifteen to ten years before"        → { from: -5479, to: -3653 }   (-15y … -10y)
"about seven years ago"              → { from: -2557, to: -2557 }   hedge discarded
"2019"        (storyYear = 2026)     → { from: -2557, to: -2557 }
"18 months before"                   → { from:  -548, to:  -548 }
"the present" / "now"                → { from:     0, to:     0 }
```

Word and digit forms both, tens+unit ("twenty-seven"), ranges before singles — a range pattern must
be tried first or the single pattern matches the second number alone and silently narrows the span.

**An expression that does not resolve returns null.** The stratum survives with its label and no
offset: it can still be named on the page, contributes no arithmetic, and produces no findings.

### 3.2 Timelines are exact normalised values

**No tolerance constant, no clustering algorithm.** Two expressions that normalise to the same
offset are the same timeline; two that do not, are not.

Considered and rejected: a ±1y merge tolerance (an invented constant, and wrong for a 7-year story
and a 300-year story simultaneously) and natural-breaks clustering (solves a problem good
normalisation removes). If the writer said "seven" in one place and "eight" in another, those are
two moments and merging them overrides the author.

**But loose material can still proliferate**, and the recourse belongs on the review panel as an
ACTION, not in the settings as a rule — see §7.1. A constant nobody can defend is replaced by a
judgement the author is uniquely able to make.

### 3.3 Event-anchored expressions — a second pass

*"the year Jason vanished"* is anchored to an **event**, not to the present, and cannot be resolved
until that event has an era. So: place all numeric expressions first, then resolve event-anchored
ones against them. Deterministic. Unresolvable stays null.

### 3.4 What the AI does

Only what rules cannot: **which stratum does this paragraph belong to**, and which characters and
ages it states. The model never emits a number, and never invents a timeline — it chooses from the
list §3.1 produced. This is the rule `brief-recommend.util.ts` already proves: *a value outside the
supplied list is dropped, never approximated.*

### 3.5 Scene assignment

The planner assigns each scene an era **by id, from the map**. An id not in the map is dropped to
null — the same refusal `matchOption` performs on an off-list genre.

### 3.6 Age anchors

`{ name, age, era }`, and **only from a stated age**. "Jason, twenty-seven" inside the −7 stratum
fixes a birth year and therefore an age at every other era. An age nobody stated is never inferred;
a character with no anchor is never reported. Absence of evidence is not a defect.

---

## 4 · State ledgers partition by era

`extractPlanState`'s `if (recalled) continue;` is removed. Prop events, opened promises and state
facts are keyed by `(era, scene)` instead of being discarded.

- `propStateAt(events, scene, era)` filters to the scene's own era before folding.
- A fact carries an era **interval**; a scene at era E sees only facts whose interval contains E.
- Facts with a null era are visible from every era — the safe default, and today's behaviour.

This is what restores checking inside the backstory without reintroducing the cross-era false
positive, because no comparison ever spans two eras unless a check asks it to.

---

## 5 · Checks — and what is deliberately NOT a check

### Findings

| Check | Fires when | Why it is sound |
|---|---|---|
| `ERA_AGE_DRIFT` | a character is written at an age the previous anchor contradicts by more than **1 year** | tolerance is one year because a birthday inside the year is not drift. Only anchored characters, and the mismatched age **becomes the new anchor**, so one wrong number is one finding (§7.5). |
| `ERA_AGE_IMPOSSIBLE` | a traveller's stated age fits **neither** having jumped **nor** having lived the interval | both readings are computed and both are refuted by the page. Traveller worldlines only — unreachable in an ordinary story (§7.5). |
| `ERA_FACT_OUT_OF_WINDOW` | a scene at era E asserts a fact whose era interval excludes E | catches "Vex is loyal to Gideon" at −20, four years before he paid for her education |
| `ERA_INVENTED` | a scene carries an era id absent from the map | the planner invented a timeline. Two witnesses disagreeing. |
| `ERA_MARKER_MISMATCH` | the page marker names one era, the plan says another | third member of the `findFlashbackMismatches` family |
| `ERA_MARKER_INCONSISTENT` | two scenes in the **same** timeline print **different** years | cheap, deterministic, and unambiguous — one period cannot be two years. Place may differ between them; the year may not. |
| `ERA_SELF_REFUTING` | the map implies a negative age, or a stratum ordered against itself | arithmetic falsifies the map before a word is written |
| `ERA_ANCHOR_CONFLICT` | two absolute/relative pairs imply different present years | the material dates its own history two incompatible ways. Deterministic, and it fires before generation. |

### Notes, not findings

**A stratum with no scenes is NOT a defect.** Most backstory is referred to and never dramatised.
Flagging it would repeat the PLACE_JUMP mistake — nine findings on a draft containing none. It is
reported as a note: *"Three of your four periods are referred to but never shown."* Useful to a
writer deciding what to dramatise; not an error.

### The standing rule

> **No number in this system may have a single AI pass as its only witness.** Numbers come from
> code. AI judgements are either checked against a second independent reading, or falsifiable by
> arithmetic, or both.

---

## 6 · The page, and what the writer is told

Standard format has **no notation for which of several eras a scene belongs to**. `(FLASHBACK)` and
`BEGIN FLASHBACK:` mark *that* it is a memory, never *when*. So the era lives in the plan and
reaches the page as a marker.

`spineDirective` gains the era and stops being silent for memories:

```
PERIOD: this scene is set in 2019, seven years before the present of the film.
        Jason is 27 here. Vex's father is alive.
MARK IT: open the sequence with BEGIN FLASHBACK: and close it with END FLASHBACK.,
        or head the scene with a dated title — SEVEN YEARS EARLIER.
```

Consecutive scenes sharing an era are told to use the **sequence** form rather than repeating
`(FLASHBACK)` on every heading — which is what the format guide actually prescribes and what the
2 Sep directive did not know to say.

**Marker style** — relative, absolute, or auto.

| Style | Renders | Composed from |
|---|---|---|
| relative | `SEVEN YEARS EARLIER` | the era offset alone |
| absolute | `LONDON, 2019` | the scene's region (falling back to its timeline's place) + `storyYear + era` |
| auto | either | absolute when `storyYear` was set, relative when it was defaulted |

Auto's rule is a consequence, not a preference: a year **you** supplied is meaningful to an audience
and belongs on screen; a year **we** assumed carries no information beyond the distance, so the
distance is what should print.

A timeline with no resolvable place falls back to the year alone (`2019`), and one with no
resolvable year falls back to the relative form. Neither ever prints an empty half — the same rule
as the trace footer: a marker composes only the parts it actually has.

---

## 7 · The Timelines settings block (From-scratch tab)

| Setting | Default | Behaviour |
|---|---|---|
| **Timelines** | **off** | Switches itself **on** when the sweep finds two or more timelines, and says what it found. Soft — you can switch it back off, and then normal scene generation handles the story as it does today. |
| **Present year** | current calendar year | The anchor. Frozen into the build at creation. |
| **Review detected timelines** | on when ≥ 2 | Shows the map — **period, year, place, and the ages it implies** — before the build. The only defence against a map that is *self-consistent and simply not your story*: arithmetic cannot catch that, and neither can a second AI reading. |
| **Page markers** | auto | relative / absolute / auto, per §6. |

Deterministic extraction, cross-checking and arithmetic falsification are **not settings**. Their
off-positions are strictly worse and no one should pick them; a toggle nobody should switch is
decoration.

### 7.0 · The settings are RECOMMENDED, not just defaulted

Every setting in the block is soft-selected from the material by the pass that already exists.
`brief-recommend.util.ts` recommends form fields with a required reason and refuses anything outside
the supplied options; **the Timelines settings are simply more fields in `FIELD_SPECS`.** No new
subsystem, and they inherit both safety rules unchanged — no reason, no recommendation; off-list,
dropped.

#### The anchor is DERIVED, not defaulted, whenever the material allows

This is the strongest result in the design and it costs one line of arithmetic.

When the material states the same event both absolutely and relatively — *"In 2019, Jason was
attacked"* and *"seven years before the film, Jason was attacked"* — the two together fix the
present:

```
    storyYear = absoluteYear − eraOffsetYears
              = 2019 − (−7)
              = 2026
```

So `storyYear` becomes **evidence rather than a default**. And because the arithmetic can be run on
every such pair the sweep finds, disagreement is detectable: two pairs implying different presents
means the material contradicts itself, reported as `ERA_ANCHOR_CONFLICT` before a word is written.

Falling back to the current calendar year happens only when no pair exists — an honest default of
last resort, not the first choice.

#### What is recommended, and on what evidence

| Material contains | Recommendation | Reason shown to the user |
|---|---|---|
| no temporal language at all | **Timelines off** | "No periods found in your material." |
| relative phrases only ("seven years before") | **on**; anchor = current year; markers **relative** | "Your material measures backwards from the present and never names a year, so the distance is what an audience can be told." |
| absolute years only (1987, 1994) | **on**; anchor = latest year mentioned; markers **absolute** | "Your material dates its events, so the year is meaningful on screen." |
| both, on the same event | **on**; anchor **computed** by the arithmetic above; markers **absolute** | "1987 and 'seven years before' describe the same event, which puts the present at 1994." |
| both, disagreeing | **on**; anchor left for the user; `ERA_ANCHOR_CONFLICT` raised | "Two datings of your history disagree — 1994 and 1996. Set the present year yourself." |
| a character described as moving between periods | **on**; that character marked a **traveller** (§7.5) | "Jason moves between 1994 and 1974, so his age is counted along his own path rather than by the year of the scene." |

Every row points at something in the material. A recommendation that cannot name its evidence is
not made — the rule the Brief already runs on.

#### Where the traveller flag comes from

It is a **label, not a number**, so §3.4 permits the model to propose it — and the standing rule
still applies, so it needs a second witness. The second witness is **structure**: a proposed
traveller must have at least one backwards step or one marked arrival in his own appearance
sequence. A "traveller" who never moves against era is not one, and the flag is dropped exactly as
`matchOption` drops an off-list genre. The user can also set or clear it on the review panel, and
that setting always wins.

Recommendations are **soft**: pre-filled, overridable, each with its own *See why*, and Undo
restores the defaults. Nothing is locked and nothing blocks the build.

### 7.1 · The review panel — actions and disclosures, not more settings

The panel already shows period / year / place / implied ages when there are two or more timelines.
Everything below lives there, so the settings block stays at four and the controls sit next to the
information they act on.

**Actions**

| Action | Offered when | Effect |
|---|---|---|
| **Merge these periods** | two or more timelines sit within a year of each other | folds them into one. Offered per PAIR, never applied by rule — the author knows whether "seven" and "eight years ago" are one moment described twice. |
| **Split** | a merged period is reopened | restores the normalised values. Merging is never destructive. |
| **Mark as backstory only** | any period | *referred to, never shown.* Silences the zero-scene note honestly rather than suppressing it, and the directive can then tell the writer this history is spoken about, not dramatised. |
| **He jumped home / He lived those years** | a traveller's move forward reaches the era he left from and the script does not say which it was (§7.5) | resolves that one step. Until it is answered the calculator returns unknown for the scenes after it — no age directive, and deliberately no finding. |
| **Set the present year** | the chosen era is a `±±` row whose anchor was refused (§7.4.1) | fills the anchor the map would not guess. Offsets, timelines and ages all work meanwhile; only the printed year waits. |

**Disclosures** — said plainly, once, where the map is read:

| Note | Raised when |
|---|---|
| *"Nine periods found, four within a year of each other. If those are one moment described loosely, merge them here."* | the map is dense relative to its own span |
| *"Three of your four periods are referred to but never shown."* | strata with no scenes assigned (§5) |
| *"This material describes its strands by duration — 'over a week', 'across one day'. The timeline axis models distance from the present, not converging spans of different length, so those are carried but not understood."* | duration-shaped strand language is detected (§10) |
| *"'Ibadi Imamate' covers eight separate imamates over 1,200 years — there is no typical year. Set the year you mean."* | the chosen era is a `±±` row (§7.4.1) |
| *"Dated 1750–2026; the modern-era boundary is disputed. Change it if you mean otherwise."* | the chosen era is a `~` row (§7.4.1) |
| *"Your material dates a scene to 1400; Morocco's era list jumps from 1269 to 1956, so no period covers it. The scene keeps its year."* | a dated scene falls in one of the map's 34 coverage gaps (§7.4.2) |

The third is a **limit disclosed, not a feature offered.** It exists because an honest "this is not
understood" beats a confident wrong answer, which is the rule the whole suite runs on.

---

## 7.2 · Not duplicating the era fields that already exist

The Brief already has `settingEra` — `SETTING_ERAS` in `taxonomy.ts`: *Ancient (pre-500 AD)*,
*Medieval (500–1500)*, *Contemporary*, *Far future* — with `eraOptionsFor(country)` supplying
country-specific timelines. **This is not the same axis and must not look like it.**

| | `settingEra` (exists) | `era` (new) |
|---|---|---|
| Answers | *where in history the story's present sits* | *how far back from that present this scene sits* |
| Cardinality | one, for the whole story | one per scene |
| Values | a period of real history | a signed offset |

They are orthogonal, and dangerous only in the naming. **The new block never uses the word "era" in
the interface.** It is *Timelines*; its anchor is *Present year*. `era` remains an internal field
name the user never meets. A form with two things called era is a form nobody can reason about.

### `settingEra` DERIVES the anchor

Not merely non-conflicting — cooperating. Defaulting a Medieval story's present year to 2026 is
absurd, and "default to now" produces exactly that. So the anchor falls back in this order:

1. **computed** from an absolute/relative pair in the material (§7.0)
2. **the midpoint of `settingEra`** — Medieval (500–1500) → 1000; 19th century → 1850
3. **the current calendar year**, only when the era is Contemporary or unset

Row three of the recommendation table gains: *"You set this in the Medieval period, so the present
is taken as around 1000 — change it if your story is more precise."*

## 7.3 · Invented calendars and deep time

### Invented worlds

A fantasy world may reckon time its own way — *Year 4025 of the Empire*, *the Second Age* — and two
things follow.

**Arithmetic still works.** 4025 is a number; offsets from it behave identically. Nothing special is
needed to *compute*.

**But the day conversion does not apply.** `days = round(years × 365.25)` assumes a Gregorian year.
An invented calendar's year is whatever the story says it is. So for an invented world the unit is
**story-years**, no conversion is performed, and **sub-year precision is unavailable** — disclosed,
not silently wrong, the same rule as §10. Invented calendars in practice never need "three days
before"; they need "two ages ago".

**And absolute markers are recommended OFF.** `LONDON, 2019` works because the audience knows what
2019 means. *ELDORIN, 4025* means nothing on first sight and misleads by looking precise. So when
the world is invented — the form already knows, via `settingWorld`, `fantasyOn` and
`mythicalElements` — the recommendation is **relative markers**, on the evidenced reason that an
invented year carries no information to an audience until the story establishes one.

### Deep time — two thousand years back

Manageable, with two specifics that must be got right or the output is wrong rather than merely
coarse:

**BC years, and the missing year zero.** With a present of 500 and an offset of −2000, the absolute
year is −1500 — which must print as **1501 BC**, not "−1500". The common era has no year 0, so the
conversion is `bc = 1 − astronomicalYear`. Getting this wrong puts every ancient marker one year out,
which is exactly the silent, confident error this design exists to prevent.

**Markers beyond the word table.** "TWO THOUSAND YEARS EARLIER" needs no spelled-out form —
past twenty, digits are clearer and the marker falls back to `2,000 YEARS EARLIER`.

**Age checks simply never fire** across such spans, because no character has an anchor on both sides
of two millennia. That is the correct behaviour and needs no special case: absence of an anchor is
already absence of a check.

## 7.4 · The era → year map

`settingEra` can derive the anchor only if the chosen era has a year. So the era list needs a map —
and the standing rule applies: **a constant that cannot say where it came from is a constant nobody
can audit.** Every row below is sourced. The implementation file carries the source URL per row;
this table carries the clause that fixes the boundary.

### The generic bands (`SETTING_ERAS`, 9 options)

| id | Label as shown | Range | Anchor |
|---|---|---|---|
| `ancient` | Ancient (pre-500 AD) | −3000 – 500 | −1250 |
| `medieval` | Medieval (500–1500) | 500 – 1500 | 1000 |
| `early-modern` | Early modern (1500–1800) | 1500 – 1800 | 1650 |
| `19c` | 19th century | 1800 – 1900 | 1850 |
| `early-20c` | Early 20th century | 1900 – 1940 | 1920 |
| `mid-20c` | Mid-century (1940s–70s) | 1940 – 1979 | 1960 |
| `contemporary` | Contemporary | — | current calendar year |
| `near-future` | Near future | +10 … +50 | current + 25 |
| `far-future` | Far future | +100 … | current + 150 |

Six of the nine **state their own range in the label the user already reads** ("Medieval (500–1500)"),
so those rows record what the UI has always claimed rather than inventing anything. `ancient` is the
exception: its label gives only an upper bound, and −3000 is chosen as the lower because that is
where the app's own deepest country rows begin. The three forward bands are offsets from the frozen
`storyYear`, not fixed years, so they never go stale.

### The country timelines (`COUNTRY_ERA_TIMELINES`, 91 rows across 26 countries)

Astronomical years; negative is BC. **Anchor is the midpoint**, `round((start+end)/2)` rounding half
away from zero — the same rule §2 fixes for day conversion, applied here so a boundary year never
lands on two different anchors depending on which code path computed it.

Flags: blank = uncontroversial · `~` = a boundary genuinely disputed by more than ~50 years ·
`±±` = **the label itself will not carry an anchor** (it bundles polities of different dates, or its
identification is not established). What the flags *do* is §7.4.1.

| Country | Era label | Start | End | Anchor | Fl | Basis |
|---|---|---:|---:|---:|:--:|---|
| Egypt | Pharaonic | −3100 | −332 | −1716 | ~ | Unification / 1st Dynasty to Alexander's conquest |
| Egypt | Ptolemaic / Greco-Roman | −332 | 641 | 155 | ±± | Alexander through Ptolemaic and Roman/Byzantine rule to the Arab conquest |
| Egypt | Coptic | 300 | 641 | 471 | ~ | Christianisation of Egypt to the Arab conquest |
| Egypt | Arab-Islamic | 641 | 1517 | 1079 |  | Arab conquest 639–642 to Selim I's conquest 1517 |
| Egypt | Ottoman | 1517 | 1798 | 1658 | ~ | Ottoman conquest to Napoleon's invasion |
| Egypt | Modern Egyptian | 1805 | now | 1916 |  | Accession of Muhammad Ali |
| Iraq | Sumer / Akkad / Babylon | −4000 | −539 | −2270 | ±± | Uruk-period Sumer to Cyrus's capture of Babylon |
| Iraq | Abbasid Baghdad | 762 | 1258 | 1010 |  | al-Manṣūr founds Baghdad to Hülegü's sack |
| Iraq | Modern Iraq | 1920 | now | 1973 |  | British Mandate / creation of the Iraqi state |
| Greece | Classical | −480 | −323 | −402 |  | End of the Persian Wars to Alexander's death |
| Greece | Hellenistic / Koine | −323 | −30 | −177 | ~ | Alexander's death to Rome's conquest of Egypt |
| Greece | Modern Greece | 1821 | now | 1924 |  | War of Independence 1821, sovereignty 1830 |
| Britain | Anglo-Saxon | 410 | 1066 | 738 |  | End of Roman Britain to the Norman Conquest |
| Britain | Norman / Medieval | 1066 | 1485 | 1276 | ±± | Norman Conquest to Bosworth |
| Britain | Tudor / Early Modern | 1485 | 1750 | 1618 | ±± | Accession of Henry VII to the conventional early-modern close |
| Britain | Modern Britain | 1750 | now | 1888 | ~ | Conventional early-modern / modern divide |
| Mexico | Mesoamerican (Aztec/Maya) | −1800 | 1521 | −140 | ±± | Earliest Maya Preclassic to the fall of Tenochtitlán |
| Mexico | New Spain (Colonial) | 1521 | 1821 | 1671 |  | Fall of Tenochtitlán to the Treaty of Córdoba |
| Mexico | Modern Mexico | 1821 | now | 1924 |  | Independence under the Treaty of Córdoba |
| Japan | Heian | 794 | 1185 | 990 |  | Capital moved to Heian-kyō to the fall of the Taira |
| Japan | Edo / Tokugawa | 1603 | 1867 | 1735 |  | Ieyasu made shogun to the shogunate's surrender of power |
| Japan | Modern Japan | 1868 | now | 1947 |  | Meiji Restoration |
| Saudi Arabia | Pre-Islamic Arabia (Jāhiliyya) | −500 | 610 | 55 | ±± | Ends at the first Qur'anic revelation; no sourced start exists |
| Saudi Arabia | Early Islamic Hijaz | 610 | 661 | 636 | ~ | Revelation / Hijra to the end of Rashidun rule from Medina |
| Saudi Arabia | Saudi states (Diriyah onward) | 1727 | 1932 | 1830 | ±± | Muhammad bin Saud rules Diriyah to the Kingdom's proclamation |
| Saudi Arabia | Modern Saudi Arabia | 1932 | now | 1979 |  | Royal decree of 23 Sept 1932 unifying Hejaz and Najd |
| Yemen | Sabaean / Himyarite | −800 | 570 | −115 | ±± | Saba to the Aksumite and Sasanian conquests |
| Yemen | Islamic Yemen (Rasulid / Zaydi) | 897 | 1962 | 1430 | ±± | Zaydi imamate at Saʿda to the 1962 republic |
| Yemen | Modern Yemen | 1990 | now | 2008 | ~ | North–South unification, 22 May 1990 |
| UAE | Magan (Bronze Age) | −2500 | −1800 | −2150 | ~ | Umm an-Nar period; Magan named in cuneiform from c. −2300 |
| UAE | Islamic era | 630 | 1820 | 1225 | ±± | Muhammad's envoys reach the region to the General Maritime Treaty |
| UAE | Trucial States (pearling) | 1820 | 1971 | 1896 | ~ | General treaty of peace to federation |
| UAE | Modern UAE | 1971 | now | 1999 |  | Federation established 2 Dec 1971 |
| Qatar | Pearling / Bedouin Qatar | 1766 | 1939 | 1853 | ~ | Al-Zubārah founded to the discovery of oil |
| Qatar | Modern Qatar | 1971 | now | 1999 |  | Independence declared 3 Sept 1971 |
| Kuwait | Pre-oil Kuwait (Bani Utub, pearling/trade) | 1752 | 1946 | 1849 | ~ | Bani Utub choose a Ṣabāḥ sheikh to the first crude export |
| Kuwait | Modern Kuwait | 1961 | now | 1994 |  | Britain recognises independence, 19 June 1961 |
| Bahrain | Dilmun (Bronze Age) | −2200 | −1600 | −1900 | ~ | Early Dilmun; Qalʿat al-Bahrain occupied from c. −2300 |
| Bahrain | Islamic Bahrain | 628 | 1783 | 1206 | ±± | Conversion of al-Mundhir ibn Sāwā to Āl Khalīfah rule |
| Bahrain | Modern Bahrain | 1971 | now | 1999 |  | Independence declared 15 Aug 1971 |
| Oman | Magan (copper kingdom) | −2500 | −1800 | −2150 | ~ | Umm an-Nar period; Magan the principal copper source |
| Oman | Ibadi Imamate | 750 | 1959 | 1355 | ±± | First imamate after the Umayyad fall to the 1959 surrender |
| Oman | Omani Empire (Zanzibar) | 1650 | 1856 | 1753 | ~ | Yaʿrubids retake Muscat to the split on Saʿīd's death |
| Oman | Modern Oman | 1970 | now | 1998 |  | Accession of Qaboos bin Said — Oman was never formally colonised |
| Syria | Aramean / Classical antiquity | −1200 | 636 | −282 | ±± | Aramean emergence to the Byzantine defeat at Yarmūk |
| Syria | Umayyad Damascus | 661 | 750 | 706 |  | The Umayyad caliphate ruled from Damascus |
| Syria | Ottoman Syria | 1516 | 1918 | 1717 |  | Marj Dābiq to the Ottoman withdrawal from Damascus |
| Syria | Modern Syria | 1946 | now | 1986 |  | French withdrawal completed April 1946 |
| Lebanon | Phoenician city-states | −1200 | −332 | −766 | ~ | Iron Age independence of Tyre / Sidon / Byblos to Alexander's siege |
| Lebanon | Mount Lebanon (Maronite / Druze) | 1516 | 1918 | 1717 | ±± | Maʿnid emirate through the Mutasarrifate |
| Lebanon | French Mandate | 1920 | 1943 | 1932 |  | Greater Lebanon proclaimed to independence, 22 Nov 1943 |
| Lebanon | Modern Lebanon | 1943 | now | 1985 |  | Independence proclaimed 22 Nov 1943 |
| Jordan | Nabataean (Petra) | −312 | 106 | −103 |  | Nabataeans attested to Trajan's annexation |
| Jordan | Islamic era | 636 | 1918 | 1277 | ±± | Arab conquest to the end of Ottoman rule |
| Jordan | Modern Jordan | 1946 | now | 1986 |  | Treaty of London, independence 25 May 1946 |
| Palestine | Canaanite / Philistine antiquity | −2000 | −604 | −1302 | ±± | Middle Bronze city-states to the destruction of Philistia |
| Palestine | Islamic Jerusalem | 638 | 1516 | 1077 | ±± | ʿUmar's capture of Jerusalem to the Ottoman conquest |
| Palestine | Ottoman / British Mandate | 1516 | 1948 | 1732 | ±± | Marj Dābiq to the Mandate's expiry |
| Palestine | Modern Palestine | 1948 | now | 1987 | ~ | Dating convention: the end of the British Mandate |
| Morocco | Amazigh / Mauretania | −225 | 44 | −91 | ±± | Mauretanian kingdom to annexation by Claudius |
| Morocco | Idrisid (Islamization) | 788 | 974 | 881 | ~ | Idris I to the Idrisid expulsion |
| Morocco | Almoravid / Almohad | 1062 | 1269 | 1166 | ±± | Almoravid rise to the fall of Almohad Marrakech |
| Morocco | Modern Morocco | 1956 | now | 1991 | ±± | End of the French and Spanish protectorates |
| Algeria | Numidia / Carthage-Rome | −814 | 429 | −193 | ±± | Traditional founding of Carthage to the Vandal crossing |
| Algeria | Ottoman Regency of Algiers | 1516 | 1830 | 1673 |  | Aruj invited to Algiers to the French capture |
| Algeria | French Algeria | 1830 | 1962 | 1896 |  | French conquest to independence |
| Algeria | Modern Algeria | 1962 | now | 1994 |  | Independence 1962 |
| Tunisia | Carthage (Punic) | −814 | −146 | −480 |  | Founding to destruction in the Third Punic War |
| Tunisia | Ifriqiya (Aghlabid / Kairouan) | 800 | 909 | 855 |  | The Aghlabid dynasty at Kairouan |
| Tunisia | Ottoman / Husainid Beylik | 1574 | 1881 | 1728 | ±± | Ottoman incorporation to the Treaty of Bardo |
| Tunisia | Modern Tunisia | 1956 | now | 1991 |  | Independence 1956, republic 1957 |
| Libya | Garamantes / Greco-Roman | −1000 | 700 | −150 | ±± | Envelope of the Fazzan Garamantian and the coastal Greco-Roman sequences |
| Libya | Ottoman / Karamanli (Tripoli) | 1551 | 1911 | 1731 | ±± | Ottoman capture of Tripoli to the Italian occupation |
| Libya | Italian Libya | 1911 | 1943 | 1927 |  | Italian occupation to the Allied expulsion of the Axis |
| Libya | Modern Libya | 1951 | now | 1989 |  | Independence declared 24 Dec 1951 |
| Mauritania | Sanhaja Berber / trans-Saharan | 700 | 1040 | 870 | ~ | Regular camel caravans to the start of the Sanhaja reform |
| Mauritania | Almoravid reform | 1040 | 1147 | 1094 |  | Ibn Yasin's movement to the Almohad capture of Marrakesh |
| Mauritania | Modern Mauritania | 1960 | now | 1993 |  | Independence declared 28 Nov 1960 |
| Sudan | Kush / Meroë (Nubian) | −780 | 350 | −215 | ~ | Napatan emergence at el-Kurru to the last Meroitic royal burials |
| Sudan | Christian Nubia (Makuria) | 569 | 1317 | 943 | ~ | Makuria's conversion to the mosque conversion at Dongola |
| Sudan | Funj Sultanate (Sennar) | 1504 | 1821 | 1663 |  | Foundation under Amara Dunqas to the submission of Badi VII |
| Sudan | Modern Sudan | 1956 | now | 1991 |  | End of the Condominium, independence 1 Jan 1956 |
| Somalia | Land of Punt / antiquity | −2500 | −1160 | −1830 | ±± | Span of attested Egyptian contact with Punt — **not** a claim about Somali territory |
| Somalia | Islamic sultanates (Adal / Ajuran) | 1250 | 1700 | 1475 | ±± | Ajuran attested to its collapse; Adal flourished 1415–1577 |
| Somalia | Modern Somalia | 1960 | now | 1993 |  | Union as the Somali Republic, 1 July 1960 |
| Djibouti | Adal / Afar-Somali sultanates | 1285 | 1862 | 1574 | ±± | Walashma Ifat through Adal, Aussa and Tadjoura to the purchase of Obock |
| Djibouti | French Somaliland | 1896 | 1967 | 1932 | ~ | Côte française des Somalis to its 1967 renaming |
| Djibouti | Modern Djibouti | 1977 | now | 2002 |  | Independence 27 June 1977 |
| Comoros | Shirazi / Swahili sultanates | 1200 | 1886 | 1543 | ±± | Attested sultanate towns to the French protectorate treaties |
| Comoros | French colonial | 1886 | 1975 | 1931 |  | Protectorate treaties to independence, 6 July 1975 |
| Comoros | Modern Comoros | 1975 | now | 2001 |  | Independence declared 6 July 1975 |

`now` in the End column is the frozen `storyYear`, not a literal — so a "Modern Egyptian" anchor
recomputes with the build's own present rather than drifting against a hard-coded 2026.

**Verified:** 91 rows, 26 countries, every anchor recomputed from its own start and end — 0
mismatches. 41 rows clean, 21 `~`, **29 `±±`**.

### 7.4.1 · What the flags do — the refusal is the feature

Nearly a third of the inventory will not carry an anchor, and that is a finding about the list, not
a failure of the research. Some examples of what a midpoint means on a `±±` row:

- **Oman, "Ibadi Imamate"** — not one polity but eight discontinuous imamates between 749 and 1959.
  The midpoint, 1355, falls inside the 1164–1406 Nabhani gap: **a year in which no imamate existed.**
- **Mexico, "Mesoamerican (Aztec/Maya)"** — midpoint −140, some 1,460 years before the Aztecs.
- **Britain, "Tudor / Early Modern"** — midpoint 1618, which is Stuart.
- **Palestine, "Ottoman / British Mandate"** — 401 Ottoman years bundled with 31 British ones, so the
  midpoint sits deep in the Ottoman period and represents the Mandate not at all.

So the behaviour is graded by flag, and it is the same discipline the whole design already uses —
*refuse rather than approximate*:

| Flag | Anchor | What the user sees |
|---|---|---|
| blank | derived, silently | nothing; the Present year box is filled |
| `~` | derived, **disclosed** | *"Dated 1750–2026; the modern-era boundary is disputed. Change it if you mean otherwise."* |
| `±±` | **refused** | the box stays empty, with the reason: *"'Ibadi Imamate' covers eight separate imamates over 1,200 years — there is no typical year. Set the year you mean."* |

A refused anchor costs nothing else. Era **offsets are relative**, so every timeline, marker and age
in §7.5 still works; only the absolute year printed on a marker waits for the user. A `±±` row still
delivers its range to the writer as context — *"the Ibadi Imamate, 750–1959"* — which is the part
that was actually well-evidenced.

### 7.4.2 · The list is a menu, not a calendar — so the map is one-directional

Checking the 91 rows for continuity found **34 gaps and 2 overlaps**. Britain and Egypt are nearly
continuous; most countries are not. Between "Magan (Bronze Age)" and "Islamic era" the UAE list
leaves 2,430 unlabelled years; Greece leaves 1,851 between Hellenistic and Modern; Morocco leaves
687 between the Almohads and 1956. Egypt's Coptic row sits *inside* its Greco-Roman row, and Oman's
Omani Empire sits inside its Ibadi Imamate.

This is not a defect in the taxonomy. The list was built as a **creative menu of evocative periods**,
and a writer choosing "Heian" does not need 1185–1603 to be on the menu too. But it settles a design
question that would otherwise have been decided by accident:

> **The map is used in one direction only: era → anchor year. Never year → era.**

An inverse lookup is undefined across 34 gaps and ambiguous across 2 overlaps, so it is not offered.
Nothing in §3, §5 or §7.5 needs it — eras reach scenes **by id from the map** (§3.5), never by
matching a year back to a period. The gaps are reported once, as a note on the review panel
alongside the zero-scene note (§5), never as a finding: *"Your material dates a scene to 1400;
Morocco's era list jumps from 1269 to 1956, so no period covers it. The scene keeps its year."*

## 7.5 · Personal time — the age calculator

Time travel is not a new axis. It is the discovery that **age was never a function of era** — it only
looked like one because, in a story without travel, the two coincide.

### The failure the naive model produces

A 34-year-old who travels to −20 is still 34. `age = anchorAge + (era − anchorEra)` says 14, so
`ERA_AGE_DRIFT` fires on **every travelled scene** — dozens of findings in a draft containing none,
the PLACE_JUMP failure at scale. An exemption would silence the check; a calculator makes it right,
and an earlier draft of this spec took the exemption. It was wrong: it bought silence by giving up
the check, and it could not express a traveller whose age moves backwards.

### A character's age is proper time along their own worldline

Age is the time a person **has lived**, accumulated along their own path through the story — not the
coordinate of the scene they are standing in. It is computed in two passes: classify every step of
the worldline, then integrate.

**Pass A — classify.** One forward pass over that character's appearances in `sceneOrder`. It knows
nothing about ages, so it runs once and serves every anchor.

```
pending ← none                    # an era he departed from and is still displaced below
for each step (prev → cur):
    if NOT a traveller:                                   → LIVED
    else if arrival marked as travel, or era(cur) < era(prev):
                                                          → JUMP
         if era(cur) < era(prev):  pending ← max(pending, era(prev))
         else if era(cur) ≥ pending: pending ← none       # he is home again
    else if pending ≠ none and era(cur) ≥ pending:        → AMBIGUOUS
    else                                                  → LIVED
```

**Pass B — integrate.** `delta(JUMP) = travelCost` (default **0** — a jump costs no life unless the
story says it does), `delta(LIVED) = era(cur) − era(prev)`, `delta(AMBIGUOUS) = unknown`. Walk
outward from an anchor in either direction, adding deltas forward and subtracting them backward.

### The traveller flag is declared, not derived — and that is the whole design

The same backwards step means opposite things:

- For a **non-traveller**, a backwards step is the *narrative* jumping. The audience is shown an
  earlier year and the character is simply younger in it. Every step is LIVED, the accumulation
  telescopes to `era − anchorEra`, and the answer is the original formula. **Ordinary stories are
  bit-for-bit unchanged** — which is what makes this safe to run for everyone instead of behind a flag.
- For a **traveller**, a backwards step is the *person* jumping. Ordinary time does not run backwards
  for a person, so this is inference from structure, not a guess about intent.

Nothing in the era sequence distinguishes those two, so nothing may try. The flag comes from the
story. Default: not a traveller.

### Where the calculator refuses

A traveller who is displaced in the past and then appears at or beyond the era he left from is
genuinely ambiguous: he may have jumped home, or he may have lived the twenty years to get back —
both are real stories, and *Twelve Monkeys* and *Kate & Leopold* differ on exactly this. The
calculator marks the step AMBIGUOUS and returns **unknown**, which means no directive and, above
all, **no finding**. Per the standing doctrine, refusing beats accusing.

Two things narrow the refusal so it does not swallow the film:

1. **`pending` clears when he gets home.** After a marked return, ordinary years at home are ordinary
   again. Without this, every scene after the return is unknown.
2. **A stated age at the arrival resolves it.** *"JASON, 34"* says he jumped; *"JASON, 54"* says he
   lived it. And an age matching **neither** reading is `ERA_AGE_IMPOSSIBLE` — a defect the old model
   could not even express.

### Stated ages segment the worldline, so one bad number is one finding

Every stated age is an anchor. Anchor *k* predicts anchor *k+1*; a mismatch beyond the existing
one-year tolerance is the `ERA_AGE_DRIFT` finding — and then *k+1* **becomes the new anchor**. One
wrong number therefore produces one finding rather than a finding on every scene after it, and an
unknown segment ends at the next stated age instead of poisoning the third act.

An age nobody stated is never inferred; a character with no anchor anywhere is never reported.
**Absence of evidence is not a defect** (§3.6). A *predicted* age below zero is `ERA_SELF_REFUTING`:
the character is standing in a scene set before he was born. A *stated* one is the author's and is
not ours to contradict.

### What the matrix serves

`expectedAge[character][scene]` is computed once and feeds three consumers:

1. `ERA_AGE_DRIFT` and `ERA_AGE_IMPOSSIBLE` compare stated ages against it.
2. `spineDirective` tells the writer **"Jason is 34 here"** — a generation improvement, not just a check.
3. A traveller whose age decreases along his own order with no stated cause becomes expressible.

**Duplicate selves.** Two entries for one character in one scene at different personal ages — a
traveller meeting himself — is *expressible*, because age is keyed by appearance rather than by
character. The design permits it; v1 does not check it. An undeclared duplicate is the natural next
finding and is deliberately deferred.

There is one limit, and it is a property of the input rather than of the model. **A stated age ON a
duplicated scene is unreadable**: the script says *"JASON, 34"* and there are two Jasons in the room,
one of whom is fourteen, so nothing in the page says which. Both appearances refuse — no age, and no
finding, because the author has not contradicted himself. With the age stated anywhere else, both
selves are carried independently and the expressibility claim holds in full.

**Two co-equal eras are not travel.** *The Godfather Part II* intercuts two periods and nobody moves
between them. Nobody is a traveller, every step is LIVED, and ages follow era exactly as before — a
stated 65 at era 0 and a stated 25 at era −40 agree, and disagreeing by more than a year is the drift
finding working normally.

### Verified

The algorithm was run as an executable harness before being written down: **15 cases pass** —
non-traveller flashback with the anchor first and with the anchor in the middle; both jumps marked; a
traveller staying five years in the past; an unmarked return refused; that same return resolved by a
stated age as a jump, as twenty years lived, and as impossible; ordinary years after coming home; a
twenty-year saga with no travel; the Godfather case agreeing and disagreeing; a scene before birth; an
unanchored character; and a traveller stranded and living forward through his own present.

Then, per *a test that passes with the feature deleted is not a test*, **9 deliberate breaks were each
caught**: deleting the ambiguity guard, widening it (the bug that marked an in-past stay unknown),
ignoring the traveller flag, deleting the re-anchoring, never clearing `pending`, dropping the
both-readings test, dropping the negative-age check, charging a year for a jump, and guessing an age
for an unanchored character.

## 8 · Failure handling — every path degrades to today

| Situation | Result |
|---|---|
| No timeline in the material | one stratum, the present. Every scene era 0, ledgers collapse to one partition, directive silent. Most stories, zero cost. |
| A phrase the parser cannot resolve | stratum kept with label, offset null. Nameable on the page, no arithmetic, no findings. |
| A scene with no era | null — skipped by the clock, no prop events. Exactly today's behaviour. |
| The classification pass fails | no map, feature inert, build proceeds unchanged. |
| Timelines switched off | nothing runs. |

---

## 9 · Testing

Per the standing doctrine — *a test that passes with the feature deleted is not a test* — every
guard below is verified by deliberate break before it is accepted.

| Area | Test |
|---|---|
| Normalisation | every form in §3.1, plus the range-before-single ordering (break it and the span silently narrows) |
| Refusal | an unresolvable phrase yields null and never a confident number |
| Rounding | every even decade (10y, 20y, 30y) — the half-day cases. Break the rule and two timelines appear where one was written |
| Timelines | "seven" and "about seven" are one; "seven" and "eight" are two |
| Event anchors | resolved in the second pass; unresolvable stays null |
| Ledgers | two scenes at −7 check against each other; a −7 scene and a 0 scene do not |
| Ages | 27 at −7 → 34 at 0, 14 at −20; unanchored characters never reported |
| Zero-scene stratum | produces a **note**, and asserting it is not a finding is itself a test |
| Anchor arithmetic | 2019 with "seven years before" → 2026; a second pair implying 2025 raises the conflict |
| Anchor fallback | Medieval setting with no pair → 1000, not the current year |
| BC formatting | present 500, offset −2000 → **1501 BC**. Break the no-year-zero rule and every ancient marker is one year out |
| Invented calendar | no day conversion, relative markers recommended, sub-year precision refused rather than approximated |
| Era → year map | all **91 country rows and 9 bands** recomputed from their own start and end — 0 mismatches, and the check is re-run whenever a row changes. A `±±` row must yield **no** anchor and a reason; a `~` row must yield an anchor **and** a disclosure; an unmapped era must fall through without inventing a year |
| Map direction | there is **no** year → era lookup. Asserting its absence is the test: 34 gaps and 2 overlaps make it undefined or ambiguous, and adding one would fail silently |
| Age calculator | the 15 worldline cases of §7.5, and the **9 deliberate breaks**, each of which must be caught: a traveller at −20 aged 34 raises NOTHING, an in-past stay ages normally, an unmarked return is refused rather than accused, and a stated age at the arrival resolves it or raises `ERA_AGE_IMPOSSIBLE` |
| Ordinary stories unchanged | with no traveller declared, every step is LIVED and the accumulation telescopes to `era − anchorEra`. Ignore the flag and the non-traveller flashback breaks immediately |
| Traveller flag | a proposed traveller with no backwards step and no marked arrival is **dropped**. Remove the structural second witness and any character the model names becomes a traveller on one AI pass alone |
| Degradation | with era null everywhere, output is byte-identical to today's |

The last row is the one that matters most: it proves the feature cannot make an existing build worse.

---

## 10 · Out of scope

- **Parallel strands of unequal duration converging on one moment** (Dunkirk's week / day / hour).
  Those are not offsets on one axis and this design does not model them. Each strand still gets an
  era, so nothing breaks; the convergence simply is not understood — **and is disclosed to the user
  when detected** (§7.1) rather than silently mishandled. This is a limit, not a setting: no toggle
  can make the model understand a shape it does not represent.
- **Modality and belief** (TimeML `SLINK`). "Presumed dead" is a belief, not a fact. Handled
  accidentally today because dialogue is never evidence of death; a proper model is its own subsystem.
- **Allen's full algebra.** See §1.
- **Sub-day precision.** The unit supports it; nothing in the design uses it yet.

---

## 11 · Decisions taken

| Question | Decision |
|---|---|
| Era unit | signed offset in **days** — serves centuries and hours with one number |
| Anchor | `storyYear`, defaulting to now, **frozen at build creation** |
| Grouping | exact normalised value. No tolerance constant, no clustering |
| Who finds numbers | **code**. The model labels and assigns, never emits a number |
| Scene ↔ era | planner picks **by id from the map**; off-list is dropped |
| Facts | era **intervals**; scenes era **points** |
| `recalled` | retired as stored state; derived as `era < 0` |
| Zero-scene stratum | a **note**, never a finding |
| Marker | **place + year** (`LONDON, 2019`) or relative (`SEVEN YEARS EARLIER`), composed from parts already present |
| Era ↔ place | plurality of assigned scenes' regions. For markers and context — **never a check**, because periods travel |
| Naming | the interface never says "era" twice — the new block is **Timelines**, its anchor **Present year** |
| `settingEra` | **derives the anchor** when no pair exists, before falling back to the current year |
| Invented worlds | story-years, no day conversion, **relative markers**, sub-year precision disclosed as unavailable |
| Deep time | supported; BC printed by `1 − astronomicalYear`; markers fall back to digits past twenty |
| Era → year | an explicit sourced map, **91 country rows + 9 bands**; unmapped is supported, never guessed |
| Unsound era labels | a `±±` row (29 of 91) **refuses its anchor** and says why. Its range still reaches the writer as context |
| Map direction | **one-directional**: era → anchor year. The inventory is a menu, not a calendar (34 gaps, 2 overlaps), so year → era is not offered |
| Time travel | **no exemption**. Age is proper time along the character's own worldline, classified then integrated (§7.5) — the check survives, and gets stronger |
| Traveller flag | **declared, never derived**. A backwards step means the narrative jumping for one character and the person jumping for another; the era sequence cannot tell them apart. Proposed by the model as a label, **seconded by structure** (a backwards step or a marked arrival) or dropped; the user's setting wins over both |
| Travel cost | **0 by default**. A jump costs no life unless the story says it does |
| Ambiguous return | **unknown**, never a guess — and unknown ends at the next stated age rather than poisoning the act |
| Duplicate selves | expressible in the matrix, **not checked in v1** |
| Settings | **recommended from the material** through the existing brief-recommend pass, not merely defaulted |
| Anchor | **derived** where an absolute and a relative dating of one event coexist; current year only as last resort |
| Loose numbers | no merge constant. **Merge is an action on the review panel**, per pair, with a note when the map is dense |
| Zero-scene periods | a note, and a **"backstory only"** mark that turns the silence into information the directive can use |
| Unmodelled shapes | **disclosed**, never silently mishandled |
| Default | **off**, auto-switched on by the analysis, soft |
