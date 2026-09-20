/**
 * verify-qfzp-exposure.ts — READ ONLY.
 *
 * A Qualifying Free Zone Person keeps the 0% rate only while non-qualifying
 * revenue stays within the de minimis: the LOWER of 5% of total revenue or
 * AED 5,000,000. Breach it and QFZP status is lost for the current tax period
 * and the four that follow, with 9% on everything.
 *
 * Qualifying Income comes from transactions with other Free Zone Persons, or
 * from the defined list of Qualifying Activities. Revenue from mainland UAE
 * persons is non-qualifying unless it falls inside that list.
 *
 * This splits 2025 revenue by customer so the exposure is a measured number
 * rather than an impression. THE FREE-ZONE FLAG BELOW IS READ OFF THE
 * CUSTOMER'S LEGAL NAME AND ADDRESS, NOT FROM A REGISTER — it is an indication
 * for the tax adviser to confirm, not a determination.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const DE_MINIMIS_PCT = 0.05;
const DE_MINIMIS_CAP = 5000000;

/** Names whose legal form or address indicates a UAE free zone. */
const FREE_ZONE = [
  'FZ', 'FZE', 'FZCO', 'FZC', 'FREE ZONE', 'TWOFOUR54',
];
/** Customers known to be mainland or government, whatever the name suggests. */
const MAINLAND: Record<string, string> = {
  'khalifa award for education': 'Abu Dhabi government body',
  'dubai media incorporated': 'Dubai government',
  'action filmz productions llc': 'Al Quoz Industrial Area, mainland Dubai',
  'alter films': 'Bur Dubai, mainland',
  'al falah academy': 'Abu Dhabi, mainland',
  'silver frame cinema production llc spc': 'mainland LLC',
  'macquip commercial equipment': 'mainland',
  'al sayegh media': 'IMPZ Dubai with an Abu Dhabi branch — needs confirming',
};
/** Customers outside the UAE. */
const FOREIGN: Record<string, string> = {
  'les productions visuelles compliment inc.': 'Montreal, Canada',
};

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

type Kind = 'free zone' | 'mainland / government' | 'foreign' | 'unclear';

function classify(name: string): { kind: Kind; why: string } {
  const lower = name.toLowerCase().trim();

  for (const [key, why] of Object.entries(FOREIGN)) {
    if (lower.includes(key)) return { kind: 'foreign', why };
  }
  for (const [key, why] of Object.entries(MAINLAND)) {
    if (lower.includes(key)) return { kind: 'mainland / government', why };
  }
  const upper = name.toUpperCase();
  for (const token of FREE_ZONE) {
    if (new RegExp(`(^|[^A-Z])${token}([^A-Z]|$)`).test(upper)) {
      return { kind: 'free zone', why: `"${token}" in the legal name` };
    }
  }
  return { kind: 'unclear', why: 'legal form does not say' };
}

