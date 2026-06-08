/**
 * One-time cleanup for bank accounts so invoices/quotations and Company
 * Management all use the single shared `bankAccount` table.
 *
 *  1. Copy any rows from the old `companyBankAccount` table into `bankAccount`.
 *  2. Remove the demo "Emirates NBD" seed accounts (bank-aed / bank-usd).
 *  3. If exactly one active account remains, make it the default.
 *
 * Run:  npx ts-node prisma/migrate-bank-accounts.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1) Migrate old company bank accounts → shared bankAccount table
  let migrated = 0;
  try {
    const oldRows: any[] = await (prisma as any).companyBankAccount.findMany();
    for (const o of oldRows) {
      // Skip if an identical IBAN/account already exists in the shared table
      const exists = await prisma.bankAccount.findFirst({
        where: {
          OR: [
            o.iban ? { iban: o.iban } : undefined,
            o.accountNumber ? { accountNumber: o.accountNumber } : undefined,
          ].filter(Boolean) as any,
        },
      });
      if (exists) continue;
      await prisma.bankAccount.create({
        data: {
          accountName: o.accountName,
          bankName: o.bankName,
          branch: o.branch || undefined,
          accountNumber: o.accountNumber || undefined,
          iban: o.iban || undefined,
          swiftCode: o.swift || undefined,
          currency: o.currency || 'AED',
          bankAddress: o.bankAddress || undefined,
          isDefaultInvoice: !!o.isDefault,
          isDefaultQuotation: !!o.isDefault,
          isDefaultReceiving: !!o.isDefault,
          isActive: o.isActive ?? true,
        },
      });
      migrated++;
    }
  } catch (e) {
    console.log('  (no old companyBankAccount table / nothing to migrate)');
  }

  // 2) Remove the demo Emirates NBD seed accounts
  const removed = await prisma.bankAccount.deleteMany({
    where: { id: { in: ['bank-aed', 'bank-usd'] } },
  }).catch(async () => {
    // If they're referenced by invoices, soft-delete instead of hard delete
    return prisma.bankAccount.updateMany({
      where: { id: { in: ['bank-aed', 'bank-usd'] } },
      data: { isActive: false, isDefaultInvoice: false, isDefaultQuotation: false },
    });
  });

  // 3) Ensure a sensible default remains
  const active = await prisma.bankAccount.findMany({ where: { isActive: true } });
  const hasDefault = active.some((a) => a.isDefaultInvoice);
  if (!hasDefault && active.length > 0) {
    await prisma.bankAccount.update({
      where: { id: active[0].id },
      data: { isDefaultInvoice: true, isDefaultQuotation: true, isDefaultReceiving: true },
    });
  }

  console.log('── Bank account cleanup complete ──');
  console.log(`  Migrated from old table: ${migrated}`);
  console.log(`  Emirates NBD seed rows handled: ${(removed as any).count ?? 0}`);
  console.log(`  Active accounts now: ${active.length}`);
  for (const a of active) {
    console.log(`    • ${a.bankName} — ${a.accountName}${a.isDefaultInvoice ? '  [default]' : ''}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
