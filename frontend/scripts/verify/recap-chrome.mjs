// Prove the rail is ONE chrome on every route: walk Home→Write→Build→Canon→Doctor→Versions→
// Room→Slate→Studio at 1440 and measure the .rail boundingBox {x,y,width,height}. They must be
// IDENTICAL (not just width) — a y/height drift = a strip offset (the old Slate bug). Records
// console errors. Room is teamOnly → patch workspace mode to 'team' client-side so it renders.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const FRONTEND = process.env.FRONTEND || 'http://localhost:3000';
const BACKEND = process.env.BACKEND || 'http://localhost:3001/api/v1';
const SHOTS = join(__dir, 'shots');
const BUILD = 'cmqqg05hb00055aywmsdhaycm';

async function login() {
  try { const c = JSON.parse(readFileSync(join(__dir, '.token.json'), 'utf8')); if (c.access_token && Date.now() - c.ts < 10 * 60 * 1000) return c; } catch { /* */ }
  const res = await fetch(`${BACKEND}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: process.env.EMAIL || 'admin@tfm.ae', password: process.env.PASSWORD || 'Demo@1234' }) });
  return res.json();
}

const SCREENS = [
  { name: 'Home', route: '/scripton' },
  { name: 'Write', route: '/scripton/reader' },
  { name: 'Build', route: `/scripton/studio?build=${BUILD}` },
  { name: 'Canon', route: '/scripton/canon' },
  { name: 'Doctor', route: '/scripton/doctor' },
  { name: 'Versions', route: '/scripton/revisions' },
  { name: 'Room', route: '/scripton/notes' },
  { name: 'Slate', route: '/scripton/library' },
  { name: 'Studio', route: '/scripton/settings' },
];

const run = async () => {
  const { access_token, user } = await login();
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  for (const s of SCREENS) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
    await page.addInitScript(({ token, userJson }) => {
      localStorage.setItem('tfm_token', token);
      localStorage.setItem('tfm_user', userJson);
      localStorage.setItem('scripon.osShell', 'new');
    }, { token: access_token, userJson: JSON.stringify(user || {}) });
    await page.route('**/production/scripton/workspace', async (route) => {
      const resp = await route.fetch(); let json = {};
      try { json = await resp.json(); } catch { /* */ }
      await route.fulfill({ response: resp, json: { ...json, mode: 'team' } });
    });
    let box = null, items = 0, err = '';
    try {
      await page.goto(`${FRONTEND}${s.route}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForSelector('.rail', { timeout: 30000 });
      await page.waitForTimeout(1200);
      box = await page.locator('.rail').first().boundingBox();
      items = await page.locator('.rail .ritem').count();
    } catch (e) { err = e.message.split('\n')[0]; }
    rows.push({ name: s.name, box, items, errs: errors.length, err });
    await ctx.close();
  }
  await browser.close();

  const fmt = (b) => b ? `x=${b.x} y=${b.y} w=${b.width} h=${Math.round(b.height)}` : '(no rail)';
  const ref = rows[0].box;
  const same = (b) => b && ref && b.x === ref.x && b.y === ref.y && b.width === ref.width && Math.round(b.height) === Math.round(ref.height);
  console.log('\nSCREEN      RAIL boundingBox                 items  identical-to-Home  errors');
  let allSame = true, anyErr = false;
  for (const r of rows) {
    const ok = r.name === 'Home' ? '(ref)' : (same(r.box) ? 'YES ✅' : 'NO ❌');
    if (r.name !== 'Home' && !same(r.box)) allSame = false;
    if (r.errs) anyErr = true;
    console.log(`${r.name.padEnd(11)} ${fmt(r.box).padEnd(32)} ${String(r.items).padEnd(6)} ${ok.padEnd(18)} ${r.errs}${r.err ? '  ' + r.err : ''}`);
  }
  console.log(`\nRail identical on every route: ${allSame ? 'YES ✅' : 'NO ❌'}   |   console errors anywhere: ${anyErr ? 'YES ❌' : 'none ✅'}`);
};
run().catch((e) => { console.error(e); process.exit(1); });
