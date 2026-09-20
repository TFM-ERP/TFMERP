/**
 * post-card-spending.ts
 *
 * Posts the 2025 card, cash-charge and bank-charge lines that
 * classify-card-spending.py marked "posted" — 568 lines, 134,834.54.
 *
 * One journal entry per bank line, dated as the statement shows it, carrying the
 * bank's own narrative in the memo. That is deliberately not a monthly summary:
 * a bank reconciliation has to be walkable line by line, and an auditor asking
 * "what is this 9,990?" should find the answer in the entry, not in a spreadsheet
 * somewhere else.
 *
 *   Dr  <expense account>      the amount
 *   Cr  1010 Bank              the amount
 *
 * Except the four Federal Tax Authority card payments, which are not a cost at
 * all — they settle the VAT liability, so they post Dr 2100 Output VAT / Cr 1010.
 *
 * GROSS, NOT NET. These amounts include 5% VAT, and input VAT is recoverable
 * only where the company holds a valid tax invoice from the supplier — a card
 * slip is not one. Nothing is assumed here: the full amount goes to the expense
 * account and the input VAT can be split out later, invoice by invoice, for the
 * ones where an invoice actually exists.
 *
 * Idempotent: every entry is tagged, and the script refuses to run twice.
 *
 *   python3 prisma/classify-card-spending.py /tmp/adcb-2025.csv --out /tmp/adcb-2025-classified.csv
 *   npx ts-node --transpile-only prisma/post-card-spending.ts /tmp/adcb-2025-classified.csv --dry
 *   npx ts-node --transpile-only prisma/post-card-spending.ts /tmp/adcb-2025-classified.csv
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

const DRY = process.argv.includes('--dry');
const TAG = '[CARD2025]';

interface Row {
  date: string;
  iso: string;
  amount: number;
  gl: string;
  label: string;
  narrative: string;
}

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

function readRows(path: string): Row[] {
  const lines = readFileSync(path, 'utf8')
    .replace(/^﻿/, '')
    .trim()
    .split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  const at = (name: string): number => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error(`the CSV has no "${name}" column`);
    return index;
  };
  const iDate = at('date');
  const iAmount = at('amount');
  const iStatus = at('status');
  const iGl = at('gl');
  const iLabel = at('label');
  const iNarr = at('narrative');

  const rows: Row[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    if (cells[iStatus] !== 'posted') continue;
    const [d, m, y] = cells[iDate].split('/');
    rows.push({
      date: cells[iDate],
      iso: `${y}-${m}-${d}`,
      amount: Number(cells[iAmount]),
      gl: cells[iGl],
      label: cells[iLabel],
      narrative: cells[iNarr],
    });
  }
  return rows.sort((a, b) => a.iso.localeCompare(b.iso));
}

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    throw new Error(
      'Give the classified CSV: npx ts-node --transpile-only ' +
        'prisma/post-card-spending.ts /tmp/adcb-2025-classified.csv [--dry]',
    );
  }

  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');

  const already = await prisma.journalEntry.count({ where: { memo: { startsWith: TAG } } });
  if (already > 0) {
    console.log(`  ${already} entries tagged ${TAG} already exist. Nothing to do.`);
    console.log('  To re-post, those entries have to be removed first — deliberately manual.');
    await prisma.$disconnect();
    return;
  }

  const rows = readRows(input);
  if (rows.length === 0) {
    throw new Error('no rows marked "posted" in that CSV — nothing has been changed');
  }

  const codes = [...new Set(rows.map((r) => r.gl))].filter(Boolean);
  const accounts = await prisma.glAccount.findMany({
    where: { code: { in: [...codes, '1010'] } },
    select: { id: true, code: true, name: true },
  });
  const account = new Map(accounts.map((a) => [a.code, a.id]));
  const accountName = new Map(accounts.map((a) => [a.code, a.name]));
  for (const code of [...codes, '1010']) {
    if (!account.has(code)) {
      throw new Error(`GL account ${code} was not found — nothing has been changed.`);
    }
  }

  const byAccount = new Map<string, { n: number; total: number }>();
  let total = 0;
  for (const row of rows) {
    const bucket = byAccount.get(row.gl) ?? { n: 0, total: 0 };
    bucket.n += 1;
    bucket.total += row.amount;
    byAccount.set(row.gl, bucket);
    total += row.amount;
  }

  console.log(`  ${rows.length} bank lines, ${money(total)}\n`);
  console.log('  account                                 lines          amount');
  for (const [code, bucket] of [...byAccount.entries()].sort()) {
    console.log(
      `  ${code} ${(accountName.get(code) ?? '').slice(0, 32).padEnd(34)}` +
        `${String(bucket.n).padStart(5)}  ${money(bucket.total).padStart(14)}`,
    );
  }
  console.log(`\n  every line credits 1010 Bank — Current Account`);

  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  const prefix = `JE-${new Date().getFullYear()}-`;
  const last = await prisma.journalEntry.findMany({
    where: { entryNumber: { startsWith: prefix } },
    select: { entryNumber: true },
    orderBy: { entryNumber: 'desc' },
    take: 1,
  });
  let next = last.length > 0 ? parseInt(last[0].entryNumber.slice(-4), 10) : 0;

  const bankId = account.get('1010')!;
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      for (const row of rows) {
        next += 1;
        await tx.journalEntry.create({
          data: {
            entryNumber: `${prefix}${String(next).padStart(4, '0')}`,
            date: new Date(`${row.iso}T00:00:00.000Z`),
            memo: `${TAG} ${row.label} — ${row.narrative}`.slice(0, 480),
            source: 'SYSTEM',
            status: 'POSTED',
            postedAt: now,
            lines: {
              create: [
                {
                  accountId: account.get(row.gl)!,
                  debit: row.amount,
                  credit: 0,
                  description: row.label,
                },
                {
                  accountId: bankId,
                  debit: 0,
                  credit: row.amount,
                  description: 'Bank — card / charge',
                },
              ],
            },
          },
        });
      }
    },
    { timeout: 300000, maxWait: 60000 },
  );

  console.log(`\n  posted ${rows.length} entries, ${prefix}${String(next - rows.length + 1).padStart(4, '0')} to ${prefix}${String(next).padStart(4, '0')}`);

  /* ---------------------------------------------------------------- verify */

  console.log('\n=== AFTER ===\n');

  const allLines = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  let debits = 0;
  let credits = 0;
  for (const line of allLines) {
    debits += dec(line.debit);
    credits += dec(line.credit);
  }
  console.log(
    `  trial balance: debits ${money(debits)}  credits ${money(credits)}  ` +
      `difference ${money(debits - credits)}`,
  );

  const allAccounts = await prisma.glAccount.findMany({
    select: { id: true, code: true, type: true },
  });
  const typeOf = new Map(allAccounts.map((a) => [a.id, a]));
  const year = await prisma.journalLine.findMany({
    where: {
      entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } },
    },
    select: { accountId: true, debit: true, credit: true },
  });

  let revenue = 0;
  let expense = 0;
  let bankIn = 0;
  let bankOut = 0;
  for (const line of year) {
    const a = typeOf.get(line.accountId);
    if (!a) continue;
    const net = dec(line.debit) - dec(line.credit);
    if (a.type === 'INCOME' || a.type === 'REVENUE') revenue += -net;
    if (a.type === 'EXPENSE') expense += net;
    if (a.code === '1010') {
      bankIn += dec(line.debit);
      bankOut += dec(line.credit);
    }
  }

  console.log(`\n  revenue                       ${money(revenue).padStart(14)}`);
  console.log(`  expenses                      ${money(expense).padStart(14)}`);
  console.log(`  PROFIT                        ${money(revenue - expense).padStart(14)}`);
  console.log(`\n  1010 Bank 2025: in ${money(bankIn)}  out ${money(bankOut)}`);
  console.log(`  the bank statements say: in 1,021,774.50  out 969,137.15`);
  console.log(`  outgoing still unrecorded: ${money(969137.15 - bankOut)}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
