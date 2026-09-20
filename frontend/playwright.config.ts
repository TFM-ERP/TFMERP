import { defineConfig, devices } from 'playwright/test';

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
 */
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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
