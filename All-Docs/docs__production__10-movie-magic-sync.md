# 10 — Movie Magic (MMB / MMS) Bidirectional Sync

Native, AI-free import/export of **Movie Magic Budgeting** (MMB) and **Movie Magic Scheduling** (MMS) files. Backend: `src/production/movie-magic/` (`MovieMagicController` @ `production/movie-magic`, `MovieMagicService`). Frontend: the **Movie Magic sync** card in Project Settings (`ProjectSettingsPanel`).

---

## Why a separate path from the AI breakdown
The script-import pipeline (`08-ai-involvement.md`) uses an LLM to *infer* breakdown elements. Movie Magic files are **already structured**, so this path parses them deterministically with `xml2js` (plus an inline CSV reader) — no AI, no guessing. Imported budget lines are tagged `origin = MOVIE_MAGIC_IMPORT` so their provenance is explicit alongside MANUAL / AI / SCRIPT_IMPORT lines.

## Endpoints
```
POST /production/movie-magic/:projectId/import        multipart: mmbFile (.xml/.csv), mmsFile (.sex)  → initializeFromImports
GET  /production/movie-magic/:projectId/export/mmb    → exportBudgetToMMB  (downloads <id>_budget_mmb.xml)
GET  /production/movie-magic/:projectId/export/mms    → exportScheduleToSEX (downloads <id>_schedule.sex)
```
Import requires `production` write (level 2); exports require read. Uploads are in-memory (25 MB cap) so the parser reads `file.buffer` directly.

## Import — budget (MMB `.xml` / `.csv`)
`importBudget(projectId, file)`:
1. Deactivates existing budget versions and creates a fresh **`WORKING`, active** `BudgetVersion` named *"Movie Magic Import"*. (This is an estimate write — it never touches `ProjectTransaction`, so it's correctly **outside** the `assertOpen()` period guard.)
2. Maps the MMB hierarchy to the native model:
   `CategoryList/Category → BudgetSection` (tier auto-derived from the code: 1xxx ATL, 2xxx BTL, 3xxx POST), `AccountList/Account → BudgetAccount`, `DetailList/Detail → BudgetLineItem`.
3. Each line is created with computed `subtotal = quantity × rate` and `total` (Prisma `createMany` doesn't compute, so the service does), `origin = MOVIE_MAGIC_IMPORT`, project currency, fringe 0.
4. Recalculates `project.totalBudget`.
- **CSV** is parsed by an inline RFC-4180-ish reader (quoted fields, escaped quotes, CRLF) with flexible headers (Section/Category, Account/Acct/Number, Description/Detail, Quantity/Amount, Rate/Cost) folded into the Section→Account→Line hierarchy.

## Import — schedule (MMS `.sex`)
`importSchedule(projectId, file)` parses `Schedule → Boneyard/Board/StripList → Strip`:
- Each strip → `ProductionStrip` (`sceneNumber`, `setName`, `location`, `intExt`, `dayNight`, `pages` — Movie Magic eighths like "2 3/8" are converted to a decimal, `shootDay`, `cast`).
- `Strip/ElementList/Element → BreakdownElement` with `mapMmsCategoryToInternal()` translating MMS labels (Props, Cast, Vehicles…) to the `BreakdownCategory` enum.

## Export
- **`exportBudgetToMMB`** reads the active `BudgetVersion` (sections → accounts → lines) and builds MMB XML (`Budget/CategoryList/Category/AccountList/Account/DetailList/Detail`, including computed `Subtotal`/`Total`).
- **`exportScheduleToSEX`** reads `ProductionStrip` + elements and builds the `.sex` XML (`Schedule/Boneyard/Strip/ElementList/Element`), translating categories back to MMS naming via `mapInternalToMms()`.

## Guardrails preserved
- Financial guardrails are untouched: imports write only to the **budget estimate** tree, never to the actuals ledger.
- Immutable labor snapshots (`ProjectRateRule`) are unaffected — Movie Magic lines carry no labor classification by default; apply fringes as usual after import.
- A LOCKED active version isn't overwritten silently — import creates a new working version and makes it active, leaving prior (incl. locked) versions intact as history.

## Dependency
Uses **`xml2js`** (added to `backend/package.json`). It's loaded via `require` so the build compiles even before install; run `npm install` (or `npm install xml2js`) in `backend/` to enable it at runtime.
