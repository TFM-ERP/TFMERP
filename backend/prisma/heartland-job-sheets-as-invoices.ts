/**
 * heartland-job-sheets-as-invoices.ts
 *
 * General Manager, 21 Sep 2026: treat Heartland's 2025 job sheets as its invoices.
 * They are the only paper Heartland issued; proper tax invoices will be requested.
 * Heartland is VAT registered, TRN 100393810500003 (from its 2024 tax invoices).
 *
 * Two 2025 Heartland rows were booked GROSS by post-supplier-docs-2025.ts because
 * the job sheets carry no TRN. This splits their VAT out:
 *
 *   EXP-2025-0002  Toilet Trailer 1, 19 Jan  2,803.50 = 2,670.00 + 133.50
 *                  Dr 1200 133.50 / Cr 1500 133.50
 *   EXP-2025-0003  Freedom Express awning, 4 Aug  6,247.50 = 5,950.00 + 297.50
 *                  Dr 1200 297.50 / Cr 5200 297.50
 *
 * and stamps Heartland's TRN on every Heartland row backed by a job sheet
 * (filed-2025-2026-0141, filed-2025-2026-0144, EXP-2025-0002, EXP-2025-0003).
 *
 * The 431.00 recovered here was NOT in any VAT return as filed (Toilet Trailer 1
 * falls in Q1, the awning in Q3). It belongs on the VAT correction list.
 *
 * Idempotent (tag [HLJOBSHEET2025]). Pass --dry for the plan.
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[HLJOBSHEET2025]';
const TRN = '100393810500003';

const SPLITS = [
  { expenseNumber: 'EXP-2025-0002', date: '2025-01-19', net: 2670, vat: 133.5, from: '1500', what: 'Toilet Trailer 1' },
  { expenseNumber: 'EXP-2025-0003', date: '2025-08-04', net: 5950, vat: 297.5, from: '5200', what: 'Freedom Express awning repair' },
];
const STAMP = ['filed-2025-2026-0141', 'filed-2025-2026-0144', 'EXP-2025-0002', 'EXP-2025-0003'];

const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

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
  const accts = await prisma.glAccount.findMany({ where: { code: { in: ['1200', '1500', '5200'] } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== 3) throw new Error('GL account missing — nothing changed.');

  const rows = await prisma.expense.findMany({ where: { expenseNumber: { in: STAMP } } });
  if (rows.length !== STAMP.length) throw new Error('Expense row missing — nothing changed.');
  const byNo = new Map(rows.map((r) => [r.expenseNumber, r]));
  for (const s of SPLITS) {
    const r = byNo.get(s.expenseNumber)!;
    if (dec(r.totalAmount) !== s.net + s.vat || dec(r.vatAmount) !== 0) {
      throw new Error(`${s.expenseNumber} not as measured — nothing changed.`);
    }
    console.log(`  ${s.expenseNumber}  ${s.what}: ${s.net + s.vat} -> net ${s.net} + VAT ${s.vat}   Dr 1200 / Cr ${s.from}`);
  }
  console.log(`  supplierVatId ${TRN} on: ${STAMP.join(', ')}`);
  if (DRY) {
    console.log('\n=== DRY RUN — nothing written ===');
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    const issued = new Set<string>();
    for (const no of STAMP) {
      const r = byNo.get(no)!;
      const split = SPLITS.find((s) => s.expenseNumber === no);
      await tx.expense.update({
        where: { id: r.id },
        data: {
          supplierVatId: TRN,
          ...(split ? { amount: split.net, vatAmount: split.vat } : {}),
          notes:
            `${r.notes ?? ''}\n[21 Sep 2026] ${TAG} Job sheet accepted as Heartland's invoice on the ` +
            `GM's instruction (the only paper Heartland issued; a proper tax invoice will be ` +
            `requested). Heartland TRN ${TRN}.` +
            (split ? ` Input VAT ${split.vat.toFixed(2)} now claimed; not in the return as filed.` : ''),
        },
      });
    }
    for (const s of SPLITS) {
      await tx.journalEntry.create({
        data: {
          entryNumber: await nextNumber(tx, issued),
          date: day(s.date),
          memo: `${TAG} ${s.expenseNumber} Heartland ${s.what} — job sheet accepted as invoice (GM, 21 Sep 2026); input VAT ${s.vat.toFixed(2)} split out of the gross cost. Heartland TRN ${TRN}.`,
          source: 'SYSTEM',
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              { accountId: acct.get('1200')!, debit: s.vat, credit: 0, description: `Input VAT — Heartland ${s.what}` },
              { accountId: acct.get(s.from)!, debit: 0, credit: s.vat, description: 'VAT taken out of the gross cost' },
            ],
          },
        },
      });
    }
  });

  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`\n  trial balance difference ${all.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
