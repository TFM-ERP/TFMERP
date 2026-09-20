/** READ-ONLY. Is the Abu Dhabi Printing & Publishing invoice 114104 recorded? */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('=== SUPPLIERS MATCHING "print" ===');
  const sups = await prisma.supplier.findMany({
    where: { OR: [{ name: { contains: 'print', mode: 'insensitive' } }, { trn: '100318777800003' }] },
    select: { id: true, name: true, trn: true, country: true },
  });
  console.log(sups.length ? JSON.stringify(sups, null, 2) : '  (none)');

  console.log('\n=== EXPENSES MATCHING 8006.25 / 7625 / 22999.2 / 381.25 ===');
  const exps = await prisma.expense.findMany({
    where: {
      OR: [
        { amount: { in: [8006.25, 7625, 22999.2, 21904] } },
        { vatAmount: { in: [381.25, 1095.2] } },
        { description: { contains: 'print', mode: 'insensitive' } },
        { invoiceNumber: { contains: "114104" } },
      ],
    },
    include: { supplier: { select: { name: true } } },
    orderBy: { expenseDate: "asc" },
  });
  for (const e of exps) {
    console.log(
      `  ${e.expenseDate.toISOString().slice(0, 10)} | ${e.supplier?.name ?? '(no supplier)'} | amt=${
        e.amount
      } vat=${e.vatAmount} | ref=${e.invoiceNumber ?? ""} | ${e.description ?? ''}`,
    );
  }
  if (exps.length === 0) console.log('  (none)');

  console.log('\n=== 2025 EXPENSES IN APRIL/MAY 2025 ===');
  const apr = await prisma.expense.findMany({
    where: {
      expenseDate: { gte: new Date("2025-04-01T00:00:00Z"), lt: new Date("2025-06-01T00:00:00Z") },
    },
    include: { supplier: { select: { name: true } } },
    orderBy: { expenseDate: "asc" },
  });
  for (const e of apr) {
    console.log(
      `  ${e.expenseDate.toISOString().slice(0, 10)} | ${e.supplier?.name ?? '(none)'} | amt=${
        e.amount
      } vat=${e.vatAmount} | ${(e.description ?? '').slice(0, 60)}`,
    );
  }
  console.log(`  (${apr.length})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
