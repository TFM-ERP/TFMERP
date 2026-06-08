/**
 * DEMO SEED — Transport: hired vehicles + drivers (SYS-12.C).
 * Creates a few Abu Dhabi rental / chauffeur companies (Suppliers) and a realistic
 * fleet of HIRED vehicles + drivers attached to them. Also wraps any in-house fleet
 * Asset (category VEHICLE) it can find as IN_HOUSE examples. Idempotent (tagged).
 *
 * Run:  node prisma/seed-transport-demo.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const TAG = 'DEMO_SEED';

// Rental companies → their hired vehicles + drivers.
const COMPANIES = [
  {
    name: 'Emirates Motor Company — Production Rentals', ranking: 'PREFERRED', phone: '+97124181111',
    vehicles: [
      { vehicleType: 'LUXURY', make: 'Mercedes-Benz', model: 'S-Class', plate: 'A 12345', emirate: 'AUH', capacity: 3, dailyRate: 1800 },
      { vehicleType: 'SUV', make: 'Toyota', model: 'Land Cruiser', plate: 'A 22841', emirate: 'AUH', capacity: 6, dailyRate: 950 },
      { vehicleType: 'VAN', make: 'Mercedes-Benz', model: 'V-Class', plate: 'A 30192', emirate: 'AUH', capacity: 7, dailyRate: 1100 },
    ],
    drivers: [
      { fullName: 'Rashid Al Mansoori', mobile: '+971501234567', license: 'DXB-884512', languages: ['Arabic', 'English'] },
      { fullName: 'Imran Khan', mobile: '+971552233445', license: 'AUH-771203', languages: ['Urdu', 'English', 'Hindi'] },
    ],
  },
  {
    name: 'Yas Coaches & Bus Hire', ranking: 'APPROVED', phone: '+97125559090',
    vehicles: [
      { vehicleType: 'BUS', make: 'Higer', model: 'KLQ6122', plate: 'B 5521', emirate: 'AUH', capacity: 53, dailyRate: 2200 },
      { vehicleType: 'MINIBUS', make: 'Toyota', model: 'Coaster', plate: 'B 6610', emirate: 'AUH', capacity: 22, dailyRate: 1300 },
      { vehicleType: 'MINIBUS', make: 'Toyota', model: 'Hiace', plate: 'B 7188', emirate: 'AUH', capacity: 14, dailyRate: 850 },
    ],
    drivers: [
      { fullName: 'Mahmoud Saleh', mobile: '+971563344556', license: 'AUH-553201', languages: ['Arabic', 'English'] },
      { fullName: 'Joseph Mwangi', mobile: '+971544556677', license: 'AUH-998123', languages: ['Swahili', 'English'] },
    ],
  },
  {
    name: 'Capital Chauffeur Services', ranking: 'PREFERRED', phone: '+97126667788',
    vehicles: [
      { vehicleType: 'SEDAN', make: 'Toyota', model: 'Camry', plate: 'C 1042', emirate: 'AUH', capacity: 4, dailyRate: 420 },
      { vehicleType: 'SEDAN', make: 'Nissan', model: 'Altima', plate: 'C 1188', emirate: 'AUH', capacity: 4, dailyRate: 400 },
      { vehicleType: 'SUV', make: 'Chevrolet', model: 'Tahoe', plate: 'C 2290', emirate: 'AUH', capacity: 6, dailyRate: 880 },
    ],
    drivers: [
      { fullName: 'Bilal Ahmed', mobile: '+971507788990', license: 'AUH-220114', languages: ['Urdu', 'English'] },
      { fullName: 'Antoine Khoury', mobile: '+971566677889', license: 'AUH-330221', languages: ['Arabic', 'French', 'English'] },
    ],
  },
  {
    name: 'Western Region Logistics & Trucks', ranking: 'APPROVED', phone: '+97128012345',
    vehicles: [
      { vehicleType: 'TRUCK', make: 'Isuzu', model: 'NPR', plate: 'D 4410', emirate: 'AUH', capacity: 3, dailyRate: 700 },
      { vehicleType: 'PICKUP', make: 'Toyota', model: 'Hilux', plate: 'D 5521', emirate: 'AUH', capacity: 5, dailyRate: 500 },
    ],
    drivers: [
      { fullName: 'Suresh Kumar', mobile: '+971509900112', license: 'AUH-660332', languages: ['Hindi', 'English'] },
    ],
  },
];

async function main() {
  // cleanup previous demo transport rows (vehicles/drivers tagged in notes)
  try { await prisma.transportVehicle.deleteMany({ where: { notes: TAG } }); } catch {}
  try { await prisma.transportDriver.deleteMany({ where: { notes: TAG } }); } catch {}

  let supN = 0, vehN = 0, drvN = 0;
  for (const co of COMPANIES) {
    // Supplier.name isn't unique — find-or-create manually.
    let supplier = await prisma.supplier.findFirst({ where: { name: co.name } });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: { name: co.name, ranking: co.ranking, phone: co.phone, category: 'Transport', categories: ['Transport'], country: 'UAE', city: 'Abu Dhabi' },
      });
    }
    supN++;

    for (const v of co.vehicles) {
      await prisma.transportVehicle.create({
        data: {
          source: 'HIRED', supplierId: supplier.id, vehicleType: v.vehicleType,
          make: v.make, model: v.model, plateNumber: v.plate, plateEmirate: v.emirate,
          capacity: v.capacity, dailyRate: v.dailyRate, currency: 'AED', status: 'AVAILABLE', notes: TAG,
        },
      });
      vehN++;
    }
    for (const d of co.drivers) {
      await prisma.transportDriver.create({
        data: { source: 'HIRED', supplierId: supplier.id, fullName: d.fullName, mobile: d.mobile, licenseNumber: d.license, languages: d.languages, notes: TAG },
      });
      drvN++;
    }
    console.log(`  ✓ ${co.name} — ${co.vehicles.length} vehicles, ${co.drivers.length} drivers`);
  }

  // Wrap up to 2 in-house fleet vehicles as IN_HOUSE examples.
  const fleet = await prisma.asset.findMany({ where: { category: 'VEHICLE', isActive: true }, take: 2 });
  for (const a of fleet) {
    const exists = await prisma.transportVehicle.findFirst({ where: { assetId: a.id } });
    if (exists) continue;
    await prisma.transportVehicle.create({
      data: { source: 'IN_HOUSE', assetId: a.id, vehicleType: 'PRODUCTION_VEHICLE', make: a.name, plateNumber: a.plateNumber, plateEmirate: a.plateEmirate, status: 'AVAILABLE', notes: TAG },
    });
    vehN++;
    console.log(`  ✓ In-house: ${a.name}`);
  }

  console.log(`\nSeeded ${supN} rental companies, ${vehN} vehicles, ${drvN} drivers. Open Transport.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
