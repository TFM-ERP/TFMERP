/**
 * post-master-vision-2025.ts
 *
 * Two ADCB transfers to a saved beneficiary, no invoice yet (GM has asked for them,
 * 21 Sep 2026; GM: book them now):
 *   24/02/2025  726.00  "TRF TO MASTER VISION DOCUMENTSCLEARNG S 45870768"
 *   16/04/2025  930.00  "TRF TO MASTER VISION DOCUMENTSCLEARNG S 69960546"
 * A documents-clearing (typing / government services) office. Purpose not yet known, so
 * category "Miscellaneous General Exp" (6900) until the receipts arrive; no VAT claimed.
 * Supplier created; each: expense Dr 6900 / Cr 2000, payment Dr 2000 / Cr 1010.
 * Idempotent (tag [MASTERVISION2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[MASTERVISION2025]';
const NAME = 'Master Vision Documents Clearing Services';
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const T: [string, number, string][] = [['2025-02-24', 726, '45870768'], ['2025-04-16', 930, '69960546']];

async function main(): Promise<void> {
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const accts = await prisma.glAccount.findMany({ where: { code: { in: ['1010', '2000', '6900'] } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== 3) throw new Error('GL account missing — nothing changed.');
  for (const [, , r] of T) if (await prisma.journalEntry.count({ where: { memo: { contains: r } } })) throw new Error(`Transfer ${r} already posted — nothing changed.`);
  if (await prisma.supplier.count({ where: { name: NAME } })) throw new Error('Supplier exists — nothing changed.');
  const ref = await prisma.expense.findUnique({ where: { expenseNumber: 'EXP-2025-0001' }, select: { createdById: true } });
  const last = await prisma.expense.findMany({ where: { expenseNumber: { startsWith: 'EXP-2025-' } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 });
  let k = parseInt(last[0].expenseNumber.slice(-4), 10);
  const nos = T.map(() => `EXP-2025-${String(++k).padStart(4, '0')}`);
  T.forEach(([d, a, r], i) => console.log(`  ${nos[i]}  ${d}  ${NAME}  ${a.toFixed(2)}  Dr 6900 / Cr 2000; paid same day transfer ${r} Dr 2000 / Cr 1010`));
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  await prisma.$transaction(async (tx) => {
    const s = await tx.supplier.create({ data: { name: NAME, tradeName: 'Master Vision', categories: ['General Supplier'], category: 'General Supplier', notes: `${TAG} Documents-clearing office. ADCB prints it as "MASTER VISION DOCUMENTSCLEARNG S" (saved beneficiary in the ADCB app). Receipts requested by the GM 21 Sep 2026.` } });
    const p = `JE-${new Date().getFullYear()}-`;
    const l = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: p } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
    let n = parseInt(l[0].entryNumber.slice(-4), 10);
    for (let i = 0; i < T.length; i++) {
      const [d, a, r] = T[i];
      const e = await tx.expense.create({ data: {
        expenseNumber: nos[i], category: 'Miscellaneous General Exp', description: 'Master Vision Documents Clearing — documents clearing / government services (purpose to confirm)',
        amount: a, vatAmount: 0, totalAmount: a, expenseDate: day(d), status: 'PAID', paidAt: day(d), approvedAt: new Date(), vendorName: NAME, supplierId: s.id,
        sourceRef: `${TAG}:${r}`, createdById: ref!.createdById,
        notes: `${TAG} Paid ${d} from the company ADCB account 13328662820001: "TRF TO MASTER VISION DOCUMENTSCLEARNG S ${r}". No receipt yet — requested by the GM 21 Sep 2026; reclassify once it arrives.`,
      } });
      await tx.journalEntry.create({ data: { entryNumber: `${p}${String(++n).padStart(4, '0')}`, date: day(d), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(), sourceType: 'EXPENSE', sourceId: e.id,
        memo: `Expense ${nos[i]} ${TAG} Master Vision Documents Clearing`, lines: { create: [{ accountId: acct.get('6900')!, debit: a, credit: 0, description: 'Documents clearing — Master Vision' }, { accountId: acct.get('2000')!, debit: 0, credit: a, description: 'Accounts Payable — Master Vision' }] } } });
      await tx.journalEntry.create({ data: { entryNumber: `${p}${String(++n).padStart(4, '0')}`, date: day(d), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
        memo: `${TAG} Payment of ${nos[i]} — ADCB "TRF TO MASTER VISION DOCUMENTSCLEARNG S ${r}".`, lines: { create: [{ accountId: acct.get('2000')!, debit: a, credit: 0, description: `Master Vision — ${nos[i]}` }, { accountId: acct.get('1010')!, debit: 0, credit: a, description: `ADCB TRF ${r}` }] } } });
    }
  });
  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`  trial balance difference ${all.reduce((s, x) => s + dec(x.debit) - dec(x.credit), 0).toFixed(2)}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
