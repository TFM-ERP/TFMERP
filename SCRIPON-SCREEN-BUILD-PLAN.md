# ScripON — Screen-by-Screen Build Plan

### Turning the Figma OS into working pages, in order, after the rail cutover
_For Claude Code + Superpowers (build) with Cowork providing per-screen design handoff + browser review. Design authority: Figma `dqUr3nasAkQIdefXcGDSyi` + the `design-tmp/scripon-v4-*.html` mockups._

> **Why the app doesn't look like the Figma yet:** only the **nav shell** (rail cutover) and the **backend kernel** are built. The redesigned *page contents* (Write canvas, Canon graph, new Coverage/Doctor, etc.) are **designs, not code** — this plan implements them, screen by screen.

---

## Step 0 — Unblock (do these first, before any screen)

1. **Fix / confirm the rail cutover.** Establish the baseline: on `/scripon/*` there is a **single shell** (no double rail) and the **new 9-workspace labeled rail** renders, with the flag fallback working. If the left rail is still the old 74px icons, fix the cutover first (flag resolution / suppression / SxRail variant). The old page *contents* showing through is expected at this step — we only need the **shell + rail** correct here.
2. **Apply the P0 kernel migration on staging + smoke.** This makes `CanonFact` / `RevisionPass` / `DecisionRecord` / `BuildVersion` data real — which **unblocks** the kernel-backed screens (Write, Canon, Versions). Until this runs, those screens can only be built as static UI.

---

## Build rules (every screen)

- **Flag-gated:** each new screen ships behind the same `scripon.osShell` cutover flag (new = the rebuilt screen, old = the existing page) so you always have an instant fallback and can verify side-by-side.
- **Reuse the data + logic; rebuild the layout.** The existing pages already fetch real data and run the engines — keep those; re-lay them out to the Figma. Don't rebuild working logic.
- **Real data, not mock.** Each rebuilt screen wires to the existing API/data it already uses (or the kernel for the new ones).
- **Responsive:** reuse the existing responsive patterns; the panel-dense collapses are specced in the `Responsive · *` Figma frames.
- **Browser-verify each** (incl. a hard-refresh console hydration check) before moving to the next screen. One screen at a time, merged behind the flag.
- **Cowork hands you a detailed design-handoff per screen** (layout, tokens, component map, states, edge cases) as you reach it — built from the Figma frame + the matching HTML mockup.

---

## Order (dependency- and value-aware)

**Group A — re-skins (fast visual wins; existing data + engines, low kernel dependency).** Do these first so the app *looks* redesigned quickly.

| Screen | Reuse | Design source |
|---|---|---|
| **Home / Slate** | projects/library data | Figma `Home` |
| **Doctor** | `ScripOnDoctor` + `ScripOnRewriteSlate` (coverage/diagnostics/transforms already work) | Figma `Doctor` |
| **Studio** | `ScripOnSettings` + protected-export (export/interop/security) | Figma `Studio` |
| **Room** | `ScripOnNotes` + approvals + protected-export distribution | Figma `Room` |
| **Develop** | the existing Builder/Brief — already works; just reachable + light re-skin | (existing) |

**Group B — kernel-backed hero (the OS heart; needs the kernel live from Step 0.2).**

| Screen | Reuse + new | Design source |
|---|---|---|
| **Write** (the canvas) | reuse `ScripOnReader` for the paper; build the Story Spine + the **Revision Pass** panel on the kernel | Figma `Write` + `scripon-v4-revision-pass.html` |
| **Render → Compare** | the kernel's render = commit; V2↔V3 semantic diff | Figma `Render→Compare` |
| **Canon** | the bi-temporal canon graph + entity facts (pure kernel data) | Figma `Canon` |
| **Versions** | `ScripOnRevisions` + the kernel's branches/decision log | Figma `Versions` |

**Suggested first screen:** **Home** — low-dependency, sets the OS tone, and proves the screen-build pattern end-to-end (flag, data wiring, responsive, browser-verify) before the harder kernel screens. If you'd rather see the heart first, start with **Write** (but do Step 0.2 first).

---

## How we work each screen (the loop)

1. Cowork produces the **design-handoff** for the screen (from the Figma frame).
2. Claude Code builds it behind the flag, reusing existing data/logic, to the handoff.
3. You + Cowork **browser-verify** it (matches design, real data, responsive, no hydration flash).
4. Merge behind the flag; move to the next screen.
5. When all screens for a group are confirmed, the old versions retire.

---

_This is the path from "nav frame built" to "the app looks and works like the Figma." It's a real multi-screen build — sequenced so each step ships something verifiable, not a big-bang rewrite._
