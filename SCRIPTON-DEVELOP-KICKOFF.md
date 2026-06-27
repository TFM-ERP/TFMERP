# ScriptON · Develop — Implementation Kickoff (START HERE)

_The complete package to ship the new **Develop** design + functionality (desktop, all stage states, the in-screen render overlay with the glow border, tablet, mobile). Hand this set to Claude Code. Behind `scripton.osShell`; design file `dqUr3nasAkQIdefXcGDSyi`._

## The docs (read in this order)
1. **SCRIPTON-DEVELOP-BUILD-ORDER.md** — the **sequence**: Gate 0 (tokens + fonts) → Develop slices A–F → verify → the rest of the app.
2. **SCRIPTON-HANDOFF-DEVELOP-REDESIGN.md** — the **spec**: what/where/exact values for every frame + stage state, keyed to node IDs. Section 0 = "read the node for exact numbers" (this is what makes any manual Figma edit land in the build).
3. **SCRIPTON-HANDOFF-DEVELOP-GENERATING-OVERLAY.md** — **slice E**: **add the `border-glow-card`** to the existing standalone render screen (it already exists — just the glow + drive code). The #48 watchdog stays its own task.
4. **SCRIPTON-PIXEL-FIDELITY-METHOD.md** + **SCRIPTON-HANDOFF-SCRIPTPAPER-PIXEL.md** — the read→set→verify loop + the ScriptPaper (already proven, commit `b51fef1`; **reused** for the Draft stage).

## Order of operations
**Gate 0** (#40 shared tokens via `get_variable_defs` + exact fonts: Fraunces / Rubik / Courier Prime incl. Bold) → **A** top bar (unified minus search, centered title) → **B** two-pane shell (real data) → **C** per-stage canvas by kind (incl. Reader script paper) → **D** 8-stage ladder + status bar + counters + version/regenerate/advance/promote → **E** add the border-glow to the existing standalone render screen → **F** responsive (tablet 834 / mobile 390). One slice per commit, flag-gated, each **verified against its node** before the next.

## Develop node map
| State / width | Frame |
|---|---|
| Desktop — Coverage (active/generating) | `69:2` |
| Desktop — Draft (Reader script view) | `96:2` |
| Desktop — Synopsis (early prose) | `99:2` |
| Desktop — Script · generating (bokeh + glow) | `103:2` (card `104:11`) |
| Tablet portrait — Draft / Synopsis | `78:2` / `115:2` |
| Mobile portrait — Coverage | `80:2` |

All frames show the **8-stage** ladder (`Logline · Synopsis · Treatment · Beats · Scenes · Step Outline · Draft · Coverage`). Generating the script is the `↗ Generate script → Library` action → the separate render screen, **not** a ladder stage.

## What's new vs today's Builder (so nothing's a surprise)
- Two-pane workspace (ladder rail + stage canvas + spine/comps) replacing the flat ladder list.
- Per-stage canvas content (prose / **script paper** / scene cards / step list / empty) + a live **status bar** with `%` and `N/8` counters.
- Generating the script = the `↗ Generate script → Library` action → the **existing standalone render screen** (not a ladder stage).
- Slice E just **adds the glowing border** to that render screen (no rebuild).
- Responsive tablet (chip-strip ladder, 2-col context) + mobile (stacked).

## Kickoff line (paste to Claude Code)
> Build the new **Develop** screen behind `scripton.osShell` (ScriptON naming, `/scripton`). Figma `dqUr3nasAkQIdefXcGDSyi` is the source of truth — **read each node directly** for exact values. Start **Gate 0** from `SCRIPTON-DEVELOP-BUILD-ORDER.md` (`#40` tokens via `get_variable_defs` + exact fonts: Fraunces / Rubik / Courier Prime incl. **Bold**), then slices **A→F** from the build-order, using `SCRIPTON-HANDOFF-DEVELOP-REDESIGN.md` for exact values. The ladder is **8 stages** (`Logline…Coverage` — **no Script stage**). **Slice E** = just add the `border-glow-card` to the **existing standalone** render screen (`SCRIPTON-HANDOFF-DEVELOP-GENERATING-OVERLAY.md`) — don't rebuild it; #48 stays its own task. One slice per commit, flag-gated, verified against its node before the next.
