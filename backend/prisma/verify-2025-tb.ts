/**
 * verify-2025-tb.ts — READ ONLY.
 *
 * The 2025 trial balance, account by account, with the result underneath.
 * Used to check where money parked in suspense has and has not been classified.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

async function main(): Promise<void> {
  const accounts = await prisma.glAccount.findMany({
    select: { id: true, code: true, name: true, type: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const lines = await prisma.journalLine.findMany({
    where: {
      entry: {
        date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') },
      },
    },
    select: { accountId: true, debit: true, credit: true },
  });

  const balances = new Map<string, { dr: number; cr: number }>();
  for (const line of lines) {
    const bucket = balances.get(line.accountId) ?? { dr: 0, cr: 0 };
    bucket.dr += dec(line.debit);
    bucket.cr += dec(line.credit);
    balances.set(line.accountId, bucket);
  }

  console.log('=== 2025 MOVEMENT BY ACCOUNT ===\n');
  let revenue = 0;
  let expense = 0;

  const rows = [...balances.entries()]
    .map(([id, bucket]) => ({ account: byId.get(id)!, bucket }))
    .filter((r) => r.account)
    .sort((a, b) => a.account.code.localeCompare(b.account.code));

  for (const { account, bucket } of rows) {
    const net = bucket.dr - bucket.cr;
    console.log(
      `  ${account.code} ${account.name.slice(0, 32).padEnd(34)}${account.type.padEnd(10)}` +
        `Dr ${money(bucket.dr).padStart(13)}  Cr ${money(bucket.cr).padStart(13)}  ` +
        `net ${money(net).padStart(13)}`,
    );
    if (account.type === 'REVENUE') revenue += -net;
    if (account.type === 'EXPENSE') expense += net;
  }

  console.log('\n=== RESULT AS THE LEDGER CURRENTLY STANDS ===\n');
  console.log(`  revenue   ${money(revenue).padStart(14)}`);
  console.log(`  expenses  ${money(expense).padStart(14)}`);
  console.log(`  profit    ${money(revenue - expense).padStart(14)}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
