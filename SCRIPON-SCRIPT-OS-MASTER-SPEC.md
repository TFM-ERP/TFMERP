# ScripON → Script OS — Master Build Spec

### The single source of truth for elevating ScripON into a true Script Operating System
_Consolidates: the user's requirements, the existing system's capabilities, and a two-wave deep-research study (9 streams, ~200 cited findings). Supersedes the earlier `SUPERPOWERS-SCREENPLAY-OS-KICKOFF.md` and the v4 plan for the OS direction. For Claude Code + Superpowers (build) and Figma (design authority, Cinematic V.4)._
_Date: 2026-06-24._

> ## ⬗ DESIGN AUTHORITY — work in the EXISTING Figma file; do not create a new one
> The production design lives here: **https://www.figma.com/design/dqUr3nasAkQIdefXcGDSyi** — "ScripON · Script OS — UX·UI".
> It already contains **six finished, on-brand screens in Cinematic V.4**, all sharing one OS shell (top ⌘K command bar + live continuity ring + the workspace rail: `Home · Develop · Write · Canon · Doctor · Versions · Room · Slate · Studio`):
> 1. **Home / Slate** — greeting, Continue-where-you-left-off hero, slate of project cards, live activity feed.
> 2. **Write** — the Revision-Pass canvas: Story Spine + paper + pinned composer + the Revision Pass panel (Render → V3).
> 3. **Canon** — the living relationship graph + bi-temporal canon-facts panel + enemy→ally timeline.
> 4. **Versions** — git-for-story branch tree (V1/V2/V3 + alt branch) + semantic diff + creative decision log.
> 5. **Room** — scene-anchored note threads + approval chain + per-recipient watermarked distribution.
> 6. **⌘K command palette** — jump to any scene/character/decision or run any tool on the current scene.
>
> **When you reach the design step: OPEN AND EXTEND THIS FILE** — refine these frames and add the missing workspaces (Doctor, Studio) to match this language. Do **not** start a fresh design. Treat these screens + this spec as the visual target, and reuse `globals.css` tokens + `CinematicHeader`.
> The designer (Cowork) will **reconcile the Figma against your plan/recon afterward**, so surface any real component names, data shapes, or constraints that should change the design rather than silently diverging.

---

## 0. How to use this document

This is the brief. Read it fully, then **build phase by phase**, **design each phase in Figma first** (Cinematic V.4), and **stop for approval before coding each phase**. Companions in the repo:
- `docs/SCRIPON-SCRIPT-OS-BLUEPRINT.md` — the evidence + reasoning behind every decision here.
- `docs/SCRIPON-BUILD-MASTER-FEATURES-AND-ROADMAP.md` — the *current* system inventory (what already exists).
- Design references: Figma `https://www.figma.com/design/dqUr3nasAkQIdefXcGDSyi` and `design-tmp/scripon-v4-revision-pass.html` (the Write canvas), `design-tmp/scripon-v4-workspace.html`.

---

## 1. The thesis — what makes it a "Script OS" (from research)

Every existing screenwriting tool is a **patch over one fault line**: the screenplay is collaborative, iterative and long-lived, but it's tooled as a *static, single-author artifact* (a PDF / `.fdx` emailed around). A true Script OS changes the substance: **stop being a document editor; become the system of record for the story.** An OS has three things a document never has:

1. **Memory** — it persistently knows the whole world (canon), not just the open file.
2. **Version control** — it preserves every state and every decision, non-destructively.
3. **A platform** — writing, analysis, collaboration, production, localization all run *on top of* that memory and history instead of each keeping a private copy.

> **One line:** the Script OS *remembers the story, records its evolution, and runs every workflow against one source of truth.*

---

## 2. What already exists — PRESERVE & ELEVATE (do not rebuild)

ScripON is already ahead of the market on intelligence and security. **None of this is dropped — it is wrapped and elevated.**

- **The Builder + the Brief (CRITICAL — preserved as the `Develop` workspace).** Every tool, lever and option to build a script stays: the format-aware develop ladders (Feature / Series / Vertical / Documentary), the full Brief/intake with all levers (genres, blends, tones, moods, treatments, **26 country/era language substrates**, **22 Arabic dialects**, **10 accents**, the **lore atlas ~130 elements**, **14 style packs**, **14 story frameworks**, budget/rating/market), and the **9 knowledge layers** (`knowledgeDirective` composer + `stageLadderFor`). Building a script and engineering/revising it are two workspaces of the same OS.
- **The Doctor (P0–P7)** — coverage, scene diagnostics, transforms (tighten/punch-up/genre-transpose/ending/humour/emotion), culture/rating, format conversion, market & greenlight. Strong; becomes the always-on intelligence layer running on canon.
- **Protected export / watermarking** — per-recipient forensic watermark + permission flags + audit + metadata sanitisation. A genuine studio-grade moat; lean into it.
- **Run-level versions** (`DevelopmentBuild` / `BuildVersion` / `buildVersionId`), `ScripOnRevisions`, the dialect-fidelity engine, the Lore atlas, and the responsive `*Tablet/*Mobile` component pattern.

