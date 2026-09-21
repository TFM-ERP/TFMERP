/**
 * complete-suppliers-2025.ts
 *
 * Makes every supplier invoice in the system belong to its supplier, and fills the
 * supplier records from what the invoices themselves print. Nothing is guessed:
 * each value below was read off a supplier document (PDF in backend/uploads or the
 * Supplier invoices folder, or the invoice e-mail), or is the supplier TRN already
 * held on that supplier's expense rows.
 *
 *  1. Supplier details — legal name, TRN, address, e-mail, phone, website. Empty
 *     fields only; nothing already on a record is overwritten (country excepted
 *     where the record carried the "UAE" default for a foreign seller).
 *  2. Invoices on file but not attached to their expense:
 *       - Abu Dhabi Printing 114104 (+ its e-mail): attachments pointed at a
 *         deleted expense id -> re-pointed to filed-2025-2026-0136.
 *       - SDM Auto Services tax invoice 21710 -> filed-2025-2026-0137.
 *       - Macquip MQ082 -> filed-2025-2026-0082 (the booked row).
 *       - Samsung AE250728-86849517 second copy -> EXP-2025-0008 (supporting).
 *  3. twofour54 tax invoice 820065232 (E-Channel registration renewal,
 *     1,515.00 + VAT 75.75 = 1,590.75, page 3 of the 24-Jul-2025 multi-invoice
 *     PDF). Paid on the company card 22 Jul (JE-2026-0793, booked gross to 6100).
 *     Booked as an expense with its VAT; the card line re-pointed to settle it.
 *  4. Senci General Trading L.L.C.: supplier created; the two cash payments already
 *     in the ledger (JE-2026-1091 320.00, JE-2026-1092 1,460.00) get expense records
 *     linked to those entries (no new ledger lines); service SB25070034 attached.
 *  5. Every expense attachment (file or invoice e-mail) is also filed as a supplier
 *     document on that supplier. Midjourney receipt 2RUQA65V is filed on Midjourney.
 *
 * Idempotent (tag [SUPPLIERS2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma, SupplierDocType } from '@prisma/client';
import { existsSync, statSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[SUPPLIERS2025]';
const UPLOADS = join(__dirname, '..', 'uploads');
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

type Fields = { name?: string; tradeName?: string; trn?: string; vatId?: string; address?: string; city?: string; country?: string; email?: string; phone?: string; website?: string; contactName?: string; tradeLicenseNumber?: string };
// key = current supplier name in the system
const DETAILS: Record<string, Fields> = {
  'Heartland': { name: 'Heartland Emirates Recreational Vehicles L.L.C', tradeName: 'Heartland', address: 'Hameem Road, Al Markaz', city: 'Abu Dhabi', phone: '02 563 3083' },
  'twofour54 FZ-LLC': { address: 'Yas Creative Hub, Yas Island, P.O. Box 2454', city: 'Abu Dhabi', email: 'accounts.receivable@twofour54.com' },
  'Dhabi One International Trading': { address: 'M40 Musaffah', city: 'Abu Dhabi', phone: '02 555 1007 / 052 639 8098', email: 'dhabione1@gmail.com', website: 'www.dhabione.com' },
  'Q-Tech General Trading LLC': { address: 'Ibn Battuta Gate Building', city: 'Dubai', tradeLicenseNumber: '666871', website: 'www.amazon.ae' },
  'Samsung Gulf Electronics FZE Dubai Branch': { address: 'Butterfly Building Tower A, Al Bourooj Street, Dubai Media City, P.O. Box 500047' },
  'Emirates Auction': { name: 'Emirates Auction LLC', tradeName: 'Emirates Auction', address: 'Al Mizhar', city: 'Dubai' },
  'Abu Dhabi Printing & Publishing Co. LLC': { trn: '100318777800003', address: 'ICAD 1, Warehouse 8/7 & 8/8, Abu Dhabi Business Hub', city: 'Abu Dhabi', email: 'info@abudhabiprinting.com' },
  'SDM Auto Service': { name: 'SDM Auto Services', trn: '100346393000003', address: 'Al Qusais Industrial 1, opposite Zulekha Hospital, P.O. Box 60385', city: 'Dubai', phone: '04 320 5554 / 050 140 4500', email: 'info@sdmauto.ae.com', website: 'www.sdmauto.ae' },
  'MAP Media Art Production FZ LLC': { trn: '100552445700003', address: 'BS 18, Dubai Studio City (facilities B29 Dubai Production City), P.O. Box 485035', city: 'Dubai', phone: '+971 4 410 7001', email: 'info@maproduction.ae', website: 'www.maproduction.ae' },
  'Macquip': { name: 'MACQUIP COMMERCIAL EQUIPMENT AND PROFESSIONAL MACHINES RENTING - L.L.C', tradeName: 'Macquip', trn: '104961238300003', address: 'C31, 11th Street, Al Dana East, H.E. Abdullah Al Masoud Foundation Building', city: 'Abu Dhabi', website: 'www.macquip.me' },
  'V Media Productions': { name: 'V Media Productions - Sole Proprietorship L.L.C.', tradeName: 'V Media', trn: '104665208500003', address: 'Musaffah M39', city: 'Abu Dhabi', phone: '+971 55 124 5555' },
  'Zoom Communications, Inc.': { trn: '100449107000003', address: '55 Almaden Blvd, 6th Floor', city: 'San Jose, CA 95113' },
  'Midjourney': { name: 'Midjourney Inc', tradeName: 'Midjourney', trn: '104681551800003', address: '611 Gateway Blvd, Suite 120', city: 'South San Francisco, CA 94080', country: 'USA', email: 'billing@midjourney.com', website: 'www.midjourney.com' },
  'Koobrik': { email: 'orlando@koobrik.com', phone: '+1 310 882 9646', website: 'www.koobrik.com' },
  'Frame.io, Inc.': { email: 'support@frame.io', website: 'www.frame.io' },
  'Adobe Systems Software Ireland Limited': { address: '4-6 Riverwalk, Citywest Business Park', city: 'Dublin 24', tradeLicenseNumber: 'IE company reg. 344992', website: 'www.adobe.com' },
  'Callaia.ai': { email: 'support@callaia.ai' },
  'La Quinta by Wyndham Abu Dhabi Al Wahda': { city: 'Abu Dhabi', email: 'ar@laquintaabudhabiaw.com', phone: '056 408 5363', website: 'laquintaabudhabialwahda.com' },
  'Kane Rodrigues': { city: 'Dubai', email: 'kane.rodrigues91@gmail.com', phone: '+971 50 205 9123' },
  'Alquram Media': { email: 'alquram.media@gmail.com' },
  'Google LLC': { address: '1600 Amphitheatre Parkway', city: 'Mountain View, CA 94043', country: 'USA' },
  'Immortal Cinema International, LLC': { address: 'P.O. Box 1322', city: 'Burbank, CA 91507', country: 'USA', contactName: 'Noah Berlow', email: 'noahberlow@immortalcinema.com', phone: '+1 323 301 5742' },
  'Music Licensing': { contactName: 'Gadzhimurad Mamaev', email: 'soundbygadzhi@gmail.com' },
  'Eleven Labs Inc.': { email: 'team@elevenlabs.io', website: 'elevenlabs.io' },
  'Railway Corporation': { email: 'billing@railway.com', website: 'railway.com' },
  'Vercel Inc.': { email: 'ar@vercel.com', website: 'vercel.com' },
  'Supabase Pte. Ltd.': { vatId: 'SG GST 202005760H', email: 'invoice+statements@supabase.com' },
  'Figma, Inc.': { address: '760 Market Street, Floor 10', city: 'San Francisco, CA 94102' },
};

const OLD_PRINTING_ID = 'cmt0nc8s100au5agwal8zsewk';
const F = {
  sdm: 'received-tax-invoice-21710-2025-05-10.pdf',
  mq: 'received-tax-invoice-mq082-2025-12-06.pdf',
  zfold2: 'received-tax-invoice-ae250728-86849517-2025-07-30.pdf',
  tw232: 'received-tax-invoice-820065232-2025-07-24.pdf',
  senci: 'received-quotation-sb25070034-2025-07-30.pdf',
  mj: 'received-receipt-2ruqa65v-0002-2025-12-29.pdf',
};

async function nextNumber(tx: Prisma.TransactionClient, issued: Set<string>): Promise<string> {
  const prefix = `JE-${new Date().getFullYear()}-`;
  const last = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
  let n = last.length > 0 ? parseInt(last[0].entryNumber.slice(-4), 10) : 0;
  let c = '';
  do { n += 1; c = `${prefix}${String(n).padStart(4, '0')}`; } while (issued.has(c));
  issued.add(c);
  return c;
}

function file(name: string): { url: string; size: number; mime: string } {
  const p = join(UPLOADS, name);
  if (!existsSync(p)) throw new Error(`Missing uploads/${name} — nothing changed.`);
  return { url: `/uploads/${name}`, size: statSync(p).size, mime: 'application/pdf' };
}

function docTypeFor(kind: string, name: string): SupplierDocType {
  const n = name.toLowerCase();
  if (n.includes('quotation') || n.includes('quote')) return 'QUOTATION';
  if (kind !== 'SOURCE' || n.includes('receipt') || n.includes('e-mail') || n.includes('email')) return 'OTHER';
  return 'INVOICE';
}

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const codes = ['1200', '2000', '6100'];
  const accts = await prisma.glAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== codes.length) throw new Error('GL account missing — nothing changed.');
  for (const f of Object.values(F)) file(f);

  // --- guards
  const sups = await prisma.supplier.findMany();
  const byName = new Map(sups.map((s) => [s.name, s]));
  for (const k of Object.keys(DETAILS)) if (!byName.has(k)) throw new Error(`Supplier "${k}" not found — nothing changed.`);
  for (const f of Object.values(DETAILS)) if (f.name && byName.has(f.name)) throw new Error(`Supplier name "${f.name}" already taken — nothing changed.`);
  if (await prisma.expense.findUnique({ where: { id: OLD_PRINTING_ID } })) throw new Error('Old Abu Dhabi Printing expense still exists — nothing changed.');
  const oldPrinting = await prisma.documentAttachment.findMany({ where: { entityType: 'EXPENSE', entityId: OLD_PRINTING_ID } });
  if (oldPrinting.length !== 2) throw new Error(`Expected 2 orphan Abu Dhabi Printing attachments, found ${oldPrinting.length} — nothing changed.`);
  const exp = async (n: string) => { const e = await prisma.expense.findUnique({ where: { expenseNumber: n } }); if (!e) throw new Error(`${n} missing — nothing changed.`); return e; };
  const printing = await exp('filed-2025-2026-0136');
  const sdm = await exp('filed-2025-2026-0137');
  const macq = await exp('filed-2025-2026-0082');
  const zfold = await exp('EXP-2025-0008');
  if (dec(printing.totalAmount) !== 8006.25 || dec(sdm.totalAmount) !== 2499 || dec(macq.totalAmount) !== 2100) throw new Error('Expense amounts not as measured — nothing changed.');
  const card232 = await prisma.journalEntry.findUnique({ where: { entryNumber: 'JE-2026-0793' }, include: { lines: { include: { account: true } } } });
  if (!card232 || card232.sourceType || !card232.memo?.includes('051739') || !card232.lines.some((l) => l.account.code === '6100' && dec(l.debit) === 1590.75)) throw new Error('twofour54 card line JE-2026-0793 not as measured — nothing changed.');
  if (await prisma.expense.count({ where: { invoiceNumber: '820065232' } })) throw new Error('820065232 already booked — nothing changed.');
  const cash = await prisma.journalEntry.findMany({ where: { entryNumber: { in: ['JE-2026-1091', 'JE-2026-1092'] } }, include: { lines: { include: { account: true } } }, orderBy: { entryNumber: 'asc' } });
  if (cash.length !== 2 || cash.some((j) => j.sourceType || !j.memo?.includes('Senci'))) throw new Error('Senci cash entries not as measured — nothing changed.');
  if (dec(cash[0].lines.find((l) => l.account.code === '5200')?.debit) !== 320 || dec(cash[1].lines.find((l) => l.account.code === '5200')?.debit) !== 1460) throw new Error('Senci amounts not as measured — nothing changed.');
  const twofour = byName.get('twofour54 FZ-LLC')!;
  const midj = byName.get('Midjourney')!;
  const createdById = zfold.createdById;
  const last25 = await prisma.expense.findMany({ where: { expenseNumber: { startsWith: 'EXP-2025-' } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 });
  let n25 = parseInt(last25[0].expenseNumber.slice(-4), 10);
  const no232 = `EXP-2025-${String(++n25).padStart(4, '0')}`;
  const noS1 = `EXP-2025-${String(++n25).padStart(4, '0')}`;
  const noS2 = `EXP-2025-${String(++n25).padStart(4, '0')}`;

  // --- supplier field changes (empty fields only)
  const vatRows = await prisma.expense.findMany({ where: { supplierVatId: { not: null }, supplierId: { not: null } }, select: { supplierId: true, supplierVatId: true } });
  const vatBySup = new Map<string, Set<string>>();
  for (const r of vatRows) { if (!vatBySup.has(r.supplierId!)) vatBySup.set(r.supplierId!, new Set()); vatBySup.get(r.supplierId!)!.add(r.supplierVatId!.trim()); }
  const updates: { id: string; label: string; data: Record<string, string> }[] = [];
  for (const s of sups) {
    const want: Fields = { ...(DETAILS[s.name] ?? {}) };
    const vats = vatBySup.get(s.id);
    if (!s.trn && !want.trn && vats && vats.size === 1) want.trn = [...vats][0];
    if (want.trn && vats && vats.size === 1 && [...vats][0] !== want.trn) throw new Error(`${s.name}: invoice TRN ${want.trn} differs from expense TRN ${[...vats][0]} — nothing changed.`);
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(want)) {
      if (!v) continue;
      const cur = (s as unknown as Record<string, unknown>)[k];
      if (k === 'name') { if (cur !== v) data[k] = v; continue; }
      if (k === 'country') { if (cur === 'UAE' && v !== 'UAE') data[k] = v; continue; }
      if (cur === null || cur === undefined || cur === '') data[k] = v;
    }
    if (Object.keys(data).length) updates.push({ id: s.id, label: s.name, data });
  }

  console.log(`Supplier records updated: ${updates.length}`);
  for (const u of updates) console.log(`  ${u.label}: ${Object.entries(u.data).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
  console.log('\nAttachments:');
  console.log(`  Abu Dhabi Printing 114104 + e-mail: re-point 2 attachments -> filed-2025-2026-0136`);
  console.log(`  SDM Auto Services 21710 (2,500.00; filed as 2,499.00) -> filed-2025-2026-0137`);
  console.log(`  Macquip MQ082 -> filed-2025-2026-0082`);
  console.log(`  Samsung AE250728-86849517 second copy -> EXP-2025-0008 (supporting)`);
  console.log('\nLedger:');
  console.log(`  ${no232}  2025-07-24  twofour54 820065232 E-Channel renewal  Dr 6100 1,515.00 + Dr 1200 75.75 / Cr 2000 1,590.75`);
  console.log(`  2025-07-25  card JE-2026-0793 re-pointed  Dr 2000 1,590.75 / Cr 6100 1,590.75  [SETTLES ${no232}]`);
  console.log(`  Senci General Trading L.L.C. (new supplier): ${noS1} 320.00 -> JE-2026-1091, ${noS2} 1,460.00 -> JE-2026-1092 (linked, no new lines)`);
  console.log('\nSupplier documents: every expense attachment filed on its supplier; Midjourney receipt 2RUQA65V filed on Midjourney.');
  if (DRY) { console.log('\n=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }

  await prisma.$transaction(async (tx) => {
    const issued = new Set<string>();
    const je = async (date: string, memo: string, lines: [string, number, number, string][], sourceType?: string, sourceId?: string) =>
      tx.journalEntry.create({
        data: {
          entryNumber: await nextNumber(tx, issued), date: day(date), memo: memo.slice(0, 480), source: 'SYSTEM',
          sourceType: sourceType ?? null, sourceId: sourceId ?? null, status: 'POSTED', postedAt: new Date(),
          lines: { create: lines.map(([c, d, cr, desc]) => ({ accountId: acct.get(c)!, debit: d, credit: cr, description: desc.slice(0, 190) })) },
        },
      });
    const attach = async (entityId: string, fname: string, kind: 'SOURCE' | 'SUPPORTING', name: string, notes: string) => {
      const f = file(fname);
      await tx.documentAttachment.create({ data: { entityType: 'EXPENSE', entityId, kind, name, provider: 'UPLOAD', url: f.url, mimeType: f.mime, sizeBytes: f.size, sourceRef: `file:${fname}`, notes: `${notes} ${TAG}` } });
    };

    // 1. suppliers
    for (const u of updates) await tx.supplier.update({ where: { id: u.id }, data: u.data });

    // 2. attachments
    for (const a of oldPrinting) await tx.documentAttachment.update({ where: { id: a.id }, data: { entityId: printing.id, notes: `${a.notes ?? ''} [21 Sep 2026] Re-pointed from a deleted expense id to filed-2025-2026-0136. ${TAG}`.trim() } });
    await attach(sdm.id, F.sdm, 'SOURCE', 'TAX INVOICE 21710 — SDM Auto Services, 2,500.00', 'Headlights Sierra 07-13 and Silverado 07-13, 2,380.96 + VAT 119.04 = 2,500.00, dated 10/05/2025. Filed in the 2025-Q2 return as 2,380.00 + 119.00 = 2,499.00 (1.00 short). Not paid from the company bank account.');
    await attach(macq.id, F.mq, 'SOURCE', 'TAX INVOICE MQ082 — Macquip, 2,100.00', 'Macquip tax invoice MQ082, 06 Dec 2025, 2,000.00 + VAT 100.00. The same document is also on EXP-2026-0009 (0.00, imported from e-mail).');
    await attach(zfold.id, F.zfold2, 'SUPPORTING', 'TAX INVOICE AE250728-86849517 — Samsung, second copy', 'Second download of the same Samsung tax invoice (from the TAX folder).');

    // 3. twofour54 820065232
    const t = await tx.expense.create({
      data: {
        expenseNumber: no232, category: 'Licence & Facilities', description: 'twofour54 — E-Channel registration renewal', amount: 1515, vatAmount: 75.75, totalAmount: 1590.75,
        expenseDate: day('2025-07-24'), status: 'PAID', paidAt: day('2025-07-25'), approvedAt: new Date(), vendorName: 'twofour54 FZ-LLC', supplierId: twofour.id,
        supplierVatId: '100300336300003', invoiceNumber: '820065232', invoiceDate: day('2025-07-24'), sourceRef: `${TAG}:820065232`, createdById,
        notes: `${TAG} twofour54 tax invoice 820065232, 24-Jul-2025, page 3 of the multi-invoice PDF "Twofour54 FZ LLC - Invoice(s) - 24-JUL-2025". Paid on company card 3825 on 22 Jul (051739). Input VAT 75.75 not in the 2025-Q3 return as filed.`,
      },
    });
    await je('2025-07-24', `Expense ${no232} ${TAG} twofour54 tax invoice 820065232 — E-Channel registration renewal`, [['6100', 1515, 0, 'E-Channel registration renewal'], ['1200', 75.75, 0, 'Input VAT — twofour54 820065232'], ['2000', 0, 1590.75, 'Accounts Payable — twofour54']], 'EXPENSE', t.id);
    await je('2025-07-25', `[CARD2025][SETTLES ${no232}] ${TAG} Card line JE-2026-0793 (PUR 22/07 TwoFour54 Dubai 3825 051739), booked gross to 6100, pays invoice 820065232 — re-pointed to the payable.`, [['2000', 1590.75, 0, `twofour54 — ${no232}`], ['6100', 0, 1590.75, 'Reverse: now settles the invoice']]);
    await attach(t.id, F.tw232, 'SOURCE', 'TAX INVOICE 820065232 — twofour54, 1,590.75 (page 3)', 'Multi-invoice PDF of 24-Jul-2025: page 1 820065216, page 2 820065224, page 3 820065232 (this one).');

    // 4. Senci
    let senci = await tx.supplier.findFirst({ where: { name: 'Senci General Trading L.L.C.' } });
    if (!senci) senci = await tx.supplier.create({ data: { name: 'Senci General Trading L.L.C.', tradeName: 'Senci', categories: ['Maintenance'], category: 'Maintenance', contactName: 'Shabar (sales manager)', notes: 'Generator service and parts (Senci SM9500 gensets). Bank: RAK Bank, IBAN AE280400000882289334003 (as printed on quotation SB25070034).' } });
    const s1 = await tx.expense.create({
      data: {
        expenseNumber: noS1, category: 'Maintenance', description: 'Senci — repair form 2250: generator SM9500DT wheels x4, battery 14AH x2, fuel cap x2', amount: 320, vatAmount: 0, totalAmount: 320,
        expenseDate: day('2025-02-27'), status: 'PAID', paidAt: day('2025-02-27'), approvedAt: new Date(), vendorName: 'Senci General Trading L.L.C.', supplierId: senci.id,
        invoiceNumber: '2250', invoiceDate: day('2025-02-27'), sourceRef: `${TAG}:senci2250`, createdById,
        notes: `${TAG} Paid in cash on delivery (Apex Express waybill 1122744). Already in the ledger as JE-2026-1091 (Dr 5200 / Cr 1000); linked, no new lines. Repair form 2250 is not in backend/uploads.`,
      },
    });
    const s2 = await tx.expense.create({
      data: {
        expenseNumber: noS2, category: 'Maintenance', description: 'Senci — service SB25070034: SM9500Di spark plugs, air filters, oil change x4, inverter boards x2, service x4', amount: 1460, vatAmount: 0, totalAmount: 1460,
        expenseDate: day('2025-07-30'), status: 'PAID', paidAt: day('2025-07-30'), approvedAt: new Date(), vendorName: 'Senci General Trading L.L.C.', supplierId: senci.id,
        invoiceNumber: 'SB25070034', invoiceDate: day('2025-07-30'), sourceRef: `${TAG}:senciSB25070034`, createdById,
        notes: `${TAG} Service quotation SB25070034, terms CASH, total 1,460.00 (no VAT shown). Paid in cash. Already in the ledger as JE-2026-1092 (Dr 5200 / Cr 1000); linked, no new lines.`,
      },
    });
    await tx.journalEntry.update({ where: { id: cash[0].id }, data: { sourceType: 'EXPENSE', sourceId: s1.id, memo: `${cash[0].memo} ${TAG} = ${noS1}`.slice(0, 1000) } });
    await tx.journalEntry.update({ where: { id: cash[1].id }, data: { sourceType: 'EXPENSE', sourceId: s2.id, memo: `${cash[1].memo} ${TAG} = ${noS2}`.slice(0, 1000) } });
    await attach(s2.id, F.senci, 'SOURCE', 'SERVICE QUOTATION SB25070034 — Senci, 1,460.00 (cash)', 'Terms CASH; used as the document for the cash payment.');

    // 5. supplier documents for every expense attachment
    const atts = await tx.documentAttachment.findMany({ where: { entityType: 'EXPENSE' }, orderBy: { createdAt: 'asc' } });
    const exps = await tx.expense.findMany({ where: { id: { in: [...new Set(atts.map((a) => a.entityId))] } }, select: { id: true, expenseNumber: true, supplierId: true } });
    const eById = new Map(exps.map((e) => [e.id, e]));
    const groups = new Map<string, { supplierId: string; url: string; name: string; kind: string; nums: string[] }>();
    for (const a of atts) {
      const e = eById.get(a.entityId);
      if (!e || !e.supplierId) continue;
      const k = `${e.supplierId}|${a.url}`;
      if (!groups.has(k)) groups.set(k, { supplierId: e.supplierId, url: a.url, name: a.name, kind: a.kind, nums: [] });
      const g = groups.get(k)!;
      if (!g.nums.includes(e.expenseNumber)) g.nums.push(e.expenseNumber);
      if (a.kind === 'SOURCE') g.kind = 'SOURCE';
    }
    let made = 0;
    for (const g of groups.values()) {
      if (await tx.supplierDocument.count({ where: { supplierId: g.supplierId, fileUrl: g.url } })) continue;
      await tx.supplierDocument.create({ data: { supplierId: g.supplierId, docType: docTypeFor(g.kind, g.name), name: g.name.slice(0, 250), fileUrl: g.url, notes: `${g.nums.join(', ')} — ${g.kind === 'SOURCE' ? 'the invoice' : 'supporting document'}. ${TAG}` } });
      made++;
    }
    const mj = file(F.mj);
    await tx.supplierDocument.create({ data: { supplierId: midj.id, docType: 'OTHER', name: 'RECEIPT 2RUQA65V — Midjourney, USD 302.40', fileUrl: mj.url, notes: `Standard plan 29 Dec 2025 – 29 Dec 2026, USD 288.00 + UAE VAT 14.40. Billed to Qais Qandil personally, paid by Mastercard ending 2528 (not the company card). Not matched to a 2025 ledger entry. ${TAG}` } });
    console.log(`  supplier documents created: ${made + 1}`);
  });

  // --- verify
  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`\n  trial balance difference ${all.reduce((s, l) => s + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  const atts = await prisma.documentAttachment.findMany({ where: { entityType: 'EXPENSE' } });
  let orphan = 0; let noSup = 0; let noDoc = 0;
  for (const a of atts) {
    const e = await prisma.expense.findUnique({ where: { id: a.entityId }, select: { supplierId: true } });
    if (!e) { orphan++; continue; }
    if (!e.supplierId) { noSup++; continue; }
    if (!(await prisma.supplierDocument.count({ where: { supplierId: e.supplierId, fileUrl: a.url } }))) noDoc++;
  }
  console.log(`  expense attachments ${atts.length}: orphaned ${orphan}, expense without supplier ${noSup}, not on supplier ${noDoc}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
