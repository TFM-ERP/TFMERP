// Focused recapture: confirm the shared top-bar continuity ring + V chip resolve the SAME
// rendered value (عنترة → 100% · V1) on every script-scoped screen, matching Develop.
// Reads the actual .sxtb .ring % and .vsw V-label text per screen + screenshots at 1440.
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
const DESKTOP = { width: 1440, height: 900 };
const COMPARE_PASS = process.env.COMPARE_PASS || '';
const RENDERED_BUILD = 'cmqqg05hb00055aywmsdhaycm'; // the عنترة build whose linked script has renders

async function login() {
  try {
    const c = JSON.parse(readFileSync(join(__dir, '.token.json'), 'utf8'));
    if (c.access_token && Date.now() - c.ts < 10 * 60 * 1000) return c;
  } catch { /* */ }
  const res = await fetch(`${BACKEND}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return res.json();
}

const SCREENS = [
  { name: 'develop', route: `/scripton/studio?build=${RENDERED_BUILD}`, ref: true },
  { name: 'canon', route: '/scripton/canon' },
  { name: 'doctor', route: '/scripton/doctor' },
  { name: 'versions', route: '/scripton/revisions' },
  { name: 'room', route: '/scripton/notes' },
  { name: 'write', route: '/scripton/reader' },
  ...(COMPARE_PASS ? [{ name: 'compare', route: `/scripton/revisions?pass=${COMPARE_PASS}` }] : []),
];

const run = async () => {
  const { access_token, user } = await login();
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  for (const s of SCREENS) {
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await ctx.newPage();
    await page.addInitScript(({ token, userJson }) => {
      localStorage.setItem('tfm_token', token);
      localStorage.setItem('tfm_user', userJson);
    }, { token: access_token, userJson: JSON.stringify(user || {}) });
    let pct = '—', vlabel = '—', err = '';
    try {
      await page.goto(`${FRONTEND}${s.route}`, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForSelector('.sxtb', { timeout: 30000 });
      // the ring resolves on a 400ms deferred tick + async fetch — give it room
      await page.waitForTimeout(2500);
      pct = (await page.locator('.sxtb .ring .pct').first().textContent().catch(() => null)) ?? '(hidden)';
      vlabel = (await page.locator('.sxtb .vsw').first().textContent().catch(() => null)) ?? '(hidden)';
    } catch (e) { err = e.message.split('\n')[0]; }
    await page.screenshot({ path: join(SHOTS, `recap2-${s.name}.png`) }).catch(() => {});
    rows.push({ name: s.name, ref: !!s.ref, pct, vlabel: (vlabel || '').replace(/▾/g, '').trim(), err });
    await ctx.close();
  }
  await browser.close();
  const ref = rows.find((r) => r.ref);
  console.log('\nSCREEN        RING %     V CHIP    match Develop?');
  for (const r of rows) {
    const match = ref && r.pct === ref.pct && r.vlabel === ref.vlabel ? '✅' : (r.ref ? '(ref)' : '⚠️');
    console.log(`${r.name.padEnd(12)} ${String(r.pct).padEnd(10)} ${String(r.vlabel).padEnd(9)} ${match}${r.err ? '  ERR: ' + r.err : ''}`);
  }
};
run().catch((e) => { console.error(e); process.exit(1); });
