/**
 * fix-duplicates-2025.ts
 *
 * Two corrections the 23 Sep 2026 scan proved, approved by the GM.
 *
 * 1. Carzhub 440.00 of 17 Dec 2025 is in the books twice. The company-card line
 *    JE-2026-1044 ("PUR 17/12 AL SHATRY Abu Dhabi 2528 503816") and filed-2025-2026-0089
 *    are the same purchase: invoice STE-05/SI/25-37441 prints approval code 503816.
 *    The card line is re-pointed from 6200 Office & Admin to 2000 Accounts Payable, so it
 *    settles the expense instead of charging the cost a second time, and a payment record
 *    is created (the pattern already used for The Parts Place). Cost falls by 440.00.
 *
 * 2. filed-2025-2026-0088, 23 Dec 2025, Shatry 1,740.00 + VAT 82.86, rests on
 *    PROFORMA STE-01/SO/25-14147 — not a tax invoice, and made out to "84 ANIS CUSTOMERS",
 *    Dubai. The real purchase is filed-2025-2026-0090 of 22 Dec (STE-01/SI/25-37958,
 *    1,190.00), whose invoice we now hold; both carry a power-steering pump. The row is
 *    reversed by a journal entry (never deleted — it is posted) and marked REJECTED.
 *
 * Trial balance stays 0.00. Idempotent (tag [DUPFIX2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[DUPFIX2025]';
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const f2 = (n: number): string => n.toFixed(2);

const CARD_ENTRY = 'JE-2026-1044';
const CARZHUB = 'filed-2025-2026-0089';
const PROFORMA = 'filed-2025-2026-0088';
const CARZHUB_TOTAL = 440;
const PROFORMA_NET = 1657.14;
const PROFORMA_VAT = 82.86;
const PROFORMA_TOTAL = 1740;
const STMT =
  '24/12/2025 PUR 17/12 AL SHATRY Abu Dhabi 2528 503816 440.00';

async function nextPaymentNumber(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.payment.findMany({
    where: { paymentNumber: { startsWith: 'PAY-2025-' } },
    select: { paymentNumber: true },
    orderBy: { paymentNumber: 'desc' },
    take: 1,
  });
  const n = last.length ? Number(last[0].paymentNumber.slice(-4)) : 0;
  return `PAY-2025-${String(n + 1).padStart(4, '0')}`;
}

async function nextEntryNumber(tx: Prisma.TransactionClient): Promise<string> {
  const p = 'JE-2026-';
  const last = await tx.journalEntry.findMany({
    where: { entryNumber: { startsWith: p } },
    select: { entryNumber: true },
    orderBy: { entryNumber: 'desc' },
    take: 1,
  });
  const n = last.length ? Number(last[0].entryNumber.slice(p.length)) : 0;
  return `${p}${String(n + 1).padStart(4, '0')}`;
}

async function trialBalance(): Promise<number> {
  const g = await prisma.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  return Number(dec(g._sum.debit) - dec(g._sum.credit));
}

async function main(): Promise<void> {
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) {
    console.log('Already applied.');
    await prisma.$disconnect();
    return;
  }

  const accts = await prisma.glAccount.findMany({
    where: { code: { in: ['1200', '2000', '6200'] } },
    select: { id: true, code: true },
  });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  for (const c of ['1200', '2000', '6200']) {
    if (!acct.get(c)) throw new Error(`GL account ${c} not found`);
  }

  // ---- read and check fix 1 -------------------------------------------------
  const card = await prisma.journalEntry.findUnique({
    where: { entryNumber: CARD_ENTRY },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  if (!card) throw new Error(`${CARD_ENTRY} not found`);
  const cardDebit = card.lines.find((l) => dec(l.debit) > 0);
  if (!cardDebit) throw new Error(`${CARD_ENTRY} has no debit line`);
  if (cardDebit.account.code !== '6200')
    throw new Error(`${CARD_ENTRY} debit is ${cardDebit.account.code}, expected 6200`);
  if (dec(cardDebit.debit) !== CARZHUB_TOTAL)
    throw new Error(`${CARD_ENTRY} debit is ${f2(dec(cardDebit.debit))}, expected 440.00`);
  const cardCredit = card.lines.find((l) => dec(l.credit) > 0);
  if (!cardCredit || cardCredit.account.code !== '1010')
    throw new Error(`${CARD_ENTRY} does not credit 1010`);

  const carzhub = await prisma.expense.findUnique({
    where: { expenseNumber: CARZHUB },
    select: { id: true, supplierId: true, totalAmount: true, status: true },
  });
  if (!carzhub) throw new Error(`${CARZHUB} not found`);
  if (dec(carzhub.totalAmount) !== CARZHUB_TOTAL)
    throw new Error(`${CARZHUB} total is ${f2(dec(carzhub.totalAmount))}, expected 440.00`);
  if (!carzhub.supplierId) throw new Error(`${CARZHUB} has no supplier`);
  if ((await prisma.payment.count({ where: { expenseId: carzhub.id } })) > 0)
    throw new Error(`${CARZHUB} already has a payment record`);

  const anyCard = await prisma.payment.findFirst({
    where: { direction: 'PAYMENT', method: 'CARD', paidFrom: 'COMPANY_BANK', bankAccountId: { not: null } },
    select: { bankAccountId: true },
  });
  if (!anyCard?.bankAccountId) throw new Error('No ADCB company bank account found on a card payment');

  // ---- read and check fix 2 -------------------------------------------------
  const pro = await prisma.expense.findUnique({
    where: { expenseNumber: PROFORMA },
    select: { id: true, amount: true, vatAmount: true, totalAmount: true, status: true },
  });
  if (!pro) throw new Error(`${PROFORMA} not found`);
  if (dec(pro.totalAmount) !== PROFORMA_TOTAL || dec(pro.vatAmount) !== PROFORMA_VAT)
    throw new Error(`${PROFORMA} is ${f2(dec(pro.totalAmount))}/${f2(dec(pro.vatAmount))}, expected 1740.00/82.86`);
  const proEntry = await prisma.journalEntry.findFirst({
    where: { sourceType: 'EXPENSE', sourceId: pro.id },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  if (!proEntry) throw new Error(`${PROFORMA} has no journal entry`);
  const proDr = new Map(proEntry.lines.filter((l) => dec(l.debit) > 0).map((l) => [l.account.code, dec(l.debit)]));
  if (proDr.get('6200') !== PROFORMA_NET || proDr.get('1200') !== PROFORMA_VAT)
    throw new Error(`${PROFORMA} entry ${proEntry.entryNumber} does not debit 6200 1657.14 + 1200 82.86`);
  if ((await prisma.payment.count({ where: { expenseId: pro.id } })) > 0)
    throw new Error(`${PROFORMA} has a payment record — it was paid; stop and check`);

  const tbBefore = await trialBalance();
  console.log(`Trial balance before: ${f2(tbBefore)}`);
  console.log('');
  console.log(`1. ${CARD_ENTRY} (19/12/2025) debit 6200 440.00 -> 2000 Accounts Payable,`);
  console.log(`   settling ${CARZHUB}; a payment record is created; the expense becomes PAID.`);
  console.log('   Effect: 2025 cost -440.00, input VAT unchanged, bank unchanged.');
  console.log(`2. ${PROFORMA} (23/12/2025, 1,740.00) reversed by a new entry:`);
  console.log('   Dr 2000 1,740.00 / Cr 6200 1,657.14 / Cr 1200 82.86; row marked REJECTED.');
  console.log('   Effect: 2025 cost -1,657.14, input VAT -82.86.');
  console.log('');
  console.log('Total: 2025 cost -2,097.14, input VAT -82.86.');

  if (DRY) {
    console.log('');
    console.log('--dry: nothing written.');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    // ---- fix 1 --------------------------------------------------------------
    await tx.journalLine.update({
      where: { id: cardDebit.id },
      data: {
        accountId: acct.get('2000') as string,
        description: `Accounts Payable — settles ${CARZHUB}`,
      },
    });
    const payNo = await nextPaymentNumber(tx);
    const pay = await tx.payment.create({
      data: {
        paymentNumber: payNo,
        direction: 'PAYMENT',
        supplierId: carzhub.supplierId as string,
        expenseId: carzhub.id,
        bankAccountId: anyCard.bankAccountId,
        amount: new Prisma.Decimal(CARZHUB_TOTAL),
        paymentDate: card.date,
        method: 'CARD',
        paidFrom: 'COMPANY_BANK',
        status: 'CLEARED',
        clearedAt: card.date,
        reference: '2528 503816',
        payerAccountRef: '7701',
        notes:
          `${TAG} ADCB company card — statement line: "${STMT}". Carzhub tax invoice ` +
          `STE-05/SI/25-37441 of 17/12/2025 prints approval code 503816, which is this line. ` +
          `The card line was charged to 6200 a second time; it is now re-pointed to 2000 and ` +
          `settles ${CARZHUB}.`,
      },
    });
    await tx.journalEntry.update({
      where: { id: card.id },
      data: {
        sourceType: 'PAYMENT',
        sourceId: pay.id,
        memo:
          `${card.memo ?? ''} ${TAG} re-pointed to 2000 Accounts Payable: this card line pays ` +
          `${CARZHUB} (Carzhub STE-05/SI/25-37441, approval 503816). It had charged the same ` +
          `purchase to 6200 a second time.`,
      },
    });
    await tx.expense.update({
      where: { id: carzhub.id },
      data: { status: 'PAID', paidAt: card.date },
    });

    // ---- fix 2 --------------------------------------------------------------
    const revNo = await nextEntryNumber(tx);
    await tx.journalEntry.create({
      data: {
        entryNumber: revNo,
        date: day('2025-12-23'),
        source: 'SYSTEM',
        status: 'POSTED',
        postedAt: new Date(),
        sourceType: 'EXPENSE',
        sourceId: pro.id,
        memo:
          `${TAG} Reverses ${PROFORMA} (${proEntry.entryNumber}). The only document is Shatry ` +
          `PROFORMA STE-01/SO/25-14147 of 23/12/2025 — not a tax invoice, and made out to ` +
          `"84 ANIS CUSTOMERS", Dubai, not to the company. The real purchase is ` +
          `filed-2025-2026-0090 of 22/12/2025 (tax invoice STE-01/SI/25-37958, 1,190.00), whose ` +
          `invoice is held; both carry a power-steering pump. GM's decision, 23 Sep 2026.`,
        lines: {
          create: [
            { accountId: acct.get('2000') as string, description: 'Accounts Payable — reversed', debit: new Prisma.Decimal(PROFORMA_TOTAL), credit: new Prisma.Decimal(0), sortOrder: 0 },
            { accountId: acct.get('6200') as string, description: 'Office & Admin — reversed', debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(PROFORMA_NET), sortOrder: 1 },
            { accountId: acct.get('1200') as string, description: 'Input VAT — reversed', debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(PROFORMA_VAT), sortOrder: 2 },
          ],
        },
      },
    });
    await tx.expense.update({
      where: { id: pro.id },
      data: {
        status: 'REJECTED',
        rejectionReason:
          `${TAG} Proforma only (STE-01/SO/25-14147), made out to "84 ANIS CUSTOMERS" — not a ` +
          `tax invoice and not ours. Reversed by ${revNo}. The real purchase is ` +
          `filed-2025-2026-0090 of 22/12/2025.`,
      },
    });
    console.log('');
    console.log(`Written: payment ${payNo}, reversing entry ${revNo}.`);
  });

  const tbAfter = await trialBalance();
  console.log(`Trial balance after: ${f2(tbAfter)}`);
  if (Math.abs(tbAfter) > 0.005) throw new Error('Trial balance is not zero — investigate');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
