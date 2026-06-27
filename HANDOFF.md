# HANDOFF — ScriptON: unified top bar, develop→ScriptScene bridge, scene-gen hardening, SP-2 settings/team-solo

**Author:** ScriptON work session (Claude). **Date:** 2026-06-26.
**Single source of truth for resuming this work with zero merge collisions.**

---

## 0. TL;DR for the reconciler

- **Everything is committed.** Working tree has **no uncommitted tracked changes** (only untracked `.md` design/handoff notes + a stray temp file).
- **One branch holds it all:** `feat/scripon-os-rail-cutover`. There is **no separate "polish" branch** — the OS rail cutover, the top-bar/Figma polish, the develop→scene bridge, the scene-gen hardening, and SP-2 (settings + team/solo) are all commits on this one branch.
- **The ONLY high-risk collision file is `backend/src/production/scripton/scripton.service.ts`** (I made large edits; the AI-streaming/idle-timeout track also lives here). See §9.
- **I did NOT touch** `backend/src/ai/providers.ts`, `backend/src/ai/ai.service.ts`, `backend/prisma/schema.prisma`, `backend/src/production/scripton/canon/*`, `frontend/.../layout.tsx`, `os-workspaces.ts`, `osShellFlag.ts`, or the SxRail-exporting `ScriptOnStudio.tsx`. (All clean per `git log` per-file attribution.)
- **No new DB schema, no migration, no new API endpoints, no new env vars/deps.** Data-only DB side effects on **عنترة** (one script) — see §4.

---

## 1. FEATURE — what was built and why

Product/module: **ScriptON** (the screenwriting product inside the TFM ERP — `backend/src/production/scripton/**` + `frontend/src/app/(dashboard)/scripton/**` + `frontend/src/components/scripton/**`). Four threads:

