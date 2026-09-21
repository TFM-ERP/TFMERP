/**
 * post-parts-place-2025.ts
 *
 * The Parts Place Inc. (Dekalb, IL, USA) invoice #171552, order #270939, 10 Oct 2025,
 * billed to The Film Makers FZ LLC: 1971 Chevrolet Nova front-end parts (grille, grille
 * support brackets, headlamp bezels/buckets/rings/adjuster, front chrome bumper, bumper
 * filler brace, hood molding) USD 852.88 + UPS shipping USD 120.00 = USD 972.88,
 * paid on the company MasterCard 3825.
 *
 * The card line (PUR 10/10 972.88 USD THE PARTS DEKALB 3825 001677, AED 3,703.46) was
 * booked by [CARDREST2025] straight to 5200 with no supplier document. This script:
 *   1. creates the supplier (foreign, no TRN) and expense EXP-2025-NNNN for AED 3,703.46
 *      (the amount the bank charged), VAT nil — foreign seller, no UAE VAT charged;
 *      Dr 5200 / Cr 2000;
 *   2. re-points the card entry to settle the payable: Dr 2000 / Cr 5200 (same pattern
 *      as the Gear-up invoice), so 5200 carries the cost once;
 *   3. attaches the invoice PDF to the expense and to the supplier's documents.
 *
 * Idempotent (tag [PARTSPLACE2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[PARTSPLACE2025]';
const ROOT = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const FILE = 'ThePartsPlace-INV-171552-2025-10-10-USD972.88.pdf';
const UPLOADS = join(__dirname, '..', 'uploads');
const AED = 3703.46;
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

async function nextNumber(tx: Prisma.TransactionClient, issued: Set<string>): Promise<string> {
  const prefix = `JE-${new Date().getFullYear()}-`;
  const last = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
  let n = last.length > 0 ? parseInt(last[0].entryNumber.slice(-4), 10) : 0;
  let c = '';
  do { n += 1; c = `${prefix}${String(n).padStart(4, '0')}`; } while (issued.has(c));
  issued.add(c);
  return c;
}

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const accts = await prisma.glAccount.findMany({ where: { code: { in: ['2000', '5200'] } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== 2) throw new Error('GL account missing — nothing changed.');
  if (!existsSync(join(ROOT, FILE))) throw new Error(`Missing ${FILE} — nothing changed.`);
  const card = await prisma.journalEntry.findMany({ where: { memo: { contains: '[CARDREST2025]' }, AND: [{ memo: { contains: 'THE PARTS DEKALB' } }, { memo: { contains: '001677' } }] }, include: { lines: { include: { account: true } } } });
  if (card.length !== 1) throw new Error(`Expected 1 card entry for The Parts Place, found ${card.length} — nothing changed.`);
  const cardDr = card[0].lines.find((l) => l.account.code === '5200');
  if (!cardDr || Math.abs(dec(cardDr.debit) - AED) > 0.005) throw new Error('Card entry amount is not 3,703.46 on 5200 — nothing changed.');
  if ((await prisma.expense.count({ where: { invoiceNumber: '171552' } })) > 0) throw new Error('Invoice 171552 already booked — nothing changed.');
  const ref = await prisma.expense.findFirst({ where: { expenseNumber: 'EXP-2025-0009' }, select: { createdById: true } });
  if (!ref) throw new Error('Reference expense EXP-2025-0009 missing — nothing changed.');
  const last25 = await prisma.expense.findMany({ where: { expenseNumber: { startsWith: 'EXP-2025-' } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 });
  const expNo = `EXP-2025-${String(parseInt(last25[0].expenseNumber.slice(-4), 10) + 1).padStart(4, '0')}`;

  console.log(`  supplier  The Parts Place Inc. (USA, no TRN)`);
  console.log(`  ${expNo}  2025-10-10  invoice 171552  AED ${AED} (USD 972.88)  VAT nil  Dr 5200 / Cr 2000`);
  console.log(`  2025-10-13  card ${card[0].entryNumber} re-pointed: Dr 2000 ${AED} / Cr 5200 ${AED}  [SETTLES ${expNo}]`);
  console.log(`  attach ${FILE} -> expense (SOURCE) + supplier document (INVOICE)`);
  if (DRY) { console.log('\n=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }

  mkdirSync(UPLOADS, { recursive: true });
  const upName = `supplier-2025-${FILE.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`;
  const dest = join(UPLOADS, upName);
  if (!existsSync(dest)) copyFileSync(join(ROOT, FILE), dest);
  const url = `/uploads/${upName}`;
  const size = statSync(dest).size;

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
    let sup = await tx.supplier.findFirst({ where: { name: 'The Parts Place Inc.' } });
    if (!sup) sup = await tx.supplier.create({ data: { name: 'The Parts Place Inc.', tradeName: 'The Parts Place', address: '630 Enterprise Ave', city: 'Dekalb, IL 60115', country: 'USA', email: 'sales@thepartsplaceinc.com', phone: '+1 630 365 1800', website: 'www.thepartsplaceinc.com', categories: ['Auto Parts'], category: 'Auto Parts' } });
    const desc = 'The Parts Place (USA) order 270939 — 1971 Chevrolet Nova front-end parts: grille SS, grille support brackets LH/RH, headlamp bezels, mounting buckets x2, trim rings x2, adjuster kit, front chrome bumper, bumper filler brace, hood molding; USD 852.88 + UPS shipping 120.00 = USD 972.88';
    const e = await tx.expense.create({
      data: {
        expenseNumber: expNo, category: 'Maintenance', description: desc.slice(0, 250), amount: AED, vatAmount: 0, totalAmount: AED,
        expenseDate: day('2025-10-10'), status: 'PAID', paidAt: day('2025-10-13'), approvedAt: new Date(), vendorName: 'The Parts Place Inc.', supplierId: sup.id,
        invoiceNumber: '171552', invoiceDate: day('2025-10-10'), sourceRef: `${TAG}:171552`, createdById: ref.createdById,
        notes: `${TAG} USD 972.88 charged to company MasterCard 3825 (transaction 81248307678); AED ${AED} as debited by ADCB on 13 Oct 2025. Foreign seller — no UAE VAT charged.`,
      },
    });
    await je('2025-10-10', `Expense ${expNo} ${TAG} The Parts Place invoice 171552 — 1971 Chevrolet Nova parts, USD 972.88`, [['5200', AED, 0, 'Vehicle parts — The Parts Place 171552'], ['2000', 0, AED, 'Accounts Payable — The Parts Place']], 'EXPENSE', e.id);
    await je('2025-10-13', `[CARD2025][SETTLES ${expNo}] ${TAG} Card line ${card[0].entryNumber} (PUR 10/10 972.88 USD THE PARTS DEKALB 3825 001677), booked as cost by [CARDREST2025], pays invoice 171552 — re-pointed to the payable.`, [['2000', AED, 0, `The Parts Place — ${expNo}`], ['5200', 0, AED, 'Reverse: now settles the invoice']]);
    await tx.documentAttachment.create({ data: { entityType: 'EXPENSE', entityId: e.id, kind: 'SOURCE', name: 'INVOICE 171552 — The Parts Place Inc., USD 972.88', provider: 'UPLOAD', url, mimeType: 'application/pdf', sizeBytes: size, sourceRef: `file:${FILE}`, notes: `Billed to The Film Makers FZ LLC; paid on company MasterCard 3825. Supplied by the GM 21 Sep 2026. Original: ${join(ROOT, FILE)}` } });
    await tx.supplierDocument.create({ data: { supplierId: sup.id, docType: 'INVOICE', name: 'INVOICE 171552 — The Parts Place Inc., USD 972.88', fileUrl: url, notes: `${expNo} — the invoice. ${TAG}` } });
  });

  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`  trial balance difference ${all.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  const e = await prisma.expense.findUnique({ where: { expenseNumber: expNo } });
  console.log(`  ${expNo}: attachments ${await prisma.documentAttachment.count({ where: { entityType: 'EXPENSE', entityId: e!.id } })}, supplier docs ${await prisma.supplierDocument.count({ where: { supplierId: e!.supplierId!, fileUrl: url } })}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
