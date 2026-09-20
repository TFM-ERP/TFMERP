# TFM‑System — Budgeting & Scheduling: Complete Rebuild Reference

> **Purpose.** This document is a carbon‑copy specification of how **Scheduling**, **Script Breakdown**, **Budgeting**, and **Cost Control** work in the current production system ("the old system", TFM‑System) so that the new **FilmOS** system can rebuild them with identical logic, data flow, permissions, versioning, locking, calculations, and cross‑module relationships. Nothing here is summarized for brevity — field names, enum values, formulas, endpoints, and UI controls are quoted verbatim from the codebase. Where the old system has a bug, inconsistency, or deliberate design choice worth preserving/reconsidering, it is called out in **Rebuild notes**.
>
> **Source of truth.** NestJS backend at `backend/src/production/` (base route `/api/v1`, port 3001), Prisma schema at `backend/prisma/schema.prisma`, Next.js frontend at `frontend/src/` (port 3000). The account‑code strings and the four‑level budget tree are the load‑bearing contracts — preserve them exactly.

---

## 0. Table of contents

1. The end‑to‑end workflow (how the four subsystems chain)
2. Shared architecture & conventions (permissions, the account‑code contract, currency, money precision)
3. **PART A — Scheduling** (stripboard, calendar anchoring, DOOD, scenarios, conflicts, reports)
4. **PART B — Script Breakdown** (elements, projection, breakdown→budget generation)
5. **PART C — Budgeting** (version tree, states, locking, calculations, fringes, transfers)
6. **PART D — Cost Control** (cost report, actuals, committed, EFC, variance, snapshots, ledger, GL)
7. **PART E — The labor / fringe burden engine** (classification‑driven statutory fringes)
8. **PART F — Cross‑module connections** (inputs to and consumers of budget/schedule)
9. **PART G — AI features** (the AI gateway, the catalog of AI touch‑points, provenance)
10. **PART H — Rebuild notes, gotchas, and what to preserve**

---

## 1. The end‑to‑end workflow

