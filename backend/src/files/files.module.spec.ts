/**
 * Guarded uploads: the byte-range parser and the signed one-file token.
 * Run: npm run test:unit
 *
 * express.static answered a Range request with a 206. A controller that always
 * returns 200 leaves audio and video unable to seek, and 7,708 of the 7,911 files
 * in uploads/ are mp3 or mp4 — so the range rules are worth pinning.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SKIP_AUDIT } from '../audit/skip-audit.decorator';
import { FILE_PASS_COOKIE, signFilePass, verifyFilePass, readCookie } from './file-pass';

// files.module resolves its uploads directory from process.cwd() when it is first loaded. The
// handler tests below need a file on disk, and they must never write into the real uploads/ —
// so this spec moves to a throwaway directory BEFORE loading the module. node --test gives each
// spec file its own process, so the chdir reaches nothing else. The secret is a fixed test
// string set in-process; nothing here reads .env.
process.env.JWT_SECRET = 'files-module-spec-secret-not-a-real-one';
const SANDBOX = realpathSync(mkdtempSync(join(tmpdir(), 'tfm-files-spec-')));
mkdirSync(join(SANDBOX, 'uploads'));
writeFileSync(join(SANDBOX, 'uploads', 'real.pdf'), '%PDF-1.4 test');
process.chdir(SANDBOX);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const files = require('./files.module') as typeof import('./files.module');
const {
  parseRange, signFileToken, verifyFileToken,
  uploadName, signedUploadPath, linkTtl, MAX_TTL_SECONDS, SERVER_MAX_TTL_SECONDS,
  FileAccessGuard, FilesController,
} = files;

const SIZE = 1000;

test('no Range header, or one this route will not interpret, serves the whole file', () => {
  for (const h of [undefined, null, '', 'bytes=', 'bytes=abc-def', 'items=0-10', 'bytes=0-99, 200-299', 'bytes=0-99,200-299', 'bytes 0-99', 5 as any]) {
    assert.equal(parseRange(h as any, SIZE), null, JSON.stringify(h));
  }
});

test('a plain range is inclusive, and Content-Length is end - start + 1', () => {
  assert.deepEqual(parseRange('bytes=0-99', SIZE), { start: 0, end: 99 });
  const r = parseRange('bytes=0-99', SIZE) as { start: number; end: number };
  assert.equal(r.end - r.start + 1, 100);
  assert.deepEqual(parseRange('bytes=500-700', SIZE), { start: 500, end: 700 });
});

test('an open-ended range runs to the last byte', () => {
  assert.deepEqual(parseRange('bytes=500-', SIZE), { start: 500, end: 999 });
  assert.deepEqual(parseRange('bytes=0-', SIZE), { start: 0, end: 999 });
});

test('a suffix range is the LAST n bytes, and a suffix larger than the file is the whole file', () => {
  assert.deepEqual(parseRange('bytes=-100', SIZE), { start: 900, end: 999 });
  assert.deepEqual(parseRange('bytes=-5000', SIZE), { start: 0, end: 999 });
  assert.equal(parseRange('bytes=-0', SIZE), 'invalid');
});

test('an end past the file is clamped, not refused — a player asking for more gets what exists', () => {
  assert.deepEqual(parseRange('bytes=900-5000', SIZE), { start: 900, end: 999 });
});

test('UNSATISFIABLE IS 416, NOT A WHOLE FILE: a start past the end, a reversed range, an empty file', () => {
  assert.equal(parseRange('bytes=1000-1100', SIZE), 'invalid');
  assert.equal(parseRange('bytes=5000-', SIZE), 'invalid');
  assert.equal(parseRange('bytes=700-500', SIZE), 'invalid');
  assert.equal(parseRange('bytes=0-10', 0), 'invalid');
});

test('whitespace around the header is tolerated', () => {
  assert.deepEqual(parseRange('  bytes=0-99  ', SIZE), { start: 0, end: 99 });
});

test('a signed token opens ONE filename, and nothing else', () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';
  const { token } = signFileToken('a.pdf', 300);
  assert.equal(verifyFileToken('a.pdf', token), true);
  assert.equal(verifyFileToken('b.pdf', token), false, 'the same token must not open a different file');
});

test('a tampered, truncated or expired token is refused', () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';
  const { token } = signFileToken('a.pdf', 300);
  const [exp, nonce, sig] = token.split('.');
  assert.equal(verifyFileToken('a.pdf', [exp, nonce, sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')].join('.')), false, 'flipped signature');
  assert.equal(verifyFileToken('a.pdf', [exp, nonce].join('.')), false, 'missing part');
  assert.equal(verifyFileToken('a.pdf', [exp, nonce, sig.slice(0, -2)].join('.')), false, 'short signature');
  const past = signFileToken('a.pdf', -10);
  assert.equal(verifyFileToken('a.pdf', past.token), false, 'expired');
});

test('the expiry the caller is told matches the one inside the token', () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';
  const { token, expiresAt } = signFileToken('a.pdf', 60);
  assert.equal(Number(token.split('.')[0]), Math.floor(expiresAt.getTime() / 1000));
});

// ── Stored path → filename, and the server-side signer ─────────────────────────────────────────

test('uploadName takes a bare filename out of every shape a stored path arrives in', () => {
  assert.equal(uploadName('/uploads/a.pdf'), 'a.pdf');
  assert.equal(uploadName('a.pdf'), 'a.pdf');
  assert.equal(uploadName('/api/v1/uploads/a.pdf'), 'a.pdf');
  assert.equal(uploadName('/api/v1/uploads/a.pdf?t=123.abc.def'), 'a.pdf');
  assert.equal(uploadName('/uploads/a.mp4#t=0.1'), 'a.mp4');
});

test('uploadName refuses what is not an upload: external URLs, nothing, traversal, a name the route would reject', () => {
  for (const u of ['http://x.test/y.pdf', 'https://x.test/uploads/y.pdf', 'data:image/png;base64,AAAA', 'blob:http://x/1',
    '', '   ', null, undefined, '/uploads/../etc/passwd', '/uploads/a/b.pdf', '../a.pdf', '/uploads/a b.pdf',
    '/uploads/', '/other/a.pdf', '/uploads/.hidden']) {
    assert.equal(uploadName(u as any), null, JSON.stringify(u));
  }
});

const expOf = (path: string) => Number(new URL(path, 'http://x').searchParams.get('t')!.split('.')[0]);
const near = (actual: number, ttl: number) => Math.abs(actual - (Math.floor(Date.now() / 1000) + ttl)) <= 2;

test('signedUploadPath signs ONE file under the guarded route, and nothing for a non-upload', () => {
  const p = signedUploadPath('/uploads/a.pdf', 60)!;
  assert.ok(p.startsWith('/api/v1/uploads/a.pdf?t='), p);
  const t = new URL(p, 'http://x').searchParams.get('t')!;
  assert.equal(verifyFileToken('a.pdf', t), true);
  assert.equal(verifyFileToken('b.pdf', t), false);
  assert.ok(near(expOf(p), 60));
  assert.equal(signedUploadPath('https://x.test/y.pdf', 60), null);
  assert.equal(signedUploadPath(null, 60), null);
});

test('TWO CEILINGS: a link defaults to the browser-facing one hour; only a named server caller gets four', () => {
  assert.equal(MAX_TTL_SECONDS, 3600, 'the browser-facing ceiling moved');
  assert.equal(SERVER_MAX_TTL_SECONDS, 14400);
  assert.ok(near(expOf(signedUploadPath('/uploads/a.mp3', 20000)!), 3600), 'default ceiling let a long TTL through');
  assert.ok(near(expOf(signedUploadPath('/uploads/a.mp3', 20000, 'link')!), 3600));
  assert.ok(near(expOf(signedUploadPath('/uploads/a.mp3', 20000, 'server')!), 14400));
  assert.ok(near(expOf(signedUploadPath('/uploads/a.mp3', 9000, 'server')!), 9000), 'a TTL under the server ceiling was changed');
  assert.ok(near(expOf(signedUploadPath('/uploads/a.mp3', 9000.9, 'server')!), 9000), 'fractions are floored');
});

test('a TTL of zero or less is floored to one second under either ceiling; a non-number falls back to an hour', () => {
  for (const c of ['link', 'server'] as const) {
    assert.ok(near(expOf(signedUploadPath('/uploads/a.mp3', 0, c)!), 1));
    assert.ok(near(expOf(signedUploadPath('/uploads/a.mp3', -5, c)!), 1));
    assert.ok(near(expOf(signedUploadPath('/uploads/a.mp3', Number.NaN, c)!), 3600));
    assert.ok(near(expOf(signedUploadPath('/uploads/a.mp3', Infinity, c)!), 3600));
  }
  assert.ok(near(expOf(signedUploadPath('/uploads/a.mp3')!), 3600));
});

test('THE BROWSER-FACING CLAMP HOLDS: POST /uploads/:filename/link with ttl=14400 still gets 3600', () => {
  assert.equal(linkTtl('14400'), 3600);
  assert.equal(linkTtl('3600'), 3600);
  assert.equal(linkTtl('3601'), 3600);
  assert.equal(linkTtl('60'), 60);
  assert.equal(linkTtl('60.9'), 60);
  for (const raw of [undefined, null, '', 'abc', '0', '-1', 'Infinity']) assert.equal(linkTtl(raw), 300, JSON.stringify(raw));
  // and through the handler itself, on a real file
  const res = new FilesController().link('real.pdf', '14400');
  assert.equal(res.ttlSeconds, 3600);
  assert.ok(near(expOf(res.url), 3600));
  assert.equal(new FilesController().link('real.pdf').ttlSeconds, 300);
});

// ── The guard: Bearer, ?t=, or the cookie — and the cookie on GET only ─────────────────────────

const LIVE_USER = { id: 'user1', isActive: true };
function prismaStub(o: { user?: any; session?: any } = {}) {
  const calls: string[] = [];
  return {
    calls,
    user: { findUnique: async () => { calls.push('user'); return 'user' in o ? o.user : LIVE_USER; } },
    userSession: {
      findUnique: async () => { calls.push('session'); return 'session' in o ? o.session : { id: 'sess1', userId: 'user1' }; },
      update: async () => { calls.push('session.update'); return {}; },
    },
  };
}
/** The guard with its Bearer fallback replaced by a recorder, so a test can tell which door was used. */
function guardWith(prisma: any) {
  const g: any = new (FileAccessGuard as any)(prisma);
  g.fellBack = 0;
  g.bearer = async () => { g.fellBack++; return false; };
  return g;
}
function ctxOf(req: any) {
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}
const future = () => Math.floor(Date.now() / 1000) + 3600;
const cookieOf = (value: string) => `other=1; ${FILE_PASS_COOKIE}=${value}`;
const reqWith = (o: { method?: string; cookie?: string; t?: string; filename?: string }) => ({
  method: o.method ?? 'GET', headers: o.cookie ? { cookie: o.cookie } : {}, query: o.t ? { t: o.t } : {}, params: { filename: o.filename ?? 'a.pdf' },
} as any);

