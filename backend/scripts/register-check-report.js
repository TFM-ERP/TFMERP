/**
 * THE REGISTER CHECK, PER STAGE — the contradiction rate, read back or measured.
 *
 *   node -r ts-node/register scripts/register-check-report.js <buildId>          # stored reports, read-only
 *   node -r ts-node/register scripts/register-check-report.js <buildId> --run    # check each current version now
 *
 * Without --run: prints data.registerCheck from each stage's current version. Free, read-only.
 *
 * With --run: checks each current version against the register transcribed from the build's source
 * — one paid model call per stage — and prints the result WITHOUT storing it: the service is handed
 * a database whose writes are blocked, so no version is touched. (The AI ledger still records each
 * call, as it does for every paid call.) This is how a ladder written BEFORE the register existed
 * gets a baseline rate to compare the regenerated one against.
 *
 * Exit 0 always when it ran; the numbers are the report.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaService } = require('../src/common/prisma/prisma.service.ts');
const { LlmRoutingService } = require('../src/ai/llm-routing.service.ts');
const { AiService } = require('../src/ai/ai.service.ts');
const { CanonService } = require('../src/production/scripton/canon/canon.service.ts');
const { ScripOnService } = require('../src/production/scripton/scripton.service.ts');

// The whole ladder, not just the eight stages the register rides on: v2.2's Ward-at-48 was in the DRAFT.
const LADDER = ['LOGLINE', 'PREMISE', 'THESIS', 'SYNOPSIS', 'STORY_ENGINE', 'SEASON_ARC', 'TREATMENT', 'BEATS', 'SCENES', 'STEP_OUTLINE', 'DRAFT'];
const buildId = process.argv[2];
const RUN = process.argv.includes('--run');
if (!buildId) { console.error('usage: node -r ts-node/register scripts/register-check-report.js <buildId> [--run]'); process.exit(2); }

const WRITE = /^(create|createMany|update|updateMany|upsert|delete|deleteMany)$/;
const readOnly = (real) => new Proxy(real, { get(t, k) {
  if (['$executeRaw', '$executeRawUnsafe', '$transaction'].includes(String(k))) return () => Promise.reject(new Error('WRITE BLOCKED ' + String(k)));
  const v = t[k];
  if (v && typeof v === 'object' && typeof v.findMany === 'function') {
    return new Proxy(v, { get(d, m) {
      const f = d[m];
      if (typeof f !== 'function') return f;
      return WRITE.test(String(m)) ? () => Promise.reject(new Error('WRITE BLOCKED ' + String(k) + '.' + String(m))) : f.bind(d);
    } });
  }
  return typeof v === 'function' ? v.bind(t) : v;
} });

(async () => {
  const real = new PrismaService();
  const ai = new AiService(real, new LlmRoutingService(real));     // real model, real ledger
  const ro = readOnly(real);
  const svc = new ScripOnService(ro, ai, new CanonService(ro, ai));  // versions untouchable
  const b = await real.developmentBuild.findUnique({ where: { id: buildId }, select: { name: true, projectId: true, brief: true } });
  if (!b) { console.error('no build ' + buildId); process.exit(2); }
  const src = String((b.brief && b.brief.sourceText) || '').trim();
  const facts = svc.composeCanon(src, [], {}).facts;
  const reg = facts.filter((f) => f.kind === 'REGISTER').length;
  console.log('BUILD ' + JSON.stringify(b.name) + '  ·  register ' + reg + ' lines  ·  ' + (RUN ? 'CHECKING NOW (paid, not stored)' : 'stored reports'));

  const stages = await real.developmentStage.findMany({ where: { buildId }, select: { kind: true, currentVersionId: true } });
  const rows = stages.filter((s) => LADDER.includes(s.kind) && s.currentVersionId)
    .sort((x, y) => LADDER.indexOf(x.kind) - LADDER.indexOf(y.kind));
  let lines = 0, stagesChecked = 0;
  for (const s of rows) {
    const v = await real.stageVersion.findUnique({ where: { id: s.currentVersionId }, select: { id: true, title: true, body: true, data: true, createdAt: true } });
    if (!v) continue;
    const rc = RUN ? await svc.checkAgainstRegister(v.id, s.kind, v.body, facts, b.projectId) : (v.data && v.data.registerCheck);
    console.log('\n' + s.kind.padEnd(10) + ' ' + (v.title || '') + '  (' + String(v.body || '').length.toLocaleString() + ' chars)');
    if (!rc) { console.log('  no register check on this version — it predates the register, or the check has not finished'); continue; }
    console.log('  ' + rc.summary);
    if (rc.ok) { lines += rc.contradicted; stagesChecked++; }
    for (const i of rc.items || []) {
      console.log('   #' + i.line + ' [' + (i.section || 'document') + '] ' + String(i.rule).slice(0, 110));
      console.log('      draft' + (i.quoteFound ? '' : ' (NOT FOUND IN DRAFT)') + ': "' + String(i.draft).slice(0, 160) + '"');
      console.log('      why: ' + String(i.why).slice(0, 160));
    }
  }
  console.log('\n' + stagesChecked + ' stage(s) checked · ' + lines + ' contradicted register line(s) in total (a line broken in two stages counts twice)');
  await real.$disconnect();
})().catch((e) => { console.error('FAILED: ' + (e && (e.stack || e.message))); process.exit(2); });
