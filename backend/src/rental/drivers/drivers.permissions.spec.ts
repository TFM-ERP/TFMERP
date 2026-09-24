/**
 * THE EXACT FAILURE THIS CATCHES: seventeen routes behind JwtAuthGuard alone — including five that
 * move money. Any authenticated user of any role could create a driver, rewrite their licence and
 * IBAN, generate a freelancer invoice, and approve and pay a payout into a posted expense.
 *
 * But the claim this spec really exists to defend is the SPLIT. @RequirePermission takes one
 * {module, level}, so "rentals AND finance" is not expressible, and the easy design — all five
 * money routes at rentals:3 — would let RENTAL_MANAGER assemble a payout and then approve and pay
 * it alone, holding finance:1. The ruling therefore cuts between assembling and committing:
 *
 *   rentals:3  generateInvoice, createPayout          (assemble a claim from completed jobs)
 *   finance:3  pushPayroll, approvePayout, payPayout  (commit money — payroll run, posted expense)
 *
 * A spec that only checked each decorator's value would pass on the rejected design too. So the
 * segregation is asserted as BEHAVIOUR, both ways round, and the last control shows the rejected
 * design failing.
 *
 * The class carries a rentals:1 FLOOR rather than nothing, so a route added here later arrives
 * gated at view instead of open. The guard resolves getAllAndOverride([handler, class])
 * (permissions.guard.ts:11-14), so every decorator below REPLACES the floor for its own route —
 * which is how a finance key can sit on a controller whose floor is a rentals key.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { DriversController } from './drivers.controller';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { PERM_KEY } from '../../permissions/require-permission.decorator';

const reflector = new Reflector();
const handlerOf = (m: string) => (DriversController.prototype as any)[m];
const perm = (m: string) => reflector.get<{ module: string; level: number }>(PERM_KEY, handlerOf(m));
const classGuards = (): any[] => Reflect.getMetadata('__guards__', DriversController) || [];

/** The ruling, as data. Every handler must appear in exactly one of these two tables. */
const GATED: Record<string, { module: string; level: number }> = {
  create: { module: 'rentals', level: 2 },
  update: { module: 'rentals', level: 2 },
  createJob: { module: 'rentals', level: 2 },
  updateJobStatus: { module: 'rentals', level: 2 },
  updateJob: { module: 'rentals', level: 2 },
  generateInvoice: { module: 'rentals', level: 3 },
  createPayout: { module: 'rentals', level: 3 },
  pushPayroll: { module: 'finance', level: 3 },
  approvePayout: { module: 'finance', level: 3 },
  payPayout: { module: 'finance', level: 3 },
};

/** Reads. They carry NO decorator and sit on the class floor — which is rentals:1, not open. */
const FLOOR = ['findAll', 'expiryAlerts', 'findOne', 'getPerformance', 'jobsByBooking', 'unbilledJobs', 'listPayouts'];

test('the class runs BOTH guards — JwtAuthGuard alone is the defect', () => {
  const names = classGuards().map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
  assert.ok(names.includes('PermissionsGuard'), 'PermissionsGuard is not in the class guard chain: ' + names.join(', '));
  assert.ok(names.includes('JwtAuthGuard'), 'JwtAuthGuard must stay: ' + names.join(', '));
});

test('the class carries a rentals:1 FLOOR — nothing here is open', () => {
  assert.deepEqual(reflector.get(PERM_KEY, DriversController), { module: 'rentals', level: 1 });
});

test('every GATED handler carries its exact module and level', () => {
  for (const [m, expected] of Object.entries(GATED)) assert.deepEqual(perm(m), expected, m);
});

test('every READ carries NO override, so it sits on the floor', () => {
  for (const m of FLOOR) assert.equal(perm(m), undefined, m + ' must inherit the class floor');
});

test('NO HANDLER IS UNACCOUNTED FOR — a route added later cannot arrive unruled', () => {
  const actual = Object.getOwnPropertyNames(DriversController.prototype)
    .filter((m) => m !== 'constructor' && typeof handlerOf(m) === 'function');
  const unaccounted = actual.filter((m) => !(m in GATED) && !FLOOR.includes(m));
  assert.deepEqual(unaccounted, [], 'decide a level for these, or list them as floor reads: ' + unaccounted.join(', '));
  const phantom = [...Object.keys(GATED), ...FLOOR].filter((m) => !actual.includes(m));
  assert.deepEqual(phantom, [], 'the tables name handlers the controller does not have: ' + phantom.join(', '));
});

