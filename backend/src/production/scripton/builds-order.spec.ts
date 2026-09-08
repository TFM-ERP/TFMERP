import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ScripOnService } from './scripton.service';

/**
 * THE BOARD PUT A REPAIR ABOVE THE WRITING.
 *
 * listBuilds ordered on DevelopmentBuild.updatedAt. That column records when the ROW was last
 * written, not when the writer worked — so the orphan recovery, which touched eleven rows on
 * 8 Sep, stamped every one of them with that date and pushed his live work to seventh place
 * behind six cards still called "Name this build".
 *
 * The order now comes from StageVersion.createdAt, the moment a draft was actually produced.
 * StageVersion has no updatedAt (checked against the schema), so no later maintenance can move a
 * build up the board — which is the whole point. It also dissolves the special case the recovered
 * builds appeared to need: their stage versions were orphaned, never deleted, so their createdAt is
 * still the original writing date and they sort back into place with no display string to parse.
 */

const iso = (d: string) => new Date(d + 'T12:00:00Z');

// The real shape on this install: his work, then the recovery's eleven.
const BUILDS = [
  { id: 'live', name: 'عنترة',            updatedAt: iso('2026-08-20'), createdAt: iso('2026-06-01') },
  { id: 'rec1', name: 'Name this build',  updatedAt: iso('2026-09-08'), createdAt: iso('2026-09-08') },
  { id: 'rec2', name: 'Name this build',  updatedAt: iso('2026-09-08'), createdAt: iso('2026-09-08') },
  { id: 'fresh', name: 'Never opened',    updatedAt: iso('2026-09-07'), createdAt: iso('2026-09-07') },
];

// stage rows per build, and the newest StageVersion.createdAt under each stage
const STAGES = [
  { id: 's-live', buildId: 'live', kind: 'SYNOPSIS', order: 2, _count: { versions: 1 } },
  { id: 's-rec1', buildId: 'rec1', kind: 'SYNOPSIS', order: 2, _count: { versions: 1 } },
  { id: 's-rec2', buildId: 'rec2', kind: 'SYNOPSIS', order: 2, _count: { versions: 1 } },
  // 'fresh' has no stage rows at all — it has never been written to.
];
const WROTE: Record<string, Date> = {
  's-live': iso('2026-09-05'),   // he wrote three days before the recovery ran
  's-rec1': iso('2026-06-23'),   // the recovered writing is from June
  's-rec2': iso('2026-06-26'),
};

function fakePrisma(opts: { groupByThrows?: boolean } = {}) {
  return {
    developmentBuild: { findMany: async () => BUILDS.map((b) => ({ ...b, status: 'DRAFT', deletedAt: null, brief: {} })) },
    buildVersion: { findMany: async () => [] },
    developmentStage: { findMany: async () => STAGES.map((s) => ({ ...s })) },
    stageVersion: {
      groupBy: async ({ by, _max }: any) => {
        if (opts.groupByThrows) throw new Error('no groupBy on this client');
        assert.deepEqual(by, ['stageId'], 'grouped per stage, then folded up to the build');
        assert.ok(_max && _max.createdAt, 'createdAt — StageVersion has no updatedAt to read');
        return Object.keys(WROTE).map((stageId) => ({ stageId, _max: { createdAt: WROTE[stageId] } }));
      },
    },
  } as any;
}

const svc = (prisma: any) => new ScripOnService(prisma, {} as any, {} as any);
const names = (cards: any[]) => cards.map((c) => c.id);

test('THE REGRESSION: a build the recovery touched today does not outrank work done in June', async () => {
  const cards = await svc(fakePrisma()).listBuilds('p1', false);
  const order = names(cards);
  // The defect was precise: rows the RECOVERY stamped with its own run date jumped the queue. A
  // build he created himself yesterday legitimately sorts on that date — that is his action, not a
  // migration's — so this asserts what actually went wrong rather than "his work is always first".
  assert.ok(order.indexOf('live') < order.indexOf('rec1'), 'behind a repair: ' + order.join(' '));
  assert.ok(order.indexOf('live') < order.indexOf('rec2'), 'behind a repair: ' + order.join(' '));
});

test('the recovered builds sort by when the writing was MADE, newest first', async () => {
  const cards = await svc(fakePrisma()).listBuilds('p1', false);
  const order = names(cards);
  assert.ok(order.indexOf('rec2') < order.indexOf('rec1'), '26 Jun before 23 Jun: ' + order.join(' '));
});

test('ordering on updatedAt would fail this suite — the old behaviour is pinned, not assumed', async () => {
  const byUpdatedAt = [...BUILDS].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  assert.notEqual(byUpdatedAt[0].id, 'live', 'the old column really did bury his work');
  assert.equal(byUpdatedAt[0].name, 'Name this build');
});

