# ScriptON · Develop — Implementation Build Order (design → live)

_For Claude Code. How to ship the new **Develop** design + functionality from `SCRIPTON-HANDOFF-DEVELOP-REDESIGN.md` (v2). Same discipline as the pixel-fidelity method (READ the node → SET the CSS → OVERLAY-verify ~99%), but Develop is a **structural rebuild with new behavior**, so it's build-then-verify per slice. Everything behind `scripton.osShell`; `old` restores the current Builder. Design file `dqUr3nasAkQIdefXcGDSyi`._

## Gate 0 — Foundation (do first; blocks every slice)
1. **#40 shared tokens** — read the design's real hexes + type ramp (`get_variable_defs`) into one source of truth (CSS vars / Tailwind). Develop's set is enumerated in the handoff §8; reconcile against the variable defs, don't hand-roll.
2. **Exact fonts** — Fraunces SemiBold · Rubik Regular/Medium/SemiBold · Courier Prime Regular **and Bold**.

The ScriptPaper proof (node `7:14`, commit `b51fef1`) already validates the read→set→verify path — and Develop **reuses that exact ScriptPaper** for the Draft stage, so that work is banked.

## The Develop build — slices (each = READ its node → SET → browser-verify vs the frame, one commit)
**A · Top bar** (`69:2` TopBar) — the unified bar **minus the global search**; put the **Develop** title + sub, centered, in the freed slot. Rail item = **Build** (already in `os-workspaces.ts`).

**B · Two-pane shell** (`69:2`) — ladder rail (left) · stage canvas (center) · right context = The spine + Comparables. Wire to the **real** develop stages, agreed brief, and comps — no mocks.

**C · Per-stage canvas** (`96:2` Draft, `99:2` Synopsis, + Scenes / Step Outline / empty) — render the focused stage **by kind**: prose · **Reader script paper (reuse the fixed ScriptPaper)** · scene cards · numbered steps · "Not written yet". Render markdown-clean (#47 — no `**` / `---` / stray `\n`).

**D · Ladder + controls** — the **8**-stage ladder (no Script stage); counters `N / 8` (ladder header, pipeline footer, canvas head); the live **status bar** (`genBusy` + real progress %); per-stage version `‹ Vn ›` · regenerate `⟳` · `Generate {next} →` · Draft's `↗ Generate script → Library` (opens the separate render screen).

**E · Render screen — add border-glow only** (`ScriptOnBuildScreen`) — the render screen **already exists as its own standalone screen; don't rebuild, restyle, or move it.** The only task: wrap its card in the user's `border-glow-card` component and drive it **`sweep-active` while rendering** (holographic + gold glow, `--glow-color: hsl(40 80% 80%)`; off when idle; static under reduced-motion). Full spec: `SCRIPTON-HANDOFF-DEVELOP-GENERATING-OVERLAY.md`. Independent of A–D/F. (#48 watchdog stays its own task.)

**F · Responsive** — Tablet (`78:2` Draft, `115:2` Synopsis, 834w): condensed bar (no search), **horizontal chip-strip ladder**, full-width canvas, spine + comps **side-by-side**. Mobile (`80:2`, 390w): single column, chips wrap, context **stacked**, script paper horizontally scrollable. Verify at **834** and **390**.

## Gate 1 — Verify (before moving on)
Overlay-compare each built frame to its node (~99%); browser-verify at desktop / 834 / 390; everything wired to real develop data; behind `scripton.osShell`; ScriptON naming + `/scripton`. Commit per slice.

## Sequencing vs the rest of the app
Develop is the deepest-changed screen and is fully designed, so build it **right after Gate 0**. Then resume Claude Code's per-screen **pixel pass** across the node map for the others (Doctor `38:2`, Room `6:156`, Home `6:233`, Canon `6:2`, Versions `6:79`, Compare `31:2`, Studio `38:198`, Slate, Write `1:2`) — pure read→set→verify, no structural change.

## Kickoff
Start **Gate 0** (#40 tokens + exact fonts), then Develop **slice A**. One slice per commit, flag-gated, verified against its node before the next. The "what/where/exact-values" for every slice is `SCRIPTON-HANDOFF-DEVELOP-REDESIGN.md`.
