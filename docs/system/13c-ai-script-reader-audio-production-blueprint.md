# SYS-13c — AI Script Reader, Virtual Table Read & Audio Production Module

**Status:** Architecture blueprint (design, pre-build)
**Owner:** Product / Solution / UX / Database Architecture
**Builds on:** SYS-13 (Script Hub / ScriptON D1–D10) and SYS-13b (ScriptON P1–P6)
**Module name (user-facing):** **ScriptON Audio** (the Reader/Table-Read/Audio-Production surface of ScriptON)

---

## 0. Guiding principles & the paid-API reconciliation

The existing Script Reader (SYS-13b P1) is **100% browser-native and $0**: it uses `window.speechSynthesis`, per-character voice selection, karaoke highlight, rehearse, and self-tape. SYS-13b P5 already added `MasterScript.voicePalette` (saved character voices), and P6 added `ScriptAudioNote` (recorded voice memos). This module is an **expansion**, not a replacement.

The module is built on a **two-tier voice architecture**:

| Tier | Engine | Cost | Default for |
| --- | --- | --- | --- |
| **Tier 0 — Live Reader** | Browser `speechSynthesis` (existing) | $0 | In-app reading, rehearsal, quick review. Always available offline. |
| **Tier 1 — Studio Render** | Provider adapters (ElevenLabs first; Azure/Google/Polly/clone later) | Metered per provider | Exported audio, table reads, investor/cinematic mixes. Opt-in, quota-gated, cost-tracked. |

This preserves the zero-cost guarantee for everyday use while introducing professional, provider-backed rendering as a **deliberate, metered, permission-gated action**. Every architecture decision below assumes the engine is swappable via a **`VoiceProviderAdapter`** interface so a new provider never triggers redevelopment.

**Mixing is free.** Synthesis (TTS) is the only metered cost. All layering, normalization, ducking, fades, and encoding are done server-side with **ffmpeg** (self-hosted compute), so ambience/room-tone/SFX/foley/music/mastering add **no per-API cost**.

---

## 1. System architecture

### 1.1 Logical layers

```
┌──────────────────────────────────────────────────────────────────┐
│ CLIENTS  Desktop · Tablet · Mobile (PWA) · Client Portal · Talent  │
│          Portal — all consume the same API + signed media URLs     │
└───────────────▲───────────────────────────────────────▲───────────┘
                │ REST/JSON + WebSocket (job status)      │ signed CDN URLs
┌───────────────┴───────────────────────────────────────┴───────────┐
│ APPLICATION (NestJS, production module)                            │
│  ScriptAudio controllers/services:                                 │
│   • VoiceCastingService    • PronunciationService                  │
│   • PerformanceService     • RenderOrchestratorService             │
│   • AudioLibraryService    • LayerSuggestionService                │
│   • ShareService           • UsageLedgerService / QuotaService     │
└───────────────▲───────────────────────────────────────▲───────────┘
                │                                         │
┌───────────────┴──────────────┐        ┌────────────────┴───────────┐
│ JOB QUEUE (BullMQ + Redis)   │        │ VOICE PROVIDER ADAPTERS     │
│  render · suggest · reconcile│        │  Browser(0) · ElevenLabs ·  │
│  · archive · expiry sweep    │        │  Azure · Google · Polly ·   │
│  WORKERS (horizontal pool)   │        │  Clone — common interface   │
│   ffmpeg mix/encode          │        └────────────────▲────────────┘
└───────────────▲──────────────┘                         │
                │                                         │
┌───────────────┴─────────────────────────────────────────┴──────────┐
│ DATA  PostgreSQL (Prisma)  +  Object storage (S3/Azure Blob + CDN)   │
│       Redis (queue/cache)  +  line-synthesis cache (hash-keyed)      │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 The provider-agnostic adapter contract

```ts
interface AudioProviderAdapter {            // generalized beyond voice — one provider, many capabilities
  key: 'BROWSER' | 'ELEVENLABS' | 'OPENAI' | 'AZURE' | 'GOOGLE' | 'POLLY' | string;
  capabilities: { tts: boolean; sfx: boolean; music: boolean; dubbing: boolean };

  // TTS (voices / narrator) — billed per character
  listVoices(): Promise<ProviderVoice[]>;
  estimateTts(segments: Segment[], cfg: VoiceConfig): CostEstimate;
  synthesize(seg: Segment, cfg: VoiceConfig):
      Promise<{ audio: Buffer; mime: string; timings?: WordTiming[]; charsBilled: number }>;

  // Generated layers — billed per generation
  generateSfx?(prompt: string, opts: { durationMs?; loop?: boolean }):
      Promise<{ audio: Buffer; mime: string; durationMs: number }>;     // ambience/room-tone/SFX/foley
  generateMusic?(prompt: string, opts: { genre?; mood?; durationMs?; structure? }):
      Promise<{ audio: Buffer; mime: string; durationMs: number }>;

