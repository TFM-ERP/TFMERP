/** Screenplay page math — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pagesToEighthsLabel, estimateEighthsPages } from './pages.util';

test('pagesToEighthsLabel renders whole pages without a fraction', () => {
  assert.equal(pagesToEighthsLabel(0), '0');
  assert.equal(pagesToEighthsLabel(1), '1');
  assert.equal(pagesToEighthsLabel(3), '3');
});

test('pagesToEighthsLabel renders eighths', () => {
  assert.equal(pagesToEighthsLabel(2.5), '2 4/8');
  assert.equal(pagesToEighthsLabel(3.875), '3 7/8');
  assert.equal(pagesToEighthsLabel(0.125), '1/8');  // sub-page drops the leading 0
  assert.equal(pagesToEighthsLabel(0.5), '4/8');
  assert.equal(pagesToEighthsLabel(1.9), '1 7/8');  // 0.9*8 = 7.2 → 7/8 (no carry)
});

test('pagesToEighthsLabel carries 8/8 up to a whole page (no "8/8")', () => {
  assert.equal(pagesToEighthsLabel(1.95), '2');   // 0.95*8 = 7.6 → rounds to 8/8 → carries to 2
  assert.equal(pagesToEighthsLabel(0.95), '1');   // rounds up to a full page
  assert.equal(pagesToEighthsLabel(7.99), '8');
  assert.equal(pagesToEighthsLabel(2.9375), '3'); // 7.5 → rounds to 8 → carries
});

test('estimateEighthsPages maps body length to decimal pages (~1400 chars/page, min 1/8)', () => {
  assert.equal(estimateEighthsPages(''), 0.125);                 // floored to one eighth
  assert.equal(estimateEighthsPages('x'.repeat(700)), 0.5);      // half page
  assert.equal(estimateEighthsPages('x'.repeat(1400)), 1);       // one page
  assert.equal(estimateEighthsPages('x'.repeat(2800)), 2);       // two pages
  assert.ok(estimateEighthsPages('a') >= 0.125, 'never below one eighth');
});
