/**
 * THE EXACT FAILURE THIS CATCHES: the fuel log behind JwtAuthGuard alone. Any authenticated user of
 * any role could add a fill-up against any asset, or delete one — and delete is a HARD delete
 * (fuel.service.ts:56 calls prisma.fuelLog.delete), with no soft-delete column and nothing that
 * restores the row.
 *
 * Floor rentals:1 on the class rather than nothing, so a route added here later arrives gated at
 * view instead of open; the two writes override to rentals:2. The guard resolves
 * getAllAndOverride([handler, class]) (permissions.guard.ts:11-14), so a handler decorator replaces
 * the floor in either direction — the failure mode the override control at the bottom is for.
 *
 * WHAT THE SERVICE DOES, read rather than assumed: create requires the asset to exist and computes
 * totalCost server-side as litres × costPerLitre (:35); getSummary aggregates litres, cost, fills
 * and average cost per litre by asset. Neither posts to a ledger and nothing bills from them.
 *
 * THE LEVEL HERE IS NOT A FENCE AROUND THE ROWS, and the last test says so. fuelLog is written
 * through three doors: this one, driver-app review() (rentals:2 since 05f5629), and
 * logistics/transport POST fuel and DELETE fuel/:id at production:2 — whose removeFuel deletes any
 * id with no scoping. A production:2 holder therefore reaches rows created here.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { FuelController } from './fuel.controller';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { PERM_KEY } from '../../permissions/require-permission.decorator';

const reflector = new Reflector();
const handlerOf = (m: string) => (FuelController.prototype as any)[m];
const perm = (m: string) => reflector.get<{ module: string; level: number }>(PERM_KEY, handlerOf(m));
const classGuards = (): any[] => Reflect.getMetadata('__guards__', FuelController) || [];

const GATED: Record<string, { module: string; level: number }> = {
  create: { module: 'rentals', level: 2 },
  delete: { module: 'rentals', level: 2 },
};
const FLOOR = ['findAll', 'summary'];

test('the class runs BOTH guards — JwtAuthGuard alone is the defect', () => {
  const names = classGuards().map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
  assert.ok(names.includes('PermissionsGuard'), 'PermissionsGuard missing: ' + names.join(', '));
  assert.ok(names.includes('JwtAuthGuard'), 'JwtAuthGuard must stay: ' + names.join(', '));
});

test('the class carries a rentals:1 FLOOR — nothing here is open', () => {
  assert.deepEqual(reflector.get(PERM_KEY, FuelController), { module: 'rentals', level: 1 });
});

test('every WRITE carries rentals:2 — including the hard delete', () => {
  for (const [m, expected] of Object.entries(GATED)) assert.deepEqual(perm(m), expected, m);
});

test('every READ carries NO override, so it sits on the floor', () => {
  for (const m of FLOOR) assert.equal(perm(m), undefined, m + ' must inherit the class floor');
});

test('NO HANDLER IS UNACCOUNTED FOR — a route added later cannot arrive unruled', () => {
  const actual = Object.getOwnPropertyNames(FuelController.prototype)
    .filter((m) => m !== 'constructor' && typeof handlerOf(m) === 'function');
  const unaccounted = actual.filter((m) => !(m in GATED) && !FLOOR.includes(m));
  assert.deepEqual(unaccounted, [], 'decide a level for these: ' + unaccounted.join(', '));
  const phantom = [...Object.keys(GATED), ...FLOOR].filter((m) => !actual.includes(m));
  assert.deepEqual(phantom, [], 'the tables name handlers that do not exist: ' + phantom.join(', '));
});

const guardWith = (map: Record<string, number>) =>
  new PermissionsGuard(new Reflector(), { forRole: async () => map } as any);
const ctxFor = (method: string, role?: string): any => ({
  getHandler: () => handlerOf(method),
  getClass: () => FuelController,
  switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
});
const allows = (map: Record<string, number>, m: string, role: string) => guardWith(map).canActivate(ctxFor(m, role));

test('rentals:1 reads both routes and writes neither', async () => {
  for (const role of ['FINANCE_MANAGER', 'SALES', 'PRODUCTION_MANAGER', 'DRIVER']) {
    for (const m of FLOOR) assert.equal(await allows({ rentals: 1, finance: 3, production: 3 }, m, role), true, role + ' lost read ' + m);
    for (const m of Object.keys(GATED))
      await assert.rejects(() => allows({ rentals: 1, finance: 3, production: 3 }, m, role) as any, /rentals/, role + ' must not ' + m);
  }
});

test('a rentals:0 role is refused even the list — the floor is not open', async () => {
  for (const m of FLOOR)
    await assert.rejects(() => allows({ finance: 2, production: 2 }, m, 'ACCOUNTANT') as any, /rentals/, m + ' was reachable at rentals:0');
});

test('rentals:2 and above keep both writes', async () => {
  for (const [role, map] of [['RENTAL_COORDINATOR', { rentals: 2 }], ['MAINTENANCE', { rentals: 2 }], ['RENTAL_MANAGER', { rentals: 3 }]] as const)
    for (const m of Object.keys(GATED)) assert.equal(await allows(map as any, m, role), true, role + ' lost ' + m);
});

test('an unauthenticated request is refused before the map is consulted', async () => {
  await assert.rejects(() => allows({ rentals: 3 }, 'delete', undefined as any) as any, /Not authenticated/);
});

/**
 * THE LIMIT OF THIS COMMIT, WRITTEN DOWN. A production:2 / rentals:0 role — PRODUCTION_COORDINATOR
 * on the live matrix, which has an account — is refused here and still reaches the same fuelLog rows
 * through logistics/transport (POST fuel, DELETE fuel/:id at production:2, removeFuel unscoped).
 * This test asserts only the half this controller owns; it exists so the other half is not mistaken
 * for covered. Closing it is a production-module change and needs its own ruling.
 */
test('LIMIT: refusing production:2 here does not fence the rows — the transport door is untouched', async () => {
  await assert.rejects(() => allows({ production: 2 }, 'delete', 'PRODUCTION_COORDINATOR') as any, /rentals/,
    'this door refuses production:2; logistics/transport DELETE fuel/:id still admits it');
});

test('NEGATIVE CONTROL — the OLD shape (no requirement) let any role hard-delete a fuel log', async () => {
  class OldFuelController { delete() { return null; } }
  const ctx: any = {
    getHandler: () => OldFuelController.prototype.delete,
    getClass: () => OldFuelController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CREW' } }) }),
  };
  assert.equal(await guardWith({}).canActivate(ctx), true, 'this is the defect: an unruled route passes');
  await assert.rejects(() => allows({}, 'delete', 'CREW') as any, /rentals/);
});

test('NEGATIVE CONTROL — a handler override at rentals:1 would reopen the hard delete', async () => {
  class Overridden { delete() { return null; } }
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden);
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden.prototype.delete);
  const ctx: any = {
    getHandler: () => Overridden.prototype.delete,
    getClass: () => Overridden,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'SALES' } }) }),
  };
  assert.equal(await guardWith({ rentals: 1 }).canActivate(ctx), true,
    'a handler override wins over the class — which is why the override test above matters');
  await assert.rejects(() => allows({ rentals: 1 }, 'delete', 'SALES') as any, /rentals/);
});
