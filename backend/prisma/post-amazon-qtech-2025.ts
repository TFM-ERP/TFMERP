/**
 * post-amazon-qtech-2025.ts
 *
 * Four Amazon.ae tax invoices from Q-Tech General Trading LLC (TRN 100483307300003),
 * supplied by the GM 21 Sep 2026. All caravan/vehicle maintenance (5200).
 *
 *   QTG-INV-AE-2025-32387600  03/11/2025  towing mirrors (Chevy pickup)  1,173.89
 *       Already in the ledger TWICE: as filed-2025-2026-0093 (Q4 return, 1,117.99 +
 *       VAT 55.90 -> 6200 / AP) and as card entry JE-2026-0941 (Dr 6200 / Cr 1010,
 *       approval 885414). The double-count fix of 20 Sep missed it because the bank
 *       says "Amazon Ret" and the ledger says "Q-Tech". Fix: the card payment
 *       settles the payable (Dr 2000 / Cr 6200), and the net moves 6200 -> 5200.
 *   QTG-INV-AE-2025-31374878  26/10/2025  Hisense 12 kg washer (caravans)  1,999.00
 *       Paid inside card approval 260966, 2,057.00 (JE-2026-0928, all in 6200); the
 *       other 58.00 was another item in the order (GM). New expense, settled out of
 *       that card entry: Dr 2000 / Cr 6200 1,999.00.
 *   QTG-INV-AE-2025-31699583  28/10/2025  Samsung 11.5 kg washer (caravans)  1,884.95
 *       Delivered to Eyes of Emirates Auto Workshop, Mussafah. Cash on delivery (GM).
 *   QTG-INV-AE-2025-1115599   13/01/2025  12V electric trailer jack        706.79
 *       Cash on delivery (GM).
 *
 * VAT. All four invoices are addressed to individuals (Qais Qandil; two billed to
 * Fadi Salem, US), not to the company, so new rows are booked GROSS. The 55.90
 * already claimed on the mirrors in Q4 is left as filed, for the adviser.
 *
 * Idempotent (tag [AMAZONQT2025]). Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[AMAZONQT2025]';
const TRN = '100483307300003';
const DOC_DIR =
  '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const UPLOADS_DIR = join(__dirname, '..', 'uploads');

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface NewExp {
  key: string;
  date: string;
  total: number;
  invoice: string;
  description: string;
  file: string;
  paid: 'card' | 'cash';
  note: string;
}

const NEW: NewExp[] = [
  {
    key: 'hisense', date: '2025-10-26', total: 1999, invoice: 'QTG-INV-AE-2025-31374878',
    description: 'Hisense WF5S1245BB 12 kg washing machine — for the caravans',
    file: 'Amazon-QTech-QTG-INV-AE-2025-31374878-Hisense-washer-1999.pdf', paid: 'card',
    note: 'Amazon order 404-6316861-1552347, billed to Fadi Salem (US), delivered to Qais Qandil. Paid inside card 3825 approval 260966 (2,057.00; the other 58.00 was another item, GM).',
  },
  {
    key: 'samsung', date: '2025-10-28', total: 1884.95, invoice: 'QTG-INV-AE-2025-31699583',
    description: 'Samsung WW11BB944DGB 11.5 kg washing machine — for the caravans',
    file: 'Amazon-QTech-QTG-INV-AE-2025-31699583-Samsung-washer-1884.95.pdf', paid: 'cash',
    note: 'Amazon order 404-7025544-0769924, billed to Qais Qandil, delivered to Eyes of Emirates Auto Workshop, Mussafah M33. Cash on delivery (GM) — no ADCB debit.',
  },
  {
    key: 'jack', date: '2025-01-13', total: 706.79, invoice: 'QTG-INV-AE-2025-1115599',
    description: 'Buyers Products 12V electric trailer jack, 3,500 lb',
    file: 'Amazon-QTech-QTG-INV-AE-2025-1115599-trailer-jack-706.79.pdf', paid: 'cash',
    note: 'Amazon order 408-3182544-9072343, billed to Qais Qandil. Cash on delivery (GM) — no ADCB debit.',
  },
];

async function nextNumber(tx: Prisma.TransactionClient, issued: Set<string>): Promise<string> {
  const prefix = `JE-${new Date().getFullYear()}-`;
  const last = await tx.journalEntry.findMany({
    where: { entryNumber: { startsWith: prefix } },
    select: { entryNumber: true },
    orderBy: { entryNumber: 'desc' },
    take: 1,
  });
  let n = last.length > 0 ? parseInt(last[0].entryNumber.slice(-4), 10) : 0;
  let candidate = '';
  do {
    n += 1;
    candidate = `${prefix}${String(n).padStart(4, '0')}`;
  } while (issued.has(candidate));
  issued.add(candidate);
  return candidate;
}

async function main(): Promise<void> {
  console.log(DRY ? '=== DRY RUN, NOTHING WILL BE WRITTEN ===\n' : '=== APPLYING ===\n');
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) {
    console.log(`Already applied (${TAG}).`);
    await prisma.$disconnect();
    return;
  }
  const codes = ['1000', '2000', '5200', '6200'];
  const accts = await prisma.glAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== codes.length) throw new Error('GL account missing — nothing changed.');

  const mirrors = await prisma.expense.findUnique({ where: { expenseNumber: 'filed-2025-2026-0093' } });
  if (!mirrors || dec(mirrors.totalAmount) !== 1173.89 || dec(mirrors.amount) !== 1117.99 || mirrors.paidAt) {
    throw new Error('filed-2025-2026-0093 not as measured — nothing changed.');
  }
  for (const je of ['JE-2026-0941', 'JE-2026-0928']) {
    const e = await prisma.journalEntry.findUnique({ where: { entryNumber: je }, select: { memo: true } });
    if (!e || !e.memo?.includes('[CARD2025]')) throw new Error(`${je} not as measured — nothing changed.`);
  }
  for (const f of [...NEW.map((n) => n.file), 'Amazon-QTech-QTG-INV-AE-2025-32387600-towing-mirrors-1173.89.pdf']) {
    if (!existsSync(join(DOC_DIR, f))) throw new Error(`Missing ${f} — nothing changed.`);
  }
  const createdById = mirrors.createdById;
  const last = await prisma.expense.findMany({ where: { expenseNumber: { startsWith: 'EXP-2025-' } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 });
  let seq = last.length ? parseInt(last[0].expenseNumber.slice(-4), 10) : 0;
  const no = new Map(NEW.map((n) => [n.key, `EXP-2025-${String(++seq).padStart(4, '0')}`]));

  console.log('  filed-2025-2026-0093 mirrors: card JE-2026-0941 re-pointed Dr 2000 / Cr 6200 1,173.89; net 1,117.99 6200 -> 5200');
  for (const n of NEW) {
    console.log(`  ${no.get(n.key)}  ${n.date}  ${money(n.total).padStart(9)}  Dr 5200 / Cr 2000; paid ${n.paid === 'card' ? 'out of card 260966 (Cr 6200)' : 'Cr 1000 cash'}  ${n.description}`);
  }
  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  mkdirSync(UPLOADS_DIR, { recursive: true });
  const stored = (f: string): string => {
    const name = `supplier-2025-${f.toLowerCase().replace(/[^a-z0-9.-]+/g, '-')}`;
    const dest = join(UPLOADS_DIR, name);
    if (!existsSync(dest)) copyFileSync(join(DOC_DIR, f), dest);
    return name;
  };

  await prisma.$transaction(
    async (tx) => {
      const issued = new Set<string>();
      const je = async (date: string, memo: string, lines: [string, number, number, string][], sourceType?: string, sourceId?: string) =>
        tx.journalEntry.create({
          data: {
            entryNumber: await nextNumber(tx, issued),
            date: day(date),
            memo: memo.slice(0, 480),
            source: 'SYSTEM',
            sourceType: sourceType ?? null,
            sourceId: sourceId ?? null,
            status: 'POSTED',
            postedAt: new Date(),
            lines: { create: lines.map(([code, debit, credit, description]) => ({ accountId: acct.get(code)!, debit, credit, description })) },
          },
        });
      const attach = async (entityId: string, file: string, name: string, notes: string) => {
        const s = stored(file);
        await tx.documentAttachment.create({
          data: {
            entityType: 'EXPENSE', entityId, kind: 'SOURCE', name, provider: 'UPLOAD',
            url: `/uploads/${s}`, mimeType: 'application/pdf', sizeBytes: statSync(join(UPLOADS_DIR, s)).size,
            sourceRef: `file:${file}`,
            notes: `${notes} Supplied by the GM 21 Sep 2026. Original: ${join(DOC_DIR, file)}`,
          },
        });
      };

      let supplier = await tx.supplier.findFirst({ where: { OR: [{ trn: TRN }, { name: { contains: 'Q-Tech', mode: 'insensitive' } }] } });
      if (!supplier) {
        supplier = await tx.supplier.create({
          data: { name: 'Q-Tech General Trading LLC', tradeName: 'Amazon.ae seller', trn: TRN, city: 'Dubai', address: 'Ibn Battuta Gate office 602, The Gardens', categories: ['Online retail'], category: 'Online retail' },
        });
      } else if (!supplier.trn) {
        await tx.supplier.update({ where: { id: supplier.id }, data: { trn: TRN } });
      }

      // Mirrors: stop the double count and move to maintenance
      await tx.expense.update({
        where: { id: mirrors.id },
        data: {
          invoiceNumber: 'QTG-INV-AE-2025-32387600', paidAt: day('2025-11-03'), supplierId: supplier.id, supplierVatId: TRN,
          category: 'Maintenance',
          notes: `${mirrors.notes ?? ''}\n[21 Sep 2026] ${TAG} Amazon tax invoice QTG-INV-AE-2025-32387600: Sanooer towing mirrors for the Chevy pickup — vehicle maintenance (5200). Billed to Fadi Salem (US), delivered to Qais Qandil; not addressed to the company, so the 55.90 VAT claimed in Q4 is for the adviser. Paid by card 3825 approval 885414 (JE-2026-0941), which had also been booked as a second cost — corrected.`,
        },
      });
      await je('2025-11-05', `[CARD2025][SETTLES filed-2025-2026-0093] ${TAG} JE-2026-0941 (Amazon Ret 885414) was a second cost for the same towing mirrors — re-pointed to settle the payable.`,
        [['2000', 1173.89, 0, 'Q-Tech — filed-2025-2026-0093'], ['6200', 0, 1173.89, 'Reverse double-counted cost']]);
      await je('2025-11-03', `${TAG} filed-2025-2026-0093 towing mirrors for the Chevy pickup — vehicle maintenance.`,
        [['5200', 1117.99, 0, 'Maintenance — towing mirrors, Chevy pickup'], ['6200', 0, 1117.99, 'Reclassified from Office & Admin']]);
      await attach(mirrors.id, 'Amazon-QTech-QTG-INV-AE-2025-32387600-towing-mirrors-1173.89.pdf', 'TAX INVOICE QTG-INV-AE-2025-32387600 — Q-Tech (Amazon.ae), towing mirrors', 'Billed to Fadi Salem; delivered to Qais Qandil.');

      for (const n of NEW) {
        const e = await tx.expense.create({
          data: {
            expenseNumber: no.get(n.key)!, category: 'Maintenance', description: n.description,
            amount: n.total, vatAmount: 0, totalAmount: n.total, expenseDate: day(n.date), status: 'PAID',
            paidAt: day(n.date), approvedAt: new Date(), vendorName: 'Q-Tech General Trading LLC (Amazon.ae)',
            supplierVatId: TRN, supplierId: supplier.id, invoiceNumber: n.invoice, invoiceDate: day(n.date),
            sourceRef: `${TAG}:${n.key}`, createdById,
            notes: `${TAG} ${n.note} Booked GROSS: the invoice is not addressed to the company, so no input VAT is claimed.`,
          },
        });
        await je(n.date, `Expense ${e.expenseNumber} ${TAG} Q-Tech (Amazon.ae) ${n.invoice} — ${n.description}`,
          [['5200', n.total, 0, n.description.slice(0, 120)], ['2000', 0, n.total, 'Accounts Payable — Q-Tech (Amazon.ae)']], 'EXPENSE', e.id);
        if (n.paid === 'card') {
          await je(n.date, `[CARD2025][SETTLES ${e.expenseNumber}] ${TAG} 1,999.00 of card 3825 approval 260966 (JE-2026-0928, 2,057.00) paid this washer; the rest stays as a general Amazon purchase.`,
            [['2000', n.total, 0, `Q-Tech — ${e.expenseNumber}`], ['6200', 0, n.total, 'Out of the general Amazon card cost']]);
        } else {
          await je(n.date, `${TAG} ${e.expenseNumber} paid cash on delivery (GM, 21 Sep 2026).`,
            [['2000', n.total, 0, `Q-Tech — ${e.expenseNumber}`], ['1000', 0, n.total, 'Cash on Hand — cash on delivery']]);
        }
        await attach(e.id, n.file, `TAX INVOICE ${n.invoice} — Q-Tech (Amazon.ae)`, n.note);
      }
    },
    { timeout: 120000, maxWait: 30000 },
  );

  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`\n  trial balance difference ${all.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  const types = await prisma.glAccount.findMany({ select: { id: true, code: true, type: true } });
  const t = new Map(types.map((a) => [a.id, a]));
  const year = await prisma.journalLine.findMany({
    where: { entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } } },
    select: { accountId: true, debit: true, credit: true },
  });
  let r = 0;
  let x = 0;
  for (const l of year) {
    const n = dec(l.debit) - dec(l.credit);
    if (t.get(l.accountId)?.type === 'INCOME') r -= n;
    if (t.get(l.accountId)?.type === 'EXPENSE') x += n;
  }
  console.log(`  2025 PROFIT ${money(r - x)}`);
  for (const code of ['1000', '2000', '5200']) {
    const ls = await prisma.journalLine.findMany({ where: { account: { code } }, select: { debit: true, credit: true } });
    console.log(`  ${code} balance ${money(ls.reduce((s, l) => s + dec(l.debit) - dec(l.credit), 0))}`);
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
