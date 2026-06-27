// Verify the Room rail icon (teamOnly → hidden in solo). NON-PERSISTENT: intercept the workspace
// API response and patch mode→'team' client-side only, so the Room item renders. No DB change.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const FRONTEND = process.env.FRONTEND || 'http://localhost:3000';
const BACKEND = process.env.BACKEND || 'http://localhost:3001/api/v1';
const SHOTS = join(__dir, 'shots');

async function login() {
  try {
    const c = JSON.parse(readFileSync(join(__dir, '.token.json'), 'utf8'));
    if (c.access_token && Date.now() - c.ts < 10 * 60 * 1000) return c;
  } catch { /* */ }
  const res = await fetch(`${BACKEND}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.EMAIL || 'admin@tfm.ae', password: process.env.PASSWORD || 'Demo@1234' }) });
  return res.json();
}

const run = async () => {
  const { access_token, user } = await login();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.addInitScript(({ token, userJson }) => {
    localStorage.setItem('tfm_token', token);
    localStorage.setItem('tfm_user', userJson);
  }, { token: access_token, userJson: JSON.stringify(user || {}) });

  // Patch ONLY the workspace payload's mode to 'team' (display-only; nothing persisted).
  await page.route('**/production/scripton/workspace', async (route) => {
    const resp = await route.fetch();
    let json = {};
    try { json = await resp.json(); } catch { /* */ }
    await route.fulfill({ response: resp, json: { ...json, mode: 'team' } });
  });

  await page.goto(`${FRONTEND}/scripton/notes`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.rail .ritem', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const labels = (await page.locator('.rail .ritem .lbl').allTextContents()).map((l) => l.trim());
  console.log('rail labels:', labels.join(', '));
  console.log('Room present:', labels.includes('Room'));
  console.log('console errors:', errors.length ? errors : 'none');
  await page.locator('.rail').first().screenshot({ path: join(SHOTS, 'recap-rail-room-crop.png') }).catch(() => {});
  await browser.close();
};
run().catch((e) => { console.error(e); process.exit(1); });
