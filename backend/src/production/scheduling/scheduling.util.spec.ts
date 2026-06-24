/** Shooting-order optimizer core — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { planShootingOrder } from './scheduling.util';

// Alternating WAREHOUSE/DOCK days, one shared actor — the classic "shoot the location out" case.
const altStrips = () => [
  { id: '1', shootDay: 1, sortOrder: 0, sceneNumber: '1', location: 'WAREHOUSE', dayNight: 'DAY', cast: ['SARAH'], pages: 1 },
  { id: '2', shootDay: 2, sortOrder: 0, sceneNumber: '2', location: 'DOCK', dayNight: 'DAY', cast: ['SARAH'], pages: 1 },
  { id: '3', shootDay: 3, sortOrder: 0, sceneNumber: '3', location: 'WAREHOUSE', dayNight: 'NIGHT', cast: ['SARAH'], pages: 1 },
  { id: '4', shootDay: 4, sortOrder: 0, sceneNumber: '4', location: 'DOCK', dayNight: 'DAY', cast: ['SARAH'], pages: 1 },
];

test('planShootingOrder returns ok:false when there are no scenes', () => {
  assert.equal(planShootingOrder([]).ok, false);
  assert.equal(planShootingOrder([{ id: 'b', isBanner: true, shootDay: 1 }]).ok, false);
});

test('it clusters locations and cuts company moves', () => {
  const r: any = planShootingOrder(altStrips(), {});
  assert.equal(r.ok, true);
  assert.equal(r.before.companyMoves, 3);   // W→D→W→D as authored
  assert.equal(r.after.companyMoves, 1);     // shoot each location out
  assert.equal(r.after.shootDays, 2);
  assert.equal(r.plan.length, 4);
  // the two WAREHOUSE scenes now share one shoot day
  const wh = r.plan.filter((p: any) => p.location === 'WAREHOUSE');
  assert.equal(new Set(wh.map((p: any) => p.shootDay)).size, 1);
});

test('within a location it orders DAY before NIGHT (fewer relights)', () => {
  const r: any = planShootingOrder(altStrips(), {});
  const s1 = r.plan.find((p: any) => p.id === '1'); // WAREHOUSE / DAY
  const s3 = r.plan.find((p: any) => p.id === '3'); // WAREHOUSE / NIGHT
  assert.equal(s1.shootDay, s3.shootDay);
  assert.ok(s1.sortOrder < s3.sortOrder, 'DAY scene scheduled before NIGHT scene');
});

test('locked days are pinned and the pool is routed around them', () => {
  const strips = [...altStrips(), { id: '5', shootDay: 5, sortOrder: 0, sceneNumber: '9', location: 'STUDIO', dayNight: 'DAY', cast: ['LEE'], pages: 1, isLocked: true }];
  const r: any = planShootingOrder(strips, {});
  const pinned = r.plan.find((p: any) => p.id === '5');
  assert.equal(pinned.pinned, true);
  assert.equal(pinned.shootDay, 5);
  assert.ok(r.plan.filter((p: any) => !p.pinned).every((p: any) => p.shootDay !== 5), 'no pool strip lands on the locked day');
});

test('respectLocks:false lets a previously-locked day be re-planned', () => {
  const strips = [...altStrips(), { id: '5', shootDay: 5, sortOrder: 0, sceneNumber: '9', location: 'WAREHOUSE', dayNight: 'DAY', cast: ['SARAH'], pages: 1, isLocked: true }];
  const r: any = planShootingOrder(strips, { respectLocks: false });
  assert.equal(r.plan.some((p: any) => p.pinned), false, 'nothing pinned when locks are ignored');
});
