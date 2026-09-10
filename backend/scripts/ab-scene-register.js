/**
 * A/B THE REGISTER ON ONE SCENE CALL — with it and without it, same scene, same everything else.
 *
 *   node -r ts-node/register scripts/ab-scene-register.js <buildId> --scene 7 [--n 3] [--out <file>] [--dry]
 *
 * --dry prints the set-up (both contexts, the scene, its budget, the register lines in scope) and
 * calls no model.
 *
 * The register (81 verbatim lines on v2.2) rides at the end of the per-scene context — the cached
 * prefix every scene call shares. On the ladder stages that was an easy call. On a small per-scene
 * call it is the density trade again: 81 rules against one scene's instruction. So it is measured:
 *
 *   Arm A — the real feature context with the register block cut off its end.
 *   Arm B — the real feature context, register included.
 *
 * Everything else is identical: the scene and its brief, its line budget, the system prompt, the
 * temperature (0.85), and the path — both arms go through the real writeScene, its integrity gate
 * and retries included. Story-so-far, previous tail, spine and per-scene canon are empty in BOTH
 * arms, so the register is the only difference. n samples per arm, interleaved, alternating which
 * arm goes first — one sample per arm at 0.85 is noise, so the spread is reported, not a point.
 *
 * Measured per sample: register contradictions (the same checker the stages use; every quote
 * verified against the scene), words against the scene's own ask, integrity defects, attempts, and
 * the cache counters on each scene call. Both arms' texts are written to --out to be READ — a
 * contradiction count is not a quality judgement, and the scenes are.
 *
 * Read-only against the database: every write is blocked (the AI ledger still records each call, as
 * it does for every paid call). 2n scene calls + 2n checks, all paid.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaService } = require('../src/common/prisma/prisma.service.ts');
const { LlmRoutingService } = require('../src/ai/llm-routing.service.ts');
const { AiService } = require('../src/ai/ai.service.ts');
const { CanonService } = require('../src/production/scripton/canon/canon.service.ts');
const { ScripOnService } = require('../src/production/scripton/scripton.service.ts');
const { knowledgeDirective } = require('../src/production/scripton/knowledge');
const { transcribeRegister } = require('../src/production/scripton/canon/canon-register.util.ts');
const { registerLines, registerCheckUser, parseRegisterCheck, REGISTER_CHECK_SYSTEM, REGISTER_CHECK_MAXTOK } = require('../src/production/scripton/canon/register-check.util.ts');
const { lineBudgetFor, snapPageWeight } = require('../src/production/scripton/feature-length.util.ts');
const { checkSceneIntegrity } = require('../src/production/scripton/continuity.util.ts');
const { asSourceText } = require('../src/production/scripton/source-excerpt.util.ts');

const args = process.argv.slice(2);
const buildId = args[0];
const opt = (k, d) => { const i = args.indexOf(k); return i > 0 && args[i + 1] ? args[i + 1] : d; };
const SCENE = Number(opt('--scene', '0'));
const N = Math.max(1, Number(opt('--n', '3')));
const OUT = opt('--out', path.join(os.tmpdir(), 'ab-scene-register-' + buildId + '-s' + SCENE + '.txt'));   // outside the repo
if (!buildId || !SCENE) { console.error('usage: node -r ts-node/register scripts/ab-scene-register.js <buildId> --scene N [--n 3] [--out file]'); process.exit(2); }

const blocked = [];
const WRITE = /^(create|createMany|update|updateMany|upsert|delete|deleteMany)$/;
const readOnly = (real) => new Proxy(real, { get(t, k) {
  if (['$executeRaw', '$executeRawUnsafe', '$transaction'].includes(String(k))) return () => { blocked.push(String(k)); return Promise.reject(new Error('WRITE BLOCKED ' + String(k))); };
  const v = t[k];
  if (v && typeof v === 'object' && typeof v.findMany === 'function') {
    return new Proxy(v, { get(d, m) {
      const f = d[m];
      if (typeof f !== 'function') return f;
      return WRITE.test(String(m)) ? () => { blocked.push(String(k) + '.' + String(m)); return Promise.reject(new Error('WRITE BLOCKED')); } : f.bind(d);
    } });
  }
  return typeof v === 'function' ? v.bind(t) : v;
} });

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const spread = (xs) => xs.length ? (Math.min(...xs) + '–' + Math.max(...xs) + ' (mean ' + mean(xs).toFixed(2) + ')') : 'n/a';

(async () => {
  const real = new PrismaService();
  const ai = new AiService(real, new LlmRoutingService(real));          // real model, real ledger
  const calls = [];
  const run = ai.run.bind(ai);
  ai.run = async (o) => { const r = await run(o); calls.push({ task: o.task, usage: (r && r.usage) || {}, stop: r && r.stopReason }); return r; };
  const ro = readOnly(real);
  const svc = new ScripOnService(ro, ai, new CanonService(ro, ai));

  const b = await real.developmentBuild.findUnique({ where: { id: buildId }, select: { name: true, projectId: true, brief: true } });
  if (!b) { console.error('no build ' + buildId); process.exit(2); }
  const brief = b.brief || {};
  const src = asSourceText(brief.sourceText);
  if (!src) { console.error('no source on ' + buildId); process.exit(2); }
  const stages = await svc.pipeline(b.projectId, buildId);
  const featDirective = [await svc.langDirective(brief), knowledgeDirective(brief)].filter(Boolean).join('\n');
  const ctxB = await svc.buildFeatureCtx(b.projectId, stages, featDirective, brief.sourceText);
  const cut = ctxB.indexOf("\n\nTHE SOURCE'S OWN RULES");
  if (cut < 0) { console.error('the feature context carries no register — nothing to compare'); process.exit(2); }
  const ctxA = ctxB.slice(0, cut);

  const cards = svc.sceneCards(stages);
  const sc = cards[SCENE - 1];
  if (!sc) { console.error('no scene ' + SCENE + ' (the SCENES stage has ' + cards.length + ')'); process.exit(2); }
  const header = SCENE + '  ' + svc.slugOf(sc, svc.isArabicBrief(brief));
  const budget = lineBudgetFor(snapPageWeight(sc.pageWeight));
  const lines = registerLines(transcribeRegister(src).facts);

  // Which register lines this scene can even touch: those naming someone present, other than the
  // protagonist, whose name is on nearly every line.
  const names = String(sc.characters || '').split(',').map((s) => s.trim()).filter(Boolean);
  const hero = new Set((names[0] || '').split(/\s+/));   // first and family name — "Quick" is on the family's lines too
  const tokens = [...new Set(names.slice(1).flatMap((n) => n.split(/\s+/)).filter((w) => /^[A-Z][a-z]{2,}/.test(w) && !hero.has(w)))];
  const inScope = lines.filter((l) => tokens.some((w) => new RegExp('\\b' + w + '\\b').test(l.rule)));

  console.log('BUILD ' + JSON.stringify(b.name) + '  ·  scene ' + header + '  ·  ' + N + ' sample(s) per arm');
  console.log('BRIEF ' + String(sc.brief || '').slice(0, 220));
  console.log('CTX   A (no register) ' + ctxA.length.toLocaleString() + ' chars  ·  B (register) ' + ctxB.length.toLocaleString()
    + ' chars  ·  register block ' + (ctxB.length - ctxA.length).toLocaleString() + ' chars, ' + lines.length + ' lines');
  console.log('BUDGET target ' + budget.target + ' lines · ask ' + budget.wordsAsk + ' words · maxTokens ' + budget.maxTokens);
  console.log('IN SCOPE (lines naming ' + tokens.join(', ') + '): ' + inScope.map((l) => '#' + l.n).join(' ') + '\n');
  if (args.includes('--dry')) { console.log('--dry: set-up only, no model called.'); await real.$disconnect(); return; }

  const res = { A: [], B: [] };
  const out = [];
  let stopped = null;
  // A run that dies part-way (a provider out of credit did, on the first real run) keeps what it
  // measured: every sample is written as it lands, and the summary covers what completed.
  samples: for (let k = 0; k < N; k++) {
    for (const arm of (k % 2 ? ['B', 'A'] : ['A', 'B'])) {
      try {
      const mark = calls.length;
      const text = await svc.writeScene(arm === 'A' ? ctxA : ctxB, sc, header, '', '', b.projectId, budget);
      const sceneCalls = calls.slice(mark).filter((c) => c.task === 'scripton.feature.scene');
      const words = (String(text).match(/\S+/g) || []).length;
      const defects = checkSceneIntegrity(0, header, String(text));
      const r = await ai.run({ task: 'scripton.develop.register-check', system: REGISTER_CHECK_SYSTEM,
        user: registerCheckUser(lines, 'SCENE', text), maxTokens: REGISTER_CHECK_MAXTOK, timeoutMs: 900000, projectId: b.projectId, refType: 'Project', refId: b.projectId });
      const rep = parseRegisterCheck(String((r && r.text) || '') || (r && r.json ? JSON.stringify(r.json) : ''), lines, text);
      const row = { arm, k: k + 1, words, ratio: budget.wordsAsk ? words / budget.wordsAsk : NaN, defects: defects.length, attempts: sceneCalls.length,
        cache: sceneCalls.map((c) => 'r' + (c.usage.cache_read_input_tokens || 0) + '/w' + (c.usage.cache_creation_input_tokens || 0) + '/in' + (c.usage.input_tokens || 0)).join(' '),
        ok: rep.ok, contradicted: rep.contradicted, lines: [...new Set(rep.items.map((i) => i.line))], unverified: rep.unverifiedQuotes, items: rep.items };
      res[arm].push(row);
      console.log(arm + k + 1 + '  ' + String(words).padStart(4) + ' words (' + row.ratio.toFixed(2) + 'x ask)  defects ' + row.defects + '  attempts ' + row.attempts
        + '  cache ' + row.cache + '  ·  ' + (rep.ok ? rep.contradicted + ' contradicted ' + JSON.stringify(row.lines) + (rep.unverifiedQuotes ? ' (' + rep.unverifiedQuotes + ' quote(s) not found)' : '') : 'CHECK FAILED'));
      out.push('==================== ARM ' + arm + ' · SAMPLE ' + (k + 1) + ' · ' + (arm === 'A' ? 'NO REGISTER' : 'REGISTER') + ' ====================\n'
        + String(text) + '\n\n--- register check: ' + rep.summary + '\n'
        + rep.items.map((i) => '#' + i.line + ' ' + i.rule.slice(0, 140) + '\n   "' + i.draft + '"' + (i.quoteFound ? '' : ' (NOT FOUND)') + '\n   ' + i.why).join('\n') + '\n');
      fs.writeFileSync(OUT, out.join('\n'));
      } catch (e) {
        stopped = arm + (k + 1) + ': ' + String((e && e.message) || e).slice(0, 300);
        break samples;
      }
    }
  }
  if (stopped) console.log('\nSTOPPED at ' + stopped + '\n— the summary covers only the samples that completed.');

  console.log('\nSUMMARY (n=' + res.A.length + ' in A, ' + res.B.length + ' in B; ' + N + ' asked per arm)');
  for (const arm of ['A', 'B']) {
    const rs = res[arm]; const okd = rs.filter((r) => r.ok);
    const freq = {}; for (const r of okd) for (const l of r.lines) freq[l] = (freq[l] || 0) + 1;
    console.log('  ' + arm + (arm === 'A' ? ' no register' : ' register   ')
      + '  contradicted ' + spread(okd.map((r) => r.contradicted))
      + '  ·  in scope ' + spread(okd.map((r) => r.lines.filter((l) => inScope.some((s) => s.n === l)).length))
      + '  ·  words/ask ' + spread(rs.map((r) => Number(r.ratio.toFixed(2))))
      + '  ·  defects ' + rs.reduce((a, r) => a + r.defects, 0) + '  ·  checks failed ' + (rs.length - okd.length));
    console.log('       lines hit (samples): ' + (Object.keys(freq).sort((x, y) => x - y).map((l) => '#' + l + '×' + freq[l]).join(' ') || 'none'));
  }
  fs.writeFileSync(OUT, out.join('\n'));
  console.log('\nTEXTS  ' + OUT);
  console.log('writes attempted and blocked: ' + (blocked.length ? [...new Set(blocked)].join(', ') : 'none'));
  await real.$disconnect();
})().catch((e) => { console.error('FAILED: ' + (e && (e.stack || e.message))); process.exit(2); });
