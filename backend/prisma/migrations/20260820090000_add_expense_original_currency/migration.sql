ALTER TABLE "expenses" ADD COLUMN "originalAmount" DECIMAL(15,2);
ALTER TABLE "expenses" ADD COLUMN "originalVatAmount" DECIMAL(15,2);
ALTER TABLE "expenses" ADD COLUMN "originalTotalAmount" DECIMAL(15,2);
ALTER TABLE "expenses" ADD COLUMN "fxRateToBase" DECIMAL(14,6);
ALTER TABLE "expenses" ADD COLUMN "fxRateSource" TEXT;
ALTER TABLE "expenses" ADD COLUMN "fxConvertedAt" TIMESTAMP(3);
ALTER TABLE "expenses" ADD COLUMN "originalCurrency" "Currency";