// ── the guard's real resolution path ──────────────────────────────────────────────────────────

const guardWith = (map: Record<string, number>) =>
  new PermissionsGuard(new Reflector(), { forRole: async () => map } as any);
const ctxFor = (method: string, role?: string): any => ({
  getHandler: () => handlerOf(method),
  getClass: () => DriversController,
  switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
});
const allows = (map: Record<string, number>, m: string, role: string) =>
  guardWith(map).canActivate(ctxFor(m, role));

// The two live maps this whole ruling turns on.
const RENTAL_MANAGER = { rentals: 3, finance: 1, setup: 1, production: 1, hr: 1 };
const FINANCE_MANAGER = { rentals: 1, finance: 3, setup: 1, production: 1, hr: 1 };

/**
 * THE SEGREGATION, STATED AS BEHAVIOUR. This is the pair of tests the commit exists for; the
 * rejected design (all five at rentals:3) passes every decorator-value test above and fails this.
 */
test('RENTAL_MANAGER assembles a payout but may NOT approve or pay it', async () => {
  assert.equal(await allows(RENTAL_MANAGER, 'createPayout', 'RENTAL_MANAGER'), true, 'must keep assembling');
  assert.equal(await allows(RENTAL_MANAGER, 'generateInvoice', 'RENTAL_MANAGER'), true, 'must keep invoicing');
  for (const m of ['pushPayroll', 'approvePayout', 'payPayout'])
    await assert.rejects(() => allows(RENTAL_MANAGER, m, 'RENTAL_MANAGER') as any, /finance/,
      'RENTAL_MANAGER (finance:1) must not be able to ' + m);
});

test('FINANCE_MANAGER commits the money but may NOT assemble the claim', async () => {
  for (const m of ['pushPayroll', 'approvePayout', 'payPayout'])
    assert.equal(await allows(FINANCE_MANAGER, m, 'FINANCE_MANAGER'), true, 'FINANCE_MANAGER must be able to ' + m);
  for (const m of ['createPayout', 'generateInvoice'])
    await assert.rejects(() => allows(FINANCE_MANAGER, m, 'FINANCE_MANAGER') as any, /rentals/,
      'FINANCE_MANAGER (rentals:1) must not be able to ' + m);
});

test('no single live role holds BOTH halves except SYSTEM_ADMIN', async () => {
  const ASSEMBLE = ['createPayout', 'generateInvoice'];
  const COMMIT = ['pushPayroll', 'approvePayout', 'payPayout'];
  const LIVE: Record<string, Record<string, number>> = {
    RENTAL_MANAGER, FINANCE_MANAGER,
    RENTAL_COORDINATOR: { rentals: 2 }, DISPATCHER: { rentals: 2 }, MAINTENANCE: { rentals: 2 },
    DRIVER: { rentals: 1 }, SALES: { rentals: 1, finance: 2 }, ACCOUNTANT: { finance: 2 },
    PRODUCTION_MANAGER: { rentals: 1, finance: 1 }, CREW: {},
  };
  const can = async (map: any, m: string, role: string) => allows(map, m, role).then(() => true, () => false);
  for (const [role, map] of Object.entries(LIVE)) {
    const assembles = (await Promise.all(ASSEMBLE.map((m) => can(map, m, role)))).some(Boolean);
    const commits = (await Promise.all(COMMIT.map((m) => can(map, m, role)))).some(Boolean);
    assert.equal(assembles && commits, false, role + ' holds both halves of the payout chain');
  }
  // And the check is not vacuous: SYSTEM_ADMIN does hold both, by design.
  const admin = { rentals: 3, finance: 3 };
  assert.equal(await can(admin, 'createPayout', 'SYSTEM_ADMIN') && await can(admin, 'payPayout', 'SYSTEM_ADMIN'), true);
});

// ── the rest of the controller ────────────────────────────────────────────────────────────────

test('DRIVER (rentals:1) gets no write — its own job routes included', async () => {
  for (const m of ['updateJobStatus', 'updateJob', 'create', 'update'])
    await assert.rejects(() => allows({ rentals: 1 }, m, 'DRIVER') as any, /rentals/, 'DRIVER must not write ' + m + ' yet');
});