---

## 3. The seven pillars + the five OS-defining features

**Seven pillars** (a Script OS needs all; current ScripON status in brackets):
1. **Canon & Memory** [per-script bibles only → must become a memory graph].
2. **Version control & draft preservation** [run-level only → needs branch/diff/decision].
3. **Story intelligence & continuity** [STRONG — Doctor P0–P7].
4. **Workflow, collaboration & notes** [ABSENT — the biggest industry gap].
5. **Interop — FDX/Fountain round-trip** [import yes; FDX *export* unconfirmed — the credibility floor].
6. **Experience, discoverability & focus** [needs an OS shell + ⌘K command palette].
7. **Studio/enterprise readiness** [security strong; needs SSO/audit/slate].

**The five features that most earn the name (prioritise these):**
1. **Living Canon** — a bi-temporal memory graph the AI is *checked against*, not just handed. **The flagship.**
2. **True version control for story** — branch/merge, semantic diff, non-destructive drafts, **+ creative Decision Records**.
3. **The Room** — notes/approvals/distribution as live structured data (kills the PDF/email "version chaos").
4. **FDX/Fountain round-trip interop** — without it, "OS" fails at the production door.
5. **OS shell + ⌘K command palette** — the discoverability that lets *all* features be present without burying them (no screenwriting tool ships one).

---

## 4. The kernel — build this FIRST (foundational architecture)

Research is unanimous: **model the memory + version kernel first.** Retrofitting it is the expensive path; building it first makes every later feature cheaper and more powerful.

