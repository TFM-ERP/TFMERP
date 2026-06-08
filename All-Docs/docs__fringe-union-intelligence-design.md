# Fringe, Union & Production Compliance Intelligence System — Design Proposal

**Status:** Design for review — no code to be written until approved.
**Author hats:** Production Accountant · Entertainment Payroll Specialist · Union Compliance Expert · Production Executive · Software Architect.
**Integrates with:** existing Production Module, Budget engine (BudgetVersion / FringeProfile / BudgetLineItem), Accounting (GL + auto‑post), AuditLog, FxRate, RBAC permissions.

---

## 0. Executive analysis — what makes this hard

Before architecture, the honest problems a "Movie Magic Budgeting + ERP" must solve:

1. **Fringes are not one number.** A fringe is a *rule*, not a percentage: pension might be a % of gross capped at a weekly/annual ceiling; health may be a flat $/worked‑day; vacation/holiday is a % of straight time only; payroll taxes have wage bases that reset annually (e.g. US SUTA/FUTA, FICA caps); workers' comp varies by **risk class code** per craft. A naive "fringePct" cannot represent this. The engine needs a **typed rule per rate** (percent, flat‑per‑day, flat‑per‑week, percent‑with‑cap, tiered).
2. **Applicability is multi‑dimensional.** Whether SAG‑AFTRA pension applies depends on country + production type + union status + the *classification* of the person (performer vs. background vs. stunt) + the agreement tier (e.g. low‑budget vs. theatrical) + effective date. This is a **resolution problem**, not a lookup.
3. **Rates change on schedules and retroactively.** Union agreements have effective and expiration dates; mid‑contract increases are common; some are retroactive. Historical budgets must be frozen; future budgets must pick up new rates. This is a **temporal/versioned data** problem.
4. **Legal exposure.** Publishing wrong union rates, or scraping agreements you're not licensed to redistribute, is a real risk. The system must treat all auto‑sourced data as **proposals requiring human approval**, store provenance, and never present itself as legal/financial advice.
5. **Maintainability without developers.** Admins must add unions, agreements, locations, classifications and rates through the UI. So the model must be **fully data‑driven** — no hard‑coded union logic.
6. **Worldwide but UAE‑first reality.** The UAE generally has **no film unions**; its "burden" is statutory (WPS payroll, end‑of‑service gratuity, visa/permit costs, no income tax). The US/CA/UK are union‑heavy. The same engine must express both — so "union" and "statutory" are just two *sources* of the same rate primitives.

**Key architectural decision:** model everything as **Rate Rules** attached to **Agreements** (union, guild, or statutory) that are **resolved** for a project by a **matcher** over (geography × production type × union status × classification × date), then **snapshotted** immutably into the project's budget. The budget engine already has the snapshot concept (BudgetVersion + FringeProfile) — we extend it.

---

## 1. System architecture proposal

Three layers, clean separation between *master data*, *resolution*, and *project snapshot*.

```
┌─────────────────────────────────────────────────────────────────┐
│ A. GLOBAL MASTER DATA (versioned, effective-dated, admin-owned)   │
│    Geography · Unions/Guilds · Agreements · Classifications ·     │
│    RateRules · Sources · ApprovalRecords                          │
└───────────────▲───────────────────────────────┬──────────────────┘
                │ research/refresh/AI proposals  │ read-only resolve
                │ (approval-gated)               ▼
┌───────────────┴───────────────┐   ┌────────────────────────────────┐
│ B. RESEARCH & UPDATE ENGINE    │   │ C. RESOLUTION ENGINE           │
│  - Manual editor               │   │  matcher(geo, type, union,     │
│  - Refresh button (fetch)      │   │   classification, date)        │
│  - AI proposal worker          │   │   → applicable RateRules       │
│  - Approval queue + audit      │   └──────────────┬─────────────────┘
└────────────────────────────────┘                  ▼
                                   ┌────────────────────────────────┐
                                   │ D. PROJECT SNAPSHOT (immutable) │
                                   │  ProjectFringeProfile +         │
                                   │  ProjectRateRule (frozen copy)  │
                                   │  → drives Budget line fringes,  │
                                   │    Cost Report, GL auto-post     │
                                   └────────────────────────────────┘
```

- **A** is the single source of truth, never mutated in place — every change creates a new version with provenance.
- **C** is a pure function: given project parameters + an "as‑of" date, return the set of rate rules. No side effects, fully testable.
- **D** copies the resolved rules into the project at creation so the project is *frozen*. Re‑resolution is explicit ("update rates from master").
- **B** only ever writes to a **staging/approval queue**; nothing reaches A without an approver.

