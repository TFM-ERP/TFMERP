/**
 * supplier-corrections-gm2-2025.ts
 *
 * Supplier identities confirmed by the GM on 21 Sep 2026 (links and Google Maps
 * screenshots he supplied), with details from those pages. These are confirmed
 * matches, so the values are written even where a field already holds something.
 * No ledger or expense changes. Idempotent (tag [SUPFIX2025B]). Pass --dry for the plan.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[SUPFIX2025B]';

interface Row { current: string; data: Record<string, string>; src: string }
const ROWS: Row[] = [
  { current: 'Royal Catering', data: { name: 'Royal Catering Services LLC', tradeName: 'Royal Catering', address: 'M40 Musaffah Industrial', city: 'Abu Dhabi', phone: '+971 2 496 3200', email: 'info@royalcatering.ae', website: 'royalcatering.ae' }, src: 'GM confirmed royalcatering.ae; details from that site' },
  { current: 'Royal Phone', data: { tradeName: 'Royal Phone Center', address: '21 Hifayif Street, G Floor, Al Nahyan', city: 'Abu Dhabi', phone: '+971 2 491 8888', website: 'royalphonecenter.com' }, src: 'GM confirmed royalphonecenter.com; address and phone from 2gis.ae listing' },
  { current: 'Formula Tires Trading', data: { tradeName: 'Formula Tyres', address: 'Al Quoz branch: Al Quoz Industrial Area 3, Sheikh Zayed Road', city: 'Dubai', phone: '04 338 9298', website: 'formulauae.com' }, src: 'GM confirmed formulauae.com, Al Quoz branch, 04 338 9298' },
  { current: 'Cars Hub', data: { tradeName: 'Carhub Auto Accessories Abu Dhabi', address: 'Al Bees 4 St, Musaffah M14', city: 'Abu Dhabi', phone: '055 584 1123', email: 'info@carhubabudhabi.com', website: 'carhubabudhabi.com' }, src: 'GM confirmed carhubabudhabi.com + Google Maps listing' },
  { current: 'GT8 General', data: { tradeName: 'GT8 Phone Center', address: "Hazza' Bin Zayed The First St, Al Nahyan, E19 02", city: 'Abu Dhabi', phone: '050 206 6857', email: 'sales@gt8-store.com', website: 'gt8-store.com' }, src: 'GM confirmed gt8-store.com + Google Maps listing (Abu Dhabi branch)' },
  { current: 'RSQ Trading', data: { name: 'Salem Rashid Al Qubaisi Trading Co. LLC', tradeName: 'SRQ Trading Co. L.L.C', address: 'Mussafah M9, P.O. Box 8661', city: 'Abu Dhabi', phone: '02 555 5999 / 24-7 workshop 050 445 4899', email: 'qubatec@emirates.net.ae', website: 'sralqubaisi.com' }, src: 'GM confirmed sralqubaisi.com + Google Maps listing (SRQ Trading Co. L.L.C); recorded as "RSQ" in the filed VAT workbook' },
  { current: 'MACGREGOR FZ LLE', data: { tradeName: 'MacGregor Equipment Rental', website: 'instagram.com/macgregorequipment' }, src: 'GM confirmed instagram.com/macgregorequipment' },
  { current: 'V Media Productions - Sole Proprietorship L.L.C.', data: { website: 'vmediagroup.ae' }, src: 'GM confirmed vmediagroup.ae' },
];

async function main(): Promise<void> {
  if ((await prisma.supplier.count({ where: { notes: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const plan: { id: string; data: Record<string, string> }[] = [];
  for (const r of ROWS) {
    const s = await prisma.supplier.findFirst({ where: { name: r.current } });
    if (!s) throw new Error(`Supplier "${r.current}" not found — nothing changed.`);
    if (r.data.name && r.data.name !== r.current && (await prisma.supplier.count({ where: { name: r.data.name } }))) throw new Error(`Name "${r.data.name}" already used — nothing changed.`);
    const data = { ...r.data, notes: `${s.notes ? `${s.notes}\n` : ''}${TAG} ${r.src} (21 Sep 2026).` };
    plan.push({ id: s.id, data });
    console.log(`  ${r.current} (TRN ${s.trn ?? '-'}): ${Object.entries(r.data).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
  }
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  await prisma.$transaction(plan.map((p) => prisma.supplier.update({ where: { id: p.id }, data: p.data })));
  console.log(`updated ${await prisma.supplier.count({ where: { notes: { contains: TAG } } })}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
