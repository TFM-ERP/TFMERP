CREATE TYPE "DocumentKind" AS ENUM ('SOURCE','GENERATED','SUPPORTING');

CREATE TABLE "document_attachments" (
  "id" TEXT NOT NULL,
  "entityType" "AttachmentEntity" NOT NULL,
  "entityId" TEXT NOT NULL,
  "kind" "DocumentKind" NOT NULL DEFAULT 'SOURCE',
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'UPLOAD',
  "url" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "sourceRef" TEXT,
  "notes" TEXT,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_attachments_entityType_entityId_idx" ON "document_attachments"("entityType","entityId");

CREATE INDEX "document_attachments_sourceRef_idx" ON "document_attachments"("sourceRef");
