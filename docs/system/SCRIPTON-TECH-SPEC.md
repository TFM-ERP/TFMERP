# ScriptON / ScripON — Technical Specification

**Purpose of this document.** A dense, accurate technical map of the ScriptON script-builder as it exists today, written so another AI can extend it with a **5-second vertical AI-video generation format** without re-discovering the architecture. It documents the real services, prompts, schemas, output shapes, export pipeline, and the (currently absent) generation-payload / negative-prompt surface where the new format will plug in.

> Stack: NestJS (backend) · Next.js 14 (frontend) · Prisma/Postgres. ScriptON lives under `production/scripton` on both sides. All paths below are absolute under `C:\Projects\TFM-System`.

---

## 0. TL;DR for the extension author

- ScriptON is **text-only** today: it generates screenplays/treatments stage-by-stage via an LLM switchboard. There is **no image/video generation, no negative-prompt, and no generation-array payload anywhere** (see §5). Adding the 5-second vertical video format means introducing a *new output target* and a *new payload schema*, not modifying an existing one.
- The pipeline is **format-driven**: a `brief` (the intake profile) is normalised to a **family** (`FEATURE | SHORT | SERIES | VERTICAL | DOCUMENTARY`) which selects a **stage ladder** and stacks **directives** into the LLM system prompt. A `VERTICAL` family already exists (micro-drama, 60–90s episodes) — the 5-second format is most naturally a **new family/preset** (e.g. `VERTICAL_AI_VIDEO`) or a sub-mode of `VERTICAL` with its own ladder + a video-payload emitter stage.
- Output is persisted as **`StageVersion.data` (JSON)** + **`StageVersion.body` (text)**; export forks into **DOCX** (editable package) and **PDF** (rendered screenplay / annotated revision). A video format would add a third export target: a **structured shot/prompt payload (JSON)** for a downstream text-to-video model.

---

## 1. Application architecture (current standard cinema/TV flow)

### 1.1 End-to-end flow

```
Intake (brief)  ─►  Adapt (3 directions)  ─►  Develop (stage ladder)  ─►  Promote to Script  ─►  Export
   │                     │                          │                          │                   │
ScriptOnIntake     scripton.adapt()         generateStage() per rung    promoteToScript()    DOCX / PDF
(frontend form)    (backend, AiService)     (backend, AiService)        (renders screenplay) (package / scriptPaper)
```

1. **Intake** — the user fills a 2-step brief (`ScriptOnIntake.tsx`). Saved via `saveIntake(projectId, data)` → persisted as an `IntakeProfile` row. Auto-saved to `localStorage` as a resumable draft.
2. **Adapt** — `scripton.adapt(projectId, { sourceText, targetFormat })` asks the LLM for **3 adaptation directions**; the user picks one (or `adaptOne`) which seeds the build.
3. **Develop** — a **build** (`DevelopmentBuild`) walks a **stage ladder** (see §3). Each rung is produced by `generateStage()` and stored as a `StageVersion`. Stages support V1/V2/V3 branching, status (`DRAFT|REVIEW|APPROVED|LOCKED`), and a "read" view.
4. **Promote to Script** — `promoteToScript(versionId)` turns the developed material into a full screenplay document (`ScriptDocument`), with progress polling (`PLANNING → WRITING → DONE`).
5. **Export** — DOCX package (`packageDocx`) and/or PDF (`render-pdf`, or annotated-revision export).

### 1.2 Backend module map (`backend/src/`)

| Area | Files | Role |
|---|---|---|
| AI switchboard | `ai/providers.ts`, `ai/ai.service.ts`, `ai/llm-routing.service.ts`, `ai/llm-engines.controller.ts` | Multi-provider LLM calls + failover |
| Generation | `production/scripton/scripton.service.ts` | `generateStage`, `stageBrief`, `intakeSteer`, `langDirective`, coverage, package |
| Knowledge | `production/scripton/knowledge/index.ts`, `knowledge/formats.ts`, `knowledge/conflicts.ts` | `knowledgeDirective`, `formatDirective`, `stageLadderFor`, era/accent/conflict packs |
| Export | `production/scripton/package-docx.util.ts`, `package-docx.renderer.ts`, `script-export.service.ts` | DOCX model + writer, PDF/annotation/watermark |
| Persistence | `prisma/schema.prisma` | `IntakeProfile`, `DevelopmentBuild`, `BuildVersion`, `DevelopmentStage`, `StageVersion`, `ScriptDocument`, `CoverageReport`, `AiRun`, `LlmEngine`, `LlmRoutingPolicy` |

---

## 2. AI services used

### 2.1 Provider switchboard — `ai/providers.ts`

```ts
export type LlmProvider = 'anthropic' | 'deepseek' | 'gemini' | 'openrouter' | 'local';
export type ProviderErrorKind = 'CREDIT'|'RATE'|'AUTH'|'TIMEOUT'|'NETWORK'|'BAD_REQUEST'|'SERVER'|'UNKNOWN';

export interface ProviderCall {
  provider: LlmProvider; model: string; apiKey?: string; baseUrl?: string;
  system?: string; user: string; maxTokens?: number; temperature?: number;
  timeoutMs?: number; idleTimeoutMs?: number; stream?: boolean; beta?: string; // beta = anthropic only
}
```

Default base URLs: Anthropic `https://api.anthropic.com` · DeepSeek `https://api.deepseek.com` · Gemini `https://generativelanguage.googleapis.com/v1beta/openai` · OpenRouter `https://openrouter.ai/api/v1` · Local `http://127.0.0.1:11434/v1` (Ollama-compatible).

### 2.2 `AiService` — `ai/ai.service.ts`

Default model resolver:
```ts
get model(): string {
  return process.env.LABOR_AI_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
}
```

