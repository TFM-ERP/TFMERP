# 01 — Production Data Model

Complete inventory of every Prisma model and enum in the production domain. Types shown as `name: Type modifiers`. `→` denotes a relation/foreign key. All money is `Decimal` with the noted precision; all primary keys are `cuid()`.

**38 models · 27 enums**, grouped into seven domains: Project core, Budget, Finance/Accounting, Crew & People, Scheduling/Breakdown, Union/Labor/Fringe, Incentives/Rebates.

---

## Domain 1 — Project core

### enum ProductionStatus
`DEVELOPMENT · PRE_PRODUCTION · PRODUCTION · POST_PRODUCTION · DELIVERED · CANCELLED · ARCHIVED`

### enum BudgetVersionStatus
`DRAFT · REVIEW · APPROVED · LOCKED · WORKING`
(Lifecycle state machine: DRAFT → REVIEW (V1…Vn) → APPROVED → LOCKED → WORKING-copy branch. `BudgetVersion` also carries `versionSequence`, `parentVersionId` branching, and a `BudgetLifecycleLog` audit table — see `12-budget-lifecycle-and-topsheet-comparison.md`.)

### enum ProductionCrewRole
`EXECUTIVE_PRODUCER · PRODUCER · LINE_PRODUCER · DIRECTOR · ASSISTANT_DIRECTOR · DOP · CAMERA_OPERATOR · GAFFER · GRIP · SOUND · ART_DIRECTOR · STYLIST · MAKEUP · WARDROBE · EDITOR · COLORIST · VFX_ARTIST · MUSIC_COMPOSER · PRODUCTION_COORDINATOR · PRODUCTION_ASSISTANT · DRIVER · OTHER`

### model ProductionProject  (`production_projects`)
The aggregate root. Owns budgets, crew, schedule, finance, locations, labor config, incentives.

| Field | Type | Notes |
|---|---|---|
| id | String @id | cuid |
| projectNumber | String @unique | human reference |
| title | String | |
| clientId / client | String? → Client | optional client link |
| projectType | String @default("TVC") | TVC \| CORPORATE \| DOCUMENTARY \| FEATURE \| SHORT \| MUSIC_VIDEO \| OTHER |
| status | ProductionStatus @default(DEVELOPMENT) | |
| startDate / endDate | DateTime? | project window |
| shootStartDate / shootEndDate | DateTime? | principal photography window |
| currency | Currency @default(AED) | project base currency |
| totalBudget | Decimal(15,2)? | denormalised from active version |
| emailSettings | Json? | per-project SMTP `{enabled, smtp{...}}` |
| logoUrl | String? | project/studio logo (shown on reports next to TFM logo) |
| description / notes | String? | |
| perDiemInternational | Decimal(12,2)? | default intl per-diem rate |
| perDiemDomestic | Decimal(12,2)? | default cross-emirate per-diem rate |
| createdAt / updatedAt | DateTime | |

**Relations (one-to-many unless noted):** budgetVersions, crew, schedules, callSheets, perDiems, overages, creditRoll (1:1), transactions, vendors, purchaseOrders, costSnapshots, pettyCashFloats, strips, breakdownElements, documents, laborConfig (1:1), projectRateRules, incentives, incentiveClaims, timecards, locations, budgetTransfers.

---

## Domain 2 — Budget

### model BudgetVersion  (`budget_versions`)
A named, versionable budget. Only one is `isActive` per project.

| Field | Type | Notes |
|---|---|---|
| id | String @id | |
| projectId / project | → ProductionProject (cascade) | |
| versionName | String | "Budget v1", "Approved Budget" |
| status | BudgetVersionStatus @default(WORKING) | LOCKED ⇒ read-only |
| isActive | Boolean @default(false) | the live version |
| notes | String? | |
| lockedAt | DateTime? | set when locked |
| createdAt / updatedAt | DateTime | |

**Relations:** globals, sections, fringes.

### model BudgetGlobal  (`budget_globals`)
Named numeric variables referenced by line-item formulas.
`id · budgetVersionId → · key (e.g. "shoot_days") · label · value Decimal(10,3) · unit?` — `@@unique([budgetVersionId, key])`.

