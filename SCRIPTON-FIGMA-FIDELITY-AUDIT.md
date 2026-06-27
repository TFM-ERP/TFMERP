# ScriptON · Figma-vs-Live Fidelity Audit

_The gap between the Figma frames (investor-loved) and the shipped screens, screen by screen, as a polish punch-list. Design authority: Figma `dqUr3nasAkQIdefXcGDSyi`. Goal: make the live app read as "finished" as the frames. Work flag-gated, behind `scripton.osShell`._

## How to read this
Each item is a **delta** (Figma → reality) with a **priority**: **P0** = biggest "looks finished" uplift, **P1** = clear per-screen gap, **P2** = pixel/detail polish. For exact spacing/type/color, open the cited Figma node and measure — don't eyeball.

---

## Cross-cutting (affects every screen — fix once, lifts all nine)

### X1 · The unified top bar is missing — **P0, highest impact**
Every Figma frame wears the same crown: **TFM tile · breadcrumb · a global ⌘K search ("Search scenes, characters, decisions — or run a command") · a continuity ring (96%) · a V-switcher (V2 ▾) · collaborator avatars (QC/AB/RM) · a share/export button.** The live screens have only a thin per-page header. This single element does most of the "designed" feeling — and it's absent everywhere. Build it as a shared component across all nine workspaces (+ the ⌘K palette, Figma **27:2**). _This is the deferred "Phase 2 top bar"; it's now the #1 fidelity item._

### X2 · Screens look empty; the Figma is full — **P0/P1**
The frames are richly populated (full activity feeds, a dense canon graph, coverage cards, a 4-gate approval ladder). Live, the bound Library has thin data, so Doctor/Room (and parts of Home/Canon) show **empty states** — which always reads as "unfinished," even with an identical layout. Fix two ways: (a) get real content in (run عنترة fully through coverage/notes), and (b) for demos, a **rich seed** so every screen shows full. Empty states should still be elegant, but the demo story needs *full*.

### X3 · Styling is hand-rolled per screen, so it drifts — **P1 (the durable fix)**
Each component carries its own `.sx` CSS block with repeated tokens. That's why spacing/type/padding vary subtly screen to screen. Extract a **shared token + primitive layer** — one spacing scale, one type ramp (Fraunces/Rubik/Courier), shared card/pill/panel/button primitives — and apply it everywhere. This converts "polish each screen by hand" into "polish once, enforced." Recommended before/alongside the pixel pass.

### X4 · Type & density — **P2**
The Figma breathes more: larger section headings (Fraunces), generous panel padding, consistent 8-pt rhythm. Several live panels are tighter/denser. Normalize against the shared scale (X3).

---

## Per-screen

### Home — Figma `6:233` → `/scripton`
**Close already.** Greeting, Continue hero, slate, quick actions, activity all present.
- **P1** Activity feed is thinner than the frame's (which shows Rendered V2 / Canon updated / Staged S65 / Lina commented / watermarked / Continuity passed / Decision logged). Populate the full event mix.
- **P2** Continue-hero poster is a flat gradient vs the frame's art-directed tile. Add poster art / a richer placeholder.
- **P0** top bar (X1).

### Write — Figma `1:2` → `/scripton/reader`
**Strong.** Story Spine + cream paper (now fixed) + composer + Revision Pass panel.
- **P2** Composer + pass-row spacing/borders slightly tighter than the frame; match panel padding + the staged-row diff styling to `1:2`.
- **P0** top bar (continuity ring + V-switcher especially belong here).

### Develop — (existing Builder) → `/scripton/studio?tab=builds`
No dedicated Figma frame; it's the reused Builder.
- **P1** Give it the same header/type treatment as the OS frames so it doesn't read as the "old" surface among the new ones.
- **P2** Tablet/mobile still use the Builder's own nav, not the OS rail (consistency).

### Canon — Figma `6:2` → `/scripton/canon`
**Good match** (graph + entity panel + bi-temporal timeline; edge-label overlap already fixed).
- **P2** Node sizing/spacing + edge-label chips can match `6:2` more exactly; the frame's graph is airier.
- **P0** top bar.

### Doctor — Figma `38:2` → `/scripton/doctor`
**Biggest contrast.** The frame is fully populated (B+ verdict, 5 grade tiles, scene-flow bars, the emotional-arc curve, diagnostics rows, the 2×4 transforms grid). Live shows the **empty state**.
- **P0** Populate — run a coverage pass on the bound script (or seed) so it shows the verdict/scorecard/arc like the frame. This screen *needs* data to look designed.
- **P0** top bar.

### Versions — Figma `6:79` → `/scripton/revisions`
**Good match** (timeline + semantic diff + decision log).
- **P1** Decision-log entries show thin auto-titles ("Render pass cmqt…") vs the frame's curated, human titles ("Amalekites become allies"). Generate readable titles from the applied changes.
- **P2** The frame shows an `alt` branch node; live is a linear spine (CRDT deferred — fine, but it's a visible difference).
- **P0** top bar.

### Render → Compare — Figma `31:2` → `/scripton/revisions?pass=…`
**Strong match** (dark diff columns + THIS RENDER panel). Mostly just **P0** top bar + P2 spacing.

### Room — Figma `6:156` → `/scripton/notes`
- **P0/P1** Empty notes (data gap) + the approval chain shows only the one *routed* stage, vs the frame's full **Writer→Producer→Director→Legal** ladder with statuses. Render the full gate ladder (pending gates included) and populate notes/distribution.
- **P0** top bar.

### Slate — Figma (library cards) → `/scripton/library`
- **P2** Cards are flatter than the frame's cinematic tiles (poster art, depth). The `✐` pill bug is already fixed.
- **P0** top bar.

### Studio — Figma `38:198` → `/scripton/settings`
- **P1** The **Security & distribution** section renders the functional `ReviewProtectionPanel`, not the clean Figma card (watermark mode segmented / permission chips / two toggles). Wrap the real controls in the frame's card layout so it matches.
- **P1** Integrations / Project settings / Danger zone are honest stubs — give them at least the frame's designed empty/placeholder treatment so they don't read as blank.
- **P0** top bar.

---

## Recommended sequence
1. **X1 — build the unified top bar + ⌘K** (one shared component, all nine screens). Single biggest uplift; do it first.
2. **X2 — populate** Doctor + Room (+ Home activity) with real or seeded content so the money screens read full.
3. **X3 — shared token/primitive layer**, then the **P1** per-screen items (approval ladder, decision titles, Studio security card, Develop header).
4. **P2 pixel pass** — screen by screen, measure against the cited Figma node, match spacing/type/color.

Each step flag-gated + browser-verified against its Figma frame. Net effect: the live app converges on the frames the room already loved.
