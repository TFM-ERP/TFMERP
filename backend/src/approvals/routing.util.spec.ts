/**
 * Approval routing ladder — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { chainForAmount } from './routing.util';

test('chainForAmount escalates approver roles by amount tier (boundaries inclusive)', () => {
  assert.deepEqual(chainForAmount(0), ['Finance Manager']);
  assert.deepEqual(chainForAmount(5000), ['Finance Manager']);
  assert.deepEqual(chainForAmount(5000.01), ['Finance Manager', 'General Manager']);
  assert.deepEqual(chainForAmount(25000), ['Finance Manager', 'General Manager']);
  assert.deepEqual(chainForAmount(25000.01), ['Finance Manager', 'General Manager', 'Director']);
  assert.deepEqual(chainForAmount(1_000_000), ['Finance Manager', 'General Manager', 'Director']);
});
