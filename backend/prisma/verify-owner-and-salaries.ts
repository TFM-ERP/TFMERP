/**
 * verify-owner-and-salaries.ts — READ ONLY.
 *
 * Before any owner pay is posted, this shows what is ALREADY in the two accounts
 * it would touch: 6000 Salaries & Wages and 2400 Owner Account (Loan). The risk
 * being guarded against is double counting — booking the owner's pay again when
 * some or all of it is already there under another name.
 *
 * Prints every 2025 journal entry touching either account, largest first.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

async function show(code: string, label: string): Promise<void> {
  const account = await prisma.glAccount.findFirst({ where: { code } });
  if (!account) {
    console.log(`\n  ${code} not found`);
    return;
  }

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: account.id,
      entry: {
        date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') },
      },
    },
    select: {
      debit: true,
      credit: true,
      description: true,
      entry: {
        select: { entryNumber: true, date: true, memo: true, sourceType: true },
      },
    },
  });

  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    debits += dec(line.debit);
    credits += dec(line.credit);
  }

  console.log(`\n=== ${code} ${label} — 2025 ===\n`);
  console.log(
    `  ${lines.length} lines · debits ${money(debits)} · credits ${money(credits)} · ` +
      `net ${money(debits - credits)}\n`,
  );

  const sorted = [...lines].sort(
    (a, b) =>
      Math.max(dec(b.debit), dec(b.credit)) - Math.max(dec(a.debit), dec(a.credit)),
  );

  for (const line of sorted.slice(0, 30)) {
    const value = dec(line.debit) > 0 ? dec(line.debit) : dec(line.credit);
    const side = dec(line.debit) > 0 ? 'Dr' : 'Cr';
    const memo = (line.entry.memo ?? line.description ?? '').replace(/\s+/g, ' ');
    console.log(
      `  ${line.entry.date.toISOString().slice(0, 10)}  ${side} ${money(value).padStart(13)}  ` +
        `${line.entry.entryNumber}  ${memo.slice(0, 92)}`,
    );
  }
  if (sorted.length > 30) {
    console.log(`  ... and ${sorted.length - 30} smaller lines`);
  }
}

async function main(): Promise<void> {
  await show('6000', 'Salaries & Wages');
  await show('2400', 'Owner Account (Loan)');
  await show('3200', 'Owner Drawings');

  console.log('\n=== THE OWNER ENTITLEMENT, AS STATED ===\n');
  const monthly = 35000;
  const housing = 90000;
  console.log(`  salary        ${money(monthly)} x 12 = ${money(monthly * 12).padStart(14)}`);
  console.log(`  housing allowance                ${money(housing).padStart(14)}`);
  console.log(`  TOTAL FOR 2025                   ${money(monthly * 12 + housing).padStart(14)}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
