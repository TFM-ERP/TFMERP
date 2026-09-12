/**
 * DEVELOPMENT SO FAR: whole stages, most recent first, and it says what it holds.
 * Run: npm run test:unit
 *
 * The old rule sent the first 2,400 characters of every earlier stage. V2.6's BEATS therefore
 * received 5,095 characters of a 15,067-character ladder and invented what lay past the cut. The
 * budget is now spent on WHOLE stages from the bottom up; the one that does not fit whole goes in as
 * a single labelled fragment; anything past it is named, never silently absent.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { developmentSoFar, soFarLabel, SOFAR_BUDGET, SOFAR_MIN_FRAGMENT } from './development-so-far.util';

const body = (n: number, seed = 'x') => (seed + ' ').repeat(Math.ceil(n / 2)).slice(0, n);
/** V2.6 at BEATS, and cmttt92yx at DRAFT — the two real ladders measured on 11–12 Sep. */
const V26 = [{ kind: 'LOGLINE', body: body(241) }, { kind: 'SYNOPSIS', body: body(5034, 'y') }, { kind: 'TREATMENT', body: body(9792, 'z') }];
const FULL = [['LOGLINE', 270], ['SYNOPSIS', 4477], ['TREATMENT', 8915], ['BEATS', 12463], ['SCENES', 16974], ['STEP_OUTLINE', 17166]]
  .map(([k, n]) => ({ kind: k as string, body: body(n as number, String(k).charAt(0).toLowerCase()) }));

test('the budget carries every measured ladder WHOLE — nothing labelled "first N of"', () => {
  for (const stages of [V26, FULL]) {
    const r = developmentSoFar(stages);
    assert.deepEqual(r.omitted, []);
    assert.ok(r.parts.every((p) => p.complete), stages.map((s) => s.kind).join(','));
    assert.equal(r.parts.length, stages.length);
    assert.doesNotMatch(r.block, /\(first /);
  }
  const r = developmentSoFar(FULL);
  assert.ok(r.block.includes('--- STEP_OUTLINE (complete, 17,166 characters) ---'));
  assert.ok(r.block.includes('--- SCENES (complete, 16,974 characters) ---'));
});

test('SPENT NEWEST FIRST: when the budget is short, the nearest stages are the ones carried whole', () => {
  const r = developmentSoFar(FULL, 30000);           // STEP_OUTLINE 17,166 whole, then 12,834 left
  assert.deepEqual(r.parts.map((p) => p.kind), ['SCENES', 'STEP_OUTLINE']);
  assert.deepEqual(r.parts.map((p) => p.complete), [false, true], 'the nearest stage is whole; the next is the fragment');
  assert.equal(r.parts[0].sent, 30000 - 17166);
  assert.deepEqual(r.omitted.map((o) => o.kind), ['LOGLINE', 'SYNOPSIS', 'TREATMENT', 'BEATS']);
});

test('THE ONE THAT DOES NOT FIT IS A LABELLED FRAGMENT, NOT A DROP', () => {
  const r = developmentSoFar(FULL, 20000);           // STEP_OUTLINE 17,166 whole, 2,834 left for SCENES
  assert.deepEqual(r.parts.map((p) => p.kind), ['SCENES', 'STEP_OUTLINE']);
  assert.equal(r.parts[0].complete, false);
  assert.equal(r.parts[0].sent, 20000 - 17166);
  assert.ok(r.block.includes('--- SCENES (first 2,834 of 16,974 characters) ---'));
  assert.ok(r.block.includes('--- STEP_OUTLINE (complete, 17,166 characters) ---'));
});

test('ANYTHING OMITTED IS NAMED, with its size, before the content', () => {
  const r = developmentSoFar(FULL, 20000);
  assert.match(r.block, /^\nDEVELOPMENT SO FAR \([^)]*\):\n\[Not carried here, for length: LOGLINE \(270 characters\), SYNOPSIS \(4,477 characters\), TREATMENT \(8,915 characters\), BEATS \(12,463 characters\)\. Everything below this line is present as labelled\.\]\n--- SCENES/);
  assert.deepEqual(r.omitted, [{ kind: 'LOGLINE', total: 270 }, { kind: 'SYNOPSIS', total: 4477 }, { kind: 'TREATMENT', total: 8915 }, { kind: 'BEATS', total: 12463 }]);
});

test('the content never exceeds the budget, and is printed oldest first', () => {
  for (const B of [2000, 9000, 20000, 30000, 64000]) {
    const r = developmentSoFar(FULL, B);
    const carried = r.parts.reduce((a, p) => a + p.sent, 0);
    assert.ok(carried <= B, B + ': ' + carried);
    const order = r.parts.map((p) => p.kind);
    assert.deepEqual(order, FULL.map((s) => s.kind).filter((k) => order.includes(k)), 'ladder order');
  }
});

test('a scrap of room is not worth a fragment: the stage is named as omitted instead', () => {
  const r = developmentSoFar(FULL, 17166 + SOFAR_MIN_FRAGMENT - 1);
  assert.deepEqual(r.parts.map((p) => p.kind), ['STEP_OUTLINE']);
  assert.ok(r.omitted.some((o) => o.kind === 'SCENES'));
  const r2 = developmentSoFar(FULL, 17166 + SOFAR_MIN_FRAGMENT);
  assert.deepEqual(r2.parts.map((p) => p.kind), ['SCENES', 'STEP_OUTLINE']);
  assert.equal(r2.parts[0].sent, SOFAR_MIN_FRAGMENT);
});

test('a single stage larger than the whole budget is still carried, as a fragment', () => {
  const r = developmentSoFar([{ kind: 'DRAFT', body: body(38257) }], 14000);
  assert.deepEqual(r.parts, [{ kind: 'DRAFT', sent: 14000, total: 38257, complete: false }]);
  assert.ok(r.block.includes('--- DRAFT (first 14,000 of 38,257 characters) ---'));
  assert.deepEqual(r.omitted, []);
});

test('the header sentence is unchanged', () => {
  assert.match(developmentSoFar(V26).block, /^\nDEVELOPMENT SO FAR \(everything already written - stay fully consistent with all of it; build directly on it\):\n--- LOGLINE/);
});

test('labels: complete, or first N of M', () => {
  assert.equal(soFarLabel('LOGLINE', 241, 241), '--- LOGLINE (complete, 241 characters) ---');
  assert.equal(soFarLabel('TREATMENT', 2400, 9792), '--- TREATMENT (first 2,400 of 9,792 characters) ---');
});

test('the budget is the measured one, and empty in is empty out', () => {
  assert.equal(SOFAR_BUDGET, 64000, 'the largest prior ladder measured is 60,265 characters');
  for (const stages of [[], [{ kind: 'LOGLINE', body: '' }], null as any, undefined as any]) {
    const r = developmentSoFar(stages);
    assert.equal(r.block, '');
    assert.deepEqual(r.parts, []);
    assert.deepEqual(r.omitted, []);
  }
});
