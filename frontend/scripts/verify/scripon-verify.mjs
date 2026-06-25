// Headless ScriptON screen verifier (Playwright, dev mode).
//
// The per-screen browser gate for the OS rebuild: log in with seed creds,
// render a /scripton route in a real browser, assert there are NO console /
// hydration errors, assert the expected shell, and capture a screenshot.
//
// Run dev mode (next dev) so React surfaces hydration mismatches as console
// errors — that is the class of bug `next build` cannot catch. This harness
// only drives `next dev`; it never builds.
//
// ⚠️ If you ALSO want a production-build sanity check, NEVER run a bare
// `next build` while `next dev` is serving — it writes a BUILD_ID +
// prerender-manifest into the shared `.next` and corrupts the live dev state
// (Tailwind/HMR break). Build into a separate dir instead:
//     NEXT_DISTDIR=.next-verify npx next build
// (next.config.js honours NEXT_DISTDIR; dev keeps the default `.next`).
//
// Usage:
//   FRONTEND=http://localhost:3210 BACKEND=http://localhost:3001/api/v1 \
//     node scripts/verify/scripton-verify.mjs
//
// Add a scenario to SCENARIOS to gate a new screen. Exit code 0 = all pass.

import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

// The rebuilt Home, verified at each breakpoint: single shell + the new rail,
// real data (greeting, Continue hero, slate cards), no console/hydration errors.
const homeExpect = async (page, r) => {
  // Home rendered past its loading skeleton (greeting is the tell).
  await page.waitForSelector('.sx.home .greet h1', { timeout: 25000 });
  r.greeting = (await page.locator('.sx.home .greet h1').first().innerText()).trim();
  r.assert('greeting renders (Good morning/afternoon/evening)', /Good (morning|afternoon|evening)/.test(r.greeting));
  // Single shell: the workspace rail present, no FilmOS <aside>.
  r.rails = await page.locator('.rail').count();
  r.filmosAside = await page.locator('aside').count();
  r.assert('single shell — no FilmOS <aside>', r.filmosAside === 0);
  r.assert('workspace rail present', r.rails >= 1);
  // Continue hero present.
  r.assert('Continue hero present', (await page.locator('.sx.home .hero').count()) >= 1);
  // Real slate data — at least one card with a title (2 master-scripts seeded).
  r.slateCards = await page.locator('.sx.home .cardgrid .scard').count();
  r.cardTitles = await page.locator('.sx.home .cardgrid .scard .ti2').allInnerTexts();
  r.assert('slate shows real script cards (>=1)', r.slateCards >= 1);
};

const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 1000, height: 1200 };
const MOBILE = { width: 390, height: 844 };

// Write Slice 1: the Story Spine + the reused Courier paper canvas (read-only).
const writeExpect = async (page, r) => {
  await page.waitForSelector('.sx.write .canvas .uvp-a4', { timeout: 25000 });
  r.rails = await page.locator('.rail').count();
  r.filmosAside = await page.locator('aside').count();
  r.assert('single shell — no FilmOS <aside>', r.filmosAside === 0);
  r.assert('workspace rail present', r.rails >= 1);
  r.assert('Story Spine present', (await page.locator('.sx.write .spine').count()) >= 1);
  r.spineDots = await page.locator('.sx.write .spdot').count();
  r.assert('spine has scene dots', r.spineDots > 0);
  r.assert('canvas uses shared ScriptPaper (slug headings)', (await page.locator('.sx.write .canvas .uvp-slug').count()) >= 1);
  // Revision Pass panel (desktop/tablet; mobile leads with the paper).
  r.passRows = await page.locator('.sx.write .pass .passrow').count();
  if (r.passRows > 0) r.assert('revision pass: staged changes + continuity meter', r.passRows >= 1 && (await page.locator('.sx.write .pass .meter .track').count()) >= 1);
  // Slice 3: the composer — conflict blocks, a clean change stages and grows the pass.
  if (await page.locator('.sx.write .stagebtn').count()) {
    const before = await page.locator('.sx.write .pass .passrow').count();
    await page.locator('.sx.write .stagebtn').click();
    await page.waitForSelector('.sx.write .composer .opt', { timeout: 10000 });
    r.assert('composer: kind tabs + composed options', (await page.locator('.sx.write .composer .chip').count()) >= 5 && (await page.locator('.sx.write .composer .opt').count()) >= 2);
    // conflicting option (2nd in Re-ending) → blocked by the continuity gate
    await page.locator('.sx.write .composer .opt').nth(1).click();
    await page.locator('.sx.write .cstage').click();
    await page.waitForTimeout(1400);
    r.assert('conflicting change blocked (continuity gate)', (await page.locator('.sx.write .composer .cflict').count()) >= 1 && (await page.locator('.sx.write .pass .passrow').count()) === before);
    // clean option (1st) → stages, pass grows
    await page.locator('.sx.write .composer .opt').first().click();
    await page.locator('.sx.write .cstage').click();
    await page.waitForTimeout(1800);
    r.passAfter = await page.locator('.sx.write .pass .passrow').count();
    r.assert('clean change stages + grows the pass', r.passAfter > before);
  }
  // Slice 4: Render = commit. Stage the fact-bearing option (r3 — CLIMAX_SITE), then
  // Render → the kernel applies the pass (new BuildVersion + extracted canon +
  // DecisionRecord) and the app lands on the Render→Compare view. Desktop/tablet only.
  if (await page.locator('.sx.write .renderbtn').count()) {
    await page.locator('.sx.write .stagebtn').click();
    await page.waitForSelector('.sx.write .composer .opt', { timeout: 10000 });
    await page.locator('.sx.write .composer .opt').nth(2).click(); // r3: carries a CLIMAX_SITE fact
    await page.locator('.sx.write .cstage').click();
    await page.waitForTimeout(1800);
    r.assert('fact-bearing change staged before render', (await page.locator('.sx.write .pass .passrow').count()) >= 1);
    await Promise.all([
      page.waitForURL(/\/scripton\/revisions\?pass=/, { timeout: 12000 }).catch(() => {}),
      page.locator('.sx.write .renderbtn').click(),
    ]);
    await page.waitForTimeout(800);
    r.assert('Render = commit → lands on Render→Compare (?pass=)', /\/scripton\/revisions\?pass=/.test(page.url()));
  }
};

