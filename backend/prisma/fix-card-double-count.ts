/**
 * fix-card-double-count.ts
 *
 * Corrects a mistake in post-card-spending.ts.
 *
 * THE MISTAKE. That script posted all 568 card lines as
 *     Dr <expense account>   /   Cr 1010 Bank
 * which is right only where the cost was not already in the ledger. Many of
 * these suppliers had already been entered as invoices —
 *     Dr <expense account>   /   Cr 2000 Accounts Payable
 * — so the card payment is not a second cost. It settles the payable:
 *     Dr 2000 Accounts Payable   /   Cr 1010 Bank
 * Posting it as an expense again overstates 2025 costs, understates the profit
 * by the same amount, and leaves the supplier looking unpaid.
 *
 * THE MATCH RULE, deliberately strict. A card entry is only re-pointed when:
 *   - the amount agrees to the fils;
 *   - the expense was actually posted (an unposted expense created no payable);
 *   - a distinctive word from the supplier's name appears in the bank narrative;
 *   - the two are within 45 days; and
 *   - the expense has not already been claimed by another card entry.
 * Anything failing any of those is left alone and reported. A wrong correction
 * is worse than the error it replaces.
 *
 *   npx ts-node --transpile-only prisma/fix-card-double-count.ts --dry
 *   npx ts-node --transpile-only prisma/fix-card-double-count.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');
const TOLERANCE = 0.01;
const WINDOW_DAYS = 45;

/** Words too common to identify a supplier. */
const STOPWORDS = new Set([
  'llc', 'fz', 'fz-llc', 'fzllc', 'fzco', 'the', 'and', 'for', 'general',
  'trading', 'co', 'company', 'services', 'service', 'international', 'uae',
  'abu', 'dhabi', 'dubai', 'sole', 'est', 'l.l.c', 'spc', 'ltd',
]);

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

const days = (a: Date, b: Date): number =>
  Math.round(Math.abs(a.getTime() - b.getTime()) / 86400000);

/** Distinctive words in a supplier name, longest first. */
function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
    .sort((a, b) => b.length - a.length);
}

/**
 * The bank truncates merchant names, so a full word will often not appear.
 * Match on the first 5 characters of a distinctive word instead, which is what
 * survives truncation ("twofour54 FZ-LLC" -> "TwoFour54", "shatry trading" ->
 * "AL SHATRY").
 */
