/**
 * ASSEMBLE THE REAL STAGE PROMPT AND GREP IT — without generating anything and without writing.
 *
 *   node -r ts-node/register scripts/verify-stage-prompt.js <buildId> [--kind SYNOPSIS] [--phrase "…"]…
 *
 * Goes through ScripOnService.generateStage itself, so what it prints is the prompt the model would
 * receive, not a reconstruction of it. Reads pass to the database; EVERY WRITE IS BLOCKED (create,
 * update, upsert, delete, raw execute, transactions) and listed; the model is a stub that captures
 * the prompt and throws, so no version is created and nothing is paid for.
 *
 * Canon: the stored row for this source if there is one (the real canon, as a stage would get it).
 * If there is none, the register alone is composed onto ZERO extracted facts and the script says so —
 * every hit is then provably from the transcribed register or the excerpt, never from the luck of a
 * model's sampling.
 *
 * Phrases are matched after normalising curly quotes: the bible writes "don’t", and a straight-
 * apostrophe grep would report a phrase that is present three times as absent.
 *
 * Exit 0 when every --phrase is found, 1 when any is not.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaService } = require('../src/common/prisma/prisma.service.ts');
const { CanonService } = require('../src/production/scripton/canon/canon.service.ts');
const { ScripOnService } = require('../src/production/scripton/scripton.service.ts');
const { selectForStage } = require('../src/production/scripton/canon/canon-select.util.ts');

const args = process.argv.slice(2);
const buildId = args[0];
const kindAt = args.indexOf('--kind');
const KIND = kindAt > 0 ? String(args[kindAt + 1]).toUpperCase() : 'SYNOPSIS';
const PHRASES = [];
for (let i = 1; i < args.length; i++) if (args[i] === '--phrase' && args[i + 1]) PHRASES.push(args[++i]);
if (!buildId) { console.error('usage: node -r ts-node/register scripts/verify-stage-prompt.js <buildId> [--kind SYNOPSIS] [--phrase "…"]'); process.exit(2); }

const blocked = [];
const WRITE = /^(create|createMany|update|updateMany|upsert|delete|deleteMany)$/;
const guard = (d, name) => new Proxy(d, { get(t, k) {
  const v = t[k];
  if (typeof v !== 'function') return v;
  if (WRITE.test(String(k))) return () => { blocked.push(name + '.' + String(k)); return Promise.reject(new Error('WRITE BLOCKED: ' + name + '.' + String(k))); };
  return v.bind(t);
} });

(async () => {
  const real = new PrismaService();
  const prisma = new Proxy(real, { get(t, k) {
    if (['$executeRaw', '$executeRawUnsafe', '$transaction'].includes(String(k))) {
      return () => { blocked.push(String(k)); return Promise.reject(new Error('WRITE BLOCKED ' + String(k))); };
    }
    const v = t[k];
    if (v && typeof v === 'object' && typeof v.findMany === 'function') return guard(v, String(k));
    return typeof v === 'function' ? v.bind(t) : v;
  } });
  const calls = []; let captured = null;
  const ai = { run: async (o) => {
    calls.push(o.task);
    if (o.task === 'scripton.develop.' + KIND.toLowerCase()) { captured = o; throw new Error('CAPTURED — stub model'); }
    throw new Error('stub model: refusing ' + o.task);
  } };
  const svc = new ScripOnService(prisma, ai, new CanonService(prisma, ai));
  const b = await real.developmentBuild.findUnique({ where: { id: buildId }, select: { projectId: true, name: true, canonState: true, brief: true } });
  if (!b) { console.error('no build ' + buildId); process.exit(2); }
  const src = String((b.brief && b.brief.sourceText) || '').trim();
  console.log('BUILD ' + JSON.stringify(b.name) + '  canonState=' + b.canonState + '  source ' + src.length.toLocaleString() + ' chars');

  let canon = await svc.loadSourceCanon(b.projectId || b.id, src, { extract: false });
  if (canon) console.log('CANON    the STORED canon (' + canon.facts.length + ' facts, ' + canon.from + ')');
  else {
    const c = svc.composeCanon(src, [], { note: 'verify-stage-prompt: no stored canon — register only' });
    svc.sourceCanonCache.set(svc.canonKeyOf(src).key, { facts: c.facts, account: c.account });
    canon = c;
    console.log('CANON    no stored canon for this source — the REGISTER ALONE, on zero extracted facts');
  }
  const reg = canon.account && canon.account.register;
  if (reg) console.log('REGISTER ' + reg.summary);
  const zero = selectForStage(canon.facts, { budgetChars: 0 });
  if (zero.byKind.REGISTER) console.log('BUDGET 0 REGISTER sent ' + zero.byKind.REGISTER.sent + ' of ' + zero.byKind.REGISTER.total);

  let err = null;
  try { await svc.generateStage({ projectId: b.projectId, kind: KIND, buildId }, null); } catch (e) { err = e; }
  await real.$disconnect();
  if (!captured) { console.error('\nNO PROMPT CAPTURED — ' + (err && err.message) + '\nmodel calls: ' + calls.join(', ')); process.exit(1); }
  const prompt = String(captured.system || '') + '\n' + String(captured.user || '');
  const out = path.join(require('os').tmpdir(), 'stage-prompt-' + buildId + '-' + KIND + '.txt');   // outside the repo
  fs.writeFileSync(out, prompt);
  console.log('PROMPT   ' + KIND + ' ' + prompt.length.toLocaleString() + ' chars  →  ' + out);

  const norm = (t) => t.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const P = norm(prompt);
  const lines = P.split('\n');
  const start = lines.findIndex((l) => l.startsWith("THE SOURCE'S OWN RULES"));
  const per = {}; let sec = null, n = 0;
  for (let k = start + 1; start >= 0 && k < lines.length; k++) {
    if (/^ABSOLUTE CONSTRAINTS|^Return ONLY JSON|^Write the screenplay/.test(lines[k])) break;
    if (/^\[.*\]$/.test(lines[k])) { sec = lines[k].slice(1, -1); continue; }
    if (lines[k].startsWith('- ')) { n++; per[sec] = (per[sec] || 0) + 1; }
  }
  console.log('REGISTER LINES IN THE PROMPT ' + n + (reg ? ' of ' + reg.total : ''));
  for (const r of (reg && reg.registers) || []) console.log('  ' + r.section + ': ' + (per[r.section] || 0) + ' in the prompt, ' + r.facts + ' transcribed');

  let missing = 0;
  if (PHRASES.length) console.log('\nPHRASES');
  for (const ph of PHRASES) {
    const hits = P.split(norm(ph)).length - 1;
    const raw = prompt.split(ph).length - 1;
    const where = [];
    let i = -1;
    while ((i = P.indexOf(norm(ph), i + 1)) >= 0) {
      const block = P.lastIndexOf("THE SOURCE'S OWN RULES", i);
      const head = P.lastIndexOf('\n[', i);
      where.push(block >= 0 && head > block ? P.slice(head + 2, P.indexOf(']', head)) : 'outside the register');
    }
    if (!hits) missing++;
    console.log('  ' + (hits ? 'FOUND ' : 'ABSENT') + '  ' + JSON.stringify(ph) + '  ×' + hits
      + (hits && !raw ? '  (after normalising quotes)' : '') + (where.length ? '  ← ' + [...new Set(where)].join(' | ') : ''));
  }
  console.log('\nwrites attempted and blocked: ' + (blocked.length ? blocked.join(', ') : 'none') + '   ·   model calls: ' + calls.join(', '));
  process.exit(missing ? 1 : 0);
})().catch((e) => { console.error('FAILED: ' + (e && (e.stack || e.message))); process.exit(2); });
