/**
 * unexplained-credits-2025.ts — READ ONLY.
 *
 * Lists every 2025 bank credit that is NOT matched by a customer receipt in the
 * ledger, so the "unexplained credits" figure stops being a number and becomes
 * a list of specific transactions with the bank's own narrative against each.
 *
 * Matching is on date and amount against posted Payment records. Anything left
 * over is either not revenue at all (a bounced cheque reversing, owner money
 * paid in, a transfer between the company's own pockets) or a real receipt that
 * has never been traced to an invoice.
 *
 *   npx ts-node --transpile-only prisma/unexplained-credits-2025.ts /tmp/adcb-2025.csv
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'fs';

const prisma = new PrismaClient();

const TOLERANCE = 0.01;
/** A receipt posted within this many days of the bank credit is the same money. */
const WINDOW_DAYS = 3;

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

const days = (a: string, b: string): number =>
  Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000);

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

/** A plain-English guess at what a credit is, from the bank's own wording. */
function describe(narrative: string): string {
  const upper = narrative.toUpperCase();
  if (upper.includes('CHQ RETRN') || upper.includes('RETURN')) {
    return 'a cheque the company issued that bounced, reversing — not income';
  }
  if (upper.includes('B/O QAIS') || upper.includes('QANDIL')) {
    return "the owner's own money paid in — not income";
  }
  if (upper.includes('CDM-CASH') || upper.includes('CASH DEPOSIT')) {
    return 'cash paid in over the counter — needs a source';
  }
  if (upper.includes('INHOUSE CHEQUE')) {
    return 'a cheque deposited in branch — the narrative names the beneficiary, not the drawer';
  }
  if (upper.includes('CHEQUE DEPOSIT')) {
    return 'a cheque deposited — the name shown is often the signatory, not the payer';
  }
  if (upper.includes('REV') || upper.includes('REFUND') || upper.includes('REF ')) {
    return 'a reversal or refund — not income';
  }
  if (upper.includes('B/O')) {
    return 'an inward transfer — the payer is named in the narrative';
  }
  return 'unclassified';
}

async function main(): Promise<void> {
  const path = process.argv[2] ?? '/tmp/adcb-2025.csv';
  const lines = readFileSync(path, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
  const header = splitCsvLine(lines[0]);
  const at = (n: string): number => header.indexOf(n);

  const credits: { iso: string; date: string; amount: number; narrative: string }[] = [];
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line);
    if (c[at('direction')] !== 'CREDIT') continue;
    const [d, m, y] = c[at('date')].split('/');
    credits.push({
      iso: `${y}-${m}-${d}`,
      date: c[at('date')],
      amount: Number(c[at('amount')]),
      narrative: c[at('narrative')]
        .replace(/^\d{2}\/\d{2}\/\d{4}\s*/, '')
        .replace(/\s+\d{2}\/\d{2}\/\d{4}\s*$/, '')
        .trim(),
    });
  }

  const receipts = await prisma.payment.findMany({
    where: {
      direction: 'RECEIPT',
      method: { not: 'CASH' },
      paymentDate: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') },
    },
    select: {
      paymentNumber: true,
      paymentDate: true,
      amount: true,
      invoice: { select: { invoiceNumber: true } },
      client: { select: { companyName: true } },
    },
  });

  const claimed = new Set<string>();
  const matched: typeof credits = [];
  const unmatched: typeof credits = [];

  for (const credit of credits) {
    const hit = receipts.find(
      (r) =>
        !claimed.has(r.paymentNumber) &&
        Math.abs(dec(r.amount) - credit.amount) <= TOLERANCE &&
        days(r.paymentDate.toISOString().slice(0, 10), credit.iso) <= WINDOW_DAYS,
    );
    if (hit) {
      claimed.add(hit.paymentNumber);
      matched.push(credit);
    } else {
      unmatched.push(credit);
    }
  }

  const total = credits.reduce((t, c) => t + c.amount, 0);
  const matchedTotal = matched.reduce((t, c) => t + c.amount, 0);
  const unmatchedTotal = unmatched.reduce((t, c) => t + c.amount, 0);

  console.log('=== 2025 BANK CREDITS ===\n');
  console.log(`  all credits on the statements   ${String(credits.length).padStart(4)}  ${money(total).padStart(14)}`);
  console.log(`  matched to a posted receipt     ${String(matched.length).padStart(4)}  ${money(matchedTotal).padStart(14)}`);
  console.log(`  NOT matched                     ${String(unmatched.length).padStart(4)}  ${money(unmatchedTotal).padStart(14)}`);

  console.log('\n=== EVERY UNMATCHED CREDIT ===\n');
  const groups = new Map<string, { n: number; total: number }>();
  for (const credit of unmatched.sort((a, b) => b.amount - a.amount)) {
    const kind = describe(credit.narrative);
    const g = groups.get(kind) ?? { n: 0, total: 0 };
    g.n += 1;
    g.total += credit.amount;
    groups.set(kind, g);
    console.log(`  ${credit.date}  ${money(credit.amount).padStart(12)}  ${credit.narrative.slice(0, 74)}`);
  }

  console.log('\n=== GROUPED BY WHAT THE BANK CALLS THEM ===\n');
  for (const [kind, g] of [...groups.entries()].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${money(g.total).padStart(12)}  x${String(g.n).padEnd(3)} ${kind}`);
  }

  console.log('\n=== RECEIPTS IN THE LEDGER WITH NO BANK CREDIT AGAINST THEM ===\n');
  const orphans = receipts.filter((r) => !claimed.has(r.paymentNumber));
  if (orphans.length === 0) {
    console.log('  none — every posted bank receipt ties to a statement line');
  } else {
    for (const r of orphans) {
      console.log(
        `  ${r.paymentDate.toISOString().slice(0, 10)}  ${money(dec(r.amount)).padStart(12)}  ` +
          `${r.paymentNumber}  ${(r.client?.companyName ?? '').slice(0, 28).padEnd(30)}` +
          `invoice ${r.invoice?.invoiceNumber ?? '-'}`,
      );
    }
    console.log(
      '\n  These should be looked at: a receipt posted to the bank that no\n' +
        '  statement line supports is either mis-dated or does not belong there.',
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
