/**
 * ScripON engine — pure-logic unit tests (zero-install: node:test + ts-node).
 * Targets scripton.util.ts, which the service delegates to, so these cover the real engine path.
 * Run: npm run test:unit
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeFacts, parseJsonArray } from './scripton.util';

test('computeFacts aggregates INT/EXT, DAY/NIGHT, locations and pages', () => {
  const f = computeFacts([
    { intExt: 'INT', dayNight: 'NIGHT', setName: 'WAREHOUSE', pages: 1.5 },
    { slugline: 'EXT. DOCK - DAY', pages: 2 },
    { intExt: 'INT', dayNight: 'DAY', setName: 'WAREHOUSE', pages: 0.5 },
  ]);
  assert.equal(f.sceneCount, 3);
  assert.equal(f.int, 2);
  assert.equal(f.ext, 1);
  assert.equal(f.day, 2);
  assert.equal(f.night, 1);
  assert.equal(f.locations, 2, 'WAREHOUSE (deduped) + DOCK');
  assert.equal(f.pages, 4);
});

test('computeFacts derives location from slugline when setName is absent', () => {
  const f = computeFacts([{ slugline: 'INT. SARAH APARTMENT - NIGHT' }]);
  assert.equal(f.locations, 1);
  assert.equal(f.int, 1);
  assert.equal(f.night, 1);
});

test('computeFacts on an empty list is all zeros (no NaN)', () => {
  assert.deepEqual(computeFacts([]), { sceneCount: 0, int: 0, ext: 0, day: 0, night: 0, locations: 0, pages: 0 });
});

test('parseJsonArray reads a bare JSON array', () => {
  assert.deepEqual(parseJsonArray('[{"a":1},{"b":2}]'), [{ a: 1 }, { b: 2 }]);
});

test('parseJsonArray unwraps a fenced json block', () => {
  assert.deepEqual(parseJsonArray('```json\n[1,2,3]\n```'), [1, 2, 3]);
});

test('parseJsonArray rescues an array buried in prose', () => {
  assert.deepEqual(parseJsonArray('Here you go: [10, 20] — hope that helps'), [10, 20]);
});

test('parseJsonArray returns [] for non-array / unparseable input', () => {
  assert.deepEqual(parseJsonArray('{"not":"an array"}'), []);
  assert.deepEqual(parseJsonArray('totally not json'), []);
  assert.deepEqual(parseJsonArray(''), []);
});
