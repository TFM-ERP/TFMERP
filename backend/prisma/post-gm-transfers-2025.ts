/**
 * post-gm-transfers-2025.ts
 *
 * The 24 outward transfers of 2025 to QAIS MOHMD ISSA QANDIL (the GM) that are not his
 * salary — 160,018.00 — named on the ADCB ProCash "PAYMENT CREDITED BENEFICIARY" e-mails.
 * GM's decision, 21 Sep 2026:
 *  - the three with a remark are his running costs, paid to him as an allowance:
 *      14/07 FUEL 4,000.00 and 26/07 TRANSPORTATION 2,500.00 -> 5100 Fuel & Transport;
 *      18/10 PHONE ALLOWANCE 3,000.00 -> 6200 Office & Admin.  No VAT (no tax invoices).
 *  - the other 21 (150,518.00) repay what the company owes him: Dr 2400 Owner Account.
 * Each posted on its own date against 1010 Bank, with the ADCB reference in the memo.
 * Idempotent (tag [GMTRF2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[GMTRF2025]';
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

// [date, amount, ADCB reference, remark on the e-mail]
const T: [string, number, string, string][] = [
  ['2025-01-03', 4100, '424120334', ''], ['2025-01-04', 4600, '424704265', ''], ['2025-01-10', 10000, '427192267', ''],
  ['2025-02-04', 1500, '437929792', ''], ['2025-02-11', 4500, '440885174', ''], ['2025-02-14', 5100, '442212155', ''],
  ['2025-02-18', 1500, '443695077', ''], ['2025-02-22', 500, '445108390', ''], ['2025-04-08', 3000, '466557357', ''],
  ['2025-05-07', 12920, '479833244', ''], ['2025-05-07', 19300, '480039758', ''], ['2025-05-13', 11000, '482582280', ''],
  ['2025-06-04', 6198, '493116179', ''], ['2025-07-09', 20000, '508237831', ''], ['2025-07-10', 1200, '508722626', ''],
  ['2025-07-14', 4000, '510185110', 'FUEL'], ['2025-07-19', 22000, '512074034', ''], ['2025-07-21', 3500, '512850280', ''],
  ['2025-07-23', 10000, '513600480', ''], ['2025-07-26', 2500, '515161766', 'TRANSPORTATION'], ['2025-08-01', 1000, '518220133', ''],
  ['2025-08-30', 3600, '530921500', ''], ['2025-10-13', 5000, '551904592', ''], ['2025-10-18', 3000, '553923453', 'PHONE ALLOWANCE'],
];
const ALLOW: Record<string, [string, string]> = { FUEL: ['5100', 'GM fuel allowance'], TRANSPORTATION: ['5100', 'GM transport allowance'], 'PHONE ALLOWANCE': ['6200', 'GM phone allowance'] };

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const total = T.reduce((s, t) => s + t[1], 0);
  if (Math.abs(total - 160018) > 0.005 || T.length !== 24) throw new Error(`List is ${T.length} rows / ${total} — expected 24 / 160,018.00. Nothing changed.`);
  const codes = ['1010', '2400', '5100', '6200'];
  const accts = await prisma.glAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== codes.length) throw new Error('GL account missing — nothing changed.');
  for (const t of T) if (await prisma.journalEntry.count({ where: { memo: { contains: t[2] } } })) throw new Error(`Transfer ${t[2]} already posted — nothing changed.`);
  let rep = 0; let allow = 0;
  for (const [d, a, r, rem] of T) {
    const [code, what] = ALLOW[rem] ?? ['2400', 'repayment of Owner Account'];
    if (code === '2400') rep += a; else allow += a;
    console.log(`  ${d}  ${a.toFixed(2).padStart(10)}  ${r}  Dr ${code} / Cr 1010  ${what}${rem ? ` ("${rem}")` : ''}`);
  }
  console.log(`\n  repayments ${rep.toFixed(2)} · allowances ${allow.toFixed(2)} · total ${total.toFixed(2)}`);
  if (DRY) { console.log('\n=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  await prisma.$transaction(async (tx) => {
    const prefix = `JE-${new Date().getFullYear()}-`;
    const last = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
    let n = parseInt(last[0].entryNumber.slice(-4), 10);
    for (const [d, a, r, rem] of T) {
      const [code, what] = ALLOW[rem] ?? ['2400', 'Repayment of Owner Account (Loan)'];
      await tx.journalEntry.create({ data: {
        entryNumber: `${prefix}${String(++n).padStart(4, '0')}`, date: day(d), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
        memo: `${TAG} ADCB transfer ${r} to QAIS MOHMD ISSA QANDIL (GM)${rem ? `, remark "${rem}"` : ''} — ${code === '2400' ? 'repays what the company owes him' : what + ', no receipts'} (GM decision 21 Sep 2026).`,
        lines: { create: [
          { accountId: acct.get(code)!, debit: a, credit: 0, description: `${what} — ADCB ${r}` },
          { accountId: acct.get('1010')!, debit: 0, credit: a, description: `ADCB O/W TRF ${r}` },
        ] },
      } });
    }
  });
  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`  trial balance difference ${all.reduce((s, l) => s + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
