/**
 * post-chevrolet-van.ts
 *
 * Records the Chevrolet Express van bought for the company on 15 December 2025.
 *
 *   15/12/2025  TRF TO TOT BERRY SWEET SOLEPROPR.LLC  ref 82877847  10,000.00
 *
 * Confirmed by the General Manager 20 Sep 2026: this transfer bought a Chevrolet
 * Express van for the company. The registration card shows Abu Dhabi plate
 * 98525, code 8, registration expiring 15 April 2026.
 *
 * THIS IS NOT AN EXPENSE. A vehicle is used over several years, so it goes to
 * the balance sheet and is written down through depreciation:
 *
 *   Dr  1500 Rental Fleet & Equipment   10,000.00
 *   Cr  1010 Bank                       10,000.00
 *
 * Treating it as a cost would understate the 2025 profit by 10,000.00 and leave
 * the company owning a van that appears nowhere in its accounts.
 *
 * DEPRECIATION. The van was owned for 16 days of 2025, so the 2025 charge is
 * negligible and is deliberately not posted here — it belongs with the fixed
 * asset register work, where the rate for the fleet is set in one place rather
 * than invented per asset.
 *
 * INPUT VAT. Booked GROSS. If Tot Berry Sweet is VAT registered and issued a tax
 * invoice, up to 476.19 of the 10,000.00 is recoverable input VAT and the asset
 * cost falls to 9,523.81. Without the invoice nothing is assumed.
 *
 * Idempotent. Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');

const AMOUNT = 10000;
const POST_DATE = '2025-12-15';
const TAG = '[VAN2025]';

const MEMO =
  `${TAG} Chevrolet Express van bought for the company — Abu Dhabi plate 98525, ` +
  'code 8, registration expiring 15 April 2026. Paid 15 Dec 2025 by transfer to ' +
  'TOT BERRY SWEET SOLE PROPR. LLC, bank reference 82877847, 10,000.00. ' +
  'Confirmed by the General Manager 20 Sep 2026. Capitalised rather than ' +
  'expensed because the van is used over several years. DEPRECIATION: owned for ' +
  '16 days of 2025, so the 2025 charge is negligible and is left to the fixed ' +
  'asset register, where the fleet rate is set. INPUT VAT: booked gross — if a ' +
  'tax invoice exists, up to 476.19 is recoverable and the cost falls to ' +
  '9,523.81.';

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');

  const already = await prisma.journalEntry.findFirst({
    where: { memo: { startsWith: TAG } },
    select: { entryNumber: true },
  });
  if (already) {
    console.log(`  Already posted as ${already.entryNumber}. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: ['1500', '1010'] } },
    select: { id: true, code: true, name: true },
  });
  const account = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of ['1500', '1010']) {
    if (!account.has(code)) {
      throw new Error(`GL account ${code} was not found — nothing has been changed.`);
    }
  }

  console.log(`  Dr 1500 Rental Fleet & Equipment  ${money(AMOUNT).padStart(12)}`);
  console.log(`  Cr 1010 Bank — Current Account    ${money(AMOUNT).padStart(12)}`);
  console.log(`  dated ${POST_DATE}\n`);

  if (DRY) {
    console.log('=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  const prefix = `JE-${new Date().getFullYear()}-`;
  const last = await prisma.journalEntry.findMany({
    where: { entryNumber: { startsWith: prefix } },
    select: { entryNumber: true },
    orderBy: { entryNumber: 'desc' },
    take: 1,
  });
  const entryNumber = `${prefix}${String(
    (last.length > 0 ? parseInt(last[0].entryNumber.slice(-4), 10) : 0) + 1,
  ).padStart(4, '0')}`;

  await prisma.journalEntry.create({
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
            accountId: account.get('1500')!,
            debit: AMOUNT,
            credit: 0,
            description: 'Chevrolet Express van — Abu Dhabi 98525/8',
          },
          {
            accountId: account.get('1010')!,
            debit: 0,
            credit: AMOUNT,
            description: 'Bank — transfer to Tot Berry Sweet, ref 82877847',
          },
        ],
      },
    },
  });

  console.log(`  posted ${entryNumber}`);

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

  const fleet = await prisma.glAccount.findFirst({ where: { code: '1500' } });
  if (fleet) {
    const lines = await prisma.journalLine.findMany({
      where: { accountId: fleet.id },
      select: { debit: true, credit: true },
    });
    const net = lines.reduce((s, l) => s + dec(l.debit) - dec(l.credit), 0);
    console.log(`  1500 Rental Fleet & Equipment: ${money(net)}`);
  }

  const bank = await prisma.glAccount.findFirst({ where: { code: '1010' } });
  if (bank) {
    const lines = await prisma.journalLine.findMany({
      where: {
        accountId: bank.id,
        entry: {
          date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') },
        },
      },
      select: { credit: true },
    });
    const out = lines.reduce((s, l) => s + dec(l.credit), 0);
    console.log(`  1010 Bank outgoing recorded for 2025: ${money(out)}`);
    console.log(`  the statements say 969,137.15 — still unrecorded ${money(969137.15 - out)}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
