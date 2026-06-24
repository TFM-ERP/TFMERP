/** Revision colour-wheel — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { REV_WHEEL, nextRevisionColor } from './revision-wheel.util';

test('the wheel is the 10-colour WGA sequence starting at WHITE', () => {
  assert.equal(REV_WHEEL.length, 10);
  assert.equal(REV_WHEEL[0].key, 'WHITE');
  assert.deepEqual(REV_WHEEL.map(c => c.key), ['WHITE','BLUE','PINK','YELLOW','GREEN','GOLDENROD','BUFF','SALMON','CHERRY','TAN']);
});

test('the first revision (no prior) is WHITE, round 0', () => {
  assert.deepEqual(nextRevisionColor(null), { key: 'WHITE', hex: '#ffffff', round: 0, index: 0 });
  assert.deepEqual(nextRevisionColor(undefined, 0), { key: 'WHITE', hex: '#ffffff', round: 0, index: 0 });
});

test('each revision steps one colour', () => {
  assert.equal(nextRevisionColor('WHITE', 0).key, 'BLUE');
  assert.equal(nextRevisionColor('BLUE', 0).key, 'PINK');
  assert.equal(nextRevisionColor('GOLDENROD', 0).key, 'BUFF');
  assert.equal(nextRevisionColor('WHITE', 0).hex, '#9ec5ff'); // BLUE hex
});

test('wrapping past TAN returns to WHITE and increments the round', () => {
  assert.deepEqual(nextRevisionColor('TAN', 0), { key: 'WHITE', hex: '#ffffff', round: 1, index: 0 });
  assert.equal(nextRevisionColor('TAN', 2).round, 3);
  assert.equal(nextRevisionColor('CHERRY', 2).round, 2); // CHERRY→TAN, no wrap
});

test('an unknown prior colour is treated as the start (→ BLUE)', () => {
  assert.equal(nextRevisionColor('MAGENTA', 0).key, 'BLUE');
});

test('ten steps from WHITE complete one full round back to WHITE', () => {
  let key: string = 'WHITE', round = 0;
  for (let i = 0; i < 10; i++) { const r = nextRevisionColor(key, round); key = r.key; round = r.round; }
  assert.equal(key, 'WHITE');
  assert.equal(round, 1);
});
