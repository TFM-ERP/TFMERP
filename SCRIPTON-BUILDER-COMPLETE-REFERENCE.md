# ScriptON — Script Builder: Complete Reference

**The AI screenplay builder inside TFM‑System.** This document covers every feature of the builder end‑to‑end: all supported formats, the complete *from‑scratch* brief screen field‑by‑field, the full generation pipeline that turns a brief into a finished script, the knowledge engine that steers it, the canon continuity kernel that keeps it self‑consistent, and everything downstream (Doctor coverage, revision passes, and the AI vertical‑video render pipeline). It is written for both readers — a plain‑language explanation of *what each thing does* plus the exact code‑level detail (field names, enum values, numeric rules, file paths) for engineers.

> Scope: comprehensive + end‑to‑end. Current as of the audit of `backend/src/production/scripton/**`, `backend/src/video/**`, and `frontend/src/components/scripton/**`.

---

## Table of contents

1. [What ScriptON is — the big picture](#1-what-scripton-is--the-big-picture)
2. [The two ways in: Adapt vs From‑scratch](#2-the-two-ways-in-adapt-vs-from-scratch)
3. [Formats — the full catalog](#3-formats--the-full-catalog)
4. [The from‑scratch Brief screen, field by field](#4-the-from-scratch-brief-screen-field-by-field)
5. [The knowledge engine — how the brief steers the writer](#5-the-knowledge-engine--how-the-brief-steers-the-writer)
6. [The generation pipeline — brief → finished script](#6-the-generation-pipeline--brief--finished-script)
7. [The canon continuity kernel](#7-the-canon-continuity-kernel)
8. [Downstream — Doctor, Revisions, AI video, Export](#8-downstream--doctor-revisions-ai-video-export)
9. [API surface — every endpoint](#9-api-surface--every-endpoint)
10. [Data model + file map](#10-data-model--file-map)

---

## 1. What ScriptON is — the big picture

ScriptON is a screenplay **operating system**: you describe a project once (the **Brief**), and a chain of AI stages develops it from a one‑line idea into a fully‑formatted screenplay — then keeps it consistent as you revise it, and (for vertical formats) renders it to video.

The macro flow is always the same five movements:

```
  BRIEF                DEVELOP LADDER                 SCRIPT              DOCTOR / CANON            (VERTICAL ONLY)
  intake screen   →    logline → synopsis →      →    full formatted  →  coverage, diagnostics, →  shot list → video
  steers the           treatment → beats →            screenplay          revision passes,          prompt → render →
  whole build          scenes → outline → draft       (paginated)         continuity kernel         stitch into episodes
```

Two engines sit under everything:

- **The knowledge engine** (`knowledge/`) turns the brief into *steering directives* — format rules, genre DNA, era language, accents, war/conflict substrate, craft style, vertical/AI‑video rules — injected into every prompt so the writer honours your intent.
- **The canon kernel** (`canon/`) is a bi‑temporal story‑memory graph. Every fact a scene establishes ("MARIAM is dead from scene 30") is recorded; later edits are continuity‑checked against it so the script can't quietly contradict itself.

A build runs in one of two collaboration modes — **solo** or **team** (`resolveCollabMode`): `TEAM`/`SOLO` are manual overrides; `AUTO` (the default) makes it a team build when the project has more than one member, else solo. Solo skips sign‑off gates.

Everything a build produces lives in a shared **ScriptON Library workspace** (a hidden `ProductionProject` flagged `scriponWorkspace: true`) until you promote it into a real production project.

---

## 2. The two ways in: Adapt vs From‑scratch

The builder opens on **New Build → "Adapt and build"** (`ScriptOnIntake.tsx`). At the top you name the build (required) and choose one of two modes:

| Mode | Label | What it does |
| --- | --- | --- |
| `ADAPT` | **Adapt material** | You bring a source work (synopsis, chapter, article, script, book). Step 1 collects the material; Step 2 is the Brief. The source *does the storytelling*; the brief *steers* it. |
| `ORIGINAL` | **From scratch** | No source. The intake jumps straight to Step 2 (the Brief). The AI invents the story from your brief alone. |

The intake is a **2‑step** flow shown as pills *(1 · Work source → 2 · Brief)*. In **From‑scratch** mode, Step 1 is skipped entirely and you land on the Brief. The whole form **auto‑saves a draft** to local storage per project, so a half‑finished build can be resumed (or discarded) next time.

> **Key principle printed on the screen:** *"Everything here steers the ladder."* and *"Steers the brief; the Work source does the storytelling. Begin writes the Logline."* The brief never writes the story by itself — it shapes how the story is written.

### Step 1 — Work source (Adapt mode only)

A single screen for assembling everything the adaptation should draw on:

- **Main paste box** — the primary work (synopsis, excerpt, chapter, article).
- **+ Add paste box** — any number of additional passages.
- **+ Add website / URL** — article/URL references (the backend can fetch & ingest them, SSRF‑guarded).
- **+ Add file(s)** — uploads. Accepts **PDF, FDX (Final Draft), Fountain, Word (.docx), EPUB, HTML** — one file or many.

All pastes are aggregated into one `sourceText`; URLs and files are carried as structured `sources[]`. Then **Next → Brief**.

---

## 3. Formats — the full catalog

Format is the single most important lever: **the project type (plus market) re‑wires the entire develop pipeline** — which stages exist, how long the piece is, its act template and arc model. This is the *Format Engine* (`knowledge/formats.ts`). Unknown inputs always fall back to the FEATURE shape; the engine never throws.

### 3.1 The six families

Every project resolves to one canonical **family** (`normalizeFamily(brief)`), inferred from the `projectType`/`format` field:

| Family | Triggers (regex on projectType) | Develop ladder (the stages that run) |
| --- | --- | --- |
| `VERTICAL_AI_VIDEO` | `VERTICAL_AI_VIDEO`, `AI_VIDEO`, `AI VIDEO` | LOGLINE → SYNOPSIS → PREMISE → STORY_ENGINE → EPISODE_MAP → BEAT_ENGINE → SCENES → DRAFT → **SHOT_LIST → VIDEO_PROMPT** |
| `VERTICAL` | `VERT`, `MICRO`, `SHORT_FORM`, `REEL` | PREMISE → STORY_ENGINE → EPISODE_MAP → BEAT_ENGINE → SCENES → DRAFT → COVERAGE |
| `DOCUMENTARY` | `DOC` | THESIS → TREATMENT → RESEARCH_PLAN → RIGHTS_PLAN → INTERVIEW_OUTLINE → PAPER_EDIT → NARRATION → COVERAGE |
| `SERIES` | `SERIES`, `TV`, `LIMITED`, `SEASON`, `EPISOD`, `MUSALSAL`, `DIZI`, `DRAMA_SERIES` | LOGLINE → SYNOPSIS → SEASON_ARC → EPISODE_MAP → TREATMENT → BEATS → SCENES → STEP_OUTLINE → DRAFT → COVERAGE |
| `SHORT` | `SHORT` | LOGLINE → SYNOPSIS → TREATMENT → BEATS → SCENES → STEP_OUTLINE → DRAFT → COVERAGE (the feature ladder) |
| `FEATURE` | *(default for anything else)* | LOGLINE → SYNOPSIS → TREATMENT → BEATS → SCENES → STEP_OUTLINE → DRAFT → COVERAGE |

`stageLadderFor(brief)` returns exactly this ladder; it replaces any fixed stage order, so the develop screen shows different rungs per format.

### 3.2 Base presets (market‑agnostic)

| Preset | Family | Length | Act template | Arc model |
| --- | --- | --- | --- | --- |
| **Feature film** | FEATURE | ~90–120 min (one continuous story, NOT episodic) | 3‑act | single protagonist arc |
| **Short film** | SHORT | under ~40 min, single story | compressed 3‑act / single‑turn | one decisive change |
| **Documentary** | DOCUMENTARY | feature ~70–110 min or series | thesis‑driven, written in the edit | argument / investigation, not dialogue beats |

### 3.3 Series presets — by market (9)

When the family is SERIES, the **market** decides the real‑world norms (`normalizeMarket` — an explicit `marketKey` from the intake's Series‑type picker wins; otherwise it's inferred from market/country/language/region). Each preset carries authentic episode counts, run‑times, act structure and terminology:

| Preset | Episodes | Length / ep | Act template | Arc model | Terminology |
| --- | --- | --- | --- | --- | --- |
| **US streaming drama** | 6–13 | 45–75 min | continuous (no commercial acts) | serialized season arc | Season |
| **US network hour** | 22 | ~44 min | Teaser + 5 acts (ABC = 6) | episodic‑of‑the‑week + light serialization | Season; act‑outs before breaks |
| **UK / BBC drama** | 3–8 | ~58 min | continuous | tight serialized | Series (not Season) |
| **K‑drama** | 12–16 | 60–70 min | per‑episode arc + mid‑episode hook | romance/melodrama spine, finite | live‑shoot vs pre‑produced |
| **Turkish dizi** | 36 | 120–150 min (home cut) | novelistic, multi‑strand | expansive family/romance saga | export re‑cut ×3 @ ~45 min |
| **Telenovela** | 80–200 | ~45 min daily | daily cliffhanger | finite melodrama with a definite END | capítulos |
| **Anime** | 12–13 | ~24 min | OP/ED + eyecatch (A/B parts) | per‑cour arc | 1 cour = 12–13; 2 cours = 24–26 |
| **Ramadan musalsal (MENA)** | 30 | 30–45 min, nightly | nightly closed beat + season hook | closed 30‑episode arc across the month | حلقة/ḥalqa; airs nightly in Ramadan |
| **Nordic noir** | 8–10 | ~58 min | continuous, slow‑burn | single investigation across the season | Series |

### 3.4 Vertical micro‑drama presets (2)

| Preset | Episodes | Length / ep | Act template | Arc model |
| --- | --- | --- | --- | --- |
| **Vertical micro‑drama (global)** | 60–100 | 60–90 s/ep (cap ~2 min) | per‑episode Beat Engine: Hook · Friction · Spike · Button | paywall‑aware; reversal engine; mandatory per‑episode cliffhanger |
| **Vertical micro‑drama (MENA)** | 40–80 | 60–90 s/ep (→120 when needed) | scenic objective + power/info shift + escalation + final hook | Addiction Loop (yes‑but / no‑also); Arabic‑first; romance within social constraints |

The vertical family resolves to MENA when the brief points at the Arab/MENA market or Arabic language (`isMena`), else GLOBAL.

### 3.5 AI video (vertical micro‑drama) — the generative format

| Preset | Episodes | Length | Pipeline |
| --- | --- | --- | --- |
| **AI video (vertical micro‑drama)** | 40–80 | 60–90 s/episode · scenes **≤5 s each** (9:16) | micro‑drama ladder → per‑episode Hook · Friction · Spike · Button → per‑scene text‑to‑video (≤5 s) → **stitched episodes** |

This is the only format whose ladder ends in render stages (`SHOT_LIST`, `VIDEO_PROMPT`): it develops a full vertical micro‑drama like the human‑acted vertical, then emits a Shot‑Grammar text‑to‑video spec, renders each ≤5 s scene, and stitches scenes into episodes. Character consistency is held with reference head‑shots; every episode ends on a cliffhanger.

### 3.6 How long is it? — the scene‑count math

The target scene count is **format‑aware**, computed three different ways:

- **Feature / Short:** `min(90, max(55, beats × 1.5))` — anchored to the number of story beats, floored at 55 and capped at 90 scenes. (No beats yet → 60.)
- **Series:** `seriesSceneCount(episodes, minutesPerEp)` → **scenes/ep = clamp(round(minutesPerEp × 0.5), 6, 60)**; **season total = scenes/ep × episodes**. (~1 scene per 2 minutes; e.g. a 60‑min ep → 30 scenes; a 10‑min ep → clamped up to 6.)
- **AI video:** scenes/episode ≈ **episode length ÷ shot duration** (e.g. a 75 s episode at 5 s/shot ≈ 15 scenes), set on the AI‑video panel.

### 3.7 The format directive (what the writer is told)

For every build, `formatDirective(brief)` appends a steering block telling the writer the structural shape, e.g.:

> `FORMAT: Ramadan musalsal (MENA). Structure as 30 episodes, 30–45 min/ep, nightly. Act template: nightly closed beat + season hook. Arc model: closed 30‑episode arc across the month. Terminology / production note: حلقة/ḥalqa; airs nightly in Ramadan. Do NOT shape this like a single feature film — honour the episodic/format structure above end‑to‑end.`

---

## 4. The from‑scratch Brief screen, field by field

This is the screen the request is about: **everything you set before the first word is written.** In *From‑scratch* mode you land here directly. The form is a single scrolling column on the left with a **live Creative Brief** preview pinned on the right that updates as you type. Sections marked *(hidden for AI video)* are replaced by the AI‑video panel when the project type is AI video.

Everything you set is collected into one `brief` object (the React `f` state) and sent to the build on **Begin**. Below, each section lists its fields, the options, and the default.

### 4.0 Header (always)

- **Project / build title** — *required.* Names the build so you can reopen it on the Builds board.
- **Mode toggle** — *Adapt material* / *From scratch* (as above).

### 4.1 Project type

A 3‑column picker (`PTYPES`):

| Value | Label | Hint |
| --- | --- | --- |
| `MOVIE` | Movie | ~90–120 min |
| `TV_SERIES` | TV series | 8–22 ep |
| `LIMITED` | Limited | 4–8 ep |
| `VERTICAL` | Vertical | 60–100 ep |
| `SHORT` | Short film | ≤ 40 min |
| `DOC` | Documentary | varies |
| `VERTICAL_AI_VIDEO` | AI video | 60–90 s ep · ≤5 s scenes |

**Series‑type sub‑picker** (appears for TV_SERIES / VERTICAL / LIMITED): chips that apply a real‑world template (mirrors the backend presets) and fill in **Episodes × Minutes/ep × Seasons**, plus a hidden `marketKey` so the backend uses that exact template instead of inferring it:

`US streaming` (10×60) · `US network hour` (22×44) · `UK/BBC` (6×58) · `K‑drama` (16×65) · `Turkish dizi` (36×130) · `Telenovela` (120×45) · `Anime` (12×24) · `Ramadan musalsal` (30×40) · `Nordic noir` (8×58) · `Limited series` (6×55) · `Vertical micro‑drama` (80×1.5) · **Custom**.

Editing any number switches to **Custom** (and lets the backend infer the market). The default template is locale‑aware: Arabic → Ramadan musalsal, else US streaming.

### 4.2 AI video settings *(only when project type = AI video)*

Replaces several story sections with render controls:

- **Shot duration** — slider 3–10 s (default 5). The length of each generated scene.
- **Aspect ratio** — `9:16` Vertical (default) · `16:9` Landscape · `1:1` Square.
- **Visual style** — the look applied to *every* scene (`VIDEO_STYLES`): `cinematic` (photoreal, default) · `anime` · `pixar3d` (3D/Pixar) · `comic` (motion comic) · `claymation` · `watercolor` · `cyberpunk` (neon) · `inkwash`.
- **Episodes** — slider 1–80 (default 8).
- **Episode length** — slider 30–120 s (default 75); shows the derived **≈ scenes/episode** (= episode length ÷ shot duration).
- **Negative prompt** — what to avoid (default `blurry, text, watermark, deformed, extra fingers, abstract, low resolution, motion blur`).
- **Seed** — integer + Randomize (for reproducible renders).

### 4.3 Grounding in reality *(Adapt mode, non‑AI)*

- **Based on a real story / person** — toggle (`realBased`, default on in Adapt).
- **How faithful vs invented** — `FAITHFUL` · `INSPIRED` (default) · `LOOSE` (`realityLevel`).
- **Research the subject online** — toggle (`researchSubject`).
- **How much real detail** — slider 0–100 (`researchAmount`, default 55).
- **Real‑person note** — free text: who they are, what's true, the wound, what to keep vs dramatise.

### 4.4 Creative DNA *(the genre identity)*

The vocabulary that defines *what the story is*, mirroring the backend genre taxonomy:

- **Base genre** — pick **up to 3** of 15: Action, Adventure, Comedy, Crime, Drama, Fantasy, Historical, Horror, Musical, Mystery, Romance, Sci‑Fi, Thriller, War, Western.
- **Subgenre** — drawn from the chosen base genres; each selected subgenre gets two sliders: **How much in the story** (presence: Rarely → Constant) and **How intense when it appears** (Subtle → Dominant).
- **Blend layers** — stack any of 10: war, romance, fantasy, noir, satire, mystery, coming‑of‑age, political, supernatural, survival.
- **Tone** — 9: epic, grounded, tragic, ironic, comic, romantic, satirical, pulpy, lyrical.
- **Mood** — 8: foreboding, bittersweet, hopeful, tense, melancholic, whimsical, dread, warm.
- **Treatment** — narrative method (8): linear, nonlinear, multi‑POV, frame, anthology, real‑time, epistolary, unreliable narrator.

(These derive the legacy `genres[]`, `tone` and `setting` fields used for back‑compat and steering.)

### 4.5 Setting & world

- **Setting country / place** — searchable combo. **Drives the era language engine.**
- **Era / period** — the eras available depend on the chosen country (e.g. Egypt → Pharaonic, Ptolemaic, Coptic, Arab‑Islamic, Modern). The engine auto‑loads each era's language register, names, dress and customs.
- **World details** — free text (e.g. desert frontier, royal court, war‑torn city).

### 4.6 Intent & budget *(hidden for AI video)*

- **Project intent** — a curated set (festival, commercial, prestige, etc. — `PROJECT_INTENTS`).
- **Budget scope** — tiers (`BUDGET_TIERS`) with hover hints; written into the brief so Budget‑Fit and the writer respect location/cast constraints.

### 4.7 Story framework *(hidden for AI video)*

The beat map the **Beats** stage will follow. **Auto** picks the best fit for the format (series/vertical → TV Network Hour; limited → Limited Series; epic/myth/fantasy → Hero's Journey; else Save the Cat). You can override with any of 13:

Three‑Act (classic) · Save the Cat (15) · Syd Field Paradigm · Hero's Journey (12, Vogler/Campbell) · Story Circle (8, Harmon) · 8‑Sequence · Hauge Six‑Stage · Freytag Pyramid (5‑act) · Kishōtenketsu (4‑act) · Truby 22 Steps · Pixar Story Spine · TV Network Hour · Limited Series. (An **i** button explains each.)

### 4.8 Style & Voice *(optional, up to 2)*

*How* the script is written — craft texture, never the plot. Pick up to **2** of 14 craft packs, each with a **strength** slider (subtle → defining): Fast Ensemble Dialogue · Slow‑Burn Naturalism · Mythic Quest · Hyperlink Mosaic · Hardboiled Noir Voice · Genre‑Pastiche Nonlinear · Maximalist Spectacle · Deadpan Absurd · Vérité Handheld · Lyrical Memory · Chamber Intimacy · Bingeable Cliff‑Engine · Punchy Single‑Idea Spot · Investigative Build. (IP‑safe — technique only, no living‑person names.)

### 4.9 Ending *(hidden for AI video)*

Pick **up to 2** ending types to blend (e.g. bittersweet + sequel hook) from `ENDING_TYPES`, plus a free‑text custom ending note. Written into the brief and honoured at the climax — the same list the Doctor's *Re‑engineer ending* uses.

### 4.10 Lore Atlas — genre & lore layer *(hidden for AI video)*

An optional, deep world‑texture system (toggle **Add a lore layer**). It *steers genre & texture; it does not write the story.*

- **Lore genres (lenses)** — combine any of: Fantasy, Horror, Folklore, Myth, Crime, Romance & customs, Naming & dress.
- **Browse By culture / By archetype** — a searchable atlas of authentic elements across **12 cultures** (creatures, crime, customs, dress) keyed to your setting. Each element card can be inspected (origin, variants, story hooks) and added to the build.
- **Allow historical pantheons** (Greek/Norse/Egyptian gods) — toggle; living‑religion sacred figures stay locked.
- **Selected — role & weight** — each chosen element gets a **role** (17 options: Protagonist, Antagonist, Ally, Mentor, Love Interest, World‑System, Obstacle, Obstacle‑turns‑ally, Rival, Kingmaker, Omen, Catalyst, Gatekeeper, Shadow, Trickster, Guardian, Herald) and a **weight** 1–4 (Accent → Spine).
- **Genre intensity** — for 11 genre families (Comedy, Action, Espionage, Horror, Mystery, Drama, Sci‑fi, Romance, Thriller, Language, Anime), set **Presence** (how often), **Intensity** (how strong), a derived **Narrative influence %**, and — for Action — specific styles (Hand‑to‑Hand, Sword, Martial arts, Gunfights, etc.).
- **Lore density** — how far the layer bends the story, 6 stops: `OFF` · `ACCENT` (flavour only) · `SUBPLOT` (B‑story) · `WOVEN` (a world‑rule; midpoint turns on it) · `DRIVER` (inciting/midpoint/climax turn on it) · `SATURATED` (full mythic mode).

### 4.11 Target *(hidden for AI video)*

- **Target language** — combo of 40 (Arabic variants, English, Spanish, French, … Other).
- **Country / market** — combo of 35 markets (Global, GCC, KSA, UAE, … Other).
- **Rating target** — a large combo spanning UAE, KSA, US film/TV, UK, Australia, Germany (FSK), France systems.
- **Format note** — optional free text (e.g. anthology, 3‑act).
- **Arabic language → Script dialect** — pick a dialect (`AR_DIALECTS`) and a **register**: *الفصحى · Formal everywhere* or *عامية · Dialect dialogue* (action in فصحى, dialogue in the chosen dialect — the professional norm).
- **Non‑Arabic language → Accents / dialects** — chips (`ACCENTS`); written via idiom + a capitalized parenthetical (e.g. `(Cockney)`), never phonetic spelling.

### 4.12 Research scope *(hidden for AI video, on by default)*

- **Scopes** — Real subject & history, Story‑craft & refs, Mythology/culture, Comps & box office, Cultural/legal fit, General web (all on by default).
- **Research depth** — slider 0–100 (default 60).

### 4.13 The live Creative Brief panel + Begin

The sticky right‑hand panel renders a running summary (type · episodes, mode, genres + tone/mood, lore, language/market/rating, setting/budget) so you see the brief assemble in real time. **Begin the build** validates the title, aggregates the source text, assembles `sources[]`, picks a smart framework if none was chosen, and calls the build with the full brief. From here the pipeline writes the **Logline** and runs the ladder.

#### The complete brief field set (defaults)

```
mode: 'ADAPT'              projectType: 'MOVIE'        episodes: 10 · minutesPerEp: 50 · seasons: 1
sourceText / pastes / urls / files        realBased: true · realityLevel: 'INSPIRED'
researchSubject: true · researchAmount: 55 · realPersonNote
baseGenres[] (≤3) · baseGenre · subgenre · subMix{presence,intensity} · blendLayers[] · tones[] · moods[] · treatment
settingCountry · settingEra · settingWorld[] · cultureEra · settingPlace[]
projectIntent · budgetTier · framework
styles[] (≤2) · styleMix{}
spine.endingIds[] (≤2) · spine.endingCustom · spine.ending
layer: loreSelections[]{slug,role,weight} · loreDensity · lorePolicy{allowHistoricalPantheon, genreIntensity{}}
language · country · rating · format · marketKey · seriesPreset
scriptVariety (AR dialect) · dialogueRegister (formal|colloquial) · accents[]
researchScope{subject,craft,mythology,comps,legal,general} · researchDepth: 60
AI video: aspectRatio '9:16' · durationSec 5 · videoStyle · episodeSec 75 · negativePrompt · seed
```

---

## 5. The knowledge engine — how the brief steers the writer

Before any stage is generated, the brief is compiled into a block of plain‑text **directives** that ride inside every prompt. This is what makes a Beirut rom‑com sound different from an Abbasid war epic. The composer is `knowledgeDirective(brief)` (`knowledge/index.ts`); each sub‑directive is a pure function of the brief that returns an empty string when it doesn't apply, so existing builds are never disturbed.

### 5.1 What gets composed, and when

`knowledgeDirective` assembles these parts in order (each only when relevant):

| # | Directive | Fires when | What it injects |
| --- | --- | --- | --- |
| 1 | `formatDirective` | always | the format/episode/length/act/arc shape (§3.7) |
| 2 | `videoDirective` | family = AI video | per‑scene ≤N s, aspect ratio, negative prompts, visual style, "one observable action per shot", "strict character consistency" |
| 3 | `verticalDirective` | family = VERTICAL | the micro‑drama engine (Beat Engine, Reversal engine, Paywall, 9:16 framing, MENA model) |
| 4 | `documentaryDirective` | family = DOCUMENTARY | the thesis→edit→narration rules, subgenre shape, rights artifacts |
| 5 | `eraDirective` | setting resolves to a known country/era | period language register, naming, dress, sacred sensitivity |
| 6 | `accentDirective` | accents matched (non‑Arabic) | idiom + capitalized parenthetical model, per‑accent cautions |
| 7 | `realPersonDirective` | `realBased` | fidelity level (faithful/inspired/loose) + how much documented detail |
| 8 | `conflictDirective` | war/political story detected | real war/colonial substrate: sides, stakes, theatres, hero archetypes, sensitivity |
| 9 | `styleDirective` | styles chosen | the up‑to‑2 craft packs and how strongly to apply them |

(The base genre line is emitted separately by `intakeSteer`, so it isn't duplicated here.)

### 5.2 The knowledge catalogs

Each catalog is the single source of truth for both the intake UI and the steering text:

- **Genres** (`genres.ts`) — 15 base genres (each with subgenres), 10 blend layers, 9 tones, 8 moods, 8 treatments.
- **Styles** (`styles.ts`) — 14 craft packs, each defining 5 dimensions (dialogue, structure, voice, visual grammar, scene construction). Opt‑in, strength 0–4. Hard guardrail: *"This steers craft only. Never change the plot, characters, setting, facts, era, conflict or lore to fit the style."*
- **Eras** (`eras.ts`) — **27 country timelines**, each an ordered list of civilisations with high/low language register, script, diglossia flag, accent notes, naming, dress and a **sacred** sensitivity flag (none/aware/high). Covers Egypt, Iraq, Greece, Britain, Mexico, Japan and the full Arab League (Saudi, Yemen, UAE, Qatar, Kuwait, Bahrain, Oman, Syria, Lebanon, Jordan, Palestine, Morocco, Algeria, Tunisia, Libya, Mauritania, Sudan, Somalia, Djibouti, Comoros). Setting fields are read in priority order: `settingCountry` → `settingPlace` → `cultureEra` → `settingEra` → `country` → `market` (the story's setting beats the audience market).
- **Accents** (`accents.ts`) — 10 accents (RP, Cockney, Glaswegian, Hiberno‑Irish, US Southern, AAVE, Castilian, Rioplatense, Mexican, Kansai‑ben) with idiom + parenthetical + cautions. **Never phonetic eye‑dialect.** Bows out entirely for Arabic (the dialect engine owns it).
- **Conflicts** (`conflicts.ts`) — war/colonial/resistance history for **~22 countries**, era‑linked. Only fires for war/political stories. Gives the writer real sides, stakes, theatres and **archetype roles (never named real individuals)**, plus a per‑conflict sensitivity guardrail (e.g. high → "stay strictly non‑partisan… never assign collective guilt… prefer 'inspired by' over depicting real living figures").
- **Documentary** (`documentary.ts`) — 8 subgenres (nature, sports, true‑crime, political, bio, music, vérité, essay) × 6 Nichols modes (expository, observational, participatory, reflexive, performative, poetic), and the 7‑stage chain ending in narration written last.
- **Vertical** (`vertical.ts`) — the micro‑drama craft: Beat Engine (Hook 0–15 s · Friction · Spike ~1:00 · Button cliffhanger), Reversal engine (shock→hurt→release in public), Paywall mapping (free block earns the unlock), 9:16 framing, plus the MENA model (8 episode templates, 8 story engines, the Addiction Loop, 5 golden rules).
- **AI‑video styles** (`index.ts`) — the 8 `VIDEO_STYLES` and the `videoDirective` rules.

### 5.3 Sacred‑content & sensitivity guardrails

Two hard guardrails are woven through the steering and survive every stage:

- **Sacred content** (from `intakeSteer`): *"do NOT depict, name, voice, or write dialogue for God, any deity, or any prophet… If a request would breach these, REDIRECT to the compliant alternative rather than refuse."* High‑sacred eras raise this automatically.
- **Conflict sensitivity**: contested/high‑sensitivity histories force non‑partisan, civilian‑dignified treatment and prefer "inspired‑by" over depicting real living figures.

### 5.4 The Arabic diglossia engine

Arabic builds get a dedicated machine (in `scripton.service.ts`): a per‑dialect **feature card** (~21 dialects with negation/future/progressive/possession/demonstrative/question particles + phonology), few‑shot **exemplars** (built‑in + your saved ones), a list of **banned MSA tells** to avoid in colloquial dialogue, a heuristic **dialect‑fidelity score**, and an AI **dialect‑repair** pass that transcreates dialogue into the chosen dialect. *Formal* register keeps the whole script in فصحى; *colloquial* writes action in فصحى and dialogue in the dialect.

---

## 6. The generation pipeline — brief → finished script

The engine is `ScripOnService` (`scripton.service.ts`, ~2,074 lines). It develops a build one stage at a time along the format ladder, then assembles a full screenplay scene by scene. Everything is non‑destructive and salvage‑hardened.

### 6.1 The develop ladder

When a build is created, the ladder for its format (§3.1) is materialised as `DevelopmentStage` rows. The classic fallback order (`STAGE_ORDER`) is **LOGLINE → SYNOPSIS → TREATMENT → BEATS → SCENES → STEP_OUTLINE → DRAFT → COVERAGE**; the Format Engine ladder overrides it per build. Stages run strictly in order — each stage's prompt includes **all earlier approved stages** as "DEVELOPMENT SO FAR", so the work compounds.

#### Every stage, by family

| Stage `kind` | Family | Produces | Token cap |
| --- | --- | --- | --- |
| `LOGLINE` | feature/series/AI | one logline ≤40 words (protagonist + opposing force + stakes) | 600 |
| `SYNOPSIS` | feature/series/AI | 3‑paragraph synopsis (setup / escalation / resolution) | 2,400 |
| `TREATMENT` | feature/series/doc | tight prose treatment, ~10 beats across 3 acts, present tense | 25,000 |
| `BEATS` | feature/series | story mapped onto the chosen FRAMEWORK's beats `[{name, beat, purpose}]` | 25,000 |
| `SCENES` | all narrative | 24–40 scene cards, each turning a value (chargeOpen ≠ chargeClose) | 25,000 |
| `STEP_OUTLINE` | feature/series | one short numbered paragraph per scene (the draft‑ready roadmap) | 25,000 |
| `DRAFT` | feature/series | full screenplay, Final Draft format, numbered scene headings (raw text) | 25,000 |
| `COVERAGE` | all | studio coverage read, verdict PASS / CONSIDER / RECOMMEND | 2,000 |
| `SEASON_ARC` | series | season‑long throughline (3–5 paragraphs) | 25,000 |
| `EPISODE_MAP` | series / vertical | every episode: `EP n — Title — logline — ends on: the hook` | 25,000 |
| `PREMISE` | vertical / AI | the pre‑loaded conflict ("the explosion already in progress") | 2,400 |
| `STORY_ENGINE` | vertical / AI | the repeatable conflict machine (friction every 60–90 s) | 3,500 |
| `BEAT_ENGINE` | vertical / AI | per‑episode beats: Hook 0–15 s · Friction · Spike ~1:00 · Button cliffhanger | 25,000 |
| `THESIS` | documentary | the central argument / question | 2,400 |
| `RESEARCH_PLAN` | documentary | footage / records / data / experts / access plan | 4,000 |
| `RIGHTS_PLAN` | documentary | tracked checklist: life‑rights, music sync/master, archive, releases | 3,000 |
| `INTERVIEW_OUTLINE` | documentary | subjects + questions grouped by theme + verité sequences | 5,000 |
| `PAPER_EDIT` | documentary | string‑out: the ordered spine the edit follows, act by act | 25,000 |
| `NARRATION` | documentary | VO script to locked picture — **written last** (raw text) | 25,000 |
| `SHOT_LIST` | AI video | ordered shots for 9:16 — each shot = ONE observable physical action | 25,000 |
| `VIDEO_PROMPT` | AI video | strict JSON of cinematic shots — the full text‑to‑video spec (below) | 25,000 |

Heavy stages (SCENES, STEP_OUTLINE, DRAFT, TREATMENT, BEATS, EPISODE_MAP, BEAT_ENGINE, PAPER_EDIT, NARRATION, SEASON_ARC, SHOT_LIST, VIDEO_PROMPT) are **streamed** with a 600 s overall / 120 s idle‑stall timeout, and **fail over to the next engine** if a stage truly stalls (~2 min). Model selection, model IDs and failover order live in the AI gateway (`AiService`), keyed by a `task` string per stage.

#### The 13 story frameworks (the BEATS map)

`savecat` (Save the Cat, 15) · `vogler` (Hero's Journey, 12) · `harmon` (Story Circle, 8) · `field` (Paradigm, 7) · `sequence8` · `tv_network` · `limited` · `three_act` · `hauge` · `freytag` · `kishotenketsu` · `truby` (22 Steps) · `story_spine` (Pixar). BEATS defaults to Save the Cat.

### 6.2 How a stage is built (the prompt)

`generateStage` assembles each stage's prompt by concatenating, in order:

1. `STAGE: <kind>` (+ the chosen framework for BEATS)
2. **CREATIVE BRIEF** — `intakeSteer(projectId)`: genres/tone, fantasy/lore layer + density, format/runtime, genre‑intensity dials, setting/world, the spine (want/need/opposing/theme/ending), constraints (budget/locations/cast), and the **sacred‑content hard rules**.
3. **Research notes** (early stages only) — from the IntakeProfile.
4. **Source material** to adapt (LOGLINE/SYNOPSIS/TREATMENT/BEATS/PREMISE/STORY_ENGINE/SEASON_ARC/THESIS).
5. **DEVELOPMENT SO FAR** — all earlier stage bodies (the running canon).
6. **FORMAT & WORLD ENGINE** — `knowledgeDirective(brief)` (§5).
7. **Language directive** — the Arabic diglossia block (empty for English).
8. The output instruction — "Return ONLY JSON {shape}" (or, for DRAFT/NARRATION, "write as plain text"; for VIDEO_PROMPT, the exact shot schema).

The shared base instruction: *"You are a development executive developing a story stage by stage. Stay true to the prior approved stages and the creative brief. Return ONLY JSON… Do NOT include any title, format, rating, episode count, or metadata header."*

### 6.3 From stages to a full screenplay

When a stage version is approved, **Promote to script** (`promoteToScript`) creates a `ScriptDocument` + an initial `White Draft` revision, then runs `generateScriptAsync` in the background. By family:

- **Feature/Short/Series** → `generateFeatureAsync`: builds the writing context from logline+synopsis+treatment+beats, builds the full developed **spine** (synopsis+treatment+beats+step‑outline), counts beats, computes the target scene count (§3.6), **plans the scenes** (`planScenes`, up to 5 continuation passes to reach length *and* the final beat), then **dramatises each scene** with `writeScene` (1.5–2.5 pages, temperature 0.85, 3 retries; the slug is supplied so headings are deterministic), paginating every 3 scenes. It appends `FADE OUT.` and runs `verifyEnding` to confirm the script reached the outline's climax + resolution (marks coverage `COMPLETE`/`SHORT`).
- **Vertical** → `generateVerticalAsync`: writes each episode (`writeVerticalEpisode`) — Hook detonates immediately, Spike re‑prices everything at ~60 s, Button cuts on a cliffhanger, ~150–260 words per screen‑minute.
- **Documentary** → `generateDocumentaryAsync`: narration written last, to picture.

`regenerateFeature(mode='extend'|'rewrite')` re‑runs an existing doc non‑destructively — it writes a **new revision** and only swaps the active revision when the run finishes `DONE`, so a failed/partial run never destroys the previous good draft. After a clean DONE, `materialiseScenes` parses the script into `ScriptScene` rows (the bridge that feeds Breakdown, Schedule, the Reader, and the video pipeline).

### 6.4 The AI‑video generation spec (`VIDEO_PROMPT`)

For AI‑video builds, the final develop stage emits a strict JSON payload — `{format:"VERTICAL_AI_VIDEO", aspectRatio:"9:16", shots:[…]}` — where each shot is a complete, self‑contained text‑to‑video prompt with: `index, durationSec, location, subject, wardrobe, facial_expression, body_language, shot_size, camera_angle, lens, camera_movement, zoom, lighting, color_style, reading_dialogue, audio_fx_ambiance, prompt, negativePrompt, seed`. The `prompt` field is a ~40–120‑word prompt ready for ComfyUI / Runway / Seedance (notably: *avoid the word "fast" — it causes jitter*). This payload is what the render pipeline (§8.3) consumes.

### 6.5 Robustness — why builds don't silently fail

The pipeline is heavily hardened:

- **Truncated‑JSON salvage** — `recoverStage` (beats/scenes/steps) and `salvageVideoShots` (the VIDEO_PROMPT shot array) brace‑match complete objects out of a cut‑off blob and keep every shot that parses; VIDEO_PROMPT is always re‑serialised as valid JSON, never a truncated string.
- **Continuation passes** — SCENES/STEP_OUTLINE extend up to 4 times to finish a truncated array; `planScenes` up to 5 to reach feature length *and* the final beat; a persisted `warning` surfaces if it's still short (never silent).
- **Stub detection** — if ≥50% of scenes come back as the placeholder stub, the run is marked `ERROR` (not filed as DONE), so the previous real draft survives.
- **Progress + stall guard** — a `genProgress` map tracks status/phase/page count with a PLANNING heartbeat, so the UI's stall detector doesn't false‑alarm while the model is planning (no page movement yet).
- **Slugline guarantee** — `ensureSluglines` makes sure a feature is never filed without numbered scene headings (EN or AR).

### 6.6 What gets persisted

| Model | Holds |
| --- | --- |
| `DevelopmentBuild` | the build root + the authoritative per‑build `brief`; status `DRAFT/REVIEW/GREENLIT/PROMOTED` |
| `BuildVersion` | V1/V2/V3 snapshots, each with a frozen `briefSnapshot` |
| `DevelopmentStage` / `StageVersion` | one row per ladder rung; the generated output + `data` (beats/scenes/steps/shots/videoPayload/warning); status `DRAFT/REVIEW/APPROVED/LOCKED` |
| `IntakeProfile` | the shared per‑project brief + research notes + character bible + typed levers |
| `ScriptDocument` / `ScriptRevision` | the script doc + its colour‑coded revisions (paginated `pageText`, ~55 lines/page) |
| `ScriptScene` | parsed scenes (number, slug, int/ext, day/night, set, description, pages) |
| `CoverageReport` / `ScriptAnalytics` / `CoverageNote` | coverage grades, analytics, living notes |
| `CanonFact` / `RevisionPass` / `SceneChange` / `BuildVersion` / `DecisionRecord` | the continuity kernel (§7) |
| `VideoRun` / episode jobs | render runs + stitched episodes (§8.3) |

---

## 7. The canon continuity kernel

The kernel (`canon/`) is what keeps a screenplay self‑consistent as it grows and is rewritten. It is a **bi‑temporal story‑memory graph**: it remembers both *when a fact is true in the story* and *when it was recorded*.

### 7.1 The fact model

A canon fact is a triple with a validity window:

- **kind** — one of `CHARACTER` · `WORLD` · `LORE` · `TIMELINE` · `RELATIONSHIP` · `PLOT`.
- **subject / predicate / object** — e.g. `MARIAM` / `status` / `dead`; the `(subject, predicate)` pair is the identity key for conflict detection.
- **statement** — the human sentence ("Mariam is killed in the raid").
- **validFrom / validTo** — the story‑order window `[from, to)`; `validTo: null` = still true at the end.
- **status** `ACTIVE`/`SUPERSEDED`, **recordedAt** (write order), **sourceSceneId**.

Facts are produced two ways: AI‑extracted from scene prose (`extractFactsAI` → only "durable world facts a later scene must not contradict"), or carried on a **staged change** as already‑vetted facts.

### 7.2 The two‑stage continuity gate

1. **At stage time** (`stageChange`) — when you stage a change in the Write screen, its facts are checked against everything established (excluding the scene's own prior facts). **If it contradicts canon, the stage is blocked** and you're told why ("`MARIAM.status: canon says "alive" but the new draft asserts "dead"`"). The change never persists.
2. **At render time** (`renderPass` → `assessPass`) — the curated change facts are re‑checked and the pass is **scored** (never blocked). `continuityScore = 1 − conflicts/(changes+conflicts)`, clamped 0–1; the UI shows this × 100 as the green continuity ring.

A render creates a real new `BuildVersion` (V2, V3, …), supersedes the changed scenes' prior facts, writes an append‑only `DecisionRecord`, and marks the pass `RENDERED`. The whole kernel is fail‑safe (bad input → empty result, never a throw).

### 7.3 Injection — new scenes respect old facts

When a scene is (re)written, `canonDirective` resolves the facts true at that story point and injects them as: *"CANON (honour — do not contradict): − MARIAM — Mariam is killed in the raid…"* — so the writer can't undo established reality.

### 7.4 Public surface

`CanonService` exposes: `extractFactsAI`, `listFacts`, `openPass`, `stageChange`, `renderPass`, `renderResult` (the Render→Compare view), `versionsView` (the Versions screen), `workspaceTopVersion` (the top‑bar ring + version chip), `directiveFor` (the injection block), `persistFacts`.

---

## 8. Downstream — Doctor, Revisions, AI video, Export

Once a script exists, the rest of the OS operates on it.

### 8.1 Doctor — coverage & diagnostics

The Doctor workspace runs studio‑grade analysis on the live script:

- **Coverage** (`coverage`) — logline, synopsis, comps, grades (structure/character/dialogue/pace), and a verdict `PASS / CONSIDER / RECOMMEND`, persisted as a `CoverageReport`; **coverage history** is kept.
- **Diagnostics** (`diagnostics`) — per‑scene "script read": verdict, what the scene wants, the obstacle, subtext, power shift, confidence.
- **Budget‑Fit** (`budgetFit` / `applyBudgetFit`) — find and apply cost‑reducing rewrites (merge night exteriors, day‑for‑night, etc.).
- **Transform / Rating / Culture‑screen / Market‑forecast / Greenlight‑decision** — content rating, cultural‑sensitivity screen, market read, and a greenlight recommendation.
- **Notes** — living `CoverageNote`s (NOTE/CONCERN) per scene, resolvable, auto‑staled when the scene changes.

### 8.2 Write & Revision passes

The Write canvas edits the script with the Story Spine. You **stage a change** (re‑ending, revise, emotion, budget‑fit, regenerate) → it's continuity‑gated (§7.2) → **Render** produces a new draft and a **Render → Compare** view (V2 ↔ V3) with the continuity score and the canon written. The **Versions** screen shows the version tree, the pending "Rendering…" node, and the append‑only decision log.

### 8.3 AI vertical‑video render pipeline

For AI‑video builds, the `VIDEO_PROMPT` payload (§6.4) feeds the render module (`backend/src/video/`). The flow:

1. **Character anchor** (`POST anchor`) — generate an approved reference head‑shot (Seedream `…/seedream/v4/text-to-image` via `FAL_KEY`, default 1080×1920). This locks identity.
2. **Per‑scene render** (`POST generate`) — each ≤5 s shot renders through an ordered **failover chain**: **local ComfyUI** (primary, free, RTX) → **Runway Gen‑4.5** → **ByteDance Seedance 2.0** (via fal). Seedance picks its endpoint by inputs: `reference-to-video` when identity images (`@Image1…9`, Face Lock) and/or previous‑clip videos (`@Video1…3`, continuity) are passed; `image-to-video` for a start/end frame; else `text-to-video`. Native audio (dialogue+music+SFX) is generated in one pass.
3. **Cohesive episode** (`POST episode`) — a background job renders each beat **in order**, passing the anchor as the identity reference and the previous clip as the continuity reference, so the character's look/face/outfit carry scene‑to‑scene; durations clamp 4–15 s.
4. **Stitch** (`POST stitch` / end of the episode job) — ffmpeg concatenates the completed clips into one 9:16 MP4 under `/uploads` (stream‑copy fast path, re‑encode fallback). The stitched episode is persisted as a `VideoRun` so it survives restarts.

Engines, credentials and routing are governed in **Settings → Video engines** (`VideoEnginesService`): a registry of providers (local_comfy, runway, seedance, luma, kling) with on/live status, per‑capability routing policies (`VIDEO_DEFAULT`/`PREVIEW`/`FINAL`), org + project‑override chains, and health checks.

### 8.4 Export & package

- **DOCX** — `POST development/package/docx` renders the development package (or the script) to a Word attachment, RTL‑aware.
- **PDF** — `POST render-pdf` renders HTML → PDF (prefers installed Chrome/Edge over bundled Chromium).
- **Package** — `GET development/package` assembles the build package (brief + stages + coverage).

---

## 9. API surface — every endpoint

All ScriptON routes are under **`/api/v1/production/scripton`** (`scripton.controller.ts`); video routes under **`/api/v1/production/video`** (`video-engines.controller.ts`). Reads need permission `production:1`, mutations `production:2`.

### Intake / brief
| Method | Path | Purpose |
| --- | --- | --- |
| GET / POST | `intake/:projectId` | get / save the brief |
| POST | `research/:projectId` | run research for the brief |
| GET | `lore` | lore library lookup (culture/genre/archetype/q/pantheon) |
| POST | `ingest` | ingest a URL or HTML (SSRF‑guarded) |
| POST | `role-profiles/:projectId` · `lookboard/:projectId` · `market-read/:projectId` | cast/look/market prep |

### Build / develop
| Method | Path | Purpose |
| --- | --- | --- |
| GET / POST | `builds` | list / create builds (`?bin=1` = recycle bin) |
| POST | `builds/:id/{rename,status,delete,restore,purge}` | build lifecycle |
| GET | `development/pipeline/:projectId` | the develop ladder state |
| POST | `develop/:projectId` | run a develop pass (proposal) |
| POST | `adapt/:projectId` · `adapt-one/:projectId` · `format-convert/:projectId` | adapt / convert |
| GET/POST | `development/versions/:buildId` (+ `/new`, `/switch`) · `development/version/:id/{discard,duplicate,status,read,set}` | build versions |
| POST | `development/character-bible/:projectId` | generate the character bible |

### Generate / promote
| Method | Path | Purpose |
| --- | --- | --- |
| POST | `development/generate/:projectId` | **generate a develop stage** |
| GET | `script-progress/:documentId` | live generation progress (the stall‑safe heartbeat) |
| POST | `development/version/:id/promote-to-script` | promote a stage → script doc (starts full draft) |
| POST | `development/script/:docId/regenerate` | regenerate feature (`mode=extend\|rewrite`) |
| POST | `development/version/:id/promote-build` · `development/build/:id/promote` | promote → production project |

### Doctor / coverage
`GET coverage/:projectId` · `GET coverage-history/:projectId` · `POST coverage/:projectId` · `POST diagnostics/:projectId` · `POST budget-fit/:projectId` (+ `apply-budget-fit`) · `POST transform/:projectId` (+ `apply-transform`) · `POST rating` · `POST culture-screen` · `POST market-forecast` · `POST greenlight-decision` · `POST analytics/:projectId`.

### Revision / compare / canon / notes
`POST compare/:projectId` · `GET development/compare?a&b` · `GET revision-pass?scriptId` · `POST revision-pass/stage` · `POST revision-pass/:passId/render` · `GET revision-pass/render-result?passId` · `GET versions?scriptId` · `GET top-version?projectId&scriptId` · `GET canon?scriptId` · `GET/POST notes/:projectId` (+ `seed`, `note/:id/resolve`, `note/:id/delete`, `notes-stale`).

### Dialect (Arabic QC)
`GET/POST dialect/exemplars` (+ `/:id/delete`) · `POST dialect/check` · `POST dialect/repair`.

### Export / settings / workspace
`POST render-pdf` · `GET development/package` · `POST development/package/docx` · `GET workspace` · `GET/PATCH settings`.

### Video (`/production/video`)
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `engines` · `engines/:key/status` · `health` | engine registry + status |
| POST/PUT/DELETE | `engines` (+ `/seed`, `/:id`) | manage engines |
| GET/PUT | `routing` · `routing/:capability` · `routing-resolved` | routing policy |
| POST | `generate` | render one shot → `{runId}` |
| GET | `runs` · `runs/:id` | list / poll runs |
| POST | `anchor` | character‑anchor image → `{imageUrl}` |
| POST | `episode` · GET `episode/:id` · GET `episodes` | cohesive episode render + poll + list |
| POST | `stitch` | concat completed clips → one MP4 |

---

## 10. Data model + file map

### Where each thing lives

| Area | Path |
| --- | --- |
| Format engine (families, presets, ladders, scene‑count) | `backend/src/production/scripton/knowledge/formats.ts` · `series-scene-count.util.ts` |
| Knowledge layers | `backend/src/production/scripton/knowledge/{index,genres,styles,eras,accents,conflicts,documentary,vertical}.ts` |
| Generation pipeline | `backend/src/production/scripton/scripton.service.ts` |
| Intake levers / collab mode / helpers | `…/intake-levers.util.ts` · `collab-mode.util.ts` · `scripton.util.ts` |
| Canon continuity kernel | `backend/src/production/scripton/canon/*.ts` |
| API controllers | `…/scripton.controller.ts` · `backend/src/video/video-engines.controller.ts` |
| AI‑video render | `backend/src/video/{video.service.ts, video-engines.service.ts, providers.ts}` |
| Export | `…/package-docx.*` · `protected-export.service.ts` |
| **The brief screen (from‑scratch intake)** | `frontend/src/components/scripton/ScriptOnIntake.tsx` |
| Create‑flow chrome / builds | `…/ScriptOnStudio.tsx` · `ScriptOnBuildScreen.tsx` · `ScriptOnBuildsPanel.tsx` |
| Develop workspace | `…/develop/ScriptonDevelop.tsx` |
| Write canvas + revision pass | `…/write/ScriptonWrite.tsx` |
| Doctor / Canon / Versions / Compare | `…/{doctor,canon,versions,compare}/*.tsx` |
| AI‑video panels | `…/VideoRenderPanel.tsx` · `CohesiveEpisodePanel.tsx` |

### The build lifecycle in one line

```
New Build (ScriptOnIntake) → brief → DevelopmentBuild → develop ladder (StageVersions)
   → Promote to script → ScriptDocument + ScriptRevision (full screenplay) → ScriptScenes
   → Doctor (CoverageReport) · Write (RevisionPass → BuildVersion, canon-checked)
   → [AI video] anchor → VIDEO_PROMPT → VideoRuns → stitched episode
   → Promote → ProductionProject (real production)
```

---

*End of reference. Every format, field, stage, endpoint and rule above was read directly from the current source.*

