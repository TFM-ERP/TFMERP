# ScriptON / FilmOS — Engines, AI Governance & Security Deep‑Dive

A complete, low‑level reference for the four "engine" subsystems of TFM‑System: the **AI (LLM) governance layer**, the **video engines & render pipeline**, the **audio engines**, and the **security / protected script‑export** layer. It covers how each works, how it connects to the rest of the system, every backend endpoint, every environment variable, and every button/field in the UIs.

> Audited directly from source: `backend/src/ai/**`, `backend/src/video/**`, `backend/src/production/script/audio/**`, `backend/src/production/scripton/{review-protection,protected-export}*`, and the `setup/{llm,video,audio}-engines` + ScriptON components.

---

## Table of contents

1. [The shared "engine switchboard" pattern](#1-the-shared-engine-switchboard-pattern)
2. [AI Governance — LLM engines & routing](#2-ai-governance--llm-engines--routing)
3. [Video engines & the AI‑video render pipeline](#3-video-engines--the-ai-video-render-pipeline)
4. [Audio engines & functions](#4-audio-engines--functions)
5. [Security — Review Protection & protected export](#5-security--review-protection--protected-export)
6. [Cross‑cutting: permissions, storage, env, the governance feed](#6-cross-cutting)
7. [File map](#7-file-map)

---

## 1. The shared "engine switchboard" pattern

Three subsystems — **LLM**, **Video**, **Audio** — are built from the *same* switchboard template. Understand it once and all three read the same way:

- **A provider catalog** (`*_PROVIDER_DEFAULTS`) — a built‑in list of providers, each with a `key`, `provider` type, `tier`, `priority`, `defaultModel`, `baseUrl`, and a **`credentialRef`** (the *name* of the env var that holds the API key — **the key itself never leaves `.env`** and is never stored in the DB or returned to the browser).
- **Seed on boot** (`onModuleInit → seedDefaults`) — idempotently creates a DB row per provider (an `LlmEngine` / `VideoEngine` / `AudioEngine`), enabling only the "safe/free" ones by default (Anthropic + Local for LLM; Local ComfyUI for video; Browser for audio), and refreshes each row's model list so the UI dropdowns are always current.
- **Routing policies** per **capability** — a `*RoutingPolicy` row (scope `ORG` or `PROJECT`) holds a `fallbackChain` (ordered engine ids), `defaultEngineId`, `allowedEngineIds`, and two override flags (`projectOverrideAllowed`, `userMayOverride`).
- **`resolveChain(capability, projectId?)`** — orders engines by the policy's `fallbackChain`, appends the rest by priority, maps each to a "plan" with its live `apiKey`/`baseUrl` from env, and marks each **`usable = enabled && hasCredential`**.
- **Failover at call time** — walk the chain, skip non‑usable engines, try each provider; the first success wins; failures are classified and (for exhausting classes) put the provider on a cooldown.
- **Health/status endpoints** power the UI's on/live indicators and never expose secrets.

> **Phase‑1 caveat (all three):** `capabilityForTask()` currently **always returns the default capability** (`LLM_DEFAULT` / `VIDEO_DEFAULT` / the audio default). The per‑capability policies (Breakdown/Drafting/Polish/Legal; Preview/Final; LIVE_READ/TTS/SFX/MUSIC/DUBBING) are fully wired in the DB + UI, but every real call currently resolves against the single default chain until the task→capability mapping is switched on.

All three subsystems + the security export live under the **`production`** permission scope: **read = level 1, mutations = level 2**, behind `JwtAuthGuard + PermissionsGuard`.

---

## 2. AI Governance — LLM engines & routing

The **AI gateway** is the single choke‑point every model call in the platform passes through. It lives in `backend/src/ai/` and is exposed to admins as **Setup → LLM Engines** (`/setup/llm-engines`), with its audit trail surfaced in the "Recent Runs" governance feed.

### 2.1 The gateway — `AiService` (`ai/ai.service.ts`)

`@Global()` module → injectable everywhere. Constructor: `(PrismaService, LlmRoutingService)`. Public surface:

| Method | Signature | What it does |
| --- | --- | --- |
| `run` | `run(opts: AiRunOpts): Promise<AiResult>` | The main failover gateway — walks the provider chain, streams long jobs, logs an `AiRun` per attempt. |
| `complete` | `complete(opts): Promise<string>` | `run(opts).text` — plain‑text convenience. |
| `json<T>` | `json(opts): Promise<T \| null>` | `run(opts).json` — parsed JSON (strips ```` ```json ```` fences, first `{`→last `}`). |
| `raw` | `raw(opts: AiRawOpts): Promise<AiRawResult>` | Vision image blocks + tool‑use. **Anthropic‑only, no streaming, no failover.** |
| `get model()` | — | Legacy default: `LABOR_AI_MODEL \|\| ANTHROPIC_MODEL \|\| 'claude-3-5-sonnet-20241022'`. |

`AiRunOpts` = `{ task, system, user, projectId?, refType?, refId?, maxTokens?, model?, temperature?, timeoutMs?, idleTimeoutMs?, stream? }`. `AiResult` = `{ text, json, model, usage, runId?, provider? }`.

**How `run()` chooses a provider:**
1. `chain = routing.resolveChain(task, projectId)`; keep `usable` engines; split into `hot` (ready) and `cooling`; `attempt = [...hot, ...cooling]` (cooled providers are **deprioritized, never dropped** — a refilled key still gets retried when others fail).
2. **Streaming** is on when `opts.stream` is set, or `maxTokens ≥ 6000`, or `timeoutMs ≥ 180000` — so a 25k‑token scene map streams (server‑side, with idle‑timeout stall detection) instead of hitting a single blocking‑request ceiling.
3. Try each provider; on success return `{text, json, model, usage, runId, provider}`. On error, classify it, log the failed attempt, cool the provider if the class is *exhausting*, and fall through.
4. **Two passes max** — a second full sweep only if **every** provider failed on a *transient* class (after a 1.5s wait).
5. Final failure = one actionable `BadRequestException` listing what was **Tried** (per‑provider reasons) and what's **Not enabled** (missing keys), plus a Local‑engine hint if the Local server was unreachable.

**Cooldown** (in‑memory, clears on restart): `RATE` → 1 min; `CREDIT`/`AUTH` → 10 min. Only `CREDIT/RATE/AUTH` are "exhausting" (`isExhausting`).

### 2.2 Providers & endpoints (`ai/providers.ts`)

`LlmProvider = 'anthropic' | 'deepseek' | 'gemini' | 'openrouter' | 'local'`. `callProvider()` dispatches:

| Provider | Wire | Endpoint | Auth header | Credential env |
| --- | --- | --- | --- | --- |
| `anthropic` | Anthropic Messages | `{baseUrl\|\|https://api.anthropic.com}/v1/messages` | `x-api-key` + `anthropic-version: 2023-06-01` (+ optional `anthropic-beta`) | `ANTHROPIC_API_KEY` |
| `deepseek` | OpenAI chat | `https://api.deepseek.com/chat/completions` | `Authorization: Bearer` | `DEEPSEEK_API_KEY` |
| `gemini` | OpenAI chat | `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` | `Authorization: Bearer` | `GEMINI_API_KEY` |
| `openrouter` | OpenAI chat | `https://openrouter.ai/api/v1/chat/completions` | `Bearer` + `HTTP-Referer` + `X-Title: FilmOS` | `OPENROUTER_API_KEY` |
| `local` | OpenAI chat | `{baseUrl}/chat/completions` (default `http://127.0.0.1:11434/v1`, Ollama) | `Bearer` only if a key is set | none (`LOCAL_LLM_SERVER_URL`) |

Defaults: overall timeout **200 s**, idle‑stall **120 s**, `maxTokens` 1500. Streaming reads SSE and folds Anthropic/OpenAI events; a non‑progressing stream aborts on the idle timeout for fast failover. `httpJson` retries once on HTTP ≥ 500.

**Error classification** (`classify` → `ProviderErrorKind`): `CREDIT` (402 / "insufficient"/"billing"/"quota"), `RATE` (429 / "rate limit"/"overloaded"), `AUTH` (401/403 / "invalid api key"), `SERVER` (≥500), `TIMEOUT` (abort), `NETWORK` (fetch error), `BAD_REQUEST` (else), `UNKNOWN`.

### 2.3 The engine catalog (`ai/llm-routing.service.ts` → `LLM_PROVIDER_DEFAULTS`)

| Key | Provider | Tier | Default model | Priority | Enabled by default | Credential |
| --- | --- | --- | --- | --- | --- | --- |
| `ANTHROPIC` | anthropic | PAID | `claude-sonnet-4-6` | 10 | ✅ | `ANTHROPIC_API_KEY` |
| `DEEPSEEK` | deepseek | PAID | `deepseek-v4-flash` | 20 | — | `DEEPSEEK_API_KEY` |
| `GEMINI` | gemini | LIMITED_FREE | `gemini-2.5-flash` | 30 | — | `GEMINI_API_KEY` |
| `OPENROUTER` | openrouter | PAID | `deepseek/deepseek-r1:free` | 40 | — | `OPENROUTER_API_KEY` |
| `LOCAL` | local | ULTIMATE_FREE | `LOCAL_LLM_MODEL \|\| 'llama3.1'` | 50 | ✅ | none (`http://127.0.0.1:11434/v1`) |

Each engine carries a curated **model dropdown** (id · label · hint · free/paid tier) — e.g. Anthropic `claude-sonnet-4-6`/`claude-opus-4-8`/`claude-haiku-4-5`; DeepSeek `deepseek-v4-flash`/`deepseek-v4-pro`; Gemini `gemini-2.5-flash` (free) … `gemini-2.5-pro` (paid); OpenRouter `deepseek/deepseek-r1:free` etc.; Local `llama3.3`/`qwen2.5`/`mistral`/`gemma3`. The engine's `defaultModel` is the master switch; env `ANTHROPIC_MODEL` is only a fallback when a row has no model.

### 2.4 Routing, capabilities, telemetry

- **Capabilities:** `LLM_DEFAULT, BREAKDOWN, DRAFTING, POLISH, LEGAL` (5 policies persisted; only `LLM_DEFAULT` resolves today).
- **`resolveChain(task, projectId)`** — ORG `LLM_DEFAULT` policy; a PROJECT policy overrides only if `projectOverrideAllowed`. Orders by `fallbackChain`, appends the rest by priority. `toPlan` reads `apiKey = process.env[credentialRef]` and sets `usable = enabled && hasCredential`.
- **`engineStatus(key)`** — tier‑aware telemetry: month‑to‑date tokens/calls (aggregated from `AiRun` by provider), plus a **live balance** for DeepSeek (`GET api.deepseek.com/user/balance`) and OpenRouter (`GET openrouter.ai/api/v1/credits`). `ULTIMATE_FREE` suppresses counters ("No limits"); `LIMITED_FREE` warns at <15% of `freeTokenCap`.
- **`health()`** — the resolved chain as non‑secret pills: `{ key, provider, model, tier, enabled, usable, hasCredential }`.

### 2.5 Governance / audit — the `AiRun` lifecycle

Every gateway attempt writes one `AiRun` row through three guarded helpers (logging never breaks a request):

| Phase | Status | Fields |
| --- | --- | --- |
| `begin()` | RUNNING | task, model, provider, projectId, refType, refId, promptChars |
| `finish()` | DONE | inputTokens, outputTokens, outputChars, latencyMs |
| `fail()` | ERROR | error `[provider:KIND] message` (≤500 chars) |

A 3‑provider failover writes **up to 3 rows** — a full per‑provider audit trail. The dotted **`task` string** is the audit taxonomy: `surface.purpose.stage` (e.g. `scripton.feature.scene` → surface `scripton`, purpose `feature`, stage `scene`).

**Recent Runs feed** (`recentRuns`): merges `AiRun ∪ VideoRun`, normalizes each to `{ kind (LLM/VIDEO), when, surface, purpose, stage, model, provider, tokens, size bucket, status, result (success/error/running), durationMs, videoUrl?, error? }`, and offers filters by `surface`, `status`, `size` (Tiny→Massive), and a time window (≤30 days). This is how **video renders show up in the same AI Governance timeline** even though they never touch `AiService`.

### 2.6 Endpoints — `LlmEnginesController` (base `production/ai`)

| Method | Path | Perm | Purpose |
| --- | --- | --- | --- |
| GET | `/engines` | 1 | list engines |
| GET | `/engines/:key/status` | 1 | tier‑aware telemetry (tokens, calls, balance) |
| GET | `/health` | 1 | resolved chain + on/usable pills |
| POST | `/engines/seed` | 2 | seed the 5 defaults + default policy |
| POST / PUT / DELETE | `/engines` · `/engines/:id` | 2 | create / update / delete an engine |
| GET | `/routing` | 1 | policies per capability (`?scope=ORG&projectId=`) |
| PUT | `/routing/:capability` | 2 | upsert a capability's policy |
| GET | `/routing-resolved` | 1 | ORG + PROJECT policies |
| GET | `/runs` | 1 | Recent Runs feed (`?hours&limit&projectId&surface&status&size`) |

### 2.7 The UI — Setup → LLM Engines (`setup/llm-engines/page.tsx`)

Two tabs (**Engines**, **Routing & Failover**) plus a read‑only **ChainStrip** header showing the active failover order (numbered pills: green "ready" = usable, amber "paused" = has key but disabled, faint "no key").

**Header buttons:** **Seed defaults** (`POST /engines/seed`) · **Add engine** (opens drawer).

**Engines tab — one row per engine:**
- Identity (name, `llm` chip, tier chip, `provider · priority · model`).
- Telemetry (usage bar `used/cap`, turns amber ≥85%; live `balance`; or "Add `<ENV_VAR>` to .env" when disabled without a key; ULTIMATE_FREE → "No limits").
- **Enabled checkbox** = the on/off master switch (`PUT /engines/:id {enabled}`).
- Status dot: Disabled / Active (usable) / No key.
- **Edit** → drawer.

**Routing & Failover tab:** 5 capability sub‑tabs; a **Failover order** list with **▲/▼ move** buttons + **include** checkboxes per engine; a **Policy** card with **Default engine** select, **Allow project override** and **Allow per‑render override** checkboxes, and **Save routing** (`PUT /routing/:capability`). A "Resolved now" panel names the first usable engine.

**Engine drawer (Add/Edit):** Provider select (locked on edit) · Key (create‑only) · Display name · Tier · Default model (grouped Free/Paid dropdown + custom id) · Base URL (local) **or** Credential reference (the env‑var name) · Priority · token caps · Notes · **Delete** (edit) · **Cancel** · **Save**.

### 2.8 Who calls it

Everything: ScriptON generation (`scripton.feature.scene`, coverage, canon), audio (`audio.voiceCasting/direction/soundDesign` via `raw` forced‑tool calls), the Doctor, etc. Vision/tool‑use is pinned to Anthropic via `raw()`. Video is the one exception — it has its own switchboard but reports into the same governance feed.

---

## 3. Video engines & the AI‑video render pipeline

The video subsystem (`backend/src/video/`) turns the ScriptON `VIDEO_PROMPT` stage into rendered 9:16 clips and stitched episodes. It follows the same switchboard pattern, exposed as **Setup → Video Engines** (`/setup/video-engines`).

### 3.1 The engine catalog (`video-engines.service.ts → VIDEO_PROVIDER_DEFAULTS`)

| Key | Provider | Tier | Default model | Priority | Base URL | Credential | Enabled by default |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `LOCAL_COMFY` | local_comfy | ULTIMATE_FREE | `comfy-workflow` | 10 | `http://127.0.0.1:8188` | none | ✅ |
| `RUNWAY` | runway | PAID | `gen4.5` | 20 | — | `RUNWAYML_API_SECRET` | — |
| `SEEDANCE` | seedance | PAID | `bytedance/seedance-2.0/text-to-video` | 30 | `https://queue.fal.run` | `FAL_KEY` | — |

- **Capabilities:** `VIDEO_DEFAULT, PREVIEW, FINAL` (only `VIDEO_DEFAULT` resolves today).
- **`luma` and `kling`** appear in the provider type union and the drawer dropdown but have **no seeded row and no adapter** — they're placeholders (selecting one would throw at render).
- Seed enables only `LOCAL_COMFY`; Runway/Seedance are present but disabled until you add their key. `engineStatus` for local also reports `workflowConfigured = !!COMFYUI_WORKFLOW_PATH`.

### 3.2 Providers & params (`video/providers.ts`)

`VideoProvider = 'runway' | 'local_comfy' | 'seedance'`. `VideoGenerationParams`:

| Field | Meaning |
| --- | --- |
| `prompt`, `negativePrompt?`, `durationSec`, `aspectRatio`, `seed?` | the shot |
| `imageUrl?` | start frame — the character **anchor**, or a previous clip's last frame (chaining) |
| `endImageUrl?` | optional end frame (start→end transition) |
| `imageUrls?[]` | reference identity images `@Image1…@Image9` — **Face Lock** |
| `videoUrls?[]` | reference videos `@Video1…@Video3` — pass the previous clip for **continuity** |
| `generateAudio?` | native dialogue + music + SFX in one pass (Seedance, free) |

`VideoJobResponse = { jobId, status: PENDING|PROCESSING|COMPLETED|FAILED, videoUrl?, error? }`.

### 3.3 The render service (`video.service.ts`)

Public methods: `generateShot`, `listRuns`, `checkJobStatus`, `stitchProject`, `generateImage`, `renderEpisode`, `getEpisode`, `listEpisodes`.

**`generateShot(projectId, params, stageVersionId?, overrideEngineId?)`** → resolves the chain, skips non‑usable engines, calls `callProvider`, and persists a **`VideoRun`** row; returns `run.id`. `checkJobStatus(runId)` polls the provider and persists `COMPLETED/FAILED`.

**Per‑provider adapters + exact endpoints:**
- **ComfyUI (local, free):** reads the API‑format workflow at `COMFYUI_WORKFLOW_PATH`, mutates node ids (positive `4`, negative `5`, latent `6`, sampler `3`; env‑overridable), sets resolution (16:9 → 1024×576, else 576×1024). `POST {base}/prompt` → poll `GET {base}/history/{id}` → asset at `GET {base}/view?filename=…&subfolder=…&type=output`.
- **Runway Gen‑4.5:** `POST https://api.dev.runwayml.com/v1/image_to_video` (headers `Authorization: Bearer`, `X-Runway-Version: 2024-11-06`), `ratio` as a resolution string (16:9→`1280:720`, else `720:1280`); poll `GET /v1/tasks/{id}`.
- **Seedance 2.0 (ByteDance via fal.ai):** endpoint chosen by inputs — `reference-to-video` when `imageUrls`/`videoUrls` present (identity `@Image1…9` + continuity `@Video1…3`), else `image-to-video` (start/optional end frame), else `text-to-video`. `POST {SEEDANCE_BASE_URL}/{model}` with `Authorization: {SEEDANCE_AUTH_SCHEME} {FAL_KEY}`; duration clamped 4–15s; aspect from `['21:9','16:9','4:3','1:1','3:4','9:16']` (default 9:16); native audio via `generate_audio`; `negativePrompt` is dropped (Seedance has no negative‑prompt concept). Queue jobs poll `{response_url}/status` then `{response_url}`.

**`generateImage(prompt, {width,height,model,seed})`** — the **character anchor**: Seedream `fal-ai/bytedance/seedream/v4/text-to-image` (same `FAL_KEY`), default **1080×1920** (9:16). Returns a public image URL that feeds Seedance reference‑to‑video.

**`stitchProject(projectId, stageVersionId?, runIds?)`** — ffmpeg concat of the project's COMPLETED clips (order = `runIds` if given, else `createdAt`). Needs ≥2 clips + ffmpeg on PATH. Fast path `-c copy -movflags +faststart`; fallback re‑encode `libx264 -crf 20 -pix_fmt yuv420p -c:a aac`. Writes `uploads/episode-<projectId>-<ts>.mp4` → served at `/uploads/...`.

**Cohesive episode (server‑side job):** `renderEpisode({projectId, anchorUrl?, beats[], …})` mints `ep_<id>`, stores an in‑memory job, and runs `runEpisode` in the background: each beat renders with `imageUrls:[anchorUrl]` (Face Lock) + `videoUrls:[prevClip]` (continuity) + `generateAudio:true`, polls to done, then stitches. The finished episode is **also persisted as a `VideoRun`** (`provider:'seedance', model:'episode'`) so it survives restart. `getEpisode(id)`/`listEpisodes(projectId)` read the in‑memory jobs.

### 3.4 Endpoints — `VideoEnginesController` (base `production/video`)

Engine/routing mirror the LLM controller (`/engines`, `/engines/:key/status`, `/health`, `/engines/seed`, CRUD, `/routing`, `/routing/:capability`, `/routing-resolved`). Render endpoints:

| Method | Path | Purpose / body |
| --- | --- | --- |
| POST | `/generate` | render one shot → `{runId}`; body: `prompt`(req), `negativePrompt`, `durationSec`(5), `aspectRatio`(9:16), `seed`, `imageUrl`, `endImageUrl`, `imageUrls[]`, `videoUrls[]`, `generateAudio`, `projectId`, `stageVersionId`, `engineId` |
| GET | `/runs` · `/runs/:id` | list recent runs · poll one |
| POST | `/anchor` | character‑anchor image (Seedream) → `{imageUrl}`; body `prompt`(req), `width`, `height`, `seed` |
| POST | `/episode` | start cohesive episode → `{episodeId}`; body `projectId`(req), `beats[]`(req), `stageVersionId`, `anchorUrl`, `title`, `aspectRatio` |
| GET | `/episode/:id` · `/episodes` | episode job status · list |
| POST | `/stitch` | concat clips → `{url,count,durationSec}`; body `projectId`, `stageVersionId`, `runIds[]` |

### 3.5 The UIs

**Setup → Video Engines** — identical shape to LLM Engines: **Seed defaults**, **Add engine**, ChainStrip, per‑engine rows with **Enabled** checkbox + readiness ("Local · no limits" / "workflow set ✓" / "Add `<credentialRef>` to .env") + **Edit** drawer, and a Routing tab (**▲/▼**, include, Default engine, project/per‑render override, **Save routing**).

**VideoRenderPanel** (per‑scene render bay, shown on the VIDEO_PROMPT stage; ≈ $0.30/s Seedance estimate, 3 concurrent):
- **▶ Render all N scenes** → **Confirm — render N (~$est)** (3 workers, poll each to done) / **Cancel**.
- **Render scene 1 only** · **Stop** (mid‑batch).
- Per‑scene 9:16 tiles (ring by status; done → `<video controls>`); **Retry** on a failed tile.
- **⬇ Stitch into one video** (when ≥2 clips) → stitched `<video>` + **Download full episode ↓** (labeled "free — no AI cost").

**CohesiveEpisodePanel** (identity‑locked continuity pipeline):
- **Step 1 — anchor:** editable prompt → **◐ Generate anchor / ↻ Regenerate** (`POST /anchor`, 1080×1920) → preview.
- **Step 2 — render:** **▶ Render cohesive episode** (disabled until an anchor exists) → `POST /episode`, then polls `episode/:id` every 4 s showing "Rendering beat X of N (identity‑locked, voiced)…" → "Stitching…" → **Download episode ↓**. Beats bake in continuity language ("@Image1 keeps the exact same character identity…", "Continue seamlessly from @Video1…").

### 3.6 How it connects

`ScriptonDevelop` parses the `VIDEO_PROMPT` stage body into `{shots[]}` (with `salvageVideoPayload` to recover truncated JSON) and renders both panels with `projectId`, `stageVersionId`, and the payload. `assetUrl()` maps `/uploads/...` clips to the API host; remote fal/Runway clip URLs are left as‑is. Files are served statically from `<cwd>/uploads` at `/uploads` (port 3001). Every render writes a `VideoRun`, which the **AI Governance Recent Runs** feed folds in as `surface: video`.

---

## 4. Audio engines & functions

The audio subsystem (`backend/src/production/script/audio/`) turns a script revision into a voiced **table‑read / full mix** — cast voices, per‑line synthesis with emotion + effects, AI sound design, and public share links. Same switchboard pattern, exposed as **Setup → Audio Engines** (`/setup/audio-engines`) plus the in‑app **ScriptOnAudioPanel**.

### 4.1 The engine catalog (`audio-engines.service.ts` + `adapters.ts`)

| Key | Display | Tier | Caps (tts/sfx/music/dub) | Credential | Cloning | Base URL |
| --- | --- | --- | --- | --- | --- | --- |
| `BROWSER` | Live Reader (Browser) | LIVE | tts | none (client `speechSynthesis`) | — | — |
| `ELEVENLABS` | ElevenLabs | STUDIO | tts·sfx·music·dubbing | `ELEVENLABS_API_KEY` | ✓ | — |
| `OPENAI` | OpenAI | STUDIO | tts | `OPENAI_API_KEY` | — | — |
| `LOCAL` | Local server (free) | STUDIO | tts | none | ✓ | `http://localhost:4123` |

Seed enables only `BROWSER` (always available, $0). Model catalogs: ElevenLabs `eleven_v3` (audio‑tag emotion + dialogue mode; default) / `eleven_multilingual_v2` / `eleven_turbo_v2_5` / `eleven_flash_v2_5`; OpenAI `gpt-4o-mini-tts` (free‑text voice direction) / `tts-1-hd` / `tts-1`; Local `chatterbox` (cloning; default) / `piper` / `melo`. Cost model billed per **char** ($/1k in the UI); Browser/Local are $0.

**Adapters** (`AudioProviderAdapter`) each `fetch` their provider directly (NOT through `AiService`):
- **ElevenLabs:** `POST /v1/text-to-speech/{voiceId}`, `/v1/text-to-dialogue` (whole‑scene multi‑speaker), `/v1/voices`, `/v1/shared-voices` (search) + `/v1/voices/add/...` (import), `/v1/sound-generation` (SFX), `/v1/music`, `/v1/user/subscription` (credits).
- **OpenAI:** `POST /v1/audio/speech` (voices alloy/ash/coral/echo/fable/nova/onyx/sage/shimmer; `gpt-4o-mini-tts` takes `instructions`).
- **Local:** OpenAI‑compatible `POST {base}/v1/audio/speech` (serialized through one queue — CPU servers OOM on parallel calls).

**Routing** capabilities: `LIVE_READ, TTS, SFX, MUSIC, DUBBING`. Fallback everywhere degrades to **Browser** (studio unreachable → browser voices; ffmpeg missing → dry dialogue stem kept).

### 4.2 The functions (one service each)

- **Voice casting** (`voice-casting.service.ts`): detects CHARACTER cues in `pageText` (regex, filters INT/EXT/etc.), stores `CharacterVoiceAssignment` + `VoiceProfile`. **Auto‑cast** samples ≤3 dialogue snippets/character and asks Claude (forced tool `submit_voice_casting`: gender/age/nationality/language/accent/style) then `matchVoice()` scores the engine's voice library (gender +4, age +2, accent +2, unused‑voice +1.5).
- **Pronunciation** (`pronunciation.service.ts`): scope cascade GLOBAL→PROJECT→MASTER→SCRIPT; `PronunciationEntry {term, alias, ipa, ssmlPhoneme, locale, category}`. `applyTo(text)` does word‑boundary respelling before synthesis (invalidates the line cache).
- **Render** (`render.service.ts`, the orchestrator): segments `pageText` into narration+dialogue; **`estimate`** projects cost with `LineSynthesisCache` hits (cached lines are free replays); **`speakLine`** synthesizes one line for live karaoke playback; **`run`** batch‑renders a job (`QUEUED→SYNTHESIZING→MIXING→DONE`) either per‑line or via ElevenLabs v3 **Text‑to‑Dialogue** chunks, concatenates a dialogue stem, mixes layers, writes an `AudioAsset` (FULL_MIX). Emotion map `EMO` (18 labels → ElevenLabs stability/style) + aliases; audio **FX** (radio/phone/tv/megaphone/echo/muffled → ffmpeg chains) parsed from parentheticals; **AI Director** (`aiDirectScene`) adds per‑line `[tag]` delivery (never overriding a writer's parenthetical). Jobs run on **BullMQ** when Redis is configured, else in‑process. A `UsageQuota` (per project/month) is a hard stop.
- **Layers** (`layers.service.ts`): `SceneAudioCue` (AMBIENCE/ROOMTONE/SFX/FOLEY/MUSIC) with start/volume/duck; **`suggest`** is AI‑first (forced tool `submit_sound_design`) with a keyword heuristic fallback; cues resolve to uploaded/library/generated audio and mix via ffmpeg (`adelay` + `amix` + `loudnorm`, dialogue ducked −12 dB).
- **Share** (`audio-share.service.ts`): `AudioShareLink {token, passcode (bcrypt), allowDownload, expiresAt, maxViews, views, revoked}`; public `resolvePublic` returns only the audio + title (never other assets); email via `MailService`.

### 4.3 Endpoints (`script-audio.controller.ts`)

Multiple controllers under **`production/audio`** (+ a throttled public one). Highlights:

| Group | Routes |
| --- | --- |
| Engines | `GET /engines`, `/engines/:key/voices`, `/engines/:key/voice-search`, `POST /engines/:key/voice-add`, `/engines/:key/status`, `/engines/seed`, CRUD, `/routing`, `/routing/:capability`, `/routing-resolved` |
| Casting | `GET /casting/:revisionId`, `POST /casting/:revisionId/autocast`, `PUT /casting/:revisionId/character/:name`, `DELETE /casting/assignment/:id`, `GET/POST/PUT/DELETE /voice-profiles…` |
| Pronunciation | `GET/POST/PUT/DELETE /pronunciation…` |
| Render | `POST /render/estimate/:revisionId`, `POST /speak/:revisionId`, `POST /render/:revisionId`, `POST /render/run/:jobId`, `GET /render/plan/:revisionId`, `GET /jobs/:projectId`, `GET /job/:id`, `GET /jobs-for-revision/:revisionId`, `POST /cue-generate/:cueId`, `POST /direct/:revisionId`, `PUT /directions/:revisionId`, `GET /library/:projectId`, `POST /library/:id/archive`, `GET /usage/:projectId`, `GET /quota/:projectId` |
| Layers | `GET /layers/cues/:revisionId`, `POST /layers/suggest/:revisionId`, `POST /layers/cue`, `PUT /layers/cue/:id/status`, `POST /layers/approve-all/:revisionId`, `DELETE /layers/cue/:id`, `GET /layers/assets`, `POST /layers/upload`, `POST /layers/cue/:id/upload` |
| Share | `GET /share/asset/:assetId`, `POST /share`, `POST /share/:id/revoke`, `POST /share/:id/email`; public `GET /public/audio-share/:token` (throttled 20/min) |

### 4.4 The UIs

**Setup → Audio Engines:** **Seed defaults**; per‑engine rows with tier/capability chips, live **voice count** + **credits** bar, **Enabled** checkbox, and a config grid (Server URL or **API‑key env‑var name**, **Model** dropdown, **Billing** "included" or **$/1k chars**, **Save engine**); a **Routing matrix** (LIVE_READ/TTS/SFX/MUSIC/DUBBING → Default engine + project/per‑render override toggles).

**ScriptOnAudioPanel** (over the script binder) — 3 tabs + a persistent transport (Play/Pause, **Studio‑live/Browser** toggle, session ≈$):
- **Studio:** `StudioReader` (scenes rail · karaoke page · casting inspector). Buttons: **Read scene / Pause**, **continue past scene**, **Direct** (AI Director), Mix desk lane mutes + **duck** slider; per‑character **Pace/Confidence/Tension** sliders, **↻ New take**, **▶ Hear**, **Edit voice**. Keyboard: Space, ↑↓ scene, ←→ line. Karaoke highlight = yellow row + auto‑scroll; AI `[tag]` shown purple on dialogue.
- **Cast → Voices / Pronunciation:** **Auto‑cast**; per‑character **Audition** + **Cast/Edit voice** (VoiceEditor: engine/voice/traits, **Preview**, **Browse/Search full library** → per result **Preview** + **Add & cast** / **Cast**, sliders, **Save voice**); Pronounce: term→alias + category **+ Add** / per‑row **Trash**.
- **Deliver → Render / Library:** mix profile cards (Table read / Full mix / Dialogue only / Narration only), scope toggles (Entire / Selected scenes / Pages), Format (MP3/WAV/AAC/M4A), cost preview + **Queue render / Play table read**, recent renders with `<audio>` + **Download**. Library: asset cards with **Download** / **Share** (ShareModal: passcode/expiry/max‑views/allow‑download → **Create link**, per‑link **Copy**/**Email**/**Revoke**) / **Archive**.
- **Layers** (Studio sub‑panel): **✓ Approve all**, **Generate missing audio**, **Auto‑suggest**, manual add‑cue, LayerTimeline (drag start, **Play scene live**), per‑cue anchor/Start/Vol/duck/approve/**Generate**/**Upload**/**Trash**.

### 4.5 How it connects

Casting/Render/Layers use `AiService.raw()` (forced tools, model `SCRIPT_AUDIO_AI_MODEL || MM_AI_MODEL || 'claude-opus-4-8'`, tasks `audio.*` → visible in Recent Runs). Synthesis uses its **own** provider adapters. Audio files land in `<cwd>/uploads` (served at `/uploads` on 3001), deduped/cached by `LineSynthesisCache`; the panel is driven by the same `revision.pageText`/scene structure as the reader, so the karaoke reader *is* the script reader with synthesis overlaid.

---

## 5. Security — Review Protection & protected export

The security layer produces a **recipient‑watermarked, permission‑locked, audit‑logged PDF** of a script, and — when protection is required — **never** emits an unprotected file. Backend: `review-protection.service.ts` (config/profiles/notices/audit) + `protected-export.service.ts` (the PDF pipeline) + `review-protection.controller.ts`. Config is stored as JSON so the settings shape can grow without migrations.

### 5.1 The settings model (`RP_DEFAULT_CONFIG`)

The default is the secure "testing copy" posture. Key fields (defaults):

| Field | Default | Notes |
| --- | --- | --- |
| `mode` | `enhanced` | `standard` (selectable text) or `enhanced` (rasterised, non‑selectable) |
| `watermarkText` | `TESTING COPY — PRIVATE REVIEW ONLY` | placeholders allowed |
| `watermarkSecondaryText` | `Issued to {recipient_name} • {copy_id}` | |
| `watermarkPattern` | `single_diagonal` | `single_diagonal`/`repeated_diagonal`/`horizontal_center` |
| `watermarkRotation` / `watermarkOpacity` | `-35` / `0.10` | opacity clamped 0.03–0.3 |
| `watermarkEveryPage` | `true` | false → first page only |
| `traceFooterEnabled` / `traceFooterTemplate` | `true` / `{copy_id} · {recipient_name} · {export_date} · Confidential — FilmOS…` | recipient trace footer |
| `noticeTemplateSlug` / `noticePlacement` / `noticeRequired` | `testing_environment` / `dedicated_cover` / `true` | legal notice; `dedicated_cover`/`first_page_top`/`first_page_bottom` |
| `requireRecipient` | `true` | name or email mandatory |
| `recipientEmailDisplay` | `masked` | `hidden`/`masked`/`full` |
| `printingPolicy` | `allow_protected` | `allow_protected`/`allow_low_resolution`/`blocked` |
| `restrictCopying`/`Extraction`/`Editing`/`Annotations`/`PageAssembly` | true/true/true/**false**/true | qpdf flags |
| `sanitizeMetadata` | `true` | always runs regardless |
| `enhancedDpi` | `220` | rasterise DPI (clamped 120–300) |

`getSettings(projectId?)` merges **`RP_DEFAULT_CONFIG` < active profile config < project‑row overrides**. `saveSettings` upserts and bumps `settingsVersion`.

### 5.2 Profiles & notices

**System profiles** (seeded, uneditable — duplicate to customize): `testing_protected_copy` (default), `standard_review`, `enhanced_protection`, `investor_confidential` (WM "CONFIDENTIAL — INVESTOR REVIEW", `recipientEmailDisplay:full`, notice `no_external_ai`). **System notices**: `testing_environment` (default, full legal block with `{placeholders}`), `confidential_review`, `draft_not_for_production`, `personalized_review`, `no_external_ai`. CRUD refuses to edit/delete system rows (creates a duplicate instead).

### 5.3 Copy‑ID & audit

`generateCopyId()` = `RPC-` + base36(now) tail + first 6 hex of `SHA‑256(projectId|recipient|now|random)` → **recipient‑derived, time+random‑salted, server‑only**, printed on every page. Every export writes a `protectedExportRecord`: `{copyId, recipient(name/email/note), mode, profileId, channel, pageCount, checksum (SHA‑256 of the final PDF), bytes, status (CREATED/FAILED/PRINTED), failureReason, settingsSnapshot (the effective config), createdById, createdAt}`. `listExports(projectId?)` powers the history tab. **The PDF itself is never persisted** — only the audit row.

### 5.4 The PDF pipeline — `produce(input)`

Input `baseHtml` comes from the reader's `buildScriptPrintHtml`. Steps:
1. **Resolve** settings + optional per‑export profile override; compute `required = enabled && noticeRequired`; enforce `requireRecipient`; mint the Copy‑ID; resolve the notice body.
2. **Inject + render:** `injectProtection` adds the notice cover + watermark layer to the HTML; the **trace footer is passed separately** and drawn by Chromium in a **reserved 16 mm bottom page margin** (`renderPdf(html, {footerHtml, margin})`) so it never overlaps the script. Arabic‑aware margins (binding side swaps). **If the render fails and protection is required → throw `PROTECTION_FAILED` (502); never return raw.** Missing renderer → `NO_CHROMIUM`/`NO_PUPPETEER` (501).
3. **Enhanced rasterise** (best‑effort): `pdftoppm` → image‑only PDF (non‑selectable). Missing → `degraded: rasterize_unavailable`.
4. **Sanitize metadata** (always, `pdf-lib`): neutral Title, Author `FilmOS`, strip keywords.
5. **Permission flags** (best‑effort, `qpdf`): 256‑bit AES, `--modify=none`, `--extract`, `--print` (per policy), `--assemble`, `--annotate`. Missing → `degraded: permissions_unavailable`.
6. **Checksum** the final bytes, write the `CREATED` audit row, return `{buffer, copyId, mode, pageCount, checksum, degraded[], fileName}`.

Watermark/footer/notice share placeholder vars (`{recipient_name}`, `{copy_id}`, `{project_title}`, `{export_datetime}`, …); `maskEmail` applies `hidden/masked/full`. **Recent hardening:** the footer moved to the puppeteer margin (no more overlap) and the watermark wraps to fit (`.rp-wm-box{white-space:normal;max-width:150mm}`) so it no longer clips at the page edges. *(Flagged dead/unwired: `markPrinted`/`markFailed` have no route; `watermarkScale`, `restrictFormFilling`, `auditLogging` are stored but unused; the old in‑body `footerLayer` is superseded.)*

### 5.5 Endpoints (`review-protection.controller.ts`, base `production/scripton/review-protection`)

| Method | Path | Perm | Purpose |
| --- | --- | --- | --- |
| POST | `/export` | 1 | produce + stream the protected PDF (headers `X-Copy-Id`, `X-Protection-Mode`, `X-Protection-Degraded`, RFC‑6266 filename) |
| GET/POST | `/settings` | 1 / 2 | get / save effective config |
| GET/POST | `/profiles` (+ `/:id/delete`) | 1 / 2 | list / save / delete profiles |
| GET/POST | `/notices` (+ `/:id/delete`) | 1 / 2 | list / save / delete notices |
| GET | `/exports` | 1 | the audit log |

Errors: `NO_PUPPETEER`/`NO_CHROMIUM` → 501, `PROTECTION_FAILED` → 502, else the underlying status.

### 5.6 The UIs

**ProtectedExportDialog** (recipient capture → streamed download): fields **Recipient name / email / Company / Role / Internal note** + a **Protection profile** select (when profiles exist). **Generate & download** validates (name or email), builds `baseHtml` via `getBaseHtml()`, POSTs `/export`, downloads the returned blob (RFC‑6266 filename, prefers the UTF‑8 name so Arabic titles survive), and shows the **Copy‑ID** + any `degraded` note. Error messages are specific per code (the Chromium/puppeteer install commands; the "no unprotected fallback" 502; the "server may be restarting" network case).

**ReviewProtectionPanel** (workspace defaults) — 4 tabs:
- **Configuration:** KPI cards (**Protection** on/off toggle, **Security mode** select, **Active profile**) + panels **Watermark** (text/secondary/pattern/opacity/rotation), **Notice** (template/placement/require), **Recipient** (email display/printing policy/require/every‑page), **Permissions** (6 toggles + sanitize) + **Save protection settings** / **Reset**.
- **Profiles:** rows with System/Default chips; **Use/Active**, **Duplicate**, **Delete** (non‑system).
- **Notices:** rows + preview; **View/duplicate** or **Edit**, **Delete**, **+ New notice** (editor with placeholder hints; editing a system notice creates a copy).
- **Export history:** table (Copy ID / Recipient / Mode / Channel / Status / When).

The **ScriptON settings page** wires it together: `onExport('pdf')` opens the dialog with `exportTarget.getBaseHtml = () => buildScriptPrintHtml(text, title, {...info, lang})`; `'word'` downloads a DOCX package.

### 5.7 How it connects

Reader `buildScriptPrintHtml` → dialog → `POST /export` → `produce()` → `ScripOnService.renderPdf(html, {footerHtml, margin})` (shared with normal PDF download) → rasterise/sanitize/permissions → audit row + streamed PDF. Guarded by `production:1` (export/read), `production:2` (settings/profiles/notices).

---

## 6. Cross‑cutting

**Permissions:** everything here is under the `production` scope — read = level 1, mutation = level 2, behind `JwtAuthGuard + PermissionsGuard`. Public surfaces (audio share) are unauthenticated but throttled and return only the shared asset.

**Secrets:** API keys live **only in `.env`**. The DB stores the env‑var *name* (`credentialRef`), never the key; `health`/`status` endpoints return `hasCredential` booleans, never values.

**Storage:** generated media (audio mixes, stitched videos, protected‑PDF temp files) use `<cwd>/uploads`, served statically at **`/uploads`** on port **3001**; `assetUrl()` bridges those paths to the API host in the frontend. Protected PDFs are streamed and never persisted (only the audit row survives). Remote clips (fal/Runway) keep their own URLs.

**The unified governance feed:** LLM (`AiRun`) and Video (`VideoRun`) runs merge into one **Recent Runs** timeline (`recentRuns` in `llm-routing.service.ts`), filterable by surface/status/size/window — the single place to watch every AI + render call across the platform.

**Env‑var cheat‑sheet:**
- LLM: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`/`LABOR_AI_MODEL`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `LOCAL_LLM_SERVER_URL`, `LOCAL_LLM_MODEL`, `APP_URL`.
- Video: `RUNWAYML_API_SECRET`, `FAL_KEY` (or `SEEDANCE_API_KEY`), `SEEDANCE_BASE_URL`/`_AUTH_SCHEME`/`_RESOLUTION`/`_GENERATE_AUDIO`, `SEEDREAM_MODEL`, `COMFYUI_BASE_URL`/`_WORKFLOW_PATH`/`_NODE_*`.
- Audio: `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `SCRIPT_AUDIO_AI_MODEL`/`MM_AI_MODEL`, `REDIS_URL`/`REDIS_HOST`/`REDIS_PORT`, Local audio base `http://localhost:4123`.
- Security: relies on installed `chrome`/`edge` (or puppeteer's Chromium), `pdftoppm` (poppler, for enhanced mode) and `qpdf` (for permission flags) — all best‑effort/optional except the PDF renderer.

---

## 7. File map

| Subsystem | Backend | Frontend |
| --- | --- | --- |
| AI gateway / governance | `backend/src/ai/{ai.service, llm-routing.service, providers, llm-engines.controller, ai.module}.ts` | `setup/llm-engines/page.tsx` |
| Video engines / render | `backend/src/video/{video.service, video-engines.service, providers, video-engines.controller, video.module}.ts` | `setup/video-engines/page.tsx` · `components/scripton/{VideoRenderPanel, CohesiveEpisodePanel}.tsx` |
| Audio | `backend/src/production/script/audio/{script-audio.controller, audio-engines.service, voice-casting.service, pronunciation.service, render.service, layers.service, audio-share.service, adapters}.ts` | `setup/audio-engines/page.tsx` · `components/production/scripton/ScriptOnAudioPanel.tsx` |
| Security / protected export | `backend/src/production/scripton/{review-protection.service, protected-export.service, review-protection.controller}.ts` | `components/scripton/{ProtectedExportDialog, ReviewProtectionPanel}.tsx` · `scripton/settings/page.tsx` |

---

*Exported directly from source. All four subsystems share the same "engine switchboard" (catalog → seed → routing policy → failover chain → health), governed centrally through the AI Recent‑Runs feed and the `production` permission scope.*



