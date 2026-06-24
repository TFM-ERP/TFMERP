/**
 * Request-scoped tenant context (AsyncLocalStorage; no Nest/Prisma imports).
 * A NestJS interceptor/middleware will call `TenantContext.run(tenantId, () => next())` per request,
 * reading tenantId from the validated JWT. The Prisma extension (Phase 1c) reads `TenantContext.get()`
 * so every query is scoped to the caller's tenant — default-deny when there's no context.
 *
 * get() returns:  string = scoped · null = explicit bypass (super-admin / pre-tenant auth) · undefined = no context.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

type Store = { tenantId: string | null };
const als = new AsyncLocalStorage<Store>();

export const TenantContext = {
  /** Run `fn` with the given tenant in scope (string to scope, null for an audited bypass). */
  run<T>(tenantId: string | null, fn: () => T): T {
    return als.run({ tenantId }, fn);
  },
  /** Current tenant id, null for an explicit bypass, or undefined when no context is set. */
  get(): string | null | undefined {
    const store = als.getStore();
    return store ? store.tenantId : undefined;
  },
};
