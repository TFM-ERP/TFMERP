/* eslint-disable @typescript-eslint/no-var-requires */
// SYS-07 slice 7 — seed the UAE permit-authority directory (idempotent by name).
//   node prisma/seed-permit-authorities.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const AUTH = [
  { name: 'Creative Media Authority (CMA)', category: 'MEDIA_AUTHORITY', jurisdiction: 'Abu Dhabi', portalUrl: 'https://www.cma.gov.ae', leadTimeDays: 14, notes: "Abu Dhabi's creative-sector government authority — formerly the Media Zone Authority. The umbrella over the Abu Dhabi Film Commission, twofour54, Image Nation and the creative initiatives." },
  { name: 'Abu Dhabi Film Commission', category: 'FILM_COMMISSION', jurisdiction: 'Abu Dhabi', portalUrl: 'https://www.film.gov.ae', leadTimeDays: 14, notes: 'A division of the Creative Media Authority. Established under twofour54 in 2009. Issues filming/location permits, runs the cash-back rebate, the locations department and the industry directory across Abu Dhabi, Al Ain & Al Dhafra.' },
  { name: 'twofour54', category: 'MEDIA_ZONE', jurisdiction: 'Abu Dhabi', portalUrl: 'https://www.twofour54.com', leadTimeDays: 14, notes: 'Media free zone & production hub — formerly Media Zone, a partner under the Creative Media Authority. Studios, facilities, freelancer permits, golden-visa support and the e-portal used to apply for permits. Distinct from the Film Commission.' },
  { name: 'UAE Media Council', category: 'MEDIA_COUNCIL', jurisdiction: 'UAE (federal)', leadTimeDays: 10, notes: 'Federal body for script/content approval, which must be obtained before the ground filming permit.' },
  { name: 'GCAA (General Civil Aviation Authority)', category: 'AVIATION', jurisdiction: 'UAE', leadTimeDays: 21, notes: 'Drone / aerial filming approval.' },
  { name: 'Integrated Transport Centre / RTA', category: 'ROADS', jurisdiction: 'Abu Dhabi', leadTimeDays: 10, notes: 'Road / lane use, traffic diversions, parking on public roads.' },
  { name: 'Abu Dhabi Police', category: 'POLICE', jurisdiction: 'Abu Dhabi', leadTimeDays: 7, notes: 'Security clearance, road closures with traffic dept, weapons/stunts coordination.' },
  { name: 'Abu Dhabi Airports (ADAC)', category: 'AIRPORT', jurisdiction: 'Abu Dhabi', leadTimeDays: 21, notes: 'Airside / terminal filming at Zayed International Airport.' },
  { name: 'Department of Culture & Tourism — Abu Dhabi (DCT)', category: 'HERITAGE', jurisdiction: 'Abu Dhabi', leadTimeDays: 14, notes: 'Heritage sites, museums, Qasr Al Hosn, cultural districts.' },
  { name: 'Abu Dhabi City Municipality', category: 'MUNICIPALITY', jurisdiction: 'Abu Dhabi', leadTimeDays: 10, notes: 'Public parks, beaches, corniche, municipal land.' },
  { name: 'Al Ain City Municipality', category: 'MUNICIPALITY', jurisdiction: 'Al Ain', leadTimeDays: 10, notes: 'Al Ain region public land incl. Jebel Hafeet road.' },
  { name: 'Al Dhafra Region Municipality', category: 'MUNICIPALITY', jurisdiction: 'Al Dhafra', leadTimeDays: 14, notes: 'Liwa / Empty Quarter desert and Western Region.' },
];

async function main() {
  // Remove the earlier merged entry (twofour54 and ADFC are separate entities).
  const del = await prisma.permitAuthority.deleteMany({ where: { name: 'twofour54 / Abu Dhabi Film Commission' } });
  if (del.count) console.log(`Removed ${del.count} merged "twofour54 / Abu Dhabi Film Commission" row.`);

  let c = 0, u = 0;
  for (const a of AUTH) {
    const ex = await prisma.permitAuthority.findUnique({ where: { name: a.name } });
    if (ex) { await prisma.permitAuthority.update({ where: { name: a.name }, data: a }); u++; }
    else { await prisma.permitAuthority.create({ data: a }); c++; }
  }
  console.log(`Permit authorities: ${c} created, ${u} updated.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