async function main(): Promise<void> {
  const invoices = await prisma.invoice.findMany({
    where: {
      issueDate: { gte: new Date('2025-01-01'), lt: new Date('2026-01-01') },
      status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT'] },
    },
    select: {
      invoiceNumber: true,
      subtotal: true,
      client: { select: { companyName: true } },
    },
  });

  const byClient = new Map<string, { net: number; n: number }>();
  for (const invoice of invoices) {
    const name = invoice.client?.companyName ?? '(no client)';
    const bucket = byClient.get(name) ?? { net: 0, n: 0 };
    bucket.net += dec(invoice.subtotal);
    bucket.n += 1;
    byClient.set(name, bucket);
  }

  const totals: Record<Kind, number> = {
    'free zone': 0,
    'mainland / government': 0,
    foreign: 0,
    unclear: 0,
  };

  console.log('=== 2025 REVENUE BY CUSTOMER (net of VAT) ===\n');
  const rows = [...byClient.entries()].sort((a, b) => b[1].net - a[1].net);
  for (const [name, bucket] of rows) {
    const { kind, why } = classify(name);
    totals[kind] += bucket.net;
    console.log(
      `  ${money(bucket.net).padStart(13)}  x${String(bucket.n).padEnd(2)} ` +
        `${name.slice(0, 34).padEnd(36)}${kind.padEnd(24)}${why}`,
    );
  }

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log('\n=== SPLIT ===\n');
  for (const kind of Object.keys(totals) as Kind[]) {
    const value = totals[kind];
    console.log(
      `  ${kind.padEnd(24)}${money(value).padStart(14)}   ${((value / total) * 100).toFixed(1).padStart(5)}%`,
    );
  }
  console.log(`  ${'total'.padEnd(24)}${money(total).padStart(14)}`);

  const nonQualifying = totals['mainland / government'] + totals.unclear;
  const allowance = Math.min(total * DE_MINIMIS_PCT, DE_MINIMIS_CAP);

  console.log('\n=== DE MINIMIS TEST, ON THE MOST GENEROUS READING ===\n');
  console.log(
    '  This assumes every free-zone and foreign dirham IS qualifying income,\n' +
      '  which is the best case and probably not true — see the note below.\n',
  );
  console.log(`  total revenue                        ${money(total).padStart(14)}`);
  console.log(`  de minimis allowance (lower of 5% / 5m) ${money(allowance).padStart(11)}`);
  console.log(`  non-qualifying on this reading       ${money(nonQualifying).padStart(14)}`);
  console.log(
    `  ${nonQualifying > allowance ? 'BREACHED by' : 'within, by'} ` +
      `${money(Math.abs(nonQualifying - allowance))}`,
  );

  if (nonQualifying > allowance) {
    console.log(
      '\n  On this reading the de minimis is breached, which would cost QFZP\n' +
        '  status for 2025 and the four tax periods after it, with 9% on all\n' +
        '  income throughout.',
    );
  }

  console.log('\n=== THE LARGER POINT ===\n');
  console.log(
    '  Free-zone-to-free-zone revenue is qualifying ONLY where it is a\n' +
      '  Qualifying Activity. That list covers manufacturing, processing,\n' +
      '  holding shares, ship and aircraft ownership, reinsurance, fund and\n' +
      '  wealth management, headquarter and treasury services, distribution\n' +
      '  in or from a Designated Zone, and logistics.\n\n' +
      '  Caravan and equipment hire to film productions is not obviously on\n' +
      '  that list. If it is not, the qualifying column above is nil and ALL\n' +
      '  the revenue is non-qualifying — which fails the de minimis outright.',
  );

  console.log('\n=== WHAT IT COSTS EITHER WAY ===\n');
  const lines = await prisma.journalLine.findMany({
    where: {
      entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } },
    },
    select: { accountId: true, debit: true, credit: true },
  });
  const accounts = await prisma.glAccount.findMany({ select: { id: true, type: true } });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  let revenue = 0;
  let expense = 0;
  for (const l of lines) {
    const a = byId.get(l.accountId);
    if (!a) continue;
    const net = dec(l.debit) - dec(l.credit);
    if (a.type === 'INCOME' || a.type === 'REVENUE') revenue += -net;
    if (a.type === 'EXPENSE') expense += net;
  }
  const profit = revenue - expense;

  console.log(`  2025 profit as the ledger stands      ${money(profit).padStart(14)}`);
  console.log(
    `\n  NOT a QFZP: 0% on the first 375,000.00, 9% above.\n` +
      `      tax on ${money(profit)} = ${money(Math.max(0, profit - 375000) * 0.09)}`,
  );
  console.log(
    `\n  A QFZP: 0% on qualifying income, 9% on the rest. The 375,000.00\n` +
      `      band is for ordinary taxable persons — confirm with the adviser\n` +
      `      whether it is available to a QFZP at all. If it is not:\n` +
      `      tax on ${money(nonQualifying > 0 ? profit : 0)} of non-qualifying profit ` +
      `= ${money(profit * 0.09)}`,
  );
  console.log(
    '\n  And a QFZP must have AUDITED financial statements whatever the\n' +
      '  revenue (Ministerial Decision 84 of 2025), which brings 2024\n' +
      '  comparatives back with it.',
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
