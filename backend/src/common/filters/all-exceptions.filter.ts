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

    // A REJECTED WRITE IS NOT A CLEAN CLIENT ERROR. On 15 Sep an intake save was refused by the
    // database for a type mismatch: sixty columns unwritten, the writer shown a toast, and nothing
    // whatsoever on the server — because the refusal came back as a 4xx and the floor above is 500.
    // The defect was found days later by diffing the row, which is not a method anyone can rely on.
    //
    // Scoped to mutating methods on purpose: a 401 on a GET is traffic, a 400 on a POST is work that
    // did not happen. `warn`, not `error`, because most of these are genuine client mistakes — the
    // point is that the failed write leaves a trace at all.
    else if (status >= 400 && /^(POST|PUT|PATCH|DELETE)$/i.test(String(req?.method || ''))) {
      this.logger.warn(`${req?.method} ${req?.url} → ${status} — write refused: ${JSON.stringify((body as any)?.message ?? body).slice(0, 300)}`);
    }

    res.status(status).json({ ...body, path: req?.url, timestamp: new Date().toISOString() });
  }
}
