/**
 * post-monitor-dec-instalment-2025.ts
 *
 * Samsung M9 monitor, tax invoice AE251121-49119949 (filed-2025-2026-0099), paid through
 * Tamara in four instalments. The Tamara app shows instalment 2 of 907.93 paid on
 * 21 Dec 2025. It is not on the company's ADCB account, so it was collected from the
 * GM's own card — the same treatment as the Gear-up.me invoice (GM paid personally,
 * company owes him through 2400). 898.50 of invoice + 9.43 Tamara fee.
 * Instalments 3 and 4 (Feb and Mar 2026, 1,797.00 of invoice) stay payable at 31 Dec 2025.
 *
 * Idempotent (tag [MONITORDEC2025]). Pass --dry for the plan.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[MONITORDEC2025]';
const dec = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

async function main(): Promise<void> {
  if ((await prisma.journalEntry.count({ where: { memo: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const accts = await prisma.glAccount.findMany({ where: { code: { in: ['2000', '2400', '6500'] } }, select: { id: true, code: true } });
  const acct = new Map(accts.map((a) => [a.code, a.id]));
  if (acct.size !== 3) throw new Error('GL account missing — nothing changed.');
  console.log('  2025-12-21  Dr 2000 898.50 + Dr 6500 9.43 / Cr 2400 907.93  (filed-2025-2026-0099, Tamara instalment 2 of 4, paid by the GM)');
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  const last = await prisma.journalEntry.findMany({ where: { entryNumber: { startsWith: `JE-${new Date().getFullYear()}-` } }, select: { entryNumber: true }, orderBy: { entryNumber: 'desc' }, take: 1 });
  const n = parseInt(last[0].entryNumber.slice(-4), 10) + 1;
  await prisma.journalEntry.create({
    data: {
      entryNumber: `JE-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`, date: new Date('2025-12-21T00:00:00.000Z'), source: 'SYSTEM', status: 'POSTED', postedAt: new Date(),
      memo: `${TAG} filed-2025-2026-0099 Samsung M9 monitor — Tamara instalment 2 of 4 (907.93, 21 Dec 2025) collected from the GM's own card, not the company account; owed to him.`,
      lines: { create: [
        { accountId: acct.get('2000')!, debit: 898.5, credit: 0, description: 'Samsung via Tamara — filed-2025-2026-0099' },
        { accountId: acct.get('6500')!, debit: 9.43, credit: 0, description: 'Tamara fee' },
        { accountId: acct.get('2400')!, debit: 0, credit: 907.93, description: 'Owner Account — paid personally' },
      ] },
    },
  });
  const all = await prisma.journalLine.findMany({ select: { debit: true, credit: true } });
  console.log(`  trial balance difference ${all.reduce((t, l) => t + dec(l.debit) - dec(l.credit), 0).toFixed(2)}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
