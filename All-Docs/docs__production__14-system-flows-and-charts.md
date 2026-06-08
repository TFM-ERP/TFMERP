# 14 — Production System: Flows & Charts (Master Visual Reference)

One consolidated, current view of the production module: data relations, budget layout & math, fringe infusion, budget↔accounting workflow, rebates, project-creation paths, draft-vs-locked behaviour, and the file map. Diagrams are Mermaid — they render as charts in VS Code (with the Mermaid extension), GitHub, and most markdown viewers.

---

## 1. Data structure & relations (ER chart)

```mermaid
erDiagram
    ProductionProject ||--o{ BudgetVersion : "versions (one isActive)"
    ProductionProject ||--o{ ProjectTransaction : "actuals ledger"
    ProductionProject ||--o{ PurchaseOrder : ""
    ProductionProject ||--o{ ProductionVendor : ""
    ProductionProject ||--o{ BudgetTransfer : "approved = reshape budget"
    ProductionProject ||--o{ Overage : "approved = lift budget"
    ProductionProject ||--o{ AccountingPeriod : "month locks"
    ProductionProject ||--o{ ProductionCrew : ""
    ProductionProject ||--o{ Location : ""
    ProductionProject ||--o{ ProductionStrip : "stripboard"
    ProductionProject ||--|| ProjectLaborConfig : "labor snapshot config"
    ProductionProject ||--o{ ProjectRateRule : "FROZEN fringe rules"
    ProductionProject ||--o{ ProjectIncentive : "frozen incentive snapshot"
    ProductionProject ||--o{ IncentiveClaim : "AD rebate tracker"
    ProductionProject ||--o{ BudgetLifecycleLog : "audit trail"

    BudgetVersion ||--o{ BudgetSection : ""
    BudgetVersion ||--o{ BudgetGlobal : "formula variables"
    BudgetVersion ||--o{ FringeProfile : "simple % fringes"
    BudgetVersion ||--o| BudgetVersion : "parentVersion (branch)"
    BudgetSection ||--o{ BudgetAccount : "cost centers"
    BudgetAccount ||--o{ BudgetLineItem : ""

    ProductionStrip ||--o{ BreakdownElement : ""
    ProductionVendor ||--o{ PurchaseOrder : ""
    ProductionCrew ||--o{ PerDiem : ""
```

**Soft links (joined by string code, not FK):** `ProjectTransaction.accountCode`, `Overage.accountCode`, `BudgetTransfer.fromCode/toCode` all reference `BudgetAccount.code` — so actuals reconcile at **cost-center grain** across budget versions. `BudgetLineItem.crewMemberId` links a line to a crew member (name badge + rate pull); `classificationCode` links it to frozen fringe rules.

---

## 2. Budget layout & value math

**Hierarchy (seeded on every new project from the Master COA — doc 13, expanded doc 15):**
```
BudgetVersion (DRAFT)                       e.g. status DRAFT, versionSequence 0
 └─ BudgetSection  1000 ATL │ 2000 BTL │ 3000 POST │ 4000 OTHER   (tier explicit)
     │             [+ optional 6000 P&A │ 7000 Revenue │ 8000 COGS │ 9000 Corporate]
     └─ BudgetAccount  1300 Producers, 2200 Camera …               (cost centers, ~35 seeded)
         └─ BudgetLineItem  1303 Line Producer …                   (~165 seeded at qty1×rate0)
```

**Per-line value math (computed on every save, stored on the line):**
```
quantity   = quantityFormula evaluated against BudgetGlobals (e.g. shoot_days + prep_days)  else manual qty
subtotal   = Σ stages[].qty × stages[].rate         (when the prep/shoot/wrap stage block is used)
           = quantity × rate ÷ exchangeRate         (otherwise)
fringeAmount = subtotal × fringePct/100             (simple profile)  OR  Σ union-rule burdens (see §3)
total      = subtotal + fringeAmount
```
Line extras: `code/subTitle` (sub-account grouping, e.g. `1301`), `origin` provenance (MANUAL / AI_GENERATED / SCRIPT_IMPORT / AUTO_BREAKDOWN / MANUAL_OVERRIDE / MOVIE_MAGIC_IMPORT) with `aiSuggestedRate/Quantity` preserved on override, `classificationCode` (per-section dropdown), `crewMemberId` (crew link + rate pull).

---

## 2b. Master Chart of Accounts structure

