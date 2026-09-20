/**
 * MACQUIP 26011 — issued but unpaid. It was sitting as DRAFT with no journal, so
 * its revenue and output VAT were absent from the accounts.
 *
 *   26011  18/05/2026  2,250.00 + 112.50 = 2,362.50   -> SENT, receivable
 *
 * Confirmed by the General Manager 19 Sep 2026: the invoice was issued and has
 * NOT been paid. It is posted as revenue with the amount left outstanding.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const NUMBER = '26011';
const NOTE =
  'Posted 19 Sep 2026. This invoice existed as a record but had never been posted - ' +
  'it was DRAFT with no journal entry, so its 2,250.00 of revenue and 112.50 of output ' +
  'VAT were absent from the accounts. CONFIRMED BY THE GENERAL MANAGER 19 Sep 2026: ' +
  'the invoice was issued and is NOT YET PAID. Posted as revenue with 2,362.50 left ' +
  'outstanding in accounts receivable. The May 2026 bank statement is password ' +
  'protected and was not opened, so non-payment rests on his confirmation rather than ' +
  'on the bank.';

async function main(): Promise<void> {
  const inv = await prisma.invoice.findFirst({
    where: { invoiceNumber: NUMBER },
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      subtotal: true,
      vatAmount: true,
      total: true,
      status: true,
      internalNotes: true,
    },
  });
  if (!inv) throw new Error(`${NUMBER} not found. Aborting.`);

  const existing = await prisma.journalEntry.count({
    where: { sourceType: 'INVOICE', sourceId: inv.id },
  });
  if (existing > 0) throw new Error(`${NUMBER} already has ${existing} journal(s). Aborting.`);

  const net = Number(inv.subtotal);
  const vat = Number(inv.vatAmount);
  const total = Number(inv.total);

  console.log(DRY ? '=== DRY RUN ===' : '=== APPLYING ===');
  console.log(
    `${NUMBER} | ${inv.issueDate.toISOString().slice(0, 10)} | ${net} + ${vat} = ${total} | ${
      inv.status
    } -> SENT (unpaid), journal to be created`,
  );
  if (DRY) return;

  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: ['1100', '2100', '4150'] } },
    select: { id: true, code: true },
  });
  const acc = new Map(accounts.map((a) => [a.code, a.id]));
  for (const c of ['1100', '2100', '4150']) {
    if (!acc.has(c)) throw new Error(`GL account ${c} not found. Aborting.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: inv.id },
      data: {
        status: 'SENT',
        amountPaid: 0,
        amountDue: total,
        internalNotes: (inv.internalNotes ? `${inv.internalNotes.trim()}\n\n` : '') + NOTE,
      },
    });

    const last = await tx.journalEntry.findMany({
      where: { entryNumber: { startsWith: 'JE-2026-' } },
      select: { entryNumber: true },
      orderBy: { entryNumber: 'desc' },
      take: 1,
    });
    const n = (last.length ? parseInt(last[0].entryNumber.slice(-4), 10) : 0) + 1;
    const entryNumber = `JE-2026-${String(n).padStart(4, '0')}`;

    await tx.journalEntry.create({
      data: {
        entryNumber,
        date: inv.issueDate,
        memo: `Invoice ${NUMBER}`,
        source: 'SYSTEM',
        sourceType: 'INVOICE',
        sourceId: inv.id,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: acc.get('1100')!, debit: total, credit: 0, description: 'Accounts Receivable' },
            { accountId: acc.get('4150')!, debit: 0, credit: net, description: 'Rental & Production (combined)' },
            { accountId: acc.get('2100')!, debit: 0, credit: vat, description: 'Output VAT (Payable)' },
          ],
        },
      },
    });
    console.log(`posted ${NUMBER}  ${entryNumber}  Dr 1100 ${total} / Cr 4150 ${net} / Cr 2100 ${vat}`);
  });

  const all = await prisma.invoice.findMany({ select: { id: true, invoiceNumber: true } });
  const orphans: string[] = [];
  for (const i of all) {
    const j = await prisma.journalEntry.count({ where: { sourceType: 'INVOICE', sourceId: i.id } });
    if (j === 0) orphans.push(i.invoiceNumber);
  }
  console.log(`\nInvoices with no journal: ${orphans.length ? orphans.join(', ') : 'none'}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
