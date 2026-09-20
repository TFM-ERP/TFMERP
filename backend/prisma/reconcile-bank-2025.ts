/**
 * reconcile-bank-2025.ts — READ ONLY.
 *
 * Builds the bridge between what the ADCB statements say left the account in
 * 2025 and what the ledger records, and accounts for every dirham of the
 * difference by name. A gap you cannot itemise is not a reconciliation.
 *
 * Reads the two working files produced earlier:
 *   /tmp/adcb-2025.csv             every statement line, direction proved
 *                                  against the running balance
 *   /tmp/adcb-2025-classified.csv  the card/cash lines with their status
 *
 *   npx ts-node --transpile-only prisma/reconcile-bank-2025.ts
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

const TRANSACTIONS = process.argv[2] ?? '/tmp/adcb-2025.csv';
const CLASSIFIED = process.argv[3] ?? '/tmp/adcb-2025-classified.csv';

/** Transfers already matched to a supplier invoice by match-outgoing-transfers. */
const MATCHED_TO_SUPPLIER: { date: string; amount: number; who: string }[] = [
  { date: '12/11/2025', amount: 114450, who: 'V Media Productions' },
  { date: '19/11/2025', amount: 11025, who: 'MAP Media Art Production' },
  { date: '22/12/2025', amount: 2100, who: 'Macquip' },
];

/** The owner salary transfers, already carried by JE-2026-0438. */
const OWNER_SALARY_TRANSFER = 35000;
const OWNER_SALARY_COUNT = 6;

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

function readCsv(path: string): Record<string, string>[] {
  const lines = readFileSync(path, 'utf8')
    .replace(/^﻿/, '')
    .trim()
    .split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((name, i) => {
      row[name] = cells[i] ?? '';
    });
    return row;
  });
}

const isTransfer = (narrative: string): boolean =>
  /O\/W TRF|TRF TO|OUTWARD/i.test(narrative);

function line(label: string, value: number, indent = 2): void {
  console.log(`${' '.repeat(indent)}${label.padEnd(58)}${money(value).padStart(14)}`);
}

