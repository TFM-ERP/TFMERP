# TFM System — Budget & Cost Data Model Overview

_A reference for planning enhancements. Describes the system exactly as it stands today (no changes made)._

---

## 1. Data Model Structure — how a line item is represented

The budget is a **four-level hierarchy**, each level its own table:

```
ProductionProject
   └── BudgetVersion        (status: WORKING | APPROVED | LOCKED, isActive)
         └── BudgetSection  (code, title, tier: ATL | BTL | POST | OTHER)
               └── BudgetAccount   (code e.g. "2100", title, etcAmount override)
                     └── BudgetLineItem   ← the line item
```

A **line item is a single row in `budget_line_items`**. It holds both the **inputs** and the **computed outputs** in the same row, and **values are updated in place** (an edit overwrites the previous value):

| Group | Fields | Meaning |
|---|---|---|
| Inputs | `quantity`, `quantityFormula`, `units`, `rate`, `currency`, `exchangeRate`, `fringePct`/`fringeProfileId`, `classificationCode`, `crewMemberId`, `stages` (JSON) | What you type/import — the estimate drivers |
| Stage detail | `stages` JSON `[{stage, qty, unit, rate, amount}]` | Prep/Shoot/Wrap/Post breakdown |
| Computed | `subtotal` = qty × rate ÷ fx (or sum of stages); `fringeAmount` = subtotal × fringePct; `total` = subtotal + fringeAmount | Recalculated and stored on save |

**Schema snippet (trimmed):**

```prisma
model BudgetLineItem {
  id        String  @id @default(cuid())
  accountId String                       // → BudgetAccount
  code      String?                       // sub-account code
  subTitle  String?                       // sub-account label / provenance tag (see Q2)
  description String
  quantityFormula String?                 // e.g. "shoot_days + prep_days"
  quantity  Decimal @default(1)           // resolved value
  units     String?
  rate      Decimal @default(0)
  fringePct Decimal @default(0)
  classificationCode String?              // links to union/statutory rate rules
  crewMemberId String?                    // rate-card auto-fill
  stages    Json?                         // per-stage breakdown
  subtotal     Decimal @default(0)        // ← computed, stored in place
  fringeAmount Decimal @default(0)        // ← computed, stored in place
  total        Decimal @default(0)        // ← computed, stored in place
}
```

**Key point for planning:** estimates and actuals **are** separated — but **across two tables, not two columns on the line.** The line item carries only the **estimate** (the budget). Live **actuals live in a separate table** (`ProjectTransaction`, see Q4). There is **no "original vs current" pair on the line itself**; the only way to preserve a prior estimate today is to create a **new BudgetVersion** (snapshot) or a **CostReportSnapshot**.

---

## 2. AI & Manual Ingestion Logic — how values get written

**Both AI/automated importers and manual user edits write to the same tables and the same fields, through the same service layer.** There is **no separate "AI" pipeline or staging table**, and **no first-class provenance/source column** on the line item.

| Source | Path | What it writes |
|---|---|---|
| Manual entry/edit | `budget.service.createLineItem` / `updateLineItem` | All line-item fields directly |
| Script import (.fdx/.pdf/.docx) | `script-import.service.importScript` | Creates **scenes + BreakdownElements**, not budget lines directly; tags with `Imported: <filename>` |
| Breakdown → budget | `breakdown.service` push-to-budget | Creates line items tagged `subTitle = "Breakdown"` / `"Auto-Breakdown"` |
| AI rate research | `labor.service.aiResearch` | Does **not** touch budget lines — writes **`RateChangeProposal`** rows that require approval before any rate changes |

**How AI vs manual is distinguished today:** only by **convention, not by a dedicated flag.** Auto-generated lines are marked via the `subTitle` field (`"Breakdown"`, `"Auto-Breakdown"`) or a `description` tag (`"Imported: …"`). There is **no `source` / `aiGenerated` / `isOverride` column**, so once a value is in `budget_line_items` you **cannot reliably tell an AI-suggested number from a hand-typed one** except by that tag convention, and a manual edit over an AI line leaves no trace.

> Notably, AI rate suggestions are deliberately **approval-gated** (they become `RateChangeProposal`s) rather than writing live — that is the one place AI output is kept separate from committed data.

---

## 3. State Management — draft vs locked/approved

Yes — but **state lives at the *version* level, not the line level.**

