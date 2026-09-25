/**
 * THE EXACT FAILURE THIS CATCHES: the hire book behind JwtAuthGuard alone. Any authenticated user
 * of any role could raise a booking, edit its dates and rates, advance it through the status
 * machine, and add, move or delete the sites a hire travels between.
 *
 * Floor rentals:1 on the class rather than nothing, so a route added here later arrives gated at
 * view instead of open; the six writes override to rentals:2. The guard resolves
 * getAllAndOverride([handler, class]) (permissions.guard.ts:11-14), so a handler decorator replaces
 * the floor — in either direction, which is what the override control at the bottom is for.
 *
 * check-conflicts IS A READ AND STAYS ON THE FLOOR. It is a POST only because it takes a body; the
 * service reads for overlaps and writes nothing. The booking form calls it while the user types, so
 * gating it at 2 would silently remove the double-booking warning for a rentals:1 reader while the
 * rest of the form still worked — a worse failure than refusing the save. The test below states
 * that as a requirement so nobody "tidies" it into the write group.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { BookingsController } from './bookings.controller';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { PERM_KEY } from '../../permissions/require-permission.decorator';

const reflector = new Reflector();
const handlerOf = (m: string) => (BookingsController.prototype as any)[m];
const perm = (m: string) => reflector.get<{ module: string; level: number }>(PERM_KEY, handlerOf(m));
const classGuards = (): any[] => Reflect.getMetadata('__guards__', BookingsController) || [];

const GATED: Record<string, { module: string; level: number }> = {
  create: { module: 'rentals', level: 2 },
  update: { module: 'rentals', level: 2 },
  updateStatus: { module: 'rentals', level: 2 },
  addLocation: { module: 'rentals', level: 2 },
  updateLocation: { module: 'rentals', level: 2 },
  removeLocation: { module: 'rentals', level: 2 },
};
const FLOOR = ['findAll', 'dashboard', 'calendar', 'timeline', 'utilization', 'checkConflicts', 'listLocations', 'findOne'];

test('the class runs BOTH guards — JwtAuthGuard alone is the defect', () => {
  const names = classGuards().map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
  assert.ok(names.includes('PermissionsGuard'), 'PermissionsGuard missing: ' + names.join(', '));
  assert.ok(names.includes('JwtAuthGuard'), 'JwtAuthGuard must stay: ' + names.join(', '));
});

test('the class carries a rentals:1 FLOOR — nothing here is open', () => {
  assert.deepEqual(reflector.get(PERM_KEY, BookingsController), { module: 'rentals', level: 1 });
});

test('every WRITE carries rentals:2 — the three location routes included', () => {
  for (const [m, expected] of Object.entries(GATED)) assert.deepEqual(perm(m), expected, m);
});

test('every READ carries NO override, so it sits on the floor', () => {
  for (const m of FLOOR) assert.equal(perm(m), undefined, m + ' must inherit the class floor');
});

test('NO HANDLER IS UNACCOUNTED FOR — a route added later cannot arrive unruled', () => {
  const actual = Object.getOwnPropertyNames(BookingsController.prototype)
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
  getClass: () => BookingsController,
  switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
});
const allows = (map: Record<string, number>, m: string, role: string) => guardWith(map).canActivate(ctxFor(m, role));

/**
 * check-conflicts is a POST that reads. It must pass at rentals:1 or the conflict warning silently
 * disappears from a form that otherwise still works.
 */
test('CONFLICT CHECK stays readable at rentals:1 — it is a POST, not a write', async () => {
  for (const role of ['FINANCE_MANAGER', 'SALES', 'PRODUCTION_MANAGER', 'DRIVER'])
    assert.equal(await allows({ rentals: 1 }, 'checkConflicts', role), true,
      role + ' lost the double-booking check; if that was deliberate it is a ruling change');
});

test('rentals:1 reads everything and writes nothing', async () => {
  for (const role of ['FINANCE_MANAGER', 'SALES', 'PRODUCTION_MANAGER']) {
    for (const m of FLOOR) assert.equal(await allows({ rentals: 1, finance: 3 }, m, role), true, role + ' lost read ' + m);
    for (const m of Object.keys(GATED))
      await assert.rejects(() => allows({ rentals: 1, finance: 3 }, m, role) as any, /rentals/, role + ' must not ' + m);
  }
});

test('a rentals:0 role is refused even the location list — the floor is not open', async () => {
  for (const m of ['findAll', 'listLocations', 'findOne'])
    await assert.rejects(() => allows({ finance: 2 }, m, 'ACCOUNTANT') as any, /rentals/, m + ' was reachable at rentals:0');
});

test('rentals:2 and above keep every write', async () => {
  for (const [role, map] of [['RENTAL_COORDINATOR', { rentals: 2 }], ['DISPATCHER', { rentals: 2 }], ['RENTAL_MANAGER', { rentals: 3 }]] as const)
    for (const m of Object.keys(GATED)) assert.equal(await allows(map as any, m, role), true, role + ' lost ' + m);
});

test('an unauthenticated request is refused before the map is consulted', async () => {
  await assert.rejects(() => allows({ rentals: 3 }, 'create', undefined as any) as any, /Not authenticated/);
});

test('NEGATIVE CONTROL — the OLD shape (no requirement) let any role advance a hire', async () => {
  class OldBookingsController { updateStatus() { return null; } }
  const ctx: any = {
    getHandler: () => OldBookingsController.prototype.updateStatus,
    getClass: () => OldBookingsController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CREW' } }) }),
  };
  assert.equal(await guardWith({}).canActivate(ctx), true, 'this is the defect: an unruled route passes');
  await assert.rejects(() => allows({}, 'updateStatus', 'CREW') as any, /rentals/);
});

test('NEGATIVE CONTROL — a handler override at rentals:1 would reopen a location write', async () => {
  class Overridden { removeLocation() { return null; } }
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden);
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden.prototype.removeLocation);
  const ctx: any = {
    getHandler: () => Overridden.prototype.removeLocation,
    getClass: () => Overridden,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'SALES' } }) }),
  };
  assert.equal(await guardWith({ rentals: 1 }).canActivate(ctx), true,
    'a handler override wins over the class — which is why the override test above matters');
  await assert.rejects(() => allows({ rentals: 1 }, 'removeLocation', 'SALES') as any, /rentals/);
});
