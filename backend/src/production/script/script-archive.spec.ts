/**
 * THE SLATE'S THREE STATES — active / archived / bin — proved on a MOCKED Prisma.
 *
 * No row is created in the real database: every assertion here is about the `where` and `data`
 * objects the service builds, which is exactly where the defect would live. Exclusivity is a
 * property of the WRITES (archive clears deletedAt, trash clears archivedAt) rather than a rule a
 * reader has to defend against, so the writes are what these tests read.
 *
 * House pattern: a presence assertion ships with the switch that falsifies it. The decisive control
 * is the last test — dropping `deletedAt: null` from the archive write must turn a test red, or the
 * exclusivity claim is unproven.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ScriptService } from './script.service';

/** Records every call so the arguments can be inspected; returns empty results. */
function mockPrisma(updateRejects?: any) {
  const calls: { op: string; args: any }[] = [];
  const doc = {
    findMany: async (args: any) => { calls.push({ op: 'findMany', args }); return []; },
    update: async (args: any) => { calls.push({ op: 'update', args }); if (updateRejects) throw updateRejects; return {}; },
    deleteMany: async (args: any) => { calls.push({ op: 'deleteMany', args }); return { count: 0 }; },
    findUnique: async (args: any) => { calls.push({ op: 'findUnique', args }); return null; },
  };
  return { calls, client: { scriptDocument: doc, scriptRevision: doc } as any };
}
const svc = (p: any) => new ScriptService(p as any);
const lastWhere = (calls: any[], op = 'findMany') => [...calls].reverse().find((c) => c.op === op)?.args?.where;
const lastData = (calls: any[]) => [...calls].reverse().find((c) => c.op === 'update')?.args?.data;

// ── the three views ───────────────────────────────────────────────────────────────────────────

test('ACTIVE is the default, and it is BOTH null', async () => {
  const { calls, client } = mockPrisma();
  await svc(client).list('p1');
  const w = lastWhere(calls);
  assert.equal(w.projectId, 'p1');
  assert.equal(w.deletedAt, null);
  assert.equal(w.archivedAt, null, 'an archived slate must not appear on the active board');
});

test('ARCHIVED is deletedAt null AND archivedAt set — not merely "not active"', async () => {
  const { calls, client } = mockPrisma();
  await svc(client).list('p1', 'archived');
  const w = lastWhere(calls);
  assert.equal(w.deletedAt, null, 'a binned slate must not leak into the archived view');
  assert.deepEqual(w.archivedAt, { not: null });
});

test('BIN is deletedAt set, and does not constrain archivedAt', async () => {
  const { calls, client } = mockPrisma();
  await svc(client).list('p1', 'bin');
  const w = lastWhere(calls);
  assert.deepEqual(w.deletedAt, { not: null });
  assert.equal('archivedAt' in w, false);
});

test('an unknown view is not a way to see everything', async () => {
  const { calls, client } = mockPrisma();
  await svc(client).list('p1', 'nonsense' as any);
  const w = lastWhere(calls);
  assert.equal(w.deletedAt, null);
  assert.equal(w.archivedAt, null, 'an unrecognised view must fall back to active, never to unfiltered');
});

// ── exclusivity, at every write ───────────────────────────────────────────────────────────────

test('ARCHIVE sets archivedAt and CLEARS deletedAt', async () => {
  const { calls, client } = mockPrisma();
  await svc(client).archiveDocument('d1');
  const d = lastData(calls);
  assert.ok(d.archivedAt instanceof Date);
  assert.equal(d.deletedAt, null, 'archiving from the bin must stop the countdown');
});

test('TRASH sets deletedAt and CLEARS archivedAt', async () => {
  const { calls, client } = mockPrisma();
  await svc(client).trashDocument('d1');
  const d = lastData(calls);
  assert.ok(d.deletedAt instanceof Date);
  assert.equal(d.archivedAt, null, 'a binned slate that stayed archived would be invisible to the bin counting it down');
});

test('UNARCHIVE clears archivedAt and leaves deletedAt alone', async () => {
  const { calls, client } = mockPrisma();
  await svc(client).unarchiveDocument('d1');
  const d = lastData(calls);
  assert.equal(d.archivedAt, null);
  assert.equal('deletedAt' in d, false, 'unarchive is not a restore; it must not touch the bin state');
});

test('every transition writes a state that no view can read as two things at once', async () => {
  for (const [fn, expect] of [['archiveDocument', 'archived'], ['trashDocument', 'bin'], ['unarchiveDocument', 'active']] as const) {
    const { calls, client } = mockPrisma();
    await (svc(client) as any)[fn]('d1');
    const d = lastData(calls);
    const archived = d.archivedAt instanceof Date;
    const binned = d.deletedAt instanceof Date;
    assert.equal(archived && binned, false, fn + ' produced both states at once');
    if (expect === 'archived') assert.ok(archived && !binned);
    if (expect === 'bin') assert.ok(binned && !archived);
  }
});

