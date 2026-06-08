# TFM System — Production Module Technical Documentation

**The Film Makers FZ LLC — Production ERP**
Generated from a full read of the current codebase (schema, backend services & routes, frontend). This set describes the **Production module** end to end: data model, features, relationships, budgeting, finance/accounting, crew, locations, scheduling, union/fringes, rebates/incentives, and AI involvement.

---

## How this documentation is organised

| File | Covers |
|---|---|
| `README.md` (this file) | Architecture, tech stack, module map, cross-cutting concepts |
| `01-data-model.md` | Every Prisma model, field, relation and enum in the production domain |
| `02-projects.md` | Project entity, creation, lifecycle, workflow checklist, currency conversion, duplicate, settings |
| `03-budget.md` | Budget hierarchy, globals & formulas, fringe profiles, stages, ATL/BTL, versions, lock/working-copy, provenance, transfers |
| `04-finance-accounting.md` | Ledger, cost report (EFC), budget-vs-actual, AP aging & payment run, period close, purchasing, petty cash, cashflow, overages, payroll, location fees |
| `05-crew-people.md` | Crew directory & assignments, deal memos, per-diem, locations, scheduling, breakdown, call sheets, credits |
| `06-union-fringes.md` | Fringe engine, geo/labor bodies/agreements/classifications/rate rules, versioning, proposals & approval, refresh, project snapshot |
| `07-rebates-incentives.md` | Incentive programs, project incentives, Abu Dhabi rebate claim tracker, estimate engine |
| `08-ai-involvement.md` | Where AI is used: rate research, update-all, script breakdown, provenance, the Anthropic integration, guardrails |
| `09-api-reference.md` | Full HTTP route inventory for every production controller |
| `10-movie-magic-sync.md` | Bidirectional Movie Magic Budgeting/Scheduling import & export |
| `12-budget-lifecycle-and-topsheet-comparison.md` | Lifecycle state machine (DRAFT→REVIEW→APPROVED→LOCKED→WORKING), audit log, dual-column topsheet |
| `13-master-coa-and-crew-link.md` | Default Chart of Accounts seed + crew-to-budget-line linking |
| `14-system-flows-and-charts.md` | **Master visual reference** — ER chart + every flow (fringes, budget⇄accounting, rebates, creation, lifecycle) as Mermaid diagrams + file map |
| `15-distribution-ledger-and-mm-import-refactor.md` | Optional 6000–9000 distribution/P&A/revenue/corporate ledger + Movie Magic import fixes (legacy fringes, sub-details, merge strategies) |
| `16-setup-labor-fringe-fx-flows.md` | **Setup visual reference** — Labor & Fringe Master, Rate Approvals workflow, Currencies & FX as Mermaid charts + file map |

---

## Technology stack

**Backend** — NestJS (modular: `*.module.ts` / `*.controller.ts` / `*.service.ts`), Prisma ORM over **PostgreSQL**. Schema managed with `prisma db push` + `prisma generate` (no migration files). Auth via JWT; every production controller is guarded by `JwtAuthGuard` + `PermissionsGuard` with `@RequirePermission('production', <level>)` (1 = read, 2 = write). An audit-log interceptor records mutations.

**Frontend** — Next.js 14 (App Router), `(dashboard)` route group, React + TypeScript, Tailwind (custom `.card` / `.input` / `.btn-*` / `brand-*` utilities), `lucide-react` icons. A single `frontend/src/lib/api.ts` (axios) exposes typed helper groups per backend module. Print/PDF "documents" are dedicated client pages under `app/print/*` that call `window.print()`.

**File storage** — Uploaded files (crew photos, documents, scripts, logos) are written under `backend/uploads/` and served by the backend at `/uploads/...`. The frontend resolves them with an `assetUrl()` helper (`API_ROOT + url`).

**AI** — Anthropic Messages API (`x-api-key`, `anthropic-version: 2023-06-01`, default model `claude-3-5-sonnet-20241022`, overridable via `LABOR_AI_MODEL`). Key lives only in `backend/.env` as `ANTHROPIC_API_KEY`.

---

## Module map (backend)

