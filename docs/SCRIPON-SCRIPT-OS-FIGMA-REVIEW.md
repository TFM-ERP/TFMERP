# ScripON → Script OS · Figma design review (P0)

_Spec §10 step 2 asks to "design the OS shell + Canon and Versions in Figma (Cinematic V.4) to match the existing Write screen." On inspection, the design authority **already contains a complete OS shell and all P0 workspaces** (likely a prior session). This is a review of what exists and how it maps to the P0 kernel plan — no redesign was done (existing work preserved). Date: 2026-06-24._

**Figma file:** `dqUr3nasAkQIdefXcGDSyi` · Page 1 (`0:1`). Six 1440×900 frames, Cinematic V.4 (dark `#0a0b0e`, gold `#C6A463`/`#E6D2A2`, Fraunces titles + Rubik UI + Courier Prime screenplay).

| Frame | Node | What it shows | Maps to P0 plan |
|---|---|---|---|
| Screen · Write | `1:2` | The hero: workspace rail + story spine + centered screenplay paper + pinned composer ("Stage a change · Scene #5", chips Tighten/Punch-up/Genre/Budget/Emotion/Canon) + Revision Pass panel ("3 changes staged", continuity, "Render new draft → V3") | `ScripOnReader` (reuse) + Task 8 Render=commit + `SceneChange` kinds |
| Screen · Canon | `6:2` | Relationship graph + entity panel with **CANON FACTS** tagged *Established S5 · active*, *S12 · reinforced in staged pass*, **"Allied with the Amalekites — New in V2 · S40 · supersedes 'enemy of the Amalekites' (V1, retired)"**; BI-TEMPORAL timeline S1→S12→S40→S65 "enemy → ally"; "enforced on every generation… checked against these facts before it's accepted" | `CanonFact` (Task 4: `validFrom`/`supersedesId`/`status`) + the verify loop (Tasks 2/8/9) — **drawn to the pixel** |
| Screen · Versions | `6:79` | Branch tree V1→V2→alt(Tragic, private branch)→V3 "from the open Revision Pass"; **Semantic diff V2→V3** (chips +2 scenes / 1 canon change / tone:+dread / budget −$140k; sentence-level strike/add; "conflicts flagged for human review"); **Decision log** (ACCEPTED/PROPOSED, Context/Decision/Consequence, "append-only… superseded never deleted") | `BuildVersion` tree + `RevisionPass→Render` (Task 8) + `DecisionRecord` (Task 6). **Semantic diff & branching are P4/deferred — design shows the target.** |
| Screen · Room | `6:156` | (collaboration: notes/approvals/distribution) | P3 — out of P0 scope |
| Screen · Home | `6:233` | "Good evening, Qais · 3 active scripts · 1 rendering"; Continue-where-you-left-off (Write · Antarah · V2 · 3 changes · 96% canon); New build / Import; **Your Slate** (Antarah/Layla & Majnun/Desert Crossing); Activity feed (render/canon-update/staged/comment/watermark/continuity/decision) — "Every render, decision, note & share is recorded" | OS shell landing + Slate; Task 10 rail; kernel event stream |
| Screen · ⌘K Palette | `27:2` | Typed query → **JUMP TO** *Scene 65 / Antarah (canon) / Amalekites→allies (decision)*; **RUN ON SCENE 65** *Re-ending / Budget-fit / Regenerate / Check continuity*; footer `↵ run · ↑↓ navigate · ⌘1–9 workspaces` | The spec's palette ("jump to any scene/character/decision, invoke any tool"). Canon-object addressing = later phase; P0 keeps the existing palette shell. |

**The workspace rail (drawn in every frame):** `Home · Write · Develop · Canon · Doctor · Versions · Room · Slate · Studio`. Top bar: Sx · ScripON · project · ⌘K search · continuity ring (96%) · version picker (V2) · collaborators · share.

## Alignment verdict
The design **independently validates the P0 kernel plan**: bi-temporal `CanonFact` (validFrom/supersedes/status), the verify step ("checked before accepted"), `RevisionPass→Render`, `DecisionRecord` (ADR, append-only/superseding), and the 9-workspace shell are all rendered. No data-model changes are implied by the design.

## Divergences / decisions
1. **Rail order.** Figma = `Home · Write · Develop · …`; spec §5 prose = `Home · Develop · Write · …`. Resolved in favour of the **rendered design authority** (Write before Develop, "Write = the hero"); plan's `OS_WORKSPACES` updated to match.
2. **Design shows beyond P0 — do NOT over-scope.** Semantic diff (P4), draft branching / alt-branch (CRDT, deferred), and ⌘K canon-object addressing (later phase) appear in the frames as the *eventual* target. P0 builds the foundation (canon graph + verify + Render=commit on `BuildVersion`); these surfaces light up in later phases. The frames are the destination, not the P0 acceptance bar.

## Net effect on §10
Recon ✅ · Figma design ✅ (pre-existing, reviewed, validated) · P0 plan ✅. The §10 gate is ready: the remaining question for the user is approval to begin coding P0.
