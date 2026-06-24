# ScripON v4 — Screenplay OS

### Architecture · Capability Map · Phased Build Plan

_Deep-think planning doc, 2026-06-24. Turns the v4 brief (Screenplay Management + Story Engineering + Script Intelligence) into a buildable plan grounded in the current code. **Design authority: Figma, in the Cinematic V.4 language** (`CinematicHeader.tsx` + `globals.css` tokens). **Build authority: Claude Code + Superpowers** (branch · TDD · approval gates)._

---

## 0. Thesis & principles

ScripON already contains ~70% of what the brief asks for — it is mostly **scattered across standalone screens** (`/scripon/reader`, `/doctor`, `/breakdown`, `/schedule`, `/greenlight`, `/revisions`, `/package`). v4 is therefore primarily an act of **re-organization + a thin intelligence spine**, not a green-field rebuild.

Five principles:

1. **Reuse before build.** Every existing engine/component is relocated, not re-written. New code is only the connective intelligence (canon, scene graph, sync) and the genuinely-missing engines.
2. **The Library is the front door; the Script Detail is the OS.** Opening a script enters a full workspace, not a viewer.
3. **Canon is the spine.** A single append-only canon ledger is the source of truth that every tool reads and approved revisions write. This is what makes "story management" real.
4. **Additive & non-destructive.** Nothing breaks existing flows; revisions branch, never overwrite; schema changes go through the migration-reconcile discipline on a backup DB.
5. **Design-first, in Cinematic V.4.** Each phase is designed in Figma before it is built; desktop / tablet / mobile parity follows the existing `*Mobile/*Tablet` variant pattern.

---

## 1. Information architecture

### 1.1 Left navigation (system-level only)
Permanent, per the brief — script-specific tools leave the global nav and live inside the script:

`Home · Library · Studio · Greenlight · Settings · Language Switcher`

Studio keeps its sub-tools standalone (**Build · Brief · Develop**). `Reader / Doctor / Breakdown / Schedule / Revisions / Notes / Package` are **removed from the global nav** and become **sections inside Script Detail** (they keep working as routes during migration, then redirect).

### 1.2 The Library as the central workspace
One permanent home for **every** screenplay regardless of origin (Build-generated · promoted project · imported FDX/Fountain/PDF/Word · adapted/translated). The Library row resolves to a **ScriptWorkspace** aggregate that preserves: original · working version · revision history · Development Package · coverage · Character Bible · World Bible · analytics · version comparisons.

**Import parity** (new): when a script is imported, ScripON auto-runs the *existing* generators it already has (coverage, analytics, Character Bible) **plus** the new bibles (World Bible, Timeline, Script-intelligence profile) so imported scripts reach the same depth as generated ones.

### 1.3 Script Detail OS — the sections
A single shell (`ScriptDetail`) hosting the existing components as tabs/sections:

| Section | Powered by (reuse) | New work |
|---|---|---|
| **Overview** | `ScripOnPackagePanel` + analytics | compose metadata · format · versions · dev-status header |
| **Script Reader** | `ScripOnReader` ✅ | scene / character / location nav rails |
| **Scene Workspace** | Reader diagnostics (partial) | **Scene Revision + Regenerate engines (new)** |
| **Story Bible** | Character Bible ✅ | **World · Lore · Timeline · Relationship maps (new)** |
| **Coverage & Doctor** | `ScripOnDoctor` ✅ | relocate only |
| **Breakdown** | `ScripOnBreakdown` ✅ | relocate only |
| **Schedule & Budget** | `ScripOnSchedule` + `ScripOnBudgetFit` ✅ | relocate only |
| **Language Studio** | dialect engine + P6 adapt ✅ | **Language Adaptation Studio (new)** |
| **Versions** | `ScripOnRevisions` ✅ | add branches + canon-aware rollback |

---

## 2. Capability map — reuse / relocate / build

