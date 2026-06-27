# ScripON · Doctor — Design Handoff (screen 2)

_For Claude Code. **Re-skin** the existing Doctor workspace at `/scripon/doctor` to the Figma, behind the `scripon.osShell` flag. This screen is already fully wired to real APIs and already responsive — **do not rebuild the logic; re-lay-out the shell.** Design authority: Figma `dqUr3nasAkQIdefXcGDSyi` node **38:2** (Doctor frame). Route: `/scripon/doctor`._

## What already exists (reuse — do NOT rebuild)
`frontend/src/app/(dashboard)/scripon/doctor/page.tsx` + `ScripOnDoctor.tsx` / `ScripOnDoctorTablet.tsx` / `ScripOnDoctorMobile.tsx` already fetch and render **real** coverage, gauges, diagnostics, analytics, and living notes, and already open the rewrite/budget/comps/package/history/format surfaces. Keep all of that data wiring and all the surface modals. The job is purely the **visual + IA re-skin** to match the Figma frame.

## The one structural change: tabs → single dashboard
The current page uses a `Coverage | Diagnostics` tab switch. **The new Doctor shows everything on one canvas — no tabs.** Coverage scorecard + emotional arc on the **left**; diagnostics/continuity + fixes/transforms on the **right**. The modal surfaces (rewrite slate, budget-fit, comps, package, history, format) stay as overlays, triggered from the transform tiles and "Full report →".

## Layout (desktop — matches frame 38:2, content area right of the rail)
Top to bottom:

1. **Title block:** `Doctor` (Fraunces) + sub-line `Coverage · diagnostics · continuity · fixes — running on canon`.
2. **Verdict banner** (full-width card): grade chip (e.g. `B+`, colored) · recommendation pill (`CONSIDER`/`RECOMMEND`/`PASS`, colored) · the **logline** (one line). Right side: `Comps: {a · b}` and a `Full report →` link.
3. **Two-column grid:**
   - **Left col — Coverage:**
     - **Coverage Scorecard** panel: a row of 5 grade tiles — **Plot · Characters · Dialogue · Structure · Market** (big colored grade per tile) → a short prose **summary** line under them → a **SCENE FLOW** mini bar-chart (per-scene bars, colored green/gold/red by health).
     - **Emotional Arc — {title}** panel: a line chart, x-axis `fear → resolve → triumph`; **gold solid = after the staged pass, dotted = current**; caption explains the overlay.
   - **Right col — Diagnostics + Fixes:**
     - **Diagnostics & Continuity** panel: a list of scene rows (`S65 · the cliff climb` + one-line note + a `KEEP`/`CONSIDER` tag), then a **Conflict Detector** sub-card (`S12 "fears heights" vs S65 climb — resolved by the staged pass ✓`).
     - **Fixes & Transforms** panel: header + `one click → stages a non-destructive change in the pass`. A **2×4 grid of transform tiles**, each = colored dot + small descriptor + bold name: **Tighten** (trim the fat) · **Punch-up** (sharpen lines) · **Genre transpose** (shift the tone) · **Re-engineer ending** (10 ending types) · **Budget-fit** (hit a target) · **Emotion re-key** (reshape the arc) · **Humour injection** (by culture) · **Add / remove character** (redistribute).

Cinematic dark + gold tokens from `globals.css` (the same set Home uses).

## Data wiring (reuse the existing effect in `doctor/page.tsx` — do NOT mock)
| Region | Source (already in the page) |
|---|---|
| project + active revision | `productionApi.projects.list()` → `pickScriponProject` → `productionApi.script.list(projId)` → `script.getRevision(revId)` |
| Verdict banner (grade, rec, logline, comps) + Scorecard tiles + summary | `productionApi.scripton.latestCoverage(projId)` via existing `buildCoverage()` / `buildGauges()` |
| SCENE FLOW + Emotional Arc | `productionApi.scripton.analytics(projId)` → `pacing.perScene`, `structure.turningPoints` |
| Diagnostics & Continuity rows | `productionApi.scripton.diagnostics(projId, {revisionId})` → `scenes` (existing `runDiag`) |
| Conflict Detector + "after staged pass" arc overlay + "running on canon" | **kernel** (continuity / `detectConflicts`) — degrade gracefully if the kernel migration isn't applied on this branch |
| Transform tiles | existing `onAction(k)` → `ScripOnRewriteSlate` (kinds `tighten`/`punchup`/…), `ScripOnBudgetFit`, `ScripOnFormatPanel`, `ScripOnCompsDeck` |
| `Full report →` | existing package/exportpdf (`ScripOnPackagePanel` or `/print/coverage?projectId=`) |
| empty-state "Generate" | `productionApi.scripton.coverage(projId, {revisionId})` |

**Transform-tile mapping:** wire each tile to its existing `onAction` kind where one exists (Tighten→`rewrite`/tighten, Punch-up→`punchup`, Budget-fit→`budgetfit`, Genre transpose→`format`). For tiles without a built transform yet (Re-engineer ending, Emotion re-key, Humour injection, Add/remove character), render the tile and route to the rewrite slate with the right kind **or** keep the existing "Coming soon" flash — match current `onAction` behavior, don't invent a backend.

## States (keep the existing guards)
- **Loading:** skeleton the banner + the four panels (reuse existing skeleton/sample-muted pattern).
- **No project / no parsed script:** keep the current graceful behavior — neutral gauges + the existing toast (`Connect a project with a parsed script to …`). Don't crash a panel.
- **Kernel inert:** the Conflict Detector sub-card and the gold "after staged pass" arc overlay simply don't render (show current-arc only, hide the conflict card or show "No continuity conflicts"); `running on canon` can read `grounded in your pages`. Never a broken widget — same rule as Home.

## Responsive (re-skin the existing tablet/mobile components)
`ScripOnDoctorTablet` / `ScripOnDoctorMobile` already exist — re-skin them to the new look, don't replace the breakpoint logic. Tablet: the two columns stack (Coverage block, then Diagnostics/Transforms). Mobile: single column — verdict → scorecard → scene flow → diagnostics → transforms (2-up tiles) → arc last. Match the `Responsive · *` intent from Home.

## Acceptance (browser-verified, headless + my eyeball)
- Matches Figma **38:2**: verdict banner, 5-tile scorecard + scene-flow, emotional arc, diagnostics/continuity + conflict detector, 2×4 transforms grid.
- **No tabs** — single dashboard canvas.
- All regions show **real data** from the existing `scripton` APIs (not the SAMPLE_* placeholders) when a project/script is connected; placeholders only as the documented empty state.
- Every transform tile and `Full report →` opens the correct existing surface; the empty-state toasts still fire.
- Kernel-inert path renders cleanly (no conflict card / no overlay, no errors).
- **No console errors / no hydration flash** on hard refresh (Playwright), at desktop/tablet/mobile.
- Behind `scripon.osShell`; `old` restores the current tabbed Doctor.
- Carry the Home polish: rev/label pills show full text (no 10-char truncation).

## Out of scope (this screen)
The unified top bar (TFM · breadcrumb · global ⌘K search · continuity ring · V-switcher · avatars · share) shown across the top of the frame is **Phase 2** — same as Home. Build the Doctor content area only; the rail is already in place from the cutover.
