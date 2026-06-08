import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../common/prisma/prisma.service';

const ACTION: Record<string, string> = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };
const isId = (s: string) => !!s && (s.length >= 20 || /^\d+$/.test(s));

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest();
    const method = req?.method;
    if (!method || !ACTION[method]) return next.handle();
    const url = String(req.originalUrl || req.url || '').split('?')[0];
    // skip auth/login noise
    if (url.includes('/auth/')) return next.handle();

    return next.handle().pipe(tap(() => {
      try {
        const user = req.user || {};
        if (!user.id) return; // userId is required on AuditLog
        const parts = url.replace(/^\/?(api\/v\d+\/)?/, '').split('/').filter(Boolean);
        const resource = parts.slice(0, 2).join('/') || url;
        const last = parts[parts.length - 1] || '';
        const resourceId = isId(last) ? last : (req.params?.id || '');
        this.prisma.auditLog.create({
          data: {
            userId: user.id, action: ACTION[method], resource, resourceId,
            ipAddress: req.ip || req.headers?.['x-forwarded-for'] || null,
          },
        }).catch(() => {});
      } catch { /* never break the request */ }
    }));
  }
}
