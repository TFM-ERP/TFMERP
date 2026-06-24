import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { continuityScore } from './render-score.util';

test('perfect score when no conflicts', () => {
  assert.equal(continuityScore(0, 4), 1);
});

test('drops with conflicts, never below 0', () => {
  assert.ok(continuityScore(2, 4) < 1);
  assert.ok(continuityScore(99, 1) >= 0);
});

test('no changes → neutral 1', () => {
  assert.equal(continuityScore(0, 0), 1);
});
