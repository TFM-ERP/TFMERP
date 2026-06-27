# ScripON · Home — Design Handoff (screen 1)

_For Claude Code. Build the **Home/Slate** workspace behind the `scripon.osShell` flag, reusing existing data; rebuild the layout to the Figma. Design authority: Figma `dqUr3nasAkQIdefXcGDSyi` (Home frame) + `design-tmp/scripon-v4-revision-pass.html` for the cinematic tokens. Route: `/scripon` (the OS Home)._

## Purpose
The landing of the OS: greet, resume the last script, show the slate of all scripts, and a live activity feed. Low kernel dependency — wires to existing project/library/activity data; the kernel-derived bits (continuity %, render/decision activity) degrade gracefully if the kernel is inert.

## Layout (desktop, content area right of the rail)
Three regions, top to bottom / left-right:

1. **Greeting** (top): `Good evening, {firstName}` (Fraunces) + sub-line `{N} active scripts · {M} rendering · {K} notes need you`.
2. **Continue hero** (full-width card under the greeting): the **last-opened script** — poster tile, eyebrow `CONTINUE WHERE YOU LEFT OFF · {lastWorkspace}`, title, meta (`format · genres · V{n} · {staged} changes staged`), a continuity line (`{score}% canon continuity` with a small ring), and a primary **Continue →** button routing to that script's last workspace (default Write).
3. **Left column — "Your Slate":** a label + a grid of **script cards** (one per script), each: poster strip (gradient), title, format badge, coverage grade pill, `V{n} · {lastEdited}`, and an `ACTIVE` tag on the current one. Click → opens that script (Write).
   **Right column — quick actions + activity:** `＋ New build` (→ Develop/Builder) and `↥ Import script` (→ import flow) buttons; below, an **Activity feed** — recent items with a colored dot + text + timestamp.

(Match the Figma Home frame for exact spacing/sizing; cinematic dark + gold tokens from `globals.css`.)

## Data wiring (reuse — do NOT mock)
| Element | Source |
|---|---|
| `firstName` | existing auth/`me` |
| active/rendering/notes counts | existing scripts list + `RevisionPass` status (rendering) + notes/`CoverageNote` count; if kernel inert, omit the `rendering` count gracefully |
| Continue hero = last-opened script | most-recent `DevelopmentBuild`/script (existing "recent" or sort by `updatedAt`); its version from `BuildVersion`, continuity from canon if available else hide the % |
| Slate cards | the existing **library/projects** list API (what `/scripon/library` uses today) — title, format, coverage grade, version, `updatedAt`, poster/initial |
| Activity feed | existing audit/activity (renders, notes, shares) + kernel `DecisionRecord`/canon writes where present; render only the item types that have data |
| New build / Import | existing Builder entry (`/scripon/studio?tab=builds`) and the existing import flow |

## Component reuse
Reuse the existing card/list primitives and data hooks the current Library/Dashboard pages use; reuse `CinematicHeader` tokens for the greeting. Build the hero + slate cards + feed as presentational components fed by the existing data — no new data layer.

## States
- **Loading:** skeletons for the hero + cards + feed (reuse existing skeleton pattern).
- **Empty (no scripts):** hero collapses to a "Start your first script" CTA (→ New build); slate shows an empty-state card; feed shows "Nothing yet."
- **No last-opened:** hide the Continue hero (or show the newest script instead).
- **Kernel inert:** continuity % and kernel-only activity items simply don't render — never a broken widget.

## Responsive (reuse existing breakpoints)
- **Tablet:** slate cards 2-up; activity moves below the slate.
- **Mobile:** single column, stacked — greeting → Continue hero → slate (1-up) → New/Import → activity; per the on-set "review-first" priority.

## Acceptance (browser-verified, headless + your eyeball)
- Matches the Figma Home frame (layout, tokens, the cinematic look).
- All regions show **real data** from the existing APIs (not placeholders).
- `Continue →` and a slate card open the right script; `New build`/`Import` route correctly.
- Loading/empty/kernel-inert states all render without errors.
- **No console errors / no hydration flash** on hard refresh (Playwright check), at desktop/tablet/mobile.
- Behind the `scripon.osShell` flag; `old` restores the previous Home.

## Out of scope (this screen)
The full-width unified top bar (Phase 2) and the kernel-backed deep features. Home only needs to read existing data + the kernel where it already exists.
