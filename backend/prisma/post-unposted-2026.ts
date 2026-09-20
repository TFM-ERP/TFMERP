/**
 * Three 2026 invoices exist as records but were never posted — they sit as DRAFT
 * with no journal entry at all, so their revenue and output VAT are missing from
 * the accounts entirely. All three are confirmed collected.
 *
 *   26035   Al Falah Academy   04/06/2026   21,000.00 + 1,050.00 = 22,050.00
 *   26036   Al Falah Academy   04/06/2026    7,000.00 +   350.00 =  7,350.00
 *   206011  Khalifa Award      10/06/2026    9,000.00 +   450.00 =  9,450.00
 *
 * MACQUIP 26011 (2,362.50) is deliberately left alone — settlement unconfirmed.
 *
 * Pass --dry to print the plan without writing.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

interface Spec {
  number: string;
  note: string;
}

const SPECS: Spec[] = [
  {
    number: '26035',
    note:
      'Posted 19 Sep 2026. This invoice existed as a record but had never been posted - ' +
      'it was DRAFT with no journal entry, so its 21,000.00 of revenue and 1,050.00 of ' +
      'output VAT were absent from the accounts. It is payment 2 of 3 on the Al Falah ' +
      'Academy new-website engagement: quotation 205186 of 5 Nov 2025 priced the build at ' +
      '84,000 excluding VAT; the engagement was contracted at 70,000.00 + 3,500.00 VAT = ' +
      '73,500.00, billed 40/30/30 as 29,400.00 (invoice 26033, received 20 Feb 2026), ' +
      '22,050.00 (this invoice) and a final 22,050.00. CONFIRMED BY THE GENERAL MANAGER ' +
      '19 Sep 2026 as PAID IN AUGUST 2026; the August 2026 bank statement is password ' +
      'protected and was not opened, so the receipt is not independently evidenced. ' +
      'THE FINAL 22,050.00 IS NOT YET INVOICED and is outstanding.',
  },
  {
    number: '26036',
    note:
      'Posted 19 Sep 2026. This invoice existed as a record but had never been posted - ' +
      'it was DRAFT with no journal entry, so its 7,000.00 of revenue and 350.00 of output ' +
      'VAT were absent from the accounts. CONFIRMED BY THE GENERAL MANAGER 19 Sep 2026 as ' +
      'a SEPARATE engagement, not part of the 73,500.00 website build: OTP implementation ' +
      'on the existing .NET registration system. RECEIVED: 7,350.00 on 27 Jun 2026, ' +
      '"B/O AL FALAH ACADEMY - ABU DHABI", bank ref 78882924. Related quotation 205187 of ' +
      '5 Oct 2025 covers maintenance, enhancement and technical support on the existing ' +
      'website at 75,000 excluding VAT; that wider scope has not been invoiced.',
  },
  {
    number: '206011',
    note:
      'Posted 19 Sep 2026. This invoice existed as a record but had never been posted - ' +
      'it was DRAFT with no journal entry, so its 9,000.00 of revenue and 450.00 of output ' +
      'VAT were absent from the accounts. It is the Books 18 overage, beyond LPO ' +
      '2025/LPO-69 of 09/12/2025 which authorised 52,500.00 for two 18th-cycle ' +
      'publications per quotation 205188. RECEIVED: paid inside the single 35,700.00 ' +
      'receipt of 19 Jun 2026, "B/O_EDUCATION KHALIF_674996537", bank ref 77499653 - ' +
      '26,250.00 being half of invoice 206010 plus 9,450.00 for this invoice. NOTE: the ' +
      'remaining 26,250.00 on 206010 was still outstanding at 30 Jun 2026.',
  },
];

function appendNote(existing: string | null, addition: string): string {
  const base = (existing ?? '').trim();
  return base.length > 0 ? `${base}\n\n${addition}` : addition;
}

async function nextEntryNumber(
  tx: Prisma.TransactionClient,
  taken: Set<string>,
): Promise<string> {
  const last = await tx.journalEntry.findMany({
    where: { entryNumber: { startsWith: 'JE-2026-' } },
    select: { entryNumber: true },
    orderBy: { entryNumber: 'desc' },
    take: 1,
  });
  let n = last.length ? parseInt(last[0].entryNumber.slice(-4), 10) : 0;
  let candidate = '';
  do {
    n += 1;
    candidate = `JE-2026-${String(n).padStart(4, '0')}`;
  } while (taken.has(candidate));
  taken.add(candidate);
  return candidate;
}

async function main(): Promise<void> {
  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: ['1100', '2100', '4150'] } },
    select: { id: true, code: true },
  });
  const acc = new Map(accounts.map((a) => [a.code, a.id]));
  for (const c of ['1100', '2100', '4150']) {
    if (!acc.has(c)) throw new Error(`GL account ${c} not found. Aborting.`);
  }

  const invoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: SPECS.map((s) => s.number) } },
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
  if (invoices.length !== SPECS.length) {
    throw new Error(`Expected ${SPECS.length} invoices, found ${invoices.length}. Aborting.`);
  }

  for (const inv of invoices) {
    const existing = await prisma.journalEntry.count({
      where: { sourceType: 'INVOICE', sourceId: inv.id },
    });
    if (existing > 0) {
      throw new Error(`${inv.invoiceNumber} already has ${existing} journal(s). Aborting.`);
    }
  }

  console.log(DRY ? '=== DRY RUN - NOTHING WILL BE WRITTEN ===' : '=== APPLYING ===');
  for (const inv of invoices) {
    console.log(
      `${inv.invoiceNumber} | ${inv.issueDate.toISOString().slice(0, 10)} | ${inv.subtotal} + ${
        inv.vatAmount
      } = ${inv.total} | ${inv.status} -> PAID, journal to be created`,
    );
  }
  if (DRY) return;

  const byNumber = new Map(invoices.map((i) => [i.invoiceNumber, i]));
  const taken = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const s of SPECS) {
      const inv = byNumber.get(s.number)!;
      const net = Number(inv.subtotal);
      const vat = Number(inv.vatAmount);
      const total = Number(inv.total);

      await tx.invoice.update({
        where: { id: inv.id },
        data: {
          status: 'PAID',
          amountPaid: total,
          amountDue: 0,
          internalNotes: appendNote(inv.internalNotes, s.note),
        },
      });

      const entryNumber = await nextEntryNumber(tx, taken);
      await tx.journalEntry.create({
        data: {
          entryNumber,
          date: inv.issueDate,
          memo: `Invoice ${s.number}`,
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
      console.log(`posted ${s.number}  ${entryNumber}  Dr 1100 ${total} / Cr 4150 ${net} / Cr 2100 ${vat}`);
    }
  });

  console.log('\n=== REMAINING INVOICES WITH NO JOURNAL ===');
  const all = await prisma.invoice.findMany({ select: { id: true, invoiceNumber: true, total: true } });
  const orphans: string[] = [];
  for (const i of all) {
    const j = await prisma.journalEntry.count({ where: { sourceType: 'INVOICE', sourceId: i.id } });
    if (j === 0) orphans.push(`${i.invoiceNumber} (${i.total})`);
  }
  console.log(orphans.length ? orphans.join(', ') : 'none');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
