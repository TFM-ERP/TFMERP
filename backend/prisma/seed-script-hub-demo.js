/**
 * DEMO SEED — Script Hub single-source-of-truth chain for PRD-2026-0016.
 * Lays down a Script document with TWO colour revisions so you can exercise the whole chain:
 *   • Rev 1 "White"  — first draft, LOCKED (page numbering frozen).
 *   • Rev 2 "Blue"   — active; scene 3 reworded (✲ revision mark), scene 8A inserted as an
 *                       A-page (✲ + pageLabel "11A"); supersedes White.
 *   • Active revision's scenes carry a completed scene-level breakdown (BreakdownElement on
 *     sceneId, source AI — plus one MANUAL element to prove it survives a re-run).
 *   • NO strips are created — open Script hub → "Sync from script" to project them (then Undo).
 *
 * NON-DESTRUCTIVE & idempotent: clears only its own demo document + demo elements on re-run.
 * Requires:  npm run db:push  (P0–P3 columns), then
 * Run:       cd backend && node prisma/seed-script-hub-demo.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PROJECT_NUMBER = 'PRD-2026-0016';
const DOC_TITLE = '[DEMO] Sands of Liwa';
const TAG = 'DEMO16-SCRIPT';
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };

// active (Blue) revision scenes; `changed` → revision mark, `aPage` → A-page label
const SCENES = [
  { n: '1',  slug: 'EXT. MOREEB DUNE - DAWN',              ie: 'EXT', dn: 'DAWN',  set: 'MOREEB DUNE',           page: 1,  pages: 1.5,  cast: ['KAIS', 'LAYLA'],          desc: 'A lone 4x4 crests the red dune as the sun breaks.', els: [{ c: 'VEHICLES', n: '4x4 Land Cruiser', q: 1 }, { c: 'SPECIAL_EQUIPMENT', n: 'Sand mats', q: 4 }] },
  { n: '2',  slug: 'INT. QASR AL HOSN - THRONE ROOM - DAY', ie: 'INT', dn: 'DAY',   set: 'QASR AL HOSN - THRONE ROOM', page: 2, pages: 2.0, cast: ['KAIS', 'THE SHEIKH'],     desc: 'Kais is summoned before the Sheikh.', els: [{ c: 'SET_DRESSING', n: 'Throne + dais', q: 1 }, { c: 'BACKGROUND', n: 'Court attendants', q: 12 }] },
  { n: '3',  slug: 'EXT. OLD SOUK - ALLEY - DAY',           ie: 'EXT', dn: 'DAY',   set: 'OLD SOUK - ALLEY',      page: 4,  pages: 1.25, cast: ['LAYLA', 'TARIQ'],         desc: 'Layla tails Tariq through the spice stalls.', changed: true, els: [{ c: 'BACKGROUND', n: 'Market shoppers', q: 25 }, { c: 'PROPS', n: 'Spice sacks', q: 8 }] },
  { n: '4',  slug: 'INT. SAFE HOUSE - NIGHT',               ie: 'INT', dn: 'NIGHT', set: 'SAFE HOUSE',            page: 5,  pages: 1.0,  cast: ['KAIS', 'LAYLA', 'TARIQ'], desc: 'The trio argue over the stolen ledger.', els: [{ c: 'PROPS', n: 'Stolen ledger', q: 1, manual: true }, { c: 'SET_DRESSING', n: 'Maps + cork board', q: 1 }] },
  { n: '5',  slug: 'EXT. MOREEB DUNE - CAMP - NIGHT',       ie: 'EXT', dn: 'NIGHT', set: 'MOREEB DUNE - CAMP',    page: 6,  pages: 2.0,  cast: ['KAIS', 'THE SHEIKH'],     desc: 'A tense handover under floodlights.', els: [{ c: 'SPECIAL_EQUIPMENT', n: 'Floodlight towers', q: 3 }, { c: 'VEHICLES', n: 'Convoy SUVs', q: 3 }] },
  { n: '6',  slug: 'INT. QASR AL HOSN - CORRIDOR - DAY',    ie: 'INT', dn: 'DAY',   set: 'QASR AL HOSN - CORRIDOR', page: 8, pages: 0.75, cast: ['KAIS'],                  desc: 'Kais slips past the guard.', els: [{ c: 'BACKGROUND', n: 'Palace guard', q: 2 }] },
  { n: '7',  slug: 'EXT. OLD SOUK - ROOFTOP - DUSK',        ie: 'EXT', dn: 'DUSK',  set: 'OLD SOUK - ROOFTOP',    page: 9,  pages: 1.5,  cast: ['LAYLA', 'TARIQ'],         desc: 'A chase across the rooftops at golden hour.', els: [{ c: 'STUNTS', n: 'Rooftop foot chase', q: 1 }, { c: 'SPECIAL_EQUIPMENT', n: 'Safety crash mats', q: 6 }] },
  { n: '8',  slug: 'INT. SAFE HOUSE - DAY',                 ie: 'INT', dn: 'DAY',   set: 'SAFE HOUSE',            page: 11, pages: 1.0,  cast: ['KAIS', 'LAYLA'],          desc: 'The morning after; a quiet reckoning.', els: [{ c: 'PROPS', n: 'Two coffee cups', q: 2 }] },
  { n: '8A', slug: 'INT. SAFE HOUSE - BATHROOM - DAY',      ie: 'INT', dn: 'DAY',   set: 'SAFE HOUSE - BATHROOM', page: 11, pages: 0.5,  cast: ['LAYLA'],                  desc: 'INSERT: Layla burns the ledger.', changed: true, aPage: '11A', els: [{ c: 'SFX', n: 'Controlled paper burn', q: 1 }, { c: 'PROPS', n: 'Ledger (burn copy)', q: 1 }] },
];
// rev 1 (White) had scene 3 with a different slug + no 8A → drives the diff/marks story
const REV1_SCENES = SCENES.filter((s) => s.n !== '8A').map((s) => s.n === '3' ? { ...s, slug: 'EXT. OLD SOUK - DAY' } : s);

const pageTextFor = (scenes) => {
  const byPage = {};
  for (const s of scenes) { (byPage[s.page] = byPage[s.page] || []).push(`${s.slug}\n${s.desc}`); }
  return Object.keys(byPage).map((p) => ({ page: Number(p), text: byPage[p].join('\n\n') }));
};

async function makeRevision(documentId, projectId, label, color, hex, opts) {
  const rev = await prisma.scriptRevision.create({
    data: {
      documentId, revisionLabel: label, colorCode: hex,
      revisionColor: color, revisionRound: 0, revisionDate: opts.date,
      isLocked: !!opts.locked, lockedAt: opts.locked ? opts.date : null,
      supersedesId: opts.supersedesId || null,
      pdfUrl: '/uploads/demo-sands-of-liwa.pdf', pageCount: 12,
      pageText: pageTextFor(opts.scenes), createdAt: opts.date,
    },
  });
  const sceneRows = [];
  for (let i = 0; i < opts.scenes.length; i++) {
    const s = opts.scenes[i];
    const sc = await prisma.scriptScene.create({
      data: {
        revisionId: rev.id, projectId, sceneNumber: s.n, slugline: s.slug, intExt: s.ie, dayNight: s.dn,
        setName: s.set, pageStart: s.page, pageEnd: s.page, sortOrder: i, description: s.desc,
        pages: s.pages, revisionMark: !!s.changed && opts.markChanges === true, pageLabel: s.aPage || null,
      },
    });
    sceneRows.push({ sc, s });
  }
  return { rev, sceneRows };
}

async function main() {
  const project = await prisma.productionProject.findUnique({ where: { projectNumber: PROJECT_NUMBER } });
  if (!project) { console.error(`✗ Project ${PROJECT_NUMBER} not found. Open/create it, then re-run.`); process.exit(1); }
  const projectId = project.id;
  console.log(`→ Seeding Script-hub demo into "${project.title}" (${PROJECT_NUMBER})`);

  // idempotent cleanup: remove prior demo doc(s) + their elements
  const olds = await prisma.scriptDocument.findMany({ where: { projectId, title: DOC_TITLE }, include: { revisions: { select: { id: true } } } });
  for (const d of olds) {
    const revIds = d.revisions.map((r) => r.id);
    if (revIds.length) await prisma.breakdownElement.deleteMany({ where: { revisionId: { in: revIds } } });
    await prisma.scriptDocument.delete({ where: { id: d.id } }); // cascades revisions + scenes
  }
  await prisma.breakdownElement.deleteMany({ where: { projectId, notes: TAG } });

  const doc = await prisma.scriptDocument.create({ data: { projectId, title: DOC_TITLE, kind: 'SCRIPT' } });

  // Rev 1 White (locked), then Rev 2 Blue (active) superseding it
  const r1 = await makeRevision(doc.id, projectId, 'White', 'WHITE', '#ffffff', { date: daysAgo(7), locked: true, scenes: REV1_SCENES, markChanges: false });
  const r2 = await makeRevision(doc.id, projectId, 'Blue', 'BLUE', '#9ec5ff', { date: new Date(), supersedesId: r1.rev.id, scenes: SCENES, markChanges: true });
  await prisma.scriptDocument.update({ where: { id: doc.id }, data: { activeRevisionId: r2.rev.id } });

  // completed scene-level breakdown on the ACTIVE (Blue) revision
  let elc = 0;
  for (const { sc, s } of r2.sceneRows) {
    const rows = [];
    for (const name of s.cast) rows.push({ projectId, sceneId: sc.id, revisionId: r2.rev.id, category: 'CAST', name, quantity: 1, estCost: 0, source: 'AI', notes: TAG });
    for (const e of (s.els || [])) rows.push({ projectId, sceneId: sc.id, revisionId: r2.rev.id, category: e.c, name: e.n, quantity: e.q || 1, estCost: 0, source: e.manual ? 'MANUAL' : 'AI', notes: TAG });
    if (rows.length) { await prisma.breakdownElement.createMany({ data: rows }); elc += rows.length; }
    await prisma.scriptScene.update({ where: { id: sc.id }, data: { brokenDownAt: new Date(), breakdownStatus: 'AI' } });
  }

  console.log(`  · Document "${DOC_TITLE}" with 2 revisions (White locked → Blue active)`);
  console.log(`  · Blue: ${SCENES.length} scenes · ✲ marks on scene 3 + 8A (A-page 11A) · ${elc} breakdown elements (1 MANUAL)`);
  console.log(`\n✅ Done. Open ${PROJECT_NUMBER} → Script → see Blue (✲ 2 changed, colour wheel). Then "Run AI breakdown" is a no-op (already tagged); click "Sync from script" → review the ADD change-list → Apply → board fills. Undo from the recent-syncs list.`);
}

main().catch((e) => { console.error('\n✗ Seed failed. If this mentions an unknown column/arg, run `npm run db:push` first (P0–P3 columns).\n', e); process.exit(1); }).finally(() => prisma.$disconnect());