The old system models a real film‑production money‑and‑time pipeline. The canonical order is **Script → Breakdown → Schedule → Budget → Cost Control**, but scheduling and budgeting are mutually reinforcing (the schedule sizes the budget's day‑counts; the locked budget anchors the shoot calendar).

```
  ┌─────────────┐   AI breakdown        ┌──────────────────┐
  │  Script     │ ───────────────────▶  │ BreakdownElement  │  (per-scene physical elements:
  │ (ScriptScene│   (per scene)         │  cast, props, VFX,│   cast/props/vehicles/VFX/…)
  │  revisions) │                       │  vehicles, …)     │
  └─────┬───────┘                       └───────┬──────────┘
        │ projection (content only)             │ aggregate by category × rate card
        ▼                                       ▼
  ┌─────────────┐   auto-schedule /      ┌──────────────────┐   push / mapping
  │ ProductionS │◀── optimizer ──────────│  Budget line     │──────────────────▶ Budget tree
  │  trip        │   (shootDay, order)   │  generation      │   (SCRIPT_IMPORT lines)
  │ (stripboard)│                        └──────────────────┘
  └─────┬───────┘
        │ strips × elements
        ▼
  ┌─────────────┐  DOOD tallies → globals staging → (user push) → budget globals (shoot_days…)
  │ DOOD matrix │────────────────────────────────────────────────────────────────────┐
  │ (Start/Work/│                                                                      ▼
  │ Hold/Drop)  │                                                            ┌──────────────────┐
  └─────┬───────┘                                                            │  BudgetVersion   │
        │ on-set codes (SW/W/WF/SWF/PU)                                       │  → Section       │
        ▼                                                                     │  → Account       │
  ┌─────────────┐   shootDayForDate()                                        │  → LineItem      │
  │ Call sheets │◀── calendar anchoring (Day N = Nth working day)            │  + Fringe/Global │
  └─────────────┘                                                            └───────┬──────────┘
                                                                     lock ▶ anchor    │ Σ line totals
                                                                    shoot calendar    ▼
                          actuals (ProjectTransaction, by accountCode) ──▶ ┌──────────────────┐
                          committed (PurchaseOrder, by costCenterCode) ──▶ │   Cost Report    │
                          overages + transfers (by account code)       ──▶ │  budget/committed│
                                                                            │  /actual/EFC/var │
                                                                            └──────────────────┘
```

**The five moments that matter for a rebuild:**

1. **Breakdown** turns each scene into tagged elements (`BreakdownElement`).
2. **Projection** turns the active script revision's scenes into stripboard rows (`ProductionStrip`) — content only, never touching the shoot‑day ordering.
3. **Scheduling** assigns each strip a `shootDay` (manual, auto‑schedule, or optimizer) and the **calendar anchoring** algorithm maps Day N to a real date (skipping weekends/holidays).
4. **DOOD** is computed live from strips × elements and, when the user pushes it, seeds the budget's day‑count globals (`shoot_days`, etc.) via a **staging buffer**; breakdown elements separately generate budget line items at a default rate card.
5. **Budget** is a four‑level tree that, once **locked**, becomes the read‑only baseline the **Cost Report** reconciles actuals (transactions) and committed costs (POs) against — everything joined by **account‑code string**.

**Rebuild note.** The coupling between schedule and budget is deliberately *staged and reversible*: DOOD writes only to `ProjectGlobalsStaging` (never directly to a budget version), breakdown‑generated lines are idempotent (`subTitle:'Auto-Breakdown'`), and every AI/cross‑module write is a preview that requires an explicit apply. Preserve this "stage → preview → explicit apply" gate.

---

## 2. Shared architecture & conventions

### 2.1 Permissions

Every production controller is guarded by `@UseGuards(JwtAuthGuard, PermissionsGuard)` with a class‑level `@RequirePermission('production', <level>)`:

- **Level 1 = read** (view). Scheduling and breakdown reads, cost‑report reads, ledger reads.
- **Level 2 = mutate/edit** (create/update/delete, lifecycle transitions, calendar config, payment runs). The **entire budget controller** is level 2 — even its GET routes — so view‑only roles (CREW/TALENT_REP at production:1) **cannot read budgets**.
- The **ledger controller** additionally uses `TwoFactorGuard`; its payment run requires `@Require2FA()`.
- Certain state changes are further gated by **project capabilities** (not just the numeric permission): `('po','approve')`, `('transfers','approve')`, `('costReport','lock')`. Budget lifecycle transitions are gated by **crew role** (Executive Producer / Producer / Line Producer) or **system role** (SYSTEM_ADMIN / FINANCE_MANAGER).

### 2.2 The account‑code contract (the single most important rule)

Budget‑to‑actuals reconciliation is done **entirely by matching a free‑text cost‑center code string** — there is no foreign key between the budget tree and the financial records. The same code appears as:

`BudgetAccount.code` ≡ `PurchaseOrder.costCenterCode` ≡ `ProjectTransaction.accountCode` ≡ `Overage.accountCode` ≡ `BudgetTransfer.fromCode`/`toCode` ≡ `BreakdownElement.costCenterCode`.

Uncoded records bucket to `'__none__'` (cost report) or `'__uncoded__'` (ledger drill‑down). **Any FilmOS rebuild must preserve this shared coding contract** (or migrate every consumer simultaneously to a relational key).

### 2.3 Currency & money precision

- Project base currency: `ProductionProject.currency` (`Currency @default(AED)`).
- Line items carry their own `currency` + `exchangeRate Decimal(10,4)`; subtotals are FX‑normalized into base by dividing by `exchangeRate`.
- Money is `Decimal(15,2)`; quantities `Decimal(10,3)`; rates `Decimal(15,2)`; percentages `Decimal(5,2)`; pages `Decimal(6,3)` (decimal eighths, e.g. `1.125` = 1⅛).

### 2.4 Restart behavior (dev)

`npm run start:dev` restarts the backend on any `.ts` save, killing in‑flight AI generation — relevant because several budget/breakdown flows call AI. Transient "server restarting" errors during editing are expected and surfaced to the user with a retry hint.

---

# PART A — SCHEDULING

Scheduling runs before budgeting and feeds it. It lives in `backend/src/production/scheduling/`. The **live schedule is the set of `ProductionStrip` rows** — the `ProductionSchedule` table holds only optional per‑day metadata. DOOD and the production calendar are **pure derivations, computed live and never stored**; the only persisted scheduling state is `ProductionStrip` (plus scenario JSON snapshots and the globals staging buffer).

## A.1 Data model

### `ProductionStrip` — `@@map("production_strips")` (schema ~line 2697) — a stripboard row (one scene OR a banner)

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `projectId` | `String` | |
| `project` | `ProductionProject @relation(onDelete: Cascade)` | |
| `sceneNumber` | `String?` | |
| `intExt` | `StripIntExt @default(INT)` | enum INT / EXT / INT_EXT |
| `dayNight` | `StripDayNight @default(DAY)` | enum DAY / NIGHT / DUSK / DAWN |
| `setName` | `String?` | |
| `location` | `String?` | free‑text location |
| `locationId` | `String?` | FK to `Location` (per‑diem + grouping) |
| `locationRef` | `Location? @relation("StripLocation", onDelete: SetNull)` | |
| `description` | `String?` | |
| `pages` | `Decimal @db.Decimal(6,3) @default(0)` | **eighths as decimal: `1.125` = 1⅛ pages** |
| `cast` | `Json?` | **array of cast name strings** (legacy cast list) |
| `estMinutes` | `Int?` | estimated shoot time |
| `shootDay` | `Int @default(0)` | **`0` = unscheduled**; 1..N = scheduled day |
| `sortOrder` | `Int @default(0)` | order within a day |
| `notes` | `String?` | also a source tag: `'Script-projected'`, `'Movie Magic'` |
| `createdAt` / `updatedAt` | `DateTime` | |
| `elements` | `BreakdownElement[]` | |
| `isLocked` | `Boolean @default(false)` | pins the strip (optimizer/projection won't move/overwrite) |
| `isBanner` | `Boolean @default(false)` | **banner / day‑break row** (company move, day off, 2nd unit) |
| `bannerText` | `String?` | |

Enums (schema ~2684): `StripIntExt { INT, EXT, INT_EXT }`; `StripDayNight { DAY, NIGHT, DUSK, DAWN }`.

### `ProductionSchedule` — `@@map("production_schedules")` (~4701) — **per‑day metadata only** (NOT the stripboard)

| Field | Type |
|---|---|
| `id` | `String @id @default(cuid())` |
| `projectId` / `project` | `String` / relation (Cascade) |
| `dayNumber` | `Int` |
| `date` | `DateTime` |
| `location` | `String?` |
| `callTime` | `String?` |
| `wrapTime` | `String?` |
| `scenes` | `String?` |
| `notes` | `String?` |

This holds optional day‑level date/call‑time/location; `board()` maps `dayNumber → {date, location, callTime}` to enrich strips. **Rebuild note:** the name is misleading — this is *day metadata*, not "the schedule".

### `ScheduleScenario` — `@@map("schedule_scenarios")` (~2733) — what‑if versioning (M6)

`id, projectId, name, notes, kind String @default("SNAPSHOT")` (`SNAPSHOT | OPTIMIZED | BASELINE`), `strips Json` (full board snapshot array), `metrics Json?`, `createdAt/updatedAt`. **Additive** — there is no `scenarioId` on `ProductionStrip`, so live board queries are untouched by scenarios.

### `ProjectGlobalsStaging` — `@@map("project_globals_staging")` (~1638) — the schedule→budget buffer

`projectId @unique, prepDays Int?, shootDays Int?, wrapDays Int?, crewCount Int?, eurToAed, usdToAed, status String @default("DRAFT")` (`DRAFT | PUSHED`), `pushedAt, pushedToVersionId, doodTallies Json?` (shape `{generatedAt, categories:{CAST:{elements,workDays,holdDays}, …}}`), `notes`. **This is the staging buffer between DOOD/schedule and the budget** — DOOD writes here, and only an explicit user push copies it into a budget version's globals.

### `ScriptSyncLog` — `@@map("script_sync_logs")` (~3463) — reversible projection audit

`projectId, revisionId?, action String @default("SYNC")` (`SYNC | RECONCILE | LOCK | ROLLED_BACK`), `diff Json?`, `appliedById?, appliedAt`.

### `ProductionProject` scheduling fields (schema ~1540)

`startDate?, endDate?, shootStartDate?` (**Day 1 anchor**, set automatically when a budget is LOCKED), `shootEndDate?`, `currency Currency @default(AED)`, `totalBudget Decimal?`, `scheduleConfig Json?` (shape `{weekendDays:number[], holidays:string[]}`). `ScriptScene` carries `productionStripId String?` (the scene↔strip link).

## A.2 Scheduling workflow & state

There is **no explicit schedule "draft/working/locked" state machine on the schedule itself.** Locking is expressed at three granularities:

1. **Per‑strip lock** — `ProductionStrip.isLocked`. Toggled with the 🔒 button (`updateStrip(id,{isLocked})`). A locked strip cannot be dragged (`draggable={!s.isLocked}`), is **pinned** in the optimizer (`if (s.isLocked && s.shootDay>0) pinnedDays.add(s.shootDay)`), and the projection engine writes **content only** and skips it (`if (strip.isLocked && !opts.overrideLocked) { …skippedLocked++ }`).
2. **Script‑revision lock** — `ScriptRevision.isLocked` freezes pages; projection preview marks a change to a locked strip as type `LOCKED` ("link only (locked)").
3. **Budget lock** — the **shoot‑start anchor is fixed when a budget is LOCKED** (see PART C); `applyMapping` refuses when the active budget `status === 'LOCKED'`.

**Schedule creation paths:**

- **Manual** — `createStrip` (Add‑scene form) → a row with the `shootDay` you type (0 = unscheduled).
- **Script import (legacy)** — `POST breakdown/import-script` (direct‑to‑board) or `POST breakdown/import-script-full` (import + AI breakdown + auto‑schedule + optional budget).
- **Script hub (canonical)** — AI‑break down a revision (`POST breakdown/revision/:revisionId/breakdown`), then **project** scenes → strips (`POST breakdown/projection/apply`).
- **Auto‑schedule** — `autoSchedule` groups unscheduled strips by `setName`, packs to `pagesPerDay` (default 5), continues numbering after the max already‑scheduled day. New day when `dayPages + p > pagesPerDay` OR the set changes at ≥60% of target.

**Versioning = Scenarios (M6):** `ScheduleScenario` JSON snapshots of the whole board. `snapshotScenario` (kind SNAPSHOT), `optimizedScenario` (runs the optimizer in preview, kind OPTIMIZED), `applyScenario` (writes a scenario's `shootDay`/`sortOrder` back to the live strips, **auto‑snapshotting the live board first as kind BASELINE for rollback**), `compareScenarios` (live board + selected scenarios' metrics side‑by‑side).

## A.3 Stripboard mechanics

- **Strip types:** (a) **scene strip** (`isBanner:false`) — scene#, INT/EXT, DAY/NIGHT, set, location, description, pages, cast, estMinutes; (b) **banner / day‑break** (`isBanner:true, bannerText`) — e.g. "COMPANY MOVE · DAY OFF · 2ND UNIT", a dark full‑width row added per day via "+ banner" (`createStrip({isBanner:true, bannerText, shootDay, pages:0})`). Company moves are **detected** (a day with >1 distinct `locationId` → `COMPANY_MOVE` warning) and **represented** as banners.
- **Ordering:** `listStrips` orders by `[{shootDay asc},{sortOrder asc}]`. Within a day, `sortOrder`.
- **Drag reorder** (frontend `StripboardPanel.moveStrip`): flattens the board, moves the dragged strip to the target day (before a target strip, or appended), recomputes per‑day `sortOrder` counters, persists via `POST reorder` (`reorder(items:{id,shootDay,sortOrder}[])` in a `$transaction`).
- **Colors** (`StripboardPanel.tsx`): DAY amber / NIGHT indigo / DUSK orange / DAWN sky (`DN_CLR` chips + `DN_EDGE` left border). EXT = teal chip, INT = gray. Pages shown as eighths via `pagesLabel` (`1.125 → "1 1/8"`).
- **Grouping into days:** `board()` groups strips by `shootDay`, joins `ProductionSchedule` day info, and returns `{board:[{dayNumber,date,location,callTime,strips,pages,sceneCount}], unscheduled, totalPages, totalScenes, shootDays}`.

## A.4 Calendar anchoring (Day N → real date) — EXACT algorithm

The mapping from shoot‑day number to calendar date is a pure, testable function (`calendar-anchoring.util.ts`). The **anchor = `project.shootStartDate ?? project.startDate` = Day 1 of Principal Photography.** Phase lengths come from `ProjectGlobalsStaging` (prep/shoot/wrap) first, else from the active budget version's globals (`prep_days`, `shoot_days`, `wrap_days`, `strike_days`) — **never hardcoded.** `weekendDays:number[]` (0=Sun … 6=Sat) and `holidays:Set<YYYY‑MM‑DD>` come from `project.scheduleConfig`.

Working‑day test (UTC, timezone‑independent):

```ts
export function isWorkingDay(d, weekendDays, holidays) {
  return !weekendDays.includes(d.getUTCDay()) && !holidays.has(isoDate(d));
}
```

SHOOT ripple — **Day N = the Nth working calendar day from the anchor; weekends/holidays become labelled day‑off rows** ("Holiday" if in the holidays set, else "Day off"):

```ts
let cur = new Date(anchorDate), placed = 0, guard = 0; let lastShoot = new Date(anchorDate);
while (hasWorkdays && placed < shootLen && guard++ < span(shootLen)) {
  if (working(cur)) {
    placed++;
    const ds = byDay.get(placed) || [];
    shootRows.push({ date: isoDate(cur), phase:'SHOOT', shootDay: placed,
                     sceneCount: ds.length, strips: ds.map(...) });
    lastShoot = new Date(cur);
  } else {
    shootRows.push({ date: isoDate(cur), phase:'SHOOT', shootDay: null, sceneCount:0,
                     strips:[], dayOff:true, label: offLabel(cur) });
  }
  if (placed < shootLen) cur = addDays(cur, 1);
}
```

`shootLen = max(lengths.shoot, maxBoardDay)`. **PREP** counts *back* N working days from the day before the anchor (then reversed). **WRAP** then **STRIKE** fill working days after `lastShoot`. The loop bound `span(needed) = needed*7 + holidays.size*7 + 30` scales with the work‑week (so if all seven days are off, it never spins). Returns `{anchor, phases:{…lengths, shootEffective, weekendDays, holidays}, days:[…prep, …shoot, …tail], unscheduledScenes}`.

**Reverse lookup** `shootDayForDate({anchor, weekendDays, holidays, date, shootLen})` walks from the anchor counting working days; returns the count `n` if the target is a working day and `n ≤ shootLen`, else `null` (before anchor, a day off, or past the window — so wrap/strike/holiday dates map to no shoot day). This is what the **call sheet** endpoint uses to resolve "what is shoot day for this date".

## A.5 DOOD (Day‑Out‑of‑Days) — EXACT algorithm

DOOD is **computed live, never stored**, from `ProductionStrip (scene, shootDay)` ⇄ `BreakdownElement (person/item, category)`. Move a scene → the next call returns the shifted matrix.

**Codes:** `SW` = Start Work (first appearance) · `W` = Work · `WF` = Work Finish (last appearance) · `SWF` = start+finish same day · `H` = Hold (idle gap shorter than the drop threshold — still paid) · `D` = Drop (idle stretch ≥ `dropAfter` days — production stops holding/paying) · `PU` = Pick‑up (a work day resuming after a Drop). `dropAfter` default 4, minimum 2.

**Canonical multi‑category engine** — `dood-calculation.util.ts` `buildDoodMatrix` (verbatim):

```ts
const dropAfter = Math.max(2, Number(input.dropAfter) || 4);
const scheduled = strips.filter(s => s.shootDay > 0).sort((a,b) => a.shootDay - b.shootDay);
const days = [...new Set(scheduled.map(s => s.shootDay))].sort((a,b) => a-b);
// element name → set of working days (merged across strips by lowercased name); quantity = max seen
for (const el of input.elements) addAppearance(el.name, stripDay.get(el.stripId), el.quantity, el.id);
if (cat === 'CAST')
  for (const s of scheduled)
    for (const name of (Array.isArray(s.cast)?s.cast:[])) addAppearance(name, s.shootDay); // legacy cast[]

const rows = [...rowsByKey.values()].map(r => {
  const work = [...r.days].sort((a,b) => a-b);
  const start = work[0], finish = work[work.length-1];
  const cells = {}; let holdDays=0, dropDays=0, pickupDays=0;
  for (const d of days) {
    if (d < start || d > finish) { cells[d] = ''; continue; }
    if (r.days.has(d)) {
      const prevW = work.filter(w => w < d).pop();
      const gapBefore = prevW != null ? days.filter(x => x > prevW && x < d).length : 0;
      const pickedUp = gapBefore >= dropAfter;
      if (d === start && d === finish) cells[d] = 'SWF';
      else if (d === start) cells[d] = 'SW';
      else if (d === finish) cells[d] = 'WF';
      else if (pickedUp) { cells[d] = 'PU'; pickupDays++; }
      else cells[d] = 'W';
      continue;
    }
    const prevWork = work.filter(w => w < d).pop();
    const nextWork = work.find(w => w > d);
    const gapLen = days.filter(x => x > prevWork && x < nextWork).length;
    if (gapLen >= dropAfter) { cells[d] = 'D'; dropDays++; } else { cells[d] = 'H'; holdDays++; }
  }
  return { name, quantity, elementIds, start, finish, cells,
           totalWorkDays: work.length, totalHoldDays: holdDays,
           totalDropDays: dropDays, totalPickupDays: pickupDays };
}).sort((a,b) => a.start - b.start || a.name.localeCompare(b.name));
// totals: { elements, workDays, holdDays, pickupDays, shootDays: days.length }
```

`DoodCalculationService.generateDoodMatrix(projectId, category, {dropAfter})` fetches the scheduled strips + `BreakdownElement where {category, stripId in strips}` + the schedule day→date map, then calls `buildDoodMatrix`. `categoriesInUse` = `groupBy category where strip.shootDay > 0` (always includes CAST for legacy support).

**Legacy cast‑only DOOD** — `SchedulingService.dood()` does the same logic with cast drawn from `strip.cast[]`, `dropAfter` fixed at 4, returning `{days, rows:[{name, codes, start, finish, workDays}]}`. **Rebuild note:** two DOOD implementations coexist; FilmOS should keep only the multi‑category `buildDoodMatrix`.

**Call‑sheet filter:** `ON_SET_CODES = {SW, W, WF, SWF, PU}` — **H and D are excluded** (a pick‑up works). For a calendar date → `shootDayForDate` → each category's DOOD cell for that day, keep only on‑set codes → `requirements:{CAST:[{name,quantity,code}], …}`.

## A.6 Schedule → budget (the globals path)

`DoodCalculationService.refreshGlobalsStaging` runs `generateDoodMatrix` for every category‑in‑use, tallies `{elements, workDays, holdDays}`, takes `shootDays = max` over categories, and **upserts `ProjectGlobalsStaging`** (`shootDays`, `doodTallies`, `status:'DRAFT'`). **It writes only to staging — nothing touches a budget version until the user explicitly pushes staging to a working copy.** Endpoint `POST dood-to-globals`. These staging values also drive calendar anchoring (§A.4). So the chain is:

**strips + breakdown → DOOD matrix → globals staging (`shoot_days`, DOOD tallies) → (user push) → budget globals**, and separately **breakdown elements → budget line items** (PART B).

## A.7 Conflicts, gating & light plan

`conflicts()` computes, per day: `OVER_TARGET` (>6 pages, low severity), `COMPANY_MOVE` (>1 location, medium), `CAST_CLASH` (a cast member needed in >1 place the same day, high), `LOCATION` availability window (against shootStart/shootEnd), `PERMIT` (not APPROVED / expired, high). Plus a **light plan**: for EXT days with geocoded locations it computes sunrise/sunset/golden‑hour/day‑length from `SunPathService.compute(lat,lng,date,240)`. Warnings are ranked high / medium / low.

## A.8 Scheduling reports

| Report | Route | Source | Contents |
|---|---|---|---|
| **DOOD** | `/print/dood/[projectId]?category=&dropAfter=` | `scheduling.doodMatrix` | Landscape matrix, day columns (num + DD/MM), cell‑code coloring, per‑row Work/Hold totals; legend SW/W/WF/SWF/PU/H/D. Cell backgrounds: SW/SWF `#bbf7d0`, W `#f0f0f0`, WF `#bfdbfe`, PU `#99f6e4`, H `#fde68a`, D `#fecaca`. |
| **One‑line schedule** | `/print/oneliner/[projectId]` | `scheduling.shootingSchedule` | Table: Sc# · I/E · D/N · Set/Location & Description · Pgs · Cast; DAY header rows + banner rows; footer "Cast working span (D#–D#)". |
| **Shooting schedule** | `/print/shooting-schedule/[projectId]` | `scheduling.shootingSchedule` | Per‑day blocks: DAY header (date, locations, scene count, pages), banner rows, per‑scene sceneNumber/IE/DN/set/pages/description/cast + **elements by category**. |
| **Stripboard (print)** | `/print/schedule/[projectId]` | — | Opened from the Outputs menu. |
| **Call sheet** | `scheduling.callsheetData` → `/m/call-sheet` | `generateCallSheet` | One date's scenes + on‑set‑only requirements (H/D filtered). |

`shootingSchedule()` payload: `{project, generatedAt, days:[{day, date, dateLabel, locations, banners, scenes:[{sceneNumber,intExt,dayNight,setName,location,description,pages,cast,elements}], pages, sceneCount, cast}], cast:[{name, firstDay, lastDay, workDays}], totalScenes, totalPages, shootDays}`.

## A.9 Scheduling endpoints

`@Controller('production/scheduling')` — guards `@UseGuards(JwtAuthGuard, PermissionsGuard)`, class‑level `@RequirePermission('production', 1)`. Reads = level 1; mutations override to level 2.

| Method | Path | Perm | Purpose |
|---|---|---|---|
| GET | `calendar/:projectId` | 1 | Full production calendar (Prep/Shoot/Wrap/Strike from anchor) |
| GET | `callsheet-data/:projectId?date=&dropAfter=` | 1 | One date's scenes + DOOD‑filtered (SW/W/WF/SWF/PU) requirements |
| GET | `calendar-config/:projectId` | 1 | Get work‑week + holidays |
| PUT | `calendar-config/:projectId` | **2** | Set work‑week + holidays |
| GET | `board/:projectId` | 1 | Board grouped by shoot day |
| GET | `dood/:projectId` | 1 | Legacy cast‑only DOOD |
| GET | `conflicts/:projectId` | 1 | Conflict/gating warnings + light plan |
| GET | `shooting-schedule/:projectId` | 1 | Shooting‑schedule payload (one‑liner + full schedule) |
| GET | `scenarios/:projectId` | 1 | List what‑if scenarios |
| POST | `scenarios/:projectId` | **2** | Snapshot live board → scenario |
| POST | `scenarios/:projectId/optimized` | **2** | Create OPTIMIZED scenario (preview optimizer) |
| POST | `scenarios/:projectId/compare` | 1 | Compare live + selected scenarios (`{ids}`) |
| GET | `scenario/:id` | 1 | Get one scenario |
| PUT | `scenario/:id` | **2** | Rename/update scenario |
| DELETE | `scenario/:id` | **2** | Delete scenario |
| POST | `scenario/:id/apply` | **2** | Apply scenario to live board (auto‑baselines first) |
| GET | `script-strip-status/:projectId` | 1 | Scene↔strip reconciliation status (preview) |
| POST | `script-strip-reconcile/:projectId` | **2** | Reconcile: write `ScriptScene.productionStripId` |
| GET | `dood-matrix/:projectId?category=&dropAfter=` | 1 | Live multi‑category DOOD matrix |
| GET | `dood-categories/:projectId` | 1 | Categories with scheduled elements |
| POST | `dood-to-globals/:projectId` | **2** | Aggregate DOOD tallies → globals **staging** |
| GET | `strips?projectId=` | 1 | List strips |
| POST | `strips` | 1 | Create strip |
| PUT | `strips/:id` | 1 | Update strip |
| POST | `reorder` | 1 | Persist `{items:[{id,shootDay,sortOrder}]}` |
| POST | `auto-schedule/:projectId` | **2** | Auto‑assign unscheduled → days |
| POST | `optimize/:projectId` | **2** | Shooting‑order optimizer (preview or `apply:true`) |
| DELETE | `strips/:id` | 1 | Delete strip |

## A.10 Scheduling frontend — per‑button controls

**`StripboardPanel.tsx`** (main scheduling page) — 3 view tabs: **Stripboard / Day Out of Days / Scenarios**. Header controls:

- **Break down script** (conditional) → `breakdown.breakdownRevision(revisionId)`.
- **Work‑week** → toggles a calendar‑config panel: 7 weekday toggles (Sun–Sat, "· off"), Holidays textarea (YYYY‑MM‑DD per line), **Save calendar** → `scheduling.setCalendarConfig`.
- **Outputs ▾** → Strip board (print) `/print/schedule/:id`, One‑line schedule `/print/oneliner/:id`, Shooting schedule `/print/shooting-schedule/:id`, Day Out of Days (Cast) `/print/dood/:id?category=CAST`.
- **Legacy import ▾** → "Script → full setup (legacy)" (`breakdown.importScriptFull`, prompts pages/day, choice of visual mapping vs auto‑budget) · "Import script (legacy)" (`breakdown.importScript`, replace:true). Accepts `.fdx,.pdf,.docx,.txt,.fountain`.
- **Auto‑schedule** → prompts pages/day → `scheduling.autoSchedule({pagesPerDay, onlyUnscheduled:true})`.
- **Optimize order** → `scheduling.optimize({apply:false})` → preview modal (before/after: Company moves, Cast hold days, D/N switches, Multi‑loc days; "Why this order" rationale; proposed days) → **Apply this order** → `optimize({apply:true})`.
- **Add scene** → form (Scene#, INT/EXT, D/N, Shoot day, Set/location, Location select, Description, Pages step 0.125, Cast comma list) → `scheduling.createStrip`.
- **Refresh** → reload.
- **Per strip:** 🔒 lock toggle (`updateStrip{isLocked}`), 🗑 delete, **day `<select>`** (U/D1..Dn, `moveDay`), drag handle (disabled when locked). **Per day column:** "+ banner" (`createStrip{isBanner,bannerText}`), drop target. **Filters:** Cast / Location / D‑N / Set + Clear.

**`UniversalDoodPanel.tsx`** — Category `<select>` (`doodCategories`→`doodMatrix`), "Drop after" number input (min 2), **Recompute**, **Export this DOOD to CSV** (client‑side), **Print this DOOD** (`/print/dood/:id`), **Refresh Globals** (`scheduling.doodToGlobals`). Cell colors: SW/SWF green‑bold, W gray, WF blue‑bold, PU teal‑bold, H amber, D red. Columns: element name (sticky) · D1..Dn (+date) · Work · Hold.

**`ScheduleScenariosPanel.tsx`** — **Refresh**, **Reconcile now** (`scheduling.reconcileScriptStrips`). Scenarios: **Snapshot board** (`snapshotScenario`), **Optimised variant** (`optimizedScenario`), **Compare** (`compareScenarios`). Per scenario: select checkbox, **Apply** (`applyScenario`), **Rename** (`updateScenario`), **Delete** (`deleteScenario`). Comparison metrics: Shoot days, Company moves, Cast hold days, D/N switches, Multi‑loc days, Scenes, Pages (green = best; "lower is better" for company moves/hold/DN/multi‑loc).

---

# PART B — SCRIPT BREAKDOWN

Breakdown lives in `backend/src/production/breakdown/`. It turns each scene into tagged physical elements, projects the active script revision's scenes onto stripboard rows, and (separately) generates budget line items from the element counts at a default rate card.

## B.1 Data model — `BreakdownElement` — `@@map("breakdown_elements")` (schema ~3432)

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `projectId` / `project` | `String` / relation (Cascade) | |
| `stripId` | `String?` | optional — scene‑owned elements may have no strip until projected |
| `strip` | `ProductionStrip? @relation(onDelete: Cascade)` | |
| `category` | `BreakdownCategory` | enum (20 values, below) |
| `name` | `String` | |
| `quantity` | `Int @default(1)` | |
| `costCenterCode` | `String?` | budget account link |
| `costCenterTitle` | `String?` | |
| `estCost` | `Decimal @db.Decimal(15,2) @default(0)` | |
| `notes` | `String?` | |
| `sceneId` | `String?` | P0 bridge to master `ScriptScene` |
| `scene` | `ScriptScene? @relation("SceneBreakdown", onDelete: SetNull)` | |
| `source` | `String? @default("AI")` | `AI` / `MANUAL` / `MOVIE_MAGIC` — preserved across re‑sync |
| `revisionId` | `String?` | |
| `createdAt` | `DateTime @default(now())` | |
| `castingCalls` | `CastingCall[]` | |
| `characterProfiles` | `CharacterProfile[]` | |

**`enum BreakdownCategory` (schema ~3408) — the 20 element categories (verbatim order):**

`CAST, BACKGROUND, STUNTS, VEHICLES, ANIMALS, ANIMAL_WRANGLER, PROPS, SET_DRESSING, WARDROBE, MAKEUP_HAIR, SFX, MECHANICAL_FX, VFX, SPECIAL_EQUIPMENT, CAMERA, ADDITIONAL_LABOR, SOUND_MUSIC, ART, GREENERY, SECURITY, OTHER`

Category comments worth preserving: `ANIMAL_WRANGLER` = "industry‑standard MMS category"; `MECHANICAL_FX` = "physical built rigs — distinct from pyrotechnic SFX"; `CAMERA` = "camera bodies/lenses/specialty rigs as scheduled elements"; `ADDITIONAL_LABOR` = "day‑player crew, standby labor, swing gang".

**`BreakdownElement.source` values:** `AI`, `MOVIE_MAGIC`, `MANUAL` — governs projection de‑dup priority (a MOVIE_MAGIC baseline is protected).

## B.2 Script → strips (content projection)

`ScriptProjectionService` (`breakdown/script-projection.service.ts`). The **active script revision's `ScriptScene` rows are the master.** `preview()` produces a per‑scene change‑list by matching `scene.productionStripId` first, else by normalized scene number (a single candidate → **ADOPT**): change types `ADD` / `ADOPT` / `UPDATE` / `UNCHANGED` / `LOCKED`, plus `orphanStrips`.

`apply()`:

- **No strip** → create `ProductionStrip` with scene content (`shootDay:0, notes:'Script-projected'`), set `scene.productionStripId`, and re‑point the scene's `BreakdownElement`s onto the new strip (`updateMany where sceneId → stripId`).
- **Locked strip** (and not `overrideLocked`) → link + re‑point elements **only**, `skippedLocked++`.
- **Else** → snapshot `before`, update strip **content only** (never `shootDay`/`sortOrder`), re‑point elements.
- `content()` maps: `sceneNumber, intExt (INT/EXT/INT_EXT), dayNight (DAY/NIGHT/DUSK/DAWN), setName, locationId, description|slugline, pages, cast (from CAST elements)`.
- `dedupStripElements` keeps a `MOVIE_MAGIC`‑sourced element over script/AI duplicates.
- Writes a reversible `ScriptSyncLog` (`diff:{created,updated,adopted,skippedLocked}`).
- Optionally cascades to casting (`createCallsFromBreakdown`) and budget (`budgetFromBreakdown`, **skipped if a Movie Magic budget baseline exists** to avoid double‑count).
- `rollback(logId)` deletes created strips + restores `before` content. `linkSceneToStrip` = manual Movie Magic reconcile (turns an ADD into an ADOPT).

## B.3 Breakdown → budget (line‑item generation)

`BreakdownService.budgetFromBreakdown` / `applyMapping`. `budgetPreview` aggregates element `quantity` by category (CAST counted as distinct uppercased names). Each category maps to a budget account by **title keyword** and gets a **default rate**:

**`CATEGORY_MAP` (keyword → account, `unit`, optional labor `classification`) & `DEFAULT_RATES` (verbatim):**

| Category | unit | classification | default rate | match keywords (first few) |
|---|---|---|---|---|
| CAST | role | PERFORMER | 2500 | cast, principal, performer, actor, lead |
| BACKGROUND | person‑day | BG | 200 | extra, atmosphere, background, crowd |
| STUNTS | day | STUNT | 1200 | stunt |
| VEHICLES | unit | — | 500 | vehicle, picture car, transport |
| ANIMALS | unit | — | 800 | animal, livestock |
| ANIMAL_WRANGLER | day | CREW | 900 | wrangler, animal handler/trainer |
| PROPS | unit | — | 150 | prop |
| SET_DRESSING | unit | — | 300 | set dressing, dressing |
| WARDROBE | unit | — | 250 | wardrobe, costume |
| MAKEUP_HAIR | unit | — | 300 | makeup, hair |
| SFX | unit | — | 1000 | special effect, sfx, pyro |
| MECHANICAL_FX | unit | — | 1200 | mechanical effect/rig, gimbal rig |
| VFX | shot | — | 2000 | visual effect, vfx, post, cgi |
| SPECIAL_EQUIPMENT | unit | — | 800 | special equipment, crane, rigging, steadicam |
| CAMERA | unit | CREW | 1500 | camera, lens, drone |
| ADDITIONAL_LABOR | person‑day | CREW | 600 | additional labor, day player crew, swing gang, grip |
| SOUND_MUSIC | unit | — | 500 | sound, music, playback |
| ART | unit | — | 400 | art department/director, construction |
| GREENERY | unit | — | 300 | greens, greenery, plants |
| SECURITY | day | — | 400 | security, location |
| OTHER | unit | — | 100 | (none) |

Each generated line: `subTitle:'Auto-Breakdown'`, `quantity=qty`, `units=map.unit`, `rate`, `currency` (project or AED), `fringePct:0`, `classificationCode=map.classification`, `origin:'SCRIPT_IMPORT'` (or `'MANUAL_OVERRIDE'` if the user moved the account or changed the rate in `applyMapping`), `aiSuggestedRate`/`aiSuggestedQuantity` archived, `subtotal=fringeAmount+total`, `total=qty*rate`. **Idempotent** — it deletes prior `subTitle:'Auto-Breakdown'` lines first. `pushToBudget` also clears legacy `subTitle:'Breakdown'` lines then delegates. After creation, it recomputes `project.totalBudget` = sum of all line `total`s. `mappingPreview`/`applyMapping` drive the drag‑drop mapping modal (`[{category, accountCode, rate}]`).

**Guard:** `applyMapping` refuses to run when the active budget version's `status === 'LOCKED'`.

## B.4 Breakdown endpoints

`@Controller('production/breakdown')` — same guards, class‑level `@RequirePermission('production', 1)`.

| Method | Path | Perm | Purpose |
|---|---|---|---|
| POST | `import-script/:projectId` | **2** | Import + AI‑breakdown a script → board |
| POST | `import-script-full/:projectId` | **2** | Import + breakdown + auto‑schedule (+ optional budget) |
| POST | `revision/:revisionId/breakdown` | **2** | Run AI breakdown once over a Script‑hub revision (P1 master) |
| GET | `projection/preview/:projectId` | 1 | Script→strips change‑list |
| POST | `projection/apply/:projectId` | **2** | Apply projection (create/adopt/update, re‑point, log) |
| GET | `projection/logs/:projectId` | 1 | Recent sync logs |
| POST | `projection/rollback/:logId` | **2** | Undo a sync |
| POST | `projection/link` | **2** | Manually link scene↔strip (`{sceneId,stripId}`) |
| GET | `strip/:stripId` | 1 | Elements by strip |
| GET | `sheet/:stripId` | 1 | Scene + elements + project (printable sheet) |
| GET | `summary/:projectId` | 1 | Rollup by category + cost center |
| GET | `location-breakdown/:projectId` | 1 | Grouped by location |
| GET | `category-breakdown/:projectId` | 1 | Grouped by category→element |
| GET | `day-rollup/:projectId` | 1 | Per‑day call‑sheet rollup |
| POST | `push-to-budget/:projectId` | 1 | Clear legacy lines + `budgetFromBreakdown` |
| GET | `budget-preview/:projectId` | 1 | Rate card + category quantities |
| GET | `mapping-preview/:projectId` | 1 | DnD mapping data (categories + accounts) |
| POST | `apply-mapping/:projectId` | **2** | Create budget lines from confirmed mapping |
| POST | `budget-generate/:projectId` | **2** | Generate budget lines at rate card |
| POST | `share` | 1 | Share breakdown to project users |
| GET | `shares/:projectId` | 1 | My shares for a project |
| POST | `shares/:id/read` | 1 | Mark share read |
| POST | `` (root) | 1 | Create element |
| PUT | `:id` | 1 | Update element |
| DELETE | `:id` | 1 | Delete element |

## B.5 Breakdown frontend — per‑button controls

**`BreakdownPanel.tsx`** (per‑scene tagging) — scene picker sidebar. Toolbar: **Import script**, **Visual map** (opens the mapping modal), **Quick generate** (`budgetPreview` → rate‑card table → **Create budget lines** `budgetGenerate`), **Push est. costs** (`pushToBudget`), **Refresh**, **Print sheet** (`/print/breakdown/:stripId`). Element form: Category dropdown (20 categories CAST…OTHER), Name, Quantity, Cost‑center dropdown, Est. cost → **Add element** (`breakdown.create`); per‑row delete (`breakdown.remove`).

**`BreakdownMappingModal.tsx`** (breakdown→budget DnD) — left: draggable AI category cards (GripVertical handle, editable rate input, classification badge, "edited" badge, Reset); right: budget account buckets (tier ATL/BTL/POST/OTHER, drop targets, "remove"). Bottom: budget total, **Cancel**, **Create budget lines** → `breakdown.applyMapping(projectId, [{category, accountCode, rate}])`. Native HTML5 drag‑and‑drop.

**`LocationBreakdownPanel.tsx`** — search, Expand/Collapse all, **Share**, **Email**, **PDF report** (`printLocations`). Per location: expand toggle, Google Maps link, **Share** / **Email** / **Call sheet**. Scene table columns: SD, Scene, Set, D/N, I/E, Synopsis, Cast, Pages, Est. Data from `breakdown.locationBreakdown`.

**`BreakdownsTab.tsx`** (breakdown hub) — inner tabs **Scenes / Elements / Locations / By Day**. Each view: search, Expand/Collapse all, **Share** (`breakdown.shareBreakdown`), **Email** (`mail.sendBreakdown`), **Print report / Call sheet** (client print). Element table columns: Element, Qty, Scenes, Shoot days, Cost center, Est. cost. Day table columns: Scene, Set, I/E, D/N, Cast, Pages.

**`ScriptProjectionsPanel.tsx`** (script→everything) — **Refresh**; 10‑color WGA revision wheel (WHITE/BLUE/PINK/YELLOW/GREEN/GOLDENROD/BUFF/SALMON/CHERRY/TAN, `script.setRevisionMeta`); **Lock script** (`script.lockRevision`); **Run AI breakdown** (`breakdown.breakdownRevision`); module status chips (breakdown/schedule/budget/casting synced/drift/none); **Reconcile n scene(s)↔strips** (`scheduling.reconcileScriptStrips`); Sync section: "also refresh budget & casting" checkbox + **Apply sync** (`breakdown.projectionApply({createBudget,createCasting})`); orphan‑strip link dropdowns (`breakdown.projectionLink`); sync logs with **undo** (`breakdown.projectionRollback`).

---

# PART C — BUDGETING

Budget lives in `backend/src/production/budget/`. The chart‑of‑accounts hierarchy is **BudgetVersion → BudgetSection (category) → BudgetAccount (cost center) → BudgetLineItem.** Attached to a version: `BudgetGlobal[]`, `FringeProfile[]`, `BudgetLifecycleLog[]`. Project‑scoped (not version‑scoped): `BudgetTransfer`, `Overage`.

**Rebuild note (critical):** the **entire budget controller requires `production:2`** — even its reads. There is **no "budget type" field**; a version's role is expressed purely by `status` + `isActive` + `parentVersionId`.

## C.1 Data model (verbatim)

### `BudgetVersion` — `@@map("budget_versions")` (schema ~4471)

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `projectId` | `String` | |
| `project` | `ProductionProject` relation | `onDelete: Cascade` |
| `versionName` | `String` | e.g. "Budget V1", "Working Copy — June Update" |
| `status` | `BudgetVersionStatus @default(DRAFT)` | |
| `isActive` | `Boolean @default(false)` | only one active per project |
| `notes` | `String?` | |
| `lockedAt` | `DateTime?` | set when status→LOCKED |
| `versionSequence` | `Int @default(0)` | sequential V‑number, assigned on submit‑to‑REVIEW |
| `parentVersionId` | `String?` | baseline a WORKING copy branched from |
| `parentVersion` | `BudgetVersion? @relation("VersionBranching")` | self‑relation |
| `childVersions` | `BudgetVersion[] @relation("VersionBranching")` | |
| `createdAt` / `updatedAt` | `DateTime` | |
| `globals` | `BudgetGlobal[]` | |
| `sections` | `BudgetSection[]` | |
| `fringes` | `FringeProfile[]` | |
| `lifecycleLogs` | `BudgetLifecycleLog[]` | |
| index | `@@index([projectId])` | |

### `BudgetSection` — `@@map("budget_sections")` (~4546) — the category tier

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `budgetVersionId` | `String` | |
| `budgetVersion` | relation | `onDelete: Cascade` |
| `code` | `String` | "1000", "2000" |
| `title` | `String` | "Above The Line", "Production" |
| `tier` | `String?` | `ATL | BTL | POST | OTHER` |
| `sortOrder` | `Int @default(0)` | |
| `color` | `String?` | UI color |
| `accounts` | `BudgetAccount[]` | |

### `BudgetAccount` — `@@map("budget_accounts")` (~4561) — the cost center

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `sectionId` | `String` | |
| `section` | relation | `onDelete: Cascade` |
| `code` | `String` | "1100", "2100" |
| `title` | `String` | "Director", "Camera Department" |
| `sortOrder` | `Int @default(0)` | |
| `etcAmount` | `Decimal? @db.Decimal(15,2)` | manual Estimate‑To‑Complete override |
| `lineItems` | `BudgetLineItem[]` | |

### `BudgetLineItem` — `@@map("budget_line_items")` (~4575)

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `accountId` | `String` | |
| `account` | relation | `onDelete: Cascade` |
| `sortOrder` | `Int @default(0)` | |
| `code` | `String?` | sub‑account code e.g. "1210" |
| `subTitle` | `String?` | sub‑account title e.g. "LINE PRODUCER"; also a provenance tag `'Auto-Breakdown'` |
| `description` | `String` | required |
| `quantityFormula` | `String?` | e.g. `"shoot_days + prep_days"` — references globals |
| `quantity` | `Decimal @db.Decimal(10,3) @default(1)` | resolved value |
| `units` | `String?` | "days","weeks","hours","units","lump" |
| `rate` | `Decimal @db.Decimal(15,2) @default(0)` | |
| `currency` | `Currency @default(AED)` | |
| `exchangeRate` | `Decimal @db.Decimal(10,4) @default(1)` | |
| `fringeProfileId` | `String?` | link to FringeProfile |
| `fringePct` | `Decimal @db.Decimal(5,2) @default(0)` | |
| `classificationCode` | `String?` | e.g. "PERFORMER","IATSE-LOCAL-600","DIRECTOR" — drives labor burden |
| `fringeDetail` | `Json?` | computed per‑rule burden breakdown `[{rateRuleId, rateType, label, amount}]` |
| `castTalentId` | `String?` | cast performer link → auto‑sets `classificationCode='PERFORMER'` from their union |
| `castTalent` | `GlobalTalentProfile? @relation("BudgetLineCastTalent")` | |
| `crewMemberId` | `String?` | Crew Directory (freelancer) link for rate‑card auto‑fill + assignee |
| `stages` | `Json?` | labour stage breakdown `[{ stage:'PREP'|'SHOOT'|'WRAP'|'POST', qty, unit, rate, amount }]` |
| `origin` | `LineItemOrigin @default(MANUAL)` | provenance |
| `aiSuggestedRate` | `Decimal? @db.Decimal(15,2)` | preserved when a human overrides |
| `aiSuggestedQuantity` | `Decimal? @db.Decimal(10,3)` | preserved when a human overrides |
| `subtotal` | `Decimal @db.Decimal(15,2) @default(0)` | comment: `qty * rate / exchangeRate` |
| `fringeAmount` | `Decimal @db.Decimal(15,2) @default(0)` | comment: `subtotal * fringePct/100` |
| `total` | `Decimal @db.Decimal(15,2) @default(0)` | comment: `subtotal + fringeAmount` |
| `notes` | `String?` | |
| `isDraft` | `Boolean @default(false)` | SYS‑13 D9 — prop→draft budget line bridge |
| `sourceAnnotationId` | `String?` | staged from a script TAG annotation |
| `contracts` | `ProjectContract[]` | |

### `FringeProfile` — `@@map("fringe_profiles")` (~4535) — simple named percentage

`id, budgetVersionId, budgetVersion (Cascade), name ("UAE Crew","Freelance"), percentage Decimal(5,2) (e.g. 18.00), description?`.

### `BudgetGlobal` — `@@map("budget_globals")` (~4522) — formula variables

`id, budgetVersionId, budgetVersion (Cascade), key ("shoot_days","prep_weeks" — used as a formula variable), label ("Shoot Days"), value Decimal(10,3), unit? ("days","weeks")`, unique `@@unique([budgetVersionId, key])`.

### `BudgetLifecycleLog` — `@@map("budget_lifecycle_logs")` (~4501) — audit trail

`id, projectId (Cascade), budgetVersionId (Cascade), fromStatus, toStatus, versionNameSnap (name at that moment, e.g. "Budget V3"), changedById?, changedByRole? (crew or system role at time of change), notes?, createdAt`, indexes on `projectId` and `budgetVersionId`.

### `BudgetTransfer` — `@@map("budget_transfers")` (~4134) — reallocation; net zero on grand total

`id, projectId (Cascade), fromCode (donor account code), fromTitle?, toCode (recipient), toTitle?, amount Decimal(15,2), reason?, date, status TransferStatus @default(PENDING), createdById?, approvedById?, approvedAt?, createdAt`, index `projectId`.

### `Overage` — `@@map("overages")` (~4108) — approved budget change / overspend

`id, projectId (Cascade), accountCode?, accountTitle?, description (required), amount Decimal(15,2), reason?, status OverageStatus @default(PENDING), requestedById?, approvedById?, approvedAt?, notes?, createdAt/updatedAt`, index `projectId`.

### Related fields on `ProductionProject`

`shootStartDate DateTime?`, `shootEndDate DateTime?`, `currency Currency @default(AED)`, `totalBudget Decimal? @db.Decimal(15,2)` (comment: "computed from active budget version").

## C.2 Budget states / enums (verbatim)

### `enum BudgetVersionStatus` (schema ~1497) — the lifecycle stage

```
DRAFT    // initial compilation stage
REVIEW   // V1, V2… submitted for approval
APPROVED // validated by Producer/Client
LOCKED   // frozen historical baseline (enforced read-only)
WORKING  // active working copy branched from a locked baseline
```

**Rebuild note:** the requested "DRAFT/WORKING/LOCKED/APPROVED" model is close but the actual enum adds **REVIEW** and treats **WORKING** as the *branch* state (a working copy off a locked baseline), not a pre‑approval draft.

### `enum LineItemOrigin` (schema ~4630) — line provenance

```
MANUAL              // typed by a user
AI_GENERATED        // produced by an AI assistant
SCRIPT_IMPORT       // pulled from an imported script / breakdown generator
SCRIPT_TAG          // staged from a script prop/tag annotation (SYS-13 D9)
AUTO_BREAKDOWN      // generated from the scene breakdown
MANUAL_OVERRIDE     // started as AI/import, then a human changed it (original kept in aiSuggested* fields)
MOVIE_MAGIC_IMPORT  // imported from a Movie Magic Budgeting (.mmb/.xml/.csv) file
```

### `enum TransferStatus` / `enum OverageStatus`

Both: `PENDING`, `APPROVED`, `REJECTED`.

### Tier codes (string `tier` on BudgetSection, computed by `tierOf()`)

`ATL` (code starts "1"), `BTL` (starts "2"), `POST` (starts "3"), else `OTHER`. **Bug to preserve/reconcile:** the **backend** `tierOf` (service ~104) is 1→ATL, 2→BTL, 3→POST, else OTHER, while the **frontend** `tierOf` (page.tsx ~54) is 1→ATL, **2/3/4→BTL, 5→POST**, else OTHER. FilmOS should pick one canonical tier map.

## C.3 Versions

- **Create** (`createVersion`): `POST versions` with `{projectId, versionName, notes?}` → status `DRAFT`, `isActive:false`, **no sections seeded** (starts empty).
- **Active version** = the one with `isActive:true`. `setActiveVersion` runs an atomic `$transaction`: `updateMany` all versions to `isActive:false`, then set the target `true` (so the project is never left with no active budget). Only the **active** version's grand total is written back to `ProductionProject.totalBudget` (`updateProjectTotal`). Frontend loads `budgetVersions.find(v => v.isActive) || budgetVersions[0]`.
- **Version number scheme:** `versionSequence` (Int, default 0). Assigned **only** on transition **to REVIEW** — `_max(versionSequence) for project + 1`; the version is also **renamed** `Budget V${seq}` at that moment. So V‑numbers are sequential per project and exist only once submitted for review.
- **Duplicate / working copy** (`cloneVersion`): deep‑copy into a **new WORKING version.** Clones globals, fringes, all sections→accounts→line items **including provenance** (`origin`, `aiSuggested*`, `stages`, `fringeDetail`, `subtotal/fringeAmount/total` copied verbatim); `fringeProfileId` on each line is **remapped** through an old→new fringe id map. New version: `status:'WORKING'`, `isActive:false`, `parentVersionId = src.id`, name = provided or `"${src.versionName} (Working Copy)"`. Writes a lifecycle log `src.status → WORKING` with role `'BRANCH'`. UI convention: after cloning, immediately `activateVersion(newId)`.
- **Compare** (`topsheetComparison`): dual‑column per‑section **Locked Baseline vs Current Working** with variance. Baseline resolution order: explicit `baselineId` → most‑recent `LOCKED` (by `lockedAt||createdAt`) → any `APPROVED` → null. Working resolution: explicit `workingId` → `isActive` version → any `WORKING` → null. `variance = baseline − working` (**negative ⇒ working is OVER baseline**). Returns `topsheetGrid[]` (per section code), `grandTotals {baseline, working, variance}`, `baseCurrency`, and the full `versions[]` list.

## C.4 Locking & lifecycle state machine

### Transition table (service `TRANSITIONS`)

```
DRAFT    → [REVIEW]
REVIEW   → [APPROVED, DRAFT]      // approve, or send back for changes
APPROVED → [LOCKED, REVIEW]      // freeze as baseline, or reopen review
LOCKED   → []                    // immutable — branch via Create Working Copy
WORKING  → [REVIEW, LOCKED]      // resubmit as next V, or direct legacy lock
```

### Two lock paths (they differ — preserve or unify deliberately)

1. **`executeStatusTransition`** — `PATCH versions/:id/status {toStatus, notes?}`. Validated against the table; on `→REVIEW` assigns the V‑number + renames; on `→LOCKED` sets `lockedAt` **and** calls `anchorProjectDates`. Always writes a `BudgetLifecycleLog`.
2. **`lockVersion`** — `PATCH versions/:id/lock` (legacy direct lock). Sets `status:'LOCKED'`, `lockedAt:now`, logs with role `'DIRECT_LOCK'`, note "Locked as baseline". **Does not run the transition‑validation table** and does **not** anchor dates. This is the button wired into the budget‑tab header.

### WHO can transition (RBAC, in `executeStatusTransition`)

- **System roles** (bypass): `SYSTEM_ADMIN`, `FINANCE_MANAGER` (matched against `req.user.role`, uppercased).
- Otherwise look up `productionCrew` for `{projectId, userId}`; allowed crew roles: `EXECUTIVE_PRODUCER`, `PRODUCER`, `LINE_PRODUCER`.
- Else → `ForbiddenException('Administrative authority required… (Executive Producer, Producer or Line Producer).')`.
- **Note:** the plain `lockVersion` path does **not** enforce these roles in the service (guarded only by the controller's `production:2`).

### What happens after LOCK

- **No physical snapshot/copy is made.** The version stays in place; `status='LOCKED'` makes it **enforced read‑only.** Every mutating service method (`createSection`, `updateSection`, `createAccount`, `updateAccount`, `createLineItem`, `updateLineItem`, `deleteLineItem`) checks `status==='LOCKED'` and throws `BadRequestException('This budget version is locked and read-only. Create a working copy to make changes, or move budget between lines via an approved transfer.')`. **Globals & fringe profiles are NOT lock‑guarded** — they can technically still be edited on a locked version (bug to fix in rebuild).
- **Calendar anchor on lock** (`anchorProjectDates`, only via `executeStatusTransition`): reads the `shoot_days` global from this version; `anchor = project.shootStartDate || project.startDate`; sets `project.shootEndDate = anchor + shoot_days − 1` (Day 1 = anchor). Wrapped in try/catch so anchoring never blocks the lock.
- **Accounting binding:** accounting does **not** bind to the locked version by id. Budget‑vs‑Actual and the Cost Report match **actuals to `account.code`** and layer approved `Overage` + approved `BudgetTransfer` on top. So the **code structure is the contract, not a frozen row‑snapshot.**
- **Unlock:** there is **no unlock.** `LOCKED → []`. The only way forward is **Create Working Copy** (branch) or an approved **Transfer.**

### `BudgetLifecycleLog` audit trail

Written by private `logLifecycle` on every transition, clone (role `BRANCH`), and direct lock (role `DIRECT_LOCK`); a `.catch()` swallows errors so the audit write never blocks the transition. `lifecycleHistory` → `GET lifecycle/:projectId`, newest first, `take: 100`.

## C.5 Line‑item calculations (verbatim formulas)

**Quantity resolution** (createLineItem / updateLineItem):

- If `quantityFormula` present → `qty = evaluateFormula(formula, globals)`.
- Else → `qty = data.quantity ?? 1`.

**Formula engine** (`evaluateFormula`): a hand‑written safe arithmetic parser (`tokenise` + recursive‑descent `Parser`). Supports `+ − * / ( )`, numeric literals, and identifiers substituted from the globals map. Division by zero → `0`. Unknown variable → `0`. Result clamped: `isFinite ? Math.max(0, result) : 0` (**no negative line quantities**). Errors → `0`.

**Subtotal:**

```
stageSub = stages present ? Σ(stage.qty × stage.rate) : null
subtotal = stageSub != null ? stageSub : (qty × rate) / exchangeRate
```

i.e. a **labour‑stage breakdown overrides** the qty×rate calc when `stages[]` is non‑empty; otherwise `subtotal = qty × rate ÷ exchangeRate` (FX‑normalized into base currency).

**Fringe amount & total:**

```
fringePct    = data.fringePct ?? 0     (overridden by FringeProfile.percentage if fringeProfileId set)
fringeAmount = subtotal × (fringePct / 100)
total        = subtotal + fringeAmount
```

**Roll‑ups (computed on read, NOT stored on section/account):**

- Account total = `Σ lineItems.total`
- Section total = `Σ account totals`
- Grand total = `Σ section totals` = `Σ all line totals` (written to `totalBudget` when the version is active)
- **Tier totals** (budget tab): ATL / BTL / POST / OTHER accumulated by section tier; displays *Total Above‑The‑Line*, *Total Below‑The‑Line*, *Total Above+Below*, *Grand Total*.

**Recalculation** (`recalculateVersion`): iterates every line **with a `quantityFormula`**, re‑evaluates qty against current globals, recomputes `subtotal/fringeAmount/total`, persists. Non‑formula lines are skipped. Triggered by `POST versions/:id/recalculate`, and automatically inside `upsertGlobal` / `deleteGlobal` (so editing a global cascades). `updateProjectTotal` then writes `totalBudget` if the version is active.

**Contingency / overhead / global adjustments:** there is **no dedicated contingency or overhead field.** Overhead/contingency is modeled as (a) an ordinary **FringeProfile** percentage per line, (b) an ordinary line item, or (c) a **BudgetGlobal** referenced in a formula. `BudgetGlobal` values feed only into formula evaluation (they are counts/quantities, not money multipliers). The UI labels the fringe‑profiles table "Fringe / **Overhead** Profiles."

## C.6 Fringes (two coordinated layers)

### Layer A — simple `FringeProfile` percentage (inside the budget module)

- **Create:** `POST versions/:id/fringes {name, percentage, description?}`.
- **Update / delete:** `PUT fringes/:id`, `DELETE fringes/:id`. Neither is lock‑guarded.
- **Assignment to a line:** the line carries `fringeProfileId` and/or a raw `fringePct`. On create/update, if `fringeProfileId` resolves to a profile, `fringePct = Number(profile.percentage)` (the profile's % **overrides** any typed value). If no profile, the typed `fringePct` is used directly.
- **How it adds to cost:** percentage only (`fringeAmount = subtotal × fringePct/100`), folded into `total`. **No flat/cap support** in this layer — `Decimal(5,2)` percentage exclusively.
- **Roll‑up:** because `fringeAmount` is inside each line's `total`, fringes automatically roll into account subtotals, section subtotals, tier totals, and the grand total.
- **Across stages:** `fringePct`/`subtotal`/`fringeAmount`/`total` are copied verbatim on `cloneVersion`, `fringeProfileId` remapped. On a LOCKED version, lines can't be edited (so fringes are frozen with the line). `recalculateVersion` recomputes fringeAmount from the stored `fringePct` for formula lines only.
- **Auto‑classification hook:** setting `castTalentId` on a line calls `classificationForTalent` → walks `GlobalTalentProfile.laborBody.agreements.classifications.code`; if it includes `'PERFORMER'` uses that, else the first code; null if no union. This sets `classificationCode` (feeds Layer B), **not** `fringePct`.

### Layer B — labor / union employer‑burden engine (see PART E)

The `BudgetLineItem.classificationCode` + `fringeDetail` JSON fields belong to a **second, richer** fringe engine outside `budget.service.ts` (endpoints under `/labor/...` and `/accounting/post-burden/...`). FilmOS should treat fringes as **two coordinated mechanisms** — a lightweight per‑line % here, and a classification‑driven statutory burden engine (PART E) that writes `fringeDetail` and can post accruals to the GL.

## C.7 Transfers

- **Model:** `BudgetTransfer` is **project‑scoped**, keyed by account **codes** (`fromCode`/`toCode`), not IDs or version IDs. Comment: "Net effect on the grand total is zero; it reshapes the working budget per account."
- **Not in budget.controller** — handled by the **costing** controller: `GET /production/costing/transfers?projectId`, `POST /production/costing/transfers`, `PATCH /production/costing/transfers/:id/status {status}`, `DELETE /production/costing/transfers/:id`.
- **UI** (CostReportPanel): a "Budget move" form captures `{fromCode, toCode, amount, reason}` → `createTransfer`. Each pending transfer shows **Approve** / **Reject** / **Delete**. Approve/reject requires project capability `('transfers','approve')` and stamps `approvedById/approvedAt`.
- **Creation** validates amount>0, from≠to, and that both codes exist in the ACTIVE version's accounts; snapshots titles. Created `PENDING`.
- **Effect on totals:** only `status:'APPROVED'` transfers count. For each: `transferByCode[fromCode] -= amount`, `transferByCode[toCode] += amount`. Then per account `revisedBudget = budget + transfer + approvedChange`. Because from/to net out, **grand revised = grand budget** (transfers don't change the total; overages do).

## C.8 Budget endpoints

Controller header (verbatim):

```ts
@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 2)          // 'edit' — even reads require edit
@Controller('production/budget')
```

| Method | Full path | Service → purpose |
|---|---|---|
| GET | `/production/budget/versions/:versionId` | `getVersion` — full version tree (globals, fringes, sections→accounts→lineItems, sorted) |
| POST | `/production/budget/versions` | `createVersion` — new DRAFT version |
| PATCH | `/production/budget/versions/:versionId/activate` | `setActiveVersion` — make active (atomic) |
| PATCH | `/production/budget/versions/:versionId/lock` | `lockVersion` — direct legacy lock → LOCKED + lockedAt + audit |
| PATCH | `/production/budget/versions/:versionId/status` | `executeStatusTransition` — validated, role‑gated transition + audit + V‑numbering + date anchor |
| GET | `/production/budget/topsheet-comparison/:projectId?baselineId&workingId` | `topsheetComparison` — baseline vs working + variance |
| GET | `/production/budget/lifecycle/:projectId` | `lifecycleHistory` — audit trail, newest 100 |
| POST | `/production/budget/versions/:versionId/clone` | `cloneVersion` — deep‑copy → new WORKING version |
| GET | `/production/budget/versions/:versionId/topsheet` | `getTopSheet` — section/account roll‑up + grandTotal |
| GET | `/production/budget/versions/:versionId/budget-vs-actual` | `getBudgetVsActual` — budget vs committed actuals + revised (transfers+overages) |
| POST | `/production/budget/versions/:versionId/recalculate` | `recalculateVersion` — re‑evaluate formula lines vs current globals |
| POST | `/production/budget/versions/:versionId/globals` | `upsertGlobal` — upsert (unique by version+key) → triggers recalc |
| DELETE | `/production/budget/globals/:globalId` | `deleteGlobal` → triggers recalc |
| POST | `/production/budget/versions/:versionId/fringes` | `createFringe` |
| PUT | `/production/budget/fringes/:fringeId` | `updateFringe` |
| DELETE | `/production/budget/fringes/:fringeId` | `deleteFringe` |
| POST | `/production/budget/versions/:versionId/sections` | `createSection` — tier auto‑derived; lock‑guarded |
| PUT | `/production/budget/sections/:sectionId` | `updateSection` — lock‑guarded |
| POST | `/production/budget/sections/:sectionId/accounts` | `createAccount` — lock‑guarded |
| PUT | `/production/budget/accounts/:accountId` | `updateAccount` — lock‑guarded |
| POST | `/production/budget/accounts/:accountId/items` | `createLineItem` — resolves formula/fringe/classification/cast; lock‑guarded |
| PUT | `/production/budget/items/:itemId` | `updateLineItem` — recompute + provenance override; lock‑guarded |
| DELETE | `/production/budget/items/:itemId` | `deleteLineItem` — lock‑guarded |

Related (other controllers): transfers under `/production/costing/transfers*`; labor fringe under `/labor/budget/:versionId/{apply-fringes,fringe-detail}`; burden posting `/accounting/post-burden/:versionId`; fringe report `/production/reports/fringe-detail/:projectId`.

## C.9 Budget frontend — the tabbed workspace

The budget experience is a **tab group inside `production/projects/[id]/page.tsx`** (there is no standalone budget page). The **"Budget" tab group** has sub‑tabs **budget · topsheet · fringe · incentives**; related money tabs under **"Account"** are actual · costreport · purchasing · accounting · cash; **globals** is a reachable tab. The active version is loaded once on mount and shared across tabs.

### Header cluster (money tabs) — per‑button

| Button | Action / API |
|---|---|
| Version name + status chip | display; chip red if LOCKED, green otherwise |
| **Lock** (when status ≠ LOCKED) | `confirm(...)` → `budget.lockVersion(activeVersion.id)` → reload (uses the weaker `…/lock` path) |
| **Working copy** (when LOCKED) | `prompt` name → `budget.cloneVersion(id, name)` → `budget.activateVersion(r.data.id)` → reload |
| **Recalculate** (↻) | `budget.recalculate(id)` → reload |
| **Export CSV** | client‑side CSV: Section Code/Section/Cost Center/CC Title/Sub‑Account/Sub‑Account Title/Description/Qty/Units/Rate/Fringe %/Subtotal/Total + GRAND TOTAL row; downloads `${projectNumber}-${versionName}-budget.csv` |
| **Print / PDF** (🖨) | `window.open('/print/budget/'+id)` |

### Budget tab (spreadsheet) — per control

- **Detailed lines: ON/OFF** toggle (localStorage `tfm_budget_detailed`) — expands labour‑stage sub‑rows.
- Locked banner when `status==='LOCKED'` (amber; "create a working copy… approved transfer in the Cost Report").
- Per **section** (collapsible): `code — title`, tier badge, section total.
- Per **account** ("CC" badge): `code · title`, account total, **+ Add item** (only when not LOCKED).
- **Line row:** Code · Description (+ crew‑name chip, classificationCode chip, origin badge [AI/Script/Breakdown/Edited], stage summary) · Qty (purple + `f(x)` if formula) · Units · Rate · Subtotal · Fringe % · Total. Hover actions (non‑LOCKED): **Stages** (opens `LaborBlockEditor` modal for prep/shoot/wrap stages), **Edit**, **Delete** (confirm → `budget.deleteItem`).
- **Edit row (inline):** editable Description, ClassificationSelect (tier‑grouped from labor snapshot), CrewSelect (offers to pull daily rate), TalentSelect (auto‑union fringe), Qty/Formula, Units (`days/weeks/hours/units/lump/shoot days`), Rate, Fringe %; **Save** → `budget.updateItem`, **Cancel**.
- **Add‑item form:** Description, Qty‑or‑Formula (auto‑detects numeric vs formula), Units, Rate, Fringe %, Fringe Profile dropdown (of `fringes`), Labor Classification, Assign crew + Cast talent, clickable **globals hint** chips that append to the formula; **Add Line Item** → `budget.createItem`. Empty required fields (description/rate) abort silently.
- **Budget Totals** card: Total Above‑The‑Line, Total Below‑The‑Line, Total Above+Below, **Grand Total** (amber).

### Top Sheet tab (`TopsheetComparisonPanel`)

- **Baseline version** + **Working copy** selectors → refetch comparison.
- Status‑driven, server‑role‑gated action buttons: DRAFT|WORKING → **Submit for review** (`transitionStatus 'REVIEW'`, prompts notes); REVIEW → **Approve** (`'APPROVED'`) / **Send back to draft** (`'DRAFT'`); APPROVED → **Lock as baseline** (`'LOCKED'`); LOCKED → **Create working copy** (clone + activate). **Print** (`/print/topsheet/:id`), **Refresh**.
- Dual‑column grid: Code · Department/Section · Locked Baseline · Current Working · Variance (red if working over baseline). GRAND TOTALS row. Footer: "Variance = Baseline − Working."
- **Change history:** renders the `BudgetLifecycleLog` list (timestamp, from→to chips, versionNameSnap, changedByRole, notes).

### Budget vs Actual tab

- **Refresh** → `budget.budgetVsActual(id)`. Summary tiles: Budget (revised), Actual (committed), Variance, Spent %. Table per section/account: Orig Budget · Revised (tooltip: Transfers + Approved overages) · Actual · Variance · Used% progress bar (green / amber ≥85% / red over). "Untagged / unmatched expenses" card lists actuals with no matching account code.

### Fringe tab (`FringeDetailPanel`) — buttons **Apply fringes**, **Post burden to GL**, **Print/PDF**, **Refresh** (see PART E).

### Globals tab

- **Add Global** → form {Key, Label, Value, Unit(`days/weeks/hours/people/—`)} → `budget.upsertGlobal` (key lowercased, spaces→`_`). Table lists globals; **Value** editable inline (onBlur → `upsertGlobal`); **delete**. Read‑only **Fringe / Overhead Profiles** table (name, %, description) below.

### Print/export surfaces

`/print/budget/[versionId]` and `/print/fringe/[versionId]` pages exist; CSV export is client‑side.

---

# PART D — COST CONTROL / ACCOUNTING

Cost control lives in `backend/src/production/costing/`, `ledger/`, `gl/`, `overages/`. The primary interactive UI is `frontend/src/components/production/CostReportPanel.tsx` (mounted inside project tabs); the print view is `frontend/src/app/print/costreport/[projectId]/page.tsx`. The shared header band is `FinanceSummaryStrip.tsx`.

**The locked budget copy is the accounting baseline.** `costReport()` reads the budget from **the single `isActive` budget version only** (`budgetVersions: { where: { isActive: true } }`). The budget number per account is computed live from that version's `BudgetLineItem` rows; the cost report never stores its own budget except in snapshots. Module constants used throughout:

```ts
const OPEN_PO          = ['APPROVED', 'PARTIALLY_INVOICED'];        // committed
const COST_ACTUAL      = ['APPROVED', 'PAID'];                       // recognized actual
const INCOME_RECOGNISED = ['INVOICED','RECEIVED','PAID','APPROVED'];
```

## D.1 The cost report — `costReport(projectId)`

Loads the active version → sections → accounts → lineItems `{ total, subtotal, fringeAmount }`, then builds four pre‑aggregation maps keyed by cost‑center code:

- **committedByCode** — over open POs (`status ∈ OPEN_PO`): `+= Number(p.total) - Number(p.invoicedAmount)`
- **actualByCode** — over COST transactions (`status ∈ COST_ACTUAL`): `+= Number(c.total)`
- **approvedByCode** — over `Overage` with `status='APPROVED'`: `+= Number(o.amount)`
- **transferByCode** — over `BudgetTransfer` with `status='APPROVED'`: `fromCode -= amount`, `toCode += amount`

**Per‑account row (verbatim):**

```ts
const budget  = a.lineItems.reduce((t,i)=> t + Number(i.total), 0);       // fringe-inclusive
const fringe  = a.lineItems.reduce((t,i)=> t + Number(i.fringeAmount), 0);
const wages   = a.lineItems.reduce((t,i)=> t + Number(i.subtotal), 0);    // pre-fringe
const committed = committedByCode[a.code] || 0;
const actual    = actualByCode[a.code]    || 0;
const transfer  = transferByCode[a.code]  || 0;
const approvedChange = approvedByCode[a.code] || 0;
const revisedBudget  = budget + transfer + approvedChange;
const etc = a.etcAmount != null ? Number(a.etcAmount) : committed;
const efc = actual + etc;
const variance = revisedBudget - efc;
return { accountId, code, title,
  budget, wages, fringe, transfer, approvedChange, revisedBudget,
  committed, actual, etc, efc, variance,
  overspent: variance < -0.01, etcManual: a.etcAmount != null };
```

**Section rollup:** `roll(k)` sums the account field `k`; section carries `{ code, title, color, accounts, budget, transfer, approvedChange, revisedBudget, fringe, committed, actual, efc, variance }`.

**`totals` shape (VERBATIM — 9 keys, note: NO `etc`, NO `wages`, NO cash):**

```ts
{ budget, transfer, approvedChange, revisedBudget, fringe, committed, actual, efc, variance }
```

**Return:** `{ projectId, currency, versionName, sections, totals, locations }`, where `locations` is an additive, read‑only location‑spend rollup explicitly NOT part of the EFC reconciliation.

## D.2 Actuals — `ProjectTransaction` (schema ~3586, `project_transactions`)

Fields: `id, projectId, kind (ProjectTxnKind), date, accountCode, accountTitle, category, description, party, reference, amount Decimal(15,2), taxAmount Decimal(15,2), total Decimal(15,2), currency, status (ProjectTxnStatus), createdById, invoiceNumber, vendorId, dueDate, paidDate, paidAmount, paidById (SoD audit), approvedById (audit), journalEntryId (GL bridge)` + ZATCA/Jordan e‑invoicing fields. Indexed on `projectId` and `accountCode`.

- **`ProjectTxnKind`** = `INCOME | COST | SALES_REVENUE (7000‑series distribution income) | CORPORATE_OVERHEAD (9000‑series studio cost)`
- **`ProjectTxnStatus`** = `DRAFT | APPROVED | INVOICED | PAID | RECEIVED | VOID`

**Transaction → budget account mapping:** by string `accountCode` (== `BudgetAccount.code` == PO `costCenterCode`). No FK. `total = amount + taxAmount` is what the cost report sums (tax‑inclusive actuals). Uncoded costs bucket to `'__none__'` / `'__uncoded__'`.

**Actual recognition:** a COST counts as actual only when `status ∈ {APPROVED, PAID}`. The report sums those `total`s by `accountCode` against the active‑version‑derived `revisedBudget`. DRAFT costs (e.g. OCR'd invoices) never hit actuals. Costs are created by: manual ledger create, `invoicePo` (APPROVED), petty‑cash SPEND (PAID), OCR upload (DRAFT).

## D.3 Committed costs — `PurchaseOrder` (schema ~3973, `purchase_orders`)

Fields: `id, projectId, poNumber @unique, vendorId, vendorName, costCenterCode (budget account code), costCenterTitle, budgetLineItemId (line‑level commitment binding), description, date, expectedDate, amount, taxAmount, total, invoicedAmount, currency, status (PurchaseOrderStatus), notes, createdById` + ZATCA + one‑to‑one back‑links (`itinerary`, `contract`, `transportVehicle`).

- **`PurchaseOrderStatus`** = `DRAFT | SUBMITTED | REJECTED | APPROVED | PARTIALLY_INVOICED | CLOSED | CANCELLED`

**Committed formula (VERBATIM):** `committed = Σ (PO.total − PO.invoicedAmount)` over POs with status APPROVED or PARTIALLY_INVOICED, grouped by `costCenterCode`. Draft/submitted/rejected/closed/cancelled POs contribute nothing. `total = amount + taxAmount`.

**Invoicing a PO (`invoicePo`):** validates remaining = `total − invoicedAmount`, requires a vendor invoice number, period‑guards the invoice date, creates a `ProjectTransaction {kind:'COST', status:'APPROVED', accountCode:po.costCenterCode, total:amount, reference:po.poNumber}` (commitment → actual), bumps `invoicedAmount`, and sets PO status `CLOSED` when `invoiced >= total-0.01` else `PARTIALLY_INVOICED`. So invoicing simultaneously drops committed and raises actual. **PO approval gate:** setting status `APPROVED` requires project capability `('po','approve')`.

## D.4 EFC / ETC / Variance / Utilization (exact)

**EFC (per account, VERBATIM):**

```ts
const etc = a.etcAmount != null ? Number(a.etcAmount) : committed;
const efc = actual + etc;
```

So **EFC = actual + ETC**, where **ETC = the manual override (`BudgetAccount.etcAmount`) if set, else the remaining open commitments (`committed`).** It is NOT `actual + committed + remaining‑budget` — there is no cost‑to‑complete drawn from the budget. When there is no manual ETC and no open POs, `ETC = 0` and `EFC = actual`. Frontend hint: "EFC = Actual + ETC. ETC = your Estimate to Complete (blank = remaining PO commitments)". Manual ETC is set via `PATCH accounts/:accountId/etc`.

**Schedule/burn forecast variant (`forecast`)** — an auto‑projected ETC layered on top:

```ts
const projEtc = (actual, committed, etcManual, etc) => {
  if (etcManual) return etc;                                     // manual wins
  const burnRemaining = pct >= 0.02 ? Math.max(0, actual/pct - actual) : 0;
  return Math.max(committed, burnRemaining);                     // never below commitments
};
forecastEfc = actual + projEtc;  forecastVariance = revisedBudget - forecastEfc;
```

`pct = elapsed shoot days / total shoot days` (from call sheets, fallback ProductionStrips). `atRisk` when `forecastVariance < -0.01`. Method label `'schedule-burn'`. This is a deterministic projection — **not** an LLM.

**Variance (per account, VERBATIM):** `const variance = revisedBudget - efc;` → **Variance = revisedBudget − EFC.** Positive = under budget (green); negative = over (red). `overspent = variance < -0.01`. Rolls up by summation. The red‑triangle "raise overage" button posts an Overage for exactly `efc − revisedBudget`.

**Utilization / Spent %:** the cost report itself has no utilization field — it's expressed via the variance/revised relationship and the `overspent` flag. Explicit percentages live in the ledger: `spentPct = budget>0 ? round(cost/budget*100) : 0` (where `budget = project.totalBudget`, the scalar), `marginPct = income>0 ? round(net/income*100) : 0`. The Budget‑vs‑Actual tab shows a Used% progress bar per account.

**Cash position** (in `financeSummary` and `ledger.computeTotals`, NOT in the cost report): `cashPosition = incomeReceived − costPaid` (incomeReceived = INCOME status ∈ {RECEIVED,PAID}; costPaid = COST status PAID).

## D.5 Snapshots — `CostReportSnapshot` (schema ~4027, `cost_report_snapshots`)

Fields: `id, projectId, asOf (default now), label, data Json ("full per-cost-center report"), budget, committed, actual, efc, variance, createdAt`.

`saveSnapshot(projectId, label, userId)` requires project capability `('costReport','lock')`, runs `costReport()`, then persists the **entire report JSON** plus scalar totals — **note it stores `totals.budget` (raw line‑item budget), NOT `revisedBudget`.** `listSnapshots` returns `{id, asOf, label, budget, committed, actual, efc, variance}` ordered `asOf desc`. Snapshots are the financier/bond artifact. UI: "Save snapshot" + a snapshots table showing EFC & Variance.

## D.6 Ledger + GL

**`ledger.service.ts`:**

- `computeTotals(items)`: `income` (INCOME/SALES_REVENUE ∈ INCOME_RECOGNISED), `cost` (COST/CORPORATE_OVERHEAD ∈ COST_ACTUAL), `net = income − cost`, `incomeReceived`, `costPaid`, `cashPosition`.
- `summary(projectId)`: totals + `budget = project.totalBudget`, `spentPct`, `marginPct`, `count`.
- `portfolio()`: per‑project rows + FX‑converted `combined` totals in `BASE_CURRENCY` + `byStatus` counts.
- **AP:** `apAging` (buckets current / 1‑30 / 31‑60 / 61‑90 / 90+ over APPROVED unpaid COSTs by dueDate), `paySelected` (payment run with 4 controls: APPROVED‑only, invoice number present, vendor‑invoice document attached, **SoD** — releaser ≠ approver; sets status PAID + paidDate/paidAmount/paidById), `paidRegister` (disbursements audit).
- **Cost coding:** `byAccount` (COST actuals by code + uncoded), `accountLedger` (drill‑down), `glByAccount` (debit/credit — COST→debit, income→credit).
- **Period close:** `listPeriods`/`setPeriod` on `AccountingPeriod` (YYYY‑MM, OPEN|CLOSED). `assertPeriodOpen` throws if a posting date falls in a CLOSED period — shared by costing, petty cash, PO invoicing, OCR.
- **Status guard (`setStatus`):** PAID is **blocked** via status flip (must go through the payment run); COST→APPROVED is blocked when an INVOICE/EXPENSE workflow exists (must route through approval); else manual approval stamps `approvedById`.

**Relation to budget/cost report:** the ledger's recognized COST actuals are the SAME rows the cost report sums as `actual`. The ledger adds cash/AP/margin/aging views over those transactions; the cost report reconciles them against the budget baseline.

**`production-gl.service.ts` (GL bridge):** mirrors each recognized `ProjectTransaction` into a balanced, POSTED double‑entry `JournalEntry` so the cost report reconciles to the trial balance. Idempotent via `journalEntryId`. `postOne`: COST → DR 5400 "Production Costs (WIP)" / CR 2000 "Accounts Payable" (or 1010 Bank if PAID); INCOME → DR 1100 AR (or 1010 Bank) / CR 4100 revenue. `syncProject` posts all un‑mirrored actuals; `unpost` voids; `reconcile` returns `{ledgerCost, ledgerIncome, postedCount, unpostedCount, unpostedAmount, inBalance}`.

## D.7 Fringes in cost

Fringes are computed at **budget line‑item level and folded into `total`** — they are NOT tracked separately in actuals/committed/EFC/variance. So:

- **Budget** in the cost report = Σ line `total` → **already fringe‑inclusive**.
- The report also exposes per account (informational, not in `totals`): `wages = Σ subtotal` (pre‑fringe) and `fringe = Σ fringeAmount`; `fringe` DOES roll up into section and `totals.fringe`.
- **Actual / committed / EFC / variance carry no separate fringe** — a cost transaction or PO commitment is a single tax‑inclusive `total`; any labor fringe an operator wants recognized must be posted as its own cost line under the relevant `accountCode`. There is no automatic fringe accrual on actuals. Fringe reconciliation is therefore budget‑side only: the fringe‑loaded budget `total` vs whatever actuals/commitments land on that code.

## D.8 Cost‑control endpoints

### `costing.controller.ts` — base `/production/costing`, `@UseGuards(JwtAuthGuard, PermissionsGuard)` + `@RequirePermission('production', 1)`

| Method | Path | Purpose | Perm |
|---|---|---|---|
| GET | `vendors` / POST `vendors` / PUT `vendors/:id` / DELETE `vendors/:id` | Vendor CRUD | 1 |
| GET | `supplier-catalog` | Active suppliers + linked flag | 1 |
| POST | `vendors/add-from-suppliers` / `vendors/:id/refresh-from-supplier` | Import/refresh supplier vendors | 1 |
| **GET** | **`report/:projectId`** | **The cost report (EFC)** | 1 |
| GET | `snapshots/:projectId` | List snapshots | 1 |
| POST | `snapshots/:projectId` | Save snapshot (needs `costReport:lock`) | 1 |
| PATCH | `accounts/:accountId/etc` | Set manual ETC | 1 |
| GET | `finance-summary/:projectId` | Unified finance header strip | 1 |
| GET | `overspend/:projectId` | Overspent accounts (raise‑overage) | 1 |
| GET | `forecast/:projectId` | Schedule/burn forecast EFC | 1 |
| GET | `reporting-pack/:projectId` | Financier/bond bundle | 1 |
| GET | `sync-warnings/:projectId` | Schedule/breakdown vs budget drift | 1 |
| GET/POST | `transfers` | List / create transfer | 1 |
| PATCH | `transfers/:id/status` | Approve/reject (needs `transfers:approve`) | 1 |
| DELETE | `transfers/:id` | Delete transfer | 1 |
| GET/POST/PUT | `pos` / `pos/:id` | PO list/create/update | 1 |
| PATCH | `pos/:id/status` | Set PO status (APPROVED needs `po:approve`) | 1 |
| POST | `pos/:id/submit-approval` / `pos/:id/revise` / `pos/:id/invoice` | PO workflow + invoicing | 1 |
| POST | `pos/:id/upload-invoice` | OCR vendor invoice → DRAFT cost | 1 |
| POST | `floats/:floatId/upload-receipt` | OCR petty‑cash receipt → DRAFT spend | **2** |
| POST | `timesheets/:projectId/upload` | OCR timesheet → DRAFT timecard | **2** |
| DELETE | `pos/:id` | Delete PO | 1 |
| GET/POST | `floats` | Petty‑cash floats (with balances) | 1 |
| PATCH | `floats/:id/close` | Close float | 1 |
| GET/POST | `floats/:floatId/txns` | Float transactions (SPEND posts PAID cost) | 1 |
| DELETE | `petty-txns/:id` | Delete petty txn (removes linked cost) | 1 |
| GET | `cashflow/:projectId` | Weekly cash‑flow forecast | 1 |

### `ledger.controller.ts` — base `/production/ledger`, `@UseGuards(JwtAuthGuard, PermissionsGuard, TwoFactorGuard)` + `@RequirePermission('production', 1)`

| Method | Path | Purpose | Perm / extra |
|---|---|---|---|
| GET | `portfolio` | All‑projects rollup + FX combined | 1 |
| GET | `summary/:projectId` | Project totals + spentPct/marginPct | 1 |
| GET | `ap-aging/:projectId` | Open payables aging buckets | 1 |
| GET | `paid/:projectId?from&to` | Disbursements register | 1 |
| POST | `pay/:projectId` | Payment run — mark PAID (4 controls) | **2 + `@Require2FA()`** |
| GET | `by-account/:projectId` | COST actuals grouped by code + uncoded | 1 |
| GET | `account/:projectId/:code` | Account drill‑down (`__uncoded__` for null) | 1 |
| GET | `gl/:projectId` | GL by account (debit/credit) | 1 |
| GET | `periods/:projectId` | List accounting periods | 1 |
| POST | `periods/:projectId` | Open/close a period | **2** |
| GET/POST | `` (root) | List / create transaction (period‑guarded) | 1 |
| PUT/DELETE | `:id` | Update / delete transaction (period‑guarded) | 1 |
| PATCH | `:id/status` | Set status (PAID/APPROVED gated) | 1 |
| POST | `:id/submit-approval` | Route DRAFT cost into INVOICE/EXPENSE workflow | 1 |

### Overages (`OveragesService`): `list` (items + PENDING/APPROVED/REJECTED totals), `create` (PENDING, `requestedById`), `update`, `setStatus` (stamps `approvedById/approvedAt`), `remove`. Approved overages feed `approvedByCode` → `revisedBudget`.

## D.9 Cost‑control frontend (`CostReportPanel.tsx`)

Key controls: per‑account **ETC** editable input (`setEtc`), **Save snapshot**, snapshots table (EFC & Variance), overspend list with a red‑triangle **raise‑overage** button (posts an Overage for `efc − revisedBudget`), the "Budget move" transfer form (**Approve/Reject/Delete** per pending transfer), and the finance summary tiles. Formula reminders printed in‑panel: "EFC = Actual + ETC", "Variance = Revised − EFC".

---

# PART E — The labor / fringe burden engine (Layer B)

This is the second, richer fringe mechanism. It is driven by `BudgetLineItem.classificationCode` and writes the computed per‑rule burden into `BudgetLineItem.fringeDetail` (JSON). It is grounded in a **frozen, per‑project copy of union/guild rate rules.**

## E.1 Data model

### `ProjectLaborConfig` — `@@map("project_labor_configs")` (schema ~6041)

`id, projectId @unique (one per project), project (Cascade), geoNodeId?/geoNode? (jurisdiction), productionType String, unionStatus UnionStatus @default(NON_UNION) (UNION | NON_UNION | MIXED), laborBodyIds Json (selected unions/guilds), asOfDate DateTime (date used to resolve rates), snapshotAt DateTime?, notes?, createdAt/updatedAt`.

### `ProjectRateRule` — `@@map("project_rate_rules")` (~6060) — frozen per‑project copy of a master `RateRule`

`id, projectId/project (Cascade), sourceRuleId? (pointer to master, for "update available" detection), laborBodyName, agreementName, classificationCode?, label, rateType RateType, calcMethod CalcMethod, value Decimal(12,5), base RateBase?, capPeriod CapPeriod?, capAmount Decimal(14,2)?, floorAmount Decimal(14,2)?, tiers Json?, currency String @default("USD"), glAccountCode?, isEstimate Boolean @default(false), overrideReason? (when an accountant edits a value at snapshot), enabled Boolean @default(true), sourceTitle?/sourceUrl? (provenance), effectiveDate?, frozenAt DateTime @default(now())`.

**Rate enums (schema ~5913):**
- `RateType` = `PENSION, HEALTH, PENSION_HEALTH, PAYROLL_TAX, WORKERS_COMP, UNEMPLOYMENT, VACATION_PAY, HOLIDAY_PAY, EMPLOYER_TAX, UNION_DUES, GUILD_CONTRIB, STATUTORY_GRATUITY, HANDLING_FEE, OTHER` (and more)
- `CalcMethod` = `PERCENT, FLAT_PER_DAY, FLAT_PER_WEEK, FLAT_PER_HOUR, PERCENT_WITH_CAP, TIERED`
- `RateBase` = `GROSS, STRAIGHT_TIME, TAXABLE, WORKED_DAYS`
- `CapPeriod` = `WEEKLY, MONTHLY, ANNUAL, PER_PRODUCTION`

## E.2 Endpoints & behavior

- `POST /labor/budget/:versionId/apply-fringes` — recomputes burden on classified lines; returns `linesTouched`. Burden is computed **per‑rule** from the project's frozen labor snapshot (filtered by `classificationCode`) and stored in each line's `fringeDetail` JSON. This is where caps / wage‑bases / flat statutory amounts live (flagged "est" when `isEstimate`).
- `GET /labor/budget/:versionId/fringe-detail` — the burden breakdown that drives the Fringe tab.
- `POST /accounting/post-burden/:versionId` — posts the burden to the GL (Dr burden expense / Cr employer liability); replaces any prior entry for the version.
- `GET /production/reports/fringe-detail/:projectId` — the printable Fringe / Burden Detail report.

## E.3 `FringeDetailPanel.tsx` — per‑button

Buttons: **Apply fringes** (recomputes burden on classified lines), **Post burden to GL**, **Print/PDF**, **Refresh**. It reads and displays: `grandWages`, `grandFringe`, `grandBurdenPct`, burdened labor = wages+fringe; `typeTotals` by rate type (PENSION, HEALTH, PENSION_HEALTH, PAYROLL_TAX, WORKERS_COMP, UNEMPLOYMENT, VACATION_PAY, HOLIDAY_PAY, EMPLOYER_TAX, UNION_DUES, GUILD_CONTRIB, STATUTORY_GRATUITY, HANDLING_FEE, OTHER); and per cost center `wages / fringeTotal / burdenPct / burden{type:amount} / anyEstimate`. Labeled decision‑support ("not legal or payroll advice").

**Rebuild note:** keep these as two coordinated mechanisms. Layer A (per‑line %) is fast and always present; Layer B (classification‑driven statutory burden) grounds real union costs, writes `fringeDetail`, and posts GL accruals. The `classificationCode` set by casting/crew links (PART C.6) is the join key into Layer B.

---

# PART F — Cross‑module connections

Budget and schedule are the hub of the production module. Everything is joined by the **account‑code string** (see §2.2) and the **strip/shoot‑day** derivations.

## F.1 Inputs — what flows INTO budget/schedule

| Source module | Data that flows in | Target field | Mechanism (file) |
|---|---|---|---|
| **Movie Magic Budgeting** (.mmb/.xml/.csv) | Category→Account→Detail rows, qty, rate, legacy fringe %, 4th‑level sub‑details | New/updated BudgetVersion + Section/Account/LineItem; `origin='MOVIE_MAGIC_IMPORT'`; distinct fringe %s → `FringeProfile` ("MMB Legacy Fringe X%"); `stages` JSON; recalced `totalBudget` | `MovieMagicService.importBudget()` (`movie-magic.service.ts`), strategies `NEW_VERSION`/`UPDATE_ACTIVE` |
| **Movie Magic Scheduling** (.sex) | Strips: scene#, INT/EXT, DAY/NIGHT, set, location, pages, ShootDay, cast[], elements | `ProductionStrip` (upsert by scene#, `notes='Movie Magic'`, skips locked) + `BreakdownElement` (`source='MOVIE_MAGIC'`) | `MovieMagicService.importSchedule()` |
| **Script breakdown (AI)** | AI‑extracted physical elements per scene + CAST from cues | `BreakdownElement` (`source='AI'`, bound to `sceneId`+`revisionId`); `scriptScene.breakdownStatus='AI'` | `ScriptImportService.breakdownRevision()` (`breakdown/script-import.service.ts`) |
| **Script projection (P2)** | Active‑revision scenes → strips (content only) | `ProductionStrip` create/adopt/update; re‑points `BreakdownElement.stripId`; `ScriptSyncLog` (reversible). **Never moves `shootDay`, never overwrites a locked strip** | `ScriptProjectionService.apply()` |
| **Breakdown → budget generator** | Element counts by category × rate card | `BudgetLineItem` (`subTitle='Auto-Breakdown'`, `origin='SCRIPT_IMPORT'`, `classificationCode` from CATEGORY_MAP, `aiSuggested*`). Idempotent | `BreakdownService.budgetFromBreakdown()` / `applyMapping()` |
| **Script annotations (prop tags)** | A PROP tag annotation → draft budget line | `BudgetLineItem` `origin='SCRIPT_TAG'`, `isDraft=true`, `sourceAnnotationId` (SYS‑13 D9) | `LineItemOrigin.SCRIPT_TAG` |
| **Scheduling (auto/optimizer)** | Groups unscheduled by set → packs to pages/day; optimizer minimizes company moves / cast holds / D‑N switches | `ProductionStrip.shootDay` + `sortOrder` | `autoSchedule()`, `optimizeOrder()`, `reorder()`, `applyScenario()` |
| **DOOD → globals staging** | Per‑category DOOD tallies + shootDays | `ProjectGlobalsStaging.doodTallies` + `shootDays` (**staging only**) | `DoodCalculationService.refreshGlobalsStaging()` |
| **Budget lock → calendar** | Locked version's `shoot_days` anchored on `shootStartDate` | `project.shootStartDate`/`shootEndDate` | `BudgetService.anchorProjectDates()` |
| **Casting** | Cast performer link → union classification | `BudgetLineItem.castTalentId` → resolves `classificationCode` (drives fringes) | `BudgetService.classificationForTalent()` |
| **Crew (rate cards)** | Directory freelancer assigned → back‑linked to a matching labour line by role/title | `BudgetLineItem.crewMemberId` (fills only unassigned non‑PERFORMER lines; account code ≠ '1400'; exact‑then‑partial title match) | `CrewService.autoLinkBudgetLines()` |
| **Purchase Orders** | Approved PO → committed; invoiced PO → actual | `costCenterCode`/`budgetLineItemId` on PO; invoicing posts `ProjectTransaction{kind:'COST'}` | `CostingService.createPo()`/`invoicePo()` |
| **Purchase Requests** | PR carries budget coding forward to PO | `costCenterCode`, `costCenterTitle`, `budgetLineItemId` | `purchase-requests.service.ts` |
| **Procurement (cards/advances/claims)** | Card txns, advances, claims → posted costs | `ProjectTransaction.accountCode` (status `CODED`→posts COST) | `procurement-txns.service.ts` |
| **Payroll (timecards)** | Timecard with classification + fringe → posted labour cost | `accountCode`/`classificationCode` on Timecard; posts ledger COST; fringe from `LaborFringeRule` by `classificationCode` | `PayrollService.computeFringe()` |
| **Locations** | Location fee (fee/day×days), permit fees, ad‑hoc costs | `ProjectTransaction{kind:'COST'}` auto‑coded to first account matching `/location/i` | `LocationsService.postFee()`/`postCost()` |
| **Petty cash** | SPEND on a float → actual | `ProjectTransaction{kind:'COST', status:'PAID'}` | `CostingService.addPettyTxn()` |
| **Overages** | Approved overage → additive budget change per code | Read as `approvedByCode` in revised budget | consumed in `costReport()` |
| **Budget transfers** | Line‑to‑line reallocation (nets to zero) | `transferByCode` in revised budget | `CostingService.createTransfer()` |

## F.2 Consumers — how modules USE budget/schedule

| Module | Budget/schedule data read | How used |
|---|---|---|
| **Call sheets** | `ProductionStrip` where `shootDay = callSheet.dayNumber` (+ next day = advance) | `pullFromSchedule()` builds scheduleItems, castCalls (from strip.cast[]), advance schedule; resolves the day's location for sun/weather/hospital |
| **Dynamic DOOD → call sheet** | strips × elements, filtered to on‑set codes SW/W/WF/SWF/PU | `generateCallSheet(date)` lists only elements required on set that day (H/D excluded) |
| **Actor self‑view** | `CallSheet.castCalls` (name match) | `CastingService.actorView()` returns only that actor's call for today |
| **Cost Report (EFC)** | Active version line totals; PO remaining (committed) by code; COST txns (actual) by code; overages; transfers; `etcAmount` | `CostingService.costReport()` |
| **Schedule‑burn forecast** | costReport + shoot‑day % elapsed | `forecast()` projects ETC; flags at‑risk lines before actuals do |
| **Sync‑integrity warnings** | Stripboard shoot‑day count vs budget `shoot_days` global; breakdown estCost vs account revisedBudget | `syncWarnings()` flags shoot‑day drift + breakdown‑exceeds‑budget |
| **Budget vs Actual** | Line totals vs COST txns + overages + transfers | `BudgetService.getBudgetVsActual()` |
| **Topsheet comparison** | Locked baseline vs current working section totals | `BudgetService.topsheetComparison()` |
| **Production Reports** | costReport (CTC, Cost Overage, Weekly Cost Report "the Green", AICP bid view); active lineItems (Fringe/Burden Detail) | `production-reports.service.ts` (read‑only over costReport) |
| **DPR (Daily Production Report)** | Call‑sheet scheduled scenes/pages, `hotCosts[]`, `estimatedDayCost`, `scenesShot`/`pagesShot` | `dpr.service.ts`; `hotCosts()` rolls cumulative burn |
| **Financier/Bond reportingPack** | costReport + forecast + cashflow + snapshots + DPR hot costs | `CostingService.reportingPack()` |
| **Cash‑flow forecast** | COST/INCOME txns + open‑PO remaining at expected date | `CostingService.cashflow()` weekly buckets |
| **Scheduling conflicts / light plan** | scheduled strips + Location (shootStart/End, permit, lat/lng) + calendar dates | `conflicts()` (see §A.7) |
| **Location Breakdown / Day Rollup / Category Breakdown** | strips grouped by location/shootDay + elements | `BreakdownService.locationBreakdown()`, `dayRollup()`, `categoryBreakdown()` |
| **Casting** | `BreakdownElement` (CAST/BACKGROUND/STUNTS) → CharacterProfile → CastingCall; shoot‑day counts | `createCallsFromBreakdown()`; match engine uses shoot‑day counts |
| **Contracts** | Casting "Selected" → DRAFT Deal Memo (proposedRate) | Selection handoff into Contracts |
| **Movement orders** | Confirmed Location coords (base→set) | Auto‑generate draft unit moves with haversine drive time |

---

# PART G — AI features touching budget & scheduling

All AI routes through the unified gateway **`AiService`** (`backend/src/ai/ai.service.ts`): `run/complete/json` walk a **DB‑driven provider failover chain** (the "LLM Engines & Routing" switchboard, `LlmRoutingService`) with in‑memory cooldowns and streaming for long jobs; `raw()` (vision + forced tool‑use) is **Anthropic‑only by design** (`api.anthropic.com/v1/messages`). Every call writes an `AiRun` audit row (task, provider, model, tokens, latency). Default model `claude-3-5-sonnet-20241022`; Movie Magic mapping default `claude-sonnet-4-6` (env `MM_AI_MODEL`/`LABOR_AI_MODEL`).

**House rule enforced everywhere: AI never writes live numbers — every suggestion is approval‑gated.**

## G.1 AI feature catalog

| AI feature | Reads (input) | Engine / model | Output | Preserve‑notes |
|---|---|---|---|---|
| **Movie Magic CoA AI mapping** | Unmapped imported budget lines (externalCode, description, amount, category) + **DynamicContext JSON** (jurisdiction VAT rules + enterprise `CoaMappingTable`) | Anthropic **forced tool** `submit_line_mappings` (`AiService.raw`, toolChoice forced); batches of 50, max 500 lines | Per line: `suggestedMasterCode`, `confidenceScore` 0..1, `reasoning`, `vatTreatment` | **SUGGESTIONS ONLY — writes nothing.** Hard‑validates codes against `coa.accounts` (hallucination blocked). `ai-mapping.service.ts` |
| **AI‑reviewed MM import (2‑step)** | Parsed MMB lines + AI mapping suggestions + master‑CoA dropdown | (uses AiMapping above) | Step 1 preview writes nothing; Step 2 **clones the active version** (never touches a LOCKED baseline), injects approved lines as `origin='MOVIE_MAGIC_IMPORT'`, unmatched → "IMPORT" section, VAT/MM‑code in notes | Approval‑gated; LOCKED baselines branched not mutated. `movie-magic.service.ts` |
| **AI script breakdown** | Reconstructed scene body text (from revision pageText + scene boundaries) | `AiService.complete` (task `scriptImport.breakdown`), batches of 8 scenes, maxTokens 3000; categories restricted to `AI_CATEGORIES` | JSON `[{sceneIndex, elements:[{category,name,quantity}]}]` → `BreakdownElement` (`source='AI'`) + CAST from cues | Idempotent (skips already‑broken‑down unless forced); **preserves MANUAL elements**; validated against `CATEGORY_SET`. `script-import.service.ts` |
| **AI budget‑line generation** | Breakdown element counts × rate card | Deterministic mapper (not an LLM) — `CATEGORY_MAP` keyword→account | `BudgetLineItem` `origin='SCRIPT_IMPORT'` (or `MANUAL_OVERRIDE` on edit); archives `aiSuggestedRate`/`aiSuggestedQuantity` | The "AI rate" is the default‑rate card; provenance preserved on override. `breakdown.service.ts` |
| **DynamicContextService (RAG context builder)** | Project `productionCountry` → GeoNode ancestry → `JurisdictionTaxRule` (active, date‑valid); `CoaMappingTable` (active) | No model — **read‑only context compiler** | ONE minified JSON string: `{jurisdiction.tax[], coa.map[], coa.accounts[]}` injected into MM‑mapping / OCR / script prompts | **Strictly read‑only, advisory.** Grounds the model in real codes to stop hallucination. `context/dynamic-context.service.ts` |
| **Vision OCR intake (invoice / petty‑cash / timesheet)** | Uploaded image/PDF (base64) | `AiService.raw` vision (Anthropic; `beta:'pdfs-2024-09-25'` for PDFs), maxTokens 1024 | Strict JSON per doc type → **DRAFT** `ProjectTransaction` / **PENDING** Timecard with `confidence` | **Never a live actual** — suggestion‑only, period‑guarded, awaits human approval. `costing.service.ts` OCR_PROMPTS |
| **Schedule/burn EFC forecast** | costReport + shoot‑day progress | Deterministic burn‑rate projection (no LLM) | `projectedEtc`, `forecastEfc`, `forecastVariance`, at‑risk list; method `'schedule-burn'` | Manual ETC overrides always win; projection never below open commitments. `costing.service.ts` |
| **Shooting‑order optimizer** | All strips (location, cast, D/N, pages) | Deterministic heuristic (`planShootingOrder`) | Proposed day/sortOrder plan + before/after metrics + plain‑English rationale | **PREVIEW by default** (apply:true to persist); never moves locked/banner strips. `scheduling.service.ts` |
| **Location/Production Intel advisory** | Weather (Open‑Meteo), holidays, location | `AiService.raw` + `AiService.json` | 4–8 prioritized items assigned to roles — cost/schedule items routed to **Line Producer/UPM**, daylight to **2nd Unit Director** | Advisory only; degrades gracefully. `intel/intel.service.ts` |

**Notably absent:** there is **no AI EFC/cost‑narrative generator and no AI DOOD generator** — DOOD, forecast, and optimizer are all **deterministic**. The only budget/schedule‑adjacent generative‑LLM features are: MM CoA mapping, script breakdown, vision OCR intake, and the Intel advisory.

## G.2 Provenance / origin list — `LineItemOrigin`

| Origin | Produced by | Notes |
|---|---|---|
| `MANUAL` | User typing a line | No `aiSuggested*` captured |
| `AI_GENERATED` | AI assistant (reserved; treated as AI‑origin in override logic) | Human edit → `MANUAL_OVERRIDE`, archives original rate/qty |
| `SCRIPT_IMPORT` | `budgetFromBreakdown()` / `applyMapping()` (default rate‑card lines) | Carries `classificationCode`, `aiSuggested*`, `subTitle='Auto-Breakdown'` |
| `SCRIPT_TAG` | Script prop/tag annotation → draft line; `isDraft=true`, `sourceAnnotationId` | SYS‑13 D9 |
| `AUTO_BREAKDOWN` | Scene‑breakdown auto‑generator (merged path via `pushToBudget`) | Treated as AI‑origin for override provenance |
| `MANUAL_OVERRIDE` | Human edits an AI/import line's rate/qty, or moves it to a different account | Original AI suggestion preserved once in `aiSuggested*` |
| `MOVIE_MAGIC_IMPORT` | `importBudget()` / `confirmAiImport()` | Legacy fringe → `FringeProfile`; the "protected baseline" (script budget skipped to avoid double‑count; MM elements win in de‑dup) |

Related provenance fields on `BudgetLineItem`: `aiSuggestedRate`, `aiSuggestedQuantity`, `classificationCode`, `castTalentId`, `crewMemberId`, `stages`, `fringeProfileId`, `isDraft`, `sourceAnnotationId`. `BreakdownElement.source` (`AI`/`MOVIE_MAGIC`/`MANUAL`) governs projection de‑dup priority (a MOVIE_MAGIC baseline is protected).

---

# PART H — Rebuild notes, gotchas & what to preserve

**Architecture invariants to preserve**

1. **The account‑code string is the universal join** between the budget tree and all financial records (POs, transactions, overages, transfers, breakdown). Preserve it exactly, or migrate every consumer to a relational key at once.
2. **The four‑level budget tree** (Version → Section → Account → LineItem) with computed‑on‑read roll‑ups; totals are never stored on Section/Account (only the grand total is cached on `ProductionProject.totalBudget`, and only for the active version).
3. **"Stage → preview → explicit apply" gate** on every AI and cross‑module write: DOOD writes only to `ProjectGlobalsStaging`; breakdown‑generated lines are idempotent (`subTitle:'Auto-Breakdown'`); MM/OCR/mapping are previews; the LOCKED baseline is branched, never mutated.
4. **DOOD, the production calendar, forecast, and the optimizer are pure/deterministic derivations** — nothing stored (except scenario JSON snapshots). Rebuild the two `*.util.ts` cores (`buildDoodMatrix`, calendar anchoring) as pure functions; they are quoted verbatim in PART A.
5. **Fringes are two coordinated engines** — a per‑line % (Layer A, PART C.6) and a classification‑driven statutory burden engine (Layer B, PART E) that writes `fringeDetail` and can post GL accruals. `classificationCode` (set by casting/crew links) is the join.
6. **The formulas are exact and load‑bearing** (PART C.5, D.1, D.4): `subtotal = qty×rate/exchangeRate` (or Σ stage amounts), `fringeAmount = subtotal×fringePct/100`, `total = subtotal + fringeAmount`; `revisedBudget = budget + approved transfers + approved overages`; `committed = Σ(PO.total − invoiced)`; `actual = Σ COST.total` (APPROVED/PAID); `ETC = etcAmount ?? committed`; `EFC = actual + ETC`; `variance = revisedBudget − EFC`.
7. **Controls to keep**: period lock (`AccountingPeriod` CLOSED blocks all postings), AP payment run three‑way match + SoD + 2FA (never a status flip), PO approval / transfer approval / cost‑report‑lock project capabilities, budget lifecycle role‑gating (EP/Producer/Line Producer or system Finance/Admin).

**Bugs / inconsistencies to fix in FilmOS (do NOT faithfully copy)**

1. **Two lock paths differ.** `PATCH …/status` validates transitions, role‑gates, and anchors the shoot calendar; the legacy `PATCH …/lock` (wired to the budget‑tab Lock button) does none of that. Unify to one lock path that always validates, role‑gates, and anchors.
2. **Globals & fringe profiles are NOT lock‑guarded** — they can be edited on a LOCKED version. Guard them (or intentionally allow, but decide).
3. **`tierOf` differs frontend vs backend** (FE: 2/3/4→BTL, 5→POST; BE: 2→BTL, 3→POST). Pick one canonical tier map.
4. **No physical locked snapshot** — LOCKED is enforced read‑only in the service, and accounting matches by account code, not version id. Consider a true immutable snapshot (the cost‑report snapshot exists, but the *budget* baseline itself is not frozen as rows).
5. **Snapshot stores raw `budget`, not `revisedBudget`** — a financier reading an old snapshot sees the pre‑transfer/overage number. Decide which is authoritative and store both.
6. **Two DOOD implementations coexist** (multi‑category `buildDoodMatrix` vs legacy cast‑only `SchedulingService.dood()`). Keep only the multi‑category one.
7. **`ProductionSchedule` is misnamed** — it is per‑day metadata, not the schedule (the board is `ProductionStrip[]`). Rename in the rebuild.
8. **Budget reads require `production:2`** (edit) — even GETs. If FilmOS wants view‑only roles to see budgets, split read vs write permissions.

**Workflow to preserve end‑to‑end:** Script → AI breakdown (`BreakdownElement`) → projection (`ProductionStrip`, content only) → schedule (`shootDay` via manual/auto/optimizer) → calendar anchoring (Day N = Nth working day) → DOOD (live) → globals staging → (push) budget globals; and breakdown elements → budget line items (rate card). Budget matures DRAFT → REVIEW (V‑numbered) → APPROVED → LOCKED (anchors the shoot calendar) → branch to WORKING copy for changes. Cost control reconciles actuals (transactions) + committed (POs) + overages + transfers against the locked baseline, all by account code, surfacing EFC and variance, with snapshots for financiers and a GL bridge for the trial balance.

---

*End of reference. Every field name, enum value, formula, endpoint, and UI control above is quoted from the current TFM‑System codebase (`backend/src/production/`, `backend/prisma/schema.prisma`, `frontend/src/`) as of the audit date. Schema line numbers are approximate anchors; the model/field names are exact.*
