import {
  Module, Controller, Injectable, Get, Post, Delete, Param, Query, Req, Res,
  UseGuards, ExecutionContext, BadRequestException, NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { basename, extname, join, resolve, sep } from 'path';
import { createReadStream, existsSync, statSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { SkipAudit } from '../audit/skip-audit.decorator';
import {
  FILE_PASS_COOKIE, FilePass, signFilePass, verifyFilePass, readCookie, passExpiry, jwtExp,
  filePassCookie, clearFilePassCookie,
} from './file-pass';

/**
 * Guarded delivery for everything in backend/uploads.
 *
 * This replaces the static mount that used to sit in main.ts:
 *
 *     app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
 *
 * That served every uploaded file to anyone who could guess a filename — no
 * token, no session, no log. With supplier invoices, client addresses and the
 * company TRN in there, it was the widest hole in the backend.
 *
 * Three ways in, all authenticated:
 *
 *   GET /api/v1/uploads/:filename
 *       with an Authorization: Bearer <jwt> header. For fetch/XHR.
 *
 *   GET /api/v1/uploads/:filename?t=<signed>
 *       with a short-lived signed token. It is an HMAC over the filename and an
 *       expiry, keyed on JWT_SECRET — it grants ONE file until it expires, and
 *       nothing else. This is what the public token pages (clearance, listen)
 *       hand out, signed by the resolver that already checked their share token.
 *
 *   GET /api/v1/uploads/:filename   with the file-pass cookie
 *       A browser <img>, <audio>, <video> or <a> cannot attach an Authorization
 *       header, and a per-file link expires in the middle of a two-hour table
 *       read. So a signed-in browser carries an HttpOnly cookie scoped to this
 *       path, holding a file pass (see file-pass.ts — it is not the JWT). The
 *       guard re-checks the user and the login session on every request, so
 *       revoking a session cuts file access on the next one.
 *
 *       THE COOKIE OPENS THIS ONE GET AND NOTHING ELSE. FileAccessGuard is on no
 *       other handler, and it ignores the cookie on any method but GET and HEAD.
 *       No other route in the API reads a cookie at all.
 *
 *   POST /api/v1/uploads/session      (Bearer only) sets that cookie.
 *   DELETE /api/v1/uploads/session    (no credentials) clears it from the browser.
 *   POST /api/v1/uploads/:filename/link   (Bearer only)
 *       mints a ?t= token. Default 5 minutes, 60 minutes maximum.
 *
 * Stored URLs do not change: DocumentAttachment.url and every other *Url column
 * stay "/uploads/<name>". `uploadName` below is the one place that turns a
 * stored value into a filename this route will serve.
 *
 * RANGE REQUESTS ARE SERVED. express.static answered a Range header with a 206;
 * a controller that always returns 200 leaves audio and video playing from the
 * start and unable to seek — and 7,708 of the 7,911 files here are mp3 or mp4.
 * A single "bytes=start-end" (or an open or suffix range) gets a 206 with
 * Content-Range and the partial length; an unsatisfiable one gets a 416; a
 * malformed or multi-range header falls back to the whole file rather than
 * guessing at it.
 *
 * Uses only node:crypto and node:fs — no new dependency.
 */

const UPLOADS_DIR = resolve(join(process.cwd(), 'uploads'));
const DEFAULT_TTL_SECONDS = 300;
/**
 * The ceiling for any TTL a CALLER asks for: POST /uploads/:filename/link clamps to this and no
 * route accepts more. One hour.
 */
export const MAX_TTL_SECONDS = 3600;
/**
 * The ceiling for a link the SERVER signs on its own authority, inside a resolver that has
 * already checked a share token (the public listen page: a feature table read runs 90-120
 * minutes, and re-resolving to refresh the link would burn a view). Four hours. Reached only
 * through signedUploadPath(..., 'server') — never from a request parameter.
 */
export const SERVER_MAX_TTL_SECONDS = 14400;

/**
 * Content types we are willing to name. Anything else downloads as binary.
 *
 * The audio and video types are not optional here: mp3, mp4 and webm are what
 * this directory mostly IS (7,705 mp3 alone), and without a real type they go
 * out as application/octet-stream with X-Content-Type-Options: nosniff — which
 * an <audio> or <video> element cannot play at all, Range support or not. .fdx
 * is deliberately absent: a Final Draft file should download, not render.
 */
const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Only these render in place; everything else is offered as a download. Audio and
 * video belong here for the same reason they belong in MIME above: Content-
 * Disposition: attachment makes a browser save the file rather than hand it to the
 * player, so a scrubber never appears no matter what the byte ranges do.
 */
const INLINE = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.txt', '.mp3', '.m4a', '.wav', '.mp4', '.webm']);

/**
 * One byte range, resolved against the real size. Returns:
 *   null        — no Range header, or one this route will not interpret (multi-range,
 *                 malformed, a unit other than bytes): serve the whole file, 200.
 *   'invalid'   — a well-formed range that cannot be satisfied: 416.
 *   {start,end} — inclusive offsets for createReadStream and Content-Range.
 * Suffix ("bytes=-500") and open-ended ("bytes=500-") forms are both accepted.
 */
export function parseRange(header: unknown, size: number): { start: number; end: number } | 'invalid' | null {
  if (typeof header !== 'string' || !header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());        // a comma anywhere fails this on purpose
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === '' && rawEnd === '') return null;
  if (size <= 0) return 'invalid';
  let start: number;
  let end: number;
  if (rawStart === '') {                                      // bytes=-N — the last N bytes
    const n = Number(rawEnd);
    if (!Number.isFinite(n) || n <= 0) return 'invalid';
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Number(rawEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (start >= size) return 'invalid';                      // past the end is unsatisfiable, not a whole-file request
    if (end < start) return 'invalid';
    if (end > size - 1) end = size - 1;                       // a reader asking for more than exists gets what exists
  }
  return { start, end };
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Reject anything that is not a plain filename before it reaches the disk.
 * Returns null rather than throwing so callers decide the status code.
 */
function safeName(raw: string): string | null {
  if (!raw) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded !== basename(decoded)) return null;          // any separator at all
  if (decoded.includes('\0') || decoded.includes('..')) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(decoded)) return null;
  return decoded;
}

/** Absolute path, proven to be inside the uploads directory. */
function resolveInsideUploads(name: string): string | null {
  const full = resolve(join(UPLOADS_DIR, name));
  if (full !== UPLOADS_DIR && !full.startsWith(UPLOADS_DIR + sep)) return null;
  return full;
}

/**
 * The filename a stored value points at, or null when it is not one of ours to serve.
 * Accepts "/uploads/<name>", a bare "<name>", and "/api/v1/uploads/<name>" with or without a
 * query string. External and data URLs, nested paths and anything safeName rejects are null.
 */
export function uploadName(stored: string | null | undefined): string | null {
  if (typeof stored !== 'string') return null;
  const s = stored.trim();
  if (!s || /^[a-z][a-z0-9+.-]*:/i.test(s)) return null;      // http:, https:, data:, blob: — not ours
  const path = s.split(/[?#]/)[0];
  const m = /^(?:\/api\/v1)?\/uploads\/([^/]+)$/.exec(path);
  const raw = m ? m[1] : path.includes('/') ? null : path;
  return raw ? safeName(raw) : null;
}

/** The TTL POST /uploads/:filename/link will use for a raw ?ttl= value. Never above MAX_TTL_SECONDS. */
export function linkTtl(raw: unknown): number {
  const requested = Number(raw);
  return raw != null && raw !== '' && Number.isFinite(requested) && requested > 0
    ? Math.min(Math.floor(requested), MAX_TTL_SECONDS)
    : DEFAULT_TTL_SECONDS;
}

function secret(): string | null {
  const s = process.env.JWT_SECRET;
  return s && s.length ? s : null;
}

export function signFileToken(name: string, ttlSeconds: number): { token: string; expiresAt: Date } {
  const key = secret();
  if (!key) throw new InternalServerErrorException('JWT_SECRET is not configured');
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = randomUUID().slice(0, 8);
  const sig = b64url(createHmac('sha256', key).update(`${name}:${exp}:${nonce}`).digest());
  return { token: `${exp}.${nonce}.${sig}`, expiresAt: new Date(exp * 1000) };
}

export function verifyFileToken(name: string, token: string): boolean {
  const key = secret();
  if (!key) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [expRaw, nonce, sig] = parts;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  if (!/^[A-Za-z0-9]{1,32}$/.test(nonce)) return false;
  const expected = b64url(createHmac('sha256', key).update(`${name}:${exp}:${nonce}`).digest());
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * A server-signed link to one stored file: "/api/v1/uploads/<name>?t=<token>", or null when the
 * value is not an upload. For resolvers that have already decided the caller may see the file.
 *
 * `ceiling` says whose authority the TTL rests on. 'link' (the default) is the one-hour limit
 * that applies to anything a caller could influence. 'server' is the four-hour limit, for a TTL
 * the server computed itself. The disk is not checked: a missing file is a 404 when fetched.
 */
export function signedUploadPath(
  stored: string | null | undefined,
  ttlSeconds: number = MAX_TTL_SECONDS,
  ceiling: 'link' | 'server' = 'link',
): string | null {
  const name = uploadName(stored);
  if (!name) return null;
  const max = ceiling === 'server' ? SERVER_MAX_TTL_SECONDS : MAX_TTL_SECONDS;
  const ttl = Number.isFinite(ttlSeconds) ? Math.min(Math.max(Math.floor(ttlSeconds), 1), max) : MAX_TTL_SECONDS;
  return `/api/v1/uploads/${encodeURIComponent(name)}?t=${signFileToken(name, ttl).token}`;
}

/**
 * Three doors, tried in this order:
 *   1. a valid signed ?t= for THIS filename;
 *   2. on GET or HEAD only, a file-pass cookie whose user is still active and whose login
 *      session still exists;
 *   3. the normal Bearer check, unchanged, so nothing is weakened for API callers.
 *
 * Door 2 is the only cookie authentication in the backend. It is refused on every other method
 * before the cookie is even parsed, and this guard is applied to the serve handler alone.
 */
@Injectable()
export class FileAccessGuard extends AuthGuard('jwt') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = typeof req.query?.t === 'string' ? req.query.t : null;
    const name = safeName(String((req.params as any)?.filename ?? ''));
    if (token && name && verifyFileToken(name, token)) return true;

    if (req.method === 'GET' || req.method === 'HEAD') {
      const pass = verifyFilePass(readCookie(req.headers?.cookie, FILE_PASS_COOKIE));
      if (pass && (await this.holderIsLive(pass))) {
        (req as any).user = { id: pass.sub, sessionId: pass.sid ?? undefined };
        return true;
      }
    }
    return this.bearer(ctx);
  }

  /** The Bearer check every other guarded route uses. */
  protected async bearer(ctx: ExecutionContext): Promise<boolean> {
    return (await super.canActivate(ctx)) as boolean;
  }

  /**
   * The same two questions JwtStrategy.validate() asks of a JWT: is the user still active, and —
   * when the pass names a session — does that session row still exist for them. Revoking a
   * session therefore cuts file access on the next request. A pass with no sid came from a
   * legacy login with no session row, which the strategy still accepts too.
   *
   * No lastSeenAt heartbeat here: every seek in an audio file is a request.
   */
  private async holderIsLive(pass: FilePass): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: pass.sub }, select: { id: true, isActive: true } });
      if (!user || !user.isActive) return false;
      if (!pass.sid) return true;
      const session = await this.prisma.userSession.findUnique({ where: { id: pass.sid }, select: { id: true, userId: true } });
      return !!session && session.userId === user.id;
    } catch {
      return false;
    }
  }
}