The brief's "Story Engineering Tools" are **already shipped** as the Doctor P0–P7 engine; v4 surfaces them *contextually inside Script Detail* instead of building anew.

| Brief capability | Verdict | Where it already lives |
|---|---|---|
| Budget / Location Fit | ♻️ Relocate | `ScripOnBudgetFit` → `scripton.budgetFit/applyBudgetFit` |
| Cost Optimization Scan | ♻️ Relocate | Greenlight "Cost" (P5) |
| Audience Fit Pass | ♻️ Relocate | `ScripOnGreenlight` Audience (P7) |
| Genre Transpose · Humour · Ending re-engineer · Emotion re-key | ♻️ Relocate | `ScripOnRewriteSlate` (P2) + `endingTypes.ts` |
| Format Conversion (feature↔series↔vertical↔short) | ♻️ Relocate | P4 format engine |
| Country / Market Transposition | ♻️ Relocate (extend) | P4 + market presets + dialect engine |
| Coverage · Diagnostics · Notes | ♻️ Relocate | `ScripOnDoctor`, `ScripOnNotes`, `CoverageNote` |
| Character Bible · Analytics · Revisions · Package | ♻️ Relocate | existing models/components |
| Add / Remove Character (redistribute function) | 🔨 Build (small) | new transform on the P-engine |
| Emotion graph (before/after viz) | 🔨 Build (small) | new viz over `ScriptAnalytics.charge` |
| **Scene Revision Engine** (surgical, continuity-safe) | 🔨 **Build** | — |
| **Scene Regenerate Engine** (single-scene, impact analysis) | 🔨 **Build** | — |
| **World / Lore / Timeline / Relationship bibles** | 🔨 **Build** | lore seed exists; per-script bibles new |
| **Story Bible Synchronization** (canon auto-update) | 🔨 **Build** | — |
| **Conflict Detector** (contradictions) | 🔨 **Build** | — |
| **Emotional Journey Tracker** (per-character arc) | 🔨 **Build** | — |
| **Language Adaptation Studio** (screenplay adaptation) | 🔨 **Build** | on dialect + P6 |
| **Canon Memory + Integrity Protection** (cross-cutting) | 🔨 **Build (foundational)** | — |
| Import parity (auto-bibles on import) | 🔨 Build (wiring) | reuses existing generators |

**Net-new engines: 7 (+ canon spine).** Everything else is composition.

---

## 3. The intelligence spine (new, foundational)

### 3.1 Canon Memory
An append-only **canon ledger** per script. Approved revisions/regenerations write canon facts; every downstream tool (rewrites, summaries, bibles, pitch, sequels, adaptations, translations) **reads canon, not raw text**, so continuity holds across the lifecycle.

```
CanonFact { id, scriptId, kind(CHARACTER|WORLD|LORE|TIMELINE|RELATIONSHIP|PLOT),
            subject, statement, sourceSceneId, supersedesId?, status(ACTIVE|RETIRED),
            createdByRevisionId?, createdAt }
```
Canon is **derived + curated**: generated on first analysis, then updated only by *approved* scene changes (never silently).

### 3.2 Scene dependency graph
Powers "related scene detection" and the Conflict Detector.

```
SceneRelation { id, scriptId, fromSceneId, toSceneId,
                type(REFERENCE|SETUP_PAYOFF|RELATIONSHIP|LOCATION|LORE|DIALOGUE_CALLBACK|CAUSE_EFFECT),
                strength, note }
```
Built once per revision by an analysis pass; cached; recomputed on approved change.

### 3.3 Integrity Protection layer
A pre-apply check run by both new engines. Reads canon + the scene graph and validates: character arcs · timeline · location continuity · cause/effect · dialogue consistency · tone/genre · setup/payoff. Emits `{ ok, warnings[], suggestedFixes[] }`. Never blocks; always explains.

---

## 4. New engine specs

### 4.1 Scene Revision Engine (Tool #1) — *targeted, continuity-safe edits*
Available in Builds (post-generation), Library, and Project Script pages.

