# Superpowers — ScripON Build Gap Fixes

A ready-to-paste prompt for Claude Code + Superpowers to close the **Section 8 gaps** from `docs/SCRIPON-BUILD-MASTER-FEATURES-AND-ROADMAP.md`, safely (branch + tests + approval gates).

Verified before writing this (2026-06-24):
- The intake wizard is a **2-step** design (`ScripOnIntake.tsx` — "consolidated intake (2-step)"); the 6-step rail was only the redesign proposal. **Not a bug.**
- The export service is **PDF-only** (`puppeteer` + `pdf-lib`); there is **no DOCX writer** dependency (`mammoth` only *reads* Word). Word export is a genuine new feature.

## How to run

```
cd "C:\Projects\TFM-System"
```
```
claude
```
Then paste the block below.

## The prompt — copy from here

```
I want to close the "Section 8 — Known gaps" items from docs/SCRIPON-BUILD-MASTER-FEATURES-AND-ROADMAP.md for the ScripON build system. Use your brainstorming + test-driven-development + git-worktree skills. Work on a branch, and for EACH fix: show me a short plan and WAIT for my go-ahead before coding; write tests first where there's pure logic; run `npm run test:unit` in /backend; commit per fix with a clear message; do NOT bundle unrelated changes. Stop and ask me if anything looks risky.

Do the fixes in this order (low risk → high risk):

1. VERIFY ONLY — Intake step count. Confirm ScripOnIntake.tsx is intentionally a 2-step wizard. If so, no code change — just confirm. (The "6-step rail" is a separate redesign tracked in ScripON-Studio-Development-Pipeline-Spec; do NOT build it here.)

2. Word / DOCX export (additive). The package UI/design promise "PDF + Word" but the export service is PDF-only and there is no DOCX writer dependency. Add a DOCX export path alongside PDF:
   - Add a docx-writer library (e.g. `docx` on npm) — confirm the repo registry allows it; if not, tell me before proceeding.
   - Build it as a PURE function (development-package model -> docx structure) so it is unit-testable; TDD it.
   - Wire it behind the existing package "Word" button / endpoint.
   - IMPORTANT: a .docx cannot be hardened like the protected PDF (no rasterise/qpdf permissions). Make the Word export clearly a "review/editable" output, keep metadata sanitisation, and surface that limitation — do not silently imply it has the same protection as the PDF.

3. Typed brief columns + migration (medium risk — needs the DB). Promote the JSON-only brief levers to typed IntakeProfile columns: scriptVariety, dialogueRegister, accents (Json), styleMix (Json), conflict/conflictId/politicalArc. Keep reading the existing JSON brief as a fallback so nothing breaks. FIRST reconcile the existing schema/migration drift (see FOUNDATIONS.md + scripts/db-reconcile.sh) and run against a BACKUP/STAGING database — never prod. Generate one proper migration; do not use bare `db push`.

4. Persistence hardening (do AFTER #3). In the coverage/analytics paths, replace the silent `(this.prisma as any)` + `.catch(() => …)` swallowing with typed Prisma calls and explicit error handling, now that the tables are guaranteed by the migration. Keep graceful behaviour where a missing table is genuinely optional, but stop hiding real errors.

5. SCOPE WITH ME FIRST — "Research-online live era deepening". This is a sizable feature (a live web-research call wired into the era directive at generation, with cited sources). Before any code, brainstorm the scope/approach with me and we decide whether to build, defer, or drop it.

DO NOT TOUCH these — they are intentional design, not bugs:
- The look-board "no faces / no performers" rule (right-of-publicity safety).
- The lore lock that never seeds living-religion deities/prophets.
- Analytics "representation = speaking-character count": adding demographic/Bechdel tallies needs a deliberate data-and-ethics design decision — raise it as a question, do not hack it in.

OUT OF SCOPE for this prompt: multi-tenancy (the release blocker) — that is its own separate, highest-risk effort.

When done, give me a summary of what landed (commits + what changed per item) so the master features doc can be regenerated.
```

## After the fixes land

Tell me what landed (paste Claude Code's summary, or just say "done"), and I'll **regenerate the HTML + Markdown master docs** from the new code state so Section 8 reflects reality.

## Notes

- **Intentional (won't be "fixed"):** look-board no-faces, no living-religion deities, representation-as-speaking-count. These are deliberate safety/design choices.
- **Out of scope here:** multi-tenancy — handle separately (it's the one release blocker).
- The riskiest item (#3 migration) is gated behind a backup DB and the drift-reconcile flow, per FOUNDATIONS.md.
