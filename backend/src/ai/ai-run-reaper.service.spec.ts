/**
 * A3 and A4 — what the sweep actually asks the database for, and what it says afterwards.
 *
 * No database: a stub Prisma records the updateMany argument, which is the whole claim. "DONE and
 * ERROR are never rewritten" is not a behaviour to observe, it is a WHERE clause to read — so the
 * test reads it. Asserting it by seeding rows and finding them unchanged would also pass if the
 * sweep did nothing at all.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { AiService } from './ai.service';
import { ABANDONED } from './ai-run-reaper.util';

const svcWith = (count: number) => {
  const calls: any[] = [];
  const logs: string[] = [];
  const prisma: any = { aiRun: { updateMany: async (args: any) => { calls.push(args); return { count }; } } };
  const svc = new AiService(prisma, {} as any);
  (svc as any).log = { warn: (m: string) => logs.push(m), log: () => {}, error: () => {}, debug: () => {}, verbose: () => {} };
  return { svc, calls, logs };
};

test('A3: the sweep asks only for RUNNING rows older than the cutoff — DONE and ERROR cannot match', async () => {
  const { svc, calls } = svcWith(0);
  const now = new Date('2026-09-15T12:00:00.000Z');
  await svc.reapAbandonedRuns(now);
  assert.equal(calls.length, 1);
  const where = calls[0].where;
  assert.equal(where.status, 'RUNNING', 'the sweep would rewrite rows that are not RUNNING');
  assert.ok(where.createdAt && where.createdAt.lt instanceof Date, 'the sweep has no age bound at all');
  assert.equal(where.createdAt.lt.toISOString(), '2026-09-15T11:00:00.000Z');
  assert.equal(calls[0].data.status, ABANDONED, 'runs are not being closed out as ABANDONED');
});

test('A4: it returns the count, and says nothing when there was nothing to say', async () => {
  const none = svcWith(0);
  assert.equal(await none.svc.reapAbandonedRuns(), 0);
  assert.deepEqual(none.logs, [], 'an empty sweep logged on a boot where nothing happened');

  const some = svcWith(18);
  assert.equal(await some.svc.reapAbandonedRuns(), 18);
  assert.equal(some.logs.length, 1);
  assert.match(some.logs[0], /reaped 18 abandoned AI run\(s\) older than 60 minutes/);
});

test('onModuleInit does not take the server down when the table is not there yet', async () => {
  const svc = new AiService({ aiRun: { updateMany: async () => { throw new Error('relation "AiRun" does not exist'); } } } as any, {} as any);
  (svc as any).log = { warn: () => {}, log: () => {}, error: () => {}, debug: () => {}, verbose: () => {} };
  await svc.onModuleInit(); // must not throw
});