// Render→Compare: the post-render V{prev}↔V{new} diff + THIS RENDER panel, driven
// by a real rendered pass (?pass=COMPARE_PASS). Asserts the banner, both diff
// columns with red/green lines, and the render summary.
const compareExpect = async (page, r) => {
  await page.waitForSelector('.sx.cmp .scol', { timeout: 25000 });
  r.rails = await page.locator('.rail').count();
  r.filmosAside = await page.locator('aside').count();
  r.assert('single shell — no FilmOS <aside>', r.filmosAside === 0);
  r.assert('workspace rail present', r.rails >= 1);
  r.assert('Rendered banner present', (await page.locator('.sx.cmp .banner .bttl').count()) >= 1);
  r.cols = await page.locator('.sx.cmp .colhead').count();
  r.assert('two version column headers', r.cols >= 2);
  r.dels = await page.locator('.sx.cmp .scol .ln.del').count();
  r.adds = await page.locator('.sx.cmp .scol .ln.add').count();
  r.assert('diff: removed (red) + added (green) lines on changed scenes', r.dels >= 1 && r.adds >= 1);
  // THIS RENDER summary — desktop shows the full panel; tablet+mobile stack & condense
  // to chips (per Figma 51:3, where the columns stack on anything below desktop).
  const vp = (await page.viewportSize())?.width || 1440;
  if (vp >= 1280) {
    r.assert('THIS RENDER: applied changes + canon written', (await page.locator('.sx.cmp .render .sect').count()) >= 3 && (await page.locator('.sx.cmp .render .row .ic.ok').count()) >= 1);
  } else {
    r.assert('THIS RENDER condenses to chips', (await page.locator('.sx.cmp .render .chip').count()) >= 1);
  }
  r.assert('preserved note present', (await page.locator('.sx.cmp .render .note').count()) >= 1);
  r.assert('Set-active control present', (await page.locator('.sx.cmp .btn.gold').count()) >= 1);
};

// Canon (kernel-backed): the bi-temporal graph from real CanonFact data —
// 5 tabs, graph or facts, entity panel, no console errors.
const canonExpect = async (page, r) => {
  await page.waitForSelector('.sx.canon .phead h1', { timeout: 25000 });
  await page.waitForSelector('.sx.canon .tab', { timeout: 25000 });
  r.rails = await page.locator('.rail').count();
  r.filmosAside = await page.locator('aside').count();
  r.assert('single shell — no FilmOS <aside>', r.filmosAside === 0);
  r.assert('workspace rail present', r.rails >= 1);
  r.tabs = await page.locator('.sx.canon .tab').count();
  r.assert('5 canon tabs', r.tabs === 5);
  r.graphNodes = await page.locator('.sx.canon .gpanel svg circle').count();
  r.factRows = await page.locator('.sx.canon .panelbox .fact').count();
  r.assert('real kernel facts rendered (graph nodes or panel facts)', r.graphNodes > 0 || r.factRows > 0);
};

