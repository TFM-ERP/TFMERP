/**
 * post-dmi-26037.ts
 *
 * Raises the tax invoice for the Dubai Media Incorporated caravan rental at
 * Dubai Festival City, 28 February to 1 March 2026. The job went ahead and has
 * never been paid; only the quotation existed (TFMQ22605, 26 Mar 2026).
 *
 *   26037   Dubai Media Incorporated   1 Mar 2026   6,000.00 + 300.00 = 6,300.00
 *
 * Numbering and date confirmed by the General Manager on 20 Sep 2026: next in
 * the 2026 sequence (26011, 26031, 26033, 26035, 26036), dated at the tax point.
 *
 * TAX POINT. UAE VAT takes the earliest of the date the service is completed,
 * the date payment is received, and the date of the tax invoice. The service
 * finished on 1 March 2026 and nothing has been paid, so the tax point is
 * 1 March 2026 and the 300.00 of output VAT belongs in **Q1 2026** — a quarter
 * already filed. This is a correction for the tax adviser and is flagged as
 * such on the invoice record, in the same [VAT2026:UNDECLARED] form used for the
 * 2025 items.
 *
 * Posts Dr 1100 / Cr 4150 + Cr 2100 and leaves the invoice SENT and unpaid.
 * Pass --dry to print the plan without writing. Re-running is safe: it refuses
 * if 26037 already exists.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');

const NUMBER = '26037';
const ISSUE_DATE = '2026-03-01';
const CLIENT_NAME = 'Dubai Media Incorporated';
const CLIENT_TRN = '100044983300003';
const NET = 6000;
const VAT = 300;
const TOTAL = NET + VAT;
const PLACE_OF_SUPPLY = 'Dubai';

const DESCRIPTION =
  'Production office caravan, Dubai Festival City, 28 February to 1 March 2026 ' +
  '(2 days). Caravan 3,500.00 x 2 days = 7,000.00, transportation to and from ' +
  'location 500.00 x 2 = 1,000.00, 7 KVA generator 350.00 x 2 = 700.00, total ' +
  '8,700.00 less a 2,700.00 discount = 6,000.00 net.';

const NOTES =
  '[VAT2026:UNDECLARED] Raised 20 Sep 2026 during the audit reconciliation. ' +
  'The job went ahead and only the quotation existed: TFMQ22605 dated 26 Mar ' +
  '2026, addressed to Fatima AlAhbabi, Dubai Media Incorporated, TRN ' +
  '100044983300003, for a production office caravan at Dubai Festival City, ' +
  'rental period 28 February to 1 March 2026 (2 days), 8,700.00 less a 2,700.00 ' +
  'discount = 6,000.00 net, VAT 5% 300.00, grand total 6,300.00. CONFIRMED BY ' +
  'THE GENERAL MANAGER 20 Sep 2026: the job is new, it went ahead, and it has ' +
  'never been paid. TAX POINT: the service completed 1 March 2026 and no ' +
  'payment has been received, so under UAE VAT the tax point is 1 March 2026 ' +
  'and the 300.00 of output VAT belongs in the 2026-Q1 return, which was filed ' +
  'without it. Refer to the tax adviser alongside the 2025 correction ' +
  'schedule. NOT TO BE CONFUSED WITH INVOICE 25111, which is a different ' +
  'Dubai Media job (Al Mandoos, 7-8 March 2025) raised 22 May 2025 and settled ' +
  '4 June 2025 for the same 6,300.00. The bank carries exactly one 6,300.00 ' +
  'credit between January 2025 and July 2026 and it belongs to 25111, not to ' +
  'this invoice.';

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

async function nextEntryNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JE-${year}-`;
  const last = await tx.journalEntry.findMany({
    where: { entryNumber: { startsWith: prefix } },
    select: { entryNumber: true },
    orderBy: { entryNumber: 'desc' },
    take: 1,
  });
  const n = last.length > 0 ? parseInt(last[0].entryNumber.slice(-4), 10) : 0;
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');

  const existing = await prisma.invoice.findFirst({
    where: { invoiceNumber: NUMBER },
    select: { id: true, issueDate: true, total: true },
  });
  if (existing) {
    console.log(
      `  Invoice ${NUMBER} already exists (${existing.issueDate.toISOString().slice(0, 10)}, ` +
        `${money(dec(existing.total))}). Nothing to do.`,
    );
    await prisma.$disconnect();
    return;
  }

  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: ['1100', '2100', '4150'] } },
    select: { id: true, code: true },
  });
  const account = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of ['1100', '2100', '4150']) {
    if (!account.has(code)) {
      throw new Error(`GL account ${code} was not found — nothing has been changed.`);
    }
  }

  const client = await prisma.client.findFirst({
    where: { companyName: { contains: 'Dubai Media', mode: 'insensitive' } },
    select: { id: true, companyName: true, trn: true },
  });
  if (!client) {
    throw new Error(
      'The Dubai Media client record was not found. It should exist from invoice 25111 — ' +
        'nothing has been changed.',
    );
  }

  console.log(`  client      ${client.companyName} (TRN ${client.trn ?? 'not set'})`);
  console.log(`  invoice     ${NUMBER}, dated ${ISSUE_DATE}, place of supply ${PLACE_OF_SUPPLY}`);
  console.log(`  net         ${money(NET)}`);
  console.log(`  VAT 5%      ${money(VAT)}`);
  console.log(`  total       ${money(TOTAL)}  — unpaid, status SENT`);
  console.log(
    `  posting     Dr 1100 ${money(TOTAL)}  /  Cr 4150 ${money(NET)}  +  Cr 2100 ${money(VAT)}`,
  );
  console.log(`\n  VAT period  2026-Q1 — already filed without this supply. Flagged for the adviser.`);

  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (!client.trn) {
      await tx.client.update({
        where: { id: client.id },
        data: { trn: CLIENT_TRN, vatId: CLIENT_TRN },
      });
      console.log(`  set TRN ${CLIENT_TRN} on ${CLIENT_NAME}`);
    }

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: NUMBER,
        clientId: client.id,
        activity: 'BOTH',
        invoiceType: 'TAX_INVOICE',
        status: 'SENT',
        issueDate: day(ISSUE_DATE),
        currency: 'AED',
        subtotal: NET,
        vatAmount: VAT,
        total: TOTAL,
        amountPaid: 0,
        amountDue: TOTAL,
        vatDisplay: 'SEPARATE',
        placeOfSupply: PLACE_OF_SUPPLY,
        subject: 'Production office caravan - Dubai Festival City, 28 Feb - 1 Mar 2026 (2 days)',
        sourceQuotationRef: 'TFMQ22605',
        internalNotes: NOTES,
        createdById: 'user-admin',
        items: {
          create: [
            {
              sortOrder: 0,
              kind: 'SERVICE',
              description: DESCRIPTION,
              quantity: 1,
              unit: 'job',
              days: 2,
              unitPrice: NET,
              discountPct: 0,
              lineTotal: NET,
              taxAmount: VAT,
            },
          ],
        },
      },
      select: { id: true },
    });

    const entryNumber = await nextEntryNumber(tx);
    await tx.journalEntry.create({
      data: {
        entryNumber,
        date: day(ISSUE_DATE),
        memo: `Invoice ${NUMBER}`,
        source: 'SYSTEM',
        sourceType: 'INVOICE',
        sourceId: invoice.id,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: account.get('1100')!,
              debit: TOTAL,
              credit: 0,
              description: 'Accounts Receivable',
            },
            {
              accountId: account.get('4150')!,
              debit: 0,
              credit: NET,
              description: 'Rental & Production (combined)',
            },
            {
              accountId: account.get('2100')!,
              debit: 0,
              credit: VAT,
              description: 'Output VAT (Payable)',
            },
          ],
        },
      },
    });

    console.log(`\n  posted ${NUMBER} — ${entryNumber}`);
  });

  console.log('\n=== AFTER ===\n');

  const lines = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
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

  const dmi = await prisma.invoice.findMany({
    where: { client: { companyName: { contains: 'Dubai Media', mode: 'insensitive' } } },
    select: {
      invoiceNumber: true,
      issueDate: true,
      total: true,
      amountDue: true,
      status: true,
      subject: true,
    },
    orderBy: { issueDate: 'asc' },
  });
  console.log('\n  Dubai Media invoices now on file:');
  for (const i of dmi) {
    console.log(
      `    ${i.invoiceNumber.padEnd(8)}${i.issueDate.toISOString().slice(0, 10)}  ` +
        `total ${money(dec(i.total)).padStart(9)}  due ${money(dec(i.amountDue)).padStart(9)}  ` +
        `${i.status}`,
    );
    console.log(`             ${i.subject ?? ''}`);
  }

  const open = await prisma.invoice.aggregate({
    _sum: { amountDue: true },
    where: { status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT', 'PAID'] } },
  });
  console.log(`\n  accounts receivable open: ${money(dec(open._sum.amountDue))}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
