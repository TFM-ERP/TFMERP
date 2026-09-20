/**
 * post-action-filmz-204460.ts
 *
 * Enters a sale that was never in the ledger, and closes the two cheques that
 * have been unexplained since the bank scan began.
 *
 *   Action Filmz Productions LLC, Al Quoz Industrial Area 1, Dubai
 *   TRN 100264374800003, contact AbdulQadir
 *   Invoice 204460, dated 28 DEC 2024, project "Movie", rental period 25 days
 *
 *   Star Caravan 29-34 foot with transportation, driver with pickup
 *   and 9Kw generator, 1,500.00 x 26 days        39,000.00
 *   Fuel, lot, 26 days                            1,660.00
 *                                                -----------
 *   Total                                        40,660.00
 *   Adjustments                                  (1,589.00)
 *   Discount                                     (1,500.00)
 *   Subtotal                                     37,571.00
 *   VAT 5%                                        1,879.00
 *   GRAND TOTAL                                  39,450.00
 *
 * THE TAX POINT IS 28 DECEMBER 2024 — Q4 2024, not 2025. The supply ran through
 * December 2024, the invoice is dated 28 Dec 2024, and 18,750.00 had already
 * been paid by then. Under UAE VAT the tax point is the earliest of those, so
 * the revenue and the 1,879.00 of output VAT belong to 2024. This is the same
 * correction already applied to Alter Films 204443 and Al Sayegh 20458/20459.
 *
 * HOW IT WAS SETTLED
 *
 *   18,750.00  paid during 2024. It appears in no statement because the ADCB
 *              statements begin on 1 January 2025 — there is nothing to find.
 *              Cleared Dr 3100 Retained Earnings / Cr 1100, as for RK Motion
 *              204442 and Alter Films 204443: the cash moved within 2024 and
 *              the 1,242.16 opening bank balance already absorbs it.
 *
 *   10,000.00  cheque 008539, drawn 02/01/2025 on Action Filmz's Emirates NBD
 *              account 1014839461101 (Oud Metha), deposited at the ADCB Al
 *              Khail Mall ATM on 03/01/2025 11:56:42 (TSN 1854), credited
 *              04/01/2025.
 *
 *   10,000.00  cheque 008682, drawn 06/02/2025 on the same account, credited
 *              14/02/2025.
 *
 * Those two are 2025 bank receipts against a 2024 receivable, so they post to
 * the bank properly as Payments.
 *
 *      700.00  STILL OWED. Confirmed by the General Manager 20 Sep 2026:
 *              "the 20,700 is correct i still need 700 aed from them".
 *
 * The ADCB narrative named ISRAR HASAN / AJAZ HASAN and ISMAIL UMARTHEEN ISMAIL
 * on the two cheques. Those are the signatories on Action Filmz's account, not
 * the payer, which is why one clearing reference (502620148) carried two
 * different names and could not be placed from the statement alone.
 *
 * Idempotent. Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');

const CLIENT = 'Action Filmz Productions LLC';
const CLIENT_TRN = '100264374800003';
const NUMBER = '204460';
const ISSUE_DATE = '2024-12-28';
const NET = 37571;
const VAT = 1879;
const TOTAL = NET + VAT;

const PAID_2024 = 18750;

interface Cheque {
  date: string;
  amount: number;
  number: string;
  note: string;
}

const CHEQUES: Cheque[] = [
  {
    date: '2025-01-04',
    amount: 10000,
    number: '008539',
    note:
      'Cheque 008539 drawn 02/01/2025 on ACTION FILMZ PRODUCTIONS LLC, Emirates NBD ' +
      'Oud Metha, account 1014839461101, IBAN AE35 0260 0010 1483 9461 101. Deposited ' +
      'at the ADCB Al Khail Mall ATM 03/01/2025 11:56:42, TSN 1854, credited 04/01/2025. ' +
      'The statement narrative reads ISRAR HASANAJAZ HASAN — those are the account ' +
      'signatories, not the payer.',
  },
  {
    date: '2025-02-14',
    amount: 10000,
    number: '008682',
    note:
      'Cheque 008682 drawn 06/02/2025 on the same ACTION FILMZ PRODUCTIONS LLC account, ' +
      'credited 14/02/2025. The statement narrative reads ISMAILUMARTHEEN ISMAIL — again ' +
      'a signatory, not the payer. Same clearing reference 502620148 as cheque 008539, ' +
      'which is what ties the two together.',
  },
];

const NOTES =
  '[VAT2024:UNDECLARED] Entered 20 Sep 2026 during the 2025 bank reconciliation, from ' +
  'the invoice supplied by the General Manager. Action Filmz Productions LLC, AbdulQadir, ' +
  'Al Fahad Warehouse, Al Quoz Industrial Area 1, Dubai, TRN 100264374800003. Invoice ' +
  '204460 dated 28 DEC 2024, project "Movie", rental period 25 days. Star Caravan 29-34 ' +
  'foot with transportation, driver with pickup and 9Kw generator at 1,500.00 x 26 = ' +
  '39,000.00, plus fuel 1,660.00 = 40,660.00, less adjustments 1,589.00 and discount ' +
  '1,500.00 = 37,571.00 net, VAT 1,879.00, grand total 39,450.00. THE LEDGER HAD NO ' +
  'RECORD OF THIS SALE AND NO CLIENT RECORD FOR ACTION FILMZ. TAX POINT 28 Dec 2024 ' +
  '(Q4 2024): the supply ran through December 2024 and 18,750.00 was already paid, so ' +
  'the revenue and output VAT belong to 2024 — the 2024-Q4 return understates output VAT ' +
  'by 1,879.00. SETTLEMENT: 18,750.00 in 2024 (invisible to the bank scan because the ' +
  'ADCB statements start 1 Jan 2025), then 10,000.00 by cheque 008539 on 04/01/2025 and ' +
  '10,000.00 by cheque 008682 on 14/02/2025. 700.00 remains owed and is confirmed still ' +
  'collectable. NOTE FOR THE ADVISER: the document is headed "INVOICE", not "TAX ' +
  'INVOICE", and carries quotation validity wording — a compliant tax invoice may need ' +
  'to be issued to the customer.';

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

async function nextReceipt(tx: Prisma.TransactionClient, issued: Set<string>): Promise<string> {
  const rows = await tx.payment.findMany({
    where: { paymentNumber: { startsWith: 'RCP-2025-' } },
    select: { paymentNumber: true },
    orderBy: { paymentNumber: 'desc' },
    take: 1,
  });
  let n = rows.length > 0 ? parseInt(rows[0].paymentNumber.slice(-4), 10) : 0;
  let candidate = '';
  do {
    n += 1;
    candidate = `RCP-2025-${String(n).padStart(4, '0')}`;
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
    where: { code: { in: ['1100', '2100', '4150', '1010', '3100'] } },
    select: { id: true, code: true },
  });
  const account = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of ['1100', '2100', '4150', '1010', '3100']) {
    if (!account.has(code)) {
      throw new Error(`GL account ${code} was not found — nothing has been changed.`);
    }
  }

  const chequeTotal = CHEQUES.reduce((t, c) => t + c.amount, 0);
  const settled = PAID_2024 + chequeTotal;
  const outstanding = TOTAL - settled;

  console.log(`  client      ${CLIENT}  (TRN ${CLIENT_TRN})`);
  console.log(`  invoice     ${NUMBER}, dated ${ISSUE_DATE} — TAX POINT Q4 2024`);
  console.log(`  net         ${money(NET).padStart(12)}`);
  console.log(`  VAT 5%      ${money(VAT).padStart(12)}`);
  console.log(`  total       ${money(TOTAL).padStart(12)}`);
  console.log(`\n  settled in 2024, to Retained Earnings   ${money(PAID_2024).padStart(12)}`);
  for (const c of CHEQUES) {
    console.log(`  cheque ${c.number} to the bank ${c.date}       ${money(c.amount).padStart(12)}`);
  }
  console.log(`  ------------------------------------------------------`);
  console.log(`  settled                                 ${money(settled).padStart(12)}`);
  console.log(`  STILL OWED                              ${money(outstanding).padStart(12)}`);

  if (Math.abs(outstanding - 700) > 0.005) {
    throw new Error(
      `the arithmetic does not land on the 700.00 the General Manager confirmed — ` +
        `it gives ${money(outstanding)}. Nothing has been changed.`,
    );
  }

  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const issued = new Set<string>();
    const receipts = new Set<string>();

    let client = await tx.client.findFirst({
      where: { companyName: { equals: CLIENT, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!client) {
      client = await tx.client.create({
        data: {
          companyName: CLIENT,
          trn: CLIENT_TRN,
          vatId: CLIENT_TRN,
          country: 'UAE',
          currency: 'AED',
          notes:
            'Created 20 Sep 2026 from invoice 204460 during the 2025 bank reconciliation. ' +
            'Contact AbdulQadir, abdul@actionfilmz.com. Al Fahad Warehouse 6C/8C/3C/31A, ' +
            '6A Street, Al Quoz Industrial Area 1, Dubai.',
        },
        select: { id: true },
      });
      console.log(`  created client ${CLIENT}`);
    }

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: NUMBER,
        clientId: client.id,
        activity: 'RENTAL',
        invoiceType: 'TAX_INVOICE',
        status: 'PARTIALLY_PAID',
        issueDate: day(ISSUE_DATE),
        currency: 'AED',
        subtotal: NET,
        vatAmount: VAT,
        total: TOTAL,
        amountPaid: settled,
        amountDue: outstanding,
        vatDisplay: 'SEPARATE',
        placeOfSupply: 'Dubai',
        subject: 'Star Caravan 29-34 foot with driver, pickup and 9Kw generator — 26 days, project "Movie"',
        internalNotes: NOTES,
        createdById: 'user-admin',
        items: {
          create: [
            {
              sortOrder: 0,
              kind: 'SERVICE',
              description:
                'Star Caravan 29-34 foot, including transportation, driver with pickup and ' +
                '9Kw generator — 1,500.00 x 26 days, plus fuel 1,660.00, less adjustments ' +
                '1,589.00 and discount 1,500.00',
              quantity: 1,
              unit: 'job',
              days: 26,
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
        memo: `Invoice ${NUMBER} — ${CLIENT}, caravan hire, tax point 28 Dec 2024`,
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

    await tx.journalEntry.create({
      data: {
        entryNumber: await nextEntry(tx, issued),
        date: day('2024-12-31'),
        memo:
          `Invoice ${NUMBER} — 18,750.00 settled during 2024, cleared to Retained ` +
          `Earnings. The ADCB statements begin 1 Jan 2025, so this receipt predates ` +
          `everything readable; the 1,242.16 opening balance already reflects it.`,
        source: 'SYSTEM',
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: account.get('3100')!, debit: PAID_2024, credit: 0, description: `Retained Earnings — ${NUMBER} settled in 2024` },
            { accountId: account.get('1100')!, debit: 0, credit: PAID_2024, description: `Accounts Receivable — ${NUMBER}` },
          ],
        },
      },
    });

    for (const cheque of CHEQUES) {
      const paymentNumber = await nextReceipt(tx, receipts);
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          direction: 'RECEIPT',
          invoiceId: invoice.id,
          clientId: client.id,
          amount: cheque.amount,
          currency: 'AED',
          paymentDate: day(cheque.date),
          method: 'CHEQUE',
          status: 'CLEARED',
          clearedAt: day(cheque.date),
          reference: cheque.number,
          notes: `[BANK] ${cheque.note}`,
        },
        select: { id: true },
      });

      await tx.journalEntry.create({
        data: {
          entryNumber: await nextEntry(tx, issued),
          date: day(cheque.date),
          memo: `Payment ${paymentNumber} — cheque ${cheque.number}, ${CLIENT}, against invoice ${NUMBER}`,
          source: 'SYSTEM',
          sourceType: 'PAYMENT',
          sourceId: payment.id,
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              { accountId: account.get('1010')!, debit: cheque.amount, credit: 0, description: `Bank — cheque ${cheque.number}` },
              { accountId: account.get('1100')!, debit: 0, credit: cheque.amount, description: `Accounts Receivable — ${NUMBER}` },
            ],
          },
        },
      });
      console.log(`  posted receipt ${paymentNumber} — cheque ${cheque.number}, ${money(cheque.amount)}`);
    }

    console.log(`  posted invoice ${NUMBER}`);
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
  for (const [label, from, to] of [
    ['2024', '2024-01-01', '2024-12-31T23:59:59Z'],
    ['2025', '2025-01-01', '2025-12-31T23:59:59Z'],
  ] as const) {
    const lines = await prisma.journalLine.findMany({
      where: { entry: { date: { gte: new Date(from), lte: new Date(to) } } },
      select: { accountId: true, debit: true, credit: true },
    });
    let revenue = 0;
    let expense = 0;
    let outputVat = 0;
    let bankIn = 0;
    for (const l of lines) {
      const a = byId.get(l.accountId);
      if (!a) continue;
      const net = dec(l.debit) - dec(l.credit);
      if (a.type === 'INCOME' || a.type === 'REVENUE') revenue += -net;
      if (a.type === 'EXPENSE') expense += net;
      if (a.code === '2100') outputVat += -net;
      if (a.code === '1010') bankIn += dec(l.debit);
    }
    console.log(
      `\n  ${label}: revenue ${money(revenue).padStart(14)}  profit ${money(revenue - expense).padStart(13)}` +
        `  output VAT ${money(outputVat).padStart(11)}`,
    );
    if (label === '2025') {
      console.log(`        bank in ${money(bankIn).padStart(14)}  (statements say 1,021,774.50 + 1,242.16 opening)`);
    }
  }

  const open = await prisma.invoice.findMany({
    where: { status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT', 'PAID'] } },
    select: {
      invoiceNumber: true,
      issueDate: true,
      amountDue: true,
      client: { select: { companyName: true } },
    },
    orderBy: { issueDate: 'asc' },
  });
  let receivable = 0;
  console.log('\n  still receivable:');
  for (const i of open) {
    receivable += dec(i.amountDue);
    console.log(
      `    ${i.invoiceNumber.padEnd(12)}${i.issueDate.toISOString().slice(0, 10)}  ` +
        `${(i.client?.companyName ?? '').slice(0, 30).padEnd(32)}${money(dec(i.amountDue)).padStart(11)}`,
    );
  }
  console.log(`    ${''.padEnd(56)}${money(receivable).padStart(11)}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
