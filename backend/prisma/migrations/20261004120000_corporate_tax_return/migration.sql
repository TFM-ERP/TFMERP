-- ─────────────────────────────────────────────────────────────────────────────────────────────
-- NOT APPLIED. NOT IN prisma/migrations/. DO NOT RUN THIS FILE.
--
-- Staged under prisma/pending-migrations/ on purpose: Prisma only scans prisma/migrations/, so a
-- `migrate deploy` run by ANYONE — including the ScriptON session, which shares this database —
-- cannot pick it up from here. Nothing touches the database without Qais's explicit "apply"
-- (handoff/schema-coordination.md, rule 4), and a file sitting in the scanned directory would arm
-- exactly the accident that rule exists to prevent.
--
-- ON "apply", IN THIS ORDER:
--
--   1. THE BACKUP. Full dump, from backend/:
--        U=$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')
--        F=../backups/pre-cttax-$(date +%Y%m%d-%H%M%S).dump
--        pg_dump "$U" -Fc -f "$F"
--      VERIFY before trusting it:
--        pg_restore -l "$F" | grep -c "TABLE DATA"     -- must read 295
--   2. confirm the ScriptON session is not mid-`migrate deploy` (rule 5)
--   3. git mv this directory to backend/prisma/migrations/20261004120000_corporate_tax_return
--   4. npm run migrate:deploy      (NEVER migrate dev, db push, or migrate diff output)
--   5. declare the model + enum values in schema.prisma, then prisma generate — in THIS tree only
--   6. re-verify: pg_restore -l on a fresh dump reads 296 TABLE DATA
--
-- TIMESTAMP. 20261004120000 sorts after 20261003120000_script_revision_scene_plan, which is the
-- newest applied row in _prisma_migrations (ScriptON, 3 Oct, commit b13022b). That migration is
-- NOT present on feat/invoice-lifecycle, so `migrate status` lists it as applied-but-missing.
-- That is correct — do not delete the row or copy the folder across (rule 6). Re-check the floor
-- before moving this directory; ScriptON may have applied more since 4 Oct.
--
-- WHY THE ENUM VALUES GO IN FIRST AND ARE NOT USED HERE. PostgreSQL permits ALTER TYPE … ADD VALUE
-- inside a transaction on 12+ only if the new value is not USED in the same transaction. Prisma
-- wraps a migration in one transaction. So this file adds the values and the table and inserts
-- nothing. Seeding the 2025 row and its three DocumentAttachment rows is a separate step, after
-- this migration has committed.
-- ─────────────────────────────────────────────────────────────────────────────────────────────

-- WHAT THIS IS FOR. The 2025 corporate tax return was filed on 26 September 2026 — reference
-- 230011764675, AED 0 payable, a 73,929 loss carried forward — and nothing in the schema could
-- record that it had happened. VatReturn already exists with periodStart/periodEnd, status
-- DRAFT|FILED, filedAt and reference; there was no corporate tax equivalent. Three PDFs sat in a
-- folder on Qais's machine as the only evidence.
--
-- AttachmentEntity also had no value for either tax return, so no FTA acknowledgement could be
-- attached to a CT return OR to a VAT return. Both values are added here; VAT_RETURN costs nothing
-- now and closes the identical gap on the model that already exists.

ALTER TYPE "AttachmentEntity" ADD VALUE IF NOT EXISTS 'CORPORATE_TAX_RETURN';
ALTER TYPE "AttachmentEntity" ADD VALUE IF NOT EXISTS 'VAT_RETURN';

-- schedules: the accounting schedules as submitted to the FTA, so a later regeneration can be
-- compared against what actually went rather than silently replacing it. Same intent as
-- VatReturn.boxes.
--
-- accountingIncome and taxableIncome are separate columns even though they are equal for 2025.
-- They diverge the moment there is a non-deductible adjustment, and collapsing them would hide
-- the adjustment that caused the divergence.
--
-- lossCarriedForward is stored as declared (whole dirhams, 73929), not as the books' 73929.74.
-- The FTA's record is the one that governs the carry-forward.
--
-- No relation field to DocumentAttachment: that model is keyed by entityType + entityId and every
-- existing attachment works that way.

CREATE TABLE "corporate_tax_returns" (
    "id"                  TEXT           NOT NULL,
    "periodStart"         TIMESTAMP(3)   NOT NULL,
    "periodEnd"           TIMESTAMP(3)   NOT NULL,
    "schedules"           JSONB          NOT NULL,
    "accountingIncome"    DECIMAL(15,2)  NOT NULL,
    "taxableIncome"       DECIMAL(15,2)  NOT NULL,
    "taxPayable"          DECIMAL(15,2)  NOT NULL DEFAULT 0,
    "lossCarriedForward"  DECIMAL(15,2)  NOT NULL DEFAULT 0,
    "smallBusinessRelief" BOOLEAN        NOT NULL DEFAULT false,
    "status"              TEXT           NOT NULL DEFAULT 'DRAFT',
    "filedAt"             TIMESTAMP(3),
    "filedById"           TEXT,
    "reference"           TEXT,
    "notes"               TEXT,
    "createdAt"           TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)   NOT NULL,

    CONSTRAINT "corporate_tax_returns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "corporate_tax_returns_periodStart_periodEnd_key"
    ON "corporate_tax_returns"("periodStart", "periodEnd");
