# ScriptOn — Debug Research Brief

_Static audit of the live repo, 31 Aug 2026. Read against `backend/src/production/scripton/**`,
`backend/src/ai/**`, `backend/prisma/**` and `frontend/src/components/scripton/**` — not against the
handoff docs, several of which claim work that is not in the code._

Scope agreed with Qais: **backend API/data · build & startup · AI develop/render pipeline.**

---

## 1. What ScriptOn actually is

| Layer | Where | Size |
|---|---|---|
| API | `backend/src/production/scripton/scripton.controller.ts` | 77 routes, base `production/scripton`, class-gated `JwtAuthGuard + PermissionsGuard + production:1` (writes re-gated `production:2`) |
| API | `backend/src/production/scripton/review-protection.controller.ts` | 11 routes, base `production/scripton/review-protection` |
| Logic | `scripton.service.ts` | **2,086 lines / 222 KB — one god-service**, 78 public methods |
| Logic | `canon/canon.service.ts`, `review-protection.service.ts`, `protected-export.service.ts` | bi-temporal canon kernel + watermarked export |
| Pure utils (tested) | `canon/*.util.ts`, `scripton.util.ts`, `intake-levers.util.ts`, `collab-mode.util.ts`, `series-scene-count.util.ts`, `package-docx.util.ts` | node:test specs alongside |
| Knowledge packs | `scripton/knowledge/*` + `lore-seed.data.ts` | ~130 KB of static era/genre/format/conflict data |
| AI gateway | `backend/src/ai/{ai.service,llm-routing.service,providers}.ts` | `@Global()`; every model call in the platform funnels through it |
| Frontend routes | `frontend/src/app/(dashboard)/scripton/*` | 19 routes |
| Frontend components | `frontend/src/components/scripton/**` | ~90 files: new OS shell + a still-live legacy set |

**Generation pipeline (the path that breaks):**

```
intake  →  develop stages (LOGLINE/SYNOPSIS/TREATMENT/BEATS/STEP_OUTLINE/SCENES)
        →  promoteToScript()          creates ScriptDocument + ScriptRevision, returns immediately
        →  generateScriptAsync()      fire-and-forget, dispatched by format
             ├─ generateFeatureAsync  → planScenes() → writeScene() × N
             ├─ generateVerticalAsync
             └─ generateDocumentaryAsync
        →  paginate()  →  ScriptRevision.pageText
        →  materialiseScenes()        parses pageText into ScriptScene rows
        →  Reader / Doctor / Room / Breakdown read ScriptScene
```

Every AI hop inside that goes `AiService.run()` → `LlmRoutingService.resolveChain()` → `callProvider()`
across `anthropic | deepseek | gemini | openrouter | local`, with classified failover, an in-memory
provider cooldown, and one `AiRun` audit row per attempt.

---

## 2. Findings, ranked

### F1 — `AiService`'s default model is a **retired** Anthropic model  ·  AI pipeline  ·  HIGH

`backend/src/ai/ai.service.ts:28`

```ts
get model(): string { return process.env.LABOR_AI_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'; }
```

`claude-3-5-sonnet-20241022` was **retired by Anthropic on 28 Oct 2025** — it is no longer served and
requests against it fail. This getter is the model for **`raw()`**, which is Anthropic-only, has **no
failover**, and serves every vision/forced-tool call: voice casting, voice direction, sound design, and
any image/OCR path. If neither `LABOR_AI_MODEL` nor `ANTHROPIC_MODEL` is set in `backend/.env`, all of
those fail at the provider with a model-not-found — classified `BAD_REQUEST`, which is **not** transient,
so there is no retry and no fallback.

Same string is still offered in the Anthropic model dropdown at `llm-routing.service.ts:39` labelled
"legacy" — picking it in Setup → LLM Engines bricks the engine.

`run()` itself is fine: the seeded default `claude-sonnet-4-6` (`llm-routing.service.ts:34`) is active
(retirement not before Feb 2027), as is `claude-opus-4-8`.

