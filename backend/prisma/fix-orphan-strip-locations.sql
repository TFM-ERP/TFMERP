-- Run BEFORE `npm run db:push` when adding the ProductionStrip -> Location relation.
-- Nulls any strip locationId that points at a non-existent location, so the new
-- foreign key can be created cleanly. Safe & idempotent.
UPDATE production_strips
SET "locationId" = NULL
WHERE "locationId" IS NOT NULL
  AND "locationId" NOT IN (SELECT id FROM locations);