Built as NestJS modules: `compliance-master` (A), `compliance-research` (B), `fringe-engine` (C), and extensions to the existing `production`/`budget` modules (D). Frontend: a master‑data admin area under Setup, a "Labor & Union Configuration" step in the project wizard, and fringe/burden views inside the budget.

---

## 2. Database schema proposal (Prisma)

Naming kept consistent with the existing schema. All money as `Decimal`, all rules typed.

### Geography (self‑referencing hierarchy)
```
model GeoNode {
  id        String   @id @default(cuid())
  level     GeoLevel // COUNTRY | STATE | REGION | DISTRICT | CITY | ZONE
  name      String
  code      String?  // ISO country, state code…
  parentId  String?
  parent    GeoNode? @relation("GeoTree", fields:[parentId], references:[id])
  children  GeoNode[] @relation("GeoTree")
}
enum GeoLevel { COUNTRY STATE REGION DISTRICT CITY ZONE }
```

### Labor bodies & agreements
```
model LaborBody {            // a union, guild, or statutory authority
  id        String   @id @default(cuid())
  kind      LaborBodyKind    // UNION | GUILD | STATUTORY | PAYROLL_PROVIDER
  name      String           // "SAG-AFTRA", "IATSE", "UAE MOHRE"
  countryId String?          // home geography
  website   String?
  isActive  Boolean @default(true)
}
enum LaborBodyKind { UNION GUILD STATUTORY PAYROLL_PROVIDER }

model Agreement {
  id            String   @id @default(cuid())
  laborBodyId   String
  name          String          // "SAG-AFTRA Theatrical 2023–2026", "Low Budget"
  productionTypes Json          // ["FEATURE","TV_SERIES",...] applicability
  tier          String?         // budget tier / scale
  effectiveDate DateTime
  expirationDate DateTime?
  status        AgreementStatus // DRAFT | ACTIVE | SUPERSEDED | EXPIRED
  sourceId      String?         // provenance
}
enum AgreementStatus { DRAFT ACTIVE SUPERSEDED EXPIRED }

model Classification {        // craft / role bucket within an agreement
  id          String @id @default(cuid())
  agreementId String
  code        String           // "PERFORMER","BG","STUNT","IATSE-LOCAL-600"
  title       String
  riskClass   String?          // workers' comp class code
}
```

### The heart — typed rate rules
```
model RateRule {
  id             String   @id @default(cuid())
  agreementId    String
  classificationId String?       // null = applies to whole agreement
  rateType       RateType
  calcMethod     CalcMethod      // PERCENT | FLAT_PER_DAY | FLAT_PER_WEEK | FLAT_PER_HOUR | PERCENT_WITH_CAP | TIERED
  value          Decimal  @db.Decimal(12,5)   // e.g. 0.205 (=20.5%) or 38.50 ($/day)
  base           RateBase?       // GROSS | STRAIGHT_TIME | TAXABLE | WORKED_DAYS
  capPeriod      CapPeriod?      // WEEKLY | ANNUAL | PER_PRODUCTION
  capAmount      Decimal? @db.Decimal(14,2)   // wage base / ceiling
  floorAmount    Decimal?
  tiers          Json?           // for TIERED: [{upTo, value}]
  currency       String   @default("USD")
  glAccountCode  String?         // maps to Chart of Accounts (e.g. 1900)
  // provenance / audit (also mirrored in compliance audit table)
  sourceId       String?
  effectiveDate  DateTime
  expirationDate DateTime?
  approvedById   String?
  approvedAt     DateTime?
  previousId     String?         // version chain
  notes          String?
  createdAt      DateTime @default(now())
}
enum RateType { PENSION HEALTH PAYROLL_TAX WORKERS_COMP UNEMPLOYMENT VACATION_PAY HOLIDAY_PAY EMPLOYER_TAX UNION_DUES GUILD_CONTRIB STATUTORY_GRATUITY OTHER }
enum CalcMethod { PERCENT FLAT_PER_DAY FLAT_PER_WEEK FLAT_PER_HOUR PERCENT_WITH_CAP TIERED }
enum RateBase { GROSS STRAIGHT_TIME TAXABLE WORKED_DAYS }
enum CapPeriod { WEEKLY MONTHLY ANNUAL PER_PRODUCTION }
```

