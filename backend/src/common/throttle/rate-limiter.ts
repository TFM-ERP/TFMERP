/**
 * Pure in-memory fixed-window rate limiter (no deps, single-instance).
 * `now` (epoch ms) is injected so the core is deterministic and unit-testable.
 * For multi-instance deployments this would need a shared store (Redis); fine as a
 * first line of defence against brute-force / abuse on a single node.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  check(key: string, now: number): RateLimitResult {
    const e = this.hits.get(key);
    if (!e || now >= e.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.limit - 1, retryAfterMs: 0 };
    }
    if (e.count >= this.limit) {
      return { allowed: false, remaining: 0, retryAfterMs: e.resetAt - now };
    }
    e.count++;
    return { allowed: true, remaining: this.limit - e.count, retryAfterMs: 0 };
  }

  /** Drop expired entries to bound memory; call periodically. */
  sweep(now: number): void {
    for (const [k, e] of this.hits) if (now >= e.resetAt) this.hits.delete(k);
  }
}
