# TFM — Multi‑Tenancy Design Proposal

_For review. Nothing is built from this doc — it's the decision gate before any code. 19 Jun 2026._

## 1. Goal & non‑goals
**Goal:** let one TFM deployment serve multiple isolated organisations (studios, production companies, a government film commission) so that **no tenant can ever read or write another tenant's data**, with minimal disruption to the ~260 existing models.

**Non‑goals (this phase):** per‑tenant custom code, white‑label theming, cross‑tenant reporting, billing/metering. Those layer on later once isolation exists.

## 2. Where we are today (verified)
- **Single‑tenant.** There is no `Tenant`/`Organization` model. (`companyId` exists only as a CRM "Company" entity — unrelated.)
- Data is scoped by **Project + RBAC**: the `PermissionsGuard` + `@RequirePermission(module, level)` decide *what a user may do*, but not *which org's rows they see*.
- Stack: **NestJS + Prisma + PostgreSQL** (`tfm_erp`), JWT auth. Many services use tolerant `(prisma as any)` calls.
- Migrations are now clean (single `0_init` baseline) — a good moment to add a cross‑cutting column.

## 3. Options
| Option | Isolation | Effort | Ops | Verdict |
|---|---|---|---|---|
| **A. Shared DB, row‑level `tenantId`** | Logical (enforced in app) | **Low–med** | Simple (one DB) | **Recommended** |
| B. Schema‑per‑tenant (one Postgres schema each) | Strong | High (260 tables × N schemas, migration fan‑out) | Medium | Overkill now |
| C. Database‑per‑tenant | Strongest | Highest (provisioning, connection routing) | Heavy | Only if a client contractually demands physical isolation |

**Recommendation: Option A.** It fits a Postgres + Prisma + existing‑project‑scoping system, needs no per‑tenant provisioning, and isolation is guaranteed by a *default‑deny* query layer (below) rather than developer discipline. B/C can be offered later to a specific client without changing app code much, because the `tenantId` is already there.

## 4. Data model
Add one model and a **single `tenantId` on the top‑level roots only** — children inherit tenancy through their parent, so we do **not** touch all 260 models.

```
model Tenant {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  status    String   @default("ACTIVE")
  createdAt DateTime @default(now())
}
```
Add `tenantId String` (+ `@@index([tenantId])`, FK → Tenant) to the **aggregate roots that are queried directly**, e.g.:
- `User` (a user belongs to one tenant — or a join table if cross‑tenant users are ever needed; single‑tenant‑per‑user is simpler and almost always right),
- `ProductionProject` (the spine — most data already hangs off a project),
- any other top‑level entity fetched without going through a project (e.g. Supplier, top‑level CRM, Locations library if global).

Everything reached **via a project** (scenes, strips, call sheets, transactions, revisions, …) does **not** need its own `tenantId` for correctness — it's reached through a tenant‑scoped parent. (We *may* still denormalise `tenantId` onto a few hot child tables later for query performance, but that's an optimisation, not a requirement.)

## 5. Enforcement — default‑deny, two layers
**Layer 1 — request context.** Add `tenantId` to the JWT claims at login. A NestJS request‑scoped `TenantContext` (or an `AsyncLocalStorage` store) reads it from the validated token on every request.

**Layer 2 — Prisma Client Extension (`$extends` query override).** A single extension wraps every model query: on **reads** (`findMany/findFirst/findUnique/count/aggregate`) it injects `where: { tenantId: ctx.tenantId }` for tenant‑scoped models; on **writes** (`create/createMany`) it sets `tenantId`; on `update/delete` it adds the tenant filter. Because it's applied by default to every call, **a developer who forgets to scope a query is still safe** — the opposite of relying on discipline.

This is defense‑in‑depth: the JWT decides the tenant, the extension enforces it on the only path to the database.

**Known bypasses to close:**
- **Raw SQL** (`$queryRaw`, `prisma db execute`, the NACHA/report raw bits) — must add explicit tenant filters; lint/grep for these and review each.
- **`(prisma as any)` calls** — still go through the client, so the extension still applies; fine.
- **Background jobs / schedulers / websocket gateways** that have no HTTP request → no JWT → must set the tenant context explicitly per job.
- **Super‑admin / cross‑tenant ops** (support tooling) → an explicit, audited "bypass" flag, never the default.

## 6. Migration & backfill (phased, data‑safe)
1. **Additive, nullable:** add `Tenant` + `tenantId String?` (nullable) on the roots → `prisma migrate dev --name add_tenancy`. No behaviour change yet.
2. **Seed + backfill:** create a default `Tenant` ("Studio One"); stamp every existing root row with its id; cascade is unnecessary (children inherit). One idempotent script.
3. **Enforce:** turn on the Prisma extension + JWT `tenantId` + context; keep a feature flag so it can be switched on per‑environment.
4. **Tighten:** once backfilled and verified, make `tenantId` **non‑null** + FK (`migrate dev`).
5. **Tests green at each step** (below) before advancing.

## 7. Testing (extends the harness we built)
- **Pure unit:** a `tenant-scope.util.ts` that builds the `where` clause → test that it always injects `tenantId`, merges with existing filters, and never widens them. (node:test, like the other 9 suites.)
- **Integration (fake Prisma):** drive a couple of services with a fake Prisma + two tenant contexts and assert tenant A never receives tenant B's rows, and writes always stamp the caller's tenant.
- **Bypass audit test:** a grep‑style test that fails if a new `$queryRaw` appears without a tenant filter (cheap guard).

## 8. Risks & mitigations
| Risk | Mitigation |
|---|---|
| A query leaks across tenants | Default‑deny extension (scoped by default) + integration tests |
| Raw SQL bypasses the extension | Inventory + explicit filters + the bypass‑audit test |
| Jobs without a request context write null/cross tenant | Require explicit `runAs(tenantId)` wrapper for all jobs |
| Backfill mis‑stamps rows | Run on a backup/staging first; verify counts per tenant before going non‑null |
| Performance (extra WHERE on big tables) | `@@index([tenantId])`; denormalise onto hot child tables only if profiling shows need |

## 9. Effort (rough)
- Phase 1–2 (model + backfill): ~0.5–1 day.
- Phase 3 (extension + JWT + context + raw‑SQL sweep): ~1–2 days, the careful part.
- Phase 4–5 (non‑null + tests): ~0.5 day.
Total ≈ **2–4 focused days**, gated by the test net already in place.

## 10. Decisions I need from you
1. **One tenant per user**, or allow a user to belong to multiple tenants (e.g. a freelancer across studios)? *(Single is simpler; recommend single for v1.)*
2. **Option A** confirmed (shared DB), or do you anticipate a client that contractually requires a **separate database** (Option C) — which would change the connection layer?
3. Tenant **provisioning** for v1: manual (we create tenants), or a self‑serve "create organisation" flow?

> Recommended default if you have no strong view: **single tenant per user, Option A, manual provisioning.** Answer these three and I'll start Phase 1 behind the tests.
