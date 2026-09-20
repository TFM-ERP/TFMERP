/**
 * verify-thirteen01.ts
 *
 * Closes a caveat left open on 19 September.
 *
 * Invoice TFMI250118 was numbered from an email attachment name during the
 * placeholder fix, and the note recorded at the time said plainly: "invoice face
 * not re-read". The face has now been read. It says:
 *
 *     Invoice Number: 250118          Quot. No.: 225118
 *     Invoice Date: April 25, 2025    Rental Period: 28 April 2025 (1 day)
 *     Star Caravan 36-40 foot, 3,500.00 x 2          7,000.00
 *     Transportation to and from location, 500 x 2   1,000.00
 *     Total 8,000.00, discount 3,000.00, net 5,000.00, VAT 250.00, total 5,250.00
 *
 * Two corrections follow:
 *   - the number is 250118, not TFMI250118 (the TFMI prefix came from the file
 *     name, not the document);
 *   - the description was never recorded, so it is stamped on now.
 *
 * IT IS NOT A DUPLICATE OF 250120, and this script records why, because the two
 * look alike enough to be merged by mistake later:
 *
 *   250118  25 Apr  caravans and transport     5,250.00  paid ref 473981934
 *   250120  26 Apr  unit, fans and crew        5,250.00  paid ref 474239945
 *
 * Same customer, same rental date (28 April 2025), same total — and completely
 * different line items. The April statement carries BOTH payments on 26/04/2025
 * and the running balance proves it: 2,544.78 -> 7,794.78 -> 13,044.78. Two
 * supplies, two invoices, two transfers. Confirmed by the General Manager
 * 20 Sep 2026 after the possibility of a duplicate was put to him.
 *
 * Read-only unless --apply is passed.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

const OLD_NUMBER = 'TFMI250118';
const NEW_NUMBER = '250118';

const SUBJECT = 'Star Caravan 36-40 foot x2 and transportation — 28 April 2025 (1 day)';

const ADDITION =
  '[20 Sep 2026] Invoice face read for the first time, closing the caveat recorded on ' +
  '19 Sep 2026 ("invoice face not re-read"). The document is headed "Invoice Number: ' +
  '250118, Invoice Date: April 25, 2025, Quot. No.: 225118", rental period 28 April 2025 ' +
  '(1 day): Star Caravan 36-40 foot at 3,500.00 x 2 = 7,000.00 and transportation to and ' +
  'from location at 500.00 x 2 = 1,000.00, total 8,000.00 less 3,000.00 discount = ' +
  '5,000.00 net, VAT 250.00, grand total 5,250.00. The number is 250118; the TFMI prefix ' +
  'came from the file name, not the document, and has been removed. ' +
  'NOT A DUPLICATE OF 250120: that is a separate invoice dated 26 April 2025 for the same ' +
  'customer and the same rental date, also 5,250.00, but for a package unit for 45 PAX, ' +
  'industrial fans and crew — entirely different line items. The April 2025 statement ' +
  'carries BOTH payments on 26/04/2025, references 473981934 and 474239945, and the ' +
  'running balance proves both landed: 2,544.78 to 7,794.78 to 13,044.78. Two supplies, ' +
  'two invoices, two transfers. Confirmed by the General Manager 20 Sep 2026 after the ' +
  'possibility of a duplicate was put to him.';

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

function appendNote(existing: string | null, addition: string): string {
  const base = (existing ?? '').trim();
  return base.length > 0 ? `${base}\n\n${addition}` : addition;
}

async function main(): Promise<void> {
  console.log(APPLY ? '=== APPLYING ===\n' : '=== READ ONLY (pass --apply to write) ===\n');

  const invoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: [OLD_NUMBER, NEW_NUMBER, '250120'] } },
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      subtotal: true,
      vatAmount: true,
      total: true,
      amountPaid: true,
      amountDue: true,
      status: true,
      subject: true,
      internalNotes: true,
      client: { select: { companyName: true } },
    },
    orderBy: { issueDate: 'asc' },
  });

  for (const invoice of invoices) {
    console.log(
      `  ${invoice.invoiceNumber.padEnd(12)}${invoice.issueDate.toISOString().slice(0, 10)}  ` +
        `${(invoice.client?.companyName ?? '').slice(0, 18).padEnd(20)}` +
        `net ${money(dec(invoice.subtotal)).padStart(9)}  VAT ${money(dec(invoice.vatAmount)).padStart(7)}  ` +
        `total ${money(dec(invoice.total)).padStart(9)}  ${invoice.status}`,
    );
    console.log(`               ${invoice.subject ?? '(no description)'}`);

    const payments = await prisma.payment.findMany({
      where: { invoiceId: invoice.id },
      select: { paymentNumber: true, paymentDate: true, amount: true, reference: true },
    });
    for (const payment of payments) {
      console.log(
        `               receipt ${payment.paymentNumber}  ` +
          `${payment.paymentDate.toISOString().slice(0, 10)}  ` +
          `${money(dec(payment.amount))}  ref ${payment.reference ?? '-'}`,
      );
    }
  }

  const target = invoices.find((i) => i.invoiceNumber === OLD_NUMBER);
  if (!target) {
    console.log(`\n  ${OLD_NUMBER} not found — already renamed, nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  const clash = invoices.find((i) => i.invoiceNumber === NEW_NUMBER);
  if (clash) {
    console.log(`\n  REFUSED: an invoice numbered ${NEW_NUMBER} already exists. Left alone.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n  ${OLD_NUMBER} -> ${NEW_NUMBER}, description stamped on`);

  if (!APPLY) {
    console.log('\n=== nothing written ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: target.id },
      data: {
        invoiceNumber: NEW_NUMBER,
        subject: SUBJECT,
        internalNotes: appendNote(target.internalNotes, ADDITION),
      },
    });

    const journals = await tx.journalEntry.findMany({
      where: { sourceType: 'INVOICE', sourceId: target.id },
      select: { id: true, memo: true },
    });
    for (const journal of journals) {
      await tx.journalEntry.update({
        where: { id: journal.id },
        data: { memo: (journal.memo ?? '').replace(OLD_NUMBER, NEW_NUMBER) },
      });
    }
  });

  console.log(`  renamed, and ${NEW_NUMBER} now carries its real description`);

  const lines = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  let debits = 0;
  let credits = 0;
  for (const l of lines) {
    debits += dec(l.debit);
    credits += dec(l.credit);
  }
  console.log(
    `\n  trial balance: debits ${money(debits)}  credits ${money(credits)}  ` +
      `difference ${money(debits - credits)}`,
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
