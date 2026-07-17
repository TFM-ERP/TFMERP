import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { orderChanges } from './change-order.util';

test('orders by sceneOrder ascending', () => {
  const out = orderChanges([{ id: 'b', sceneOrder: 5 }, { id: 'a', sceneOrder: 2 }]);
  assert.deepEqual(out.map((c) => c.id), ['a', 'b']);
});

test('is stable for equal sceneOrder', () => {
  const out = orderChanges([{ id: 'x', sceneOrder: 3 }, { id: 'y', sceneOrder: 3 }]);
  assert.deepEqual(out.map((c) => c.id), ['x', 'y']);
});

test('fail-safe on null', () => {
  assert.deepEqual(orderChanges(null as any), []);
});
