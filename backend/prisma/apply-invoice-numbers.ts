/**
 * Replaces the placeholder invoice numbers with the real numbers read off the
 * invoice faces, and re-dates the RK Motion Pictures invoice to its true 2024
 * tax point.
 *
 * Authorised by the General Manager on 19 Sep 2026: "run the comfirmed ones and
 * the rk".
 *
 * Every existing internalNotes value is PRESERVED and the evidence is appended.
 * The [VAT2025:*] markers at the head of those notes are load-bearing for the
 * VAT reconciliation narrative and must survive this run untouched.
 *
 * Runs inside a single transaction. Pass --dry to print the plan without
 * writing.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');
const STAMP = 'Number confirmed 19 Sep 2026 from the invoice document';

interface Rename {
  from: string;
  to: string;
  evidence: string;
  newIssueDate?: string;
  journalMemo?: string;
}

const RENAMES: Rename[] = [
  {
    from: 'FILED-2025-Q4-I5',
    to: '25150',
    evidence:
      `${STAMP}: "Invoice No.: 25150", "Date: 1 NOV, 2025", Total 114,000, ` +
      `Grand Total 119,700 - agrees with the recorded figures.`,
  },
  {
    from: 'FILED-2025-Q4-I4',
    to: '250655',
    evidence:
      `${STAMP}: "Inv. No.: 250655", "Date: DEC 5, 2025", Total 29,000, VAT 1,450, ` +
      `Grand Total 30,450, marked "Payment 1 of 2". NOTE: a second document, ` +
      `250656, exists for the SAME supply (identical line items "Abu Dhabi - ` +
      `Photography", 11 & 14 OCT 2025, Star Caravan x2, identical 30,450, marked ` +
      `"Payment 2 of 2"). Both documents state the full 30,450 while each requests ` +
      `15,225. Only ONE supply of 30,450 is recorded here; 250656 must NOT be ` +
      `entered as a second invoice or revenue and output VAT will be doubled.`,
  },
  {
    from: 'FILED-2025-Q2-I6',
    to: '205135',
    evidence:
      `${STAMP}: TAX INVOICE dated "APR 3, 2025", Package Total 50,000, ` +
      `Grand Total 52,500 - agrees with the recorded figures. The "Inv. No." field ` +
      `on the document face is blank; the number 205135 is taken from the file name ` +
      `of the document that was issued to the client.`,
  },
  {
    from: 'FILED-2025-Q2-I7',
    to: '25120',
    evidence:
      `${STAMP}: "Inv. No. 25120", "JUN 02, 2025", Grand Total 3,675 - agrees with ` +
      `the recorded figures.`,
  },
  {
    from: 'FILED-2025-Q2-I4',
    to: 'TFMI250118',
    evidence:
      `Number confirmed 19 Sep 2026 from the sent-mail record: message of 25/04/2025 ` +
      `"Attached is the requested invoice" carrying the attachment ` +
      `"Invoice Thirteen01 TFMI250118 25042025.pdf". The invoice document itself has ` +
      `not been re-read, so the number rests on the sent-mail evidence alone.`,
  },
  {
    from: 'FILED-2025-Q3-I4',
    to: '2050152',
    evidence:
      `${STAMP}: "Inv. No.: 2050152", "Date: SEP 30th, 2025", Total 30,000, VAT 1,500, ` +
      `Grand Total 31,500 - agrees with the recorded figures.`,
  },
  {
    from: 'FILED-2025-Q1-I7',
    to: '204442',
    newIssueDate: '2024-11-24',
    journalMemo:
      'Invoice 204442 - RK Motion Pictures. Re-dated 19 Sep 2026 to the true tax ' +
      'point of 24 Nov 2024 (was held at 31 Mar 2025 because the imported workbook ' +
      'cell read "24 1 2024").',
    evidence:
      `${STAMP}: "Inv. No. 204442", dated 24 NOV 2024 - Filming permit 6,000 + ` +
      `Equipment permit 1,400 = Total 7,400, VAT 370, Grand Total 7,770. RE-DATED ` +
      `19 Sep 2026 from 31 Mar 2025 to 24 Nov 2024, its true tax point, on the ` +
      `General Manager's instruction. CONSEQUENCE: this supply is a 2024 supply and ` +
      `is no longer part of FY2025. 2025 revenue falls by 7,400 net. The filed ` +
      `2025-Q1 VAT return DID include this supply, so that return overstates output ` +
      `VAT by 370 and the 2024 position understates it by the same amount - refer to ` +
      `the tax adviser before the Corporate Tax return is filed.`,
  },
];

function appendNote(existing: string | null, addition: string): string {
  const base = (existing ?? '').trim();
  return base.length > 0 ? `${base}\n\n${addition}` : addition;
}

async function main(): Promise<void> {
  const numbers = RENAMES.map((r) => r.from);

  const before = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: numbers } },
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      dueDate: true,
      internalNotes: true,
    },
  });

  if (before.length !== RENAMES.length) {
    throw new Error(
      `Expected ${RENAMES.length} placeholder invoices, found ${before.length}. Aborting.`,
    );
  }

  const targets = RENAMES.map((r) => r.to);
  const clash = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: targets } },
    select: { invoiceNumber: true },
  });
  if (clash.length > 0) {
    throw new Error(
      `Target numbers already in use: ${clash.map((c) => c.invoiceNumber).join(', ')}. Aborting.`,
    );
  }

  const byNumber = new Map(before.map((inv) => [inv.invoiceNumber, inv]));

  console.log(DRY ? '=== DRY RUN - NOTHING WILL BE WRITTEN ===' : '=== APPLYING ===');

  if (DRY) {
    for (const r of RENAMES) {
      const inv = byNumber.get(r.from);
      if (!inv) continue;
      console.log(
        `${r.from} -> ${r.to}` +
          (r.newIssueDate
            ? `  (issueDate ${inv.issueDate.toISOString().slice(0, 10)} -> ${r.newIssueDate})`
            : ''),
      );
    }
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const r of RENAMES) {
      const inv = byNumber.get(r.from);
      if (!inv) throw new Error(`Placeholder ${r.from} vanished mid-run. Aborting.`);

      const data: Record<string, unknown> = {
        invoiceNumber: r.to,
        internalNotes: appendNote(inv.internalNotes, r.evidence),
      };

      if (r.newIssueDate) {
        const nd = new Date(`${r.newIssueDate}T00:00:00.000Z`);
        data.issueDate = nd;
        if (inv.dueDate && inv.dueDate > nd) data.dueDate = nd;
      }

      await tx.invoice.update({ where: { id: inv.id }, data });

      const journals = await tx.journalEntry.findMany({
        where: { sourceType: 'INVOICE', sourceId: inv.id },
        select: { id: true, entryNumber: true, memo: true },
      });

      for (const j of journals) {
        const jdata: Record<string, unknown> = {
          memo: r.journalMemo ?? `Invoice ${r.to}`,
        };
        if (r.newIssueDate) jdata.date = new Date(`${r.newIssueDate}T00:00:00.000Z`);
        await tx.journalEntry.update({ where: { id: j.id }, data: jdata });
        console.log(
          `  journal ${j.entryNumber}: memo -> "${jdata.memo}"` +
            (r.newIssueDate ? `, date -> ${r.newIssueDate}` : ''),
        );
      }

      console.log(
        `${r.from} -> ${r.to}` + (r.newIssueDate ? ` (re-dated to ${r.newIssueDate})` : ''),
      );
    }
  });

  console.log('\n=== AFTER ===');
  const after = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: targets } },
    include: { client: { select: { companyName: true } } },
    orderBy: { issueDate: 'asc' },
  });
  for (const inv of after) {
    console.log(
      `${inv.invoiceNumber} | ${inv.issueDate.toISOString().slice(0, 10)} | ${
        inv.client?.companyName ?? ''
      } | tot=${inv.total}`,
    );
  }
  console.log(`(${after.length} of ${targets.length} renamed)`);

  const leftovers = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: 'FILED-2025-' } },
  });
  console.log(`\nPlaceholders still outstanding: ${leftovers}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
