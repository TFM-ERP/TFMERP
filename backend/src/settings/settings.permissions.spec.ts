/**
 * THE EXACT FAILURE THIS CATCHES: a controller that runs JwtAuthGuard alone.
 *
 * settings.controller.ts had no PermissionsGuard, so any authenticated user of any role could
 * change the company's SMTP credentials and letterhead. Nothing failed, nothing logged — the
 * guard simply was not in the chain, and PermissionsGuard returns true for a route with no
 * requirement (permissions.guard.ts:14), so a missing decorator is indistinguishable from a
 * deliberate open route unless something asserts the difference.
 *
 * This reads the metadata the same way Nest does, through Reflector, and states BOTH halves:
 * every write carries its exact {module, level}, and every read carries none. A test that only
 * checked the writes would pass on a class-level requirement that silently closed GET /settings —
 * which layout.tsx:282 and sixteen app/print/* letterheads depend on.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { Reflector } from '@nestjs/core';
import { SettingsController } from './settings.controller';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PERM_KEY } from '../permissions/require-permission.decorator';

const reflector = new Reflector();
const perm = (method: string) =>
  reflector.get<{ module: string; level: number }>(PERM_KEY, (SettingsController.prototype as any)[method]);

/** Nest stores @UseGuards under this key; read it rather than trusting the source text. */
const classGuards = (): any[] => Reflect.getMetadata('__guards__', SettingsController) || [];

test('the class runs BOTH guards — JwtAuthGuard alone is the defect', () => {
  const names = classGuards().map((g: any) => (typeof g === 'function' ? g.name : g?.constructor?.name));
  assert.ok(names.includes('PermissionsGuard'), 'PermissionsGuard is not in the class guard chain: ' + names.join(', '));
  assert.ok(names.includes('JwtAuthGuard'), 'JwtAuthGuard must stay: ' + names.join(', '));
});

test('THE CLASS ITSELF CARRIES NO REQUIREMENT — or every read closes with it', () => {
  assert.equal(reflector.get(PERM_KEY, SettingsController), undefined,
    'a class-level requirement would gate GET /settings, which every dashboard page and 16 print letterheads read');
});

test('every WRITE handler carries its exact module and level', () => {
  assert.deepEqual(perm('update'), { module: 'setup', level: 2 }, 'PUT /settings');
  assert.deepEqual(perm('emailTest'), { module: 'setup', level: 2 }, 'POST /settings/email-test');
});

test('every READ handler carries NONE', () => {
  assert.equal(perm('get'), undefined, 'GET /settings must stay open');
});

/**
 * The guard's own contract, restated here because the whole design leans on it: a route with no
 * requirement passes. That is what lets the class-level guard sit above open reads.
 *
 * The map comes from PermissionsService.forRole(role), NOT from req.user — the request carries the
 * role, the service resolves what it may do. A stub stands in for it so this test touches no
 * database.
 */
const guardWith = (map: Record<string, number>) =>
  new PermissionsGuard(new Reflector(), { forRole: async () => map } as any);
const ctxFor = (method: string, role?: string): any => ({
  getHandler: () => (SettingsController.prototype as any)[method],
  getClass: () => SettingsController,
  switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
});
test('a route with no requirement passes the guard', async () => {
  assert.equal(await guardWith({}).canActivate(ctxFor('get', 'CREW')), true,
    'GET must pass for a role with no setup permission');
});

test('a gated route REFUSES a role without the level, and names the module', async () => {
  // FINANCE_MANAGER holds setup:1 on the live matrix — one short of the requirement.
  const guard = guardWith({ setup: 1 });
  const ctx = ctxFor('update', 'FINANCE_MANAGER');
  await assert.rejects(() => guard.canActivate(ctx) as any, (e: any) => {
    assert.equal(e.constructor.name, 'ForbiddenException');
    assert.match(String(e.message), /setup/, 'the refusal must name the module so the UI can say what refused it');
    return true;
  });
});

test('and ALLOWS the level that holds it', async () => {
  // SYSTEM_ADMIN holds setup:3 — the only role that does.
  assert.equal(await guardWith({ setup: 3 }).canActivate(ctxFor('update', 'SYSTEM_ADMIN')), true);
});

test('an unauthenticated request is refused before the map is consulted', async () => {
  await assert.rejects(() => guardWith({ setup: 3 }).canActivate(ctxFor('update')) as any,
    /Not authenticated/);
});
