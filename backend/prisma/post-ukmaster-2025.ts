/**
 * post-ukmaster-2025.ts
 *
 * Intelligence Trading LLC (UK Master), Dragon Mart 1, Dubai, TRN 100517462600003 —
 * tax invoice No. 02910, 22/12/2025: BMW X6 2013, oil (and service items), 1,571.43 + VAT
 * 78.57 = 1,650.00. GM, 21 Sep 2026: company car, paid in cash. Not in the bank.
 * Supplier created; expense EXP-2025-NNNN category Maintenance: Dr 5200 + Dr 1200 / Cr 2000,
 * paid Dr 2000 / Cr 1000 Cash on Hand. Invoice photo attached.
 * Note for the adviser: the customer TRN is handwritten as "600664500003" (the company's
 * TRN is 100600664500003) and the customer name is blank — the VAT claim may be challenged.
 * Idempotent (tag [UKMASTER2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[UKMASTER2025]';
const ROOT = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const FILE = 'IntelligenceTrading-UKMaster-02910-2025-12-22-BMWX6-1650-CASH.jpg';
const UPLOADS = join(__dirname, '..', 'uploads');
const NET = 1571.43; const VAT = 78.57; const TOT = 1650;
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

async function main(): Promise<void> {
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const accts = await prisma.glAccount.findMany({ where: { code: { in: ['1000', '1200', '2000', '5200'] } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== 4) throw new Error('GL account missing — nothing changed.');
  if (!existsSync(join(ROOT, FILE))) throw new Error(`Missing ${FILE} — nothing changed.`);
  if (await prisma.supplier.count({ where: { OR: [{ trn: '100517462600003' }, { name: 'Intelligence Trading LLC' }] } })) throw new Error('Supplier exists — nothing changed.');
  if (await prisma.expense.count({ where: { supplierVatId: '100517462600003' } })) throw new Error('Invoice already booked — nothing changed.');
  const ref = await prisma.expense.findUnique({ where: { expenseNumber: 'EXP-2025-0001' }, select: { createdById: true } });
  const last = await prisma.expense.findMany({ where: { expenseNumber: { startsWith: 'EXP-2025-' } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 });
  const no = `EXP-2025-${String(parseInt(last[0].expenseNumber.slice(-4), 10) + 1).padStart(4, '0')}`;
  console.log(`  ${no}  2025-12-22  Intelligence Trading LLC (UK Master) 02910  ${NET} + ${VAT} = ${TOT}  Dr 5200/1200 Cr 2000; paid cash Dr 2000 / Cr 1000`);
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  const up = `supplier-2025-${FILE.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`;
  if (!existsSync(join(UPLOADS, up))) copyFileSync(join(ROOT, FILE), join(UPLOADS, up));
  await prisma.$transaction(async (tx) => {
    const s = await tx.supplier.create({ data: { name: 'Intelligence Trading LLC', tradeName: 'UK Master', trn: '100517462600003', address: 'Shop AAF 01-02, AA Section, Dragon Mart 1', city: 'Dubai', phone: '+971 52 263 1013', email: 'uttam_biswas16@yahoo.com', website: 'ukmaster.ae', categories: ['Spare Parts Supplier'], category: 'Spare Parts Supplier', notes: `${TAG} Details from tax invoice 02910 (21 Sep 2026).` } });
    const e = await tx.expense.create({ data: {
      expenseNumber: no, category: 'Maintenance', description: 'BMW X6 2013 (company car) — oil and service items, UK Master', amount: NET, vatAmount: VAT, totalAmount: TOT,
      expenseDate: day('2025-12-22'), status: 'PAID', paidAt: day('2025-12-22'), approvedAt: new Date(), vendorName: 'Intelligence Trading LLC (UK Master)', supplierId: s.id,
      supplierVatId: '100517462600003', invoiceNumber: '02910', invoiceDate: day('2025-12-22'), sourceRef: `${TAG}:02910`, createdById: ref!.createdById,
      notes: `${TAG} Tax invoice 02910, supplied by the GM 21 Sep 2026. Company car, paid in cash (GM). Customer TRN handwritten as "600664500003" (company TRN 100600664500003), customer name blank — input VAT 78.57 may be challenged; not in the Q4 return as filed.`,
    } });
    const p = `JE-${new Date().getFullYear()}-`;
    const l = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: p } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
    let n = parseInt(l[0].entryNumber.slice(-4), 10);
    await tx.journalEntry.create({ data: { entryNumber: `${p}${String(++n).padStart(4, '0')}`, date: day('2025-12-22'), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(), sourceType: 'EXPENSE', sourceId: e.id,
      memo: `Expense ${no} ${TAG} Intelligence Trading LLC (UK Master) tax invoice 02910 — BMW X6 oil/service`, lines: { create: [
        { accountId: acct.get('5200')!, debit: NET, credit: 0, description: 'BMW X6 — oil/service' },
        { accountId: acct.get('1200')!, debit: VAT, credit: 0, description: 'Input VAT — UK Master 02910' },
        { accountId: acct.get('2000')!, debit: 0, credit: TOT, description: 'Accounts Payable — Intelligence Trading LLC' }] } } });
    await tx.journalEntry.create({ data: { entryNumber: `${p}${String(++n).padStart(4, '0')}`, date: day('2025-12-22'), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
      memo: `${TAG} ${no} UK Master 02910 paid in cash (GM).`, lines: { create: [
        { accountId: acct.get('2000')!, debit: TOT, credit: 0, description: `Intelligence Trading — ${no}` },
        { accountId: acct.get('1000')!, debit: 0, credit: TOT, description: 'Cash on Hand' }] } } });
    await tx.documentAttachment.create({ data: { entityType: 'EXPENSE', entityId: e.id, kind: 'SOURCE', name: 'TAX INVOICE 02910 — Intelligence Trading LLC (UK Master), 1,650.00', provider: 'UPLOAD', url: `/uploads/${up}`, mimeType: 'image/jpeg', sizeBytes: statSync(join(UPLOADS, up)).size, sourceRef: `file:${FILE}`, notes: `Photo supplied by the GM 21 Sep 2026. ${TAG}` } });
    await tx.supplierDocument.create({ data: { supplierId: s.id, docType: 'INVOICE', name: 'TAX INVOICE 02910 — Intelligence Trading LLC (UK Master), 1,650.00', fileUrl: `/uploads/${up}`, notes: `${no} — the invoice. ${TAG}` } });
  });
  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`  trial balance difference ${all.reduce((s, x) => s + dec(x.debit) - dec(x.credit), 0).toFixed(2)}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