  supports: { ssml: boolean; wordTimings: boolean; multilingual: boolean; cloning: boolean; styles: string[] };
}
```

`RenderOrchestratorService` only ever talks to this interface. **Browser** is a degenerate adapter (TTS only; client synthesizes; no server cost). **ElevenLabs** declares `{tts, sfx, music, dubbing}` — a single key/subscription that powers voices *and* generated ambience/room-tone/SFX/foley (Sound Effects API) *and* music (Eleven Music API, Music v2). **OpenAI** declares `{tts}` only (an allowed alternate voice engine; no native SFX/music). Adding an engine = implement one class + insert an `AudioEngine` admin row. Capability flags let the orchestrator route each unit (voice vs SFX vs music) to an engine that supports it, with per-capability failover.

### 1.3 Integration map with existing modules

| Existing module | Touchpoint |
| --- | --- |
| **Projects** | All audio entities carry `projectId` (nullable for House/master); quotas & cost roll up per project. |
| **Script Management (ScriptON)** | Voice assignments, performance settings, cues, renders all key off `ScriptRevision` / `ScriptScene`. Reuses parsed `pageText` + sluglines. |
| **Talent / Casting** | Character → real `Talent`/`CharacterProfile` link; "cast this actor's voice" and (Enterprise) licensed/cloned actor voices. Casting review packages export from here. |
| **Scheduling** | Estimated runtime feeds table-read scheduling; scene order can follow shoot order. |
| **Contacts** | Share recipients (producers/directors/investors) resolve from Contacts. |
| **Budgeting** | Render cost posts to a project cost line (origin `AUDIO_RENDER`); cost-per-project reporting joins the ledger. |
| **Document Management** | Final mixes optionally registered as project documents (vault) with retention. |
| **Client Portal / Talent Portal** | Listen-only + scoped share links; talents hear their own sides/table reads. |
| **Mobile app (PWA)** | Offline cached Tier-0 reads; download Tier-1 mixes for offline playback. |

### 1.4 Engines, routing policy & the user surface (three separated layers)

The system cleanly separates **what is installed**, **what is used**, and **what a person sees**:

1. **Engines (admin install)** — a registry of audio engines (`AudioEngine`, the model formerly called `VoiceProvider`). The **free "Live Reader — Browser"** engine is a first-class peer, not a fallback: admin can leave it on, disable it, or restrict it by role. Tier-1 engines (ElevenLabs, OpenAI, Azure, Google, Polly…) are added with credentials, cost model, rate limits. The whole module runs with **zero, one, or several** engines enabled.

2. **Routing policy (admin decides what's used)** — a **per-capability** matrix, not "a provider": voices, SFX, music, dubbing, and live-reading each route independently, so vendors can be mixed (e.g. voices = ElevenLabs, music = another engine, alternate voices = OpenAI). Stored in `AudioRoutingPolicy`.

| Capability | Default engine | Allowed alternates | Fallback |
| --- | --- | --- | --- |
| Live reading | Browser (free) | — | — |
| Voices (TTS) | ElevenLabs | **OpenAI**, Azure, Google | Browser |
| Sound effects | ElevenLabs | (Library clips) | none |
| Music | ElevenLabs | (future engines) | Library |
| Dubbing | (off) | ElevenLabs | — |

3. **User surface (role-scoped, contextual)** — while working, a user sees **only enabled options**. If the route is locked, the render dialog *states* it read-only ("Voices → ElevenLabs · Music → Library") with a live cost estimate; credentials and cost config never appear downstream. Portals (client/talent/investor) see none of it.

**Precedence / decisions (resolved):**
- **Org policy** is the base.
- **Project override** is allowed **but admin-gated** (`AudioRoutingPolicy.projectOverrideAllowed`) — to honor a financier/studio that mandates a specific vendor for a title.
- **Per-render engine selection is admin-only by default.** An org setting (`AudioRoutingPolicy.userMayOverride`, default `false`) lets admin **later** delegate a per-render override to Producer/LP (gated by `scriptaudio.render.premium`). It is **never** exposed to clients or talent.
- With nothing enabled, the user only ever sees **"Listen (free)."**

---

## 2. Navigation structure

ScriptON gains an **Audio** sub-area. Two entry points:

**A. In-project (per `ScriptRevision`)** — new toolbar group inside the ScriptON binder:

```
ScriptON ▸ [Reader] [Voices] [Pronounce] [Performance] [Layers] [Render] [Audio Library] [Share]
```

- **Reader** — the existing reader, upgraded (karaoke, modes, resume).
- **Voices** — Character Voice Casting panel.
- **Pronounce** — Pronunciation dictionary (project + script scope).
- **Performance** — scene- & character-level emotion controls.
- **Layers** — narrator / ambience / room-tone / SFX / foley / music cue editor.
- **Render** — choose profile + scope + format → queue a Studio Render.
- **Audio Library** — generated assets for this script.
- **Share** — secure links & recipients.

**B. Standalone master (`/scripts` Script Library, SYS-13b P5)** — library-level tabs:

```
Script Library ▸ <MasterScript> ▸ [Revisions] [Voice Palette] [Pronunciation] [Audio Renders]
```

Master-level voice palettes + pronunciation are inherited by every linked project (extends the existing `voicePalette` inheritance on link).

**C. Org admin** — `Settings ▸ ScriptON Audio`:

```
Providers · Voice Library · Pronunciation (global) · Layer Library · Production Profiles
· Quotas & Limits · Cost & Billing · Storage · Permissions · Audit
```

---

## 3. Personas & RBAC

### 3.1 Personas
Writer, Script Coordinator, Director, Producer/LP, Casting Director, Development Exec, Financier/Investor (portal), Actor/Talent (portal), Client (portal), Sound/Post (Enterprise), Org Admin.

### 3.2 Capabilities (extend existing `production` permission levels + `ProjectRoleAssignment`)

| Capability | Description | Default holders |
| --- | --- | --- |
| `scriptaudio.read` | Use Tier-0 reader, listen to existing mixes | All project members + portals (scoped) |
| `scriptaudio.voice.assign` | Assign/edit character voice profiles | Director, Casting, Coordinator |
| `scriptaudio.pronounce` | Edit pronunciation dictionary | Coordinator, Director |
| `scriptaudio.performance` | Edit emotion/performance controls | Director, Coordinator |
| `scriptaudio.layers` | Edit ambience/SFX/foley/music cues | Coordinator, Sound |
| `scriptaudio.render.basic` | Queue Tier-0/derived renders (no paid provider) | Coordinator+ |
| `scriptaudio.render.premium` | Queue Tier-1 (metered provider) renders | Producer/LP, Admin (quota-gated) |
| `scriptaudio.export` | Export/download audio files | Producer, Director, Coordinator |
| `scriptaudio.share.external` | Create external share links | Producer, Admin |
| `scriptaudio.admin` | Providers, libraries, quotas, cost | Org Admin |
| `scriptaudio.cost.view` | See cost/usage dashboards | Producer/LP, Admin, Finance |

Portal scoping: Client/Talent portals receive **listen + download-if-permitted** on explicitly shared assets only; never generation or cost. Premium render always passes through `scriptaudio.render.premium` **and** a quota check (§18). Reuse the existing field-level/role engine; financier sees only "Investor Review" shares.

---

## 4. Database schema

All tables follow existing conventions: `cuid()` ids, `projectId String?` (nullable → House/master scope), plain-indexed FKs where a relation would touch large models, `createdAt/updatedAt`, soft-archive via `status`. New tables (Prisma model names):

### 4.1 Voice & casting

**`AudioEngine`** (registry of engines; `VoiceProvider` is an accepted alias for back-reference).
`id · key(BROWSER|ELEVENLABS|OPENAI|AZURE|GOOGLE|POLLY|…) · displayName · tier(LIVE|STUDIO) · enabled · credentialRef(secret-manager handle, never the raw key) · capabilities(Json: {tts,sfx,music,dubbing}) · defaultModel · supportsCloning · costModel(Json: { tts:{unit:'CHAR'|'SECOND', rate}, sfx:{unit:'GENERATION', rate}, music:{unit:'GENERATION', rate}, currency, minCharge }) · rateLimit(Json) · roleAllowList(Json: roles permitted to use this engine, null=all) · status · createdAt/updatedAt`
> Browser is a seeded `tier=LIVE`, `enabled=true` row that requires no credential. ElevenLabs/OpenAI/etc. are `tier=STUDIO`.

**`VoiceProfile`** — reusable voice (the "casting card" for a voice).
`id · scope(GLOBAL|MASTER|PROJECT) · projectId? · masterScriptId? · ownerId · name · providerId(FK VoiceProvider) · externalVoiceId · gender · ageRange · nationality · nativeLanguage · spokenLanguages(Json string[]) · accent · style · defaultRate(Decimal) · defaultPitch(Decimal) · emotionalRange(Json) · clonedFromTalentId?(FK Talent) · sampleUrl · createdAt/updatedAt`
Indexes: `(scope, projectId)`, `(masterScriptId)`, `(providerId)`.

**`CharacterVoiceAssignment`** — binds a screenplay character to a voice for a revision (or master).
`id · revisionId?(FK ScriptRevision) · masterScriptId? · characterName · voiceProfileId(FK VoiceProfile) · talentId?(FK Talent) · speakCharacterName(Bool, default false) · overrides(Json: {rate,pitch,accent,style}) · languageMap(Json: { "fr": voiceProfileId|cfg }) · sortOrder · createdById · createdAt/updatedAt`
Unique: `(revisionId, characterName)`. Index: `(masterScriptId)`.

> Characters are detected from the existing cue parser (SYS-13b P3 `cueCharacters` / P6 analyze). A "Narrator" pseudo-character row carries the narration voice.

**`AudioRoutingPolicy`** — per-capability routing (the admin "what's used" matrix).
`id · scope(ORG|PROJECT) · projectId? · capability(LIVE_READ|TTS|SFX|MUSIC|DUBBING) · defaultEngineId(FK AudioEngine) · allowedEngineIds(Json string[]) · fallbackChain(Json string[]) · projectOverrideAllowed(Bool, default false) · userMayOverride(Bool, default false — admin-only until flipped) · updatedById · updatedAt`
Unique: `(scope, projectId, capability)`. Resolution: PROJECT row (if `projectOverrideAllowed`) → ORG row. Per-render engine choice is honored only when `userMayOverride=true` **and** the actor holds `scriptaudio.render.premium`; otherwise the policy default is used and the picker is read-only.

### 4.2 Pronunciation

**`PronunciationEntry`**
`id · scope(GLOBAL|MASTER|PROJECT|SCRIPT) · projectId? · masterScriptId? · revisionId? · term · alias(plain respelling, e.g. "Kais") · ipa?(optional IPA) · ssmlPhoneme?(provider phoneme tag) · locale? · category(NAME|LOCATION|BRAND|COMPANY|FANTASY|FOREIGN|HISTORICAL|OTHER) · caseSensitive(Bool) · createdById · createdAt/updatedAt`
Index: `(scope, projectId)`, `(revisionId)`. Resolution order: SCRIPT → MASTER → PROJECT → GLOBAL (most specific wins).

### 4.3 Performance / emotion

**`ScenePerformanceSetting`**
`id · revisionId(FK) · sceneNumber · sliders(Json: {energy,anger,fear,humor,sarcasm,suspense,excitement,confidence,sadness,seriousness,tension,drama} 1–10) · narratorEmotion(Int) · pacing(Int) · note · updatedById · updatedAt`
Unique: `(revisionId, sceneNumber)`.

**`CharacterPerformanceSetting`**
`id · assignmentId(FK CharacterVoiceAssignment) · sliders(Json: {confidence,aggression,calmness,volatility,pace,vocalStrength,formality,intelligence} 1–10) · updatedAt`
Unique: `(assignmentId)`.

### 4.4 Audio enhancement layers

**`AudioLayerAsset`** — the library of ambience/room-tone/SFX/foley/music clips.
`id · scope(GLOBAL|PROJECT) · projectId? · type(AMBIENCE|ROOMTONE|SFX|FOLEY|MUSIC) · category · name · url · durationMs · tags(Json) · source(LIBRARY|UPLOAD|GENERATED) · providerId? · genPrompt?(text prompt used for GENERATED) · genParams?(Json) · license(Json: {kind,attribution,expiresAt}) · loopable(Bool) · createdById · createdAt`
> `GENERATED` assets are produced on demand by a provider (e.g. ElevenLabs Sound Effects / Eleven Music) from `genPrompt`, then cached and reused. The auto-suggest engine emits these prompts; mixing remains ffmpeg.
Index: `(type, category)`, `(scope, projectId)`.

**`SceneAudioCue`** — a placed layer on a scene/timeline.
`id · revisionId(FK) · sceneNumber? · layerType(AMBIENCE|ROOMTONE|SFX|FOLEY|MUSIC) · layerAssetId?(FK AudioLayerAsset) · uploadUrl? · startMs · endMs? · volumeDb · fadeInMs · fadeOutMs · duckDialogue(Bool) · source(AUTO|MANUAL) · status(SUGGESTED|APPROVED|REMOVED) · confidence(Float, for AUTO) · createdById · createdAt/updatedAt`
Index: `(revisionId, sceneNumber)`, `(revisionId, layerType)`.

### 4.5 Production profiles (presets)

**`AudioProductionProfile`**
`id · scope(GLOBAL|PROJECT) · projectId? · name · isSystem(Bool, for the 5 seeded presets) · config(Json: {narrator:{on,voiceProfileId,style,emotion}, ambience:{on,volumeDb}, roomTone:{on,volumeDb}, sfx:{on}, foley:{on}, music:{on,category,volumeDb,fade}, dialogue:{speakNames}}) · createdById · createdAt/updatedAt`
Seed presets: *Basic Script Reading, Table Read, Producer Review, Investor Presentation, Cinematic Experience*.

### 4.6 Render jobs & audio assets

**`AudioRenderJob`** — one render request (the unit of cost + background work).
`id · projectId? · scriptId(FK ScriptDocument) · revisionId(FK ScriptRevision) · profileId?(FK AudioProductionProfile) · scope(ENTIRE|ACT|SEQUENCE|SCENE|PAGE|SELECTION|TABLE_READ|CHARACTER_ONLY|NARRATOR_ONLY|DIALOGUE_ONLY) · selection(Json: scene/page/character lists) · providerKey · format(MP3|WAV|AAC|M4A) · options(Json: includeNames/sceneNumbers/pageNumbers/narration/titlePage/spokenMetadata/stems) · status(QUEUED|ESTIMATING|AWAITING_APPROVAL|SYNTHESIZING|MIXING|ENCODING|DONE|FAILED|CANCELLED) · progress(Int 0–100) · costEstimate(Decimal) · costActual(Decimal) · currency · charsBilled(Int) · durationSec(Int) · requestedById · approvedById? · error? · outputAssetId?(FK AudioAsset) · createdAt · startedAt? · finishedAt?`
Index: `(projectId, status)`, `(revisionId)`, `(requestedById)`.

**`AudioAsset`** — the Audio Library item (final mixes + stems).
`id · projectId? · scriptId · revisionId · scriptVersionLabel · jobId?(FK AudioRenderJob) · kind(FULL_MIX|DIALOGUE_STEM|NARRATION_STEM|CHARACTER_STEM|SCENE_CLIP|LAYER_STEM) · characterName?(for CHARACTER_STEM) · title · url · format · durationSec · fileSizeBytes(BigInt) · checksum · voiceConfigSnapshot(Json) · exportConfigSnapshot(Json) · provider · generatedById · generatedAt · status(ACTIVE|ARCHIVED|DELETED) · storageTier(HOT|ARCHIVE)`
Index: `(projectId, status)`, `(revisionId, kind)`, `(jobId)`.

### 4.7 Sharing, progress, analytics, cost

**`AudioShareLink`**
`id · assetId(FK AudioAsset) · token(unique) · recipientType(PRODUCER|DIRECTOR|INVESTOR|ACTOR|CLIENT|OTHER) · recipientContactId?(FK Contact) · permissions(Json: {listen,download}) · passwordHash? · watermarkSpokenId?(per-recipient leak-trace) · expiresAt? · maxPlays? · playCount · createdById · createdAt · revokedAt?`
Index: `(token)`, `(assetId)`.

**`ListeningProgress`** — resume + "listening time".
`id · userId · revisionId · positionMs · lastSceneNumber · totalListenedMs · device(DESKTOP|TABLET|MOBILE) · updatedAt`
Unique: `(userId, revisionId)`.

**`PlaybackEvent`** — analytics firehose (most-played scenes/characters).
`id · userId? · shareLinkId? · revisionId · assetId? · sceneNumber? · characterName? · action(PLAY|PAUSE|SEEK|COMPLETE|SCENE_ENTER) · positionMs · device · createdAt`
Index: `(revisionId, createdAt)`, `(assetId)`. (Append-only; roll up nightly into a summary table for scale.)

**`VoiceUsageRecord`** — the cost/usage ledger (one row per synthesized billable unit batch).
`id · jobId(FK AudioRenderJob) · providerId · projectId? · userId · charsBilled(Int) · seconds(Decimal) · unitCost(Decimal) · totalCost(Decimal) · currency · cacheHit(Bool) · createdAt`
Index: `(projectId, createdAt)`, `(userId, createdAt)`, `(providerId, createdAt)`.

**`UsageQuota`**
`id · scope(ORG|PROJECT|USER) · projectId? · userId? · period(MONTH|TOTAL) · charLimit? · secondLimit? · costLimit(Decimal)? · storageQuotaBytes(BigInt)? · usedChars · usedSeconds · usedCost · usedStorageBytes · resetsAt? · hardStop(Bool)`
Unique: `(scope, projectId, userId, period)`.

**`LineSynthesisCache`** — avoid re-paying for unchanged dialogue across revisions/renders.
`id · cacheKey(unique = sha256(text + voiceConfig + pronunciationVersion + providerKey)) · providerKey · url · durationMs · charsBilled · hitCount · createdAt · lastUsedAt`
Index: `(cacheKey)`.

### 4.8 Relationship summary

```
ProductionProject 1─* ScriptDocument 1─* ScriptRevision 1─* ScriptScene
ScriptRevision 1─* CharacterVoiceAssignment *─1 VoiceProfile *─1 VoiceProvider
CharacterVoiceAssignment 0..1─1 CharacterPerformanceSetting
CharacterVoiceAssignment 0..1─0..1 Talent           (voice ↔ real cast)
ScriptRevision 1─* ScenePerformanceSetting
ScriptRevision 1─* SceneAudioCue *─0..1 AudioLayerAsset
ScriptRevision 1─* AudioRenderJob 1─0..1 AudioAsset(FULL_MIX) 1─* AudioAsset(stems)
AudioRenderJob 1─* VoiceUsageRecord
AudioAsset 1─* AudioShareLink *─0..1 Contact
ScriptRevision 1─* ListeningProgress / PlaybackEvent
MasterScript 1─* VoiceProfile / PronunciationEntry   (inherited on link → project)
```

---

## 5. Voice casting & language/accent engine

**Character Voice Casting panel** (per revision): auto-detected character list (cue parser) → each row shows Character, assigned Voice (card), Gender, Age Range, Nationality, Native Language, Spoken Languages, Accent, Speed, Style, Emotional Profile. Bulk "Auto-cast" suggests voices by detected gender/age heuristics; "Cast from Talent" links a real `Talent` (and, Enterprise, their licensed/cloned voice).

**The four-axis identity model** (stored on `VoiceProfile` + per-assignment `languageMap`):

| Axis | Meaning | Drives |
| --- | --- | --- |
| Nationality | Cultural origin | Accent default suggestion |
| Native Language | Mother tongue | Accent coloring when speaking a non-native language |
| Spoken Language(s) | Languages the character speaks in the script | Which provider voice/locale renders a given line |
| Accent | Explicit accent tag | Overrides the default (e.g. `ARABIC_ENGLISH`, `MANDARIN_ENGLISH`) |

**Per-line language routing:** the renderer detects each dialogue segment's language (heuristic + script cues like parentheticals "(in French)"; ML detection Phase 2). It then picks `languageMap[lang]` if present, else the base voice with the accent profile. Example outcomes the user specified:

- **Ahmed (Emirati, native Arabic, speaks English, accent Arabic-English)** → English lines rendered with the Arabic-English accent voice/style.
- **Li Wei (Chinese, Mandarin, English, Chinese-English)** → English with Chinese-English accent.
- **John (English native, secondary Arabic)** → English natural; Arabic lines routed to an Arabic-capable voice that preserves his timbre (or clone) so identity is retained across languages.

**Multilingual scenes:** because routing is per-segment, a scene that alternates English/French (`JOHN: Good morning.` / `MARIE: Bonjour…`) plays each line in the correct language while keeping each character's voice identity and accent. Provider SSML `<lang>` is used where supported; otherwise per-language voice selection.

---

## 6. Pronunciation dictionary

A managed dictionary applied automatically at synthesis time. Entries carry an `alias` respelling (e.g. `Qais → Kais`), optional IPA, and an optional provider SSML phoneme tag. Scope cascade SCRIPT → MASTER → PROJECT → GLOBAL. The renderer normalizes text through the resolved dictionary **before** synthesis, and bumps a `pronunciationVersion` so the line cache invalidates when the dictionary changes. UI: searchable table with category filter, inline test ("speak this term"), CSV import/export, and "detect proper nouns" (auto-suggest entries from the script's capitalized/foreign tokens).

---

## 7. Emotion & performance controls

- **Scene-level** sliders (1–10): energy, anger, fear, humor, sarcasm, suspense, excitement, confidence, sadness, seriousness, tension, drama, plus narrator-emotion and pacing → `ScenePerformanceSetting`.
- **Character-level** sliders (1–10): confidence, aggression, calmness, emotional volatility, speech pace, vocal strength, formality, intelligence → `CharacterPerformanceSetting`.

These map onto provider style/stability/similarity/style-exaggeration knobs through an adapter-specific translation table (e.g. ElevenLabs `stability`/`style`; Azure `<mstts:express-as style="…">`). Where a provider lacks a knob, the orchestrator falls back to SSML prosody (`rate`, `pitch`, `volume`, emphasis) so performance intent degrades gracefully. Auto-mood: the narrator and scene defaults can be seeded from the P6 Analyze heuristic (tension/drama inferred from action density and slug day/night) — user-overridable.

---

## 8. Reader, playback & karaoke sync

**Reading logic.** Default: character cue names are **not** spoken; only dialogue + (if narrator on) scene headings/action/transitions/parentheticals via the narrator voice. Optional "speak character names" prepends `"<Name> says… "`. Parentheticals can be (a) spoken by narrator, (b) used only as performance hints, or (c) skipped — a per-profile setting.

**Karaoke highlight.** Tier-1 providers that return word/char timings populate a `timings` map per segment; Tier-0 browser uses `speechSynthesis` `onboundary`. The reader highlights the current word/line and auto-scrolls (existing reader extended). Timings are persisted with the asset so exported playback re-highlights without re-synthesis.

**Playback modes** (drive `AudioRenderJob.scope` and the live reader filter): Entire Script · By Act · By Sequence · By Scene · By Page · Selected Scenes · Character-Only · Narrator-Only · Dialogue-Only · Table Read.

**Navigation & UX:** scene/page/character jump, resume-from-last (`ListeningProgress`), estimated remaining time (chars ÷ words-per-min model), adjustable speed, desktop/tablet/mobile responsive screenplay view with preserved formatting.

---

## 9. Table Read mode

Generates a full virtual table read: every character on its own voice, dedicated narrator, automatic speaker switching, natural inter-line timing (configurable gap + overlap rules), continuous playback. Implemented as `scope=TABLE_READ` → the orchestrator emits an ordered segment list (narration + dialogue), synthesizes/caches each, then concatenates with timing rules and (optionally) light room tone. Output is a single `FULL_MIX` asset **plus** optional per-character stems for later re-use. Phase 2: "live table read" session where participants join and only AI-voice the absent roles.

---

## 10. Audio enhancement layers

Six independent, individually toggImageable layers, each optional and mixable before playback/export:

| Layer | Model | Auto-suggest source | Controls |
| --- | --- | --- | --- |
| **1 Narrator** | profile config | n/a | on/off, voice, style, emotion |
| **2 Ambience** | `SceneAudioCue(AMBIENCE)` | slug/action keywords → category (coffee shop, airport, desert, rain…) | accept/replace/remove, volume |
| **3 Room tone** | `SceneAudioCue(ROOMTONE)` | INT/EXT + location | independent volume |
| **4 SFX** | `SceneAudioCue(SFX)` | action-line verbs (door, gunshot, phone…) + timeline | approve/edit/replace/remove, position |
| **5 Foley** | `SceneAudioCue(FOLEY)` | character motion cues (footsteps, cloth, keys) | separate from SFX, per-cue |
| **6 Music** | `SceneAudioCue(MUSIC)` | genre/tone of scene | volume, fade in/out, start/end, scene-or-whole |

**Auto-suggestion engine (`LayerSuggestionService`)**: MVP is a **local keyword/heuristic matcher** over scene text → candidate `SceneAudioCue` rows with `source=AUTO, status=SUGGESTED, confidence` ($0, on-machine). Phase 2 upgrades to an embeddings/NLP classifier. Users always approve/replace/remove. **Ducking**: dialogue-side-chain compression auto-lowers music/ambience under speech (ffmpeg `sidechaincompress`).

---

## 11. Audio production profiles

`AudioProductionProfile` presets bundle layer + dialogue config. Five seeded system presets exactly as specified: **Basic Script Reading**, **Table Read**, **Producer Review**, **Investor Presentation**, **Cinematic Experience**. Users clone/edit to project- or org-scoped presets. Selecting a profile at render time pre-fills all layer toggles; per-render overrides allowed.

---

## 12. Render pipeline & background jobs

**Render pipeline (`AudioRenderJob`):**
1. **Estimate** — segment the selected scope (narration + dialogue lines), resolve voices/pronunciation/performance, compute char/second cost via adapter → `costEstimate`. If premium + over soft quota → `AWAITING_APPROVAL`.
2. **Synthesize** — per segment: check `LineSynthesisCache` (hash) → hit reuses audio at $0; miss calls the adapter, stores clip + timings, writes `VoiceUsageRecord`. Concurrency-limited per provider rate limit.
3. **Mix** — ffmpeg: assemble dialogue timeline → add narrator → layer ambience/room-tone/SFX/foley/music with volumes/fades/ducking → loudness-normalize (EBU R128 / -16 LUFS for review, -23 for broadcast later).
4. **Encode** — to requested format(s); generate stems if requested.
5. **Store** — upload to object storage (per-project prefix), checksum, create `AudioAsset` rows, set `outputAssetId`, `costActual`, `durationSec`.
6. **Notify** — WebSocket progress + completion event; optional email/portal notification.

**Background/scheduled jobs:** render workers (BullMQ); nightly **PlaybackEvent → summary rollup**; **cost reconciliation** (provider invoice vs ledger); **storage lifecycle** (HOT→ARCHIVE after N days, delete on retention); **share-link expiry sweep**; **quota reset** (monthly); **cache eviction** (LRU on `LineSynthesisCache`); **layer-suggestion** pre-compute on revision upload.

---

## 13. Export system

**Scope:** current page · selected pages · current scene · selected scenes · current act · entire script.
**Include/exclude toggles:** character names, scene numbers, page numbers, narration, script version, revision info, title page, sound-design layers.
**Spoken metadata (optional announcements):** script title, version, revision date, scene number ("Scene 12"), page number ("Page 24"), draft ("Draft Version 3.2").
**Formats:** MP3, WAV, AAC, M4A now; **Broadcast WAV (BWF) + production formats** flagged Future. Each export is an `AudioRenderJob` producing `AudioAsset`(s). Exports inherit the active production profile unless overridden.

---

## 14. Audio library & asset-management architecture

- **Object storage** (S3 or Azure Blob) behind a **CDN**; keys namespaced `org/{org}/project/{project}/script/{revision}/{assetId}.{ext}`. DB stores metadata only.
- **Signed, time-boxed URLs** for playback/download; share links resolve through `ShareService` (never expose raw bucket URLs).
- **Stems + mix**: every render can emit `FULL_MIX` + dialogue/narration/character/layer stems for re-mixing without re-synthesis.
- **Dedup & cache**: `LineSynthesisCache` keyed by content hash → unchanged dialogue across revisions/renders costs $0 to reuse.
- **Lifecycle tiers**: `HOT` (recent/active) → `ARCHIVE` (cold storage) → delete per retention. `checksum` for integrity.
- **Library UI** stores & exposes per asset: project, script, version, generation date, generated-by, voice config snapshot, export config, duration, file size. Actions: search, filter, preview, download, share, duplicate, **regenerate** (re-runs the job with the stored config), archive.

---

## 15. Sharing & collaboration

Secure links (`AudioShareLink`) with: recipient type (producer/director/investor/actor/client), optional Contact link, listen/download permission flags, optional password, **per-recipient spoken watermark id** for leak-tracing, expiration, max-plays. Portal delivery: Client/Talent/Investor portals render a branded listen page; play/seek events feed `PlaybackEvent` for "who listened / how far." Revoke instantly. (Mirrors the existing Sides leak-trace watermark + clearance-pack token patterns.)

---

## 16. Administration & configuration (settings pages)

`Settings ▸ ScriptON Audio`:

1. **Engines** — register/enable each audio engine (Browser/free, ElevenLabs, OpenAI, Azure…), credentials (via secret manager handle), tier, default model, cost model, rate limits, role allow-list, test-synthesis.
1b. **Routing & Defaults** — the per-capability matrix (`AudioRoutingPolicy`): pick default engine + allowed alternates + fallback per capability (live-read/TTS/SFX/music/dubbing); toggle `projectOverrideAllowed`; toggle `userMayOverride` (off by default → per-render selection is admin-only until enabled, then limited to Producer/LP).
2. **Voice Library** — import provider voices, create/curate `VoiceProfile`s, mark org-default voices, manage clones (Enterprise).
3. **Pronunciation (global)** — org dictionary; bulk import.
4. **Layer Library** — manage ambience/room-tone/SFX/foley/music assets + licenses; upload; tag.
5. **Production Profiles** — manage presets.
6. **Quotas & Limits** — per org/project/user char/second/cost/storage caps; soft vs hard stop; approval thresholds.
7. **Cost & Billing** — provider cost models, currency, markup, cost-center mapping to Budgeting.
8. **Storage** — buckets, CDN, retention/lifecycle policy.
9. **Permissions** — map capabilities to roles/templates.
10. **Audit** — full action log (who rendered/exported/shared/spent).

---

## 17. API architecture & third-party integrations

**Controller groups (NestJS, `production/scriptaudio/*`):** `voices` (profiles + assignments), `pronunciation`, `performance`, `layers` (assets + cues + suggest), `profiles`, `render` (estimate/queue/approve/cancel/status), `library` (assets CRUD + regenerate + archive), `share`, `progress`, `analytics`, `admin/providers`, `admin/quotas`, `admin/usage`.

**Representative endpoints:**
```
GET  /production/scriptaudio/voices/revision/:revisionId         # assignments + detected chars
PUT  /production/scriptaudio/voices/assignment/:id
GET  /production/scriptaudio/voiceprofiles?scope=…
POST /production/scriptaudio/pronunciation/:scope/:id
PUT  /production/scriptaudio/performance/scene/:revisionId/:sceneNumber
GET  /production/scriptaudio/layers/suggest/:revisionId          # auto-cues
POST /production/scriptaudio/render/estimate/:revisionId         # → cost preview
POST /production/scriptaudio/render/:revisionId                  # queue job
POST /production/scriptaudio/render/:jobId/approve               # premium over-quota
WS   /production/scriptaudio/render/:jobId/status                # progress
GET  /production/scriptaudio/library/:projectId
POST /production/scriptaudio/library/:assetId/regenerate
POST /production/scriptaudio/share/:assetId                      # secure link
GET  /production/scriptaudio/analytics/:projectId
POST /production/scriptaudio/admin/engines                       # admin: register/enable engine
GET  /production/scriptaudio/admin/routing/:scope/:projectId?    # routing matrix
PUT  /production/scriptaudio/admin/routing/:capability           # set default/alternates/overrides
GET  /production/scriptaudio/routing/resolved/:revisionId        # effective engines a user may use here
```

**Third-party integrations:** ElevenLabs (TTS, voice library, voice cloning, Sound Effects, Eleven Music) as first full adapter; **OpenAI** (TTS only) as an allowed alternate voice engine; Azure Cognitive Speech, Google Cloud TTS, Amazon Polly as future adapters; optional licensed SFX/music libraries (e.g. provider-supplied) registered as `AudioLayerAsset` sources; object-storage/CDN (S3/CloudFront or Azure Blob/Front Door); email/notification via existing MailService; secret manager for provider keys. **Webhooks/async**: providers that render async post back to a signed callback that advances the job.

---

## 18. Cost management & usage tracking

- **Estimate-before-spend**: every render shows a cost preview (chars × rate, minus projected cache hits) before queueing.
- **Ledger**: `VoiceUsageRecord` per synthesized batch (chars, seconds, unit cost, total, cache-hit flag).
- **Quotas** (`UsageQuota`) at org/project/user with soft (warn) and hard (block) stops; premium render over soft threshold → `AWAITING_APPROVAL` requiring `scriptaudio.render.premium`.
- **Budgeting integration**: actual cost posts to a project cost line (origin `AUDIO_RENDER`) so it appears in cost reports; cost-per-project and cost-per-user reports join the ledger.
- **Cache savings** surfaced (chars saved × rate) to justify ROI.
- **Markup/cost-center** config for studios that rebill clients.

---

## 19. Reporting & analytics

Backed by `VoiceUsageRecord`, `PlaybackEvent` (+ nightly rollup), `AudioAsset`, `AudioShareLink`:

| Report | Source |
| --- | --- |
| Audio generations (count, success rate, avg duration) | AudioRenderJob |
| Listening time (per user/project/script) | ListeningProgress + PlaybackEvent |
| Most-played scenes / characters | PlaybackEvent rollup |
| Voice usage (by profile/provider) | VoiceUsageRecord |
| Storage usage (per project/tier) | AudioAsset + UsageQuota |
| Export & share activity | AudioRenderJob + AudioShareLink |
| User activity / audit | audit log |
| Cost per project / per user | VoiceUsageRecord |

Delivered as dashboards (charts) + CSV/PDF export; producer/finance roles see cost, others see engagement only.

---

## 20. Multi-project scalability architecture

- **Tenancy & partitioning**: every entity carries `projectId`; storage keys and quotas partition by org→project. Hot tables (`PlaybackEvent`) are append-only with nightly rollup + time-based partitioning/retention.
- **Queue + worker pool**: BullMQ on Redis; horizontally scalable stateless workers; per-provider concurrency & rate-limit guards; priority lanes (interactive preview > batch export).
- **Synthesis cache** (`LineSynthesisCache`) is global → cross-project reuse of identical lines/voices slashes cost and latency.
- **CDN-fronted playback**; signed URLs; range requests for scrubbing.
- **Idempotent renders** keyed by (revision + config hash) so duplicate requests dedupe.
- **Backpressure**: quota + queue-depth limits; graceful "estimated wait" UX.
- **Provider failover**: if a provider errors/limits, the orchestrator can retry or fall back (configurable) to another adapter or Tier-0.

---

## 21. UI screens & settings inventory

**Project/script screens:** Reader (upgraded) · Voice Casting panel · Pronunciation manager · Performance (scene + character) · Layer/Cue editor (timeline) · Render dialog (profile + scope + format + cost preview) · Render progress drawer · Audio Library (grid + filters + asset detail) · Share manager.
**Library (master) screens:** Voice Palette · Pronunciation · Audio Renders.
**Admin screens:** Providers · Voice Library · Global Pronunciation · Layer Library · Production Profiles · Quotas & Limits · Cost & Billing · Storage · Permissions · Audit.
**Portal screens:** branded Listen page (client/talent/investor) with scoped controls.

---

## 22. Automation workflows

- On **revision upload** → auto-detect characters, pre-suggest layer cues, carry forward voice assignments by character name (like bookmark carry-forward), invalidate stale line cache.
- On **voice/pronunciation/performance change** → mark affected cached lines stale (selective).
- On **render complete** → notify requester + (if configured) producer/portal; optionally register `FULL_MIX` as a project Document.
- On **quota threshold** → warn owner; block + request approval at hard stop.
- On **share open** → log event; on expiry → auto-revoke.
- **Casting/Investor/Producer review packages** → one-click generate the matching profile render + share link to the relevant recipient list.

---

## 23. Scalability concerns & mitigations

| Concern | Mitigation |
| --- | --- |
| Provider cost runaway | Estimate-before-spend, quotas, approval gate, line cache, cache-savings reporting |
| Long renders for full features | Segment-level parallelism, queue priority, progressive/partial delivery, stems reuse |
| Storage growth | Lifecycle tiers (HOT→ARCHIVE→delete), dedup, per-project quotas |
| `PlaybackEvent` volume | Append-only + nightly rollup + partition/retention |
| Provider outage/limit | Adapter failover + Tier-0 fallback + retry/backoff |
| Multilingual correctness | Per-segment routing, pronunciation dictionary, human-overridable, QA preview |
| PII / leak of unreleased scripts | Signed URLs, per-recipient spoken watermark, expiry, audit, portal scoping |

---

## 24. Industry best practices reflected

Color-coded revision discipline (already in ScriptON), per-recipient watermarking for unreleased material (studio anti-leak standard), loudness normalization to broadcast targets, stems-based delivery for post, table-read-before-greenlight as a development gate, casting via voice "audition" cards, controlled distribution to financiers/clients with expiry, and cost attribution to the production budget — all mirror how studio script-development and post departments operate.

---

## 25. Phasing

### MVP (ship first — leans on existing $0 reader + one provider)
- Upgrade existing Reader: karaoke highlight, all playback modes, resume, est. time, speed.
- Character Voice Casting panel (detected chars → `VoiceProfile`), narrator voice, "speak names" toggle.
- Provider-agnostic adapter + **ElevenLabs** adapter + **Browser** Tier-0; `VoiceProvider` admin.
- Pronunciation dictionary (project + script scope, auto-apply).
- Scene + character performance sliders (mapped to provider knobs/SSML).
- Render pipeline → **Table Read** + Dialogue-only/Narrator-only; formats MP3/WAV.
- Audio Library (store/search/preview/download/regenerate/archive) + line-synthesis cache.
- Export scopes + include/exclude + spoken metadata.
- Cost estimate + `VoiceUsageRecord` ledger + basic per-project/user cost report + quotas.
- Secure share links with expiry; listen on Client/Talent portals.
- Multilingual per-segment routing + accent profiles (core cases: Arabic-English, Mandarin-English, bilingual identity).

### Phase 2
- Layers 2–6 (ambience, room tone, SFX, foley, music) with auto-suggest (heuristic) + timeline cue editor + ducking + the 5 production profiles.
- Master-level voice palettes & pronunciation inherited on link (extends P5).
- Additional adapters (Azure/Google/Polly); provider failover.
- Richer analytics (most-played scenes/characters, listening time, storage), CSV/PDF.
- AAC/M4A; per-character stems; regenerate-with-changes diffing.
- Mobile offline download of mixes.

### Enterprise
- Voice cloning / **licensed voice-actor** library + rights management.
- ML-based layer suggestion & language detection; auto-mood from analysis.
- Broadcast WAV/BWF + production delivery; loudness profiles per channel.
- ADR & dubbing workflows; full-cast audio productions; audio-drama generation.
- Cost markup/rebill, cost-center mapping, SSO-scoped portals, advanced audit/retention/DLP.
- Live virtual table-read sessions (AI fills absent roles) — ties into the deferred SYS-13b "Live Layers (WebSocket)" P6.2.

### Future roadmap
- Script presentation packages; development/casting/producer/investor review workflows as first-class objects.
- Advanced foley & production-sound libraries; marketplace of licensed voices/SFX/music.
- Real-time collaborative listening rooms; auto-generated "audio look-book" for financiers.

---

## 26. Integration touchpoints (quick reference)

| Action | Writes/Reads |
| --- | --- |
| Render queued | AudioRenderJob (+ VoiceUsageRecord on synth) → Budgeting cost line |
| Asset stored | AudioAsset → optional Document Management registration |
| Voice cast from actor | CharacterVoiceAssignment.talentId → Talent/Casting |
| Share to investor | AudioShareLink.recipientContactId → Contacts → Client/Investor Portal |
| Listening | ListeningProgress / PlaybackEvent → Analytics |
| Master palette | VoiceProfile/PronunciationEntry (MASTER) → inherited on link to project |

---

## 27. Decisions

**Resolved**
- **Engine model** — multi-engine registry; the free Browser reader is a permanent peer; Tier-1 engines added per capability. ElevenLabs is the first full adapter (TTS+SFX+Music+Dubbing); **OpenAI** is an allowed alternate **TTS** engine.
- **Project override of the default engine** — **allowed but admin-gated** (`projectOverrideAllowed`), for financier/studio vendor mandates per title.
- **Per-render engine selection** — **admin-only by default**; an org setting (`userMayOverride`) can later delegate a per-render override to **Producer/LP** (gated by `scriptaudio.render.premium`). **Never** exposed to clients/talent.

**Still open (product sign-off)**
1. **Primary engine commercial terms** (ElevenLabs tier, cloning rights; OpenAI TTS tier) — drives cost-model defaults.
2. **Storage backend** (S3 vs Azure Blob) — matches current hosting.
3. **Default loudness target** for review vs broadcast.
4. **Quota policy** defaults (per-project monthly char/generation cap; hard vs soft).
5. **Retention** windows for HOT vs ARCHIVE vs delete.

---

*Backward-compatible: every new entity is additive; the existing Tier-0 reader keeps working with no provider configured. Premium rendering is inert until an admin enables a `VoiceProvider`.*