### 4.1 Canon & Memory (two stores, one loop)
Passive story bibles fail — the model drifts and bigger context windows don't fix it ("lost in the middle"). The architecture:
- **A structured canon graph** — entities, relationships and **state over time** (**bi-temporal**: when it's true in the story *and* when it was recorded), so canon can legitimately change (a character dies, an alliance breaks) without losing history. (Graphiti/Zep temporal-KG pattern; the digital Holocron.)
- **A semantic index over the prose** — embeddings + RAPTOR-style scene→chapter→arc summaries so the system can recall any part of a feature-length script. Hybrid graph+vector (pure-vector loses relations; pure-graph has cold-start cost).
- **The loop:** every generation runs **extract facts → relevance-weighted inject → verify output against canon**. ScripON already does the *inject* step (`knowledgeDirective`); the OS upgrade is the **persistent graph** + the **verify** step. This is what makes the AI *respect* canon, not merely be handed it.

### 4.2 Version & Decision kernel
- **Drafts are branches** on a CRDT substrate (Automerge-style): keystroke-level history, branch/merge/diff "for free", offline-safe collab.
- **Semantic, multi-resolution diff** — sentence-embedding diff (meaning-change vs rephrase), with an in-document view + a summary view. **Semantic conflicts** (one draft renames a term, another uses the old one) are *not* machine-resolvable — keep a human in the loop.
- **Industry layer on top:** WGA revision colors (White → Blue → Pink → Yellow → Green → Goldenrod → Buff → Salmon → Cherry → … doubles), right-margin asterisks, page/scene **locking**, A-pages, OMIT/STET.
- **Decision Records (the missing pillar):** import the ADR pattern (Context / Decision / Consequences / Status, append-only, superseding) to log **creative** decisions ("killed X in act 2 because…") with rejected alternatives. Canon stores *what is true*; the decision log stores *why it was chosen*.

### 4.3 The Revision Pass sits on the kernel
The loved **Revision Pass** (stage many non-destructive scene changes → "Render new draft" → new version, continuity-checked) is the **staging area** of this version-control system (git's index); **Render = a commit** that writes canon + a decision record and produces a new branch state (V3). The design doesn't change; its foundations get deeper.

---

## 5. Information architecture — the OS shell (holds ALL features)

The goal: *all* the power present, none of it buried. Three layers (see the Figma file):

1. **Kernel (always on):** Canon + History + Decisions — the single source of truth every workspace reads. Users feel it as *the script always knows itself* (the live continuity meter in the top bar).
2. **Shell (navigation + discoverability):**
   - **⌘K command palette** — type to run any action, jump to any scene/character/decision, invoke any tool. *The* discoverability answer; no rival ships one.
   - **Left workspace rail** (modes of working on one story, not tabs hiding tools):
     `Home · Develop · Write · Canon · Doctor · Versions · Room · Slate · Studio`
     - **Develop** = the Builder + Brief + Format (everything from §2, preserved).
     - **Write** = the Revision-Pass canvas (the hero).
     - **Canon** = the living memory graph (characters/world/lore/timeline/relationships).
     - **Doctor** = coverage/diagnostics/continuity/transforms.
     - **Versions** = branch tree + semantic diff + decision log + WGA revisions.
     - **Room** = collaboration: notes/approvals/distribution/presence.
     - **Slate** = portfolio across scripts & franchise.
     - **Studio** = settings, security, export/interop.
   - Top bar: project, **live continuity ring**, version, collaborators, share.
3. **Canvas (focus):** the script. The Write workspace = paper + **Story Spine** (acts + emotional charge + staged-change flags + you-are-here) + the **pinned composer** (tools compose in-context) + the **Revision Pass** panel. Every other workspace composes panels onto/beside the script; nothing replaces it as the centre.

Discoverability via the palette; focus via the canvas; power via the workspaces.

---

## 6. Data model (additive Prisma — reuse existing models)

Reuse `DevelopmentBuild` / `BuildVersion` / `ScriptRevision` / `RoleProfile` / `CoverageNote` / `ScriptAnalytics` / `DialectExemplar` / `LoreElement`. Add:

- **Memory:** `CanonFact { scriptId, kind(CHARACTER|WORLD|LORE|TIMELINE|RELATIONSHIP|PLOT), subject, statement, sourceSceneId, validFrom, validTo, recordedAt, supersedesId?, status }` · `SceneRelation { fromSceneId, toSceneId, type(REFERENCE|SETUP_PAYOFF|RELATIONSHIP|LOCATION|LORE|CALLBACK|CAUSE_EFFECT), strength }` · `StoryEntity`/`RelationshipEdge`/`TimelineEvent`/`WorldBibleEntry`.
- **Version/Decision:** `Draft`/`Branch` (CRDT doc ref) · `DecisionRecord { scriptId, title, status(PROPOSED|ACCEPTED|SUPERSEDED), context, decision, consequences, supersedesId?, createdBy, createdAt }`.
- **Revision Pass:** `RevisionPass { scriptId, baseVersionId, status(OPEN|RENDERING|RENDERED|DISCARDED), continuityScore, renderedVersionId? }` · `SceneChange { passId, sceneId, kind(REVISE|RE_ENDING|REGENERATE|BUDGET_FIT|EMOTION|CANON|NOTE), spec(Json), previewBefore?, previewAfter?, status, relatedAffected(Json), integrity(Json) }`.
- **Room:** `Note`/`Comment` (scene-anchored, threaded), `ApprovalStep`, `Distribution`/`ShareGrant` (per-recipient, watermark-linked, NDA version), all as live data — never PDFs.
- **Continuity:** `ConflictFlag`, `EmotionBeat`.

> **Schema discipline:** all of this lands via the drift-reconcile flow (`FOUNDATIONS.md` + `scripts/db-reconcile.sh`) on a **backup/staging DB** — never bare `db push`, never prod, one migration per change. Multi-tenancy stays a separate effort.

---

## 7. Reuse map — relocate vs build

- **Reuse/relocate (exists):** the Builder/Brief/Format → Develop; `ScripOnReader` → the Write paper; `ScripOnRewriteSlate` + `endingTypes` + `ScripOnBudgetFit` → the composer's change kinds; `ScripOnDoctor` → Doctor; `ScripOnRevisions` + `BuildVersion` → Versions; `ScripOnGreenlight`/`ScripOnBreakdown`/`ScripOnSchedule` → their workspaces; protected-export → Studio/Room distribution; the lore atlas + dialect/era substrate → Canon.
- **Build (net-new):** the **Canon memory graph + verify-loop**; the **version/decision kernel** (CRDT drafts, branch, semantic diff, decision records); the **Revision Pass** staging→render; the **Room**; the **⌘K palette + OS shell**; **FDX/Fountain round-trip export**; continuity/plot-hole + emotion-arc + table-read + representation analytics; the Slate; SSO/audit.

---

## 8. Phased roadmap (kernel-first · reuse-first · design-first)

- **P0 · Kernel + shell skeleton.** Canon graph (bi-temporal) + semantic index + the extract→inject→**verify** loop wired into generation. The version/decision store (CRDT drafts + DecisionRecord). The OS shell (rail + ⌘K + top bar) wrapping the existing Reader as the Write canvas. Prove the loop with the simplest path: stage a `NOTE` SceneChange → Render → new version.
- **P1 · Revision Pass + real change kinds.** The pinned composer; wire REVISE / RE_ENDING / BUDGET_FIT / REGENERATE / EMOTION by reusing RewriteSlate/endings/BudgetFit/the generator; each produces a staged `SceneChange` with a before/after peek. Render applies all in one regeneration → new `BuildVersion`, continuity-checked.
- **P2 · Living-Canon intelligence.** Continuity/conflict/plot-hole running on the graph; the Story-Spine charge ribbon + flags; canon write-through + bible sync; Canon workspace (relationship graph/timeline/world).
- **P3 · The Room.** Notes/approvals/distribution/presence as live data; per-recipient watermarked share on top of protected-export.
- **P4 · Interop + intelligence quick wins.** FDX + Fountain round-trip export; WGA revision colors + locking; table reads; representation/Bechdel; emotion-arc viz; Read/Focus mode; semantic diff view in Versions.
- **P5 · Studio/enterprise.** SSO/SAML, audit logs, SCIM; Slate/portfolio; TPN-aligned posture; Language Adaptation studio on the rendered draft.

Sequencing principle: the kernel (P0) before features — like RBAC-before-everything in enterprise software.

---

## 9. Guardrails & rules

1. **Reuse first** — relocate existing engines; build only the kernel + the net-new list. **Never drop the Builder/Brief** — they are the Develop workspace.
2. **Non-destructive, always** — staging never edits the script; Render creates a new version; the base draft is immutable; everything is revertible.
3. **Design-first in Figma**, Cinematic V.4 (reuse `globals.css` tokens + `CinematicHeader`; targets = the Figma file + `design-tmp/scripon-v4-revision-pass.html`). No features hidden in three-dot menus.
4. **Schema safety** — drift-reconcile + backup DB; one migration per change; never prod.
5. **Multi-tenancy stays separate** (the release blocker).
6. **Respect intentional safety designs** — no-faces look-board, no living-religion deities, representation-as-speaking-count (raise demographics as a design decision, don't hack it).
7. **Interop is non-negotiable** — FDX + Fountain round-trip is the credibility floor.
8. **TDD the pure logic** — canon extract/verify, scene-graph, change-dependency ordering, continuity scoring, semantic diff, render-apply. `npm run test:unit` in `/backend`; commit per slice.

---

## 10. How to proceed (Superpowers + Figma)

Use brainstorming, writing-plans, test-driven-development, git-worktrees, requesting-code-review. **Start with P0 only:**
1. Recon the current Reader / Revisions / Develop(build/brief) / nav + the Cinematic tokens; confirm what's reused for each workspace.
2. In Figma (Cinematic V.4), design the OS shell + the Canon and Versions workspaces to match the existing Write screen already in the file.
3. Propose the P0 build slice (canon graph + verify-loop + version/decision store + shell wrapping the Reader + the NOTE→Render proof) as a short plan.
4. **Stop and show me the recon + Figma + P0 plan before writing code.** Wait for approval.

When a phase lands, report Figma frames + commits + what changed, and keep `docs/SCRIPON-SCRIPT-OS-BLUEPRINT.md` + the master features doc in sync.

---

## 11. Evidence (selected)

Two-store memory + close-the-loop: Graphiti/Zep temporal KG (neo4j.com/blog/developer/graphiti-knowledge-graph-memory), RAPTOR (arxiv.org/abs/2401.18059), Novelcrafter Codex (novelcrafter.com/features/codex), drift/"lost in the middle" (novarrium.com/blog/ai-writing-tools-keep-contradicting-themselves). Version control for prose: Ink & Switch *Upwelling* (inkandswitch.com/upwelling), Automerge (automerge.org), Arc Studio branching (help.arcstudiopro.com/guides/draft-revision-management). Decision records: ADRs (microsoft.github.io/code-with-engineering-playbook/design/design-reviews/decision-log). The workflow gap: Scripto/Wrapbook (wrapbook.com/on-production-podcast/building-better-tools-for-the-writers-room-with-josh-kline). Interop: FDX dominance (filmmakermagazine.com/120862-final-draft-screenwriting-alternatives). Command palette: (uxpatterns.dev/patterns/advanced/command-palette). Security/enterprise: forensic watermarking (blog.cimediacloud.com/forensic-watermarking), TPN (ttpn.org), build order (hashorn.com/blog/enterprise-ready-saas-sso-scim-audit-logs). Canon at scale: the Holocron (starwars.fandom.com/wiki/Holocron_continuity_database). Full set in `docs/SCRIPON-SCRIPT-OS-BLUEPRINT.md`.
