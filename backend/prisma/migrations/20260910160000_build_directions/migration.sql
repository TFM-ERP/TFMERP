-- THE DIRECTION MOVES ONTO THE BUILD, WITH VERSIONS.
--
-- It lived in intake_profiles.treatment: ONE value per PROJECT, read live by every build in it,
-- overwritten by every pick, and saved as label + change + tone only. Project cmqocmg0 holds 25
-- builds and one direction; whichever build picked last steered all of them.
--
-- ADDITIVE: one new table, one nullable column. Nothing is altered, dropped or rewritten, and
-- intake_profiles is not touched — its text stays exactly where it is.

-- AlterTable
ALTER TABLE "development_builds" ADD COLUMN     "directionId" TEXT;

-- CreateTable
CREATE TABLE "build_directions" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "label" TEXT,
    "title" TEXT,
    "logline" TEXT,
    "keep" TEXT,
    "change" TEXT,
    "tone" TEXT,
    "risk" TEXT,
    "note" TEXT,
    "origin" TEXT NOT NULL,
    "legacyText" TEXT,
    "provenance" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "build_directions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "build_directions_buildId_n_key" ON "build_directions"("buildId", "n");

-- BACKFILL: ONLY WHERE THE EVIDENCE SAYS THE TEXT STEERED THE BUILD. NO SILENT COPY.
--
-- Copying the project's text onto every build in the project would write a false provenance onto
-- almost all of them — and "active" is not the test either: عنترة, Das and The Key are active in
-- project cmqocmg0, and every one of their stage versions predates the FAITHFUL text by months.
--
-- The test is the timeline. intake_profiles."updatedAt" is the LAST write of any intake field, so
-- the treatment has not changed since then: every stage version created AFTER it was generated under
-- exactly this text. A build with at least one such version gets the text as its v1, origin
-- 'inherited', with the counts on both sides of that write recorded in `provenance`. Every other
-- build is left with NO row and directionId NULL — "predates per-build directions": the direction it
-- was generated under was overwritten on the project and cannot be recovered.
--
-- Both timestamps are timestamp(3) without time zone, compared column to column, so no session time
-- zone can shift the comparison.
INSERT INTO "build_directions" ("id", "buildId", "n", "label", "origin", "legacyText", "provenance", "createdAt")
SELECT
    'bdmig' || substr(md5(e."buildId"), 1, 20) AS "id",
    e."buildId" AS "buildId",
    1 AS "n",
    e."label" AS "label",
    'inherited' AS "origin",
    e."treatment" AS "legacyText",
    'Inherited from the project-wide intake profile, the only place a direction was stored before per-build directions. '
      || 'That text was last written ' || to_char(e."written", 'YYYY-MM-DD HH24:MI:SS') || ' UTC. '
      || e."after" || ' of this build''s ' || (e."after" + e."before") || ' stage versions were generated after that write, under this text'
      || CASE WHEN e."before" > 0
              THEN '; ' || e."before" || ' were generated before it, under a direction that was overwritten and cannot be recovered.'
              ELSE '.' END
      || CASE WHEN length(e."treatment") = 600
              THEN ' The text is exactly 600 characters: it was cut by the write-time cap that has since been removed.'
              ELSE '' END AS "provenance",
    CURRENT_TIMESTAMP AS "createdAt"
FROM (
    SELECT b."id" AS "buildId",
           i."treatment" AS "treatment",
           i."updatedAt" AS "written",
           substring(i."treatment" from '^(FAITHFUL|RECONCEIVED|REINVENTION|BOLD|REIMAGINED)\M') AS "label",
           count(v."id") FILTER (WHERE v."createdAt" >  i."updatedAt") AS "after",
           count(v."id") FILTER (WHERE v."createdAt" <= i."updatedAt") AS "before"
    FROM "development_builds" b
    JOIN "intake_profiles" i ON i."projectId" = b."projectId"
    LEFT JOIN "development_stages" s ON s."buildId" = b."id"
    LEFT JOIN "stage_versions" v ON v."stageId" = s."id"
    WHERE i."treatment" ~ '^(FAITHFUL|RECONCEIVED|REINVENTION|BOLD|REIMAGINED)\M.* - change: '
    GROUP BY b."id", i."treatment", i."updatedAt"
) e
WHERE e."after" > 0;

UPDATE "development_builds" AS b
SET "directionId" = d."id"
FROM "build_directions" d
WHERE d."buildId" = b."id" AND d."n" = 1 AND d."origin" = 'inherited';
