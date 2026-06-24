import { CanActivate, ExecutionContext, Injectable, SetMetadata, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimiter } from './rate-limiter';

export const THROTTLE_KEY = 'throttle_opts';

/** Per-route rate limit: @Throttle(maxRequests, windowMs). Pair with @UseGuards(ThrottleGuard). */
export const Throttle = (limit: number, windowMs: number) => SetMetadata(THROTTLE_KEY, { limit, windowMs });

// Module-level store so all guard instances share state regardless of how Nest instantiates it.
const limiters = new Map<string, RateLimiter>();

@Injectable()
export class ThrottleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const opts = this.reflector.getAllAndOverride<{ limit: number; windowMs: number }>(THROTTLE_KEY, [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!opts) return true;

    const routeKey = `${ctx.getClass().name}.${ctx.getHandler().name}`;
    let limiter = limiters.get(routeKey);
    if (!limiter) { limiter = new RateLimiter(opts.limit, opts.windowMs); limiters.set(routeKey, limiter); }

    const req = ctx.switchToHttp().getRequest();
    const fwd = req.headers?.['x-forwarded-for'];
    const ip = (fwd ? String(fwd).split(',')[0] : req.ip || req.socket?.remoteAddress || 'unknown').toString().trim();

    const res = limiter.check(`${routeKey}:${ip}`, Date.now());
    if (!res.allowed) {
      throw new HttpException(
        `Too many requests — try again in ${Math.ceil(res.retryAfterMs / 1000)}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