- **Search & locate:** scene № · character · location · keyword · dialogue · event · emotional beat · plot point. Shows target + previous + next + related context.
- **Related-scene detection:** queries the scene graph before editing; user picks *apply-only / auto-update related / review manually / ignore*.
- **Revision modes:** replace exactly · enhance-instruction · cinematic rewrite · stronger emotion · stronger action · same-voice · continuity-safe · dialogue-only · description-only · emotion-only · notes-only.
- **Integrity → Before/After:** runs §3.3, shows original vs revised + diff highlights + change explanations; actions approve / reject / edit / save-as-alternate.
- **Version history & canon:** records what/who/when/why + related scenes affected + AI recs accepted/rejected; revert change/scene, restore version, return to original draft. **Approved → canon.**

```
SceneRevision { id, scriptId, sceneId, mode, instruction?, beforeText, afterText,
                rationale, relatedAffected(Json), integrity(Json), status(PROPOSED|APPROVED|REJECTED|ALTERNATE),
                authorId, aiRunId?, createdAt }
```

### 4.2 Scene Regenerate Engine (Tool #2) — *safe single-scene regeneration*
Separate from revision. Never regenerates the whole script.

- **Smart regenerate** off full script + arcs + tone + timeline + canon.
- **Three directions:** emotional · action · cinematic (choose / combine / request more).
- **Hint mode:** e.g. *"Make Antara fight the Amalekite leader before earning his respect"* — regenerate preserving continuity.
- **Impact analysis** before save: story logic · emotional arc · character arc · timeline · dialogue refs · future scenes · endings → what changed · scenes affected · continuity risks · suggested fixes.
- **Apply options:** replace scene · replace + update related · manual review · save alternate · keep original · reject.

### 4.3 Story Bible + Synchronization
Per-script bibles: **Character** (exists) · **World** · **Lore** (from the lore atlas) · **Timeline** · **Relationship map**. On an approved scene change, a **sync pass** updates the affected bible entries from canon (e.g. *Amalekites become allies → World Bible + Timeline + relationship graph update; future analysis uses the new canon*). Sync is canon-driven and previewed before commit.

### 4.4 Conflict Detector
Scans canon + scenes for contradictions (e.g. *S12 Antara fears heights / S65 climbs a cliff casually*). Emits `ConflictFlag { sceneA, sceneB, type, explanation, suggestedFix, status }`, surfaced in Scene Workspace and Coverage.

### 4.5 Emotional Journey Tracker
Per-character emotion beats (`EmotionBeat { sceneId, character, emotion, valence, intensity }`) → a scene-by-scene arc (Fear → Hope → Anger → Triumph → Loss). Revisions that create emotional discontinuity raise a warning + show the graph + suggest corrections. Feeds the "Emotion re-key" before/after viz.

### 4.6 Language Adaptation Studio (Tool #3) — *adaptation, not translation*
Built on the dialect engine + P6 adaptation, but standalone. Preserves canon · approved revisions · character voices · lore · world · continuity while producing English / Arabic / French / Spanish / festival / Hollywood-dev / subtitle / dubbing versions. Modes: literal-reference · creative adaptation · international English · festival · dubbing · subtitle · producer · Hollywood tone · preserve-cultural-flavor · simplify-global. **Comparison view:** original · literal · creative · adaptation notes (cultural adjustments · dialogue changes · emotional-preservation choices).

```
Adaptation { id, sourceScriptId, language, mode, status, docId, notes(Json), canonSnapshotId, createdAt }
```

---

## 5. Data model additions (sketch)

New Prisma models (additive; reuse `DevelopmentBuild`/`BuildVersion`/`ScriptRevision`/`RoleProfile`/`CoverageNote`/`ScriptAnalytics`/`LoreElement`):