```
src/production/
  projects/      project CRUD, dashboard, workflow, currency convert, duplicate
  budget/        budget versions, sections, accounts, line items, globals, fringes, lock/clone
  costing/       cost report (EFC), POs, vendors, supplier import, transfers, petty cash, cashflow, snapshots
  ledger/        per-project transactions (the actuals ledger), AP aging, payment run, period close, GL
  scheduling/    stripboard, day-out-of-days, auto-schedule
  breakdown/     scene breakdown elements, script import (AI), push-to-budget
  payroll/       cast/crew timecards → burdened cost posting
  locations/     location binder, permits, fee posting
  perdiem/       per-diem claims + generate-from-schedule
  overages/      overage requests + approval
  callsheets/    call sheets + publish + email
  credits/       end-credit roll
  crew/          per-project crew assignments + production schedule days
  documents/     project document vault
  mail/          production email (global + per-project SMTP), send callsheet/cost-report/deal-memo
src/labor/       union/fringe intelligence: geo, labor bodies, agreements, classifications,
                 rate rules, sources, proposals, project snapshot, fringe-engine, incentives, claim
```

---

## Cross-cutting concepts (read this first)

These ideas recur across the whole module and explain *why* the data model is shaped the way it is.

### 1. Two-ledger separation: estimate vs actual
- **Budget (estimate)** lives in the `BudgetLineItem` tree (Version → Section → Account → LineItem).
- **Actuals** live in a *separate* table, **`ProjectTransaction`** (`kind = COST | INCOME`).
- They are reconciled **by matching `accountCode`** (the `BudgetAccount.code`), not by a per-line foreign key. So actuals attach at **cost-center grain**, not individual line grain.

### 2. The cost report is computed live, never stored
`CostingService.costReport()` recomputes on every request:
```
Budget        = Σ BudgetLineItem.total            (per account)
± Transfers   = Σ APPROVED BudgetTransfer          (between accounts, nets to zero)
+ Approved Δ  = Σ APPROVED Overage                 (additive)
= Revised Budget
Committed     = Σ open PurchaseOrder remaining
Actual        = Σ ProjectTransaction COST (APPROVED|PAID)
ETC           = BudgetAccount.etcAmount override, else remaining commitments
EFC           = Actual + ETC
Variance      = Revised Budget − EFC
```
Only `CostReportSnapshot` rows freeze a point-in-time copy.

### 3. Immutable baselines via version state
`BudgetVersion.status` = `WORKING | APPROVED | LOCKED`. A **LOCKED** version is read-only (enforced server-side on every line/section/account/global/fringe mutation). To change a locked budget you **clone a working copy** (`cloneVersion`) or **move money via an approved `BudgetTransfer`**.

### 4. Approval gates everywhere money or rates move
`BudgetTransfer`, `Overage`, and `RateChangeProposal` all use a `PENDING → APPROVED/REJECTED` state, and only **APPROVED** rows affect computed figures. AI never writes live numbers — it files proposals.

### 5. Frozen snapshots for legal safe-harbor
Union/statutory rates are resolved from a master library but **frozen onto the project** (`ProjectRateRule`, `ProjectLaborConfig`) at snapshot time. Master updates never retroactively change historical projects; the project can opt-in to apply new versions.

### 6. Provenance on every budget line
`BudgetLineItem.origin` (`MANUAL | AI_GENERATED | SCRIPT_IMPORT | AUTO_BREAKDOWN | MANUAL_OVERRIDE`) plus `aiSuggestedRate` / `aiSuggestedQuantity` track where a number came from and preserve the original AI/import suggestion when a human edits it.

### 7. Period close
`AccountingPeriod` (`OPEN | CLOSED` per `YYYY-MM`) locks a month. `assertOpen()` guards ledger create/update/delete, PO invoicing, petty-cash spends, payment runs, and timecard posting — nothing can post into a closed month.

### 8. Pure fringe engine
`labor/fringe-engine.ts` is **DB-free**: typed rate primitives (`PERCENT`, `FLAT_PER_DAY`, `FLAT_PER_WEEK`, `FLAT_PER_HOUR`, `PERCENT_WITH_CAP`, `TIERED`) computed by `computeRule` / `computeLineFringes`, and matched by `resolveRules`. Reused by budget fringe apply, payroll, and labor preview.