### model FringeProfile  (`fringe_profiles`)
Simple named fringe % (separate from the union/statutory engine).
`id · budgetVersionId → · name · percentage Decimal(5,2) · description?`.

### model BudgetSection  (`budget_sections`)
Top-level budget grouping (department band).
`id · budgetVersionId → · code (e.g. "1000") · title · tier String? (ATL|BTL|POST|OTHER) · sortOrder · color?` → accounts.

### model BudgetAccount  (`budget_accounts`)
Cost center inside a section.
`id · sectionId → · code (e.g. "2100") · title · sortOrder · etcAmount Decimal(15,2)? (manual Estimate-to-Complete override)` → lineItems.

### enum LineItemOrigin
`MANUAL · AI_GENERATED · SCRIPT_IMPORT · AUTO_BREAKDOWN · MANUAL_OVERRIDE · MOVIE_MAGIC_IMPORT`
(`MOVIE_MAGIC_IMPORT` tags budget lines parsed from a Movie Magic Budgeting `.xml`/`.csv` file — see `10-movie-magic-sync.md`.)

### model BudgetLineItem  (`budget_line_items`)
The atomic budget row. Holds **inputs**, **provenance**, and **computed outputs** in one record (updated in place).

| Field | Type | Notes |
|---|---|---|
| id / accountId / sortOrder | | → BudgetAccount (cascade) |
| code / subTitle | String? | sub-account grouping (e.g. "1210", "LINE PRODUCER") |
| description | String | |
| quantityFormula | String? | references globals, e.g. `shoot_days + prep_days` |
| quantity | Decimal(10,3) @default(1) | resolved value |
| units | String? | days/weeks/hours/units/lump |
| rate | Decimal(15,2) @default(0) | |
| currency | Currency @default(AED) | |
| exchangeRate | Decimal(10,4) @default(1) | multi-currency |
| fringeProfileId | String? | simple fringe profile link |
| fringePct | Decimal(5,2) @default(0) | |
| classificationCode | String? | drives union/statutory rates (PERFORMER, IATSE-LOCAL-600…) |
| fringeDetail | Json? | computed per-rule burden `[{rateRuleId, rateType, label, amount}]` |
| crewMemberId | String? | Crew Directory link for rate-card auto-fill |
| stages | Json? | per-stage labour `[{stage:PREP\|SHOOT\|WRAP\|POST, qty, unit, rate, amount}]` |
| **origin** | LineItemOrigin @default(MANUAL) | provenance |
| **aiSuggestedRate** | Decimal(15,2)? | preserved on human override |
| **aiSuggestedQuantity** | Decimal(10,3)? | preserved on human override |
| subtotal | Decimal(15,2) | `qty × rate ÷ exchangeRate` (or Σ stages) |
| fringeAmount | Decimal(15,2) | `subtotal × fringePct/100` |
| total | Decimal(15,2) | `subtotal + fringeAmount` |
| notes | String? | |

### enum TransferStatus
`PENDING · APPROVED · REJECTED`

### model BudgetTransfer  (`budget_transfers`)
Line-to-line budget reallocation; net effect on the grand total is zero. Only APPROVED transfers reshape the budget.
`id · projectId → · fromCode/fromTitle · toCode/toTitle · amount Decimal(15,2) · reason? · date · status TransferStatus @default(PENDING) · createdById? · approvedById? · approvedAt?`. Index: projectId.

---

## Domain 3 — Finance / Accounting

### enum ProjectTxnKind
`INCOME · COST`

### enum ProjectTxnStatus
`DRAFT · APPROVED · INVOICED · PAID · RECEIVED · VOID`

### model ProjectTransaction  (`project_transactions`)
The single **actuals ledger** for the project. Every actual (PO invoice, petty-cash spend, payroll, location fee, manual entry) becomes one row.