Public methods:
- `run(opts): Promise<AiResult>` — main entry. Provider failover chain, auto-streaming when `maxTokens > 6000` or `timeoutMs > 180s`, transient retry (TIMEOUT/SERVER/RATE/NETWORK up to 2 passes), cooldown on exhausting errors. Returns `{ text, json, model, usage, runId, provider }`.
- `complete(opts): Promise<string>` — text only.
- `json<T>(opts): Promise<T|null>` — extracts JSON.
- `raw(opts): Promise<AiRawResult>` — **Anthropic-only** (vision image blocks + tool-use); used by research/web-search. Supports `tools`, `toolChoice`. Returns `{ data, text, toolUse, usage, model, runId }`.

Cooldown:
```ts
private cool(p, kind){ const mins = kind === 'RATE' ? 1 : 10; this.cooldown.set(p, Date.now()+mins*60000); }
```

### 2.3 Routing — `ai/llm-routing.service.ts`

Built-in provider catalog / default models (overridable via `LlmEngine` + `LlmRoutingPolicy` DB tables, seeded idempotently on boot; Phase-1 enables Anthropic + Local):

| Provider | Default model | Tier | Credential env |
|---|---|---|---|
| Anthropic | `claude-sonnet-4-6` | PAID | `ANTHROPIC_API_KEY` |
| DeepSeek | `deepseek-v4-flash` | PAID | `DEEPSEEK_API_KEY` |
| Gemini | `gemini-2.5-flash` | LIMITED_FREE | `GEMINI_API_KEY` |
| OpenRouter | `deepseek/deepseek-r1:free` | PAID | `OPENROUTER_API_KEY` |
| Local | `llama3.1` | ULTIMATE_FREE | `LOCAL_LLM_SERVER_URL` |

`resolveChain(task?, projectId?)` returns an ordered `ProviderPlan[]`; capabilities = `['LLM_DEFAULT','BREAKDOWN','DRAFTING','POLISH','LEGAL']` (Phase-1 uses `LLM_DEFAULT`). Audited per call in the `AiRun` table.

> **Extension note (video):** a text-to-video model (e.g. a local/hosted generator) would be added either as a new `LlmProvider`-style entry or, better, a **separate `VideoService`** mirroring this switchboard shape (provider, model, payload, failover, `AiRun`-style audit). Negative prompts and shot arrays belong in *that* service's payload, not in `AiService`.

---

## 3. Formats & how `projectType` re-wires the pipeline

### 3.1 Families & ladders — `knowledge/formats.ts`

```ts
FEATURE_LADDER  = ['LOGLINE','SYNOPSIS','TREATMENT','BEATS','SCENES','STEP_OUTLINE','DRAFT','COVERAGE'];
SERIES_LADDER   = ['LOGLINE','SYNOPSIS','SEASON_ARC','EPISODE_MAP','TREATMENT','BEATS','SCENES','STEP_OUTLINE','DRAFT','COVERAGE'];
VERTICAL_LADDER = ['PREMISE','STORY_ENGINE','EPISODE_MAP','BEAT_ENGINE','SCENES','DRAFT','COVERAGE'];
DOC_LADDER      = ['THESIS','TREATMENT','RESEARCH_PLAN','RIGHTS_PLAN','INTERVIEW_OUTLINE','PAPER_EDIT','NARRATION','COVERAGE'];
```

Family normalisation:
```ts
export function normalizeFamily(brief): 'VERTICAL'|'DOCUMENTARY'|'SERIES'|'SHORT'|'FEATURE' {
  const t = up(brief && (brief.projectType || brief.format));
  if (/VERT|MICRO|SHORT_?FORM|REEL/.test(t)) return 'VERTICAL';
  if (/DOC/.test(t)) return 'DOCUMENTARY';
  if (/SERIES|TV|LIMITED|SEASON|EPISOD|MUSALSAL|DIZI|DRAMA_SERIES/.test(t)) return 'SERIES';
  if (/SHORT/.test(t)) return 'SHORT';
  return 'FEATURE';
}
export function stageLadderFor(brief){ return pickPreset(brief).ladder.slice(); }
```

Series market presets (episode count / runtime / act shape) include `US_STREAMING`, `US_NETWORK`, `UK`, `KDRAMA`, `TURKISH_DIZI`, `TELENOVELA`, `ANIME`, `RAMADAN_MUSALSAL`, `NORDIC_NOIR`. Vertical presets: `GLOBAL` (60–100 eps, 60–90s, *Hook · Friction · Spike · Button*) and `MENA` (40–80 eps, Arabic-first addiction loop).

### 3.2 Directive stacking — `knowledge/index.ts`

```ts
export function knowledgeDirective(brief): string {
  const parts = [];
  parts.push(formatDirective(brief));                 // act/episode shape, runtime
  if (fam==='VERTICAL')    parts.push(verticalDirective(brief));
  if (fam==='DOCUMENTARY') parts.push(documentaryDirective(brief));
  const era=eraDirective(brief);            if(era) parts.push(era);     // period language
  const acc=accentDirective(brief);         if(acc) parts.push(acc);     // dialect features
  const real=realPersonDirective(brief);    if(real) parts.push(real);   // true-story fidelity
  const conf=conflictDirective(brief);      if(conf) parts.push(conf);   // conflict engine
  const sty=styleDirective(brief);          if(sty) parts.push(sty);     // genre/texture
  return parts.filter(Boolean).join('\n');
}
```

> **Extension note:** the 5-second AI-video format adds (a) a new entry to `normalizeFamily`/presets, (b) a new ladder (likely short: e.g. `CONCEPT → SHOT → VIDEO_PROMPT`), and (c) a new `videoDirective(brief)` stacked here.

---

## 4. Current system prompt (standard scripts)

### 4.1 Base system (all stages) — `scripton.service.ts` `stageBrief()`

