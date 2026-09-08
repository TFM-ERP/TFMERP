/**
 * VERIFY THE CANON BEFORE SPENDING ON THE LADDER.
 *
 * Runs the SHIPPED extraction prompt against one build's real sourceText and reports what the
 * schema actually held. Read-only against the database; one paid model call; writes nothing.
 *
 * WHY THIS EXISTS. The canon prompt was biography-only: of 30 facts extracted from a real bible, 28
 * were biography, and the sentences that decide the film — who the antagonist is, who permitted
 * versus who expanded, what the crime IS, what must happen before the climax — reached nothing at
 * all. Raising the fact cap could not fix that; there was no slot for them. Six structural kinds and
 * a per-category quota were added, and this is how you know they worked ON THIS DOCUMENT rather than
 * on the last one. Inspection is not verification: the first run of the new prompt overran its
 * 8,000-token ceiling and returned ZERO facts, which reading the prompt would never have revealed.
 *
 *   node scripts/verify-canon-extraction.js <buildId> [--claim "regex"] [--claim "..."]
 *
 * Exit 0 when every requested claim is represented, 1 when any is not.
 */
require('ts-node/register');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { SOURCE_CANON_SYSTEM, SOURCE_CANON_MAXTOK } = require('../src/production/scripton/canon/canon-prompt.util.ts');
const { parseFactsLoose } = require('../src/production/scripton/canon/canon-parse.util.ts');
const { mapAiFactsToCore } = require('../src/production/scripton/canon/canon-map.util.ts');
const { selectCanonByQuota, quotaSummary, quotaShortfall } = require('../src/production/scripton/canon/canon-quota.util.ts');
const { canonDirective, prohibitionDirective } = require('../src/production/scripton/canon/canon-inject.util.ts');

const STRUCTURAL = ['ROLE', 'CRIME', 'CAUSATION', 'OUTCOME', 'ORDERING', 'PROHIBITION'];

// What the schema must be able to hold at all. Each is checked ACROSS facts, not within one
// statement — "represented" means the pipeline carries the idea, not that one row contains every word.
const STRUCTURAL_CHECKS = [
  ['ROLE: an antagonist is named', 'ROLE', /antagonist|villain/i],
  ['ROLE: a betrayer is named', 'ROLE', /betray/i],
  ['CRIME: the crime itself is named', 'CRIME', /is_crime|crime/i],
  ['CRIME: something is marked a MECHANISM', 'CRIME', /mechanism|launder|invoice|shell/i],
  ['CAUSATION: permitted / authorised / expanded kept distinct', 'CAUSATION', /permitt|authoris|authoriz|expand|conceal|executed/i],
  ['OUTCOME: who survives or dies', 'OUTCOME', /surviv|dies|killed|testif|delivered/i],
  ['ORDERING: an explicit before / after', 'ORDERING', /occurs_before|occurs_after|before|after/i],
  ['PROHIBITION: at least one explicit rule', 'PROHIBITION', /./],
];

