# ScripON → Script OS — P0 Recon & Reuse Map

_Recon for `SCRIPON-SCRIPT-OS-MASTER-SPEC.md` §10 step 1. Read-only sweep of the codebase (4 parallel agents) to confirm what exists and what is genuinely net-new before proposing the P0 build slice. Date: 2026-06-24._

---

## 0. Headline

The OS shell, the Develop/Brief engine, the Write canvas, the revision/branching UX, the WGA revision metadata, scene-anchored notes, and per-recipient forensic distribution **already exist as substrate**. The genuinely net-new kernel — the **bi-temporal canon graph + extract→inject→verify loop** and the **version/decision kernel** — is still the whole job. The deltas below are a *head start on plumbing*, not "already done."

---

## 1. What exists — reuse map (workspace by workspace)

### Write canvas (the hero) — EXISTS
- `frontend/src/components/scripon/ScripOnReader.tsx` (+ `…Tablet`/`…Mobile`) — screenplay display: scene navigator (left), Doctor dock (right, tabs: Doctor/Breakdown/Notes/Revisions/Production), 6-tile action grid (`diagnose/rewrite/coverage/compare/budgetfit/develop`). Props: `scenes: SxScene[]`, `sceneRead`, `activeTab`, `onAction`, `onRun`. CSS namespace `.sx`.
- Responsive pattern confirmed: shared `deviceCss.ts` (`T_CSS`/`M_CSS`, `.dvt`/`.dvm`, `SEG5`/`TAB5` nav), ~13 feature families each with Tablet+Mobile variants.

### Revision Pass / branching — EXISTS (non-destructive already)
- `ScripOnRevisions.tsx` — revision timeline + side-by-side line diff (`.add`/`.del`). Types `SxRev`/`SxLine`/`SxCompare`. Actions: restore/exportpages/new.
- `ScripOnRewriteSlate.tsx` — 6 transform kinds (tighten/punchup/genre/ending/humour/intensity), 3 variants each, change types `REWRITE|CUT|ADD|MERGE|RETONE|RECONNECT`. **Apply branches a new inactive revision** (non-destructive already).
- `ScripOnBudgetFit.tsx` — cost-aware rewrite strategies (`CONSOLIDATE|CUT|MERGE|CONVERT|RECAST|VFX`); also a light-theme `production/BudgetFitPanel.tsx`.
- `endingTypes.ts` — the 14-type ending taxonomy the spec references, already shared between intake and the rewrite slate (bilingual EN/AR).

### Develop / Builder / Brief — EXISTS (rich, data-driven, pure)
- `backend/prisma` `IntakeProfile` — typed intake (mode, source, reality, format, language, country, budget) + promoted lever columns (scriptVariety, dialogueRegister, accents, styleMix, conflict, politicalArc).
- `intake-levers.util.ts` — `LEVER_KEYS`, `resolveLever(s)`, `pickLevers` (typed-column-first, JSON-brief fallback).
- `scripton.service.ts` — P0–P7 engine; `intakeSteer`, `stageLadderFor`, `coverage/transform/budgetFit/formatConvert/develop/adapt`.
- Knowledge layers (pure, fail-safe functions of the brief), under `…/scripton/knowledge/`:
  - `formats.ts` — Feature/Short/Series(10 markets)/Vertical(2)/Documentary ladders; `stageLadderFor`, `pickPreset`, `normalizeFamily/Market`.
  - `vertical.ts` (Beat/Reversal/Paywall/9:16, MENA templates+engines), `documentary.ts` (Nichols modes), `eras.ts` (26 country/era substrates), `accents.ts` (10), `genres.ts` (15 genres + blends/tones/moods/treatments), `conflicts.ts` (sensitivity), `styles.ts` (14 packs), `index.ts` → `knowledgeDirective()`.
  - `lore-seed.data.ts` — ~91 lore rows (~26 cultures); auto-seeds `LoreElement`.
