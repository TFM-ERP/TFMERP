import { createHmac, timingSafeEqual } from 'crypto';

/**
 * The file pass — what the HttpOnly cookie on /api/v1/uploads holds.
 *
 * An <img>, <audio>, <video> or <a> cannot send an Authorization header, and a per-file signed
 * link expires in the middle of a long playback. So a signed-in browser carries this instead: an
 * HMAC over who it is (sub), which login it came from (sid) and until when (exp). FileAccessGuard
 * accepts it on GET /api/v1/uploads/:filename and NOWHERE ELSE — no other route reads a cookie.
 *
 * It is not the JWT, and cannot be used as one: it opens files, not the API.
 *
 * It is keyed on JWT_SECRET, the same key as the per-file ?t= token in files.module.ts. What
 * keeps the two apart is the fixed prefix in the signed message below: a ?t= token signs
 * "<name>:<exp>:<nonce>", a pass signs "file-pass:v1:<exp>:<sub>:<sid>". Neither verifies as the
 * other, and file-pass.spec.ts crosses them both ways to keep it so.
 *
 * Pure: no Nest, no Prisma, no request object. Uses only node:crypto.
 */

export const FILE_PASS_COOKIE = 'tfm_file_pass';
export const FILE_PASS_PATH = '/api/v1/uploads';
/** Eight hours — the JWT's own default life (auth.module.ts). A pass never outlives its login. */
export const FILE_PASS_MAX_SECONDS = 8 * 3600;

const VERSION = 'v1';
const NO_SID = '-';
/** cuids and uuids both fit. No '.', which separates the fields, and no ':', which separates the signed message. */
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface FilePass {
  sub: string;
  sid: string | null;
  exp: number;
}

function secret(): string | null {
  const s = process.env.JWT_SECRET;
  return s && s.length ? s : null;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(key: string, exp: number, sub: string, sid: string): string {
  return b64url(createHmac('sha256', key).update(`file-pass:${VERSION}:${exp}:${sub}:${sid}`).digest());
}

export function signFilePass(p: { sub: string; sid?: string | null; exp: number }): string {
  const key = secret();
  if (!key) throw new Error('JWT_SECRET is not configured');
  const sid = p.sid || NO_SID;
  if (!ID.test(String(p.sub)) || (sid !== NO_SID && !ID.test(sid))) throw new Error('file pass: unusable id');
  if (!Number.isInteger(p.exp) || p.exp <= 0) throw new Error('file pass: unusable expiry');
  return `${VERSION}.${p.exp}.${p.sub}.${sid}.${sign(key, p.exp, p.sub, sid)}`;
}

/** The pass's fields, or null for anything that is not a live pass signed with this server's key. */
export function verifyFilePass(value: unknown, nowMs: number = Date.now()): FilePass | null {
  const key = secret();
  if (!key || typeof value !== 'string' || !value) return null;
  const parts = value.split('.');
  if (parts.length !== 5) return null;
  const [ver, expRaw, sub, sid, sig] = parts;
  if (ver !== VERSION) return null;
  if (!/^\d{1,12}$/.test(expRaw)) return null;
  const exp = Number(expRaw);
  if (exp * 1000 < nowMs) return null;
  if (!ID.test(sub) || (sid !== NO_SID && !ID.test(sid))) return null;
  const a = Buffer.from(sign(key, exp, sub, sid));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { sub, sid: sid === NO_SID ? null : sid, exp };
}

/**
 * One cookie's value out of a raw Cookie header, by exact name. Hand-rolled on purpose: this is
 * the only place in the backend that reads a cookie, and it does not justify cookie-parser.
 */
export function readCookie(header: unknown, name: string): string | null {
  if (typeof header !== 'string' || !header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/** When a pass minted now should expire, in epoch seconds: the login's own expiry, at most eight hours out. */
export function passExpiry(jwtExpSeconds: number | null, nowMs: number): number {
  const ceiling = Math.floor(nowMs / 1000) + FILE_PASS_MAX_SECONDS;
  return jwtExpSeconds != null && Number.isFinite(jwtExpSeconds) ? Math.min(ceiling, Math.floor(jwtExpSeconds)) : ceiling;
}

/**
 * exp from a Bearer header's JWT, decoded and NOT verified. Only for a request JwtAuthGuard has
 * already let through — the guard verified this exact token; JwtStrategy.validate() just does not
 * hand exp on, and changing what it returns would change req.user for every route in the API.
 */
export function jwtExp(authorization: unknown): number | null {
  if (typeof authorization !== 'string') return null;
  const m = /^Bearer\s+([^\s.]+)\.([^\s.]+)\.[^\s.]+$/i.exec(authorization.trim());
  if (!m) return null;
  try {
    const exp = JSON.parse(Buffer.from(m[2], 'base64url').toString('utf8'))?.exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

function attributes(maxAge: number, secure: boolean): string {
  return `Max-Age=${maxAge}; Path=${FILE_PASS_PATH}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/** The Set-Cookie value that hands a browser its pass. Lives exactly as long as the pass does. */
export function filePassCookie(value: string, expSeconds: number, nowMs: number, secure: boolean): string {
  const maxAge = Math.max(0, expSeconds - Math.floor(nowMs / 1000));
  return `${FILE_PASS_COOKIE}=${value}; ${attributes(maxAge, secure)}`;
}

/**
 * The Set-Cookie value that removes it. This clears the cookie from the browser that asks; it
 * does not invalidate a pass value copied beforehand — only removing the session row does that.
 */
export function clearFilePassCookie(secure: boolean): string {
  return `${FILE_PASS_COOKIE}=; ${attributes(0, secure)}`;
}
