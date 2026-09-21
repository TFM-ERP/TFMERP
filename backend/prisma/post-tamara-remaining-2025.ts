/**
 * post-tamara-remaining-2025.ts
 *
 * The rest of the 2025 Tamara payments on company card 3825, identified from the
 * Tamara app ("My Purchases", read 21 Sep 2026). The GM's rule: everything paid on
 * the company card is a business cost. Only the instalments the company card paid
 * are booked; instalments Tamara collected from another card are not company costs.
 *
 * CORRECTION to post-tamara-samsung-2025.ts: the three 154.30 payments are NOT
 * late charges on the Z Fold7. The Tamara app shows them as instalments 2, 3 and 4
 * of an AliExpress order of 28 Jul 2025 (610.78, truck lights) — the 4 Oct payment
 * of 2,657.16 is Z Fold7 instalment 4 (2,502.86) plus AliExpress instalment 4
 * (154.30). The Z Fold7 plan was 2,502.89 + 3 × 2,502.86 = 10,011.47, so Tamara's
 * fee is 104.03, not 566.93. 462.90 moves from 6500 to 5200.
 *
 * Company-card Tamara payments booked here (gross — no tax invoice held):
 *   19/02  208.36  AliExpress 19 Jan (824.79): levels, tool cabinet, rolling toolbox, trailer dirt protection  -> 5200
 *   08/04  349.63  Amazon 8 Mar (4,257.20): Siemens IQ700 built-in electric cooker                            -> 6200
 *   12/06  250.00  Gear-up.me 15 Apr (2,055): Ubiquiti G4 doorbell, chime, G4 Instant camera                    -> 6200
 *   12/06  250.00  Gear-up.me, second instalment                                                               -> 6200
 *   12/07  367.57  Amazon 12 Jun (1,455): LG 27UP850 27" 4K monitor                                            -> 6200
 *   17/09   32.43  Not identified in the Tamara app                                                            -> 6200
 *   22/10 1,381.30 Amazon 22 Oct (2,504.98): JW Speaker 8910 heated LED headlights                            -> 5200
 *   02/12 1,074.07 AliExpress 2 Dec (4,295.74): Hummer grille lights, 14.9" car radio, RV 32A cables x10       -> 5200
 *   02/12  384.29  AliExpress 2 Dec (1,521.88): DeWalt tools                                                  -> 6200
 *
 * Idempotent (tag [TAMARA2025B]). Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[TAMARA2025B]';
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const LINES: [string, number, string, string, string][] = [
  ['2025-02-20', 208.36, 'PUR 19/02 Tamara Dubai 3825 326256', '5200', 'AliExpress order 19 Jan 2025 (824.79, instalment 2 of 4): levels, tool cabinet, rolling toolbox, trailer dirt protection'],
  ['2025-04-09', 349.63, 'PUR 08/04 Tamara Dubai 3825 763623', '6200', 'Amazon order 404-5289262 of 8 Mar 2025 (4,257.20, instalment 2 of 4): Siemens IQ700 built-in electric cooker'],
  ['2025-06-13', 250.0, 'PUR 12/06 Tamara Dubai 3825 717705', '6200', 'Gear-up.me order 2000004670 of 15 Apr 2025 (2,055.00): Ubiquiti G4 Doorbell Pro, UP-Chime, G4 Instant camera'],
  ['2025-06-13', 250.0, 'PUR 12/06 Tamara Dubai 3825 718532', '6200', 'Gear-up.me order 2000004670 of 15 Apr 2025, further instalment'],
  ['2025-07-14', 367.57, 'PUR 12/07 Tamara Dubai 3825 294916', '6200', 'Amazon order 404-2971947 of 12 Jun 2025 (1,455.00, instalment 2 of 4): LG 27UP850 27" 4K monitor'],
  ['2025-09-18', 32.43, 'PUR 17/09 Tamara Dubai 3825 035953', '6200', 'Tamara payment not identified in the Tamara app'],
  ['2025-10-23', 1381.3, 'PUR 22/10 Tamara Dubai 3825 002531', '5200', 'Amazon order 404-9127535 of 22 Oct 2025 (2,504.98, instalment 1 of 4): JW Speaker 8910 heated LED headlights'],
  ['2025-12-04', 1074.07, 'PUR 02/12 Tamara Dubai 3825 369485', '5200', 'AliExpress order of 2 Dec 2025 (4,295.74, instalment 1 of 4): Hummer grille lights, 14.9" car radio, RV 32A extension cables x10, crimping ferrules'],
  ['2025-12-04', 384.29, 'PUR 02/12 Tamara Dubai 3825 387582', '6200', 'AliExpress order of 2 Dec 2025 (1,521.88, instalment 1 of 4): DeWalt power tools'],
];
const RECLASS = 462.9;

async function nextNumber(tx: Prisma.TransactionClient, issued: Set<string>): Promise<string> {
  const prefix = `JE-${new Date().getFullYear()}-`;
  const last = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
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
  const codes = ['1010', '5200', '6200', '6500'];
  const accts = await prisma.glAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== codes.length) throw new Error('GL account missing — nothing changed.');
  for (const [, , narr] of LINES) {
    if ((await prisma.journalEntry.count({ where: { memo: { contains: narr.slice(-6) } } })) > 0) throw new Error(`${narr} already in the ledger — nothing changed.`);
  }
  const lateLines = await prisma.journalLine.findMany({
    where: { account: { code: '6500' }, entry: { memo: { contains: '[TAMARA2025]' } } },
    select: { debit: true },
  });
  const charged = lateLines.reduce((t, l) => t + dec(l.debit), 0);
  if (Math.abs(charged - (566.93 + 9.45)) > 0.005) throw new Error(`6500 lines from [TAMARA2025] total ${charged}, expected 576.38 — nothing changed.`);

  for (const [d, a, n, code, what] of LINES) console.log(`  ${d}  ${a.toFixed(2).padStart(9)}  Dr ${code} / Cr 1010  ${n.slice(-6)}  ${what.slice(0, 80)}`);
  console.log(`  2025-10-06  ${RECLASS.toFixed(2)}  Dr 5200 / Cr 6500  correction: AliExpress truck lights, not Tamara late charges`);
  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const issued = new Set<string>();
    for (const [d, a, n, code, what] of LINES) {
      await tx.journalEntry.create({
        data: {
          entryNumber: await nextNumber(tx, issued), date: day(d), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
          memo: `[CARD2025] ${TAG} ${n} — Tamara instalment paid by the company card. ${what}. Business cost on the GM's rule for company-card purchases (21 Sep 2026). No tax invoice held; booked gross.`.slice(0, 480),
          lines: { create: [
            { accountId: acct.get(code)!, debit: a, credit: 0, description: what.slice(0, 190) },
            { accountId: acct.get('1010')!, debit: 0, credit: a, description: `Bank — ${n.slice(-11)}` },
          ] },
        },
      });
    }
    await tx.journalEntry.create({
      data: {
        entryNumber: await nextNumber(tx, issued), date: day('2025-10-06'), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
        memo: `${TAG} Correction to [TAMARA2025]: the three 154.30 Tamara payments (1 Sep, 28 Sep, and inside 4 Oct 2,657.16) are instalments 2-4 of AliExpress order 1114799191… of 28 Jul 2025 (610.78, truck door, cab-roof and marker lights), not Z Fold7 late charges. Z Fold7 Tamara fee is 104.03.`,
        lines: { create: [
          { accountId: acct.get('5200')!, debit: RECLASS, credit: 0, description: 'AliExpress truck lights — Tamara instalments 2-4' },
          { accountId: acct.get('6500')!, debit: 0, credit: RECLASS, description: 'Reverse: not Tamara late charges' },
        ] },
      },
    });
  });

  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`\n  trial balance difference ${all.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  const types = await prisma.glAccount.findMany({ select: { id: true, type: true } });
  const t = new Map(types.map((x) => [x.id, x.type]));
  const year = await prisma.journalLine.findMany({ where: { entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } } }, select: { accountId: true, debit: true, credit: true } });
  let r = 0;
  let e = 0;
  for (const l of year) {
    const n = dec(l.debit) - dec(l.credit);
    if (t.get(l.accountId) === 'INCOME') r -= n;
    if (t.get(l.accountId) === 'EXPENSE') e += n;
  }
  console.log(`  2025 PROFIT ${(r - e).toFixed(2)}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
