-- Supplier payments: where the money came from, fee, and what the slip printed.
-- Additive only: new enums, nullable columns, one defaulted column, one index.
-- Spec: docs/superpowers/specs/2026-09-22-supplier-payments-paid-from-and-slips-design.md
CREATE TYPE "PaymentSource" AS ENUM ('COMPANY_BANK', 'CASH_ON_HAND', 'OWNER');
CREATE TYPE "AccountOwnership" AS ENUM ('COMPANY', 'OWNER');

ALTER TABLE "payments"
  ADD COLUMN "paidFrom" "PaymentSource",
  ADD COLUMN "feeAmount" DECIMAL(15,2),
  ADD COLUMN "beneficiary" TEXT,
  ADD COLUMN "beneficiaryAccount" TEXT,
  ADD COLUMN "payerAccountRef" TEXT;

CREATE INDEX "payments_reference_idx" ON "payments"("reference");

ALTER TABLE "bank_accounts"
  ADD COLUMN "ownership" "AccountOwnership" NOT NULL DEFAULT 'COMPANY',
  ADD COLUMN "cardLast4" TEXT;