`ScriptWorkspace` (aggregate root linking original/working/versions/package/coverage/bibles/analytics) · `CanonFact` · `SceneRelation` · `SceneRevision` · `WorldBibleEntry` · `TimelineEvent` · `RelationshipEdge` · `ConflictFlag` · `EmotionBeat` · `Adaptation`.

> **Migration discipline:** these land behind the test net, on a **backup/staging DB**, via the reconcile flow in `FOUNDATIONS.md` (`scripts/db-reconcile.sh`) — never bare `db push`, never prod. Multi-tenancy is *not* entangled here (still the separate release blocker).

---

## 6. Design authority — Figma, Cinematic V.4

- **Source of truth = Figma.** No features hidden in three-dot menus; the Script Detail experience is redesigned around these capabilities.
- **Cinematic V.4 language:** reuse the existing tokens (`globals.css`: `--gold/--gold2/--cream/--panel/--hair/--blue/--green/--red…`) and the `CinematicHeader` system; extend, don't replace. _(Note: I found the Cinematic design language in code but no file explicitly tagged "V.4" — point me to the V.4 Figma page/frame if it's a specific iteration and I'll anchor exactly to it.)_
- **Responsive:** desktop = planning · tablet = review · mobile = on-set quick actions, following the existing `*Tablet/*Mobile` component pattern.
- **Bilingual:** every new surface ships EN + AR (RTL), per `docs/system/22-i18n-coverage.md`.
- **Flow:** each phase is designed in Figma → reviewed → then built. (Claude Code carries the Figma plugin + design skills for design↔code.)

---

## 7. Phased roadmap (risk-ascending · design-first · reuse-first)

| Phase | Goal | Risk |
|---|---|---|
| **P0 · Foundations & IA** | Figma: Script Detail OS shell in Cinematic V.4. Code: the `ScriptDetail` shell hosting existing components as sections; left-nav restructure; **import-parity wiring** (run existing coverage/analytics/bible on imports); the **Canon + SceneRelation** data models (additive, backup-DB migration). | Med (schema) |
| **P1 · Reuse / Relocate** | Move Reader, Doctor, Breakdown, Schedule&Budget, Revisions, Notes, Package, Greenlight (cost/audience), BudgetFit, RewriteSlate into Script Detail sections. Old routes redirect. | Low |
| **P2 · Scene Engines** | Scene Revision + Scene Regenerate + Integrity layer + scene-graph detection + before/after + **canon write**. The flagship new value. | Med–High |
| **P3 · Intelligence** | Story Bible (World/Lore/Timeline/Relationships) + Sync + Conflict Detector + Emotional Journey Tracker — all canon-driven. | Med |
| **P4 · Language Adaptation Studio** | Multi-language screenplay adaptation + comparison view, canon-preserving. | Med |
| **P5 · Polish** | Pixel-pass vs Figma; tablet/mobile parity; Arabic/RTL; discoverability; perf. | Low |

Every phase runs the Superpowers loop: **brainstorm → plan → approve → TDD → review → commit**, design locked in Figma first.

---

## 8. Guardrails

- **Don't break the running app** — additive composition; existing routes redirect, not deleted, until parity is proven.
- **Canon is append-only**; sync and revisions write through approval, never silently.
- **Schema work is gated** behind the drift-reconcile + a backup DB; one migration per change.
- **Multi-tenancy stays separate** (the release blocker) — don't couple v4 to it.
- **Respect intentional safety designs** (no-faces look-board · no living-religion deities · representation-as-speaking-count is a deliberate deferral).
- **Reuse audit before each build step** — if a capability exists, relocate it; only build the connective tissue and the 7 new engines.

---

_Companions: `docs/SCRIPON-BUILD-MASTER-FEATURES-AND-ROADMAP.md` (current-state reference) · `docs/scripon-country-era-reality-check.md` · `ScripON-Doctor-MASTER-STATUS.html` (status authority) · this plan drives `SUPERPOWERS-SCREENPLAY-OS-KICKOFF.md`._
