/**
 * Pure exception → HTTP response mapping (no Nest/Prisma imports, so unit-testable).
 * Used by AllExceptionsFilter to give every module a consistent error shape:
 *   { statusCode, error?, message } (the filter adds path + timestamp).
 *
 * Prisma errors are detected by duck-typing (name + code) so this stays dependency-free.
 */
export interface MappedError {
  status: number;
  body: { statusCode: number; error?: string; message: any };
}

// Prisma known-request error codes → HTTP status + safe message.
const PRISMA_CODES: Record<string, [number, string]> = {
  P2002: [409, 'A record with these details already exists.'],
  P2003: [400, 'Related record not found, or it is still in use.'],
  P2025: [404, 'Record not found.'],
  P2000: [400, 'A provided value is too long.'],
  P2014: [400, 'The change violates a required relation.'],
};

export function mapError(ex: any): MappedError {
  // Nest HttpException (has getStatus/getResponse) — preserve status + body as-is.
  if (ex && typeof ex.getStatus === 'function' && typeof ex.getResponse === 'function') {
    const status = ex.getStatus();
    const resp = ex.getResponse();
    if (typeof resp === 'string') return { status, body: { statusCode: status, message: resp } };
    return { status, body: { statusCode: status, ...(resp as object) } as any };
  }
  // Prisma known request error (duck-typed).
  if (ex && ex.name === 'PrismaClientKnownRequestError' && typeof ex.code === 'string') {
    const [status, message] = PRISMA_CODES[ex.code] ?? [400, 'Database request could not be completed.'];
    return { status, body: { statusCode: status, error: ex.code, message } };
  }
  if (ex && (ex.name === 'PrismaClientValidationError' || ex.name === 'PrismaClientUnknownRequestError')) {
    return { status: 400, body: { statusCode: 400, message: 'Invalid data submitted.' } };
  }
  // Anything else → opaque 500 (never leak the raw error to the client; the filter logs it).
  return { status: 500, body: { statusCode: 500, message: 'Internal server error' } };
}
