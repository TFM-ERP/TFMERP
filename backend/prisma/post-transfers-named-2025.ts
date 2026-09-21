/**
 * post-transfers-named-2025.ts
 *
 * Outgoing ADCB transfers whose beneficiary is named in the ProCash "PAYMENT CREDITED
 * BENEFICIARY" e-mails, now documented or explained by the GM (21 Sep 2026):
 *  - Transformer General Trading INV-009116, 26/07/2025, 2014 Toyota Tundra ARB dual
 *    compressor fitted: 2,284.76 + 114.24 = 2,399.00. Paid 28/07 transfer 515612741.
 *  - AVEC Events INV-001374, 08/07/2025, catering for The Athletic shoot 7–8 Jul:
 *    4,130.00 + 206.50 = 4,336.50. Paid 30/09 transfer 545090663 (ProCash screenshot kept).
 *  - Freelancers (GM: freelance payments, no invoices): ali Mohammed 2,236.00 (14/07)
 *    and 2,000.00 (13/12), Ramzia A S Almadi 800.00 (29/07), Kadem Almsikh
 *    1,000.00 (07/04). Category "Freelancers" -> 5300 Freelance & Crew Costs. No VAT.
 * Each: supplier created, expense Dr cost (+1200) / Cr 2000, payment Dr 2000 / Cr 1010,
 * documents attached to the expense and the supplier.
 * Also: EXP-2025-0001 and filed-0082 (artist-trailer rentals, posted to 5000) had
 * category "Crew", which now maps to 5300 — set to "Production Costs" (5000) so a
 * re-post cannot move them.
 * Idempotent (tag [NAMEDTRF2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[NAMEDTRF2025]';
const ROOT = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const UPLOADS = join(__dirname, '..', 'uploads');
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

interface Sup { key: string; name: string; data: Record<string, unknown> }
const SUPS: Sup[] = [
  { key: 'tgt', name: 'Transformer General Trading', data: { trn: '100460263500003', address: 'P.O. Box 26682', city: 'Abu Dhabi', email: 'transformercar.uae@gmail.com', categories: ['Spare Parts Supplier'], category: 'Spare Parts Supplier' } },
  { key: 'avec', name: 'AVEC EVENTS', data: { trn: '100604796100003', address: 'Al Qusais Second', city: 'Dubai', phone: '+971 55 333 0115 / 04 835 9953', bankName: 'RAKBANK', bankAccount: '8333271126901', iban: 'AE840400008333271126901', categories: ['Catering'], category: 'Catering' } },
  { key: 'ali', name: 'ali Mohammed', data: { categories: ['Freelancer / Vendor'], category: 'Freelancer / Vendor', notes: 'Freelancer — paid by ADCB transfer (ProCash e-mails).' } },
  { key: 'ramzia', name: 'Ramzia A S Almadi', data: { categories: ['Freelancer / Vendor'], category: 'Freelancer / Vendor', notes: 'Freelancer — paid by ADCB transfer (ProCash e-mail).' } },
  { key: 'kadem', name: 'Kadem Almsikh', data: { categories: ['Freelancer / Vendor'], category: 'Freelancer / Vendor', notes: 'Freelancer — paid by ADCB transfer (ProCash e-mail).' } },
];
interface Item { sup: string; date: string; paid: string; ref: string; net: number; vat: number; acct: string; category: string; desc: string; inv: string | null; vatId?: string; files: [string, 'SOURCE' | 'SUPPORTING', string][] }
const ITEMS: Item[] = [
  { sup: 'tgt', date: '2025-07-26', paid: '2025-07-28', ref: '515612741', net: 2284.76, vat: 114.24, acct: '5200', category: 'Maintenance', desc: '2014 Toyota Tundra — ARB dual on-board compressor, tyre inflation kit, blow gun, bracket fabrication and installation, 16mm battery cable, fuse holder', inv: 'INV-009116', vatId: '100460263500003', files: [['TransformerGT-INV-009116-2025-07-26-Tundra-ARB-2399.pdf', 'SOURCE', 'TAX INVOICE INV-009116 — Transformer General Trading, 2,399.00']] },
  { sup: 'avec', date: '2025-07-08', paid: '2025-09-30', ref: '545090663', net: 4130, vat: 206.5, acct: '5000', category: 'Production Costs', desc: 'Catering for The Athletic shoot 7–8 Jul 2025 — 33 boxed meals (19 + 14 pax) and 2 days service charge, Abu Dhabi location', inv: 'INV-001374', vatId: '100604796100003', files: [['AVEC-INV-001374-2025-07-08-Catering-TheAthletic-4336.50.pdf', 'SOURCE', 'TAX INVOICE INV-001374 — AVEC Events, 4,336.50'], ['AVEC-ProCash-545090663-2025-09-30-payment-4336.50.jpg', 'SUPPORTING', 'ADCB ProCash payment 545090663 — 4,336.50 to AVEC Events, 30 Sep 2025']] },
  { sup: 'kadem', date: '2025-04-07', paid: '2025-04-07', ref: '465718721', net: 1000, vat: 0, acct: '5300', category: 'Freelancers', desc: 'Freelance payment — Kadem Almsikh', inv: null, files: [] },
  { sup: 'ali', date: '2025-07-14', paid: '2025-07-14', ref: '509941946', net: 2236, vat: 0, acct: '5300', category: 'Freelancers', desc: 'Freelance payment — ali Mohammed', inv: null, files: [] },
  { sup: 'ramzia', date: '2025-07-29', paid: '2025-07-29', ref: '516403361', net: 800, vat: 0, acct: '5300', category: 'Freelancers', desc: 'Freelance payment — Ramzia A S Almadi', inv: null, files: [] },
  { sup: 'ali', date: '2025-12-13', paid: '2025-12-13', ref: '582138253', net: 2000, vat: 0, acct: '5300', category: 'Freelancers', desc: 'Freelance payment — ali Mohammed', inv: null, files: [] },
];

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const codes = ['1010', '1200', '2000', '5000', '5200', '5300'];
  const accts = await prisma.glAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== codes.length) throw new Error('GL account missing — nothing changed.');
  for (const it of ITEMS) {
    for (const [f] of it.files) if (!existsSync(join(ROOT, f))) throw new Error(`Missing ${f} — nothing changed.`);
    if (await prisma.journalEntry.count({ where: { memo: { contains: it.ref } } })) throw new Error(`Transfer ${it.ref} already posted — nothing changed.`);
    if (it.inv && (await prisma.expense.count({ where: { invoiceNumber: it.inv } }))) throw new Error(`${it.inv} already booked — nothing changed.`);
  }
  for (const s of SUPS) if (await prisma.supplier.count({ where: { name: s.name } })) throw new Error(`Supplier ${s.name} already exists — nothing changed.`);
  const trailers = await prisma.expense.findMany({ where: { expenseNumber: { in: ['EXP-2025-0001', 'filed-2025-2026-0082'] } } });
  if (trailers.length !== 2 || trailers.some((t) => t.category !== 'Crew')) throw new Error('Trailer expenses not as measured — nothing changed.');
  const ref = await prisma.expense.findUnique({ where: { expenseNumber: 'EXP-2025-0001' }, select: { createdById: true } });
  const last25 = await prisma.expense.findMany({ where: { expenseNumber: { startsWith: 'EXP-2025-' } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 });
  let n25 = parseInt(last25[0].expenseNumber.slice(-4), 10);
  const nums = ITEMS.map(() => `EXP-2025-${String(++n25).padStart(4, '0')}`);
  ITEMS.forEach((it, i) => console.log(`  ${nums[i]}  ${it.date}  ${SUPS.find((s) => s.key === it.sup)!.name}  ${it.inv ?? 'no invoice'}  ${it.net.toFixed(2)} + ${it.vat.toFixed(2)}  Dr ${it.acct}${it.vat ? '/1200' : ''} Cr 2000; paid ${it.paid} ref ${it.ref} Dr 2000 Cr 1010`));
  console.log('  EXP-2025-0001, filed-2025-2026-0082: category Crew -> Production Costs (already on 5000)');
  if (DRY) { console.log('\n=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }

  await prisma.$transaction(async (tx) => {
    const prefix = `JE-${new Date().getFullYear()}-`;
    const last = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
    let jn = parseInt(last[0].entryNumber.slice(-4), 10);
    const je = (date: string, memo: string, lines: [string, number, number, string][], sourceType?: string, sourceId?: string) =>
      tx.journalEntry.create({ data: { entryNumber: `${prefix}${String(++jn).padStart(4, '0')}`, date: day(date), memo, source: 'SYSTEM', sourceType: sourceType ?? null, sourceId: sourceId ?? null, status: 'POSTED', postedAt: new Date(), lines: { create: lines.filter((l) => l[1] || l[2]).map(([c, d, cr, desc]) => ({ accountId: acct.get(c)!, debit: d, credit: cr, description: desc.slice(0, 190) })) } } });
    const supId = new Map<string, string>();
    for (const s of SUPS) {
      const created = await tx.supplier.create({ data: { name: s.name, ...s.data, notes: `${(s.data.notes as string) ?? ''} ${TAG} Created 21 Sep 2026 from the ADCB ProCash payment e-mails and the GM.`.trim() } as Prisma.SupplierUncheckedCreateInput });
      supId.set(s.key, created.id);
    }
    for (let i = 0; i < ITEMS.length; i++) {
      const it = ITEMS[i]; const no = nums[i]; const sup = SUPS.find((s) => s.key === it.sup)!;
      const total = +(it.net + it.vat).toFixed(2);
      const e = await tx.expense.create({ data: {
        expenseNumber: no, category: it.category, description: it.desc, amount: it.net, vatAmount: it.vat, totalAmount: total,
        expenseDate: day(it.date), status: 'PAID', paidAt: day(it.paid), approvedAt: new Date(), vendorName: sup.name, supplierId: supId.get(it.sup)!,
        supplierVatId: it.vatId ?? null, invoiceNumber: it.inv, invoiceDate: it.inv ? day(it.date) : null, sourceRef: `${TAG}:${it.ref}`, createdById: ref!.createdById,
        notes: `${TAG} Paid ${it.paid} from the company ADCB account, transfer ${it.ref}; beneficiary named on the ADCB ProCash e-mail.${it.inv ? '' : ' No invoice — GM confirmed a freelance payment (21 Sep 2026).'}${it.vat ? ` Input VAT ${it.vat.toFixed(2)} on a tax invoice to the company; not in the return as filed.` : ''}`,
      } });
      await je(it.date, `Expense ${no} ${TAG} ${sup.name}${it.inv ? ` ${it.inv}` : ''} — ${it.desc}`.slice(0, 480), [[it.acct, it.net, 0, it.desc], ['1200', it.vat, 0, `Input VAT — ${sup.name} ${it.inv ?? ''}`], ['2000', 0, total, `Accounts Payable — ${sup.name}`]], 'EXPENSE', e.id);
      await je(it.paid, `${TAG} Payment of ${no} (${sup.name}) — ADCB outward transfer ${it.ref}.`, [['2000', total, 0, `${sup.name} — ${no}`], ['1010', 0, total, `ADCB O/W TRF ${it.ref}`]]);
      for (const [f, kind, name] of it.files) {
        const up = `supplier-2025-${f.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`;
        if (!existsSync(join(UPLOADS, up))) copyFileSync(join(ROOT, f), join(UPLOADS, up));
        const mime = f.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        await tx.documentAttachment.create({ data: { entityType: 'EXPENSE', entityId: e.id, kind, name, provider: 'UPLOAD', url: `/uploads/${up}`, mimeType: mime, sizeBytes: statSync(join(UPLOADS, up)).size, sourceRef: `file:${f}`, notes: `Supplied by the GM 21 Sep 2026. Original: ${join(ROOT, f)} ${TAG}` } });
        await tx.supplierDocument.create({ data: { supplierId: supId.get(it.sup)!, docType: kind === 'SOURCE' ? 'INVOICE' : 'OTHER', name, fileUrl: `/uploads/${up}`, notes: `${no} — ${kind === 'SOURCE' ? 'the invoice' : 'proof of payment'}. ${TAG}` } });
      }
    }
    for (const t of trailers) await tx.expense.update({ where: { id: t.id }, data: { category: 'Production Costs', notes: `${t.notes ?? ''}\n${TAG} Category Crew -> Production Costs: artist-trailer rental, posted to 5000; "Crew" now maps to 5300 Freelance & Crew Costs.`.trim() } });
  });
  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`\n  trial balance difference ${all.reduce((s, l) => s + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