Defined once at module level in `projects.service.ts` (`MASTER_COA` + `DISTRIBUTION_COA`), inserted through the shared `seedSections()` helper. Tier is **explicit per section** — never derived from the code prefix.

```mermaid
flowchart TD
    COA[Master COA] --> ATL["1000 ABOVE THE LINE · tier ATL"]
    COA --> BTL["2000 PRODUCTION · tier BTL"]
    COA --> POST["3000 POST PRODUCTION · tier POST"]
    COA --> OTH["4000 OTHER · tier OTHER"]
    COA -.->|"optional (checkbox / inject)"| DIST[Distribution & Corporate block]

    ATL --> A1["1100 Story & Rights · 1200 Writing ·<br/>1300 Producers · 1400 Director ·<br/>1500 Cast · 1600 Casting · 1700 Stunts"]
    BTL --> B1["2100 Staff · 2150 Extra Talent · 2200 Camera ·<br/>2300 Grip · 2400 Electric · 2500 Sound ·<br/>2600 Art · 2650 Construction · 2700 Set Dressing ·<br/>2750 Props · 2800 Wardrobe · 2900 Makeup & Hair ·<br/>2920 SFX · 2940 Locations · 2960 Transport ·<br/>2980 Catering · 2990 Safety"]
    POST --> P1["3100 Editorial · 3200 Post Sound · 3300 Music ·<br/>3400 VFX · 3500 Color & Finishing · 3600 Titles & Deliverables"]
    OTH --> O1["4100 Insurance · 4200 Legal & Accounting ·<br/>4300 Publicity · 4400 Office & Admin · 4500 Contingency"]
    DIST --> D1["6000 Prints & Advertising: 6100 Creative ·<br/>6200 Media Buy · 6300 Publicity & PR · 6400 Print & Logistics"]
    DIST --> D2["7000 Revenue: 7100 Sales & Licensing"]
    DIST --> D3["8000 COGS: 8100 Amortization · Residuals ·<br/>Participations · Sales-agent fees"]
    DIST --> D4["9000 Corporate Overhead: 9100 Corporate SG&A"]
```

| | Sections | Accounts | Seeded lines | Notes |
|---|---|---|---|---|
| **MASTER_COA** (always) | 4 | ~35 | ~165 | every line `qty 1 × rate 0, units "allow"`; labor lines carry `classificationCode` (WRITER · PRODUCER · DIRECTOR · PERFORMER · STUNT · BG · DRIVER · CREW) so the fringe engine fires the moment a rate is typed |
| **DISTRIBUTION_COA** (optional) | 4 | 7 | ~27 | tier `OTHER`, sortOrder 6–9; added at creation (checkbox) **or** later via `POST /projects/:id/inject-distribution` — guards: active version exists · not LOCKED · no duplicate 6000+ codes · totals re-rolled |

Actuals for the 6000+ block post with the new `ProjectTxnKind` values **`SALES_REVENUE`** (folded as income) and **`CORPORATE_OVERHEAD`** (folded as cost) and reconcile by `accountCode` like everything else. Full line-by-line tables: doc 13 (production COA) and doc 15 (distribution block).

---

## 3. Fringe infusion — from master library to the working budget

```mermaid
flowchart TD
    A[Master library<br/>GeoNode → LaborBody → Agreement<br/>→ Classification → RateRule] -->|"refresh engine / AI research<br/>(allow-listed sources)"| P[RateChangeProposal<br/>PENDING]
    P -->|approve: SysAdmin / Finance Mgr / LP| A
    A -->|"snapshot(asOfDate)"| S[ProjectRateRule<br/>FROZEN per project]
    L[BudgetLineItem<br/>classificationCode] --> C{applyFringesToVersion}
    S --> C
    C -->|computeLineFringes per rule:<br/>PERCENT · FLAT/DAY · FLAT/WEEK ·<br/>PERCENT_WITH_CAP · TIERED| F[line.fringeDetail JSON<br/>+ line.fringeAmount]
    F --> T[line.total → account → section → topsheet]
    T --> CR[Cost Report: burden lines in EFC]
    CR --> GL[GL journals auto-posted]
```

Key behaviours:
- The snapshot is **immutable**: master rate updates never change a project until *Apply updates* is explicitly chosen. Historical/locked budgets are forever reproducible.
- **Fringes are per-version**: running *apply fringes* recomputes `fringeAmount/fringeDetail` on the lines of **that version only**. A LOCKED baseline's lines are guarded read-only, so its fringes are frozen with it; the WORKING copy carries its own lines and absorbs all recalculation. The dual topsheet (§7) then shows the drift between the two.
- Payroll reuses the same pure engine: timecards compute gross + the same classification burdens before posting.
- **Movie Magic legacy fringes:** an MMB import creates one `FringeProfile` per distinct percentage found in the file ("MMB Legacy Fringe 18.5%") and links the lines to it — imported totals match the file to the penny and survive later edits, until you replace them with statutory rules from the snapshot.