| Field | Type | Notes |
|---|---|---|
| id / projectId | → ProductionProject (cascade) | |
| kind | ProjectTxnKind | COST or INCOME |
| date | DateTime | drives period & cashflow bucketing |
| accountCode / accountTitle | String? | budget cost-center link (for Budget vs Actual) |
| category | String? | |
| description | String | |
| party | String? | client (income) or vendor (cost) |
| reference | String? | e.g. PO number |
| amount / taxAmount / total | Decimal(15,2) | |
| currency | Currency @default(AED) | |
| status | ProjectTxnStatus @default(DRAFT) | APPROVED/PAID counted as actual |
| invoiceNumber / vendorId / dueDate / paidDate / paidAmount | | Accounts-Payable fields |
| createdById / createdAt / updatedAt | | |

Indexes: projectId, accountCode.

### model AccountingPeriod  (`accounting_periods`)
Month-grain close lock.
`id · projectId · period "YYYY-MM" · status "OPEN"|"CLOSED" · closedAt? · closedBy?` — `@@unique([projectId, period])`.

### enum PurchaseOrderStatus
`DRAFT · APPROVED · PARTIALLY_INVOICED · CLOSED · CANCELLED`

### model PurchaseOrder  (`purchase_orders`)
Commitment document; "committed" in the cost report = open PO remaining.
`id · projectId → · poNumber @unique · vendorId? → ProductionVendor · vendorName? · costCenterCode/Title? · description · date · expectedDate? · amount/taxAmount/total · invoicedAmount · currency · status @default(DRAFT) · notes? · createdById?`.

### model ProductionVendor  (`production_vendors`)
Per-project vendor, optionally linked to the company **Supplier** master (`supplierId`) — the single source of truth; the row snapshots name/category/contact/TRN.
`id · projectId → · supplierId? · name · category? · contactName? · phone? · email? · trn? · notes?` → purchaseOrders.

### enum PettyCashTxnType
`TOPUP · SPEND`

### model PettyCashFloat  (`petty_cash_floats`)
`id · projectId → · holder · openingAmount · currency · status "OPEN"|"CLOSED" · notes?` → transactions.

### model PettyCashTxn  (`petty_cash_txns`)
A SPEND also posts a linked `ProjectTransaction` (COST, PAID) via `ledgerTxnId`.
`id · floatId → · type PettyCashTxnType · date · description · costCenterCode/Title? · amount · ledgerTxnId? · createdById?`.

### model CostReportSnapshot  (`cost_report_snapshots`)
Frozen point-in-time copy of the full cost report.
`id · projectId → · asOf · label? · data Json · budget · committed · actual · efc · variance` (all Decimal(15,2)).

### enum OverageStatus
`PENDING · APPROVED · REJECTED`

### model Overage  (`overages`)
A cost overrun raised against an account; APPROVED overages lift that account's revised budget.
`id · projectId → · accountCode/Title? · description · amount · reason? · status @default(PENDING) · requestedById? · approvedById? · approvedAt? · notes?`.

### model Timecard  (`timecards`)
Cast/crew timecard → burdened, coded production cost.
`id · projectId → · name · role? · classificationCode? (drives fringes) · accountCode/Title? · weekEnding? · days Decimal(8,2) · dailyRate · otHours/otRate · boxRental · kitRental · perDiemDays/perDiemRate · currency · gross · fringe · total · status "DRAFT"|"APPROVED"|"POSTED" · postedTxnId? · notes?`.

---

## Domain 4 — Crew & People

### model ProductionCrew  (`production_crew`)
A per-project crew booking, optionally linked to the global Crew Directory (`crewMemberId → CrewMember`).
`id · projectId → · name · role ProductionCrewRole @default(OTHER) · department? · roleTitle? · isInternal · productionVehicle (driver licence fields: driverLicenseNumber/Expiry/DocUrl) · userId? · email? · mobile? · crewMemberId? → CrewMember · startDate/endDate? · location? · dailyRate? · weeklyRate? · totalDays? · totalPaid? · notes? · dealMemoStatus "NOT_SENT"|"SENT"|"SIGNED" · ndaStatus "NOT_REQUIRED"|"SENT"|"SIGNED" · dealMemoUrl? · contractUrl?` → perDiems.

