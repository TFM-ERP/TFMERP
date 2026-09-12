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
import { parseRange, signFileToken, verifyFileToken } from './files.module';

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
