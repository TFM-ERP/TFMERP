# TFM — Production Budget & Chart of Accounts

_Reference doc, 2026-06-30. Extracted read-only from the live code, Prisma schema, and seeds (cross-checked against the `All-Docs` design specs). A snapshot — if a Claude Code feature is mid-flight, the handoff will update it. Legend: ✅ implemented in code · 🔶 spec/approved-but-pending._

---

## 1. The mental model

Budgeting in a Production project rests on three ideas:

1. **Two ledgers, one account code.** The *estimate* (the budget) and the *actuals* live in separate tables and reconcile on a shared **account code** (the cost-center grain) — there is deliberately **no foreign key from an actual transaction to a specific budget line**. Estimates live in `BudgetLineItem`; actuals live in `ProjectTransaction`.
2. **The budget is versioned, not edited in place.** You don't overwrite last week's number — you create a new `BudgetVersion`. Preserving a prior estimate = a new version or a `CostReportSnapshot`.
3. **Production has its own project accounting.** It does not depend on the top-level Finance/Accounting modules — it carries its own budget hierarchy, GL bridge, and project ledger. (The company-level GL in `src/accounting/` is a separate, second chart of accounts — see §4.)

---

## 2. Budget data model

A strict four-level hierarchy, each level its own table, all hanging off the project:

```
ProductionProject
 └─ BudgetVersion         (status, isActive, lockedAt, versionSequence, parentVersionId)
     ├─ BudgetGlobal      (named variables: shoot_days, prep_weeks … value + unit)
     ├─ FringeProfile     (named % rates: "UAE Crew" 18.00 …)
     ├─ BudgetSection     (code "1000", title "Above The Line", tier ATL|BTL|POST|OTHER)
     │   └─ BudgetAccount (code "1100", title "Camera", etcAmount override)
     │         └─ BudgetLineItem   ← the atomic estimate row
     └─ BudgetLifecycleLog (audit trail of every status change)
```

**BudgetLineItem** is where the detail lives. Key fields:

| Group | Fields |
|---|---|
| Inputs | `quantity`, `quantityFormula`, `units`, `rate`, `currency` (default AED), `exchangeRate`, `fringePct`/`fringeProfileId`, `classificationCode`, `stages` (JSON per PREP/SHOOT/WRAP/POST) |
| Labor links | `castTalentId` → `GlobalTalentProfile` (union drives `classificationCode`); `crewMemberId` → crew directory (drives rate-card auto-fill) |
| Computed (stored) | `subtotal` = qty × rate ÷ exchangeRate (or Σ stages); `fringeAmount` = subtotal × fringePct/100; `total` = subtotal + fringeAmount |
| Provenance | `origin` ∈ MANUAL / AI_GENERATED / SCRIPT_IMPORT / SCRIPT_TAG / AUTO_BREAKDOWN / MANUAL_OVERRIDE / MOVIE_MAGIC_IMPORT; `aiSuggestedRate`/`aiSuggestedQuantity` (frozen when a human overrides) |

Two engines act on this model:

- **Formula engine** — `BudgetGlobal` rows are named variables; a line's `quantityFormula` (e.g. `shoot_days + prep_days`) is evaluated against them. Changing a global re-runs `recalculateVersion()` across every formula line.
- **Fringe engine** — two ways to carry burden: (1) a simple named `FringeProfile` %, or (2) a union/statutory `classificationCode` (PRODUCER, DIRECTOR, PERFORMER, STUNT, WRITER, BG, DRIVER, CREW…) that resolves frozen rate rules into a per-rule `fringeDetail`. AI never writes live numbers — proposals go through an approval row first.

---

## 3. Budget lifecycle

A version moves through a state machine, and every transition is written to `BudgetLifecycleLog` (from/to status, name snapshot, actor, role, reason):

```
DRAFT ──► REVIEW (becomes "Budget V1", V2…) ──► APPROVED ──► LOCKED ──► WORKING (branch/clone)
            ▲       │ send back                    │ reopen                 │ resubmit
            └───────┘                              └────────────────────────┘
```

- **DRAFT** — new/hand-built versions start here. **WORKING** — clones from a locked baseline and Movie Magic imports start here.
- **→ REVIEW** assigns the next sequential `versionSequence` and renames to `Budget V{n}`.
- **→ LOCKED** stamps `lockedAt` and makes the version **immutable** (`assertVersionEditable()` blocks every line/section/account/global/fringe edit); also anchors the project's shoot dates from the `shoot_days` global.
- **Clone/branch** deep-copies everything (globals, fringe profiles with remapped IDs, sections, accounts, line items incl. provenance) into a new WORKING version with `parentVersionId` set.
- **One active version at a time** (`isActive`) drives `project.totalBudget` and the cost report.

