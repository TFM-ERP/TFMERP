# 06 — Union, Statutory & Fringe Intelligence

A data-driven, approval-gated system for US/CA/UK union/guild rates and UAE statutory burdens, with immutable per-project snapshots. Backend: `src/labor/` (`LaborController` @ `labor`, `LaborService`, `fringe-engine.ts`). Frontend: `setup/labor` (master), `setup/rate-approvals`, and the project `labor` tab (`ProjectLaborPanel`) + `FringeDetailPanel`.

---

## 6.1 The master library

A geography-rooted catalogue:

```
GeoNode (COUNTRY→STATE→…→ZONE tree)
  └─ LaborBody (UNION | GUILD | STATUTORY | PAYROLL_PROVIDER)   e.g. SAG-AFTRA, IATSE, UAE MOHRE
       └─ Agreement (effective/expiration, productionTypes, status)   e.g. "SAG-AFTRA Theatrical 2023-2026"
            ├─ Classification (PERFORMER, BG, STUNT, IATSE-LOCAL-600 …)
            └─ RateRule (the typed burden primitive)  ──? RateSource (provenance)
```

CRUD across all of these: `geoTree/geoList/createGeo…`, `laborBodies/createLaborBody…`, `agreements/agreement/createAgreement…`, `createClassification…`, `rateRules/createRateRule…`, `sources/createSource…`.

## 6.2 The fringe engine (pure, DB-free) — `fringe-engine.ts`

Typed rate primitives via `CalcMethod`:
- `PERCENT` — value × wage base
- `FLAT_PER_DAY` / `FLAT_PER_WEEK` / `FLAT_PER_HOUR` — flat × quantity
- `PERCENT_WITH_CAP` — percent up to a `capAmount` ceiling (per `capPeriod`)
- `TIERED` — `tiers: [{upTo, value}]`

`RateRule` carries `rateType` (PENSION, HEALTH, PAYROLL_TAX, WORKERS_COMP, VACATION_PAY, STATUTORY_GRATUITY, UNION_DUES…), `value Decimal(12,5)`, `base` (GROSS/STRAIGHT_TIME/TAXABLE/WORKED_DAYS), optional cap/floor/tiers, `currency`, and `glAccountCode`.

Three pure functions:
- `resolveRules(ctx, agreements)` — given project config (production type, union status, labor bodies, geography, as-of date) + candidate agreements, returns the applicable rules.
- `computeRule(rule, input)` — burden for one rule given wage base + quantities.
- `computeLineFringes(rules, input)` — applies an array of rules to a line, returns `{ total, detail[] }`.

Reused by budget fringe-apply, **payroll** (timecard burden), and labor preview.

## 6.3 Rate versioning & provenance

- `RateRule.previousId` forms a **version chain**. `updateRateRule` creates a *new* version and expires the old one the day before the new effective date — historical snapshots never mutate.
- `RateSource` records `url`, `publisher`, `trusted` (allow-list), and change-detection fields `lastHash` (SHA-256), `lastStatus`, `lastCheckedAt`. `isEstimate` flags uncited/approximate rules.

## 6.4 Approval queue — `RateChangeProposal`

**Nothing updates automatically.** Every change (manual, refresh, or AI) becomes a `RateChangeProposal` (`origin`, `payload`, `diff`, `confidence`, `PENDING→APPROVED/REJECTED`).
- `createProposal`, `listProposals`, `pendingCount`.
- **`approveProposal(id, userId, role, notes)`** — writes the `RateRule` (new version) and refreshes affected `ProjectRateRule`s. Approver roles: **System Admin OR Finance Manager OR Line Producer**.
- `rejectProposal`.
Rendered on `setup/rate-approvals`.

## 6.5 The refresh engine

`refreshRates(laborBodyIds)` fetches **allow-listed sources only** (host allow-list incl. film.gov.ae, cma.gov.ae, mediaoffice.abudhabi, plus union publishers), hashes the content, and when it changes files a `PENDING` `REFRESH` proposal (it never writes rates directly). Constraints honoured: no unofficial websites; nothing updates without approval.

## 6.6 Per-project labor snapshot (immutable)

`ProjectLaborConfig` (1:1) captures the project's `geoNode`, `productionType`, `unionStatus`, selected `laborBodyIds`, and `asOfDate`.
- `getProjectConfig` / `saveConfig`.
- **`snapshot(projectId)`** — resolves the applicable master rules at `asOfDate` and **freezes them as `ProjectRateRule`s** (full copy: value, method, base, caps, tiers, GL code, source title/url, `frozenAt`). Historical projects therefore never change when masters update.
- `toggleProjectRule(id, enabled)`; `checkUpdates(projectId)` detects newer master versions vs `sourceRuleId`; `applyUpdates(projectId, ids)` opt-in adopts them (future-only by default).
Rendered in `ProjectLaborPanel`.

## 6.7 Applying fringes to the budget

- `resolvePreview(data)` — preview applicable rules for a config (no write).
- **`applyFringesToVersion(versionId)`** — for every labour line (matched by `classificationCode`) runs `computeLineFringes` against the frozen `ProjectRateRule`s, writing the per-rule breakdown into `BudgetLineItem.fringeDetail` and the sum into `fringeAmount`.
- `fringeDetail(versionId)` — the burden breakdown per line/rate-type, rendered in `FringeDetailPanel` and the branded `print/fringe/[versionId]` PDF; burden also surfaces as lines in the Cost Report / EFC and auto-posts GL journals.

## 6.8 Why this shape (design rationale)

Line-level calc fidelity + immutable project snapshots + approval-gated, cited sourcing gives a **legal safe-harbor**: every burden number on a historical project is traceable to a frozen rule and an approved source, and future rate changes never silently rewrite a delivered budget.
