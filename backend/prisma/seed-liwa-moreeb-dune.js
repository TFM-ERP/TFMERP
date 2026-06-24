/**
 * DEMO SEED — Location workspace "Liwa Desert — Moreeb Dune" in project PRD-2026-0016.
 * Fills every workspace sub-tab: Overview · Clearance · Recce · Media · Budget · Risk · Sun.
 *   Overview  → full location record (address, GPS, owner, parking/basecamp, hospital, fee)
 *   Clearance → 3 permits + 5 documents (NOC/COI/agreement/RA/method statement) → ~80% gate
 *   Recce     → 1 tech recce with 6 departmental notes (incl. a BLOCKER)
 *   Media     → photo plates (placeholder image URLs render in the grid)
 *   Budget    → 4 payments (fee deposit PAID, balance/permits/bond outstanding)
 *   Risk      → 4 risks (heat, dune-driving, wildlife, sandstorm) mixed Open/Mitigated
 *   Sun       → auto-computed from lat/lng (Moreeb Dune 23.1145, 53.7889)
 *
 * Idempotent: re-finds the location by name and rebuilds its child rows. Tagged DEMO16.
 * Run:  cd backend && node prisma/seed-liwa-moreeb-dune.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PROJECT_NUMBER = 'PRD-2026-0016';
const LOC_NAME = 'Liwa Desert — Moreeb Dune';
const TAG = 'DEMO16';
const d = (days) => { const x = new Date(); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + days); return x; };

async function main() {
  const project = await prisma.productionProject.findUnique({ where: { projectNumber: PROJECT_NUMBER } });
  if (!project) { console.error(`✗ Project ${PROJECT_NUMBER} not found.`); process.exit(1); }
  const projectId = project.id;

  // ---- upsert the location (find by name within the project) ----
  const locData = {
    projectId, name: LOC_NAME,
    type: 'Desert / Dune', scenes: '40, 41, 42',
    status: 'OPTION', pipelineStage: 'INSURANCE_RECEIVED',
    country: 'United Arab Emirates', emirate: 'Abu Dhabi', area: 'Liwa · Al Dhafra',
    fullAddress: 'Moreeb Dune (Tal Mireb), Liwa, Al Dhafra Region, Abu Dhabi',
    lat: 23.1145, lng: 53.7889,
    googleMapsUrl: 'https://maps.google.com/?q=23.1145,53.7889',
    what3words: '///dune.crest.liwa',
    ownerContactName: 'Al Dhafra Municipality — Filming Permits',
    ownerPhone: '+97128846666', ownerEmail: 'permits@adm.gov.ae',
    accessNotes: '4x4 only past the Tal Mireb checkpoint; graded road to basecamp, soft sand beyond.',
    parkingNotes: 'Unit parking on graded apron at the dune base; shuttle crew up by 4x4.',
    basecampNotes: 'Basecamp on the hard pan 600m from the ridge — catering, honeywagons, 2× gennies.',
    restrictions: 'No driving on the protected dune face outside marked tracks. Night noise curfew 22:00–06:00 near the rest house.',
    nearestHospitalName: 'Liwa Hospital',
    nearestHospitalAddress: 'Liwa, Al Dhafra Region, Abu Dhabi',
    nearestHospitalPhone: '+97128821700',
    locationFeePerDay: 15000, currency: 'AED',
    permitStatus: 'APPROVED',
    photoUrls: [
      'https://picsum.photos/seed/liwa-dune-1/800/600',
      'https://picsum.photos/seed/liwa-dune-2/800/600',
      'https://picsum.photos/seed/liwa-dune-3/800/600',
      'https://picsum.photos/seed/liwa-dune-4/800/600',
      'https://picsum.photos/seed/liwa-dune-5/800/600',
      'https://picsum.photos/seed/liwa-dune-6/800/600',
      'https://picsum.photos/seed/liwa-dune-7/800/600',
      'https://picsum.photos/seed/liwa-dune-8/800/600',
    ],
    notes: `${TAG} · demo location workspace`,
  };
  let loc = await prisma.location.findFirst({ where: { projectId, name: LOC_NAME } });
  if (loc) { loc = await prisma.location.update({ where: { id: loc.id }, data: locData }); console.log(`→ Updated location "${LOC_NAME}"`); }
  else { loc = await prisma.location.create({ data: locData }); console.log(`→ Created location "${LOC_NAME}"`); }
  const locationId = loc.id;

  // ---- clean this demo location's children (idempotent) ----
  await prisma.recceNote.deleteMany({ where: { techRecce: { locationId } } }).catch(() => {});
  await prisma.techRecce.deleteMany({ where: { locationId } }).catch(() => {});
  await prisma.locationPermit.deleteMany({ where: { locationId } }).catch(() => {});
  await prisma.locationDocument.deleteMany({ where: { locationId } }).catch(() => {});
  await prisma.locationRisk.deleteMany({ where: { locationId } }).catch(() => {});
  await prisma.locationPayment.deleteMany({ where: { locationId } }).catch(() => {});

  // ---- Clearance: permits ----
  const permits = [
    { permitType: 'GROUND_FILMING', authority: 'twofour54', jurisdiction: 'Abu Dhabi', referenceNumber: 'GF-2026-1184', status: 'APPROVED', applicationDate: d(-20), approvalDate: d(-8), expiryDate: d(25), fee: 3500, conditions: 'Daylight + night unit; restore site within 48h of wrap.' },
    { permitType: 'DRONE_GCAA', authority: 'GCAA', jurisdiction: 'UAE', referenceNumber: 'GCAA-DRN-5521', status: 'IN_REVIEW', applicationDate: d(-6), fee: 2200, conditions: 'VLOS only; max 120m AGL; no flights over the rest house.' },
    { permitType: 'POLICE', authority: 'Al Dhafra Police', jurisdiction: 'Al Dhafra', referenceNumber: 'ADP-CONV-2207', status: 'APPLIED', applicationDate: d(-4), fee: 0, conditions: 'Convoy escort for the night unit move.' },
  ];
  for (const p of permits) await prisma.locationPermit.create({ data: { locationId, currency: 'AED', notes: TAG, ...p } });

  // ---- Clearance: documents ----
  const docs = [
    { category: 'NOC', title: 'Filming NOC — Moreeb Dune', status: 'RECEIVED', authority: 'Al Dhafra Municipality', refNumber: 'NOC-AD-2026-0420', issueDate: d(-7), expiryDate: d(30) },
    { category: 'INSURANCE', title: 'Public Liability (COI) — AED 10M', status: 'RECEIVED', partyName: 'Oman Insurance Co.', refNumber: 'PLL-99213', issueDate: d(-15), expiryDate: d(60), amount: 10000000 },
    { category: 'LOCATION_AGREEMENT', title: 'Location Agreement — Tal Mireb', status: 'SIGNED', partyName: 'Al Dhafra Municipality', signedDate: d(-5), amount: 15000 },
    { category: 'RISK_ASSESSMENT', title: 'Risk Assessment & Method Statement', status: 'RECEIVED', authority: 'HSE', issueDate: d(-3) },
    { category: 'METHOD_STATEMENT', title: 'HSE Method Statement — Dune Driving', status: 'DRAFT' },
  ];
  for (const x of docs) await prisma.locationDocument.create({ data: { locationId, currency: 'AED', notes: TAG, ...x } });

  // ---- Risk register ----
  const risks = [
    { category: 'HEAT', hazard: 'Extreme heat (45°C+) — crew heat stress', likelihood: 4, impact: 4, riskScore: 16, status: 'OPEN', mitigation: 'Shade tents, electrolytes, 60-min rotation, medic on standby, dawn/dusk scheduling.', owner: 'Safety Officer', nearestMedical: 'Liwa Hospital (+97128821700)' },
    { category: 'OTHER', hazard: 'Dune driving — vehicle rollover on soft sand', likelihood: 3, impact: 4, riskScore: 12, status: 'MITIGATED', mitigation: 'Tyres deflated, trained desert drivers only, recovery 4x4 on site, speed limits on the face.', owner: 'Transport Captain' },
    { category: 'WEATHER', hazard: 'Sandstorm — visibility & equipment damage', likelihood: 3, impact: 3, riskScore: 9, status: 'OPEN', mitigation: 'Met Office monitoring; gear covers; SFX wind only in confirmed windows; stop-work trigger.', owner: '1st AD' },
    { category: 'WILDLIFE', hazard: 'Snakes / scorpions at dawn call', likelihood: 2, impact: 3, riskScore: 6, status: 'MITIGATED', mitigation: 'Site sweep before crew arrival; closed-toe footwear; antivenom location briefed.', owner: 'Location Manager' },
  ];
  for (const r of risks) await prisma.locationRisk.create({ data: { locationId, notes: TAG, ...r } });

  // ---- Budget: payments ----
  const pays = [
    { amount: 7500, status: 'PAID', paidDate: d(-10), description: 'Location fee — deposit (50%)', payeeName: 'Al Dhafra Municipality', invoiceRef: 'INV-LIWA-001' },
    { amount: 7500, status: 'PENDING', dueDate: d(5), description: 'Location fee — balance (50%)', payeeName: 'Al Dhafra Municipality' },
    { amount: 5700, status: 'INVOICED', dueDate: d(3), description: 'Filming + drone permit fees', payeeName: 'twofour54 / GCAA', invoiceRef: 'INV-PERMITS-220' },
    { amount: 5000, status: 'PENDING', dueDate: d(2), description: 'Refundable site-restoration bond', payeeName: 'Al Dhafra Municipality' },
  ];
  for (const p of pays) await prisma.locationPayment.create({ data: { locationId, currency: 'AED', notes: TAG, ...p } });

  // ---- Recce: one tech recce with departmental notes ----
  await prisma.techRecce.create({
    data: {
      locationId, reccedAt: d(-6), conductedBy: 'Marco Ferreira (1st AD)',
      attendees: 'DoP, Gaffer, Key Grip, LM, Transport Captain, SFX', status: 'DONE',
      summary: 'Full tech recce of the Moreeb Dune east face for the caravan crossing (Sc 40) and sandstorm (Sc 41) sequences.',
      notes: {
        create: [
          { department: 'CAMERA', note: 'Crane access limited on soft sand — use techno-dolly on track boards for the ridge push-in.', severity: 'MEDIUM', resolved: false, actionItem: 'Order 24m of track board + sand mats.' },
          { department: 'ELECTRIC', note: 'No mains power; 2× 60kVA gennies at basecamp, ~200m cable run to set.', severity: 'LOW', resolved: true },
          { department: 'SFX', note: 'Wind machines need a flat staging pad clear of the dressed caravan — coordinate with Art.', severity: 'MEDIUM', resolved: false },
          { department: 'TRANSPORT', note: '4x4 only past the checkpoint; shuttle cast/crew from the graded road, no 2WD on the face.', severity: 'HIGH', resolved: false, actionItem: 'Confirm 3× 4x4 shuttle + recovery vehicle.' },
          { department: 'SAFETY', note: 'Remote site + heat — air-ambulance / medevac plan must be confirmed before the shoot day.', severity: 'BLOCKER', resolved: false, actionItem: 'Confirm air-ambulance coverage with the insurer.' },
          { department: 'SOUND', note: 'Persistent wind noise on the ridge — plan for ADR on wide dune shots.', severity: 'INFO', resolved: true },
        ],
      },
    },
  });

  console.log(`  ✓ ${permits.length} permits · ${docs.length} documents · ${risks.length} risks · ${pays.length} payments · 1 recce (6 notes) · ${locData.photoUrls.length} photos`);
  console.log(`\n✅ Done. Open ${PROJECT_NUMBER} → Locations → Board → "${LOC_NAME}" to see every tab filled.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