**RBAC:** lifecycle transitions require `production` level 2 **and** a per-project role of Executive Producer / Producer / Line Producer, or a global `SYSTEM_ADMIN` / `FINANCE_MANAGER`. Coordinators can view comparisons but not transition.

**Top-sheet comparison** — dual-column baseline (latest LOCKED, else APPROVED) vs working (active, else latest WORKING), matched by section code, with variance per section + grand totals.

---

## 4. Chart of Accounts — there are **two** of them

This is the most important thing to understand: TFM runs two distinct charts of accounts.

### 4a. Production Budget COA (industry / Movie Magic / AICP numbering)

Used by `BudgetSection.code`, `BudgetAccount.code`, `PurchaseOrder.costCenterCode`, and `ProjectTransaction.accountCode`. New projects are now seeded with **industry-standard topsheet numbering** natively. Tier is inferred from the leading digit: **1 = ATL · 2–4 = BTL · 5 = POST · 6+ = OTHER** (an explicitly stored section tier always wins).

| Section | Tier | Representative accounts |
|---|---|---|
| **1000** | ATL | 1100 Story/Rights & Continuity · 1200 Producers Unit · 1300 Directors Unit · 1400 Cast · 1500 Bits & Stunts · 1600 Casting · 1800 ATL Travel & Living · 1900 Fringes & Taxes (ATL) |
| **2000–4000** | BTL | 2100 Production Staff · 2200 Set Design (Art) · 2300 Set Construction · 2500 Set Operations · 2600 SFX · 2700 Set Dressing · 2750/2800 Props/Wardrobe · 2900 Makeup & Hair · 2940/3600 Location · 2960/3500 Transportation · 3200 Lighting/Electrical · 3300 Camera · 3400 Production Sound · 2990 Safety & Welfare · 4100 Animals · 4200 Second Unit |
| **5000** | POST | 5000 Post Staff & Facilities · 5100 Editing · 5200/3300 Music · 5300 Post Sound · 5400 Visual Effects · 5500 DI/Color · 5600 Titles · 5700 Stock & Deliverables |
| **6000** | OTHER | 6300 Tests · 6400 Studio · 6500 Publicity · 6700 Insurance · 6800 General/Office · 6900 Contingency / Completion Bond |
| **7000+** | Finance/Distribution (optional ledger) | 7100 Creative Materials · 7200 Media Buy · 7300 Publicity & PR · 7400 Print & Logistics · 7510 Sales & Licensing · 8100 COGS · 9100 Corporate SG&A |

Each account holds line items; labor lines carry a default fringe `classificationCode`. The distribution/studio ledger (7000/8000/9000) is optional — added at project creation or later via `POST /production/projects/:id/inject-distribution`.

> **Legacy note:** older TFM projects used a different scheme (POST=3000, OTHER=4000, distribution=6000/7000) that *collided* with industry codes (e.g. `1400` = Director in old TFM but Cast in industry; `3300` = Music vs Camera). New projects use industry numbering; existing projects keep their original codes and are bridged by the mapping table (§7). The full per-line seed lives in `prisma/seed-misfits.js`, `seed-jurisdiction.js`, and `ProjectsService.createDefaultBudget()`.

### 4b. Company GL COA (`src/accounting/` — UAE SME, ~34 accounts)

A separate double-entry general ledger (`GlAccount`), seeded once via `POST /accounting/accounts/seed`. This is the statutory/company books, distinct from the per-project budget COA above.

| Range | Type | Examples |
|---|---|---|
| 1000–1510 | ASSET | 1000 Cash · 1010 Bank — Current (isBank) · 1100 AR · 1200 Input VAT · 1500 Rental Fleet |
| 2000–2360 | LIABILITY | 2000 AP · 2100 Output VAT · 2300 End-of-Service · 2350 Benefits & Union Payable · 2360 Payroll Taxes |
| 3000–3200 | EQUITY | 3000 Owner Capital · 3100 Retained Earnings |
| 4000–4200 | INCOME | 4000 Rental Revenue · 4100 Production Services Revenue · 4200 Other Income |
| 5000–5690 | COST OF SALES | 5000 Cost of Services · 5300 Freelance & Crew · 5400 Production Costs (WIP) · 5600 Fringe Benefits · 5610 Payroll Taxes · 5630 End-of-Service Provision |
| 6000–6900 | OPERATING | 6000 Salaries · 6100 Rent & Utilities · 6400 Insurance · 6600 Depreciation · 6900 Other |

