# ScriptON · Render → Compare — Design Handoff (screen 8 · Group B, kernel-backed)

_For Claude Code. Build the **Render → Compare** view — the post-render V↔V semantic diff + the render summary — behind the `scripton.osShell` flag. It lives **inside the Versions workspace** (the rail shows **Versions** active). Design authority: Figma `dqUr3nasAkQIdefXcGDSyi` node **31:2** + responsive **51:3** (Compare stacked). Route: `/scripton/revisions` (compare mode). Names are post-rename (`ScriptOn*`, `/scripton/*`)._

## Purpose
This is what you land on after hitting **Render** in Write: it shows *what the commit did* — the new version vs the previous, side by side — and lets you make the new version active, keep the old, or discard. Non-destructive: the previous version is always preserved.

## What exists (reuse — do NOT rebuild)
- `ScriptOnRevisions.tsx` (+ Tablet/Mobile) — the current Versions surface; this Render→Compare is a **mode within it**.
- `ScriptPaper` (the shared paper renderer) — reuse for **each** of the two diff columns.
- The **Slice-4 render result** (`POST …/revision-pass/:passId/render`) already returns the render outcome — new `BuildVersion`, applied `SceneChange`s, `CanonFact`s written, the `DecisionRecord`, and the auto-fix bridge. **Reuse that payload** for the summary panel; don't recompute it.
- The kernel `BuildVersion` (active flag) for activation; `revisionPass`/version APIs in `lib/api.ts`.

## Layout (desktop — matches frame 31:2, content area right of the rail)
1. **Header banner:** ✓ `Rendered V{new}` · `from the Revision Pass · {k} changes applied · continuity {score}% · {n} auto-fix`. Right: `Discard V{new}` (red ghost) · `Keep V{prev} active` · gold `✓ Set V{new} active`.
2. **Two-column diff:**
   - **Left — `V{prev} · previous (active)`:** the prior version's scenes (ScriptPaper); changed lines struck through in **red**.
   - **Right — `V{new} · rendered`:** the new version's scenes (ScriptPaper); changed lines highlighted in **green** with a left accent bar.
   - Only the **changed scenes** show the diff treatment; unchanged scenes render plainly. Align the two columns scene-for-scene.
3. **Right — THIS RENDER ({score}%):**
   - `APPLIED · {k} CHANGES` — the applied `SceneChange`s, each green-checked (`Scene 12 · strengthen setup`, …).
   - `CANON WRITTEN` — the `CanonFact`s this render wrote, each with its validity (`Amalekites → allies (valid from S40)`).
   - `DECISION RECORDED` — the `DecisionRecord` (`Render pass · {k} changes — Accepted`).
   - `AUTO-FIX APPLIED` — the inserted bridge (`DAWN time-bridge inserted (S64 night → S65 dawn)`).
   - Footer note: `V{prev} is preserved and still readable. Switch the active version back anytime — nothing was overwritten.`

Cinematic dark + gold tokens (same set as the other screens).

## Data wiring (reuse the kernel render result — do NOT mock)
| Region | Source |
|---|---|
| Header (version, changes applied, continuity, auto-fix count) | the Slice-4 render result payload |
| Left/right columns | the two `BuildVersion`s' scene text (prev = previously active, new = just rendered) via `ScriptPaper` |
| Diff highlighting | the changed scenes = the applied `SceneChange`s; line-level red(removed)/green(added) — compute via a thin compare (line diff on the changed scenes' text), or a small `GET …/compare?from&to` if cleaner |
| APPLIED changes | applied `SceneChange`s from the render result |
| CANON WRITTEN | the `CanonFact`s written by this render (subject/statement + `valid from S{validFrom}`) |
| DECISION RECORDED | the render's `DecisionRecord` |
| AUTO-FIX | the bridge from `orderChanges` |
| Set active / Keep / Discard | flip the `BuildVersion` active flag (non-destructive); Discard marks the new version discarded; prev is never overwritten |

## States
- **Reached after a render:** shows that render's result (the normal path from Write).
- **Reached cold (no render in context):** fall back to a **version picker** — choose two versions to compare — which doubles as the bridge into the Versions list (next screen). Don't dead-end.
- **Activation:** `Set V{new} active` flips active and confirms; `Keep` leaves prev active; `Discard` drops the new version after a confirm. All reversible (prev preserved).
- **Loading:** skeleton both columns + the panel.

## Responsive (frame 51:3 — Compare stacked)
- **Tablet/Mobile:** the two columns **stack** (prev above, new below — or a prev/new toggle), with the THIS RENDER panel below; the header controls collapse but `Set active`/`Keep`/`Discard` stay reachable. Match 51:3.

## Acceptance (browser-verified, headless + my eyeball)
- Matches Figma **31:2**: header banner + controls, the two-column V↔V diff (red removed / green added on changed scenes), the THIS RENDER panel (applied / canon written / decision / auto-fix), the "preserved" note.
- **Real kernel data**: the diff is two real `BuildVersion`s; the panel reflects the real render result (applied changes, the `CanonFact`s written — cross-check they match the Canon screen, the `DecisionRecord`, the auto-fix bridge).
- Activation flips the active version **non-destructively** (prev still readable after); Discard is confirm-gated.
- Columns reuse `ScriptPaper`; the screen is a mode of the Versions workspace (rail shows Versions active).
- **No console errors / no hydration flash** on hard refresh (Playwright) at desktop/tablet/mobile (stacked per 51:3).
- Behind `scripton.osShell`; ScriptON naming + `/scripton` route.

## Out of scope (this screen)
The unified top bar + ⌘K (Phase 2). The full **Versions** list/history/decision-log view is the **next** handoff (frame 6:79) — same workspace; this one is the compare/render-result mode. CRDT branch/merge (deferred).
