# Adopting Prisma Migrations (Pre-0 foundation)

The project has been running on `prisma db push` with **no migration history**, so the
schema drifts ahead of the live database (this is what caused the "scaffold 500" — a
column existed in the schema but not in the DB). Adopting migrations fixes that class of
bug permanently and makes deploys/rollbacks safe.

> ⚠️ Run these on **your machine** (where Prisma + the database live). They are
> **non-destructive**. **Never run `prisma migrate reset`** — it drops all data.

## One-time baseline (do this once)

```bash
cd C:\Projects\TFM-System\backend

# 0) Back up first (recommended)
#    pg_dump "<your DATABASE_URL>" > backup_before_baseline.sql

# 1) Bring the live DB in sync with the current schema (adds AiRun + any pending columns; additive)
npm run db:push

# 2) Generate the baseline migration from the current schema (writes SQL, touches no DB)
mkdir prisma\migrations\0_init
npm run migrate:baseline > prisma\migrations\0_init\migration.sql

# 3) Mark the baseline as already-applied (because step 1 already made the DB match) — no SQL runs
npx prisma migrate resolve --applied 0_init

# 4) Confirm
npm run migrate:status   # should report: Database schema is up to date
```

## From now on (every schema change)

```bash
# edit prisma/schema.prisma, then:
npm run migrate            # = prisma migrate dev  (creates + applies a new migration locally)
# in production / CI:
npm run migrate:deploy     # = prisma migrate deploy (applies pending migrations only)
```

`prisma/migrations/migration_lock.toml` is already created (provider = postgresql).
After this, `db push` is no longer the deploy path — migrations are.

## Why this is Pre-0
Everything in the ScripON Doctor roadmap writes new tables; without migrations those
writes 500 the same way the brief did. Migrations + the unified `AiService` (already added
in `src/ai/`) are the two foundations the rest of the build stands on.
