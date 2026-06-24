/**
 * SchedulingService.optimizeOrder — integration-style tests: REAL service + fake Prisma (no DB).
 * Covers the wrapper orchestration around the pure planner: fetch strips, plan, and (only on apply)
 * persist each strip via a $transaction. Run: npm run test:unit
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { SchedulingService } from './scheduling.service';

const STRIPS = [
  { id: '1', isBanner: false, isLocked: false, shootDay: 1, sortOrder: 0, sceneNumber: '1', location: 'WAREHOUSE', dayNight: 'DAY', cast: ['SARAH'], pages: 1 },
  { id: '2', isBanner: false, isLocked: false, shootDay: 2, sortOrder: 0, sceneNumber: '2', location: 'DOCK', dayNight: 'DAY', cast: ['SARAH'], pages: 1 },
  { id: '3', isBanner: false, isLocked: false, shootDay: 3, sortOrder: 0, sceneNumber: '3', location: 'WAREHOUSE', dayNight: 'NIGHT', cast: ['SARAH'], pages: 1 },
  { id: '4', isBanner: false, isLocked: false, shootDay: 4, sortOrder: 0, sceneNumber: '4', location: 'DOCK', dayNight: 'DAY', cast: ['SARAH'], pages: 1 },
];
function harness() {
  const updates: any[] = []; let txnCalls = 0;
  const db = {
    productionStrip: {
      findMany: async () => STRIPS.map((s) => ({ ...s })),
      update: (args: any) => { updates.push(args); return args; },
    },
    $transaction: async (writes: any[]) => { txnCalls++; return writes; },
  };
  return { svc: new SchedulingService(db as any, {} as any, {} as any), updates, get txnCalls() { return txnCalls; } };
}

test('optimizeOrder(preview) plans, improves the schedule, and does NOT persist', async () => {
  const h = harness();
  const res: any = await h.svc.optimizeOrder('proj', { apply: false });
  assert.equal(res.ok, true);
  assert.equal(res.applied, false);
  assert.equal(res.plan.length, 4);
  assert.ok(res.after.companyMoves <= res.before.companyMoves);
  assert.equal(h.updates.length, 0, 'preview must not write');
  assert.equal(h.txnCalls, 0);
});

test('optimizeOrder(apply) persists every planned strip in one transaction', async () => {
  const h = harness();
  const res: any = await h.svc.optimizeOrder('proj', { apply: true });
  assert.equal(res.applied, true);
  assert.equal(h.updates.length, 4, 'one update per planned strip');
  assert.equal(h.txnCalls, 1, 'a single $transaction');
  for (const u of h.updates) {
    assert.ok(u.where && u.where.id, 'update targets a strip id');
    assert.ok('shootDay' in u.data && 'sortOrder' in u.data, 'update sets shootDay + sortOrder');
  }
});