### enum PerDiemStatus
`PENDING · APPROVED · PAID`

### model PerDiem  (`per_diems`)
`id · projectId → · assignmentId? → ProductionCrew · crewName · location? · ratePerDay · days · currency · startDate/endDate? · total · status @default(PENDING) · notes? · createdById?`.

### enum LocationType
`INT · EXT · STUDIO · BACKLOT · OTHER`

### enum LocationStatus
`SCOUTING · OPTION · CONFIRMED · RELEASED`

### model Location  (`locations`)
Location binder: pin, contacts, LM/assistant, permit, hospital, fee.
`id · projectId → · name · type LocationType @default(EXT) · status LocationStatus @default(SCOUTING) · country? @default("United Arab Emirates") · emirate? · area? · fullAddress? · lat/lng Decimal? · googleMapsUrl? · what3words? · locationManagerId? · locationAssistantId? · owner contact (name/phone/email)? · parkingNotes/basecampNotes/accessNotes? · facilities Json? {power,water,toilets,wifi} · restrictions? · nearestHospital (name/address/phone)? · locationFeePerDay Decimal(14,2)? · currency · permitRequired · permitStatus? · permitNumber? · permitExpiry? · permitDocUrl? · photoUrls Json? · documentUrls Json? · notes?`.

---

## Domain 5 — Scheduling / Breakdown

### enum StripIntExt
`INT · EXT · INT_EXT`

### enum StripDayNight
`DAY · NIGHT · DUSK · DAWN`

### model ProductionStrip  (`production_strips`)
A stripboard strip = a scene.
`id · projectId → · sceneNumber? · intExt @default(INT) · dayNight @default(DAY) · setName? · location? · locationId? (→ Location) · description? · pages Decimal(6,3) (e.g. 1.125 = 1⅛) · cast Json? · estMinutes? · shootDay Int @default(0) (0 = unscheduled) · sortOrder · notes?` → elements.

### enum BreakdownCategory
`CAST · BACKGROUND · STUNTS · VEHICLES · ANIMALS · PROPS · SET_DRESSING · WARDROBE · MAKEUP_HAIR · SFX · VFX · SPECIAL_EQUIPMENT · SOUND_MUSIC · ART · GREENERY · SECURITY · OTHER`

### model BreakdownElement  (`breakdown_elements`)
A tagged element on a scene, with an estimated cost that can be pushed to the budget.
`id · projectId → · stripId → ProductionStrip · category BreakdownCategory · name · quantity · costCenterCode/Title? · estCost Decimal(15,2) · notes?`.

### enum CallSheetStatus
`DRAFT · PUBLISHED`

### model CallSheet  (`call_sheets`)
`id · projectId → · dayNumber · totalDays? · shootDate · status @default(DRAFT) · generalCall/shootingCall/estWrap? · weather/tempHigh/tempLow/sunrise/sunset? · locationId? (→ Location) · locationName/Address/MapUrl? · parkingNotes/basecampNotes? · hospital (name/address/phone)? · keyContacts Json · scheduleItems Json · castCalls Json · backgroundCalls Json · crewCalls Json · advanceSchedule Json (next day) · notes? · safetyNotes? · createdById?`.

### model CreditRoll  (`credit_rolls`)
`id · projectId @unique → · title? · blocks Json [{heading, lines:[{role,name}]}]`.

### model ProductionSchedule  (`production_schedules`)
Simple per-day schedule (distinct from the stripboard).
`id · projectId → · dayNumber · date · location? · callTime? · wrapTime? · scenes? · notes?`.

### model ProjectDocument  (`project_documents`)
Document vault entry (upload or cloud link).
`id · projectId → · name · kind "FILE"|"LINK" · provider "UPLOAD"|"GDRIVE"|"DROPBOX"|"LINK" · url · category? · mimeType? · sizeBytes? · entityType?/entityId? (link to a PO/petty/deal-memo/crew) · uploadedById?`.

---

## Domain 6 — Union / Labor / Fringe

