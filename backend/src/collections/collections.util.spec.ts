/** Collections money/date formatters — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fmt, fmtD } from './collections.util';

test('fmt renders amounts with thousands separators and 2 decimals', () => {
  assert.equal(fmt(1234.5), '1,234.50');
  assert.equal(fmt(1000000), '1,000,000.00');
  assert.equal(fmt(-5), '-5.00');
});

test('fmt coerces null/undefined/garbage to 0.00', () => {
  assert.equal(fmt(0), '0.00');
  assert.equal(fmt(null), '0.00');
  assert.equal(fmt(undefined), '0.00');
});

test('fmtD formats a date and uses an em-dash when absent', () => {
  assert.equal(fmtD(null), '—');
  assert.equal(fmtD(''), '—');
  const s = fmtD('2025-06-21T12:00:00Z');
  assert.match(s, /2025/);
  assert.match(s, /Jun/i);
});
