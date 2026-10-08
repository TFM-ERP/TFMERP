/**
 * Covers BOTH controllers in this commit: rental/logistics and rental/maintenance.
 *
 * THE EXACT FAILURE THIS CATCHES: the live logistics board and the maintenance log behind
 * JwtAuthGuard alone. Any authenticated user of any role could move units between sites, advance a
 * site's status, re-pin a location, record odometers, hitch and unhitch trailers, and schedule,
 * start, complete or cancel maintenance — which takes a unit out of the fleet and puts it back.
 *
 * Floor rentals:1 on each class rather than nothing, so a route added later arrives gated at view
 * instead of open; the thirteen writes (8 + 5) override to rentals:2. The guard resolves
 * getAllAndOverride([handler, class]) (permissions.guard.ts:11-14), so a handler decorator replaces
 * the floor in either direction — the failure mode the override control at the bottom is for.
 *
 * FOUR OF MAINTENANCE'S FIVE WRITES MOVE asset.status (create only when scheduled for today; start,
 * complete and cancel inside transactions). Asset.status has three doors and all three are rentals:2
 * — PATCH /rental/assets/:id/status, PUT /rental/assets/:id (sanitize keeps `status` in its
 * allowlist, assets.service.ts:100), and these four sites. That consistency is asserted below rather
 * than assumed.
 *
 * TWO ENTITIES LOGISTICS WRITES HAVE A DOOR THAT IS STILL OPEN, and the LIMIT tests pin them:
 * conditionReport (condition-reports.controller.ts:19 and :22 — create AND delete, JwtAuthGuard
 * alone) and asset.currentOdometer (PATCH /pm/assets/:id/readings, pm.controller.ts:31, JwtAuthGuard
 * alone). Both belong to the deferred condition-reports + pm commit.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { LogisticsController } from './logistics.controller';
import { MaintenanceController } from '../maintenance/maintenance.controller';
import { AssetsController } from '../assets/assets.controller';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { PERM_KEY } from '../../permissions/require-permission.decorator';

const reflector = new Reflector();
const permOn = (C: any, m: string) => reflector.get<{ module: string; level: number }>(PERM_KEY, C.prototype[m]);
const guardsOn = (C: any): any[] => Reflect.getMetadata('__guards__', C) || [];

const LOGISTICS_WRITES = ['assignUnit', 'setTow', 'recordReading', 'setLocationStatus',
  'updateLocation', 'logInspection', 'confirmHitch', 'unhitch'];
const LOGISTICS_FLOOR = ['overview', 'dispatchCheck'];
const MAINT_WRITES = ['create', 'update', 'start', 'complete', 'cancel'];
const MAINT_FLOOR = ['findAll', 'schedule', 'overdue', 'findOne'];

const SUITES = [
  { name: 'logistics', C: LogisticsController, writes: LOGISTICS_WRITES, floor: LOGISTICS_FLOOR },
  { name: 'maintenance', C: MaintenanceController, writes: MAINT_WRITES, floor: MAINT_FLOOR },
];

for (const { name, C, writes, floor } of SUITES) {
  test(`${name}: the class runs BOTH guards — JwtAuthGuard alone is the defect`, () => {
    const names = guardsOn(C).map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
    assert.ok(names.includes('PermissionsGuard'), 'PermissionsGuard missing: ' + names.join(', '));
    assert.ok(names.includes('JwtAuthGuard'), 'JwtAuthGuard must stay: ' + names.join(', '));
  });

  test(`${name}: the class carries a rentals:1 FLOOR — nothing here is open`, () => {
    assert.deepEqual(reflector.get(PERM_KEY, C), { module: 'rentals', level: 1 });
  });

  test(`${name}: every WRITE carries rentals:2`, () => {
    for (const m of writes) assert.deepEqual(permOn(C, m), { module: 'rentals', level: 2 }, m);
  });

  test(`${name}: every READ carries NO override, so it sits on the floor`, () => {
    for (const m of floor) assert.equal(permOn(C, m), undefined, m + ' must inherit the class floor');
  });

  test(`${name}: NO HANDLER IS UNACCOUNTED FOR — a route added later cannot arrive unruled`, () => {
    const actual = Object.getOwnPropertyNames(C.prototype)
      .filter((m) => m !== 'constructor' && typeof C.prototype[m] === 'function');
    const unaccounted = actual.filter((m) => !writes.includes(m) && !floor.includes(m));
    assert.deepEqual(unaccounted, [], 'decide a level for these: ' + unaccounted.join(', '));
    const phantom = [...writes, ...floor].filter((m) => !actual.includes(m));
    assert.deepEqual(phantom, [], 'the tables name handlers that do not exist: ' + phantom.join(', '));
  });
}

const guardWith = (map: Record<string, number>) =>
  new PermissionsGuard(new Reflector(), { forRole: async () => map } as any);
const ctxOn = (C: any, method: string, role?: string): any => ({
  getHandler: () => C.prototype[method],
  getClass: () => C,
  switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
});
const allowsOn = (C: any, map: Record<string, number>, m: string, role: string) =>
  guardWith(map).canActivate(ctxOn(C, m, role));

test('rentals:1 reads both boards and writes neither', async () => {
  for (const { C, writes, floor } of SUITES)
    for (const role of ['FINANCE_MANAGER', 'SALES', 'PRODUCTION_MANAGER', 'DRIVER']) {
      for (const m of floor) assert.equal(await allowsOn(C, { rentals: 1, finance: 3, production: 3 }, m, role), true, role + ' lost read ' + m);
      for (const m of writes)
        await assert.rejects(() => allowsOn(C, { rentals: 1, finance: 3, production: 3 }, m, role) as any, /rentals/, role + ' must not ' + m);
    }
});

test('a rentals:0 role is refused even the reads — neither floor is open', async () => {
  for (const { C, floor } of SUITES)
    for (const m of floor)
      await assert.rejects(() => allowsOn(C, { finance: 2, production: 2 }, m, 'ACCOUNTANT') as any, /rentals/, m);
});

test('rentals:2 and above keep every write on both controllers', async () => {
  for (const { C, writes } of SUITES)
    for (const [role, map] of [['DISPATCHER', { rentals: 2 }], ['MAINTENANCE', { rentals: 2 }], ['RENTAL_MANAGER', { rentals: 3 }]] as const)
      for (const m of writes) assert.equal(await allowsOn(C, map as any, m, role), true, role + ' lost ' + m);
});

/**
 * The driver PWA writes four of these logistics routes (app/driver/page.tsx:93, 98, 133, 134).
 * rentals:2 is the ruled lock-now level for every driver-surface write and DRIVER holds rentals:1,
 * so none of them is reachable by a driver. Correct only while no driver has a login; when
 * row-scoped self-service lands this is SUPPOSED to change, and should be rewritten, not deleted.
 */
