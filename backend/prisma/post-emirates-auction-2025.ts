/**
 * post-emirates-auction-2025.ts
 *
 * The trailer caravan bought at Emirates Auction on 5 December 2025.
 *
 *   Statement of Purchase, lot 603365, gate pass ref 58991, car id 470641:
 *     auction amount 40,300.00 + VAT 2,015.00
 *     admin fees        600.00 + VAT    30.00
 *     loading/unloading 100.00 + VAT     5.00
 *     total          41,000.00 + VAT 2,050.00 = 43,050.00
 *   Paid 07/12/2025 by bank deposit 43,050.00; a further 105.00 deposited on
 *   08/12/2025 was moved to a security deposit on 09/12/2025.
 *
 * ALREADY IN THE LEDGER as filed-2025-2026-0085 (2025-Q4 VAT return): 41,000.00
 * to 6900 Other Expenses, 2,050.00 input VAT, 43,050.00 payable, never paid.
 *
 * WHAT THIS DOES
 *   1. A caravan is a fleet asset used over several years, so the 41,000.00 moves
 *      from 6900 to 1500 Rental Fleet & Equipment. The admin and loading fees are
 *      costs of acquiring it and are capitalised with it.
 *   2. The payment. No such debit exists on the ADCB statement. On the same day,
 *      07/12/2025 between 14:50 and 14:55, 20,000.00 was withdrawn in five ATM
 *      withdrawals at Hazza Bin Zayed, and the cash tin stood at 65,672.50 after
 *      them. The deposit was made in cash: Dr 2000 / Cr 1000 Cash on Hand.
 *   3. The 105.00 security deposit is money Emirates Auction still holds for the
 *      company: Dr 1300 / Cr 1000 on 08/12/2025.
 *
 * VAT. The 2,050.00 claimed in Q4 is left as filed. The Statement of Purchase is
 * addressed to QAIS MOHMD ISSA QANDIL, not the company, and is not titled a tax
 * invoice; whether the claim stands is for the tax adviser.
 *
 * DEPRECIATION is left to the fixed asset register.
 *
 * ALSO: records Heartland's TRN 100393810500003 on its supplier record, read off
 * its 2024 tax invoices (HL/245/2024, HL-INV 221/2024, HL/271/2024).
 *
 * Idempotent (tag [AUCTION2025]). Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { copyFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[AUCTION2025]';
const EXPENSE = 'filed-2025-2026-0085';
const DOC_DIR =
  '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/Supplier invoices';
const DOC = 'EmiratesAuction-2025-12-05-TrailerCaravan-lot603365-43050.pdf';
const STORED = 'supplier-2025-emiratesauction-2025-12-05-trailercaravan-lot603365-43050.pdf';
const UPLOADS_DIR = join(__dirname, '..', 'uploads');

const money = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

interface Line { code: string; debit?: number; credit?: number; description: string }
interface Journal { date: string; memo: string; lines: Line[] }

const JOURNALS: Journal[] = [
  {
    date: '2025-12-05',
    memo: `${TAG} Emirates Auction lot 603365, trailer caravan — capitalised as a fleet asset (auction 40,300.00 + admin 600.00 + loading 100.00). ${EXPENSE}.`,
    lines: [
      { code: '1500', debit: 41000, description: 'Rental Fleet — trailer caravan, Emirates Auction lot 603365' },
      { code: '6900', credit: 41000, description: 'Reclassified from Other Expenses' },
    ],
  },
  {
    date: '2025-12-07',
    memo: `${TAG} Emirates Auction lot 603365 paid by cash bank deposit 43,050.00 on 07/12/2025 — cash from the five ATM withdrawals of 20,000.00 the same afternoon plus cash already held. ${EXPENSE}.`,
    lines: [
      { code: '2000', debit: 43050, description: 'Emirates Auction — lot 603365' },
      { code: '1000', credit: 43050, description: 'Cash on Hand — deposited to Emirates Auction' },
    ],
  },
  {
    date: '2025-12-08',
    memo: `${TAG} Emirates Auction security deposit 105.00 — deposited 08/12/2025, moved to security deposit 09/12/2025. Refundable; held by Emirates Auction.`,
    lines: [
      { code: '1300', debit: 105, description: 'Security deposit held by Emirates Auction' },
      { code: '1000', credit: 105, description: 'Cash on Hand — deposited to Emirates Auction' },
    ],
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
    console.log(`Already applied (${TAG}). Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  const codes = ['1000', '1300', '1500', '2000', '6900'];
  const accts = await prisma.glAccount.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  for (const c of codes) if (!acct.has(c)) throw new Error(`GL account ${c} missing — nothing changed.`);

  const e = await prisma.expense.findUnique({ where: { expenseNumber: EXPENSE } });
  if (!e) throw new Error(`${EXPENSE} not found — nothing changed.`);
  if (dec(e.totalAmount) !== 43050 || dec(e.amount) !== 41000 || e.paidAt) {
    throw new Error(`${EXPENSE} is not as measured (total ${dec(e.totalAmount)}, paidAt ${e.paidAt}) — nothing changed.`);
  }
  const src = join(DOC_DIR, DOC);
  if (!existsSync(src)) throw new Error(`Missing ${src} — nothing changed.`);

  console.log(`  ${EXPENSE}  ${e.vendorName}  ${money(dec(e.totalAmount))}  -> paidAt 2025-12-07, note added\n`);
  for (const j of JOURNALS) {
    const d = j.lines.reduce((t, l) => t + (l.debit ?? 0), 0);
    const c = j.lines.reduce((t, l) => t + (l.credit ?? 0), 0);
    if (Math.abs(d - c) > 0.005) throw new Error('Unbalanced journal — nothing changed.');
    console.log(`  ${j.date}  ${j.memo.slice(0, 110)}`);
    for (const l of j.lines) {
      console.log(`      ${l.code}  ${(l.debit ? `Dr ${money(l.debit)}` : `Cr ${money(l.credit ?? 0)}`).padStart(14)}  ${l.description}`);
    }
  }
  console.log(`\n  attach SOURCE: ${DOC}`);
  console.log('  supplier Heartland: TRN 100393810500003 (only if blank)');

  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  mkdirSync(UPLOADS_DIR, { recursive: true });
  const dest = join(UPLOADS_DIR, STORED);
  if (!existsSync(dest)) copyFileSync(src, dest);

  await prisma.$transaction(
    async (tx) => {
      const issued = new Set<string>();
      await tx.expense.update({
        where: { id: e.id },
        data: {
          paidAt: day('2025-12-07'),
          invoiceNumber: 'EA-LOT-603365',
          invoiceDate: day('2025-12-05'),
          description: 'Trailer caravan — Emirates Auction lot 603365 (auction, admin fees, loading)',
          notes:
            `${e.notes ?? ''}\n[21 Sep 2026] ${TAG} Emirates Auction Statement of Purchase, lot ` +
            '603365, gate pass ref 58991: trailer caravan 40,300.00 + admin 600.00 + loading ' +
            '100.00 = 41,000.00 + VAT 2,050.00 = 43,050.00. Capitalised to 1500 as a fleet ' +
            'asset. Paid 07/12/2025 by cash bank deposit (20,000.00 withdrawn by ATM that ' +
            'afternoon). 105.00 security deposit held by Emirates Auction (1300). The statement ' +
            'is addressed to Qais personally, not the company, and is not a tax invoice — the ' +
            '2,050.00 input VAT claimed in Q4 is left as filed for the tax adviser.',
        },
      });
      // Heartland's TRN, from its 2024 tax invoices HL/245/2024, HL-INV 221/2024, HL/271/2024.
      await tx.supplier.updateMany({
        where: { name: 'Heartland', trn: null },
        data: { trn: '100393810500003', tradeName: 'Heartland Emirates Recreational Vehicles L.L.C' },
      });
      for (const j of JOURNALS) {
        await tx.journalEntry.create({
          data: {
            entryNumber: await nextNumber(tx, issued),
            date: day(j.date),
            memo: j.memo.slice(0, 480),
            source: 'SYSTEM',
            status: 'POSTED',
            postedAt: new Date(),
            lines: {
              create: j.lines.map((l) => ({
                accountId: acct.get(l.code)!,
                debit: l.debit ?? 0,
                credit: l.credit ?? 0,
                description: l.description,
              })),
            },
          },
        });
      }
      await tx.documentAttachment.create({
        data: {
          entityType: 'EXPENSE',
          entityId: e.id,
          kind: 'SOURCE',
          name: 'Emirates Auction Statement of Purchase + gate pass — lot 603365, trailer caravan, 43,050.00',
          provider: 'UPLOAD',
          url: `/uploads/${STORED}`,
          mimeType: 'application/pdf',
          sizeBytes: statSync(dest).size,
          sourceRef: `file:${DOC}`,
          notes: `Addressed to Qais personally; not a tax invoice. Supplied by the GM 21 Sep 2026. Original: ${src}`,
        },
      });
    },
    { timeout: 120000, maxWait: 30000 },
  );

  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  const diff = all.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0);
  console.log(`\n  trial balance difference ${money(Math.round(diff * 100) / 100)}`);
  for (const code of ['1000', '1500', '2000']) {
    const ls = await prisma.journalLine.findMany({ where: { account: { code } }, select: { debit: true, credit: true } });
    console.log(`  ${code} balance ${money(ls.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0))}`);
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
