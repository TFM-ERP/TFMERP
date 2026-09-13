/**
 * The era check: three states, notes that are not findings, and no fraction anywhere.
 * Run: npm run test:unit
 *
 * The check that needs no model call. Its whole value is that it says what it could NOT do —
 * "no source material", "two expressions measuring from something it cannot date" — rather than
 * printing "no findings" over silence.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildEraCheck, ERA_ANCHOR_CONFLICT } from './era-check.util';

const hit = (text: string, from: number | null) => ({ text, start: 0, end: text.length, offset: from === null ? null : { from, to: from } });
const anchor = (over: any = {}) => ({ year: 2026, provenance: 'COMPUTED' as const, stored: true, ...over });
const AT = '2026-09-13T00:00:00.000Z';
const run = (over: any = {}) => buildEraCheck({ hits: [], anchor: anchor(), materialChars: 105179, at: AT, ...over });

test('a clean stage: it ran, found nothing, and says so without a fraction', () => {
  const r = run({ hits: [hit('seven years before', -2557), hit('1994', -11688)] });
  assert.equal(r.state, 'NO FINDINGS');
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.expressions, { total: 2, resolved: 2, unresolved: 0, samples: [] });
  assert.match(r.summary, /nothing in this stage contradicts the timeline/);
  assert.doesNotMatch(r.summary, /\b\d+ of \d+\b/, 'no ratio in the summary — the Keep ruling, applied here');
  assert.equal(r.at, AT);
});

test('TWO DATINGS THAT DISAGREE ARE THE FINDING, and the code is the exported constant', () => {
  const r = run({ anchor: anchor({ year: null, provenance: 'ASK', conflict: { years: [2026, 2024], pairs: ['2019 + "seven years before"', '1994 + "thirty years before"'] } }) });
  assert.equal(r.state, 'FINDINGS');
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].code, ERA_ANCHOR_CONFLICT);
  assert.equal(ERA_ANCHOR_CONFLICT, 'ERA_ANCHOR_CONFLICT');
  assert.match(r.findings[0].note, /2026 and 2024/);
  assert.equal(r.findings[0].evidence.length, 2);
});

test('NO ANCHOR IS NOT RUN, WITH THE REASON — never "no findings"', () => {
  const r = run({ anchor: anchor({ year: null, provenance: 'ASK', note: '"Sometime after the war" is not a period this map knows.' }) });
  assert.equal(r.state, 'NOT RUN');
  assert.match(r.reason || '', /not a period this map knows/);
  assert.match(r.summary, /^ERA CHECK DID NOT RUN: /);
  assert.deepEqual(r.findings, []);
});

test('but a conflict OUTRANKS the missing anchor — the refusal is itself the finding', () => {
  const r = run({ anchor: anchor({ year: null, provenance: 'ASK', note: 'Two datings disagree.', conflict: { years: [1994, 1996], pairs: ['a', 'b'] } }) });
  assert.equal(r.state, 'FINDINGS');
  assert.equal(r.findings[0].code, ERA_ANCHOR_CONFLICT);
});

test('NO SOURCE MATERIAL IS A STATED CONDITION, counted and quoted, never a fault', () => {
  const r = run({ materialChars: 0, hits: [] });
  assert.ok(r.notes.some((n) => /no source material, so no temporal expression could be read/.test(n)), JSON.stringify(r.notes));
  assert.deepEqual(r.findings, [], 'and it is not a finding');
  assert.equal(r.state, 'NO FINDINGS');
});

test('A DISTANCE WITH NO BASE IS COUNTED AND QUOTED, not silently dropped', () => {
  // What the sweep actually returns unresolved: a magnitude whose base is missing. A bare "before
  // the war", with no number in it, is never a hit at all — Task 3a's problem, not this one's.
  const r = run({ hits: [hit('seven years before', null), hit('two years after', null), hit('seven years before', -2557)] });
  assert.equal(r.expressions.unresolved, 2);
  assert.deepEqual(r.expressions.samples, ['seven years before', 'two years after']);
  assert.ok(r.notes.some((n) => /2 temporal expressions measure a distance from something this build cannot date/.test(n) && /"seven years before"/.test(n)), JSON.stringify(r.notes));
  assert.equal(r.state, 'NO FINDINGS', 'unresolvable is not a defect in the writing');
});

test('one unresolved expression is said in the singular', () => {
  const r = run({ hits: [hit('seven years before', null)] });
  assert.ok(r.notes.some((n) => /1 temporal expression measures a distance/.test(n)), JSON.stringify(r.notes));
});

test('NO FINDINGS STATES ITS OWN BLINDNESS — and only that state does', () => {
  const clean = run({ hits: [hit('seven years before', -2557)] });
  assert.equal(clean.state, 'NO FINDINGS');
  assert.ok(clean.notes.some((n) => /Bare event references .* carry no number and are not read by this check at all/.test(n)
    && /Nothing here says whether they are consistent/.test(n)), JSON.stringify(clean.notes));

  const found = run({ anchor: anchor({ year: null, provenance: 'ASK', conflict: { years: [1994, 1996], pairs: ['a'] } }) });
  assert.equal(found.state, 'FINDINGS');
  assert.equal(found.notes.filter((n) => /Bare event references/.test(n)).length, 0, 'a stage with a finding is not being read as health');

  const notRun = run({ anchor: anchor({ year: null, provenance: 'ASK', note: 'no period.' }) });
  assert.equal(notRun.state, 'NOT RUN');
  assert.equal(notRun.notes.filter((n) => /Bare event references/.test(n)).length, 0);
});

test('AN UNPERSISTED ANCHOR SAYS SO — stored:false reaches the stage', () => {
  const r = run({ anchor: anchor({ stored: false }) });
  assert.ok(r.notes.some((n) => /NOT PERSISTED/.test(n)), JSON.stringify(r.notes));
  assert.equal(r.anchor.stored, false);
});

test('an assumed anchor cannot pass as a computed one', () => {
  assert.ok(run({ anchor: anchor({ provenance: 'ERA_MIDPOINT', year: 1000 }) }).notes.some((n) => /derived from the chosen period/.test(n)));
  assert.ok(run({ anchor: anchor({ provenance: 'DEFAULTED_PRESENT' }) }).notes.some((n) => /assumed to be this year/.test(n)));
  assert.equal(run({ anchor: anchor({ provenance: 'COMPUTED' }) }).notes.filter((n) => /assumed|derived from the chosen/.test(n)).length, 0);
  assert.equal(run().anchor.provenance, 'COMPUTED');
});

test('no anchor at all is NOT RUN, and nothing throws on junk', () => {
  assert.equal(buildEraCheck({ hits: [], anchor: null, materialChars: 0, at: AT }).state, 'NOT RUN');
  assert.equal(buildEraCheck({ hits: null as any, anchor: null as any, materialChars: NaN as any }).state, 'NOT RUN');
});

test('the samples are capped, so a register of forty phrases does not become the summary', () => {
  const many = Array.from({ length: 40 }, (_, i) => hit('before event ' + i, null));
  const r = run({ hits: many });
  assert.equal(r.expressions.unresolved, 40);
  assert.equal(r.expressions.samples.length, 5);
});
