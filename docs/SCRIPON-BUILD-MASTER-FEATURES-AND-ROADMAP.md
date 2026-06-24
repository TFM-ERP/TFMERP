# ScripON Build — Master Features & Roadmap

_Generated 2026-06-24 from the codebase + the ScripON design/spec docs. **Source of truth = code**; build status cross-checked against `ScripON-Doctor-MASTER-STATUS.html` (19 Jun 2026), `docs/system/18-feature-gap-analysis.md`, and the `docs/knowledge-base/scripon/` guideline set._

> **What ScripON Build is:** a brief-driven screenplay-development engine. You author a **Brief**; a **Format Engine** re-wires the develop pipeline to your project type + market; the engine generates the script stage-by-stage (logline → … → draft), auto-generates a character breakdown and coverage, lets you re-run whole **versions (V1/V2/V3)**, and exports an investor-grade, protected package. Domain knowledge is encoded once in two mirrored layers — machine-readable modules (`backend/src/production/scripton/knowledge/`) the generator consumes, and human-readable guideline docs (`docs/knowledge-base/scripon/`).

---

## 1. The build flow (pipeline)

```
Brief (IntakeProfile / DevelopmentBuild.brief)
   │
   ├─ stageLadderFor(brief) ─────────► picks the develop ladder for the format
   │
   ▼
Per-stage generation  (generateStage)
   prompt = intakeSteer + langDirective + knowledgeDirective + prior-stage context
   LOGLINE → SYNOPSIS → TREATMENT → BEATS → SCENES → STEP_OUTLINE → DRAFT → COVERAGE
   │                                   (ladder swaps per format — see §5)
   ▼
promoteToScript → generateScriptAsync (dispatched by family)
   Feature/Series → plan scene map (50–88) → write scene-by-scene → paginate
   Vertical       → parse episode map → write first ≤15 episodes (free block)
   Documentary    → assemble narration to the paper-edit
   │
   ├─ auto Character Bible (on SCENES)        ├─ Coverage + Analytics
   ▼
Development Package  (read-model: spine · characters · world · market · coverage)
   │
   ├─ Build Versions  V1 / V2 / V3  (frozen brief snapshot + ladder + script per run)
   ▼
Protected export (PDF) · revisions (WGA colour wheel) · promote → Project
```

**Default ladder** (`STAGE_ORDER`): `LOGLINE → SYNOPSIS → TREATMENT → BEATS → SCENES → STEP_OUTLINE → DRAFT → COVERAGE`. The Format Engine swaps this per format (§5). Knowledge is injected as plain-text **steering** appended to each generation prompt — it guides the model; it is not hard-coded plot logic.

---

## 2. Options to build a script — the Brief (every lever)

Everything below is a real input the engine reads (persisted on `IntakeProfile`, or carried through `DevelopmentBuild.brief` / `BuildVersion.briefSnapshot` JSON). Grouped by band.

### 2.1 Source & mode
| Lever | Values | Field |
|---|---|---|
| Build mode | `ORIGINAL` (from scratch) · `ADAPT` (existing material) · `SEED` | `mode` |
| Source material | pasted text · website URL · uploaded file (**PDF / FDX / Fountain / Word / EPUB / HTML**) | `sourceText`, `sourceUrl`, `sourceFileUrl`, `sourceKind` |

### 2.2 Format & market — *re-wires the whole build*
| Lever | Values | Field |
|---|---|---|
| Project type | Feature · Short · Series (TV/streaming/limited) · **Vertical micro-drama** · Documentary | `projectType` / `format` |
| Market | US streaming · US network · UK · K-drama · Turkish dizi · Telenovela · Anime · **Ramadan musalsal** · Nordic noir · Vertical (global/MENA) | `market` / `country` / `language` |
| Series shape | episode count · minutes per episode · seasons | `episodes`, `minutesPerEp`, `seasons` |

### 2.3 Creative DNA
| Lever | Count / values | Field |
|---|---|---|
| Base genre | **15** — action, adventure, comedy, crime, drama, fantasy, historical, horror, musical, mystery, romance, sci-fi, thriller, war, western (each with 4–7 subgenres) | `genres`, `subgenre` |
| Blend layers | **10** — war, romance, fantasy, noir, satire, mystery, coming-of-age, political, supernatural, survival | `blendLayers` |
| Tone | **9** — epic, grounded, tragic, ironic, comic, romantic, satirical, pulpy, lyrical | `tone(s)` |
| Mood | **8** — foreboding, bittersweet, hopeful, tense, melancholic, whimsical, dread, warm | `mood(s)` |
| Treatment | **8** — linear, non-linear, multi-POV, frame, anthology, real-time, epistolary, unreliable narrator | `treatment` |
| Fantasy / myth | on/off · type · mythology culture · blend level (`REALISTIC/BALANCED/MYTHIC`) | `fantasyOn`, `fantasyType`, `mythologyCulture`, `blendLevel` |

