/**
 * THE EXACT FAILURE THIS CATCHES: rental contracts behind JwtAuthGuard alone. Any authenticated user
 * of any role could raise a contract against a booking, edit its terms, or sign it — and sign() is a
 * two-entity write, moving the contract to SIGNED and the booking to CONTRACT_SIGNED in one
 * transaction (contracts.service.ts:110-119).
 *
 * Floor rentals:1 on the class rather than nothing, so a route added here later arrives gated at
 * view instead of open; create and update override to rentals:2, and sign to rentals:3 because it is
 * a cross-entity status change rather than a field edit.
 *
 * WHAT sign() DOES NOT DO, read rather than assumed: it verifies nobody. signedByName is a plain
 * string off the request body — no signature capture, no identity binding, no check that the caller
 * is the signatory. It records an assertion that a named person signed; it does not evidence it. So
 * rentals:3 is a level on a state transition, not an e-signature control.
 *
 * TWO THINGS rentals:3 DOES NOT FENCE, both pinned by LIMIT tests at the bottom:
 *
 *   1. THE SIGNATURE FIELDS. update() writes signedAt and signedByName (:98-99) and create() accepts
 *      both (:76-77), and both sit at rentals:2. Only sign sets the contract's status to SIGNED.
 *
 *   2. THE BOOKING'S CONTRACT_SIGNED STATE. ALLOWED_TRANSITIONS (bookings.service.ts:10) permits
 *      CONTRACT_SENT -> CONTRACT_SIGNED, and bookings updateStatus (:322-331) checks only that table
 *      — it never looks for a contract, signed or otherwise. That is PATCH /rental/bookings/:id/status
 *      at rentals:2, also reached from the Workflow board via statusApi. So rentals:3 here gates the
 *      CONTRACT's signed state, not the BOOKING's; and with no contract page in existence, the status
 *      route is in practice the only way a booking reaches CONTRACT_SIGNED today. Finding F — closing
 *      it is a ruling, not a default.
 *
 * NOTHING CALLS ANY OF THIS. rentalApi.contracts (lib/api.ts:216-221) has no call site anywhere in
 * the frontend and there is no rental/contracts page. That is why gating is free here — and why it
 * matters: five routes reachable by any authenticated account with no screen that would show it.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { ContractsController } from './contracts.controller';
import { BookingsController } from '../bookings/bookings.controller';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { PERM_KEY } from '../../permissions/require-permission.decorator';

const reflector = new Reflector();
const handlerOf = (m: string) => (ContractsController.prototype as any)[m];
const perm = (m: string) => reflector.get<{ module: string; level: number }>(PERM_KEY, handlerOf(m));
const classGuards = (): any[] => Reflect.getMetadata('__guards__', ContractsController) || [];

const GATED: Record<string, { module: string; level: number }> = {
  create: { module: 'rentals', level: 2 },
  update: { module: 'rentals', level: 2 },
  sign: { module: 'rentals', level: 3 },
};
const FLOOR = ['findAll', 'findOne'];

test('the class runs BOTH guards — JwtAuthGuard alone is the defect', () => {
  const names = classGuards().map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
  assert.ok(names.includes('PermissionsGuard'), 'PermissionsGuard missing: ' + names.join(', '));
  assert.ok(names.includes('JwtAuthGuard'), 'JwtAuthGuard must stay: ' + names.join(', '));
});

test('the class carries a rentals:1 FLOOR — nothing here is open', () => {
  assert.deepEqual(reflector.get(PERM_KEY, ContractsController), { module: 'rentals', level: 1 });
});

test('create and update are rentals:2 — and SIGN is a level above them', () => {
  for (const [m, expected] of Object.entries(GATED)) assert.deepEqual(perm(m), expected, m);
  assert.ok(perm('sign').level > perm('update').level, 'sign must sit above the ordinary writes');
});

test('every READ carries NO override, so it sits on the floor', () => {
  for (const m of FLOOR) assert.equal(perm(m), undefined, m + ' must inherit the class floor');
});

test('NO HANDLER IS UNACCOUNTED FOR — a route added later cannot arrive unruled', () => {
  const actual = Object.getOwnPropertyNames(ContractsController.prototype)
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
  getClass: () => ContractsController,
  switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
});
const allows = (map: Record<string, number>, m: string, role: string) => guardWith(map).canActivate(ctxFor(m, role));

test('rentals:1 reads both routes and writes nothing', async () => {
  for (const role of ['FINANCE_MANAGER', 'SALES', 'PRODUCTION_MANAGER', 'DRIVER']) {
    for (const m of FLOOR) assert.equal(await allows({ rentals: 1, finance: 3 }, m, role), true, role + ' lost read ' + m);
    for (const m of Object.keys(GATED))
      await assert.rejects(() => allows({ rentals: 1, finance: 3 }, m, role) as any, /rentals/, role + ' must not ' + m);
  }
});

/**
 * The point of putting sign a level up: the roles that draft a contract cannot mark THAT CONTRACT
 * signed. RENTAL_COORDINATOR, DISPATCHER and MAINTENANCE all hold rentals:2. It does not stop them
 * advancing the booking — see the finding F test below.
 */
