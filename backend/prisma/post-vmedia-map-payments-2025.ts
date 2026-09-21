/**
 * post-vmedia-map-payments-2025.ts
 *
 * Payments of two supplier invoices already in Accounts Payable, from the company's
 * ADCB statement (GM 21 Sep 2026: "all paid"):
 *  - V Media INV-1010-2025 (filed-2025-2026-0078), 114,450.00 — 12/11/2025
 *    "TRF TO V MEDIA PRODUCTIONS - SOLEPROPRI 66758657".
 *  - MAP DPC-25-335 (filed-2025-2026-0079), 11,025.00 — 19/11/2025 "O/W TRF 569744688".
 *    The GM was not sure whether MAP was paid from the corporate or his personal account;
 *    the company statement carries an outward transfer of exactly 11,025.00 on the invoice
 *    date, so it is posted from the company account.
 * Dr 2000 / Cr 1010 each. Idempotent (tag [VMEDIAMAP2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[VMEDIAMAP2025]';
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const PAY = [
  { exp: 'filed-2025-2026-0078', amount: 114450, date: '2025-11-12', ref: '66758657', text: 'V Media INV-1010-2025 — ADCB "TRF TO V MEDIA PRODUCTIONS - SOLEPROPRI 66758657"' },
  { exp: 'filed-2025-2026-0079', amount: 11025, date: '2025-11-19', ref: '569744688', text: 'MAP DPC-25-335 — ADCB outward transfer 569744688 (exact amount, same day as the invoice)' },
];

async function main(): Promise<void> {
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const accts = await prisma.glAccount.findMany({ where: { code: { in: ['1010', '2000'] } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== 2) throw new Error('GL account missing — nothing changed.');
  const rows = [];
  for (const p of PAY) {
    const e = await prisma.expense.findUnique({ where: { expenseNumber: p.exp } });
    if (!e || dec(e.totalAmount) !== p.amount || e.paidAt) throw new Error(`${p.exp} not as measured — nothing changed.`);
    if (await prisma.journalEntry.count({ where: { memo: { contains: p.ref } } })) throw new Error(`Transfer ${p.ref} already posted — nothing changed.`);
    const settled = await prisma.journalEntry.count({ where: { memo: { contains: p.exp }, lines: { some: { accountId: acct.get('2000')!, debit: { gt: 0 } } } } });
    if (settled) throw new Error(`${p.exp} already has a payment — nothing changed.`);
    rows.push({ p, e });
    console.log(`  ${p.date}  ${p.exp}  Dr 2000 / Cr 1010  ${p.amount.toFixed(2)}  ${p.text}`);
  }
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  await prisma.$transaction(async (tx) => {
    const prefix = `JE-${new Date().getFullYear()}-`;
    const last = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
    let n = parseInt(last[0].entryNumber.slice(-4), 10);
    for (const { p, e } of rows) {
      await tx.journalEntry.create({
        data: {
          entryNumber: `${prefix}${String(++n).padStart(4, '0')}`, date: day(p.date), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
          memo: `${TAG} Payment of ${p.exp}: ${p.text}.`,
          lines: { create: [
            { accountId: acct.get('2000')!, debit: p.amount, credit: 0, description: `${p.exp}` },
            { accountId: acct.get('1010')!, debit: 0, credit: p.amount, description: `ADCB ${p.ref}` },
          ] },
        },
      });
      await tx.expense.update({ where: { id: e.id }, data: { status: 'PAID', paidAt: day(p.date), notes: `${e.notes ?? ''}\n${TAG} Paid ${p.date} from the company ADCB account, ref ${p.ref} (GM confirmed paid, 21 Sep 2026).`.trim() } });
    }
  });
  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`  trial balance difference ${all.reduce((s, l) => s + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
