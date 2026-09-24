/**
 * THE EXACT FAILURE THIS CATCHES: the fleet asset register behind JwtAuthGuard alone. Any
 * authenticated user of any role could add an asset, rewrite its registration and insurance, or
 * flip its status — including flipping a unit to AVAILABLE while it sits in maintenance, which is
 * what logistics' dispatch check reads.
 *
 * Floor rentals:1 on the class rather than nothing, so a route added here later arrives gated at
 * view instead of open; the three writes override to rentals:2. The guard resolves
 * getAllAndOverride([handler, class]) (permissions.guard.ts:11-14), so a handler decorator replaces
 * the floor — in either direction, which is the failure mode the override test below exists for.
 *
 * THE FLOOR HAS A KNOWN COST, ASSERTED HERE SO IT IS NOT DISCOVERED LATER. GET /rental/assets is
 * read by LineItemsEditor.tsx:66 on four finance screens. ACCOUNTANT holds finance:2 and rentals:0
 * and therefore loses it. That is the ruling, not an oversight — the test named for it pins the
 * consequence so nobody "fixes" it by quietly opening the read.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { AssetsController } from './assets.controller';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { PERM_KEY } from '../../permissions/require-permission.decorator';

const reflector = new Reflector();
const handlerOf = (m: string) => (AssetsController.prototype as any)[m];
const perm = (m: string) => reflector.get<{ module: string; level: number }>(PERM_KEY, handlerOf(m));
const classGuards = (): any[] => Reflect.getMetadata('__guards__', AssetsController) || [];

const GATED: Record<string, { module: string; level: number }> = {
  create: { module: 'rentals', level: 2 },
  update: { module: 'rentals', level: 2 },
  updateStatus: { module: 'rentals', level: 2 },
};
const FLOOR = ['findAll', 'expiryAlerts', 'utilization', 'findOne', 'checkAvailability'];

test('the class runs BOTH guards — JwtAuthGuard alone is the defect', () => {
  const names = classGuards().map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
  assert.ok(names.includes('PermissionsGuard'), 'PermissionsGuard missing: ' + names.join(', '));
  assert.ok(names.includes('JwtAuthGuard'), 'JwtAuthGuard must stay: ' + names.join(', '));
});

test('the class carries a rentals:1 FLOOR — nothing here is open', () => {
  assert.deepEqual(reflector.get(PERM_KEY, AssetsController), { module: 'rentals', level: 1 });
});

test('every WRITE carries rentals:2', () => {
  for (const [m, expected] of Object.entries(GATED)) assert.deepEqual(perm(m), expected, m);
});

test('every READ carries NO override, so it sits on the floor', () => {
  for (const m of FLOOR) assert.equal(perm(m), undefined, m + ' must inherit the class floor');
});

test('NO HANDLER IS UNACCOUNTED FOR — a route added later cannot arrive unruled', () => {
  const actual = Object.getOwnPropertyNames(AssetsController.prototype)
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
  getClass: () => AssetsController,
  switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
});
const allows = (map: Record<string, number>, m: string, role: string) => guardWith(map).canActivate(ctxFor(m, role));

test('rentals:1 reads but cannot write — FINANCE_MANAGER, SALES, PRODUCTION_MANAGER, DRIVER', async () => {
  for (const role of ['FINANCE_MANAGER', 'SALES', 'PRODUCTION_MANAGER', 'DRIVER']) {
    for (const m of FLOOR) assert.equal(await allows({ rentals: 1, finance: 3 }, m, role), true, role + ' lost read ' + m);
    for (const m of Object.keys(GATED))
      await assert.rejects(() => allows({ rentals: 1, finance: 3 }, m, role) as any, /rentals/, role + ' must not ' + m);
  }
});

test('rentals:2 and above keep the writes', async () => {
  for (const [role, map] of [['DISPATCHER', { rentals: 2 }], ['MAINTENANCE', { rentals: 2 }], ['RENTAL_MANAGER', { rentals: 3 }]] as const)
    for (const m of Object.keys(GATED)) assert.equal(await allows(map as any, m, role), true, role + ' lost ' + m);
});

/**
 * THE RULED COST, PINNED. ACCOUNTANT is finance:2 / rentals:0, so it loses the asset list that
 * LineItemsEditor puts on four finance screens. If this ever goes green-to-red because someone
 * opened the read, that is a ruling change and should be made deliberately — not by deleting this.
 */
test('RULED COST: ACCOUNTANT (finance:2, rentals:0) loses the asset list the invoice editor reads', async () => {
  await assert.rejects(() => allows({ finance: 2 }, 'findAll', 'ACCOUNTANT') as any, /rentals/,
    'if this now passes, GET /rental/assets was opened — a ruling change, not a bug fix');
});

test('an unauthenticated request is refused before the map is consulted', async () => {
  await assert.rejects(() => allows({ rentals: 3 }, 'create', undefined as any) as any, /Not authenticated/);
});

test('NEGATIVE CONTROL — the OLD shape (no requirement) let any role re-status a unit', async () => {
  class OldAssetsController { updateStatus() { return null; } }
  const ctx: any = {
    getHandler: () => OldAssetsController.prototype.updateStatus,
    getClass: () => OldAssetsController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CREW' } }) }),
  };
  assert.equal(await guardWith({}).canActivate(ctx), true, 'this is the defect: an unruled route passes');
  await assert.rejects(() => allows({}, 'updateStatus', 'CREW') as any, /rentals/);
});

test('NEGATIVE CONTROL — a handler override at rentals:1 would reopen a write', async () => {
  class Overridden { update() { return null; } }
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden);
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden.prototype.update);
  const ctx: any = {
    getHandler: () => Overridden.prototype.update,
    getClass: () => Overridden,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'SALES' } }) }),
  };
  assert.equal(await guardWith({ rentals: 1 }).canActivate(ctx), true,
    'a handler override wins over the class — which is why the override test above matters');
  await assert.rejects(() => allows({ rentals: 1 }, 'update', 'SALES') as any, /rentals/);
});
