/**
 * post-cash-and-senci.ts
 *
 * Two things, and the second is why the first is now possible.
 *
 * PART 1 — the ATM withdrawals become a cash tin, not a mystery.
 *
 * 25 ATM withdrawals totalling 73,700.00 have been sitting unposted because
 * nobody could say whether each one was a business cost or a drawing. That
 * question was the wrong one to ask at the withdrawal. Taking money out of the
 * bank is not spending it — it moves the money from one place the company holds
 * it to another:
 *
 *     Dr  1000 Cash on Hand
 *     Cr  1010 Bank
 *
 * The business-or-drawings question then belongs to what the cash was SPENT on,
 * which is answerable one receipt at a time. This clears 73,700.00 of the bank
 * reconciliation immediately and without assuming anything, and it makes the
 * unexplained cash visible as a balance rather than invisible as a gap.
 *
 * PART 2 — the first two cash receipts, which prove the model.
 *
 *   27/02/2025   320.00    Senci General Trading, after-sales service repair
 *                          form 2250: wheels x4, battery 14AH x2, fuel cap x2
 *                          for generator SM9500DT. Delivered cash-on-delivery
 *                          through Apex Express, waybill 1122744, "NCND-320".
 *
 *   30/07/2025 1,460.00    Senci General Trading, service SB25070034 on the
 *                          SM9500Di at 800 running hours: spark plugs x4, air
 *                          filters x4, oil change x4, inverter board x2
 *                          (replaced for two gensets), service charges x4.
 *                          Terms CASH.
 *
 * NEITHER APPEARS ANYWHERE IN THE BANK — checked across every statement from
 * January 2025 to July 2026. Both were paid in cash, which is exactly what the
 * ATM withdrawals were for. They post:
 *
 *     Dr  5200 Maintenance & Repairs
 *     Cr  1000 Cash on Hand
 *
 * VAT. Booked GROSS. The 1,460.00 is marked "Vat inc" on its face, so 69.52 of
 * it is VAT — but the document is a service QUOTATION, not a tax invoice, and
 * the 320.00 repair form shows no VAT at all. Input VAT needs a valid tax
 * invoice, so nothing is claimed. Asking Senci for tax invoices would release
 * about 84.00.
 *
 * NOT POSTED, DELIBERATELY: Senci invoices INV#8322 (30/03/2024, one SM9500Di
 * generator, 4,952.38 + 247.62 = 5,200.00) and INV#8548 (11/05/2024, two more,
 * 9,333.33 + 466.67 = 9,800.00). Those are 2024 equipment purchases — 15,000.00
 * of generators — and the opening entry JE-2026-0435 already brings in
 * 305,000.00 of fleet and equipment at net book value, which on the face of it
 * includes them. Posting them again would count the same generators twice. They
 * need checking against whatever supported that 305,000.00.
 *
 * Idempotent. Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');
const CSV = process.argv.find((a) => a.endsWith('.csv')) ?? '/tmp/adcb-2025-classified.csv';

const CASH_TAG = '[CASHDRAW2025]';
const SPEND_TAG = '[CASHSPEND2025]';

interface CashSpend {
  date: string;
  amount: number;
  account: string;
  description: string;
  memo: string;
}

const CASH_SPENDS: CashSpend[] = [
  {
    date: '2025-02-27',
    amount: 320,
    account: '5200',
    description: 'Generator parts — wheels x4, battery 14AH x2, fuel cap x2',
    memo:
      `${SPEND_TAG} Senci General Trading L.L.C., after-sales service repair form ` +
      'No. 2250, received 27/02/2025, generator SM9500DT. Parts: wheel ' +
      '[20134-00127-02] x4, battery 14AH x2, fuel cap x2. Material cost 320.00, ' +
      'service charge nil, total 320.00. Delivered cash-on-delivery through Apex ' +
      'Express Courier, waybill 1122744, marked "NCND-320", collected 27/02/2025. ' +
      'PAID IN CASH — no debit of 320.00 appears in any ADCB statement from ' +
      'January 2025 to July 2026. Booked gross: the repair form shows no VAT and ' +
      'is not a tax invoice, so no input VAT is claimed.',
  },
  {
    date: '2025-07-30',
    amount: 1460,
    account: '5200',
    description: 'Generator service at 800 hours — SM9500Di, two gensets',
    memo:
      `${SPEND_TAG} Senci General Trading L.L.C., service SB25070034 dated ` +
      '30/07/2025, model SM9500Di at 800 running hours. Spark plug x4 at 15.00, ' +
      'air filter x4 at 15.00, oil changing x4 at 35.00, inverter board x2 at ' +
      '400.00 (replaced for two gensets), service charges x4 at 100.00. Total ' +
      '1,460.00, terms CASH. PAID IN CASH — no debit of 1,460.00 appears in any ' +
      'ADCB statement from January 2025 to July 2026. Booked gross: the document ' +
      'is a service QUOTATION marked "Vat inc", not a tax invoice, so the 69.52 ' +
      'of VAT inside it is not claimed. A tax invoice from Senci would release it.',
  },
];

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

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

function readWithdrawals(path: string): { iso: string; amount: number; narrative: string }[] {
  const lines = readFileSync(path, 'utf8')
    .replace(/^﻿/, '')
    .trim()
    .split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  const at = (name: string): number => header.indexOf(name);
  const iDate = at('date');
  const iAmount = at('amount');
  const iStatus = at('status');
  const iNarr = at('narrative');

  const out: { iso: string; amount: number; narrative: string }[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    if (cells[iStatus] !== 'cash') continue;
    const [d, m, y] = cells[iDate].split('/');
    out.push({
      iso: `${y}-${m}-${d}`,
      amount: Number(cells[iAmount]),
      narrative: cells[iNarr],
    });
  }
  return out.sort((a, b) => a.iso.localeCompare(b.iso));
}

async function nextNumber(
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

  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: ['1000', '1010', '5200'] } },
    select: { id: true, code: true, name: true },
  });
  const account = new Map(accounts.map((a) => [a.code, a.id]));
  for (const code of ['1000', '1010', '5200']) {
    if (!account.has(code)) {
      throw new Error(`GL account ${code} was not found — nothing has been changed.`);
    }
  }

  const drawsDone = await prisma.journalEntry.count({ where: { memo: { startsWith: CASH_TAG } } });
  const spendsDone = await prisma.journalEntry.count({ where: { memo: { startsWith: SPEND_TAG } } });

  const withdrawals = drawsDone > 0 ? [] : readWithdrawals(CSV);
  const spends = spendsDone > 0 ? [] : CASH_SPENDS;

  console.log('--- 1. ATM WITHDRAWALS -> CASH ON HAND ---\n');
  if (drawsDone > 0) {
    console.log(`  already posted (${drawsDone} entries tagged ${CASH_TAG}) — skipped`);
  } else {
    let total = 0;
    for (const w of withdrawals) {
      total += w.amount;
      console.log(`  ${w.iso}  ${money(w.amount).padStart(11)}  ${w.narrative.slice(0, 66)}`);
    }
    console.log(`\n  ${withdrawals.length} withdrawals, ${money(total)} — Dr 1000 / Cr 1010`);
  }

  console.log('\n--- 2. COSTS PAID IN CASH ---\n');
  if (spendsDone > 0) {
    console.log(`  already posted (${spendsDone} entries tagged ${SPEND_TAG}) — skipped`);
  } else {
    for (const s of spends) {
      console.log(`  ${s.date}  ${money(s.amount).padStart(11)}  Dr ${s.account}  ${s.description}`);
    }
    console.log(
      `\n  ${spends.length} costs, ${money(spends.reduce((t, s) => t + s.amount, 0))} — Cr 1000 Cash on Hand`,
    );
  }

  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  if (withdrawals.length === 0 && spends.length === 0) {
    console.log('\n=== NOTHING TO DO ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      const issued = new Set<string>();

      for (const w of withdrawals) {
        await tx.journalEntry.create({
          data: {
            entryNumber: await nextNumber(tx, issued),
            date: day(w.iso),
            memo:
              `${CASH_TAG} Cash withdrawn from the bank — ${w.narrative}. Moved to ` +
              `1000 Cash on Hand, not treated as spending: what the cash was used ` +
              `for is recorded separately as the receipts come in.`.slice(0, 480),
            source: 'SYSTEM',
            status: 'POSTED',
            postedAt: new Date(),
            lines: {
              create: [
                {
                  accountId: account.get('1000')!,
                  debit: w.amount,
                  credit: 0,
                  description: 'Cash on Hand — ATM withdrawal',
                },
                {
                  accountId: account.get('1010')!,
                  debit: 0,
                  credit: w.amount,
                  description: 'Bank — ATM withdrawal',
                },
              ],
            },
          },
        });
      }

      for (const s of spends) {
        await tx.journalEntry.create({
          data: {
            entryNumber: await nextNumber(tx, issued),
            date: day(s.date),
            memo: s.memo.slice(0, 480),
            source: 'SYSTEM',
            status: 'POSTED',
            postedAt: new Date(),
            lines: {
              create: [
                {
                  accountId: account.get(s.account)!,
                  debit: s.amount,
                  credit: 0,
                  description: s.description,
                },
                {
                  accountId: account.get('1000')!,
                  debit: 0,
                  credit: s.amount,
                  description: 'Cash on Hand — paid in cash',
                },
              ],
            },
          },
        });
      }
    },
    { timeout: 180000, maxWait: 30000 },
  );

  console.log(`\n  posted ${withdrawals.length} withdrawals and ${spends.length} cash costs`);

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

  const all = await prisma.glAccount.findMany({
    select: { id: true, code: true, type: true },
  });
  const byId = new Map(all.map((a) => [a.id, a]));
  const year = await prisma.journalLine.findMany({
    where: {
      entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } },
    },
    select: { accountId: true, debit: true, credit: true },
  });
  let revenue = 0;
  let expense = 0;
  let cashDr = 0;
  let cashCr = 0;
  let bankOut = 0;
  for (const l of year) {
    const a = byId.get(l.accountId);
    if (!a) continue;
    const net = dec(l.debit) - dec(l.credit);
    if (a.type === 'INCOME' || a.type === 'REVENUE') revenue += -net;
    if (a.type === 'EXPENSE') expense += net;
    if (a.code === '1000') {
      cashDr += dec(l.debit);
      cashCr += dec(l.credit);
    }
    if (a.code === '1010') bankOut += dec(l.credit);
  }

  console.log(`\n  revenue                  ${money(revenue).padStart(14)}`);
  console.log(`  expenses                 ${money(expense).padStart(14)}`);
  console.log(`  PROFIT                   ${money(revenue - expense).padStart(14)}`);
  console.log(
    `\n  1000 Cash on Hand: in ${money(cashDr)}  out ${money(cashCr)}  ` +
      `balance at 31 Dec ${money(cashDr - cashCr)}`,
  );
  console.log(
    '\n  The General Manager has said there was NO cash on hand at 31 Dec 2025,\n' +
      '  so that balance has to be spent down by evidenced costs or taken as\n' +
      '  drawings. It is now visible as a number instead of hidden in the bank gap.',
  );
  console.log(`\n  bank outgoing recorded   ${money(bankOut).padStart(14)}`);
  console.log(`  statements say 969,137.15 — still unrecorded ${money(969137.15 - bankOut)}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
