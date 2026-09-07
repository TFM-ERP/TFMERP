import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  totalInputTokens, totalTokens, runCostUsd, cacheDidEngage,
  MODEL_RATES, CACHE_READ_MULTIPLIER, CACHE_WRITE_5M_MULTIPLIER,
  trackPrefixCache, emptyStreak, PREFIX_BUST_AFTER,
} from './ai-cost.util';

// A cached scene call: the 2,892-token story context served from cache, a small uncached remainder.
const CACHED_SCENE = { inputTokens: 400, cacheReadTokens: 2892, cacheCreationTokens: 0, outputTokens: 353 };
// The first call of the same run: the context is WRITTEN to cache instead of read.
const FIRST_SCENE = { inputTokens: 400, cacheReadTokens: 0, cacheCreationTokens: 2892, outputTokens: 353 };
// A row from before caching existed: the two cache columns are NULL, not zero.
const LEGACY = { inputTokens: 5950, cacheReadTokens: null, cacheCreationTokens: null, outputTokens: 353 };

test('THE BUG THIS FILE EXISTS FOR: input_tokens alone under-reports a cached call', () => {
  // 400 is what the provider reports as input_tokens. The call really consumed 3,292.
  assert.equal(CACHED_SCENE.inputTokens, 400);
  assert.equal(totalInputTokens(CACHED_SCENE), 3292);
  assert.ok(totalInputTokens(CACHED_SCENE) > CACHED_SCENE.inputTokens * 8,
    'the gap is not a rounding detail - it is most of the input');
});

test('a pre-caching row is unchanged by any of this — NULL reads as zero', () => {
  assert.equal(totalInputTokens(LEGACY), 5950, 'identical to the old inputTokens figure');
  assert.equal(totalTokens(LEGACY), 6303);
});

test('totalTokens is what a token CAP should meter — cached tokens are cheaper, not absent', () => {
  assert.equal(totalTokens(CACHED_SCENE), 3645);
  assert.equal(totalTokens(FIRST_SCENE), 3645, 'read or written, the model still processed them');
});

test('the three input classes are priced apart, not summed at one rate', () => {
  const r = MODEL_RATES['claude-opus-5'];
  const cost = runCostUsd('claude-opus-5', CACHED_SCENE)!;
  const expected = (400 + 2892 * CACHE_READ_MULTIPLIER) * r.inputPerM / 1e6 + 353 * r.outputPerM / 1e6;
  assert.ok(Math.abs(cost - expected) < 1e-12, 'a read must be billed at a tenth, not at full rate');
  // And the naive "price the sum at 1x" figure it replaces would be materially higher.
  const naive = 3292 * r.inputPerM / 1e6 + 353 * r.outputPerM / 1e6;
  assert.ok(naive > cost * 1.5, 'treating reads as full-price input overstates a cached call');
});

test('a cache WRITE costs more than the tokens it holds, and more than a read of the same size', () => {
  const write = runCostUsd('claude-opus-5', FIRST_SCENE)!;
  const read = runCostUsd('claude-opus-5', CACHED_SCENE)!;
  assert.ok(write > read, 'the first call of a run is the expensive one');
  const r = MODEL_RATES['claude-opus-5'];
  const expected = (400 + 2892 * CACHE_WRITE_5M_MULTIPLIER) * r.inputPerM / 1e6 + 353 * r.outputPerM / 1e6;
  assert.ok(Math.abs(write - expected) < 1e-12, '5-minute write is 1.25x');
});

test('the 1-hour TTL is priced at 2x — the reason this codebase does not use it', () => {
  const fiveMin = runCostUsd('claude-opus-5', FIRST_SCENE, '5m')!;
  const oneHour = runCostUsd('claude-opus-5', FIRST_SCENE, '1h')!;
  assert.ok(oneHour > fiveMin, 'the 1h write premium is real and would be paid on every run');
});

test('caching pays for itself across a run — the measured shape of a 130-scene feature', () => {
  const uncached = 130 * runCostUsd('claude-opus-5', { inputTokens: 3292, outputTokens: 353 })!;
  const cached = runCostUsd('claude-opus-5', FIRST_SCENE)! + 129 * runCostUsd('claude-opus-5', CACHED_SCENE)!;
  assert.ok(cached < uncached, 'the whole point');
  const saving = uncached - cached;
  assert.ok(saving > 1 && saving < 3, 'saving lands in the measured $1.20-2.00/script band, got $' + saving.toFixed(2));
});

test('an unknown model returns null rather than a confidently wrong number', () => {
  assert.equal(runCostUsd('some-model-we-do-not-price', CACHED_SCENE), null);
  assert.equal(runCostUsd('', CACHED_SCENE), null);
  assert.notEqual(runCostUsd('claude-sonnet-5', CACHED_SCENE), null, 'the models actually routed to are priced');
});

