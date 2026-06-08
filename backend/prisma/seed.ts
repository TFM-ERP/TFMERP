import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const d = (s: string) => new Date(s + 'T00:00:00.000Z');
const addDays = (dt: Date, n: number) => new Date(dt.getTime() + n * 86_400_000);

async function main() {
  console.log('\n🌱  Seeding TFM ERP…\n');

  // ── Cleanup (delete previous seed in FK-safe reverse order) ────────────────
  console.log('🧹  clearing previous seed data…');
  await (prisma.fuelLog          as any).deleteMany({ where: { id: { in: ['fl-01','fl-02','fl-03','fl-04','fl-05','fl-06'] } } });
  await (prisma.tireRecord       as any).deleteMany({ where: { id: { in: ['tr-01','tr-02','tr-03','tr-04','tr-05','tr-06'] } } });
  await (prisma.sparePart        as any).deleteMany({ where: { id: { in: ['sp-01','sp-02','sp-03','sp-04','sp-05'] } } });
  await (prisma.maintenanceLog   as any).deleteMany({ where: { id: { in: ['ml-01','ml-02','ml-03','ml-04','ml-05','ml-06'] } } });
  await (prisma.vendorPayment    as any).deleteMany({ where: { id: { in: ['vp-01','vp-02','vp-03'] } } });
  await (prisma.vendorInvoice    as any).deleteMany({ where: { id: { in: ['vi-01','vi-02','vi-03','vi-04','vi-05'] } } });
  await (prisma.vendorMaintenanceJob as any).deleteMany({ where: { id: { in: ['vmj-01','vmj-02','vmj-03','vmj-04','vmj-05','vmj-06','vmj-07','vmj-08'] } } });
  await (prisma.expense          as any).deleteMany({ where: { id: { in: ['exp-01','exp-02','exp-03','exp-04','exp-05','exp-06','exp-07','exp-08','exp-09'] } } });
  await (prisma.payment          as any).deleteMany({ where: { id: { in: ['pay-01','pay-02','pay-03'] } } });
  await (prisma.invoiceItem      as any).deleteMany({ where: { id: { in: ['ii-01-1','ii-01-2','ii-02-1','ii-02-2','ii-02-3','ii-03-1','ii-03-2','ii-04-1','ii-04-2'] } } });
  await (prisma.invoice          as any).deleteMany({ where: { id: { in: ['inv-01','inv-02','inv-03','inv-04'] } } });
  await (prisma.bookingItem      as any).deleteMany({ where: { id: { in: ['bi-01-1','bi-01-2','bi-02-1','bi-02-2','bi-02-3','bi-03-1','bi-03-2','bi-04-1','bi-04-2','bi-05-1','bi-05-2','bi-06-1'] } } });
  await (prisma.rentalBooking    as any).deleteMany({ where: { id: { in: ['bkg-01','bkg-02','bkg-03','bkg-04','bkg-05','bkg-06'] } } });
  await (prisma.quotationItem    as any).deleteMany({ where: { id: { in: ['qi-01-1','qi-01-2','qi-01-3','qi-02-1','qi-02-2','qi-02-3','qi-02-4'] } } });
  await (prisma.quotation        as any).deleteMany({ where: { id: { in: ['quot-01','quot-02'] } } });
  await (prisma.contact          as any).deleteMany({ where: { id: { startsWith: 'gc-' } } });
  await (prisma.driver           as any).deleteMany({ where: { id: { in: ['driver-01','driver-02','driver-03','driver-04'] } } });
  await (prisma.asset            as any).deleteMany({ where: { id: { startsWith: 'asset-' } } });
  await (prisma.maintenanceVendor as any).deleteMany({ where: { id: { startsWith: 'v-' } } });
  await (prisma.supplier         as any).deleteMany({ where: { id: { startsWith: 'sup-' } } });
  await (prisma.clientContact    as any).deleteMany({ where: { id: { startsWith: 'cc-client-' } } });
  await (prisma.client           as any).deleteMany({ where: { id: { startsWith: 'client-' } } });
  await (prisma.taxRate          as any).deleteMany({ where: { id: { in: ['tax-vat5','tax-zero'] } } });
  await (prisma.bankAccount      as any).deleteMany({ where: { id: { in: ['bank-aed','bank-usd'] } } });
  await (prisma.companySettings  as any).deleteMany({ where: { id: 'cs-tfm' } });
  await (prisma.user             as any).deleteMany({ where: { email: { in: ['admin@tfm.ae','finance@tfm.ae','rental@tfm.ae','maintenance@tfm.ae','sales@tfm.ae','coordinator@tfm.ae'] } } });

  // ── Users ──────────────────────────────────────────────────────────────────
  console.log('👤  users…');
  const hash = await bcrypt.hash('Demo@1234', 10);
  for (const u of [
    { id: 'user-admin',       fullName: 'Admin User',        email: 'admin@tfm.ae',       role: 'SYSTEM_ADMIN',           activity: 'BOTH' },
    { id: 'user-finance',     fullName: 'Finance Manager',   email: 'finance@tfm.ae',     role: 'FINANCE_MANAGER',        activity: 'BOTH' },
    { id: 'user-rental',      fullName: 'Rental Manager',    email: 'rental@tfm.ae',      role: 'RENTAL_MANAGER',         activity: 'RENTAL' },
    { id: 'user-maintenance', fullName: 'Maintenance Tech',  email: 'maintenance@tfm.ae', role: 'MAINTENANCE',            activity: 'RENTAL' },
    { id: 'user-sales',       fullName: 'Sales Executive',   email: 'sales@tfm.ae',       role: 'SALES',                  activity: 'BOTH' },
    { id: 'user-coord',       fullName: 'Prod. Coordinator', email: 'coordinator@tfm.ae', role: 'PRODUCTION_COORDINATOR', activity: 'PRODUCTION' },
  ]) {
    await (prisma.user as any).upsert({ where: { id: u.id }, update: {}, create: { ...u, passwordHash: hash } });
  }

  // ── Company Settings ───────────────────────────────────────────────────────
  console.log('🏢  company…');
  await (prisma.companySettings as any).upsert({
    where: { id: 'cs-tfm' }, update: {},
    create: { id: 'cs-tfm', name: 'The Film Makers FZ LLC', tradeName: 'TFM Production & Rentals', trn: '100123456700003', address: 'Dubai Studio City, Building 7, Office 204', city: 'Dubai', country: 'UAE', phone: '+971 4 123 4567', email: 'info@tfm.ae', website: 'https://www.tfm.ae', logoUrl: '/tfm-logo.svg', defaultCurrency: 'AED', vatRate: 5, defaultPaymentTermDays: 30, invoicePrefix: 'INV', quotationPrefix: 'QUO', bookingPrefix: 'BKG', defaultBankName: 'Emirates NBD', defaultBankAccount: '1012345678901', defaultBankIban: 'AE070260001012345678901', defaultBankSwift: 'EBILAEAD' },
  });

  // ── Bank Accounts ──────────────────────────────────────────────────────────
  console.log('🏦  bank accounts…');
  await (prisma.bankAccount as any).upsert({ where: { id: 'bank-aed' }, update: {}, create: { id: 'bank-aed', accountName: 'The Film Makers FZ LLC', bankName: 'Emirates NBD', accountNumber: '1012345678901', iban: 'AE070260001012345678901', swiftCode: 'EBILAEAD', currency: 'AED', branch: 'Dubai Studio City', isDefaultInvoice: true, isDefaultQuotation: true, isDefaultReceiving: true, isActive: true } });
  await (prisma.bankAccount as any).upsert({ where: { id: 'bank-usd' }, update: {}, create: { id: 'bank-usd', accountName: 'The Film Makers FZ LLC', bankName: 'Emirates NBD', accountNumber: '1012345678902', iban: 'AE070260001012345678902', swiftCode: 'EBILAEAD', currency: 'USD', branch: 'Dubai Studio City', isDefaultInvoice: false, isDefaultQuotation: false, isDefaultReceiving: false, isActive: true } });

  // ── Tax Rates ──────────────────────────────────────────────────────────────
  console.log('💰  tax rates…');
  await (prisma.taxRate as any).upsert({ where: { id: 'tax-vat5' }, update: {}, create: { id: 'tax-vat5', name: 'UAE VAT 5%', rate: 5, vatType: 'STANDARD', isDefault: true, description: 'Standard UAE Value Added Tax' } });
  await (prisma.taxRate as any).upsert({ where: { id: 'tax-zero' }, update: {}, create: { id: 'tax-zero', name: 'Zero Rated', rate: 0, vatType: 'ZERO_RATED', isDefault: false, description: 'Zero-rated supply' } });

  // ── Clients ────────────────────────────────────────────────────────────────
  console.log('🎬  clients…');
  for (const cl of [
    { id: 'client-mbc',     companyName: 'MBC Group',                 tradeName: 'MBC',          trn: '100111222300003', billingAddress: 'Media City, Dubai',         city: 'Dubai',     country: 'UAE', paymentTermDays: 30 },
    { id: 'client-netflix', companyName: 'Netflix MENA',              tradeName: 'Netflix',      trn: '100222333400003', billingAddress: 'DIFC, Dubai',               city: 'Dubai',     country: 'UAE', paymentTermDays: 45 },
    { id: 'client-rotana',  companyName: 'Rotana Studios',            tradeName: 'Rotana',       trn: '100333444500003', billingAddress: 'Khalidiyah, Abu Dhabi',     city: 'Abu Dhabi', country: 'UAE', paymentTermDays: 30 },
    { id: 'client-adfc',    companyName: 'Abu Dhabi Film Commission', tradeName: 'ADFC',         trn: null,              billingAddress: 'Twofour54, Abu Dhabi',       city: 'Abu Dhabi', country: 'UAE', paymentTermDays: 60 },
    { id: 'client-bbc',     companyName: 'BBC Studios Middle East',   tradeName: 'BBC Studios',  trn: '100555666700003', billingAddress: 'Dubai Media City',           city: 'Dubai',     country: 'UAE', paymentTermDays: 30 },
  ]) {
    await (prisma.client as any).upsert({ where: { id: cl.id }, update: {}, create: cl as any });
    await (prisma.clientContact as any).upsert({ where: { id: `cc-${cl.id}-0` }, update: {}, create: { id: `cc-${cl.id}-0`, clientId: cl.id, name: 'Primary Contact', email: `contact@${cl.id.replace('client-','')}.ae`, isPrimary: true } });
  }

  // ── Suppliers ──────────────────────────────────────────────────────────────
  console.log('🔧  suppliers…');
  for (const s of [
    { id: 'sup-emirates-auto', supplierCode: 'SUP-0001', name: 'Emirates Auto Workshop LLC',    categories: ['Maintenance Workshop','Spare Parts'],  trn: '100111222300003', contactName: 'Khalid Hassan',   email: 'khalid@emiratesauto.ae',    phone: '+971 4 123 4567', address: 'Al Quoz Industrial 3, Dubai',   city: 'Dubai',   country: 'UAE', paymentTermDays: 30, status: 'ACTIVE' },
    { id: 'sup-gulf-tyre',     supplierCode: 'SUP-0002', name: 'Gulf Tyre & Battery Center',    categories: ['Tyres & Batteries'],                   trn: '100222333400003', contactName: 'Mohammed Ali',    email: 'm.ali@gulftyre.ae',         phone: '+971 4 234 5678', address: 'Al Quoz Industrial 1, Dubai',   city: 'Dubai',   country: 'UAE', paymentTermDays: 15, status: 'ACTIVE' },
    { id: 'sup-caravan-tech',  supplierCode: 'SUP-0003', name: 'Caravan & Trailer Technology',  categories: ['Maintenance Workshop'],                trn: '100333444500003', contactName: 'Ravi Kumar',      email: 'ravi@caravantech.ae',       phone: '+971 6 345 6789', address: 'Al Sajaa Industrial, Sharjah',  city: 'Sharjah', country: 'UAE', paymentTermDays: 30, status: 'ACTIVE' },
    { id: 'sup-al-futtaim',    supplierCode: 'SUP-0004', name: 'Al Futtaim Auto & Machinery',   categories: ['Spare Parts','Equipment Rental'],       trn: '100444555600003', contactName: 'Ahmed Salim',     email: 'a.salim@alfuttaim.ae',      phone: '+971 4 200 2000', address: 'Festival City, Dubai',          city: 'Dubai',   country: 'UAE', paymentTermDays: 30, status: 'ACTIVE' },
    { id: 'sup-generator-co',  supplierCode: 'SUP-0005', name: 'Aggreko Generator Services ME', categories: ['Maintenance Workshop','Equipment Rental'], trn: '100555666700003', contactName: 'Mark Stevenson', email: 'm.stevenson@aggreko.ae',   phone: '+971 4 200 3300', address: 'Jebel Ali Free Zone, Dubai',    city: 'Dubai',   country: 'UAE', paymentTermDays: 30, status: 'ACTIVE' },
  ]) {
    await (prisma.supplier as any).upsert({ where: { id: s.id }, update: {}, create: s as any });
  }

  // ── Vendors ────────────────────────────────────────────────────────────────
  console.log('🔩  vendors…');
  for (const v of [
    { id: 'v-emirates-auto', name: 'Emirates Auto Workshop',  vendorType: 'AUTO_WORKSHOP',   contactPerson: 'Khalid Hassan',  mobile: '+971501112233', email: 'khalid@emiratesauto.ae',   address: 'Al Quoz Industrial 3', city: 'Dubai',   country: 'UAE', isActive: true, supplierId: 'sup-emirates-auto' },
    { id: 'v-gulf-tires',   name: 'Gulf Tyre & Battery',     vendorType: 'TIRE_SUPPLIER',   contactPerson: 'Mohammed Ali',   mobile: '+971502223344', email: 'm.ali@gulftyre.ae',        address: 'Al Quoz Industrial 1', city: 'Dubai',   country: 'UAE', isActive: true, supplierId: 'sup-gulf-tyre' },
    { id: 'v-caravan-tech', name: 'Caravan & Trailer Tech',  vendorType: 'CARAVAN_REPAIR',  contactPerson: 'Ravi Kumar',     mobile: '+971503334455', email: 'ravi@caravantech.ae',      address: 'Al Sajaa Industrial',  city: 'Sharjah', country: 'UAE', isActive: true, supplierId: 'sup-caravan-tech' },
    { id: 'v-generator-co', name: 'Aggreko Generator Svcs',  vendorType: 'GENERATOR_REPAIR',contactPerson: 'Mark Stevenson', mobile: '+971504445566', email: 'm.stevenson@aggreko.ae',   address: 'Jebel Ali Free Zone',  city: 'Dubai',   country: 'UAE', isActive: true, supplierId: 'sup-generator-co' },
    { id: 'v-ac-cool',      name: 'ArcticAir HVAC Services', vendorType: 'AC_REPAIR',       contactPerson: 'Sanjay Verma',   mobile: '+971505556677', email: 's.verma@arcticair.ae',     address: 'Dubai Investment Pk 2',city: 'Dubai',   country: 'UAE', isActive: true, supplierId: null },
  ]) {
    const { supplierId, ...vd } = v;
    await (prisma.maintenanceVendor as any).upsert({ where: { id: v.id }, update: {}, create: { ...vd, ...(supplierId ? { supplierId } : {}) } as any });
    await (prisma.contact as any).upsert({ where: { id: `gc-v-${v.id}` }, update: {}, create: { id: `gc-v-${v.id}`, name: v.contactPerson, contactType: 'VENDOR_EMPLOYEE', mobile: v.mobile, email: v.email, company: v.name, vendorId: v.id } });
  }

  // ── Assets ─────────────────────────────────────────────────────────────────
  console.log('🚛  assets…');
  for (const a of [
    { id: 'asset-trailer-01', assetType: 'ARTIST_TRAILER',  name: '40ft Film Production Trailer',    plateNumber: 'SH 12345', plateEmirate: 'SHJ', vinNumber: 'GLDH2020SHJ001', status: 'AVAILABLE',      condition: 'EXCELLENT', purchaseDate: d('2020-03-15'), purchaseValue: 280000, currentValue: 240000, depreciation: 10, insuranceExpiry: d('2026-12-31'), registrationExpiry: d('2026-06-30'), trailerSpecs: { axles: 3, length: 40, width: 2.5, payload: 30000 }, notes: 'Main production trailer.' },
    { id: 'asset-trailer-02', assetType: 'MAKEUP_TRAILER',  name: '30ft Makeup & Wardrobe Trailer',  plateNumber: 'SH 23456', plateEmirate: 'SHJ', vinNumber: 'WINN2019SHJ002', status: 'ON_HIRE',        condition: 'GOOD',      purchaseDate: d('2019-06-01'), purchaseValue: 180000, currentValue: 145000, depreciation: 10, insuranceExpiry: d('2026-12-31'), registrationExpiry: d('2026-09-30'), trailerSpecs: { axles: 2, length: 30, width: 2.4, payload: 10000 }, notes: 'Dual-station makeup trailer.' },
    { id: 'asset-trailer-03', assetType: 'ARTIST_TRAILER',  name: '45ft Production Office Trailer',  plateNumber: 'SH 34567', plateEmirate: 'SHJ', vinNumber: 'FRST2021SHJ003', status: 'AVAILABLE',      condition: 'EXCELLENT', purchaseDate: d('2021-01-20'), purchaseValue: 320000, currentValue: 288000, depreciation: 10, insuranceExpiry: d('2026-12-31'), registrationExpiry: d('2027-01-31'), trailerSpecs: { axles: 3, length: 45, width: 2.5, payload: 20000 }, notes: 'Director & production office.' },
    { id: 'asset-trailer-04', assetType: 'UTILITY_TRAILER', name: '35ft Catering Trailer',           plateNumber: 'SH 45678', plateEmirate: 'SHJ', vinNumber: 'DTHL2021SHJ004', status: 'IN_MAINTENANCE', condition: 'FAIR',      purchaseDate: d('2021-04-10'), purchaseValue: 150000, currentValue: 120000, depreciation: 12, insuranceExpiry: d('2026-11-30'), registrationExpiry: d('2026-04-30'), trailerSpecs: { axles: 2, length: 35, width: 2.4, payload: 8000  }, notes: 'Full commercial kitchen.' },
    { id: 'asset-gen-01',     assetType: 'GENERATOR',       name: 'Perkins 100kVA Generator',        plateNumber: null,       plateEmirate: null,  vinNumber: 'PERK2020DXB001', status: 'AVAILABLE',      condition: 'GOOD',      purchaseDate: d('2020-08-01'), purchaseValue: 45000,  currentValue: 38000,  depreciation: 15, insuranceExpiry: d('2026-12-31'), registrationExpiry: null,             trailerSpecs: null, notes: '100kVA silent diesel generator.' },
    { id: 'asset-gen-02',     assetType: 'GENERATOR',       name: 'Cummins 200kVA Generator',        plateNumber: null,       plateEmirate: null,  vinNumber: 'CUMM2019DXB002', status: 'ON_HIRE',        condition: 'GOOD',      purchaseDate: d('2019-05-15'), purchaseValue: 85000,  currentValue: 65000,  depreciation: 15, insuranceExpiry: d('2026-12-31'), registrationExpiry: null,             trailerSpecs: null, notes: 'Heavy-duty 200kVA.' },
    { id: 'asset-van-01',     assetType: 'CREW_TRANSPORT',  name: 'Toyota HiAce Production Van',     plateNumber: 'D 56789',  plateEmirate: 'DXB', vinNumber: 'TOYT2022DXB001', status: 'AVAILABLE',      condition: 'EXCELLENT', purchaseDate: d('2022-02-01'), purchaseValue: 95000,  currentValue: 82000,  depreciation: 15, insuranceExpiry: d('2026-12-31'), registrationExpiry: d('2026-02-28'), trailerSpecs: null, notes: '15-seater crew transport.' },
    { id: 'asset-van-02',     assetType: 'SUPPORT_VEHICLE', name: 'Mercedes Sprinter Equipment Van', plateNumber: 'D 67890',  plateEmirate: 'DXB', vinNumber: 'MERC2021DXB002', status: 'ON_HIRE',        condition: 'GOOD',      purchaseDate: d('2021-09-01'), purchaseValue: 135000, currentValue: 108000, depreciation: 15, insuranceExpiry: d('2026-12-31'), registrationExpiry: d('2026-09-30'), trailerSpecs: null, notes: 'High-roof sprinter.' },
    { id: 'asset-tow-01',     assetType: 'TOWING_VEHICLE',  name: 'Volvo FH16 Towing Truck',         plateNumber: 'SH 78901', plateEmirate: 'SHJ', vinNumber: 'VOLV2020SHJ001', status: 'AVAILABLE',      condition: 'GOOD',      purchaseDate: d('2020-11-01'), purchaseValue: 650000, currentValue: 520000, depreciation: 12, insuranceExpiry: d('2026-12-31'), registrationExpiry: d('2026-11-30'), trailerSpecs: null, notes: 'Primary towing unit.' },
    { id: 'asset-tow-02',     assetType: 'TOWING_VEHICLE',  name: 'MAN TGX 26.500 Towing Truck',     plateNumber: 'SH 89012', plateEmirate: 'SHJ', vinNumber: 'MAN_2021SHJ002', status: 'AVAILABLE',      condition: 'EXCELLENT', purchaseDate: d('2021-07-15'), purchaseValue: 580000, currentValue: 490000, depreciation: 12, insuranceExpiry: d('2026-12-31'), registrationExpiry: d('2026-07-31'), trailerSpecs: null, notes: 'Secondary towing truck.' },
    { id: 'asset-trailer-05', assetType: 'UTILITY_TRAILER', name: '20ft Equipment Storage Trailer',  plateNumber: 'SH 90123', plateEmirate: 'SHJ', vinNumber: 'SCHM2018SHJ005', status: 'AVAILABLE',      condition: 'GOOD',      purchaseDate: d('2018-03-01'), purchaseValue: 95000,  currentValue: 65000,  depreciation: 10, insuranceExpiry: d('2026-12-31'), registrationExpiry: d('2026-03-31'), trailerSpecs: { axles: 2, length: 20, width: 2.4, payload: 12000 }, notes: 'Dry-storage trailer.' },
    { id: 'asset-trailer-06', assetType: 'STAR_TRAILER',    name: '25ft Green Room Trailer',         plateNumber: 'SH 01234', plateEmirate: 'SHJ', vinNumber: 'AIRS2022SHJ006', status: 'AVAILABLE',      condition: 'EXCELLENT', purchaseDate: d('2022-06-01'), purchaseValue: 220000, currentValue: 198000, depreciation: 10, insuranceExpiry: d('2026-12-31'), registrationExpiry: d('2026-06-30'), trailerSpecs: { axles: 2, length: 25, width: 2.4, payload: 6000  }, notes: 'Luxury talent trailer.' },
  ]) {
    const { trailerSpecs, ...ad } = a;
    await (prisma.asset as any).upsert({ where: { id: a.id }, update: {}, create: { ...ad, ...(trailerSpecs ? { trailerSpecs } : {}) } as any });
  }

  // ── Drivers ────────────────────────────────────────────────────────────────
  console.log('👤  drivers…');
  for (const dr of [
    { id: 'driver-01', fullName: 'Ahmed Al Mansoori', driverType: 'EMPLOYEE', mobile: '+971501112233', email: 'ahmed.mansoori@tfm.ae', licenseNumber: 'UAE-LN-112233', licenseExpiry: d('2027-05-15'), licenseClass: 'Heavy Vehicle', isActive: true },
    { id: 'driver-02', fullName: 'Rajesh Menon',       driverType: 'EMPLOYEE', mobile: '+971502223344', email: 'rajesh.menon@tfm.ae',   licenseNumber: 'UAE-LN-223344', licenseExpiry: d('2026-09-20'), licenseClass: 'Heavy Vehicle', isActive: true },
    { id: 'driver-03', fullName: 'Carlos Santos',      driverType: 'EMPLOYEE', mobile: '+971503334455', email: 'carlos.santos@tfm.ae',  licenseNumber: 'UAE-LN-334455', licenseExpiry: d('2027-02-10'), licenseClass: 'Light Vehicle', isActive: true },
    { id: 'driver-04', fullName: 'Michael Okafor',     driverType: 'EMPLOYEE', mobile: '+971504445566', email: 'michael.okafor@tfm.ae', licenseNumber: 'UAE-LN-445566', licenseExpiry: d('2028-11-05'), licenseClass: 'Heavy Vehicle', isActive: true },
  ]) {
    await (prisma.driver as any).upsert({ where: { id: dr.id }, update: {}, create: dr as any });
    await (prisma.contact as any).upsert({ where: { id: `gc-dr-${dr.id}` }, update: {}, create: { id: `gc-dr-${dr.id}`, name: dr.fullName, contactType: 'DRIVER_CONTACT', mobile: dr.mobile, email: dr.email, company: 'The Film Makers FZ LLC', driverId: dr.id } });
  }

  // ── Quotations ─────────────────────────────────────────────────────────────
  console.log('📄  quotations…');
  await (prisma.quotation as any).upsert({ where: { id: 'quot-01' }, update: {},
    create: { id: 'quot-01', quotationNumber: 'QUO-2026-0001', clientId: 'client-mbc', activity: 'RENTAL', status: 'APPROVED', issueDate: d('2026-01-10'), validUntil: d('2026-02-10'), currency: 'AED', subtotal: 85000, discountAmount: 0, vatAmount: 4250, total: 89250, vatDisplay: 'EXCLUSIVE', createdById: 'user-sales', notes: 'Approved by client.',
      items: { create: [
        { id: 'qi-01-1', sortOrder: 1, description: '40ft Production Trailer - 14 days', quantity: 1, unitPrice: 42000, lineTotal: 42000, discountPct: 0, taxAmount: 2100 },
        { id: 'qi-01-2', sortOrder: 2, description: '200kVA Generator - 14 days',        quantity: 1, unitPrice: 28000, lineTotal: 28000, discountPct: 0, taxAmount: 1400 },
        { id: 'qi-01-3', sortOrder: 3, description: 'Towing Service (round trip)',        quantity: 2, unitPrice: 7500,  lineTotal: 15000, discountPct: 0, taxAmount:  750 },
      ]},
    },
  });
  await (prisma.quotation as any).upsert({ where: { id: 'quot-02' }, update: {},
    create: { id: 'quot-02', quotationNumber: 'QUO-2026-0002', clientId: 'client-netflix', activity: 'RENTAL', status: 'SENT', issueDate: d('2026-02-01'), validUntil: d('2026-03-01'), currency: 'AED', subtotal: 120000, discountAmount: 0, vatAmount: 0, total: 120000, vatDisplay: 'EXCLUSIVE', createdById: 'user-sales', notes: 'Pending client approval.',
      items: { create: [
        { id: 'qi-02-1', sortOrder: 1, description: 'Makeup & Wardrobe Trailer - 21 days', quantity: 1, unitPrice: 38000, lineTotal: 38000, discountPct: 0, taxAmount: 0 },
        { id: 'qi-02-2', sortOrder: 2, description: 'Green Room Trailer - 21 days',         quantity: 1, unitPrice: 46000, lineTotal: 46000, discountPct: 0, taxAmount: 0 },
        { id: 'qi-02-3', sortOrder: 3, description: 'Equipment Van - 21 days',               quantity: 1, unitPrice: 20000, lineTotal: 20000, discountPct: 0, taxAmount: 0 },
        { id: 'qi-02-4', sortOrder: 4, description: 'Driver service x2',                    quantity: 2, unitPrice: 8000,  lineTotal: 16000, discountPct: 0, taxAmount: 0 },
      ]},
    },
  });

  // ── Bookings ───────────────────────────────────────────────────────────────
  console.log('📅  bookings…');
  for (const bk of [
    { id: 'bkg-01', bookingNumber: 'BKG-2026-0001', clientId: 'client-mbc',     status: 'COMPLETED', startDate: d('2026-01-20'), endDate: d('2026-02-03'), subtotal: 70000, discountAmount: 0, vatAmount: 3500, total: 73500, currency: 'AED', deliveryAddress: 'MBC Studios, Dubai Media City', createdById: 'user-sales', notes: 'Drama series. Delivered on time.',
      items: [{ id: 'bi-01-1', assetId: 'asset-trailer-01', sortOrder: 1, description: '40ft Production Trailer', quantity: 1, unit: 'day', unitPrice: 3000, days: 14, lineTotal: 42000, taxAmount: 2100 }, { id: 'bi-01-2', assetId: 'asset-gen-02', sortOrder: 2, description: '200kVA Generator', quantity: 1, unit: 'day', unitPrice: 2000, days: 14, lineTotal: 28000, taxAmount: 1400 }] },
    { id: 'bkg-02', bookingNumber: 'BKG-2026-0002', clientId: 'client-netflix', status: 'ACTIVE',    startDate: d('2026-02-15'), endDate: d('2026-03-08'), subtotal: 86000, discountAmount: 0, vatAmount: 0,    total: 86000, currency: 'AED', deliveryAddress: 'Alserkal Avenue, Al Quoz', createdById: 'user-sales', notes: 'Documentary shoot.',
      items: [{ id: 'bi-02-1', assetId: 'asset-trailer-02', sortOrder: 1, description: 'Makeup Trailer', quantity: 1, unit: 'day', unitPrice: 1810, days: 21, lineTotal: 38010, taxAmount: 0 }, { id: 'bi-02-2', assetId: 'asset-van-02', sortOrder: 2, description: 'Equipment Van', quantity: 1, unit: 'day', unitPrice: 952, days: 21, lineTotal: 19992, taxAmount: 0 }, { id: 'bi-02-3', assetId: 'asset-gen-02', sortOrder: 3, description: '200kVA Generator', quantity: 1, unit: 'day', unitPrice: 1333, days: 21, lineTotal: 27993, taxAmount: 0 }] },
    { id: 'bkg-03', bookingNumber: 'BKG-2026-0003', clientId: 'client-rotana',  status: 'COMPLETED', startDate: d('2025-12-01'), endDate: d('2025-12-20'), subtotal: 65000, discountAmount: 0, vatAmount: 3250, total: 68250, currency: 'AED', deliveryAddress: 'Rotana Studios, Abu Dhabi', createdById: 'user-sales', notes: 'TV commercial.',
      items: [{ id: 'bi-03-1', assetId: 'asset-trailer-03', sortOrder: 1, description: '45ft Office Trailer', quantity: 1, unit: 'day', unitPrice: 2400, days: 20, lineTotal: 48000, taxAmount: 2400 }, { id: 'bi-03-2', assetId: 'asset-gen-01', sortOrder: 2, description: '100kVA Generator', quantity: 1, unit: 'day', unitPrice: 850, days: 20, lineTotal: 17000, taxAmount: 850 }] },
    { id: 'bkg-04', bookingNumber: 'BKG-2026-0004', clientId: 'client-adfc',    status: 'SCHEDULED', startDate: addDays(new Date(), 10), endDate: addDays(new Date(), 25), subtotal: 92000, discountAmount: 0, vatAmount: 0, total: 92000, currency: 'AED', deliveryAddress: 'Twofour54, Abu Dhabi', createdById: 'user-sales', notes: 'Feature film.',
      items: [{ id: 'bi-04-1', assetId: 'asset-trailer-01', sortOrder: 1, description: '40ft Production Trailer', quantity: 1, unit: 'day', unitPrice: 3667, days: 15, lineTotal: 55005, taxAmount: 0 }, { id: 'bi-04-2', assetId: 'asset-trailer-06', sortOrder: 2, description: 'Green Room Trailer', quantity: 1, unit: 'day', unitPrice: 2467, days: 15, lineTotal: 37005, taxAmount: 0 }] },
    { id: 'bkg-05', bookingNumber: 'BKG-2026-0005', clientId: 'client-bbc',     status: 'COMPLETED', startDate: d('2025-11-05'), endDate: d('2025-11-15'), subtotal: 42000, discountAmount: 0, vatAmount: 2100, total: 44100, currency: 'AED', deliveryAddress: 'Dubai Creek, Deira', createdById: 'user-sales', notes: 'Travel documentary.',
      items: [{ id: 'bi-05-1', assetId: 'asset-van-01', sortOrder: 1, description: 'HiAce Production Van', quantity: 1, unit: 'day', unitPrice: 1800, days: 10, lineTotal: 18000, taxAmount: 900 }, { id: 'bi-05-2', assetId: 'asset-trailer-05', sortOrder: 2, description: '20ft Storage Trailer', quantity: 1, unit: 'day', unitPrice: 2400, days: 10, lineTotal: 24000, taxAmount: 1200 }] },
    { id: 'bkg-06', bookingNumber: 'BKG-2026-0006', clientId: 'client-mbc',     status: 'CANCELLED', startDate: d('2026-01-05'), endDate: d('2026-01-10'), subtotal: 12000, discountAmount: 0, vatAmount: 600, total: 12600, currency: 'AED', deliveryAddress: 'Dubai Media City', createdById: 'user-sales', notes: 'Cancelled by client.',
      items: [{ id: 'bi-06-1', assetId: 'asset-gen-01', sortOrder: 1, description: '100kVA Generator', quantity: 1, unit: 'day', unitPrice: 2400, days: 5, lineTotal: 12000, taxAmount: 600 }] },
  ]) {
    const { items, ...bkd } = bk;
    await (prisma.rentalBooking as any).upsert({ where: { id: bk.id }, update: {}, create: bkd as any });
    for (const it of items) {
      await (prisma.bookingItem as any).upsert({ where: { id: it.id }, update: {}, create: { ...it, bookingId: bk.id } as any });
    }
  }

  // ── Invoices ───────────────────────────────────────────────────────────────
  console.log('🧾  invoices…');
  for (const inv of [
    { id: 'inv-01', invoiceNumber: 'INV-2026-0001', clientId: 'client-mbc',     bookingId: 'bkg-01', activity: 'RENTAL', invoiceType: 'TAX_INVOICE', status: 'PAID',            issueDate: d('2026-02-05'), dueDate: d('2026-03-05'), currency: 'AED', subtotal: 70000, discountAmount: 0, vatAmount: 3500,  total: 73500, amountPaid: 73500, amountDue: 0,     vatDisplay: 'EXCLUSIVE', createdById: 'user-finance', notes: 'Full payment received.',
      items: [{ id: 'ii-01-1', sortOrder: 1, description: '40ft Production Trailer - 14d', quantity: 1, unitPrice: 42000, lineTotal: 42000, discountPct: 0, taxAmount: 2100 }, { id: 'ii-01-2', sortOrder: 2, description: '200kVA Generator - 14d', quantity: 1, unitPrice: 28000, lineTotal: 28000, discountPct: 0, taxAmount: 1400 }] },
    { id: 'inv-02', invoiceNumber: 'INV-2026-0002', clientId: 'client-netflix', bookingId: 'bkg-02', activity: 'RENTAL', invoiceType: 'TAX_INVOICE', status: 'PARTIALLY_PAID',  issueDate: d('2026-02-20'), dueDate: d('2026-03-20'), currency: 'AED', subtotal: 86000, discountAmount: 0, vatAmount: 0,     total: 86000, amountPaid: 43000, amountDue: 43000, vatDisplay: 'EXCLUSIVE', createdById: 'user-finance', notes: '50% advance received.',
      items: [{ id: 'ii-02-1', sortOrder: 1, description: 'Makeup Trailer - 21d', quantity: 1, unitPrice: 38000, lineTotal: 38000, discountPct: 0, taxAmount: 0 }, { id: 'ii-02-2', sortOrder: 2, description: 'Equipment Van - 21d', quantity: 1, unitPrice: 28000, lineTotal: 28000, discountPct: 0, taxAmount: 0 }, { id: 'ii-02-3', sortOrder: 3, description: '200kVA Generator - 21d', quantity: 1, unitPrice: 20000, lineTotal: 20000, discountPct: 0, taxAmount: 0 }] },
    { id: 'inv-03', invoiceNumber: 'INV-2025-0098', clientId: 'client-bbc',     bookingId: 'bkg-05', activity: 'RENTAL', invoiceType: 'TAX_INVOICE', status: 'OVERDUE',         issueDate: d('2025-11-20'), dueDate: d('2025-12-20'), currency: 'AED', subtotal: 42000, discountAmount: 0, vatAmount: 2100, total: 44100, amountPaid: 0,     amountDue: 44100, vatDisplay: 'EXCLUSIVE', createdById: 'user-finance', notes: 'Follow up x3. Escalate.',
      items: [{ id: 'ii-03-1', sortOrder: 1, description: 'HiAce Van - 10d', quantity: 1, unitPrice: 18000, lineTotal: 18000, discountPct: 0, taxAmount: 900 }, { id: 'ii-03-2', sortOrder: 2, description: '20ft Storage Trailer - 10d', quantity: 1, unitPrice: 24000, lineTotal: 24000, discountPct: 0, taxAmount: 1200 }] },
    { id: 'inv-04', invoiceNumber: 'INV-2025-0085', clientId: 'client-rotana',  bookingId: 'bkg-03', activity: 'RENTAL', invoiceType: 'TAX_INVOICE', status: 'PAID',            issueDate: d('2025-12-22'), dueDate: d('2026-01-22'), currency: 'AED', subtotal: 65000, discountAmount: 0, vatAmount: 3250, total: 68250, amountPaid: 68250, amountDue: 0,     vatDisplay: 'EXCLUSIVE', createdById: 'user-finance', notes: 'Paid in full.',
      items: [{ id: 'ii-04-1', sortOrder: 1, description: '45ft Office Trailer - 20d', quantity: 1, unitPrice: 48000, lineTotal: 48000, discountPct: 0, taxAmount: 2400 }, { id: 'ii-04-2', sortOrder: 2, description: '100kVA Generator - 20d', quantity: 1, unitPrice: 17000, lineTotal: 17000, discountPct: 0, taxAmount: 850 }] },
  ]) {
    const { items, ...invd } = inv;
    await (prisma.invoice as any).upsert({ where: { id: inv.id }, update: {}, create: invd as any });
    for (const it of items) {
      await (prisma.invoiceItem as any).upsert({ where: { id: it.id }, update: {}, create: { ...it, invoiceId: inv.id } as any });
    }
  }

  // ── Payments ───────────────────────────────────────────────────────────────
  console.log('💳  payments…');
  for (const p of [
    { id: 'pay-01', paymentNumber: 'PAY-2026-0001', invoiceId: 'inv-01', clientId: 'client-mbc',     amount: 73500, currency: 'AED', paymentDate: d('2026-02-20'), method: 'BANK_TRANSFER', status: 'CLEARED', reference: 'TRF-MBC-20260220' },
    { id: 'pay-02', paymentNumber: 'PAY-2026-0002', invoiceId: 'inv-02', clientId: 'client-netflix', amount: 43000, currency: 'AED', paymentDate: d('2026-02-16'), method: 'BANK_TRANSFER', status: 'CLEARED', reference: 'TRF-NFLX-20260216' },
    { id: 'pay-03', paymentNumber: 'PAY-2026-0003', invoiceId: 'inv-04', clientId: 'client-rotana',  amount: 68250, currency: 'AED', paymentDate: d('2026-01-15'), method: 'BANK_TRANSFER', status: 'CLEARED', reference: 'TRF-ROT-20260115' },
  ]) {
    await (prisma.payment as any).upsert({ where: { id: p.id }, update: {}, create: p as any });
  }

  // ── Expenses ───────────────────────────────────────────────────────────────
  console.log('💸  expenses…');
  for (const ex of [
    { id: 'exp-01', expenseNumber: 'EXP-2026-0001', activity: 'RENTAL', category: 'Fuel',         description: 'Diesel — Volvo TOW-001 MBC delivery',         amount: 850,   currency: 'AED', vatAmount: 0,    totalAmount: 850,   expenseDate: d('2026-01-08'), status: 'APPROVED',          vendorName: 'ENOC Al Quoz',            createdById: 'user-maintenance', supplierId: null },
    { id: 'exp-02', expenseNumber: 'EXP-2026-0002', activity: 'RENTAL', category: 'Maintenance',  description: 'Oil & filter service — Volvo TOW-001',         amount: 2286,  currency: 'AED', vatAmount: 114,  totalAmount: 2400,  expenseDate: d('2026-01-18'), status: 'APPROVED',          vendorName: 'Emirates Auto Workshop',  createdById: 'user-maintenance', supplierId: 'sup-emirates-auto' },
    { id: 'exp-03', expenseNumber: 'EXP-2026-0003', activity: 'RENTAL', category: 'Tyres',        description: 'Tyre replacement x4 — MAN TGX TOW-002',        amount: 8381,  currency: 'AED', vatAmount: 419,  totalAmount: 8800,  expenseDate: d('2026-01-25'), status: 'APPROVED',          vendorName: 'Gulf Tyre & Battery',     createdById: 'user-maintenance', supplierId: 'sup-gulf-tyre' },
    { id: 'exp-04', expenseNumber: 'EXP-2026-0004', activity: 'RENTAL', category: 'Insurance',    description: 'Fleet insurance renewal — 12 vehicles',         amount: 27143, currency: 'AED', vatAmount: 1357, totalAmount: 28500, expenseDate: d('2026-02-05'), status: 'APPROVED',          vendorName: 'AXA Insurance UAE',       createdById: 'user-finance',      supplierId: null },
    { id: 'exp-05', expenseNumber: 'EXP-2026-0005', activity: 'RENTAL', category: 'Registration', description: 'Vehicle registration renewal — TRL-001 & TRL-002', amount: 3200, currency: 'AED', vatAmount: 0,   totalAmount: 3200,  expenseDate: d('2026-02-12'), status: 'APPROVED',          vendorName: 'RTA Dubai',               createdById: 'user-maintenance', supplierId: null },
    { id: 'exp-06', expenseNumber: 'EXP-2026-0006', activity: 'RENTAL', category: 'Repairs',      description: 'Catering trailer exhaust fan replacement',      amount: 1571,  currency: 'AED', vatAmount: 79,   totalAmount: 1650,  expenseDate: d('2026-02-20'), status: 'APPROVED',          vendorName: 'Aggreko Generator Svcs',  createdById: 'user-maintenance', supplierId: 'sup-generator-co' },
    { id: 'exp-07', expenseNumber: 'EXP-2026-0007', activity: 'RENTAL', category: 'Tolls',        description: 'Salik toll recharges — March fleet',            amount: 780,   currency: 'AED', vatAmount: 0,    totalAmount: 780,   expenseDate: d('2026-03-01'), status: 'APPROVED',          vendorName: 'Salik RTA',               createdById: 'user-finance',      supplierId: null },
    { id: 'exp-08', expenseNumber: 'EXP-2026-0008', activity: 'RENTAL', category: 'Fuel',         description: 'Diesel — MAN TGX Rotana Abu Dhabi run',         amount: 2000,  currency: 'AED', vatAmount: 0,    totalAmount: 2000,  expenseDate: d('2026-03-05'), status: 'APPROVED',          vendorName: 'ADNOC Station',           createdById: 'user-maintenance', supplierId: null },
    { id: 'exp-09', expenseNumber: 'EXP-2026-0009', activity: 'RENTAL', category: 'Maintenance',  description: 'A/C annual service — Makeup Trailer TRL-002',   amount: 1143,  currency: 'AED', vatAmount: 57,   totalAmount: 1200,  expenseDate: d('2026-03-10'), status: 'PENDING_APPROVAL',  vendorName: 'ArcticAir HVAC',          createdById: 'user-maintenance', supplierId: null },
  ]) {
    const { supplierId, ...exd } = ex;
    await (prisma.expense as any).upsert({ where: { id: ex.id }, update: {}, create: { ...exd, ...(supplierId ? { supplierId } : {}) } as any });
  }

  // ── Vendor Jobs ────────────────────────────────────────────────────────────
  console.log('🔩  maint. jobs…');
  for (const jb of [
    { id: 'vmj-01', jobNumber: 'MJ-2026-0001', vendorId: 'v-emirates-auto', assetId: 'asset-tow-01',     status: 'COMPLETED',  priority: 'NORMAL', category: 'Routine Service',    problemDescription: '10,000km service — oil, filters, brakes', openedAt: d('2026-01-18'), actualCompletion: d('2026-01-18'), estimatedCompletion: d('2026-01-18'), laborCost: 800,  partsCost: 1600, subtotal: 2400,  vatAmount: 120,   totalCost: 2520  },
    { id: 'vmj-02', jobNumber: 'MJ-2026-0002', vendorId: 'v-gulf-tires',   assetId: 'asset-tow-02',     status: 'COMPLETED',  priority: 'HIGH',   category: 'Tyre Replacement',   problemDescription: 'Front axle tyre replacement x4',           openedAt: d('2026-01-25'), actualCompletion: d('2026-01-25'), estimatedCompletion: d('2026-01-25'), laborCost: 400,  partsCost: 8400, subtotal: 8800,  vatAmount: 440,   totalCost: 9240  },
    { id: 'vmj-03', jobNumber: 'MJ-2026-0003', vendorId: 'v-generator-co', assetId: 'asset-trailer-04', status: 'IN_PROGRESS',priority: 'HIGH',   category: 'Generator Repair',   problemDescription: 'Exhaust fan seized + 500hr generator service', openedAt: d('2026-02-20'), actualCompletion: null, estimatedCompletion: addDays(new Date(), 3), laborCost: null, partsCost: null, subtotal: null, vatAmount: null, totalCost: null },
    { id: 'vmj-04', jobNumber: 'MJ-2026-0004', vendorId: 'v-emirates-auto', assetId: 'asset-van-01',    status: 'COMPLETED',  priority: 'LOW',    category: 'A/C Service',        problemDescription: 'A/C regas and cabin filter replacement',    openedAt: d('2025-12-10'), actualCompletion: d('2025-12-10'), estimatedCompletion: d('2025-12-10'), laborCost: 300,  partsCost: 450,  subtotal: 750,   vatAmount: 37.5,  totalCost: 787.5 },
    { id: 'vmj-05', jobNumber: 'MJ-2026-0005', vendorId: 'v-caravan-tech', assetId: 'asset-trailer-01', status: 'COMPLETED',  priority: 'NORMAL', category: 'Annual Inspection',  problemDescription: 'Annual roadworthiness — axle, suspension, lights', openedAt: d('2025-11-15'), actualCompletion: d('2025-11-15'), estimatedCompletion: d('2025-11-15'), laborCost: 2000, partsCost: 2200, subtotal: 4200, vatAmount: 210, totalCost: 4410 },
    { id: 'vmj-06', jobNumber: 'MJ-2026-0006', vendorId: 'v-generator-co', assetId: 'asset-gen-01',     status: 'COMPLETED',  priority: 'NORMAL', category: 'Generator Service',  problemDescription: '250hr Perkins service — oil, coolant, injectors', openedAt: d('2026-01-30'), actualCompletion: d('2026-01-30'), estimatedCompletion: d('2026-01-30'), laborCost: 750, partsCost: 1000, subtotal: 1750, vatAmount: 87.5, totalCost: 1837.5 },
    { id: 'vmj-07', jobNumber: 'MJ-2026-0007', vendorId: 'v-ac-cool',      assetId: 'asset-trailer-02', status: 'PENDING',    priority: 'LOW',    category: 'A/C Service',        problemDescription: 'Annual A/C service — Makeup Trailer',       openedAt: addDays(new Date(), -1), actualCompletion: null, estimatedCompletion: addDays(new Date(), 5), laborCost: null, partsCost: null, subtotal: null, vatAmount: null, totalCost: null },
    { id: 'vmj-08', jobNumber: 'MJ-2026-0008', vendorId: 'v-emirates-auto', assetId: 'asset-tow-01',    status: 'PENDING',    priority: 'NORMAL', category: 'Pre-trip Inspection', problemDescription: 'Pre-trip inspection before Abu Dhabi delivery', openedAt: addDays(new Date(), -1), actualCompletion: null, estimatedCompletion: addDays(new Date(), 14), laborCost: null, partsCost: null, subtotal: null, vatAmount: null, totalCost: null },
  ]) {
    await (prisma.vendorMaintenanceJob as any).upsert({ where: { id: jb.id }, update: {}, create: jb as any });
  }

  // ── Vendor Invoices & Payments ─────────────────────────────────────────────
  console.log('🏭  vendor invoices…');
  for (const vi of [
    { id: 'vi-01', invoiceNumber: 'EMI-INV-0118', vendorId: 'v-emirates-auto', jobId: 'vmj-01', status: 'PAID',      issuedAt: d('2026-01-18'), dueDate: d('2026-02-18'), laborCost: 800,  partsCost: 1600, subtotal: 2400,  vatAmount: 120,   total: 2520,  amountPaid: 2520, amountDue: 0 },
    { id: 'vi-02', invoiceNumber: 'GT-INV-0125',  vendorId: 'v-gulf-tires',   jobId: 'vmj-02', status: 'PAID',      issuedAt: d('2026-01-25'), dueDate: d('2026-02-25'), laborCost: 400,  partsCost: 8400, subtotal: 8800,  vatAmount: 440,   total: 9240,  amountPaid: 9240, amountDue: 0 },
    { id: 'vi-03', invoiceNumber: 'AG-INV-0220',  vendorId: 'v-generator-co', jobId: 'vmj-03', status: 'SUBMITTED', issuedAt: d('2026-02-20'), dueDate: d('2026-03-20'), laborCost: 300,  partsCost: 1350, subtotal: 1650,  vatAmount: 82.5,  total: 1732.5,amountPaid: 0,    amountDue: 1732.5 },
    { id: 'vi-04', invoiceNumber: 'EMI-INV-1210', vendorId: 'v-emirates-auto', jobId: 'vmj-04', status: 'PAID',      issuedAt: d('2025-12-10'), dueDate: d('2026-01-10'), laborCost: 300,  partsCost: 450,  subtotal: 750,   vatAmount: 37.5,  total: 787.5, amountPaid: 787.5,amountDue: 0 },
    { id: 'vi-05', invoiceNumber: 'CTT-INV-1115', vendorId: 'v-caravan-tech', jobId: 'vmj-05', status: 'PAID',      issuedAt: d('2025-11-15'), dueDate: d('2025-12-15'), laborCost: 2000, partsCost: 2200, subtotal: 4200,  vatAmount: 210,   total: 4410,  amountPaid: 4410, amountDue: 0 },
  ]) {
    await (prisma.vendorInvoice as any).upsert({ where: { id: vi.id }, update: {}, create: vi as any });
  }
  for (const vp of [
    { id: 'vp-01', paymentNumber: 'VP-2026-0001', vendorId: 'v-emirates-auto', invoiceId: 'vi-01', amount: 2520,  currency: 'AED', paymentDate: d('2026-02-01'), method: 'BANK_TRANSFER', status: 'CLEARED', reference: 'TRF-EMI-20260201' },
    { id: 'vp-02', paymentNumber: 'VP-2026-0002', vendorId: 'v-gulf-tires',   invoiceId: 'vi-02', amount: 9240,  currency: 'AED', paymentDate: d('2026-02-10'), method: 'BANK_TRANSFER', status: 'CLEARED', reference: 'TRF-GT-20260210' },
    { id: 'vp-03', paymentNumber: 'VP-2026-0003', vendorId: 'v-caravan-tech', invoiceId: 'vi-05', amount: 4410,  currency: 'AED', paymentDate: d('2025-12-10'), method: 'BANK_TRANSFER', status: 'CLEARED', reference: 'TRF-CTT-20251210' },
  ]) {
    await (prisma.vendorPayment as any).upsert({ where: { id: vp.id }, update: {}, create: vp as any });
  }

  // ── Spare Parts ────────────────────────────────────────────────────────────
  console.log('⚙️   spare parts…');
  for (const sp of [
    { id: 'sp-01', name: 'Perkins Engine Oil 10W-40 (20L)',    partNumber: 'PERK-OIL-001', manufacturer: 'Castrol',     vendorId: 'v-emirates-auto', assetId: 'asset-gen-01',     jobId: 'vmj-06', purchaseDate: d('2026-01-30'), purchasePrice: 280,  condition: 'GOOD',  isActive: true },
    { id: 'sp-02', name: 'Bridgestone M860A 315/80R22.5',      partNumber: 'BRST-315-001', manufacturer: 'Bridgestone', vendorId: 'v-gulf-tires',    assetId: 'asset-tow-02',     jobId: 'vmj-02', purchaseDate: d('2026-01-25'), purchasePrice: 1850, condition: 'GOOD',  isActive: true },
    { id: 'sp-03', name: 'Cummins Fuel Filter FF5580',         partNumber: 'GEN-FILT-001', manufacturer: 'Cummins',     vendorId: 'v-generator-co',  assetId: 'asset-gen-02',     jobId: null,     purchaseDate: d('2026-01-15'), purchasePrice: 85,   condition: 'NEW',   isActive: true },
    { id: 'sp-04', name: 'Trailer LED Tail Light Assembly',    partNumber: 'LED-TRAIL-001',manufacturer: 'Hella',       vendorId: 'v-caravan-tech',  assetId: 'asset-trailer-01', jobId: 'vmj-05', purchaseDate: d('2025-11-15'), purchasePrice: 320,  condition: 'GOOD',  isActive: true },
    { id: 'sp-05', name: 'Heavy Truck Air Filter Universal',   partNumber: 'AF-HT-001',    manufacturer: 'Mann Filter', vendorId: 'v-emirates-auto', assetId: 'asset-tow-01',     jobId: 'vmj-01', purchaseDate: d('2026-01-18'), purchasePrice: 145,  condition: 'GOOD',  isActive: true },
  ]) {
    const { jobId, ...spd } = sp;
    await (prisma.sparePart as any).upsert({ where: { id: sp.id }, update: {}, create: { ...spd, ...(jobId ? { jobId } : {}) } as any });
  }

  // ── Tire Records ───────────────────────────────────────────────────────────
  console.log('🔵  tire records…');
  for (const tr of [
    { id: 'tr-01', assetId: 'asset-tow-01', vendorId: 'v-gulf-tires', position: 'FRONT_LEFT',      manufacturer: 'Bridgestone', model: 'R268',    size: '295/80R22.5', purchaseDate: d('2025-06-01'), installationDate: d('2025-06-01'), purchasePrice: 1650, odometerAtInstall: 75000, currentOdometer: 95000, isActive: true },
    { id: 'tr-02', assetId: 'asset-tow-01', vendorId: 'v-gulf-tires', position: 'FRONT_RIGHT',     manufacturer: 'Bridgestone', model: 'R268',    size: '295/80R22.5', purchaseDate: d('2025-06-01'), installationDate: d('2025-06-01'), purchasePrice: 1650, odometerAtInstall: 75000, currentOdometer: 95000, isActive: true },
    { id: 'tr-03', assetId: 'asset-tow-02', vendorId: 'v-gulf-tires', position: 'FRONT_LEFT',      manufacturer: 'Bridgestone', model: 'M860A',   size: '315/80R22.5', purchaseDate: d('2026-01-25'), installationDate: d('2026-01-25'), purchasePrice: 1850, odometerAtInstall: 61000, currentOdometer: 61000, isActive: true },
    { id: 'tr-04', assetId: 'asset-tow-02', vendorId: 'v-gulf-tires', position: 'FRONT_RIGHT',     manufacturer: 'Bridgestone', model: 'M860A',   size: '315/80R22.5', purchaseDate: d('2026-01-25'), installationDate: d('2026-01-25'), purchasePrice: 1850, odometerAtInstall: 61000, currentOdometer: 61000, isActive: true },
    { id: 'tr-05', assetId: 'asset-van-01', vendorId: 'v-gulf-tires', position: 'FRONT_LEFT',      manufacturer: 'Michelin',    model: 'Agilis 3',size: '215/75R16C',  purchaseDate: d('2024-09-01'), installationDate: d('2024-09-01'), purchasePrice: 580,  odometerAtInstall: 12000, currentOdometer: 28500, isActive: true },
    { id: 'tr-06', assetId: 'asset-van-02', vendorId: 'v-gulf-tires', position: 'REAR_LEFT_INNER', manufacturer: 'Michelin',    model: 'Agilis 3',size: '235/65R16C',  purchaseDate: d('2023-11-01'), installationDate: d('2023-11-01'), purchasePrice: 620,  odometerAtInstall: 18000, currentOdometer: 52000, isActive: false },
  ]) {
    await (prisma.tireRecord as any).upsert({ where: { id: tr.id }, update: {}, create: tr as any });
  }

  // ── Maintenance Logs ───────────────────────────────────────────────────────
  console.log('📋  maint. logs…');
  for (const ml of [
    { id: 'ml-01', assetId: 'asset-tow-01',     maintenanceType: 'PREVENTIVE', status: 'COMPLETED',   description: '10,000km service — oil, filters, brakes',      scheduledDate: d('2026-01-18'), completedDate: d('2026-01-18'), cost: 2400,  vendorName: 'Emirates Auto Workshop',     partsReplaced: 'Oil filter, air filter, fuel filter, 12L oil', nextServiceDate: d('2026-07-18'), downTimeDays: 1 },
    { id: 'ml-02', assetId: 'asset-tow-02',     maintenanceType: 'CORRECTIVE', status: 'COMPLETED',   description: 'Front axle tyre replacement x4',                scheduledDate: d('2026-01-25'), completedDate: d('2026-01-25'), cost: 8800,  vendorName: 'Gulf Tyre & Battery',        partsReplaced: '4x Bridgestone M860A 315/80R22.5', nextServiceDate: d('2027-01-25'), downTimeDays: 1 },
    { id: 'ml-03', assetId: 'asset-gen-01',     maintenanceType: 'PREVENTIVE', status: 'COMPLETED',   description: '250hr Perkins generator service',               scheduledDate: d('2026-01-30'), completedDate: d('2026-01-30'), cost: 1750,  vendorName: 'Aggreko Generator Services', partsReplaced: 'Oil 8L, coolant 5L, filters', nextServiceDate: addDays(d('2026-01-30'), 120), downTimeDays: 1 },
    { id: 'ml-04', assetId: 'asset-trailer-01', maintenanceType: 'INSPECTION', status: 'COMPLETED',   description: 'Annual roadworthiness inspection — passed',     scheduledDate: d('2025-11-15'), completedDate: d('2025-11-15'), cost: 4200,  vendorName: 'Caravan & Trailer Technology', partsReplaced: 'Grease, lubricant', nextServiceDate: d('2026-11-15'), downTimeDays: 1 },
    { id: 'ml-05', assetId: 'asset-van-01',     maintenanceType: 'CORRECTIVE', status: 'COMPLETED',   description: 'A/C regas and cabin filter replacement',        scheduledDate: d('2025-12-10'), completedDate: d('2025-12-10'), cost: 750,   vendorName: 'Emirates Auto Workshop',     partsReplaced: 'R134a 800g, cabin filter', nextServiceDate: d('2026-06-10'), downTimeDays: 0 },
    { id: 'ml-06', assetId: 'asset-trailer-04', maintenanceType: 'CORRECTIVE', status: 'IN_PROGRESS', description: 'Generator + exhaust fan repair in progress',    scheduledDate: d('2026-02-20'), completedDate: null,            cost: null,  vendorName: 'Aggreko Generator Services', partsReplaced: 'Exhaust fan replaced', nextServiceDate: null, downTimeDays: null },
  ]) {
    await (prisma.maintenanceLog as any).upsert({ where: { id: ml.id }, update: {}, create: ml as any });
  }

  // ── Fuel Logs ──────────────────────────────────────────────────────────────
  console.log('⛽  fuel logs…');
  for (const fl of [
    { id: 'fl-01', assetId: 'asset-tow-01', logDate: d('2026-01-08'), litres: 320, costPerLitre: 2.89, totalCost: 924.80, odometer: 89500, notes: 'Full tank before MBC delivery' },
    { id: 'fl-02', assetId: 'asset-tow-01', logDate: d('2026-01-20'), litres: 285, costPerLitre: 2.89, totalCost: 823.65, odometer: 92000, notes: 'On-site refuel MBC Studios' },
    { id: 'fl-03', assetId: 'asset-tow-02', logDate: d('2026-02-15'), litres: 310, costPerLitre: 2.89, totalCost: 895.90, odometer: 58000, notes: 'Pre-trip Jebel Ali' },
    { id: 'fl-04', assetId: 'asset-tow-02', logDate: d('2026-03-05'), litres: 290, costPerLitre: 2.92, totalCost: 846.80, odometer: 60500, notes: 'Abu Dhabi run refuel' },
    { id: 'fl-05', assetId: 'asset-van-01', logDate: d('2026-02-10'), litres: 60,  costPerLitre: 2.63, totalCost: 157.80, odometer: 27000, notes: 'Regular fill EPPCO Al Quoz' },
    { id: 'fl-06', assetId: 'asset-gen-01', logDate: d('2026-01-22'), litres: 200, costPerLitre: 2.89, totalCost: 578.00, odometer: null,  notes: 'Delivered to yard — generator tank' },
  ]) {
    await (prisma.fuelLog as any).upsert({ where: { id: fl.id }, update: {}, create: fl as any });
  }

  console.log('');
  console.log('✅  Seed complete!');
  console.log('   Users 6 · Clients 5 · Suppliers 5 · Vendors 5');
  console.log('   Assets 12 · Drivers 4 · Quotations 2 · Bookings 6');
  console.log('   Invoices 4 · Payments 3 · Expenses 9');
  console.log('   Maint.Jobs 8 · Vendor Inv 5 · Vendor Pay 3');
  console.log('   Spare Parts 5 · Tire Records 6 · Maint.Logs 6 · Fuel Logs 6');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
