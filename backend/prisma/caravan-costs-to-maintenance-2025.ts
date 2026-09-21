/**
 * caravan-costs-to-maintenance-2025.ts
 *
 * General Manager, 21 Sep 2026: "all caravan related invoices and trailers should
 * be maintenance." Reverses today's capitalisation and books Sana Electronics.
 *
 * 1. Everything put into 1500 Rental Fleet & Equipment today by [SUPDOC2025],
 *    [AUCTION2025] and [HLJOBSHEET2025] moves to 5200 Maintenance & Repairs:
 *      Heartland solar/battery jobs (Toilet Trailer 1 net 2,670.00, Toilet Trailer 2
 *      2,595.00, Freedom Express 2,650.00), five caravan ACs (Dhabi One 6,666.67 +
 *      2,619.05, Abdullah S 3,500.00 + 5,600.00) and the Emirates Auction trailer
 *      caravan 41,000.00. Total 67,300.72.
 *
 *    The Emirates Auction caravan is a purchase of a whole caravan. The GM was told
 *    that booking it as maintenance is hard to defend and chose maintenance anyway.
 *    Recorded here so the position is visible to the adviser.
 *
 * 2. Sana Electronics, three card payments not yet in the ledger, 13,250.00 —
 *    caravan maintenance (GM). No supplier invoice held; booked gross.
 *      01/05/2025 5,600.00 approval 030151 · 06/05/2025 4,000.00 approval 253945 ·
 *      23/12/2025 3,650.00 approval 432259 (card 2528)
 *
 * Idempotent (tag [CARAVANMAINT2025]). Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[CARAVANMAINT2025]';
const SOURCE_TAGS = ['[SUPDOC2025]', '[AUCTION2025]', '[HLJOBSHEET2025]', 'Expense EXP-2025-0002'];
const EXPECTED_TOTAL = 67300.72;

const SANA = [
  { posted: '2025-05-03', amount: 5600, narrative: 'PUR 01/05 SANA ELECT ABU DHABI 3825 030151' },
  { posted: '2025-05-08', amount: 4000, narrative: 'PUR 06/05 SANA ELECT ABU DHABI 3825 253945' },
  { posted: '2025-12-25', amount: 3650, narrative: 'PUR 23/12 SANA ELECT ABU DHABI 2528 432259' },
];

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function nextNumber(tx: Prisma.TransactionClient, issued: Set<string>): Promise<string> {
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
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) {
    console.log(`Already applied (${TAG}).`);
    await prisma.$disconnect();
    return;
  }
  const accts = await prisma.glAccount.findMany({ where: { code: { in: ['1010', '1500', '5200'] } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== 3) throw new Error('GL account missing — nothing changed.');

  const lines = await prisma.journalLine.findMany({
    where: { account: { code: '1500' }, entry: { OR: SOURCE_TAGS.map((t) => ({ memo: { contains: t } })) } },
    select: { debit: true, credit: true, description: true, entry: { select: { entryNumber: true, date: true } } },
    orderBy: { entry: { date: 'asc' } },
  });
  const moves = lines.map((l) => ({
    date: l.entry.date,
    from: l.entry.entryNumber,
    net: Math.round((dec(l.debit) - dec(l.credit)) * 100) / 100,
    what: l.description ?? '',
  }));
  const total = Math.round(moves.reduce((t, m) => t + m.net, 0) * 100) / 100;
  if (Math.abs(total - EXPECTED_TOTAL) > 0.005) {
    throw new Error(`1500 lines from today total ${total}, expected ${EXPECTED_TOTAL} — nothing changed.`);
  }
  if ((await prisma.journalEntry.count({ where: { OR: SANA.map((s) => ({ memo: { contains: s.narrative.slice(-6) } })) } })) > 0) {
    throw new Error('A Sana payment is already in the ledger — nothing changed.');
  }

  console.log('--- 1. 1500 -> 5200 ---');
  for (const m of moves) console.log(`  ${m.date.toISOString().slice(0, 10)}  ${money(m.net).padStart(10)}  ${m.from}  ${m.what}`);
  console.log(`  total ${money(total)}`);
  console.log('\n--- 2. Sana Electronics card payments, Dr 5200 / Cr 1010 ---');
  for (const s of SANA) console.log(`  ${s.posted}  ${money(s.amount).padStart(10)}  ${s.narrative}`);
  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const issued = new Set<string>();
    for (const m of moves) {
      const up = m.net > 0;
      const amt = Math.abs(m.net);
      await tx.journalEntry.create({
        data: {
          entryNumber: await nextNumber(tx, issued),
          date: m.date,
          memo: `${TAG} Reclassified from 1500 to 5200 Maintenance & Repairs on the GM's instruction (21 Sep 2026: all caravan and trailer invoices are maintenance). Reverses ${m.from}: ${m.what}`.slice(0, 480),
          source: 'SYSTEM',
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              { accountId: acct.get('5200')!, debit: up ? amt : 0, credit: up ? 0 : amt, description: `Maintenance — ${m.what}`.slice(0, 190) },
              { accountId: acct.get('1500')!, debit: up ? 0 : amt, credit: up ? amt : 0, description: `Out of Rental Fleet — ${m.from}` },
            ],
          },
        },
      });
    }
    for (const s of SANA) {
      await tx.journalEntry.create({
        data: {
          entryNumber: await nextNumber(tx, issued),
          date: day(s.posted),
          memo: `[CARD2025] ${TAG} ${s.narrative} — caravan maintenance (GM, 21 Sep 2026). No supplier invoice held; booked gross.`,
          source: 'SYSTEM',
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              { accountId: acct.get('5200')!, debit: s.amount, credit: 0, description: 'Maintenance — Sana Electronics, caravan' },
              { accountId: acct.get('1010')!, debit: 0, credit: s.amount, description: `Bank — ${s.narrative.slice(-11)}` },
            ],
          },
        },
      });
    }
    await tx.expense.updateMany({
      where: { expenseNumber: 'EXP-2025-0002' },
      data: { category: 'Maintenance' },
    });
  });

  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`\n  trial balance difference ${all.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  const types = await prisma.glAccount.findMany({ select: { id: true, code: true, type: true } });
  const t = new Map(types.map((a) => [a.id, a]));
  const year = await prisma.journalLine.findMany({
    where: { entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } } },
    select: { accountId: true, debit: true, credit: true },
  });
  let r = 0;
  let e = 0;
  for (const l of year) {
    const n = dec(l.debit) - dec(l.credit);
    if (t.get(l.accountId)?.type === 'INCOME') r -= n;
    if (t.get(l.accountId)?.type === 'EXPENSE') e += n;
  }
  console.log(`  2025 revenue ${money(r)}  expenses ${money(e)}  PROFIT ${money(r - e)}`);
  for (const code of ['1500', '5200']) {
    const ls = await prisma.journalLine.findMany({ where: { account: { code } }, select: { debit: true, credit: true } });
    console.log(`  ${code} balance ${money(ls.reduce((s, l) => s + dec(l.debit) - dec(l.credit), 0))}`);
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
