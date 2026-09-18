/**
 * F4 item 2 — the stratum table, in both forms.
 *
 * The gate for this change is prompt-level: the table appears in the composed prompt, in the form
 * its provenance dictates. Whether the model then USES the labels is report-only — a page-level
 * claim, and 17 Sep established those are not acceptable at n=1.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { strataFrom, stratumTable, ambiguityNotes, strataDropped } from './stratum-table.util';
import { sweepEras } from './era.util';

const MATERIAL = [
  'In the present, Jason runs a boatyard.',
  'Seven years earlier he was left for dead on a Boston dock.',
  'Eight years ago the MacRaes took him in.',
  'Seven years earlier, Adrian turned the car around.',
].join('\n');

const hits = () => sweepEras(MATERIAL, 2026);

test('one stratum per DISTANCE, not one per mention', () => {
  const s = strataFrom(hits(), 2026, 'DEFAULTED_PRESENT');
  assert.deepEqual(s.map((x) => x.yearsEarlier), [7, 8], '"seven years earlier" appears twice and is one layer');
  assert.deepEqual(s.map((x) => x.label), ['A', 'B'], 'labelled in order of distance');
});

test('NOT COMPUTED: offsets only — no year the model was not given', () => {
  const s = strataFrom(hits(), 2026, 'DEFAULTED_PRESENT');
  const table = stratumTable(s, 2026, 'DEFAULTED_PRESENT');
  assert.match(table, /PRESENT\s+the present/);
  assert.match(table, /STRATUM A\s+7 years earlier/);
  assert.match(table, /STRATUM B\s+8 years earlier/);
  assert.equal(/\b2026\b|\b2019\b|\b2018\b/.test(table), false, 'an assumed year reached the page');
});

test('COMPUTED: years, with the offset kept beside them', () => {
  const s = strataFrom(hits(), 2026, 'COMPUTED');
  const table = stratumTable(s, 2026, 'COMPUTED');
  assert.match(table, /PRESENT\s+2026/);
  assert.match(table, /STRATUM A\s+2019\s+7 years earlier/);
  assert.match(table, /STRATUM B\s+2018\s+8 years earlier/);
});

test('the instruction removes the arithmetic rather than checking it', () => {
  const table = stratumTable(strataFrom(hits(), 2026, 'COMPUTED'), 2026, 'COMPUTED');
  assert.match(table, /use the LABEL, never your own arithmetic/);
  assert.match(table, /Do NOT compute the offset yourself/);
  assert.match(table, /NOT invent a stratum that is not on this list/);
});

test('a single-period story gets no heading at all', () => {
  assert.equal(stratumTable([], 2026, 'COMPUTED'), '');
  assert.equal(strataFrom(sweepEras('A boatyard, a Monday, a promise.', 2026), 2026, 'COMPUTED').length, 0);
});

test('a flash-FORWARD is not a stratum of the past', () => {
  // The signed axis expresses it; a stratum table would misname it as a past layer.
  const s = strataFrom(sweepEras('Three years later the yard is busy.', 2026), 2026, 'COMPUTED');
  assert.deepEqual(s, []);
});

test('the phrase is carried in the material\'s own words', () => {
  const s = strataFrom(hits(), 2026, 'COMPUTED');
  assert.match(s[0].phrase.toLowerCase(), /seven years earlier/);
});

test('ADJACENT STRATA ARE FLAGGED, NOT COLLAPSED — the partition cannot tell one night from two', () => {
  // The era check disclaims this on every run: whether "seven years earlier" and "eight years ago"
  // name the same event needs the events named, which this file cannot do. Fixity applied to a wrong
  // partition is worse than no table — the model splits one night in two CONSISTENTLY and the
  // register check finds nothing to contradict.
  const s = strataFrom(hits(), 2026, 'COMPUTED');
  const table = stratumTable(s, 2026, 'COMPUTED');
  assert.deepEqual(ambiguityNotes(s), ['A and B may be one stratum — events not named']);
  assert.match(table, /A and B may be one stratum — events not named/);
  // NOT collapsed: both strata survive, because merging destroys a real distinction as blindly as
  // splitting invents one.
  assert.equal(s.length, 2);
  assert.deepEqual(s.map((x) => x.yearsEarlier), [7, 8]);
});

test('well-separated strata get no note', () => {
  const far = strataFrom(sweepEras('Twenty years earlier the yard opened. Two years ago it closed.', 2026), 2026, 'COMPUTED');
  assert.deepEqual(ambiguityNotes(far), [], 'a 2-and-20 split is not ambiguous and must not be muddied');
  assert.equal(/may be one stratum/.test(stratumTable(far, 2026, 'COMPUTED')), false);
});

test('strata beyond the label count are COUNTED and SAID, not silently dropped', () => {
  const many = Array.from({ length: 11 }, (_, i) => `${(i + 1) * 3} years earlier something happened.`).join('\n');
  const h = sweepEras(many, 2026);
  assert.equal(strataDropped(h), 3, '11 distinct distances against 8 labels');
  const table = stratumTable(strataFrom(h, 2026, 'COMPUTED'), 2026, 'COMPUTED', strataDropped(h));
  assert.match(table, /3 further stratum\/strata were found in the material and are NOT listed here/);
});

test('nothing dropped means no note about dropping', () => {
  const h = hits();
  assert.equal(strataDropped(h), 0);
  assert.equal(/NOT listed here/.test(stratumTable(strataFrom(h, 2026, 'COMPUTED'), 2026, 'COMPUTED', 0)), false);
});
