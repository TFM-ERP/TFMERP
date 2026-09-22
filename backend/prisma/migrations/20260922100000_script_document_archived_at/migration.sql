-- Slates gain the builds' three-state model: active (both null), archived, binned.
-- Exclusivity is a property of the WRITES — archive clears deletedAt, trash clears archivedAt —
-- rather than a rule someone has to remember. Archived is indefinite; the 30-day sweep is keyed on
-- deletedAt, so an archived document is structurally unreachable by it.
ALTER TABLE "script_documents" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "script_documents_archivedAt_idx" ON "script_documents"("archivedAt");