test('a valid pass on GET, from a live session, is let in without Bearer — and the request knows who it is', async () => {
  const prisma = prismaStub();
  const g = guardWith(prisma);
  const req = reqWith({ cookie: cookieOf(signFilePass({ sub: 'user1', sid: 'sess1', exp: future() })) });
  assert.equal(await g.canActivate(ctxOf(req)), true);
  assert.equal(g.fellBack, 0);
  assert.deepEqual(req.user, { id: 'user1', sessionId: 'sess1' });
  assert.ok(!prisma.calls.includes('session.update'), 'a file request must not write a heartbeat — every seek is a request');
});

test('HEAD is read-only too, and takes the pass', async () => {
  const g = guardWith(prismaStub());
  assert.equal(await g.canActivate(ctxOf(reqWith({ method: 'HEAD', cookie: cookieOf(signFilePass({ sub: 'user1', sid: 'sess1', exp: future() })) }))), true);
});

test('THE COOKIE IS IGNORED OFF GET: the same valid pass on POST, PUT, PATCH or DELETE falls through to Bearer', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const prisma = prismaStub();
    const g = guardWith(prisma);
    const req = reqWith({ method, cookie: cookieOf(signFilePass({ sub: 'user1', sid: 'sess1', exp: future() })) });
    assert.equal(await g.canActivate(ctxOf(req)), false, method);
    assert.equal(g.fellBack, 1, `${method} did not fall through to Bearer`);
    assert.equal(req.user, undefined);
    assert.deepEqual(prisma.calls, [], `${method} looked the pass up at all`);
  }
});

