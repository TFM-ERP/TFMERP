# ScriptON · Unify All Screens to the Approved Figma (one batch)

_For Claude Code. Port every remaining OS screen to the approved Figma so the whole app is visually unified. Do it **all in one pass** — commit per screen for traceability, but **do NOT stop for per-screen review**; present the complete set (a screenshot of every screen) at the end for one review. Method: **read the node → set the CSS to the #40 tokens → verify**. Behind `scripton.osShell`; **real data, no mocks**; **no new inline palettes**. **Develop is DONE — do not rebuild it; just don't regress it.** Design file `dqUr3nasAkQIdefXcGDSyi`._

## Phase 1 — Shared chrome FIRST (this is what unifies everything at once)
The top bar and rail are shared components, so getting them pixel-right **once** fixes all 9 screens together. Do this before any bodies.

- **Top bar (`ScriptonTopBar`)** → match the node (e.g. `6:80` on Versions): brand (`TFM` tile · `ScriptON` · divider · project) · the **search** field (the `⌘K` pill) · the right cluster = **green continuity pill** (`◯ %`) + **boxed `V▾`** + collaborator avatars + share. Match the node's pill / box / avatar-stack **styling exactly** (this is the slice-A deferred item — do it now, once, on the shared bar). Drive from **real data** — real continuity %, real version label, real collaborators; never the mock `QQ/AB/RM` count. **Keep Develop's exceptions intact:** `noSearch` + the centered title (`centerTitle`).
- **Rail** → match the node (`6:111`): the items, order, icon, label (all **Build**, never "Develop"), and the **active highlight** (each screen highlights its own item; Compare highlights Versions). Pixel-match the rail width, item spacing, icon size/colour, and the active bar/background to the node.
- **Gate:** verify the shared chrome on three screens (Home + Versions + **Develop**) before touching bodies — the bar + rail must look **identical** across them and must **not regress Develop**.

## Phase 2 — Per-screen bodies (each to its node)
Then each screen's content to its node, reusing the `#40` `.sx` tokens (no inline palette blocks):

| Screen | Desktop node | Responsive |
|---|---|---|
| Home / Slate | `6:233` | — |
| Write (+ ScriptPaper `7:14`, already pixel-true) | `1:2` | `46:3` |
| Canon | `6:2` | — |
| Doctor | `38:2` | — |
| Versions | `6:79` | — |
| Render → Compare | `31:2` | `51:3` |
| Room | `6:156` | `49:3` |
| Studio | `38:198` | — |

(⌘K palette `27:2` stays deferred.)

For each: read the node (`get_design_context`) → set type / colour / spacing / radii to the tokens → wire to **real** data (honest empty states where data is absent — the Develop pass set that bar) → verify at desktop (+ the responsive node where one exists) → commit.

## Rules
- `#40` tokens only — **no new inline palette blocks**; reference the shared `.sx` layer.
- Behind `scripton.osShell` (`old` restores the current screens). ScriptON naming, `/scripton`.
- **Real data, no mocks.** Refuse another entity's data as a stand-in (honest empty states), exactly as Develop did.
- 0 console errors; don't regress Develop or any shipped screen.

## Cadence (this is the change from the Develop build)
Do **all** screens in one pass. Commit per screen. **Do not stop for per-screen review.** At the end, deliver in one go:
- the **commit list**, and
- a **screenshot of every screen** (desktop, + responsive where built),
so the whole unified set can be reviewed **together**.

## Acceptance (end-of-pass review)
- Every screen's **top bar + rail are identical** (the unified chrome); Develop's `noSearch` + centered title intact.
- Each screen **body matches its node (~99%)**, wired to **real** data, behind the flag, 0 console errors.
- One screenshot per screen delivered for the batch review.