### 2.4 Setting & world (drives language, naming, dress, sacred-sensitivity)
| Lever | Notes | Field |
|---|---|---|
| Country | **26** country timelines (the 22 Arab League states + Greece, Britain, Mexico, Japan) | `settingCountry`, `country` |
| Era | ordered civilisation timeline per country; defaults to modern | `settingEra`, `cultureEra`, `eraKey` |
| Place / world | free setting + world-building notes | `settingPlace`, `settingWorld` |

### 2.5 Language & dialect
| Lever | Values | Field |
|---|---|---|
| Language | any; **Arabic** gets the deep dialect engine | `language` / `scriptLanguage` |
| Arabic variety | **22** — Egyptian (Cairene/Saidi), Levantine (Damascene/Lebanese/Palestinian/Jordanian), Gulf (Emirati/Kuwaiti/Qatari/Bahraini), Saudi (Najdi/Hejazi), Omani, Iraqi (Gelet/Qeltu), Maghrebi (Moroccan/Algerian/Tunisian/Libyan), Sudanese, Yemeni | `scriptVariety` |
| Register | `formal` (MSA only) vs `colloquial` (diglossia: action in فصحى, dialogue in dialect) | `dialogueRegister` |
| Accents (beyond Arabic) | **10** — RP, Cockney, Glaswegian, Hiberno-Irish, US Southern, AAVE, Castilian, Rioplatense, Mexican, Kansai-ben | `accents`, `voice`, `dialect` |

### 2.6 Based on reality
| Lever | Values | Field |
|---|---|---|
| Real-based | on/off | `realBased` |
| Fidelity | `FAITHFUL` · `INSPIRED` · `LOOSE` | `realityLevel` |
| Detail dial | 0–100 (essence → documented) | `researchAmount` |
| Research subject | research the real person/story online | `researchSubject`, `realPersonNote` |

### 2.7 Lore Atlas (folklore / myth substrate)
| Lever | Values | Field |
|---|---|---|
| Elements | ~130 researched elements across ~20 cultures | `loreSelections` |
| Density | `OFF → ACCENT → SUBPLOT → WOVEN → DRIVER → SATURATED` | `loreDensity` |
| Policy | tiers `FOLKLORE / SACRED_AWARE / HISTORICAL_PANTHEON / CARE`; living-religion deities never seeded; pantheon opt-in | `lorePolicy` |

### 2.8 Conflict & colonization (opt-in)
| Lever | Values | Field |
|---|---|---|
| Conflict story | explicit opt-in, else auto-detected from war/political genres | `conflict`, `conflictId`, `politicalArc` |
| Coverage | **22** Arab League states, each with era-linked conflicts (sides, stakes, theatres, hero archetypes, sensitivity) | resolved from setting |

### 2.9 Style & Voice (the "how it's written" axis)
| Lever | Values | Field |
|---|---|---|
| Style packs | **14** — fast-ensemble, slow-burn, mythic-quest, hyperlink-mosaic, noir-voice, genre-pastiche, maximalist-spectacle, deadpan-absurd, vérité-handheld, lyrical-memory, chamber-intimate, bingeable-cliff, punchy-spot, investigative-build | `styles` / `stylePacks` |
| Strength | per-pack 0–4 (subtle → defining); max 2 blend | `styleMix` |

### 2.10 Targets, intent & guardrails
| Lever | Values | Field |
|---|---|---|
| Intent | the project's purpose | `projectIntent` |
| Budget tier | drives location/scale guardrails | `budgetTier` |
| Rating | MPA / BBFC / GCAM / UAE etc. | `rating` |
| Comps / constraints | comparable titles, hard constraints, sensitivity | `comps`, `constraints`, `guardrails`, `sensitivityTier` |
| Story framework | **14** — Save the Cat, Hero's Journey (Vogler), Story Circle (Harmon), Field paradigm, 8-Sequence, TV-network, Limited, 3-act, Hauge, Freytag, Kishōtenketsu, Truby 22, Story Spine | (per-stage, BEATS) |

---

## 3. Knowledge layers (the substrate the generator consumes)

