import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT = 'skip_audit';
/**
 * Exempt a route (or an entire controller) from the app-wide AuditInterceptor —
 * for handlers that write their own, more specific audit row: @SkipAudit()
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT, true);
