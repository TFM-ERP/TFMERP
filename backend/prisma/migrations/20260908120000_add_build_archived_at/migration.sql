-- Archive: a third state beside active and binned. Additive and nullable, so nothing is migrated
-- automatically -- what is in the bin stays in the bin until it is moved by hand.
ALTER TABLE "development_builds" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "development_builds_archivedAt_idx" ON "development_builds"("archivedAt");
