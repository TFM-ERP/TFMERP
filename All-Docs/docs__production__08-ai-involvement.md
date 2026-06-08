# 08 — AI Involvement

Where artificial intelligence touches the production module, how it's integrated, and the guardrails that keep it from silently changing committed data.

---

## 8.1 Integration

- **Provider:** Anthropic Messages API, called server-side via `fetch` with headers `x-api-key`, `anthropic-version: 2023-06-01`.
- **Model:** default `claude-3-5-sonnet-20241022`, overridable with env `LABOR_AI_MODEL`.
- **Key:** `ANTHROPIC_API_KEY` lives **only** in `backend/.env` (never in the frontend or the database).
- AI is invoked from two backend areas: `src/labor/` (rate & incentive research) and `src/production/breakdown/script-import.service.ts` (script breakdown).

## 8.2 AI use #1 — Union/incentive rate research (approval-gated)

`LaborService`:
- **`aiResearch(data)`** — researches a labor/rate topic and files a `RateChangeProposal` (`origin = AI`, with `payload`, `diff`, `confidence`, and a cited quote/source) for human review. It does **not** write a `RateRule`.
- **`aiUpdateAll()`** — loops the active labor bodies (US/UK/CA unions + UAE statutory) and also pulls the latest **Abu Dhabi incentive** parameters, filing proposals for each.
- Proposals appear in `setup/rate-approvals`; only `approveProposal` (System Admin / Finance Manager / Line Producer) writes the rule (a new version). This satisfies the hard constraints: *nothing updates without approval*, *no unofficial sources*, *history never changes*.

The **refresh engine** (`refreshRates`) is the non-AI sibling: it fetches allow-listed official sources, hashes them, and files refresh proposals when content changes.

## 8.3 AI use #2 — Automated script breakdown

`ScriptImportService` (under `breakdown/`):
- **`extractText(filePath, ext)`** — extracts text from `.fdx` (Final Draft XML, via regex + paragraph structure), `.pdf` (`pdf-parse`), `.docx` (`mammoth`), `.txt`, `.fountain`.
- **`splitScenes(text, fdx)`** — parses the screenplay into scenes (heading, INT/EXT, DAY/NIGHT, set name, body, cast, estimated pages) from FDX paragraphs or plain text.
- **`importScript(projectId, body)`** — runs extract → split → **AI element extraction** (classifies each scene's elements into `BreakdownCategory`: cast, props, stunts, vehicles, SFX, VFX…) → creates `ProductionStrip`s and `BreakdownElement`s.
- **`fullSetup(projectId, body)`** — one-click "Script → full setup": import + `autoSchedule` + `budgetFromBreakdown` (generates budget lines from the breakdown).
Entry points: the Breakdown view, and the New-Project flow (upload a script after save).

> Public breakdown APIs were evaluated and rejected (Prescene is waitlist; Filmustage/StudioBinder are export-only), so the in-app LLM breakdown is the chosen approach, with an optional Filmustage XLSX import as a future path.

## 8.4 AI provenance on the budget

Lines the AI/import path creates are tagged so a human can always tell where a number came from:
- `BudgetLineItem.origin` = `AI_GENERATED` (AI), `SCRIPT_IMPORT` (script importer), `AUTO_BREAKDOWN` (breakdown push).
- The suggested numbers are stored in `aiSuggestedRate` / `aiSuggestedQuantity`.
- If a human later edits the rate or quantity, `updateLineItem` flips the line to `MANUAL_OVERRIDE` and **preserves the original AI suggestion** for transparency (shown on hover in the budget grid).

## 8.5 Guardrails (summary)

1. AI never writes live rates/incentives — it only files **proposals** that a human approves.
2. Rate sources are restricted to an **allow-list** of official domains; no unofficial websites.
3. **Historical projects never change**: rates are frozen as `ProjectRateRule`s; new rates apply to future projects unless explicitly applied.
4. AI-touched budget lines are **labelled** (`origin`) and the original suggestion is preserved on override.
5. The API key is server-side only; any key pasted into chat is treated as compromised and must be rotated.