**Fix:** change the fallback in `ai.service.ts:28` to a current ID (`claude-sonnet-5` / `claude-opus-5`
/ `claude-sonnet-4-6`), and drop `claude-3-5-sonnet-20241022` from the catalog at `llm-routing.service.ts:39`.

---

### F2 — Migration history does not match the schema  ·  data  ·  HIGH

Verified by diffing every `CREATE TABLE`/`ALTER` in `prisma/migrations/*/migration.sql` against
`prisma/schema.prisma`:

| In schema, in **no** migration | Consequence |
|---|---|
| `intake_profiles.collabMode` · `intake_profiles.scriptonDefaults` | only in the **untracked** `prisma/manual/2026-06-26-scripton-collab.sql` |
| `video_engines` · `video_routing_policies` · `video_runs` | the whole video-engine subsystem has zero migration coverage |

All ScriptOn core tables (`development_builds`, `build_versions`, `stage_versions`,
`development_stages`, `intake_profiles`, `llm_engines`, `llm_routing_policies`, `canon_facts`,
`scene_relations`, `decision_records`, `revision_passes`, `scene_changes`, `protected_export_records`,
`review_protection_*`) **are** covered — by `20260623230407_sync_schema_from_db_push` and
`20260624143851_canon_kernel_p0`. The August work (`invoice_import`, `expense_original_currency`,
`document_attachments`) is properly migrated and touches finance only, not ScriptOn.

What this costs:

1. `prisma migrate status` reports drift; **`prisma migrate dev` will offer to reset the database.**
2. A DB built from migrations alone (`migrate deploy`) has no `collabMode`/`scriptonDefaults` → every
   `IntakeProfile` read/write throws → intake, settings and the team/solo toggle die.
3. `backend/railway.json` runs `npx prisma db push --skip-generate` as its **preDeployCommand**. That
   masks the drift on Railway — and `db push` will happily **drop** any column or table present in the
   DB but absent from `schema.prisma`. That is a data-loss footgun on every deploy.

**Fix:** generate one baseline migration from the live DB (`prisma migrate diff --from-schema-datasource
--to-schema-datamodel`), commit it, then replace the Railway preDeploy with `prisma migrate deploy`.

---

### F3 — Generation progress lives only in process memory  ·  AI pipeline  ·  HIGH

`scripton.service.ts:1038`

```ts
private genProgress = new Map<string, {...}>();
scriptProgress(documentId) { return this.genProgress.get(documentId) || { status: 'UNKNOWN', done: 0, total: 0, pageCount: 0 }; }
```

`promoteToScript()` / `regenerateFeature()` return immediately and let `generateScriptAsync()` run
unawaited. Nothing about that run is persisted — status, phase, error and the stub-guard verdict are all
in the Map. So:

- Any process restart mid-generation → `GET script-progress/:documentId` returns `UNKNOWN` forever, the
  UI spinner never resolves, `ScriptRevision.pageText` stays on the "being written…" placeholder, and
  **`materialiseScenes()` never runs** — so no `ScriptScene` rows, and Reader/Doctor/Room show an empty
  script with no error anywhere.
- `npm run start:dev` is `nest start --watch`. Every file save restarts the process. In dev this fires
  constantly.
- More than one backend instance (Railway scaling) → progress polls hit the wrong instance.

**Fix:** persist run state on `ScriptRevision` (or a `GenerationRun` row) — status, phase, done/total,
lastActivityAt, error — and reconcile orphaned RUNNING rows on boot.

---

### F4 — Failures are swallowed platform-wide  ·  everything  ·  HIGH (this is why nothing has a stack trace)

`scripton.service.ts` alone: **37 bare `catch { }` blocks and 143 `.catch(() => …)` handlers.**
Representative:

