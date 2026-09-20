/**
 * fix-2024-tax-points.ts
 *
 * Authorised by the General Manager, 20 September 2026: "Move all three back to
 * 2024" and "Post it — clear to Retained Earnings".
 *
 * PART 1 — three invoices re-dated to their true tax point.
 *
 * Under UAE VAT the tax point is the earliest of the date the supply is made,
 * the date payment is received, and the date of the tax invoice. All three of
 * these were supplied and invoiced in November/December 2024, yet the imported
 * workbook parked them at 31 March 2025, putting 2024 revenue into FY2025. The
 * same correction was already made to RK Motion 204442 on 19 Sep 2026.
 *
 *   204443  Alter Films      2,100.00   31/03/2025 -> 26/11/2024
 *   20458   Al Sayegh Media 10,500.00   31/03/2025 -> 11/12/2024
 *   20459   Al Sayegh Media 21,000.00   31/03/2025 -> 10/12/2024
 *
 * The invoice and its journal entry are moved together, so the ledger and the
 * sales list stay in step.
 *
 * PART 2 — two receivables settled in 2024, cleared.
 *
 *   204443  2,100.00  paid 02/12/2024 by ALTERFILMS MEDIA PRODUCTION LLC through
 *                     Emirates NBD, transaction reference 1119021224293437,
 *                     narrative "Hardees Shoot" — payment advice provided by the
 *                     General Manager 20 Sep 2026.
 *   204442  7,770.00  confirmed paid by the General Manager; no payment appears
 *                     in any statement from January 2025 onward, so it was
 *                     settled during 2024.
 *
 * These are posted Dr 3100 Retained Earnings / Cr 1100 Accounts Receivable, NOT
 * to the bank. The money arrived and was spent within 2024, and 2024 cash is not
 * maintained in this ledger: the opening bank balance of 1,242.16 at 1 Jan 2025
 * is a bank fact that already absorbs both. Debiting 1010 in 2024 would add to
 * that opening balance and break it.
 *
 * Idempotent throughout. Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');

interface Redate {
  number: string;
  to: string;
  client: string;
  evidence: string;
}

const REDATES: Redate[] = [
  {
    number: '204443',
    to: '2024-11-26',
    client: 'Alter Films',
    evidence:
      'Invoice face reads "Invoice No.: 204443, Date.: 26 NOV 2024, Rental date: ' +
      '24 NOV 2024" — mobile toilet 4-doors 1,500.00 plus transportation 500.00 = ' +
      '2,000.00, VAT 100.00, grand total 2,100.00.',
  },
  {
    number: '20458',
    to: '2024-12-11',
    client: 'Al Sayegh Media',
    evidence:
      'Invoice face reads "Inv. No.: 20458, Date: DEC 11, 2024", project Arabian ' +
      'Nights - Manarat Al Saadiyat, rental period 14-15 Dec 2024, grand total ' +
      '10,500.00.',
  },
  {
    number: '20459',
    to: '2024-12-10',
    client: 'Al Sayegh Media',
    evidence:
      'Invoice face reads "Inv. No. 20459, DEC 10 2024", total 20,000.00 plus VAT ' +
      '1,000.00 = 21,000.00.',
  },
];

interface Settlement {
  number: string;
  on: string;
  amount: number;
  evidence: string;
}

const SETTLEMENTS: Settlement[] = [
  {
    number: '204443',
    on: '2024-12-02',
    amount: 2100,
    evidence:
      'Emirates NBD businessONLINE payment advice provided 20 Sep 2026: ' +
      'ALTERFILMS MEDIA PRODUCTION LLC, debit account 1015769280701, paid ' +
      'AED 2,100.00 value date 02/12/2024 to IBAN AE820030013328662820001, ' +
      'transaction reference 1119021224293437, narrative "Hardees Shoot", ' +
      'authorised by SAROSH at 13:33 on 02/12/2024.',
  },
  {
    number: '204442',
    on: '2024-12-31',
    amount: 7770,
    evidence:
      'Confirmed paid by the General Manager 20 Sep 2026. No credit of 7,770.00 ' +
      'and no reference to RK Motion appears in any ADCB statement from January ' +
      '2025 to July 2026, so it was settled during 2024. Date taken as 31 Dec 2024 ' +
      'because the exact day is not evidenced.',
  },
];

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

function appendNote(existing: string | null, addition: string): string {
  const base = (existing ?? '').trim();
  return base.length > 0 ? `${base}\n\n${addition}` : addition;
}

async function nextEntryNumber(
  tx: Prisma.TransactionClient,
  issued: Set<string>,
): Promise<string> {
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

  const retained = await prisma.glAccount.findFirst({ where: { code: '3100' } });
  const receivable = await prisma.glAccount.findFirst({ where: { code: '1100' } });
  if (!retained || !receivable) {
    throw new Error('GL 3100 or 1100 was not found — nothing has been changed.');
  }

  /* ----------------------------------------------------------------- plan 1 */

  console.log('--- 1. INVOICES TO RE-DATE ---\n');

  const redatePlan: { id: string; number: string; to: string; note: string; journalIds: string[] }[] = [];

  for (const item of REDATES) {
    const invoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: item.number },
      select: {
        id: true,
        invoiceNumber: true,
        issueDate: true,
        subtotal: true,
        vatAmount: true,
        total: true,
        internalNotes: true,
        client: { select: { companyName: true } },
      },
    });
    if (!invoice) {
      console.log(`  ${item.number.padEnd(10)} NOT FOUND — skipped`);
      continue;
    }

    const current = invoice.issueDate.toISOString().slice(0, 10);
    if (current === item.to) {
      console.log(`  ${item.number.padEnd(10)} already dated ${item.to} — nothing to do`);
      continue;
    }

    const journals = await prisma.journalEntry.findMany({
      where: { sourceType: 'INVOICE', sourceId: invoice.id },
      select: { id: true, entryNumber: true, date: true },
    });

    console.log(
      `  ${item.number.padEnd(10)}${(invoice.client?.companyName ?? '').slice(0, 22).padEnd(24)}` +
        `${current} -> ${item.to}   net ${money(dec(invoice.subtotal)).padStart(10)}  ` +
        `VAT ${money(dec(invoice.vatAmount)).padStart(8)}  ` +
        `journals: ${journals.map((j) => j.entryNumber).join(', ') || 'none'}`,
    );

    redatePlan.push({
      id: invoice.id,
      number: item.number,
      to: item.to,
      journalIds: journals.map((j) => j.id),
      note: appendNote(
        invoice.internalNotes,
        `[20 Sep 2026] Re-dated from ${current} to ${item.to}, its true tax point, on ` +
          `the General Manager's authority. ${item.evidence} Under UAE VAT the tax ` +
          `point is the earliest of supply, payment and invoice date, all of which ` +
          `fall in 2024. VAT CONSEQUENCE: the 2025-Q1 return as filed included this ` +
          `supply and now overstates output VAT by ${money(dec(invoice.vatAmount))}; ` +
          `the 2024 position understates it by the same amount. For the tax adviser.`,
      ),
    });
  }

  /* ----------------------------------------------------------------- plan 2 */

  console.log('\n--- 2. RECEIVABLES SETTLED IN 2024 ---\n');

  const settlePlan: { id: string; number: string; on: string; amount: number; note: string }[] = [];

  for (const item of SETTLEMENTS) {
    const invoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: item.number },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        amountPaid: true,
        amountDue: true,
        status: true,
        internalNotes: true,
        client: { select: { companyName: true } },
      },
    });
    if (!invoice) {
      console.log(`  ${item.number.padEnd(10)} NOT FOUND — skipped`);
      continue;
    }

    const due = dec(invoice.amountDue);
    if (Math.abs(due) < 0.005) {
      console.log(`  ${item.number.padEnd(10)} already settled — nothing to do`);
      continue;
    }
    if (Math.abs(due - item.amount) > 0.005) {
      console.log(
        `  ${item.number.padEnd(10)} REFUSED: ledger shows ${money(due)} outstanding, ` +
          `the register expects ${money(item.amount)}. Left alone.`,
      );
      continue;
    }

    console.log(
      `  ${item.number.padEnd(10)}${(invoice.client?.companyName ?? '').slice(0, 22).padEnd(24)}` +
        `${money(item.amount).padStart(11)}  settled ${item.on}`,
    );

    settlePlan.push({
      id: invoice.id,
      number: item.number,
      on: item.on,
      amount: item.amount,
      note: appendNote(
        invoice.internalNotes,
        `[20 Sep 2026] Settled during 2024 and cleared from receivables on the ` +
          `General Manager's authority. ${item.evidence} Posted Dr 3100 Retained ` +
          `Earnings / Cr 1100 Accounts Receivable, NOT to the bank: the money ` +
          `arrived and was spent within 2024, and the opening bank balance of ` +
          `1,242.16 at 1 Jan 2025 already absorbs it.`,
      ),
    });
  }

  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  if (redatePlan.length === 0 && settlePlan.length === 0) {
    console.log('\n=== NOTHING TO DO ===');
    await prisma.$disconnect();
    return;
  }

  /* ------------------------------------------------------------------ apply */

  await prisma.$transaction(async (tx) => {
    const issued = new Set<string>();

    for (const item of redatePlan) {
      await tx.invoice.update({
        where: { id: item.id },
        data: { issueDate: day(item.to), internalNotes: item.note },
      });
      for (const journalId of item.journalIds) {
        await tx.journalEntry.update({
          where: { id: journalId },
          data: { date: day(item.to) },
        });
      }
      console.log(`  re-dated ${item.number} to ${item.to}`);
    }

    for (const item of settlePlan) {
      const entryNumber = await nextEntryNumber(tx, issued);
      await tx.journalEntry.create({
        data: {
          entryNumber,
          date: day(item.on),
          memo:
            `Invoice ${item.number} settled during 2024 — cleared from receivables ` +
            `to Retained Earnings. The receipt reached the bank in 2024 and the ` +
            `1 Jan 2025 opening balance already reflects it.`,
          source: 'SYSTEM',
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              {
                accountId: retained.id,
                debit: item.amount,
                credit: 0,
                description: `Retained Earnings — ${item.number} settled in 2024`,
              },
              {
                accountId: receivable.id,
                debit: 0,
                credit: item.amount,
                description: `Accounts Receivable — ${item.number}`,
              },
            ],
          },
        },
      });
      await tx.invoice.update({
        where: { id: item.id },
        data: {
          amountPaid: item.amount,
          amountDue: 0,
          status: 'PAID',
          internalNotes: item.note,
        },
      });
      console.log(`  cleared ${item.number} — ${entryNumber}`);
    }
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

  const accounts = await prisma.glAccount.findMany({
    select: { id: true, code: true, type: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));

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
    for (const l of lines) {
      const a = byId.get(l.accountId);
      if (!a) continue;
      const net = dec(l.debit) - dec(l.credit);
      if (a.type === 'INCOME' || a.type === 'REVENUE') revenue += -net;
      if (a.type === 'EXPENSE') expense += net;
      if (a.code === '2100') outputVat += -net;
    }
    console.log(
      `\n  ${label}: revenue ${money(revenue).padStart(14)}  ` +
        `expenses ${money(expense).padStart(13)}  profit ${money(revenue - expense).padStart(13)}`,
    );
    console.log(`        output VAT ${money(outputVat).padStart(13)}`);
  }

  const open = await prisma.invoice.aggregate({
    _sum: { amountDue: true },
    where: { status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT', 'PAID'] } },
  });
  console.log(`\n  accounts receivable open: ${money(dec(open._sum.amountDue))}`);

  const stillOpen = await prisma.invoice.findMany({
    where: { status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT', 'PAID'] } },
    select: {
      invoiceNumber: true,
      issueDate: true,
      amountDue: true,
      client: { select: { companyName: true } },
    },
    orderBy: { issueDate: 'asc' },
  });
  for (const i of stillOpen) {
    console.log(
      `    ${i.invoiceNumber.padEnd(12)}${i.issueDate.toISOString().slice(0, 10)}  ` +
        `${(i.client?.companyName ?? '').slice(0, 30).padEnd(32)}${money(dec(i.amountDue)).padStart(11)}`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
