/**
 * Books 17 (Khalifa Award for Education) — resolution of 19 Sep 2026.
 *
 * Decision: invoice 2051001 (17,876.25) is SUPERSEDED and is NOT posted. The
 * supply already in the ledger at 22,968.75 is the one that was executed and paid.
 * See the note written below for the full evidence chain.
 *
 * This script only renames the live invoice from its placeholder to the number
 * printed on its face and records the finding. No figure changes.
 *
 * Pass --dry to print the plan without writing.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

const FROM = 'FILED-2025-Q2-I5';
const TO = '2i2054045';

const EVIDENCE = [
  'Number confirmed 19 Sep 2026 from the invoice document: "I. No.: 2i2054045", ',
  '"Date: May 01, 2025", quotation 205050 dated APR 21, 2025, project "17th Cycle ',
  'Books printing". Line items: أناشيد البراءة 250 @ 19.00 = 4,750.00 (24x16.8cm ',
  'landscape, 28+4pp, 170gsm matt, hard binding, gold foil logo); أزهار من أشعار 250 ',
  '@ 34.50 = 8,625.00 (24x16.8cm landscape, 52+4pp, hard binding, gold foil logo); ',
  'إعادة تصميم الكتاب والرسومات 2 @ 4,250 = 8,500.00. Total 21,875.00 + VAT 1,093.75 ',
  '= 22,968.75, terms 50% on quotation approval and 50% on delivery. SETTLED IN FULL: ',
  'two receipts of 11,484.40 on 2 and 13 May 2025 (bank refs 477361155 and 482342674). ',
  'NOTE ON THE NUMBER: the document prints "2i2054045", apparently a "2nd invoice" ',
  'prefix on 2054045. The bare number 2054045 belongs to a different invoice, to IY ',
  'Film Locations, dated the same day. The two are distinct; the prefix is what makes ',
  'them so. If house numbering should read otherwise, this is the line to change.',
  '\n\n',
  'BOOKS 17 — WHY INVOICE 2051001 (17,876.25) IS NOT IN THE LEDGER. Decided 19 Sep ',
  '2026 at the General Manager’s request, on the documents rather than on memory. ',
  '2051001 (10 Jan 2025, quotation 2042090, LPO 2024/65) billed FOUR soft-cover ',
  'perfect-bound books at 21x17cm on 100gsm wood-free with 350gsm art-glossy covers: ',
  'أناشيد البراءة 250 @ 14.50, التعليم الأخضر 250 @ 17.20, أزهار من أشعار 250 @ 13.00 ',
  'and خريطة الاستراتيجية 250 @ 23.40 = 17,025.00 + 851.25 = 17,876.25. It is ',
  'SUPERSEDED, not a separate supply, on five points: ',
  '(1) LPO 2024/65 of 07/01/2025 authorised exactly 17,876.25 for four publications ',
  'per quotation 2042090, payable 100% AFTER completion and delivery — and nothing was ',
  'ever paid against it: no 17,876.25 and no 8,938.13 appears in any statement that ',
  'opens, and the document itself says "Will share an invoice once the transfer is ',
  'received", so no transfer had been received. ',
  '(2) The specification then changed materially: four soft-cover 21x17 portrait books ',
  'became two hard-bound 24x16.8 landscape books with 2mm gray board and a gold foil ',
  'logo. Page counts differ too (48 -> 28+4; 30 -> 52+4). ',
  '(3) The two titles that survive into the May invoice carry a separate charge for ',
  '"redesign of the book and illustrations", 2 units at 4,250 — i.e. the two books were ',
  'redesigned, which is what a change of specification looks like. The other two ',
  'January titles do not appear at all. ',
  '(4) A NEW quotation was raised (205050, 21 Apr 2025) and a new invoice issued ',
  '(2i2054045, 1 May 2025). A supplementary charge would not need a fresh quotation ',
  'for the whole job. ',
  '(5) The only printing cost ever incurred is supplier invoice 114104 from Abu Dhabi ',
  'Printing & Publishing dated 30 Apr 2025, for exactly TWO books at 24x16.8cm on ',
  '170gsm art matt with 2mm gray board, 7,625.00 + 381.25 VAT. That is the MAY ',
  'specification. No cost was ever incurred for the four-book January specification, ',
  'because those books were never printed. ',
  'CONCLUSION: posting 2051001 would add 17,025.00 of revenue and 851.25 of output VAT ',
  'for work that was never executed and never paid. It must not be entered. ',
  'SEPARATELY: the General Manager recalled an overage billed "through the 9,000+ ',
  'invoice". That is invoice 206011 (9,000.00 + 450.00 = 9,450.00, 10 Jun 2026), which ',
  'belongs to BOOKS 18, not Books 17 — LPO 2025/LPO-69 of 09/12/2025 authorised 52,500 ',
  'for two 18th-cycle publications per quotation 205188, and 206011 is work beyond that ',
  'LPO. It is already in the ledger and was paid inside the single 35,700.00 receipt of ',
  '19 Jun 2026 (26,250.00 being half of 206010, plus 9,450.00 for 206011). Books 17 ',
  'handled its own increase by re-quoting, not by a separate overage invoice.',
].join('');

function appendNote(existing: string | null, addition: string): string {
  const base = (existing ?? '').trim();
  return base.length > 0 ? `${base}\n\n${addition}` : addition;
}

async function main(): Promise<void> {
  const inv = await prisma.invoice.findFirst({
    where: { invoiceNumber: FROM },
    select: { id: true, invoiceNumber: true, issueDate: true, total: true, internalNotes: true },
  });
  if (!inv) throw new Error(`${FROM} not found. Aborting.`);

  const clash = await prisma.invoice.findFirst({
    where: { invoiceNumber: TO },
    select: { invoiceNumber: true },
  });
  if (clash) throw new Error(`${TO} already in use. Aborting.`);

  const orphan = await prisma.invoice.findFirst({
    where: { invoiceNumber: '2051001' },
    select: { invoiceNumber: true },
  });
  if (orphan) throw new Error('2051001 is in the ledger — it should not be. Aborting.');

  if (DRY) {
    console.log('=== DRY RUN - NOTHING WILL BE WRITTEN ===');
    console.log(`${FROM} -> ${TO}  (${inv.issueDate.toISOString().slice(0, 10)}, ${inv.total})`);
    console.log('2051001: not in the ledger and will not be added.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: inv.id },
      data: { invoiceNumber: TO, internalNotes: appendNote(inv.internalNotes, EVIDENCE) },
    });
    const journals = await tx.journalEntry.findMany({
      where: { sourceType: 'INVOICE', sourceId: inv.id },
      select: { id: true, entryNumber: true },
    });
    for (const j of journals) {
      await tx.journalEntry.update({ where: { id: j.id }, data: { memo: `Invoice ${TO}` } });
      console.log(`  journal ${j.entryNumber}: memo -> "Invoice ${TO}"`);
    }
  });

  console.log(`${FROM} -> ${TO}`);

  const left = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: 'FILED-' } },
    select: { invoiceNumber: true, issueDate: true, total: true },
    orderBy: { issueDate: 'asc' },
  });
  console.log(`\nPlaceholders still outstanding: ${left.length}`);
  for (const l of left) {
    console.log(`  ${l.invoiceNumber} | ${l.issueDate.toISOString().slice(0, 10)} | ${l.total}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