async function main(): Promise<void> {
  const all = readCsv(TRANSACTIONS);
  const debits = all.filter((r) => r.direction === 'DEBIT');
  const credits = all.filter((r) => r.direction === 'CREDIT');

  const bankOut = debits.reduce((sum, r) => sum + Number(r.amount), 0);
  const bankIn = credits.reduce((sum, r) => sum + Number(r.amount), 0);

  /* ------------------------------------------------- what the ledger holds */

  const bank = await prisma.glAccount.findFirst({ where: { code: '1010' } });
  if (!bank) throw new Error('GL 1010 was not found');

  const ledgerLines = await prisma.journalLine.findMany({
    where: {
      accountId: bank.id,
      entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } },
    },
    select: { debit: true, credit: true },
  });
  let ledgerIn = 0;
  let ledgerOut = 0;
  for (const l of ledgerLines) {
    ledgerIn += dec(l.debit);
    ledgerOut += dec(l.credit);
  }

  console.log('=== 2025 BANK: STATEMENT AGAINST LEDGER ===\n');
  line('money out, per the ADCB statements', bankOut);
  line('money out, per the ledger', ledgerOut);
  line('DIFFERENCE', bankOut - ledgerOut);

  /* ------------------------------------------------------ the transfer side */

  const transfers = debits.filter((r) => isTransfer(r.narrative));
  const transferTotal = transfers.reduce((sum, r) => sum + Number(r.amount), 0);

  const ownerSalary = transfers.filter(
    (r) => Math.abs(Number(r.amount) - OWNER_SALARY_TRANSFER) < 0.01,
  );
  const ownerSalaryTotal = ownerSalary.reduce((sum, r) => sum + Number(r.amount), 0);

  const matchedTotal = MATCHED_TO_SUPPLIER.reduce((sum, m) => sum + m.amount, 0);
  const matchedKeys = new Set(
    MATCHED_TO_SUPPLIER.map((m) => `${m.date}|${m.amount.toFixed(2)}`),
  );

  const namedNoInvoice = transfers.filter(
    (r) =>
      /TRF TO/i.test(r.narrative) &&
      !matchedKeys.has(`${r.date}|${Number(r.amount).toFixed(2)}`),
  );
  const namedNoInvoiceTotal = namedNoInvoice.reduce((sum, r) => sum + Number(r.amount), 0);

  const unidentifiedTotal =
    transferTotal - ownerSalaryTotal - matchedTotal - namedNoInvoiceTotal;

  /* ------------------------------------------------------ the card/cash side */

  const classified = readCsv(CLASSIFIED);
  const bucket = (status: string): number =>
    classified
      .filter((r) => r.status === status)
      .reduce((sum, r) => sum + Number(r.amount), 0);

  const posted = bucket('posted');
  const review = bucket('review');
  const cash = bucket('cash');
  const unknown = bucket('unknown');

  const bounced = classified
    .filter((r) => /PDC I\/W CLEARING/i.test(r.narrative))
    .reduce((sum, r) => sum + Number(r.amount), 0);
  const salaryExcluded = bucket('excluded') - bounced;

  /* ------------------------------------------------------- the owner funding */

  const ownerFundsIn = 10700;

  /* ------------------------------------------------------------ the bridge */

  console.log('\n=== WHAT THE DIFFERENCE IS MADE OF ===\n');

  console.log('  STILL TO POST — real money out, no entry yet\n');
  line('transfers matched to a supplier invoice, not yet posted', matchedTotal, 4);
  for (const m of MATCHED_TO_SUPPLIER) {
    console.log(`        ${m.date}  ${m.who.padEnd(34)}${money(m.amount).padStart(14)}`);
  }
  line('transfers with a payee named but no invoice on file', namedNoInvoiceTotal, 4);
  for (const r of namedNoInvoice.sort((a, b) => Number(b.amount) - Number(a.amount))) {
    const who = /TRF TO ([A-Z0-9 .&'-]+)/i.exec(r.narrative)?.[1]?.trim() ?? '';
    console.log(`        ${r.date}  ${who.slice(0, 34).padEnd(34)}${money(Number(r.amount)).padStart(14)}`);
  }
  line('transfers with no payee at all (38 of them)', unidentifiedTotal, 4);
  line('card items held for a decision', review, 4);
  line('cash withdrawn from ATMs', cash, 4);
  line('one line not recognised', unknown, 4);

  const toPost =
    matchedTotal + namedNoInvoiceTotal + unidentifiedTotal + review + cash + unknown;
  console.log(`  ${'-'.repeat(72)}`);
  line('SUB-TOTAL, GENUINELY UNPOSTED', toPost, 4);

  console.log('\n  NOT MISSING — presentation only, no effect on profit\n');
  line('twofour54 cheques that bounced, reversed the same day', bounced, 4);
  console.log('        The debit and the matching credit both belong in the bank');
  console.log('        ledger. They net to nothing, so the profit is right either way.');
  line('owner funds paid IN, netted against the outgoing side', ownerFundsIn, 4);
  console.log('        JE-2026-0438 shows 214,300.00 net. The bank shows 225,000.00');
  console.log('        out and 10,700.00 in. Same net, wrong presentation.');

  console.log(`  ${'-'.repeat(72)}`);
  line('SUB-TOTAL, PRESENTATION', bounced + ownerFundsIn, 4);

  console.log(`\n  ${'='.repeat(72)}`);
  line('TOTAL DIFFERENCE ACCOUNTED FOR', toPost + bounced + ownerFundsIn, 2);
  line('difference to explain', bankOut - ledgerOut, 2);
  const residual = bankOut - ledgerOut - (toPost + bounced + ownerFundsIn);
  line('UNEXPLAINED RESIDUAL', residual, 2);
  if (Math.abs(residual) < 0.05) {
    console.log('\n  Every dirham of the difference is named. Nothing is unaccounted for.');
  } else {
    console.log('\n  WARNING: the bridge does not close. Do not rely on it.');
  }

  /* ------------------------------------------------------- already recorded */

  console.log('\n=== FOR COMPLETENESS: WHAT IS ALREADY RECORDED ===\n');
  line('card, cash-charge and bank-charge lines posted 20 Sep', posted);
  line(`owner salary, ${OWNER_SALARY_COUNT} transfers of ${money(OWNER_SALARY_TRANSFER)}`, ownerSalaryTotal);
  line('December employee salary', salaryExcluded);
  line('less owner funds paid in, netted by JE-2026-0438', -ownerFundsIn);
  console.log(`  ${'-'.repeat(72)}`);
  line('ledger outgoing', posted + ownerSalaryTotal + salaryExcluded - ownerFundsIn);

  console.log('\n=== THE INCOMING SIDE, FOR CONTEXT ===\n');
  line('money in, per the statements', bankIn);
  line('money in, per the ledger (includes the 1,242.16 opening)', ledgerIn);
  line('difference', bankIn - ledgerIn + 1242.16);
  console.log('\n  That difference is mostly not revenue: the three bounced');
  console.log('  twofour54 cheques reversing (40,909.00), the two unattributed');
  console.log('  cheques of 10,000.00, the 21,525.00 Al Sayegh cheque and owner');
  console.log('  funding. It is dealt with separately from the outgoing side.');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