test('cacheDidEngage: the silent-failure detector, not a cache-hit counter', () => {
  assert.equal(cacheDidEngage(false, CACHED_SCENE), null, 'no prefix sent - the question does not apply');
  assert.equal(cacheDidEngage(true, CACHED_SCENE), true, 'a read means it engaged');
  assert.equal(cacheDidEngage(true, FIRST_SCENE), true, 'a WRITE also means it engaged - first call of a run');
  assert.equal(cacheDidEngage(true, { inputTokens: 3292, cacheReadTokens: 0, cacheCreationTokens: 0 }), false,
    'both zero after asking for caching = the prefix was under the minimum and nothing was cached');
  assert.equal(cacheDidEngage(true, null), false);
});

test('junk in, a number out — this runs on the reporting path', () => {
  for (const bad of [undefined, null, {}, { inputTokens: NaN }, { cacheReadTokens: -5 }, { outputTokens: 'x' as any }]) {
    assert.doesNotThrow(() => totalTokens(bad as any));
    assert.ok(Number.isFinite(totalTokens(bad as any)), 'never NaN: ' + JSON.stringify(bad));
    assert.ok(totalTokens(bad as any) >= 0, 'never negative');
  }
  assert.equal(runCostUsd('claude-opus-5', {}), 0);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE EXPENSIVE FAILURE
//
// A prefix that is written every call and never read costs 1.25x instead of 1x - worse than not
// caching, and slower. cacheDidEngage cannot see it (read || write passes), which is exactly how a
// per-scene rule concatenated into the system prompt went unnoticed: `ctx` was byte-identical, the
// prefix ABOVE it was not, and every response looked like caching working.

const WRITE_ONLY = { cacheReadTokens: 0, cacheCreationTokens: 2892 };
const READ = { cacheReadTokens: 2892, cacheCreationTokens: 0 };

/** Drive a sequence of calls through the tracker; return every warning it raised. */
function runCalls(seq: Array<{ cacheReadTokens: number; cacheCreationTokens: number }>) {
  let streak = emptyStreak(); const warns: number[] = [];
  seq.forEach((t, i) => { const r = trackPrefixCache(streak, t); streak = r.next; if (r.warn) warns.push(i); });
  return { streak, warns };
}

test('THE GUARD MUST FAIL IN THE EXPENSIVE DIRECTION: write-every-call, read-never, warns', () => {
  const { warns, streak } = runCalls([WRITE_ONLY, WRITE_ONLY, WRITE_ONLY, WRITE_ONLY]);
  assert.ok(warns.length > 0, 'a busting prefix must be reported, not silently paid for');
  assert.equal(warns[0], PREFIX_BUST_AFTER - 1, 'it fires as soon as the pattern is established');
  assert.equal(streak.reads, 0);
  assert.equal(streak.writes, 4);
});

test('the FIRST call of a run writes and reads nothing — that is correct and must not warn', () => {
  const { warns } = runCalls([WRITE_ONLY]);
  assert.equal(warns.length, 0, 'one write is a run starting, not a bug');
  assert.equal(runCalls([WRITE_ONLY, WRITE_ONLY]).warns.length, 0, 'nor is two, on a retry');
});

test('a healthy run — one write then reads — never warns, however long it goes on', () => {
  const { warns, streak } = runCalls([WRITE_ONLY, READ, READ, READ, READ, READ, READ, READ, READ, READ]);
  assert.equal(warns.length, 0);
  assert.equal(streak.writes, 1);
  assert.equal(streak.reads, 9);
});

test('a single read anywhere clears the suspicion — the prefix demonstrably survives', () => {
  assert.equal(runCalls([WRITE_ONLY, WRITE_ONLY, READ, WRITE_ONLY, WRITE_ONLY, WRITE_ONLY]).warns.length, 0,
    'reads prove the prefix holds; occasional re-writes are TTL expiry, not busting');
});

test('it warns ONCE, then stops — a busted path reports itself and does not shout', () => {
  const { warns } = runCalls(Array(20).fill(WRITE_ONLY));
  assert.equal(warns.length, 1, 'one warning per key, not one per scene');
});

test('a path that caches nothing at all does not trip the busting warning', () => {
  // Both counters zero is the CHEAP failure, and cacheDidEngage already names it.
  const { warns } = runCalls(Array(10).fill({ cacheReadTokens: 0, cacheCreationTokens: 0 }));
  assert.equal(warns.length, 0, 'no writes means no money is being wasted on writes');
});

test('junk in, a streak out — this runs on every cached call', () => {
  assert.doesNotThrow(() => trackPrefixCache(undefined, null));
  assert.doesNotThrow(() => trackPrefixCache(undefined, { cacheReadTokens: NaN } as any));
  assert.equal(trackPrefixCache(undefined, {}).next.calls, 1);
});