(async () => {
  const buildId = process.argv[2];
  if (!buildId) { console.error('usage: node scripts/verify-canon-extraction.js <buildId> [--claim "regex"]'); process.exit(2); }
  const claims = [];
  for (let i = 3; i < process.argv.length; i++) if (process.argv[i] === '--claim' && process.argv[i + 1]) claims.push(process.argv[++i]);

  const prisma = new PrismaClient();
  const b = await prisma.developmentBuild.findUnique({ where: { id: buildId }, select: { name: true, brief: true } });
  await prisma.$disconnect();
  if (!b) { console.error('No build ' + buildId); process.exit(2); }
  const src = (b.brief && b.brief.sourceText) || '';
  if (src.length < 400) { console.error('Build ' + JSON.stringify(b.name) + ' has ' + src.length + ' characters of source — nothing to extract.'); process.exit(2); }
  console.log('BUILD  ' + JSON.stringify(b.name) + '  —  ' + src.length.toLocaleString() + ' characters of source\n');

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error('ANTHROPIC_API_KEY not set'); process.exit(2); }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-opus-5', max_tokens: SOURCE_CANON_MAXTOK, system: SOURCE_CANON_SYSTEM,
      // THE WHOLE SOURCE, exactly as the service sends it. This carried its own slice(0, 60000) —
      // a second copy of the prompt assembly, which drifted the moment the service stopped slicing,
      // so a "verification" reported on 57% of the document while the pipeline read all of it. The
      // system prompt is imported for precisely this reason; the user half must be too.
      messages: [{ role: 'user', content: 'SOURCE MATERIAL:\n' + src }],
    }),
  });
  const j = await res.json();
  if (!res.ok) { console.error('API ' + res.status + ': ' + JSON.stringify(j).slice(0, 400)); process.exit(2); }
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');

  console.log('stop_reason=' + j.stop_reason + '  in=' + j.usage.input_tokens + '  out=' + j.usage.output_tokens + '/' + SOURCE_CANON_MAXTOK);
  if (j.stop_reason === 'max_tokens') console.log('  !! CUT AT THE CEILING — raise SOURCE_CANON_MAXTOK; facts below are only what survived.');

  // Saved so provenance can be checked offline — which section each fact came from is the real
  // measure of a wider read, not the fact COUNT, which moves by a few between identical runs.
  const savePath = (process.argv.indexOf('--save') > 0) ? process.argv[process.argv.indexOf('--save') + 1] : null;
  if (savePath) { require('fs').writeFileSync(savePath, text); console.log('  raw response saved to ' + savePath); }
  const loose = parseFactsLoose(text);
  if (loose.salvaged) console.log('  !! TRUNCATED — salvaged ' + loose.recovered + ' complete facts');
  if (!loose.facts.length) { console.error('\nNO FACTS AT ALL. Tail:\n' + text.slice(-400)); process.exit(1); }

  const picked = selectCanonByQuota(mapAiFactsToCore(loose.facts, { id: '', order: 0 }), { total: 60 });
  const all = picked.facts.concat(picked.prohibitions);
  const bio = Object.entries(picked.counts).filter(([k]) => !STRUCTURAL.includes(k)).reduce((n, [, v]) => n + v, 0);

  console.log('\nEXTRACTED ' + picked.extracted + ' → KEPT ' + picked.kept + '   ' + quotaSummary(picked.counts));
  console.log('biography ' + bio + ' of ' + picked.kept + '   (the failure being fixed was 28 of 30)');
  if (picked.capBound) console.log('\n  !! ' + quotaShortfall(picked));

  console.log('\n--- STRUCTURAL FACTS AND RULES REACHING THE PROMPT ---');
  for (const f of all) if (STRUCTURAL.includes(f.kind)) console.log('  ' + f.kind.padEnd(12) + f.statement.slice(0, 190));

  const has = (kind, re) => all.some((f) => (!kind || f.kind === kind)
    && re.test(f.subject + ' ' + f.predicate + ' ' + f.object + ' ' + f.statement));

  console.log('\n--- CAN THE SCHEMA HOLD STRUCTURE ON THIS DOCUMENT? ---');
  let fail = 0;
  for (const [name, kind, re] of STRUCTURAL_CHECKS) {
    const ok = has(kind, re);
    console.log((ok ? '  PASS  ' : '  FAIL  ') + name);
    if (!ok) fail++;
  }
  if (claims.length) {
    console.log('\n--- THE CLAIMS YOU ASKED FOR ---');
    for (const c of claims) {
      const ok = has(null, new RegExp(c, 'i'));
      console.log((ok ? '  PASS  ' : '  FAIL  ') + c);
      if (!ok) fail++;
    }
  }
  console.log('\nprompt bytes this adds to every stage: '
    + (canonDirective(all, { at: 0, max: 60 }).length + prohibitionDirective(all).length).toLocaleString());
  console.log(fail ? '\n' + fail + ' CHECK(S) FAILED — do not spend on the ladder yet.' : '\nALL CHECKS PASSED.');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FAILED: ' + (e && e.message)); process.exit(2); });
