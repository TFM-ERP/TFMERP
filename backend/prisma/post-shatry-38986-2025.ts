/**
 * post-shatry-38986-2025.ts
 *
 * Shatry answered. Tax invoice STE-01/SI/25-38986, 31-Dec-2025, delivery note DV/14895,
 * to THE FILM MARKET FZ LLC, TRN 100600664500003: the same three lines as the proforma —
 * 2 x DEGREASER 71.36, 1 x PUMP P/S ASM 1,648.60, 1 x CLEANERCARB 20.04 — discount 0.96,
 * 1,657.14 + VAT 82.86 = 1,740.00, mode of payment Cash.
 *
 * So the purchase was real; only the document was wrong. filed-2025-2026-0088 (dated 23 Dec,
 * resting on proforma STE-01/SO/25-14147) stays REJECTED and reversed by JE-2026-1253 —
 * the cost is posted again here against the real invoice, on its real tax point of 31 Dec,
 * to 5200 Maintenance & Repairs (a power-steering pump and cleaners, not office supplies),
 * and paid out of 1000 Cash on Hand as the invoice states.
 *
 * Net against yesterday's books: same 1,740.00 of cost, moved from 23 to 31 December, from
 * 6200 to 5200, now with a tax invoice, an invoice number and a payment record. Both dates
 * fall in Q4, so the VAT return as filed is unaffected.
 *
 * Idempotent (tag [SHATRY38986]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[SHATRY38986]';
const ROOT = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const FILE = 'Shatry-STE-01-SI-25-38986-2025-12-31-1740-CASH.jpg';
const UPLOADS = join(__dirname, '..', 'uploads');
const DEST = 'supplier-2025-shatry-ste-01-si-25-38986-2025-12-31-1740-cash.jpg';
const NET = 1657.14;
const VAT = 82.86;
const TOT = 1740;
const INV = 'STE-01/SI/25-38986';
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const f2 = (n: number): string => n.toFixed(2);

async function nextNumber(
  tx: Prisma.TransactionClient,
  model: 'expense' | 'payment' | 'journalEntry',
  prefix: string,
): Promise<string> {
  const rows =
    model === 'expense'
      ? await tx.expense.findMany({ where: { expenseNumber: { startsWith: prefix } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 })
      : model === 'payment'
        ? await tx.payment.findMany({ where: { paymentNumber: { startsWith: prefix } }, select: { paymentNumber: true }, orderBy: { paymentNumber: 'desc' }, take: 1 })
        : await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
  const last = rows.length ? Object.values(rows[0])[0] as string : null;
  const n = last ? Number(last.slice(prefix.length)) : 0;
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

async function main(): Promise<void> {
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) {
    console.log('Already applied.');
    await prisma.$disconnect();
    return;
  }
  const src = join(ROOT, FILE);
  if (!existsSync(src)) throw new Error(`Invoice scan not found: ${src}`);

  const supplier = await prisma.supplier.findFirst({
    where: { name: { contains: 'Shatry', mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!supplier) throw new Error('Shatry supplier not found');

  const accts = await prisma.glAccount.findMany({
    where: { code: { in: ['1000', '1200', '2000', '5200'] } },
    select: { id: true, code: true },
  });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  for (const c of ['1000', '1200', '2000', '5200']) if (!acct.get(c)) throw new Error(`GL ${c} missing`);

  const pro = await prisma.expense.findUnique({
    where: { expenseNumber: 'filed-2025-2026-0088' },
    select: { id: true, status: true },
  });
  if (!pro) throw new Error('filed-2025-2026-0088 not found');
  if (pro.status !== 'REJECTED')
    throw new Error(`filed-2025-2026-0088 is ${pro.status}, expected REJECTED — the reversal must be in place first`);

  const user = await prisma.user.findFirst({ select: { id: true } });
  if (!user) throw new Error('No user to own the expense');

  const cash = await prisma.journalLine.aggregate({
    _sum: { debit: true, credit: true },
    where: { account: { code: '1000' }, entry: { date: { lt: day('2026-01-01') } } },
  });
  const cashBal = Number(cash._sum.debit ?? 0) - Number(cash._sum.credit ?? 0);
  if (cashBal < TOT) throw new Error(`Cash on hand at 31/12/2025 is ${f2(cashBal)} — not enough for ${f2(TOT)}`);
  console.log(`Cash on hand at 31/12/2025 before this: ${f2(cashBal)}`);
  console.log(`${supplier.name} — ${INV}, 31/12/2025: ${f2(NET)} + VAT ${f2(VAT)} = ${f2(TOT)}, paid cash.`);
  console.log('  Dr 5200 1,657.14 + Dr 1200 82.86 / Cr 2000 1,740.00, then Dr 2000 / Cr 1000 1,740.00.');
  console.log(`  Invoice attached to the expense and to the supplier; filed-2025-2026-0088 note updated.`);
  if (DRY) { console.log('\n--dry: nothing written.'); await prisma.$disconnect(); return; }

  copyFileSync(src, join(UPLOADS, DEST));
  const bytes = statSync(join(UPLOADS, DEST)).size;

  await prisma.$transaction(async (tx) => {
    const expNo = await nextNumber(tx, 'expense', 'EXP-2025-');
    const exp = await tx.expense.create({
      data: {
        expenseNumber: expNo,
        category: 'Maintenance',
        description:
          `Shatry Trading LLC ${INV} — power-steering pump assembly, degreaser and carb cleaner. ` +
          `Replaces filed-2025-2026-0088, which rested on proforma STE-01/SO/25-14147 made out to ` +
          `another customer; the supplier issued this tax invoice on 23 Sep 2026.`,
        amount: new Prisma.Decimal(NET),
        vatAmount: new Prisma.Decimal(VAT),
        totalAmount: new Prisma.Decimal(TOT),
        expenseDate: day('2025-12-31'),
        invoiceNumber: INV,
        invoiceDate: day('2025-12-31'),
        supplierId: supplier.id,
        supplierVatId: '100380648400003',
        vendorName: supplier.name,
        status: 'PAID',
        paidAt: day('2025-12-31'),
        createdById: user.id,
        notes: `${TAG} Delivery note DV/14895. Mode of payment: cash. Prepared by Anis.`,
      },
    });

    const jeNo = await nextNumber(tx, 'journalEntry', 'JE-2026-');
    await tx.journalEntry.create({
      data: {
        entryNumber: jeNo, date: day('2025-12-31'), source: 'SYSTEM', status: 'POSTED',
        postedAt: new Date(), sourceType: 'EXPENSE', sourceId: exp.id,
        memo: `${TAG} ${expNo} Shatry ${INV} of 31/12/2025 — the real tax invoice behind the reversed filed-2025-2026-0088.`,
        lines: { create: [
          { accountId: acct.get('5200') as string, description: 'Maintenance & Repairs', debit: new Prisma.Decimal(NET), credit: new Prisma.Decimal(0), sortOrder: 0 },
          { accountId: acct.get('1200') as string, description: 'Input VAT', debit: new Prisma.Decimal(VAT), credit: new Prisma.Decimal(0), sortOrder: 1 },
          { accountId: acct.get('2000') as string, description: 'Accounts Payable', debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(TOT), sortOrder: 2 },
        ] },
      },
    });

    const payNo = await nextNumber(tx, 'payment', 'PAY-2025-');
    const pay = await tx.payment.create({
      data: {
        paymentNumber: payNo, direction: 'PAYMENT', supplierId: supplier.id, expenseId: exp.id,
        amount: new Prisma.Decimal(TOT), paymentDate: day('2025-12-31'), method: 'CASH',
        paidFrom: 'CASH_ON_HAND', status: 'CLEARED', clearedAt: day('2025-12-31'),
        reference: INV,
        notes: `${TAG} Paid in cash — the invoice prints "Mode of Payment Cash 1,740.00 AED".`,
      },
    });
    const payJe = await nextNumber(tx, 'journalEntry', 'JE-2026-');
    await tx.journalEntry.create({
      data: {
        entryNumber: payJe, date: day('2025-12-31'), source: 'SYSTEM', status: 'POSTED',
        postedAt: new Date(), sourceType: 'PAYMENT', sourceId: pay.id,
        memo: `${TAG} ${payNo} settles ${expNo} — Shatry ${INV}, cash.`,
        lines: { create: [
          { accountId: acct.get('2000') as string, description: 'Accounts Payable', debit: new Prisma.Decimal(TOT), credit: new Prisma.Decimal(0), sortOrder: 0 },
          { accountId: acct.get('1000') as string, description: 'Cash on Hand', debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(TOT), sortOrder: 1 },
        ] },
      },
    });

    const name = `TAX INVOICE ${INV} — Shatry Trading LLC, 31/12/2025, 1,740.00 cash`;
    await tx.documentAttachment.create({
      data: {
        entityType: 'EXPENSE', entityId: exp.id, kind: 'SOURCE', name,
        provider: 'UPLOAD', url: `/uploads/${DEST}`, mimeType: 'image/jpeg', sizeBytes: bytes,
        sourceRef: INV,
        notes: `${TAG} Supplied by Shatry on 23 Sep 2026 after we asked for a tax invoice against proforma STE-01/SO/25-14147.`,
      },
    });
    await tx.documentAttachment.create({
      data: {
        entityType: 'PAYMENT', entityId: pay.id, kind: 'SUPPORTING', name,
        provider: 'UPLOAD', url: `/uploads/${DEST}`, mimeType: 'image/jpeg', sizeBytes: bytes,
        sourceRef: INV,
      },
    });
    await tx.supplierDocument.create({
      data: {
        supplierId: supplier.id, docType: 'INVOICE', name,
        fileUrl: `/uploads/${DEST}`,
        notes: `${TAG} 31/12/2025, 1,657.14 + VAT 82.86 = 1,740.00, cash. Delivery note DV/14895. Booked as ${expNo}.`,
      },
    });

    await tx.expense.update({
      where: { id: pro.id },
      data: {
        rejectionReason:
          `[DUPFIX2025] Proforma only (STE-01/SO/25-14147), made out to "84 ANIS CUSTOMERS" — not a ` +
          `tax invoice and not ours. Reversed by JE-2026-1253. ${TAG} 23 Sep 2026: Shatry issued the ` +
          `real tax invoice ${INV} dated 31/12/2025 for the same three lines; the purchase is booked ` +
          `as ${expNo} on its real tax point. Both dates fall in Q4, so the VAT return as filed is unaffected.`,
      },
    });

    console.log(`\nWritten: ${expNo}, ${jeNo}, ${payNo}, ${payJe}; invoice attached to the expense, the payment and the supplier.`);
  });

  const g = await prisma.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  const tb = Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0);
  console.log(`Trial balance: ${f2(tb)}`);
  if (Math.abs(tb) > 0.005) throw new Error('Trial balance is not zero — investigate');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
