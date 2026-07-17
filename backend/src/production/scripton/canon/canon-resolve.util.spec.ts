import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCanonAt } from './canon-resolve.util';
import type { CanonFactCore } from './canon.types';

const f = (p: Partial<CanonFactCore>): CanonFactCore => ({
  kind: 'CHARACTER', subject: 'MARIAM', predicate: 'status', object: 'alive',
  statement: '', validFrom: 0, validTo: null, status: 'ACTIVE', recordedAt: 0, ...p,
});

test('fact is live from validFrom onward when validTo is null', () => {
  const facts = [f({ object: 'alive', validFrom: 0 })];
  assert.equal(resolveCanonAt(facts, 5).length, 1);
  assert.equal(resolveCanonAt(facts, 5)[0].object, 'alive');
});

test('fact stops being live at validTo (half-open window)', () => {
  const facts = [f({ object: 'alive', validFrom: 0, validTo: 10 })];
  assert.equal(resolveCanonAt(facts, 9).length, 1);
  assert.equal(resolveCanonAt(facts, 10).length, 0);
});

test('later recordedAt wins for the same subject+predicate', () => {
  const facts = [
    f({ object: 'alive', validFrom: 0, recordedAt: 0 }),
    f({ object: 'dead',  validFrom: 0, recordedAt: 5 }),
  ];
  const live = resolveCanonAt(facts, 3);
  assert.equal(live.length, 1);
  assert.equal(live[0].object, 'dead');
});

test('SUPERSEDED facts are never live', () => {
  const facts = [f({ object: 'alive', status: 'SUPERSEDED' })];
  assert.equal(resolveCanonAt(facts, 1).length, 0);
});

test('null/empty input is fail-safe', () => {
  assert.deepEqual(resolveCanonAt(null as any, 1), []);
  assert.deepEqual(resolveCanonAt([], 1), []);
});
