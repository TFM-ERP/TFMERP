/**
 * artist-trailers-and-midjourney-2025.ts
 *
 * The GM supplied the two artist-trailer invoices on 21 Sep 2026:
 *  - MACGREGOR FZ LLE AJM501, 01/07/2025, 2,750.00 + 137.50 = 2,887.50 (EXP-2025-0001,
 *    already booked Dr 5000/1200 Cr 2000 and paid 26 Jul by transfer 515169203, JE-2026-1065).
 *    The PDF is attached; status -> PAID; supplier address and bank from the invoice.
 *  - MACQUIP MQ082, 06/12/2025, 2,000.00 + 100.00 = 2,100.00 (filed-2025-2026-0082). Same
 *    file as the copy already attached. Its payment — ADCB outward transfer 585783326 of
 *    2,100.00 on 22/12/2025, matched in accounts/2025-outgoing-identification.md — was
 *    never posted: posted now (Dr 2000 / Cr 1010), same treatment as AJM501. The cost is
 *    moved 6900 -> 5000 to match AJM501 (same service, artist trailer). EXP-2026-0009 (0.00,
 *    the same MQ082 imported from e-mail) is marked REJECTED as a duplicate. Bank from invoice.
 *  - Midjourney receipt 2RUQA65V, USD 302.40, 29/12/2025: it IS in the company bank —
 *    ADCB card 2528, 30/12/2025, AED 1,151.15 (JE-2026-1060, booked gross to 6900). The
 *    earlier note calling card 2528 "not the company card" was wrong. Expense record created
 *    (gross; the receipt is billed to Qais Qandil, so no input VAT) and the card line
 *    re-pointed to settle it.
 *
 * Idempotent (tag [TRAILERS2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[TRAILERS2025]';
const ROOT = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const UPLOADS = join(__dirname, '..', 'uploads');
const AJM_FILE = 'MacGregor-AJM501-2025-07-01-ArtistTrailer-2887.50.pdf';
const MJ_URL = '/uploads/received-receipt-2ruqa65v-0002-2025-12-29.pdf';
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
  const codes = ['1010', '2000', '5000', '6900'];
  const accts = await prisma.glAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== codes.length) throw new Error('GL account missing — nothing changed.');
  if (!existsSync(join(ROOT, AJM_FILE))) throw new Error(`Missing ${AJM_FILE} — nothing changed.`);
  if (!existsSync(join(UPLOADS, MJ_URL.replace('/uploads/', '')))) throw new Error('Midjourney receipt missing — nothing changed.');

  const ajm = await prisma.expense.findUnique({ where: { expenseNumber: 'EXP-2025-0001' } });
  const mq = await prisma.expense.findUnique({ where: { expenseNumber: 'filed-2025-2026-0082' } });
  const mqDup = await prisma.expense.findUnique({ where: { expenseNumber: 'EXP-2026-0009' } });
  if (!ajm || !mq || !mqDup) throw new Error('Expense missing — nothing changed.');
  if (dec(ajm.totalAmount) !== 2887.5 || ajm.invoiceNumber !== 'AJM501') throw new Error('EXP-2025-0001 not as measured — nothing changed.');
  if (!(await prisma.journalEntry.findFirst({ where: { entryNumber: 'JE-2026-1065', memo: { contains: 'AJM501' } } }))) throw new Error('AJM501 payment JE-2026-1065 not found — nothing changed.');
  if (dec(mq.totalAmount) !== 2100 || mq.paidAt) throw new Error('filed-0082 not as measured — nothing changed.');
  if (await prisma.journalEntry.count({ where: { memo: { contains: '585783326' } } })) throw new Error('Transfer 585783326 already posted — nothing changed.');
  const mqJe = await prisma.journalEntry.findFirst({ where: { sourceType: 'EXPENSE', sourceId: mq.id }, include: { lines: { include: { account: true } } } });
  if (!mqJe || !mqJe.lines.some((l) => l.account.code === '6900' && dec(l.debit) === 2000)) throw new Error('filed-0082 posting not Dr 6900 2,000 — nothing changed.');
  if (dec(mqDup.totalAmount) !== 0 || mqDup.invoiceNumber !== 'MQ082') throw new Error('EXP-2026-0009 not as measured — nothing changed.');
  const mjCard = await prisma.journalEntry.findUnique({ where: { entryNumber: 'JE-2026-1060' }, include: { lines: { include: { account: true } } } });
  if (!mjCard || mjCard.sourceType || !mjCard.memo?.includes('MIDJOURNEY') || !mjCard.lines.some((l) => l.account.code === '6900' && dec(l.debit) === 1151.15)) throw new Error('Midjourney card line JE-2026-1060 not as measured — nothing changed.');
  if (await prisma.expense.count({ where: { invoiceNumber: '2RUQA65V' } })) throw new Error('2RUQA65V already booked — nothing changed.');
  const mg = await prisma.supplier.findFirst({ where: { trn: '104313630600003' } });
  const mqs = await prisma.supplier.findFirst({ where: { trn: '104961238300003' } });
  const mjs = await prisma.supplier.findFirst({ where: { trn: '104681551800003' } });
  const mjDoc = await prisma.supplierDocument.findFirst({ where: { fileUrl: MJ_URL } });
  if (!mg || !mqs || !mjs || !mjDoc) throw new Error('Supplier or document missing — nothing changed.');
  const last25 = await prisma.expense.findMany({ where: { expenseNumber: { startsWith: 'EXP-2025-' } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 });
  const mjNo = `EXP-2025-${String(parseInt(last25[0].expenseNumber.slice(-4), 10) + 1).padStart(4, '0')}`;

  console.log('  EXP-2025-0001 MacGregor AJM501: attach invoice, status APPROVED -> PAID (paid 26/07/2025, JE-2026-1065)');
  console.log('  filed-0082 Macquip MQ082: payment 22/12/2025 transfer 585783326  Dr 2000 2,100.00 / Cr 1010 2,100.00; status PAID');
  console.log('  filed-0082 reclass  Dr 5000 2,000.00 / Cr 6900 2,000.00 (artist trailer, as AJM501); category Crew');
  console.log('  EXP-2026-0009 (0.00, same MQ082 from e-mail) -> REJECTED as duplicate');
  console.log(`  ${mjNo} Midjourney 2RUQA65V 1,151.15 gross  Dr 6900 / Cr 2000; card JE-2026-1060 re-pointed Dr 2000 / Cr 6900`);
  console.log('  MacGregor: Creative Tower, P.O. Box 4422, Fujairah; WIO IBAN AE510860000009334620522 · Macquip: WIO IBAN AE780860000009156397668');
  if (DRY) { console.log('\n=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }

  const upName = `supplier-2025-${AJM_FILE.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`;
  if (!existsSync(join(UPLOADS, upName))) copyFileSync(join(ROOT, AJM_FILE), join(UPLOADS, upName));
  const ajmUrl = `/uploads/${upName}`;
  const mjSize = statSync(join(UPLOADS, MJ_URL.replace('/uploads/', ''))).size;

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
    // MacGregor AJM501
    await tx.documentAttachment.create({ data: { entityType: 'EXPENSE', entityId: ajm.id, kind: 'SOURCE', name: 'TAX INVOICE AJM501 — MACGREGOR FZ LLE, 2,887.50', provider: 'UPLOAD', url: ajmUrl, mimeType: 'application/pdf', sizeBytes: statSync(join(UPLOADS, upName)).size, sourceRef: `file:${AJM_FILE}`, notes: `Artist trailer, 1 July 2025. Supplied by the GM 21 Sep 2026. Original: ${join(ROOT, AJM_FILE)} ${TAG}` } });
    await tx.supplierDocument.create({ data: { supplierId: mg.id, docType: 'INVOICE', name: 'TAX INVOICE AJM501 — MACGREGOR FZ LLE, 2,887.50', fileUrl: ajmUrl, notes: `EXP-2025-0001 — the invoice. ${TAG}` } });
    await tx.expense.update({ where: { id: ajm.id }, data: { status: 'PAID', notes: `${ajm.notes ?? ''}\n${TAG} Invoice PDF attached; paid 26/07/2025 by transfer 515169203 (JE-2026-1065).`.trim() } });
    await tx.supplier.update({ where: { id: mg.id }, data: { address: 'Creative Tower, P.O. Box 4422', city: 'Fujairah', bankName: 'WIO Bank', iban: 'AE510860000009334620522', swiftCode: 'WIOBAEADXXX', notes: `${mg.notes ?? ''}\n${TAG} From invoice AJM501: registered Creative Tower, Fujairah P.O. Box 4422; business address Etihad Airways Centre 5th Floor, Abu Dhabi; bank WIO.`.trim() } });
    // Macquip MQ082
    await je('2025-12-22', `${TAG} Payment of Macquip tax invoice MQ082 (filed-2025-2026-0082) — ADCB outward transfer 585783326, 22/12/2025. Matched in accounts/2025-outgoing-identification.md.`, [['2000', 2100, 0, 'Macquip — MQ082'], ['1010', 0, 2100, 'ADCB O/W TRF 585783326']]);
    await je('2025-12-06', `${TAG} filed-2025-2026-0082 Macquip MQ082 artist trailer reclassified 6900 -> 5000 Cost of Services, same as MacGregor AJM501.`, [['5000', 2000, 0, 'Artist trailer — Macquip MQ082'], ['6900', 0, 2000, 'Reclass to 5000']]);
    await tx.expense.update({ where: { id: mq.id }, data: { status: 'PAID', paidAt: day('2025-12-22'), category: 'Crew', notes: `${mq.notes ?? ''}\n${TAG} Paid 22/12/2025 by ADCB transfer 585783326. Cost moved 6900 -> 5000 (artist trailer). Invoice re-supplied by the GM 21 Sep 2026 — same file as the one attached.`.trim() } });
    await tx.expense.update({ where: { id: mqDup.id }, data: { status: 'REJECTED', rejectionReason: 'Duplicate of filed-2025-2026-0082 — same Macquip MQ082 invoice, imported from e-mail with no amount.', notes: `${mqDup.notes ?? ''}\n${TAG} Duplicate of filed-2025-2026-0082.`.trim() } });
    await tx.supplier.update({ where: { id: mqs.id }, data: { bankName: 'WIO Bank', bankAccount: '9156397668', iban: 'AE780860000009156397668', swiftCode: 'WIOBAEADXXX' } });
    // Midjourney
    const e = await tx.expense.create({
      data: {
        expenseNumber: mjNo, category: 'Software & Subscriptions', description: 'Midjourney Standard plan, 29 Dec 2025 – 29 Dec 2026, USD 288.00 + UAE VAT 14.40 = USD 302.40', amount: 1151.15, vatAmount: 0, totalAmount: 1151.15,
        expenseDate: day('2025-12-29'), status: 'PAID', paidAt: day('2025-12-30'), approvedAt: new Date(), vendorName: 'Midjourney Inc', supplierId: mjs.id,
        invoiceNumber: '2RUQA65V', invoiceDate: day('2025-12-29'), sourceRef: `${TAG}:2RUQA65V`, createdById: ajm.createdById,
        notes: `${TAG} Receipt 2RUQA65V. Paid on ADCB card 2528 (company account), AED 1,151.15 on 30/12/2025. Booked gross: the receipt is billed to Qais Qandil, not the company, so the UAE VAT on it is not claimed.`,
      },
    });
    await je('2025-12-29', `Expense ${mjNo} ${TAG} Midjourney receipt 2RUQA65V — annual Standard plan, USD 302.40`, [['6900', 1151.15, 0, 'Midjourney annual plan'], ['2000', 0, 1151.15, 'Accounts Payable — Midjourney']], 'EXPENSE', e.id);
    await je('2025-12-30', `[CARD2025][SETTLES ${mjNo}] ${TAG} Card line JE-2026-1060 (PUR 29/12 302.4 USD MIDJOURNEY 2528 590304), booked as cost, pays receipt 2RUQA65V — re-pointed to the payable.`, [['2000', 1151.15, 0, `Midjourney — ${mjNo}`], ['6900', 0, 1151.15, 'Reverse: now settles the receipt']]);
    await tx.documentAttachment.create({ data: { entityType: 'EXPENSE', entityId: e.id, kind: 'SOURCE', name: 'RECEIPT 2RUQA65V — Midjourney, USD 302.40', provider: 'UPLOAD', url: MJ_URL, mimeType: 'application/pdf', sizeBytes: mjSize, sourceRef: 'file:received-receipt-2ruqa65v-0002-2025-12-29.pdf', notes: TAG } });
    await tx.supplierDocument.update({ where: { id: mjDoc.id }, data: { docType: 'INVOICE', notes: `${mjNo} — the receipt. Standard plan 29 Dec 2025 – 29 Dec 2026, USD 288.00 + UAE VAT 14.40. Paid on ADCB card 2528 (company account), AED 1,151.15. ${TAG}` } });
  });

  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`\n  trial balance difference ${all.reduce((s, l) => s + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
