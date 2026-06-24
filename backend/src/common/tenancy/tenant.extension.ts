/**
 * Prisma client extension — tenant-scopes EVERY query via the unit-tested core (default-deny).
 * Applied in PrismaService ONLY when TENANCY_ENFORCED is on (so it's inert until enabled).
 * findUnique/findUniqueOrThrow can't carry a tenantId where, so they're enforced by POST-FILTER on
 * the result (recursion-free) rather than rewritten to findFirst.
 */
import { applyTenantToArgs, isTenantScoped, tenantRowAllowed } from './tenant-scope.util';
import { TenantContext } from './tenant-context';

export const tenantExtension = {
  name: 'tenant-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        if (!isTenantScoped(model)) return query(args);
        const tenantId = TenantContext.get();
        if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
          if (tenantId === undefined) throw new Error(`Tenant context required to query ${model}`);
          const row = await query(args);
          if (tenantRowAllowed(row, tenantId)) return row;
          if (operation === 'findUniqueOrThrow') throw new Error(`No ${model} found for the current tenant`);
          return null;
        }
        return query(applyTenantToArgs(model, operation, args, tenantId));
      },
    },
  },
};
