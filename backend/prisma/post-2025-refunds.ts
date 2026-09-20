/**
 * post-2025-refunds.ts
 *
 * Seven bank credits in 2025 are refunds of card purchases — goods returned to
 * Amazon, and one Talabat order. They sat in the "unexplained credits" pile
 * because they are not customer receipts and nothing else claimed them.
 *
 * A refund is not income. It reduces the cost it came from:
 *
 *     Dr  1010 Bank
 *     Cr  <the expense account the original purchase was posted to>
 *
 * All seven originals are inside the card spending posted on 20 September, so
 * without this the 2025 expenses are overstated by 3,339.72 and the bank shows
 * 3,339.72 less coming in than the statements do.
 *
 *   30/10/2025  1,999.00  REF 28/10 Amazon ae Dubai
 *   27/12/2025    605.99  REF 25/12 Amazon ae Dubai
 *   27/10/2025    490.09  REF 25/10 Amazon ae Dubai
 *   29/11/2025    122.12  REF 27/11 Amazon ae Dubai
 *   18/11/2025     74.99  REF 16/11 Amazon ae Dubai
 *   27/11/2025     46.53  REF 25/11 Amazon ae Dubai
 *   14/01/2025      1.00  REF 11/01 Talabat Dubai
 *
 * Amazon purchases were classified to 6200 Office & Admin and Talabat to 5000
 * Cost of Services, so the refunds go back to the same places.
 *
 * NOT INCLUDED, and why:
 *   - the four bounced twofour54 cheques reversing, 51,409.00 — the debit side
 *     is deliberately unposted too, so the pair nets to nothing;
 *   - the owner's 10,700.00 paid in — already inside JE-2026-0438;
 *   - the 1,100.00 returned outward transfer of 01/08/2025 — its outward leg
 *     (31/07/2025, ref 517757250) is also unposted, so the pair nets to nothing;
 *   - the 21,525.00, 5,250.00, 3,500.00 and 100.00 — real money in that still
 *     needs attributing to a customer or a source.
 *
 * Idempotent. Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');
const TAG = '[REFUND2025]';

interface Refund {
  date: string;
  amount: number;
  account: string;
  narrative: string;
}

const REFUNDS: Refund[] = [
  { date: '2025-01-14', amount: 1.0, account: '5000', narrative: 'REF 11/01 Talabat DUBAI 3825' },
  { date: '2025-10-27', amount: 490.09, account: '6200', narrative: 'REF 25/10 Amazon ae Dubai 3825' },
  { date: '2025-10-30', amount: 1999.0, account: '6200', narrative: 'REF 28/10 Amazon ae Dubai 3825' },
  { date: '2025-11-18', amount: 74.99, account: '6200', narrative: 'REF 16/11 Amazon ae Dubai 3825' },
  { date: '2025-11-27', amount: 46.53, account: '6200', narrative: 'REF 25/11 Amazon ae Dubai 3825' },
  { date: '2025-11-29', amount: 122.12, account: '6200', narrative: 'REF 27/11 Amazon ae Dubai 3825' },
  { date: '2025-12-27', amount: 605.99, account: '6200', narrative: 'REF 25/12 Amazon ae Dubai 3825' },
];

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

async function nextNumber(tx: Prisma.TransactionClient, issued: Set<string>): Promise<string> {
  const prefix = `JE-${new Date().getFullYear()}-`;
  const last = await tx.journalEntry.findMany({
    where: { entryNumber: { startsWith: prefix } },
    select: { entryNumber: true },
    orderBy: { entryNumber: 'desc' },
    take: 1,
  });
  let n = last.length > 0 ? parseInt(last[0].entryNumber.slice(-4), 10) : 0;
  let candidate = '';
  do {
    n += 1;
    candidate = `${prefix}${String(n).padStart(4, '0')}`;
  } while (issued.has(candidate));
  issued.add(candidate);
  return candidate;
}

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');

  const already = await prisma.journalEntry.count({ where: { memo: { startsWith: TAG } } });
  if (already > 0) {
    console.log(`  ${already} entries tagged ${TAG} already exist. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  const codes = [...new Set(REFUNDS.map((r) => r.account))];
  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: [...codes, '1010'] } },
    select: { id: true, code: true, name: true },
  });
  const account = new Map(accounts.map((a) => [a.code, a.id]));
  const name = new Map(accounts.map((a) => [a.code, a.name]));
  for (const code of [...codes, '1010']) {
    if (!account.has(code)) {
      throw new Error(`GL account ${code} was not found — nothing has been changed.`);
    }
  }

  let total = 0;
  for (const refund of REFUNDS) {
    total += refund.amount;
    console.log(
      `  ${refund.date}  ${money(refund.amount).padStart(10)}  ` +
        `Dr 1010 / Cr ${refund.account} ${(name.get(refund.account) ?? '').slice(0, 22).padEnd(24)}` +
        refund.narrative.slice(0, 34),
    );
  }
  console.log(`\n  ${REFUNDS.length} refunds, ${money(total)}`);

  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const issued = new Set<string>();
    for (const refund of REFUNDS) {
      await tx.journalEntry.create({
        data: {
          entryNumber: await nextNumber(tx, issued),
          date: day(refund.date),
          memo:
            `${TAG} Refund of a card purchase — ${refund.narrative}. Credited back to ` +
            `the account the original purchase was posted to. A refund is not income: ` +
            `it reduces the cost it came from.`,
          source: 'SYSTEM',
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: account.get('1010')!,
                debit: refund.amount,
                credit: 0,
                description: 'Bank — refund received',
              },
              {
                accountId: account.get(refund.account)!,
                debit: 0,
                credit: refund.amount,
                description: 'Purchase refunded',
              },
            ],
          },
        },
      });
    }
  });

  console.log(`\n  posted ${REFUNDS.length} refunds`);

  /* ----------------------------------------------------------------- verify */

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

  const accountsAll = await prisma.glAccount.findMany({
    select: { id: true, code: true, type: true },
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
  let bankIn = 0;
  for (const l of year) {
    const a = byId.get(l.accountId);
    if (!a) continue;
    const net = dec(l.debit) - dec(l.credit);
    if (a.type === 'INCOME' || a.type === 'REVENUE') revenue += -net;
    if (a.type === 'EXPENSE') expense += net;
    if (a.code === '1010') bankIn += dec(l.debit);
  }
  console.log(`\n  revenue                  ${money(revenue).padStart(14)}`);
  console.log(`  expenses                 ${money(expense).padStart(14)}`);
  console.log(`  PROFIT                   ${money(revenue - expense).padStart(14)}`);
  console.log(`\n  bank receipts recorded   ${money(bankIn).padStart(14)}`);
  console.log(
    `  statements say 1,023,016.66 with the opening — unexplained ` +
      `${money(1023016.66 - bankIn)}`,
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
