# 07 — Rebates & Incentives

Incentive estimation and the Abu Dhabi film-rebate claim tracker. Backend: `src/labor/` (incentive methods on `LaborService`). Frontend: project `incentives` tab (`IncentivesPanel`), `AdRebateTracker`, and the labor master `setup/labor`.

---

## 7.1 Incentive program catalogue — `IncentiveProgram`

Master list of programs keyed to geography (`GeoNode`):
`name`, `authority`, `incentiveType` (TAX_CREDIT/REBATE/CASH_REBATE/GRANT/EXEMPTION), `ratePct` (fraction, e.g. 0.30), `basis` (TOTAL/BTL/LABOR/WAGES/QUALIFIED), `minSpend`, `capAmount`, `upliftPct` (bonus), `transferable`/`refundable`, `currency`, `productionTypes`, cited `sourceTitle/sourceUrl`, effective/expiration, `isEstimate`, `isActive`.

CRUD: `incentivePrograms(geoNodeId)`, `createIncentiveProgram`, `updateIncentiveProgram`, `removeIncentiveProgram`.

## 7.2 Project incentives (frozen snapshot) — `ProjectIncentive`

Selecting a program onto a project snapshots its parameters (`programId` pointer + frozen `ratePct/basis/cap/minSpend/uplift/currency`, optional `qualifiedSpendOverride`). So later master edits don't change a project's modelled incentive.
- `projectIncentives(projectId)`, `addProjectIncentive`, `updateProjectIncentive`, `removeProjectIncentive`.
- The estimate engine computes the modelled benefit = `ratePct × qualifying base` (base chosen by `basis`, optionally overridden), respecting `minSpend`, `capAmount`, and `upliftPct`. Surfaced in `IncentivesPanel` against the live budget/cost figures.

## 7.3 Abu Dhabi rebate claim tracker — `IncentiveClaim`

A dedicated, points-based tracker for the ADFC (Abu Dhabi Film Commission) rebate, modelled from the official **ADFC Rebate Guidelines 2025**.

Fields: `programName` (default "Abu Dhabi Film Rebate"), `currency` (AED), `standardPct` (default 0.35), `criteria` JSON `[{key,label,points,selected}]`, `totalPoints`, `enhancedPct`, `totalPct`, `adqpe` (**Abu Dhabi Qualifying Production Expenditure**), `capAmount`, `estimatedRebate`, and `stages` JSON `[{key,label,status,date,note}]` for the certificate/audit pipeline.

- `getClaim(projectId)` / `saveClaim(projectId, data)`.
- **Enhanced-percentage bands** (points → enhanced uplift): 10–14 → +2.5%, 15–39 → +5%, 40–69 → +7.5%, 70–84 → +10%, 85+ → +15% (added on top of the 35% standard).
- `estimatedRebate = totalPct × ADQPE`, capped at `capAmount`.
- The `stages` track the route to the certificate and through audit to receive the program amount.
Rendered in `AdRebateTracker` (criteria checklist, doc/stage checklist, deadlines).

## 7.4 AI assist

The labor "update all" routine (`aiUpdateAll`) also refreshes the latest Abu Dhabi incentive parameters as **proposals** for review (it never writes program rates live). See `08-ai-involvement.md`.
