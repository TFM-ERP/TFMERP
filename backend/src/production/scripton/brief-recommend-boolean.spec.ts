/**
 * F0 — the recommender's type declarations, and the save they were rejecting.
 *
 * The defect these pin: `realBased` and `researchSubject` are `Boolean` columns, but were declared
 * `{ kind: 'number', min: 0, maxNum: 1 }` here — so the analysis answered a yes/no question with
 * 0.25 and 0.7, and Postgres refused the whole sixty-column row. The build survived only because
 * `createBuild` copies the brief into jsonb, which accepts anything.
 *
 * The negative controls matter more than the assertions: revert the declaration to `number` and the
 * fraction is accepted again, which is what the save was choking on.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { coerceRecommendations, FIELD_SPECS, DECLARED_KINDS, listFor } from './brief-recommend.util';

const why = 'The material invents its characters, company and case; only the institutional world is real.';
const rec = (field: string, value: any) => [{ field, value, why }];
const one = (field: string, value: any, options: any = {}) => coerceRecommendations({ fields: rec(field, value) }, options)[0];

test('the Boolean columns are declared boolean, not number', () => {
  assert.equal(FIELD_SPECS.realBased.kind, 'boolean');
  assert.equal(FIELD_SPECS.researchSubject.kind, 'boolean');
  assert.ok(DECLARED_KINDS.includes('boolean'), 'the kind table and the field table are out of step');
});

test('a fraction is DROPPED, not rounded to true — 0.25 is a degree, and this field has no degree', () => {
  assert.equal(one('realBased', 0.25), undefined, '0.25 still reaches a Boolean column');
  assert.equal(one('researchSubject', 0.7), undefined, '0.7 still reaches a Boolean column');
});

test('genuine yes/no answers still land, in every shape a model offers', () => {
  assert.equal(one('realBased', true).value, true);
  assert.equal(one('realBased', false).value, false);
  assert.equal(one('realBased', 'yes').value, true);
  assert.equal(one('realBased', 'FALSE').value, false);
  // Whole 0 and 1 are unambiguous answers to the question actually asked.
  assert.equal(one('realBased', 1).value, true);
  assert.equal(one('realBased', 0).value, false);
});

test('realityLevel carries the degree the flag cannot, with the column\'s own vocabulary', () => {
  assert.equal(FIELD_SPECS.realityLevel.kind, 'enum');
  // An INLINE list, because the caller sends no `realityLevel` options. With a string key this
  // would resolve to undefined and the field would silently never apply — the failure mode being
  // fixed, in a new place.
  assert.deepEqual(listFor(FIELD_SPECS.realityLevel, {}, 'realityLevel'), ['FAITHFUL', 'INSPIRED', 'LOOSE']);
  assert.equal(one('realityLevel', 'LOOSE').value, 'LOOSE');
  assert.equal(one('realityLevel', 'loose').value, 'LOOSE', 'case-insensitive matching is what matchOption promises');
  // A MODEL THAT ANSWERS IN PROSE IS DROPPED. matchOption is exact, case-insensitive, then
  // punctuation-normalised — it is not fuzzy, and should not be: guessing which of three fidelity
  // levels "loosely based on real events" meant is the kind of inference that puts a value the
  // analysis never chose into a field that changes the prompt.
  assert.equal(one('realityLevel', 'loosely based on real events'), undefined);
  assert.equal(one('realityLevel', 'DOCUMENTARY'), undefined, 'a value outside the column vocabulary was accepted');
});

test('the Int columns refuse a fraction rather than rounding it', () => {
  assert.equal(FIELD_SPECS.researchAmount.int, true);
  assert.equal(FIELD_SPECS.researchDepth.int, true);
  assert.equal(one('researchAmount', 55).value, 55);
  assert.equal(one('researchAmount', 55.5), undefined, 'a fraction still reaches an Int column');
  assert.equal(one('researchDepth', 60.2), undefined, 'a fraction still reaches an Int column');
});

test('NEGATIVE CONTROL: as a number field, the fraction sails straight through', () => {
  // This is what the declaration used to be. If this test ever fails, the coercer has stopped
  // distinguishing the two kinds and the assertions above prove nothing.
  const asNumber: any = { kind: 'number', min: 0, maxNum: 1 };
  const saved = FIELD_SPECS.realBased;
  try {
    (FIELD_SPECS as any).realBased = asNumber;
    assert.equal(one('realBased', 0.25).value, 0.25, 'the old declaration no longer accepts 0.25 — the controls are not comparable');
  } finally {
    (FIELD_SPECS as any).realBased = saved;
  }
  assert.equal(one('realBased', 0.25), undefined, 'the spec was not restored');
});

test('an inline vocabulary and a caller-supplied one resolve the same way', () => {
  // listFor is shared with the prompt builder so the field is OFFERED with the vocabulary it is
  // VALIDATED against. Two copies of this resolution is how those drift apart.
  assert.deepEqual(listFor({ kind: 'enum', options: 'rating' } as any, { rating: ['G', 'R'] }, 'rating'), ['G', 'R']);
  assert.deepEqual(listFor({ kind: 'enum' } as any, { tone: ['Dry'] }, 'tone'), ['Dry']);
  assert.deepEqual(listFor({ kind: 'enum', options: ['A', 'B'] } as any, {}, 'anything'), ['A', 'B']);
});
