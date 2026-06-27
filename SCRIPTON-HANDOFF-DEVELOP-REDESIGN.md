# ScriptON · Develop — Redesign Handoff v2 (desktop + tablet + mobile, all stage states)

_For Claude Code. Rebuild the **Develop** workspace to the new OS Figma. This v2 supersedes v1 — the screen is now a true two-pane cinematic workspace with per-stage content, live generation status, a 9-stage ladder, and a full-screen "render the script" moment. Goal: the live result is **~99% to the Figma** at desktop, tablet portrait, and mobile portrait. Behind `scripton.osShell`. Design file `dqUr3nasAkQIdefXcGDSyi`._

## 0. Source of truth — read the nodes (this is how manual edits get in)
**The Figma frames are the authority.** For every measurement (font family/size/weight, fill hex, line-height, padding, x/y, width, radius, effects) **read the exact node** via Dev Mode `get_design_context` / `use_figma`, then set the exact CSS — do not eyeball, and do not trust this doc's numbers over the live node if they differ. Any hand-edits made in Figma after this doc was written live in the nodes, so reading the node is what captures them. This doc tells you **what exists and where**; the node tells you the **exact value**.

### Node map (screen → frame)
| State / width | Frame node | Notes |
|---|---|---|
| Desktop — Coverage (active / generating) | **69:2** `Screen · Develop` | the canonical desktop frame |
| Desktop — Draft (Reader script view) | **96:2** `Screen · Develop (Draft)` | script-paper canvas |
| Desktop — Synopsis (early prose) | **99:2** `Screen · Develop (Synopsis)` | 2/9 state |
| Desktop — Script · generating | **103:2** `Screen · Develop (Script · generating)` | bokeh defocus + glowing render card (`GeneratingModal` = **104:11**) |
| Tablet portrait — Draft | **78:2** `Responsive · Develop tablet` | 834 wide |
| Tablet portrait — Synopsis | **115:2** `Responsive · Develop tablet (Synopsis)` | 834 wide |
| Mobile portrait — Coverage | **80:2** `Responsive · Develop mobile` | 390 wide |

## 1. Route / scope
The **Develop** view of the Builder (`/scripton/studio?tab=develop`). Keep the **Builds** tab (build cards) as the secondary mode. Rail item is **Build** (`key:'develop'`, hammer icon) — it owns `/scripton/studio`; the Develop ladder is what opens when you open a build. (Rail rename already landed in `os-workspaces.ts`.)

## 2. The stage ladder — 8 stages
`Logline · Synopsis · Treatment · Beats · Scenes · Step Outline · Draft · Coverage`

This is the full develop ladder. Generating the screenplay is **not a ladder stage** — it's the `↗ Generate script → Library` action (on Draft / once develop is done) that opens the **separate render screen** (§6).

> All Develop frames render the **8**-stage ladder (desktop `69:2 / 96:2 / 99:2`, tablet `78:2 / 115:2`, mobile `80:2`, generating-state `103:2`). Counters: done = stages with a version; `pct = round(done/total*100)`.

Per-stage row states: **done** = filled green dot (`#57b368`) + cream/`#b9c0b3` name; **active** = gold dot/`●` + gold name (`#E6D2A2`) on a gold-tint row (`rgba(198,164,99,.10)`) + 3px gold left-bar; **pending** = hollow dot + muted name + `pending`. Active row sub shows live state (`writing…`, version, page count).

## 3. Desktop layout (69:2)
Top bar + left rail (shared OS chrome) + a 3-zone body.

**Top bar (unified, minus search).** Identical to the other OS pages **except the global search is removed**. Left: `TFM` tile · `ScriptON` wordmark · divider · `Antarah`. Center (the freed search slot): the page title **Develop** over the sub **"Nothing is written until the spine is agreed."**, centered. Right: continuity ring `96%` · `V2 ▾` · collaborator avatars (QQ/AB/RM) · share. No search field on Develop.

**Body — three columns** (left of all: the OS rail, active = Build):
1. **Ladder rail** (~280px, panel `#14161c`): header = gold `✦` tile + "The ladder" + "`7 / 8 stages`"; the 8 stage rows (dot + name + sub, states per §2); footer = "Pipeline `7 / 8`" + a gold progress bar filled to `pct`.
2. **Stage canvas** (center, flex): **head** = stage name (Fraunces ~20) + "`Stage N of 8 · {meta}`" (+ framework for Beats) and, top-right, the version control `‹ V2/3 › ⟳` (regenerate); **body** = the focused stage's content (§4); **foot** = the live status bar when generating, else the `Generate {next} →` + `⟳ Regenerate {stage}` actions (§5).
3. **Right context** (~268px): **The spine** (header + `AGREED FIRST` gold badge; rows Format / Logline(wraps) / Framework / Stage) and **Comparables** (sub + gold-tint chips + one-line note).

