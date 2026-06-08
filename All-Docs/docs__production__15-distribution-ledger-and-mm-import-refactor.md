# 15 — Distribution/Corporate Ledger (Y14) & Movie Magic Import Refactor

Implements two blueprints: the optional **6000–9000 studio ledger** and the **MMB import
stabilization** (legacy fringe capture, 4th-level sub-details, merge strategies).

---

## 1. Distribution & Corporate Ledger (6000–9000)

Optional COA block for projects that track sales/distribution — not just the production
budget. Defined as module-level `DISTRIBUTION_COA` in
`backend/src/production/projects/projects.service.ts` next to `MASTER_COA`.

| Section | Accounts |
|---|---|
| **6000 Prints & Advertising (P&A)** | 6100 Creative Materials (trailer, key art, spots, digital assets) · 6200 Media Buy (TV, digital, OOH, print) · 6300 Publicity & PR (agencies, junkets, premieres, festivals) · 6400 Print & Logistics (DCP, KDM, localization) |
| **7000 Revenue** | 7100 Sales & Licensing (theatrical box office, territory MGs, SVOD/AVOD, airline, product placement) |
| **8000 Cost of Goods Sold** | 8100 COGS (amortization of production cost, residuals & guild participations, talent back-end, sales-agent fees) |
| **9000 Corporate Overhead** | 9100 Corporate SG&A (executive salaries, studio office rent, G&A) |

All four sections carry `tier: 'OTHER'`, `sortOrder` 6–9, and distinct colors so they sit
*after* the production budget in every report.

### Two entry points

1. **At creation** — the New Project form has a checkbox
   *"Include distribution & corporate ledger (6000–9000)"* → `create()` passes
   `includeDistribution: true` → `createDefaultBudget(projectId, true)` seeds
   `MASTER_COA` + `DISTRIBUTION_COA`.
2. **Post-creation injection** — `POST /production/projects/:id/inject-distribution`
   (Settings tab → "Add distribution ledger"). Safety guards, in order:
   - active budget version must exist (404 otherwise);
   - version `status !== 'LOCKED'` (create a working copy first);
   - none of the 6000/7000/8000/9000 section codes may already exist (rejects with the
     duplicate list — running it twice is a no-op error, never a double-seed);
   - after seeding, the version total is re-rolled onto `ProductionProject.totalBudget`.

### Transaction kinds

`ProjectTxnKind` gained **`SALES_REVENUE`** and **`CORPORATE_OVERHEAD`**.
`ledger.service.ts → computeTotals()` treats `SALES_REVENUE` like `INCOME` and
`CORPORATE_OVERHEAD` like `COST`, so cash flow, AP aging and the finance summary fold the
studio ledger in without any report changes. Actuals join the 6000+ accounts by
`accountCode`, exactly like production accounts.

> Requires `npx prisma db push && npx prisma generate` (new enum values).

---

## 2. Movie Magic Import Refactor (`movie-magic.service.ts`)

### Fix 1 — Legacy fringe holding tank

The parser now captures per-detail fringe figures (`Fringe`/`Fringes`/`FringeAmount`/
`FringeTotal` for amounts; `FringePct`/`FringePercent`/`FringeRate` for percentages; CSV
columns `fringe`, `fringe %`, etc.). `resolveFringe()` derives the missing half (pct from
amount or amount from pct, rounded to 2 dp).

For every **distinct percentage** in the file the import creates one
`FringeProfile` named **"MMB Legacy Fringe {pct}%"** on the target version and links the
lines via `fringeProfileId`. One profile per distinct pct (not a single 0% bucket) means a
later `updateLineItem()` recompute resolves against the matching percentage instead of
wiping the imported value — and `total = subtotal + fringeAmount` matches the Movie Magic
file **to the penny**.

### Fix 2 — 4th-level sub-details → stages JSON

MMB allows details under details. The parser collects
`SubDetailList/SubDetail` (and aliases) and flattens them into the existing
`BudgetLineItem.stages` JSON: `[{ stage, qty, unit, rate, amount }]` — the same shape the
labor block editor and `stagesSubtotal()` already use (`qty` key, not `quantity`). When
sub-details exist, the line subtotal is the **sum of stage amounts** (MMB's own roll-up);
otherwise it stays `qty × rate`.

### Fix 3 — Merge strategy

`importBudget(projectId, file, mergeStrategy)`:

| Strategy | Behaviour |
|---|---|
| `NEW_VERSION` (default) | Previous behaviour: deactivate all versions, create a fresh active **"Movie Magic Import"** WORKING version. |
| `UPDATE_ACTIVE` | Non-destructive departmental upsert into the **active, unlocked** version: sections and accounts matched **by code** (created if missing); line items deleted + recreated **only inside accounts present in the file**. Departments not in the file are untouched. Rejects if no active version or the active version is LOCKED. |

The multipart route `POST /production/movie-magic/:projectId/import` accepts a
`mergeStrategy` form field; anything other than `UPDATE_ACTIVE` falls back to
`NEW_VERSION`. The Settings tab has a strategy dropdown; project-creation imports always
use `NEW_VERSION` (there is nothing to merge into yet beyond the seeded skeleton).

All imported lines still carry `origin: MOVIE_MAGIC_IMPORT`, and a re-import recalculates
the version → project totals.

### Import result payload

```json
{
  "versionId": "…", "strategy": "UPDATE_ACTIVE",
  "sections": 12, "accounts": 38, "lineItems": 412,
  "legacyFringeProfiles": ["MMB Legacy Fringe 18.5%", "MMB Legacy Fringe 12%"]
}
```

---

## 3. Files touched

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | `ProjectTxnKind` += `SALES_REVENUE`, `CORPORATE_OVERHEAD` |
| `backend/src/production/ledger/ledger.service.ts` | `computeTotals()` maps the new kinds to income/cost |
| `backend/src/production/projects/projects.service.ts` | module-level `MASTER_COA` (expanded) + `DISTRIBUTION_COA`; `seedSections()`; `injectDistributionLedger()`; `create()` DTO + `createDefaultBudget(projectId, includeDistribution)`; seeded version now starts `DRAFT` |
| `backend/src/production/projects/projects.controller.ts` | `POST :id/inject-distribution` |
| `backend/src/production/movie-magic/movie-magic.service.ts` | fringe + sub-detail parsing, legacy fringe profiles, merge strategies |
| `backend/src/production/movie-magic/movie-magic.controller.ts` | `mergeStrategy` body field |
| `frontend/src/lib/api.ts` | `projects.injectDistribution`; `movieMagic.import(..., mergeStrategy)` |
| `frontend/.../production/projects/page.tsx` | "Include distribution ledger" checkbox on New Project |
| `frontend/src/components/production/ProjectSettingsPanel.tsx` | merge-strategy dropdown · legacy-fringe feedback · "Add distribution ledger" card |
| `docs/production/13-master-coa-and-crew-link.md` | expanded COA table (ATL 1100–1700 · BTL 2100–2990 · POST 3100–3600 · OTHER 4100–4500) |