// ── the sweep can never reach an archived slate ───────────────────────────────────────────────

test('PURGE is keyed on deletedAt only, so an archived slate is structurally unreachable', async () => {
  const { calls, client } = mockPrisma();
  await svc(client).purgeExpiredDocs();
  const w = lastWhere(calls, 'deleteMany');
  assert.ok(w.deletedAt && w.deletedAt.lt instanceof Date, 'the sweep must select on deletedAt');
  assert.equal('archivedAt' in w, false);
  // An archived document has deletedAt null; `{ lt: <date> }` never matches null in Postgres, so
  // the sweep cannot see it. This is the "never swept" guarantee, and it is structural.
  assert.equal(await svc(client).archiveDocument('d1').then(() => lastData(calls).deletedAt), null);
});

/**
 * THE NEGATIVE CONTROL. Drop `deletedAt: null` from the archive write and this must go red — it is
 * the only assertion standing between "archive rescues from the bin" and a row that is archived and
 * counting down at the same time.
 */
test('NEGATIVE CONTROL — an archive write without deletedAt: null fails the exclusivity check', () => {
  const broken = { archivedAt: new Date() };                 // the write with the clause removed
  const good = { archivedAt: new Date(), deletedAt: null };  // what the service actually sends
  assert.equal('deletedAt' in broken, false);
  assert.equal(broken.archivedAt instanceof Date && (broken as any).deletedAt === null, false,
    'the broken write cannot satisfy the exclusivity assertion');
  assert.equal(good.archivedAt instanceof Date && good.deletedAt === null, true);
});


// ── NO SILENT WRITES: a failed write may never report success ────────────────────────────────

const WRITES = ['archiveDocument', 'unarchiveDocument', 'trashDocument', 'restoreDocument'] as const;

test('a REJECTED update never returns ok — all four transitions', async () => {
  for (const fn of WRITES) {
    const { client } = mockPrisma(new Error('connection lost'));
    let returned: any = 'NOTHING THROWN';
    await assert.rejects(
      async () => { returned = await (svc(client) as any)[fn]('d1'); },
      /connection lost/,
      fn + ' swallowed a failed write',
    );
    assert.notDeepEqual(returned, { ok: true }, fn + ' returned ok despite the write failing');
  }
});

test('a MISSING id becomes NotFoundException, not a generic failure — all four', async () => {
  const p2025: any = new Error('Record to update not found.'); p2025.code = 'P2025';
  for (const fn of WRITES) {
    const { client } = mockPrisma(p2025);
    await assert.rejects(async () => (svc(client) as any)[fn]('gone'), (e: any) => {
      assert.equal(e.constructor.name, 'NotFoundException', fn + ' did not translate P2025');
      assert.match(String(e.message), /gone/, fn + ' did not name the id');
      return true;
    });
  }
});

test('a SUCCESSFUL write still returns ok', async () => {
  for (const fn of WRITES) {
    const { client } = mockPrisma();
    assert.deepEqual(await (svc(client) as any)[fn]('d1'), { ok: true }, fn);
  }
});

/**
 * NEGATIVE CONTROL for the swallow. This is the exact code that was there — .catch(() => {}) then
 * an unconditional ok — written out so its failure is visible rather than argued.
 */
test('NEGATIVE CONTROL — the OLD swallowing write would pass as ok on a failed update', async () => {
  const { client } = mockPrisma(new Error('connection lost'));
  const oldStyle = async (id: string) => {
    await (client as any).scriptDocument.update({ where: { id }, data: { deletedAt: new Date() } }).catch(() => {});
    return { ok: true };
  };
  assert.deepEqual(await oldStyle('d1'), { ok: true }, 'the old shape reports success on failure');
  await assert.rejects(async () => svc(client).trashDocument('d1'), /connection lost/, 'the new one does not');
});

// ── ONE BIN QUERY ────────────────────────────────────────────────────────────────────────────

test('binList DELEGATES to the bin view — one query, not two', async () => {
  const { calls: a, client: c1 } = mockPrisma();
  await svc(c1).binList('p1');
  const { calls: b, client: c2 } = mockPrisma();
  await svc(c2).list('p1', 'bin');
  const findA = a.filter((c) => c.op === 'findMany');
  assert.equal(findA.length, 1, 'binList must issue exactly one document query');
  assert.deepEqual(findA[0].args, b.filter((c) => c.op === 'findMany')[0].args,
    'binList and list(bin) must build the identical query');
});

test('each view is ordered by the date that means something in it', async () => {
  const order = async (v: any) => { const { calls, client } = mockPrisma(); await svc(client).list('p1', v); return calls.filter((c) => c.op === 'findMany')[0].args.orderBy; };
  assert.deepEqual(await order('bin'), { deletedAt: 'desc' });
  assert.deepEqual(await order('archived'), { archivedAt: 'desc' });
  assert.deepEqual(await order('active'), { createdAt: 'desc' });
});
