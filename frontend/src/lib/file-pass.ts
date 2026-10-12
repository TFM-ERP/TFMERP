import { useEffect, useState } from 'react';
import { api } from './api';
import { jwtExpMs, needsMint, nextRefreshDelay, FIRST_PAINT_HOLD_MS } from './file-pass.logic';

/**
 * The file pass, browser side.
 *
 * An <img>, <audio>, <video> or <a> cannot send the Authorization header, so a signed-in browser
 * carries an HttpOnly cookie that opens GET /api/v1/uploads/<name> and nothing else. The server
 * sets it on POST /uploads/session (Bearer only) and removes it on DELETE /uploads/session.
 * Script never sees the cookie; all this module holds is the expiry the server reported, in
 * memory, to know when to ask again. Nothing here is written to localStorage.
 *
 * Credentials go on these two calls only, not on the shared axios instance: on localhost the API
 * is another origin (:3001), and without them the browser would discard the Set-Cookie.
 *
 * api.ts imports clearFilePass from here and this file imports api from there. The cycle is safe
 * because each side uses the other only inside functions, never while its module is loading.
 */

const TOKEN_KEY = 'tfm_token';
/** A mint that has not answered in this long is given up on, so the next one can start. */
const MINT_TIMEOUT_MS = 15_000;

let passExpMs: number | null = null;
let inflight: Promise<boolean> | null = null;
/** The first mint of this page load has settled, success or not. */
let settled = false;

function token(): string | null {
  try {
    return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Ask the server for a file pass. False, without a request, when nobody is signed in. Concurrent
 * calls share one request. A failure resolves false; this never throws.
 */
export function ensureFilePass(): Promise<boolean> {
  if (!token()) return Promise.resolve(false);
  if (inflight) return inflight;
  inflight = api
    // The body is {} on purpose. axios would send a null body as the text "null" under the JSON
    // content type; the API's strict JSON parser refuses that with a 400 that carries no CORS
    // headers, and the browser reports it as a network error.
    .post('/uploads/session', {}, { withCredentials: true, timeout: MINT_TIMEOUT_MS })
    .then(({ data }) => {
      const exp = Date.parse(data?.expiresAt);
      passExpMs = Number.isFinite(exp) ? exp : null;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      inflight = null;
      settled = true;
    });
  return inflight;
}

let refreshUsers = 0;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function schedule() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  const t = token();
  if (!refreshUsers || !t) return;
  const delay = nextRefreshDelay(passExpMs, jwtExpMs(t), Date.now());
  if (delay == null) return;
  refreshTimer = setTimeout(() => { void ensureFilePass().then(schedule); }, delay);
}

/** A tab that slept through its timer, or was in the background: catch up when it comes back. */
function onWake() {
  if (document.visibilityState !== 'visible') return;
  const t = token();
  if (t && needsMint(passExpMs, jwtExpMs(t), Date.now())) void ensureFilePass().then(schedule);
}

/**
 * Keep the pass fresh while the app is open. Returns the stop function. Started twice, it still
 * runs one timer and one pair of listeners; it stops when the last starter stops.
 */
export function startFilePassRefresh(): () => void {
  if (typeof window === 'undefined') return () => {};
  refreshUsers += 1;
  if (refreshUsers === 1) {
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
  }
  schedule();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    refreshUsers -= 1;
    if (refreshUsers > 0) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
    document.removeEventListener('visibilitychange', onWake);
    window.removeEventListener('focus', onWake);
  };
}

/**
 * For the app shells: false until the first mint of this page load has settled — success or not
 * — or three seconds have passed, whichever comes first; true straight away when nobody is signed
 * in. A shell renders its children only once this is true, so no image is requested before the
 * cookie exists. The cap is there because a backend that does not answer must not blank the app.
 * Also keeps the pass fresh for as long as the shell is mounted.
 */
export function useFilePassReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const done = () => { if (live) setReady(true); };
    const stop = startFilePassRefresh();
    let hold: ReturnType<typeof setTimeout> | null = null;
    if (!token() || settled) done();
    else {
      hold = setTimeout(done, FIRST_PAINT_HOLD_MS);
      void ensureFilePass().then(() => { done(); schedule(); });
    }
    return () => {
      live = false;
      if (hold) clearTimeout(hold);
      stop();
    };
  }, []);
  return ready;
}

/**
 * Sign-out and the 401 path: forget the expiry and have the server remove the cookie. Sent with
 * fetch + keepalive, not axios — the caller navigates away at once, and a keepalive request
 * survives that where an in-flight XHR may be cancelled. Never throws; the caller does not wait.
 *
 * This removes the cookie from this browser. It does not invalidate a pass copied beforehand.
 */
export function clearFilePass(): void {
  passExpMs = null;
  settled = false;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  if (typeof window === 'undefined') return;
  try {
    void fetch(`${api.defaults.baseURL}/uploads/session`, { method: 'DELETE', credentials: 'include', keepalive: true }).catch(() => {});
  } catch { /* nothing to do: the cookie expires by itself */ }
}
