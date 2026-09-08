import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ScripOnService } from './scripton.service';

/**
 * purgeBuildsCascade() is the only function in this codebase that permanently destroys a
 * screenplay, and it shipped without a test while buildShortKey had one.
 *
 * THERE ARE NO FOREIGN KEYS ON development_builds. Nothing in the database will stop a where clause
 * scoped one predicate too wide — a missing `id` filter deletes every build in the table and every
 * stage version in the system, and the first symptom is a writer's work being gone. A test is the
 * only guard that exists, so it asserts against an in-memory store that HONOURS the where clauses
 * rather than a mock that records them: a too-wide predicate empties the fake exactly as it would
 * empty Postgres.
 */

type Row = Record<string, any>;

/** Minimal Prisma stand-in: filters real rows by the `where` it is given, and records call order. */
function fakeDb(seed: { builds: Row[]; stages: Row[]; stageVersions: Row[]; buildVersions: Row[] }) {
  const db = {
    builds: [...seed.builds], stages: [...seed.stages],
    stageVersions: [...seed.stageVersions], buildVersions: [...seed.buildVersions],
  };
  const calls: string[] = [];
  const match = (val: any, cond: any): boolean =>
    (cond && typeof cond === 'object' && Array.isArray(cond.in)) ? cond.in.includes(val) : val === cond;
  const filter = (rows: Row[], where: any) => rows.filter((r) => Object.entries(where || {}).every(([k, v]) => match(r[k], v)));
  const table = (name: keyof typeof db, label: string) => ({
    findMany: async ({ where }: any = {}) => filter(db[name], where),
    deleteMany: async ({ where }: any = {}) => {
      calls.push(label);
      const doomed = filter(db[name], where);
      db[name] = db[name].filter((r) => !doomed.includes(r));
      return { count: doomed.length };
    },
  });
  const prisma: any = {
    developmentStage: table('stages', 'stages'),
    stageVersion: table('stageVersions', 'stageVersions'),
    buildVersion: table('buildVersions', 'buildVersions'),
    developmentBuild: table('builds', 'builds'),
  };
  return { prisma, db, calls };
}

/** Build A is purged; build B must survive it completely. */
const seed = () => ({
  builds: [{ id: 'A' }, { id: 'B' }],
  stages: [
    { id: 'sA1', buildId: 'A' }, { id: 'sA2', buildId: 'A' },
    { id: 'sB1', buildId: 'B' }, { id: 'sB2', buildId: 'B' },
  ],
  stageVersions: [
    { id: 'vA1', stageId: 'sA1', body: 'x'.repeat(11922) },   // Beats V1, to the character
    { id: 'vA2', stageId: 'sA2', body: 'y'.repeat(8363) },    // Treatment V1
    { id: 'vB1', stageId: 'sB1', body: 'z'.repeat(500) },     // build B's work — must survive
  ],
  buildVersions: [{ id: 'bvA', buildId: 'A' }, { id: 'bvB', buildId: 'B' }],
});

const svc = (prisma: any) => new ScripOnService(prisma, {} as any, {} as any);

test('THE ONE THAT MATTERS: purging A leaves B entirely whole', async () => {
  const { prisma, db } = fakeDb(seed());
  await svc(prisma).purgeBuildsCascade(['A']);
  assert.deepEqual(db.builds.map((b) => b.id), ['B'], 'build B must still exist');
  assert.deepEqual(db.stages.map((s) => s.id), ['sB1', 'sB2'], 'B keeps both stages');
  assert.deepEqual(db.stageVersions.map((v) => v.id), ['vB1'], "B's writing is untouched");
  assert.deepEqual(db.buildVersions.map((v) => v.id), ['bvB'], 'B keeps its build version');
});

test('A is fully gone — no stage, version or draft of it survives', async () => {
  const { prisma, db } = fakeDb(seed());
  await svc(prisma).purgeBuildsCascade(['A']);
  assert.equal(db.stages.filter((s) => s.buildId === 'A').length, 0, 'no orphaned stages left behind');
  assert.equal(db.stageVersions.filter((v) => String(v.stageId).startsWith('sA')).length, 0,
    'stranding the writing is the defect this cascade exists to fix');
  assert.equal(db.buildVersions.filter((v) => v.buildId === 'A').length, 0);
});

test('children before the parent — the order that makes the rows findable while deleting', async () => {
  const { prisma, calls } = fakeDb(seed());
  await svc(prisma).purgeBuildsCascade(['A']);
  assert.deepEqual(calls, ['stageVersions', 'stages', 'buildVersions', 'builds'],
    'stage versions are reached THROUGH their stages; delete the stage first and they are unfindable');
  assert.ok(calls.indexOf('stageVersions') < calls.indexOf('stages'));
  assert.ok(calls.indexOf('stages') < calls.indexOf('builds'));
});

test('the returned counts are accurate — the UI states them to the user as fact', async () => {
  const { prisma } = fakeDb(seed());
  const out = await svc(prisma).purgeBuildsCascade(['A']);
  assert.equal(out.builds, 1);
  assert.equal(out.stages, 2);
  assert.equal(out.stageVersions, 2);
  assert.equal(out.versions, 1);
  assert.equal(out.chars, 11922 + 8363, 'the character count is what the toast prints — it must be exact');
});

test('an empty id list deletes NOTHING — a where of {} would empty the table', async () => {
  const { prisma, db, calls } = fakeDb(seed());
  const out = await svc(prisma).purgeBuildsCascade([]);
  assert.equal(calls.length, 0, 'it must not reach the database at all');
  assert.equal(db.builds.length, 2);
  assert.equal(db.stageVersions.length, 3);
  assert.deepEqual(out, { builds: 0, stages: 0, stageVersions: 0, versions: 0, chars: 0 });
  for (const bad of [null, undefined]) {
    const f = fakeDb(seed());
    await svc(f.prisma).purgeBuildsCascade(bad as any);
    assert.equal(f.db.builds.length, 2, 'null ids must be inert too');
  }
});