// Develop (light re-skin): the Builder's Builds panel in one OS shell, Develop
// highlighted, the vestigial Close dropped, + New build kept, no console errors.
const developExpect = async (page, r) => {
  await page.waitForSelector('.bld', { timeout: 25000 });
  // The re-skin is the shared Builds panel — applies at every breakpoint.
  r.closeBtn = await page.locator('.bld .top .btn.ghost').count();
  r.assert('vestigial Close button dropped', r.closeBtn === 0);
  r.assert('+ New build kept', (await page.locator('.bld .top .btn.gold').count()) >= 1);
  r.assert('OS-reskinned Builds panel (.bld.osnew)', (await page.locator('.bld.osnew').count()) === 1);
  // The 9-workspace OS rail is the desktop Builder shell; tablet/mobile keep the
  // Builder's own device nav (existing breakpoint logic).
  r.rails = await page.locator('.rail').count();
  if (r.rails > 0) {
    r.activeRail = (await page.locator('.rail .ritem.on .lbl').first().innerText().catch(() => '')).trim();
    r.assert('Develop rail item highlighted (desktop OS rail)', r.activeRail === 'Develop');
  }
};

// The 3-column Room: title, Notes + Thread + (Approval chain + Distribution),
// single shell, no console errors. Mobile carries the 3-tab review-first control.
const roomExpect = async (page, r) => {
  await page.waitForSelector('.sx.room .phead h1', { timeout: 25000 });
  r.rails = await page.locator('.rail').count();
  r.filmosAside = await page.locator('aside').count();
  r.assert('single shell — no FilmOS <aside>', r.filmosAside === 0);
  r.assert('workspace rail present', r.rails >= 1);
  r.cols = await page.locator('.sx.room .rcols .rcol').count();
  r.assert('3 Room columns (notes · thread · side)', r.cols === 3);
  r.assert('approval chain + distribution panels present', (await page.locator('.sx.room .rcol.side .panel').count()) >= 2);
  r.assert('thread column present', (await page.locator('.sx.room .thread').count()) >= 1);
  r.assert('mobile review-first 3-tab control present', (await page.locator('.sx.room .mtab').count()) === 3);
};

// The consolidated Studio: title, 7-item sub-nav, 4 export cards, single rail
// (old embedded 74px rail dropped), Studio highlighted, no console errors.
const studioExpect = async (page, r) => {
  await page.waitForSelector('.sx.studio .phead h1', { timeout: 25000 });
  r.rails = await page.locator('.rail').count();
  r.filmosAside = await page.locator('aside').count();
  r.assert('single shell — no FilmOS <aside>', r.filmosAside === 0);
  r.assert('exactly one rail (old embedded rail dropped)', r.rails === 1);
  r.subnav = await page.locator('.sx.studio .subnav .sni').count();
  r.exportCards = await page.locator('.sx.studio .fmts .fcard').count();
  r.assert('7-item sub-nav', r.subnav === 7);
  r.assert('4 export cards', r.exportCards === 4);
  r.activeRail = (await page.locator('.rail .ritem.on .lbl').first().innerText().catch(() => '')).trim();
  r.assert('Studio rail item highlighted on /scripton/settings', r.activeRail === 'Studio');
};

// The single-canvas Doctor: no tabs, verdict banner, 5-tile scorecard, 2×4
// transforms — at every breakpoint, with no console/hydration errors.
const doctorExpect = async (page, r) => {
  await page.waitForSelector('.sx.doctor .phead h1', { timeout: 25000 });
  r.rails = await page.locator('.rail').count();
  r.filmosAside = await page.locator('aside').count();
  r.assert('single shell — no FilmOS <aside>', r.filmosAside === 0);
  r.assert('workspace rail present', r.rails >= 1);
  r.assert('NO tabs (single canvas)', (await page.locator('.sx.doctor .tabs').count()) === 0);
  r.assert('verdict banner present', (await page.locator('.sx.doctor .verdict').count()) >= 1);
  r.scoreTiles = await page.locator('.sx.doctor .score .stile').count();
  r.transformTiles = await page.locator('.sx.doctor .tgrid .ttile').count();
  r.assert('coverage scorecard = 5 tiles', r.scoreTiles === 5);
  r.assert('transforms grid = 8 tiles', r.transformTiles === 8);
};

