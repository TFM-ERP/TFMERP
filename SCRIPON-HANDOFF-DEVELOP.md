# ScripON · Develop — Design Handoff (screen 5, light re-skin)

_For Claude Code. **Light re-skin only** — Develop is the **existing Builder**, which already works and already renders in the OS shell. No new Figma frame (the design source is "existing"). Keep all builder logic; just make it OS-consistent. Behind the `scripon.osShell` flag. Route: `/scripon/studio?tab=builds` (Develop) + the Builder's `Adapt` / `Format` tabs._

## Why this is the lightest screen
You already verified (route-develop-highlight.png) that the rail's **Develop** opens `/scripon/studio?tab=builds`, highlights correctly, and shows the Builder inside the new OS shell. So the screen is reachable and functional. This pass is **polish for OS consistency**, not a rebuild.

## What exists (reuse — do NOT rebuild)
`ScripOnStudio.tsx` = the Builder: **Builds** list (filter pills `All · Draft · Review · Greenlit · Promoted`, `Active`/`Bin` toggle, build cards with `Open script` / `Develop` / `Settings` / delete, and a `+ New build` tile), plus the **Develop** (the ladder), **Adapt**, and **Format** tabs, and the `ScriptPaper` viewer. Tablet/mobile variants exist. All engines run via the page — leave them alone.

## The re-skin asks (light touch)
1. **Single shell, reachable, highlighted** — confirm Develop opens the Builder in one OS shell (no double rail), Develop highlights, and `?tab=builds` vs the bare `/scripon/studio` both behave (Develop owns this path now per the Studio route fix).
2. **Drop the vestigial modal affordance** — the Builder's top bar shows a **`Close`** button (left over from when it was an overlay). In the OS, Develop is a **persistent workspace**, not a modal — remove `Close` (or repurpose it to route Home / last route). Keep `+ New build`.
3. **OS header + token consistency** — align the `Development builds` header and the `Builds / Develop / Adapt / Format` tabs to the OS look (Fraunces title + sub-line, cinematic dark/gold tokens), and make the build-card status pills consistent with Home/Doctor (full-text rev labels — carry the prior polish; no 10-char truncation).
4. **Keep all Builder logic** — build CRUD, Open script, the Develop ladder, Adapt (source → directions), Format (target → episode map), promote-to-project. No engine or data changes.

## Data wiring
No change — the Builder already fetches its real builds/versions. Don't add a data layer; don't mock.

## States
Keep the existing states (empty builds → the `+ New build` tile; Bin view; per-build status). Just re-skinned.

## Responsive (re-skin existing tablet/mobile)
`ScripOnStudioTablet` / `ScripOnStudioMobile` — keep the breakpoint logic, apply the same light token/header polish. Build cards stack; tabs collapse to a select/segmented control on mobile.

## Acceptance (browser-verified, headless + my eyeball)
- Develop opens the Builder from the rail, highlights, **single OS shell**.
- No `Close`/modal vestige; header + tabs + pills read OS-consistent (Fraunces, cinematic tokens, full-text labels).
- All Builder actions still work (new build, open script, develop/adapt/format, promote).
- **No console errors / no hydration flash** on hard refresh (Playwright) at desktop/tablet/mobile.
- Behind `scripon.osShell`; `old` restores the current Builder presentation.

## Out of scope (this screen)
The unified top bar (Phase 2) and any deeper Builder redesign — the Builder already works, so this is a light cosmetic pass only. The Brief/intake redesign (6-step rail, civilisation-timeline picker, research-online toggle, Package "spine" view) is a **separate, larger future effort** — not part of this Group-A re-skin.