---

## 4. Budget ⇄ Accounting workflow (estimate vs actual)

```mermaid
flowchart LR
    subgraph ESTIMATE["ESTIMATE (BudgetVersion tree)"]
      B[Budget = Σ line.total]
      TR[+ APPROVED BudgetTransfers ±]
      OV[+ APPROVED Overages]
      B --> RV[Revised Budget]
      TR --> RV
      OV --> RV
    end
    subgraph ACTUALS["ACTUALS (ProjectTransaction ledger)"]
      PO[PO invoiced] --> TXN[COST txns]
      PC[Petty cash SPEND] --> TXN
      PR[Payroll posted] --> TXN
      LF[Location fees] --> TXN
      MN[Manual entries] --> TXN
    end
    OPO[Open POs] --> COM[Committed]
    TXN -->|"APPROVED + PAID"| ACT[Actual]
    RV --> VAR
    ACT --> EFC[EFC = Actual + ETC]
    COM --> EFC
    EFC --> VAR[Variance = Revised − EFC]
    PER[AccountingPeriod CLOSED] -.->|assertOpen blocks posting| TXN
```

- Reconciliation is **by `accountCode`** on every COST transaction.
- The same numbers feed all six surfaces (Budget vs Actual, Cost Report, Purchasing, Accounting, Cash, Overages) plus the shared FinanceSummaryStrip — one ledger, one revised-budget picture.
- Money moves only through gates: transfers and overages are PENDING until approved; OCR-drafted invoices are `DRAFT` until a human approves; closed periods reject any posting (ledger, PO invoice, petty spend, payroll, payment run).

---

## 5. Rebate / incentive structure

```mermaid
flowchart TD
    IP[IncentiveProgram master<br/>geo · type · ratePct · basis · cap · uplift] -->|select onto project| PI[ProjectIncentive<br/>FROZEN parameter snapshot]
    PI --> EST["Estimated benefit = ratePct × basis<br/>(TOTAL / BTL / LABOR / QUALIFIED)<br/>respecting minSpend, cap, uplift"]
    subgraph AD["Abu Dhabi Rebate (IncentiveClaim)"]
      STD[Standard 35%] --> TOT[totalPct]
      PTS["Criteria points → enhanced band<br/>10-14→+2.5% · 15-39→+5% ·<br/>40-69→+7.5% · 70-84→+10% · 85+→+15%"] --> TOT
      TOT --> REB["estimatedRebate = totalPct × ADQPE (capped)"]
      REB --> STG[Certificate/audit stages tracker]
    end
    AI[aiUpdateAll] -->|proposals only, never live| IP
```

---

## 6. New-project creation & how the budget gets filled

```mermaid
flowchart TD
    N[New Project form<br/>title · client · type · CURRENCY fixed at creation<br/>☑ optional distribution ledger 6000–9000] --> CR[ProjectsService.create]
    CR --> SEED["Auto-seed: BudgetVersion DRAFT + Master COA<br/>(4 sections · ~35 accounts · ~165 zero-value lines<br/>+ globals + fringe profiles<br/>+ DISTRIBUTION_COA if ticked)"]
    CR --> OPT{Optional attachments on create}
    OPT -->|Script .fdx/.pdf/.docx| AI["AI breakdown → scenes+elements<br/>→ auto-schedule → budget lines<br/>(or visual drag-drop mapping first)"]
    OPT -->|Movie Magic .xml/.csv/.sex| MM["Deterministic import →<br/>'Movie Magic Import' WORKING version<br/>+ legacy fringe profiles + stages from sub-details<br/>+ strips/elements (no AI)"]
    SEED --> FILL{Filling the budget}
    FILL -->|Manual| M["Type lines · formulas from globals ·<br/>stage blocks · classification dropdown ·<br/>crew dropdown pulls day rate"]
    FILL -->|Automatic| A["Breakdown push-to-budget ·<br/>visual mapping (origin tagged) ·<br/>MM import (origin MOVIE_MAGIC_IMPORT)"]
    FILL --> FR["Apply fringes (labor snapshot)<br/>→ fringeAmount per line"]
```

