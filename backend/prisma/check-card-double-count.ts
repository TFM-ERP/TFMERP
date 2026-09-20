/**
 * check-card-double-count.ts — READ ONLY.
 *
 * Checks a mistake in post-card-spending.ts.
 *
 * That script posted every card line as Dr <expense> / Cr 1010 Bank. That is
 * right ONLY where the cost is not already in the ledger. Where a supplier
 * invoice was already entered — Dr expense / Cr 2000 Accounts Payable — the
 * card payment does not create a second cost: it settles the payable, and the
 * correct posting is Dr 2000 / Cr 1010.
 *
 * Posting it as an expense a second time overstates costs and understates
 * profit by the same amount, and leaves the payable sitting there unpaid.
 *
 * This finds every [CARD2025] entry whose amount matches an expense row already
 * in the ledger, so the size of the double count is measured rather than
 * guessed.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/** Amounts this close are treated as the same money. */
const TOLERANCE = 0.05;
/** How far apart a bank payment and its invoice may sit and still be a pair. */
const WINDOW_DAYS = 60;

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

const days = (a: Date, b: Date): number =>
  Math.round(Math.abs(a.getTime() - b.getTime()) / 86400000);

async function main(): Promise<void> {
  const entries = await prisma.journalEntry.findMany({
    where: { memo: { startsWith: '[CARD2025]' } },
    select: {
      entryNumber: true,
      date: true,
      memo: true,
      lines: {
        select: { debit: true, account: { select: { code: true } } },
      },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`=== ${entries.length} CARD ENTRIES POSTED ===\n`);

  const expenses = await prisma.expense.findMany({
    where: {
      expenseDate: { gte: new Date('2024-11-01'), lte: new Date('2026-03-31') },
    },
    select: {
      expenseNumber: true,
      expenseDate: true,
      totalAmount: true,
      amount: true,
      vatAmount: true,
      vendorName: true,
      status: true,
    },
  });

  // Only an expense that was actually posted creates a payable to settle.
  const posted = new Set<string>();
  const expenseJournals = await prisma.journalEntry.findMany({
    where: { sourceType: 'EXPENSE' },
    select: { sourceId: true },
  });
  const expenseIds = new Set(expenseJournals.map((j) => j.sourceId).filter(Boolean) as string[]);
  const withIds = await prisma.expense.findMany({
    where: { id: { in: [...expenseIds] } },
    select: { id: true, expenseNumber: true },
  });
  for (const e of withIds) posted.add(e.expenseNumber);

  let overlapTotal = 0;
  const hits: string[] = [];

  for (const entry of entries) {
    const charge = entry.lines
      .filter((l) => dec(l.debit) > 0)
      .reduce((sum, l) => sum + dec(l.debit), 0);
    if (charge <= 0) continue;

    const candidates = expenses.filter(
      (e) =>
        Math.abs(dec(e.totalAmount) - charge) < TOLERANCE &&
        days(e.expenseDate, entry.date) <= WINDOW_DAYS,
    );
    if (candidates.length === 0) continue;

    const best = candidates.sort(
      (a, b) => days(a.expenseDate, entry.date) - days(b.expenseDate, entry.date),
    )[0];

    const wasPosted = posted.has(best.expenseNumber);
    overlapTotal += charge;
    hits.push(
      `  ${entry.date.toISOString().slice(0, 10)}  ${money(charge).padStart(11)}  ` +
        `${entry.entryNumber}  -> ${best.expenseNumber.padEnd(22)}` +
        `${(best.vendorName ?? '').slice(0, 22).padEnd(24)}` +
        `${best.status.padEnd(18)}${wasPosted ? 'POSTED — DOUBLE COUNT' : 'not posted'}`,
    );
  }

  console.log('=== CARD ENTRIES THAT MATCH AN EXISTING EXPENSE ROW ===\n');
  if (hits.length === 0) {
    console.log('  none — no double counting found');
  } else {
    for (const hit of hits) console.log(hit);
    console.log(`\n  ${hits.length} entries, ${money(overlapTotal)} of overlap`);
  }

  console.log('\n=== THE TWO ACCOUNTS INVOLVED ===\n');
  for (const code of ['2000', '6100']) {
    const account = await prisma.glAccount.findFirst({ where: { code } });
    if (!account) continue;
    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        entry: {
          date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') },
        },
      },
      select: { debit: true, credit: true },
    });
    let dr = 0;
    let cr = 0;
    for (const l of lines) {
      dr += dec(l.debit);
      cr += dec(l.credit);
    }
    console.log(
      `  ${code} ${account.name.padEnd(28)} Dr ${money(dr).padStart(13)}  ` +
        `Cr ${money(cr).padStart(13)}  net ${money(dr - cr).padStart(13)}`,
    );
  }

  console.log(
    '\n  2000 Accounts Payable carries supplier invoices entered but never\n' +
      '  settled. Every card payment that matches one of them should be\n' +
      '  reducing that balance, not adding a second cost.',
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