```
You are a development executive developing a story stage by stage.
Stay true to the prior approved stages and the creative brief.
Return ONLY JSON, no text outside it.
Do NOT include any title, format, rating, episode count, or metadata header in the output — only the requested content.
```

### 4.2 Per-stage system prompts (verbatim, abridged where noted)

- **LOGLINE** — `Write ONE logline (max 40 words): a protagonist with a clear goal, the opposing force, and the stakes.` → shape `{output}`
- **SYNOPSIS** — `Write a 3-paragraph synopsis (setup / escalation / resolution) true to the logline.` → `{output}`
- **TREATMENT** — `Write a tight prose treatment (~10 beats across 3 acts), present tense, scene-anchored, no dialogue.` → `{output}`
- **BEATS** — `Map the story onto the [FRAMEWORK] framework using EXACTLY these beats in order: [BEATS]. For each beat write what happens. output = a one-line summary. Return {output, beats:[{name, beat, purpose}]}.` → `{output, beats}`
- **SCENES** — `Break the story into 24–40 SCENE CARDS (no more than 40). Each scene MUST turn a value (chargeOpen must differ from chargeClose). Keep each synopsis to 1–2 sentences. Return {output, scenes:[{sceneNumber, slugline, intExt, dayNight, location, synopsis, purpose, conflict, stakes, characters:[string], thread, chargeOpen, chargeClose, turnType}]}. thread is A|B|C; chargeOpen/chargeClose are + or -; turnType is action|revelation.` → `{output, scenes}`
- **STEP_OUTLINE** — `Write a STEP OUTLINE: one SHORT numbered paragraph (2–4 sentences) per scene, present tense… Return {output, steps:[{n, scene, text}]}.` → `{output, steps}`
- **DRAFT** — `You are a professional screenwriter… Write the screenplay in professional FINAL DRAFT format with NUMBERED scene headings (e.g. "1  EXT. DESERT CAMP - NIGHT")… Output ONLY the screenplay text as plain text — no JSON, no metadata, no title page.` → `{output}` (raw text)
- **SERIES extras** — `SEASON_ARC` (3–5 para throughline), `EPISODE_MAP` (`EP n — Title — logline — ends on: hook`).
- **VERTICAL extras** — `PREMISE`, `STORY_ENGINE` (repeatable conflict machine), `BEAT_ENGINE` (per-episode `Hook (0–15s) · Friction · Spike (~1:00) · Button (cliffhanger)`).
- **DOCUMENTARY extras** — `THESIS`, `RESEARCH_PLAN`, `RIGHTS_PLAN`, `INTERVIEW_OUTLINE`, `PAPER_EDIT`, `NARRATION`.

### 4.3 Prompt composition order (per `generateStage`)

```
system = baseSystem + stageBrief(kind).system
user   = "STAGE: <kind> | FRAMEWORK: <fw>"
       + intakeSteer(projectId)        // "CREATIVE BRIEF (honour throughout): - ..."
       + priorStagesDump               // "DEVELOPMENT SO FAR --- LOGLINE --- ... "
       + knowledgeDirective(brief)      // FORMAT & WORLD ENGINE block
       + langDirective(brief)           // Arabic diglossic rules (async), if Arabic
       + stageBrief(kind).shapeInstruction  // "Return ONLY JSON {output, scenes:[...]}"
```

`intakeSteer()` builds the CREATIVE BRIEF from the `IntakeProfile`: reality level (`FAITHFUL|INSPIRED|LOOSE`), genres/tone/moods, fantasy + mythical elements, projectType specs, lore selections + density (`ACCENT|SUBPLOT|WOVEN|DRIVER|SATURATED`), spine (want/need/opposing/theme/ending), constraints (budget, maxLocations, castSize), setting/era/world, and `sensitivityTier` guardrails.

**Sacred-content hard rule (Tier 1)** is injected verbatim: no depiction/naming/voicing of God/deities/prophets; convey via narration/POV/off-screen/light; no scripture as character speech.

**Arabic language directive (`langDirective`)** — diglossic: `formal` ⇒ whole script in فصحى (MSA); `colloquial` ⇒ action in فصحى, dialogue in the chosen dialect from a 21-variety bank (Cairene, Damascene, Emirati, Iraqi Gelet, Darija, …) with native exemplar lines, an `arOnly` "Arabic script everywhere" clause, and a `BANNED_MSA` list (`سوف/سـ`, `ليس`, `الذي/التي`, `لقد`, `لم/لن`, …).

---

## 5. Negative-prompt logic & generation arrays — CURRENT STATE

**There is none.** Exhaustive search across the backend found:
- No `negativePrompt` / `negative_prompt` field anywhere.
- No image/video generation payloads, arrays, or shot lists.
- "negative" appears only in finance/budget contexts.

ScriptON is **purely text generation**. This is the **green-field surface** for the 5-second vertical video feature. Recommended shape for the new payload (to be designed by the extension author), persisted in `StageVersion.data` of a new `VIDEO_PROMPT` stage:

```jsonc
{
  "format": "VERTICAL_AI_VIDEO",
  "aspectRatio": "9:16",
  "durationSec": 5,
  "shots": [
    {
      "index": 0,
      "durationSec": 5,
      "prompt": "<positive text-to-video prompt>",
      "negativePrompt": "<things to avoid: blur, extra fingers, text artifacts, ...>",
      "camera": "slow push-in",
      "style": "<style pack id>",
      "seed": 123456,
      "refImageUrl": null
    }
  ]
}
```

Negative prompts would be **stored as a per-shot string** (or array) inside this structure — there is no legacy convention to conform to, so the extension defines it.

---

## 6. Current output structure

### 6.1 Persistence — `StageVersion` (Prisma)