const SCENARIOS = [
  { name: 'home-desktop', route: '/scripton', storage: {}, viewport: DESKTOP, expect: homeExpect },
  { name: 'home-tablet', route: '/scripton', storage: {}, viewport: TABLET, expect: homeExpect },
  { name: 'home-mobile', route: '/scripton', storage: {}, viewport: MOBILE, expect: homeExpect },
  {
    name: 'home-old-fallback',
    route: '/scripton',
    storage: { 'scripon.osShell': 'old' },
    viewport: DESKTOP,
    expect: async (page, r) => {
      // Fallback: the legacy command-centre dashboard + FilmOS chrome restored.
      await page.waitForSelector('aside', { timeout: 20000 });
      r.filmosAside = await page.locator('aside').count();
      r.assert('old flag restores FilmOS chrome (<aside> present)', r.filmosAside >= 1);
      r.assert('new Home NOT mounted under old flag', (await page.locator('.sx.home').count()) === 0);
    },
  },
  { name: 'doctor-desktop', route: '/scripton/doctor', storage: {}, viewport: DESKTOP, expect: doctorExpect },
  { name: 'doctor-tablet', route: '/scripton/doctor', storage: {}, viewport: TABLET, expect: doctorExpect },
  { name: 'doctor-mobile', route: '/scripton/doctor', storage: {}, viewport: MOBILE, expect: doctorExpect },
  {
    name: 'doctor-old-fallback',
    route: '/scripton/doctor',
    storage: { 'scripon.osShell': 'old' },
    viewport: DESKTOP,
    expect: async (page, r) => {
      await page.waitForSelector('aside', { timeout: 20000 });
      r.filmosAside = await page.locator('aside').count();
      r.assert('old flag restores FilmOS chrome (<aside> present)', r.filmosAside >= 1);
      r.assert('new Doctor canvas NOT mounted under old flag', (await page.locator('.sx.doctor').count()) === 0);
    },
  },
  { name: 'studio-desktop', route: '/scripton/settings', storage: {}, viewport: DESKTOP, expect: studioExpect },
  { name: 'studio-tablet', route: '/scripton/settings', storage: {}, viewport: TABLET, expect: studioExpect },
  { name: 'studio-mobile', route: '/scripton/settings', storage: {}, viewport: MOBILE, expect: studioExpect },
  {
    // The route fix: Develop solely owns /scripton/studio and must highlight there.
    name: 'route-develop-highlight',
    route: '/scripton/studio',
    storage: {},
    viewport: DESKTOP,
    expect: async (page, r) => {
      await page.waitForSelector('.rail .ritem.on .lbl', { timeout: 25000 });
      r.activeRail = (await page.locator('.rail .ritem.on .lbl').first().innerText()).trim();
      r.assert('Develop rail item highlighted on /scripton/studio', r.activeRail === 'Develop');
    },
  },
  {
    name: 'studio-old-fallback',
    route: '/scripton/settings',
    storage: { 'scripon.osShell': 'old' },
    viewport: DESKTOP,
    expect: async (page, r) => {
      await page.waitForSelector('aside', { timeout: 20000 });
      r.assert('old flag restores FilmOS chrome (<aside> present)', (await page.locator('aside').count()) >= 1);
      r.assert('new Studio NOT mounted under old flag', (await page.locator('.sx.studio').count()) === 0);
    },
  },
  { name: 'room-desktop', route: '/scripton/notes', storage: {}, viewport: DESKTOP, expect: roomExpect },
  { name: 'room-tablet', route: '/scripton/notes', storage: {}, viewport: TABLET, expect: roomExpect },
  { name: 'room-mobile', route: '/scripton/notes', storage: {}, viewport: MOBILE, expect: roomExpect },
  {
    name: 'room-old-fallback',
    route: '/scripton/notes',
    storage: { 'scripon.osShell': 'old' },
    viewport: DESKTOP,
    expect: async (page, r) => {
      await page.waitForSelector('aside', { timeout: 20000 });
      r.assert('old flag restores FilmOS chrome (<aside> present)', (await page.locator('aside').count()) >= 1);
      r.assert('new Room NOT mounted under old flag', (await page.locator('.sx.room').count()) === 0);
    },
  },
  { name: 'develop-desktop', route: '/scripton/studio?tab=builds', storage: {}, viewport: DESKTOP, expect: developExpect },
  { name: 'develop-tablet', route: '/scripton/studio?tab=builds', storage: {}, viewport: TABLET, expect: developExpect },
  { name: 'develop-mobile', route: '/scripton/studio?tab=builds', storage: {}, viewport: MOBILE, expect: developExpect },
  {
    name: 'develop-old-fallback',
    route: '/scripton/studio?tab=builds',
    storage: { 'scripon.osShell': 'old' },
    viewport: DESKTOP,
    expect: async (page, r) => {
      await page.waitForSelector('.bld', { timeout: 25000 });
      r.assert('old flag keeps the Close button', (await page.locator('.bld .top .btn.ghost').count()) >= 1);
      r.assert('Builds panel NOT OS-reskinned under old flag', (await page.locator('.bld.osnew').count()) === 0);
    },
  },
  { name: 'write-desktop', route: '/scripton/reader', storage: {}, viewport: DESKTOP, expect: writeExpect },
  { name: 'write-tablet', route: '/scripton/reader', storage: {}, viewport: TABLET, expect: writeExpect },
  { name: 'write-mobile', route: '/scripton/reader', storage: {}, viewport: MOBILE, expect: writeExpect },
  // Render→Compare — only when a rendered pass id is supplied (COMPARE_PASS env).
  ...(process.env.COMPARE_PASS ? [
    { name: 'compare-desktop', route: '/scripton/revisions?pass=' + process.env.COMPARE_PASS, storage: {}, viewport: DESKTOP, expect: compareExpect },
    { name: 'compare-tablet', route: '/scripton/revisions?pass=' + process.env.COMPARE_PASS, storage: {}, viewport: TABLET, expect: compareExpect },
    { name: 'compare-mobile', route: '/scripton/revisions?pass=' + process.env.COMPARE_PASS, storage: {}, viewport: MOBILE, expect: compareExpect },
  ] : []),
  { name: 'canon-desktop', route: '/scripton/canon', storage: {}, viewport: DESKTOP, expect: canonExpect },
  { name: 'canon-tablet', route: '/scripton/canon', storage: {}, viewport: TABLET, expect: canonExpect },
  { name: 'canon-mobile', route: '/scripton/canon', storage: {}, viewport: MOBILE, expect: canonExpect },
  {
    name: 'canon-old-fallback',
    route: '/scripton/canon',
    storage: { 'scripon.osShell': 'old' },
    viewport: DESKTOP,
    expect: async (page, r) => {
      await page.waitForSelector('aside', { timeout: 20000 });
      r.assert('old flag restores FilmOS chrome (<aside> present)', (await page.locator('aside').count()) >= 1);
      r.assert('new Canon NOT mounted under old flag', (await page.locator('.sx.canon').count()) === 0);
    },
  },
];