### Provenance & approval
```
model RateSource {
  id        String @id @default(cuid())
  laborBodyId String?
  title     String          // "SAG-AFTRA 2023 Theatrical MOA"
  url       String?
  publisher String?         // SAG-AFTRA, EP, Cast & Crew
  trusted   Boolean @default(true)   // allow-list flag
  retrievedAt DateTime?
}

model RateChangeProposal {  // staging — nothing hits RateRule without approval
  id          String @id @default(cuid())
  origin      String          // MANUAL | REFRESH | AI
  payload     Json            // proposed RateRule fields
  diff        Json?           // old vs new
  sourceId    String?
  status      ProposalStatus  // PENDING | APPROVED | REJECTED
  reviewedById String?
  reviewedAt  DateTime?
  createdAt   DateTime @default(now())
}
enum ProposalStatus { PENDING APPROVED REJECTED }
```

### Project snapshot (immutable) — extends existing budget
```
model ProjectLaborConfig {   // answers from the wizard
  id          String @id @default(cuid())
  projectId   String @unique
  geoNodeId   String?         // resolved location
  productionType String
  unionStatus UnionStatus     // UNION | NON_UNION | MIXED
  laborBodyIds Json           // selected unions/guilds
  asOfDate    DateTime        // date used to resolve rates
}
enum UnionStatus { UNION NON_UNION MIXED }

model ProjectRateRule {      // frozen copy of resolved RateRules at creation
  id           String @id @default(cuid())
  projectId    String
  sourceRuleId String?        // pointer back to master (for "update available" detection)
  // …same fields as RateRule, copied by value…
  glAccountCode String?
}
```
*(The existing `FringeProfile` on `BudgetVersion` stays as the per‑line fringe handle; `ProjectRateRule` feeds/auto‑creates those profiles.)*

**Audit:** every `RateRule`/`Agreement` mutation already flows through the global `AuditLog` interceptor; the `previousId` chain + `RateChangeProposal` give full before/after lineage and approver.

---

## 3. Entity‑relationship diagram (textual)

```
GeoNode ──< GeoNode (tree)
LaborBody ──< Agreement ──< Classification ──< RateRule
                    │                              │
                    └────────── RateRule ──────────┘ (agreement-level)
RateSource ──< RateRule ;  RateSource ──< Agreement
RateRule ──(previousId)──> RateRule        (version chain)
RateChangeProposal ──> RateRule (on approve)

ProductionProject ──1:1── ProjectLaborConfig
ProductionProject ──< ProjectRateRule  ( frozen copy of RateRule )
ProjectRateRule ──> BudgetAccount / FringeProfile (GL + budget mapping)
ProjectRateRule.glAccountCode ──> GlAccount (auto-post burden journals)
```

---

## 4. Production workflow design

1. **Wizard step "Labor & Union Configuration"** (new step in project create): location (Country→State→City→Zone via GeoNode pickers), production type, union status (Union/Non‑Union/Mixed), multi‑select applicable unions/guilds (filtered by country), and an **as‑of date** (defaults to today).
2. On submit → **Resolution engine** runs `resolve(config, asOf)` → returns candidate RateRules with a human‑readable preview ("SAG‑AFTRA Pension 20.5% on gross capped weekly; IATSE Health $XX/day; UAE gratuity 5.83%…").
3. Accountant reviews/toggles the preview (can exclude any rule, override a value with a reason).
4. Confirm → **snapshot**: copy chosen rules into `ProjectRateRule`, create matching `FringeProfile`s and GL burden accounts, store `ProjectLaborConfig` with the as‑of date.
5. Project is now frozen. A later **"Check for rate updates"** action compares `ProjectRateRule.sourceRuleId` against master and shows a diff the accountant may apply (never automatic).

---

## 5. Budget workflow design

- Budget line items already have `fringeProfileId`/`fringePct`. We extend a line to optionally carry a **classification** (e.g., this 1400‑Cast line is "PERFORMER"); the engine then attaches *all* applicable `ProjectRateRule`s, not a single pct.
- **Fringe computation** per line: for each applicable rule, compute by `calcMethod` (percent of base, flat×days, percent‑with‑cap using qty/weeks, tiered). Sum → line fringe; roll into account → section → Top Sheet, exactly like today, but the Top Sheet gains a **"Fringes & Burden" breakdown** by rate type.
- A dedicated **Fringe Detail** view: per cost center, show each burden (pension/health/tax/WC…) with its rule and amount — the classic Movie Magic "fringe report."
- Caps are honored at the **person/role level** where data exists (qty×weeks×rate), approximated at line level otherwise, with a clear "estimate" flag.

