/* eslint-disable @typescript-eslint/no-var-requires */
// SYS-07 — DEMO DATA: real Abu Dhabi locations + scout assignments + project links.
// Run from the backend folder AFTER db push + generate:
//   node prisma/seed-locations-demo.js
//
// Idempotent (safe to re-run): master locations upsert by `code`; assignments,
// submissions, project links, evaluations, permits and risks are only created if
// absent. Locations data (GPS, permit authority) is real; photos point at Wikimedia
// Commons (the UI falls back to a placeholder if a file name has changed).
//
// Permit authority across Abu Dhabi / Al Ain / Al Dhafra: the Abu Dhabi Film
// Commission, via the twofour54 e-portal + UAE Media Council script approval.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// The permitting commission. (twofour54 runs the application e-portal and UAE Media
// Council handles script approval — those are separate entities in the directory.)
const PERMIT_BODY = 'Abu Dhabi Film Commission';
const photo = (file) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1024`;

// ── Real Abu Dhabi locations ────────────────────────────────────────────────
const MASTER = [
  {
    code: 'LOC-AUH-01', name: 'Sheikh Zayed Grand Mosque', category: 'EXT', subType: 'Mosque / Landmark',
    status: 'PREFERRED', summary: 'Iconic white-marble mosque — vast reflective courtyards, colonnades and domes. World-class architectural backdrop.',
    tags: ['landmark', 'religious', 'marble', 'symmetry', 'sunrise', 'sunset'],
    region: 'Abu Dhabi', city: 'Abu Dhabi', district: 'Al Maqta', fullAddress: 'Sheikh Rashid Bin Saeed St, Abu Dhabi',
    lat: 24.4128, lng: 54.4748, timezone: 'Asia/Dubai',
    accessNotes: 'Strictly managed access; coordinate via the mosque centre. Modest dress mandatory for all cast/crew.',
    parkingNotes: 'Large visitor car parks; unit base via service road by arrangement.',
    powerAvailable: false, powerNotes: 'No production power — genset required, placement approved by the centre.',
    soundNotes: 'Quiet; near Al Maqta — minimal flight path. Respect prayer times.',
    ownerName: 'Sheikh Zayed Grand Mosque Centre', restrictions: 'No commercial shoots inside prayer halls; religious & cultural sensitivity; women cover head/arms/legs; no shoes on carpet; no intrusive lighting near worshippers.',
    permitAuthority: PERMIT_BODY, standardFee: null, feeCurrency: 'AED', feeNotes: 'Cultural/heritage approval rather than a day rate; lead time 3–4 weeks.',
    nearestHospitalName: 'Sheikh Khalifa Medical City', nearestHospitalPhone: '+971 2 819 0000',
    safetyNotes: 'Crowd management on public days; heat — shade & water for crew.',
    photos: ['Sheikh_Zayed_Mosque.jpg', 'Sheikh_Zayed_Grand_Mosque_-_Abu_Dhabi.jpg'],
  },
  {
    code: 'LOC-AUH-02', name: 'Louvre Abu Dhabi', category: 'EXT', subType: 'Museum / Architecture',
    status: 'LIBRARY', summary: "Jean Nouvel's domed museum on Saadiyat — the 'rain of light' lattice dome over a sea-level plaza. Futuristic, sculptural.",
    tags: ['museum', 'architecture', 'modern', 'dome', 'waterfront'],
    region: 'Abu Dhabi', city: 'Abu Dhabi', district: 'Saadiyat Cultural District', fullAddress: 'Saadiyat Island, Abu Dhabi',
    lat: 24.5339, lng: 54.3981, timezone: 'Asia/Dubai',
    accessNotes: 'Filming arranged via museum partnerships; out-of-hours preferred to avoid visitors.',
    parkingNotes: 'On-site visitor parking; unit base by arrangement.',
    powerAvailable: true, powerNotes: 'House power available in service areas by agreement.',
    soundNotes: 'Coastal breeze under the dome; light aircraft occasionally.',
    ownerName: 'Louvre Abu Dhabi', restrictions: 'No tripod contact with artworks; protect finishes; commercial use of collection requires clearance.',
    permitAuthority: PERMIT_BODY, standardFee: 60000, feeCurrency: 'AED', feeNotes: 'Indicative full-day exterior/plaza; interiors negotiated separately.',
    nearestHospitalName: 'Cleveland Clinic Abu Dhabi', nearestHospitalPhone: '+971 800 8 2223',
    safetyNotes: 'Water edge around plaza; non-slip footwear; dome shade variable.',
    photos: ['Louvre_Abu_Dhabi.jpg', 'Louvre_Abu_Dhabi_November_2017.jpg'],
  },
  {
    code: 'LOC-AUH-03', name: 'Emirates Palace', category: 'INT', subType: 'Palace Hotel',
    status: 'PREFERRED', summary: 'Grand domed palace hotel — gold-leaf atrium, sweeping marble staircases, manicured gardens and private beach. Opulence on tap.',
    tags: ['palace', 'luxury', 'interior', 'gold', 'gardens', 'beach'],
    region: 'Abu Dhabi', city: 'Abu Dhabi', district: 'West Corniche', fullAddress: 'West Corniche Rd, Abu Dhabi',
    lat: 24.4612, lng: 54.3170, timezone: 'Asia/Dubai',
    accessNotes: 'Hotel filming office; guest-privacy windows; night shoots common.',
    parkingNotes: 'Ample; loading via service entrance.',
    powerAvailable: true, powerNotes: 'House power throughout.',
    soundNotes: 'Controlled interiors; Corniche traffic outside.',
    ownerName: 'Mandarin Oriental Emirates Palace', restrictions: 'Guest privacy; no branding conflicts; security screening for crew.',
    permitAuthority: PERMIT_BODY, standardFee: 50000, feeCurrency: 'AED', feeNotes: 'Indicative day rate; suites/ballroom priced separately.',
    nearestHospitalName: 'NMC Royal Hospital Khalifa City', nearestHospitalPhone: '+971 2 503 5000',
    safetyNotes: 'Polished marble — slip risk; protect gold-leaf surfaces.',
    photos: ['Emirates_Palace_Hotel.jpg', 'Emirates_Palace_Abu_Dhabi.jpg'],
  },
  {
    code: 'LOC-AUH-04', name: 'Qasr Al Watan', category: 'EXT', subType: 'Presidential Palace',
    status: 'LIBRARY', summary: 'Working presidential palace open to visitors — immense domed Great Hall, reflective forecourts, ceremonial scale.',
    tags: ['palace', 'ceremonial', 'symmetry', 'grand', 'white'],
    region: 'Abu Dhabi', city: 'Abu Dhabi', district: 'Al Ras Al Akhdar', fullAddress: 'Al Ras Al Akhdar, Abu Dhabi',
    lat: 24.4631, lng: 54.3050, timezone: 'Asia/Dubai',
    accessNotes: 'Government site — security clearance for cast/crew & equipment; lead time long.',
    parkingNotes: 'Designated visitor parking; unit access controlled.',
    powerAvailable: true, powerNotes: 'House power by agreement; genset needs clearance.',
    soundNotes: 'Quiet, controlled grounds.',
    ownerName: 'Qasr Al Watan (Presidential Affairs)', restrictions: 'Security vetting; no filming of restricted wings; protocol approval.',
    permitAuthority: PERMIT_BODY, standardFee: 40000, feeCurrency: 'AED', feeNotes: 'Indicative; subject to protocol approval.',
    nearestHospitalName: 'Sheikh Khalifa Medical City', nearestHospitalPhone: '+971 2 819 0000',
    safetyNotes: 'Reflective stone in heat; crowd control on public days.',
    photos: ['Qasr_Al_Watan.jpg', 'Qasr_al-Watan_Presidential_Palace.jpg'],
  },
  {
    code: 'LOC-AUH-05', name: 'Yas Marina Circuit', category: 'EXT', subType: 'Motorsport Circuit',
    status: 'PREFERRED', summary: 'F1 circuit on Yas Island — pit lane, grandstands, marina straight and the illuminated Yas hotel link bridge. Recently featured in major productions.',
    tags: ['motorsport', 'modern', 'night', 'marina', 'action'],
    region: 'Abu Dhabi', city: 'Abu Dhabi', district: 'Yas Island', fullAddress: 'Yas Marina Circuit, Yas Island, Abu Dhabi',
    lat: 24.4672, lng: 54.6031, timezone: 'Asia/Dubai',
    accessNotes: 'Circuit operations office; track time scheduled around events.',
    parkingNotes: 'Vast paddock & parking; ideal large unit base.',
    powerAvailable: true, powerNotes: 'Substantial house power across pit/paddock.',
    soundNotes: 'Open; aircraft from Zayed Intl nearby on some approaches.',
    ownerName: 'Ethara / Yas Marina Circuit', restrictions: 'Track-safety marshalling for any on-track action; insurance evidence.',
    permitAuthority: PERMIT_BODY, standardFee: 75000, feeCurrency: 'AED', feeNotes: 'Indicative full-day; on-track action priced with safety crew.',
    nearestHospitalName: 'Cleveland Clinic Abu Dhabi', nearestHospitalPhone: '+971 800 8 2223',
    safetyNotes: 'Track safety protocol; high-speed action requires marshals, medical & fire cover.',
    photos: ['Yas_Marina_Circuit.jpg', 'Yas_Marina_Circuit_2009.jpg'],
  },
  {
    code: 'LOC-AUH-06', name: 'Qasr Al Hosn', category: 'EXT', subType: 'Historic Fort',
    status: 'LIBRARY', summary: "Abu Dhabi's oldest stone building — restored fort & inner palace with period courtyards. Heritage / period backdrop in the city core.",
    tags: ['heritage', 'period', 'fort', 'history', 'sand-stone'],
    region: 'Abu Dhabi', city: 'Abu Dhabi', district: 'Al Hosn', fullAddress: 'Sheikh Rashid Bin Saeed St, Al Hosn, Abu Dhabi',
    lat: 24.4819, lng: 54.3543, timezone: 'Asia/Dubai',
    accessNotes: 'DCT Abu Dhabi heritage site; out-of-hours for clean period frames.',
    parkingNotes: 'Adjacent public parking; unit base nearby.',
    powerAvailable: false, powerNotes: 'Limited; genset by arrangement.',
    soundNotes: 'City-centre ambient traffic.',
    ownerName: 'Department of Culture and Tourism — Abu Dhabi', restrictions: 'Heritage protection — no fixings to historic fabric; protect restored surfaces.',
    permitAuthority: PERMIT_BODY, standardFee: 25000, feeCurrency: 'AED', feeNotes: 'Indicative; heritage approval required.',
    nearestHospitalName: 'Sheikh Khalifa Medical City', nearestHospitalPhone: '+971 2 819 0000',
    safetyNotes: 'Uneven historic surfaces; heat in courtyards.',
    photos: ['Qasr_Al_Hosn.jpg', 'Abu_Dhabi_City_vom_Fort_Qasr_Al_Hosn.JPG'],
  },
  {
    code: 'LOC-AA-07', name: 'Jebel Hafeet', category: 'EXT', subType: 'Mountain / Road',
    status: 'LIBRARY', summary: "Al Ain's mountain — a sinuous, much-photographed switchback road climbing to panoramic summit viewpoints. Hero driving / car-commercial road.",
    tags: ['mountain', 'road', 'driving', 'panorama', 'switchback'],
    region: 'Al Ain', city: 'Al Ain', district: 'Jebel Hafeet', fullAddress: 'Jebel Hafeet Mountain Rd, Al Ain',
    lat: 24.0586, lng: 55.7736, timezone: 'Asia/Dubai',
    accessNotes: 'Public mountain road — rolling road closures via authorities for action.',
    parkingNotes: 'Summit & mid-mountain lay-bys; staging at base.',
    powerAvailable: false, powerNotes: 'None on mountain — genset/battery.',
    soundNotes: 'Wind exposed at altitude; otherwise quiet.',
    ownerName: 'Al Ain City Municipality', restrictions: 'Road-closure coordination with police; altitude wind on cranes/drones.',
    permitAuthority: PERMIT_BODY, standardFee: 10000, feeCurrency: 'AED', feeNotes: 'Indicative; road-closure costs additional.',
    nearestHospitalName: 'Tawam Hospital, Al Ain', nearestHospitalPhone: '+971 3 767 7444',
    safetyNotes: 'Cliff edges & fast descending traffic; wind limits for aerial; brake-heat on camera cars.',
    photos: ['Jebel_Hafeet.jpg', 'Jebel_Hafeet_road.jpg'],
  },
  {
    code: 'LOC-AD-08', name: 'Liwa Desert — Moreeb Dune', category: 'EXT', subType: 'Desert / Dunes',
    status: 'PREFERRED', summary: 'Towering red dunes at the edge of the Empty Quarter (Rub al Khali). One of the tallest dunes on earth — epic, unspoilt desert scale.',
    tags: ['desert', 'dunes', 'epic', 'red-sand', 'sunset', 'remote'],
    region: 'Al Dhafra', city: 'Liwa', district: 'Moreeb Dune (Tal Moreeb)', fullAddress: 'Moreeb Dune, Liwa, Al Dhafra Region',
    lat: 23.1393, lng: 53.7906, timezone: 'Asia/Dubai',
    accessNotes: '~2.5h drive from Abu Dhabi; 4x4 essential; remote — full unit logistics.',
    parkingNotes: 'Open desert staging; recovery vehicles on standby.',
    powerAvailable: false, powerNotes: 'Fully off-grid — gensets, fuel bowser, comms.',
    cellularNotes: 'Patchy mobile signal; satellite comms recommended.',
    soundNotes: 'Silent desert — pristine for sound; wind picks up afternoons.',
    ownerName: 'Al Dhafra Region (open desert)', restrictions: 'Environmental care — no litter; dune-driving safety; heat curfews midday.',
    permitAuthority: PERMIT_BODY, standardFee: 15000, feeCurrency: 'AED', feeNotes: 'Indicative; remote logistics dominate cost.',
    nearestHospitalName: 'Madinat Zayed Hospital', nearestHospitalPhone: '+971 2 894 2222',
    safetyNotes: 'Extreme heat; remote medevac distance; 4x4 rollover risk; sand ingress on gear; sun protection mandatory.',
    photos: ['Moreeb_Dune.jpg', 'Liwa_Oasis.jpg'],
  },
];

// Weighted-score helper mirroring AssessmentService (permitComplexity inverted).
const CRITERIA = ['visual', 'access', 'logistics', 'cost', 'safety', 'productionValue', 'permitComplexity', 'feasibility', 'comfort', 'schedule'];
function weighted(scores) {
  let t = 0, n = 0;
  for (const c of CRITERIA) { const r = Number(scores[c]); if (!r) continue; t += (c === 'permitComplexity' ? 6 - r : r); n++; }
  return n ? Math.round((t / n) * 1000) / 1000 : 0;
}

async function main() {
  // 1) Master library + media
  const masters = {};
  for (const m of MASTER) {
    const { photos, ...data } = m;
    const rec = await prisma.masterLocation.upsert({ where: { code: m.code }, update: data, create: data });
    masters[m.code] = rec;
    await prisma.locationMedia.deleteMany({ where: { masterLocationId: rec.id } });
    await prisma.locationMedia.createMany({
      data: photos.map((f, i) => ({ masterLocationId: rec.id, type: 'PHOTO', url: photo(f), caption: m.name, isPrimary: i === 0, sortOrder: i })),
    });
  }
  console.log(`Master locations upserted: ${Object.keys(masters).length}`);

  // 2) Active projects (newest few, excluding archived)
  const projects = (await prisma.productionProject.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }))
    .filter((p) => !/ARCHIV/i.test(p.status || '')).slice(0, 3);
  if (!projects.length) { console.log('No active projects found — created master library only.'); return; }
  const [p1, p2, p3] = [projects[0], projects[1] || projects[0], projects[2] || projects[0]];
  console.log(`Using active projects: ${projects.map((p) => p.title).join(', ')}`);

  // 3) Scout assignments on the lead project (idempotent by title)
  const ASSIGN = [
    { project: p1, title: 'Hero desert — opening sequence', sceneRefs: '1, 4, 12', locationType: 'EXT', type: 'INITIAL', priority: 'HIGH', budgetTarget: 18000, assignedToName: 'Locations Scout', description: 'Vast unspoilt dunes for the title sequence; sunrise/sunset, 4x4 access, room for a crane.' },
    { project: p1, title: 'Grand interior — palace ballroom', sceneRefs: '22, 23', locationType: 'INT', type: 'PRODUCER', priority: 'MEDIUM', budgetTarget: 55000, assignedToName: 'Locations Scout', description: 'Opulent gold/marble interior for the gala scene; night availability.' },
    { project: p2, title: 'Modern landmark — chase establisher', sceneRefs: '48', locationType: 'EXT', type: 'TECH_RECCE', priority: 'MEDIUM', budgetTarget: 70000, assignedToName: 'Unit Scout', description: 'Iconic modern architecture / circuit for the act-three chase establisher.' },
  ];
  let aCount = 0; const assignments = {};
  for (const a of ASSIGN) {
    let rec = await prisma.scoutAssignment.findFirst({ where: { projectId: a.project.id, title: a.title } });
    if (!rec) {
      rec = await prisma.scoutAssignment.create({ data: {
        projectId: a.project.id, title: a.title, description: a.description, sceneRefs: a.sceneRefs,
        locationType: a.locationType, type: a.type, priority: a.priority, budgetTarget: a.budgetTarget, feeCurrency: 'AED',
        dueDate: new Date(Date.now() + 14 * 864e5), status: 'OPEN', assignedToName: a.assignedToName,
      } });
      aCount++;
    }
    assignments[a.title] = rec;
  }
  console.log(`Scout assignments created: ${aCount}`);

  // 4) Field candidates on the desert assignment (idempotent by candidateName)
  const desert = assignments['Hero desert — opening sequence'];
  const CANDS = [
    { name: 'Moreeb Dune — east face', lat: 23.1393, lng: 53.7906, fee: 15000, photos: ['Moreeb_Dune.jpg'], owner: 'Al Dhafra Region', summary: 'Towering red dune, clean ridge lines, sunrise side.', master: 'LOC-AD-08' },
    { name: 'Liwa crescent dunes (alt)', lat: 23.1100, lng: 53.7600, fee: 12000, photos: ['Liwa_Oasis.jpg'], owner: 'Open desert', summary: 'Lower crescent dunes, easier vehicle access, less dramatic.' },
  ];
  let sCount = 0;
  if (desert) for (const c of CANDS) {
    const exists = await prisma.scoutSubmission.findFirst({ where: { assignmentId: desert.id, candidateName: c.name } });
    if (exists) continue;
    await prisma.scoutSubmission.create({ data: {
      assignmentId: desert.id, candidateName: c.name, summary: c.summary, lat: c.lat, lng: c.lng,
      googleMapsUrl: `https://www.google.com/maps?q=${c.lat},${c.lng}`, media: c.photos.map(photo),
      ownerName: c.owner, estFeePerDay: c.fee, status: 'PENDING', submittedByName: 'Field Scout',
    } });
    sCount++;
  }
  if (desert && sCount) await prisma.scoutAssignment.updateMany({ where: { id: desert.id, status: 'OPEN' }, data: { status: 'SUBMITTED' } });
  console.log(`Field candidates created: ${sCount}`);

  // 5) Link master locations into active projects (idempotent by project+master)
  const LINKS = [
    { project: p1, code: 'LOC-AD-08', scenes: '1, 4, 12', start: 20, end: 22, status: 'CONFIRMED' },
    { project: p1, code: 'LOC-AUH-03', scenes: '22, 23', start: 26, end: 26, status: 'OPTION' },
    { project: p2, code: 'LOC-AUH-05', scenes: '48', start: 35, end: 36, status: 'SCOUTING' },
    { project: p3, code: 'LOC-AUH-01', scenes: '7', start: 30, end: 30, status: 'OPTION' },
  ];
  let lCount = 0; const linked = {};
  for (const lk of LINKS) {
    const m = masters[lk.code]; if (!m) continue;
    let loc = await prisma.location.findFirst({ where: { projectId: lk.project.id, masterLocationId: m.id } });
    if (!loc) {
      loc = await prisma.location.create({ data: {
        projectId: lk.project.id, masterLocationId: m.id, name: m.name, type: m.category, status: lk.status,
        country: m.country, emirate: m.region, area: m.district, fullAddress: m.fullAddress, lat: m.lat, lng: m.lng,
        googleMapsUrl: `https://www.google.com/maps?q=${m.lat},${m.lng}`, ownerContactName: m.ownerName,
        parkingNotes: m.parkingNotes, accessNotes: m.accessNotes, restrictions: m.restrictions,
        nearestHospitalName: m.nearestHospitalName, nearestHospitalPhone: m.nearestHospitalPhone,
        locationFeePerDay: m.standardFee, currency: 'AED', permitRequired: true,
        scenes: lk.scenes, shootStart: new Date(Date.now() + lk.start * 864e5), shootEnd: new Date(Date.now() + lk.end * 864e5),
      } });
      lCount++;
    }
    linked[lk.code + '@' + lk.project.id] = loc;
  }
  console.log(`Project location links created: ${lCount}`);

  // 6) An evaluation + permit + risk on the confirmed desert location (idempotent)
  const desertLoc = linked['LOC-AD-08@' + p1.id];
  if (desertLoc) {
    if ((await prisma.locationEvaluation.count({ where: { locationId: desertLoc.id } })) === 0) {
      const scores = { visual: 5, access: 2, logistics: 2, cost: 4, safety: 3, productionValue: 5, permitComplexity: 2, feasibility: 4, comfort: 2, schedule: 4 };
      const ws = weighted(scores);
      await prisma.locationEvaluation.create({ data: {
        locationId: desertLoc.id, scores, weightedScore: ws,
        recommendation: ws >= 4 ? 'RECOMMENDED' : ws >= 2.5 ? 'ACCEPTABLE' : 'NOT_RECOMMENDED',
        notes: 'Stunning visuals; remote logistics & heat are the main constraints.', evaluatedByName: 'Line Producer',
      } });
    }
    if ((await prisma.locationPermit.count({ where: { locationId: desertLoc.id } })) === 0) {
      await prisma.locationPermit.create({ data: {
        locationId: desertLoc.id, type: 'FILMING', authority: PERMIT_BODY, jurisdiction: 'Al Dhafra, Abu Dhabi',
        status: 'APPLIED', applicationDate: new Date(), fee: 15000, currency: 'AED',
        conditions: 'Environmental care; dune-driving safety plan; daylight working window.',
      } });
    }
    if ((await prisma.locationRisk.count({ where: { locationId: desertLoc.id } })) === 0) {
      await prisma.locationRisk.createMany({ data: [
        { locationId: desertLoc.id, category: 'HEAT', hazard: 'Extreme midday heat / dehydration', likelihood: 4, impact: 4, riskScore: 16, mitigation: 'Midday curfew, shade tents, water & electrolytes, medic on set', owner: 'UPM', status: 'OPEN', nearestMedical: 'Madinat Zayed Hospital' },
        { locationId: desertLoc.id, category: 'TRAFFIC', hazard: '4x4 dune-driving rollover', likelihood: 2, impact: 5, riskScore: 10, mitigation: 'Experienced desert drivers, recovery vehicles, briefed routes', owner: 'Transport Captain', status: 'OPEN' },
      ] });
    }
    await prisma.masterLocation.update({ where: { id: masters['LOC-AD-08'].id }, data: { timesUsed: 1, lastUsedAt: new Date() } }).catch(() => {});
  }

  console.log('\nDemo seed complete.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