// Cache the token between runs so repeated verifications don't trip the
// backend's auth rate limiter (429). Reused if < 10 min old.
const TOKEN_CACHE = join(__dir, '.token.json');
async function login() {
  try {
    const raw = readFileSync(TOKEN_CACHE, 'utf8');
    const c = JSON.parse(raw);
    if (c.access_token && Date.now() - c.ts < 10 * 60 * 1000) return { access_token: c.access_token, user: c.user, cached: true };
  } catch { /* no/stale cache */ }
  const res = await fetch(`${BACKEND}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: HTTP ${res.status} ${await res.text()}`);
  const { access_token, user } = await res.json();
  if (!access_token) throw new Error('login response had no access_token');
  try { writeFileSync(TOKEN_CACHE, JSON.stringify({ access_token, user, ts: Date.now() })); } catch { /* ignore */ }
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

  // Optional CLI filter: `node scripon-verify.mjs write` runs only matching screens.
  const ONLY = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const SELECTED = ONLY.length ? SCENARIOS.filter((s) => ONLY.some((o) => s.name.includes(o))) : SCENARIOS;

  for (const sc of SELECTED) {
    const r = makeResult(sc.name);
    const context = await browser.newContext({ viewport: sc.viewport || { width: 1440, height: 900 } });
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
        new URL(r.finalUrl).pathname.startsWith(sc.route.split('?')[0]));
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
    if (r.greeting) console.log(`   greeting: "${r.greeting}"`);
    if (r.slateCards !== undefined) console.log(`   slate cards: ${r.slateCards}   titles: [${(r.cardTitles || []).map((x) => x.trim()).join(', ')}]`);
    if (r.scoreTiles !== undefined) console.log(`   scorecard tiles: ${r.scoreTiles}   transform tiles: ${r.transformTiles}`);
    if (r.subnav !== undefined) console.log(`   sub-nav items: ${r.subnav}   export cards: ${r.exportCards}`);
    if (r.activeRail !== undefined) console.log(`   active rail item: "${r.activeRail}"`);
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