- **9 knowledge layers** = format/vertical/documentary/era/accent/conflict/style/genre/real-person directives, composed by `knowledgeDirective(brief)`.

### OS shell — PARTLY EXISTS
- `frontend/src/app/(dashboard)/layout.tsx` — left sidebar (60↔220px, 7 groups), top breadcrumb bar, sub-tabs, **working ⌘K palette already wired in** (lines ~319–327 listener, ~663–689 render: recent + pinned + all pages/actions).
- `components/workspace/GroupedRail.tsx` (`RailGroup/RailModule/RailPage`) and `components/workspace/CommandPalette.tsx` (`CmdItem`) — additive Phase-1/3 components, demoed at `/nav-preview` and `/command-palette`, **not yet merged** into the main layout.
- Cinematic tokens: `app/globals.css` (SYS-14 semantic tokens `--surface-*/--text-*/--border-*/--accent/--gold`, gold-only accent, 7 themes) + `app/scripton-ds.css` (`.son`/`.son-dark` scoped). `components/CinematicHeader.tsx` (`CinematicHeader`, `CinematicChips`).

### Doctor — EXISTS (service-layer pattern, not a DB entity)
- `scripton.service.ts` + `scripton.controller.ts`: `coverage`, `diagnostics` (objective/obstacle/subtext/power-shift/verdict/fix), `transform` + `applyTransform` (non-destructive branch), `marketForecast`, `greenlightDecision`. Numbers computed from the scene model; AI writes prose around facts.

### Protected export / distribution — EXISTS (genuinely close to done)
- `protected-export.service.ts` + `review-protection.service.ts/controller.ts`.
- Models: `ReviewProtectionSettings`, `ReviewProtectionProfile`, `NoticeTemplate`, **`ProtectedExportRecord`** (unique recipient-traceable `copyId`, checksum, channel, status, audit).
- Pipeline: server-issued copy-id → mandatory notice cover → per-page watermark + trace footer → Chromium render → metadata sanitisation → checksum → hardening. Hard rule: required-but-failed protection throws (no unprotected fallback).

### Schema-change flow — EXISTS (must be honoured)
- `FOUNDATIONS.md` + `backend/scripts/db-reconcile.sh`: schema is ~260 models / ~8.9k lines grown mostly via `db push` → real drift. Reconcile = dry-run baseline → review SQL → `--apply` (records baseline, runs no DDL) on a **backup/staging** DB. After that: always `prisma migrate dev --name <change>`, never bare `db push`. Recommended order: tests → migrations/drift → multi-tenancy (last).

---

## 2. Existing Prisma models to REUSE (confirmed present)

`DevelopmentBuild`, `BuildVersion`, `ScriptRevision` (WGA colors WHITE→TAN, `isLocked`/`lockedAt`, `supersedesId`, `revisionRound`, `changeSummary`), `RoleProfile` (type-only, no names/photos by design), `CoverageNote` (scene-anchored to durable scene id), `ScriptAnalytics` (`representation`/`charge`/`arc`/`structure` JSON), `DialectExemplar`, `LoreElement`, `ApprovalStep`, the protection models above.

## 3. Genuinely NET-NEW (confirmed absent)

`CanonFact`, `SceneRelation`, `StoryEntity`, `RelationshipEdge`, `TimelineEvent`, `WorldBibleEntry`, `DecisionRecord`, `Draft`/`Branch` (CRDT ref), `RevisionPass`, `SceneChange` (content — note: `SceneChangeRequest` exists but is venue/logistics, not script content), generic `Note`/`Comment` entities, `Distribution`/`ShareGrant` graph, `ConflictFlag`, `EmotionBeat`.

---

## 4. Deltas — foundation vs. done (read carefully)

Presence of a model/field ≠ delivering the spec's intent. Each "already there" item below is **substrate**, not a finished pillar:

