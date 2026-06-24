/**
 * Intake brief-lever resolution — pure-logic unit tests (node:test + ts-node).
 * Run: npm run test:unit
 *
 * Levers were promoted from DevelopmentBuild.brief JSON into typed IntakeProfile columns.
 * resolveLever()/resolveLevers() must read TYPED-FIRST then fall back to the brief so existing
 * builds (data only in brief) keep working; pickLevers() extracts the persisted subset.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { LEVER_KEYS, resolveLever, resolveLevers, pickLevers } from './intake-levers.util';

test('typed column wins over the brief when present', () => {
  assert.equal(resolveLever({ scriptVariety: 'ar-EG' }, { scriptVariety: 'ar-MSA' }, 'scriptVariety'), 'ar-EG');
});

test('falls back to the brief when the typed value is null/undefined/empty', () => {
  assert.equal(resolveLever({ scriptVariety: null }, { scriptVariety: 'ar-MSA' }, 'scriptVariety'), 'ar-MSA');
  assert.equal(resolveLever({}, { scriptVariety: 'ar-MSA' }, 'scriptVariety'), 'ar-MSA');
  assert.equal(resolveLever({ scriptVariety: '   ' }, { scriptVariety: 'ar-MSA' }, 'scriptVariety'), 'ar-MSA');
});

test('returns null when neither side has the lever', () => {
  assert.equal(resolveLever({}, {}, 'politicalArc'), null);
  assert.equal(resolveLever(null, null, 'conflict'), null);
});

test('JSON levers prefer the typed value, including an explicit empty array', () => {
  assert.deepEqual(resolveLever({ accents: ['Gulf'] }, { accents: ['Levant'] }, 'accents'), ['Gulf']);
  assert.deepEqual(resolveLever({ accents: [] }, { accents: ['Levant'] }, 'accents'), []);
  assert.deepEqual(resolveLever({}, { styleMix: { noir: 3 } }, 'styleMix'), { noir: 3 });
});

test('resolveLevers returns every promoted key', () => {
  const out = resolveLevers({ scriptVariety: 'ar-EG' }, { dialogueRegister: 'colloquial' });
  assert.deepEqual(Object.keys(out).sort(), [...LEVER_KEYS].sort());
  assert.equal(out.scriptVariety, 'ar-EG');
  assert.equal(out.dialogueRegister, 'colloquial');
  assert.equal(out.conflictId, null);
});

test('pickLevers extracts only defined lever keys and ignores foreign fields', () => {
  const picked = pickLevers({ scriptVariety: 'ar-MSA', accents: ['Gulf'], baseGenre: 'Thriller', name: 'x' });
  assert.deepEqual(picked, { scriptVariety: 'ar-MSA', accents: ['Gulf'] });
});

test('pickLevers tolerates null input', () => {
  assert.deepEqual(pickLevers(null), {});
});