### enum GeoLevel
`COUNTRY · STATE · REGION · DISTRICT · CITY · ZONE`

### model GeoNode  (`geo_nodes`)
Self-referential geography tree.
`id · level GeoLevel · name · code? (ISO) · parentId? → GeoNode (self) · children GeoNode[]` → laborBodies, laborConfigs, incentivePrograms.

### enum LaborBodyKind
`UNION · GUILD · STATUTORY · PAYROLL_PROVIDER`

### model LaborBody  (`labor_bodies`)
`id · kind LaborBodyKind · name (SAG-AFTRA, IATSE, UAE MOHRE) · shortName? · countryId? → GeoNode · website? · notes? · isActive` → agreements, sources.

### enum AgreementStatus
`DRAFT · ACTIVE · SUPERSEDED · EXPIRED`

### model Agreement  (`agreements`)
A collective agreement / scale book.
`id · laborBodyId → · name · productionTypes Json · tier? · effectiveDate · expirationDate? · status @default(ACTIVE) · sourceId? → RateSource · notes?` → classifications, rateRules.

### model Classification  (`classifications`)
A job classification inside an agreement.
`id · agreementId → · code (PERFORMER, BG, STUNT, IATSE-LOCAL-600) · title · riskClass? (workers' comp class)` → rateRules.

### enum RateType
`PENSION · HEALTH · PENSION_HEALTH · PAYROLL_TAX · WORKERS_COMP · UNEMPLOYMENT · VACATION_PAY · HOLIDAY_PAY · EMPLOYER_TAX · UNION_DUES · GUILD_CONTRIB · STATUTORY_GRATUITY · HANDLING_FEE · OTHER`

### enum CalcMethod
`PERCENT · FLAT_PER_DAY · FLAT_PER_WEEK · FLAT_PER_HOUR · PERCENT_WITH_CAP · TIERED`

### enum RateBase
`GROSS · STRAIGHT_TIME · TAXABLE · WORKED_DAYS`

### enum CapPeriod
`WEEKLY · MONTHLY · ANNUAL · PER_PRODUCTION`

### model RateRule  (`rate_rules`)
A single typed fringe/burden primitive. Versioned via `previousId` chain.
`id · agreementId → · classificationId? → Classification · label · rateType RateType · calcMethod CalcMethod · value Decimal(12,5) (0.205 = 20.5%, or 38.50 $/day) · base RateBase? · capPeriod CapPeriod? · capAmount/floorAmount Decimal(14,2)? · tiers Json? [{upTo,value}] · currency @default("USD") · glAccountCode? · sourceId? → RateSource · effectiveDate · expirationDate? · approvedById?/approvedAt? · previousId? · isEstimate Boolean · notes?`.

### model RateSource  (`rate_sources`)
Provenance + change-detection for the refresh engine.
`id · laborBodyId? → · title · url? · publisher? · trusted Boolean (allow-list) · retrievedAt? · lastHash? (SHA-256) · lastStatus? (OK|BLOCKED|ERROR|NOT_ALLOWLISTED) · lastCheckedAt?` → agreements, rateRules.

### enum ProposalStatus
`PENDING · APPROVED · REJECTED`

### model RateChangeProposal  (`rate_change_proposals`)
Approval queue for any rate change (manual, refresh, or AI).
`id · origin "MANUAL"|"REFRESH"|"AI" · payload Json (proposed RateRule) · diff Json? · sourceId? · confidence Decimal(5,2)? · status @default(PENDING) · reviewedById?/reviewedAt? · reviewNotes?`.

### enum UnionStatus
`UNION · NON_UNION · MIXED`

### model ProjectLaborConfig  (`project_labor_configs`)
Per-project labor snapshot config (1:1).
`id · projectId @unique → · geoNodeId? → GeoNode · productionType · unionStatus @default(NON_UNION) · laborBodyIds Json · asOfDate · snapshotAt? · notes?`.

