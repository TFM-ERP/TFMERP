/**
 * THE EXACT FAILURE THIS CATCHES: PATCH /driver-app/submissions/:id/review behind JwtAuthGuard alone.
 *
 * That route turns a driver's expense claim into a POSTED finance Expense — driver-app.service.ts
 * writes it with status 'APPROVED' and no second approver — and it was reachable by any
 * authenticated user of any role, holding no finance permission whatsoever. review() also never
 * compares the reviewer against the submitting driver, so it doubles as a self-approval path, and
 * pending() takes no user at all, so the whole claims queue was readable by anyone logged in.
 *
 * The lock is a CLASS-LEVEL rentals:2, so every route inherits it and a route added later arrives
 * locked rather than open. That design has one failure mode, and it is the one this spec is really
 * about: PermissionsGuard resolves getAllAndOverride([handler, class]) (permissions.guard.ts:11-14),
 * so ANY per-handler @RequirePermission OVERRIDES the class — including one that lowers it. A spec
 * that only asserted the class requirement would pass while a handler quietly sat at rentals:1.
 *
 * So both halves are stated: the class carries exactly {rentals, 2}, and NO handler carries its own.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { DriverAppController } from './driver-app.controller';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { PERM_KEY } from '../permissions/require-permission.decorator';

const reflector = new Reflector();

/** Nest stores @UseGuards under this key; read it rather than trusting the source text. */
const classGuards = (): any[] => Reflect.getMetadata('__guards__', DriverAppController) || [];

/** Every route on the controller. The completeness test below proves this list is not short. */
const HANDLERS = ['me', 'jobs', 'createSubmission', 'mySubmissions', 'pending', 'review'];

const handlerOf = (m: string) => (DriverAppController.prototype as any)[m];

test('the class runs BOTH guards — JwtAuthGuard alone is the defect', () => {
  const names = classGuards().map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
  assert.ok(names.includes('PermissionsGuard'), 'PermissionsGuard is not in the class guard chain: ' + names.join(', '));
  assert.ok(names.includes('JwtAuthGuard'), 'JwtAuthGuard must stay: ' + names.join(', '));
});

test('the CLASS carries exactly {rentals, 2}', () => {
  assert.deepEqual(reflector.get(PERM_KEY, DriverAppController), { module: 'rentals', level: 2 });
});

/**
 * THE ONE THAT MATTERS. A handler-level decorator overrides the class in EITHER direction, so an
 * override is how this lock would silently come undone. None may exist unless it is a deliberate,
 * asserted exception — and today there are none.
 */
test('NO HANDLER OVERRIDES THE CLASS — an override would win, including a lower one', () => {
  const overridden = HANDLERS.filter((m) => reflector.get(PERM_KEY, handlerOf(m)) !== undefined);
  assert.deepEqual(overridden, [],
    'these handlers carry their own requirement, which overrides the class lock: ' + overridden.join(', '));
});

test('NO HANDLER IS UNACCOUNTED FOR — a route added later must be listed here', () => {
  const actual = Object.getOwnPropertyNames(DriverAppController.prototype)
    .filter((m) => m !== 'constructor' && typeof handlerOf(m) === 'function');
  assert.deepEqual(actual.sort(), [...HANDLERS].sort(),
    'the controller routes and this spec have drifted apart');
});

/**
 * The guard's real resolution path, not just the metadata. The map comes from
 * PermissionsService.forRole(role) — the request carries the role, the service resolves what it may
 * do — so a stub stands in and this test touches no database.
 */
const guardWith = (map: Record<string, number>) =>
  new PermissionsGuard(new Reflector(), { forRole: async () => map } as any);
const ctxFor = (method: string, role?: string): any => ({
  getHandler: () => handlerOf(method),
  getClass: () => DriverAppController,
  switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
});