Normal balances: debit = ASSET/EXPENSE; credit = LIABILITY/EQUITY/INCOME. Every journal entry must balance (Dr = Cr, enforced).

### How the two connect

The **GL bridge** (`production-gl.service.ts`) mirrors each project actual into a balanced, POSTED `JournalEntry` in the company GL using fixed codes: cost → **Dr 5400** (Production Costs WIP) / **Cr 1010** (Bank) or **Cr 2000** (AP); income → **Dr 1010/1100** / **Cr 4100** (Production Services Revenue). Fringe burden posts **Dr 56xx / Cr 23xx**. It's idempotent (tracks `journalEntryId`), reversible (void), and period-safe.

---

## 5. Cost tracking — budget vs actual

Actuals are all `ProjectTransaction` rows (`kind = COST | INCOME`), fed by PO invoices, petty-cash spends, timecard/payroll postings, location fees, and manual entries. The **Cost Report** is computed live per account code:

```
Budget    = Σ BudgetLineItem.total           (active version, by account)
Transfer± = Σ APPROVED BudgetTransfer         (net by code; grand total unchanged)
Approved Δ= Σ APPROVED Overage                (additive by code)
Revised   = Budget + Transfer + Approved Δ
Committed = Σ open PO remaining               (APPROVED + PARTIALLY_INVOICED)
Actual    = Σ ProjectTransaction COST          (APPROVED | PAID)
ETC       = account.etcAmount override, else Committed
EFC       = Actual + ETC
Variance  = Revised − EFC                      (negative = overspent)
```

Supporting pieces:

- **Purchase Orders** — `PO-YYYY-NNNN`, bound to a `costCenterCode` and optionally a specific `budgetLineItemId` (SmartPO). Invoicing a PO posts a COST transaction and advances PARTIALLY_INVOICED → CLOSED.
- **Budget Transfers** — move money between two cost centers with approval; net-zero on the grand total.
- **Overages** — account-coded over-spend requests with approval; lift that account's revised budget. Overspent accounts are auto-detected.
- **Per diem & timecards** — burdened employer cost: gross + OT + box/kit + per-diem + fringe → posted as a coded COST (period-guarded). This is employer-cost accounting, **not** gross-to-net payslips.
- **AP aging & payment run** — open APPROVED costs bucketed by overdue days; `paySelected` enforces four controls (status APPROVED, invoice number present, vendor invoice document attached, segregation of duties: releaser ≠ approver) and requires **2FA**.
- **Period locks** — `AccountingPeriod` (`YYYY-MM`, OPEN/CLOSED); posting into a CLOSED month is blocked everywhere.
- **Snapshots** — `CostReportSnapshot` freezes a point-in-time report (budget/committed/actual/efc/variance).
- **Forecast** — burn-rate projection from schedule days elapsed for accounts without a manual ETC.

---

## 6. GL / accounting integration (double-entry)

- **JournalEntry** `JE-YYYY-NNNN`, status DRAFT → POSTED → VOID; posted entries can't be edited or deleted, only voided. **JournalLine** carries account, debit, credit, reconciliation flags.
- **Auto-posting** (idempotent, keyed on sourceType/sourceId): Invoice → Dr AR / Cr revenue + Cr Output VAT; Expense → Dr expense + Dr Input VAT / Cr AP; Payment cleared → Dr Bank / Cr AR; **Fringe burden** per budget version → Dr 56xx / Cr 23xx (one balanced entry per version, replaces prior).
- **Reconciliation** — bank accounts (`LedgerBankAccount`, optionally project-dedicated) with line clearing and `BankReconciliation`.
- **Trial balance / P&L / balance sheet** summaries available from the accounting module.

---

## 7. Movie Magic / industry COA reconciliation

`CoaMappingTable` (`sourceSystem` = MOVIE_MAGIC | TFM_LEGACY, `externalCode` → `masterCode`) is how TFM round-trips with Movie Magic Scheduling and re-imports legacy budgets:

