/**
 * F9 — the ladder DRAFT states its page count against the target.
 *
 * The three states have to be three, and the boundaries have to be the ENGINE'S, not this file's.
 * Every threshold below is derived from the plan the service will actually build — nothing is
 * hard-coded to 110 or 99, so a change to the genre table moves the test with the code.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { draftLengthCheck } from './draft-length.util';
import { planFeatureLength } from './feature-length.util';

const plan = planFeatureLength({ genre: 'THRILLER', texture: 'PRODUCED' });

test('the plan under test is a feature-sized one', () => {
  assert.ok(plan.targetPages >= 90, 'targetPages ' + plan.targetPages);
  assert.ok(plan.minPages < plan.targetPages);
});

test('SEED — a ladder draft short of the floor says so, and says how short', () => {
  const r = draftLengthCheck(57, plan);
  assert.equal(r.state, 'SEED');
  assert.equal(r.pages, 57);
  assert.equal(r.targetPages, plan.targetPages);
  assert.match(r.note, /SEED, NOT A FEATURE/);
  assert.match(r.note, new RegExp(String(plan.minPages - 57) + ' pages short'));
});

test('ON_TARGET — the floor and the target are both inside the band', () => {
  assert.equal(draftLengthCheck(plan.minPages, plan).state, 'ON_TARGET');
  assert.equal(draftLengthCheck(plan.targetPages, plan).state, 'ON_TARGET');
});

test('one page below the floor is a SEED — the boundary is not fuzzy', () => {
  assert.equal(draftLengthCheck(plan.minPages - 1, plan).state, 'SEED');
});

test('OVER — past the hard page cap', () => {
  assert.equal(draftLengthCheck(140, plan).state, 'OVER');
});

test('ratio is reported, rounded, and never negative', () => {
  assert.equal(draftLengthCheck(57, plan).ratio, Math.round((57 / plan.targetPages) * 100) / 100);
  assert.equal(draftLengthCheck(-10, plan).pages, 0);
  assert.equal(draftLengthCheck(-10, plan).state, 'SEED');
});

/**
 * targetFrom — the field that stops "110" meaning two different things.
 *
 * The V3.2 brief carries `targetPages: 110`, so it is BRIEF. An empty brief collects the same 110
 * from the THRILLER profile's default and, without this field, reports it identically.
 */
test('targetFrom says BRIEF when the brief named a length', () => {
  const asked = planFeatureLength({ genre: 'THRILLER', targetPages: 110 });
  assert.equal(asked.targetFrom, 'BRIEF');
  const r = draftLengthCheck(57, asked);
  assert.equal(r.targetFrom, 'BRIEF');
  assert.doesNotMatch(r.note, /NOT asked for/);
});

test('targetFrom says DEFAULT when nothing in the brief did, and the note says so', () => {
  const assumed = planFeatureLength({ genre: 'THRILLER' });
  assert.equal(assumed.targetFrom, 'DEFAULT');
  const r = draftLengthCheck(57, assumed);
  assert.equal(r.targetFrom, 'DEFAULT');
  assert.match(r.note, /The target was NOT asked for/);
  assert.match(r.note, /measured against an assumption/);
});

test('an empty brief is DEFAULT — the silent-default case the :4870 comment warns about', () => {
  assert.equal(planFeatureLength({}).targetFrom, 'DEFAULT');
  assert.equal(planFeatureLength(null).targetFrom, 'DEFAULT');
});

test('minutes in the brief are still the brief asking', () => {
  assert.equal(planFeatureLength({ genre: 'THRILLER', targetMinutes: 100 }).targetFrom, 'BRIEF');
  assert.equal(planFeatureLength({ genre: 'THRILLER', length: '95 pages' }).targetFrom, 'BRIEF');
});

test('the three states are exhaustive across the whole page range', () => {
  const seen = new Set<string>();
  for (let p = 0; p <= 200; p++) seen.add(draftLengthCheck(p, plan).state);
  assert.deepEqual([...seen].sort(), ['ON_TARGET', 'OVER', 'SEED']);
});
