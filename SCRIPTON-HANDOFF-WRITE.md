# ScriptON · Write — Design Handoff (screen 7 · the hero, kernel-backed)

_For Claude Code. Build the **Write** workspace — the script canvas + the **Revision Pass** staging panel — the heart of the OS, behind the `scripton.osShell` flag. Design authority: Figma `dqUr3nasAkQIdefXcGDSyi` node **1:2** (Write frame) + `design-tmp/scripon-v4-revision-pass.html` (the loved canvas styling). Route: `/scripton/reader` (post-rename). **Names are post-rename** (`ScriptOn*`, `/scripton/*`)._

## Prerequisite
The P0 kernel is merged + live (done). This screen is where canon facts get **created** — staging is non-destructive; **Render = commit** writes canon + a decision record + a new version.

## Build in slices (do NOT big-bang — verify each)
This is the most complex screen. Ship it in four flag-gated, browser-verified slices:
1. **Canvas + Story Spine** (read-only): reuse `ScriptOnReader` for the paper; add the left Story-Spine strip. No kernel writes yet.
2. **Revision Pass panel** (read): render the open pass's staged changes + continuity % from the kernel.
3. **Stage-a-change composer** (write-stage): compose → stage a `SceneChange` (non-destructive), continuity-checked.
4. **Render = commit**: apply the pass → new `BuildVersion` + extracted canon + `DecisionRecord`.

## What exists (reuse — do NOT rebuild)
- `ScriptOnReader.tsx` (+ Tablet/Mobile) — the unified A4 script paper. **Reuse it verbatim** for the center canvas (the "never rebuild the Reader" rule).
- The **canon kernel** (`backend/.../scripton/canon/`): `resolveCanonAt`, `detectConflicts`, `factsExcludingScenes`, `canonDirective` (pure, tested) + the `CanonFact` store and the `GET …/canon` read endpoint (from the Canon screen).
- The **staging kernel** (merged): `RevisionPass`, `SceneChange`, `DecisionRecord`, and the Render path (commit → new `BuildVersion`). Reuse these — don't reinvent staging.
- `design-tmp/scripon-v4-revision-pass.html` — the exact cinematic styling the user loved; match it.

## Layout (desktop — matches frame 1:2, content area right of the rail)
1. **Left — Story Spine:** a thin vertical multi-color strip spanning the page height — colored segments = acts/sequence, with **dots** marking scenes that have staged changes + the current scroll position. Click a point → scroll the canvas to that scene.
2. **Center — the script paper (the canvas):** `ScriptOnReader` rendering the active revision in Courier. Scenes with a staged change carry a gold **`STAGED`** badge. An inline **"Stage a change · Scene {n}"** composer can open on a scene:
   - sub: `composed — continuity-checked before it joins the pass`.
   - **HOW TO CHANGE IT** tabs: `Re-ending · Rewrite · Stronger emotion · Budget-fit · Regenerate`.
   - **COMPOSE THE CHANGE** — AI-composed options as selectable rows with tags, e.g. `Redemptive climb — earns the cave (+arc)` · `Tragic slip — Abla sees him fall (alt)` · `Swap cliff → gorge ledge (reuse S58) (−$140k)`.
   - Buttons: gold **`+ Stage this change`**, `Preview on page`.
3. **Right — REVISION PASS → V{n+1}:** header `{k} changes staged`; **`Continuity across the pass {score}%`** bar (`continuityScore`). The staged-change list — each row = an icon (revise / canon-shift / re-ending), `Scene {n} · {label}`, a tag line (`Revise · sets up 65` / `Canon shift · World Bible · Timeline` / `Re-ending · Budget −$140k`), and a one-line summary or a **red→green diff** for re-endings. A **bridge card**: `One bridge needed: S64 night → S65 dawn. Auto-fix on render.` Footer: gold **`Render new draft → V{n+1}`**; `Save pass` · `Preview all` · `Discard`.

Cinematic dark + gold tokens (match the loved mockup + `globals.css`).

## Data wiring (reuse the merged kernel — do NOT mock)
| Region | Source |
|---|---|
| Canvas paper | `ScriptOnReader` on the active revision (existing data) |
| Story Spine | the revision's ordered scene list + which scenes have an open `SceneChange` |
| Staged changes list | the open `RevisionPass` + its `SceneChange`s for the active script |
| Continuity % | `continuityScore` over the pass (kernel) |
| Bridge card | `orderChanges` / dependency + `detectConflicts` → needed bridges (auto-fixable on render) |
| Stage-a-change options | AI-composed alternates via the existing generate path; **continuity-checked with `detectConflicts` (using `factsExcludingScenes`) before staging** |
| `Stage this change` | create a `SceneChange` in the open pass (non-destructive — never edits the base draft) |
| `Render new draft → V{n+1}` | the kernel Render = commit: apply pass → new `BuildVersion`, extract→verify canon (writes `CanonFact`), write a `DecisionRecord` |
| STAGED badge | scenes with an open `SceneChange` |

## States
- **No open pass:** right panel = empty state ("No changes staged — stage one to start a Revision Pass"); paper reads normally; spine shows no change-dots.
- **Composer continuity check:** if a composed option contradicts canon, show the conflict inline (from `detectConflicts`) before it can be staged.
- **Render:** confirm → progress → on success the pass clears, a new version (V{n+1}) exists, Canon reflects the new facts, and a DecisionRecord is logged. Non-destructive: the base draft/version is immutable and revertible.
- **Loading / kernel-empty:** skeletons; if the script has no scenes, the canvas shows the reader's existing empty state.

## Responsive (frames 46:3 Write tablet, 49:3 Mobile review)
- **Tablet (46:3):** Revision Pass panel collapses to a right drawer/tab; the Story Spine narrows; canvas stays primary.
- **Mobile (49:3, review-first):** the paper leads; staged changes + the composer open as full-screen sheets; `Render`/`Stage` reachable with one thumb.

## Acceptance (browser-verified, headless + my eyeball — per slice)
- Matches Figma **1:2** + the loved mockup: Story Spine, the canvas with STAGED badges + inline composer, the Revision Pass panel with continuity %, the bridge card, and Render.
- Canvas **reuses `ScriptOnReader`** (not a reimplementation).
- **Real kernel data**: staged changes are real `SceneChange`s; continuity % is real; **Render actually commits** (new `BuildVersion` + new `CanonFact`s visible on the Canon screen + a `DecisionRecord`); staging never mutates the base draft.
- Non-destructive + revertible; the bridge auto-fix runs on render.
- **No console errors / no hydration flash** on hard refresh (Playwright) at desktop/tablet/mobile.
- Behind `scripton.osShell`; `old` restores the current Reader. ScriptON naming + `/scripton` route throughout.

## Out of scope (this screen)
The unified top bar + ⌘K palette (Phase 2). CRDT branch/merge (deferred — Render rides `BuildVersion`). The depth/quality of AI change-composition is bounded by the existing generate path; this screen wires to it and lets the kernel's verify guard it.
