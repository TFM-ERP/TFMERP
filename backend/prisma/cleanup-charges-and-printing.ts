/**
 * cleanup-charges-and-printing.ts
 *
 * Two safe corrections, both idempotent. Run with --dry to see the plan.
 *
 * 1. WRITE OFF THE INBOUND TRANSFER CHARGES.
 *    Three invoices sit a few dirhams short of settled because the
 *    correspondent banks deducted their fee in transit. The customer paid the
 *    full amount; we received less. That shortfall is a cost of ours, not a
 *    debt of theirs, so it is written off to 6500 Bank Charges and the
 *    invoices close. Total 591.02.
 *
 * 2. REMOVE THE DUPLICATE PRINTING COST.
 *    Abu Dhabi Printing & Publishing invoice 114104 is in the ledger twice:
 *      30/04/2025  7,625.00 + 381.25 VAT   APPROVED, posted   <- correct
 *      17/05/2025  8,006.25 + 0.00 VAT     PENDING, unposted  <- duplicate
 *    The second is the gross figure entered as net, with no VAT split and the
 *    wrong date. It carries NO journal entry, so removing it does not disturb
 *    the ledger or any VAT return — it only stops the cost being counted twice
 *    the moment someone approves it. The surviving row gets the supplier's real
 *    document number and TRN, which the FTA Audit File needs on every purchase
 *    line.
 *
 * NOT TOUCHED, DELIBERATELY: the sixteen other duplicate groups in 2025. Every
 * one of those rows carries a `FILED-2025-Qn-Rnn` source reference, which means
 * it reproduces a line of a VAT return AS FILED with the FTA. Deleting them
 * would silently reverse input VAT that has already been claimed. That is a
 * disclosure for the tax adviser to make, not a cleanup. See
 * `accounts/2025-expense-duplicates-and-printing.md`.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');

/** The supplier's own document reference, from the tax invoice provided. */
const PRINTING_INVOICE_NUMBER = '114104';
const PRINTING_SUPPLIER_TRN = '100318777800003';
const PRINTING_KEEP = 'filed-2025-2026-0136';
const PRINTING_DROP = 'gmail-2025-2026-0024';

/** Invoices left short by a transfer charge, and the charge itself. */
const CHARGE_WRITE_OFFS: { invoice: string; amount: number; note: string }[] = [
  {
    invoice: 'TFMI25251',
    amount: 385.52,
    note:
      'Correspondent bank charges deducted in transit on the inward remittances ' +
      'from Les Productions Visuelles Compliment inc. The customer discharged the ' +
      'invoice in full; the shortfall never reached us and is our cost.',
  },
  {
    invoice: 'TFMI25278',
    amount: 115.5,
    note:
      'Correspondent bank charge deducted in transit on the inward remittance from ' +
      'Les Productions Visuelles Compliment inc. The invoice\'s own notes record the ' +
      'deduction. The customer discharged the invoice in full.',
  },
  {
    invoice: '2054046',
    amount: 90.0,
    note:
      'Correspondent bank charge deducted in transit on the 7 May 2025 receipt from ' +
      'IY Film Locations FZ LLC. The customer discharged the invoice in full.',
  },
];

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

function appendNote(existing: string | null, addition: string): string {
  const base = (existing ?? '').trim();
  return base.length > 0 ? `${base}\n\n${addition}` : addition;
}

/**
 * The next free JE number. Takes the numbers already handed out in this run so
 * two entries created in one transaction cannot collide.
 */
