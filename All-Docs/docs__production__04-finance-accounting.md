# 04 — Finance & Accounting

The six finance surfaces — **Budget vs Actual, Cost Report, Purchasing, Accounting, Cash, Overages** — all read one ledger (`ProjectTransaction`) and one budget picture, so they tie out. Backends: `costing/`, `ledger/`, `payroll/`, `locations/`. A shared `FinanceSummaryStrip` sits atop every finance tab.

---

## 4.1 The actuals ledger — `ProjectTransaction`

The single source of truth for money that has actually been committed/spent/received. `kind = COST | INCOME`; `status` drives recognition:
- **Actual cost** = COST with status `APPROVED` or `PAID`.
- **Recognised income** = INCOME with status `INVOICED/RECEIVED/PAID/APPROVED`; **cash-in** = `RECEIVED/PAID`.
Every actual flows in here: PO invoices, petty-cash spends, payroll postings, location fees, and manual entries.

`LedgerService`: `list`, `create`, `update`, `setStatus`, `remove`, `summary` (income/cost/net/margin), `portfolio` (cross-project, FX-normalised), `byAccount` (group COSTs by code + uncoded flag), `accountLedger(code)` (drill-down), `glByAccount` (debit/credit GL).

## 4.2 Period close

`AccountingPeriod` (`YYYY-MM`, `OPEN|CLOSED`). `setPeriod` opens/closes; `listPeriods` lists. The private `assertOpen(projectId, date)` guard throws on any post into a CLOSED month and is enforced on: ledger `create/update/remove`, `paySelected`, **PO `invoicePo`**, **petty-cash SPEND `addPettyTxn`**, and **timecard `post`** — so Purchasing and Cash can't bypass the lock.

## 4.3 Accounts Payable

A COST with status `APPROVED` (unpaid) is an open payable.
- `apAging(projectId)` — open payables bucketed by `dueDate`: current / 1–30 / 31–60 / 61–90 / 90+, with outstanding = total − paidAmount.
- `paySelected(projectId, ids, paidDate)` — the **payment run**: marks selected invoices `PAID` (period-guarded), sets `paidDate`/`paidAmount`.

Rendered in `AccountingPanel` (Ledger / Payables / Payroll / Reports tabs).

## 4.4 Purchasing — POs & vendors

`CostingService` + `PurchasingPanel`.
- **PO lifecycle**: `DRAFT → APPROVED → PARTIALLY_INVOICED → CLOSED` (or `CANCELLED`). `createPo`, `updatePo`, `setPoStatus`, `removePo`. Open POs (APPROVED/PARTIALLY_INVOICED) are the **committed** figure.
- **`invoicePo(id, {amount})`** — posts a `ProjectTransaction` COST (status APPROVED) carrying `vendorId`, `reference = poNumber`, and `dueDate = PO.expectedDate` (so it ages correctly in AP), then advances `invoicedAmount` and closes the PO when fully invoiced. Period-guarded.
- **Vendors**: per-project `ProductionVendor`, optionally **linked to the company Supplier master** (`supplierId`). `supplierCatalog(projectId)` lists active suppliers flagged linked/unlinked; `addFromSuppliers(projectId, ids[])` imports one/many/all as linked vendors (snapshotting name/category/TRN/contact); `refreshVendorFromSupplier(id)` re-pulls the snapshot. Plus ad-hoc one-off vendors.

## 4.5 Petty cash & cash flow — `CashPanel`

- `PettyCashFloat` (holder, opening, OPEN/CLOSED) → `PettyCashTxn` (`TOPUP|SPEND`). A **SPEND** posts a linked `ProjectTransaction` COST (status PAID) via `ledgerTxnId`, so petty spends appear in the cost report; deleting the petty txn deletes its ledger row. `addPettyTxn` is period-guarded.
- `cashflow(projectId)` — weekly buckets (Mon-start): inflow/outflow (recognised) + forecastIn (invoiced income) + forecastOut (open PO remaining at expected date), running cumulative closing cash.

## 4.6 Cost Report (EFC) — `CostReportPanel`

`costReport(projectId)` computes, per account and rolled to sections/totals:
```
Budget        Σ line.total
Transfer ±    Σ APPROVED BudgetTransfer net by code
Approved Δ    Σ APPROVED Overage by code
Revised       Budget + Transfer + Approved Δ
Committed     Σ open PO remaining by code
Actual        Σ COST (APPROVED|PAID) by code
ETC           account.etcAmount  else  remaining commitments
EFC           Actual + ETC
Variance      Revised − EFC        (overspent flag when < 0)
```
Features: editable ETC per account; **Move budget** modal (creates a PENDING `BudgetTransfer`); inline ✓/✗ transfer approval; per-line **raise overage** for overspent lines; snapshot history (`saveSnapshot`/`listSnapshots` → `CostReportSnapshot`); CSV + branded PDF (`print/costreport/[projectId]`, shows Budget→Revised→Committed→Actual→EFC→Variance) + email.
- `financeSummary(projectId)` — the unified strip: budget/transfer/approvedChange/revisedBudget/committed/actual/efc/variance + cash position.
- `overspendSuggestions(projectId)` — accounts where EFC > revised budget, with the gap, powering one-click overage raising.

## 4.7 Overages — `OveragesPanel`

`Overage` (account-coded, `PENDING→APPROVED/REJECTED`). **Approved overages lift that account's revised budget** in the cost report and budget-vs-actual. The panel auto-detects overspent accounts (via `overspend`) and lets you raise a pre-filled overage; approve/reject inline.

## 4.8 Payroll / timecards — `payroll/`

`Timecard` → burdened production cost. `preview` computes live (no save) gross + OT + box/kit + per-diem + **fringe via the fringe-engine** (by `classificationCode`) + total. `create`/`update` store the computed card (locked once POSTED). **`post(id)`** posts the burdened total as a coded `ProjectTransaction` COST (period-guarded) and stamps `postedTxnId`; `reverse` deletes that cost and reverts to APPROVED. This is employer-cost accounting, not gross-to-net payslips (intentionally out of scope).

## 4.9 Location fees — `locations/`

`postFee(id, days)` posts `locationFeePerDay × days` as a coded `ProjectTransaction` COST, auto-mapping to a "Locations" budget account when one exists. (Locations themselves are covered in `05-crew-people.md`.)

## 4.10 How the surfaces tie together

```
Budget (estimate)  ─┐
                    ├─ matched by accountCode ─► Cost Report / Budget vs Actual / Finance strip
ProjectTransaction ─┘ (actuals: POs invoiced, petty spends, payroll, fees, manual)
PurchaseOrder (open) ─► Committed   |   BudgetTransfer(APPROVED) ± and Overage(APPROVED) + ─► Revised Budget
AccountingPeriod ─► locks posting   |   PettyCash SPEND & Timecard POST & PO invoice ─► post into the ledger
```
