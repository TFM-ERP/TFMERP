# ScriptON · ScriptPaper — Pixel-Exact Rebuild (the Write-page proof)

_For Claude Code. Rebuild the script paper to **match the Figma exactly** — measured, not eyeballed. This is the proof for the pixel-fidelity method; if it lands, we roll the same Dev-Mode-driven pass across every screen. Design authority: Figma `dqUr3nasAkQIdefXcGDSyi` node **7:14** (the Write paper) + its children. Behind `scripton.osShell`._

## Why this is needed
The live `ScriptPaper` inherited the **old Reader's** CSS — Courier Prime **14.5px**, line-height **1.62** — but the Figma is **12.5px** with **Bold sluglines** and tighter rhythm. So the page reads bigger/looser than the design. Set the exact values below.

## Exact specs (measured from node 7:14)
**The sheet**
- Background `#F7F4EC` · `border-radius: 6px`
- `box-shadow: 0 30px 60px -18px rgba(0,0,0,0.55)`
- Content width ~**620px** (A4 column); padding **top 40px · left 48px · right 62px** (→ a ~510px text column) · bottom ~48px.

**Type — Courier Prime throughout**, ink `#23231f`, font-size **12.5px**, line height **22px** (≈1.76 — this is the design's line rhythm; one blank line between blocks ≈ **44px**).
- **Slugline** (`64  EXT. RIDGE — NIGHT`): Courier Prime **Bold** 12.5px, `#23231f`, at the left margin (48px). 22px to the action below it.
- **Action**: Courier Prime Regular 12.5px, `#23231f`, left margin 48px, column width ~510px.
- **Character cue** (`ANTARAH`): Courier Prime Regular 12.5px, **indented ~148px from the action margin** (≈196px from the sheet's left edge; ≈ 20ch in monospace).
- **Dialogue**: Courier Prime Regular 12.5px, **indented ~102px from the action margin** (≈150px from the left edge; ≈ 13.5ch), column width ~330px (≈ 44ch).
- **Page number** (top-right, e.g. `14.`): Courier Prime Regular **11px**, `#6b727d`, pinned ~16px from the top and right edges.

Courier is monospace, so express indents in **`ch`** for robustness (1ch ≈ 7.5px at 12.5px). Standard screenplay element classes map cleanly: slugline (bold), action (full), character (indent ~20ch), dialogue (indent ~13.5ch / width ~44ch), parenthetical (between cue & dialogue), transition (right-aligned) — keep the same element model the Reader already parses, just re-tuned to these numbers.

## What to change
Rebuild `ScriptPaper`'s CSS to the values above (don't keep the Reader's 14.5px/1.62). Keep the component's parsing/pagination logic; only the **presentation metrics** change. Apply wherever `ScriptPaper` renders (Write canvas + the Reader), behind the flag.

## Acceptance
- Open Figma node **7:14** beside the live Write page at the same zoom; the script paper matches to **~99%** — font size, the **Bold sluglines**, line rhythm, the cream sheet, margins, the character/dialogue indents, the page number, the radius + shadow.
- Verify at desktop and on the cream paper (not the old dark/large variant).
- No console errors; behind `scripton.osShell`.

## Then — the method, rolled out
This proves the approach: **read the exact Figma node specs → set the exact CSS.** Once you confirm the paper is pixel-true, we do the same per screen (the shared-token layer #40 + the per-screen pixel pass #43), each measured from its Figma node via Dev Mode / `get_design_context`, not eyeballed — which is what finally makes the whole app match the frames.
