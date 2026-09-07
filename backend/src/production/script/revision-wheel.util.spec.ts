/** Revision colour-wheel — pure-logic unit tests (node:test + ts-node). Run: npm run test:unit */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { REV_WHEEL, nextRevisionColor, revisionLabel, revisionWheel } from './revision-wheel.util';

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

// ─────────────────────────────────────────────────────────────────────────────────────────────
// ROUND NAMING — revision 10 was undefined behaviour
//
// nextRevisionColor has always incremented `round` on every wrap back to WHITE, and nothing ever
// rendered it. So the tenth revision and the first both read "BLUE" on screen: two different
// documents with one identifier, which is the same failure as two builds sharing a name.

test('the first pass is a DRAFT, not revisions — the one colour that is named differently', () => {
  assert.equal(revisionLabel('WHITE', 0), 'WHITE DRAFT');
  assert.equal(revisionLabel(null, 0), 'WHITE DRAFT', 'a missing colour is the first white');
  assert.equal(revisionLabel(undefined), 'WHITE DRAFT');
});

test('the first cycle is the bare colour', () => {
  assert.equal(revisionLabel('BLUE', 0), 'BLUE');
  assert.equal(revisionLabel('GOLDENROD', 0), 'GOLDENROD');
  assert.equal(revisionLabel('TAN', 0), 'TAN');
});

test('THE WRAP: the second cycle is named, and is distinguishable from the first', () => {
  assert.equal(revisionLabel('BLUE', 1), 'SECOND BLUE');
  assert.equal(revisionLabel('PINK', 1), 'SECOND PINK');
  assert.notEqual(revisionLabel('BLUE', 1), revisionLabel('BLUE', 0), 'the whole point');
  // WHITE in a later round is a genuine white PAGE revision, not a new draft.
  assert.equal(revisionLabel('WHITE', 1), 'SECOND WHITE');
});

test('it keeps naming past the second cycle', () => {
  assert.equal(revisionLabel('BLUE', 2), 'THIRD BLUE');
  assert.equal(revisionLabel('BLUE', 9), 'TENTH BLUE');
});

test('past the named ordinals it stays unambiguous rather than clever', () => {
  assert.equal(revisionLabel('BLUE', 10), 'ROUND 11 BLUE');
  assert.equal(revisionLabel('BLUE', 25), 'ROUND 26 BLUE');
});

test('revision 10 of a real production is no longer undefined behaviour', () => {
  // Walk the wheel exactly as ScriptService does, and assert every label is unique.
  let colour: string | null = null, round = 0;
  const labels: string[] = [];
  for (let i = 0; i < 25; i++) {
    const next = nextRevisionColor(colour, round);
    colour = next.key; round = next.round;
    labels.push(revisionLabel(colour, round));
  }
  assert.equal(new Set(labels).size, labels.length, 'every revision must have its own name: ' + labels.join(', '));
  assert.ok(labels.includes('SECOND BLUE'), 'the eleventh revision reads SECOND BLUE');
});

test('junk in, a readable name out — this renders on a card', () => {
  for (const bad of [null, undefined, '', 0 as any, {} as any]) assert.ok(revisionLabel(bad as any).length > 0);
  assert.equal(revisionLabel('BLUE', -3), 'BLUE', 'a negative round is the first cycle');
  assert.equal(revisionLabel('blue', 1), 'SECOND BLUE', 'case is normalised');
});

test('the wheel exposed to the UI is the SAME list the backend assigns from', () => {
  const wheel = revisionWheel();
  assert.equal(wheel.length, REV_WHEEL.length, 'no second, shorter copy');
  assert.deepEqual(wheel.map((w) => w.key), REV_WHEEL.map((c) => c.key));
  assert.deepEqual(wheel.map((w) => w.hex), REV_WHEEL.map((c) => c.hex), 'and the SAME hexes');
  assert.ok(wheel.some((w) => w.key === 'TAN'), 'including TAN, which the frontend copy was missing');
  assert.equal(wheel[0].label, 'WHITE DRAFT');
});
