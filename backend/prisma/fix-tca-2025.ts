/**
 * fix-tca-2025.ts
 *
 * TCA Auto Garage tax invoice 16300, 06/12/2025, to The Film Makers FZ LLC (correct name and TRN),
 * Acura/CL vehicle 6122515472910/AUH: one adjustable aluminium trailer hitch ball.
 * Total 475.00, discount 22.62, sub-total 452.38, VAT 22.62, net total 475.00 — paid by CARD,
 * receipt 15,413, the same day.
 *
 * The books hold the same purchase twice, and the filed figure is wrong:
 *   JE-2026-1004 (08/12) — the ADCB card line "PUR 06/12 TCA AUTO G ABU DHABI 3825 448211",
 *     475.00 gross straight to 5200;
 *   filed-2025-2026-0091 (16/12) — 475.00 **plus** 23.75 VAT = 498.75 (JE-2026-0333), because
 *     whoever keyed the return treated the gross 475.00 as net and added 5% on top.
 *
 * Fix, the same shape as the Carzhub correction:
 *   - filed-0091 is corrected to the invoice: 452.38 + 22.62 = 475.00, dated 06/12, with the
 *     invoice number, the supplier and the document on it;
 *   - the card line is re-pointed from 5200 to 2000 Accounts Payable so it *pays* that expense
 *     instead of charging the cost a second time, and PAY-2025-NNNN records it.
 *
 * Cost 950.00 -> 452.38 (-497.62). Input VAT 23.75 -> 22.62 (-1.13).
 *
 * Note for the adviser: the invoice prints two different supplier TRNs — 100460815200003 in the
 * header and 104105383400003 beside "TAX INVOICE". One is wrong, which matters for the 22.62.
 *
 * Idempotent (tag [TCAFIX2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[TCAFIX2025]';
const SRC = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices/Scan 23 Sep 2026/030_2025-12-06_TCA-Auto-Garage_475.00.jpg';
const UPLOADS = join(__dirname, '..', 'uploads');
const DEST = 'supplier-2025-tca-auto-garage-16300-2025-12-06-475-card.jpg';
const EXP = 'filed-2025-2026-0091';
const CARD_ENTRY = 'JE-2026-1004';
const OLD_NET = 475, OLD_VAT = 23.75, OLD_TOT = 498.75;
const NET = 452.38, VAT = 22.62, TOT = 475;
const INV = '16300';
const DATE = '2025-12-06';
const PAID = '2025-12-08';
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const f2 = (n: number): string => n.toFixed(2);

async function nextNumber(tx: Prisma.TransactionClient, prefix: string): Promise<string> {
  const rows = await tx.payment.findMany({
    where: { paymentNumber: { startsWith: prefix } },
    select: { paymentNumber: true }, orderBy: { paymentNumber: 'desc' }, take: 1,
  });
  const n = rows.length ? Number(rows[0].paymentNumber.slice(prefix.length)) : 0;
  return `${prefix}${String(n + 1).padStart(4, '0')}`;
}

async function main(): Promise<void> {
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) {
    console.log('Already applied.'); await prisma.$disconnect(); return;
  }
  if (!existsSync(SRC)) throw new Error(`Invoice scan not found: ${SRC}`);

  const accts = await prisma.glAccount.findMany({
    where: { code: { in: ['1010', '1200', '2000', '5200'] } }, select: { id: true, code: true },
  });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  for (const c of ['1010', '1200', '2000', '5200']) if (!acct.get(c)) throw new Error(`GL ${c} missing`);

  const exp = await prisma.expense.findUnique({
    where: { expenseNumber: EXP },
    select: { id: true, status: true, amount: true, vatAmount: true, totalAmount: true, supplierId: true },
  });
  if (!exp) throw new Error(`${EXP} not found`);
  if (Number(exp.totalAmount) !== OLD_TOT || Number(exp.vatAmount) !== OLD_VAT)
    throw new Error(`${EXP} is ${f2(Number(exp.totalAmount))}/${f2(Number(exp.vatAmount))}, expected 498.75/23.75`);
  if ((await prisma.payment.count({ where: { expenseId: exp.id } })) > 0)
    throw new Error(`${EXP} already has a payment record`);

  const expEntry = await prisma.journalEntry.findFirst({
    where: { sourceType: 'EXPENSE', sourceId: exp.id },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  if (!expEntry) throw new Error(`${EXP} has no journal entry`);
  const dCost = expEntry.lines.find((l) => l.account.code === '5200' && Number(l.debit) === OLD_NET);
  const dVat = expEntry.lines.find((l) => l.account.code === '1200' && Number(l.debit) === OLD_VAT);
  const cAp = expEntry.lines.find((l) => l.account.code === '2000' && Number(l.credit) === OLD_TOT);
  if (!dCost || !dVat || !cAp) throw new Error(`${expEntry.entryNumber} is not 5200 475.00 + 1200 23.75 / 2000 498.75`);

  const card = await prisma.journalEntry.findUnique({
    where: { entryNumber: CARD_ENTRY },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  if (!card) throw new Error(`${CARD_ENTRY} not found`);
  const cardDr = card.lines.find((l) => l.account.code === '5200' && Number(l.debit) === TOT);
  const cardCr = card.lines.find((l) => l.account.code === '1010' && Number(l.credit) === TOT);
  if (!cardDr || !cardCr) throw new Error(`${CARD_ENTRY} is not Dr 5200 475.00 / Cr 1010 475.00`);

  const supplier = exp.supplierId
    ? await prisma.supplier.findUnique({ where: { id: exp.supplierId }, select: { id: true, name: true } })
    : await prisma.supplier.findFirst({ where: { name: { contains: 'TCA', mode: 'insensitive' } }, select: { id: true, name: true } });
  if (!supplier) throw new Error('TCA supplier not found');

  console.log(`${EXP} (${expEntry.entryNumber}): 475.00 + 23.75 = 498.75 on 16/12  ->  452.38 + 22.62 = 475.00 on ${DATE}`);
  console.log(`${CARD_ENTRY} (08/12, 475.00): debit 5200 -> 2000, becomes the payment of ${EXP}`);
  console.log(`Supplier ${supplier.name}; invoice ${INV} attached to the expense, the payment and the supplier.`);
  console.log('Effect: 2025 cost -497.62 (950.00 -> 452.38), input VAT -1.13 (23.75 -> 22.62).');
  if (DRY) { console.log('\n--dry: nothing written.'); await prisma.$disconnect(); return; }

  copyFileSync(SRC, join(UPLOADS, DEST));
  const bytes = statSync(join(UPLOADS, DEST)).size;
  const name = `TAX INVOICE ${INV} — TCA Auto Garage LLC, 06/12/2025, 475.00 card`;

  await prisma.$transaction(async (tx) => {
    // ---- correct the filed row to the invoice --------------------------------
    await tx.journalLine.update({ where: { id: dCost.id }, data: { debit: new Prisma.Decimal(NET), description: 'Maintenance & Repairs' } });
    await tx.journalLine.update({ where: { id: dVat.id }, data: { debit: new Prisma.Decimal(VAT), description: 'Input VAT' } });
    await tx.journalLine.update({ where: { id: cAp.id }, data: { credit: new Prisma.Decimal(TOT), description: 'Accounts Payable' } });
    await tx.journalEntry.update({
      where: { id: expEntry.id },
      data: {
        date: day(DATE),
        memo: `${expEntry.memo ?? ''} ${TAG} Corrected to tax invoice ${INV} of 06/12/2025: 452.38 + VAT 22.62 = 475.00. ` +
          `The return line had 475.00 as net and added 5% on top (498.75, VAT 23.75), dated 16/12. GM's decision, 23 Sep 2026.`,
      },
    });
    await tx.expense.update({
      where: { id: exp.id },
      data: {
        expenseDate: day(DATE), amount: new Prisma.Decimal(NET), vatAmount: new Prisma.Decimal(VAT),
        totalAmount: new Prisma.Decimal(TOT), invoiceNumber: INV, invoiceDate: day(DATE),
        supplierId: supplier.id, vendorName: supplier.name, category: 'Maintenance',
        status: 'PAID', paidAt: day(PAID),
        description: `TCA Auto Garage LLC tax invoice ${INV} — adjustable aluminium trailer hitch ball, ` +
          `Acura/CL 6122515472910/AUH. 452.38 + VAT 22.62 = 475.00, paid by card, receipt 15,413.`,
        notes: `${TAG} Was 475.00 + 23.75 = 498.75 dated 16/12 — the gross was keyed as net. The card line ` +
          `${CARD_ENTRY} was a second charge for the same purchase and now settles this row. The invoice ` +
          `prints two different supplier TRNs (100460815200003 and 104105383400003) — one is wrong.`,
      },
    });

    // ---- the card line becomes the payment -----------------------------------
    const payNo = await nextNumber(tx, 'PAY-2025-');
    const pay = await tx.payment.create({
      data: {
        paymentNumber: payNo, direction: 'PAYMENT', supplierId: supplier.id, expenseId: exp.id,
        bankAccountId: (await tx.payment.findFirst({ where: { method: 'CARD', paidFrom: 'COMPANY_BANK', bankAccountId: { not: null } }, select: { bankAccountId: true } }))?.bankAccountId ?? null,
        amount: new Prisma.Decimal(TOT), paymentDate: card.date, method: 'CARD', paidFrom: 'COMPANY_BANK',
        status: 'CLEARED', clearedAt: card.date, reference: '3825 448211', payerAccountRef: '7701',
        notes: `${TAG} ADCB company card — statement line: "PUR 06/12 TCA AUTO G ABU DHABI 3825 448211". ` +
          `The garage receipt 15,413 of 06/12/2025 prints the same 475.00 paid by card.`,
      },
    });
    await tx.journalLine.update({ where: { id: cardDr.id }, data: { accountId: acct.get('2000') as string, description: `Accounts Payable — settles ${EXP}` } });
    await tx.journalEntry.update({
      where: { id: card.id },
      data: {
        sourceType: 'PAYMENT', sourceId: pay.id,
        memo: `${card.memo ?? ''} ${TAG} re-pointed to 2000 Accounts Payable: this card line pays ${EXP} ` +
          `(TCA invoice ${INV}). It had charged the same purchase to 5200 a second time.`,
      },
    });

    for (const [entityType, entityId, kind] of [['EXPENSE', exp.id, 'SOURCE'], ['PAYMENT', pay.id, 'SUPPORTING']] as const) {
      await tx.documentAttachment.create({
        data: { entityType, entityId, kind, name, provider: 'UPLOAD', url: `/uploads/${DEST}`,
          mimeType: 'image/jpeg', sizeBytes: bytes, sourceRef: INV, notes: `${TAG} From the 23 Sep 2026 scan, page 030.` },
      });
    }
    await tx.supplierDocument.create({
      data: { supplierId: supplier.id, docType: 'INVOICE', name, fileUrl: `/uploads/${DEST}`,
        notes: `${TAG} 06/12/2025, 452.38 + VAT 22.62 = 475.00, card. Booked as ${EXP}, paid by ${payNo}.` },
    });
    console.log(`\nWritten: ${EXP} corrected, ${CARD_ENTRY} re-pointed, ${payNo} created, invoice attached.`);
  });

  const g = await prisma.journalLine.aggregate({ _sum: { debit: true, credit: true } });
  const tb = Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0);
  console.log(`Trial balance: ${f2(tb)}`);
  if (Math.abs(tb) > 0.005) throw new Error('Trial balance is not zero — investigate');
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