```prisma
model StageVersion {
  id String @id @default(cuid())
  stageId String
  stage DevelopmentStage @relation(fields:[stageId], references:[id], onDelete: Cascade)
  n Int @default(1)
  title String?
  body String? @db.Text          // flat prose / screenplay text
  data Json?                      // structured: { beats } | { scenes } | { steps } | { warning }
  framework String?
  colorCode String?
  status String @default("DRAFT") // DRAFT|REVIEW|APPROVED|LOCKED
  aiRunId String?
  createdById String?
  createdAt DateTime @default(now())
  @@index([stageId]) @@map("stage_versions")
}
```

Every generation is audited in `AiRun` (`task`, `provider`, `model`, `promptChars`, `outputChars`, `inputTokens`, `outputTokens`, `latencyMs`, `error`, `refType`/`refId`).

### 6.2 Per-stage output JSON

```jsonc
// BEATS
{ "output": "one-line summary", "beats": [ { "name": "...", "beat": "...", "purpose": "..." } ] }

// SCENES
{ "output": "...", "scenes": [ {
  "sceneNumber": 1, "slugline": "EXT. DESERT CAMP - NIGHT",
  "intExt": "EXT", "dayNight": "NIGHT", "location": "Desert camp",
  "synopsis": "1-2 sentences", "purpose": "...", "conflict": "...", "stakes": "...",
  "characters": ["NAME"], "thread": "A", "chargeOpen": "+", "chargeClose": "-", "turnType": "revelation"
} ] }

// STEP_OUTLINE
{ "output": "...", "steps": [ { "n": 1, "scene": "1", "text": "2-4 sentence paragraph" } ] }
```

```
// DRAFT — raw text, Final Draft style (NOT JSON)
1  EXT. DESERT CAMP - NIGHT
The wind howls across the dunes...

            CHARACTER
      Hey, you there!
```

### 6.3 Generation ceilings & resilience (`generateStage`)

- `MAXTOK` per stage: LOGLINE 600, SYNOPSIS 2400, TREATMENT/BEATS/SCENES/STEP_OUTLINE/DRAFT/EPISODE_MAP/BEAT_ENGINE/PAPER_EDIT/NARRATION/SEASON_ARC 25000, COVERAGE 2000, PREMISE 2400, STORY_ENGINE 3500, THESIS 2400, RESEARCH_PLAN 4000, RIGHTS_PLAN 3000, INTERVIEW_OUTLINE 5000.
- HEAVY stages stream (`stream:true`, `timeoutMs:600000`, `idleTimeoutMs:120000`).
- **Continuation backstop** for array stages (SCENES/STEP_OUTLINE/EPISODE_MAP/BEAT_ENGINE): if `output_tokens ≥ cap*0.9` and JSON is truncated, re-prompt `"You have already mapped N items, ending with <tail>. Continue from the NEXT item…"`, up to 4 passes, then concat + renumber; surfaces a `warning` in `data` if still incomplete.

---

## 7. Frontend UI schema (settings, options, toggles, format choice)

### 7.1 Build flow / from-scratch pages

| Step | File | Notes |
|---|---|---|
| Studio entry / builds list | `frontend/src/app/(dashboard)/scripton/studio/page.tsx` | Coordinates Builds → Adapt → Develop → Render; `ScriptOnBuildsPanel` |
| Intake overlay (2-step) | `frontend/src/components/scripton/ScriptOnIntake.tsx` | Step 1 Work Source (paste/URLs/files), Step 2 Brief |
| Directions picker / progress | `frontend/src/components/scripton/ScriptOnBuildScreen.tsx` | 3 directions from `adapt()`; render progress |
| Develop ladder/versioning | `frontend/src/components/scripton/develop/ScriptonDevelop.tsx` | per-stage versions, Advance/Branch |
| Taxonomy (UI schema source) | `frontend/src/components/scripton/taxonomy.ts` | genres, tones, moods, frameworks, styles, budgets, accents |
| Endings | `frontend/src/components/scripton/endingTypes.ts` | 13 ending types |
| Arabic dialects | `frontend/src/components/scripton/dialects.ts` | 21 varieties |
| Screenplay paper/print | `frontend/src/components/scripton/scriptPaper.tsx` | tokeniser, pagination, CSS |

The standalone `/scripton/intake` route is retired and redirects to `/scripton/studio` (intake is now the Studio "Start a build" overlay).

### 7.2 Format selection (the core schema)

```ts
// ScriptOnIntake.tsx — project type picker
const PTYPES: [string,string,string][] = [
  ['MOVIE','Movie','~90-120 min'],
  ['TV_SERIES','TV series','8-22 ep'],
  ['LIMITED','Limited','4-8 ep'],
  ['VERTICAL','Vertical','60-100 ep'],
  ['SHORT','Short film','<=40 min'],
  ['DOC','Documentary','varies'],
];

// Series presets
type SeriesPreset = { key; label; labelAr; episodes; minutesPerEp; seasons; marketKey; types:string[] };
const SERIES_PRESETS: SeriesPreset[] = [
  { key:'US_STREAMING', label:'US streaming drama', labelAr:'دراما البث الأمريكية', episodes:10, minutesPerEp:60, seasons:1, marketKey:'US_STREAMING', types:['TV_SERIES'] },
  { key:'US_NETWORK', label:'US network hour', episodes:22, minutesPerEp:44, seasons:1, marketKey:'US_NETWORK', types:['TV_SERIES'] },
  // + UK, KDRAMA, TURKISH_DIZI, TELENOVELA, ANIME, RAMADAN_MUSALSAL, NORDIC_NOIR, LIMITED, VERTICAL
];
```

> **Extension hook:** add `['VERTICAL_AI_VIDEO','AI video (5s vertical)','5 s · 9:16']` to `PTYPES` and a matching preset; the chosen `projectType` flows through `saveIntake → createBuild → brief.projectType → normalizeFamily` and selects the new ladder.

