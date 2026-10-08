/**
 * THE EXACT FAILURE THIS CATCHES: a controller that runs JwtAuthGuard alone.
 *
 * company.controller.ts had no PermissionsGuard, so any authenticated user of any role could
 * rewrite the company's bank accounts, trade licence documents and trading addresses. Nothing
 * failed and nothing logged — the guard simply was not in the chain, and PermissionsGuard returns
 * true for a route carrying no requirement (permissions.guard.ts:14), so a MISSING decorator is
 * indistinguishable from a DELIBERATELY open route unless something asserts the difference.
 *
 * This reads the metadata the way Nest does, through Reflector, and states every half:
 *   · each gated handler carries its exact {module, level};
 *   · each open read carries none — GET /company is read by SetupGate on every page;
 *   · the CLASS carries none, or every open read closes with it;
 *   · and NO HANDLER IS UNACCOUNTED FOR, so a route added later cannot arrive unruled.
 *
 * The last one is the only test here that fails on code nobody has written yet. A spec that merely
 * checks the sixteen handlers present today would pass unchanged on a seventeenth that ships open.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { CompanyController } from './company.controller';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { PERM_KEY } from '../permissions/require-permission.decorator';

const reflector = new Reflector();
const perm = (method: string) =>
  reflector.get<{ module: string; level: number }>(PERM_KEY, (CompanyController.prototype as any)[method]);

/** Nest stores @UseGuards under this key; read it rather than trusting the source text. */
const classGuards = (): any[] => Reflect.getMetadata('__guards__', CompanyController) || [];

/**
 * THE RULING, AS DATA. Qais decided each of these; the table is the decision, and the tests below
 * only read it. A handler absent from BOTH tables fails the completeness test.
 */
const GATED: Record<string, { module: string; level: number }> = {
  // The company profile carries the TRN, licence numbers and letterhead used on every invoice.
  updateProfile: { module: 'finance', level: 3 },
  // Bank accounts: the SAME prisma.bankAccount rows the finance controller writes. One door alone
  // would leave them reachable through the other.
  createBankAccount: { module: 'finance', level: 3 },
  updateBankAccount: { module: 'finance', level: 3 },
  deleteBankAccount: { module: 'finance', level: 3 },
  // The list returns the owner's personal account under ?includeOwner on feat/invoice-lifecycle,
  // so it is NOT open — finance:1 matches the finance controller's own class-level read level.
  listBankAccounts: { module: 'finance', level: 1 },
  // Setup surface: addresses, licence documents, and the wizard's completion flag.
  completeSetup: { module: 'setup', level: 2 },
  createLocation: { module: 'setup', level: 2 },
  updateLocation: { module: 'setup', level: 2 },
  deleteLocation: { module: 'setup', level: 2 },
  createDocument: { module: 'setup', level: 2 },
  updateDocument: { module: 'setup', level: 2 },
  deleteDocument: { module: 'setup', level: 2 },
};

/** Open ON PURPOSE. Each one is named with what breaks if it closes. */
const OPEN: Record<string, string> = {
  getProfile: 'SetupGate reads GET /company on every page; a level here blanks the app below it',
  expiryAlerts: 'the dashboard expiry banner renders for every role',
  listLocations: 'locations fill address pickers across production and HR',
  listDocuments: 'the documents list is read by the same company page every role can open',
};

test('the class runs BOTH guards — JwtAuthGuard alone is the defect', () => {
  const names = classGuards().map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
  assert.ok(names.includes('PermissionsGuard'), 'PermissionsGuard is not in the class guard chain: ' + names.join(', '));
  assert.ok(names.includes('JwtAuthGuard'), 'JwtAuthGuard must stay: ' + names.join(', '));
});

test('THE CLASS ITSELF CARRIES NO REQUIREMENT — or every open read closes with it', () => {
  assert.equal(reflector.get(PERM_KEY, CompanyController), undefined,
    'a class-level requirement would gate GET /company, which SetupGate reads on every page load');
});

test('every GATED handler carries its exact module and level', () => {
  for (const [method, expected] of Object.entries(GATED)) {
    assert.deepEqual(perm(method), expected, method);
  }
});

test('every OPEN handler carries NONE', () => {
  for (const [method, why] of Object.entries(OPEN)) {
    assert.equal(perm(method), undefined, method + ' must stay open — ' + why);
  }
});

/**
 * THE ONE THAT CATCHES THE NEXT ROUTE. Every handler on the controller must appear in exactly one
 * of the two tables above, so adding a route forces a decision about it rather than defaulting to
 * open. This is the test that would have failed on the original file.
 */
