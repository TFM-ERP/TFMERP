/**
 * DEMO SEED — Project PRD-2026-0016
 * Populates realistic, "various stages" example data for testing:
 *   • Transport Captain garage — hired fleet (vehicles in mixed classes/statuses) + drivers
 *     (incl. one in a fatigue-lockout window, one on-duty).
 *   • Transport runs (orders) in EVERY lifecycle stage — Requested · Assigned · En-route ·
 *     Passenger-onboard · Completed · Cancelled — spread across the next few days, some
 *     generated from the call sheets below.
 *   • Call sheets for the next THREE shoot days (today + 2), with full cast/crew/schedule/
 *     advance-schedule blocks, weather, hospital, parking/basecamp. Day 1–2 PUBLISHED, day 3 DRAFT.
 *
 * Idempotent: every row it creates is tagged "DEMO16" (in notes) and cleared on re-run.
 * Run:  cd backend && node prisma/seed-prd-2026-0016-demo.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PROJECT_NUMBER = 'PRD-2026-0016';
const TAG = 'DEMO16';

// date helpers — everything is relative to "now" so it's always the next 3 days
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const at = (days, hh, mm = 0) => { const d = today0(); d.setDate(d.getDate() + days); d.setHours(hh, mm, 0, 0); return d; };
const dayOf = (days) => { const d = today0(); d.setDate(d.getDate() + days); return d; };
const hhmm = (hh, mm = 0) => `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

// AUH mid-June daylight (approx) — shared across the call sheets
const SUN = { sunrise: '05:35', sunset: '19:09', goldenHourAm: '06:03', goldenHourPm: '18:41', weather: 'Sunny · hazy AM', tempHigh: '43', tempLow: '32' };

const KEY_CONTACTS = [
  { role: 'Director', name: 'Khalid Al Hashimi', phone: '+971501100011' },
  { role: 'Line Producer', name: 'Dana Haddad', phone: '+971501100022' },
  { role: '1st AD', name: 'Marco Ferreira', phone: '+971501100033' },
  { role: 'UPM', name: 'Selma Cardoso', phone: '+971501100044' },
  { role: 'DoP', name: 'Henrik Larsson', phone: '+971501100055' },
  { role: 'Transport Captain', name: 'Rashid Al Mansoori', phone: '+971501234567' },
  { role: 'Set Medic', name: 'Dr. Reem Al Najjar', phone: '+971501100066' },
];
const HOSPITAL = { hospitalName: 'Sheikh Khalifa Medical City', hospitalAddress: 'Al Karamah St, Abu Dhabi', hospitalPhone: '+97123819000' };

// per-day shoot content
const DAYS = [
  {
    dayNumber: 12, status: 'PUBLISHED',
    locName: 'Qasr Al Hosn — East Court', area: 'Al Hosn, Abu Dhabi',
    general: '05:30', shooting: '07:00', wrap: '19:30',
    scenes: [
      { time: '07:00', scene: '24A', intExt: 'EXT', description: 'Nabil arrives at the fort gates at dawn', pages: '1 2/8', cast: '1', location: 'East Court' },
      { time: '09:30', scene: '24B', intExt: 'EXT', description: 'Confrontation with the guards', pages: '2 4/8', cast: '1,3', location: 'East Court' },
      { time: '14:00', scene: '31', intExt: 'INT', description: 'Layla waits in the watchtower', pages: '1 6/8', cast: '2', location: 'Watchtower set' },
    ],
    cast: [
      { cast: '1', character: 'NABIL', name: 'Yousef Daher', callTime: '05:45', hmw: '06:00', onSet: '07:00', remarks: 'Pickup VIP' },
      { cast: '2', character: 'LAYLA', name: 'Mariam Saleh', callTime: '12:00', hmw: '12:30', onSet: '14:00', remarks: '' },
      { cast: '3', character: 'SAMI', name: 'Tariq Hassan', callTime: '08:00', hmw: '08:20', onSet: '09:30', remarks: '' },
    ],
    bg: [{ description: 'Fort guards', count: 8, callTime: '06:30', location: 'Basecamp' }, { description: 'Market crowd', count: 20, callTime: '08:00', location: 'Holding' }],
  },
  {
    dayNumber: 13, status: 'PUBLISHED',
    locName: 'Al Wathba Desert — Dune Camp', area: 'Al Wathba, Abu Dhabi',
    general: '05:00', shooting: '06:30', wrap: '18:30',
    scenes: [
      { time: '06:30', scene: '40', intExt: 'EXT', description: 'Caravan crosses the dunes (golden hour)', pages: '2 2/8', cast: '1,2', location: 'Dune ridge' },
      { time: '10:00', scene: '41', intExt: 'EXT', description: 'Sandstorm — the map is lost', pages: '3', cast: '1,2,3', location: 'Dune basin (SFX wind)' },
      { time: '16:30', scene: '42', intExt: 'EXT', description: 'Camp at dusk', pages: '1 3/8', cast: '1,2', location: 'Dune Camp' },
    ],
    cast: [
      { cast: '1', character: 'NABIL', name: 'Yousef Daher', callTime: '05:15', hmw: '05:30', onSet: '06:30', remarks: 'Pickup VIP' },
      { cast: '2', character: 'LAYLA', name: 'Mariam Saleh', callTime: '05:15', hmw: '05:30', onSet: '06:30', remarks: '' },
      { cast: '3', character: 'SAMI', name: 'Tariq Hassan', callTime: '08:30', hmw: '08:50', onSet: '10:00', remarks: '' },
    ],
    bg: [{ description: 'Caravan riders', count: 12, callTime: '05:30', location: 'Basecamp' }],
  },
  {
    dayNumber: 14, status: 'DRAFT',
    locName: 'Corniche Breakwater', area: 'Corniche, Abu Dhabi',
    general: '12:00', shooting: '13:30', wrap: '23:30',
    scenes: [
      { time: '13:30', scene: '55', intExt: 'EXT', description: 'Reunion on the breakwater', pages: '2', cast: '1,2', location: 'Breakwater' },
      { time: '19:00', scene: '56', intExt: 'EXT', description: 'Night chase along the marina (steadicam)', pages: '2 5/8', cast: '1,3', location: 'Marina walk' },
    ],
    cast: [
      { cast: '1', character: 'NABIL', name: 'Yousef Daher', callTime: '12:15', hmw: '12:30', onSet: '13:30', remarks: '' },
      { cast: '2', character: 'LAYLA', name: 'Mariam Saleh', callTime: '12:15', hmw: '12:30', onSet: '13:30', remarks: '' },
      { cast: '3', character: 'SAMI', name: 'Tariq Hassan', callTime: '17:30', hmw: '17:50', onSet: '19:00', remarks: 'Night' },
    ],
    bg: [{ description: 'Evening joggers', count: 10, callTime: '18:30', location: 'Marina' }],
  },
];

const CREW_CALLS = [
  { department: 'Camera', name: 'Henrik Larsson', role: 'DoP', callTime: '06:15' },
  { department: 'Camera', name: 'Aisha Noor', role: '1st AC', callTime: '06:15' },
  { department: 'Grip', name: 'Pavel Novak', role: 'Key Grip', callTime: '06:00' },
  { department: 'Electric', name: 'Sami Rahman', role: 'Gaffer', callTime: '06:00' },
  { department: 'Sound', name: 'Liang Wei', role: 'Production Sound', callTime: '06:45' },
  { department: 'Art', name: 'Nadia Costa', role: 'Production Designer', callTime: '05:30' },
  { department: 'Wardrobe', name: 'Fatima Yusuf', role: 'Costume Supervisor', callTime: '05:30' },
];

async function main() {
  const project = await prisma.productionProject.findUnique({ where: { projectNumber: PROJECT_NUMBER } });
  if (!project) { console.error(`✗ Project ${PROJECT_NUMBER} not found. Open the project once (or create it), then re-run.`); process.exit(1); }
  const projectId = project.id;
  console.log(`→ Seeding demo data into "${project.title}" (${PROJECT_NUMBER})`);

  // ---- cleanup previous DEMO16 rows (idempotent) ----
  await prisma.transportOrder.deleteMany({ where: { projectId, notes: { contains: TAG } } }).catch(() => {});
  await prisma.transportVehicle.deleteMany({ where: { projectId, notes: { contains: TAG } } }).catch(() => {});
  await prisma.transportDriver.deleteMany({ where: { notes: { contains: TAG } } }).catch(() => {});
  await prisma.callSheet.deleteMany({ where: { projectId, notes: { contains: TAG } } }).catch(() => {});

  // ---- rental supplier (find-or-create; Supplier.name not unique) ----
  let supplier = await prisma.supplier.findFirst({ where: { name: 'Capital Chauffeur Services' } });
  if (!supplier) supplier = await prisma.supplier.create({ data: { name: 'Capital Chauffeur Services', ranking: 'PREFERRED', phone: '+97126667788', category: 'Transport', categories: ['Transport'], country: 'UAE', city: 'Abu Dhabi' } });

  // ---- vehicles (mixed class + status) ----
  const vehDefs = [
    { vehicleType: 'LUXURY', make: 'Mercedes-Benz', model: 'S-Class', plateNumber: 'AUH 12345', plateEmirate: 'AUH', capacity: 3, dailyRate: 1800, fleetClass: 'PASSENGER', color: 'Black', status: 'ASSIGNED', returnLocation: 'Capital Chauffeur — Mussafah depot' },
    { vehicleType: 'SUV', make: 'Toyota', model: 'Land Cruiser', plateNumber: 'AUH 22841', plateEmirate: 'AUH', capacity: 6, dailyRate: 950, fleetClass: 'PASSENGER', color: 'White', status: 'AVAILABLE' },
    { vehicleType: 'VAN', make: 'Mercedes-Benz', model: 'V-Class', plateNumber: 'AUH 30192', plateEmirate: 'AUH', capacity: 7, dailyRate: 1100, fleetClass: 'PASSENGER', color: 'Silver', status: 'AVAILABLE' },
    { vehicleType: 'MINIBUS', make: 'Toyota', model: 'Hiace', plateNumber: 'AUH 7188', plateEmirate: 'AUH', capacity: 14, dailyRate: 850, fleetClass: 'PASSENGER', color: 'White', status: 'AVAILABLE' },
    { vehicleType: 'TRUCK', make: 'Isuzu', model: 'NPR Camera Truck', plateNumber: 'AUH 4410', plateEmirate: 'AUH', capacity: 3, dailyRate: 700, fleetClass: 'WORKING', color: 'White', status: 'ASSIGNED' },
    { vehicleType: 'PICKUP', make: 'Toyota', model: 'Hilux (Picture)', plateNumber: 'AUH 5521', plateEmirate: 'AUH', capacity: 5, dailyRate: 500, fleetClass: 'PICTURE', color: 'Desert Tan', status: 'MAINTENANCE' },
  ];
  const veh = [];
  for (const v of vehDefs) veh.push(await prisma.transportVehicle.create({ data: { source: 'HIRED', supplierId: supplier.id, projectId, currency: project.currency || 'AED', notes: TAG, ...v } }));

  // ---- drivers (one on-duty, one in fatigue lockout) ----
  const drvDefs = [
    { source: 'HIRED', fullName: 'Rashid Al Mansoori', mobile: '+971501234567', licenseNumber: 'AUH-884512', languages: ['Arabic', 'English'], minRestHours: 10, onDutySince: at(0, 5, 0) },
    { source: 'HIRED', fullName: 'Imran Khan', mobile: '+971552233445', licenseNumber: 'AUH-771203', languages: ['Urdu', 'English', 'Hindi'], onDutySince: at(0, 5, 30) },
    { source: 'FREELANCE', fullName: 'Antoine Khoury', mobile: '+971566677889', licenseNumber: 'AUH-330221', languages: ['Arabic', 'French', 'English'] },
    { source: 'HIRED', fullName: 'Joseph Mwangi', mobile: '+971544556677', licenseNumber: 'AUH-998123', languages: ['Swahili', 'English'], lastWrapAt: at(-1, 23, 40) },
    { source: 'HIRED', fullName: 'Bilal Ahmed', mobile: '+971507788990', licenseNumber: 'AUH-220114', languages: ['Urdu', 'English'] },
  ];
  const drv = [];
  for (const d of drvDefs) drv.push(await prisma.transportDriver.create({ data: { supplierId: supplier.id, notes: TAG, ...d } }));

  // ---- call sheets (next 3 days) — link to existing project locations when present ----
  const projLocs = await prisma.location.findMany({ where: { projectId }, take: 3, orderBy: { createdAt: 'asc' } });
  const csIds = [];
  for (let i = 0; i < DAYS.length; i++) {
    const D = DAYS[i];
    const L = projLocs[i];
    const cs = await prisma.callSheet.create({
      data: {
        projectId, dayNumber: D.dayNumber, totalDays: 28, shootDate: dayOf(i), status: D.status,
        generalCall: D.general, shootingCall: D.shooting, estWrap: D.wrap,
        weather: SUN.weather, tempHigh: SUN.tempHigh, tempLow: SUN.tempLow, sunrise: SUN.sunrise, sunset: SUN.sunset, goldenHourAm: SUN.goldenHourAm, goldenHourPm: SUN.goldenHourPm,
        locationId: L ? L.id : null,
        locationName: L ? L.name : D.locName,
        locationAddress: L ? (L.fullAddress || `${D.area}`) : `${D.locName}, ${D.area}`,
        locationMapUrl: L ? L.googleMapsUrl : null,
        parkingNotes: L ? (L.parkingNotes || 'Unit parking on the north service road; crew shuttle from basecamp.') : 'Unit parking on the north service road; crew shuttle from basecamp.',
        basecampNotes: L ? (L.basecampNotes || 'Basecamp 400m from set — catering, honeywagons, makeup trailers.') : 'Basecamp 400m from set — catering, honeywagons, makeup trailers.',
        ...HOSPITAL,
        keyContacts: KEY_CONTACTS,
        scheduleItems: D.scenes,
        castCalls: D.cast,
        backgroundCalls: D.bg,
        crewCalls: CREW_CALLS,
        advanceSchedule: (DAYS[i + 1] ? DAYS[i + 1].scenes.map((s) => ({ time: s.time, scene: s.scene, description: s.description, location: s.location })) : [{ time: 'TBC', scene: '—', description: 'Company move / cover set', location: 'TBC' }]),
        safetyNotes: 'Heat protocol: shade + electrolytes every 90 min. SFX wind on Day 13 — eye protection on set. Night work Day 14 — hi-vis after dusk.',
        notes: `${TAG} · demo call sheet`,
      },
    });
    csIds.push(cs.id);
    console.log(`  ✓ Call sheet — Day ${D.dayNumber} (${D.status}) ${dayOf(i).toDateString()}`);
  }

  // ---- transport runs in EVERY stage ----
  const AUH = { lat: 24.4539, lng: 54.3773 };
  const orders = [
    // REQUESTED (unassigned) — VIP talent pickup tomorrow, from a call sheet
    { type: 'TALENT_PICKUP', status: 'REQUESTED', scheduledAt: at(1, 5, 15), fromLocation: 'Jumeirah at Saadiyat Island Resort', toLocation: 'Basecamp — Al Wathba', priority: 'VIP', passengerNote: '1 — Lead (NABIL)', callSheetId: csIds[1], genSource: 'callsheet:cast:NABIL' },
    // REQUESTED — crew shuttle tomorrow
    { type: 'CREW_SHUTTLE', status: 'REQUESTED', scheduledAt: at(1, 5, 30), fromLocation: 'Crew Hotel — Yas Island', toLocation: 'Basecamp — Al Wathba', priority: 'NORMAL', passengerNote: '14 crew', callSheetId: csIds[1] },
    // ASSIGNED — today VIP pickup (acknowledged, not yet rolling)
    { type: 'TALENT_PICKUP', status: 'ASSIGNED', scheduledAt: at(0, 5, 15), fromLocation: 'Jumeirah at Saadiyat Island Resort', toLocation: 'Qasr Al Hosn — East Court', priority: 'VIP', passengerNote: '1 — Lead (LAYLA)', vehicleId: veh[0].id, driverId: drv[0].id, acknowledgedAt: at(0, 5, 2), callSheetId: csIds[0], genSource: 'callsheet:cast:LAYLA', pickupLat: 24.5440, pickupLng: 54.4290, dropLat: 24.4720, dropLng: 54.3520 },
    // EN_ROUTE — today crew shuttle currently rolling
    { type: 'CREW_SHUTTLE', status: 'EN_ROUTE', scheduledAt: at(0, 5, 45), fromLocation: 'Crew Hotel — Yas Island', toLocation: 'Qasr Al Hosn — East Court', priority: 'NORMAL', passengerNote: '12 crew', vehicleId: veh[3].id, driverId: drv[1].id, acknowledgedAt: at(0, 5, 35), enRouteAt: at(0, 5, 48), callSheetId: csIds[0] },
    // PASSENGER_ONBOARD — airport pickup, talent in the car
    { type: 'AIRPORT_PICKUP', status: 'PASSENGER_ONBOARD', scheduledAt: at(0, 9, 0), fromLocation: 'Zayed Intl Airport — T1 Arrivals', toLocation: 'Crew Hotel — Yas Island', priority: 'NORMAL', passengerNote: '2 — DoP + 1', vehicleId: veh[1].id, driverId: drv[2].id, acknowledgedAt: at(0, 8, 30), enRouteAt: at(0, 8, 40), arrivedAt: at(0, 9, 5), onboardAt: at(0, 9, 18), pickupLat: 24.4330, pickupLng: 54.6510 },
    // COMPLETED — equipment run yesterday
    { type: 'EQUIPMENT_RUN', status: 'COMPLETED', scheduledAt: at(-1, 14, 0), fromLocation: 'Filmquip Rental — Mussafah', toLocation: 'Basecamp — Al Wathba', priority: 'NORMAL', passengerNote: 'Camera carnet + 6 cases', vehicleId: veh[4].id, driverId: drv[4].id, acknowledgedAt: at(-1, 13, 50), enRouteAt: at(-1, 14, 5), arrivedAt: at(-1, 14, 55), completedAt: at(-1, 15, 5) },
    // COMPLETED — inter-location move yesterday
    { type: 'INTER_LOCATION', status: 'COMPLETED', scheduledAt: at(-1, 16, 30), fromLocation: 'Basecamp — Al Wathba', toLocation: 'Unit 2 — Corniche Breakwater', priority: 'NORMAL', passengerNote: '7 crew', vehicleId: veh[2].id, driverId: drv[1].id, acknowledgedAt: at(-1, 16, 20), enRouteAt: at(-1, 16, 33), arrivedAt: at(-1, 17, 10), completedAt: at(-1, 17, 12) },
    // CANCELLED — today, talent self-driving
    { type: 'TALENT_PICKUP', status: 'CANCELLED', scheduledAt: at(0, 7, 0), fromLocation: 'Rosewood Abu Dhabi', toLocation: 'Qasr Al Hosn — East Court', priority: 'NORMAL', passengerNote: '1 — Supporting (SAMI)', notes: `${TAG} · cancelled — talent travelling with agent (self-drive)` },
    // ASSIGNED — wrap-day airport drop in 2 days (VIP director)
    { type: 'AIRPORT_DROPOFF', status: 'ASSIGNED', scheduledAt: at(2, 22, 0), fromLocation: 'Crew Hotel — Yas Island', toLocation: 'Zayed Intl Airport — T3 Departures', priority: 'VIP', passengerNote: '1 — Director', vehicleId: veh[0].id, driverId: drv[0].id, acknowledgedAt: at(2, 21, 0), callSheetId: csIds[2] },
    // EN_ROUTE — today inter-location supply
    { type: 'OTHER', status: 'EN_ROUTE', scheduledAt: at(0, 12, 30), fromLocation: 'Basecamp — Al Wathba', toLocation: 'Set — Watchtower', priority: 'URGENT', passengerNote: 'Hot lunch + medic kit', vehicleId: veh[2].id, driverId: drv[2].id, acknowledgedAt: at(0, 12, 20), enRouteAt: at(0, 12, 33) },
  ];
  for (const o of orders) {
    await prisma.transportOrder.create({ data: { projectId, ...o, notes: o.notes || `${TAG} · run` } });
  }
  console.log(`  ✓ ${orders.length} transport runs across stages: Requested · Assigned · En-route · Onboard · Completed · Cancelled`);

  console.log(`\n✅ Done. Open ${PROJECT_NUMBER} → Call sheets (3 days) and Transport / Captain board.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
