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
  assert.match(r.summary, /never dates the present, so there was nothing to compare it against/);
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
  assert.ok(clean.notes.some((n) => /bare references like "before the war", which carry no number and are not read by this check at all/.test(n)),
    JSON.stringify(clean.notes));

  const found = run({ anchor: anchor({ year: null, provenance: 'ASK', conflict: { years: [1994, 1996], pairs: ['a'] } }) });
  assert.equal(found.state, 'FINDINGS');
  assert.equal(found.notes.filter((n) => /Bare event references/.test(n)).length, 0, 'a stage with a finding is not being read as health');

  const notRun = run({ anchor: anchor({ year: null, provenance: 'ASK', note: 'no period.' }) });
  assert.equal(notRun.state, 'NOT RUN');
  assert.equal(notRun.notes.filter((n) => /Bare event references/.test(n)).length, 0);
});


// ── the comparison: the stage's own dating, against itself and against the anchor ───────────────
//
// These are the tests that CAN come back positive. Before them the only finding in this file came
// from the anchor — a per-build fact, identical on every stage — so no stage body could ever produce
// one, and the head line claimed a comparison that never happened.

test('A STAGE THAT DATES THE PRESENT TWO WAYS IS A FINDING', () => {
  const r = run({ bodyPairs: [{ year: 2026, text: '2019 + "seven years before"' }, { year: 2024, text: '1994 + "thirty years before"' }] });
  assert.equal(r.state, 'FINDINGS');
  assert.equal(r.findings[0].code, ERA_ANCHOR_CONFLICT);
  assert.match(r.findings[0].note, /dates the present two ways — 2026 and 2024/);
  assert.equal(r.findings[0].evidence.length, 2);
});

test('A STAGE THAT CONTRADICTS A COMPUTED ANCHOR IS A FINDING', () => {
  const r = run({ anchor: anchor({ year: 2026, provenance: 'COMPUTED' }), bodyPairs: [{ year: 1994, text: '1987 + "seven years before"' }] });
  assert.equal(r.state, 'FINDINGS');
  assert.match(r.findings[0].note, /dates the present at 1994, and the material dated it at 2026/);
});

test('but against an ASSUMED anchor it is a NOTE — the stage is the better evidence', () => {
  for (const p of ['DEFAULTED_PRESENT', 'ERA_MIDPOINT']) {
    const r = run({ anchor: anchor({ year: 2026, provenance: p as any }), bodyPairs: [{ year: 1994, text: '1987 + "seven years before"' }] });
    assert.equal(r.state, 'NO FINDINGS', p + ' must not accuse');
    assert.ok(r.notes.some((n) => /dates the present at 1994/.test(n) && /Set the present year if the stage is right/.test(n)), JSON.stringify(r.notes));
    // THE HEAD LINE MUST NOT CONTRADICT THAT NOTE. It printed "agrees with the story's present year"
    // beside a note saying it disagrees, because the branch tested whether pairs existed at all.
    assert.doesNotMatch(r.summary, /own dating agrees with the story's present year/, p + ': the head line claimed agreement');
    assert.match(r.summary, /dates the present differently from the year assumed here, which is not treated as a contradiction/);
  }
});

test('A STAGE THAT DATES ITSELF WITH NO ANCHOR IS NOT SILENT — it is the answer nobody asked for', () => {
  const r = run({ anchor: anchor({ year: null, provenance: 'ASK', note: 'No period.' }), bodyPairs: [{ year: 1994, text: '1987 + "seven years before"' }] });
  assert.equal(r.state, 'NOT RUN', 'there is still no anchor to measure against');
  assert.ok(r.notes.some((n) => /dates the present at 1994/.test(n) && /this build has no present year at all/.test(n) && /Set it — the stage has the answer/.test(n)),
    JSON.stringify(r.notes));
  assert.doesNotMatch(r.summary, /own dating agrees/);
});

test('a stage whose dating AGREES with the anchor is clean, and says what it compared', () => {
  const r = run({ anchor: anchor({ year: 2026, provenance: 'COMPUTED' }), bodyPairs: [{ year: 2026, text: '2019 + "seven years before"' }] });
  assert.equal(r.state, 'NO FINDINGS');
  assert.match(r.summary, /this stage's own dating agrees with the story's present year/);
  assert.ok(r.notes.some((n) => /What was checked: whether this stage dates the present in two different ways/.test(n)));
});

test('A STAGE THAT NEVER DATES THE PRESENT SAYS SO — it does not claim a clean timeline', () => {
  // Measured 13 Sep: V2.6's TREATMENT, SCENES and SYNOPSIS and n2's TREATMENT carry 27 temporal hits
  // and NOT ONE absolute year, so this is what every real stage today produces.
  const r = run({ hits: [hit('SEVEN YEARS EARLIER', -2557), hit('eight years ago', -2922)], bodyPairs: [] });
  assert.equal(r.state, 'NO FINDINGS');
  assert.match(r.summary, /never dates the present, so there was nothing to compare it against/);
  assert.ok(r.notes.some((n) => /this stage dates the present in no way at all, so nothing was compared/.test(n)), JSON.stringify(r.notes));
  assert.ok(r.notes.some((n) => /whether "seven years earlier" and "eight years ago" mean the same event, which needs the events named/.test(n)));
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