| Spec item | What exists | What's still missing (the actual P0/Px work) |
|---|---|---|
| ⌘K palette (pillar 6) | Palette wired; filters pages/actions, recent+pinned | Jump to **scene/character/decision** (those story objects don't exist as canon yet) → palette is a *shell*, not the spec's palette |
| WGA revision layer (§4.2) | `ScriptRevision` colors/lock/supersedes | Branch/merge, **semantic diff**, A-pages/OMIT/STET — none exist; today's revisions are linear metadata |
| Room notes (pillar 4) | `CoverageNote` (scene-anchored), `ApprovalStep` | Threaded notes + approvals + distribution + **presence** as live data |
| Distribution (pillar 4) | `ProtectedExportRecord` per-recipient + watermark + audit — **genuinely close** | The "live data, never PDF" distribution **graph** (share grants, NDA version) |
| Canon/memory (pillar 1) | per-script bibles (`characterBible` JSON), lore atlas | The whole bi-temporal **graph + verify loop** — net-new |
| Version kernel (pillar 2) | `BuildVersion` (linear, immutable snapshots) | Branch/diff/decision; CRDT substrate (load-bearing risk) |

**Net:** P0 gets a head start on data plumbing and UI shell. The net-new kernel (canon graph + verify loop + version/decision store) is still the whole job.

---

## 5. The CRDT decision (flagged, not decided)

P0-as-specced bundles **two** hard new subsystems: the bi-temporal canon graph **and** a CRDT/Automerge version substrate. Dropping a CRDT into a Prisma/Postgres app is the **least-reversible** architecture choice in the roadmap. The spec's own proof path — *stage a `NOTE` SceneChange → Render → new version* — can ride the **existing `BuildVersion`** model and needs no CRDT to demonstrate the loop.

**Recommended thin P0:** prove `canon graph` + `extract→inject→verify` + `NOTE→Render` on existing version primitives; defer the CRDT branch/merge substrate to a later, explicit decision. Tightest-constraint-first, fully reversible.

---

## 6. Recommended P0 build slice (for approval)

1. **Canon kernel (data + extract):** add `CanonFact` (bi-temporal: `validFrom/validTo/recordedAt/supersedesId/status`) + `SceneRelation`; a pure `extract facts from scene` function (TDD'd). Land schema via the drift-reconcile flow on staging — one migration.
2. **Verify step:** wire `extract → relevance-weighted inject (reuse `knowledgeDirective` inject) → verify output against canon` into one generation path. This is the loop the spec says makes the AI *respect* canon, not just be handed it.
3. **Version/decision store (no CRDT):** add `DecisionRecord` (ADR shape) + `RevisionPass`/`SceneChange` (content) on top of existing `BuildVersion`. Render = commit: writes canon + a decision record + a new `BuildVersion`.
4. **Shell wrap:** merge `GroupedRail` into the real layout as the workspace rail (`Home·Develop·Write·Canon·Doctor·Versions·Room·Slate·Studio`); extend the existing ⌘K palette to address canon objects once they exist.
5. **Proof:** stage a `NOTE` `SceneChange` on `ScripOnReader` → **Render** → new `BuildVersion`, continuity-checked against canon. The simplest end-to-end path through the kernel.

**Guardrails honoured:** reuse-first; non-destructive (Render creates a new version, base immutable); schema via drift-reconcile + staging, one migration; multi-tenancy stays separate; TDD the pure logic (extract/verify/scene-graph/change-ordering).

---

## 7. Open forks for the user

1. **P0 scope:** literal spec P0 (canon graph **+ CRDT** version substrate) vs. recommended **thin P0** (canon graph + verify + NOTE→Render on existing `BuildVersion`, CRDT deferred).
2. **Order:** spec §10 is Figma-first (recon + Figma + plan, then stop). Given the scope is actively shifting from these deltas, recommend **plan-approval first, then Figma**, to avoid drawing frames for a scope that may change.
