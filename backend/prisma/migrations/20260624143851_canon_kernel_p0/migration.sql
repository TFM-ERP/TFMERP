-- CreateEnum
CREATE TYPE "CanonKind" AS ENUM ('CHARACTER', 'WORLD', 'LORE', 'TIMELINE', 'RELATIONSHIP', 'PLOT');

-- CreateTable
CREATE TABLE "canon_facts" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "kind" "CanonKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "object" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "validFrom" INTEGER NOT NULL,
    "validTo" INTEGER,
    "recordedAt" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sourceSceneId" TEXT,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canon_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_relations" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "fromSceneId" TEXT NOT NULL,
    "toSceneId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_records" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "context" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "consequences" TEXT NOT NULL,
    "supersedesId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_passes" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "baseVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "continuityScore" DOUBLE PRECISION,
    "renderedVersionId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_changes" (
    "id" TEXT NOT NULL,
    "passId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "previewBefore" TEXT,
    "previewAfter" TEXT,
    "status" TEXT NOT NULL DEFAULT 'STAGED',
    "relatedAffected" JSONB,
    "integrity" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scene_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canon_facts_scriptId_subject_predicate_idx" ON "canon_facts"("scriptId", "subject", "predicate");

-- CreateIndex
CREATE INDEX "canon_facts_scriptId_validFrom_idx" ON "canon_facts"("scriptId", "validFrom");

-- CreateIndex
CREATE INDEX "scene_relations_scriptId_fromSceneId_idx" ON "scene_relations"("scriptId", "fromSceneId");

-- CreateIndex
CREATE INDEX "scene_relations_scriptId_toSceneId_idx" ON "scene_relations"("scriptId", "toSceneId");

-- CreateIndex
CREATE INDEX "decision_records_scriptId_createdAt_idx" ON "decision_records"("scriptId", "createdAt");

-- CreateIndex
CREATE INDEX "revision_passes_scriptId_status_idx" ON "revision_passes"("scriptId", "status");

-- CreateIndex
CREATE INDEX "scene_changes_passId_idx" ON "scene_changes"("passId");

-- AddForeignKey
ALTER TABLE "scene_changes" ADD CONSTRAINT "scene_changes_passId_fkey" FOREIGN KEY ("passId") REFERENCES "revision_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
