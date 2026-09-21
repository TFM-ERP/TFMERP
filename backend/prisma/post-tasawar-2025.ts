/**
 * post-tasawar-2025.ts
 *
 * ADCB 17/02/2025 "TRF TO TASAWER NV CRG TR BY HVY TRCO LL 43370350", 790.85.
 * GM, 21 Sep 2026: freelance payment to Tasawar Naveed Mubarik Ali — beneficiary details
 * from his banking app: Al Hilal Bank, IBAN AE080530000022186090001 (screenshot kept).
 * No invoice, no VAT. Supplier created; expense EXP-2025-NNNN category Freelancers
 * (5300): Dr 5300 / Cr 2000, paid Dr 2000 / Cr 1010 the same day.
 * Idempotent (tag [TASAWAR2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[TASAWAR2025]';
const ROOT = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const FILE = 'Tasawar-Naveed-beneficiary-AlHilal-2025-02-17-790.85.jpg';
const UPLOADS = join(__dirname, '..', 'uploads');
const REF = '43370350';
const AMT = 790.85;
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

async function main(): Promise<void> {
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const accts = await prisma.glAccount.findMany({ where: { code: { in: ['1010', '2000', '5300'] } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== 3) throw new Error('GL account missing — nothing changed.');
  if (!existsSync(join(ROOT, FILE))) throw new Error(`Missing ${FILE} — nothing changed.`);
  if (await prisma.journalEntry.count({ where: { memo: { contains: REF } } })) throw new Error('Transfer already posted — nothing changed.');
  if (await prisma.supplier.count({ where: { name: 'Tasawar Naveed Mubarik Ali' } })) throw new Error('Supplier exists — nothing changed.');
  const ref = await prisma.expense.findUnique({ where: { expenseNumber: 'EXP-2025-0001' }, select: { createdById: true } });
  const last = await prisma.expense.findMany({ where: { expenseNumber: { startsWith: 'EXP-2025-' } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 });
  const no = `EXP-2025-${String(parseInt(last[0].expenseNumber.slice(-4), 10) + 1).padStart(4, '0')}`;
  console.log(`  ${no}  2025-02-17  Tasawar Naveed Mubarik Ali  freelance  ${AMT}  Dr 5300 / Cr 2000; paid same day transfer ${REF} Dr 2000 / Cr 1010`);
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  const up = `supplier-2025-${FILE.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`;
  if (!existsSync(join(UPLOADS, up))) copyFileSync(join(ROOT, FILE), join(UPLOADS, up));
  await prisma.$transaction(async (tx) => {
    const s = await tx.supplier.create({ data: { name: 'Tasawar Naveed Mubarik Ali', categories: ['Freelancer / Vendor'], category: 'Freelancer / Vendor', bankName: 'Al Hilal Bank', iban: 'AE080530000022186090001', notes: `${TAG} Freelancer. ADCB prints him as "TASAWER NV CRG TR BY HVY TRCO LL". Bank details from the GM's banking app, 21 Sep 2026.` } });
    const e = await tx.expense.create({ data: {
      expenseNumber: no, category: 'Freelancers', description: 'Freelance payment — Tasawar Naveed Mubarik Ali', amount: AMT, vatAmount: 0, totalAmount: AMT,
      expenseDate: day('2025-02-17'), status: 'PAID', paidAt: day('2025-02-17'), approvedAt: new Date(), vendorName: 'Tasawar Naveed Mubarik Ali', supplierId: s.id,
      sourceRef: `${TAG}:${REF}`, createdById: ref!.createdById,
      notes: `${TAG} Paid 17/02/2025 from the company ADCB account, transfer ${REF}, to Al Hilal Bank IBAN AE080530000022186090001. No invoice — GM confirmed a freelance payment (21 Sep 2026).`,
    } });
    const p = `JE-${new Date().getFullYear()}-`;
    const l = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: p } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
    let n = parseInt(l[0].entryNumber.slice(-4), 10);
    await tx.journalEntry.create({ data: { entryNumber: `${p}${String(++n).padStart(4, '0')}`, date: day('2025-02-17'), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(), sourceType: 'EXPENSE', sourceId: e.id,
      memo: `Expense ${no} ${TAG} Freelance payment — Tasawar Naveed Mubarik Ali`, lines: { create: [{ accountId: acct.get('5300')!, debit: AMT, credit: 0, description: 'Freelance — Tasawar Naveed Mubarik Ali' }, { accountId: acct.get('2000')!, debit: 0, credit: AMT, description: 'Accounts Payable — Tasawar Naveed Mubarik Ali' }] } } });
    await tx.journalEntry.create({ data: { entryNumber: `${p}${String(++n).padStart(4, '0')}`, date: day('2025-02-17'), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
      memo: `${TAG} Payment of ${no} — ADCB "TRF TO TASAWER NV CRG TR BY HVY TRCO LL ${REF}".`, lines: { create: [{ accountId: acct.get('2000')!, debit: AMT, credit: 0, description: `Tasawar Naveed — ${no}` }, { accountId: acct.get('1010')!, debit: 0, credit: AMT, description: `ADCB TRF ${REF}` }] } } });
    await tx.documentAttachment.create({ data: { entityType: 'EXPENSE', entityId: e.id, kind: 'SUPPORTING', name: 'Beneficiary details — Tasawar Naveed Mubarik Ali, Al Hilal Bank', provider: 'UPLOAD', url: `/uploads/${up}`, mimeType: 'image/jpeg', sizeBytes: statSync(join(UPLOADS, up)).size, sourceRef: `file:${FILE}`, notes: `GM's banking app screenshot, 21 Sep 2026. ${TAG}` } });
    await tx.supplierDocument.create({ data: { supplierId: s.id, docType: 'BANK_DETAILS', name: 'Beneficiary details — Al Hilal Bank IBAN AE080530000022186090001', fileUrl: `/uploads/${up}`, notes: `${no}. ${TAG}` } });
  });
  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`  trial balance difference ${all.reduce((s, x) => s + dec(x.debit) - dec(x.credit), 0).toFixed(2)}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