test('A REVOKED OR UNKNOWN SESSION IS REFUSED: a well-signed pass whose session row is gone falls through', async () => {
  const pass = cookieOf(signFilePass({ sub: 'user1', sid: 'sess-gone', exp: future() }));
  const g = guardWith(prismaStub({ session: null }));
  assert.equal(await g.canActivate(ctxOf(reqWith({ cookie: pass }))), false);
  assert.equal(g.fellBack, 1);
  // a session row that belongs to someone else is no better
  const g2 = guardWith(prismaStub({ session: { id: 'sess-gone', userId: 'someone-else' } }));
  assert.equal(await g2.canActivate(ctxOf(reqWith({ cookie: pass }))), false);
  assert.equal(g2.fellBack, 1);
});

test('an inactive or deleted user is refused, pass or no pass', async () => {
  const pass = cookieOf(signFilePass({ sub: 'user1', sid: 'sess1', exp: future() }));
  for (const user of [null, { id: 'user1', isActive: false }]) {
    const g = guardWith(prismaStub({ user }));
    assert.equal(await g.canActivate(ctxOf(reqWith({ cookie: pass }))), false);
    assert.equal(g.fellBack, 1);
  }
});

test('AN EXPIRED PASS AND A FORGED PASS ARE REFUSED, and neither reaches the database', async () => {
  const expired = signFilePass({ sub: 'user1', sid: 'sess1', exp: Math.floor(Date.now() / 1000) - 10 });
  const good = signFilePass({ sub: 'user1', sid: 'sess1', exp: future() });
  const forged = good.slice(0, -1) + (good.endsWith('A') ? 'B' : 'A');
  const otherUser = good.replace('.user1.', '.user2.');
  const fileTokenAsPass = signFileToken('a.pdf', 300).token;
  for (const [label, value] of [['expired', expired], ['forged', forged], ['re-addressed', otherUser], ['a ?t= token', fileTokenAsPass], ['junk', 'v1.9999999999.x.y.AAAA'], ['empty', '']] as const) {
    const prisma = prismaStub();
    const g = guardWith(prisma);
    assert.equal(await g.canActivate(ctxOf(reqWith({ cookie: cookieOf(value) }))), false, label);
    assert.equal(g.fellBack, 1, label);
    assert.deepEqual(prisma.calls, [], `${label} pass reached the database`);
  }
});

