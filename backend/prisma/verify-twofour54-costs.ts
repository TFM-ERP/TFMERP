/**
 * verify-twofour54-costs.ts — READ ONLY.
 *
 * The General Manager has flagged two 2025 costs:
 *   CMA licence renewal            10,000.00 + 500.00 VAT   = 10,500.00
 *   twofour54 desk / agreement     20,000.00 + 1,000.00 VAT = 21,000.00
 *
 * This checks whether either is already in the ledger, so that scanning the
 * invoices later adds the VAT detail rather than a second copy of the cost.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

async function main(): Promise<void> {
  console.log('=== JOURNAL ENTRIES MENTIONING twofour54, 2025 ===\n');

  const entries = await prisma.journalEntry.findMany({
    where: {
      date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') },
      OR: [
        { memo: { contains: 'twofour', mode: 'insensitive' } },
        { memo: { contains: 'two four', mode: 'insensitive' } },
        { memo: { contains: 'CMA', mode: 'insensitive' } },
        { memo: { contains: 'licence', mode: 'insensitive' } },
        { memo: { contains: 'license', mode: 'insensitive' } },
      ],
    },
    select: {
      entryNumber: true,
      date: true,
      memo: true,
      lines: {
        select: {
          debit: true,
          credit: true,
          account: { select: { code: true, name: true } },
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  let total = 0;
  for (const entry of entries) {
    const charge = entry.lines
      .filter((l) => dec(l.debit) > 0 && l.account.code !== '1010')
      .reduce((sum, l) => sum + dec(l.debit), 0);
    total += charge;
    console.log(
      `  ${entry.date.toISOString().slice(0, 10)}  ${money(charge).padStart(11)}  ` +
        `${entry.entryNumber}  ${(entry.memo ?? '').replace(/\s+/g, ' ').slice(0, 86)}`,
    );
  }
  console.log(`\n  ${entries.length} entries, ${money(total)} charged`);

  console.log('\n=== EXPENSE ROWS FOR twofour54 OR THE LICENCE ===\n');
  const expenses = await prisma.expense.findMany({
    where: {
      OR: [
        { vendorName: { contains: 'twofour', mode: 'insensitive' } },
        { vendorName: { contains: 'two four', mode: 'insensitive' } },
        { description: { contains: 'licence', mode: 'insensitive' } },
        { description: { contains: 'license', mode: 'insensitive' } },
        { description: { contains: 'CMA', mode: 'insensitive' } },
      ],
    },
    select: {
      expenseNumber: true,
      expenseDate: true,
      vendorName: true,
      amount: true,
      vatAmount: true,
      totalAmount: true,
      description: true,
      status: true,
    },
    orderBy: { expenseDate: 'asc' },
  });

  if (expenses.length === 0) {
    console.log('  none — the cost exists only as the bank payment');
  } else {
    for (const e of expenses) {
      console.log(
        `  ${e.expenseDate.toISOString().slice(0, 10)}  ${e.expenseNumber.padEnd(22)}` +
          `net ${money(dec(e.amount)).padStart(10)}  VAT ${money(dec(e.vatAmount)).padStart(8)}  ` +
          `${(e.vendorName ?? '').slice(0, 24).padEnd(26)}${e.status}`,
      );
    }
  }

  console.log('\n=== 6100 RENT & UTILITIES, 2025 ===\n');
  const rent = await prisma.glAccount.findFirst({ where: { code: '6100' } });
  if (rent) {
    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: rent.id,
        entry: {
          date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') },
        },
      },
      select: { debit: true },
    });
    const sum = lines.reduce((s, l) => s + dec(l.debit), 0);
    console.log(`  ${lines.length} lines, ${money(sum)}`);
  }

  console.log('\n=== INPUT VAT RECOVERABLE ON THESE TWO, IF THE INVOICES EXIST ===\n');
  console.log(`  CMA licence renewal          500.00`);
  console.log(`  twofour54 desk / agreement 1,000.00`);
  console.log(`  ---------------------------------`);
  console.log(`  recoverable                1,500.00`);
  console.log(
    '\n  Both bank payments are posted GROSS to 6100. Splitting the VAT out\n' +
      '  needs the tax invoices — a card slip is not enough for the FTA.',
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