Every automatic path **tags provenance** (`origin`) and archives the suggested numbers; a human edit flips the line to `MANUAL_OVERRIDE` without losing the original.

**Re-importing Movie Magic later (Settings tab)** offers two merge strategies: *New version* (replace the active budget with a fresh import) or *Update active* (departmental upsert — sections/accounts matched by code, line items replaced only inside accounts present in the file; refuses LOCKED). The distribution ledger can likewise be added post-creation from Settings.

---

## 7. Lifecycle: draft → locked baseline → working copy → dual topsheet

```mermaid
stateDiagram-v2
    [*] --> DRAFT : project created (COA seeded)
    DRAFT --> REVIEW : submit → auto-numbered Budget V1, V2…
    REVIEW --> APPROVED : Producer/Client validates
    REVIEW --> DRAFT : send back
    APPROVED --> LOCKED : freeze baseline (read-only enforced)
    APPROVED --> REVIEW : reopen
    LOCKED --> WORKING : Create Working Copy (clone, parentVersionId)
    WORKING --> REVIEW : resubmit as next V
```

- Transitions are **role-gated** (project crew EP / Producer / Line Producer, or SysAdmin/Finance) and every change writes a `BudgetLifecycleLog` (who, role, when, why).
- **Fringes & the draft/working budget:** edits and fringe recalculation only ever touch the editable version. The LOCKED baseline keeps the exact totals (including fringes) it had at freeze.
- **Seeing the locked budget in the Top Sheet:** the Top Sheet tab is the **comparison workspace** — pick `Baseline: Budget V1 (Locked)` and `Working: Working Copy`, and the grid shows per-section `Locked Baseline | Current Working | Variance` (variance = baseline − working; red = working is over), with grand totals and the change-history timeline underneath.

```
Code  Department          Locked Baseline   Current Working   Variance
1000  Above The Line        450,000.00        485,000.00      -35,000
2000  Production (BTL)    1,200,000.00      1,150,000.00      +50,000
GRAND TOTALS             1,950,000.00      1,950,000.00            0
```

---

## 8. File map — where everything lives

**Backend (`backend/src/`)**
| Area | Files |
|---|---|
| Projects, COA seed, workflow, currency convert, role dashboards | `production/projects/projects.service.ts` + controller |
| Budget tree, lifecycle state machine, dual topsheet, lock/clone, provenance | `production/budget/budget.service.ts` + controller |
| Cost report/EFC, transfers, POs+OCR invoice intake, vendors+supplier link, petty cash, cashflow, finance summary | `production/costing/costing.service.ts` + controller |
| Actuals ledger, AP aging, payment run, period close, GL | `production/ledger/ledger.service.ts` + controller |
| Stripboard/DOOD/auto-schedule | `production/scheduling/` |
| Breakdown, script AI import, visual mapping apply | `production/breakdown/breakdown.service.ts`, `script-import.service.ts` |
| Payroll timecards → burdened costs | `production/payroll/` |
| Locations + fee posting | `production/locations/` |
| Vendor self-onboarding (JWT link, staging, approve) | `production/vendor-onboarding/` |
| Movie Magic import/export | `production/movie-magic/` |
| Union/fringe engine, snapshots, proposals, incentives, AD claim | `labor/labor.service.ts`, `labor/fringe-engine.ts` |
| Data model (all of it) | `prisma/schema.prisma` |

**Frontend (`frontend/src/`)**
| Area | Files |
|---|---|
| Project workspace (all tabs, budget grid, classification+crew dropdowns) | `app/(dashboard)/production/projects/[id]/page.tsx` |
| Topsheet comparison, cost report, finance strip, purchasing, accounting, cash, overages, mapping modal… | `components/production/*.tsx` |
| Offline PWA queue | `lib/offline-db.ts`, `lib/useOfflineSync.ts`, `public/sw.js` |
| API surface | `lib/api.ts` |
| Public vendor onboarding | `app/vendor-onboarding/[token]/page.tsx` |
| Branded PDFs | `app/print/{budget,topsheet,fringe,costreport,callsheet,schedule,breakdown,dealmemo,credits}/` |

**Documentation (`docs/production/`)** — `README` (index & concepts) · `01` data model · `02` projects · `03` budget · `04` finance/accounting · `05` crew/people · `06` union/fringes · `07` rebates · `08` AI · `09` API reference · `10` Movie Magic · `12` lifecycle & topsheet · `13` COA & crew link · `14` this file · `15` distribution ledger & MM import refactor.