/**
 * KNOWN RESIDUAL — FINDING C. THIS TEST PINS WHAT IS, NOT WHAT SHOULD BE.
 *
 * rentals:1 is a read of EVERY driver row, and findAll returns them whole — drivers.service.ts:145
 * issues findMany with no `select`, so every scalar column comes back: Emirates ID and its expiry,
 * passport number and expiry, visa expiry, licence number, bank name, account number, IBAN, and the
 * daily and weekly rate. DRIVER sits at rentals:1, so the day a driver is given a login they can
 * read every other driver's identity documents, bank details and pay — and FINANCE_MANAGER,
 * PRODUCTION_MANAGER and SALES already can.
 *
 * A level cannot fix that: @RequirePermission cannot express "your own row", so narrowing it means
 * a service-level select or a row scope, which is a different change with its own ruling. The
 * service is deliberately NOT touched here. What makes the residual tolerable today is the standing
 * rule that no driver gets a login until row-scoped self-service lands.
 *
 * The test exists so the reach is written down and any change to it is deliberate rather than
 * accidental. If a later commit narrows these reads, this test is SUPPOSED to go red.
 */
test('RESIDUAL (finding C): rentals:1 still reads every driver row whole — pinned, not endorsed', async () => {
  for (const m of FLOOR)
    assert.equal(await allows({ rentals: 1 }, m, 'DRIVER'), true,
      m + ' is no longer reachable at rentals:1 — if that was deliberate, finding C moved and this test should be rewritten, not deleted');
});

test('a rentals:0 role is refused even the reads — the floor is not open', async () => {
  for (const m of FLOOR)
    await assert.rejects(() => allows({ finance: 2 }, m, 'ACCOUNTANT') as any, /rentals/, m + ' was reachable at rentals:0');
});

test('RENTAL_COORDINATOR / DISPATCHER / MAINTENANCE (rentals:2) keep the ordinary writes', async () => {
  for (const role of ['RENTAL_COORDINATOR', 'DISPATCHER', 'MAINTENANCE'])
    for (const m of ['create', 'update', 'createJob', 'updateJobStatus', 'updateJob'])
      assert.equal(await allows({ rentals: 2 }, m, role), true, role + ' lost ' + m);
});

test('— but rentals:2 stops short of every money route', async () => {
  for (const m of Object.keys(GATED).filter((k) => GATED[k].level === 3))
    await assert.rejects(() => allows({ rentals: 2 }, m, 'DISPATCHER') as any, /rentals|finance/, m);
});

test('an unauthenticated request is refused before the map is consulted', async () => {
  await assert.rejects(() => allows({ finance: 3 }, 'payPayout', undefined as any) as any, /Not authenticated/);
});

// ── controls ──────────────────────────────────────────────────────────────────────────────────

test('NEGATIVE CONTROL — the OLD shape (no requirement anywhere) let any role pay a payout', async () => {
  class OldDriversController { payPayout() { return null; } }
  const ctx: any = {
    getHandler: () => OldDriversController.prototype.payPayout,
    getClass: () => OldDriversController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CREW' } }) }),
  };
  assert.equal(await guardWith({}).canActivate(ctx), true, 'this is the defect: an unruled route passes');
  await assert.rejects(() => allows({}, 'payPayout', 'CREW') as any, /finance/);
});

/**
 * THE CONTROL FOR THE SPLIT ITSELF. The rejected design — all five money routes at rentals:3 —
 * satisfies every "does the decorator say what the table says" test, and hands one role the whole
 * chain. Built by hand so its failure is visible rather than argued.
 */
test('NEGATIVE CONTROL — all five at rentals:3 would let RENTAL_MANAGER pay its own payout', async () => {
  class AllRentals { createPayout() { return null; } payPayout() { return null; } }
  for (const m of ['createPayout', 'payPayout'])
    Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 3 }, (AllRentals.prototype as any)[m]);
  const ctx = (m: string): any => ({
    getHandler: () => (AllRentals.prototype as any)[m],
    getClass: () => AllRentals,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'RENTAL_MANAGER' } }) }),
  });
  const g = guardWith(RENTAL_MANAGER);
  assert.equal(await g.canActivate(ctx('createPayout')), true);
  assert.equal(await g.canActivate(ctx('payPayout')), true,
    'the rejected design gives one role both halves — which is why the split exists');
  // The controller as ruled refuses the same role the same act.
  await assert.rejects(() => allows(RENTAL_MANAGER, 'payPayout', 'RENTAL_MANAGER') as any, /finance/);
});