### 7.3 Taxonomy objects (drive the form)

```ts
// taxonomy.ts
BASE_GENRES: { id; label; ar; subgenres:string[] }[]   // action, adventure, comedy, crime, drama, fantasy, historical, horror, musical, mystery, romance, sci-fi, thriller, war, western
BLEND_LAYERS: { id; label; ar }[]                        // war, romance, fantasy, noir, satire, mystery, coming-of-age, political, supernatural, survival
TONES: { id; label; ar }[]                               // epic, grounded, tragic, ironic, comic, romantic, satirical, pulpy, lyrical
MOODS: { id; label; ar }[]                               // foreboding, bittersweet, hopeful, tense, melancholic, whimsical, dread, warm
STYLE_PACKS: { id; label; ar; blurb; arBlurb; bestFor:string[] }[]
STYLE_STRENGTH = ['Whisper','Light','Balanced','Strong','Defining'];

// ScriptOnIntake.tsx
FRAMEWORK_INFO: { id; name; desc; ar; arDesc }[]  // three_act, savecat, field, vogler, harmon, 8seq, hauge, freytag, kishotenketsu, truby, pixar, tv_hour, limited
GENRE_FAMS: { id; name; bring; presence:string[5]; intensity:string[5]; styles?:string[] }[]  // presence/intensity 5-stop ladders per family

// endingTypes.ts
ENDING_TYPES: { id; label; desc; ar; arDesc }[]   // resolved, triumphant, tragic, bittersweet, twist, ambiguous, hopeful, circular, open/sequel, cliffhanger, downer, poetic-justice, frame, anticlimax

// dialects.ts
AR_DIALECTS: { id; lang; label; native }[]        // ar-MSA + 20 regional varieties
```

### 7.4 Intake form state (serialised to backend + localStorage draft)

```ts
const initialFormState = {
  mode:'ADAPT',                       // 'ADAPT'|'ORIGINAL'
  sourceText:'', realBased:true, realityLevel:'INSPIRED', // FAITHFUL|INSPIRED|LOOSE
  researchSubject:true, researchAmount:55,
  genres:[], baseGenre:'', baseGenres:[], subgenre:'', subMix:{}, // {sub:{p:0-4, ii:0-4}}
  styles:[], styleMix:{}, blendLayers:[], tones:[], moods:[], treatment:'',
  settingCountry:'', settingEra:'', settingWorld:[], cultureEra:'', settingPlace:[],
  projectIntent:'', budgetTier:'', tone:'', framework:'',
  projectType:'MOVIE', episodes:10, minutesPerEp:50, seasons:1,
  loreSelections:[],                  // {slug,name,culture,tier,role,weight,genre}[]
  loreDensity:'ACCENT',               // OFF|ACCENT|SUBPLOT|WOVEN|DRIVER|SATURATED
  lorePolicy:{ allowHistoricalPantheon:false, genreIntensity:{} },
  format:'', language:'', country:'', rating:'',
  researchScope:{ subject:true, craft:true, mythology:true, comps:true, legal:true, general:true },
  researchDepth:60,
  spine:{ endingIds:[], endingCustom:'', ending:'' },
  scriptVariety:'ar-MSA', dialogueRegister:'formal', // formal|colloquial
  accents:[], seriesPreset:'', marketKey:'',
};
```

Lore density stops + notes (`DSTOPS`/`DNOTE`) and per-genre `genreIntensity:{ p, ii, inf, manualInf, styles[] }` drive the Lore Atlas + Genre-intensity panels.

---

## 7A. UI controls inventory (every toggle / slider / select / button)

Component-level inventory of every interactive control, with the exact state field it binds and its value range/options. Form state is the object referred to as `f` in `ScriptOnIntake.tsx` (see §7.4). Local-only UI state (panel open/close) is noted as *(local)*. Line numbers are anchors and drift over time.

### Intake — Step 1: Work Source (`ScriptOnIntake.tsx`)

| Control | Type | State field | Range / options | Action |
|---|---|---|---|---|
| Project / build title | text | `f.name` | string | Names the build |
| Mode picker | radio/chip | `f.mode` | `ADAPT` \| `ORIGINAL` | Adapt material vs build from scratch |
| Resume / Discard draft | button | (localStorage draft) | — | Restore/clear auto-saved draft |
| Work source (main) | textarea | `f.sourceText` | free text | Primary source material |
| Additional paste box (dynamic) | textarea | `pastes[]` | free text/item | Extra passages (1–N) |
| Add paste box | button | `pastes[]` splice | — | Add a passage field |
| Website / URL (dynamic) | text | `urls[]` | URL/item | Reference links (1–N) |
| Add website / URL | button | `urls[]` splice | — | Add a URL field |
| File upload (dynamic) | file | `files[]` | .pdf .fdx .fountain .txt .docx .epub .html | Attach + auto-upload doc |
| Remove paste / URL / file | icon button | array splice | — | Delete one item |
| Next — Brief | primary button | step → 2 | requires name + project | Advance to Step 2 |

### Intake — Step 2: Brief — format & structure (`ScriptOnIntake.tsx`)

| Control | Type | State field | Range / options | Action |
|---|---|---|---|---|
| Back to source | button | step → 1 | ADAPT only | Return to Step 1 |
| Project type | chip grid | `f.projectType` | `MOVIE`\|`TV_SERIES`\|`LIMITED`\|`VERTICAL`\|`SHORT`\|`DOC` | **Choose format** |
| Series type preset | chips | `f.seriesPreset` + `f.marketKey` | `US_STREAMING`\|`US_NETWORK`\|`UK`\|`KDRAMA`\|`TURKISH_DIZI`\|`TELENOVELA`\|`ANIME`\|`RAMADAN_MUSALSAL`\|`NORDIC_NOIR`\|`LIMITED`\|`VERTICAL`\|`CUSTOM` | Series template |
| Episodes | stepper | `f.episodes` | int (typ. 6–120) | Episodes/season |
| Minutes / ep | stepper | `f.minutesPerEp` | int (typ. 24–130) | Runtime/ep |
| Seasons | stepper | `f.seasons` | int (typ. 1) | Season count |
| Story framework info | toggle | `fwInfo` *(local)* | show/hide | Reveal framework blurbs |
| Story framework | select | `f.framework` | Auto, three_act, savecat, field, vogler, harmon, 8seq, hauge, freytag, kishotenketsu, truby, pixar, tv_hour, limited | Structural model |
| Treatment | select | `f.treatment` | linear / non-linear / … | Narrative method |

