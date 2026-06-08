/* CoA translation seed — run from the backend folder:  node prisma/seed-mm-mapping.js  (idempotent)
 *
 * Since June 2026 the Master CoA uses the INDUSTRY-STANDARD Movie Magic / AICP
 * numbering natively (docs/production/17), so industry files map 1:1 — identity
 * mappings come from seed-jurisdiction.js.
 *
 * This seed loads the LEGACY translation instead: TFM's pre-switch numbering
 * (projects created before the change, and their Movie Magic exports) → the new
 * industry codes. Source system: 'TFM_LEGACY'.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// [old TFM code, old title, new industry code, new title, notes]
const ROWS = [
  ['1100', 'Story & Rights', '1100', 'Story, Rights & Continuity', ''],
  ['1200', 'Writing', '1100', 'Story, Rights & Continuity', 'writers fold into Story & Rights'],
  ['1300', 'Producers', '1200', 'Producers Unit', ''],
  ['1400', 'Director', '1300', 'Directors Unit', ''],
  ['1500', 'Cast (Principal)', '1400', 'Cast', ''],
  ['1600', 'Casting', '1400', 'Cast', 'casting director → 1405'],
  ['1700', 'Stunts', '1500', 'Bits & Stunts', ''],
  ['2100', 'Production Staff', '2000', 'Production Staff', ''],
  ['2150', 'Extra Talent', '2100', 'Extra Talent', ''],
  ['2200', 'Camera Department', '3300', 'Camera', ''],
  ['2300', 'Grip Department', '2500', 'Set Operations', ''],
  ['2400', 'Electric / Lighting', '3200', 'Lighting / Electrical', ''],
  ['2500', 'Production Sound', '3400', 'Production Sound', ''],
  ['2600', 'Art Department', '2200', 'Set Design (Art)', ''],
  ['2650', 'Set Construction', '2300', 'Set Construction', ''],
  ['2655', 'Set Strike', '2400', 'Set Striking', ''],
  ['2700', 'Set Dressing', '2700', 'Set Dressing', 'same code'],
  ['2750', 'Property (Props)', '2800', 'Property (Props)', ''],
  ['2800', 'Wardrobe', '2900', 'Wardrobe', ''],
  ['2900', 'Makeup & Hair', '3100', 'Makeup & Hairstyling', ''],
  ['2920', 'Special Effects (SFX)', '2600', 'Special Effects', ''],
  ['2940', 'Locations', '3600', 'Location', ''],
  ['2955', 'Animals & Wranglers', '4100', 'Animals', ''],
  ['2960', 'Transportation', '3500', 'Transportation', ''],
  ['2975', 'Picture Vehicles', '3000', 'Picture Vehicles', ''],
  ['2980', 'Catering & Craft', '2500', 'Set Operations', 'catering lines 2521/2522'],
  ['2985', 'Travel & Living (BTL)', '3800', 'Travel & Living (BTL)', ''],
  ['2990', 'Safety & Welfare', '4600', 'Health & Safety', ''],
  ['3050', 'Post Staff & Facilities', '5000', 'Post Staff & Facilities', ''],
  ['3100', 'Editorial', '5100', 'Editing', ''],
  ['3200', 'Post Sound', '5300', 'Video Post Sound', ''],
  ['3300', 'Music', '5200', 'Music', ''],
  ['3400', 'Visual Effects (VFX)', '5400', 'Visual Effects', ''],
  ['3500', 'Color & Finishing', '5500', 'Video Post Picture (DI)', ''],
  ['3600', 'Titles & Deliverables', '5600', 'Titles', ''],
  ['3700', 'Stock Footage & Deliverables', '5700', 'Stock Footage & Deliverables', ''],
  ['4100', 'Insurance', '6700', 'Insurance', ''],
  ['4200', 'Legal & Accounting', '6800', 'General Expense / Office', 'production accountant → 2005'],
  ['4300', 'Publicity', '6500', 'Publicity / Marketing', ''],
  ['4400', 'Office & Admin', '6800', 'General Expense / Office', 'office rental → 4002'],
  ['4500', 'Contingency', '6900', 'Contingency / Completion Bond', ''],
  ['4600', 'Second Unit', '4200', 'Second Unit', ''],
  ['4650', 'Aerial & Marine Units', '4400', 'Aerial Unit', 'marine portion → 4500'],
  ['4700', 'Re-shoots / Pickups', '4800', 'Re-shoots', ''],
  ['4750', 'Tests & Screenings', '6300', 'Tests', ''],
  // legacy distribution ledger (was 6000–7000) → shifted 7000+
  ['6100', 'Creative Materials', '7100', 'Creative Materials', ''],
  ['6200', 'Media Buy (Advertising)', '7200', 'Media Buy (Advertising)', ''],
  ['6300', 'Publicity & PR (P&A)', '7300', 'Publicity & PR', 'NOTE: collides with industry 6300 Tests — context decides'],
  ['6400', 'Print & Logistics (P&A)', '7400', 'Print & Logistics', 'NOTE: collides with industry 6400 Studio Expenses'],
  ['7100', 'Sales & Licensing', '7510', 'Sales & Licensing', ''],
];

async function main() {
  let created = 0, updated = 0;
  for (const [externalCode, externalLabel, masterCode, masterTitle, notes] of ROWS) {
    const data = { externalLabel, masterCode, masterTitle, isActive: true, notes: notes || null };
    const existing = await prisma.coaMappingTable.findUnique({
      where: { sourceSystem_externalCode: { sourceSystem: 'TFM_LEGACY', externalCode } },
    });
    if (existing) { await prisma.coaMappingTable.update({ where: { id: existing.id }, data }); updated++; }
    else { await prisma.coaMappingTable.create({ data: { sourceSystem: 'TFM_LEGACY', externalCode, ...data } }); created++; }
  }
  // retire the now-obsolete MM_INDUSTRY rows (industry codes are native — identity covers them)
  const retired = await prisma.coaMappingTable.updateMany({ where: { sourceSystem: 'MM_INDUSTRY' }, data: { isActive: false } });
  console.log(`TFM_LEGACY mappings: ${created} created, ${updated} updated. MM_INDUSTRY rows deactivated: ${retired.count}.`);
  console.log('Total mapping rows:', await prisma.coaMappingTable.count());
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
