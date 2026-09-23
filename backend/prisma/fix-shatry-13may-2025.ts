/**
 * fix-shatry-13may-2025.ts
 *
 * Shatry tax invoice STE-01/SI/25-14402, 13-May-2025: SENSOR CR/SH 182.05 and CLEANERCARB x3
 * 57.95, discount 8.73 — 228.57 + VAT 11.43 = 240.00, mode of payment Cash.
 *
 * filed-2025-2026-0122 carries the same day at 409.52 + 20.48 = 430.00 (Q2 return line R26),
 * with no supplier document number, unpaid, and no card line anywhere in mid-May for either
 * 430.00 or 240.00 — so there is no second purchase in the ledger to account for the difference.
 * The GM's instruction, 23 Sep 2026: book it per the invoice.
 *
 * The row is corrected to 228.57 + 11.43 = 240.00, given the real invoice number, re-categorised
 * to Maintenance with its cost line moved 6200 -> 5200 (a crankshaft sensor and carb cleaner),
 * the invoice attached to the expense, the payment and the supplier, and settled from cash.
 *
 * Cost -180.95, input VAT -9.05. The Q2 2025 return as filed claimed 20.48 — the 9.05 difference
 * is for the adviser. If a second Shatry invoice for 13 May turns up, this is the row to add it to.
 *
 * Idempotent (tag [SHATRY13MAY]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[SHATRY13MAY]';
const SRC = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices/Scan 23 Sep 2026/065_2025-05-13_Shatry_240.00.jpg';
const UPLOADS = join(__dirname, '..', 'uploads');
const DEST = 'supplier-2025-shatry-ste-01-si-25-14402-2025-05-13-240-cash.jpg';
const EXP = 'filed-2025-2026-0122';
const OLD_NET = 409.52, OLD_VAT = 20.48, OLD_TOT = 430;
const NET = 228.57, VAT = 11.43, TOT = 240;
const INV = 'STE-01/SI/25-14402';
const DATE = '2025-05-13';
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const f2 = (n: number): string => n.toFixed(2);

async function nextPay(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.payment.findMany({
    where: { paymentNumber: { startsWith: 'PAY-2025-' } },
    select: { paymentNumber: true }, orderBy: { paymentNumber: 'desc' }, take: 1,
  });
  const n = rows.length ? Number(rows[0].paymentNumber.slice(-4)) : 0;
  return `PAY-2025-${String(n + 1).padStart(4, '0')}`;
}

async function main(): Promise<void> {
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) {
    console.log('Already applied.'); await prisma.$disconnect(); return;
  }
  if (!existsSync(SRC)) throw new Error(`Invoice scan not found: ${SRC}`);

  const accts = await prisma.glAccount.findMany({
    where: { code: { in: ['1000', '1200', '2000', '5200', '6200'] } }, select: { id: true, code: true },
  });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  for (const c of ['1000', '1200', '2000', '5200', '6200']) if (!acct.get(c)) throw new Error(`GL ${c} missing`);

  const exp = await prisma.expense.findUnique({
    where: { expenseNumber: EXP },
    select: { id: true, amount: true, vatAmount: true, totalAmount: true, supplierId: true, status: true },
  });
  if (!exp) throw new Error(`${EXP} not found`);
  if (Number(exp.totalAmount) !== OLD_TOT || Number(exp.vatAmount) !== OLD_VAT)
    throw new Error(`${EXP} is ${f2(Number(exp.totalAmount))}/${f2(Number(exp.vatAmount))}, expected 430.00/20.48`);
  if (!exp.supplierId) throw new Error(`${EXP} has no supplier`);
  if ((await prisma.payment.count({ where: { expenseId: exp.id } })) > 0)
    throw new Error(`${EXP} already has a payment record`);

  const entry = await prisma.journalEntry.findFirst({
    where: { sourceType: 'EXPENSE', sourceId: exp.id },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  if (!entry) throw new Error(`${EXP} has no journal entry`);
  const dCost = entry.lines.find((l) => l.account.code === '6200' && Number(l.debit) === OLD_NET);
  const dVat = entry.lines.find((l) => l.account.code === '1200' && Number(l.debit) === OLD_VAT);
  const cAp = entry.lines.find((l) => l.account.code === '2000' && Number(l.credit) === OLD_TOT);
  if (!dCost || !dVat || !cAp) throw new Error(`${entry.entryNumber} is not 6200 409.52 + 1200 20.48 / 2000 430.00`);

  const cash = await prisma.journalLine.aggregate({
    _sum: { debit: true, credit: true },
    where: { account: { code: '1000' }, entry: { date: { lte: day(DATE) } } },
  });
  const cashBal = Number(cash._sum.debit ?? 0) - Number(cash._sum.credit ?? 0);
  if (cashBal < TOT) throw new Error(`Cash on hand at ${DATE} is ${f2(cashBal)} — not enough for ${f2(TOT)}`);

  console.log(`Cash on hand at ${DATE}: ${f2(cashBal)}`);
  console.log(`${EXP} (${entry.entryNumber}): 409.52 + 20.48 = 430.00  ->  ${f2(NET)} + ${f2(VAT)} = ${f2(TOT)}`);
  console.log(`  invoice ${INV} of ${DATE}; cost line 6200 -> 5200; paid from cash; invoice attached.`);
  console.log('Effect: 2025 cost -180.95, input VAT -9.05.');
  if (DRY) { console.log('\n--dry: nothing written.'); await prisma.$disconnect(); return; }

  copyFileSync(SRC, join(UPLOADS, DEST));
  const bytes = statSync(join(UPLOADS, DEST)).size;
  const name = `TAX INVOICE ${INV} — Shatry Trading LLC, 13/05/2025, 240.00 cash`;

  await prisma.$transaction(async (tx) => {
    await tx.journalLine.update({
      where: { id: dCost.id },
      data: { accountId: acct.get('5200') as string, debit: new Prisma.Decimal(NET), description: 'Maintenance & Repairs' },
    });
    await tx.journalLine.update({ where: { id: dVat.id }, data: { debit: new Prisma.Decimal(VAT) } });
    await tx.journalLine.update({ where: { id: cAp.id }, data: { credit: new Prisma.Decimal(TOT) } });
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: {
        memo: `${entry.memo ?? ''} ${TAG} Corrected to tax invoice ${INV} of 13/05/2025: 228.57 + VAT 11.43 ` +
          `= 240.00. The Q2 return line R26 carried 430.00 with no supplier document; no second purchase ` +
          `exists in the ledger for that day. Cost line moved 6200 -> 5200. GM's decision, 23 Sep 2026.`,
      },
    });
    await tx.expense.update({
      where: { id: exp.id },
      data: {
        amount: new Prisma.Decimal(NET), vatAmount: new Prisma.Decimal(VAT), totalAmount: new Prisma.Decimal(TOT),
        invoiceNumber: INV, invoiceDate: day(DATE), supplierVatId: '100380648400003', category: 'Maintenance',
        status: 'PAID', paidAt: day(DATE),
        description: `Shatry Trading LLC ${INV} — crankshaft sensor and carb cleaner x3.`,
        notes: `${TAG} Was 409.52 + 20.48 = 430.00 from Q2 return line R26, with no supplier document. ` +
          `Mode of payment on the invoice: cash. If a second Shatry invoice for 13/05/2025 turns up, add it ` +
          `as its own row rather than restoring the 430.00.`,
      },
    });

    const payNo = await nextPay(tx);
    const pay = await tx.payment.create({
      data: {
        paymentNumber: payNo, direction: 'PAYMENT', supplierId: exp.supplierId as string, expenseId: exp.id,
        amount: new Prisma.Decimal(TOT), paymentDate: day(DATE), method: 'CASH', paidFrom: 'CASH_ON_HAND',
        status: 'CLEARED', clearedAt: day(DATE), reference: INV,
        notes: `${TAG} Paid in cash — the invoice prints "Mode of Payment Cash 240.00 AED".`,
      },
    });
    const payJe = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: 'JE-2026-' } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
    const payNum = `JE-2026-${String(Number(payJe[0].entryNumber.slice(8)) + 1).padStart(4, '0')}`;
    await tx.journalEntry.create({
      data: {
        entryNumber: payNum, date: day(DATE), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
        sourceType: 'PAYMENT', sourceId: pay.id,
        memo: `${TAG} ${payNo} settles ${EXP} — Shatry ${INV}, cash.`,
        lines: { create: [
          { accountId: acct.get('2000') as string, description: 'Accounts Payable', debit: new Prisma.Decimal(TOT), credit: new Prisma.Decimal(0), sortOrder: 0 },
          { accountId: acct.get('1000') as string, description: 'Cash on Hand', debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(TOT), sortOrder: 1 },
        ] },
      },
    });

    for (const [entityType, entityId, kind] of [['EXPENSE', exp.id, 'SOURCE'], ['PAYMENT', pay.id, 'SUPPORTING']] as const) {
      await tx.documentAttachment.create({
        data: { entityType, entityId, kind, name, provider: 'UPLOAD', url: `/uploads/${DEST}`,
          mimeType: 'image/jpeg', sizeBytes: bytes, sourceRef: INV, notes: `${TAG} From the 23 Sep 2026 scan, page 065.` },
      });
    }
    await tx.supplierDocument.create({
      data: { supplierId: exp.supplierId as string, docType: 'INVOICE', name, fileUrl: `/uploads/${DEST}`,
        notes: `${TAG} 13/05/2025, 228.57 + VAT 11.43 = 240.00, cash. Booked as ${EXP}, paid by ${payNo}.` },
    });
    console.log(`\nWritten: ${EXP} corrected to the invoice, ${payNo} / ${payNum} cash, invoice attached.`);
  });

  const g = await prisma.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  const tb = Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0);
  console.log(`Trial balance: ${f2(tb)}`);
  if (Math.abs(tb) > 0.005) throw new Error('Trial balance is not zero — investigate');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
