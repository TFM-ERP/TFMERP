# ScriptON · Unified Top Bar — Build Handoff (fidelity P0)

_For Claude Code. Build the shared global **top bar** that sits across all nine workspaces — the single biggest fidelity uplift from the audit. Behind `scripton.osShell`. Design authority: the top bar present on **every** Figma frame in `dqUr3nasAkQIdefXcGDSyi` (e.g. Home `6:233`, Write `1:2`, Doctor `38:2`, Canon `6:2`). **The ⌘K command palette is deferred** — build the search field's *look* only._

## Goal
Today each workspace renders its own thin per-page header. The Figma gives all nine the same polished global bar. Replace the per-page headers with **one shared `ScriptonTopBar`** rendered once in the OS shell, above the workspace content. Keep each screen's in-content page title (e.g. "Doctor · Coverage…") — the top bar sits *above* it.

## Layout (matches the bar on every frame, left → right)
- **Left cluster:** the **TFM** gold tile (click → Home / back to FilmOS) · **ScriptON** wordmark · a **breadcrumb** = the active script/workspace (e.g. `Antarah`).
- **Center:** the **global search field** — pill input, placeholder `Search scenes, characters, decisions — or run a command`, with a `⌘K` hint chip on the right. **Visual only for now** (see Deferred).
- **Right cluster:** a **continuity ring** (e.g. `96%`, green progress ring) · a **V-switcher** (`V{n} ▾`) · **collaborator avatars** (small colored initials, e.g. QC/AB/RM, max ~3 + overflow) · a **share/export** icon button.

Cinematic dark + gold tokens; height ~56–60px; match the frame's padding, the ring stroke, the pill radius, the avatar size. Sticky at the top of the content area, full width to the right of the rail.

## Data wiring (reuse — degrade gracefully)
| Element | Source |
|---|---|
| breadcrumb | the active/bound script (عنترة etc.) — same context the screens already resolve; fall back to the workspace name |
| continuity ring | the kernel continuity for the active script (`continuityScore` / canon continuity); **hide the ring** if the kernel has no score yet (don't show a fake %) |
| V-switcher | the active `BuildVersion` + a dropdown of the script's versions → selecting one routes to Versions / Render→Compare (`?pass`/`?from&to`) |
| avatars | the script's members from Access & roles / the members system; placeholder initials only if none |
| share / export | the existing protected-export / share flow (the same one Studio uses) |
| TFM tile | Home (`/scripton`) on click; the existing "back to FilmOS" affordance on long-press/secondary if kept |

## Replace, don't stack
- Remove each workspace's existing **minimal top header strip** (the `TFM · {proj} · {rev pill}` row) — the shared bar supersedes it. Keep the in-content **page title** block (`Doctor`, `Canon`, etc.).
- Hoist the bar into the OS shell (the `(dashboard)` shell / the place the rail is rendered) so it renders **once** for all `/scripton/*` routes — not per page. Verify no double-header on any of the nine.

## States
- **Loading:** skeleton the breadcrumb + ring + avatars.
- **Kernel inert / no score:** continuity ring hidden (not 0% or fake).
- **No members:** avatars show a single placeholder or hide.
- **No versions yet:** V-switcher shows `V1` (or hides the dropdown).

## Responsive
- **Tablet:** collapse the search field to an icon; keep ring + V-switcher + avatars.
- **Mobile:** TFM + breadcrumb + a search icon + an overflow (⋯) holding ring/versions/share; per the responsive frames.

## Deferred (do NOT build now)
The **⌘K command palette** (Figma `27:2`) — the dropdown/search behavior. Build the search **field's appearance + the ⌘K hint** for fidelity, but wire it to a harmless no-op (or focus only) for now. The palette is a separate later task.

## Acceptance (browser-verified, headless + my eyeball)
- One shared bar renders on **all nine** workspaces, matching the Figma bar (left/center/right clusters, ring, V-switcher, avatars, share).
- Per-page minimal headers are gone; **no double header**; in-content page titles intact.
- Real data where it exists (breadcrumb, continuity, versions, members, share); graceful degrade where it doesn't — **no fake numbers**.
- Responsive collapse works at tablet/mobile.
- **No console errors / no hydration flash** on hard refresh across all nine routes.
- Behind `scripton.osShell`; `old` unaffected. ScriptON naming throughout.

## Out of scope
The ⌘K palette behavior (deferred). The per-screen pixel polish, populate, and token-layer work are separate audit items — this handoff is the top bar only.
