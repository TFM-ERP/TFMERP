import { test as setup } from 'playwright/test';
import path from 'node:path';

/**
 * Runs once, before any spec in the "chromium" project — it is its own Playwright
 * project ("setup"), wired in via the "chromium" project's `dependencies: ['setup']`
 * in playwright.config.ts. It signs in
 * through the real login form exactly one time and saves the resulting session
 * (cookies plus localStorage, including the `tfm_token` the app reads on every request)
 * to STORAGE_STATE_PATH. Every test in the "chromium" project then starts its own
 * browser context already authenticated by loading that file as `storageState`, instead
 * of driving the login form itself.
 *
 * Why this exists: the backend throttles `/auth/login` to five attempts per fifteen
 * minutes per IP (`@Throttle(5, 15 * 60 * 1000)` on `backend/src/auth/auth.controller.ts`)
 * — a deliberate brute-force guard. This suite runs `fullyParallel` across several
 * workers; a per-test `login()` call used to mean one login attempt per test, all from
 * this machine's one IP, enough to trip that guard inside a single run. Logging in once
 * here — and nowhere else — keeps a full suite run to exactly one `/auth/login` call.
 *
 * Credential handling matches invoice-lifecycle.spec.ts's Rule 2: E2E_USER and
 * E2E_PASSWORD come only from the environment, are never read from a file, never
 * logged or echoed, and never invented. When either is missing, this test returns
 * immediately — before touching the login form or the network — rather than attempting
 * a login with an empty password. playwright.config.ts only points the "chromium"
 * project at STORAGE_STATE_PATH when both are present, so a credential-less run never
 * tries to load a state file this test didn't write; every spec's own
 * `test.skip(!CREDS_PRESENT, ...)` in `beforeEach` still does the rest, exactly as it did
 * before this file existed.
 */

// Kept out of git (see .gitignore) — this file holds a live session token, not a secret
// that was ever typed into this repo. Written fresh by this test on every run that has
// credentials; nothing reads a stale copy across runs.
export const STORAGE_STATE_PATH = path.join(__dirname, '.auth', 'user.json');

setup('authenticate once', async ({ page }) => {
  const user = process.env.E2E_USER;
  const password = process.env.E2E_PASSWORD;
  if (!user || !password) {
    return;
  }

  // Selectors match e2e/invoice-lifecycle.spec.ts's former login() helper: the
  // email/password inputs have no `for`/`id` link to their <label>, so `type` is the
  // stable, unique way to find them on this form.
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(user);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  // On success the page does `router.push('/finance')`. If the account needs a second
  // (2FA) factor the form stays on /login and reveals a code field instead — this wait
  // then times out with a clear "waiting for URL" failure rather than hanging forever.
  await page.waitForURL(/\/finance(\/|$)/, { timeout: 15_000 });

  await page.context().storageState({ path: STORAGE_STATE_PATH });
});