/** Secure is a deployment fact, not something to sniff from a request that arrives through a proxy hop. */
function secureCookie(): boolean {
  return process.env.FILE_PASS_SECURE === 'true';
}

@ApiTags('Files')
@Controller('uploads')
export class FilesController {
  @Post('session')
  @UseGuards(JwtAuthGuard)
  @SkipAudit()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Set the file-pass cookie for this browser',
    description:
      'Bearer only — the cookie cannot renew itself. Sets an HttpOnly, SameSite=Lax cookie scoped to ' +
      '/api/v1/uploads so <img>, <audio>, <video> and <a> can load files. It lives as long as the ' +
      'login it came from, eight hours at most, and is accepted by GET /uploads/:filename only.',
  })
  session(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = (req as any).user as { id: string; sessionId?: string };
    const now = Date.now();
    const exp = passExpiry(jwtExp(req.headers?.authorization), now);
    const value = signFilePass({ sub: user.id, sid: user.sessionId ?? null, exp });
    res.setHeader('Set-Cookie', filePassCookie(value, exp, now, secureCookie()));
    return { expiresAt: new Date(exp * 1000).toISOString() };
  }

  @Delete('session')
  @SkipAudit()
  @ApiOperation({
    summary: 'Clear the file-pass cookie from this browser',
    description:
      'Takes no credentials and reads none: it is called on logout and after a 401, when there may be ' +
      'no valid token left. It removes the cookie from the browser that asks. It does not invalidate ' +
      'a pass value copied beforehand — only removing the login session does that.',
  })
  clearSession(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Set-Cookie', clearFilePassCookie(secureCookie()));
    return { cleared: true };
  }

  @Get(':filename')
  @UseGuards(FileAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Download an uploaded file',
    description:
      'Requires a Bearer token, a signed ?t= token, or the file-pass cookie from POST /uploads/session. ' +
      'Add ?dl=1 to have it saved rather than shown.',
  })
  @ApiQuery({ name: 't', required: false, description: 'Short-lived signed token' })
  @ApiQuery({ name: 'dl', required: false, description: '1 to force a download' })
  serve(@Param('filename') filename: string, @Req() req: Request, @Res() res: Response) {
    const name = safeName(filename);
    if (!name) throw new BadRequestException('Invalid filename');

    const full = resolveInsideUploads(name);
    if (!full || !existsSync(full)) throw new NotFoundException('File not found');

    const stat = statSync(full);
    if (!stat.isFile()) throw new NotFoundException('File not found');

    const ext = extname(name).toLowerCase();
    // ?dl=1 is not part of any signature: it only changes how a file the caller may already
    // read is presented. <a download> is ignored across origins, and mp3/mp4 are inline above.
    const disposition = INLINE.has(ext) && (req.query as any)?.dl !== '1' ? 'inline' : 'attachment';

    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${disposition}; filename="${name}"`);
    // Company records: no shared cache, no other site framing them. A seek is a
    // fresh request rather than a cached byte range, which is the right trade here.
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'");
    // Advertised on EVERY response, including the 200: a player asks for the whole
    // file first and only offers a scrubber if the answer says ranges are allowed.
    res.setHeader('Accept-Ranges', 'bytes');

    const range = parseRange(req.headers?.range, stat.size);
    if (range === 'invalid') {
      res.setHeader('Content-Range', `bytes */${stat.size}`);
      res.status(416).end();
      return;
    }
    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`);
      res.setHeader('Content-Length', String(range.end - range.start + 1));
      createReadStream(full, { start: range.start, end: range.end }).pipe(res);
      return;
    }

    res.setHeader('Content-Length', String(stat.size));
    createReadStream(full).pipe(res);
  }

  @Post(':filename/link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mint a short-lived link to one file',
    description:
      'For <iframe>, <embed> and <img>, which cannot send an Authorization header. ' +
      'The token covers this filename only and expires. Default 300s, maximum 3600s.',
  })
  @ApiQuery({ name: 'ttl', required: false, description: 'Seconds, 1 to 3600' })
  link(@Param('filename') filename: string, @Query('ttl') ttl?: string) {
    const name = safeName(filename);
    if (!name) throw new BadRequestException('Invalid filename');

    const full = resolveInsideUploads(name);
    if (!full || !existsSync(full)) throw new NotFoundException('File not found');

    const seconds = linkTtl(ttl);

    const { token, expiresAt } = signFileToken(name, seconds);
    return {
      url: `/api/v1/uploads/${encodeURIComponent(name)}?t=${token}`,
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: seconds,
    };
  }
}

@Module({
  controllers: [FilesController],
})
export class FilesModule {}
