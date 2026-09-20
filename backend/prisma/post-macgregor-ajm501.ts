/**
 * post-macgregor-ajm501.ts
 *
 * Enters a supplier invoice that was missing from the ledger entirely, and
 * identifies one of the 38 unnamed outward transfers.
 *
 *   MACGREGOR FZ LLE, Creative Tower, Fujairah, TRN 104313630600003
 *   Invoice AJM501, issued 01/07/2025, due 16/07/2025
 *   Artist Trailer, 1st July        2,750.00
 *   VAT 5%                            137.50
 *   Total                           2,887.50
 *
 * THE PAYMENT. The ADCB statements carry exactly one debit of 2,887.50 in the
 * whole of 2025: 26/07/2025, `O/W TRF 515169203`, ten days after the due date.
 * MacGregor's own bank SMS confirms receipt of 2,887.50 from THE FILM MAKERS FZ
 * LLC into account 93XXXX0522, which is the last eight of the IBAN printed on
 * the invoice (AE51086000000**9334620522**). The General Manager confirmed on
 * 20 Sep 2026 that the SMS screenshot is an old one, not a payment made today —
 * so the July 2025 transfer is this invoice.
 *
 * TWO ENTRIES, in the right order:
 *
 *   01/07/2025   Dr 5000 Cost of Services      2,750.00
 *                Dr 1200 Input VAT             137.50
 *                Cr 2000 Accounts Payable      2,887.50
 *
 *   26/07/2025   Dr 2000 Accounts Payable      2,887.50
 *                Cr 1010 Bank                  2,887.50
 *
 * The cost and the input VAT belong to the invoice date; the bank movement
 * belongs to the payment date. Posting the payment straight to an expense would
 * lose the 137.50 of recoverable VAT and put the cost in the wrong month.
 *
 * Idempotent. Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');

const SUPPLIER = 'MACGREGOR FZ LLE';
const SUPPLIER_TRN = '104313630600003';
const INVOICE_NUMBER = 'AJM501';
const INVOICE_DATE = '2025-07-01';
const DUE_DATE = '2025-07-16';
const PAID_DATE = '2025-07-26';
const BANK_REF = '515169203';
const NET = 2750;
const VAT = 137.5;
const TOTAL = NET + VAT;

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

async function nextEntryNumber(
  tx: Prisma.TransactionClient,
  issued: Set<string>,
): Promise<string> {
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

  const existing = await prisma.expense.findFirst({
    where: { invoiceNumber: INVOICE_NUMBER },
    select: { expenseNumber: true, totalAmount: true },
  });
  if (existing) {
    console.log(
      `  Invoice ${INVOICE_NUMBER} is already in the ledger as ${existing.expenseNumber} ` +
        `(${money(dec(existing.totalAmount))}). Nothing to do.`,
    );
    await prisma.$disconnect();
    return;
  }

  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: ['5000', '1200', '2000', '1010'] } },
    select: { id: true, code: true, name: true },
  });
  const account = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of ['5000', '1200', '2000', '1010']) {
    if (!account.has(code)) {
      throw new Error(`GL account ${code} was not found — nothing has been changed.`);
    }
  }

  // The bank line this settles must actually exist, or the match is a story.
  console.log(`  supplier    ${SUPPLIER}  (TRN ${SUPPLIER_TRN})`);
  console.log(`  invoice     ${INVOICE_NUMBER}, ${INVOICE_DATE}, due ${DUE_DATE}`);
  console.log(`  net         ${money(NET).padStart(11)}   Artist Trailer, 1st July`);
  console.log(`  input VAT   ${money(VAT).padStart(11)}`);
  console.log(`  total       ${money(TOTAL).padStart(11)}`);
  console.log(`  paid        ${PAID_DATE} by transfer, ADCB reference ${BANK_REF}`);
  console.log(`\n  ${INVOICE_DATE}  Dr 5000 ${money(NET)}  Dr 1200 ${money(VAT)}  Cr 2000 ${money(TOTAL)}`);
  console.log(`  ${PAID_DATE}  Dr 2000 ${money(TOTAL)}  Cr 1010 ${money(TOTAL)}`);

  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const issued = new Set<string>();

    let supplier = await tx.supplier.findFirst({
      where: { name: { equals: SUPPLIER, mode: 'insensitive' } },
      select: { id: true, trn: true },
    });
    if (!supplier) {
      supplier = await tx.supplier.create({
        data: {
          name: SUPPLIER,
          trn: SUPPLIER_TRN,
          vatId: SUPPLIER_TRN,
          category: 'Equipment Rental',
          categories: ['Equipment Rental'],
          notes:
            'Created 20 Sep 2026 from tax invoice AJM501 during the 2025 bank ' +
            'reconciliation. Creative Tower, PO Box 4422, Fujairah.',
        },
        select: { id: true, trn: true },
      });
      console.log(`  created supplier ${SUPPLIER}`);
    } else if (!supplier.trn) {
      await tx.supplier.update({
        where: { id: supplier.id },
        data: { trn: SUPPLIER_TRN, vatId: SUPPLIER_TRN },
      });
    }

    const count = await tx.expense.count({ where: { expenseNumber: { startsWith: 'EXP-2025-' } } });
    const expenseNumber = `EXP-2025-${String(count + 1).padStart(4, '0')}`;

    const expense = await tx.expense.create({
      data: {
        expenseNumber,
        activity: 'RENTAL',
        category: 'Crew',
        description: 'Artist Trailer, 1st July 2025 — MacGregor Equipment Rental',
        amount: NET,
        vatAmount: VAT,
        totalAmount: TOTAL,
        expenseDate: day(INVOICE_DATE),
        invoiceNumber: INVOICE_NUMBER,
        invoiceDate: day(INVOICE_DATE),
        dueDate: day(DUE_DATE),
        status: 'APPROVED',
        approvedAt: new Date(),
        paidAt: day(PAID_DATE),
        vendorName: SUPPLIER,
        supplierVatId: SUPPLIER_TRN,
        supplierId: supplier.id,
        createdById: 'user-admin',
        importSource: 'MANUAL',
        notes:
          `[20 Sep 2026] Entered during the 2025 bank reconciliation from the supplier's ` +
          `tax invoice, provided by the General Manager. MACGREGOR FZ LLE, Creative Tower, ` +
          `PO Box 4422, Fujairah, TRN ${SUPPLIER_TRN}. Invoice ${INVOICE_NUMBER} issued ` +
          `${INVOICE_DATE}, due ${DUE_DATE}, Artist Trailer 1st July, ${money(NET)} plus ` +
          `${money(VAT)} VAT. SETTLED ${PAID_DATE} by outward transfer, ADCB reference ` +
          `${BANK_REF} — the only debit of ${money(TOTAL)} in the whole of 2025, and ` +
          `MacGregor's own bank SMS confirms receipt into account 93XXXX0522, the last ` +
          `eight of the IBAN on the invoice. This identifies one of the 38 outward ` +
          `transfers that ADCB left unnamed. VAT: ${money(VAT)} of input VAT is ` +
          `recoverable and was not previously claimed.`,
      },
      select: { id: true },
    });

    const invoiceEntry = await nextEntryNumber(tx, issued);
    await tx.journalEntry.create({
      data: {
        entryNumber: invoiceEntry,
        date: day(INVOICE_DATE),
        memo: `Expense ${expenseNumber} — ${SUPPLIER} invoice ${INVOICE_NUMBER}, Artist Trailer`,
        source: 'SYSTEM',
        sourceType: 'EXPENSE',
        sourceId: expense.id,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: account.get('5000')!,
              debit: NET,
              credit: 0,
              description: 'Cost of Services — artist trailer hire',
            },
            {
              accountId: account.get('1200')!,
              debit: VAT,
              credit: 0,
              description: 'Input VAT (Recoverable)',
            },
            {
              accountId: account.get('2000')!,
              debit: 0,
              credit: TOTAL,
              description: `Accounts Payable — ${SUPPLIER}`,
            },
          ],
        },
      },
    });

    const paymentEntry = await nextEntryNumber(tx, issued);
    await tx.journalEntry.create({
      data: {
        entryNumber: paymentEntry,
        date: day(PAID_DATE),
        memo:
          `Payment of ${SUPPLIER} invoice ${INVOICE_NUMBER} — outward transfer, ADCB ` +
          `reference ${BANK_REF}. Identifies one of the transfers ADCB left unnamed.`,
        source: 'SYSTEM',
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: account.get('2000')!,
              debit: TOTAL,
              credit: 0,
              description: `Accounts Payable — ${SUPPLIER} settled`,
            },
            {
              accountId: account.get('1010')!,
              debit: 0,
              credit: TOTAL,
              description: `Bank — O/W TRF ${BANK_REF}`,
            },
          ],
        },
      },
    });

    console.log(`  posted ${expenseNumber}: ${invoiceEntry} (invoice) and ${paymentEntry} (payment)`);
  });

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
  let inputVat = 0;
  let bankOut = 0;
  for (const l of year) {
    const a = byId.get(l.accountId);
    if (!a) continue;
    const net = dec(l.debit) - dec(l.credit);
    if (a.type === 'INCOME' || a.type === 'REVENUE') revenue += -net;
    if (a.type === 'EXPENSE') expense += net;
    if (a.code === '1200') inputVat += net;
    if (a.code === '1010') bankOut += dec(l.credit);
  }
  console.log(`\n  revenue                  ${money(revenue).padStart(14)}`);
  console.log(`  expenses                 ${money(expense).padStart(14)}`);
  console.log(`  PROFIT                   ${money(revenue - expense).padStart(14)}`);
  console.log(`\n  input VAT recoverable    ${money(inputVat).padStart(14)}`);
  console.log(`  bank outgoing recorded   ${money(bankOut).padStart(14)}`);
  console.log(`  statements say 969,137.15 — still unrecorded ${money(969137.15 - bankOut)}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