### Intake — Step 2: real-story, genre, tone

| Control | Type | State field | Range / options | Action |
|---|---|---|---|---|
| Based on a real story | toggle | `f.realBased` | bool (ADAPT) | Real-story mode |
| Grounding level | chip radio | `f.realityLevel` | `FAITHFUL`\|`INSPIRED`\|`LOOSE` | Adaptation fidelity |
| Research the subject | toggle | `f.researchSubject` | bool | Enable online research |
| Research amount | slider | `f.researchAmount` | 0–100 | Detail to research |
| Real person / story note | textarea | `f.realPersonNote` | free text | What's true vs dramatised |
| Base genre | chips (max 3) | `f.baseGenres[]` | 15 `BASE_GENRES` | Up to 3 primary genres |
| Subgenre | chips | `f.subMix` keys | subgenres of chosen base | Enable subgenres |
| Subgenre presence | slider | `f.subMix[s].p` | 0–4 (Rarely→Constant) | How often |
| Subgenre intensity | slider | `f.subMix[s].ii` | 0–4 (Subtle→Dominant) | How strong |
| Blend layers | chips | `f.blendLayers[]` | 10 `BLEND_LAYERS` | Optional flavours |
| Tone | chips | `f.tones[]` | 9 `TONES` | Narrative tone(s) |
| Mood | chips | `f.moods[]` | 8 `MOODS` | Emotional mood(s) |

### Intake — Step 2: setting, intent, voice, ending

| Control | Type | State field | Range / options | Action |
|---|---|---|---|---|
| Setting country / place | combo | `f.settingCountry` | `SETTING_COUNTRIES` (~60) | Geographic setting |
| Era / period | select | `f.settingEra` | varies by country | Temporal period |
| World details | text→array | `f.settingWorld[]` | comma-separated | World descriptors |
| Project intent | chip radio | `f.projectIntent` | commercial / prestige / award / … | Creative goal |
| Budget scope | chip radio | `f.budgetTier` | ~5 tiers low→premium | Budget band |
| Craft voice header | counter | — | 0/2–2/2 | Voices chosen |
| Craft voice | chips (max 2) | `f.styles[]` | `STYLE_PACKS` | Writing texture |
| Craft voice strength | slider | `f.styleMix[id]` | 0–4 (`STYLE_STRENGTH`: Whisper→Defining) | Voice intensity |
| Ending info | toggle | `endInfo` *(local)* | show/hide | Reveal ending blurbs |
| Ending | chips (max 2) | `f.spine.endingIds[]` | 13 `ENDING_TYPES` | Blend up to 2 endings |
| Ending custom note | text | `f.spine.endingCustom` | free text | Custom ending steer |

### Intake — Step 2: Lore Atlas layer (optional)

| Control | Type | State field | Range / options | Action |
|---|---|---|---|---|
| Add a lore layer | toggle | `layerOn` *(local)* | bool | Activate Lore Atlas |
| Lore lens | chips | `lenses[]` *(local)* | Fantasy/Horror/Folklore/Myth/Crime/Romance/Naming-dress | Filter elements |
| Browse mode | tabs | `atlasMode` *(local)* | `culture` \| `archetype` | Browse axis |
| Lore search | text | `q` *(local)* | free text | Search elements |
| Culture picker | chip radio | `culture` *(local)* | 12+ cultures | Select culture |
| Element card | card toggle | `f.loreSelections[]` | add/remove | Add element to build |
| Element info | icon button | `openEl` *(local)* | modal | Element detail card |
| Allow historical pantheons | toggle | `f.lorePolicy.allowHistoricalPantheon` | bool | Include real-deity pantheons |
| Element role | select | `f.loreSelections[].role` | PROTAGONIST/ANTAGONIST/ALLY/MENTOR/LOVE_INTEREST/WORLD_SYSTEM/OBSTACLE/… (16) | Narrative function |
| Element weight | radio dots | `f.loreSelections[].weight` | 1–4 (1–2 Accent / 3–4 Spine) | Importance |
| Lore density | chip radio | `f.loreDensity` | `OFF`\|`ACCENT`\|`SUBPLOT`\|`WOVEN`\|`DRIVER`\|`SATURATED` | How far lore bends plot |

### Intake — Step 2: genre-intensity panel (per family)

| Control | Type | State field | Range / options | Action |
|---|---|---|---|---|
| Genre intensity show/hide | toggle | `genreOpen` *(local)* | bool | Expand panel |
| Genre family add/remove | checkbox | `f.lorePolicy.genreIntensity[id]` | `GENRE_FAMS` | Add a family control |
| Family presence | slider | `…[id].p` | 0–4 (family-specific labels) | How often |
| Family intensity | slider | `…[id].ii` | 0–4 (family-specific labels) | How strong |
| Action style | chips | `…[id].styles[]` | 10 action styles | Action types (action family) |
| Narrative influence | slider | `…[id].inf` (+`manualInf`) | 0–100 (step 5) | % narrative driven |

### Intake — Step 2: language & delivery

