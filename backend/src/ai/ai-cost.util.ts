/**
 * TOKEN ACCOUNTING FOR CACHED CALLS.
 *
 * WHY THIS EXISTS. `usage.input_tokens` stops meaning "the input" the moment a call carries a cache
 * breakpoint: Anthropic reports it as the tokens AFTER the last breakpoint, so the cached prefix —
 * 2,892 tokens of story context on every scene call in this pipeline — simply is not in it. Anything
 * that sums that column alone under-reports every cached call, and does so SILENTLY, getting quieter
 * the better caching works.
 *
 * That is not a reporting nicety here. $4/script is the figure this project was re-planned around,
 * and engineStatus() meters a monthly token cap off these same columns — the cap whose being set
 * below the workload is what looked like an expensive pipeline in the first place. A number that
 * drifts downward as caching improves would recreate that misreading exactly.
 *
 *     true input = inputTokens + cacheReadTokens + cacheCreationTokens
 *
 * The three are priced differently, which is why they are stored and summed separately rather than
 * folded together at write time:
 *
 *     cache read        ~0.1x   the whole point — a hit costs a tenth of the tokens it saves
 *     cache write 5m     1.25x  the premium for putting it there, paid once per run
 *     cache write 1h     2x     not used here; see the TTL note in providers.ts
 *     uncached input      1x
 *
 * Pure functions, no I/O, no Prisma — so the arithmetic that produces the headline cost figure is
 * testable without a database or a provider.
 */

/** Per-million-token list prices. Input is the 1x base; output its own rate. */
export interface ModelRates { inputPerM: number; outputPerM: number }

/** Anthropic list prices, $/1M tokens. Keyed by the model ids this install actually routes to. */
export const MODEL_RATES: Readonly<Record<string, ModelRates>> = {
  'claude-opus-5': { inputPerM: 5, outputPerM: 25 },
  'claude-opus-4-8': { inputPerM: 5, outputPerM: 25 },
  'claude-sonnet-5': { inputPerM: 2, outputPerM: 10 },
  'claude-sonnet-4-6': { inputPerM: 3, outputPerM: 15 },
  'claude-haiku-4-5': { inputPerM: 1, outputPerM: 5 },
};

/** The cache multipliers, named rather than sprinkled as literals. */
export const CACHE_READ_MULTIPLIER = 0.1;
export const CACHE_WRITE_5M_MULTIPLIER = 1.25;
export const CACHE_WRITE_1H_MULTIPLIER = 2;

export interface RunTokens {
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadTokens?: number | null;
  cacheCreationTokens?: number | null;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * The REAL input token count for a run: uncached remainder + what was read from cache + what was
 * written to it. Rows written before caching existed carry NULL in the two cache columns, which
 * reads as zero and makes this identical to the old `inputTokens` for them.
 */
export function totalInputTokens(r?: RunTokens | null): number {
  const t = r || {};
  return num(t.inputTokens) + num(t.cacheReadTokens) + num(t.cacheCreationTokens);
}

/** Every token a run touched, in and out. This is what a token CAP should meter against. */
export function totalTokens(r?: RunTokens | null): number {
  return totalInputTokens(r) + num((r || {}).outputTokens);
}

/**
 * What a run cost, in dollars, with each class of token at its own rate.
 *
 * An unknown model returns null rather than a plausible-looking number: quietly pricing an
 * unrecognised model at some other model's rate is how a cost report becomes confidently wrong,
 * which is the failure this file exists to prevent.
 */
export function runCostUsd(model: string, r?: RunTokens | null, ttl: '5m' | '1h' = '5m'): number | null {
  const rates = MODEL_RATES[String(model || '')];
  if (!rates) return null;
  const t = r || {};
  const writeMultiplier = ttl === '1h' ? CACHE_WRITE_1H_MULTIPLIER : CACHE_WRITE_5M_MULTIPLIER;
  const inputUsd = (
    num(t.inputTokens)
    + num(t.cacheReadTokens) * CACHE_READ_MULTIPLIER
    + num(t.cacheCreationTokens) * writeMultiplier
  ) * rates.inputPerM / 1e6;
  return inputUsd + num(t.outputTokens) * rates.outputPerM / 1e6;
}

/**
 * Did a call that ASKED for caching get ANYTHING at all?
 *
 * Returns null when the question does not apply (no prefix was sent). False means the request
 * carried a breakpoint and the provider reported neither a read nor a write — a prefix under the
 * model's minimum cacheable length, silently not cached.
 *
 * THIS ONLY CATCHES THE CHEAP FAILURE. It is `read || write`, so a call that writes a fresh entry
 * every single time and never reads one passes it — and that is the EXPENSIVE failure: the prefix
 * is billed at 1.25x instead of 1x, so caching costs more than not caching and is slower. Detecting
 * that needs history across calls, which is what trackPrefixCache below is for.
 */
export function cacheDidEngage(askedForCache: boolean, r?: RunTokens | null): boolean | null {
  if (!askedForCache) return null;
  const t = r || {};
  return num(t.cacheReadTokens) > 0 || num(t.cacheCreationTokens) > 0;
}

/** Running tally of how a cached path is behaving, per task+project. */
export interface CacheStreak { calls: number; writes: number; reads: number; warned: boolean }

/** How many writes with no read before we call it busted. One write is the first call of a run and
 *  is correct. Three, with nothing ever read back, is not a run starting — it is a prefix changing. */
export const PREFIX_BUST_AFTER = 3;

export function emptyStreak(): CacheStreak { return { calls: 0, writes: 0, reads: 0, warned: false }; }

/**
 * THE GUARD THAT CAN FAIL IN THE EXPENSIVE DIRECTION.
 *
 * A cache prefix only pays off if it is written once and read thereafter. If anything above it in
 * the prefix — tools, then system, then earlier message blocks — differs between calls, every call
 * writes a new entry and reads none, and the bill goes UP. That is what happened when the per-scene
 * length rule was concatenated into the system prompt: `ctx` was byte-identical, the prefix above it
 * was not, and nothing in the response distinguished it from caching working perfectly.
 *
 * So the signal is not a single call, it is the shape over several: sustained writes with zero reads.
 * Warns once per key, so a busted path reports itself and then stops shouting.
 */
export function trackPrefixCache(prev: CacheStreak | undefined, r?: RunTokens | null): { next: CacheStreak; warn: boolean } {
  const p = prev || emptyStreak();
  const t = r || {};
  const wrote = num(t.cacheCreationTokens) > 0;
  const read = num(t.cacheReadTokens) > 0;
  const next: CacheStreak = {
    calls: p.calls + 1,
    writes: p.writes + (wrote ? 1 : 0),
    reads: p.reads + (read ? 1 : 0),
    warned: p.warned,
  };
  const busting = next.reads === 0 && next.writes >= PREFIX_BUST_AFTER;
  const warn = busting && !p.warned;
  if (warn) next.warned = true;
  return { next, warn };
}
