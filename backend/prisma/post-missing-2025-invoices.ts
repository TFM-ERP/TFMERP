/**
 * Posts the two 2025 tax invoices the General Manager confirmed on 19 Sep 2026
 * as real and paid, and which were absent from the ledger entirely:
 *
 *   2510032  The Creator Space FZ LLC   12 Jan 2025   24,000.00 + 1,200.00 = 25,200.00
 *   125036   Media Mania FZ LLC          8 Apr 2025    5,000.00 +   250.00 =  5,250.00
 *
 * Compass 250121 is deliberately NOT posted: the General Manager confirmed the
 * job never happened and was never paid.
 *
 * Khalifa 2051001 is deliberately NOT posted: still open (see the notes below).
 *
 * Each invoice gets the standard posting Dr 1100 / Cr 4150 + Cr 2100.
 * Pass --dry to print the plan without writing.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

interface Spec {
  number: string;
  issueDate: string;
  clientName: string;
  clientTrn: string;
  net: number;
  vat: number;
  placeOfSupply: string;
  description: string;
  notes: string;
}

const SPECS: Spec[] = [
  {
    number: '2510032',
    issueDate: '2025-01-12',
    clientName: 'The Creator Space FZ LLC',
    clientTrn: '104016158800003',
    net: 24000,
    vat: 1200,
    placeOfSupply: 'Abu Dhabi',
    description:
      'Star Caravan 28-32 foot, 12 days, rental period 13-25 January 2025 - Yas Creative Hub, Yas Island',
    notes:
      '[VAT2025:UNDECLARED] Added 19 Sep 2026. Found in the OneDrive Commercials/TFM/2025 folder ' +
      'during the audit reconciliation and absent from the ledger entirely. The document is a TAX ' +
      'INVOICE, "In. No.: 2510032" (the file name says I251003, which is wrong), dated JAN 12, 2025, ' +
      'rental period 13-25 January 2025, one Star Caravan 28-32 foot at AED 2,000 for 12 days = ' +
      '24,000.00, tax 5% 1,200.00, grand total 25,200.00. Customer TRN 104016158800003. Terms were ' +
      '50% on approval and 50% on 19/01/2025. CONFIRMED BY THE GENERAL MANAGER 19 Sep 2026 as a ' +
      'correct invoice that was paid; he quoted the value as 25,000, the document says 25,200 and ' +
      'the document has been followed. THE RECEIPT IS NOT EVIDENCED: the January to April 2025 bank ' +
      'statements are password protected and were not opened. VAT CONSEQUENCE: this supply was NOT ' +
      'in the filed 2025-Q1 VAT return, which therefore understates output VAT by 1,200.00. Refer to ' +
      'the tax adviser before the Corporate Tax return is filed.',
  },
  {
    number: '125036',
    issueDate: '2025-04-08',
    clientName: 'Media Mania FZ-LLC',
    clientTrn: '100289675900003',
    net: 5000,
    vat: 250,
    placeOfSupply: 'Abu Dhabi',
    description:
      'HMU/Wardrobe rest caravan 32-37 foot, 4-door mobile toilet, transportation, 7kVA generator and ' +
      'fuel - 7 April 2025 (1 day), Yas Island',
    notes:
      '[VAT2025:UNDECLARED] Added 19 Sep 2026. Found in the OneDrive Commercials/TFM/2025 folder ' +
      'during the audit reconciliation and absent from the ledger entirely. The document is a TAX ' +
      'INVOICE, "Inv. No.: 125036", quotation 205036, dated APR 8, 2025, rental period 7 April 2025 ' +
      '(1 day) at Yas Island. Line items 6,150.00 less a 1,150.00 discount = 5,000.00 net, VAT 5% ' +
      '250.00, grand total 5,250.00. The document carries a PAID stamp on its face. Customer TRN ' +
      '100289675900003. CONFIRMED BY THE GENERAL MANAGER 19 Sep 2026 as paid. THE RECEIPT IS NOT ' +
      'EVIDENCED IN THE BANK: the April 2025 statement is password protected and was not opened; the ' +
      'two 5,250.00 receipts in February 2025 belong to Wonderful Productions, not to this supply. ' +
      'VAT CONSEQUENCE: this supply was NOT in the filed 2025-Q2 VAT return, which therefore ' +
      'understates output VAT by 250.00. Refer to the tax adviser before the Corporate Tax return ' +
      'is filed.',
  },
];

function d(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
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
  const clash = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: SPECS.map((s) => s.number) } },
    select: { invoiceNumber: true },
  });
  if (clash.length > 0) {
    throw new Error(`Already in the ledger: ${clash.map((c) => c.invoiceNumber).join(', ')}.`);
  }

  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: ['1100', '2100', '4150'] } },
    select: { id: true, code: true },
  });
  const acc = new Map(accounts.map((a) => [a.code, a.id]));
  for (const c of ['1100', '2100', '4150']) {
    if (!acc.has(c)) throw new Error(`GL account ${c} not found. Aborting.`);
  }

  if (DRY) {
    console.log('=== DRY RUN - NOTHING WILL BE WRITTEN ===');
    for (const s of SPECS) {
      const existing = await prisma.client.findFirst({
        where: { companyName: s.clientName },
        select: { id: true, trn: true },
      });
      console.log(
        `${s.number} | ${s.issueDate} | ${s.clientName}` +
          `${existing ? ' (client exists)' : ' (CLIENT WILL BE CREATED)'}` +
          ` | ${s.net} + ${s.vat} = ${s.net + s.vat}`,
      );
      console.log(`    Dr 1100 ${s.net + s.vat}  /  Cr 4150 ${s.net}  +  Cr 2100 ${s.vat}`);
    }
    console.log('\nNOT posted: Compass 250121 (never happened), Khalifa 2051001 (still open).');
    return;
  }

  const taken = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const s of SPECS) {
      let client = await tx.client.findFirst({
        where: { companyName: s.clientName },
        select: { id: true, trn: true, vatId: true },
      });

      if (!client) {
        const created = await tx.client.create({
          data: {
            companyName: s.clientName,
            trn: s.clientTrn,
            vatId: s.clientTrn,
            country: 'UAE',
            currency: 'AED',
            notes: `Created 19 Sep 2026 from tax invoice ${s.number} during the 2025 audit reconciliation.`,
          },
          select: { id: true, trn: true, vatId: true },
        });
        client = created;
        console.log(`  created client ${s.clientName} (TRN ${s.clientTrn})`);
      } else if (!client.trn) {
        await tx.client.update({
          where: { id: client.id },
          data: { trn: s.clientTrn, vatId: client.vatId ?? s.clientTrn },
        });
        console.log(`  set TRN ${s.clientTrn} on existing client ${s.clientName}`);
      }

      const total = s.net + s.vat;

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: s.number,
          clientId: client.id,
          activity: 'BOTH',
          invoiceType: 'TAX_INVOICE',
          status: 'PAID',
          issueDate: d(s.issueDate),
          currency: 'AED',
          subtotal: s.net,
          vatAmount: s.vat,
          total,
          amountPaid: total,
          amountDue: 0,
          vatDisplay: 'SEPARATE',
          placeOfSupply: s.placeOfSupply,
          internalNotes: s.notes,
          createdById: 'user-admin',
          items: {
            create: [
              {
                sortOrder: 0,
                kind: 'SERVICE',
                description: s.description,
                quantity: 1,
                unit: 'job',
                days: 1,
                unitPrice: s.net,
                discountPct: 0,
                lineTotal: s.net,
                taxAmount: s.vat,
              },
            ],
          },
        },
        select: { id: true },
      });

      const entryNumber = await nextEntryNumber(tx, taken);
      await tx.journalEntry.create({
        data: {
          entryNumber,
          date: d(s.issueDate),
          memo: `Invoice ${s.number}`,
          source: 'SYSTEM',
          sourceType: 'INVOICE',
          sourceId: invoice.id,
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: acc.get('1100')!,
                debit: total,
                credit: 0,
                description: 'Accounts Receivable',
              },
              {
                accountId: acc.get('4150')!,
                debit: 0,
                credit: s.net,
                description: 'Rental & Production (combined)',
              },
              {
                accountId: acc.get('2100')!,
                debit: 0,
                credit: s.vat,
                description: 'Output VAT (Payable)',
              },
            ],
          },
        },
      });

      console.log(`posted ${s.number} (${s.issueDate}) ${s.net} + ${s.vat} = ${total}  ${entryNumber}`);
    }
  });

  console.log('\n=== 2025 SALES INVOICES AFTER THE RUN ===');
  const all = await prisma.invoice.findMany({
    where: {
      issueDate: { gte: d('2025-01-01'), lt: d('2026-01-01') },
    },
    include: { client: { select: { companyName: true } } },
    orderBy: { issueDate: 'asc' },
  });
  let net = 0;
  for (const i of all) {
    net += Number(i.subtotal);
    console.log(
      `  ${i.invoiceNumber} | ${i.issueDate.toISOString().slice(0, 10)} | ${
        i.client?.companyName ?? ''
      } | ${i.subtotal} + ${i.vatAmount} = ${i.total}`,
    );
  }
  console.log(`  (${all.length} invoices, net ${net.toFixed(2)})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