test('rentals:2 drafts and edits but may NOT sign the contract', async () => {
  for (const role of ['RENTAL_COORDINATOR', 'DISPATCHER', 'MAINTENANCE']) {
    for (const m of ['create', 'update']) assert.equal(await allows({ rentals: 2 }, m, role), true, role + ' lost ' + m);
    await assert.rejects(() => allows({ rentals: 2 }, 'sign', role) as any, /rentals/, role + ' must not sign');
  }
});

test('rentals:3 signs — RENTAL_MANAGER and SYSTEM_ADMIN', async () => {
  for (const role of ['RENTAL_MANAGER', 'SYSTEM_ADMIN'])
    assert.equal(await allows({ rentals: 3 }, 'sign', role), true, role + ' must be able to sign');
});

test('a rentals:0 role is refused even the list — the floor is not open', async () => {
  for (const m of FLOOR)
    await assert.rejects(() => allows({ finance: 2 }, m, 'ACCOUNTANT') as any, /rentals/, m + ' was reachable at rentals:0');
});

test('an unauthenticated request is refused before the map is consulted', async () => {
  await assert.rejects(() => allows({ rentals: 3 }, 'sign', undefined as any) as any, /Not authenticated/);
});

/**
 * THE LIMIT OF rentals:3, WRITTEN DOWN. update() writes signedAt and signedByName at rentals:2, so a
 * level on sign does not stop a rentals:2 holder recording a signer name and date on a DRAFT
 * contract. What rentals:3 protects is the transition — status SIGNED and the booking moving to
 * CONTRACT_SIGNED. This asserts only the half the level owns.
 */
test('LIMIT 1: rentals:3 does not fence the signature fields — update still writes them', async () => {
  assert.equal(await allows({ rentals: 2 }, 'update', 'RENTAL_COORDINATOR'), true,
    'update is rentals:2 and contracts.service.ts:98-99 writes signedAt and signedByName through it');
  await assert.rejects(() => allows({ rentals: 2 }, 'sign', 'RENTAL_COORDINATOR') as any, /rentals/,
    "only the contract's own SIGNED status is fenced");
});

/**
 * LIMIT 2 — FINDING F. The booking has its own door to CONTRACT_SIGNED and it is a level lower.
 * ALLOWED_TRANSITIONS (bookings.service.ts:10) permits CONTRACT_SENT -> CONTRACT_SIGNED, and
 * bookings updateStatus (:322-331) validates only that table: it never looks for a contract. So
 * rentals:3 here protects the CONTRACT row, not the booking's state, and with no contract page in
 * existence the status route is in practice the only way a booking reaches CONTRACT_SIGNED at all.
 *
 * This reads the OTHER controller's decorator rather than restating it, so the two levels cannot
 * drift apart silently. If the booking status route is ever raised to rentals:3, this test goes red
 * and should be rewritten to record that finding F was closed — not deleted.
 */
test('LIMIT 2 (finding F): the BOOKING reaches CONTRACT_SIGNED at rentals:2, a level below sign', async () => {
  const signPerm = perm('sign');
  const bookingStatusPerm = reflector.get<{ module: string; level: number }>(
    PERM_KEY, (BookingsController.prototype as any).updateStatus);
  assert.deepEqual(signPerm, { module: 'rentals', level: 3 });
  assert.deepEqual(bookingStatusPerm, { module: 'rentals', level: 2 },
    'PATCH /rental/bookings/:id/status is the booking\'s own door to CONTRACT_SIGNED');
  assert.ok(bookingStatusPerm.level < signPerm.level,
    'the gap: the booking can be advanced a level below what signing the contract costs');

  // And as behaviour: the same role this controller refuses is admitted by that route.
  const bookingCtx = (role: string): any => ({
    getHandler: () => (BookingsController.prototype as any).updateStatus,
    getClass: () => BookingsController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  });
  await assert.rejects(() => allows({ rentals: 2 }, 'sign', 'DISPATCHER') as any, /rentals/,
    'refused here');
  assert.equal(await guardWith({ rentals: 2 }).canActivate(bookingCtx('DISPATCHER')), true,
    'and admitted there — no contract is consulted on that path');
});

test('NEGATIVE CONTROL — the OLD shape (no requirement) let any role sign a contract', async () => {
  class OldContractsController { sign() { return null; } }
  const ctx: any = {
    getHandler: () => OldContractsController.prototype.sign,
    getClass: () => OldContractsController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CREW' } }) }),
  };
  assert.equal(await guardWith({}).canActivate(ctx), true, 'this is the defect: an unruled route passes');
  await assert.rejects(() => allows({}, 'sign', 'CREW') as any, /rentals/);
});

test('NEGATIVE CONTROL — sign at rentals:2 would let the drafting roles mark a contract signed', async () => {
  class Overridden { sign() { return null; } }
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden);
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 2 }, Overridden.prototype.sign);
  const ctx: any = {
    getHandler: () => Overridden.prototype.sign,
    getClass: () => Overridden,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'DISPATCHER' } }) }),
  };
  assert.equal(await guardWith({ rentals: 2 }).canActivate(ctx), true,
    'at rentals:2 a dispatcher signs — which is what the level above exists to prevent');
  await assert.rejects(() => allows({ rentals: 2 }, 'sign', 'DISPATCHER') as any, /rentals/);
});
