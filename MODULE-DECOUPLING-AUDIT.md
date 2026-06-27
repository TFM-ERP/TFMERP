# TFM — Module Decoupling Audit

_Code-grounded, 2026-06-24. Read against the live repo (`backend/src` + `prisma/schema.prisma`), not assumed. Produced to decide which modules can run/sell standalone vs. stay integrated, as the input to packaging/pricing._

## Bottom line

Your instinct is correct: **Rental is the only module that stands fully apart from Production.** The codebase splits cleanly into **two product lines**, not six independent modules:

- **Line A — Rental** (rental operations + the client-facing Finance billing). Cleanly separable; **zero code dependency on Production.**
- **Line B — Production Suite** = Production core **+ its own embedded accounting** (ledger / GL / budget / costing / payroll) + Locations + Transportation + ScripON. Integrated by design; most of these are *features/entitlements* of Production, not separate products.

The one genuine standalone candidate *inside* Line B is **ScripON** (sellable to writers) — but it needs 2–3 seams cut first.

A surprise worth knowing: **Production does NOT import the top-level Finance/Accounting modules at all.** It has its own project accounting. So a customer who "doesn't want finance" can still run Production with full cost tracking — the top-level Finance module is really the *Rental / company* billing system.

## There are actually two finance systems

1. **Company / Rental finance** — `finance/` (quotations, invoices, payments, VAT) + `accounting/` (company chart of accounts). Couples to Rental (Booking ↔ Invoice/Quotation).
2. **Production project accounting** — `production/ledger` + `production/gl` + `budget` + `costing` + `payroll` + `perdiem` + `procurement`. Self-contained inside Production; double-entry, project-scoped.

They touch only via two shared DB tables (`glAccount`, `journalEntry`) — **schema-level, not code**. Accounting seeds the company COA; Production GL posts project actuals to the same tables. That's a soft seam, not a code dependency.

## Standalone-readiness by module

| Module | Standalone? | Code coupling | Data coupling | Effort |
|---|---|---|---|---|
| **Rental** | ✅ Own vertical | None to Production | `Booking ↔ Invoice/Quotation` (Finance); in-house fleet wraps `Asset`/`Driver` | LOW — ship with Finance |
| **Finance + Accounting** | ✅ Yes | None (only `StatusService` infra) | optional `BankAccount.projectId`; `Booking↔Invoice` | LOW |
| **Production (whole)** | ✅ Yes, as a unit | needs only LocationsLibrary + infra; **no Finance/Accounting import** | embedded accounting is self-contained | LOW to run as a unit; HIGH to split internals |
| **ScripON** (+ audio/reader) | 🟡 Medium | service is clean (`Prisma` + `AiService` only) | breakdown & scheduling read its tables; `promoteBuild` writes `productionProject` | MEDIUM |
| **Locations** | 🔴 Production feature | — | `Location` cascades under `ProductionProject` | entitlement, not a product (`MasterLocation` library is the only project-free part) |
| **Transportation** (travel/logistics) | 🔴 Production feature | injects Production `Ledger`/`Costing` | FKs to `ProductionProject` throughout; wraps Rental `Asset`/`Driver`; ties to Production `PurchaseOrder` | entitlement |

## The hard seams (the "fixing" work), priority-ordered

1. **`BreakdownElement` is the linchpin** — it FKs `ProductionProject` + `ProductionStrip` + `ScriptScene` simultaneously (schema ~3435–3448). This single model pins Production ↔ ScripON together. To let ScripON stand alone, breakdown must consume scenes through an export/interface, not a direct table FK.
2. **`scriptScene.productionStripId`** — scheduling writes into ScripON's own table (`scheduling.service` ~397) and script reconciliation reads it back. Same Production↔ScripON seam, at the row level.
3. **`promoteBuild()` writes `productionProject`** (`scripton.service` ~1579–1584) — ScripON creating production rows directly. In standalone mode this becomes an export/webhook instead.
4. **Audio/Reader have no module boundary** — 7 audio controllers are flat-registered in `production.module.ts`; "Reader" is a single method inside `RenderService`. Wrap them in an `AudioModule` with entitlement gates to license independently.
5. **Rental ↔ Finance** — `RentalBooking ↔ Invoice/Quotation` is a bidirectional FK (schema 657 / 1070). Fine if sold together (they are one line); a seam only if ever split.
6. **Transportation wraps Rental** — `TransportVehicle.assetId → Asset`, `TransportDriver.driverId → Driver` (7681 / 7742): in-house fleet identity physically lives in Rental's tables. Fine within the suite; relevant only if Rental and Production transport are deployed separately.
7. **Multi-tenant safety** — `glAccount` / `journalEntry` are shared across Accounting + Production GL. They must be scoped by tenant (and ideally project) so different orgs/projects can't collide on account codes.

## What this means (packaging preview — not pricing yet)

- **Two sellable lines:** Rental (standalone) and the Production Suite.
- **Within the Suite:** Production core — with embedded budget/cost/ledger, Locations, and Transportation as **built-in entitlements** — is the base. **ScripON** is the one true add-on that can *also* sell standalone to writers. **Company Accounting** (statutory COA consolidating project ledgers) is an enterprise add-on.
- **Locations & Transportation are feature flags inside Production**, not separate products — don't try to sell them alone.
- This maps directly onto the tenancy model: everything is project-scoped, and project → Organization (tenant). The modularization seams and the `tenantId` work share the **same backbone** — do them together, not as two projects.

## Suggested next step

Pick one and I'll build it on top of this map:

- **(a) Decoupling plan** — concrete interfaces + entitlement-aware fallbacks + refactor steps for the seams above, with effort/risk per item.
- **(b) Operating plan + rollout roadmap** — phased productization sequenced around this coupling reality.
- **(c) Pricing/packaging matrix** — the two lines + the ScripON add-on, with tiers and entitlement toggles.

---
_Method: NestJS module-import + service-injection graph, cross-module TypeScript imports, and Prisma cross-domain relation scan. Evidence (file:line / schema line) available on request for any edge above._
