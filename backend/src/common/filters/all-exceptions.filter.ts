import { ExceptionFilter, Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { mapError } from './exception-map';

/**
 * Global exception filter — gives every module one consistent error response shape
 * and turns Prisma / unexpected errors into proper HTTP codes instead of leaky 500s.
 * Registered via APP_FILTER in AppModule. Mapping logic lives in exception-map.ts (tested).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();
    const { status, body } = mapError(exception);

    // Log anything that isn't a clean client error (5xx / unexpected) with full detail,
    // so the previously-silent failures surface server-side without leaking to the client.
    if (status >= 500) {
      this.logger.error(`${req?.method} ${req?.url} → ${status}`, (exception as any)?.stack || String(exception));
    }

    res.status(status).json({ ...body, path: req?.url, timestamp: new Date().toISOString() });
  }
}
