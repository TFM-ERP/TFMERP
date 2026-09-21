/**
 * supplier-corrections-gm-2025.ts
 *
 * Corrections given by the GM on 21 Sep 2026:
 *  - "Apex" is Apex Tools (apextools.com) — Apex Trading Company WLL, Mussafah M10,
 *    Abu Dhabi — not Apex Express courier as the web pass had guessed. Details from
 *    apextools.com replace the courier's.
 *  - Heartland is Heartland Emirates Recreational Vehicles
 *    (هارتلاند الامارات للمركبات الترفيهية والكرفانات), Al Bihouth, Al Markaz, Abu Dhabi.
 *    Bank details as printed on its invoices; category Maintenance (GM: all caravan
 *    and trailer work is maintenance).
 *
 * No ledger or expense changes. Idempotent (tag [SUPFIX2025]). Pass --dry for the plan.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[SUPFIX2025]';

async function main(): Promise<void> {
  if ((await prisma.supplier.count({ where: { notes: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const apex = await prisma.supplier.findFirst({ where: { name: 'Apex', trn: '100261452500003' } });
  const hl = await prisma.supplier.findFirst({ where: { trn: '100393810500003' } });
  if (!apex || !hl) throw new Error('Apex or Heartland not found — nothing changed.');
  const stripWeb = (n: string | null) => (n ?? '').split('\n').filter((l) => !l.startsWith('[SUPWEB2025]')).join('\n');
  const apexData = {
    name: 'Apex Trading Company WLL', tradeName: 'Apex Tools', address: 'Mussafah Industrial Area M10, P.O. Box 47090', city: 'Abu Dhabi',
    phone: '+971 50 576 6126', email: 'online@apextools.com', website: 'apextools.com', categories: ['General Supplier'], category: 'General Supplier',
    notes: `${stripWeb(apex.notes)}\n${TAG} GM 21 Sep 2026: Apex is Apex Tools (apextools.com), tools and equipment. Details from apextools.com. The earlier web match to Apex Express courier was wrong and has been removed (Apex Express only delivered the Senci parcel).`.trim(),
  };
  const hlData = {
    tradeName: 'Heartland — هارتلاند الامارات للمركبات الترفيهية والكرفانات', address: 'Al Bihouth, Al Markaz', city: 'Abu Dhabi',
    phone: '02 563 3083 / +971 56 133 7522', categories: ['Maintenance Workshop'], category: 'Maintenance Workshop',
    bankName: 'Abu Dhabi Islamic Bank', bankAccount: '16288353', iban: 'AE300500000000016288353',
    notes: `${stripWeb(hl.notes)}\n${TAG} GM 21 Sep 2026: Heartland Emirates Recreational Vehicles (هارتلاند الامارات للمركبات الترفيهية والكرفانات), Al Bihouth, Al Markaz, Abu Dhabi. Invoice header reads "Hameem Rd, Al Markaz". Bank details as printed on its invoices. Mobile +971 56 133 7522 and facebook.com/heartlanduae from web research.`.trim(),
  };
  console.log('Apex ->', JSON.stringify(apexData, null, 1));
  console.log('Heartland ->', JSON.stringify(hlData, null, 1));
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  await prisma.$transaction([prisma.supplier.update({ where: { id: apex.id }, data: apexData }), prisma.supplier.update({ where: { id: hl.id }, data: hlData })]);
  console.log(`updated ${await prisma.supplier.count({ where: { notes: { contains: TAG } } })}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
