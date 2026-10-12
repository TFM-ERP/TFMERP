import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jwtExpMs, needsMint, nextRefreshDelay, REFRESH_MARGIN_MS, REFRESH_EVERY_MS, REFRESH_FLOOR_MS, FIRST_PAINT_HOLD_MS } from './file-pass.logic.ts';

const NOW = Date.UTC(2026, 9, 12, 9, 0, 0);
const MIN = 60_000;
const HOUR = 60 * MIN;

test('the numbers the plan fixes: 10 min margin, 20 min cadence, 30 s floor, 3 s first-paint hold', () => {
  assert.deepEqual([REFRESH_MARGIN_MS, REFRESH_EVERY_MS, REFRESH_FLOOR_MS, FIRST_PAINT_HOLD_MS], [10 * MIN, 20 * MIN, 30_000, 3000]);
});

// ── needsMint ────────────────────────────────────────────────────────────────

test('no expiry held — every fresh page load — means mint', () => {
  assert.equal(needsMint(null, NOW + 8 * HOUR, NOW), true);
  assert.equal(needsMint(null, null, NOW), true);
});

test('9 minutes left on the pass and hours left on the login: mint', () => {
  assert.equal(needsMint(NOW + 9 * MIN, NOW + 5 * HOUR, NOW), true);
});

test('11 minutes left: no mint yet', () => {
  assert.equal(needsMint(NOW + 11 * MIN, NOW + 5 * HOUR, NOW), false);
});

test('a pass already past, with a live login: mint', () => {
  assert.equal(needsMint(NOW - MIN, NOW + 5 * HOUR, NOW), true);
});

test('9 MINUTES LEFT AND THE PASS ENDS WITH THE LOGIN: no mint — it could not last any longer', () => {
  const end = NOW + 9 * MIN;
  assert.equal(needsMint(end, end, NOW), false);
  assert.equal(needsMint(end + 400, end, NOW), false, 'the server rounds to whole seconds');
  assert.equal(needsMint(end - 400, end, NOW), false, 'the server rounds to whole seconds');
});

test('with no readable login expiry the pass is judged on its own time left', () => {
  assert.equal(needsMint(NOW + 9 * MIN, null, NOW), true);
  assert.equal(needsMint(NOW + 11 * MIN, null, NOW), false);
});

// ── nextRefreshDelay ─────────────────────────────────────────────────────────

test('8 hours left on the pass, login lasting longer: ask again in 20 minutes', () => {
  assert.equal(nextRefreshDelay(NOW + 8 * HOUR, NOW + 9 * HOUR, NOW), 20 * MIN);
});

test('25 minutes left: ask in 15, so the refresh lands 10 minutes before expiry', () => {
  assert.equal(nextRefreshDelay(NOW + 25 * MIN, NOW + 5 * HOUR, NOW), 15 * MIN);
});

test('already past, or inside the margin, with a live login: the 30 s floor', () => {
  assert.equal(nextRefreshDelay(NOW - MIN, NOW + 5 * HOUR, NOW), 30_000);
  assert.equal(nextRefreshDelay(NOW + 9 * MIN, NOW + 5 * HOUR, NOW), 30_000);
  assert.equal(nextRefreshDelay(NOW + 10 * MIN + 5000, NOW + 5 * HOUR, NOW), 30_000);
});

test('NO 30-SECOND LOOP AT THE END OF A LOGIN: the pass ends with the login -> stop (null)', () => {
  const end = NOW + 9 * MIN;
  assert.equal(nextRefreshDelay(end, end, NOW), null);
  assert.equal(nextRefreshDelay(NOW + 3 * HOUR, NOW + 3 * HOUR, NOW), null, 'hours left, but still nothing to gain');
});

test('a login that is already over: stop', () => {
  assert.equal(nextRefreshDelay(null, NOW - MIN, NOW), null);
  assert.equal(nextRefreshDelay(NOW - MIN, NOW - MIN, NOW), null);
});

test('no expiry held (the mint failed) and a live login: try again at the floor, not at once', () => {
  assert.equal(nextRefreshDelay(null, NOW + 5 * HOUR, NOW), 30_000);
  assert.equal(nextRefreshDelay(null, null, NOW), 30_000);
});

// ── jwtExpMs ─────────────────────────────────────────────────────────────────

const seg = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: object) => `${seg({ alg: 'HS256', typ: 'JWT' })}.${seg(payload)}.c2ln`;

test('jwtExpMs reads exp from a well-formed token, in ms', () => {
  assert.equal(jwtExpMs(jwt({ sub: 'u1', sid: 's1', exp: 1791800000 })), 1791800000_000);
});

test('jwtExpMs copes with a payload whose base64url needs padding or uses - and _', () => {
  for (const sub of ['a', 'ab', 'abc', 'abcd', 'ÿþý>>??']) assert.equal(jwtExpMs(jwt({ sub, exp: 1791800000 })), 1791800000_000, sub);
});

test('jwtExpMs is null for a token with no exp, a non-numeric exp, garbage and nothing', () => {
  assert.equal(jwtExpMs(jwt({ sub: 'u1' })), null);
  assert.equal(jwtExpMs(jwt({ exp: 'soon' })), null);
  for (const bad of [null, undefined, '', 'abc', 'a.b', 'a.b.c', 'a.!!!.c', `${seg({})}.${Buffer.from('not json').toString('base64url')}.x`]) assert.equal(jwtExpMs(bad), null, String(bad));
});
