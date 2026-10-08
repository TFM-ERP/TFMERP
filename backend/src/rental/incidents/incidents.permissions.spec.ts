/**
 * THE EXACT FAILURE THIS CATCHES: the incident log behind JwtAuthGuard alone. Any authenticated
 * user of any role could file an incident against a named driver or a unit, edit it, resolve it
 * with a cost attached, or move it through the status machine.
 *
 * Floor rentals:1 on the class rather than nothing, so a route added here later arrives gated at
 * view instead of open; the four writes override to rentals:2. The guard resolves
 * getAllAndOverride([handler, class]) (permissions.guard.ts:11-14), so a handler decorator replaces
 * the floor in either direction — the failure mode the override control at the bottom is for.
 *
 * POST /rental/incidents IS THE DRIVER PWA'S ROUTE TOO (app/driver/page.tsx:247). rentals:2 is the
 * ruled lock-now level for every driver-surface write, and DRIVER sits at rentals:1, so no driver
 * reaches it — correct today only because no driver has a login. The test naming DRIVER states that
 * as the current intent, not as a permanent one.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { IncidentsController } from './incidents.controller';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { PERM_KEY } from '../../permissions/require-permission.decorator';

const reflector = new Reflector();
const handlerOf = (m: string) => (IncidentsController.prototype as any)[m];
const perm = (m: string) => reflector.get<{ module: string; level: number }>(PERM_KEY, handlerOf(m));
const classGuards = (): any[] => Reflect.getMetadata('__guards__', IncidentsController) || [];

const GATED: Record<string, { module: string; level: number }> = {
  create: { module: 'rentals', level: 2 },
  update: { module: 'rentals', level: 2 },
  resolve: { module: 'rentals', level: 2 },
  updateStatus: { module: 'rentals', level: 2 },
};
const FLOOR = ['findAll', 'summary', 'findOne'];

test('the class runs BOTH guards — JwtAuthGuard alone is the defect', () => {
  const names = classGuards().map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
  assert.ok(names.includes('PermissionsGuard'), 'PermissionsGuard missing: ' + names.join(', '));
  assert.ok(names.includes('JwtAuthGuard'), 'JwtAuthGuard must stay: ' + names.join(', '));
});

test('the class carries a rentals:1 FLOOR — nothing here is open', () => {
  assert.deepEqual(reflector.get(PERM_KEY, IncidentsController), { module: 'rentals', level: 1 });
});

test('every WRITE carries rentals:2', () => {
  for (const [m, expected] of Object.entries(GATED)) assert.deepEqual(perm(m), expected, m);
});

test('every READ carries NO override, so it sits on the floor', () => {
  for (const m of FLOOR) assert.equal(perm(m), undefined, m + ' must inherit the class floor');
});

test('NO HANDLER IS UNACCOUNTED FOR — a route added later cannot arrive unruled', () => {
  const actual = Object.getOwnPropertyNames(IncidentsController.prototype)
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
  getClass: () => IncidentsController,
  switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
});
const allows = (map: Record<string, number>, m: string, role: string) => guardWith(map).canActivate(ctxFor(m, role));

test('rentals:1 reads everything and writes nothing', async () => {
  for (const role of ['FINANCE_MANAGER', 'SALES', 'PRODUCTION_MANAGER']) {
    for (const m of FLOOR) assert.equal(await allows({ rentals: 1, finance: 3 }, m, role), true, role + ' lost read ' + m);
    for (const m of Object.keys(GATED))
      await assert.rejects(() => allows({ rentals: 1, finance: 3 }, m, role) as any, /rentals/, role + ' must not ' + m);
  }
});

/**
 * The driver PWA files incidents through POST /rental/incidents. DRIVER is rentals:1, so it is
 * refused — the lock-now level, correct while no driver has a login. When row-scoped self-service
 * lands this test is SUPPOSED to change; it is here so that change is deliberate.
 */
test('DRIVER (rentals:1) cannot file an incident — the lock-now level, not a permanent one', async () => {
  await assert.rejects(() => allows({ rentals: 1 }, 'create', 'DRIVER') as any, /rentals/,
    'if a driver can file again, row-scoped self-service landed and this test should be rewritten, not deleted');
});

test('a rentals:0 role is refused even the list — the floor is not open', async () => {
  for (const m of FLOOR)
    await assert.rejects(() => allows({ finance: 2 }, m, 'ACCOUNTANT') as any, /rentals/, m + ' was reachable at rentals:0');
});

test('rentals:2 and above keep every write', async () => {
  for (const [role, map] of [['RENTAL_COORDINATOR', { rentals: 2 }], ['MAINTENANCE', { rentals: 2 }], ['RENTAL_MANAGER', { rentals: 3 }]] as const)
    for (const m of Object.keys(GATED)) assert.equal(await allows(map as any, m, role), true, role + ' lost ' + m);
});

test('an unauthenticated request is refused before the map is consulted', async () => {
  await assert.rejects(() => allows({ rentals: 3 }, 'resolve', undefined as any) as any, /Not authenticated/);
});

test('NEGATIVE CONTROL — the OLD shape (no requirement) let any role resolve an incident', async () => {
  class OldIncidentsController { resolve() { return null; } }
  const ctx: any = {
    getHandler: () => OldIncidentsController.prototype.resolve,
    getClass: () => OldIncidentsController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CREW' } }) }),
  };
  assert.equal(await guardWith({}).canActivate(ctx), true, 'this is the defect: an unruled route passes');
  await assert.rejects(() => allows({}, 'resolve', 'CREW') as any, /rentals/);
});

test('NEGATIVE CONTROL — a handler override at rentals:1 would reopen resolve', async () => {
  class Overridden { resolve() { return null; } }
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden);
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden.prototype.resolve);
  const ctx: any = {
    getHandler: () => Overridden.prototype.resolve,
    getClass: () => Overridden,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'SALES' } }) }),
  };
  assert.equal(await guardWith({ rentals: 1 }).canActivate(ctx), true,
    'a handler override wins over the class — which is why the override test above matters');
  await assert.rejects(() => allows({ rentals: 1 }, 'resolve', 'SALES') as any, /rentals/);
});
