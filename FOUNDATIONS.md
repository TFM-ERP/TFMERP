# TFM Foundations — Release-Readiness Track

_Status 2026-06-19. Recon-verified against the live repo, not assumed._

## Where we actually are
- **Automated tests** — was greenfield (a `test: jest` script existed, but no jest config, no test deps, zero specs). ✅ **Now bootstrapped**: a zero-install harness (Node 22 built-in `node:test` + the already-present `ts-node`), first **8 unit tests green** via `npm run test:unit`.
- **Migrations / schema drift** — 1 baseline migration + `migration_lock.toml` exist, but `schema.prisma` has grown to **260 models / 8,598 lines**, almost all added via `db push`. The migration history is far behind the schema → **real drift**. ⚠️
- **Multi-tenancy** — **none**. No `Tenant`/`Org`/`Workspace` model; data is scoped by **project + RBAC** (the permissions guard). Single-tenant. ⚠️ (largest, riskiest)

## Recommended order (risk-ascending)
1. **Tests** — additive, zero risk, and the safety net for everything below. Beachhead laid; now expand coverage.
2. **Migrations / drift** — medium risk; needs the database. Reconcile so *schema == migration history* **before** any tenancy work.
3. **Multi-tenancy** — highest blast radius; touches the top-level data roots. Do it **last**, behind the test net and a clean migration baseline.

## 1) Tests — what's set up & how to extend
- **Runner**: Node's built-in `node:test` + `node:assert`, transpiled on the fly by `ts-node` (no jest / no `npm install` — this repo's registry is locked down, so a zero-dependency runner is the robust choice). `tsconfig.json` gained `"ts-node": { "transpileOnly": true }` so specs run cross-platform without env vars.
- **Commands**: `npm run test:unit` (once) · `npm run test:watch` (TDD loop). Both discover `src/**/*.spec.ts`.
- **First suite**: `src/production/scripton/scripton.util.spec.ts` covers the pure engine helpers every P0–P7 engine relies on — `computeFacts` (scene aggregation) and `parseJsonArray` (tolerant model-output parsing). To make them testable, the logic was extracted into `scripton.util.ts` and the service now **delegates** to it (behavior-identical).
- **Pattern to extend**: pull pure logic into a `*.util.ts` (no Nest/Prisma/AI imports) and test it directly. Do **not** import services/controllers into unit tests — that drags in the DI + Prisma + AI-SDK chain and is brittle. For true service/controller integration tests, add `@nestjs/testing` + a Prisma test-double later (once jest or a disposable DB is available).
- **High-value next targets** (all pure, easy wins): ACH/NACHA file formatting, sun/daylight math, money/number parsers, the scheduling optimizer's scoring, the revision colour-wheel advance.

## 2) Migrations / drift — safe reconcile (no data loss)
Make the migration history reflect the current 260-model schema **without** re-creating existing tables:
1. Confirm drift: `npx prisma migrate status`.
2. Capture the gap as one new migration **script** (don't auto-apply):
   `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<ts>_sync/migration.sql`
3. Mark it applied on the existing DB so prod data is untouched: `npx prisma migrate resolve --applied <ts>_sync`.
4. From then on, **every** schema change goes through `npx prisma migrate dev --name <change>` — never bare `db push`.
- ⚠️ Run against a **backup/staging DB first**. This is data-adjacent; never run blindly on prod.

## 3) Multi-tenancy — design & incremental path
Today: one shared DB scoped by project + RBAC. To isolate multiple organisations:
- **Model**: add `Tenant` (Organization). Put `tenantId` on the **top-level roots** only (Project, the user↔org membership, any directly-queried aggregate) — not all 260 models; children inherit tenancy through their parent.
- **Enforcement**: a Prisma client extension / middleware that auto-injects `where: { tenantId }` for the request's tenant, plus a request-scoped `TenantContext` in Nest — so a developer can't forget to scope a query.
- **Backfill**: one migration that creates a default Tenant and stamps existing rows.
- **Why last**: highest-risk change in the system; the test net + clean migration baseline must exist first so regressions are caught and the schema change is captured properly.

---
_This document is the plan; the passing test suite is the first brick laid._
