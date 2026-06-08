# 02 — Projects: creation, lifecycle, workflow

Backend: `src/production/projects/` (`ProjectsController` @ `production/projects`, `ProjectsService`).
Frontend: `app/(dashboard)/production/projects/` (list, `[id]` detail), `app/(dashboard)/production/dashboard`.

---

## 2.1 The project entity

`ProductionProject` is the aggregate root (see `01-data-model.md`). Key attributes: `projectNumber` (unique reference), `title`, `projectType` (TVC/Corporate/Documentary/Feature/Short/Music-Video/Other), `status` (lifecycle), `currency` (project base), `shootStart/EndDate`, `logoUrl`, per-diem defaults, and `totalBudget` (denormalised from the active budget version).

## 2.2 Lifecycle (`ProductionStatus`)

```
DEVELOPMENT → PRE_PRODUCTION → PRODUCTION → POST_PRODUCTION → DELIVERED
                                                   ↘ CANCELLED / ARCHIVED
```
Status is free to set via `update()`; it is informational (filters the dashboard and list) and does not gate other modules.

## 2.3 Creating a project

`POST /production/projects` → `ProjectsService.create(data)`:
1. Creates the `ProductionProject` (with chosen **currency** at creation — currency is fixed up-front so all downstream money is consistent).
2. **Auto-seeds an initial budget version** (`WORKING`, `isActive = true`) with a default chart of accounts: standard `BudgetSection`s (ATL/Production/Post/Other) and `BudgetAccount`s, plus default `BudgetGlobal`s (shoot days, prep weeks…) and starter `FringeProfile`s.

This means a brand-new project already has a usable budget skeleton.

**Optional script-first setup:** after save, the user can upload a script (`.fdx/.pdf/.docx`) which runs the breakdown importer → scenes → elements → auto-schedule → budget lines (see `08-ai-involvement.md`).

Frontend: the projects list (`projects/page.tsx`) provides search + filter by type/status, "New project", and **duplicate**.

## 2.4 Duplicate a project

`POST /production/projects/:id/duplicate` → `duplicate(id, crewScope)` clones the project, deep-copies the active budget version (globals, fringes, sections, accounts, line items), and optionally clones crew by scope: `all | atl | btl | none`.

## 2.5 Currency conversion (whole project)

`POST /production/projects/:id/convert-currency` → `convertCurrency(projectId, toCurrency, factor)`.
A **destructive** conversion that multiplies every monetary value by `factor` and sets the new `currency`, across: budget line items (+ stage rates) and ETC, project transactions, per-diems, purchase orders, timecards, locations (fees), incentives and claims, crew day/week rates, and `totalBudget`. There is no automatic undo — back up first (this is why the rate `factor` is explicit, not auto-fetched). FX rates for display elsewhere come from `setup/fx`.

Frontend: **Project Settings** tab (`ProjectSettingsPanel`) — also where the project/studio **logo** is uploaded (shown beside the TFM logo on budget and cost-report PDFs).

## 2.6 The guided workflow checklist

`GET /production/projects/:id/workflow` → `workflow(projectId)` returns an ordered checklist of setup steps with completion + prerequisite state, computed from real data: budget version present, labor snapshot taken, schedule/strips built, incentive selected, POs raised, an accounting period opened, etc. Rendered by `WorkflowChecklist` so steps can't be done out of order. This was added to standardise the production process (currency at creation, then a proper step sequence).

## 2.7 Dashboard & portfolio

- `GET /production/projects/dashboard` → `getDashboard()`: counts by status, recent projects.
- `GET /production/ledger/portfolio` → `LedgerService.portfolio()`: combined P&L/cash across **all** projects, converting mixed currencies to the base reporting currency via `FxService`. Rendered on `production/dashboard`.

## 2.8 Project detail page — tab map

`app/(dashboard)/production/projects/[id]/page.tsx` groups tabs:

| Group | Tab (`tab===`) | Renders |
|---|---|---|
| Overview | `overview` | `OverviewPanel` (finance strip + quick links) |
| Budget & Cost | `budget` | inline budget spreadsheet (sections→accounts→lines) |
| | `topsheet` | top-sheet summary (department totals & %) |
| | `fringe` | `FringeDetailPanel` |
| | `incentives` | `IncentivesPanel` |
| | `actual` | Budget vs Actual (revised budget + variance) |
| | `costreport` | `CostReportPanel` (EFC) + `FinanceSummaryStrip` |
| | `purchasing` | `PurchasingPanel` (POs + vendors) |
| | `accounting` | `AccountingPanel` (ledger/AP/payroll/reports) |
| | `cash` | `CashPanel` (forecast + petty cash) |
| | `overages` | `OveragesPanel` |
| Schedule | `schedule` | `StripboardPanel` (stripboard + DOOD + breakdown) |
| | `callsheets` | `CallSheetsPanel` |
| | `locations` | `LocationsPanel` |
| People | `crew` | `CrewAssignmentsPanel` |
| | `perdiem` | `PerDiemPanel` |
| Setup & Output | `settings` | `ProjectSettingsPanel` (logo, currency) |
| | `labor` | `ProjectLaborPanel` (union snapshot) |
| | `globals` | globals + fringe profiles editor |
| | `documents` | `DocumentsPanel` (vault) |
| | `projectemail` | `ProjectEmailPanel` (SMTP) |
| | `credits` | `EndCreditsPanel` |

The active budget version is shown with a status badge and **Lock baseline** / **Create working copy** / **Recalc** controls (see `03-budget.md`).