| Site | Swallows | Looks like |
|---|---|---|
| `llm-routing.service.ts:~200` `resolveChain` | a missing `llm_engines` table | silently falls back to the in-code default chain |
| `llm-routing.service.ts:73` `onModuleInit` | any seed failure | boots clean, engines never seeded |
| `scripton.service.ts:1379` `materialiseScenes` | any parse/DB error | `return 0` — "no scenes", not "it failed" |
| `scripton.service.ts` `writeScene` | 3 consecutive AI failures | returns `SCENE_STUB` |
| `ai.service.ts` `begin/finish/fail` | any `AiRun` write failure | audit row silently missing |

This is deliberate ("tolerant pre-db:push"), and it is the single biggest obstacle to debugging: real
failures surface as empty results. The `AiRun` table is the one place the truth survives — see §3.

**Fix:** replace bare `catch {}` with a `Logger.warn` carrying the operation and error. Cheap, and it
makes every other finding here observable.

---

### F5 — The shared-primitive extraction was never finished  ·  frontend  ·  MEDIUM

`frontend/src/components/scripton/shared/sx.tsx` is a **byte-identical copy** of `SxRail`, `SX_CSS`
(14,775 chars, identical), `RAIL10` and `cleanStageText` — all of which are **still exported from
`ScriptOnStudio.tsx`**. Nothing was repointed:

- `ScriptonShell.tsx` → `import { SxRail } from './shared/sx'`
- **all 12 legacy components** → `import { SxRail } from './ScriptOnStudio'` — including
  `ScriptOnLibrary.tsx` (which the new Slate renders `embedded`) and `ScriptOnSettings.tsx`.

So two copies of the rail and two `SX_CSS` blobs are live in the same app, and `ScriptOnStudio.tsx`
still cannot be deleted. `_RETIRED.md`'s line _"Shared primitives (SxRail, SX_CSS, cleanStageText, Sx*
types) extracted to shared/sx"_ is **not true in the code** — the extraction created a duplicate rather
than moving anything.

**Fix:** delete the primitives from `ScriptOnStudio.tsx`, re-export from `./shared/sx` for one release,
repoint the 12 imports, then drop the re-export.

---

### F6 — A failing AI call can hang a request for many minutes  ·  build/runtime  ·  MEDIUM

`main.ts:72` sets `server.requestTimeout = 0` (no cap). `AiService.run()` walks the whole chain, then —
if every provider failed transiently — sweeps it **a second time** after 1.5 s. `planScenes()` passes
`timeoutMs: 230000`. Worst case: 5 providers × 230 s × 2 passes ≈ 38 minutes on one request, with the
frontend just spinning. Nothing bounds the total.

**Fix:** add an overall deadline to `run()` (wall-clock budget across the chain), and give the frontend a
client-side timeout.

---

### F7 — The `LOCAL` engine is always reported "usable"  ·  AI pipeline  ·  MEDIUM

`llm-routing.service.ts:156,168` — `usable = enabled && !!baseUrl`, and `LOCAL` is seeded **enabled**
with `baseUrl: http://127.0.0.1:11434/v1`. There is no reachability check. Consequences:

- The actionable *"AI is not configured. Add a provider key…"* message can never fire, because the chain
  always contains one "usable" provider.
- On Railway there is no Ollama on `127.0.0.1` at all, so Local is a guaranteed terminal `NETWORK`
  failure at the end of every chain.

---

### F8 — `seedDefaults()` overwrites engine rows on every boot  ·  AI pipeline  ·  MEDIUM

`llm-routing.service.ts:114`

```ts
const patch: any = { models: d.models as any, credentialRef: d.credentialRef };
```

Runs on every `onModuleInit`. A `credentialRef` changed in the Engines & Routing UI silently reverts to
the code default on the next restart, and the model catalog is force-refreshed. Line 115 also migrates
`claude-3-5-sonnet-20241022` forward — good — but nothing migrates a model that later goes retired.

---

### F9 — `POST production/scripton/render-pdf` renders client HTML in headless Chrome  ·  security  ·  MEDIUM

