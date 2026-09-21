/**
 * supplier-corrections-gm3-2025.ts
 *
 * Supplier identities confirmed by the GM on 21 Sep 2026 (links and Google Maps
 * screenshots he supplied), with details from those pages. These are confirmed
 * matches, so the values are written even where a field already holds something.
 * No ledger or expense changes. Idempotent (tag [SUPFIX2025C]). Pass --dry for the plan.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const TAG = '[SUPFIX2025C]';

interface Row { current: string; data: Record<string, string>; src: string }
const ROWS: Row[] = [
  { current: 'Ard Al Khaleej Electronix Wheel', data: { tradeName: 'Ard Al Khaleej Perfumes', address: 'Fikree Market, Murshid Bazar (in Al Harameen Islamic Clock), near Grand Sina Hotel, behind Al Sabkha bus stop, Deira', city: 'Dubai', phone: '055 788 6393' }, src: 'GM confirmed Google Maps listing "Ard al khaleej perfumes" (plus code 7892+JH Dubai)' },
  { current: 'Firefly Trading', data: { tradeName: 'Firefly Burger Abu Dhabi', address: 'Garden City Tower, Khalidiyah St, Al Khalidiyah, W8', city: 'Abu Dhabi', phone: '02 679 0090', categories: 'Catering', category: 'Catering' }, src: 'GM confirmed Google Maps listing "Firefly Burger Abu Dhabi" (restaurant)' },
  { current: 'Ogaret', data: { tradeName: 'Ogaret Restaurant (Jafza)', address: 'JAFZA Food Court 1, Jebel Ali Free Zone', city: 'Dubai', phone: '04 887 0055', categories: 'Catering', category: 'Catering' }, src: 'GM confirmed Google Maps listing "Ogaret restaurant (Jafza)"' },
  { current: 'Koobrik', data: { website: 'koobrik.com' }, src: 'GM confirmed koobrik.com (script coverage / data platform for creative industries; site publishes no legal entity or address)' },
];

async function main(): Promise<void> {
  if ((await prisma.supplier.count({ where: { notes: { contains: TAG } } })) > 0) { console.log('Already applied.'); await prisma.$disconnect(); return; }
  const plan: { id: string; data: Record<string, unknown> }[] = [];
  for (const r of ROWS) {
    const s = await prisma.supplier.findFirst({ where: { name: r.current } });
    if (!s) throw new Error(`Supplier "${r.current}" not found — nothing changed.`);
    if (r.data.name && r.data.name !== r.current && (await prisma.supplier.count({ where: { name: r.data.name } }))) throw new Error(`Name "${r.data.name}" already used — nothing changed.`);
    const data: Record<string, unknown> = { ...r.data, ...(r.data.categories ? { categories: [r.data.categories] } : {}), notes: `${s.notes ? `${s.notes}\n` : ''}${TAG} ${r.src} (21 Sep 2026).` };
    plan.push({ id: s.id, data });
    console.log(`  ${r.current} (TRN ${s.trn ?? '-'}): ${Object.entries(r.data).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
  }
  if (DRY) { console.log('=== DRY RUN — nothing written ==='); await prisma.$disconnect(); return; }
  await prisma.$transaction(plan.map((p) => prisma.supplier.update({ where: { id: p.id }, data: p.data })));
  console.log(`updated ${await prisma.supplier.count({ where: { notes: { contains: TAG } } })}`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
