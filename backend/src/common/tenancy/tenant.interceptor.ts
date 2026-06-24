/**
 * Populates the request-scoped TenantContext from the authenticated user, so the Prisma extension
 * can scope every query. Register globally (APP_INTERCEPTOR). Reads req.user.tenantId (set by the JWT
 * strategy); no user → null (bypass — public/auth routes aren't tenant data and are RBAC-guarded anyway).
 */
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req: any = ctx.switchToHttp().getRequest();
    const tenantId: string | null = (req && req.user && typeof req.user.tenantId === 'string') ? req.user.tenantId : null;
    return new Observable((subscriber) => {
      TenantContext.run(tenantId, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
