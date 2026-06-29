# Seedance (ByteDance) — config-driven video engine

Adds **Seedance 2.0** as a third video render provider alongside Local ComfyUI and Runway, governed
by the same Video-engines switchboard (catalog · routing · failover · on/live status). Because
Seedance's parameters change often, the adapter is **config-driven**: the endpoint, auth scheme,
resolution and model id are all settings — a version bump is a config edit, not a code change.

_Researched June 2026. Verify against the live docs before relying on exact params._

---

## What Seedance is, today (June 2026)

- **Seedance 2.0** — ByteDance's current flagship video model (launched April 2026). Multimodal
  (text / image / audio / video in), **native audio**, real-world physics, director-level camera
  control. Up to **15 s**, **480p / 720p**, aspect ratios incl. **9:16** (our vertical default).
- **Official direct API:** BytePlus / Volcengine **ModelArk** (`/contents/generations/tasks`,
  `Authorization: Bearer <ARK_API_KEY>`).
- **Authorized wrapper (our default): fal.ai** — clean, stable REST; it tracks the latest Seedance
  model so upstream param churn is absorbed for us. This is *why* we default to it: it is the most
  resilient way to depend on a "keeps-changing" model.

### fal.ai text-to-video (the default we target)

```
POST https://queue.fal.run/bytedance/seedance-2.0/text-to-video
Authorization: Key <FAL_KEY>
Content-Type: application/json

{ "prompt": "...", "resolution": "720p", "duration": "5",
  "aspect_ratio": "9:16", "generate_audio": true, "seed": 123 }
```

Queue submit returns a `request_id`; poll `.../requests/<id>/status`, then `.../requests/<id>` for
the result `{ "video": { "url": "..." }, "seed": 42 }`. (The sync host `https://fal.run/...` returns
the result inline instead — the adapter handles both.)

Model IDs: `bytedance/seedance-2.0/text-to-video` (standard) · `.../fast/text-to-video` (cheaper/faster)
· `.../image-to-video`.

---

## Can ScriptON's output be understood by Seedance? — yes, with one fix

Our `VIDEO_PROMPT` stage emits each shot with the cinematic detail split across fields
(`prompt`, `camera_movement`, `audio_fx_ambiance`, `negativePrompt`, `durationSec`, `seed`).
Seedance — like ComfyUI and Runway — takes **one self-contained text prompt** and has **no
negative-prompt** concept. So two things were aligned:

1. **The `VIDEO_PROMPT` stage instruction** now tells the model to write each `prompt` as a
   COMPLETE, self-contained cinematic description (**Subject + Action + Camera move + Scene/Lighting
   + Style, ~40–120 words**) with the camera move and lighting **baked into the sentence** — so any
   engine renders it faithfully without reading the side fields. (Also: avoid "fast" → jitter;
   describe camera vs subject motion separately — per Seedance's prompt guide.)
2. **The render trigger** (`VideoRenderPanel`) composes defensively: it folds `camera_movement`
   into the prompt text (deduped) before sending — so even older shots still carry the camera move.

### Field mapping (ScriptON shot → Seedance)

| ScriptON shot field | Seedance input | Notes |
|---|---|---|
| `prompt` (+ folded `camera_movement`) | `prompt` | the full cinematic description |
| `aspectRatio` (`9:16`) | `aspect_ratio` | mapped/validated; vertical default `9:16` |
| `durationSec` (5) | `duration` | clamped to Seedance's 4–15 s range |
| `seed` | `seed` | passed through when present |
| `negativePrompt` | — | **dropped** (Seedance has no negative prompt; only ComfyUI uses it) |
| `audio_fx_ambiance` | `generate_audio` | Seedance synthesizes native audio (on by default) |

---

## What was wired

**Backend**
- `video/providers.ts` — `VideoProvider` union += `'seedance'`.
- `video/video-engines.service.ts` — `'seedance'` in `VIDEO_PROVIDERS`; a `SEEDANCE` entry in
  `VIDEO_PROVIDER_DEFAULTS` (disabled until a key is set; `credentialRef: FAL_KEY`,
  `baseUrl: https://queue.fal.run`, `defaultModel: bytedance/seedance-2.0/text-to-video`, three
  model options). Seeded baseUrl now applies to cloud engines too.
- `video/video.service.ts` — `callSeedance` + `pollSeedance` + `seedanceCfg`/`seedanceAspect`,
  wired into `callProvider` and `checkJobStatus`. Maps our params → Seedance; handles fal queue
  **and** sync hosts; clamps duration; validates aspect.
- `scripton.service.ts` — `VIDEO_PROMPT` stage instruction tuned for self-contained, engine-agnostic
  prompts.

**Frontend**
- `setup/video-engines` — `seedance` added to the provider list (Create-engine dropdown).
- `VideoRenderPanel` — composes the full prompt (bakes the camera move in).

It inherits the rest for free: governed routing + failover (e.g. local ComfyUI → Seedance →
Runway), live on/off status in **AI Governance → Video engines**, and every render logged to
`VideoRun` → the Recent Runs feed.

---

## Enable it

1. Get a fal.ai key → set `FAL_KEY=...` in the backend env (`.env`).
2. Restart the backend (the catalog re-seeds the `SEEDANCE` engine).
3. **AI Governance → Video engines** → enable **Seedance 2.0**, and place it in the failover chain
   where you want it (e.g. after Local ComfyUI).
4. Develop a `VERTICAL_AI_VIDEO` build → **▶ Generate video** on the VIDEO_PROMPT stage.

## Config knobs (env) — survive the API changing

| Env | Default | Purpose |
|---|---|---|
| `FAL_KEY` / `SEEDANCE_API_KEY` | — | API key (the engine's `credentialRef` is `FAL_KEY`) |
| `SEEDANCE_BASE_URL` | `https://queue.fal.run` | queue root; use `https://fal.run` for sync |
| `SEEDANCE_AUTH_SCHEME` | `Key` | `Key` (fal) or `Bearer` (ModelArk) |
| `SEEDANCE_RESOLUTION` | `720p` | `480p` / `720p` |
| `SEEDANCE_GENERATE_AUDIO` | `true` | `false` to mute |
| **model id** | `bytedance/seedance-2.0/text-to-video` | the engine's **editable `defaultModel`** in the UI |

**To move to a newer Seedance** (e.g. `bytedance/seedance-2.5/text-to-video`): just edit the engine's
model in **Video engines** — no redeploy. **To switch to ModelArk:** set `SEEDANCE_BASE_URL` to the
ModelArk root, `SEEDANCE_AUTH_SCHEME=Bearer`, and the engine's `credentialRef` to `ARK_API_KEY`.
(ModelArk's request body differs from fal's; if you point there, the body builder in `callSeedance`
is the one spot to branch.)

## Sources
- [Seedance 2.0 — fal.ai](https://fal.ai/models/bytedance/seedance-2.0/text-to-video)
- [fal-ai/seedance-2.0-api (README, schema)](https://github.com/fal-ai/seedance-2.0-api)
- [Seedance 2.0 API Reference — BytePlus ModelArk](https://docs.byteplus.com/en/docs/ModelArk/1520757)
- [Seedance 2.0 — ByteDance Seed](https://seed.bytedance.com/en/seedance2_0)
