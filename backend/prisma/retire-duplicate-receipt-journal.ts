/**
 * Retires manual journal JE-2026-0431 — 20 September 2026.
 *
 * WHY. Before the payments backfill existed, the twofour54 receipt of 12 Feb 2026
 * (111,877.50 against invoice 25160) was recorded as a hand-written journal:
 *
 *     Dr 1010 Bank              111,877.50
 *         Cr 1100 Accounts Receivable   111,877.50
 *
 * The backfill then created a proper Payment row for the same receipt, with its
 * own journal on the same two accounts. The money was therefore counted twice:
 * accounts receivable was over-credited and the bank over-debited by 111,877.50.
 *
 * WHICH ONE SURVIVES. The Payment row, because it is the system's own record of
 * a receipt — it appears in Finance → Payments, produces a receipt document, and
 * drives the invoice's amountPaid and status. A manual journal does none of that.
 *
 * NOTHING IS LOST. The narrative on the manual journal — the bank reference, the
 * balance movement, and Fatima Wasim's confirmation of 14 Sep 2026 that twofour54
 * paid in full with no net-off — has been copied into the receipt's own notes in
 * backfill-receipts.ts, so it lives on the payment record.
 *
 * Safe to run more than once. Pass --dry to see the plan only.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const ENTRY = 'JE-2026-0431';
const EXPECTED = 111877.5;

function money(n: number): string {
  return n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function main(): Promise<void> {
  const entry = await prisma.journalEntry.findFirst({
    where: { entryNumber: ENTRY },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });

  if (!entry) {
    console.log(`${ENTRY} is not present — already retired. Nothing to do.`);
    return;
  }

  // Only retire it if it is what this script was written for.
  const arLine = entry.lines.find((l) => l.account.code === '1100');
  const bankLine = entry.lines.find((l) => l.account.code === '1010');
  if (!arLine || !bankLine || entry.lines.length !== 2) {
    throw new Error(`${ENTRY} is not the two-line entry this script expects. Aborting.`);
  }
  if (Math.abs(Number(arLine.credit) - EXPECTED) > 0.005) {
    throw new Error(
      `${ENTRY} credits accounts receivable by ${money(Number(arLine.credit))}, not ${money(EXPECTED)}. Aborting.`,
    );
  }

  // And only if the receipt that replaces it actually exists.
  const replacement = await prisma.payment.findFirst({
    where: {
      direction: 'RECEIPT',
      reference: '14039563',
      amount: EXPECTED,
      invoice: { invoiceNumber: '25160' },
    },
    select: { paymentNumber: true, paymentDate: true },
  });
  if (!replacement) {
    throw new Error(
      'The replacement receipt for invoice 25160 was not found. Run backfill-receipts.ts first. Aborting.',
    );
  }

  console.log(DRY ? '=== DRY RUN — NOTHING WILL BE WRITTEN ===' : '=== APPLYING ===');
  console.log(`retiring  ${ENTRY}  ${entry.date.toISOString().slice(0, 10)}  ${money(EXPECTED)}`);
  console.log(
    `replaced by receipt ${replacement.paymentNumber} of ${replacement.paymentDate
      .toISOString()
      .slice(0, 10)}`,
  );
  if (DRY) return;

  await prisma.$transaction(async (tx) => {
    await tx.journalLine.deleteMany({ where: { entryId: entry.id } });
    await tx.journalEntry.delete({ where: { id: entry.id } });
  });

  const ar = await prisma.journalLine.aggregate({
    where: { account: { code: '1100' }, entry: { status: 'POSTED' } },
    _sum: { debit: true, credit: true },
  });
  const tb = await prisma.journalLine.aggregate({
    where: { entry: { status: 'POSTED' } },
    _sum: { debit: true, credit: true },
  });
  const arBal = Number(ar._sum.debit ?? 0) - Number(ar._sum.credit ?? 0);
  const diff = Number(tb._sum.debit ?? 0) - Number(tb._sum.credit ?? 0);

  console.log(`\nAccounts receivable now ${money(Math.round(arBal * 100) / 100)}`);
  console.log(`Trial balance difference ${money(Math.round(diff * 100) / 100)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
