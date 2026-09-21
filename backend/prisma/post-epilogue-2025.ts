/**
 * post-epilogue-2025.ts
 *
 * Epilogue Media LLC (Kane Rodrigues, location sound recordist; Shams Business Center,
 * Sharjah Media City Free Zone; not VAT-registered — no TRN, no VAT on its invoices).
 * Invoices supplied by the GM 21 Sep 2026, both for NBA The Athletics:
 *  - INV-2025-00683, 08/07/2025: sound recording 7–8 Jul, 5,000.00 less 10% = 4,500.00.
 *    Paid 22/07/2025, ADCB transfer 513119810 (ProCash remark "INVOICE 202500683").
 *  - INV-2025-00695, 03/10/2025: sound recording 30 Sep–3 Oct 10,000.00 + gas and parking
 *    221.00 (ADNOC 195.94, Sheikh Fatima Park 10.00, Mawaqif 15.00) = 10,221.00.
 *    Paid 29/11/2025, ADCB transfer 575281527 (remark "AUDIO RENTAL").
 * The two e-mail placeholder rows (gmail-2025-2026-0032 / -0050, 0.00, PENDING_APPROVAL,
 * supplier "Kane Rodrigues") ARE these invoices: they are completed in place — amount,
 * supplier, status PAID — and posted: Dr 5300 Freelance & Crew Costs / Cr 2000, then
 * Dr 2000 / Cr 1010 on the payment date. The unused "Epilogue" supplier record becomes
 * Epilogue Media LLC; the "Kane Rodrigues" record's documents move to it and it is set
 * INACTIVE (Kane is Epilogue's contact).
 * Idempotent (tag [EPILOGUE2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[EPILOGUE2025]';
const ROOT = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const UPLOADS = join(__dirname, '..', 'uploads');
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const ROWS = [
  { exp: 'gmail-2025-2026-0032', inv: 'INV-2025-00683', date: '2025-07-08', paid: '2025-07-22', ref: '513119810', amount: 4500,
    desc: 'Epilogue Media — location sound recording with standard kit, NBA The Athletics, 7–8 Jul 2025 (2 days × 2,500 less 10%)',
    files: [['Epilogue-INV-2025-00683-2025-07-08-SoundRecording-4500.pdf', 'SOURCE', 'INVOICE INV-2025-00683 — Epilogue Media LLC, 4,500.00']] as [string, 'SOURCE' | 'SUPPORTING', string][] },
  { exp: 'gmail-2025-2026-0050', inv: 'INV-2025-00695', date: '2025-10-03', paid: '2025-11-29', ref: '575281527', amount: 10221,
    desc: 'Epilogue Media — location sound recording with standard kit, NBA The Athletics, 30 Sep–3 Oct 2025 (4 days × 2,500) + gas and parking 221.00',
    files: [
      ['Epilogue-INV-2025-00695-2025-10-03-SoundRecording-10221.pdf', 'SOURCE', 'INVOICE INV-2025-00695 — Epilogue Media LLC, 10,221.00'],
      ['Epilogue-INV-2025-00695-receipt-ADNOC-fuel-195.94.pdf', 'SUPPORTING', 'ADNOC fuel receipt 04/10/2025, 195.94 (re-billed on INV-2025-00695)'],
      ['Epilogue-INV-2025-00695-receipt-SheikhFatimaPark-parking-10.pdf', 'SUPPORTING', 'Sheikh Fatima Park parking 03/10/2025, 10.00 (re-billed on INV-2025-00695)'],
      ['Epilogue-INV-2025-00695-receipt-Mawaqif-parking-15.pdf', 'SUPPORTING', 'Mawaqif parking 03/10/2025, 15.00 (re-billed on INV-2025-00695)'],
    ] as [string, 'SOURCE' | 'SUPPORTING', string][] },
];

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const accts = await prisma.glAccount.findMany({ where: { code: { in: ['1010', '2000', '5300'] } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== 3) throw new Error('GL account missing — nothing changed.');
  const ep = await prisma.supplier.findFirst({ where: { name: 'Epilogue' }, include: { _count: { select: { expenses: true } } } });
  const kane = await prisma.supplier.findFirst({ where: { name: 'Kane Rodrigues' } });
  if (!ep || ep._count.expenses !== 0 || !kane) throw new Error('Epilogue / Kane Rodrigues suppliers not as measured — nothing changed.');
  const exps = [];
  for (const r of ROWS) {
    const e = await prisma.expense.findUnique({ where: { expenseNumber: r.exp } });
    if (!e || dec(e.totalAmount) !== 0 || e.invoiceNumber !== r.inv || e.supplierId !== kane.id) throw new Error(`${r.exp} not as measured — nothing changed.`);
    if (await prisma.journalEntry.count({ where: { OR: [{ sourceId: e.id }, { memo: { contains: r.ref } }] } })) throw new Error(`${r.exp} or transfer ${r.ref} already posted — nothing changed.`);
    for (const [f] of r.files) if (!existsSync(join(ROOT, f))) throw new Error(`Missing ${f} — nothing changed.`);
    exps.push(e);
    console.log(`  ${r.exp}  ${r.inv}  ${r.date}  ${r.amount.toFixed(2)}  Dr 5300 / Cr 2000; paid ${r.paid} transfer ${r.ref} Dr 2000 / Cr 1010; ${r.files.length} file(s)`);
  }
  console.log('  supplier "Epilogue" -> Epilogue Media LLC (details from the invoices); Kane Rodrigues docs moved, record INACTIVE');
  if (DRY) { console.log('\n=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }

  await prisma.$transaction(async (tx) => {
    await tx.supplier.update({ where: { id: ep.id }, data: {
      name: 'Epilogue Media LLC', tradeName: 'Epilogue Media', contactName: 'Kane Rodrigues (location sound recordist)', address: 'Shams Business Center, Sharjah Media City Free Zone', city: 'Sharjah',
      phone: '+971 50 205 9123', email: 'kane.rodrigues91@gmail.com', bankName: 'WIO Bank', iban: 'AE640860000009220737632', swiftCode: 'WIOBAEADXXX',
      categories: ['Freelancer / Vendor'], category: 'Freelancer / Vendor',
      notes: `${ep.notes ?? ''}\n${TAG} Epilogue Media LLC — Kane Rodrigues's company (sound recording). Not VAT-registered: no TRN and no VAT on its invoices. Details from INV-2025-00683 / 00695. Earlier this record was wrongly used for the Samsung monitor (corrected).`.trim(),
    } });
    await tx.supplierDocument.updateMany({ where: { supplierId: kane.id }, data: { supplierId: ep.id } });
    await tx.supplier.update({ where: { id: kane.id }, data: { status: 'INACTIVE', isActive: false, notes: `${kane.notes ?? ''}\n${TAG} Merged into Epilogue Media LLC (his company) — invoices and documents are there.`.trim() } });
    const prefix = `JE-${new Date().getFullYear()}-`;
    const last = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
    let n = parseInt(last[0].entryNumber.slice(-4), 10);
    for (let i = 0; i < ROWS.length; i++) {
      const r = ROWS[i]; const e = exps[i];
      await tx.expense.update({ where: { id: e.id }, data: {
        category: 'Freelancers', description: r.desc, amount: r.amount, vatAmount: 0, totalAmount: r.amount, expenseDate: day(r.date), invoiceDate: day(r.date),
        status: 'PAID', paidAt: day(r.paid), approvedAt: new Date(), vendorName: 'Epilogue Media LLC', supplierId: ep.id,
        notes: `${e.notes ?? ''}\n${TAG} Invoice supplied by the GM 21 Sep 2026: ${r.inv}, ${r.amount.toFixed(2)}, no VAT (supplier not VAT-registered). Paid ${r.paid} from the company ADCB account, transfer ${r.ref}.`.trim(),
      } });
      await tx.journalEntry.create({ data: { entryNumber: `${prefix}${String(++n).padStart(4, '0')}`, date: day(r.date), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(), sourceType: 'EXPENSE', sourceId: e.id,
        memo: `Expense ${r.exp} ${TAG} Epilogue Media LLC ${r.inv} — sound recording, NBA The Athletics`,
        lines: { create: [{ accountId: acct.get('5300')!, debit: r.amount, credit: 0, description: r.desc.slice(0, 190) }, { accountId: acct.get('2000')!, debit: 0, credit: r.amount, description: 'Accounts Payable — Epilogue Media LLC' }] } } });
      await tx.journalEntry.create({ data: { entryNumber: `${prefix}${String(++n).padStart(4, '0')}`, date: day(r.paid), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
        memo: `${TAG} Payment of ${r.exp} (Epilogue Media LLC ${r.inv}) — ADCB outward transfer ${r.ref}.`,
        lines: { create: [{ accountId: acct.get('2000')!, debit: r.amount, credit: 0, description: `Epilogue Media — ${r.inv}` }, { accountId: acct.get('1010')!, debit: 0, credit: r.amount, description: `ADCB O/W TRF ${r.ref}` }] } } });
      for (const [f, kind, name] of r.files) {
        const up = `supplier-2025-${f.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`;
        if (!existsSync(join(UPLOADS, up))) copyFileSync(join(ROOT, f), join(UPLOADS, up));
        await tx.documentAttachment.create({ data: { entityType: 'EXPENSE', entityId: e.id, kind, name, provider: 'UPLOAD', url: `/uploads/${up}`, mimeType: 'application/pdf', sizeBytes: statSync(join(UPLOADS, up)).size, sourceRef: `file:${f}`, notes: `Supplied by the GM 21 Sep 2026. Original: ${join(ROOT, f)} ${TAG}` } });
        await tx.supplierDocument.create({ data: { supplierId: ep.id, docType: kind === 'SOURCE' ? 'INVOICE' : 'OTHER', name, fileUrl: `/uploads/${up}`, notes: `${r.exp} — ${kind === 'SOURCE' ? 'the invoice' : 'receipt re-billed on the invoice'}. ${TAG}` } });
      }
    }
  });
  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`  trial balance difference ${all.reduce((s, l) => s + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
