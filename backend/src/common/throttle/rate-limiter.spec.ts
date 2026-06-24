/**
 * Pure fixed-window rate limiter — unit tests (node:test + ts-node). Run: npm run test:unit
 * `now` is injected so the window logic is deterministic (no Date.now in the core).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { RateLimiter } from './rate-limiter';

test('allows up to the limit within a window, then blocks with a retry delay', () => {
  const rl = new RateLimiter(3, 1000);
  assert.equal(rl.check('a', 0).allowed, true);   // 1
  assert.equal(rl.check('a', 100).allowed, true); // 2
  const third = rl.check('a', 200);
  assert.equal(third.allowed, true);              // 3
  assert.equal(third.remaining, 0);
  const fourth = rl.check('a', 300);
  assert.equal(fourth.allowed, false);            // blocked
  assert.equal(fourth.retryAfterMs, 700);         // window started at 0 → resets at 1000
});

test('separate keys are tracked independently', () => {
  const rl = new RateLimiter(1, 1000);
  assert.equal(rl.check('ip1', 0).allowed, true);
  assert.equal(rl.check('ip1', 10).allowed, false);
  assert.equal(rl.check('ip2', 10).allowed, true); // different key unaffected
});

test('the window resets after it elapses', () => {
  const rl = new RateLimiter(2, 1000);
  rl.check('a', 0); rl.check('a', 0);
  assert.equal(rl.check('a', 999).allowed, false); // still in window
  assert.equal(rl.check('a', 1000).allowed, true); // window rolled over
});

test('remaining counts down from limit-1', () => {
  const rl = new RateLimiter(5, 1000);
  assert.equal(rl.check('a', 0).remaining, 4);
  assert.equal(rl.check('a', 0).remaining, 3);
});
