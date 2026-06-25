// Headless ScripON screen verifier (Playwright, dev mode).
//
// The per-screen browser gate for the OS rebuild: log in with seed creds,
// render a /scripon route in a real browser, assert there are NO console /
// hydration errors, assert the expected shell, and capture a screenshot.
//
// Run dev mode (next dev) so React surfaces hydration mismatches as console
// errors — that is the class of bug `next build` cannot catch.
//
// Usage:
//   FRONTEND=http://localhost:3210 BACKEND=http://localhost:3001/api/v1 \
//     node scripts/verify/scripon-verify.mjs
//
// Add a scenario to SCENARIOS to gate a new screen. Exit code 0 = all pass.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FRONTEND = process.env.FRONTEND || 'http://localhost:3210';
const BACKEND = process.env.BACKEND || 'http://localhost:3001/api/v1';
const EMAIL = process.env.SEED_EMAIL || 'admin@tfm.ae';
const PASSWORD = process.env.SEED_PASSWORD || 'Demo@1234';

const __dir = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(__dir, 'shots');
mkdirSync(SHOTS, { recursive: true });

// A console message / page error counts as a failure when it matches none of
// the benign-noise patterns. Hydration mismatches are called out explicitly.
const HYDRATION = [/hydrat/i, /did not match/i, /text content does not match/i, /server[- ]rendered/i];
const IGNORE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /favicon\.ico/i,
  /Failed to load resource.*404.*(favicon|\.map)/i,
];

const SCENARIOS = [
  {
    name: 'scripon-home-new-shell',
    route: '/scripon',
    storage: {}, // flag default = 'new'
    expect: async (page, r) => {
      // Single shell: the new rail container present, NO FilmOS <aside> rail.
      await page.waitForSelector('.rail .ritem', { timeout: 20000 });
      r.rails = await page.locator('.rail').count();
      r.filmosAside = await page.locator('aside').count();
      r.labels = await page.locator('.rail .lbl').allInnerTexts();
      r.assert('new rail renders (>=1 .rail)', r.rails >= 1);
      r.assert('single shell — no FilmOS <aside>', r.filmosAside === 0);
      // The 9 workspaces (English locale). Distinctive new-rail labels.
      for (const w of ['Home', 'Write', 'Develop', 'Canon', 'Doctor', 'Versions', 'Room', 'Slate', 'Studio']) {
        r.assert(`rail has "${w}"`, r.labels.some((l) => l.trim() === w));
      }
    },
  },
  {
    name: 'scripon-home-old-fallback',
    route: '/scripon',
    storage: { 'scripon.osShell': 'old' }, // instant fallback
    expect: async (page, r) => {
      // Fallback: FilmOS chrome restored (the <aside> grouped rail is back).
      await page.waitForSelector('aside', { timeout: 20000 });
      r.filmosAside = await page.locator('aside').count();
      r.assert('old flag restores FilmOS chrome (<aside> present)', r.filmosAside >= 1);
    },
  },
];

async function login() {
  const res = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: HTTP ${res.status} ${await res.text()}`);
  const { access_token, user } = await res.json();
  if (!access_token) throw new Error('login response had no access_token');
  return { access_token, user };
}

function makeResult(name) {
  const checks = [];
  return {
    name,
    checks,
    errors: [],
    assert(label, ok) { checks.push({ label, ok: !!ok }); },
    get passed() { return checks.every((c) => c.ok) && this.errors.length === 0; },
  };
}

async function run() {
  const { access_token, user } = await login();
  console.log(`✓ logged in as ${user?.email || EMAIL}`);

  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const sc of SCENARIOS) {
    const r = makeResult(sc.name);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Seed auth + flag overrides into localStorage before any app code runs.
    await page.addInitScript(
      ({ token, userJson, storage }) => {
        localStorage.setItem('tfm_token', token);
        localStorage.setItem('tfm_user', userJson);
        for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
      },
      { token: access_token, userJson: JSON.stringify(user || {}), storage: sc.storage },
    );

    // Capture every console error + uncaught page error.
    page.on('console', (m) => {
      if (m.type() !== 'error' && m.type() !== 'warning') return;
      const text = m.text();
      if (IGNORE.some((re) => re.test(text))) return;
      const hydration = HYDRATION.some((re) => re.test(text));
      // Only errors fail the gate; warnings are recorded but fail only if hydration.
      if (m.type() === 'error' || hydration) r.errors.push(`[${m.type()}]${hydration ? '[HYDRATION]' : ''} ${text}`);
    });
    page.on('pageerror', (e) => r.errors.push(`[pageerror] ${e.message}`));

    try {
      await page.goto(`${FRONTEND}${sc.route}`, { waitUntil: 'networkidle', timeout: 45000 });
      r.finalUrl = page.url();
      r.assert(`stayed on ${sc.route} (not redirected to /login or /setup)`,
        new URL(r.finalUrl).pathname.startsWith(sc.route));
      await sc.expect(page, r);
    } catch (e) {
      r.errors.push(`[harness] ${e.message}`);
    }

    const shot = join(SHOTS, `${sc.name}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    r.shot = shot;
    results.push(r);
    await context.close();
  }

  await browser.close();

  // Report
  let allPass = true;
  for (const r of results) {
    console.log(`\n── ${r.name} ${r.passed ? '✅ PASS' : '❌ FAIL'} ──`);
    console.log(`   url: ${r.finalUrl}`);
    if (r.labels) console.log(`   rail labels: [${r.labels.map((l) => l.trim()).filter(Boolean).join(', ')}]`);
    if (r.rails !== undefined) console.log(`   .rail count: ${r.rails}   <aside> count: ${r.filmosAside}`);
    for (const c of r.checks) console.log(`   ${c.ok ? '✓' : '✗'} ${c.label}`);
    if (r.errors.length) { console.log('   console/page errors:'); r.errors.forEach((e) => console.log(`     • ${e}`)); }
    else console.log('   console/page errors: none');
    console.log(`   screenshot: ${r.shot}`);
    allPass = allPass && r.passed;
  }
  console.log(`\n${allPass ? '✅ ALL SCENARIOS PASS' : '❌ FAILURES PRESENT'}`);
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error('FATAL', e); process.exit(2); });
