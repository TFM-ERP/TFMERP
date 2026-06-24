# Tenancy — Phase 1c wiring (the final, flag-gated step)

The enforcement pieces are built + unit-tested:
`backend/src/common/tenancy/` → `tenant-scope.util.ts` · `tenant-context.ts` · `tenant.extension.ts` · `tenant.interceptor.ts`.

Three small wirings turn them on — all behind **`TENANCY_ENFORCED`** (default OFF ⇒ today's behaviour, zero change). Apply, then **`npm run start:dev`** to confirm it still boots (proves it compiled + is inert). Only later set the flag to actually enforce.

### Edit 1 — apply the extension in PrismaService (only when the flag is on)
In `backend/src/common/prisma/prisma.service.ts`, expose a tenant-aware client. Because Prisma's `$extends` returns a *new* client, expose it as a getter rather than reassigning `this`:
```ts
import { tenantExtension } from '../tenancy/tenant.extension';
// inside PrismaService (extends PrismaClient):
private _scoped: any;
get db() {
  if (process.env.TENANCY_ENFORCED !== 'true') return this;     // flag OFF → plain client (today)
  if (!this._scoped) this._scoped = this.$extends(tenantExtension);
  return this._scoped;
}
```
Then services read through `this.prisma.db.<model>` instead of `this.prisma.<model>`. (Do this incrementally — start with the 6 root models' services; everything else is reached via a project and inherits.)
*Simplest first cut:* leave services as-is and only flip `db` in once you’re ready; with the flag OFF nothing changes regardless.

### Edit 2 — register the interceptor globally
In `backend/src/app.module.ts` providers:
```ts
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantInterceptor } from './common/tenancy/tenant.interceptor';
// ...
providers: [ /* ...existing... */ { provide: APP_INTERCEPTOR, useClass: TenantInterceptor } ],
```
(Harmless with the flag off — it just sets a context the extension ignores.)

### Edit 3 — put tenantId in the JWT
- Where the token is signed at login (auth service), include the user's tenant:
  `sign({ sub: user.id, email: user.email, tenantId: user.tenantId, ... })`
- In `JwtStrategy.validate(payload)`, return `tenantId` on the user:
  `return { id: payload.sub, email: payload.email, tenantId: payload.tenantId, ... }`
So `req.user.tenantId` exists for the interceptor.

### Enable + test (when ready)
1. `npm run start:dev` with the flag **unset** → app boots exactly as today (sanity check).
2. Set `TENANCY_ENFORCED=true` in `backend/.env`, restart.
3. Log in (the login user lookup uses the `null` bypass, so auth still works), open a screen that lists Projects/Suppliers → you should see only your tenant's rows.
4. Quick negative check: a second tenant's user must not see the first tenant's data.
5. If anything misbehaves, unset the flag (instant revert to today) and tell me the symptom.

### Notes
- `findUnique` on a root model is enforced by **post-filter** (returns null if the row isn't your tenant) — for hard isolation prefer `findFirst`.
- Background jobs / schedulers have no request → wrap them in `TenantContext.run(tenantId, () => ...)` explicitly, or they hit default-deny.
- Raw SQL (`$queryRaw`) bypasses the extension — add explicit tenant filters there.
