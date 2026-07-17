import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { canonDirective } from './canon-inject.util';
import type { CanonFactCore } from './canon.types';

const f = (p: Partial<CanonFactCore>): CanonFactCore => ({
  kind: 'CHARACTER', subject: 'MARIAM', predicate: 'status', object: 'dead',
  statement: 'Mariam died in the raid.', validFrom: 10, validTo: null,
  status: 'ACTIVE', recordedAt: 0, ...p,
});

test('emits a CANON block with live facts at the point', () => {
  const out = canonDirective([f({})], { at: 20 });
  assert.match(out, /^CANON/);
  assert.match(out, /MARIAM — Mariam died in the raid\./);
});

test('omits facts not yet true at the point', () => {
  assert.equal(canonDirective([f({ validFrom: 30 })], { at: 20 }), '');
});

test('subjects filter keeps only relevant entities', () => {
  const facts = [f({ subject: 'MARIAM' }), f({ subject: 'KHALID', statement: 'Khalid rules the city.' })];
  const out = canonDirective(facts, { at: 20, subjects: ['KHALID'] });
  assert.match(out, /KHALID/);
  assert.doesNotMatch(out, /MARIAM/);
});

test('fail-safe → empty string', () => {
  assert.equal(canonDirective([], { at: 1 }), '');
  assert.equal(canonDirective(null as any, { at: 1 }), '');
});