## 4. Per-stage canvas content (how each stage looks)
The canvas renders the focused stage's real output, by kind:
- **Prose stages** (Logline, Synopsis, Treatment, Beats, Coverage) → clean prose. Coverage uses gold mini-labels (`LOGLINE / STRENGTHS / CONCERNS / COMPARABLES / VERDICT`, verdict colored: GO green / HOLD red / CONSIDER amber-green). Render markdown-clean — strip `**` / `---` / stray `\n` (bug #47).
- **Scenes** → scene cards (slug + purpose/synopsis + `chargeOpen → chargeClose`, turn/thread tags; flat scenes flagged red).
- **Step Outline** → numbered list (`n. step text`, gold numerals).
- **Draft** (and any rendered script) → the **Reader script paper** (§4a).
- **Empty** → "Not written yet — generate this stage from the one before it."

### 4a. Reader script view (Draft) — frames 96:2 (desktop) / 78:2 (tablet)
Cream sheet `#F7F4EC`, radius 6, soft drop shadow, **Courier Prime** ink `#23231f`, **bold sluglines**, indented character cues / parentheticals / dialogue, page number top-right. Use the exact measured metrics in **`SCRIPTON-HANDOFF-SCRIPTPAPER-PIXEL.md`** (node `7:14`): 12.5px / 22px line / cue ≈20ch / dialogue ≈13.5ch. On mobile the paper is horizontally scrollable or scaled (don't reflow screenplay geometry).

## 5. Status, progress & controls
- **Live status bar** (canvas foot, while a stage runs): spinner ring + "`Generating {stage} — this can take a minute or two`" + an animated gold progress bar + `%`. This is `genBusy` — global, so it shows on the foot regardless of which stage is focused.
- **Pipeline bar** (ladder footer): gold bar filled to `done/total`.
- **Stage counters**: ladder header `done / total stages`, footer `Pipeline done / total`, canvas head `Stage N of total`.
- **Version switch** per stage: `‹ Vn/of ›` in the canvas head (+ the build-level `V2 ▾` in the top bar). **Regenerate** `⟳` ("another take"). **Advance**: `Generate {next} →`. **Promote**: Draft shows `↗ Generate script → Library`.

## 6. Script render screen — **standalone; add border-glow only**
Generating the screenplay is **not a develop stage** — it's the `↗ Generate script → Library` action that opens the **existing standalone render screen** (`ScriptOnBuildScreen`). **Don't rebuild, restyle, or move it.** The only change: **add the `border-glow-card`** effect around its card, glowing (`sweep-active`) while rendering (`--glow-color: hsl(40 80% 80%)`; treatment per node `104:11` / `103:2`). Full spec: `SCRIPTON-HANDOFF-DEVELOP-GENERATING-OVERLAY.md`.

## 7. Responsive
**Tablet portrait (78:2 / 115:2, 834w).** Condensed unified bar (brand + ring + `V2` + avatars; **no search**). Vertical auto-layout content: **Header** (Develop + sub) → **Ladder card** = a horizontal **wrapping chip strip** (each chip = dot + stage name; active = gold; done = green; pending = muted) + `n / 9 stages` + pipeline bar → **Stage canvas** (full width; Reader paper for Draft, prose for Synopsis) → **Context row** = The spine + Comparables **side-by-side** (two columns). No vertical ladder rail in portrait.

**Mobile portrait (80:2, 390w).** Same pattern, single column: condensed bar (brand + ring only) → Header → Ladder chip card (chips wrap ~3 rows) → Stage canvas (prose + status bar) → **The spine** → **Comparables** **stacked** full-width. Chips, type, and paddings are tightened (see node).

## 8. Tokens (verify against nodes)
Dark bg `#0b0c0f`/`#14161c` panels · hairline `rgba(255,255,255,.07)` · gold `#C6A463` / `#E6D2A2` / ink `#1a1509` · cream `#F4EEE0` · text `#E8E6E0` · mute `#9aa1ab` · faint `#6b727d` · green `#57b368` · paper `#F7F4EC` / ink `#23231f` · glow `#F5DAA3`. Type: **Fraunces** SemiBold (titles), **Rubik** Regular/Medium/SemiBold (body/UI), **Courier Prime** Regular/**Bold** (script). Radii 14 (cards) / 999 (chips) / 24 (render card).

## 9. Data wiring (reuse real develop data — don't mock)
| Region | Source |
|---|---|
| Ladder stages + statuses | existing develop stages + done/active/pending (8 stages) |
| Active stage content | the focused stage's body, rendered by kind (§4), markdown-clean |
| Status bar / % | `genBusy` + real generation progress (phase-aware, pairs with #48) |
| Spine | the agreed brief — format, logline, framework, stage |
| Comparables | existing comps (AUTO) |
| Advance / Regenerate / Version / Promote | existing generate / recover / version / promote-to-Library flows |
| Script render screen | the existing standalone render screen — **just add the border-glow** (don't replace it) |

## 10. Acceptance (browser-verified)
- Desktop matches **69:2** (+ stage states **96:2 / 99:2 / 103:2**); tablet matches **78:2 / 115:2** (~834); mobile matches **80:2** (~390) — each ~**99%**, overlay-compared to the node.
- Two-pane on desktop (ladder rail + canvas + context); **chip-strip ladder + stacked context** in portrait; no congestion.
- Per-stage content renders by kind; **Draft = Reader script paper**; status bar + `%` + `N/8` counters present and wired to real data.
- Script render screen = the existing standalone screen, with the border-glow added (no rebuild).
- Top bar unified **minus search**, with the centered Develop title.
- Behind `scripton.osShell`; `old` restores the current Builder. ScriptON naming; `/scripton` route.

## 11. Out of scope
Full Builds-tab redesign and the ⌘K palette (Phase 2).
