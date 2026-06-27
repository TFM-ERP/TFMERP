// Capture the left rail at 1440 to confirm the icon glyphs match Figma 6:111 (clapperboard Build,
// graph Canon, git-branch Versions, users Room, grid Slate, sun Studio; Home/Write/Doctor unchanged).
// Records console errors (acceptance: 0). Crops to the rail strip for a clean comparison.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const FRONTEND = process.env.FRONTEND || 'http://localhost:3000';
const BACKEND = process.env.BACKEND || 'http://localhost:3001/api/v1';
const EMAIL = process.env.EMAIL || 'admin@tfm.ae';
const PASSWORD = process.env.PASSWORD || 'Demo@1234';
const SHOTS = join(__dir, 'shots');

async function login() {
  try {
    const c = JSON.parse(readFileSync(join(__dir, '.token.json'), 'utf8'));
    if (c.access_token && Date.now() - c.ts < 10 * 60 * 1000) return c;
  } catch { /* */ }
  const res = await fetch(`${BACKEND}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
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

  // Canon: a script-scoped screen where all 9 rail items show (team mode → Room visible).
  await page.goto(`${FRONTEND}/scripton/canon`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.rail .ritem', { timeout: 30000 });
  await page.waitForTimeout(1500);

  const items = await page.locator('.rail .ritem').count();
  // each rail glyph svg: count <path> to sanity-check the new multi-path icons rendered
  const labels = await page.locator('.rail .ritem .lbl').allTextContents();
  const paths = await page.locator('.rail .ritem .box svg path').count();
  console.log('rail items:', items, '| labels:', labels.map((l) => l.trim()).join(', '));
  console.log('total <path> in rail glyphs:', paths);
  console.log('console errors:', errors.length ? errors : 'none');

  await page.screenshot({ path: join(SHOTS, 'recap-rail-full.png') });
  // tight crop of the rail strip (76px wide) for icon comparison
  const rail = page.locator('.rail').first();
  await rail.screenshot({ path: join(SHOTS, 'recap-rail-crop.png') }).catch(() => {});
  await browser.close();
};
run().catch((e) => { console.error(e); process.exit(1); });
