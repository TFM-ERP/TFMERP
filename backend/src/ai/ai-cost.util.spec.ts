import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  totalInputTokens, totalTokens, runCostUsd, cacheDidEngage,
  MODEL_RATES, CACHE_READ_MULTIPLIER, CACHE_WRITE_5M_MULTIPLIER,
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
