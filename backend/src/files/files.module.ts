import {
  Module, Controller, Injectable, Get, Post, Param, Query, Req, Res,
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
 * Two ways in, both authenticated:
 *
 *   GET /api/v1/uploads/:filename
 *       with an Authorization: Bearer <jwt> header. For fetch/XHR.
 *
 *   GET /api/v1/uploads/:filename?t=<signed>
 *       with a short-lived signed token. A browser <iframe>, <embed> or <img>
 *       cannot attach an Authorization header, so a PDF viewer needs this. The
 *       token is an HMAC over the filename and an expiry, keyed on JWT_SECRET —
 *       it grants ONE file until it expires, and nothing else.
 *
 *   POST /api/v1/uploads/:filename/link   (Bearer only)
 *       mints one of those tokens. Default 5 minutes, 60 minutes maximum.
 *
 * Stored URLs do not change: DocumentAttachment.url and every other *Url column
 * stay "/uploads/<name>". What resolves them is `assetUrl` in the frontend's
 * lib/api.ts, and as of this commit it STRIPS "/api/v1" rather than adding it —
 * so nothing the app renders comes through this controller yet. That is why the
 * static mount in main.ts is still in place here: this commit adds the guarded
 * route beside it and changes no existing behaviour. The client switch and the
 * mount's removal are the two commits that follow.
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
const MAX_TTL_SECONDS = 3600;

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
 * A valid signed token for THIS filename is enough. Otherwise fall through to
 * the normal Bearer check, so nothing is weakened for API callers.
 */
@Injectable()
export class FileAccessGuard extends AuthGuard('jwt') {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = typeof req.query?.t === 'string' ? req.query.t : null;
    const name = safeName(String((req.params as any)?.filename ?? ''));
    if (token && name && verifyFileToken(name, token)) return true;
    return super.canActivate(ctx);
  }
}

@ApiTags('Files')
@Controller('uploads')
export class FilesController {
  @Get(':filename')
  @UseGuards(FileAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Download an uploaded file',
    description:
      'Requires a Bearer token, or a signed ?t= token obtained from POST /uploads/:filename/link.',
  })
  @ApiQuery({ name: 't', required: false, description: 'Short-lived signed token' })
  serve(@Param('filename') filename: string, @Req() req: Request, @Res() res: Response) {
    const name = safeName(filename);
    if (!name) throw new BadRequestException('Invalid filename');

    const full = resolveInsideUploads(name);
    if (!full || !existsSync(full)) throw new NotFoundException('File not found');

    const stat = statSync(full);
    if (!stat.isFile()) throw new NotFoundException('File not found');

    const ext = extname(name).toLowerCase();
    const disposition = INLINE.has(ext) ? 'inline' : 'attachment';

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

    const requested = Number(ttl);
    const seconds = Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), MAX_TTL_SECONDS)
      : DEFAULT_TTL_SECONDS;

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
