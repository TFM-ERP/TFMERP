/**
 * Second batch of placeholder invoice-number replacements, each confirmed from
 * the invoice PDF supplied by the General Manager on 19 Sep 2026.
 *
 * NUMBERS ONLY. No date is changed by this script. Three of these invoices carry
 * 2024 tax points while sitting in FY2025; that re-dating decision is still open
 * and is deliberately NOT made here.
 *
 * Existing internalNotes and their [VAT2025:*] markers are preserved; evidence is
 * appended. Runs in one transaction. Pass --dry to print the plan only.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');

interface Rename {
  from: string;
  to: string;
  evidence: string;
}

const RENAMES: Rename[] = [
  {
    from: 'FILED-2025-Q1-I5',
    to: '20459',
    evidence:
      'Number confirmed 19 Sep 2026 from the invoice document: "Inv. No.: 20459", ' +
      '"Date: DEC 10, 2024", quotation reference 204452, total 20,000 + VAT 1,000 = ' +
      'grand total 21,000 - agrees with the recorded figures. TAX POINT IS 2024: this ' +
      'supply is dated 10 Dec 2024 but is held in FY2025 because the imported workbook ' +
      'cell read "10 12 2024". The date has deliberately NOT been changed - see the ' +
      'note on invoice 204442 (RK Motion Pictures) for the same issue, which was moved ' +
      'to 2024 on 19 Sep 2026. Pending a decision by the General Manager and his tax ' +
      'adviser.',
  },
  {
    from: 'FILED-2025-Q1-I4',
    to: '20458',
    evidence:
      'Number confirmed 19 Sep 2026 from the invoice document: "Inv. No.: 20458", ' +
      '"Quot. No.: 204458", "Date: DEC11, 2024". Project "Arabian Nights - Manarat Al ' +
      'Saadiyat", rental period 14-15 Dec 2024. Two Star Caravans at AED 3,000, qty 2, ' +
      '2 days = AED 10,000; Tax 5% AED 500; Grand Total AED 10,500 - agrees with the ' +
      'recorded figures. The "Total AED 20,000" row printed on the document is an error ' +
      'on the document itself: the line items come to 10,000, the VAT of 500 is 5% of ' +
      '10,000, and quotation 204458 (also 11 Dec 2024, same project and rental period) ' +
      'quotes AED 10,000. NOT A DUPLICATE OF 20459: that invoice cites a different ' +
      'quotation (204452), a different rental structure and a 3-day period. Two separate ' +
      'supplies; the coincidence that 20459 shows a "2nd payment 50%" of 10,500 is just ' +
      'that. Place of supply is Abu Dhabi (Manarat Al Saadiyat) although the customer is ' +
      'registered in Dubai. Customer TRN on the document: 100068913100003. TAX POINT IS ' +
      '2024 - date deliberately NOT changed, pending the same decision as 20459.',
  },
  {
    from: 'FILED-2025-Q1-I6',
    to: '204443',
    evidence:
      'Number confirmed 19 Sep 2026 from the invoice document: "Invoice No.:204443", ' +
      '"Date.: 26 NOV 2024", "Rental date: 24 NOV 2024" - which is the date the imported ' +
      'workbook carried as "24 11 2024". Mobile Toilet 4-Doors AED 1,500 + ' +
      'Transportation two ways AED 500 = Total AED 2,000, VAT 5% AED 100, Grand Total ' +
      'AED 2,100 - agrees with the recorded figures. Customer TRN on the document: ' +
      '104589819200003 (ALTERFILMS MEDIA PRODUCTION L.L.C, Bur Dubai). TAX POINT IS ' +
      '2024 - date deliberately NOT changed, pending the same decision as 20459.',
  },
  {
    from: 'FILED-2025-Q4-I7',
    to: '250640',
    evidence:
      'Number confirmed 19 Sep 2026 from the invoice document: "Inv. No.: 250640", ' +
      '"Date: NOV 10, 2025". Project "Abu Dhabi - Photography", rental period 11 and 14 ' +
      'OCT 2025 (2 days). Star Caravan VVIP 33-38 foot 7,000 + transportation 750 + ' +
      'waste/fresh water 500 + generator 700 = Total 8,950, less discount 1,950 = new ' +
      'total 7,000, Tax 5% 350, Grand Total Due 7,350 - agrees with the recorded ' +
      'figures. Place of supply Abu Dhabi. Customer TRN: 100068913100003. NOTE: invoice ' +
      '250655 covers the same project name and the same rental dates (11 & 14 Oct 2025) ' +
      'for a different unit (2x Star Caravan, 30,450). They appear to be two units on ' +
      'one shoot rather than a duplication, but confirm before either is amended.',
  },
  {
    from: 'FILED-2026-Q1-I4',
    to: '26031',
    evidence:
      'Number confirmed 19 Sep 2026 from the invoice document: "Tax Invoice. Invoice ' +
      'No.: 26031", "Date: 03 FEB, 2026". Project "Commercial", rental period 6 FEB ' +
      '(1 day). Star Caravan 7,000 + transportation 1,000 + generator x2 700 + waste/ ' +
      'fresh water 350 = Total 9,050, less discount 2,050 = 7,000, VAT 5% 350, Grand ' +
      'Total 7,350 - agrees with the recorded figures. Customer TRN: 104027676600003 ' +
      '(Cinegate FZC, Sharjah Publishing City Free Zone).',
  },
];

function appendNote(existing: string | null, addition: string): string {
  const base = (existing ?? '').trim();
  return base.length > 0 ? `${base}\n\n${addition}` : addition;
}

async function main(): Promise<void> {
  const froms = RENAMES.map((r) => r.from);
  const tos = RENAMES.map((r) => r.to);

  const before = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: froms } },
    select: { id: true, invoiceNumber: true, issueDate: true, total: true, internalNotes: true },
  });

  if (before.length !== RENAMES.length) {
    throw new Error(`Expected ${RENAMES.length} placeholders, found ${before.length}. Aborting.`);
  }

  const clash = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: tos } },
    select: { invoiceNumber: true },
  });
  if (clash.length > 0) {
    throw new Error(
      `Target numbers already in use: ${clash.map((c) => c.invoiceNumber).join(', ')}. Aborting.`,
    );
  }

  const byNumber = new Map(before.map((i) => [i.invoiceNumber, i]));

  if (DRY) {
    console.log('=== DRY RUN - NOTHING WILL BE WRITTEN ===');
    for (const r of RENAMES) {
      const inv = byNumber.get(r.from);
      console.log(
        `${r.from} -> ${r.to}  (date unchanged at ${inv?.issueDate
          .toISOString()
          .slice(0, 10)}, total ${inv?.total})`,
      );
    }
    return;
  }

  console.log('=== APPLYING (numbers only, no dates changed) ===');

  await prisma.$transaction(async (tx) => {
    for (const r of RENAMES) {
      const inv = byNumber.get(r.from);
      if (!inv) throw new Error(`Placeholder ${r.from} vanished mid-run. Aborting.`);

      await tx.invoice.update({
        where: { id: inv.id },
        data: { invoiceNumber: r.to, internalNotes: appendNote(inv.internalNotes, r.evidence) },
      });

      const journals = await tx.journalEntry.findMany({
        where: { sourceType: 'INVOICE', sourceId: inv.id },
        select: { id: true, entryNumber: true },
      });
      for (const j of journals) {
        await tx.journalEntry.update({ where: { id: j.id }, data: { memo: `Invoice ${r.to}` } });
        console.log(`  journal ${j.entryNumber}: memo -> "Invoice ${r.to}"`);
      }

      console.log(`${r.from} -> ${r.to}`);
    }
  });

  console.log('\n=== AFTER ===');
  const after = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: tos } },
    include: { client: { select: { companyName: true } } },
    orderBy: { issueDate: 'asc' },
  });
  for (const i of after) {
    console.log(
      `${i.invoiceNumber} | ${i.issueDate.toISOString().slice(0, 10)} | ${
        i.client?.companyName ?? ''
      } | ${i.total}`,
    );
  }

  const left = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: 'FILED-' } },
    select: { invoiceNumber: true, total: true },
  });
  console.log(`\nPlaceholders still outstanding: ${left.length}`);
  for (const l of left) console.log(`  ${l.invoiceNumber} (${l.total})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
