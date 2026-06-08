/* eslint-disable @typescript-eslint/no-var-requires */
// SYS-07 — Promote existing per-project Locations into the Master Location Library.
// Run AFTER `prisma db push` + `prisma generate`:
//   node prisma/migrate-locations-to-library.js
//
// Idempotent (safe to re-run):
//   1. For every project Location with no masterLocationId, find-or-create a MasterLocation
//      deduped by name + rough geo (GPS within ~150m, else region+district).
//   2. Link the Location back via masterLocationId.
//   3. Recompute the master's accreted production-history aggregates.
//
// Historical/locked projects are NOT modified beyond setting the masterLocationId link
// (no name/cost/status changes), so locked budgets stay intact.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function sameGeo(a, b) {
  if (a.lat && a.lng && b.lat && b.lng) {
    const dLat = Math.abs(Number(a.lat) - Number(b.lat));
    const dLng = Math.abs(Number(a.lng) - Number(b.lng));
    return dLat < 0.0015 && dLng < 0.0015;
  }
  const reg = (x) => (x || '').trim().toLowerCase();
  return reg(a.region) === reg(b.emirate);
}

async function findOrCreateMaster(loc) {
  const candidates = await prisma.masterLocation.findMany({
    where: { name: { equals: loc.name, mode: 'insensitive' } },
  });
  const match = candidates.find((c) => sameGeo(c, loc));
  if (match) return { master: match, created: false };

  const master = await prisma.masterLocation.create({
    data: {
      name: loc.name,
      category: loc.type || 'EXT',
      status: 'LIBRARY',
      country: loc.country,
      region: loc.emirate,
      district: loc.area,
      fullAddress: loc.fullAddress,
      lat: loc.lat,
      lng: loc.lng,
      googleMapsUrl: loc.googleMapsUrl,
      what3words: loc.what3words,
      accessNotes: loc.accessNotes,
      parkingNotes: loc.parkingNotes,
      basecampNotes: loc.basecampNotes,
      restrictions: loc.restrictions,
      ownerName: loc.ownerContactName,
      ownerPhone: loc.ownerPhone,
      ownerEmail: loc.ownerEmail,
      permitAuthority: loc.permitRequired ? 'See project permit' : null,
      standardFee: loc.locationFeePerDay,
      feeCurrency: loc.currency || 'AED',
      nearestHospitalName: loc.nearestHospitalName,
      nearestHospitalAddress: loc.nearestHospitalAddress,
      nearestHospitalPhone: loc.nearestHospitalPhone,
      notes: loc.notes,
    },
  });
  return { master, created: true };
}

async function recomputeHistory(masterId) {
  const usages = await prisma.location.findMany({
    where: { masterLocationId: masterId },
    select: { projectId: true, createdAt: true },
  });
  const projectIds = [...new Set(usages.map((u) => u.projectId))];
  const txns = await prisma.projectTransaction.aggregate({
    where: { projectId: { in: projectIds.length ? projectIds : ['__none__'] }, category: 'Location' },
    _sum: { amount: true },
  });
  const lastUsedAt = usages.length
    ? usages.reduce((max, u) => (u.createdAt > max ? u.createdAt : max), usages[0].createdAt)
    : null;
  await prisma.masterLocation.update({
    where: { id: masterId },
    data: {
      timesUsed: projectIds.length,
      lastUsedAt,
      totalSpentToDate: Number(txns._sum.amount || 0),
    },
  });
}

async function main() {
  const locations = await prisma.location.findMany({ where: { masterLocationId: null } });
  console.log(`Found ${locations.length} unlinked project location(s).`);

  let createdMasters = 0, reused = 0;
  const touchedMasters = new Set();

  for (const loc of locations) {
    const { master, created } = await findOrCreateMaster(loc);
    if (created) createdMasters++; else reused++;
    await prisma.location.update({ where: { id: loc.id }, data: { masterLocationId: master.id } });
    touchedMasters.add(master.id);
    console.log(`  ${created ? '＋ created' : '↳ reused '} master "${master.name}" ← project location ${loc.id}`);
  }

  for (const id of touchedMasters) await recomputeHistory(id);

  const total = await prisma.masterLocation.count();
  console.log(`\nDone. ${createdMasters} master(s) created, ${reused} reused. Library now holds ${total} master location(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
