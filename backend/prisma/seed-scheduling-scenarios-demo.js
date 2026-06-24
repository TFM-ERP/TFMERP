/**
 * DEMO SEED — Scheduling what-if scenarios for PRD-2026-0016 (Scheduling M6).
 * Creates 3 scenarios so the Scenarios tab Compare/Apply flow has data:
 *   • "[DEMO] Baseline snapshot"        — exact clone of the current live board.
 *   • "[DEMO] Optimised — fewer moves"  — re-sequenced (group by location, chain by cast,
 *                                          cluster Day/Night), ~5 pages/day.
 *   • "[DEMO] Compressed — 7 pg/day"    — packed tighter to fewer days.
 * Each carries computed metrics {shootDays, companyMoves, multiLocationDays, castHoldDays,
 * dayNightSwitches, totalPages, totalScenes} so the compare table shows real deltas.
 *
 * If the board has NO strips yet, it first lays down a small, deliberately sub-optimal demo
 * strip set (tagged notes "DEMO16-SCHED") so the optimiser has an obvious win to show.
 *
 * NON-DESTRUCTIVE & idempotent: clears only its own rows (demo scenarios by name prefix; demo
 * strips by the notes tag) on re-run. Real strips are never created/deleted.
 *
 * Requires:  npm run db:push  (so ScheduleScenario + strip columns exist), then
 * Run:       cd backend && node prisma/seed-scheduling-scenarios-demo.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PROJECT_NUMBER = 'PRD-2026-0016';
const NAME_PREFIX = '[DEMO] ';
const STRIP_TAG = 'DEMO16-SCHED';

// ── metrics (mirror of SchedulingService.scenarioMetrics) ────────────────────
function metrics(rows) {
  const real = (rows || []).filter((r) => !r.isBanner);
  const days = [...new Set(real.map((r) => Number(r.shootDay)))].filter((d) => d > 0).sort((a, b) => a - b);
  const byDay = new Map();
  for (const r of real) { const d = Number(r.shootDay); if (d > 0) { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(r); } }
  const locOf = (r) => String(r.location || r.setName || r.locationId || '');
  let moves = 0, dnSwitch = 0, multiLocDays = 0, prevLoc = null;
  for (const d of days) {
    const list = (byDay.get(d) || []).slice().sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    const locs = [...new Set(list.map(locOf))];
    if (locs.length > 1) multiLocDays++;
    const primary = locs.length ? locs[0] : null;
    if (prevLoc !== null && primary !== prevLoc) moves++;
    prevLoc = primary;
    for (let i = 1; i < list.length; i++) if (list[i].dayNight !== list[i - 1].dayNight) dnSwitch++;
  }
  const castDays = new Map();
  for (const r of real) { const d = Number(r.shootDay); if (d <= 0) continue; for (const c of (Array.isArray(r.cast) ? r.cast : [])) { if (!c) continue; if (!castDays.has(c)) castDays.set(c, new Set()); castDays.get(c).add(d); } }
  const dayIndex = new Map(); days.forEach((d, i) => dayIndex.set(d, i));
  let hold = 0;
  for (const set of castDays.values()) { const ws = [...set].sort((a, b) => a - b); if (ws.length < 2) continue; hold += (dayIndex.get(ws[ws.length - 1]) - dayIndex.get(ws[0])) + 1 - ws.length; }
  return { shootDays: days.length, companyMoves: moves, multiLocationDays: multiLocDays, castHoldDays: hold, dayNightSwitches: dnSwitch, totalPages: Number(real.reduce((t, r) => t + Number(r.pages || 0), 0).toFixed(3)), totalScenes: real.length };
}

const toRow = (s) => ({ stripId: s.id, sceneNumber: s.sceneNumber, intExt: s.intExt, dayNight: s.dayNight, setName: s.setName, location: s.location, locationId: s.locationId, description: s.description, pages: Number(s.pages || 0), cast: Array.isArray(s.cast) ? s.cast : [], shootDay: s.shootDay, sortOrder: s.sortOrder, isBanner: !!s.isBanner, bannerText: s.bannerText || null });

// ── optimiser (mirror of SchedulingService.optimizeOrder, preview only) ──────
function optimise(strips, { pagesPerDay = 5, groupDN = true } = {}) {
  const pool = strips.filter((s) => !s.isBanner);
  const locKey = (s) => String(s.locationId || s.location || s.setName || '-');
  const locName = (s) => String(s.location || s.setName || s.locationId || 'Location');
  const sceneNo = (s) => parseInt(String(s.sceneNumber || '').replace(/\D/g, '')) || 0;
  const castOf = (s) => (Array.isArray(s.cast) ? s.cast : []).filter(Boolean);

  const blockMap = new Map();
  for (const s of pool) { const k = locKey(s); if (!blockMap.has(k)) blockMap.set(k, []); blockMap.get(k).push(s); }
  const blocks = [...blockMap.entries()].map(([key, list]) => {
    const ordered = [...list].sort((a, b) => { if (groupDN) { const da = a.dayNight === 'NIGHT' ? 1 : 0, db = b.dayNight === 'NIGHT' ? 1 : 0; if (da !== db) return da - db; } return sceneNo(a) - sceneNo(b); });
    const cast = new Set(); for (const s of list) for (const c of castOf(s)) cast.add(c);
    const pages = list.reduce((t, s) => t + Number(s.pages || 0), 0);
    return { key, name: locName(list[0]), strips: ordered, cast, pages };
  });
  const remaining = [...blocks].sort((a, b) => (b.cast.size - a.cast.size) || (b.pages - a.pages));
  const seq = []; let active = new Set();
  while (remaining.length) {
    let bestI = 0, bestScore = -1;
    for (let i = 0; i < remaining.length; i++) { const blk = remaining[i]; let ov = 0; for (const c of blk.cast) if (active.has(c)) ov++; const sc = ov * 1000 + blk.cast.size + blk.pages / 100; if (sc > bestScore) { bestScore = sc; bestI = i; } }
    const next = remaining.splice(bestI, 1)[0]; seq.push(next); active = new Set([...next.cast]);
  }
  let day = 1, dayPages = 0, order = 0; const rows = [];
  const adv = () => { day++; dayPages = 0; order = 0; };
  for (let bi = 0; bi < seq.length; bi++) {
    if (bi > 0) adv();
    for (const s of seq[bi].strips) { const p = Number(s.pages || 0); if (dayPages > 0 && dayPages + p > pagesPerDay + 0.001) adv(); rows.push({ ...toRow(s), shootDay: day, sortOrder: order++ }); dayPages += p; }
  }
  for (const s of strips) if (s.isBanner) rows.push(toRow(s));
  return rows;
}

// ── a sub-optimal demo strip set (only used when the board is empty) ─────────
const DEMO_STRIPS = (() => {
  // 3 sets, cast deliberately spread so the live order has many moves + holds
  const S = (sceneNumber, setName, location, intExt, dayNight, pages, cast) => ({ sceneNumber, setName, location, intExt, dayNight, pages, cast });
  const list = [
    S('1',  'PALACE THRONE ROOM', 'Qasr Al Hosn', 'INT', 'DAY',   2.0, ['Pierce', 'Lara']),
    S('14', 'DESERT DUNE',        'Moreeb Dune',  'EXT', 'DAY',   1.5, ['Tim']),
    S('2',  'PALACE THRONE ROOM', 'Qasr Al Hosn', 'INT', 'NIGHT', 1.0, ['Pierce']),
    S('22', 'SOUK ALLEY',         'Old Souk',     'EXT', 'DAY',   2.5, ['Lara', 'Tim']),
    S('15', 'DESERT DUNE',        'Moreeb Dune',  'EXT', 'NIGHT', 1.0, ['Tim', 'Pierce']),
    S('3',  'PALACE CORRIDOR',    'Qasr Al Hosn', 'INT', 'DAY',   0.75, ['Pierce', 'Lara']),
    S('23', 'SOUK ALLEY',         'Old Souk',     'EXT', 'DAY',   1.25, ['Lara']),
    S('16', 'DESERT CAMP',        'Moreeb Dune',  'EXT', 'DAY',   2.0, ['Tim']),
    S('4',  'PALACE THRONE ROOM', 'Qasr Al Hosn', 'INT', 'DAY',   1.5, ['Pierce', 'Lara']),
    S('24', 'SOUK STALL',         'Old Souk',     'INT', 'DAY',   1.0, ['Lara', 'Tim']),
  ];
  // interleave locations across days 1..5 (2 scenes/day) — the worst-case for moves/holds
  return list.map((s, i) => ({ ...s, shootDay: Math.floor(i / 2) + 1, sortOrder: i % 2 }));
})();

async function main() {
  const project = await prisma.productionProject.findUnique({ where: { projectNumber: PROJECT_NUMBER } });
  if (!project) { console.error(`✗ Project ${PROJECT_NUMBER} not found. Open/create it, then re-run.`); process.exit(1); }
  const projectId = project.id;
  console.log(`→ Seeding demo scenarios into "${project.title}" (${PROJECT_NUMBER})`);

  // clear prior demo scenarios (idempotent)
  const delScen = await prisma.scheduleScenario.deleteMany({ where: { projectId, name: { startsWith: NAME_PREFIX } } });
  if (delScen.count) console.log(`  · cleared ${delScen.count} prior demo scenario(s)`);

  // load live strips; lay down demo strips only if the board is empty
  let strips = await prisma.productionStrip.findMany({ where: { projectId }, orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }] });
  if (strips.length === 0) {
    await prisma.productionStrip.deleteMany({ where: { projectId, notes: { contains: STRIP_TAG } } });
    console.log('  · board empty → laying down a sub-optimal demo strip set (10 scenes, 3 locations)');
    for (const s of DEMO_STRIPS) {
      await prisma.productionStrip.create({ data: { projectId, sceneNumber: s.sceneNumber, intExt: s.intExt, dayNight: s.dayNight, setName: s.setName, location: s.location, description: null, pages: s.pages, cast: s.cast, shootDay: s.shootDay, sortOrder: s.sortOrder, notes: STRIP_TAG } });
    }
    strips = await prisma.productionStrip.findMany({ where: { projectId }, orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }] });
  } else {
    console.log(`  · using the existing live board (${strips.length} strips) — no strips created`);
  }

  const baseRows = strips.map(toRow);
  const optRows = optimise(strips, { pagesPerDay: 5, groupDN: true });
  const cmpRows = optimise(strips, { pagesPerDay: 7, groupDN: true });

  const made = [];
  const mk = async (name, notes, kind, rows) => {
    const m = metrics(rows);
    const r = await prisma.scheduleScenario.create({ data: { projectId, name, notes, kind, strips: rows, metrics: m } });
    made.push({ name, ...m });
    return r;
  };
  await mk(`${NAME_PREFIX}Baseline snapshot`, 'As-is clone of the live board', 'BASELINE', baseRows);
  await mk(`${NAME_PREFIX}Optimised — fewer moves`, 'Grouped by location, chained by cast, ~5 pg/day', 'OPTIMIZED', optRows);
  await mk(`${NAME_PREFIX}Compressed — 7 pg/day`, 'Same optimiser packed tighter to fewer days', 'SNAPSHOT', cmpRows);

  console.log('\n  Scenario                         days  moves  hold  D/N  pages');
  for (const s of made) console.log(`  ${s.name.replace(NAME_PREFIX, '').padEnd(30)} ${String(s.shootDays).padStart(4)} ${String(s.companyMoves).padStart(6)} ${String(s.castHoldDays).padStart(5)} ${String(s.dayNightSwitches).padStart(4)} ${String(s.totalPages).padStart(6)}`);
  console.log(`\n✅ Done. Open ${PROJECT_NUMBER} → Scheduling → Stripboard → Scenarios tab. Tick two and Compare; Apply the optimised one (a rollback baseline is auto-saved).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
