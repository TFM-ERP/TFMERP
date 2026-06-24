# Superpowers + Figma — ScripON v4 Screenplay OS · Revision-Pass kickoff

Paste-ready brief for **Claude Code + Superpowers** (build) and **Figma** (design authority, Cinematic V.4). This version supersedes the earlier "tabbed Script Detail" concept — the new spine is a **Script Canvas + a non-destructive Revision Pass**.

Companions in the repo: `docs/SCRIPON-BUILD-MASTER-FEATURES-AND-ROADMAP.md` (current state) · `docs/SCRIPON-V4-SCREENPLAY-OS-PLAN.md` (architecture) · design reference `design-tmp/scripon-v4-revision-pass.html` (the target UX).

---

## 1. The product idea (read this first)

A screenwriter opens a script and **reads it as paper** — the unified screenplay reader is the canvas, not a tab. As they read they **mark up scenes**: rewrite this one, re-end that one, budget-fit another, regenerate a third. **Each change is staged into a "Revision Pass," not applied immediately.** They keep adding, editing and removing staged changes across many scenes, saving the pass until they're satisfied. Then one **"Render new draft"** regenerates the whole script with all staged changes at once — continuity-checked across the set — producing a **new version (V3)** while the previous draft stays intact.

This is the core loop: **read → stage many changes → render a new draft → compare.** Non-destructive, batch, review-then-commit. It is the difference between a document editor and a story-engineering system.

## 2. The UX (target design: `design-tmp/scripon-v4-revision-pass.html`)

