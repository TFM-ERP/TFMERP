/**
 * finalise-supplier-docs-2025.ts
 *
 * GM, 21 Sep 2026: every invoice supplied today must be in the books with proper
 * entries, filed in the folder, and attached both to its expense and to its supplier.
 * An audit of today's postings found these gaps; this script closes them.
 *
 * 1. 2024 Heartland invoices — not in the books at all. The GM paid them personally.
 *      HL-INV 221/2024  23/06/2024  3,455.00 + 172.75 = 3,627.75  (tax invoice)
 *      HL/245/2024      14/07/2024  8,790.17 + 439.50 = 9,229.67  (tax invoice; the
 *                                   9,229.50 job sheet of 10/07/2024 is the same job)
 *      HL/271/2024      05/08/2024    610.00 +  30.50 =   640.50  (tax invoice)
 *      Job sheet        19/12/2024  4,430.00 + 221.50 = 4,651.50  (Rockwood)
 *      Job sheet        31/12/2024  1,773.00 +  88.65 = 1,861.65  (Freedom Express)
 *    Each: Dr 5200 net + Dr 1200 VAT / Cr 2000, then Dr 2000 / Cr 2400 Owner Account.
 *    Heartland job sheets are treated as invoices (GM). None of this VAT is in a 2024
 *    return as filed — for the adviser.
 *
 * 2. Gear-up.me tax invoice 2000003098 (Orynx General Trading LLC, TRN 100046263800003),
 *    15/04/2025, billed to the company: Ubiquiti doorbell, chime, camera,
 *    1,957.14 + 97.86 = 2,055.00. Tamara: 1,326.58 + 3 × 250.00 = 2,076.58 (fee 21.58).
 *    The company card paid two instalments (500.00, already booked as cost by
 *    [TAMARA2025B]) — those now settle the invoice; the GM paid the rest personally.
 *
 * 3. Samsung monitor filed-2025-2026-0099 — the tax invoice AE251121-49119949 is from
 *    Samsung Gulf Electronics, not "Epilogue": supplier corrected; the duplicate
 *    attachment added today is removed and the original upgraded to SOURCE.
 *
 * 4. Caravan/trailer rows still categorised as Office/Miscellaneous -> Maintenance,
 *    matching the ledger (5200).
 *
 * 5. Every invoice file is attached to its supplier as a supplier document.
 *
 * Idempotent (tag [FINALISE2025]). Pass --dry for the plan.
 */