| Control | Type | State field | Range / options | Action |
|---|---|---|---|---|
| Target language | combo | `f.language` | ~38 languages | Script language |
| Country / market | combo | `f.country` | ~44 markets (Global, GCC, KSA, UAE, …) | Target market |
| Rating target | combo | `f.rating` | 50+ systems (UAE/KSA/US/UK/…) | Age gate |
| Format note | text | `f.format` | free text | Format descriptor |
| Script dialect (Arabic) | select | `f.scriptVariety` | `AR_DIALECTS` (ar-MSA + 20) | Dialogue dialect |
| Dialogue register (Arabic) | radio | `f.dialogueRegister` | `formal` \| `colloquial` | فصحى vs dialect dialogue |
| Accents (non-Arabic) | chips | `f.accents[]` | ~12 accents | Dialogue accents |
| Research scope | checkboxes | `f.researchScope` | `{subject,craft,mythology,comps,legal,general}` bools | Domains to research |
| Research depth | slider | `f.researchDepth` | 0–100 | Depth per scope |
| Begin the build | primary button | submit → `createBuild` | requires valid brief | Start the build |

### Build screen — research + direction pick (`ScriptOnBuildScreen.tsx`)

| Control | Type | State field | Range / options | Action |
|---|---|---|---|---|
| Stage progress / bar / status | display | `items[]`, `progress`, `status` | 0–100%, per-stage done/active/wait/error | Prep progress |
| Continue to Develop | button | `onContinue()` | on error | Proceed despite error |
| Direction card ×3 | cards | direction objects | FAITHFUL / RECONCEIVED / REINVENTION | logline + keep/change/tone/risk |
| Develop this | primary button | `onPick(cur)` | — | Seed the Develop ladder |
| Version navigator `< V# >` | button pair | `onSwitchVersion()` | bounded | Switch direction versions |
| Add note | toggle | `noteOpen` *(local)* | — | Show regen note box |
| Note | textarea | `note` *(local)* | free text | Steer a regeneration |
| Regenerate direction | icon button | `onRegen(cur, note)` | — | Re-roll a direction |

### Develop screen — ladder & canvas (`develop/ScriptonDevelop.tsx`)

| Control | Type | State field | Range / options | Action |
|---|---|---|---|---|
| Ladder stage row / chip | button | `focusKind` | ladder kinds | Focus a stage |
| Ladder progress / counter | display | `pct`, `done/TOTAL` | 0–100%, e.g. 4/8 | Completion |
| Version navigator `< V# >` | button pair | `onSwitchVersion(stageId, ±1)` | bounded | Switch stage versions |
| Regenerate stage | icon button | `onRegenerate(kind)` | — | Re-roll focused stage |
| Generate next stage | primary button | `onAdvance()` | — | Advance the ladder |
| Promote to Script | gold button | `onPromoteScript(versionId)` | DRAFT only | Render full screenplay → Library |
| Spine panel | display | brief k/v | Format, Logline, Framework, Stage | Show agreed brief |
| Comparables | display | `props.comps[]` | titles | Auto comps |

### Top bar (global) (`ScriptonTopBar.tsx`)

| Control | Type | State field | Action |
|---|---|---|---|
| TFM logo | button | `onBack()` | Back to FilmOS/home |
| Continuity ring | display | `continuity` (0–100%) | Arc continuity |
| Version switcher | button | `onOpenVersions()` | Versions/Revisions screen |
| Share / export | button | `onShare()` | Opens `ProtectedExportDialog` |

### Settings — AI Governance & Protection (`ScriptOnSettings.tsx`)

| Control | Type | State field | Range / options | Action |
|---|---|---|---|---|
| Section nav | radio | `section` | `ai` \| `protection` | Switch panel |
| Subnav | buttons | — | Workspace, AI Governance, Review Protection, Members & roles, Companies & tenancy, Integrations, Billing | Sidebar (most deferred) |
| Active model | display | `model` | e.g. `claude-opus-4-8` | Current engine |
| Confidence gate | slider | `confidence` | 0–1 | Auto-approval threshold |
| Human approval | toggle | — | bool | Require sign-off on rewrites |
| AI runs audit table | display | — | Surface/Model/Tokens/Confidence/Status/When | Last-24h runs |
| Discard / Save changes | buttons | — | — | Persist governance |
| Export PDF (protected) | button | — | opens `ProtectedExportDialog` | Recipient-watermarked PDF |
| Export Word | button | — | `.docx` | Editable package export |

**State-binding patterns** (for the extension author): single scalars (`f.projectType`, `f.language`); arrays (`f.baseGenres[]`, `f.loreSelections[]`, `pastes[]`); nested objects keyed by id (`f.subMix[sub]={p,ii}`, `f.lorePolicy.genreIntensity[id]={p,ii,inf,manualInf,styles[]}`); and local panel toggles (`layerOn`, `fwInfo`, `endInfo`, `genreOpen`, `noteOpen`). The whole `f` object is auto-saved to `localStorage` as a resumable draft and POSTed via `saveIntake` / `createBuild`.

> **Extension note (5-second AI video):** the new format's controls slot into Step 2 — add `VERTICAL_AI_VIDEO` to the project-type grid, then a small control cluster bound to new `f` fields: `f.aspectRatio` (select `9:16`), `f.durationSec` (stepper, default 5), `f.videoStyle` (chips), `f.seed` (number), and `f.negativePrompt` (textarea). These persist in the same `f` draft and flow to the new ladder/stage described in §10.

---

## 8. Frontend API surface (`frontend/src/lib/api.ts`)

