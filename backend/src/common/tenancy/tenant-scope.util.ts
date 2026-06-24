/**
 * Pure tenant-scoping core (no Nest/Prisma imports → unit-testable in isolation).
 * The Prisma client extension (tenant.extension.ts) delegates here so EVERY query is tenant-scoped
 * BY DEFAULT (default-deny). Only the top-level ROOT models carry a tenantId column; children reached
 * via a project inherit tenancy through their parent.
 *
 * tenantId contract:  string → scope · null → audited bypass (super-admin / pre-tenant auth) · undefined → THROW (fail closed).
 */
export const TENANT_SCOPED_MODELS = new Set<string>([
  'User', 'ProductionProject', 'Supplier', 'Asset', 'MasterScript', 'Contact',
]);

export function isTenantScoped(model: string | undefined | null): boolean {
  return !!model && TENANT_SCOPED_MODELS.has(model);
}

export function scopeWhere(model: string | undefined, where: any, tenantId: string | null | undefined): any {
  if (!isTenantScoped(model)) return where;
  if (tenantId === null) return where;
  if (tenantId === undefined) throw new Error(`Tenant context required to query ${model}`);
  const base = (where && typeof where === 'object' && !Array.isArray(where)) ? where : {};
  if ('tenantId' in base) return base;
  return { ...base, tenantId };
}

export function stampTenant(model: string | undefined, data: any, tenantId: string | null | undefined): any {
  if (!isTenantScoped(model) || data == null) return data;
  if (tenantId === null) return data;
  if (tenantId === undefined) throw new Error(`Tenant context required to create ${model}`);
  if (Array.isArray(data)) return data.map((d) => (d && typeof d === 'object' && d.tenantId == null ? { ...d, tenantId } : d));
  return (typeof data === 'object' && data.tenantId == null) ? { ...data, tenantId } : data;
}

const SCOPE_WHERE_OPS = new Set([
  'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow', 'findMany',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany',
]);

/** Operation-aware arg rewriter the extension delegates to. Pure: returns new args. */
export function applyTenantToArgs(model: string | undefined, operation: string, args: any, tenantId: string | null | undefined): any {
  if (!isTenantScoped(model)) return args;
  const a: any = (args && typeof args === 'object') ? { ...args } : {};
  if (operation === 'create' || operation === 'createMany') {
    a.data = stampTenant(model, a.data, tenantId);
  } else if (operation === 'upsert') {
    a.where = scopeWhere(model, a.where, tenantId);
    a.create = stampTenant(model, a.create, tenantId);
  } else if (SCOPE_WHERE_OPS.has(operation)) {
    a.where = scopeWhere(model, a.where, tenantId);
  }
  return a;
}

export function redirectsToFindFirst(model: string | undefined, operation: string): false | 'findFirst' | 'findFirstOrThrow' {
  if (!isTenantScoped(model)) return false;
  if (operation === 'findUnique') return 'findFirst';
  if (operation === 'findUniqueOrThrow') return 'findFirstOrThrow';
  return false;
}

/**
 * Post-filter guard for findUnique results (which can't carry a tenantId where): is this row visible
 * to the current tenant? row==null and the null/undefined bypass cases pass through; a present row is
 * allowed only when its tenantId matches (or wasn't selected, in which case we can't check — prefer
 * findFirst for hard isolation).
 */
export function tenantRowAllowed(row: any, tenantId: string | null | undefined): boolean {
  if (row == null) return true;
  if (tenantId === null || tenantId === undefined) return true;
  return row.tenantId === undefined || row.tenantId === tenantId;
}
