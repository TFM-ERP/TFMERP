# ScripON · Canon — Design Handoff (screen 6 · first Group B, kernel-backed)

_For Claude Code. Build the **Canon** workspace — the bi-temporal canon graph — replacing today's empty stub, behind the `scripon.osShell` flag. This is the **proof the kernel is live.** Design authority: Figma `dqUr3nasAkQIdefXcGDSyi` node **6:2** (Canon frame). Route: `/scripon/canon`._

## Prerequisite (gates this screen)
The P0 kernel must be **merged + its migration applied** first (`CanonFact`, `SceneRelation`, `DecisionRecord`, `RevisionPass`, `SceneChange` live on the dev DB). Until then Canon can only be static. Build this against the **real merged kernel** — no invented data.

## What exists post-merge (reuse — do NOT rebuild)
- **Canon kernel** (`backend/src/production/scripton/canon/`): `canon.types.ts` (`CanonFactCore`), `resolveCanonAt(facts, at)` (bi-temporal resolver — ACTIVE facts whose `[validFrom, validTo)` contains `at`; later `recordedAt` wins), `detectConflicts` (overlap + different object = conflict). These are pure + tested.
- **`CanonFact` store** — written by the extract→inject→verify loop at render. Read it for this screen (add a thin read endpoint — e.g. `GET …/canon?projectId&versionId` returning `CanonFactCore[]` — if one isn't already exposed; built on the kernel, not mocked).
- **Replace the stub:** `frontend/src/app/(dashboard)/scripon/canon/page.tsx` is an empty placeholder on the **old** chrome (`position:fixed` overlay + old `SxRail`). Drop that — Canon renders into the OS shell content area like the Group-A screens (cinematic tokens, no embedded rail).

### `CanonFactCore` (the shape every region reads)
`kind` (`CHARACTER|WORLD|LORE|TIMELINE|RELATIONSHIP|PLOT`) · `subject` (UPPER entity) · `predicate` (e.g. `status|alliance_with|location`) · `object` (value or other entity) · `statement` (human sentence) · `validFrom` (scene-order index it becomes true) · `validTo` (null = still true) · `status` (`ACTIVE|SUPERSEDED`) · `recordedAt` · `supersedesId`.

## Layout (desktop — matches frame 6:2, content area right of the rail)
1. **Title block:** `Canon` (Fraunces) + sub-line `Story memory · enforced on every generation · {factCount} facts · synced from V{n}`.
2. **Tabs:** `Relationships` (default) · `Characters` · `World` · `Lore` · `Timeline` — these filter by `CanonKind` (RELATIONSHIP / CHARACTER / WORLD / LORE / TIMELINE).
3. **Center — the graph:** entity nodes connected by labeled edges. **Nodes** = the `subject`/`object` entities; **edges** = `RELATIONSHIP` facts, labeled by `predicate` (e.g. `loves`, `enslaved by`, `mother`, `secret father`, `allies · canon V2`). The selected entity is the gold center node. **SUPERSEDED / retired** relations render dashed/muted; **new-in-V{n}** edges read as the design shows (`allies · canon V2`, gold dashed). Reuse the hand-rolled SVG network-graph technique already in Doctor's analytics (`analyticsNode`) — **no new graph dependency.**
4. **Right — entity detail panel:** the selected entity — name + role/descriptor. **CANON FACTS** list: each fact = its `statement`, a sub-line `Established S{validFrom} · {status}` (+ `reinforced in staged pass` / `New in V{n} · S{validFrom} · supersedes "{prior}" (V{k}, retired)` from `supersedesId`), with a status dot (green ACTIVE, amber new/superseding). Note line: `Every rewrite, summary, bible, pitch & adaptation is checked against these facts before it's accepted.` Then **BI-TEMPORAL — canon changes with the story:** a timeline of the scene-order points where this entity's facts change (e.g. `S1 · S12 · S40 · S65`) with a one-line transition caption (e.g. `Amalekites: enemy → ally`) — computed by calling `resolveCanonAt` at each point.

Cinematic dark + gold tokens (same `.sx` set as the other screens).

## Data wiring (reuse the merged kernel — do NOT mock)
| Region | Source |
|---|---|
| fact count + version | `CanonFact` rows for the project's active version (`synced from V{n}`) |
| graph nodes/edges | `RELATIONSHIP`-kind facts → `subject`/`object` = nodes, `predicate` = edge label; `status==='SUPERSEDED'` → dashed/retired |
| tab filter | `CanonKind` |
| entity panel facts | facts where `subject` = selected entity (all kinds), grouped; show `statement`, `Established S{validFrom}`, `status`, supersession via `supersedesId` |
| bi-temporal timeline | `resolveCanonAt(entityFacts, at)` at each scene-order point where the entity's facts change → value transitions |
| conflicts (optional surfacing) | `detectConflicts` — same core the Doctor Conflict Detector uses |
| verify note | static copy (the `canonDirective` guarantee) |

## States
- **Kernel merged but no facts yet** (extraction not run): an **empty state** — "No canon yet — render a version to extract its facts" (canon is written by the extract→render loop, not hand-entered). To demo a populated Canon for review, run an extraction/render on a script that has scenes, or seed ephemeral sample facts at the network layer (as was done for Room).
- **Loading:** skeleton the graph + panel.
- **Empty tab:** a tab with no facts shows an empty-tab note, not a broken graph.

## Responsive (no dedicated Canon responsive frame — reuse the pattern)
- **Tablet:** graph above, entity panel below (or a right drawer); tabs become a scroll/segmented row.
- **Mobile:** lead with the **entity list + its canon facts + the bi-temporal timeline** (the readable substance); the relationship graph collapses to a simplified list/tree or a tap-to-expand — facts first, graph optional.

## Acceptance (browser-verified, headless + my eyeball)
- Matches Figma **6:2**: title + fact-count sub-line, the 5 tabs, the relationship graph, the entity canon-facts panel + bi-temporal timeline.
- **Real kernel data**: graph + facts come from `CanonFact`; the timeline is real `resolveCanonAt` output; supersession (retired V1 → active V2) renders. Empty state when no facts — never fabricated.
- Old stub chrome (fixed overlay / old rail) is gone — single OS shell.
- **No console errors / no hydration flash** on hard refresh (Playwright) at desktop/tablet/mobile.
- Behind `scripon.osShell`; `old` restores the current stub. Full-text rev/label pills.

## Out of scope (this screen)
The unified top bar + ⌘K palette (Phase 2). **Editing** canon by hand — in P0 canon is written by the extract loop and read here; no inline fact editor. The deeper Write/Render screens (where facts get *created*) are their own handoffs.
