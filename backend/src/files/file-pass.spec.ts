/**
 * The file pass: the value inside the HttpOnly cookie that lets an <img>, <audio> or <video>
 * reach GET /api/v1/uploads/:filename without an Authorization header.
 * Run: npm run test:unit
 *
 * It is NOT the JWT. It is an HMAC over who (sub), which login (sid) and until when (exp), with
 * a fixed prefix in the signed message so it can never be replayed as a per-file ?t= token, nor
 * a ?t= token as a pass — both are keyed on JWT_SECRET, so the prefix is the only wall between
 * them and the crossed-token test below is what keeps it standing.
 *
 * The secret here is a fixed test string set in-process. Nothing in this file reads .env.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';

process.env.JWT_SECRET = 'file-pass-spec-secret-not-a-real-one';

import {
  FILE_PASS_COOKIE, FILE_PASS_PATH, FILE_PASS_MAX_SECONDS,
  signFilePass, verifyFilePass, readCookie, passExpiry, jwtExp, filePassCookie, clearFilePassCookie,
} from './file-pass';
import { signFileToken, verifyFileToken } from './files.module';

const NOW = Date.UTC(2026, 9, 10, 12, 0, 0);
const nowSec = Math.floor(NOW / 1000);
const future = nowSec + 3600;

test('a pass round-trips who, which login, and until when', () => {
  const v = signFilePass({ sub: 'user1', sid: 'sess1', exp: future });
  assert.deepEqual(verifyFilePass(v, NOW), { sub: 'user1', sid: 'sess1', exp: future });
});

test('a pass with no session id round-trips as sid: null — the legacy-login case', () => {
  assert.deepEqual(verifyFilePass(signFilePass({ sub: 'user1', exp: future }), NOW), { sub: 'user1', sid: null, exp: future });
  assert.deepEqual(verifyFilePass(signFilePass({ sub: 'user1', sid: null, exp: future }), NOW), { sub: 'user1', sid: null, exp: future });
});

test('AN EXPIRED PASS IS REFUSED — signed here with exp in the past, which the live lock script cannot do', () => {
  const v = signFilePass({ sub: 'user1', sid: 'sess1', exp: nowSec - 1 });
  assert.equal(verifyFilePass(v, NOW), null);
  // and the same value was good one second before it expired
  assert.notEqual(verifyFilePass(v, NOW - 5000), null);
});

test('a forged pass is refused: any field changed after signing, or the signature itself', () => {
  const v = signFilePass({ sub: 'user1', sid: 'sess1', exp: future });
  const [ver, exp, sub, sid, sig] = v.split('.');
  const flip = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A');
  assert.equal(verifyFilePass([ver, exp, sub, sid, flip].join('.'), NOW), null, 'flipped signature');
  assert.equal(verifyFilePass([ver, exp, 'user2', sid, sig].join('.'), NOW), null, 'another user');
  assert.equal(verifyFilePass([ver, exp, sub, 'sess2', sig].join('.'), NOW), null, 'another session');
  assert.equal(verifyFilePass([ver, exp, sub, '-', sig].join('.'), NOW), null, 'session stripped');
  assert.equal(verifyFilePass([ver, String(future + 86400), sub, sid, sig].join('.'), NOW), null, 'life extended');
  assert.equal(verifyFilePass(['v2', exp, sub, sid, sig].join('.'), NOW), null, 'wrong version');
  assert.equal(verifyFilePass([ver, exp, sub, sig].join('.'), NOW), null, 'four parts');
  assert.equal(verifyFilePass([ver, exp, sub, sid, sig.slice(0, -2)].join('.'), NOW), null, 'short signature');
  for (const junk of ['', 'v1', 'v1....', 'not-a-pass', undefined as any, null as any, 5 as any]) {
    assert.equal(verifyFilePass(junk, NOW), null, JSON.stringify(junk));
  }
});

test('a pass cannot be signed for an id that would break its own format', () => {
  assert.throws(() => signFilePass({ sub: 'a.b', exp: future }));
  assert.throws(() => signFilePass({ sub: 'a:b', exp: future }));
  assert.throws(() => signFilePass({ sub: '', exp: future }));
  assert.throws(() => signFilePass({ sub: 'user1', sid: 's.1', exp: future }));
  assert.throws(() => signFilePass({ sub: 'user1', exp: Number.NaN }));
});

test('CROSSED TOKENS, BOTH WAYS: a pass is not a ?t= token and a ?t= token is not a pass', () => {
  const pass = signFilePass({ sub: 'user1', sid: 'sess1', exp: future });
  const fileToken = signFileToken('a.pdf', 300).token;
  assert.equal(verifyFileToken('a.pdf', pass), false, 'a pass opened a file as a ?t= token');
  assert.equal(verifyFileToken('file-pass', pass), false);
  assert.equal(verifyFilePass(fileToken), null, 'a ?t= token was accepted as a pass');
  // sanity: each is valid as itself, so the two refusals above are about the kind, not a bad value
  assert.equal(verifyFileToken('a.pdf', fileToken), true);
  assert.notEqual(verifyFilePass(pass, NOW), null);
});

test('with no secret configured: signing throws, verifying refuses', () => {
  const keep = process.env.JWT_SECRET;
  const v = signFilePass({ sub: 'user1', exp: future });
  delete process.env.JWT_SECRET;
  try {
    assert.equal(verifyFilePass(v, NOW), null);
    assert.throws(() => signFilePass({ sub: 'user1', exp: future }));
  } finally { process.env.JWT_SECRET = keep; }
});

test('readCookie finds one name among several, by exact name', () => {
  assert.equal(readCookie(`a=1; ${FILE_PASS_COOKIE}=abc.def; b=2`, FILE_PASS_COOKIE), 'abc.def');
  assert.equal(readCookie(`${FILE_PASS_COOKIE}=abc`, FILE_PASS_COOKIE), 'abc');
  assert.equal(readCookie(`${FILE_PASS_COOKIE}_x=nope; x${FILE_PASS_COOKIE}=nope`, FILE_PASS_COOKIE), null, 'a longer name is a different cookie');
  assert.equal(readCookie(`${FILE_PASS_COOKIE}=first; ${FILE_PASS_COOKIE}=second`, FILE_PASS_COOKIE), 'first');
  assert.equal(readCookie('a=1; b=2', FILE_PASS_COOKIE), null);
  for (const h of [undefined, null, '', 5, ['x=1'], {}]) assert.equal(readCookie(h, FILE_PASS_COOKIE), null, JSON.stringify(h));
});

test('a pass never outlives the login it came from, and never exceeds eight hours', () => {
  assert.equal(FILE_PASS_MAX_SECONDS, 8 * 3600);
  assert.equal(passExpiry(nowSec + 2 * 3600, NOW), nowSec + 2 * 3600, 'a JWT with 2h left');
  assert.equal(passExpiry(nowSec + 20 * 3600, NOW), nowSec + 8 * 3600, 'a JWT with 20h left');
  assert.equal(passExpiry(null, NOW), nowSec + 8 * 3600, 'a JWT with no exp');
});

test('jwtExp reads exp out of a Bearer header without verifying it — the guard already did', () => {
  const seg = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = (payload: object) => `${seg({ alg: 'HS256' })}.${seg(payload)}.sig`;
  assert.equal(jwtExp(`Bearer ${jwt({ sub: 'u', exp: 1790000000 })}`), 1790000000);
  assert.equal(jwtExp(`bearer ${jwt({ sub: 'u', exp: 1790000000 })}`), 1790000000);
  assert.equal(jwtExp(`Bearer ${jwt({ sub: 'u' })}`), null);
  assert.equal(jwtExp(`Bearer ${jwt({ exp: 'soon' })}`), null);
  for (const h of [undefined, null, '', 'Bearer', 'Bearer a.b', 'Bearer a.!!!.c', 'Basic abc', 5]) assert.equal(jwtExp(h), null, JSON.stringify(h));
});

test('the cookie is HttpOnly, Lax, scoped to the uploads path, and Secure only when asked', () => {
  assert.equal(FILE_PASS_PATH, '/api/v1/uploads');
  const c = filePassCookie('VALUE', nowSec + 600, NOW, false);
  assert.ok(c.startsWith(`${FILE_PASS_COOKIE}=VALUE;`), c);
  for (const part of ['HttpOnly', 'SameSite=Lax', 'Path=/api/v1/uploads', 'Max-Age=600']) assert.ok(c.split('; ').includes(part), `${part} missing from ${c}`);
  assert.ok(!/;\s*Secure/i.test(c), 'Secure set without being asked');
  assert.ok(filePassCookie('VALUE', nowSec + 600, NOW, true).split('; ').includes('Secure'));
  assert.ok(filePassCookie('VALUE', nowSec - 5, NOW, false).split('; ').includes('Max-Age=0'), 'a past expiry must not produce a negative Max-Age');
});

test('the clearing cookie has the same name and path, an empty value, and Max-Age=0', () => {
  const c = clearFilePassCookie(false);
  assert.ok(c.startsWith(`${FILE_PASS_COOKIE}=;`), c);
  for (const part of ['HttpOnly', 'SameSite=Lax', 'Path=/api/v1/uploads', 'Max-Age=0']) assert.ok(c.split('; ').includes(part), `${part} missing from ${c}`);
  assert.ok(clearFilePassCookie(true).split('; ').includes('Secure'));
});
