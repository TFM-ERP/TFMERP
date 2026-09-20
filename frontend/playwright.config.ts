import { defineConfig, devices } from 'playwright/test';
import path from 'node:path';

// Kept as a plain constant here (not imported from e2e/auth.setup.ts) because Playwright
// loads this config file before it loads any test file, and e2e/auth.setup.ts calls
// `setup(...)` at module scope — importing it this early makes Playwright fail with
// "did not expect test() to be called here". Must stay byte-identical to the path
// auth.setup.ts writes to.
const STORAGE_STATE_PATH = path.join(__dirname, 'e2e', '.auth', 'user.json');

/**
 * Read-only Playwright coverage for the invoice lifecycle UI.
 *
 * This suite assumes the app is ALREADY RUNNING — frontend on :3000, backend on :3001 — the
 * same way a developer runs it day to day (`npm run dev` in each app). There is deliberately
 * no `webServer` entry here: this machine's dev server may be shared with its owner or another
 * session, and a Playwright-managed server would stop or restart it out from under them. If
 * the app isn't up, tests fail fast with a connection error against `baseURL` rather than
 * silently starting a second copy.
 *
 * See frontend/e2e/invoice-lifecycle.spec.ts for the credential environment variables this
 * suite needs and the no-writes rule it follows — this app talks to a live production
 * database, not a test one.
 *
 * Sign-in happens exactly once per run, not once per test: the "setup" project below
 * (e2e/auth.setup.ts) logs in through the real form a single time and saves the session to
 * STORAGE_STATE_PATH; the "chromium" project's `dependencies: ['setup']` makes it depend on
 * "setup" and starts every test's browser context from that saved session instead of the
 * login form. This is what keeps the suite under the backend's five-attempts-per-fifteen-
 * minutes login throttle (backend/src/auth/auth.controller.ts) when running `fullyParallel`
 * across several workers.
 */

const CREDS_PRESENT = Boolean(process.env.E2E_USER && process.env.E2E_PASSWORD);

export default defineConfig({
  testDir: './e2e',
  // Keep this glob well clear of `src/**/*.test.ts` (node:test's glob, see
  // src/test-support/README.md) so the two runners never pick up each other's files.
  testMatch: '**/*.spec.ts',

  timeout: 30_000,
  expect: { timeout: 10_000 },

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'setup',
      // Not `**/*.spec.ts` — this project runs only the one-time login, never the specs.
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Only when credentials are present: auth.setup.ts only writes this file when it
        // has a user/password to log in with, so pointing every run at it unconditionally
        // would make a credential-less run fail on a missing file instead of skipping
        // cleanly the way each spec's own `beforeEach` already does.
        ...(CREDS_PRESENT ? { storageState: STORAGE_STATE_PATH } : {}),
      },
      dependencies: ['setup'],
    },
  ],
});