import { PrismaClient, Prisma, SupplierDocType } from '@prisma/client';
import { copyFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[FINALISE2025]';
const ROOT = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const DIR24 = join(ROOT, '2024 - Heartland');
const UPLOADS = join(__dirname, '..', 'uploads');
const HL_TRN = '100393810500003';
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

interface Inv24 { key: string; date: string; no: string | null; net: number; vat: number; desc: string; file: string; support: string[] }
const HL24: Inv24[] = [
  { key: 'hl221', date: '2024-06-23', no: 'HL-INV 221/2024', net: 3455, vat: 172.75, desc: 'Powered tongue jack, hitch pin, ball mount bushing, water pump, electric tongue jacks x4, tank deodoriser, RV wash brush', file: 'Heartland-INVOICE-HL-INV-221-2024-2024-06-23-3627.75.pdf', support: [] },
  { key: 'hl245', date: '2024-07-14', no: 'HL/245/2024', net: 8790.17, vat: 439.5, desc: 'Coachman Freedom Express: generator bracket modification, keyless RV door locks x2, latches, jacks x4, tail/marker lights, lumitronics lights, cam locks, vinyl insert, 12V electric winch and parts', file: 'Heartland-TAX-INVOICE-HL-245-2024-2024-07-14-9229.67.pdf', support: ['Heartland-2024-07-10-CoachmanFreedomExpress-9229.50.pdf', 'Heartland-2024-07-01-QUOTE-9518.25.pdf', 'Heartland-2024-07-01-QUOTE-updated-7523.25.pdf'] },
  { key: 'hl271', date: '2024-08-05', no: 'HL/271/2024', net: 610, vat: 30.5, desc: 'Hitch adapter 2.5" to 2", EazLift locking hitch pins x2, ball mount', file: 'Heartland-INVOICE-HL-271-2024-2024-08-05-640.50.jpg', support: [] },
  { key: 'hlrock', date: '2024-12-19', no: null, net: 4430, vat: 221.5, desc: 'Rockwood: entry door lock, Go Power 100A battery + 190W solar panel, slide lubrication', file: 'Heartland-2024-12-19-Rockwood-4651.50.pdf', support: [] },
  { key: 'hlfe', date: '2024-12-31', no: null, net: 1773, vat: 88.65, desc: 'Freedom Express: bathtub silicone, kitchen faucet, door grab handle, roof AC cover, tongue jack switch, AC foam', file: 'Heartland-2024-12-31-FreedomExpress-1861.65.pdf', support: [] },
];
const GEARUP_FILE = 'GearUp-Orynx-2000003098-Ubiquiti-2055-Tamara.pdf';
const RECATEGORISE = ['filed-2025-2026-0077', 'filed-2025-2026-0080', 'filed-2025-2026-0141', 'filed-2025-2026-0144', 'filed-2025-2026-0085'];

async function nextNumber(tx: Prisma.TransactionClient, issued: Set<string>): Promise<string> {
  const prefix = `JE-${new Date().getFullYear()}-`;
  const last = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
  let n = last.length > 0 ? parseInt(last[0].entryNumber.slice(-4), 10) : 0;
  let c = '';
  do { n += 1; c = `${prefix}${String(n).padStart(4, '0')}`; } while (issued.has(c));
  issued.add(c);
  return c;
}

function store(dir: string, file: string): { url: string; size: number; mime: string } {
  mkdirSync(UPLOADS, { recursive: true });
  const name = `supplier-2025-${file.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`;
  const dest = join(UPLOADS, name);
  if (!existsSync(dest)) copyFileSync(join(dir, file), dest);
  return { url: `/uploads/${name}`, size: statSync(dest).size, mime: file.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' };
}

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const codes = ['1200', '2000', '2400', '5200', '6200', '6500'];
  const accts = await prisma.glAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== codes.length) throw new Error('GL account missing — nothing changed.');

  const heartland = await prisma.supplier.findFirst({ where: { name: 'Heartland' } });
  if (!heartland || heartland.trn !== HL_TRN) throw new Error('Heartland supplier not as expected — nothing changed.');
  for (const i of HL24) for (const f of [i.file, ...i.support]) if (!existsSync(join(DIR24, f))) throw new Error(`Missing ${f}`);
  if (!existsSync(join(ROOT, GEARUP_FILE))) throw new Error(`Missing ${GEARUP_FILE}`);
  for (const i of HL24) {
    const amt = +(i.net + i.vat).toFixed(2);
    const dup = await prisma.expense.count({ where: { supplierId: heartland.id, totalAmount: amt, expenseDate: { lt: day('2025-01-01') } } });
    if (dup) throw new Error(`Heartland 2024 ${amt} already in the books — nothing changed.`);
  }
  const gearCard = await prisma.journalEntry.findMany({ where: { memo: { contains: '[TAMARA2025B]' }, OR: [{ memo: { contains: '717705' } }, { memo: { contains: '718532' } }] }, select: { id: true } });
  if (gearCard.length !== 2) throw new Error('Gear-up card entries not found — nothing changed.');
  if ((await prisma.expense.count({ where: { invoiceNumber: '2000003098' } })) > 0) throw new Error('Gear-up invoice already booked — nothing changed.');
  const monitor = await prisma.expense.findUnique({ where: { expenseNumber: 'filed-2025-2026-0099' } });
  const samsung = await prisma.supplier.findFirst({ where: { trn: '100382193900003' } });
  if (!monitor || !samsung) throw new Error('Monitor or Samsung supplier missing — nothing changed.');
  const monAtts = await prisma.documentAttachment.findMany({ where: { entityType: 'EXPENSE', entityId: monitor.id }, orderBy: { createdAt: 'asc' } });
  if (monAtts.length !== 2) throw new Error(`Monitor has ${monAtts.length} attachments, expected 2 — nothing changed.`);
  const createdById = monitor.createdById;

  const last24 = await prisma.expense.findMany({ where: { expenseNumber: { startsWith: 'EXP-2024-' } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 });
  let s24 = last24.length ? parseInt(last24[0].expenseNumber.slice(-4), 10) : 0;
  const last25 = await prisma.expense.findMany({ where: { expenseNumber: { startsWith: 'EXP-2025-' } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 });
  const gearNo = `EXP-2025-${String(parseInt(last25[0].expenseNumber.slice(-4), 10) + 1).padStart(4, '0')}`;
  const no24 = new Map(HL24.map((i) => [i.key, `EXP-2024-${String(++s24).padStart(4, '0')}`]));

  for (const i of HL24) console.log(`  ${no24.get(i.key)}  ${i.date}  ${i.no ?? 'job sheet'}  ${i.net} + ${i.vat}  Dr 5200/1200 Cr 2000; paid Dr 2000 Cr 2400`);
  console.log(`  ${gearNo}  2025-04-15  Gear-up 2000003098  1,957.14 + 97.86; card 500.00 re-pointed from 6200 to 2000; GM paid 1,555.00 + fee 21.58 -> Cr 2400`);
  console.log('  filed-2025-2026-0099 -> supplier Samsung Gulf Electronics; duplicate attachment removed');
  console.log(`  recategorise to Maintenance: ${RECATEGORISE.join(', ')}`);
  if (DRY) { console.log('\n=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }

  await prisma.$transaction(async (tx) => {
    const issued = new Set<string>();
    const je = async (date: string, memo: string, lines: [string, number, number, string][], sourceType?: string, sourceId?: string) =>
      tx.journalEntry.create({
        data: {
          entryNumber: await nextNumber(tx, issued), date: day(date), memo: memo.slice(0, 480), source: 'SYSTEM',
          sourceType: sourceType ?? null, sourceId: sourceId ?? null, status: 'POSTED', postedAt: new Date(),
          lines: { create: lines.filter((l) => l[1] || l[2]).map(([c, d, cr, desc]) => ({ accountId: acct.get(c)!, debit: d, credit: cr, description: desc.slice(0, 190) })) },
        },
      });
    const attach = async (entityId: string, dir: string, file: string, kind: 'SOURCE' | 'SUPPORTING', name: string, notes: string) => {
      const s = store(dir, file);
      await tx.documentAttachment.create({ data: { entityType: 'EXPENSE', entityId, kind, name, provider: 'UPLOAD', url: s.url, mimeType: s.mime, sizeBytes: s.size, sourceRef: `file:${file}`, notes: `${notes} Supplied by the GM 21 Sep 2026. Original: ${join(dir, file)}` } });
    };

    // 1. 2024 Heartland
    for (const i of HL24) {
      const total = +(i.net + i.vat).toFixed(2);
      const e = await tx.expense.create({
        data: {
          expenseNumber: no24.get(i.key)!, category: 'Maintenance', description: `Heartland Emirates RV — ${i.desc}`.slice(0, 250),
          amount: i.net, vatAmount: i.vat, totalAmount: total, expenseDate: day(i.date), status: 'PAID', paidAt: day(i.date), approvedAt: new Date(),
          vendorName: 'Heartland Emirates Recreational Vehicles', supplierId: heartland.id, supplierVatId: HL_TRN, invoiceNumber: i.no, invoiceDate: day(i.date),
          sourceRef: `${TAG}:${i.key}`, createdById,
          notes: `${TAG} ${i.no ? `Heartland tax invoice ${i.no}` : 'Heartland job sheet (treated as invoice, GM)'} dated ${i.date}: ${i.net.toFixed(2)} + VAT ${i.vat.toFixed(2)} = ${total.toFixed(2)}. Paid personally by the GM (21 Sep 2026) — owed to him through 2400. Input VAT not in any 2024 return as filed.`,
        },
      });
      await je(i.date, `Expense ${e.expenseNumber} ${TAG} Heartland ${i.no ?? 'job sheet'} — ${i.desc}`, [['5200', i.net, 0, `Maintenance — Heartland ${i.no ?? 'job sheet'}`], ['1200', i.vat, 0, 'Input VAT — Heartland'], ['2000', 0, total, 'Accounts Payable — Heartland']], 'EXPENSE', e.id);
      await je(i.date, `${TAG} ${e.expenseNumber} Heartland ${i.no ?? 'job sheet'} paid personally by the GM — owed to him`, [['2000', total, 0, `Heartland — ${e.expenseNumber}`], ['2400', 0, total, 'Owner Account — paid personally']]);
      await attach(e.id, DIR24, i.file, 'SOURCE', `${i.no ? `TAX INVOICE ${i.no}` : `Job sheet ${i.date}`} — Heartland Emirates RV, ${total.toFixed(2)}`, i.no ? 'Heartland tax invoice to the company, TRN shown.' : 'Heartland job sheet, no TRN or number.');
      for (const s of i.support) await attach(e.id, DIR24, s, 'SUPPORTING', `Heartland ${s.includes('QUOTE') ? 'quotation' : 'job sheet'} — ${s.replace(/\.(pdf|jpg)$/i, '')}`, s.includes('QUOTE') ? 'Quotation for the same work.' : 'Job sheet for the same job as the tax invoice — not a second supply.');
    }

    // 2. Gear-up.me
    let gear = await tx.supplier.findFirst({ where: { trn: '100046263800003' } });
    if (!gear) gear = await tx.supplier.create({ data: { name: 'Orynx General Trading LLC (Gear-up.me)', tradeName: 'Gear-up.me', trn: '100046263800003', address: 'Sheikh Zayed Road', city: 'Dubai', email: 'support@gear-up.me', phone: '+971 4 223 1780', categories: ['Electronics'], category: 'Electronics' } });
    const g = await tx.expense.create({
      data: {
        expenseNumber: gearNo, category: 'Office', description: 'Ubiquiti G4 Doorbell Pro, UP-Chime, G4 Instant camera', amount: 1957.14, vatAmount: 97.86, totalAmount: 2055,
        expenseDate: day('2025-04-15'), status: 'PAID', paidAt: day('2025-07-15'), approvedAt: new Date(), vendorName: 'Orynx General Trading LLC (Gear-up.me)', supplierId: gear.id,
        supplierVatId: '100046263800003', invoiceNumber: '2000003098', invoiceDate: day('2025-04-15'), sourceRef: `${TAG}:gearup`, createdById,
        notes: `${TAG} Tax invoice 2000003098, order 2000004670, billed to the company with its TRN. Paid through Tamara: 1,326.58 + 3 × 250.00 = 2,076.58 (fee 21.58). Company card 3825 paid two instalments (500.00, 12 Jun 2025); the GM paid the rest personally (1,555.00 of the invoice + 21.58 fee) — owed to him through 2400. Input VAT 97.86 not in the Q2 2025 return as filed.`,
      },
    });
    await je('2025-04-15', `Expense ${gearNo} ${TAG} Gear-up.me tax invoice 2000003098 — Ubiquiti doorbell, chime, camera`, [['6200', 1957.14, 0, 'Ubiquiti doorbell, chime, camera'], ['1200', 97.86, 0, 'Input VAT — Gear-up 2000003098'], ['2000', 0, 2055, 'Accounts Payable — Gear-up.me via Tamara']], 'EXPENSE', g.id);
    await je('2025-06-13', `[CARD2025][SETTLES ${gearNo}] ${TAG} The two 250.00 Tamara payments of 12 Jun (3825 717705, 718532), booked as cost by [TAMARA2025B], pay invoice 2000003098 — re-pointed to the payable.`, [['2000', 500, 0, `Gear-up.me — ${gearNo}`], ['6200', 0, 500, 'Reverse: now settles the invoice']]);
    await je('2025-07-15', `${TAG} ${gearNo} rest of the Tamara plan paid personally by the GM (1,326.58 on 15 Apr + 250.00 on 15 Jul) — owed to him`, [['2000', 1555, 0, `Gear-up.me — ${gearNo}`], ['6500', 21.58, 0, 'Tamara fee'], ['2400', 0, 1576.58, 'Owner Account — paid personally']]);
    await attach(g.id, ROOT, GEARUP_FILE, 'SOURCE', 'TAX INVOICE 2000003098 — Orynx General Trading (Gear-up.me), 2,055.00', 'Billed to the company with its TRN; paid through Tamara.');

    // 3. Monitor
    await tx.expense.update({ where: { id: monitor.id }, data: { supplierId: samsung.id, vendorName: 'Samsung Gulf Electronics FZE Dubai Branch (via Tamara)', category: 'Office', notes: `${monitor.notes ?? ''}\n[21 Sep 2026] ${TAG} Supplier corrected from "Epilogue" to Samsung Gulf Electronics FZE Dubai Branch (TRN 100382193900003), the issuer of tax invoice AE251121-49119949 for exactly this amount and date.` } });
    await tx.documentAttachment.update({ where: { id: monAtts[0].id }, data: { kind: 'SOURCE', notes: 'Samsung Gulf Electronics tax invoice AE251121-49119949, billed to the company with its TRN. [21 Sep 2026] Earlier note naming Epilogue as the seller was wrong.' } });
    await tx.documentAttachment.delete({ where: { id: monAtts[1].id } });

    // 4. Categories
    await tx.expense.updateMany({ where: { expenseNumber: { in: RECATEGORISE } }, data: { category: 'Maintenance' } });

    // 5. Supplier documents: every attachment on every expense that has a supplier and a file we hold
    const atts = await tx.documentAttachment.findMany({ where: { entityType: 'EXPENSE', OR: [{ url: { startsWith: '/uploads/supplier-2025-' } }, { url: { startsWith: '/uploads/received-tax-invoice-doit' } }, { url: { startsWith: '/uploads/received-tax-invoice-ae251121' } }] } });
    for (const a of atts) {
      const e = await tx.expense.findUnique({ where: { id: a.entityId }, select: { supplierId: true, expenseNumber: true } });
      if (!e?.supplierId) continue;
      if (await tx.supplierDocument.count({ where: { supplierId: e.supplierId, fileUrl: a.url } })) continue;
      const lower = a.url.toLowerCase();
      const docType: SupplierDocType = lower.includes('quote') ? 'QUOTATION' : a.kind === 'SOURCE' || lower.includes('invoice') ? 'INVOICE' : 'OTHER';
      await tx.supplierDocument.create({ data: { supplierId: e.supplierId, docType, name: a.name, fileUrl: a.url, notes: `${e.expenseNumber} — ${a.kind === 'SOURCE' ? 'the invoice' : 'supporting document'}. ${TAG}` } });
    }
  }, { timeout: 180000, maxWait: 30000 });

  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`\n  trial balance difference ${all.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  console.log(`  supplier documents: ${await prisma.supplierDocument.count({ where: { notes: { contains: TAG } } })}`);
  await prisma.$disconnect();
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
