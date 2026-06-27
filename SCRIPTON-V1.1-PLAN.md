# ScriptON · v1.1 Plan — Polish + the Three Scheduled Features

_After the v1.0 nine-workspace OS build. Same discipline: flag-gated (`scripton.osShell`), reuse-first, real data, browser-verified per item. Surfaced by the live English walkthrough (2026)._

---

## Batch 0 — Immediate polish (already handed to Claude Code, in flight)
Tracked here for completeness; these ship as quick fixes, not v1.1 features:
1. **Write paper → cream** — `ScriptonWrite.tsx` `--paper:#16181e→#F7F4EC`, `--ink:#0e1014→#23231f` (match `ScriptOnReader`). _(Figma already corrected on the Write desktop + tablet frames.)_
2. **Slate pill `✐` escape** — Library cards render a literal `✐`; decode/remove it.
3. **Canon edge-label overlap** — nudge relationship-edge labels so "alliance with"/"retired" don't collide.
4. **Surface AI engines** — link Studio → AI governance to `/setup/llm-engines` + `/setup/audio-engines`.

---

## Feature 1 — FDX export (Final Draft XML)
**What:** the credibility-floor interchange format; currently a "ship next" stub in Studio → Export & interop.
**Build:** a backend FDX serializer that walks the active revision's scene/element model (slugline · action · character · parenthetical · dialogue · transition) and emits Final Draft `.fdx` XML; wire the Studio **FDX → Export** button to it (gold/live, drop the stub message).
**Reuse:** the export plumbing + download flow from `protected-export.service` (PDF/.docx already do this); the same scene/element data the Reader/ScriptPaper renders.
**Acceptance:** Export produces a valid `.fdx` that round-trips back into Final Draft (open + re-import); element types map correctly; behind the flag; verified on a real parsed script.

## Feature 2 — Fountain export (plain-text screenplay)
**What:** the open plain-text format; "ship next" stub today.
**Build:** a Fountain serializer (sluglines `INT./EXT.`, centered transitions, `@`/caps character cues, `(parentheticals)`, dialogue, `=` synopses) from the same scene model; wire the **Fountain → Export** button.
**Reuse:** same export/download plumbing as FDX; trivial relative to FDX (plain text).
**Acceptance:** Export produces valid `.fountain` that re-imports cleanly (Slate already lists Fountain under Imports); behind the flag; verified on a real script.

## Feature 3 — Project settings (name · locale · defaults)
**What:** Studio → Project settings, currently "This settings section ships in the next phase."
**Build:** a real settings panel — workspace/project **name**, **locale** (the AR/EN the walkthrough exposed — also fixes the missing-Arabic rail labels by making locale explicit), and **defaults** (default format, default revision color, default export protection). Persist to the project / `IntakeProfile` (no new store).
**Reuse:** the existing project + `IntakeProfile` models; the existing settings form patterns in `ScriptOnSettings`.
**Acceptance:** changes persist + reload; locale switch updates the UI; defaults apply to new builds/exports; behind the flag.

## Feature 4 — Access & roles → live RBAC
**What:** Studio → Access & roles is a designed panel on **sample** members (Qais·Owner, Lina·Producer, Nadia·Legal, Studio Vault) — not wired. This is the "I don't know how it works yet" gap.
**Build:** wire it to the **real FilmOS members/roles/RBAC** so it controls, for this script: who can **review** (see it in Room), who **approves** (the Room approval chain — Writer→Producer→Director→Legal), and who **receives** watermarked **distribution** copies (Studio protected-export recipients). Make SSO/SAML + Audit-log reflect real settings (or mark explicitly read-only if the backend isn't ready).
**Reuse:** the existing members/RBAC system (the app already does perms filtering), the approvals API (`approvalsApi`, already powering Room's Resolve→sign-off), and the protected-export recipient log.
**Acceptance:** real members render (not samples); changing a role changes who can review/approve/receive; the approval chain + distribution reflect it end-to-end; behind the flag.

---

## Deferred backlog (Phase 2 — bigger, schedule separately)
- **Unified top bar + ⌘K palette** across all nine workspaces (the frames show it; intentionally out of v1).
- **CRDT branch/merge authoring** (P0 deferred) — real branches in Versions, not just read-only lineage.
- **Richer AI change-composition + decision auto-titles** (render `DecisionRecord`s currently get thin "Render pass X" titles).
- **Mobile Render sheet** (Write is review-first on mobile by design — add one-thumb render if wanted).
- **Doctor/Room bind to the active script** (today they bind to the workspace project name, e.g. "ScriptON Library").
- **Arabic i18n completion** (some rail labels untranslated — Project settings' locale work helps).

## Sequencing
Batch 0 first (quick, in flight) → flip the `scripton.osShell` flag default-on + retire the old views once Batch 0 is verified → then v1.1 Features 1–4 (Exports are quick wins; Project settings is small; Access & roles → RBAC is the meatiest). Phase-2 backlog after.