test('no cookie at all falls through to Bearer, as it always did', async () => {
  const g = guardWith(prismaStub());
  assert.equal(await g.canActivate(ctxOf(reqWith({}))), false);
  assert.equal(g.fellBack, 1);
});

test('a pass with no session id (a legacy login) is let in on the user alone', async () => {
  const prisma = prismaStub();
  const g = guardWith(prisma);
  const req = reqWith({ cookie: cookieOf(signFilePass({ sub: 'user1', exp: future() })) });
  assert.equal(await g.canActivate(ctxOf(req)), true);
  assert.deepEqual(prisma.calls, ['user']);
  assert.deepEqual(req.user, { id: 'user1', sessionId: undefined });
});

test('a valid ?t= for this filename still opens it with no cookie and no database', async () => {
  const prisma = prismaStub();
  const g = guardWith(prisma);
  assert.equal(await g.canActivate(ctxOf(reqWith({ t: signFileToken('a.pdf', 300).token }))), true);
  assert.equal(g.fellBack, 0);
  assert.deepEqual(prisma.calls, []);
  // ...and a ?t= for another file does not
  const g2 = guardWith(prismaStub());
  assert.equal(await g2.canActivate(ctxOf(reqWith({ t: signFileToken('b.pdf', 300).token }))), false);
});

// ── Structure: which handler reads the cookie, and which never may ─────────────────────────────

const proto = FilesController.prototype as any;
const guardsOf = (m: string): any[] => Reflect.getMetadata(GUARDS_METADATA, proto[m]) || [];
const routeOf = (m: string) => `${RequestMethod[Reflect.getMetadata(METHOD_METADATA, proto[m])]} ${Reflect.getMetadata(PATH_METADATA, proto[m])}`;

test('NO OTHER ROUTE READS THE COOKIE: FileAccessGuard sits on GET :filename and on no other handler', () => {
  const handlers = Object.getOwnPropertyNames(proto).filter((m) => m !== 'constructor' && Reflect.getMetadata(PATH_METADATA, proto[m]) !== undefined);
  assert.deepEqual(handlers.map(routeOf).sort(), ['DELETE session', 'GET :filename', 'POST :filename/link', 'POST session']);
  const withFileGuard = handlers.filter((m) => guardsOf(m).includes(FileAccessGuard));
  assert.deepEqual(withFileGuard.map(routeOf), ['GET :filename']);
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, FilesController) || [], [], 'a class-level guard would put the cookie on every route here');
});

test('minting a pass and minting a link take Bearer only — a pass cannot renew itself', () => {
  assert.deepEqual(guardsOf('session'), [JwtAuthGuard]);
  assert.deepEqual(guardsOf('link'), [JwtAuthGuard]);
});