- **MOVIE_MAGIC** rows are identity mappings (the master COA is now industry-native, so external = master 1:1) — seeded by `seed-jurisdiction.js`.
- **TFM_LEGACY** rows translate old TFM codes → new industry codes (e.g. 1400 Director→1300, 1500 Cast→1400, 2200 Camera→3300, 2960 Transport→3500, 3400 VFX→5400) — seeded by `seed-mm-mapping.js`.
- Resolution is by **code + description via the AI mapper** (`DynamicContextService` feeds both tagged sets) — no hardcoded mapping logic. Four MMS breakdown categories were added (CAMERA, ADDITIONAL_LABOR, MECHANICAL_FX, ANIMAL_WRANGLER).

---

## 8. Crew ↔ COA link

On any budget line, a Line Producer can pick a crew member onboarded to the project (`CrewService.findByProject`, shown as *name · role · rate/day*). Selecting sets the line's `crewMemberId`; if the assignment has a daily rate, the UI offers to pull it into the line's `rate` (units → days). The grid then shows a badge (e.g. `1301 Producer — Qais Qandil`). Cast lines use `castTalentId` instead, which resolves the union `classificationCode` automatically (SAG-AFTRA/ACTRA/Equity → PERFORMER). Crew-department BTL lines default to the generic `CREW` classification, refined per project after the labor snapshot.

---

## 9. API surface (by controller)

- **`production/budget`** (perm production:2) — versions CRUD + `activate`/`lock`/`status` (lifecycle), `clone`, `topsheet`, `topsheet-comparison/:projectId`, `budget-vs-actual`, `recalculate`, `lifecycle/:projectId`, globals/fringes/sections/accounts/items CRUD.
- **`production/costing`** — `report/:projectId`, `forecast`, `snapshots`, `overspend`, `finance-summary`, `reporting-pack`, transfers CRUD + status, POs CRUD + status/submit/revise/`invoice`/upload, petty-cash floats + txns (+ OCR receipt), vendors, cashflow.
- **`production/ledger`** — transactions CRUD + status/submit, `summary`, `portfolio`, `ap-aging`, `pay/:projectId` (2FA + SoD), `by-account`, `account/:code`, `gl`, accounting `periods` open/close.
- **`production/gl`** — `sync/:projectId` (mirror actuals → GL), `reconcile/:projectId`.
- **`production/overages`**, **`production/perdiem`** — CRUD + status (+ `perdiem/generate` from schedule).
- **`accounting`** (company GL) — accounts CRUD + `seed`, journals CRUD + post/void, `post-all`, `post-burden/:versionId`, `trial-balance`, `summary`, bank accounts + reconciliation.

---

## 10. Implemented vs. spec

**✅ Implemented:** the full budget hierarchy + versioning + lifecycle + formula/fringe engines; cost report / BvA / forecast; POs, transfers, overages, per-diem, timecards; project ledger + AP aging + payment run (2FA/SoD); period locks; the GL bridge + company double-entry GL + fringe-burden posting; Movie Magic / legacy COA mapping; ZATCA (UAE) and JoFotara (Jordan) e-invoice **schema fields**.

**🔶 Spec / pending (approved architecture, not yet built):** SOX-grade VOID-instead-of-delete on `ProjectTransaction`; multi-currency FX month-end revaluation (account 6810); UAE Reverse-Charge VAT and Withholding Tax auto-postings; ZATCA Fatoora & JoFotara middleware (the actual clearance calls); weekly financier cost-report snapshot locking with trial-balance/bank-rec proof; episodic amortization ledger.

---

## 11. Source of truth (files)

- Schema: `backend/prisma/schema.prisma` — budget models ~L4471–4600, GL/journal ~L4326–4400, PO/Overage/Transfer/Snapshot ~L3973–4135, `CoaMappingTable` ~L1665.
- Seeds: `seed.ts`, `seed-jurisdiction.js` (master COA + MM identity map), `seed-mm-mapping.js` (TFM_LEGACY), `seed-misfits.js` (real budget with concrete codes/actuals).
- Code: `src/production/budget|costing|gl|ledger/*.service.ts`; company GL in `src/accounting/accounting.service.ts` (`STANDARD_COA`).
- Design specs: `All-Docs/docs__budget-data-model-overview.md`, `…__production__03-budget`, `…12-budget-lifecycle`, `…13-master-coa-and-crew-link`, `…17-mm-industry-coa-reconciliation`, `…18-budget-accounting-structure`, `…04-finance-accounting`.
