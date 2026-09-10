-- Restore the index 20260909020000 created. It is not in the database (checked 10 Sep: the
-- migration's checksum matches its file, yet pg_indexes has no development_builds_canonState_idx),
-- and schema.prisma never declared it — so a `prisma db push`, which syncs the database to the
-- schema, would drop it. The database has since disagreed with its own migration history, and that
-- is the state in which `prisma migrate dev` offers a RESET. The schema now declares the index.
--
-- ADDITIVE ONLY. IF NOT EXISTS makes it a no-op wherever the index survived and on a fresh replay.
CREATE INDEX IF NOT EXISTS "development_builds_canonState_idx" ON "development_builds"("canonState");
