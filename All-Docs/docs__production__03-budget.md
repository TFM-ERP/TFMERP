# 03 — Budgeting

Backend: `src/production/budget/` (`BudgetController` @ `production/budget`, `BudgetService`).
Frontend: the `budget`, `topsheet`, `globals` tabs of the project page; `LaborBlockEditor`; print pages `print/budget/[versionId]`, `print/topsheet/[versionId]`.

---

## 3.1 The budget hierarchy

```
BudgetVersion → BudgetSection (tier ATL/BTL/POST) → BudgetAccount (cost center) → BudgetLineItem
```
- **Section** = department band, carries `tier` (ATL/BTL/POST/OTHER). Tier is auto-derived from the code (1xxx→ATL, 2xxx→BTL, 3xxx→POST, else OTHER) and used to sort ATL above BTL.
- **Account** = cost center (`code` + `title`), the unit at which actuals reconcile. Holds an optional `etcAmount` override.
- **Line item** = the atomic row holding inputs, provenance and computed totals.

## 3.2 Formula engine & globals

`BudgetGlobal` rows are named variables (`shoot_days`, `prep_weeks`…). A line's `quantityFormula` (e.g. `shoot_days + prep_days`) is evaluated against the globals map by `evaluateFormula`. `recalculateVersion(versionId)` re-resolves every formula line and recomputes subtotals when a global changes (`upsertGlobal`/`deleteGlobal` trigger it). The **Recalc** button calls `recalculate`.

Computed fields on each line:
```
subtotal     = Σ stages.amount   (if stages present)   else  quantity × rate ÷ exchangeRate
fringeAmount = subtotal × fringePct / 100
total        = subtotal + fringeAmount
```

## 3.3 Per-stage labour breakdown

Labour lines can carry a `stages` JSON: `[{stage: PREP|SHOOT|WRAP|POST, qty, unit, rate, amount}]` — e.g. *6 days prep (daily) · 2 weeks shoot (weekly) · 2 days wrap (daily)*. Edited via `LaborBlockEditor`; the rate can be pulled from the linked crew member's rate card (`crewMemberId`). When stages exist, `subtotal` is the sum of stage amounts. Unit types: Day/Week/Month/Package/Hour/Lump etc.

## 3.4 Simple fringe vs the union engine

Two fringe mechanisms coexist:
- **Simple**: `FringeProfile` (a named %) → `fringePct` on the line → `fringeAmount`. Good for "18% UAE crew".
- **Union/statutory**: `classificationCode` links the line to frozen `ProjectRateRule`s; `LaborService.applyFringesToVersion` computes a per-rule burden into `fringeDetail` and sums it into `fringeAmount`. See `06-union-fringes.md`.

## 3.5 Versions, locking, and the working-copy workflow

`BudgetVersionStatus = WORKING | APPROVED | LOCKED`; one version is `isActive`.

- `createVersion` — new empty WORKING version.
- `setActiveVersion` — flips `isActive` (deactivates the others).
- **`lockVersion`** — sets `LOCKED` + `lockedAt`. **Enforced read-only**: `BudgetService` now calls `assertVersionEditable()` on `createLineItem`, `updateLineItem`, `deleteLineItem`, `createSection`, `updateSection`, `createAccount`, `updateAccount`, and the globals/fringe mutations — any write to a LOCKED version throws.
- **`cloneVersion`** — deep-copies a version into a new WORKING "Working Copy" (globals, fringes, sections, accounts, every line item **including provenance**; fringe-profile references are remapped to the new profiles). This is the "create a working copy to change a locked budget" path.

Frontend: the version pill shows status; **Lock baseline** (with confirm) when WORKING, **Create working copy** (prompts a name → clone → activate) when LOCKED. A LOCKED budget tab shows an amber banner and hides all add/edit/delete controls.

## 3.6 Provenance (origin) & AI-override tracking

Every line carries `origin ∈ {MANUAL, AI_GENERATED, SCRIPT_IMPORT, AUTO_BREAKDOWN, MANUAL_OVERRIDE}` plus `aiSuggestedRate` / `aiSuggestedQuantity`.

- `createLineItem` accepts `origin` (default MANUAL); AI/import callers pass their origin and the suggested numbers are captured.
- `updateLineItem` contains **override detection**: if the existing origin is AI/import and a human changes the **rate or quantity** (or stages), the line flips to `MANUAL_OVERRIDE` and the **original AI suggestion is preserved once** in `aiSuggestedRate/Quantity`.
- Breakdown writes tag origin (`AUTO_BREAKDOWN` from the scene-breakdown push; `SCRIPT_IMPORT` from the script importer) and stash the suggested rate/qty.

Frontend: small coloured origin badges on each line (AI / Script / Breakdown / Edited); hovering "Edited" reveals the original AI figure.

## 3.7 Budget transfers (line-to-line reallocation)

`BudgetTransfer` moves money between two cost centers (`fromCode`/`toCode`) with `PENDING → APPROVED/REJECTED` approval. The grand total is unchanged; per-account budgets shift. Only **APPROVED** transfers affect the revised budget. Managed from the Cost Report ("Move budget" modal + inline ✓/✗ approve). See `04-finance-accounting.md` §Cost Report.

## 3.8 Top sheet & Budget vs Actual

- `getTopSheet(versionId)` — section/department totals and percentage of grand total (the budget summary page + `print/topsheet`).
- `getBudgetVsActual(versionId)` — per account: **Original Budget**, net **Transfers**, **Approved Δ** (overages) ⇒ **Revised Budget**, vs **Actual** (`ProjectTransaction` COST APPROVED/PAID), with variance vs revised and `usedPct`. Also lists unallocated actuals (codes with no matching account). Rendered on the `actual` tab and `costreport` print.

## 3.9 Budget API surface

`getVersion · createVersion · activateVersion · lockVersion · cloneVersion · topSheet · budgetVsActual · recalculate · upsertGlobal · deleteGlobal · createFringe/updateFringe/deleteFringe · createSection/updateSection · createAccount/updateAccount · createLineItem/updateLineItem/deleteLineItem`. Full routes in `09-api-reference.md`.