test('purging several builds at once still spares everything not named', async () => {
  const s = seed();
  s.builds.push({ id: 'C' });
  s.stages.push({ id: 'sC1', buildId: 'C' });
  s.stageVersions.push({ id: 'vC1', stageId: 'sC1', body: 'keep me' });
  const { prisma, db } = fakeDb(s);
  const out = await svc(prisma).purgeBuildsCascade(['A', 'B']);
  assert.equal(out.builds, 2);
  assert.deepEqual(db.builds.map((b) => b.id), ['C']);
  assert.deepEqual(db.stageVersions.map((v) => v.id), ['vC1'], 'C is untouched by a two-build purge');
});

test('a build with no stages purges cleanly and reports zeroes', async () => {
  // Eight of the eleven binned builds are exactly this shape.
  const { prisma, db } = fakeDb({ builds: [{ id: 'A' }, { id: 'B' }], stages: [], stageVersions: [], buildVersions: [] });
  const out = await svc(prisma).purgeBuildsCascade(['A']);
  assert.equal(out.builds, 1);
  assert.equal(out.stages, 0);
  assert.equal(out.chars, 0);
  assert.deepEqual(db.builds.map((b) => b.id), ['B']);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ARCHIVED IS SAFE — the promise the third state makes, and the one that must never quietly lapse.
//
// The sweep selects on deletedAt alone. That is only safe because the four transition writes keep
// archivedAt and deletedAt mutually exclusive: archive clears deletedAt, delete clears archivedAt.
// A row carrying both would be archived work with a 30-day countdown running on it, and the sweep
// would take it without a word. These tests are what stops that shape from being reintroduced.

function archiveDb() {
  const db: { builds: any[] } = {
    builds: [
      { id: 'live', archivedAt: null, deletedAt: null },
      { id: 'archived', archivedAt: new Date('2020-01-01'), deletedAt: null },   // archived long ago
      { id: 'binned', archivedAt: null, deletedAt: new Date('2020-01-01') },     // binned long ago
    ],
  };
  const prisma: any = {
    developmentBuild: {
      findMany: async ({ where }: any = {}) => db.builds.filter((b) => {
        const c = where && where.deletedAt;
        if (c && c.lt !== undefined) return !!b.deletedAt && b.deletedAt < c.lt;
        if (c === null) return b.deletedAt === null;
        return true;
      }).map((b) => ({ ...b })),
      update: async ({ where, data }: any) => {
        const row = db.builds.find((b) => b.id === where.id);
        Object.assign(row, data);
        return { ...row };
      },
      deleteMany: async ({ where }: any) => {
        const ids: string[] = (where && where.id && where.id.in) || [];
        const before = db.builds.length;
        db.builds = db.builds.filter((b) => ids.indexOf(b.id) < 0);
        return { count: before - db.builds.length };
      },
    },
    developmentStage: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    stageVersion: { findMany: async () => [], deleteMany: async () => ({ count: 0 }) },
    buildVersion: { deleteMany: async () => ({ count: 0 }) },
  };
  return { prisma, db };
}

test('THE PROMISE: a build archived years ago survives the 30-day sweep', async () => {
  const { prisma, db } = archiveDb();
  await svc(prisma).purgeExpiredBuilds();
  assert.ok(db.builds.some((b) => b.id === 'archived'), 'archived work was swept — the state means nothing');
  assert.ok(!db.builds.some((b) => b.id === 'binned'), 'and the binned one, long expired, WAS taken');
  assert.ok(db.builds.some((b) => b.id === 'live'), 'the active build is untouched');
});

test('archiving from the bin leaves the countdown without returning to the active board', async () => {
  const { prisma, db } = archiveDb();
  await svc(prisma).archiveBuild('binned');
  const row = db.builds.find((b) => b.id === 'binned');
  assert.equal(row.deletedAt, null, 'the countdown is gone');
  assert.ok(row.archivedAt instanceof Date, 'and it is archived, not active');
  await svc(prisma).purgeExpiredBuilds();
  assert.ok(db.builds.some((b) => b.id === 'binned'), 'the rescue holds against the sweep');
});

test('NEVER BOTH: every transition clears the state it is leaving', async () => {
  const { prisma, db } = archiveDb();
  const row = () => db.builds.find((b) => b.id === 'live');
  const s = svc(prisma);
  await s.archiveBuild('live');
  assert.equal(row().deletedAt, null);
  await s.deleteBuild('live');
  assert.equal(row().archivedAt, null, 'binning an archived build must clear archivedAt');
  assert.ok(row().deletedAt instanceof Date);
  await s.restoreBuild('live');
  assert.equal(row().archivedAt, null);
  assert.equal(row().deletedAt, null, 'restore returns it to active — both null');
  await s.archiveBuild('live');
  await s.unarchiveBuild('live');
  assert.equal(row().archivedAt, null, 'unarchive returns it to active');
  assert.equal(row().deletedAt, null);
  for (const b of db.builds) assert.ok(!(b.archivedAt && b.deletedAt), 'no row may ever carry both');
});

test('an archived build is never a purge candidate, whatever its age', async () => {
  const { prisma, db } = archiveDb();
  db.builds.push({ id: 'ancient', archivedAt: new Date('1999-01-01'), deletedAt: null });
  await svc(prisma).purgeExpiredBuilds();
  assert.ok(db.builds.some((b) => b.id === 'ancient'), 'age is irrelevant — archived has no expiry');
});