1. **Unified top bar (Figma polish, "X1/P0").** A single shared global bar (`ScriptonTopBar`) across all 9 OS workspaces, replacing each screen's bespoke `.top` header. Fixes double-headers and the breadcrumb that read the fictional "Midnight Run" sample.
2. **Develop→ScriptScene bridge.** The develop/render pipeline wrote `ScriptRevision.pageText` (+ BuildVersion + CanonFacts) but **never created `ScriptScene` rows**, so AI-developed scripts rendered empty and silently fell back to a fictional "Midnight Run" sample. Now a finished revision's pageText is parsed into `ScriptScene` rows (the same parser the PDF import path uses, made Arabic-aware) so the Reader/Doctor/Room render real scenes.
3. **Honest empty states.** Killed the fictional-sample fallback on the real-data path (Write, Doctor, Room): a bound-but-unparsed script now shows its own title + an honest empty state, never the sample. Labelled `SAMPLE` badge only for a true no-script demo.
4. **Scene-gen hardening.** `writeScene` silently swallowed AI failures and returned a stub `(The scene continues.)`; a transient outage produced a complete-looking all-stub draft filed as DONE. Added retries + a wholesale-stub guard (mark ERROR, don't file stubs).
5. **SP-2 (Tasks 6–9): Settings + team/solo toggle.** Approval actions branch on collaboration mode (team routes for sign-off, solo direct-applies); a real Project-settings panel; Arabic rail-label translations; new revisions inherit the workspace default colour. (SP-2 Tasks 1–5 were merged earlier on this branch.)

---

## 2. GIT

- **Branch:** `feat/scripon-os-rail-cutover`
- **HEAD:** `d5a183f74a1550d57cc1deff23e51e69fb4f1d1d`
- **Local branches:** `feat/scripon-os-rail-cutover` (current), `feat/scripon-os-shell`, `feat/scripon-script-os-p0`, `main`, `ux/themes-rtl-homes`. No "polish" branch exists.
- **Committed or uncommitted?** **All work is committed.** `git diff --stat` is empty.

`git status --porcelain` (all untracked, none staged/modified):
```
?? MODULE-DECOUPLING-AUDIT.md
?? SCRIPON-HANDOFF-CANON.md
?? SCRIPON-HANDOFF-DEVELOP.md
?? SCRIPON-HANDOFF-DOCTOR.md
?? SCRIPON-HANDOFF-HOME.md
?? SCRIPON-HANDOFF-ROOM.md
?? SCRIPON-HANDOFF-STUDIO.md
?? SCRIPON-SCREEN-BUILD-PLAN.md
?? SCRIPTON-FIGMA-FIDELITY-AUDIT.md
?? SCRIPTON-HANDOFF-RENDER-COMPARE.md
?? SCRIPTON-HANDOFF-TOPBAR.md
?? SCRIPTON-HANDOFF-VERSIONS.md
?? SCRIPTON-HANDOFF-WRITE.md
?? SCRIPTON-V1.1-PLAN.md
?? design-tmp/scripon-backto-filmos-options.html
?? design-tmp/scripon-tfm-brand-home.html
?? "frontend/C\357\200\272Users...scratchpadnext-build-output.txt"   (stray temp file — safe to delete)
```
(`HANDOFF.md` itself will appear untracked once written.)

**Commits introduced by this session** (newest→oldest; range `7a82000..d5a183f`):
```
d5a183f fix(scripton): final-review minors — AR strings for solo actions + live collab caption
cf661b8 fix(scripton): T9 default colour → colorCode (hex), not revisionColor (WGA key)
e46384d feat(scripton): new builds/revisions/exports inherit ScriptON defaults
782939f feat(scripton): complete Arabic translations for the OS rail labels + settings
3d05217 feat(scripon): real Project settings panel (name, locale, defaults, collab)
0a1a136 fix(scripton): solo breakdown edit applies to all selected elements + refreshes
da75e65 feat(scripton): approval actions branch team/solo (solo direct-applies)
596bb64 fix(scripton): harden scene generation against silent all-stub drafts
798f0ef fix(scripton): honest empty state on Doctor + Room (kill sample-coverage fallback)
1960c86 feat(scripton): develop→ScriptScene bridge — materialise scenes so developed scripts render
3e71745 fix(scripton): kill the 'Midnight Run' sample fallback on Write's real-data path
5525379 test(scripon): add slate-desktop verify scenario (bar + no double-header)
5a72fa6 feat(scripton): roll unified top bar into 7 screens + fix Write breadcrumb (X1)
87f9545 feat(scripton): unified top bar — shared component + Home/Write adoption (X1, P0)
```
(SP-2 Tasks 1–5 — `fe44281`, `83e0b7f`, `c808b57`, `99d77bb`, `7a82000` — were committed earlier on the same branch and are the prerequisites for Tasks 6–9.)

**Branch relationship + safe merge order:** This branch already contains the P0 canon kernel (merged from `feat/scripon-script-os-p0`) and the OS-rail-cutover/polish work — it is **one cumulative ScriptON branch**, not separate from "the polish branch." If the **AI-streaming track** is a *different* branch that also edits `scripton.service.ts` (see §9), merge order should be: **land the AI-streaming branch first, then rebase this branch on top and resolve `scripton.service.ts`** (my changes are additive new methods + localized edits inside `writeScene`/`generateFeatureAsync`/`extendFeatureAsync` — see §9 for exact functions). If instead this branch lands first, the AI track rebases onto it. Either way the conflict is confined to `scripton.service.ts`.

---

## 3. FILES — what changed (this session, 25 files; `git diff 7a82000..d5a183f --stat`)

**Backend (4):**
- `backend/src/production/script/scene-parse.util.ts` — **NEW.** Pure slugline parser extracted from `ScriptService` + made **Arabic-aware** (داخلي=INT, خارجي=EXT; فجر/نهار/ليل→DAWN/DAY/NIGHT). Exports `parseScenes(pages: string[]): ParsedScene[]`.
- `backend/src/production/script/scene-parse.util.spec.ts` — **NEW.** 4 node:test cases (English + عنترة's real Arabic headings + empty).
- `backend/src/production/script/script.service.ts` — `parseScenes` now **delegates** to the new util (English import behaviour unchanged; gains Arabic). Net −40 lines (inlined logic removed).
- `backend/src/production/scripton/scripton.service.ts` — **the big one** (+101/−16). Bridge `materialiseScenes()` + completion hooks; scene-gen hardening (`writeScene` retries, `mostlyStub`/`failStubRun`, `SCENE_STUB` const); T9 defaults (`scriptonDefs()` + 3 revision-create paths). See §9.

**No new NestJS module/service/controller was added.** Everything lives in the existing `ScripOnService`/`ScriptService` (both already wired via `ProductionModule` → `AppModule`). `app.module.ts` / `production.module.ts` were **not touched**.

**Frontend pages (6):**
- `scripton/reader/page.tsx` — Write data path: never seed the sample; bind real title; honest empty state for unparsed; labelled `sample` demo only when nothing binds; `resolveScriptonProjectId()` on cold workspace cache; new `?doc=<id>` to open a specific script. Also adds `useScriptonMode()` (T6).
- `scripton/doctor/page.tsx` — start neutral (no `SAMPLE_GAUGES`/'Midnight Run'); `resolveScriptonProjectId()` fallback; bind real doc title (T6/empty-state).
- `scripton/notes/page.tsx` — `resolveScriptonProjectId()` fallback; bind real doc title (Room).
- `scripton/breakdown/page.tsx` — solo branch applies to all `active.ids` + refetch (T6).
- `scripton/studio/page.tsx` — `onPromote` solo branch (T6); settings load/save wiring (T7).
- `scripton/settings/page.tsx` — settings state + load (`workspace()`→`settings(pid)`) + `saveSettings`; passes `settings`/`onSaveSettings`/`mode` to `<ScriptonStudio>` (T7).

**Frontend components (top-bar rollout + new bar, 12):**
- **NEW** `components/scripton/topbar/ScriptonTopBar.tsx`, `topbar/useScriptonTopBar.ts`, `topbar/scripton-topbar.logic.ts` (+ `.logic.test.ts`).
- Top bar rolled into: `ScriptOnLibrary.tsx`, `canon/ScriptonCanon.tsx`, `compare/ScriptonCompare.tsx`, `doctor/ScriptonDoctor.tsx`, `home/ScriptonHome.tsx`, `room/ScriptonRoom.tsx`, `versions/ScriptonVersions.tsx`, `write/ScriptonWrite.tsx` (also empty-state + `sample` badge), `studio/ScriptonStudio.tsx` (also T7 settings panel + collab caption).
- `frontend/src/lib/i18n.ts` — AR dictionary entries (rail labels + settings + solo-action strings).
- `frontend/scripts/verify/scripon-verify.mjs` — headless verify harness (new write/slate assertions; `WRITE_DOC` removed in favour of عنترة-now-renders).

> ⚠️ Two distinct files share a similar name: `components/scripton/studio/ScriptonStudio.tsx` (the OS Studio panel — **edited**, T7) vs `components/scripton/ScriptOnStudio.tsx` (exports the shared **SxRail** — **NOT edited**). Don't conflate them.

---

## 4. DATABASE

**Schema: NO changes this session.** `backend/prisma/schema.prisma` was **not modified** (last touched by `fe44281`, prior). **No migration run** (no `prisma migrate`, no `db push`) by this session.

Pre-existing branch context (already applied, NOT mine this session):
- `IntakeProfile.collabMode String @default("AUTO")` + `scriptonDefaults Json?  // { format, revisionColor, exportProtection }` — added in `fe44281` (SP-2 T1), applied via `npx prisma db execute` (`backend/prisma/migrations/manual/2026-06-26-scripton-collab.sql`). Stacks on top of the P0 canon-kernel migration (`2004b77`, "apply canon kernel migration — 5 tables, snake_case @@map").

**Models added/changed this session: NONE.** Explicit status for the models you flagged:
- `CanonFact` — **not changed** (no rows added/removed this session).
- `RevisionPass` — **not changed.**
- `DecisionRecord` — **not changed.**
- `SceneChange` — **not changed.**
- `SceneRelation` — **not changed.**
- `BuildVersion` — **not changed.** عنترة's BuildVersion timeline is still the single **V1** from the prior cleanup; I added no BuildVersions (regeneration creates `ScriptRevision`, not `BuildVersion`).
- `IntakeProfile` — schema unchanged; one **data** round-trip during T9 verification (set `scriptonDefaults.revisionColor` then **restored to original** — net zero).
- `ScriptRevision` — schema unchanged; **data** side effects on عنترة (see below).
- `ScriptScene` — schema unchanged; **data** added (the bridge backfill — see below).

**No new cross-module relations.** Nothing crosses ScripON ↔ breakdown/scheduling/finance/locations/transport. The breakdown solo-edit (T6) calls the **existing** `breakdown.update` endpoint; it adds no relation.

**Data touched — عنترة only** (`scriptDocument.id = cmqqiliff00005avskb2syjbw`, the "ScripON Library" workspace `cmqocmg0g00002jvk3v9666sw`):
- **ScriptScene: +19 rows** on عنترة's active revision (`cmqqvi2ns006j5am0r7y0rpso`) via the bridge **backfill** — Arabic sluglines + intExt/dayNight + page boundaries; **headings only, no body** (bodies are the develop `(The scene continues.)` stubs). This is what makes عنترة render in the Reader instead of the sample.
- **ScriptRevision: one orphan** — `cmquvbb0o000d5avc1vr09aty` ("White Draft (rewrite)", inactive, ~1 scene of real Arabic prose in `pageText`, **0 ScriptScene rows**). It's a leftover from a regeneration that was interrupted by a backend restart; harmless but real. عنترة now has **22 revisions** (was 21). The active revision is unchanged (`cmqqvi2ns…`). A T9-verification test revision was created and **deleted** (restored).
- The user is examining عنترة separately; nothing else touches its data.

---

## 5. API — new/changed endpoints

**No new or changed backend endpoints this session.** All work is internal `ScripOnService` methods or frontend reuse of existing routes:
- Bridge/hardening/T9 are internal to `scripton.service.ts` (no controller change).
- T6 reuses existing endpoints: `approvalsApi.routeChange`, `productionApi.scripton.development.setStatus(versionId,'APPROVED')` (`POST /production/scripton/development/version/:versionId/status`, runs on **versionId**), `productionApi.breakdown.update(id, data)` (`PUT /production/breakdown/:id`, runs on **element id**).
- T7 reuses the settings endpoints added earlier (`99d77bb`): `GET /production/scripton/settings?projectId=…` and the save (`PATCH`) — both keyed by **projectId** (the workspace id).
- Regeneration (used during verification, not added): `POST /production/scripton/development/script/:docId/regenerate` `{mode:'rewrite'|'extend'}` — runs on **docId**; `GET /production/scripton/script-progress/:documentId`.

---

## 6. FRONTEND — new routes/components + api.ts

- **New components:** `components/scripton/topbar/ScriptonTopBar.tsx` (+ `useScriptonTopBar.ts`, `scripton-topbar.logic.ts`).
- **New route param (not a new route):** `/scripton/reader?doc=<id>` opens a specific script in Write.
- **No new routes** under `/scripton/*` were added; no new nav entries.
- **`frontend/src/lib/api.ts`: NOT changed this session.** (The `productionApi.scripton.*` methods used by the top bar / T7 — `versions`, `settings`, `saveSettings`, `workspace`, `renderResult`, `renderPass`, `discardVersion` — were added in earlier commits.)

---

## 7. ENTITLEMENT / PLAN — gating

- **No new feature flag introduced this session.** All ScriptON OS screens (including the top bar, the bridge's rendered output, and the SP-2 surfaces) remain behind the **existing** `scripton.osShell` flag (`osShellFlag.ts`, default `'new'` — the hard-default cutover from `3ed1852`, prior). I did not change that flag.
- Team/solo behaviour is **server-authoritative**, resolved on the workspace payload (`mode: 'team'|'solo'`), read by the frontend via the existing `useScriptonMode()`. Not a flag — a per-workspace setting (`IntakeProfile.collabMode` AUTO|TEAM|SOLO).
- Always-on within the OS shell; no entitlement/billing gate added.

---

## 8. CONFIG — env / deps / scripts

- **No new env vars.**
- **No new npm dependencies.**
- **No new package.json scripts.** (Existing used: backend `test:unit` = `node --require ts-node/register --test "src/**/*.spec.ts"`; build = `nest build`. Headless verify = `node frontend/scripts/verify/scripon-verify.mjs` against a dev server on `:3000`.)

---

## 9. COLLISION CHECK (critical)

Per-file, verified via `git log main..HEAD --oneline -- <file>`:

**AI streaming / idle-timeout / provider-failover files:**
- `backend/src/ai/providers.ts` — **NOT touched by this session.** (Only commit touching it on the branch is `cd5b6f0`, an unrelated backend WIP snapshot.) ✅ no collision from me.
- `backend/src/ai/ai.service.ts` — **NOT touched by this session.** (Only `cd5b6f0`.) ✅ no collision from me.
- `backend/src/production/scripton/scripton.service.ts` — **HEAVILY TOUCHED (the one real collision risk).** My commits here: `1960c86`, `596bb64`, `e46384d`, `cf661b8` (+101/−16 lines). **Exactly what I changed:**
  - **Added** module const `SCENE_STUB = '(The scene continues.)'` (top of file).
  - **Added** `import { parseScenes } from '../script/scene-parse.util'`.
  - **Added** methods: `materialiseScenes(revisionId, projectId)`, `mostlyStub(stubs,total)`, `failStubRun(docId,revId,stubs,total)`, `scriptonDefs()`.
  - **Edited `writeScene(...)`** — replaced the single try/catch+stub with a 3× retry loop (this is the most likely line-level conflict with AI-streaming/idle-timeout work, since that work also lives in/around the AI call here).
  - **Edited `generateScriptAsync(...)`** — now `await`s the per-format generator then calls `materialiseScenes` on DONE.
  - **Edited `generateFeatureAsync(...)` and `extendFeatureAsync(...)`** — added a stub counter + the `mostlyStub`→`failStubRun` guard before the final save/DONE.
  - **Edited `regenerateFeature(...)`** `.then` — materialise scenes before swapping the active revision.
  - **Edited `promoteToScript(...)`, `regenerateFeature(...)`, `promoteBuild(...)`** revision-create calls — set `colorCode: <defs>.revisionColor || null` (and kept `revisionColor: 'WHITE'`).
  - **If the AI track edits `writeScene`/the `ai.run` call site, expect a conflict there.** My edits are otherwise additive/localized.

**ScriptON OS / polish surfaces:**
- `frontend/src/app/(dashboard)/layout.tsx` (OS shell / FilmOS-chrome suppression) — **NOT touched this session.** ✅
- `frontend/src/components/scripton/os-workspaces.ts` (rail's 9 workspaces + routes) — **NOT touched this session.** ✅ (No workspace/route added or reordered.)
- `frontend/src/components/scripton/osShellFlag.ts` (the cutover flag) — **NOT touched this session.** ✅
- `frontend/src/components/scripton/ScriptOnStudio.tsx` (exports shared **SxRail**) — **NOT touched this session.** ✅ (I edited the *different* file `studio/ScriptonStudio.tsx`.)
- ScriptON top-bar component (`components/scripton/topbar/ScriptonTopBar*`) — **CREATED this session** (`87f9545`) and adopted across 9 screens (`5a72fa6`). New files — no overlap unless the polish track also added a top bar (it did not, per branch history). ⚠️ If the polish track separately edits any of the 9 screen components listed in §3, expect overlap there.
- `backend/src/production/scripton/canon/*` (P0 canon kernel — resolve/verify/inject) — **NOT touched this session.** ✅ (Canon files differ from `main` only via older branch commits.)

---

## 10. FLAG / ROUTE / NAV

- **New routes under `/scripton/*`:** none. (`?doc=` is a query param on the existing `/scripton/reader`.)
- **New feature flag:** none. Still behind the existing `scripton.osShell`.
- **Rail (`os-workspaces.ts`):** unchanged — no workspace added/removed/reordered.
- **Top bar:** new shared `ScriptonTopBar` rendered per-screen (the SxRail-sibling pattern) on all 9 OS workspaces; it self-resolves the bound script for its breadcrumb/version-switcher and degrades gracefully. It does not alter routing or the rail.

---

## 11. STATE — build / tests / TODOs

- **Frontend typecheck:** `npx tsc --noEmit` (in `frontend/`) — **clean.**
- **Backend build:** `npm run build` (`nest build`) — **clean** (last run at `cf661b8`).
- **Unit tests:** the specs covering this work pass — `scene-parse.util.spec.ts` (4) + `collab-mode.util.spec.ts` (3) = **7/7 pass** (`node --require ts-node/register --test …`). The **full** `npm run test:unit` (`src/**/*.spec.ts`) was **not run to completion** here (it exceeded a 4-minute window; many specs touch infra) — run it on a warm DB before merge if you gate on it.
- **Runtime verification done** (headless Playwright on `:3000` + DB probes): all 35 `scripton-verify.mjs` scenarios PASS with `COMPARE_PASS` set; Write renders عنترة's 19 real Arabic pages; Doctor/Room show honest empty states; T7 settings persist→reload round-trip confirmed (and restored); T8 AR rail renders 8 Arabic labels (Room hidden in solo, `dir=rtl`); T9 default colour lands in `colorCode` (verified `#ff3b30`, then cleaned up).

**Known TODOs / stubs / open items:**
1. **عنترة full regeneration is NOT done** (owner is examining it). The bridge + hardening are proven (the one completed scene of the interrupted run is real Arabic prose, 0 stubs), but a full 60-scene regenerate saturates the dev backend — run it in a dedicated window. **Orphan revision `cmquvbb0o000d5avc1vr09aty`** (inactive, partial prose, 0 scenes) can be deleted.
2. **Bridge is parity-with-import: headings only, no scene body.** Developed (and imported) scripts render scene structure, not prose pages, until a body-from-pageText step is added (out of scope; would also touch the import path).
3. **Solo "Distribute" (Doctor) is flash-only** (plan-mandated) — no persistence until sides-generation is wired.
4. **RBAC decision pending:** the collab-mode *override* write is gated at `production:2`, not owner-only (v1.1 decision). Tighten to owner/admin only if desired.
5. **Slate tablet/mobile** are legacy `.dvt`/`.dvm` device builds **without** the unified bar (desktop Slate has it) — folded into the later responsive-polish step.
6. **`useScriptonMode()` fan-out:** 4 components each fire `workspace()` on mount (redundant, harmless) — a shared cache hook is a possible follow-up.
7. Two transient dev-env notes (not code): the auth endpoint rate-limits after repeated logins (a polling loop tripped it); and a long in-process generation saturates the single dev backend. Neither affects committed code.