test('clearing needs no credentials — the 401 path has none — and takes no guard', () => {
  assert.deepEqual(guardsOf('clearSession'), []);
});

test('neither session route writes an audit row: a refresh every twenty minutes is not an event', () => {
  assert.equal(Reflect.getMetadata(SKIP_AUDIT, proto.session), true);
  assert.equal(Reflect.getMetadata(SKIP_AUDIT, proto.clearSession), true);
});

// ── The session handlers ───────────────────────────────────────────────────────────────────────

function resStub() {
  const headers: Record<string, string> = {};
  return { headers, setHeader: (k: string, v: string) => { headers[k] = v; } } as any;
}
const seg = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const bearerWithExp = (exp: number) => `Bearer ${seg({ alg: 'HS256' })}.${seg({ sub: 'user1', exp })}.sig`;

test('POST session hands back a cookie bound to this user and this login, living as long as the login', () => {
  const jwtExpiry = Math.floor(Date.now() / 1000) + 2 * 3600;
  const res = resStub();
  const out = new FilesController().session({ user: { id: 'user1', sessionId: 'sess1' }, headers: { authorization: bearerWithExp(jwtExpiry) } } as any, res);
  const cookie = res.headers['Set-Cookie'];
  assert.ok(cookie, 'no Set-Cookie');
  for (const part of ['HttpOnly', 'SameSite=Lax', 'Path=/api/v1/uploads']) assert.ok(cookie.split('; ').includes(part), part);
  assert.ok(!cookie.split('; ').includes('Secure'), 'Secure without FILE_PASS_SECURE=true');
  assert.deepEqual(verifyFilePass(readCookie(cookie.split('; ')[0], FILE_PASS_COOKIE)), { sub: 'user1', sid: 'sess1', exp: jwtExpiry });
  assert.equal(out.expiresAt, new Date(jwtExpiry * 1000).toISOString());
  assert.deepEqual(Object.keys(out), ['expiresAt'], 'the pass value must not be in the response body');
});

test('POST session caps the pass at eight hours when the login runs longer, and sets Secure only when the env flag says so', () => {
  const res = resStub();
  const keep = process.env.FILE_PASS_SECURE;
  process.env.FILE_PASS_SECURE = 'true';
  try {
    const out = new FilesController().session({ user: { id: 'user1' }, headers: { authorization: bearerWithExp(Math.floor(Date.now() / 1000) + 20 * 3600) } } as any, res);
    assert.ok(Math.abs(new Date(out.expiresAt).getTime() / 1000 - (Date.now() / 1000 + 8 * 3600)) <= 2);
    assert.ok(res.headers['Set-Cookie'].split('; ').includes('Secure'));
    assert.equal(verifyFilePass(readCookie(res.headers['Set-Cookie'].split('; ')[0], FILE_PASS_COOKIE))!.sid, null);
  } finally { if (keep === undefined) delete process.env.FILE_PASS_SECURE; else process.env.FILE_PASS_SECURE = keep; }
});

test('DELETE session answers with the clearing cookie and reads nothing', () => {
  const res = resStub();
  assert.deepEqual(new FilesController().clearSession(res), { cleared: true });
  assert.ok(res.headers['Set-Cookie'].startsWith(`${FILE_PASS_COOKIE}=;`));
  assert.ok(res.headers['Set-Cookie'].split('; ').includes('Max-Age=0'));
});

// ── ?dl=1 ──────────────────────────────────────────────────────────────────────────────────────

function serveInto(query: any) {
  const headers: Record<string, string> = {};
  const res: any = {
    setHeader: (k: string, v: string) => { headers[k] = v; }, status: () => res, end: () => undefined,
    on: () => res, once: () => res, emit: () => true, write: () => true, removeListener: () => res,
  };
  new FilesController().serve('real.pdf', { headers: {}, query } as any, res);
  return headers;
}

test('?dl=1 forces a download; without it a PDF still renders in place', () => {
  assert.equal(serveInto({})['Content-Disposition'], 'inline; filename="real.pdf"');
  assert.equal(serveInto({ dl: '1' })['Content-Disposition'], 'attachment; filename="real.pdf"');
  assert.equal(serveInto({ dl: '0' })['Content-Disposition'], 'inline; filename="real.pdf"');
  assert.equal(serveInto({ dl: 'true' })['Content-Disposition'], 'inline; filename="real.pdf"', 'only the literal 1 switches it');
});
