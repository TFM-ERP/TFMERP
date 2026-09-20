/**
 * Al Falah Academy — corrects the placeholder to the invoice as issued.
 *
 *   FILED-2026-Q1-I5   28,047.62 + 1,402.38 = 29,450.00   (imported figures)
 *        ->  26033      28,000.00 + 1,400.00 = 29,400.00   (invoice + bank)
 *
 * Confirmed by the General Manager 19 Sep 2026: 29,400 is correct and received.
 * The journal lines are corrected to match. Pass --dry for the plan only.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const FROM = 'FILED-2026-Q1-I5';
const TO = '26033';
const NET = 28000;
const VAT = 1400;
const TOTAL = 29400;
const ISSUE = new Date('2026-02-13T00:00:00.000Z');

const NOTE =
  'Corrected 19 Sep 2026 from the invoice document and the bank. The document is ' +
  '"Tax Invoice. Invoice No.: 26033, Date: 13 FEB, 2026", quotation 205186 of ' +
  '19 JAN 2026, project "Website Design & Development for Al Falah Academy". The ' +
  'whole engagement is 70,000.00 + 3,500.00 VAT = 73,500.00, and this invoice is the ' +
  'first instalment, marked "Due Payment 1 of 3 — AED 29,400.00" (40%). RECEIVED: ' +
  '29,400.00 on 20 Feb 2026, "B/O AL FALAH ACADEMY - ABU DHABI", bank ref 17539313. ' +
  'The imported figures were 28,047.62 + 1,402.38 = 29,450.00, which was 29,450 ' +
  'grossed down at 5% rather than the amount actually invoiced; the document and the ' +
  'bank both say 29,400.00 and both have been followed. Journal lines corrected to ' +
  'match. REMAINING ON THIS ENGAGEMENT: 44,100.00 across payments 2 and 3 — invoices ' +
  '26035 (22,050.00) and 26036 (7,350.00) are in the ledger as DRAFT and together ' +
  'come to 29,400.00, so 14,700.00 of the 73,500.00 is not yet invoiced. The tax ' +
  'point of the remaining instalments is a question for the tax adviser.';

function appendNote(existing: string | null, addition: string): string {
  const base = (existing ?? '').trim();
  return base.length > 0 ? `${base}\n\n${addition}` : addition;
}

async function main(): Promise<void> {
  const inv = await prisma.invoice.findFirst({
    where: { invoiceNumber: FROM },
    include: { items: true },
  });
  if (!inv) throw new Error(`${FROM} not found. Aborting.`);

  const clash = await prisma.invoice.findFirst({
    where: { invoiceNumber: TO },
    select: { invoiceNumber: true },
  });
  if (clash) throw new Error(`${TO} already in use. Aborting.`);

  const journals = await prisma.journalEntry.findMany({
    where: { sourceType: 'INVOICE', sourceId: inv.id },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });

  console.log(DRY ? '=== DRY RUN - NOTHING WILL BE WRITTEN ===' : '=== APPLYING ===');
  console.log(
    `${FROM} -> ${TO}   ${inv.subtotal} + ${inv.vatAmount} = ${inv.total}  ->  ${NET} + ${VAT} = ${TOTAL}`,
  );
  for (const j of journals) {
    for (const l of j.lines) {
      console.log(
        `  ${j.entryNumber} ${l.account.code}  dr=${l.debit} cr=${l.credit}  (${j.status})`,
      );
    }
  }
  if (DRY) return;

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: inv.id },
      data: {
        invoiceNumber: TO,
        issueDate: ISSUE,
        subtotal: NET,
        vatAmount: VAT,
        total: TOTAL,
        amountPaid: TOTAL,
        amountDue: 0,
        placeOfSupply: inv.placeOfSupply ?? 'Abu Dhabi',
        internalNotes: appendNote(inv.internalNotes, NOTE),
      },
    });

    for (const item of inv.items) {
      await tx.invoiceItem.update({
        where: { id: item.id },
        data: { unitPrice: NET, lineTotal: NET, taxAmount: VAT },
      });
    }

    for (const j of journals) {
      await tx.journalEntry.update({
        where: { id: j.id },
        data: { date: ISSUE, memo: `Invoice ${TO}` },
      });
      for (const l of j.lines) {
        const code = l.account.code;
        const data =
          code === '1100'
            ? { debit: TOTAL, credit: 0 }
            : code === '2100'
              ? { debit: 0, credit: VAT }
              : { debit: 0, credit: NET };
        await tx.journalLine.update({ where: { id: l.id }, data });
      }
      console.log(`  ${j.entryNumber}: Dr 1100 ${TOTAL} / Cr 4150 ${NET} / Cr 2100 ${VAT}`);
    }
  });

  const after = await prisma.invoice.findFirst({
    where: { invoiceNumber: TO },
    select: { invoiceNumber: true, issueDate: true, subtotal: true, vatAmount: true, total: true },
  });
  console.log('\nAFTER:', JSON.stringify(after));

  const left = await prisma.invoice.count({ where: { invoiceNumber: { startsWith: 'FILED-' } } });
  console.log(`Placeholders still outstanding anywhere: ${left}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
