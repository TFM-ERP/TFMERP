-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('RECEIPT', 'PAYMENT');
-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_clientId_fkey";
-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_invoiceId_fkey";
-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "direction" "PaymentDirection" NOT NULL DEFAULT 'RECEIPT',
ADD COLUMN     "expenseId" TEXT,
ADD COLUMN     "supplierId" TEXT,
ALTER COLUMN "invoiceId" DROP NOT NULL,
ALTER COLUMN "clientId" DROP NOT NULL;
-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