function nameAppears(vendor: string, narrative: string): string | null {
  const hay = narrative.toLowerCase();
  for (const word of tokens(vendor)) {
    const stem = word.slice(0, 5);
    if (stem.length >= 4 && hay.includes(stem)) return word;
  }
  return null;
}

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');

  const payable = await prisma.glAccount.findFirst({ where: { code: '2000' } });
  if (!payable) throw new Error('GL 2000 Accounts Payable was not found');

  const entries = await prisma.journalEntry.findMany({
    where: { memo: { startsWith: '[CARD2025]' } },
    select: {
      id: true,
      entryNumber: true,
      date: true,
      memo: true,
      lines: {
        select: { id: true, debit: true, credit: true, account: { select: { code: true } } },
      },
    },
    orderBy: { date: 'asc' },
  });
  if (entries.length === 0) {
    console.log('  no [CARD2025] entries found — nothing to correct');
    await prisma.$disconnect();
    return;
  }

  /* Expenses that were actually posted, so a payable really exists. */
  const expenseJournals = await prisma.journalEntry.findMany({
    where: { sourceType: 'EXPENSE' },
    select: { sourceId: true },
  });
  const postedIds = [...new Set(expenseJournals.map((j) => j.sourceId).filter(Boolean))] as string[];

  const expenses = await prisma.expense.findMany({
    where: {
      id: { in: postedIds },
      expenseDate: { gte: new Date('2024-11-01'), lte: new Date('2026-03-31') },
    },
    select: {
      id: true,
      expenseNumber: true,
      expenseDate: true,
      totalAmount: true,
      vendorName: true,
    },
  });

  const claimed = new Set<string>();
  const fixes: {
    entryId: string;
    entryNumber: string;
    lineId: string;
    date: Date;
    amount: number;
    from: string;
    expenseNumber: string;
    vendor: string;
    on: string;
  }[] = [];
  const rejected: string[] = [];

  for (const entry of entries) {
    const debitLine = entry.lines.find((l) => dec(l.debit) > 0);
    if (!debitLine) continue;
    const amount = dec(debitLine.debit);
    const narrative = entry.memo ?? '';

    const candidates = expenses
      .filter((e) => !claimed.has(e.id))
      .filter((e) => Math.abs(dec(e.totalAmount) - amount) <= TOLERANCE)
      .filter((e) => days(e.expenseDate, entry.date) <= WINDOW_DAYS);

    if (candidates.length === 0) continue;

    let chosen: (typeof candidates)[number] | null = null;
    let on = '';
    for (const candidate of candidates.sort(
      (a, b) => days(a.expenseDate, entry.date) - days(b.expenseDate, entry.date),
    )) {
      const word = nameAppears(candidate.vendorName ?? '', narrative);
      if (word) {
        chosen = candidate;
        on = word;
        break;
      }
    }

    if (!chosen) {
      rejected.push(
        `  ${entry.date.toISOString().slice(0, 10)}  ${money(amount).padStart(11)}  ` +
          `${entry.entryNumber}  amount matches ${candidates.length} expense(s) but no ` +
          `supplier name in the narrative — LEFT ALONE`,
      );
      continue;
    }

    claimed.add(chosen.id);
    fixes.push({
      entryId: entry.id,
      entryNumber: entry.entryNumber,
      lineId: debitLine.id,
      date: entry.date,
      amount,
      from: debitLine.account.code,
      expenseNumber: chosen.expenseNumber,
      vendor: chosen.vendorName ?? '',
      on,
    });
  }

  console.log('=== CARD PAYMENTS THAT ARE SETTLING AN EXISTING INVOICE ===\n');
  let total = 0;
  for (const fix of fixes) {
    total += fix.amount;
    console.log(
      `  ${fix.date.toISOString().slice(0, 10)}  ${money(fix.amount).padStart(11)}  ` +
        `${fix.entryNumber}  ${fix.from} -> 2000   ${fix.expenseNumber.padEnd(22)}` +
        `${fix.vendor.slice(0, 24).padEnd(26)}(on "${fix.on}")`,
    );
  }
  console.log(`\n  ${fixes.length} entries, ${money(total)} of double-counted cost`);

  if (rejected.length > 0) {
    console.log('\n=== AMOUNT MATCHED BUT THE NAME DID NOT — LEFT ALONE ===\n');
    for (const line of rejected) console.log(line);
    console.log(
      '\n  These need a human eye. Correcting them on amount alone would be a\n' +
        '  guess, and a wrong correction is worse than the error it replaces.',
    );
  }

  if (DRY || fixes.length === 0) {
    console.log(DRY ? '\n=== DRY RUN — nothing written ===' : '\n=== NOTHING TO DO ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const fix of fixes) {
        await tx.journalLine.update({
          where: { id: fix.lineId },
          data: {
            accountId: payable.id,
            description: `Accounts Payable — settles ${fix.expenseNumber} (${fix.vendor})`,
          },
        });
        await tx.journalEntry.update({
          where: { id: fix.entryId },
          data: {
            memo:
              `[CARD2025][SETTLES ${fix.expenseNumber}] payment of an invoice already in ` +
              `the ledger — corrected 20 Sep 2026 from ${fix.from} to 2000 Accounts ` +
              `Payable, because the cost was already recognised when the invoice was ` +
              `entered.`,
          },
        });
      }
    },
    { timeout: 120000, maxWait: 30000 },
  );

  console.log(`\n  corrected ${fixes.length} entries`);

  /* ---------------------------------------------------------------- verify */

  console.log('\n=== AFTER ===\n');
  const allLines = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  let debits = 0;
  let credits = 0;
  for (const l of allLines) {
    debits += dec(l.debit);
    credits += dec(l.credit);
  }
  console.log(
    `  trial balance: debits ${money(debits)}  credits ${money(credits)}  ` +
      `difference ${money(debits - credits)}`,
  );

  const accounts = await prisma.glAccount.findMany({
    select: { id: true, code: true, type: true, name: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const year = await prisma.journalLine.findMany({
    where: {
      entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } },
    },
    select: { accountId: true, debit: true, credit: true },
  });
  let revenue = 0;
  let expense = 0;
  let apDr = 0;
  let apCr = 0;
  for (const l of year) {
    const a = byId.get(l.accountId);
    if (!a) continue;
    const net = dec(l.debit) - dec(l.credit);
    if (a.type === 'INCOME' || a.type === 'REVENUE') revenue += -net;
    if (a.type === 'EXPENSE') expense += net;
    if (a.code === '2000') {
      apDr += dec(l.debit);
      apCr += dec(l.credit);
    }
  }
  console.log(`\n  revenue                       ${money(revenue).padStart(14)}`);
  console.log(`  expenses                      ${money(expense).padStart(14)}`);
  console.log(`  PROFIT                        ${money(revenue - expense).padStart(14)}`);
  console.log(
    `\n  2000 Accounts Payable: invoices ${money(apCr)}  paid ${money(apDr)}  ` +
      `still owed ${money(apCr - apDr)}`,
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
