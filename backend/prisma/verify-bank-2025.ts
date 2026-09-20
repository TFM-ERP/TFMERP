/**
 * verify-bank-2025.ts
 *
 * Read-only. Reconciles GL 1010 Bank against the ADCB statements for 2025.
 *
 * The statements give three hard numbers for the year:
 *   opening balance brought forward at 01 Jan 2025 :  1,242.16
 *   closing balance at 31 Dec 2025                 : 53,879.51
 * so the net movement through the account across 2025 must be 52,637.35.
 *
 * This script prints what the ledger currently says, month by month, and the
 * difference against those figures. The difference is the unrecorded outgoing
 * side: supplier payments, salaries, bank charges and owner drawings that have
 * not yet been entered.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const OPENING_2025 = 1242.16;
const CLOSING_2025 = 53879.51;

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

async function main(): Promise<void> {
  const bank = await prisma.glAccount.findFirst({ where: { code: '1010' } });
  if (!bank) {
    throw new Error('GL account 1010 was not found.');
  }

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId: bank.id,
      entry: {
        date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') },
      },
    },
    select: {
      debit: true,
      credit: true,
      description: true,
      entry: { select: { date: true, entryNumber: true, memo: true } },
    },
    orderBy: { entry: { date: 'asc' } },
  });

  const months = new Map<string, { in: number; out: number; count: number }>();
  let totalIn = 0;
  let totalOut = 0;

  for (const line of lines) {
    const key = line.entry.date.toISOString().slice(0, 7);
    const bucket = months.get(key) ?? { in: 0, out: 0, count: 0 };
    const debit = dec(line.debit);
    const credit = dec(line.credit);
    bucket.in += debit;
    bucket.out += credit;
    bucket.count += 1;
    months.set(key, bucket);
    totalIn += debit;
    totalOut += credit;
  }

  console.log('=== GL 1010 BANK, MOVEMENT THROUGH 2025 ===\n');
  console.log('  month      lines            in           out           net');
  let running = 0;
  for (const key of [...months.keys()].sort()) {
    const bucket = months.get(key)!;
    const net = bucket.in - bucket.out;
    running += net;
    console.log(
      `  ${key}  ${String(bucket.count).padStart(5)}  ` +
        `${money(bucket.in).padStart(12)}  ${money(bucket.out).padStart(12)}  ` +
        `${money(net).padStart(12)}`,
    );
  }

  const net = totalIn - totalOut;
  console.log('\n  ---------------------------------------------------------------');
  console.log(
    `  total       ${String(lines.length).padStart(5)}  ` +
      `${money(totalIn).padStart(12)}  ${money(totalOut).padStart(12)}  ` +
      `${money(net).padStart(12)}`,
  );
  if (Math.abs(running - net) > 0.005) {
    console.log(`  WARNING: month total ${money(running)} does not agree with ${money(net)}`);
  }

  console.log('\n=== AGAINST THE STATEMENTS ===\n');
  const expectedNet = CLOSING_2025 - OPENING_2025;
  console.log(`  opening brought forward, 01 Jan 2025 : ${money(OPENING_2025).padStart(14)}`);
  console.log(`  closing balance, 31 Dec 2025        : ${money(CLOSING_2025).padStart(14)}`);
  console.log(`  net movement the account must show  : ${money(expectedNet).padStart(14)}`);
  console.log(`  net movement the ledger shows       : ${money(net).padStart(14)}`);
  console.log(`  ------------------------------------------------------------`);
  console.log(`  UNRECORDED OUTGOING                 : ${money(net - expectedNet).padStart(14)}`);
  console.log(
    '\n  Every dirham of that difference is money that left the account in 2025\n' +
      '  and is not yet in the ledger. It is the whole of the remaining work on\n' +
      '  the 2025 accounts: supplier payments, salaries, bank charges, cash\n' +
      '  withdrawals and owner drawings.',
  );

  console.log('\n=== RECEIPTS POSTED, BY YEAR AND EVIDENCE ===\n');
  const payments = await prisma.payment.findMany({
    where: { direction: 'RECEIPT' },
    select: { paymentDate: true, amount: true, method: true, notes: true },
    orderBy: { paymentDate: 'asc' },
  });

  const byYear = new Map<string, { bank: number; cash: number; count: number }>();
  for (const payment of payments) {
    const year = payment.paymentDate.toISOString().slice(0, 4);
    const bucket = byYear.get(year) ?? { bank: 0, cash: 0, count: 0 };
    const amount = dec(payment.amount);
    if (payment.method === 'CASH') {
      bucket.cash += amount;
    } else {
      bucket.bank += amount;
    }
    bucket.count += 1;
    byYear.set(year, bucket);
  }

  console.log('  year   count      to the bank       in cash          total');
  for (const year of [...byYear.keys()].sort()) {
    const bucket = byYear.get(year)!;
    console.log(
      `  ${year}  ${String(bucket.count).padStart(6)}  ${money(bucket.bank).padStart(15)}  ` +
        `${money(bucket.cash).padStart(12)}  ${money(bucket.bank + bucket.cash).padStart(13)}`,
    );
  }

  console.log('\n=== SHORTFALLS LEFT ON SETTLED INVOICES ===\n');
  const invoices = await prisma.invoice.findMany({
    where: { status: 'PARTIALLY_PAID' },
    select: {
      invoiceNumber: true,
      total: true,
      amountPaid: true,
      amountDue: true,
      client: { select: { companyName: true } },
    },
    orderBy: { issueDate: 'asc' },
  });

  if (invoices.length === 0) {
    console.log('  none');
  } else {
    for (const invoice of invoices) {
      console.log(
        `  ${invoice.invoiceNumber.padEnd(14)}${(invoice.client?.companyName ?? '').padEnd(32)}` +
          `total ${money(dec(invoice.total)).padStart(12)}  ` +
          `short ${money(dec(invoice.amountDue)).padStart(10)}`,
      );
    }
    console.log(
      '\n  Small shortfalls on inward remittances are the correspondent bank\n' +
        '  fees deducted in transit. They are a cost of the company, not a debt\n' +
        '  of the customer, and should be written off to bank charges so the\n' +
        '  receivable closes.',
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