---

## 6. Accounting integration design

- Each `RateType` maps to a **GL account** (`glAccountCode`): pension/health/union → 1900/5600 fringe accounts; employer payroll taxes → their own liability/expense accounts; WC → insurance/expense. This reuses the seeded Chart of Accounts.
- When production actuals post (payroll/expenses), the existing **auto‑post engine** can generate the burden journals: Dr burden expense (by cost center) / Cr the matching employer‑liability account, using the project's frozen rates.
- The **Cost Report (EFC)** already separates Budget/Committed/Actual/EFC per cost center; fringes become first‑class lines so EFC includes burdened labor, not just bare wages.
- All currency handled by the existing `FxService` (base‑currency consolidation).

---

## 7. Research & update strategy

Tiered, **approval‑gated**, provenance‑first:

- **Tier 1 — Manual (always available):** admin editor for LaborBody/Agreement/Classification/RateRule with required source + dates. This is the baseline and the legal safe‑harbor (a human entered it).
- **Tier 2 — Refresh button:** "Refresh Union & Fringe Rates" enqueues a fetch against an **allow‑list of official/approved sources** (SAG‑AFTRA, DGA, WGA, IATSE, Teamsters, EP, Cast & Crew; ACTRA, DGC, NABET, provincial authorities; Equity, BECTU, WGGB, Directors UK). Output → `RateChangeProposal` rows (never live data).
- **Tier 3 — AI research assistant:** an assistant reads the approved sources, extracts candidate rates with citations, and files `RateChangeProposal`s with a diff and the exact source URL/quote. It **proposes only**.
- **Approval queue:** admin reviews each proposal (old vs new, source link), approves/rejects; approval writes a new `RateRule` version (`previousId` chain) and stamps approver + date.

**Update propagation rule (your requirement):** approving a new rate affects **only future project snapshots**. Existing projects keep their frozen `ProjectRateRule`s until an accountant explicitly runs "update rates" on that project.

---

## 8. Refresh button architecture

```
[Refresh] → POST /compliance/refresh {bodies[], geo[]}
  → enqueue job per (LaborBody × Source)
     → fetcher pulls ONLY allow-listed source URLs (server-side; respects each site's terms)
     → parser/extractor → normalized candidate RateRule(s)
     → de-dupe vs current master → build diff
     → write RateChangeProposal(status=PENDING, origin=REFRESH, sourceId)
  → admin sees "N proposals pending" badge → Approval queue
```
- Rate‑limited, cached, and **idempotent** (re‑refresh updates the same pending proposal rather than duplicating).
- If a source can't be fetched/parsed, it's logged as "needs manual review," never guessed.
- Honors the platform's content/fetch restrictions — only approved domains, no scraping of unlicensed full agreements; we capture **rate figures + citation**, not redistributable documents.

## 9. AI‑assisted update workflow

```
Admin: "Research SAG-AFTRA 2024 pension & health"
  → AI agent restricted to approved-source allow-list
  → extracts: rateType, calcMethod, value, base, cap, effective/expiration + citation
  → self-checks (sanity ranges, effective-date continuity, currency)
  → files RateChangeProposal with: proposed values, diff vs current, source URL + quoted line, confidence
  → Admin approval queue (human decides) → versioned RateRule on approve
```
- The AI never writes to master, never to a live project, and always cites. Low‑confidence or conflicting extractions are flagged, not applied.
- Every proposal stores who/what/when/source for audit.

---

## 10. Risks, limitations & legal considerations

- **Not legal/financial advice.** Surface a standing disclaimer; the accountant/payroll company remains responsible. Rates are decision‑support, not authority.
- **Copyright / licensing.** Union agreements are often copyrighted. Store **rate values + citations**, not republished full texts. Respect each source's terms; prefer official rate summaries and licensed payroll‑provider references.
- **Accuracy & liability.** Approval‑gating + provenance + version history are the controls. Default to "estimate" flags where caps/role data are incomplete.
- **Temporal correctness.** Retroactive increases and mid‑term bumps must be modeled by effective‑dated rules; the resolver must pick the rule valid at the project's as‑of date.
- **Caps need person‑level data** to be exact; line‑level budgets give estimates. Be explicit about which.
- **Jurisdictional gaps.** UAE has no film unions — model statutory burdens (WPS, gratuity, visa/permit) so the engine isn't US‑centric. Expandability is structural (data‑driven), not code changes.
- **Maintenance load.** Dozens of agreements renew on rolling cycles; without the refresh/AI tiers this becomes stale fast — hence the update engine is core, not optional.
- **Security/RBAC.** Master‑data editing and approvals must be a high permission level (e.g., `setup`/`finance` = manage); approvals are audited via the existing AuditLog.

