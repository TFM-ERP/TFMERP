/**
 * When to ask the server for a file pass, and when to ask again.
 *
 * The file pass is the HttpOnly cookie that lets an <img>, <audio>, <video> or <a> reach
 * GET /api/v1/uploads/<name>. Script cannot read it, so the page keeps the expiry the server
 * reported — in memory only — and works out the rest from that and from the login token's own
 * expiry. A pass never outlives the login it came from.
 *
 * Pure: no window, no timers, no network. lib/file-pass.ts does those.
 */

/** Ask again once less than this is left on the pass. */
export const REFRESH_MARGIN_MS = 10 * 60 * 1000;
/** Otherwise ask again this often. */
export const REFRESH_EVERY_MS = 20 * 60 * 1000;
/** Never ask more often than this. */
export const REFRESH_FLOOR_MS = 30 * 1000;
/** How long a shell holds its first paint for the pass before going ahead without it. */
export const FIRST_PAINT_HOLD_MS = 3000;

/** The login token's expiry in epoch ms, read from its payload. Null when absent or unreadable. Verifies nothing. */
export function jwtExpMs(token: string | null | undefined): number | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const exp = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))?.exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** The pass already runs to the end of the login: minting again cannot make it last longer. */
function capped(passExpMs: number | null, loginExpMs: number | null): boolean {
  return passExpMs != null && loginExpMs != null && passExpMs >= loginExpMs - 1000;
}

/**
 * Should the page ask for a pass now? Yes when it holds no expiry — always the case on a fresh
 * page load — or when under ten minutes remain. Except when the pass already runs to the end of
 * the login: asking again would only return the same expiry.
 */
export function needsMint(passExpMs: number | null, loginExpMs: number | null, nowMs: number): boolean {
  if (passExpMs == null) return true;
  if (capped(passExpMs, loginExpMs)) return false;
  return passExpMs - nowMs < REFRESH_MARGIN_MS;
}

/**
 * How long to wait before asking again, in ms: twenty minutes, or sooner so the refresh lands at
 * least ten minutes before the pass expires, never under thirty seconds. Null means stop: the
 * pass runs to the end of the login, or the login itself is over.
 */
export function nextRefreshDelay(passExpMs: number | null, loginExpMs: number | null, nowMs: number): number | null {
  if (loginExpMs != null && loginExpMs <= nowMs) return null;
  if (capped(passExpMs, loginExpMs)) return null;
  if (passExpMs == null) return REFRESH_FLOOR_MS;
  return Math.max(REFRESH_FLOOR_MS, Math.min(REFRESH_EVERY_MS, passExpMs - nowMs - REFRESH_MARGIN_MS));
}
