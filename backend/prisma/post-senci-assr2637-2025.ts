/**
 * post-senci-assr2637-2025.ts
 *
 * Senci General Trading LLC issued the tax invoice for the generator repair:
 * ASSR#2637, tax date 30/09/2025, our TRN 100600664500003, supplier TRN 100342406400003,
 * terms CASH — wheels x8 400.00, air filter cartridge 70.00, spark plug components x3 75.00,
 * inverter SM9500Di x2 850.00, cylinder head cover gasket 35.00, engine oil 30.00.
 * Subtotal 1,390.48 + VAT 69.52 = 1,460.00.
 *
 * EXP-2025-0013 already carries the 1,460.00, but as 1,460.00 of cost with no VAT, dated
 * 30/07/2025 and numbered SB25070034 — which is the *quotation*, the weakest of the three
 * documents. The tax invoice is dated 30/09/2025 and the repair form gives 30/09/25 as the
 * delivery date, so the tax point is 30 September. The row and its cash entry move there.
 *
 *   - 1,460.00 gross splits into 1,390.48 cost + 69.52 input VAT;
 *   - expense and journal re-dated to 30/09/2025, invoice number ASSR#2637;
 *   - the missing payment record is created (cash, as the invoice states);
 *   - the tax invoice is attached to the expense, the payment and the supplier; the existing
 *     SB25070034 service document stays attached as supporting.
 *
 * Cost -69.52, input VAT +69.52. No VAT was ever claimed on this purchase, so the 69.52 is a
 * new claim for the adviser, in the quarter containing 30 September 2025.
 *
 * Idempotent (tag [SENCI2637]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[SENCI2637]';
const SRC = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices/Senci-ASSR2637-2025-09-30-1460-CASH.pdf';
const UPLOADS = join(__dirname, '..', 'uploads');
const DEST = 'supplier-2025-senci-assr2637-2025-09-30-1460-cash.pdf';
const EXP = 'EXP-2025-0013';
const OLD_NET = 1460;
const NET = 1390.48, VAT = 69.52, TOT = 1460;
const INV = 'ASSR#2637';
const DATE = '2025-09-30';
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
  if (!existsSync(SRC)) throw new Error(`Invoice not found: ${SRC}`);

  const accts = await prisma.glAccount.findMany({
    where: { code: { in: ['1000', '1200', '5200'] } }, select: { id: true, code: true },
  });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  for (const c of ['1000', '1200', '5200']) if (!acct.get(c)) throw new Error(`GL ${c} missing`);

  const exp = await prisma.expense.findUnique({
    where: { expenseNumber: EXP },
    select: { id: true, amount: true, vatAmount: true, totalAmount: true, supplierId: true, status: true },
  });
  if (!exp) throw new Error(`${EXP} not found`);
  if (Number(exp.totalAmount) !== TOT || Number(exp.vatAmount) !== 0)
    throw new Error(`${EXP} is ${f2(Number(exp.totalAmount))}/${f2(Number(exp.vatAmount))}, expected 1460.00/0.00`);
  if (!exp.supplierId) throw new Error(`${EXP} has no supplier`);
  if ((await prisma.payment.count({ where: { expenseId: exp.id } })) > 0)
    throw new Error(`${EXP} already has a payment record`);

  const entry = await prisma.journalEntry.findFirst({
    where: { sourceType: 'EXPENSE', sourceId: exp.id },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  if (!entry) throw new Error(`${EXP} has no journal entry`);
  const dCost = entry.lines.find((l) => l.account.code === '5200' && Number(l.debit) === OLD_NET);
  const cCash = entry.lines.find((l) => l.account.code === '1000' && Number(l.credit) === TOT);
  if (!dCost || !cCash) throw new Error(`${entry.entryNumber} is not Dr 5200 1,460.00 / Cr 1000 1,460.00`);

  const cash = await prisma.journalLine.aggregate({
    _sum: { debit: true, credit: true },
    where: { account: { code: '1000' }, entry: { date: { lte: day(DATE) } } },
  });
  const cashBal = Number(cash._sum.debit ?? 0) - Number(cash._sum.credit ?? 0);
  console.log(`Cash on hand at ${DATE} (with this 1,460.00 already out, moving within the year): ${f2(cashBal)}`);
  if (cashBal < 0) throw new Error('Cash on hand would be negative — investigate');

  console.log(`${EXP} (${entry.entryNumber}): 1,460.00 cost + 0.00 VAT on 30/07  ->  ${f2(NET)} + ${f2(VAT)} on ${DATE}`);
  console.log(`  invoice number SB25070034 (a quotation) -> ${INV}; the tax invoice is attached and a cash payment recorded.`);
  console.log('Effect: 2025 cost -69.52, input VAT +69.52 — a new claim, never made before.');
  if (DRY) { console.log('\n--dry: nothing written.'); await prisma.$disconnect(); return; }

  copyFileSync(SRC, join(UPLOADS, DEST));
  const bytes = statSync(join(UPLOADS, DEST)).size;
  const name = `TAX INVOICE ${INV} — Senci General Trading LLC, 30/09/2025, 1,460.00 cash`;

  await prisma.$transaction(async (tx) => {
    await tx.journalLine.update({ where: { id: dCost.id }, data: { debit: new Prisma.Decimal(NET) } });
    await tx.journalLine.create({
      data: { entryId: entry.id, accountId: acct.get('1200') as string, description: 'Input VAT',
        debit: new Prisma.Decimal(VAT), credit: new Prisma.Decimal(0), sortOrder: 1 },
    });
    await tx.journalLine.update({ where: { id: cCash.id }, data: { sortOrder: 2 } });
    await tx.journalEntry.update({
      where: { id: entry.id },
      data: {
        date: day(DATE),
        memo: `${entry.memo ?? ''} ${TAG} Tax invoice ${INV} of 30/09/2025 supplied 23 Sep 2026: ` +
          `1,390.48 + VAT 69.52 = 1,460.00. The 1,460.00 had been posted gross with no VAT and dated ` +
          `30/07/2025 from quotation SB25070034; the tax point is the invoice date, and the repair form ` +
          `gives 30/09/25 as the delivery date.`,
      },
    });
    await tx.expense.update({
      where: { id: exp.id },
      data: {
        expenseDate: day(DATE), amount: new Prisma.Decimal(NET), vatAmount: new Prisma.Decimal(VAT),
        invoiceNumber: INV, invoiceDate: day(DATE), supplierVatId: '100342406400003',
        paidAt: day(DATE),
        description: `Senci General Trading LLC tax invoice ${INV} — generator SM9500Di: wheels x8, air ` +
          `filter cartridge, spark plug components x3, inverter x2, cylinder head cover gasket, engine oil. ` +
          `Repair form 2637, work done 23/07/2025, delivered 30/09/2025.`,
        notes: `${TAG} Was 1,460.00 gross with no VAT, dated 30/07/2025 from quotation SB25070034. ` +
          `Terms on the invoice: CASH. The repair form carries a handwritten bank reference ` +
          `530PD917CCB2B9BS — no bank line of 1,460.00 exists in the 2025 statements, so the cash posting stands.`,
      },
    });

    const payNo = await nextPay(tx);
    const pay = await tx.payment.create({
      data: {
        paymentNumber: payNo, direction: 'PAYMENT', supplierId: exp.supplierId as string, expenseId: exp.id,
        amount: new Prisma.Decimal(TOT), paymentDate: day(DATE), method: 'CASH', paidFrom: 'CASH_ON_HAND',
        status: 'CLEARED', clearedAt: day(DATE), reference: INV,
        notes: `${TAG} Cash, as the invoice states (Terms: CASH). Posted in the ledger by ${entry.entryNumber}.`,
      },
    });
    await tx.journalEntry.update({ where: { id: entry.id }, data: { sourceType: 'EXPENSE', sourceId: exp.id } });

    for (const [entityType, entityId, kind] of [['EXPENSE', exp.id, 'SOURCE'], ['PAYMENT', pay.id, 'SUPPORTING']] as const) {
      await tx.documentAttachment.create({
        data: { entityType, entityId, kind, name, provider: 'UPLOAD', url: `/uploads/${DEST}`,
          mimeType: 'application/pdf', sizeBytes: bytes, sourceRef: INV,
          notes: `${TAG} Supplied by Senci on 23 Sep 2026 after the repair form was found without a tax invoice.` },
      });
    }
    await tx.supplierDocument.create({
      data: { supplierId: exp.supplierId as string, docType: 'INVOICE', name, fileUrl: `/uploads/${DEST}`,
        notes: `${TAG} 30/09/2025, 1,390.48 + VAT 69.52 = 1,460.00, cash. Booked as ${EXP}, paid by ${payNo}.` },
    });
    console.log(`\nWritten: ${EXP} split and re-dated, ${payNo} created, ${INV} attached.`);
  });

  const g = await prisma.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  const tb = Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0);
  console.log(`Trial balance: ${f2(tb)}`);
  if (Math.abs(tb) > 0.005) throw new Error('Trial balance is not zero — investigate');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