Each module is a pure, fail-safe function of the brief, paired with a guideline doc. Composed by `knowledgeDirective(brief)`.

| Layer (`knowledge/…`) | What it provides | Guideline doc |
|---|---|---|
| `formats.ts` | Format families + **9 market presets** (episodes/length/act/arc/terminology) + the 4 stage ladders | `00`, `02` |
| `vertical.ts` | Vertical micro-drama: Beat Engine (Hook·Friction·Spike·Button), Addiction Loop, paywall economics, 9:16 rules, **8 MENA story engines + 8 episode templates** | `01` |
| `documentary.ts` | **8 subgenres × 6 Nichols modes**, ladder swap, rights-as-tracked-items | `03` |
| `eras.ts` | **26 country → era timelines** (register, diglossia, script, naming, dress, sacred flag) | `04` |
| `accents.ts` | **10** beyond-Arabic accents, two-knob model (dialect × register), no eye-dialect rule | `04` |
| `genres.ts` | 15 base genres + subgenres, 10 blends, 9 tones, 8 moods, 8 treatments (bilingual) | — |
| `conflicts.ts` | **22-country** conflict/colonization substrate, opt-in, sensitivity policy | `07` |
| `styles.ts` | **14** IP-safe style/voice packs | `08` |
| `index.ts` + `realPersonDirective` | Composer (`knowledgeDirective`, `stageLadderFor`) + real-person fidelity | `05`, `06` |
| `lore-seed.data.ts` | Lore Atlas — ~130 elements / ~20 cultures, 4 tiers | (atlas) |

---

## 4. Formats — how each build differs

| Format | Develop ladder | Presets |
|---|---|---|
| **Feature / Short** | Logline → Synopsis → Treatment → Beats → Scenes → Step Outline → Draft → Coverage | 1 ep, ~90–120 min, 3-act |
| **Series** | … → **Season Arc → Episode Map** → Treatment → Beats → Scenes → … | 9 market presets (US streaming 6–13 · US network 22 · UK 3–8 · K-drama 12–16 · Turkish dizi 36 · telenovela 80–200 · anime 12–26 · **Ramadan musalsal 30** · Nordic noir 8–10) |
| **Vertical micro-drama** | **Premise → Story Engine → Episode Map → Beat Engine** → Scenes → Draft → Coverage | Global 60–100 eps / 60–90 s; MENA 40–80 eps, Arabic-first, Addiction Loop; deliverable = bible + first ≤15 episodes |
| **Documentary** | **Thesis → Treatment → Research Plan → Rights Plan → Interview Outline → Paper Edit → Narration** → Coverage | no dialogue beats; narration written last; 8 subgenres × 6 modes |

Two flags always carried: **terminology** (UK = "Series" not "Season") and **K-drama production model** (live-shoot vs pre-produced).

---

## 5. The build tools (UI surface — 14 live screens)

All under `/scripon`, responsive (desktop / tablet / mobile):

- **Studio** — the unified host: **Intake** (brief wizard, Adapt vs From-scratch), **Builds**, **Develop** (the stage ladder), **Format** panel.
- **Reader** — three-pane script workspace + live scene diagnostics (KEEP/CUT/CONSIDER, objective, obstacle, subtext, power-shift).
- **Breakdown** — 6 production lenses (Cast, Props, Locations, Wardrobe, Vehicles, VFX) → strips / schedule / cost.
- **Doctor** — coverage scoring (A–D, RECOMMEND/CONSIDER/PASS), diagnostics, budget-fit, rewrite slate, compare, history, comps.
- **Dialect** — Arabic fidelity scorer (0–100) + auto-repair + native exemplar bank.
- **Greenlight** — market forecast, audience quadrants, cost, P(greenlight) decision memo.
- **Package** — investor dossier (10 sections) + character-bible generator + **promote to production**.
- **Library** · **Notes** (scene-anchored threads) · **Revisions** (WGA colour-wheel diff) · **Approvals** (sign-off chain + compliance gate) · **Reports** (PDF/XLSX/FDX) · **Schedule & Budget** · **⌘K command palette**.

### Doctor AI engine — P0–P7 (all shipped)
P0 Coverage + scene diagnostics + version compare + import/OCR · P1 budget/location-fit rewrite → non-destructive GREEN branch · P2 creative transforms (tighten, punch-up, genre transpose, ending re-engineer, humour, intensity) · P3 culture/compliance/rating (MPA/BBFC/GCAM/UAE + MENA culture screen) · P4 format conversion (film ↔ series ↔ vertical) · P5 market & greenlight intelligence · P6 adaptation & development studios · P7 greenlight decision layer (scorecard, quadrants, ROI, memo).

