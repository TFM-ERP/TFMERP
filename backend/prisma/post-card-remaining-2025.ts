/**
 * post-card-remaining-2025.ts
 *
 * GM, 21 Sep 2026: "all company card would be all business" and "book the rest".
 * The last 2025 company-card lines still unposted (status review/unknown in the
 * classified ADCB file). No supplier documents are held for any of them — booked
 * gross from the bank line, Dr expense / Cr 1010. Personal-looking items are booked
 * as business on the GM's instruction and flagged for the adviser.
 *
 * Idempotent (tag [CARDREST2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[CARDREST2025]';
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

// [posted, amount, narrative, fee narrative | null, fee, account, description]
const L: [string, number, string, string | null, number, string, string][] = [
  ['2025-01-09', 125, 'PUR 07/01 VAPORS R U ABUDHABI 3825 329710', null, 0, '6900', 'Vapors R Us — booked as business on GM instruction (looks personal)'],
  ['2025-01-10', 40, 'PUR 08/01 ABU DHABI ABUDHABI 3825 724262', null, 0, '6900', 'Merchant not identified ("ABU DHABI ABUDHABI")'],
  ['2025-02-05', 453, 'PUR 03/02 Abu Dhabi AUH 3825 632777', null, 0, '6900', 'Merchant "Abu Dhabi AUH" — not identified'],
  ['2025-02-11', 3203, 'PUR 09/02 Abu Dhabi AUH 3825 958293', null, 0, '6900', 'Merchant "Abu Dhabi AUH" — not identified'],
  ['2025-02-15', 78, 'PUR 13/02 Abu Dhabi AUH 3825 062922', null, 0, '6900', 'Merchant "Abu Dhabi AUH" — not identified'],
  ['2025-07-18', 100, 'PUR 17/07 VAPORS R U ABUDHABI 3825 036323', null, 0, '6900', 'Vapors R Us — booked as business on GM instruction (looks personal)'],
  ['2025-07-21', 149, 'PUR 19/07 HENNES&MAU DUBAI 3825 717281', null, 0, '6900', 'H&M clothing — booked as business on GM instruction (looks personal)'],
  ['2025-07-22', 517, 'PUR 20/07 Abu Dhabi AUH 3825 151995', null, 0, '6900', 'Merchant "Abu Dhabi AUH" — not identified'],
  ['2025-07-24', 7051.2, 'PUR 22/07 WIZZ AIRZR ABU DHABI 3825 575978', null, 0, '5100', 'Wizz Air flights — business travel (GM rule for company-card purchases)'],
  ['2025-09-01', 71, 'PUR 29/08 NETFLIX CO Amsterdam 3825 526950', 'FOREIGN TRANSACTION FEE 29/08 NETFLIX 3825 526950', 1.76, '6200', 'Netflix subscription'],
  ['2025-09-30', 71, 'PUR 29/09 Netflix co Los Gatos 3825 981293', 'FOREIGN TRANSACTION FEE 29/09 Netflix 3825 981293', 1.76, '6200', 'Netflix subscription'],
  ['2025-10-13', 3703.46, 'PUR 10/10 972.88 USD THE PARTS DEKALB 3825 001677', null, 0, '5200', 'The Parts (USA) — vehicle parts, USD 972.88'],
  ['2025-10-30', 71, 'PUR 29/10 Netflix co Los Gatos 3825 137592', 'FOREIGN TRANSACTION FEE 29/10 Netflix 3825 137592', 1.76, '6200', 'Netflix subscription'],
  ['2025-12-03', 71, 'PUR 29/11 NETFLIX CO AMSTERDAM 3825 129884', 'FOREIGN TRANSACTION FEE 29/11 NETFLIX 3825 129884', 1.76, '6200', 'Netflix subscription'],
  ['2025-12-08', 4652.59, 'PUR 07/12 914.27 GBP Kem PRAHA 10 3825 839971', null, 0, '5100', 'Kem, Prague, GBP 914.27 — business travel (GM rule for company-card purchases)'],
  ['2025-12-08', 481, 'PUR 05/12 Abu Dhabi AUH 3825 497007', null, 0, '6900', 'Merchant "Abu Dhabi AUH" — not identified'],
];

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN ===\n' : '=== APPLYING ===\n');
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const codes = ['1010', '5100', '5200', '6200', '6500', '6900'];
  const accts = await prisma.glAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== codes.length) throw new Error('GL account missing — nothing changed.');
  for (const l of L) if ((await prisma.journalEntry.count({ where: { memo: { contains: l[2].slice(-6) } } })) > 0) throw new Error(`${l[2]} already in the ledger — nothing changed.`);
  let total = 0;
  for (const [d, a, n, , fee, c, w] of L) { total += a + fee; console.log(`  ${d}  ${(a + fee).toFixed(2).padStart(9)}  Dr ${c}${fee ? ` + 6500 ${fee}` : ''} / Cr 1010  ${w}`); }
  console.log(`  total ${total.toFixed(2)}`);
  if (Math.abs(total - 20844.29) > 0.005) throw new Error('Total does not agree to 20,844.29 — nothing changed.');
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }

  await prisma.$transaction(async (tx) => {
    const prefix = `JE-${new Date().getFullYear()}-`;
    const last = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
    let n = parseInt(last[0].entryNumber.slice(-4), 10);
    for (const [d, a, narr, feeNarr, fee, c, w] of L) {
      n += 1;
      await tx.journalEntry.create({
        data: {
          entryNumber: `${prefix}${String(n).padStart(4, '0')}`, date: day(d), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
          memo: `[CARD2025] ${TAG} ${narr}${feeNarr ? ` + ${feeNarr}` : ''} — ${w}. No supplier document held; booked gross.`.slice(0, 480),
          lines: { create: [
            { accountId: acct.get(c)!, debit: a, credit: 0, description: w.slice(0, 190) },
            ...(fee ? [{ accountId: acct.get('6500')!, debit: fee, credit: 0, description: 'Foreign transaction fee' }] : []),
            { accountId: acct.get('1010')!, debit: 0, credit: +(a + fee).toFixed(2), description: `Bank — card 3825 ${narr.slice(-6)}` },
          ] },
        },
      });
    }
  });
  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`  trial balance difference ${all.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
