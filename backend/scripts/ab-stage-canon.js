/**
 * A/B THE STAGE BLOCK: full canon vs selected, same stage, same everything.
 *
 *   node scripts/ab-stage-canon.js <buildId>
 *
 * The stage block was the record — 26,651 bytes of canon on all eight ladder stages and then every
 * scene call. selectForStage carries the rules whole and takes everything else round-robin by
 * section. This asks the only question that matters: does the smaller block still carry the
 * sentences that decide the film? Read-only against the database; two paid model calls.
 */
require('ts-node/register');
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { SOURCE_CANON_SYSTEM, SOURCE_CANON_MAXTOK } = require('../src/production/scripton/canon/canon-prompt.util.ts');
const { parseFactsLoose } = require('../src/production/scripton/canon/canon-parse.util.ts');
const { mapAiFactsToCore } = require('../src/production/scripton/canon/canon-map.util.ts');
const { selectCanonByQuota } = require('../src/production/scripton/canon/canon-quota.util.ts');
const { locateFacts } = require('../src/production/scripton/canon/canon-locate.util.ts');
const { selectForStage } = require('../src/production/scripton/canon/canon-select.util.ts');
const { canonDirective, prohibitionDirective } = require('../src/production/scripton/canon/canon-inject.util.ts');

// The four sentences this whole exercise exists for, as concepts checked across the block.
const NAMED = [
  ['who the antagonist is', /antagonist/i],
  ['who the deepest betrayal is', /betray/i],
  ['permitted vs expanded, kept apart', /permitt|authoris|authoriz/i],
  ['the crime itself', /traffick|is_crime|crime/i],
  ['what must happen before what', /before|occurs_before/i],
];

(async () => {
  const buildId = process.argv[2];
  if (!buildId) { console.error('usage: node scripts/ab-stage-canon.js <buildId>'); process.exit(2); }
  const prisma = new PrismaClient();
  const b = await prisma.developmentBuild.findUnique({ where: { id: buildId }, select: { name: true, brief: true } });
  await prisma.$disconnect();
  const src = (b && b.brief && b.brief.sourceText) || '';
  if (!src) { console.error('no source on ' + buildId); process.exit(2); }
  console.log('BUILD ' + JSON.stringify(b.name) + '  ' + src.length.toLocaleString() + ' chars\n');

  const key = process.env.ANTHROPIC_API_KEY;
  const cacheFile = '.ab-canon-' + buildId + '.json';
  let text;
  if (require('fs').existsSync(cacheFile)) {
    text = require('fs').readFileSync(cacheFile, 'utf8');
    console.log('reusing the cached extraction (delete ' + cacheFile + ' to re-extract)\n');
  } else {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-opus-5', max_tokens: SOURCE_CANON_MAXTOK, system: SOURCE_CANON_SYSTEM,
        messages: [{ role: 'user', content: 'SOURCE MATERIAL:\n' + src }] }),
    });
    const j = await res.json();
    if (!res.ok) { console.error('API ' + res.status + ': ' + JSON.stringify(j).slice(0, 300)); process.exit(2); }
    text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    require('fs').writeFileSync(cacheFile, text);
    console.log('extraction: out=' + j.usage.output_tokens + '/' + SOURCE_CANON_MAXTOK + '  stop=' + j.stop_reason + '\n');
  }

  const picked = selectCanonByQuota(mapAiFactsToCore(parseFactsLoose(text).facts, { id: '', order: 0 }));
  const placed = locateFacts(src, picked.facts.concat(picked.undroppable));
  const full = placed.facts;
  const sel = selectForStage(full);

  const block = (facts) => canonDirective(facts, { at: 0, max: 100000 }) + '\n' + prohibitionDirective(facts);
  const A = block(full);
  const B = block(sel.facts);

  console.log('  FULL      ' + String(full.length).padStart(4) + ' facts   ' + A.length.toLocaleString().padStart(7) + ' bytes');
  console.log('  SELECTED  ' + String(sel.facts.length).padStart(4) + ' facts   ' + B.length.toLocaleString().padStart(7) + ' bytes   '
    + Math.round((B.length / A.length) * 100) + '% of full');
  console.log('  ' + sel.note);
  console.log('  saved per stage: ' + (A.length - B.length).toLocaleString() + ' bytes  ·  across 8 stages: '
    + ((A.length - B.length) * 8).toLocaleString() + ' bytes');

  console.log('\n--- THE FOUR NAMED SENTENCES, IN EACH BLOCK ---');
  let lost = 0;
  for (const [name, re] of NAMED) {
    const inA = re.test(A); const inB = re.test(B);
    console.log('  full ' + (inA ? 'YES' : 'NO ') + '   selected ' + (inB ? 'YES' : 'NO ') + '   ' + name);
    if (inA && !inB) lost++;
  }

  const sectionsIn = (t) => new Set(full.filter((x) => t.includes(String(x.statement).slice(0, 40))).map((x) => x.sourceSection || '(unplaced)'));
  console.log('\n  sections represented — full ' + sectionsIn(A).size + ', selected ' + sectionsIn(B).size);
  console.log('\n' + (lost ? lost + ' NAMED SENTENCE(S) LOST BY SELECTING — keep the full block.'
    : 'NOTHING NAMED WAS LOST. The selected block carries them at ' + Math.round((B.length / A.length) * 100) + '% of the size.'));
  process.exit(lost ? 1 : 0);
})().catch((e) => { console.error('FAILED: ' + (e && e.message)); process.exit(2); });
