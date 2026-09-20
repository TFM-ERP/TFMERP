/**
 * post-thirteen01-250120.ts
 *
 * Enters a 2025 sale that was never in the ledger, and claims the bank credit
 * that has been sitting unattributed since the first bank scan.
 *
 *   Thirteen01 Productions L.L.C-FZ, Meydan Grandstand, Nad Al Sheba, Dubai
 *   TRN 104058144700003, contact Leslie
 *   Invoice 250120, dated 26 April 2025, rental period 28 April 2025 (1 day)
 *
 *     Package Unit for 45 PAX            1,750.00
 *     Industrial Fans - Ice, 3 x 400.00  1,200.00
 *     Unit Supervisor                    1,250.00
 *     Unit Assistant, 2 x 1,000.00       2,000.00
 *                                       ----------
 *     Total                              6,200.00
 *     Discount                          (1,200.00)
 *     Net                                5,000.00
 *     VAT 5%                               250.00
 *     GRAND TOTAL                        5,250.00
 *
 * THE RECEIPT. The April 2025 statement carries a credit of exactly 5,250.00 on
 * 26/04/2025, `B/O_/009/004 T_NRAK_474239945_Profess`, bank reference
 * 474239945 — the invoice date itself, and the terms are 100% on approval. That
 * credit has been on the unattributed list from the beginning.
 *
 * NOT THE SAME AS TFMI250118. The ledger already holds a Thirteen01 invoice for
 * 5,250.00 dated 25 April 2025, settled by a different transfer (reference
 * 473981934). Two 5,250.00 invoices to the same customer on consecutive days is
 * exactly the shape that invites a double count, so: 250118 covers 25 April and
 * 250120 covers 28 April, they are separate one-day jobs, and each has its own
 * bank reference. The script refuses to run if a 250120 already exists.
 *
 * The number 250120 is also used by Al Sayegh in the ledger as "250120-AS",
 * which was suffixed for exactly this collision. This invoice takes the bare
 * number as it appears on its own face.
 *
 * Idempotent. Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');

const CLIENT = 'Thirteen01';
const CLIENT_TRN = '104058144700003';
const NUMBER = '250120';
const ISSUE_DATE = '2025-04-26';
const PAID_DATE = '2025-04-26';
const BANK_REF = '474239945';
const NET = 5000;
const VAT = 250;
const TOTAL = NET + VAT;

const NOTES =
  '[VAT2025:UNDECLARED] Entered 20 Sep 2026 during the 2025 bank reconciliation. ' +
  'Thirteen01 Productions L.L.C-FZ, Leslie, Meydan Grandstand 6th floor, Nad Al Sheba, ' +
  'Dubai, TRN 104058144700003. Invoice 250120 dated 26 April 2025, rental period ' +
  '28 April 2025 (1 day): package unit for 45 PAX 1,750.00, industrial fans - ice ' +
  '3 x 400.00 = 1,200.00, unit supervisor 1,250.00, unit assistant 2 x 1,000.00 = ' +
  '2,000.00, total 6,200.00 less 1,200.00 discount = 5,000.00 net, VAT 250.00, grand ' +
  'total 5,250.00. THE LEDGER HAD NO RECORD OF THIS SALE. SETTLED THE SAME DAY: the ' +
  'April 2025 statement shows 5,250.00 credited 26/04/2025, B/O_/009/004 ' +
  'T_NRAK_474239945_Profess, bank reference 474239945 — a credit that had been ' +
  'unattributed since the first bank scan. Terms were 100% on approval, which fits. ' +
  'NOT TO BE CONFUSED WITH TFMI250118, a separate Thirteen01 invoice of the same ' +
  '5,250.00 dated 25 April 2025 and settled by a different transfer, reference ' +
  '473981934. Two one-day jobs on consecutive days, two invoices, two bank ' +
  'references. VAT CONSEQUENCE: this supply was not in the filed 2025-Q2 return, ' +
  'which therefore understates output VAT by 250.00.';

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

async function nextEntry(tx: Prisma.TransactionClient, issued: Set<string>): Promise<string> {
  const prefix = `JE-${new Date().getFullYear()}-`;
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

  const existing = await prisma.invoice.findFirst({
    where: { invoiceNumber: NUMBER },
    select: { invoiceNumber: true, issueDate: true, total: true },
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
    where: { code: { in: ['1100', '2100', '4150', '1010'] } },
    select: { id: true, code: true },
  });
  const account = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of ['1100', '2100', '4150', '1010']) {
    if (!account.has(code)) {
      throw new Error(`GL account ${code} was not found — nothing has been changed.`);
    }
  }

  const client = await prisma.client.findFirst({
    where: { companyName: { contains: 'Thirteen', mode: 'insensitive' } },
    select: { id: true, companyName: true, trn: true },
  });
  if (!client) {
    throw new Error(
      'The Thirteen01 client record was not found — it should exist from TFMI250118. ' +
        'Nothing has been changed.',
    );
  }

  console.log(`  client      ${client.companyName}  (TRN ${client.trn ?? 'not set'})`);
  console.log(`  invoice     ${NUMBER}, dated ${ISSUE_DATE}`);
  console.log(`  net         ${money(NET).padStart(11)}`);
  console.log(`  VAT 5%      ${money(VAT).padStart(11)}`);
  console.log(`  total       ${money(TOTAL).padStart(11)}`);
  console.log(`  settled     ${PAID_DATE}, bank reference ${BANK_REF} — same day`);

  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const issued = new Set<string>();

    if (!client.trn) {
      await tx.client.update({
        where: { id: client.id },
        data: { trn: CLIENT_TRN, vatId: CLIENT_TRN },
      });
      console.log(`  set TRN ${CLIENT_TRN} on ${client.companyName}`);
    }

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: NUMBER,
        clientId: client.id,
        activity: 'RENTAL',
        invoiceType: 'TAX_INVOICE',
        status: 'PAID',
        issueDate: day(ISSUE_DATE),
        currency: 'AED',
        subtotal: NET,
        vatAmount: VAT,
        total: TOTAL,
        amountPaid: TOTAL,
        amountDue: 0,
        vatDisplay: 'SEPARATE',
        placeOfSupply: 'Dubai',
        subject: 'Package unit for 45 PAX, fans and crew — 28 April 2025 (1 day)',
        internalNotes: NOTES,
        createdById: 'user-admin',
        items: {
          create: [
            {
              sortOrder: 0,
              kind: 'SERVICE',
              description:
                'Package unit for 45 PAX 1,750.00, industrial fans - ice 3 x 400.00, ' +
                'unit supervisor 1,250.00, unit assistant 2 x 1,000.00, less 1,200.00 discount',
              quantity: 1,
              unit: 'job',
              days: 1,
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

    await tx.journalEntry.create({
      data: {
        entryNumber: await nextEntry(tx, issued),
        date: day(ISSUE_DATE),
        memo: `Invoice ${NUMBER} — Thirteen01, unit package 28 Apr 2025`,
        source: 'SYSTEM',
        sourceType: 'INVOICE',
        sourceId: invoice.id,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: account.get('1100')!, debit: TOTAL, credit: 0, description: 'Accounts Receivable' },
            { accountId: account.get('4150')!, debit: 0, credit: NET, description: 'Rental & Production (combined)' },
            { accountId: account.get('2100')!, debit: 0, credit: VAT, description: 'Output VAT (Payable)' },
          ],
        },
      },
    });

    const rows = await tx.payment.findMany({
      where: { paymentNumber: { startsWith: 'RCP-2025-' } },
      select: { paymentNumber: true },
      orderBy: { paymentNumber: 'desc' },
      take: 1,
    });
    const paymentNumber = `RCP-2025-${String(
      (rows.length > 0 ? parseInt(rows[0].paymentNumber.slice(-4), 10) : 0) + 1,
    ).padStart(4, '0')}`;

    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        direction: 'RECEIPT',
        invoiceId: invoice.id,
        clientId: client.id,
        amount: TOTAL,
        currency: 'AED',
        paymentDate: day(PAID_DATE),
        method: 'BANK_TRANSFER',
        status: 'CLEARED',
        clearedAt: day(PAID_DATE),
        reference: BANK_REF,
        notes:
          `[BANK] B/O_/009/004 T_NRAK_${BANK_REF}_Profess — credited 26/04/2025, the ` +
          `invoice date itself. Terms were 100% on approval. This credit had been on ` +
          `the unattributed list since the first bank scan; it belongs to invoice ` +
          `${NUMBER}, not to TFMI250118, which was settled by reference 473981934.`,
      },
      select: { id: true },
    });

    await tx.journalEntry.create({
      data: {
        entryNumber: await nextEntry(tx, issued),
        date: day(PAID_DATE),
        memo: `Payment ${paymentNumber} — Thirteen01, invoice ${NUMBER}, bank reference ${BANK_REF}`,
        source: 'SYSTEM',
        sourceType: 'PAYMENT',
        sourceId: payment.id,
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: account.get('1010')!, debit: TOTAL, credit: 0, description: `Bank — ref ${BANK_REF}` },
            { accountId: account.get('1100')!, debit: 0, credit: TOTAL, description: `Accounts Receivable — ${NUMBER}` },
          ],
        },
      },
    });

    console.log(`  posted invoice ${NUMBER} and receipt ${paymentNumber}`);
  });

  /* ----------------------------------------------------------------- verify */

  console.log('\n=== AFTER ===\n');

  const allLines = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  let debits = 0;
  let credits = 0;
  for (const l of allLines) {
    debits += dec(l.debit);
    credits += dec(l.credit);
  }
  console.log(
    `  trial balance: debits ${money(debits)}  credits ${money(credits)}  ` +
      `difference ${money(debits - credits)}`,
  );

  const accountsAll = await prisma.glAccount.findMany({ select: { id: true, code: true, type: true } });
  const byId = new Map(accountsAll.map((a) => [a.id, a]));
  const year = await prisma.journalLine.findMany({
    where: {
      entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } },
    },
    select: { accountId: true, debit: true, credit: true },
  });
  let revenue = 0;
  let expense = 0;
  let outputVat = 0;
  let bankIn = 0;
  for (const l of year) {
    const a = byId.get(l.accountId);
    if (!a) continue;
    const net = dec(l.debit) - dec(l.credit);
    if (a.type === 'INCOME' || a.type === 'REVENUE') revenue += -net;
    if (a.type === 'EXPENSE') expense += net;
    if (a.code === '2100') outputVat += -net;
    if (a.code === '1010') bankIn += dec(l.debit);
  }
  console.log(`\n  2025 revenue             ${money(revenue).padStart(14)}`);
  console.log(`  2025 profit              ${money(revenue - expense).padStart(14)}`);
  console.log(`  2025 output VAT          ${money(outputVat).padStart(14)}`);
  console.log(`\n  bank receipts recorded   ${money(bankIn).padStart(14)}`);
  console.log(
    `  statements say 1,023,016.66 with the opening — unexplained ` +
      `${money(1023016.66 - bankIn)}`,
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