test('DRIVER (rentals:1) reaches none of the four routes its own app calls', async () => {
  for (const m of ['setLocationStatus', 'updateLocation', 'unhitch', 'confirmHitch'])
    await assert.rejects(() => allowsOn(LogisticsController, { rentals: 1 }, m, 'DRIVER') as any, /rentals/, m);
});

/**
 * asset.status is written from three places and they must not drift apart. This reads the assets
 * controller's own decorators rather than restating them.
 */
test('ASSET.STATUS: all three doors sit at rentals:2 — assets PATCH, assets PUT, and these four', () => {
  assert.deepEqual(permOn(AssetsController, 'updateStatus'), { module: 'rentals', level: 2 },
    'PATCH /rental/assets/:id/status');
  assert.deepEqual(permOn(AssetsController, 'update'), { module: 'rentals', level: 2 },
    'PUT /rental/assets/:id — sanitize() keeps `status` in its allowlist (assets.service.ts:100)');
  for (const m of ['create', 'start', 'complete', 'cancel'])
    assert.deepEqual(permOn(MaintenanceController, m), { module: 'rentals', level: 2 },
      m + ' moves asset.status and must match the other doors');
});

/**
 * LIMIT — conditionReport. logInspection is rentals:2 here, but condition-reports.controller.ts runs
 * JwtAuthGuard ALONE and exposes both POST and DELETE, so inspection records can still be written
 * and removed by any authenticated account. Gating this route does not protect the entity. Closing
 * that is the deferred condition-reports commit.
 */
test('LIMIT: gating logInspection does not fence conditionReport — the other door is still open', async () => {
  assert.deepEqual(permOn(LogisticsController, 'logInspection'), { module: 'rentals', level: 2 });
  await assert.rejects(() => allowsOn(LogisticsController, { rentals: 1 }, 'logInspection', 'DRIVER') as any, /rentals/,
    'refused here — while POST and DELETE /condition-reports remain reachable by anyone logged in');
});

/**
 * LIMIT — asset.currentOdometer. recordReading is rentals:2, but PATCH /pm/assets/:id/readings
 * (pm.controller.ts:31, JwtAuthGuard alone) writes the same column (pm.service.ts:100-103).
 */
test('LIMIT: gating recordReading does not fence asset.currentOdometer — pm readings is still open', async () => {
  assert.deepEqual(permOn(LogisticsController, 'recordReading'), { module: 'rentals', level: 2 });
  await assert.rejects(() => allowsOn(LogisticsController, { rentals: 1 }, 'recordReading', 'SALES') as any, /rentals/,
    'refused here — while PATCH /pm/assets/:id/readings remains reachable by anyone logged in');
});

test('an unauthenticated request is refused before the map is consulted', async () => {
  await assert.rejects(() => allowsOn(LogisticsController, { rentals: 3 }, 'unhitch', undefined as any) as any, /Not authenticated/);
  await assert.rejects(() => allowsOn(MaintenanceController, { rentals: 3 }, 'complete', undefined as any) as any, /Not authenticated/);
});

test('NEGATIVE CONTROL — the OLD shape (no requirement) let any role complete maintenance', async () => {
  class OldMaintenanceController { complete() { return null; } }
  const ctx: any = {
    getHandler: () => OldMaintenanceController.prototype.complete,
    getClass: () => OldMaintenanceController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CREW' } }) }),
  };
  assert.equal(await guardWith({}).canActivate(ctx), true, 'this is the defect: an unruled route passes');
  await assert.rejects(() => allowsOn(MaintenanceController, {}, 'complete', 'CREW') as any, /rentals/);
});

test('NEGATIVE CONTROL — a handler override at rentals:1 would reopen a logistics write', async () => {
  class Overridden { unhitch() { return null; } }
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden);
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden.prototype.unhitch);
  const ctx: any = {
    getHandler: () => Overridden.prototype.unhitch,
    getClass: () => Overridden,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'DRIVER' } }) }),
  };
  assert.equal(await guardWith({ rentals: 1 }).canActivate(ctx), true,
    'a handler override wins over the class — which is why the override test above matters');
  await assert.rejects(() => allowsOn(LogisticsController, { rentals: 1 }, 'unhitch', 'DRIVER') as any, /rentals/);
});