---

## 6. Outputs & protection

- **Per-stage outputs** persisted (survive reload); **full script** with deterministic numbered INT/EXT sluglines (Arabic-native داخلي/خارجي when Arabic).
- **Auto character bible** (6–9 principals) generated on Scenes — no manual step.
- **Coverage + analytics** — pacing, structure (TRIPOD turning-points as reference), dialogue/Gini, character co-occurrence network.
- **Development Package** read-model + **Build Versions** (V1/V2/V3, each a frozen brief + ladder + script).
- **Protected PDF export** — `standard` (selectable) vs `enhanced` (rasterised); per-recipient watermark + trace footer; qpdf permission flags; metadata sanitised; non-guessable copy-id + audit record; **hard rule: no unprotected fallback**.

---

## 7. Roadmap

### ✅ Shipped (per MASTER-STATUS 19 Jun)
Doctor P0–P7 engine · the Adapt/Build **Format Engine** knowledge layer (all 9 modules) · **14 live screens** (desktop/tablet/mobile) · run-level **Build Versions** in the backend · unified `AiService` + `AiRun` governance/audit · Prisma migration baseline (`0_init`) reconciled · automated tests (41 tests / 9 suites) · import + OCR (FDX/Fountain/Celtx/Word/PDF + scanned).

### 🔴 The one release blocker
- **Multi-tenancy** — none today (single-studio). Needs a `Tenant` model + query-scoping middleware. Highest blast radius — do it last, behind the test net + clean migration baseline.

### 🟡 Planned / next (grounded in the specs)
- **Develop-pipeline depth** (`ScripON-Studio-Development-Pipeline-Spec`): forward-only stage progression; per-stage `DevelopmentStage`/`StageVersion` rows with WGA colour tags; **approval gates** (Draft→Review→Approved→Locked); deeper **scene cards** with a McKee "flat-scene" warning; a new **Step Outline** stage between Scenes and Draft; more real frameworks; **Adapt as a first-class mode** with a coverage gate per stage.
- **Development Package guarantees**: always-filled Period·Locale + Budget tier; format-adaptive spine; **editable Word (.docx) export** *(today: PDF only — see §8)*.
- **Dedicated Cost-Optimisation and Audience screens** (currently folded into Greenlight).
- **Backend APIs**: CRUD for new entities, cross-entity search, bulk actions, async AI endpoints with progress, webhooks/notifications.
- **Vertical cliffhanger lint** (fail any episode that resolves instead of cutting on a question).
- **Consolidation**: retire/redirect the two older script entry points (`/scripts`, `/script-workspace`) in favour of `/scripon`.
- **Live pixel pass** against the `design/` frames; grow integration-test coverage; full `npm run build` validation.
- **i18n**: Arabic for the ScripON audio panel + Script Hub surfaces (part of 254 files / ~3,877 strings still English).
- **Adjacent (non-ScripON, same roadmap)**: Comms backbone, Meetings module, Transport GPS telemetry + WebRTC walkie-radio, Transport-Captain dispatch board + driver app rebuild.

---

## 8. Known gaps & caveats (design vs. ground reality)

- **Word / DOCX export is not implemented** — the package UI and design docs reference "PDF + Word," but the export service produces **PDF only**.
- **"Research-online live era deepening"** (from the redesign) is **not live** for the era path; only the real-person research fields exist.
- Several brief levers (`scriptVariety`, `dialogueRegister`, `accents`, `styleMix`, `conflict`/`politicalArc`) flow through the **JSON `brief`/`briefSnapshot`**, not typed `IntakeProfile` columns — fine for the engine, but no typed round-trip guarantee yet.
- **Analytics → representation** = speaking-character count only (demographic/Bechdel tallies deferred); **look-board image binding** deferred (descriptors + queries only, no faces by design).
- The intake wizard currently presents as **~2 steps with internal bands** (the redesign proposed a 6-step rail) — confirm against `ScripOnIntake.tsx` if the exact step layout matters.
- The service uses tolerant persistence (`this.prisma as any`, `.catch(()=>…)`), so coverage/analytics can silently fall back to in-memory if a table is missing pre-`db:push`.

---

_Cross-references: `docs/knowledge-base/scripon/` (00–08 + README) · `docs/scripon-country-era-reality-check.md` · `ScripON-Doctor-MASTER-STATUS.html` · `ScripON-Studio-Development-Pipeline-Spec.html` · `docs/system/18-feature-gap-analysis.md`._
