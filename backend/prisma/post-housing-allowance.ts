/**
 * post-housing-allowance.ts
 *
 * Charges the General Manager's 2025 housing allowance of 90,000.00.
 *
 * The salary element of the package — 35,000.00 a month, 420,000.00 for the year
 * — is already charged by JE-2026-0417, Dr 6000 Salaries / Cr 2400 Owner
 * Account. The housing allowance was never charged at all. It is part of the
 * same remuneration package, so it goes to the same two accounts:
 *
 *     31 Dec 2025   Dr 6000 Salaries & Wages       90,000.00
 *                   Cr 2400 Owner Account (Loan)   90,000.00
 *
 * It is credited to the owner account rather than paid, because it has not been
 * separately drawn — it increases what the company owes him.
 *
 * BASIS: confirmed by the General Manager on 20 September 2026, who holds the
 * employment documentation setting the package at 35,000.00 per month plus
 * 90,000.00 housing. That document should be attached to this entry before the
 * return is filed — this is a payment to a Connected Person under UAE corporate
 * tax and the FTA expects the basis to be evidenced and the amount to reflect
 * the market value of the service provided.
 *
 * Idempotent: refuses to run twice. Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');

const AMOUNT = 90000;
const POST_DATE = '2025-12-31';
const MEMO =
  '2025 housing allowance - General Manager. Part of the remuneration package of ' +
  '35,000.00 per month plus 90,000.00 housing; the salary element is charged by ' +
  'JE-2026-0417. Confirmed by the General Manager 20 Sep 2026, who holds the ' +
  'employment documentation. ATTACH THAT DOCUMENT TO THIS ENTRY BEFORE FILING - ' +
  'this is a Connected Person payment under UAE corporate tax and is deductible ' +
  'only to the extent it reflects the market value of the service provided.';

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

async function nextEntryNumber(tx: Prisma.TransactionClient): Promise<string> {
  const prefix = `JE-${new Date().getFullYear()}-`;
  const last = await tx.journalEntry.findMany({
    where: { entryNumber: { startsWith: prefix } },
    select: { entryNumber: true },
    orderBy: { entryNumber: 'desc' },
    take: 1,
  });
  const n = last.length > 0 ? parseInt(last[0].entryNumber.slice(-4), 10) : 0;
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');

  const already = await prisma.journalEntry.findFirst({
    where: { memo: { startsWith: '2025 housing allowance' } },
    select: { entryNumber: true, date: true },
  });
  if (already) {
    console.log(
      `  Already posted as ${already.entryNumber} ` +
        `(${already.date.toISOString().slice(0, 10)}). Nothing to do.`,
    );
    await prisma.$disconnect();
    return;
  }

  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: ['6000', '2400'] } },
    select: { id: true, code: true, name: true },
  });
  const account = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of ['6000', '2400']) {
    if (!account.has(code)) {
      throw new Error(`GL account ${code} was not found — nothing has been changed.`);
    }
  }

  // The salary charge must already be there, or the package is being booked
  // out of order and the owner account would not read correctly.
  const salaryCharge = await prisma.journalEntry.findFirst({
    where: { entryNumber: 'JE-2026-0417' },
    select: { entryNumber: true },
  });
  if (!salaryCharge) {
    throw new Error(
      'JE-2026-0417, the 420,000.00 salary charge, was not found. The housing ' +
        'allowance belongs with it — nothing has been changed.',
    );
  }

  console.log(`  Dr 6000 Salaries & Wages      ${money(AMOUNT).padStart(13)}`);
  console.log(`  Cr 2400 Owner Account (Loan)  ${money(AMOUNT).padStart(13)}`);
  console.log(`  dated ${POST_DATE}\n`);

  if (DRY) {
    console.log('=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const entryNumber = await nextEntryNumber(tx);
    await tx.journalEntry.create({
      data: {
        entryNumber,
        date: new Date(`${POST_DATE}T00:00:00.000Z`),
        memo: MEMO,
        source: 'SYSTEM',
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: account.get('6000')!,
              debit: AMOUNT,
              credit: 0,
              description: 'Housing allowance - General Manager',
            },
            {
              accountId: account.get('2400')!,
              debit: 0,
              credit: AMOUNT,
              description: 'Owner Account - housing allowance owed',
            },
          ],
        },
      },
    });
    console.log(`  posted ${entryNumber}`);
  });

  /* ---------------------------------------------------------------- verify */

  console.log('\n=== AFTER ===\n');

  const lines = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    debits += dec(line.debit);
    credits += dec(line.credit);
  }
  console.log(
    `  trial balance: debits ${money(debits)}  credits ${money(credits)}  ` +
      `difference ${money(debits - credits)}`,
  );

  const accountsAll = await prisma.glAccount.findMany({
    select: { id: true, code: true, name: true, type: true },
  });
  const byId = new Map(accountsAll.map((a) => [a.id, a]));
  const year = await prisma.journalLine.findMany({
    where: {
      entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } },
    },
    select: { accountId: true, debit: true, credit: true },
  });

  let revenue = 0;
  let expense = 0;
  let ownerAccount = 0;
  let salaries = 0;
  for (const line of year) {
    const a = byId.get(line.accountId);
    if (!a) continue;
    const net = dec(line.debit) - dec(line.credit);
    if (a.type === 'INCOME' || a.type === 'REVENUE') revenue += -net;
    if (a.type === 'EXPENSE') expense += net;
    if (a.code === '2400') ownerAccount += net;
    if (a.code === '6000') salaries += net;
  }

  console.log(`\n  6000 Salaries & Wages, 2025      ${money(salaries).padStart(14)}`);
  console.log(`  2400 Owner Account, 2025         ${money(ownerAccount).padStart(14)}`);
  console.log(`    (negative = the company owes the owner)`);
  console.log(`\n  revenue                          ${money(revenue).padStart(14)}`);
  console.log(`  expenses                         ${money(expense).padStart(14)}`);
  console.log(`  PROFIT                           ${money(revenue - expense).padStart(14)}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
