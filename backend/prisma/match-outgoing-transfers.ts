/**
 * match-outgoing-transfers.ts
 *
 * READ ONLY. Builds the worksheet for identifying the 2025 outward transfers.
 *
 * ADCB does not print the beneficiary on an outward transfer, so the statement
 * alone cannot say who was paid. But the supplier invoices are largely already
 * in the ledger, sitting unpaid in 2000 Accounts Payable — so for most transfers
 * the answer is already in the system and only needs to be recognised.
 *
 * This script takes every outward transfer read off the statements and looks for
 * an unpaid expense of the same amount, preferring one dated close to the
 * transfer. It proposes; it never posts. Where it finds a single candidate
 * within a few days the match is worth trusting on sight; where it finds several
 * or none, Qais has to say.
 *
 *   python3 prisma/extract-adcb-transactions.py --year 2025 --csv /tmp/adcb-2025.csv
 *   npx ts-node --transpile-only prisma/match-outgoing-transfers.ts /tmp/adcb-2025.csv
 *
 * Writes the worksheet next to the input as *-transfers-worksheet.csv.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync, writeFileSync } from 'fs';

const prisma = new PrismaClient();

/** Amounts this close are treated as the same money. */
const TOLERANCE = 0.5;
/** A candidate this many days from the transfer is still plausible. */
const WINDOW_DAYS = 45;

interface Transfer {
  date: string;
  iso: string;
  amount: number;
  narrative: string;
}

interface Candidate {
  expenseNumber: string;
  vendor: string;
  expenseDate: string;
  total: number;
  invoiceNumber: string;
  gapDays: number;
}

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

/** dd/mm/yyyy from the statement to an ISO day. */
function toIso(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/');
  return `${y}-${m}-${d}`;
}

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(ms / 86400000);
}

/** A CSV line reader that respects quoted fields. */
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

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function readTransfers(path: string): Transfer[] {
  // The CSV is written with CRLF endings; leaving the \r on turns the last
  // column name into "narrative\r" and every lookup silently misses.
  const lines = readFileSync(path, 'utf8')
    .replace(/^﻿/, '')
    .trim()
    .split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  const at = (name: string): number => header.indexOf(name);
  const iDate = at('date');
  const iDir = at('direction');
  const iAmt = at('amount');
  const iNarr = at('narrative');

  const transfers: Transfer[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    if (cells[iDir] !== 'DEBIT') continue;
    const narrative = cells[iNarr] ?? '';
    if (!/O\/W TRF|TRF TO|OUTWARD/i.test(narrative)) continue;
    const date = cells[iDate];
    transfers.push({
      date,
      iso: toIso(date),
      amount: Number(cells[iAmt]),
      narrative: narrative
        .replace(/^\d{2}\/\d{2}\/\d{4}\s*/, '')
        .replace(/\s+\d{2}\/\d{2}\/\d{4}\s*$/, '')
        .trim(),
    });
  }
  return transfers.sort((a, b) => b.amount - a.amount);
}

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    throw new Error(
      'Give the transaction CSV: npx ts-node --transpile-only ' +
        'prisma/match-outgoing-transfers.ts /tmp/adcb-2025.csv',
    );
  }

  const transfers = readTransfers(input);
  console.log(
    `=== ${transfers.length} OUTWARD TRANSFERS, ` +
      `${money(transfers.reduce((sum, t) => sum + t.amount, 0))} ===\n`,
  );

  const expenses = await prisma.expense.findMany({
    where: {
      expenseDate: {
        gte: new Date('2024-12-01'),
        lte: new Date('2026-03-31'),
      },
    },
    select: {
      expenseNumber: true,
      expenseDate: true,
      totalAmount: true,
      amount: true,
      vatAmount: true,
      invoiceNumber: true,
      vendorName: true,
      supplier: { select: { name: true } },
    },
  });

  console.log(`  checked against ${expenses.length} expense rows\n`);

  const rows: string[][] = [
    [
      'date',
      'amount',
      'bank narrative',
      'candidates found',
      'best candidate',
      'candidate vendor',
      'candidate date',
      'days apart',
      'PAID TO (fill in)',
      'WHAT FOR (fill in)',
    ],
  ];

  let confident = 0;
  let confidentValue = 0;
  let ambiguous = 0;
  let none = 0;
  let noneValue = 0;

  for (const transfer of transfers) {
    const candidates: Candidate[] = [];
    for (const expense of expenses) {
      const total = dec(expense.totalAmount);
      if (Math.abs(total - transfer.amount) > TOLERANCE) continue;
      const expenseIso = expense.expenseDate.toISOString().slice(0, 10);
      const gap = daysBetween(transfer.iso, expenseIso);
      if (gap > WINDOW_DAYS) continue;
      candidates.push({
        expenseNumber: expense.expenseNumber,
        vendor: expense.supplier?.name ?? expense.vendorName ?? '',
        expenseDate: expenseIso,
        total,
        invoiceNumber: expense.invoiceNumber ?? '',
        gapDays: gap,
      });
    }
    candidates.sort((a, b) => a.gapDays - b.gapDays);

    const best = candidates[0];
    if (candidates.length === 1) {
      confident += 1;
      confidentValue += transfer.amount;
    } else if (candidates.length > 1) {
      ambiguous += 1;
    } else {
      none += 1;
      noneValue += transfer.amount;
    }

    const named = /TRF TO ([A-Z0-9 .&'-]+)/i.exec(transfer.narrative);

    rows.push([
      transfer.date,
      transfer.amount.toFixed(2),
      transfer.narrative,
      String(candidates.length),
      best ? best.expenseNumber : '',
      best ? best.vendor : named ? named[1].trim() : '',
      best ? best.expenseDate : '',
      best ? String(best.gapDays) : '',
      named ? named[1].trim() : '',
      '',
    ]);

    const mark =
      candidates.length === 1 ? 'MATCH ' : candidates.length > 1 ? 'SEVERAL' : '  ?   ';
    console.log(
      `  ${mark} ${transfer.date}  ${money(transfer.amount).padStart(13)}  ` +
        (best
          ? `${best.vendor.slice(0, 30).padEnd(32)}${best.expenseNumber}  (${best.gapDays}d)`
          : named
            ? `${named[1].trim().slice(0, 30)}  — named by the bank, no matching expense`
            : 'no payee, no matching expense'),
    );
  }

  const output = input.replace(/\.csv$/i, '') + '-transfers-worksheet.csv';
  writeFileSync(output, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'utf8');

  console.log('\n=== SUMMARY ===\n');
  console.log(`  one clear candidate : ${String(confident).padStart(3)}   ${money(confidentValue)}`);
  console.log(`  several candidates  : ${String(ambiguous).padStart(3)}`);
  console.log(`  nothing to match    : ${String(none).padStart(3)}   ${money(noneValue)}`);
  console.log(`\n  worksheet written to ${output}`);
  console.log(
    '\n  Nothing has been posted. Fill the last two columns for anything not\n' +
      '  matched and the payments can be entered against the right suppliers.',
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
