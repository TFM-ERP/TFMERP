/**
 * fix-shatry-20aug-2025.ts
 *
 * Shatry tax invoice STE-01/SI/25-24631, dated 20-Aug-2025 — one purchase:
 * RESERVOIR,CLNT 252.35 · OILTRANSMISSION x7 140.58 · COOLANT RAD 4% 26.29 ·
 * FILTERTRANS 150.36 · COOLANT DEXCOOL x2 90.43, discount 0.87,
 * 628.57 + VAT 31.43 = 660.00, mode of payment Cash.
 *
 * The books hold that same 660.00 four times — filed-2025-2026-0001, -0004, -0014 and -0017,
 * which are Q3 return lines R4, R7, R17 and R20. Only one invoice exists, for one purchase,
 * and its date matches the rows exactly (20 Aug 2025), so the surviving row keeps its date.
 *
 *   filed-0001 survives: it takes the real invoice number and date, is re-categorised to
 *   Maintenance (coolant, transmission oil, a filter — not office supplies), its journal
 *   line moves 6200 -> 5200, the invoice is attached to it and to the supplier, and the
 *   660.00 is paid out of 1000 Cash on Hand as the invoice states.
 *
 *   filed-0004, -0014 and -0017 are reversed (Dr 2000 / Cr 6200 / Cr 1200, 20 Aug 2025)
 *   and marked REJECTED. Cost -1,980.00, input VAT -94.29.
 *
 * The Q3 2025 VAT return as filed claimed all four lines, so the return and the books will
 * differ by 94.29 of input VAT. That is for the adviser — it is below the AED 10,000
 * voluntary-disclosure threshold and belongs in the next return.
 *
 * Idempotent (tag [SHATRY20AUG]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[SHATRY20AUG]';
const SRC = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices/Scan 23 Sep 2026/026_2025-08-20_Shatry_660.00.jpg';
const UPLOADS = join(__dirname, '..', 'uploads');
const DEST = 'supplier-2025-shatry-ste-01-si-25-24631-2025-08-20-660-cash.jpg';
const KEEP = 'filed-2025-2026-0001';
const DROP = ['filed-2025-2026-0004', 'filed-2025-2026-0014', 'filed-2025-2026-0017'];
const NET = 628.57;
const VAT = 31.43;
const TOT = 660;
const INV = 'STE-01/SI/25-24631';
const DATE = '2025-08-20';
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const f2 = (n: number): string => n.toFixed(2);

async function nextNumber(
  tx: Prisma.TransactionClient,
  model: 'payment' | 'journalEntry',
  prefix: string,
): Promise<string> {
  const rows =
    model === 'payment'
      ? await tx.payment.findMany({ where: { paymentNumber: { startsWith: prefix } }, select: { paymentNumber: true }, orderBy: { paymentNumber: 'desc' }, take: 1 })
      : await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
  const last = rows.length ? (Object.values(rows[0])[0] as string) : null;
  const n = last ? Number(last.slice(prefix.length)) : 0;
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

async function main(): Promise<void> {
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) {
    console.log('Already applied.');
    await prisma.$disconnect();
    return;
  }
  if (!existsSync(SRC)) throw new Error(`Invoice scan not found: ${SRC}`);

  const accts = await prisma.glAccount.findMany({
    where: { code: { in: ['1000', '1200', '2000', '5200', '6200'] } },
    select: { id: true, code: true },
  });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  for (const c of ['1000', '1200', '2000', '5200', '6200']) if (!acct.get(c)) throw new Error(`GL ${c} missing`);

  const rows = await prisma.expense.findMany({
    where: { expenseNumber: { in: [KEEP, ...DROP] } },
    select: { id: true, expenseNumber: true, status: true, totalAmount: true, vatAmount: true, supplierId: true },
  });
  if (rows.length !== 4) throw new Error(`Expected 4 rows, found ${rows.length}`);
  for (const r of rows) {
    if (Number(r.totalAmount) !== TOT || Number(r.vatAmount) !== VAT)
      throw new Error(`${r.expenseNumber} is ${f2(Number(r.totalAmount))}/${f2(Number(r.vatAmount))}, expected 660.00/31.43`);
    if (r.status !== 'APPROVED') throw new Error(`${r.expenseNumber} is ${r.status}, expected APPROVED`);
    if ((await prisma.payment.count({ where: { expenseId: r.id } })) > 0)
      throw new Error(`${r.expenseNumber} already has a payment — stop and check`);
  }
  const keep = rows.find((r) => r.expenseNumber === KEEP)!;
  if (!keep.supplierId) throw new Error(`${KEEP} has no supplier`);

  const keepEntry = await prisma.journalEntry.findFirst({
    where: { sourceType: 'EXPENSE', sourceId: keep.id },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  if (!keepEntry) throw new Error(`${KEEP} has no journal entry`);
  const costLine = keepEntry.lines.find((l) => l.account.code === '6200' && Number(l.debit) === NET);
  if (!costLine) throw new Error(`${KEEP} (${keepEntry.entryNumber}) has no 6200 debit of ${f2(NET)}`);

  const cash = await prisma.journalLine.aggregate({
    _sum: { debit: true, credit: true },
    where: { account: { code: '1000' }, entry: { date: { lte: day(DATE) } } },
  });
  const cashBal = Number(cash._sum.debit ?? 0) - Number(cash._sum.credit ?? 0);
  if (cashBal < TOT) throw new Error(`Cash on hand at ${DATE} is ${f2(cashBal)} — not enough for ${f2(TOT)}`);

  console.log(`Cash on hand at ${DATE}: ${f2(cashBal)}`);
  console.log(`Invoice ${INV}, ${DATE}: ${f2(NET)} + VAT ${f2(VAT)} = ${f2(TOT)}, cash.`);
  console.log(`  ${KEEP} survives — invoice number and date set, re-categorised to Maintenance,`);
  console.log(`  ${keepEntry.entryNumber} cost line moves 6200 -> 5200, invoice attached, paid from 1000.`);
  console.log(`  Reversed and rejected: ${DROP.join(', ')} — cost -1,980.00, input VAT -94.29.`);
  if (DRY) { console.log('\n--dry: nothing written.'); await prisma.$disconnect(); return; }

  copyFileSync(SRC, join(UPLOADS, DEST));
  const bytes = statSync(join(UPLOADS, DEST)).size;
  const name = `TAX INVOICE ${INV} — Shatry Trading LLC, 20/08/2025, 660.00 cash`;

  await prisma.$transaction(async (tx) => {
    // ---- the three duplicates ------------------------------------------------
    for (const num of DROP) {
      const r = rows.find((x) => x.expenseNumber === num)!;
      const src = await tx.journalEntry.findFirst({ where: { sourceType: 'EXPENSE', sourceId: r.id }, select: { entryNumber: true } });
      const revNo = await nextNumber(tx, 'journalEntry', 'JE-2026-');
      await tx.journalEntry.create({
        data: {
          entryNumber: revNo, date: day(DATE), source: 'SYSTEM', status: 'POSTED',
          postedAt: new Date(), sourceType: 'EXPENSE', sourceId: r.id,
          memo: `${TAG} Reverses ${num} (${src?.entryNumber ?? 'n/a'}). The 660.00 of 20/08/2025 is in the books four ` +
            `times (Q3 return lines R4, R7, R17, R20); Shatry issued one invoice, ${INV}, for one purchase. ` +
            `${KEEP} carries it. GM's decision, 23 Sep 2026.`,
          lines: { create: [
            { accountId: acct.get('2000') as string, description: 'Accounts Payable — reversed', debit: new Prisma.Decimal(TOT), credit: new Prisma.Decimal(0), sortOrder: 0 },
            { accountId: acct.get('6200') as string, description: 'Office & Admin — reversed', debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(NET), sortOrder: 1 },
            { accountId: acct.get('1200') as string, description: 'Input VAT — reversed', debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(VAT), sortOrder: 2 },
          ] },
        },
      });
      await tx.expense.update({
        where: { id: r.id },
        data: {
          status: 'REJECTED',
          rejectionReason: `${TAG} Duplicate of ${KEEP}. Shatry issued one invoice for 20/08/2025, ${INV}, ` +
            `660.00; the books carried it four times. Reversed by ${revNo}. The Q3 return as filed claimed ` +
            `all four lines — 94.29 of input VAT for the adviser to correct in the next return.`,
        },
      });
      console.log(`  ${num} reversed by ${revNo}.`);
    }

    // ---- the survivor --------------------------------------------------------
    await tx.journalLine.update({
      where: { id: costLine.id },
      data: { accountId: acct.get('5200') as string, description: 'Maintenance & Repairs' },
    });
    await tx.journalEntry.update({
      where: { id: keepEntry.id },
      data: {
        memo: `${keepEntry.memo ?? ''} ${TAG} Shatry ${INV} of 20/08/2025 — coolant, transmission oil and a ` +
          `filter; the cost line moves 6200 -> 5200. Three duplicate rows of the same 660.00 were reversed.`,
      },
    });
    await tx.expense.update({
      where: { id: keep.id },
      data: {
        category: 'Maintenance',
        invoiceNumber: INV,
        invoiceDate: day(DATE),
        supplierVatId: '100380648400003',
        description: `Shatry Trading LLC ${INV} — coolant reservoir, transmission oil x7, coolant rad, ` +
          `transmission filter, Dexcool x2. The only invoice behind the four 660.00 rows of 20/08/2025.`,
        status: 'PAID',
        paidAt: day(DATE),
        notes: `${TAG} Mode of payment: cash. Prepared by Anis. Invoice supplied in the 23 Sep 2026 scan.`,
      },
    });

    const payNo = await nextNumber(tx, 'payment', 'PAY-2025-');
    const pay = await tx.payment.create({
      data: {
        paymentNumber: payNo, direction: 'PAYMENT', supplierId: keep.supplierId as string, expenseId: keep.id,
        amount: new Prisma.Decimal(TOT), paymentDate: day(DATE), method: 'CASH', paidFrom: 'CASH_ON_HAND',
        status: 'CLEARED', clearedAt: day(DATE), reference: INV,
        notes: `${TAG} Paid in cash — the invoice prints "Mode of Payment Cash 660.00 AED".`,
      },
    });
    const payJe = await nextNumber(tx, 'journalEntry', 'JE-2026-');
    await tx.journalEntry.create({
      data: {
        entryNumber: payJe, date: day(DATE), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
        sourceType: 'PAYMENT', sourceId: pay.id,
        memo: `${TAG} ${payNo} settles ${KEEP} — Shatry ${INV}, cash.`,
        lines: { create: [
          { accountId: acct.get('2000') as string, description: 'Accounts Payable', debit: new Prisma.Decimal(TOT), credit: new Prisma.Decimal(0), sortOrder: 0 },
          { accountId: acct.get('1000') as string, description: 'Cash on Hand', debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(TOT), sortOrder: 1 },
        ] },
      },
    });

    for (const [entityType, entityId, kind] of [['EXPENSE', keep.id, 'SOURCE'], ['PAYMENT', pay.id, 'SUPPORTING']] as const) {
      await tx.documentAttachment.create({
        data: { entityType, entityId, kind, name, provider: 'UPLOAD', url: `/uploads/${DEST}`,
          mimeType: 'image/jpeg', sizeBytes: bytes, sourceRef: INV,
          notes: `${TAG} From the 23 Sep 2026 scan, page 026.` },
      });
    }
    await tx.supplierDocument.create({
      data: { supplierId: keep.supplierId as string, docType: 'INVOICE', name, fileUrl: `/uploads/${DEST}`,
        notes: `${TAG} 20/08/2025, 628.57 + VAT 31.43 = 660.00, cash. Booked as ${KEEP}.` },
    });
    console.log(`  ${KEEP} kept: invoice ${INV} attached, ${payNo} cash, cost line now 5200.`);
  });

  const g = await prisma.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  const tb = Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0);
  console.log(`Trial balance: ${f2(tb)}`);
  if (Math.abs(tb) > 0.005) throw new Error('Trial balance is not zero — investigate');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