```ts
// adapt / research
productionApi.scripton.adapt(projectId, { sourceText, targetFormat })       // POST /production/scripton/adapt/:id  → { directions }
productionApi.scripton.adaptOne(projectId, { direction, note })             // POST .../adapt-one/:id
productionApi.scripton.research(projectId)                                  // POST .../research/:id
productionApi.scripton.lore({ pantheon })                                   // GET  .../lore
productionApi.scripton.formatConvert(projectId, { targetFormat })          // POST .../format-convert/:id → { episodes }

// builds + develop
productionApi.scripton.development.createBuild({ name, projectId, brief })  // POST /production/scripton/builds
productionApi.scripton.development.generate(projectId, { kind, buildId, framework, seed })  // POST .../development/generate/:id
productionApi.scripton.development.pipeline(projectId, buildId?)            // GET  .../development/pipeline/:id
productionApi.scripton.development.listVersions/newVersion/switchVersion/versionBrief(buildId,...)
productionApi.scripton.development.setVersion/duplicate/read/setStatus(versionId,...)
productionApi.scripton.development.promoteToScript(versionId)               // POST .../version/:id/promote-to-script
productionApi.scripton.development.scriptProgress(documentId)               // GET  .../script-progress/:id  → { status, phase, done, total, pageCount, lastActivityAt }

// intake + export
productionApi.scripton.development.getIntake/saveIntake(projectId, data)
productionApi.scripton.development.getPackage({ docId, projectId, buildId })
productionApi.scripton.development.packageDocx(body)                        // responseType: 'blob'
productionApi.scripton.development.characterBible(projectId, buildId?)
productionApi.scripton.renderPdf(html, filename)                           // POST .../render-pdf  responseType: 'blob'
```

API base: `NEXT_PUBLIC_API_URL || http://localhost:3001/api/v1`; JWT auto-attached; 401 → `/login`.

---

## 9. Data pipeline / export (PDF script vs automated payload)

### 9.1 Two export targets today

```
StageVersion.current ─► buildPackageDocModel() ─► PackageDoc ─┬─► packDocx()  ─► .docx Buffer
                                                              └─► dossierHtml() ─► renderPdf() (puppeteer) ─► .pdf Buffer
ScriptDocument (promoted) ─► scriptPaper tokeniser ─► HTML ─► render-pdf ─► screenplay .pdf
ScriptRevision ─► script-export.service.exportPdf() ─► annotated + watermarked .pdf
```

### 9.2 DOCX package model — `package-docx.util.ts`

```ts
interface PackageDoc { title:string; eyebrow:string; logline:string; sections:DocSection[]; }
type DocSection = { heading:string; blocks:DocBlock[] };
type DocBlock =
  | { kind:'metaTable'; rows:[string,string][] }
  | { kind:'spine'; rungs:{ title:string; body:string }[] }
  | { kind:'characters'; items:{ name; role; tagline; coreIdentity; arc }[] }
  | { kind:'list'; items:string[] }
  | { kind:'paragraph'; text:string };
```

`buildPackageDocModel({ build, project, script, brief, coverage, stages, ladder, characterBible })` → sections: Overview (metaTable), Development Spine (rungs ≤1600 chars), Characters (≤9), Market & Comps (≤8), Coverage. `packDocx()` writes via the `docx` lib (creator "FilmOS · ScripON", gold `#9A7B2E` headings, RTL for Arabic, metadata sanitised — "Editable review copy, not a protected export").

### 9.3 Screenplay rendering — `scriptPaper.tsx`

```ts
type Tok = { type:string; text:string; sceneNo?:string }; // gap|scene|action|cue|paren|dialogue|trans|fadein
formatScreenplay(raw, lang?): Tok[]          // Latin + Arabic-aware tokeniser
paginateTokens(toks, budget=48): Tok[][]     // page budgeting
SCRIPT_PAPER_CSS                              // .uvp-a4 (screen) / .uvp-ar (RTL A4 manuscript)
```

### 9.4 PDF / annotation export — `script-export.service.ts`

`exportPdf(revisionId, { layerIds? }, userId, userName)` flattens IAM-filtered annotation layers (HIGHLIGHT→rect, PEN→line, TEXT/STICKY/TAG→text) onto the source PDF with `pdf-lib`, then a diagonal watermark per page: `"<USERNAME> · <id last4> · CONFIDENTIAL"` (35°, opacity .5). HTML→PDF uses `renderPdf(html)` via puppeteer (Chromium discovery chain; throws `NO_PUPPETEER`/`NO_CHROMIUM`).

> **Extension note (video):** the new format adds a **third pipeline branch**: a `VIDEO_PROMPT` stage emits the §5 JSON payload, exported either as a downloadable `.json` (automated payload for a text-to-video model) or POSTed to a new `VideoService`. It does NOT go through DOCX/scriptPaper.

---

## 10. Where the 5-second vertical AI-video format plugs in (summary checklist)

1. **Frontend** — add `VERTICAL_AI_VIDEO` to `PTYPES` (+ preset: 5s, 9:16); add a small settings panel for aspect ratio, duration, style, seed, and **negative prompt** text; new state fields on `initialFormState`.
2. **Family/preset** — extend `normalizeFamily`/`pickPreset` (`knowledge/formats.ts`) with the new family + a short ladder (e.g. `CONCEPT → SHOT_LIST → VIDEO_PROMPT`).
3. **Directive** — add `videoDirective(brief)` to `knowledgeDirective` (9:16 framing, single 5s shot, motion, no dialogue dependency).
4. **Stage prompts** — new entries in `stageBrief()` returning the §5 shot/prompt JSON shape (positive + `negativePrompt` per shot).
5. **Output** — persist as `StageVersion.data` JSON; audit via `AiRun`.
6. **Generation service** — a separate `VideoService` mirroring the switchboard (provider/model/payload/failover) for the actual text-to-video call; keep `AiService` for the prompt-authoring step.
7. **Export** — new `.json` payload export branch (and optionally a rendered preview), bypassing DOCX/PDF.

---

*Generated from a live read of the codebase. Exact line numbers shift as the repo evolves; the file paths and symbol names above are the stable anchors.*