---

## 11. Recommended implementation roadmap

- **Phase 0 — Foundations (schema + resolver, no UI fetch):** Geo/LaborBody/Agreement/Classification/RateRule/Source models; resolution engine; admin CRUD; seed UAE statutory + a thin US/CA/UK starter set entered manually. Wizard step + project snapshot + budget fringe computation + Fringe Detail report. *This alone replaces manual fringe setup.*
- **Phase 1 — Accounting & reporting:** GL mapping per rate type; burden in Cost Report/EFC; auto‑post burden journals; FX consolidation.
- **Phase 2 — Update engine:** `RateChangeProposal` + approval queue + manual versioning UI + audit lineage.
- **Phase 3 — Refresh button:** allow‑listed fetch → proposals.
- **Phase 4 — AI research assistant:** extraction with citations → proposals.
- **Phase 5 — Incentives & tax credits** (explicitly future), more countries, person‑level cap precision, payroll‑provider integrations (EP/Cast & Crew).

---

## Decisions confirmed (2026-06-02) & Phase 0 build status

**Confirmed:**
1. Calc fidelity — **line-level estimates** first (caps/wage-bases approximated, flagged `isEstimate`).
2. Snapshot granularity — **project-level config + version recompute**.
3. Phase-0 data depth — **full US/CA/UK union rates now + UAE statutory** (cited starter set; long tail via update engine).
4. Approvers — **Finance Manager OR System Admin OR Line Producer** (master-data writes gated at `setup` edit level; SYSTEM_ADMIN/FINANCE_MANAGER by default).

**Phase 0 — BUILT:**
- Schema: `GeoNode`, `LaborBody`, `Agreement`, `Classification`, `RateRule`, `RateSource`, `RateChangeProposal`, `ProjectLaborConfig`, `ProjectRateRule` (+ enums); `BudgetLineItem.classificationCode` + `fringeDetail`.
- Backend `LaborModule`: pure `fringe-engine.ts` (resolver + typed computation), `labor.service.ts` (master CRUD, resolve preview, immutable snapshot, check/apply updates, budget fringe application, Fringe Detail report), `labor.controller.ts` (RBAC-guarded), registered in `app.module.ts`.
- Seed `prisma/seed-labor.js`: geography (US/CA/UK/UAE + states/cities), labor bodies (SAG-AFTRA, DGA, WGA, IATSE, Teamsters, ACTRA, DGC, Equity, BECTU + US/CA/UK/UAE statutory), agreements, classifications, and **cited rate rules** (figure + source URL + effective date; estimates flagged).
- Frontend: project **Labor & Union** tab (`ProjectLaborPanel`) — configure → preview → freeze snapshot → check/apply updates; **Fringe Detail** tab (`FringeDetailPanel`) — burden per cost center + Apply fringes; budget grid **classification tagging**; Setup → **Labor & Fringe Master** admin (`setup/labor`) — bodies/agreements/classifications/rate rules/sources/geography; `laborApi` helpers; nav wired.

**Deferred to later phases (as designed):** Phase 1 GL burden auto-post + EFC burden lines + branded Fringe PDF; Phase 2 approval queue (`RateChangeProposal` model already present); Phase 3 refresh button; Phase 4 AI assistant; Phase 5 person-level caps, incentives, payroll-provider integrations.

---

## Open decisions to confirm before Phase 0

1. **Calc fidelity for v1:** line‑level estimates (qty×weeks×rate, caps approximate) vs. wait for person‑level (deal‑memo‑driven) precision? *Recommend: line‑level now, person‑level in Phase 5.*
2. **Snapshot granularity:** snapshot rules at **project** level (one set) or per **budget version**? *Recommend: project‑level config + version‑level recompute, mirroring the existing BudgetVersion model.*
3. **Phase‑0 country depth:** how complete should the seeded US/CA/UK starter rates be vs. UAE statutory? (Affects how much manual rate entry up front.)
4. **Who approves rates** (which role gets the approval permission)?
5. **Refresh/AI sourcing:** confirm the exact approved‑source allow‑list and that we store **figures + citations only** (not full agreement texts).