test('a build with no writing yet falls back to its own creation, never to updatedAt', async () => {
  const cards = await svc(fakePrisma()).listBuilds('p1', false);
  const fresh = cards.find((c: any) => c.id === 'fresh');
  assert.equal(fresh.lastWorkedAt, null, 'nothing written means nothing to claim');
  const order = names(cards);
  assert.ok(order.indexOf('fresh') < order.indexOf('rec1'),
    'created 7 Sep outranks writing from June — but on its OWN date, not a migration stamp: ' + order.join(' '));
});

test('the card carries the date it was sorted on', async () => {
  const cards = await svc(fakePrisma()).listBuilds('p1', false);
  const live = cards.find((c: any) => c.id === 'live');
  assert.equal(new Date(live.lastWorkedAt).toISOString(), WROTE['s-live'].toISOString(),
    'a board that orders by something it does not show cannot be checked by the reader');
});

test('the bin keeps deletedAt order — there, "when did I bin this" is the question', async () => {
  const prisma = fakePrisma();
  prisma.developmentBuild.findMany = async ({ orderBy }: any) => {
    assert.deepEqual(orderBy, { deletedAt: 'desc' });
    return [{ ...BUILDS[1], deletedAt: iso('2026-09-08'), status: 'DRAFT', brief: {} },
            { ...BUILDS[0], deletedAt: iso('2026-09-01'), status: 'DRAFT', brief: {} }];
  };
  const cards = await svc(prisma).listBuilds('p1', true);
  assert.deepEqual(names(cards), ['rec1', 'live'], 'the bin is not re-sorted by activity');
});

test('a client without groupBy degrades to creation order, it does not throw the board away', async () => {
  const cards = await svc(fakePrisma({ groupByThrows: true })).listBuilds('p1', false);
  assert.equal(cards.length, 4, 'the board still renders');
  cards.forEach((c: any) => assert.equal(c.lastWorkedAt, null));
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// A FAILED QUERY IS NOT AN EMPTY BOARD.
//
// listBuilds ended in `.catch(() => [])`, so ANY database error rendered as "No builds yet" — and
// it did: the archivedAt filter shipped before the migration was applied, Postgres rejected the
// query, and one refresh emptied the whole board with no error anywhere. The same class of failure
// as SAMPLE and the stuck skeleton: a screen asserting something it does not know.
//
// Two properties now hold. The archive columns are optional at RUNTIME, so a database without the
// migration still lists builds. And anything else is thrown, so the panel shows its failure state
// ("Nothing was deleted — this is a loading failure") instead of a lie.

const COLUMN_MISSING = 'The column `development_builds.archivedAt` does not exist in the current database.';

function dbWithoutArchiveColumn(otherError?: string) {
  let attempts = 0;
  return {
    attempts: () => attempts,
    prisma: {
      developmentBuild: {
        findMany: async ({ select, where }: any) => {
          attempts++;
          if (otherError) throw new Error(otherError);
          if (select && select.archivedAt) throw new Error(COLUMN_MISSING);
          if (where && 'archivedAt' in where) throw new Error(COLUMN_MISSING);
          return BUILDS.map((b) => ({ ...b, status: 'DRAFT', deletedAt: null, brief: {} }));
        },
        update: async ({ data }: any) => {
          if ('archivedAt' in data) throw new Error(COLUMN_MISSING);
          return { ok: true };
        },
      },
      buildVersion: { findMany: async () => [] },
      developmentStage: { findMany: async () => [] },
      stageVersion: { groupBy: async () => [] },
    } as any,
  };
}

test('THE REGRESSION: a database without the archive migration still lists every build', async () => {
  const f = dbWithoutArchiveColumn();
  const cards = await svc(f.prisma).listBuilds('p1', false);
  assert.equal(cards.length, BUILDS.length, 'the board emptied instead of falling back');
  assert.equal(f.attempts(), 2, 'three-state query first, two-state fallback second');
});

test('any OTHER database error is thrown — it must never render as "No builds yet"', async () => {
  const f = dbWithoutArchiveColumn('connection refused');
  await assert.rejects(() => svc(f.prisma).listBuilds('p1', false), /connection refused/,
    'a read failure was swallowed into an empty board');
});

test('the Archived view is empty, not broken, before the migration', async () => {
  const f = dbWithoutArchiveColumn();
  assert.deepEqual(await svc(f.prisma).listBuilds('p1', false, 'archived'), []);
});

test('delete still bins a build on a database without the archive column', async () => {
  const f = dbWithoutArchiveColumn();
  const r: any = await svc(f.prisma).deleteBuild('live');
  assert.equal(r.ok, true, 'the deletedAt half must still be written');
  assert.equal(r.archived, false, 'and it must report that the archive half was dropped');
});

test('archive REFUSES rather than reporting success it did not achieve', async () => {
  const f = dbWithoutArchiveColumn();
  await assert.rejects(() => svc(f.prisma).archiveBuild('live'), /migration/,
    'flashing "Archived" over a build that was not archived is the failure being prevented');
});
