/**
 * supplier-corrections-gm4-2025.ts
 *
 * GM 21 Sep 2026: +971 50 943 2686 is MACGREGOR FZ LLE's number. macquip.me shows the
 * same number and links instagram.com/macgregorequipment, so MacGregor Equipment Rental
 * and Macquip are connected businesses; both records note it (they stay separate
 * suppliers — different TRNs). No ledger changes. Idempotent ([SUPFIX2025D]); --dry for the plan.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[SUPFIX2025D]';

async function main(): Promise<void> {
  if ((await prisma.supplier.count({ where: { notes: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const mg = await prisma.supplier.findFirst({ where: { trn: '104313630600003' } });
  const mq = await prisma.supplier.findFirst({ where: { trn: '104961238300003' } });
  if (!mg || !mq) throw new Error('MacGregor or Macquip not found — nothing changed.');
  console.log(`  ${mg.name}: phone ${mg.phone ?? '-'} -> +971 50 943 2686`);
  console.log(`  ${mq.name}: note link to MacGregor`);
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  await prisma.$transaction([
    prisma.supplier.update({ where: { id: mg.id }, data: { phone: '+971 50 943 2686', notes: `${mg.notes ?? ''}\n${TAG} GM confirmed phone +971 50 943 2686. Same number and Instagram as Macquip (macquip.me) — connected business, separate TRN (Macquip 104961238300003).`.trim() } }),
    prisma.supplier.update({ where: { id: mq.id }, data: { notes: `${mq.notes ?? ''}\n${TAG} Connected to MACGREGOR FZ LLE (MacGregor Equipment Rental, TRN 104313630600003): same phone +971 50 943 2686 and Instagram, per macquip.me and the GM.`.trim() } }),
  ]);
  const r = await prisma.supplier.findUnique({ where: { id: mg.id } });
  console.log(`  verified: ${r!.name} | ${r!.tradeName} | ${r!.phone} | ${r!.website}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
