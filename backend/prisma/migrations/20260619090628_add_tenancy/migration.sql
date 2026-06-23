-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "master_scripts" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "production_projects" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "assets_tenantId_idx" ON "assets"("tenantId");

-- CreateIndex
CREATE INDEX "contacts_tenantId_idx" ON "contacts"("tenantId");

-- CreateIndex
CREATE INDEX "master_scripts_tenantId_idx" ON "master_scripts"("tenantId");

-- CreateIndex
CREATE INDEX "production_projects_tenantId_idx" ON "production_projects"("tenantId");

-- CreateIndex
CREATE INDEX "suppliers_tenantId_idx" ON "suppliers"("tenantId");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");