### model ProjectRateRule  (`project_rate_rules`)
**Frozen copy** of a master RateRule, attached to the project at snapshot time.
`id · projectId → · sourceRuleId? (pointer for "update available" detection) · laborBodyName · agreementName · classificationCode? · label · rateType · calcMethod · value Decimal(12,5) · base? · capPeriod? · capAmount/floorAmount? · tiers? · currency · glAccountCode? · isEstimate · overrideReason? · enabled · sourceTitle?/sourceUrl? · effectiveDate? · frozenAt`.

---

## Domain 7 — Incentives / Rebates

### enum IncentiveType
`TAX_CREDIT · REBATE · CASH_REBATE · GRANT · EXEMPTION`

### model IncentiveProgram  (`incentive_programs`)
Master catalogue of incentive programs by geography.
`id · geoNodeId? → · name · authority? · incentiveType @default(TAX_CREDIT) · ratePct Decimal(6,4) (fraction) · basis "TOTAL"|"BTL"|"LABOR"|"WAGES"|"QUALIFIED" · minSpend? · capAmount? · upliftPct? · transferable · refundable · currency · productionTypes Json? · sourceTitle?/sourceUrl? · effectiveDate?/expirationDate? · isEstimate · isActive · notes?`.

### model ProjectIncentive  (`project_incentives`)
Frozen snapshot of a program selected onto a project.
`id · projectId → · programId? · name · incentiveType · ratePct · basis · capAmount? · minSpend? · upliftPct? · currency · qualifiedSpendOverride? · sourceTitle?/sourceUrl? · notes?`.

### model IncentiveClaim  (`incentive_claims`)
The Abu Dhabi rebate claim tracker (points-based enhanced %, ADQPE, stages).
`id · projectId → · programName @default("Abu Dhabi Film Rebate") · currency @default("AED") · standardPct Decimal(6,4) @default(0.35) · criteria Json [{key,label,points,selected}] · totalPoints · enhancedPct · totalPct @default(0.35) · adqpe Decimal(15,2)? (Abu Dhabi Qualifying Production Expenditure) · capAmount? · estimatedRebate? · stages Json [{key,label,status,date,note}] · notes?`.

---

## Relationship summary (textual ERD)

```
ProductionProject 1─┬─* BudgetVersion 1─┬─* BudgetSection 1─* BudgetAccount 1─* BudgetLineItem
                    │                   ├─* BudgetGlobal
                    │                   └─* FringeProfile
                    ├─* BudgetTransfer            (fromCode/toCode ⇒ BudgetAccount.code, soft link)
                    ├─* ProjectTransaction        (accountCode ⇒ BudgetAccount.code, soft link)  ← actuals
                    ├─* AccountingPeriod
                    ├─* PurchaseOrder *─1 ProductionVendor (─? Supplier master)
                    ├─* PettyCashFloat 1─* PettyCashTxn (─? ProjectTransaction)
                    ├─* CostReportSnapshot
                    ├─* Overage                   (accountCode ⇒ BudgetAccount.code, soft link)
                    ├─* Timecard                  (─? ProjectTransaction when posted)
                    ├─* ProductionCrew (─? CrewMember) 1─* PerDiem
                    ├─* Location
                    ├─* ProductionStrip 1─* BreakdownElement
                    ├─* ProductionSchedule
                    ├─* CallSheet (─? Location)
                    ├─1 CreditRoll
                    ├─* ProjectDocument
                    ├─1 ProjectLaborConfig (─? GeoNode)
                    ├─* ProjectRateRule           (frozen copy of RateRule)
                    ├─* ProjectIncentive          (frozen copy of IncentiveProgram)
                    └─* IncentiveClaim

GeoNode (tree) 1─* LaborBody 1─* Agreement 1─┬─* Classification 1─* RateRule
                                             └─* RateRule (─? RateSource, ─? previous RateRule)
GeoNode 1─* IncentiveProgram
RateChangeProposal  (standalone approval queue; approval writes RateRule + ProjectRateRule)
```

> "Soft link" = joined by a string code (`accountCode` / `fromCode` / `toCode`) rather than a Prisma foreign key. This is intentional — it lets transactions and overages reference a cost center that may exist across budget versions.
