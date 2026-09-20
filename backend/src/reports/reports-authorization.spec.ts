/**
 * Authorization for GET /api/v1/reports/:key.
 *
 * Financial reports are confidential: the revenue matrix names every client and
 * what each was billed. Until 2026-08-22 this route carried JwtAuthGuard only,
 * so any authenticated user — including a driver — could run any report by key.
 * These tests pin the guard that closed it.
 *
 * Pure: PermissionsGuard is exercised directly with stubs, so no DB and no HTTP.
 */

import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from '../permissions/permissions.guard';

/** Effective levels per role, as seeded by PermissionsService DEFAULTS. */
const FINANCE_LEVEL: Record<string, number> = {
  SYSTEM_ADMIN: 3,
  FINANCE_MANAGER: 3,
  ACCOUNTANT: 2,
  SALES: 2,
  RENTAL_MANAGER: 1,
  PRODUCTION_MANAGER: 1,
  // no finance access at all
  HR_MANAGER: 0,
  DRIVER: 0,
  DISPATCHER: 0,
  CREW: 0,
  MAINTENANCE: 0,
  TALENT_REP: 0,
  RENTAL_COORDINATOR: 0,
  PRODUCTION_COORDINATOR: 0,
  TRAVEL_COORDINATOR: 0,
};

const guardFor = (role: string | undefined, required: { module: string; level: number } | undefined) => {
  const reflector: any = { getAllAndOverride: () => required };
  const perms: any = {
    forRole: async (r: string) =>
      r === 'SYSTEM_ADMIN'
        ? { finance: 3, reports: 3, home: 3 }
        : { finance: FINANCE_LEVEL[r] ?? 0, home: 1 },
  };
  const ctx: any = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  };
  return { guard: new PermissionsGuard(reflector, perms), ctx };
};

const REQUIRED = { module: 'finance', level: 1 };

describe('GET /reports/:key requires finance:1', () => {
  for (const role of ['SYSTEM_ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'SALES', 'RENTAL_MANAGER', 'PRODUCTION_MANAGER']) {
    test(`${role} may run a financial report`, async () => {
      const { guard, ctx } = guardFor(role, REQUIRED);
      assert.equal(await guard.canActivate(ctx), true);
    });
  }

  for (const role of ['DRIVER', 'DISPATCHER', 'CREW', 'MAINTENANCE', 'HR_MANAGER', 'TALENT_REP', 'TRAVEL_COORDINATOR']) {
    test(`${role} is rejected`, async () => {
      const { guard, ctx } = guardFor(role, REQUIRED);
      await assert.rejects(() => guard.canActivate(ctx), ForbiddenException);
    });
  }

  test('an unauthenticated request is rejected before any role lookup', async () => {
    const { guard, ctx } = guardFor(undefined, REQUIRED);
    await assert.rejects(() => guard.canActivate(ctx), ForbiddenException);
  });

  test('the guard is permissive when no metadata is attached — which is why the decorator is required', async () => {
    // PermissionsGuard returns true when @RequirePermission is absent. Adding the
    // guard without the decorator would silently authorise everyone, so this
    // documents why both must be present on the route.
    const { guard, ctx } = guardFor('DRIVER', undefined);
    assert.equal(await guard.canActivate(ctx), true);
  });
});
