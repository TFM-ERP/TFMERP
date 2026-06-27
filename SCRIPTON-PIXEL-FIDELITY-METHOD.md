# ScriptON · Pixel-Fidelity Method — "Read the exact Figma node → set the exact CSS"

_The standard process for making every live screen match its Figma frame to ~99%. Measured, never eyeballed. Design source: Figma `dqUr3nasAkQIdefXcGDSyi`._

## The principle
Every visual value in the app comes from **a real measurement of the Figma node**, not from a screenshot or a description. If a number isn't read from Figma, it isn't set.

## Order of work
1. **Tokens first (#40).** Read the design's primitives once and put them in ONE source of truth (CSS variables / Tailwind config): the exact color hexes, the type ramp (family + weight + size per role, incl. **Courier Prime 12.5px** script, Fraunces titles, Rubik body), the spacing scale, radii, shadows. Every component then references tokens — no hand-rolled per-screen values.
2. **Fonts.** Load the exact families + weights used in the frames — **Fraunces** (SemiBold), **Rubik** (Regular/Medium/SemiBold), **Courier Prime** (Regular **and Bold**). A fallback or wrong weight breaks fidelity instantly.
3. **Per-screen pixel pass (#43).** Screen by screen, run the loop below.

## The per-screen loop
For each screen (and each key sub-element):
1. **Read** the Figma node's exact specs — via Figma Dev Mode `get_design_context` (or a `use_figma` read): `fontName` (family+style), `fontSize`, fill **hex**, `lineHeight`, `letterSpacing`, padding, x/y position & indents, width, `cornerRadius`, effects (shadow).
2. **Set** the component's CSS to those exact values, referencing the shared tokens from step 1.
3. **Verify** — put the live screen beside the Figma node at the **same zoom** and compare: type size, weight, color, line rhythm, margins/indents, radii, shadows, icon choice, panel proportions. Correct until the difference is invisible (~99%).
4. Behind `scripton.osShell`; browser-verify at the screen's breakpoints (desktop + iPad portrait + mobile).

## Figma node map (screen → node to measure against)
| Screen | Desktop node | Responsive |
|---|---|---|
| Write (+ ScriptPaper `7:14`) | `1:2` | `46:3` |
| Home / Slate | `6:233` | — |
| Develop | `69:2` | `78:2` (tablet ⟂), `80:2` (mobile ⟂) |
| Canon | `6:2` | — |
| Doctor | `38:2` | — |
| Versions | `6:79` | — |
| Render → Compare | `31:2` | `51:3` |
| Room | `6:156` | `49:3` |
| Studio | `38:198` | — |
| ⌘K palette | `27:2` | (Phase 2) |

## Acceptance bar
~**99%** per screen — literal 100% is rare (browser font-hinting/sub-pixel), but the gap becomes **invisible at normal viewing**. Each screen signs off by an overlay comparison against its node, not a vibe check.

## Start
Screen 0 is the **ScriptPaper proof** (`SCRIPTON-HANDOFF-SCRIPTPAPER-PIXEL.md`, node `7:14`) — it validates the method on the element that's most visibly off today. Once it lands pixel-true, run tokens (#40) → then the per-screen loop across the map above.
