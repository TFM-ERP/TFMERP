/**
 * DEMO SEED — Accommodation properties + room inventory (SYS-12.A).
 * Realistic Abu Dhabi mix: hotels, serviced apartments, villas, a desert crew
 * camp and staff housing. Idempotent (tagged notes='DEMO_SEED').
 *
 * Run:  node prisma/seed-accommodation-demo.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const TAG = 'DEMO_SEED';

// rooms: [type, count, capacity, nightlyRate, prefix]
const PROPERTIES = [
  { name: 'Rosewood Abu Dhabi', type: 'HOTEL', city: 'Abu Dhabi', area: 'Al Maryah Island', contact: ['Reservations Desk', '+97126677777'],
    rooms: [['EXECUTIVE_SUITE', 4, 2, 1200, 'E'], ['SUITE', 3, 2, 900, 'S'], ['DOUBLE', 8, 2, 650, ''], ['TWIN', 6, 2, 650, 'T']] },
  { name: 'Yas Island Rotana', type: 'HOTEL', city: 'Abu Dhabi', area: 'Yas Island', contact: ['Group Sales', '+97165555555'],
    rooms: [['SUITE', 2, 2, 750, 'S'], ['DOUBLE', 10, 2, 480, ''], ['TWIN', 8, 2, 480, 'T']] },
  { name: 'Saadiyat Serviced Apartments', type: 'SERVICED_APARTMENT', city: 'Abu Dhabi', area: 'Saadiyat Island', contact: ['Building Manager', '+97121234567'],
    rooms: [['APARTMENT', 10, 4, 550, 'A']] },
  { name: 'Al Reem Production Villas', type: 'VILLA', city: 'Abu Dhabi', area: 'Al Reem Island', contact: ['Estate Office', '+97129998888'],
    rooms: [['VILLA', 4, 6, 1400, 'V']] },
  { name: 'Liwa Desert Crew Camp', type: 'CREW_CAMP', city: 'Liwa', area: 'Empty Quarter', contact: ['Camp Boss', '+971501112233'],
    rooms: [['DORMITORY', 6, 8, 120, 'D'], ['DORMITORY', 2, 4, 160, 'DP']] },
  { name: 'Mussafah Staff Housing', type: 'STAFF_HOUSING', city: 'Abu Dhabi', area: 'Mussafah', contact: ['HR Housing', '+971504445566'],
    rooms: [['DORMITORY', 8, 10, 90, 'H']] },
];

async function main() {
  // cleanup
  try { await prisma.accommodationProperty.deleteMany({ where: { notes: TAG } }); } catch {}

  let props = 0, rms = 0;
  for (const p of PROPERTIES) {
    const property = await prisma.accommodationProperty.create({
      data: {
        name: p.name, type: p.type, city: p.city, country: 'United Arab Emirates',
        address: `${p.area}, ${p.city}`, contactName: p.contact[0], contactPhone: p.contact[1], notes: TAG,
      },
    });
    props++;
    const roomRows = [];
    for (const [type, count, capacity, rate, prefix] of p.rooms) {
      for (let i = 1; i <= count; i++) {
        roomRows.push({ propertyId: property.id, roomNumber: `${prefix}${100 + i}`, type, capacity, nightlyRate: rate, currency: 'AED', status: 'AVAILABLE' });
      }
    }
    await prisma.roomInventory.createMany({ data: roomRows });
    rms += roomRows.length;
    console.log(`  ✓ ${p.name} — ${roomRows.length} rooms`);
  }
  console.log(`\nSeeded ${props} properties, ${rms} rooms. Open Accommodation → Properties.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