async function nextEntryNumber(
  tx: Prisma.TransactionClient,
  issued: Set<string>,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JE-${year}-`;
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

  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: ['1100', '6500'] } },
    select: { id: true, code: true, name: true },
  });
  const account = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of ['1100', '6500']) {
    if (!account.has(code)) {
      throw new Error(`GL account ${code} was not found — nothing has been changed.`);
    }
  }

  /* ---------------------------------------------------------------- part 1 */

  console.log('--- 1. TRANSFER CHARGES TO WRITE OFF ---\n');

  const planned: { id: string; number: string; amount: number; note: string }[] = [];
  let chargeTotal = 0;

  for (const item of CHARGE_WRITE_OFFS) {
    const invoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: item.invoice },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        status: true,
        internalNotes: true,
        client: { select: { companyName: true } },
      },
    });

    if (!invoice) {
      console.log(`  ${item.invoice.padEnd(14)} NOT FOUND — skipped`);
      continue;
    }

    const due = dec(invoice.amountDue);
    if (Math.abs(due) < 0.005) {
      console.log(`  ${item.invoice.padEnd(14)} already settled — nothing to do`);
      continue;
    }
    if (Math.abs(due - item.amount) > 0.005) {
      console.log(
        `  ${item.invoice.padEnd(14)} REFUSED: ledger shows ${money(due)} outstanding, ` +
          `the register expects ${money(item.amount)}. Left alone.`,
      );
      continue;
    }

    console.log(
      `  ${item.invoice.padEnd(14)}${(invoice.client?.companyName ?? '').slice(0, 30).padEnd(32)}` +
        `total ${money(dec(invoice.total)).padStart(12)}  ` +
        `received ${money(dec(invoice.amountPaid)).padStart(12)}  ` +
        `write off ${money(item.amount).padStart(8)}`,
    );

    planned.push({
      id: invoice.id,
      number: invoice.invoiceNumber,
      amount: item.amount,
      note: appendNote(
        invoice.internalNotes,
        `[20 Sep 2026] ${money(item.amount)} written off to 6500 Bank Charges. ${item.note}`,
      ),
    });
    chargeTotal += item.amount;
  }

  console.log(`\n  to write off: ${money(chargeTotal)} across ${planned.length} invoice(s)`);

  /* ---------------------------------------------------------------- part 2 */

  console.log('\n--- 2. THE DUPLICATE PRINTING COST ---\n');

  const keep = await prisma.expense.findFirst({
    where: { expenseNumber: PRINTING_KEEP },
    select: {
      id: true,
      expenseDate: true,
      amount: true,
      vatAmount: true,
      totalAmount: true,
      invoiceNumber: true,
      supplierVatId: true,
      notes: true,
      status: true,
    },
  });
  const drop = await prisma.expense.findFirst({
    where: { expenseNumber: PRINTING_DROP },
    select: {
      id: true,
      expenseDate: true,
      amount: true,
      vatAmount: true,
      totalAmount: true,
      status: true,
    },
  });

  let dropId: string | null = null;

  if (!keep) {
    console.log(`  ${PRINTING_KEEP} NOT FOUND — the correct row is missing, nothing removed.`);
  } else if (!drop) {
    console.log(`  ${PRINTING_DROP} is already gone — nothing to remove.`);
  } else {
    const journals = await prisma.journalEntry.count({
      where: { sourceType: 'EXPENSE', sourceId: drop.id },
    });

    console.log(
      `  keep   ${PRINTING_KEEP}  ${keep.expenseDate.toISOString().slice(0, 10)}  ` +
        `net ${money(dec(keep.amount))}  VAT ${money(dec(keep.vatAmount))}  ${keep.status}`,
    );
    console.log(
      `  drop   ${PRINTING_DROP}  ${drop.expenseDate.toISOString().slice(0, 10)}  ` +
        `net ${money(dec(drop.amount))}  VAT ${money(dec(drop.vatAmount))}  ${drop.status}  ` +
        `journals: ${journals}`,
    );

    if (journals > 0) {
      console.log(
        '\n  REFUSED: the duplicate carries a posted journal, so removing it would ' +
          'change the ledger.\n  That needs a reversing entry and a decision, not a ' +
          'delete. Left alone.',
      );
    } else if (Math.abs(dec(drop.totalAmount) - dec(keep.totalAmount)) > 0.005) {
      console.log(
        '\n  REFUSED: the two rows do not carry the same gross amount, so they may ' +
          'not be the same\n  document after all. Left alone.',
      );
    } else {
      dropId = drop.id;
      console.log('\n  The duplicate is unposted and matches gross. It will be removed.');
      console.log(
        `  The surviving row will carry invoice number ${PRINTING_INVOICE_NUMBER} ` +
          `and supplier TRN ${PRINTING_SUPPLIER_TRN}.`,
      );
    }
  }

  /* ----------------------------------------------------------------- apply */

  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  if (planned.length === 0 && !dropId) {
    console.log('\n=== NOTHING TO DO ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const issued = new Set<string>();

    if (planned.length > 0) {
      const entryNumber = await nextEntryNumber(tx, issued);
      await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date('2025-12-31'),
          memo:
            'Inward transfer charges deducted by correspondent banks, written off ' +
            'against the receivables they left short',
          source: 'SYSTEM',
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: account.get('6500')!,
                debit: chargeTotal,
                credit: 0,
                description: 'Bank Charges — inward transfer deductions',
              },
              {
                accountId: account.get('1100')!,
                debit: 0,
                credit: chargeTotal,
                description: `Accounts Receivable — ${planned
                  .map((p) => p.number)
                  .join(', ')}`,
              },
            ],
          },
        },
      });

      for (const item of planned) {
        await tx.invoice.update({
          where: { id: item.id },
          data: {
            amountDue: 0,
            status: 'PAID',
            internalNotes: item.note,
          },
        });
      }
      console.log(`\n  posted ${entryNumber}: ${money(chargeTotal)} to 6500 Bank Charges`);
    }

    if (dropId) {
      await tx.expense.delete({ where: { id: dropId } });
      await tx.expense.update({
        where: { id: keep!.id },
        data: {
          invoiceNumber: PRINTING_INVOICE_NUMBER,
          supplierVatId: PRINTING_SUPPLIER_TRN,
          notes: appendNote(
            keep!.notes,
            '[20 Sep 2026] Supplier document number and TRN taken from the tax invoice ' +
              'provided 19 Sep 2026: Abu Dhabi Printing & Publishing Co. LLC, invoice ' +
              '114104 dated 30-Apr-25, 7,625.00 + 381.25 VAT. A second row for the same ' +
              'document (17/05/2025, 8,006.25 gross entered as net, no VAT, unposted) ' +
              'was removed at the same time.',
          ),
        },
      });
      console.log(`  removed ${PRINTING_DROP} and stamped ${PRINTING_KEEP}`);
    }
  });

  /* ---------------------------------------------------------------- verify */

  console.log('\n=== AFTER ===\n');

  const lines = await prisma.journalLine.findMany({
    select: { debit: true, credit: true },
  });
  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    debits += dec(line.debit);
    credits += dec(line.credit);
  }
  console.log(
    `  trial balance: debits ${money(debits)}  credits ${money(credits)}  ` +
      `difference ${money(debits - credits)}`,
  );

  const receivable = await prisma.invoice.aggregate({
    _sum: { amountDue: true },
    where: { status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT', 'PAID'] } },
  });
  console.log(`  accounts receivable still open: ${money(dec(receivable._sum.amountDue))}`);

  const partial = await prisma.invoice.count({ where: { status: 'PARTIALLY_PAID' } });
  console.log(`  invoices still part-paid: ${partial}`);

  const printing = await prisma.expense.count({
    where: { invoiceNumber: PRINTING_INVOICE_NUMBER },
  });
  console.log(`  rows carrying printing invoice ${PRINTING_INVOICE_NUMBER}: ${printing}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
