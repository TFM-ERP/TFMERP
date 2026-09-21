/**
 * post-tamara-samsung-2025.ts
 *
 * Two Samsung Gulf Electronics tax invoices (TRN 100382193900003), both billed to
 * THE FILM MAKERS FZ LLC, TRN 100600664500003, and paid through Tamara (buy now,
 * pay later) with the company card. Supplied by the GM 21 Sep 2026.
 *
 *   AE250728-86849517  28/07/2025  Galaxy Z Fold7 + accessories — company phone (GM)
 *       9,435.66 + VAT 471.78 = 9,907.44. NOT in the ledger or any VAT return.
 *       Paid by four Tamara card payments plus Tamara charges:
 *         28/07 2,502.89 · 01/09 154.30 · 22/09 2,502.86 · 28/09 154.30 + 2,502.86 ·
 *         04/10 2,657.16 (= 2,502.86 + 154.30)          total 10,474.37
 *       Each instalment is 1/4 of 9,907.44 (2,476.86) plus Tamara's ~1.05% fee; the
 *       three 154.30 lines are late-payment charges (no August payment was made).
 *       Tamara charges over the invoice: 566.93 -> 6500 Bank Charges.
 *
 *   AE251121-49119949  21/11/2025  Samsung 32" Smart Monitor M9, 3,594.00
 *       Already in the ledger as filed-2025-2026-0099 (Q4 return, vendor recorded as
 *       "Epilogue", 3,422.86 + 171.14). First Tamara instalment 21/11 907.95 =
 *       898.50 + 9.45 fee. The other three instalments (2,695.50) fall in 2026 and
 *       stay as a payable at 31 Dec 2025.
 *
 * The other nine 2025 Tamara payments (4,297.65) are for purchases not yet identified.
 *
 * Idempotent (tag [TAMARA2025]). Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[TAMARA2025]';
const TRN = '100382193900003';
const DOC_DIR = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const FOLD_DOC = 'Samsung-AE250728-86849517-GalaxyZFold7-9907.44-Tamara.pdf';
const MON_DOC = 'Samsung-AE251121-49119949-Monitor-M9-3594-Tamara.pdf';
const UPLOADS_DIR = join(__dirname, '..', 'uploads');

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const money = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// [posted date, card amount, narrative approval, principal part, charges part]
const FOLD_PAYMENTS: [string, number, string, number, number][] = [
  ['2025-07-30', 2502.89, 'PUR 28/07 Tamara Dubai 3825 993505', 2476.86, 26.03],
  ['2025-09-02', 154.30, 'PUR 01/09 Tamara Dubai 3825 607463', 0, 154.30],
  ['2025-09-23', 2502.86, 'PUR 22/09 Tamara Dubai 3825 060133', 2476.86, 26.00],
  ['2025-09-29', 154.30, 'PUR 28/09 Tamara Dubai 3825 995892', 0, 154.30],
  ['2025-09-29', 2502.86, 'PUR 28/09 Tamara Dubai 3825 995401', 2476.86, 26.00],
  ['2025-10-06', 2657.16, 'PUR 04/10 Tamara Dubai 3825 572647', 2476.86, 180.30],
];

async function nextNumber(tx: Prisma.TransactionClient, issued: Set<string>): Promise<string> {
  const prefix = `JE-${new Date().getFullYear()}-`;
  const last = await tx.journalEntry.findMany({ where: { entryNumber: { startsWith: prefix } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
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
  const codes = ['1010', '1200', '2000', '6200', '6500'];
  const accts = await prisma.glAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== codes.length) throw new Error('GL account missing — nothing changed.');

  const monitor = await prisma.expense.findUnique({ where: { expenseNumber: 'filed-2025-2026-0099' } });
  if (!monitor || dec(monitor.totalAmount) !== 3594 || monitor.paidAt) throw new Error('filed-2025-2026-0099 not as measured — nothing changed.');
  for (const [, , narr] of FOLD_PAYMENTS) {
    if ((await prisma.journalEntry.count({ where: { memo: { contains: narr.slice(-6) } } })) > 0) throw new Error(`${narr} already in the ledger — nothing changed.`);
  }
  if ((await prisma.journalEntry.count({ where: { memo: { contains: '669713' } } })) > 0) throw new Error('669713 already in the ledger — nothing changed.');
  if ((await prisma.expense.count({ where: { invoiceNumber: 'AE250728-86849517' } })) > 0) throw new Error('Z Fold invoice already in the ledger — nothing changed.');
  for (const f of [FOLD_DOC, MON_DOC]) if (!existsSync(join(DOC_DIR, f))) throw new Error(`Missing ${f} — nothing changed.`);

  const principal = FOLD_PAYMENTS.reduce((t, p) => t + p[3], 0);
  const charges = FOLD_PAYMENTS.reduce((t, p) => t + p[4], 0);
  const cash = FOLD_PAYMENTS.reduce((t, p) => t + p[1], 0);
  if (Math.abs(principal - 9907.44) > 0.005 || Math.abs(principal + charges - cash) > 0.005) throw new Error('Z Fold split does not add up — nothing changed.');

  const last = await prisma.expense.findMany({ where: { expenseNumber: { startsWith: 'EXP-2025-' } }, select: { expenseNumber: true }, orderBy: { expenseNumber: 'desc' }, take: 1 });
  const foldNo = `EXP-2025-${String((last.length ? parseInt(last[0].expenseNumber.slice(-4), 10) : 0) + 1).padStart(4, '0')}`;

  console.log(`  ${foldNo}  2025-07-28  Galaxy Z Fold7  9,435.66 + VAT 471.78 = 9,907.44   Dr 6200 + 1200 / Cr 2000`);
  for (const p of FOLD_PAYMENTS) console.log(`    ${p[0]}  ${money(p[1]).padStart(9)}  Dr 2000 ${money(p[3])} + Dr 6500 ${money(p[4])} / Cr 1010   ${p[2]}`);
  console.log(`    Tamara charges ${money(charges)}`);
  console.log('  filed-2025-2026-0099 monitor: 2025-11-24 907.95 = Dr 2000 898.50 + Dr 6500 9.45 / Cr 1010; 2,695.50 left payable (2026 instalments)');
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
            entryNumber: await nextNumber(tx, issued), date: day(date), memo: memo.slice(0, 480), source: 'SYSTEM',
            sourceType: sourceType ?? null, sourceId: sourceId ?? null, status: 'POSTED', postedAt: new Date(),
            lines: { create: lines.filter((l) => l[1] > 0 || l[2] > 0).map(([code, debit, credit, description]) => ({ accountId: acct.get(code)!, debit, credit, description })) },
          },
        });
      const attach = async (entityId: string, file: string, name: string, notes: string) => {
        const s = stored(file);
        await tx.documentAttachment.create({
          data: {
            entityType: 'EXPENSE', entityId, kind: 'SOURCE', name, provider: 'UPLOAD', url: `/uploads/${s}`,
            mimeType: 'application/pdf', sizeBytes: statSync(join(UPLOADS_DIR, s)).size, sourceRef: `file:${file}`,
            notes: `${notes} Supplied by the GM 21 Sep 2026. Original: ${join(DOC_DIR, file)}`,
          },
        });
      };

      let supplier = await tx.supplier.findFirst({ where: { OR: [{ trn: TRN }, { name: { contains: 'Samsung Gulf', mode: 'insensitive' } }] } });
      if (!supplier) {
        supplier = await tx.supplier.create({
          data: { name: 'Samsung Gulf Electronics FZE Dubai Branch', trn: TRN, city: 'Dubai', address: 'Butterfly Building Tower A, Al Bourooj Street, Dubai Media City', categories: ['Electronics'], category: 'Electronics' },
        });
      }

      // Z Fold7 — new expense, company phone
      const fold = await tx.expense.create({
        data: {
          expenseNumber: foldNo, category: 'Office', description: 'Samsung Galaxy Z Fold7 + accessories — company phone',
          amount: 9435.66, vatAmount: 471.78, totalAmount: 9907.44, expenseDate: day('2025-07-28'), status: 'PAID',
          paidAt: day('2025-10-04'), approvedAt: new Date(), vendorName: 'Samsung Gulf Electronics FZE Dubai Branch (via Tamara)',
          supplierVatId: TRN, supplierId: supplier.id, invoiceNumber: 'AE250728-86849517', invoiceDate: day('2025-07-30'),
          sourceRef: `${TAG}:zfold7`, createdById: monitor.createdById,
          notes: `${TAG} Tax invoice AE250728-86849517, billed to The Film Makers FZ LLC TRN 100600664500003. Galaxy Z Fold7 SM-F966B (IMEI 350312174151881) with Care+, film, 25W adapter, SmartTag2 x4. Company phone (GM, 21 Sep 2026). Paid through Tamara in four instalments on card 3825 (10,474.37 including 566.93 Tamara fees and late charges, booked to 6500). Input VAT 471.78 was not in the Q3 2025 return as filed.`,
        },
      });
      await je('2025-07-28', `Expense ${foldNo} ${TAG} Samsung Gulf Electronics AE250728-86849517 — Galaxy Z Fold7, company phone`,
        [['6200', 9435.66, 0, 'Company phone — Galaxy Z Fold7'], ['1200', 471.78, 0, 'Input VAT — Samsung AE250728-86849517'], ['2000', 0, 9907.44, 'Accounts Payable — Samsung via Tamara']], 'EXPENSE', fold.id);
      for (const [date, amount, narr, prin, chg] of FOLD_PAYMENTS) {
        await je(date, `[CARD2025][SETTLES ${foldNo}] ${TAG} ${narr} — Tamara instalment for the Z Fold7${chg > 0 ? ` (Tamara fee/late charge ${chg.toFixed(2)})` : ''}`,
          [['2000', prin, 0, `Samsung via Tamara — ${foldNo}`], ['6500', chg, 0, 'Tamara fee / late charge'], ['1010', 0, amount, `Bank — ${narr.slice(-11)}`]]);
      }
      await attach(fold.id, FOLD_DOC, 'TAX INVOICE AE250728-86849517 — Samsung Gulf Electronics, Galaxy Z Fold7', 'Billed to the company with its TRN; paid through Tamara.');

      // Monitor — already filed; first instalment + document
      await tx.expense.update({
        where: { id: monitor.id },
        data: {
          invoiceNumber: 'AE251121-49119949', supplierVatId: TRN,
          notes: `${monitor.notes ?? ''}\n[21 Sep 2026] ${TAG} Samsung Gulf Electronics tax invoice AE251121-49119949 (21/11/2025): 32" Smart Monitor M9 LS32FM902SMXUE, billed to the company with its TRN. Paid through Tamara in four instalments; the first (card 3825 approval 669713, 907.95 = 898.50 + 9.45 fee) was on 21/11/2025, the other three (2,695.50) in 2026.`,
        },
      });
      await je('2025-11-24', `[CARD2025][SETTLES filed-2025-2026-0099] ${TAG} PUR 21/11 Tamara Dubai 3825 669713 — first Tamara instalment for the Samsung M9 monitor`,
        [['2000', 898.5, 0, 'Samsung via Tamara — filed-2025-2026-0099'], ['6500', 9.45, 0, 'Tamara fee'], ['1010', 0, 907.95, 'Bank — 3825 669713']]);
      await attach(monitor.id, MON_DOC, 'TAX INVOICE AE251121-49119949 — Samsung Gulf Electronics, 32" Monitor M9', 'Billed to the company with its TRN; paid through Tamara.');
    },
    { timeout: 120000, maxWait: 30000 },
  );

  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`\n  trial balance difference ${all.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  const types = await prisma.glAccount.findMany({ select: { id: true, type: true } });
  const t = new Map(types.map((a) => [a.id, a.type]));
  const year = await prisma.journalLine.findMany({ where: { entry: { date: { gte: new Date('2025-01-01'), lte: new Date('2025-12-31T23:59:59Z') } } }, select: { accountId: true, debit: true, credit: true } });
  let r = 0;
  let x = 0;
  for (const l of year) {
    const n = dec(l.debit) - dec(l.credit);
    if (t.get(l.accountId) === 'INCOME') r -= n;
    if (t.get(l.accountId) === 'EXPENSE') x += n;
  }
  console.log(`  2025 PROFIT ${money(r - x)}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
