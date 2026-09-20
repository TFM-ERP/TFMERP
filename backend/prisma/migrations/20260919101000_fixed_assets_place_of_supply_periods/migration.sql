-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "accumulatedDepreciation" DECIMAL(15,2),
ADD COLUMN     "depreciationMethod" TEXT,
ADD COLUMN     "depreciationStartDate" TIMESTAMP(3),
ADD COLUMN     "isCompanyAsset" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "usefulLifeYears" INTEGER;
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "placeOfSupply" TEXT;
-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "periodType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "vat_returns" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "boxes" JSONB NOT NULL,
    "netVatDue" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "filedAt" TIMESTAMP(3),
    "filedById" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vat_returns_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "depreciation_runs" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "assetCount" INTEGER NOT NULL DEFAULT 0,
    "totalCharge" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "depreciation_runs_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "fiscal_periods_startDate_endDate_idx" ON "fiscal_periods"("startDate", "endDate");
-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_year_periodType_startDate_key" ON "fiscal_periods"("year", "periodType", "startDate");
-- CreateIndex
CREATE UNIQUE INDEX "vat_returns_periodStart_periodEnd_key" ON "vat_returns"("periodStart", "periodEnd");
-- CreateIndex
CREATE UNIQUE INDEX "depreciation_runs_periodStart_periodEnd_key" ON "depreciation_runs"("periodStart", "periodEnd");
