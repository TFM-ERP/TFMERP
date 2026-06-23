-- AlterTable
ALTER TABLE "AiRun" ADD COLUMN     "provider" TEXT;

-- AlterTable
ALTER TABLE "CoverageReport" ADD COLUMN     "analyticsId" TEXT,
ADD COLUMN     "scores" JSONB,
ADD COLUMN     "writerRecommendation" TEXT;

-- AlterTable
ALTER TABLE "annotations" ADD COLUMN     "resolved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "approval_requests" ADD COLUMN     "payload" JSONB,
ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "production_projects" ADD COLUMN     "coverage" JSONB,
ADD COLUMN     "creativeBrief" JSONB,
ADD COLUMN     "genre" TEXT,
ADD COLUMN     "logline" TEXT,
ADD COLUMN     "scriponWorkspace" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceBuildId" TEXT;

-- AlterTable
ALTER TABLE "script_documents" ADD COLUMN     "buildVersionId" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "llm_engines" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'PAID',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "credentialRef" TEXT,
    "baseUrl" TEXT,
    "defaultModel" TEXT,
    "models" JSONB,
    "capabilities" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "monthlyTokenCap" INTEGER,
    "freeTokenCap" INTEGER,
    "costModel" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_engines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_routing_policies" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'ORG',
    "projectId" TEXT,
    "capability" TEXT NOT NULL,
    "defaultEngineId" TEXT,
    "allowedEngineIds" JSONB,
    "fallbackChain" JSONB,
    "projectOverrideAllowed" BOOLEAN NOT NULL DEFAULT false,
    "userMayOverride" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_routing_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_stages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT,
    "kind" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "currentVersionId" TEXT,
    "buildId" TEXT,
    "buildVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "development_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_versions" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "n" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "body" TEXT,
    "data" JSONB,
    "framework" TEXT,
    "colorCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "aiRunId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_profiles" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "sourceText" TEXT,
    "sourceUrl" TEXT,
    "sourceFileUrl" TEXT,
    "realBased" BOOLEAN NOT NULL DEFAULT false,
    "realityLevel" TEXT,
    "researchSubject" BOOLEAN NOT NULL DEFAULT true,
    "researchAmount" INTEGER NOT NULL DEFAULT 50,
    "genres" JSONB,
    "tone" TEXT,
    "fantasyOn" BOOLEAN NOT NULL DEFAULT false,
    "fantasyType" TEXT,
    "mythicalElements" JSONB,
    "mythologyCulture" TEXT,
    "blendLevel" TEXT,
    "format" TEXT,
    "language" TEXT,
    "country" TEXT,
    "rating" TEXT,
    "length" TEXT,
    "comps" JSONB,
    "spine" JSONB,
    "constraints" JSONB,
    "researchScope" JSONB,
    "researchDepth" INTEGER NOT NULL DEFAULT 50,
    "blendLayers" JSONB,
    "treatment" TEXT,
    "settingPlace" JSONB,
    "settingEra" TEXT,
    "settingWorld" JSONB,
    "cultureEra" TEXT,
    "sensitivityTier" TEXT,
    "guardrails" JSONB,
    "projectIntent" TEXT,
    "budgetTier" TEXT,
    "sourceKind" TEXT,
    "buildId" TEXT,
    "sources" JSONB,
    "projectType" TEXT,
    "episodes" INTEGER,
    "minutesPerEp" INTEGER,
    "seasons" INTEGER,
    "loreSelections" JSONB,
    "loreDensity" TEXT,
    "lorePolicy" JSONB,
    "researchNotes" TEXT,
    "characterBible" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lore_elements" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "culture" TEXT NOT NULL,
    "region" TEXT,
    "genres" JSONB NOT NULL,
    "archetypes" JSONB NOT NULL,
    "tier" TEXT NOT NULL,
    "blurb" TEXT NOT NULL,
    "origin" TEXT,
    "variants" JSONB,
    "hooks" JSONB,
    "aliases" JSONB,
    "sources" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lore_elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_builds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "projectId" TEXT,
    "linkedProjectId" TEXT,
    "linkedScriptId" TEXT,
    "promotedVersionId" TEXT,
    "promotedAt" TIMESTAMP(3),
    "activeVersionId" TEXT,
    "brief" JSONB,
    "characterBible" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "development_builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "build_versions" (
    "id" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "n" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT,
    "briefSnapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "build_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dialect_exemplars" (
    "id" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "msa" TEXT,
    "dialect" TEXT NOT NULL,
    "note" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dialect_exemplars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_analytics" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT,
    "revisionId" TEXT,
    "network" JSONB,
    "dialogue" JSONB,
    "pacing" JSONB,
    "arc" JSONB,
    "charge" JSONB,
    "structure" JSONB,
    "representation" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "script_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_notes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "revisionId" TEXT,
    "sceneId" TEXT,
    "sceneNumber" TEXT,
    "category" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coverage_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_profiles" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "revisionId" TEXT,
    "role" TEXT NOT NULL,
    "importance" TEXT,
    "ageRange" TEXT,
    "gender" TEXT,
    "physicality" TEXT,
    "energy" TEXT,
    "arc" TEXT,
    "wardrobeNote" TEXT,
    "lookRefs" JSONB,
    "scenesPct" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lookboard_images" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'LOCATION',
    "url" TEXT NOT NULL,
    "source" TEXT,
    "license" TEXT,
    "attribution" TEXT,
    "provenance" JSONB,
    "caption" TEXT,
    "sceneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookboard_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comps" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER,
    "budgetTier" TEXT,
    "metrics" JSONB,
    "source" TEXT,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_reads" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "revisionId" TEXT,
    "quadrant" JSONB,
    "ranges" JSONB,
    "confidence" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_protection_settings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'standard',
    "activeProfileId" TEXT,
    "config" JSONB,
    "settingsVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_protection_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_protection_profiles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isSystemProfile" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_protection_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notice_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "protected_export_records" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "scriptDocumentId" TEXT,
    "revisionId" TEXT,
    "copyId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "profileId" TEXT,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "recipientNote" TEXT,
    "channel" TEXT,
    "pageCount" INTEGER,
    "checksum" TEXT,
    "bytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "failureReason" TEXT,
    "settingsSnapshot" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedAt" TIMESTAMP(3),

    CONSTRAINT "protected_export_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "llm_engines_key_key" ON "llm_engines"("key");