test('NO HANDLER IS UNACCOUNTED FOR — a new route cannot arrive unruled', () => {
  const handlers = Object.getOwnPropertyNames(CompanyController.prototype)
    .filter((m) => m !== 'constructor' && typeof (CompanyController.prototype as any)[m] === 'function');
  const unaccounted = handlers.filter((m) => !(m in GATED) && !(m in OPEN));
  assert.deepEqual(unaccounted, [],
    'these handlers are in neither table — decide a level, or record why they are open: ' + unaccounted.join(', '));
  // And the tables may not name a handler that does not exist, or the ruling drifts from the code.
  const phantom = [...Object.keys(GATED), ...Object.keys(OPEN)].filter((m) => !handlers.includes(m));
  assert.deepEqual(phantom, [], 'the table names handlers the controller does not have: ' + phantom.join(', '));
});

/**
 * The guard's own contract, restated because the whole design leans on it: a route with no
 * requirement passes. That is what lets the class-level guard sit above the open reads.
 *
 * The map comes from PermissionsService.forRole(role), NOT from req.user — the request carries the
 * role, the service resolves what it may do. A stub stands in for it so this test touches no
 * database.
 */
const guardWith = (map: Record<string, number>) =>
  new PermissionsGuard(new Reflector(), { forRole: async () => map } as any);
const ctxFor = (method: string, role?: string): any => ({
  getHandler: () => (CompanyController.prototype as any)[method],
  getClass: () => CompanyController,
  switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
});

test('an open read passes the guard for a role holding nothing at all', async () => {
  assert.equal(await guardWith({}).canActivate(ctxFor('getProfile', 'CREW')), true,
    'GET /company must pass for a role with no finance and no setup permission');
});

test('ACCOUNTANT (finance:2) is REFUSED a bank-account write, and the refusal names the module', async () => {
  const guard = guardWith({ finance: 2, setup: 1 });
  await assert.rejects(() => guard.canActivate(ctxFor('createBankAccount', 'ACCOUNTANT')) as any, (e: any) => {
    assert.equal(e.constructor.name, 'ForbiddenException');
    assert.match(String(e.message), /finance/, 'the refusal must name the module so the UI can say what refused it');
    return true;
  });
});

test('— but ACCOUNTANT still READS the bank-account list at finance:1', async () => {
  assert.equal(await guardWith({ finance: 2 }).canActivate(ctxFor('listBankAccounts', 'ACCOUNTANT')), true,
    'the list is finance:1; the role holding 2 must keep seeing it');
});

test('a role below finance:1 is refused even the list', async () => {
  await assert.rejects(() => guardWith({ setup: 3 }).canActivate(ctxFor('listBankAccounts', 'HR_MANAGER')) as any,
    /finance/, 'the list returns the owner’s personal account under ?includeOwner');
});

test('FINANCE_MANAGER (finance:3) holds the bank-account writes and the profile', async () => {
  const guard = guardWith({ finance: 3, setup: 1 });
  for (const m of ['createBankAccount', 'updateBankAccount', 'deleteBankAccount', 'updateProfile']) {
    assert.equal(await guard.canActivate(ctxFor(m, 'FINANCE_MANAGER')), true, m);
  }
});

test('— and that same role is refused the SETUP writes, which are a different key', async () => {
  const guard = guardWith({ finance: 3, setup: 1 });
  await assert.rejects(() => guard.canActivate(ctxFor('createLocation', 'FINANCE_MANAGER')) as any, /setup/);
});

test('SYSTEM_ADMIN (setup:3) holds the setup writes', async () => {
  assert.equal(await guardWith({ setup: 3 }).canActivate(ctxFor('createDocument', 'SYSTEM_ADMIN')), true);
});

test('an unauthenticated request is refused before the map is consulted', async () => {
  await assert.rejects(() => guardWith({ finance: 3 }).canActivate(ctxFor('createBankAccount')) as any,
    /Not authenticated/);
});

/**
 * NEGATIVE CONTROL. The controller as it stood — JwtAuthGuard alone, no decorators — must be able
 * to FAIL these assertions, or they prove nothing. This restates the old shape and shows that the
 * exact checks above go red on it.
 */
test('NEGATIVE CONTROL — the OLD shape (no guard, no decorators) fails both halves', async () => {
  class OldCompanyController {
    createBankAccount() { return null; }
  }
  assert.equal(reflector.get(PERM_KEY, OldCompanyController.prototype.createBankAccount), undefined,
    'the old handler carried no requirement');
  // With no requirement, the guard lets a role holding NOTHING write the company bank accounts.
  const oldCtx: any = {
    getHandler: () => OldCompanyController.prototype.createBankAccount,
    getClass: () => OldCompanyController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role: 'CREW' } }) }),
  };
  assert.equal(await guardWith({}).canActivate(oldCtx), true,
    'this is the defect: an unruled route passes the guard');
  // And the same role is refused by the controller as it now stands.
  await assert.rejects(() => guardWith({}).canActivate(ctxFor('createBankAccount', 'CREW')) as any, /finance/);
});