- **Story Spine (left, thin):** the whole film as one ribbon — act bands + emotional-charge curve + scene ticks, with **gold flags where changes are staged** and a "you-are-here" marker. Macro always visible; click to jump. Doubles as page/scene navigation.
- **The Paper (center, hero):** the unified screenplay, paginated and page-like (the existing Reader's paper view, full-bleed). Page selector in the top bar (`Page 14 / 27`). Hovering any scene reveals an inline action row (Revise · Re-ending · Note). Scenes with staged changes show a **gold margin rule + a "✎ STAGED" flag** on the page.
- **The Composer (pinned card, in-context):** acting on a scene opens a card **pinned beneath that scene** (never a modal that hides the script). It surfaces the composing tools *open and together* — change-type chips, ending suggestions, budget-fit, emotion — and the primary action is **"＋ Stage this change"** (plus "Preview on page"). Tools compose; output goes to the pass.
- **The Revision Pass (right):** the spine of the workflow. A live **continuity meter** (e.g. 96%) across the whole set; a stack of staged-change cards (Scene 12 setup · Scene 40 canon shift · Scene 65 re-ending + budget) each with type, summary, a before/after peek, edit/remove; cross-change notes (e.g. "S64 night → S65 dawn: add a bridge — auto-fix on render"). Footer: **"⛭ Render new draft → V3"** + Save pass / Preview all / Discard, with the reassurance that V2 stays intact.
- **Read ⇄ Markup toggle** in the top bar: read clean, or enter markup mode where scenes become actionable.

## 3. Reuse first (most of this exists)

Relocate/compose, don't rebuild: the paper reader (`ScripOnReader`), the transforms (`ScripOnRewriteSlate` → P2), budget-fit (`ScripOnBudgetFit`), ending taxonomy (`endingTypes.ts`), versions (`ScripOnRevisions` + `BuildVersion`/`buildVersionId`), coverage/diagnostics (`ScripOnDoctor`), character bible, the generation pipeline (`scripton.service.ts`). **New code is the Revision-Pass spine + the per-scene staging, not the engines underneath.**

## 4. New: the Revision-Pass engine + data model (the heart of v4)

A staged, non-destructive change set applied in one regeneration.

```
RevisionPass { id, scriptId, baseVersionId, status(OPEN|RENDERING|RENDERED|DISCARDED),
               continuityScore, createdBy, createdAt, renderedVersionId? }

SceneChange  { id, passId, sceneId, sceneNumber,
               kind(REVISE|RE_ENDING|REGENERATE|BUDGET_FIT|EMOTION|CANON|NOTE),
               spec(Json),            // mode/instruction/chosen ending/budget target…
               previewBefore?, previewAfter?,
               status(STAGED|EDITED|CONFLICTED),
               relatedAffected(Json), integrity(Json) }
```

Behaviour:
- Staging a change runs the per-scene composer (reusing RewriteSlate/BudgetFit/endings) but **persists a `SceneChange`** instead of writing the script.
- The pass keeps a **continuity score** computed across all staged changes together (timeline, arcs, setup/payoff, canon) — not per change in isolation.
- **Render** = apply every `SceneChange` in dependency order in one async regeneration → a **new `BuildVersion` (V3)** stamped on a fresh script revision; run the ending-coverage + integrity guards; auto-apply trivial bridges (e.g. time cues); leave the base version untouched; then surface a compare.
- Approved renders write **canon** (per the plan's canon spine) so future passes/bibles/adaptations respect them.

## 5. Phases (design-first · reuse-first · risk-ascending)

- **P0 · Script Canvas + Pass skeleton** — Figma: the canvas + spine + pass in Cinematic V.4. Code: the full-bleed paper reader as the workspace; page navigation; the `RevisionPass`/`SceneChange` models (additive, backup-DB migration); the right-hand pass panel rendering staged changes; **scene hover → pin a NOTE change** end-to-end (simplest change kind) to prove the staging loop.
- **P1 · The Composer + real change kinds** — pin the composer card; wire REVISE / RE_ENDING / BUDGET_FIT / REGENERATE by reusing RewriteSlate, endingTypes, BudgetFit, and the scene generator — each producing a staged `SceneChange` with a before/after peek.
- **P2 · Render the pass** — apply all staged changes in one regeneration → new `BuildVersion`; ending/integrity guards; compare view; non-destructive guarantees.
- **P3 · Continuity intelligence** — the cross-pass continuity meter, related-scene/setup-payoff detection, conflict flags, the Story-Spine charge ribbon + change flags, canon write-through + bible sync.
- **P4 · Language Adaptation + polish** — adaptation studio on the rendered draft; pixel-pass vs Figma; tablet/mobile parity; Arabic/RTL.

## 6. How to proceed (Superpowers loop)

Use brainstorming, writing-plans, test-driven-development, git-worktrees, requesting-code-review. Work **phase by phase**, **design a phase in Figma first** (Cinematic V.4 — reuse `globals.css` tokens + `CinematicHeader`; the target is `design-tmp/scripon-v4-revision-pass.html`), then build. Start with **P0 only**: recon the current Reader/Revisions/nav + Cinematic tokens, design the canvas+spine+pass in Figma, propose the P0 build slice, and **stop for my approval before writing code.**

## 7. Rules / guardrails

1. **Reuse first** — relocate existing engines (RewriteSlate, BudgetFit, endingTypes, Reader, Revisions, the generator); build only the Revision-Pass spine + staging.
2. **Non-destructive, always** — staging never edits the script; Render creates a *new* version; the base draft is immutable; everything is revertible.
3. **Design-first in Figma**, Cinematic V.4; no features hidden in three-dot menus; the script is the canvas.
4. **Schema safety** — `RevisionPass`/`SceneChange` (and later canon/bible models) land via the drift-reconcile flow (`FOUNDATIONS.md` + `scripts/db-reconcile.sh`) on a **backup/staging DB** — never bare `db push`, never prod, one migration per change.
5. **Multi-tenancy stays out** (separate release blocker).
6. **Respect intentional safety designs** — no-faces look-board, no living-religion deities, representation-as-speaking-count.
7. **TDD the pure logic** — change-dependency ordering, continuity scoring, render-apply diffing, bridge auto-fixes. `npm run test:unit` in /backend; commit per slice.

When a phase lands, report Figma frames + commits + what changed so the plan + the master features doc stay in sync.
