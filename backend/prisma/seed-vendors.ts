/**
 * Seed script — Third-Party Maintenance Vendors
 * Run: npx ts-node prisma/seed-vendors.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding maintenance vendors...');

  await prisma.maintenanceVendor.upsert({
    where: { id: 'vendor-heartland-emirates' },
    update: {},
    create: {
      id: 'vendor-heartland-emirates',
      name: 'Heartland Emirates Recreational Vehicles',
      vendorType: 'CARAVAN_REPAIR',
      contactPerson: 'Heartland Team',
      mobile: '+971 2 563 3083',
      whatsapp: '+971 50 995 1085',
      email: 'info@heartlanduae.com',
      address: 'Al Bihouth, Al Markaz, Abu Dhabi, UAE',
      paymentTermDays: 30,
      currency: 'AED',
      isActive: true,
      notes: 'Specialises in caravan maintenance, trailer repairs, RV electrical, AC servicing, generator integration, and structural repairs.',
    },
  });

  await prisma.maintenanceVendor.upsert({
    where: { id: 'vendor-eyes-of-emirates' },
    update: {},
    create: {
      id: 'vendor-eyes-of-emirates',
      name: 'Eyes of Emirates Auto Workshop',
      vendorType: 'AUTO_WORKSHOP',
      mobile: '+971 56 302 3002',
      website: 'https://eyesofemirates.ae/',
      address: '5 Al Kawakib 1 St, Musaffah M33, Abu Dhabi, UAE',
      paymentTermDays: 30,
      currency: 'AED',
      isActive: true,
      notes: 'Vehicle mechanical repairs, AC repairs, diagnostics, general maintenance, suspension repairs, and tire services.',
    },
  });

  console.log('✅ Vendors seeded successfully.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
