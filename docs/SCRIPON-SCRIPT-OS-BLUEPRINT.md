# ScripON → Script OS — Blueprint

### A blank-sheet, evidence-based reassessment of what ScripON must become to legitimately be a Script Operating System

_Synthesised 2026-06-24 from a two-wave deep-research study (9 streams, ~200 sourced claims) across professional screenwriting software, studio & writers'-room workflows, franchise canon management, localization, enterprise/studio security, long-form AI memory architectures, and version-control theory. Sources cited inline; full list at the end. This document precedes implementation — it sets the foundations, not the feature backlog._

---

## 0. The thesis — what actually earns the name "Script OS"

The research is unusually unanimous on one point: **every existing screenwriting tool is a patch over the same fault line.** The screenplay is a *collaborative, iterative, multi-stakeholder, long-lived* thing, but it is tooled as a *static, single-author artifact* — a PDF or a `.fdx` file emailed around. Scripto's founder (built for Colbert's room) calls the PDF "a publishing format, not a live data-sharing format," and describes the resulting "duct-tape-and-rubber-band ecosystem" of tools faking live data on top of it ([Wrapbook/On Production](https://www.wrapbook.com/on-production-podcast/building-better-tools-for-the-writers-room-with-josh-kline)).

So the OS-defining move is not "more AI tools." It is a change of substance: **stop being a document editor and become the system of record for the story** — the layer the whole lifecycle runs on. An operating system has three properties a document never has:

1. **Memory** — it persistently knows the whole world (canon), not just the open file.
2. **Version control** — it preserves every state and every decision, non-destructively.
3. **A platform** — other capabilities (writing, analysis, collaboration, production, localization) run *on top of* that memory and history, instead of each keeping its own private copy.

A Script OS is the thing that **remembers the story, records its evolution, and lets every workflow run against that single source of truth.** Everything below follows from that.

---

## 1. The seven pillars (evidence → where ScripON stands → the move)

| # | Pillar | What the research says a Script OS needs | ScripON today | The move |
|---|---|---|---|---|
| 1 | **Canon & Memory** | A single authoritative store of story truth — entities, relationships, state, **with time** — that every tool reads/writes. Franchises do this manually (Lucasfilm's *Holocron*, 120k entries, with a human "Keeper" — [Wookieepedia](https://starwars.fandom.com/wiki/Holocron_continuity_database)). AI tools approximate it with codex/lorebook injection ([Novelcrafter Codex](https://www.novelcrafter.com/features/codex)). | Per-script bibles + lore atlas + a planned "canon" note. Siloed per feature. | **Elevate canon to a project/franchise-level memory graph** (the spine). §3. |
| 2 | **Version control & draft preservation** | Drafts as branches; autosnapshots; semantic diff; WGA revision colors + page/scene locking; a *decision log*. Arc Studio already ships snapshots, autosave-every-10-min, visual diff, and **Alternate Drafts = git-style branches** ([Arc Studio](https://help.arcstudiopro.com/guides/draft-revision-management)). Research-grade prose VC (Ink & Switch *Upwelling*) models "drafts/layers/stack" on CRDTs ([Upwelling](https://www.inkandswitch.com/upwelling/)). | Run-level `BuildVersion`; the planned Revision Pass; `ScripOnRevisions`. No branch/merge, no semantic diff, no decision log, no WGA colors/locking. | **Make version control foundational** — a draft/branch/diff/decision graph. §4. |
| 3 | **Story intelligence & continuity** | Coverage, structure/beat analysis, pacing, dialogue, **emotion arcs** (Largo's 8-emotion graph, StoryFit sentiment arc), **continuity/plot-hole detection** (FinalBit's Plot Hole Report), table reads, representation analytics (Final Draft Inclusivity + GD-IQ). | **Strong** — Doctor P0–P7 already does coverage, diagnostics, transforms, rating/culture, market/greenlight. | **Turn analysis into an always-on layer that runs on canon**, add the rare ones (continuity/plot-hole, emotion arc, table read, representation). §5. |
| 4 | **Workflow, collaboration & notes** | The biggest *unsolved* industry gap: notes arrive from many parties with "no shared system" (calls/emails/PDFs); a script coordinator manually re-bases a ~150-person distribution list; "version chaos" from emailing files ([Wrapbook](https://www.wrapbook.com/on-production-podcast/building-better-tools-for-the-writers-room-with-josh-kline)). Winners are real-time + in-script comments + review-request flows (Arc Studio, WriterDuet, Scripto). | None. Single-user; notes are `CoverageNote` only; approvals exist in the wider ERP but not script-native. | **Build a structured notes/approval/distribution layer** — notes as data, not PDFs. §5. |
| 5 | **Interop — the credibility floor** | Non-negotiable: **FDX (Final Draft XML) import/export is the de-facto industry interchange** (~95% of productions); Fountain (open plain-text) + PDF are table-stakes. Tools that draft elsewhere still export `.fdx` for production ([Filmmaker Mag](https://filmmakermagazine.com/120862-final-draft-screenwriting-alternatives/)). | PDF export (protected). Imports FDX/Fountain/Celtx/Word for analysis. FDX **export** unconfirmed. | **Guarantee round-trip FDX + Fountain.** A "Script OS" that can't hand a `.fdx` to production isn't taken seriously. Quick win, high stakes. |
| 6 | **Experience, discoverability & focus** | "Get out of the way" is the #1 repeated praise; smart auto-format, the script-as-canvas, drag-card boards, typewriter/focus/dark modes, a live scene navigator. **A Cmd-K command palette is standard in modern creative OSes (Figma, Notion, Linear) but no screenwriting tool ships one** — a clear differentiation gap ([uxpatterns](https://uxpatterns.dev/patterns/advanced/command-palette)). Low latency is itself a feature. | The loved Revision-Pass canvas is the right writing surface. No command palette, no OS shell to hold *all* features. | **Wrap the canvas in an OS shell + Cmd-K** so every feature is reachable without burying it. §6. |
| 7 | **Studio & enterprise readiness** | Per-recipient **forensic watermarking** + access control + immutable share/NDA logs + TPN-Gold posture is the *price of entry* for handling unreleased scripts ([Sony Ci](https://blog.cimediacloud.com/forensic-watermarking/), [TPN](https://www.ttpn.org/about-us/)). Build order: **RBAC → audit logs → SSO/SAML → SCIM**, under SOC 2 ([Hashorn](https://hashorn.com/blog/enterprise-ready-saas-sso-scim-audit-logs)). Slate/portfolio view across productions. | **Real asset:** protected-export already does per-recipient watermark + permissions + audit + sanitised metadata. RBAC exists in the ERP. | **Lean into security as a differentiator**; add SSO/audit/slate for studio sale. |

---

## 2. The core architectural insight (two stores, one loop)

The memory research converges hard on a single architecture — and it is the thing that will most separate ScripON from "a generator with a bible."

**Passive bibles fail.** Giving the model a story bible does not enforce it; the model statistically drifts (a "blue-eyed" character trends back to brown) — confirmed across the AI-fiction tooling space, and the reason even million-token windows don't fix long-form contradictions ("lost in the middle") ([Novarrium](https://novarrium.com/blog/ai-writing-tools-keep-contradicting-themselves)).

**The fix is two stores + a closed loop:**

- **A structured canon graph** — entities, relationships and **state over time** (bi-temporal: *when it's true in the story* and *when it was recorded*), so canon can legitimately change (a character dies, an alliance breaks) without losing history. This is exactly Graphiti/Zep's temporal knowledge-graph model ([Neo4j/Graphiti](https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/)), and the digital equivalent of the Holocron.
- **A semantic index over the prose itself** — embeddings + RAPTOR-style scene→chapter→arc summaries so the system can recall *any* part of a feature-length script ([RAPTOR](https://arxiv.org/abs/2401.18059)). Pure-vector loses relational precision; pure-graph has a cold-start/curation cost — the consensus is **hybrid** ([Glean](https://www.glean.com/blog/knowledge-graph-vs-vector-database)).
- **The loop:** every generation runs **extract facts → relevance-weight & inject → verify the output against canon** (the shape shared by Mem0's ADD/UPDATE/DELETE reconciliation and the three-stage "logic-locking" pattern). This is what makes the AI *respect* canon instead of merely being handed it.

ScripON already injects knowledge as steering (the `knowledgeDirective` composer) — that is the *inject* step of this loop. **The OS upgrade is to add the persistent graph (memory) and the verify step (enforcement).** That single change is the difference between "remembers what you told it this session" and "knows the story."

---

## 3. Version control as a first-class system (not a feature)

A Script OS preserves *everything* and records *why*. The research gives a concrete, prose-native model:

- **Drafts are branches.** Use a CRDT substrate (Automerge-style) for keystroke-level history, branch/merge/diff "for free," and offline-safe real-time collab ([Automerge](https://automerge.org/docs/hello/)). Arc Studio's Alternate Drafts proves writers want private experimental branches that merge back.
- **Diff must be semantic & multi-resolution.** Line diff is useless for prose; sentence-embedding diff distinguishes a *meaning change* from a rephrase, and you need both an in-document view (additions highlighted, deletions behind a hover-glyph) and a *summary* view ([Ink & Switch Patchwork](https://www.inkandswitch.com/patchwork/notebook/2024-version-control/04/)). **Critical limit:** *semantic* conflicts (one draft renames a term globally, another adds a scene using the old term) are individually valid but jointly contradictory and are **not machine-resolvable today** — keep a human in the loop and optimise the review surface ([Upwelling](https://www.inkandswitch.com/upwelling/)).
- **Industry revision layer on top:** WGA revision colors (White → Blue → Pink → Yellow → Green → Goldenrod → Buff → Salmon → Cherry → … doubles), right-margin asterisks, page/scene **locking** and A-pages, OMIT/STET — the protocol production actually requires ([Final Draft KB](https://kb.finaldraft.com/hc/en-us/articles/15575314119316-What-are-the-standard-revision-set-colors)). The Revision Pass should *render into* this, not replace it.
- **The missing third pillar — Decision Records.** Import the ADR pattern (Context / Decision / Consequences / Status, append-only, superseding) to log **creative** decisions: "killed character X in act 2 because…," with the rejected alternatives. The canon graph stores *what is true*; the decision log stores *why it was chosen* — and survives team turnover ([Microsoft ADR](https://microsoft.github.io/code-with-engineering-playbook/design/design-reviews/decision-log/)). No screenwriting tool does this; it is a genuine OS-grade differentiator.

Your loved **Revision Pass is exactly right** — but reframed: it is the *staging area* of this version-control system (git's index), and "Render V3" is a *commit* that writes canon + a decision record and produces a new branch state. The design doesn't change; its foundations get deeper.

---

## 4. Where the current concept falls short (honest gap analysis)

The Revision-Pass design is the best writing/revision *surface* in the category — but as drawn it is **a brilliant editor, not yet an OS.** Against the seven pillars, the gaps are:

1. **Memory is per-script and passive** — no persistent, bi-temporal canon graph the AI is *checked against*; no semantic index over the whole script. (Pillar 1, §2.)
2. **No true version control** — run-level versions exist, but no branching, no semantic diff, no decision log, no WGA colors/locking for production. (Pillar 2, §3.)
3. **No collaboration layer** — the single biggest *industry* pain (notes/approvals/distribution) is entirely absent; it's single-player. (Pillar 4.)
4. **Interop unproven** — FDX *export* (the credibility floor) is unconfirmed. (Pillar 5.)
5. **No OS shell / discoverability** — the design surfaces *some* tools; there's no command palette or systematic home for *all* of them. (Pillar 6 — and your exact note: "I want all in.")
6. **Enterprise/slate** — strong security primitives exist but no SSO/audit-for-studios or cross-project slate view. (Pillar 7.)
7. **A few high-value intelligence gaps** — continuity/plot-hole detection, emotion-arc visualisation, table reads, representation analytics. (Pillar 3.)

---

## 5. Blank-sheet information architecture — the OS shell that holds *all* features

You said it: *some* features showed, you want *all* in, but the design is great. The resolution is not to cram the canvas — it's to **wrap the loved canvas in an OS shell**, the way Figma/Linear/Notion hold enormous surface area without clutter.

**Three layers:**

1. **The Spine (always present): Canon + History + Decisions.** The story's memory graph, its version/branch tree, and its decision log — the single source of truth every workspace reads. This is the "operating system kernel"; users feel it as *the script always knows itself*.
2. **The Shell (navigation & discoverability):**
   - **Cmd-K command palette** — the headline UX differentiator no rival has: type to run any action, jump to any scene/character/decision, invoke any tool. Solves "all features in" without burying them.
   - **A system rail of Workspaces** (not tabs hiding tools — *modes* of working on the same story): **Write** (the Revision-Pass canvas — the hero), **Develop** (Build/Brief/Format), **Doctor** (coverage/analysis/continuity), **Bible** (canon graph: characters/world/lore/timeline/relationships), **Versions** (branch tree, diff, decision log, WGA revisions), **Room** (collaboration: notes, approvals, distribution, presence), **Slate** (portfolio across scripts/franchise), **Studio** (settings, security, export/interop).
   - **Global presence + a live continuity indicator** in the top bar (the canon health of the whole script).
3. **The Canvas (focus): the script.** Your Revision-Pass design *is* the Write workspace — paper, Story Spine, pinned composer, staged pass. Every other workspace composes panels onto or beside it; nothing replaces the script as the centre.

This is how all of §1's pillars live in one product without overwhelming the writer: **kernel (memory/history) → shell (palette + workspaces) → canvas (the script).** Discoverability via the palette; focus via the canvas; power via the workspaces.

---

## 6. What to centralize · elevate · make foundational

- **Centralize:** one **Canon & Memory graph** and one **Version/Decision graph** — every feature reads/writes these instead of keeping private copies. (Kills the silo problem that makes today's tools "patches.")
- **Make foundational (the kernel):** (a) the bi-temporal canon graph + semantic index + verify-loop; (b) CRDT-backed draft/branch/diff; (c) the creative decision log. Build these *first*; everything else gets more powerful for free.
- **Elevate:** the Story Bible → a living franchise-scale canon graph; per-stage versions → real branching + semantic diff + WGA production layer; the Doctor → an always-on continuity/intelligence layer running on canon.
- **Add (net-new, OS-grade):** the Room (notes/approval/distribution), the command palette + OS shell, FDX round-trip, table reads, representation analytics, slate/portfolio, SSO/audit.
- **Keep & lean into (your moats):** the Doctor P0–P7 intelligence, the protected-export/watermarking security, the country/era/dialect substrate + lore atlas, and the Revision-Pass UX. These are already ahead of the field — most rivals have none of them.

---

## 7. The five features that most earn the name "Script OS"

If only five things define the leap, the evidence points here:

1. **Living Canon (bi-temporal memory graph + close-the-loop enforcement).** The AI *knows and respects* the whole story. Nothing in the consumer market does this well; franchises do it by hand. **This is the flagship.**
2. **True version control for story** — branch/merge, semantic diff, non-destructive drafts, **+ creative Decision Records**. "Every draft and every *why*, forever." No rival pairs versioning with decision rationale.
3. **The Room** — collaboration, notes, approvals and distribution as structured live data, replacing the PDF/email chaos that is the industry's #1 unsolved pain.
4. **FDX/Fountain round-trip interop** — the credibility floor; without it, "OS" claims fail at the production door.
5. **The OS shell + Cmd-K command palette** — the discoverability/UX that lets *all* the power be present without burying it. The single biggest unclaimed UX differentiator in the category.

Continuity/plot-hole detection, emotion arcs, table reads, representation analytics, and the slate view are the high-value second tier.

---

## 8. Prioritized roadmap

**Foundations (build first — the kernel; nothing else is "OS" without them)**
- Canon & Memory graph (bi-temporal entities/relationships/state) + semantic index over the script + the extract→inject→**verify** loop wired into generation.
- Version/Decision kernel: CRDT draft store → branches, snapshots, semantic diff, decision log. The Revision Pass becomes its staging area.

**Flagship bets**
- Living-Canon enforcement (continuity/conflict/plot-hole running on the graph).
- The Room (notes/approvals/distribution/presence).
- OS shell + Cmd-K command palette + the Workspace IA.

**Quick wins (high value, low risk)**
- FDX + Fountain round-trip export (credibility floor).
- WGA revision colors + page/scene locking (production readiness).
- Table reads (assigned AI voices), representation/Bechdel analytics, emotion-arc visualisation.
- Read/Focus mode, autosave + visible version history, dark mode polish.

**Studio/enterprise (when selling to productions)**
- SSO/SAML, audit logs, SCIM; slate/portfolio across scripts & franchise; TPN-aligned posture on top of the existing watermarking.

Sequencing principle from the research: model the **memory and version kernel first** (like RBAC-before-everything in enterprise software, or "two stores, one loop" in memory architecture) — the kernel makes every later feature cheaper and more powerful, and retrofitting it is the expensive path.

---

## 9. Bottom line

ScripON is already ahead of the market on *intelligence* (Doctor P0–P7) and *security* (protected export) and has the best *writing surface* concept (the Revision Pass). It is **not yet an OS** because it lacks the kernel: a persistent, enforced **story memory**, a real **version-and-decision** system, and a **collaboration** layer — wrapped in a **shell** (palette + workspaces) that makes the whole arsenal discoverable. Build those, and "Script OS" stops being a name and becomes accurate: the system that *remembers the story, records its evolution, and runs every workflow against one source of truth.*

---

## Sources (selected, by pillar)

**Functions/interop:** Filmmaker Magazine (FDX dominance & named-writer critiques) https://filmmakermagazine.com/120862-final-draft-screenwriting-alternatives/ · Fountain syntax https://fountain.io/syntax/ · StudioBinder breakdown https://www.studiobinder.com/script-breakdown-software/
**UX:** Scrivener composition/corkboard https://www.literatureandlatte.com/blog/distraction-free-writing-with-scrivener · Command-palette pattern https://uxpatterns.dev/patterns/advanced/command-palette · Arc Studio quick-format https://help.arcstudiopro.com/guides/quick-formatting-shortcuts-keystrokes-guide
**Memory/canon:** Novelcrafter Codex https://www.novelcrafter.com/features/codex · NovelAI Lorebook https://docs.novelai.net/en/text/lorebook/ · Sudowrite Story Bible/continuity https://sudowrite.com/blog/how-to-avoid-plot-holes-sudowrites-chapter-continuity-feature-explained/ · Graphiti/Zep temporal graph https://neo4j.com/blog/developer/graphiti-knowledge-graph-memory/ · RAPTOR https://arxiv.org/abs/2401.18059 · GraphRAG survey https://github.com/DEEP-PolyU/Awesome-GraphRAG · Mem0 https://arxiv.org/html/2504.19413v1 · "lost in the middle"/drift https://novarrium.com/blog/ai-writing-tools-keep-contradicting-themselves
**Versioning/decisions:** Arc Studio revisions/branching https://help.arcstudiopro.com/guides/draft-revision-management · Final Draft revision colors https://kb.finaldraft.com/hc/en-us/articles/15575314119316-What-are-the-standard-revision-set-colors · Ink & Switch Upwelling https://www.inkandswitch.com/upwelling/ & Patchwork https://www.inkandswitch.com/patchwork/notebook/2024-version-control/04/ · Automerge https://automerge.org/docs/hello/ · ADRs https://microsoft.github.io/code-with-engineering-playbook/design/design-reviews/decision-log/
**Workflow:** Scripto/Wrapbook "On Production" https://www.wrapbook.com/on-production-podcast/building-better-tools-for-the-writers-room-with-josh-kline · Final Draft Beat Board https://blog.finaldraft.com/what-is-a-beat-board-anyway · Scriptation note-transfer https://scriptation.com/features/transfer-notes/
**Canon at scale / localization:** Holocron https://starwars.fandom.com/wiki/Holocron_continuity_database · Lucasfilm Story Group / canon reset https://screenrant.com/star-wars-canon-legends-expanded-universe-explained/ · Netflix TTAL localization https://slator.com/why-netflix-created-a-new-blueprint-for-subtitling-and-dubbing/ · transcreation https://blog.amara.org/2025/04/01/how-transcreation-and-cultural-adaptation-make-stories-resonate-across-borders/
**Story intelligence:** FinalBit plot-hole report https://www.finalbitai.com/features/plot-hole-detection-report · Largo emotion graph https://home.largo.ai/largo-content-insights/ · StoryFit arcs https://storyfit.com/story-arcs-script-analysis/ · Final Draft Inclusivity / GD-IQ https://deadline.com/2019/04/final-draft-inclusivity-analysis-software-update-1202604031/ · table reads (WriterDuet ReadAloud) https://www.writerduet.com/article/119-readaloud
**Enterprise/security:** Forensic watermarking (Sony Ci) https://blog.cimediacloud.com/forensic-watermarking/ · TPN https://www.ttpn.org/about-us/ · Enterprise build order (RBAC→SSO→SCIM) https://hashorn.com/blog/enterprise-ready-saas-sso-scim-audit-logs · Figma multiplayer architecture https://www.figma.com/blog/how-figmas-multiplayer-technology-works/

_Verification note: vendor/marketing figures (accuracy %, time-savings, user counts, single-vendor "active enforcement" efficacy) are flagged as indicative, not audited. Architecture patterns (two-store memory, CRDT versioning, ADRs, Figma's conflict model, WGA colors, FDX/Fountain) are corroborated by primary or multiple independent sources._