-- CreateIndex
CREATE INDEX "llm_routing_policies_projectId_idx" ON "llm_routing_policies"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "llm_routing_policies_scope_projectId_capability_key" ON "llm_routing_policies"("scope", "projectId", "capability");

-- CreateIndex
CREATE INDEX "development_stages_projectId_idx" ON "development_stages"("projectId");

-- CreateIndex
CREATE INDEX "development_stages_buildVersionId_idx" ON "development_stages"("buildVersionId");

-- CreateIndex
CREATE INDEX "stage_versions_stageId_idx" ON "stage_versions"("stageId");

-- CreateIndex
CREATE UNIQUE INDEX "intake_profiles_projectId_key" ON "intake_profiles"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "lore_elements_slug_key" ON "lore_elements"("slug");

-- CreateIndex
CREATE INDEX "lore_elements_culture_idx" ON "lore_elements"("culture");

-- CreateIndex
CREATE INDEX "development_builds_projectId_idx" ON "development_builds"("projectId");

-- CreateIndex
CREATE INDEX "development_builds_linkedProjectId_idx" ON "development_builds"("linkedProjectId");

-- CreateIndex
CREATE INDEX "development_builds_deletedAt_idx" ON "development_builds"("deletedAt");

-- CreateIndex
CREATE INDEX "build_versions_buildId_idx" ON "build_versions"("buildId");

-- CreateIndex
CREATE INDEX "dialect_exemplars_variety_idx" ON "dialect_exemplars"("variety");

-- CreateIndex
CREATE INDEX "script_analytics_projectId_idx" ON "script_analytics"("projectId");

-- CreateIndex
CREATE INDEX "script_analytics_revisionId_idx" ON "script_analytics"("revisionId");

-- CreateIndex
CREATE INDEX "coverage_notes_projectId_idx" ON "coverage_notes"("projectId");

-- CreateIndex
CREATE INDEX "coverage_notes_sceneId_idx" ON "coverage_notes"("sceneId");

-- CreateIndex
CREATE INDEX "role_profiles_projectId_idx" ON "role_profiles"("projectId");

-- CreateIndex
CREATE INDEX "lookboard_images_projectId_idx" ON "lookboard_images"("projectId");

-- CreateIndex
CREATE INDEX "comps_projectId_idx" ON "comps"("projectId");

-- CreateIndex
CREATE INDEX "market_reads_projectId_idx" ON "market_reads"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "review_protection_settings_projectId_key" ON "review_protection_settings"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "review_protection_profiles_slug_key" ON "review_protection_profiles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "notice_templates_slug_key" ON "notice_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "protected_export_records_copyId_key" ON "protected_export_records"("copyId");

-- CreateIndex
CREATE INDEX "protected_export_records_projectId_idx" ON "protected_export_records"("projectId");

-- CreateIndex
CREATE INDEX "protected_export_records_scriptDocumentId_idx" ON "protected_export_records"("scriptDocumentId");

-- CreateIndex
CREATE INDEX "protected_export_records_copyId_idx" ON "protected_export_records"("copyId");

-- CreateIndex
CREATE INDEX "approval_requests_projectId_idx" ON "approval_requests"("projectId");

-- AddForeignKey
ALTER TABLE "stage_versions" ADD CONSTRAINT "stage_versions_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "development_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