`scripton.controller.ts:16` — `@RequirePermission('production', 1)` (view-level). The body is arbitrary
HTML, passed to `page.setContent()` with `--no-sandbox` (`scripton.service.ts:1061`). Any authenticated
viewer can submit HTML that pulls `file://` paths or internal-network URLs and receive the result back
inside the returned PDF. Auth-gated, so not critical — but it is a real SSRF / local-file-read path.

**Fix:** raise to `production:2`, and block non-`data:`/allowlisted resource loads via a Puppeteer
request interceptor.

---

### F10 — Global `forbidNonWhitelisted: true`  ·  API  ·  LOW (context)

`main.ts:26`. Any request body carrying a property not decorated on its DTO returns **400 "property X
should not exist"**. ScriptOn's controllers all take `@Body() body: any`, so they are exempt — but if you
see unexplained 400s elsewhere in the app while chasing this, that is the cause.

---

## 3. What to run and paste back

From `C:\Projects\TFM-System`. None of these touch credentials or write anything.

```powershell
# 1 — DB vs schema: the exact drift, as SQL. Empty output = in sync.
cd backend
npx prisma migrate status
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script

# 2 — which model/provider is actually failing, and why (the AiRun audit trail)
node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.aiRun.findMany({orderBy:{createdAt:'desc'},take:25,select:{createdAt:1,task:1,provider:1,model:1,status:1,error:1}}).then(r=>{console.table(r.map(x=>({when:x.createdAt.toISOString().slice(5,16),task:x.task,provider:x.provider,model:x.model,status:x.status,error:(x.error||'').slice(0,90)})));process.exit(0)}).catch(e=>{console.error(e.message);process.exit(1)})"

# 3 — which model IDs the .env is forcing (model names only, no keys)
powershell -c "Get-Content .env | Select-String -Pattern '^(ANTHROPIC_MODEL|LABOR_AI_MODEL|LOCAL_LLM_MODEL|LOCAL_LLM_SERVER_URL)='"
# and just the NAMES of every key set, so we can see what's missing without exposing values
powershell -c "Get-Content .env | ForEach-Object { ($_ -split '=')[0] } | Where-Object { $_ -and $_ -notmatch '^#' }"

# 4 — backend compiles?
npx tsc -p tsconfig.json --noEmit

# 5 — frontend compiles?  NOTE the distDir: a plain `npm run build` corrupts the dev server's .next
cd ..\frontend
$env:NEXT_DISTDIR=".next-verify"; npm run build
```

Then, with the backend running and logged into the app, open **Setup → LLM Engines** (`/setup/llm-engines`)
and tell me what the ChainStrip pills say — which engines read *ready* / *paused* / *no key*, and which
model each shows.

---

## 4. Suggested order of attack

1. **F1** — one-line fix, and it unblocks every `raw()` call. Do it first.
2. **F4** — add logging to the swallowed catches in `scripton.service.ts` + `llm-routing.service.ts`.
   Everything below is invisible until this is done.
3. Run §3 and read the `AiRun` table. That names the failing provider and model directly.
4. **F2** — baseline the migrations before any further schema work, and get `db push` off the deploy path.
5. **F3** — persist generation state. This is the fix that stops "the script generated but came out empty".
6. **F5–F9** as follow-ups.

---

## 5. Docs that no longer match the code

- `frontend/src/components/scripton/_RETIRED.md` — claims the shared primitives were extracted to
  `shared/sx`. They were **copied**; `ScriptOnStudio.tsx` still exports and still serves 12 importers (F5).
- `SCRIPTON-CHROME-SINGLE-SOURCE.md` — the duplicate-rail task it describes is still open, though the two
  copies are currently identical, so the 74px/76px jump it reported is gone.
- `README.md` — accurate on stack and layout; its "Development Roadmap" framing is superseded by
  `docs/SYSTEM-MAP.md`, which says so itself.
- `HANDOFF.md` (26 Jun) — still the best single description of the develop→ScriptScene bridge and the
  scene-gen hardening; both are present in the code as described.
