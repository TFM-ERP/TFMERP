-- The ladder canon, stored. It lived in an in-memory map, so a build marked canonState 'ready'
-- certified facts that a restart erased and nobody could read back.
--
-- ADDITIVE ONLY: one new table, nothing altered, nothing dropped, no backfill. Builds already marked
-- 'ready' have no row here; the stage gate notices, extracts once, and stores it.
--
-- Keyed on (sha256 of the whole source, extractor version), not on a build or a project: a second
-- build on the same bible reuses the extraction instead of paying for it again.
CREATE TABLE "source_canons" (
    "id" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "extractorVersion" INTEGER NOT NULL,
    "sourceChars" INTEGER NOT NULL,
    "facts" JSONB NOT NULL,
    "account" JSONB NOT NULL,
    "register" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_canons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "source_canons_digest_extractorVersion_key" ON "source_canons"("digest", "extractorVersion");