| Scope | Field / enum | Values |
|---|---|---|
| **Budget version** | `BudgetVersionStatus` + `isActive` + `lockedAt` | **WORKING → APPROVED → LOCKED** |
| Project lifecycle | `ProductionStatus` | DEVELOPMENT, PRE_PRODUCTION, PRODUCTION, POST_PRODUCTION, DELIVERED, CANCELLED, ARCHIVED |
| Ledger transaction | `ProjectTxnStatus` | DRAFT, APPROVED, INVOICED, PAID, RECEIVED, VOID |
| Accounting period | `AccountingPeriod.status` | OPEN / CLOSED (locks a month) |
| Approvals layer | `OverageStatus`, `TransferStatus`, `ProposalStatus`, `ApprovalStatus` | PENDING / APPROVED / REJECTED |

So a project has a clear **"locked/approved budget" mechanism**: lock the active `BudgetVersion` (sets `LOCKED` + `lockedAt`). A locked version is the immutable baseline; new work goes into a fresh version.

**Gap for planning:** there is **no per-line-item status** — an individual line can't be "draft" or "approved" on its own; the lock is **all-or-nothing at the version grain**.

---

## 4. Live Cost Tracking — how actuals link to a budget line

Actuals are **calculated dynamically at request time**, never hard-coded. But the link is **indirect**:

- Live costs are **not stored on the budget line.** They are rows in **`ProjectTransaction`** (`kind = COST`).
- A cost is tied to the budget by **matching `accountCode`** (the `BudgetAccount.code`) — **there is no foreign key from a transaction to a specific `BudgetLineItem`.** So the link is at the **account/cost-center grain**, not the individual line.

**Everything that becomes an actual flows into that one ledger:**

```
PurchaseOrder ──(invoice)──┐
Petty-cash SPEND ──────────┤
Timecard / payroll ────────┼──▶  ProjectTransaction (kind = COST, accountCode)
Location fee ──────────────┤
Manual cost entry ─────────┘
        (open POs = "committed", not yet actual)
```

The **Cost Report computes live, on each load**, grouping by `accountCode`:

```
Budget        = Σ BudgetLineItem.total           (per account)
+ Transfers   = Σ approved BudgetTransfer         (± between accounts)
+ Approved Δ  = Σ approved Overage                 (additive)
= Revised Budget
Committed     = Σ open PurchaseOrder remaining
Actual        = Σ ProjectTransaction COST (APPROVED/PAID)
ETC           = account.etcAmount override, else remaining commitments
EFC           = Actual + ETC
Variance      = Revised Budget − EFC
```

Only two things are **persisted (denormalised)**: the line's own computed `subtotal/fringeAmount/total`, and optional **`CostReportSnapshot`** rows (a frozen copy of the whole report at a moment in time). Everything else is recomputed.

---

## Data-flow at a glance

```
        ESTIMATE side                          ACTUAL side
   ┌──────────────────────┐            ┌───────────────────────────┐
   │  BudgetLineItem      │            │  ProjectTransaction (COST) │
   │  (qty × rate → total)│            │  from POs, petty cash,     │
   │  grouped by account  │            │  payroll, fees, manual     │
   └──────────┬───────────┘            └─────────────┬─────────────┘
              │  match on accountCode (no line-level FK)
              ▼                                       ▼
        ┌───────────────────────────────────────────────────┐
        │   COST REPORT  (computed live, per account code)   │
        │   Budget → Revised → Committed → Actual → EFC → Var │
        └───────────────────────────────────────────────────┘
                 ▲                         ▲
        approved BudgetTransfer     approved Overage
        (move between lines)        (lift the budget)
```

---

## Implications for your enhancement plan

These are the structural facts most likely to shape any redesign:

1. **In-place edits overwrite estimates.** There is no original-vs-current pair on the line; historical estimates survive only as separate `BudgetVersion`s / `CostReportSnapshot`s. A true "frozen original budget vs live working budget" on the same line would need new columns (e.g. `originalTotal`).
2. **No provenance field.** AI-generated, imported, and manually-typed values are indistinguishable except by the `subTitle` tag convention. Tracking "AI value vs manual override" would need a dedicated column (e.g. `source`, `aiSuggestedRate`, `isManualOverride`).
3. **Actuals attach to account code, not line id.** Line-by-line actual tracking (rather than per-cost-center) would require a `budgetLineItemId` foreign key on `ProjectTransaction`.
4. **Locking is version-grain.** Per-line approval/lock states would be a new concept (`BudgetLineItem.status`).
5. **What already works well:** clean estimate/actual separation across tables, version-level locking, approval-gated overages/transfers/AI rate proposals, and a fully dynamic cost report.