test('DRIVER (rentals:1) is refused EVERY route — reads included', async () => {
  const guard = guardWith({ rentals: 1, home: 1 });
  for (const m of HANDLERS) {
    await assert.rejects(() => guard.canActivate(ctxFor(m, 'DRIVER')) as any, (e: any) => {
      assert.equal(e.constructor.name, 'ForbiddenException', m);
      assert.match(String(e.message), /rentals/, m + ': the refusal must name the module');
      return true;
    }, m + ' did not refuse a rentals:1 role');
  }
});

test('the review route in particular refuses a role with no finance permission at all', async () => {
  // This is the route that writes a posted Expense. CREW holds rentals:0.
  await assert.rejects(() => guardWith({ home: 1 }).canActivate(ctxFor('review', 'CREW')) as any, /rentals/);
  // ACCOUNTANT holds finance:2 but rentals:0 — finance permission does not open this door either.
  await assert.rejects(() => guardWith({ finance: 2 }).canActivate(ctxFor('review', 'ACCOUNTANT')) as any, /rentals/);
});

test('the claims QUEUE is not readable by anyone logged in', async () => {
  await assert.rejects(() => guardWith({ rentals: 1 }).canActivate(ctxFor('pending', 'DRIVER')) as any, /rentals/);
  await assert.rejects(() => guardWith({}).canActivate(ctxFor('pending', 'CREW')) as any, /rentals/);
});

test('DISPATCHER, MAINTENANCE and RENTAL_COORDINATOR (rentals:2) keep every route', async () => {
  const guard = guardWith({ rentals: 2 });
  for (const role of ['DISPATCHER', 'MAINTENANCE', 'RENTAL_COORDINATOR'])
    for (const m of HANDLERS)
      assert.equal(await guard.canActivate(ctxFor(m, role)), true, role + ' lost ' + m);
});

test('RENTAL_MANAGER (rentals:3) keeps every route', async () => {
  const guard = guardWith({ rentals: 3 });
  for (const m of HANDLERS) assert.equal(await guard.canActivate(ctxFor(m, 'RENTAL_MANAGER')), true, m);
});

test('an unauthenticated request is refused before the map is consulted', async () => {
  await assert.rejects(() => guardWith({ rentals: 3 }).canActivate(ctxFor('review')) as any, /Not authenticated/);
});

/**
 * NEGATIVE CONTROL. The controller as it stood — no class requirement — must be able to FAIL these
 * assertions, or they prove nothing. Both defects are restated so their failure is visible rather
 * than argued: an unruled class lets anyone through, and a handler override silently lowers the bar.
 */
test('NEGATIVE CONTROL — the OLD shape (no requirement anywhere) let any role post an Expense', async () => {
  class OldDriverAppController { review() { return null; } }
  const oldCtx: any = {
    getHandler: () => OldDriverAppController.prototype.review,
    getClass: () => OldDriverAppController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CREW' } }) }),
  };
  assert.equal(reflector.get(PERM_KEY, OldDriverAppController), undefined);
  assert.equal(await guardWith({}).canActivate(oldCtx), true,
    'this is the defect: with no requirement the guard passes a role holding nothing');
  // The controller as it now stands refuses that same caller.
  await assert.rejects(() => guardWith({}).canActivate(ctxFor('review', 'CREW')) as any, /rentals/);
});

test('NEGATIVE CONTROL — a handler override at rentals:1 would reopen the route to DRIVER', async () => {
  // Built by hand rather than by editing the real controller: the class is locked at 2, the handler
  // overrides at 1, and getAllAndOverride takes the handler. This is what the override test above
  // exists to catch.
  class Overridden { review() { return null; } }
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 2 }, Overridden);
  Reflect.defineMetadata(PERM_KEY, { module: 'rentals', level: 1 }, Overridden.prototype.review);
  const ctx: any = {
    getHandler: () => Overridden.prototype.review,
    getClass: () => Overridden,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'DRIVER' } }) }),
  };
  assert.equal(await guardWith({ rentals: 1 }).canActivate(ctx), true,
    'the handler override wins over the class — which is exactly why no handler may carry one');
  // And the real controller, with no override, refuses the same role on the same route.
  await assert.rejects(() => guardWith({ rentals: 1 }).canActivate(ctxFor('review', 'DRIVER')) as any, /rentals/);
});
