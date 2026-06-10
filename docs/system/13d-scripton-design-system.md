# SYS-13d — ScriptON Design System (SON-DS)

**Status:** Adopted for ScriptON + ScriptON Audio (current phase). Candidate for platform-wide rollout (noted below).
**Source of truth:** the approved mockups
`docs/system/mockups/scripton-audio-ui-mockup.html` and `…/scripton-audio-screens-mockup.html`.

## What this is
The "one component, three form factors" language: a single set of design tokens + primitives that adapt by **container width** (not just viewport), so **web, tablet, mobile, and a future native shell share one codebase**. Light is default; dark is a class toggle. Built on the UX research in SYS-13c (Material 3 canonical list-detail layout, adaptive navigation rail → bottom nav, persistent transport/mini-player, ≥44px touch targets, `clamp()` fluid type, container queries).

## Where it lives (code)
- **Tokens + primitive CSS:** `frontend/src/app/scripton-ds.css` — scoped under `.son` (and `.son-dark`), imported once in `src/app/layout.tsx`. Nothing global is overridden; adoption is opt-in by adding the `.son` root.
- **React primitives:** `frontend/src/components/production/scripton/Son.tsx`
  - `SonRoot` — establishes tokens, `container-type`, theme state (persisted to `localStorage`), wraps a subtree.
  - `SonThemeToggle`, `SonShell`, `SonTabs`, `SonCard`, `SonChip`, `SonBtn`, `SonTransport`.

## Token reference (CSS variables, light → dark)
`--son-accent` charcoal `#0f172a` → sky `#38bdf8` · `--son-bg` `#f1f5f9` → `#0b1120` · `--son-surface` `#fff` → `#1e293b` · `--son-text` `#0f172a` → `#e2e8f0` · `--son-muted`, `--son-faint`, `--son-border`, `--son-hi` (karaoke), `--son-ok/info/warn/danger/violet`. Radius 16/10, `--son-tap` 44px, `--son-shadow`, fluid `--son-fs-title/-body`.

## Breakpoints (container queries, by the component's own width)
- **≤700px (compact / mobile):** list + inspector hide; bottom nav shows; single detail pane; `.son-hide-compact` hides secondary chrome.
- **701–1023px (medium / tablet):** icon rail + list-detail (2 panes); inspector folds away.
- **≥1024px (expanded / desktop):** rail + list + detail + inspector (3 panes).

Use `.son-content.has-list` and `.has-inspector` to opt a screen into the canonical list-detail grid.

## Primitives & usage
`SonShell > son-topbar (crumb + title + actions + SonThemeToggle) > SonTabs > son-content[.has-list[.has-inspector]] > .son-pane.son-list / .son-detail / .son-inspector > SonTransport (persistent) > son-bottomnav (compact only)`. Cards = `son-card`; list rows = `son-card son-row`; chips = `SonChip`; buttons = `SonBtn`/`son-btn(.is-primary)`; inputs = `son-input`.

## Adoption status
- **Done:** foundation CSS + React primitives; **ScriptON document-list view** re-skinned (themed cards/rows, theme toggle, container-query responsive). Old `PanelHeader`/`StatRow` chrome retired from that view.
- **Next slices (this phase):**
  1. **Binder + Reader** — wrap in `SonRoot`, convert header to `son-topbar`, sub-nav to `SonTabs`, add the persistent `SonTransport` to the reader, theme the viewer/right-rail.
  2. **ScriptON Audio screens** — Voice Casting, Render + cost preview, Audio Library, Sound Layers built directly on SON-DS (they already match the mockups 1:1).
  3. **Sub-panels/modals** (Sides, Lining, Tags, Procurement, Analyze, Audio notes) — restyle to `son-card`/`SonBtn` and theme tokens.

## Platform-wide rollout (LATER — noted, not scheduled)
SON-DS is intentionally generic. Because it's scoped under `.son` and ships as plain tokens + primitives, it can re-skin the rest of the platform without a rewrite:
- Promote `scripton-ds.css` tokens to a shared `design-system.css`; alias the existing `components/production/ui.tsx` kit (`Btn`/`Chip`/`Card`) onto SON primitives so all production panels inherit it.
- Replace the dashboard shell's bespoke rail/topbar with `SonShell`/`SonTabs`; adopt the bottom-nav pattern on mobile globally.
- Single light/dark source of truth (retire the older warm-neutral `.dark` layer in `globals.css`).
Decision: **adopt for ScriptON now; revisit a platform-wide migration after the ScriptON Audio MVP ships.**
