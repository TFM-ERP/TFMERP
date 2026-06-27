# ScriptON · Versions — Design Handoff (screen 9 · final · kernel-backed)

_For Claude Code. Build the **Versions** view — the version/branch timeline + semantic-diff preview + the creative **decision log** — behind the `scripton.osShell` flag. This is the **default (cold) view** of the Versions workspace; the Render→Compare you just built is its compare mode. Design authority: Figma `dqUr3nasAkQIdefXcGDSyi` node **6:79**. Route: `/scripton/revisions` (no `?pass`). Names post-rename (`ScriptOn*`, `/scripton/*`)._

## Purpose
The non-destructive memory of the script: every draft as a node on a branchable timeline, a **semantic** (not line) diff between versions, and an **append-only decision log** explaining *why* each creative choice was made — the trail that survives team turnover.

## What exists (reuse — do NOT rebuild)
- `ScriptOnRevisions.tsx` (+ Tablet/Mobile) — the current Versions surface; **re-skin it to 6:79.**
- Kernel `BuildVersion`s (the version lineage + active flag) — already created by renders (V1…Vn on the build).
- Kernel `DecisionRecord`s — written at render; they power the decision log.
- The **Render→Compare diff logic** (just built) — reuse it for the compact semantic-diff preview; "open full compare" deep-links to `/scripton/revisions?pass=<id>` (or `?from&to`).

## Layout (desktop — matches frame 6:79, content area right of the rail)
1. **Title block:** `Versions` (Fraunces) + sub-line `Every draft, branch & decision — non-destructive. Semantic diff, not line diff.`
2. **Left — the version timeline (branch graph):** a vertical line of version nodes, newest work at the bottom:
   - each node = `V{n} · {label}` + meta (`{date} · {author} · rendered from Build` / `{k} scenes changed`); e.g. `V1 · First full draft`, `V2 · Active draft (Amalekites → allies · act-2 tightened · 5 scenes changed)`.
   - the **active** version is the gold-ringed node; an **in-progress render** shows dashed (`V3 · Rendering 3 changes… · from the open Revision Pass`).
   - **branches** render as a dashed offshoot node (`alt · Tragic ending · private branch · {author}`). Click a node to select it (drives the diff panel).
3. **Right top — Semantic diff · V{a} → V{b}:** for the selected pair — change **tags** (`+2 scenes`, `1 canon change`, `tone: +dread`, `budget −$140k`), then a compact dark-Courier diff block (struck-red removed / added, plus `+ inserted` / `~ changed` annotation lines like `~ Amalekite banners recolored to allied sigil (canon S40)`). Note: `Sentence-level diff — surfaces meaning changes, hides rephrasing noise. Semantic conflicts are flagged for human review.` Include an `open full compare →` link to the Render→Compare mode.
4. **Right bottom — Decision log · creative decisions:** `Why each choice was made — append-only, survives team turnover.` A list of `DecisionRecord` cards — title, a status badge (`ACCEPTED` green / `PROPOSED` amber), and `Context / Decision / Consequence` lines (e.g. `Amalekites become allies — … World Bible + timeline + relationship graph updated (canon S40)`). Note: `Superseded decisions are never deleted — they are linked, so the reasoning trail stays intact.`

Cinematic dark + gold tokens (same set as the other screens).

## Data wiring (reuse the kernel — do NOT mock)
| Region | Source |
|---|---|
| Timeline nodes | `BuildVersion`s on the active script's build (label, author, date, scenes-changed, active flag); in-progress = the open `RevisionPass` rendering |
| Branches | version lineage / parent links (read-only — see Out of scope) |
| Semantic diff preview | the selected pair via the Render→Compare diff logic (changed scenes + change tags) |
| Decision log | `DecisionRecord`s (append-only; status; context/decision/consequence; supersession links) |
| `open full compare →` | deep-link to `/scripton/revisions?pass=<id>` (the built compare mode) |

## Interactions
- Select a version node → the semantic-diff panel updates (selected vs its parent/active).
- `open full compare →` → the Render→Compare view.
- Decision cards are read; superseded ones stay linked (never removed).

## States
- **Loading:** skeleton the timeline + both right panels.
- **Only V1 (no diffs yet):** timeline shows V1; diff panel shows an empty "Render a pass to see a diff"; decision log shows "No decisions yet."
- **Render in progress:** the new version node is dashed (`Rendering…`) and resolves when the render commits.
- **No branches:** just the linear spine — fine.

## Responsive (reuse existing breakpoints)
- **Tablet:** timeline left, the diff + decision log stack on the right (or move below).
- **Mobile:** single column — timeline (compact) → semantic diff → decision log; `open full compare` goes to the stacked compare (51:3).

## Acceptance (browser-verified, headless + my eyeball)
- Matches Figma **6:79**: title, the version/branch timeline with the active node + in-progress dashed node, the semantic-diff preview (tags + compact diff), and the append-only decision log with status badges.
- **Real kernel data**: nodes are real `BuildVersion`s (active flag correct); the diff is real; the decision log is real `DecisionRecord`s. (The ~18 test versions from Render→Compare will show here — fine; consider a "latest N" view if it's noisy.)
- `open full compare →` reaches the Render→Compare mode; non-destructive framing holds (nothing deleted).
- **No console errors / no hydration flash** on hard refresh (Playwright) at desktop/tablet/mobile.
- Behind `scripton.osShell`; `old` restores the current revisions view. ScriptON naming + `/scripton` route.

## Out of scope (this screen)
The unified top bar + ⌘K (Phase 2). **CRDT branch/merge authoring is deferred (P0 decision)** — branches are **displayed** read-only from existing version lineage; creating/merging branches is a later phase. The `alt · Tragic ending` branch renders if such lineage exists, else just show the linear spine.
