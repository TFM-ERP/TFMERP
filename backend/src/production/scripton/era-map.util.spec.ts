import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { COUNTRY_ERA_YEARS, ERA_BANDS } from './era-map.util';

test('the inventory is the whole inventory - 91 rows, 26 countries, and the flag counts', () => {
  assert.equal(COUNTRY_ERA_YEARS.length, 91);
  assert.equal(new Set(COUNTRY_ERA_YEARS.map((r) => r.country)).size, 26);
  assert.equal(ERA_BANDS.length, 9);
  const n = (f: string) => COUNTRY_ERA_YEARS.filter((r) => r.flag === f).length;
  assert.equal(n(''), 41);
  assert.equal(n('disputed'), 22);
  assert.equal(n('unsound'), 28);
});

test('every row is orderly and every row says where it came from', () => {
  for (const r of COUNTRY_ERA_YEARS) {
    assert.ok(r.start === null || r.end === null || r.start < r.end, r.country + ' / ' + r.label + ': start is not before end');
    assert.ok(r.basis.length > 10, r.country + ' / ' + r.label + ': no basis');
    assert.ok(['', 'disputed', 'unsound'].includes(r.flag), r.country + ' / ' + r.label + ': bad flag');
    assert.ok(r.start !== null || r.end !== null, r.country + ' / ' + r.label + ': a row with neither a start nor an end says nothing');
  }
});

test('no country lists the same label twice', () => {
  const seen = new Set<string>();
  for (const r of COUNTRY_ERA_YEARS) {
    const k = r.country + ' | ' + r.label;
    assert.ok(!seen.has(k), 'duplicate row: ' + k);
    seen.add(k);
  }
});

test('the sourced rows are pinned, so no row can drift without someone deciding to', () => {
  // Historical dates cannot be unit-tested against history — that is circular. What CAN be
  // asserted is that nobody changed one by accident. Every row here was researched and carries
  // its own basis clause; editing one is a deliberate act, and this fingerprint makes it show up
  // in review rather than passing silently. If this fails and you MEANT to change a row, update
  // the hash in the same commit as the row, and say in the message which row and on what source.
  const fingerprint = createHash('sha256').update(
    COUNTRY_ERA_YEARS.map((r) => [r.country, r.label, r.start, r.end, r.flag].join('|')).join('\n'),
  ).digest('hex').slice(0, 16);
  assert.equal(fingerprint, 'd0342a83b37a9606');
});

import * as map from './era-map.util';
import {
  midpointYear, findEraRow, anchorYearForEra, anchorYearForBand, eraOffsetForEra, describeRange,
} from './era-map.util';

test('midpoints round half AWAY FROM ZERO, matching yearsToDays', () => {
  assert.equal(midpointYear(1940, 1979), 1960);
  assert.equal(midpointYear(-3100, -332), -1716);
  assert.equal(midpointYear(0, 1), 1);
  assert.equal(midpointYear(-1, 0), -1);
});

test('a clean row anchors silently', () => {
  const v = anchorYearForEra('Japan', 'Edo / Tokugawa', 2026);
  assert.equal(v.year, 1735);
  assert.equal(v.note, '');
});

test('a disputed row anchors AND discloses', () => {
  const v = anchorYearForEra('Britain', 'Modern Britain', 2026);
  assert.equal(v.year, 1888);
  assert.match(v.note, /disputed/);
});

test('an unsound row REFUSES the year and says why - the refusal is the feature', () => {
  const v = anchorYearForEra('Oman', 'Ibadi Imamate', 2026);
  assert.equal(v.year, null);
  assert.match(v.note, /covers more than one period/);
  assert.match(v.note, /Set the year you mean/);
  assert.equal(anchorYearForEra('Mexico', 'Mesoamerican (Aztec/Maya)', 2026).year, null);
  assert.equal(anchorYearForEra('Palestine', 'Ottoman / British Mandate', 2026).year, null);
});

test('an open-ended modern row closes on the caller present, so it never goes stale', () => {
  assert.equal(anchorYearForEra('Egypt', 'Modern Egyptian', 2026).year, 1916);
  assert.equal(anchorYearForEra('Egypt', 'Modern Egyptian', 2126).year, 1966);
});

test('a label the map does not know MISSES - a supported state, never a guess', () => {
  assert.deepEqual(anchorYearForEra('Egypt', 'Pharaonic Renamed', 2026), { year: null, note: '', status: 'missing' });
  assert.deepEqual(anchorYearForEra('Atlantis', 'Golden Age', 2026), { year: null, note: '', status: 'missing' });
  assert.deepEqual(anchorYearForEra('', '', 2026), { year: null, note: '', status: 'missing' });
  assert.deepEqual(anchorYearForEra('Egypt', 'Coptic', NaN), { year: null, note: '', status: 'missing' });
  assert.equal(findEraRow(null as any, null as any), null);
});

test('a miss and a refusal are told apart by status, not just by whether the note is empty', () => {
  // The caller is meant to fall through on a MISS and stop-and-ask on a REFUSAL — opposite
  // behaviours. Distinguishing them only by an empty-vs-non-empty note is exactly the trap: a
  // caller that falls through on a refused row manufactures the approximation those rows exist to
  // refuse, and produces a plausible year, so nothing would catch it.
  assert.equal(anchorYearForEra('Egypt', 'Pharaonic Renamed', 2026).status, 'missing');   // unknown label
  assert.equal(anchorYearForEra('Atlantis', 'Golden Age', 2026).status, 'missing');       // unknown country
  assert.equal(anchorYearForEra('Egypt', 'Coptic', NaN).status, 'missing');               // bad presentYear
  assert.equal(anchorYearForEra('Saudi Arabia', 'Pre-Islamic Arabia (Jāhiliyya)', 2026).status, 'refused'); // null start
  assert.equal(anchorYearForEra('Oman', 'Ibadi Imamate', 2026).status, 'refused');        // unsound
  assert.equal(anchorYearForEra('Japan', 'Edo / Tokugawa', 2026).status, 'ok');           // clean
  assert.equal(anchorYearForEra('Britain', 'Modern Britain', 2026).status, 'ok');         // disputed, still ok
});

test('the generic bands anchor, and the forward ones are offsets from the present', () => {
  assert.equal(anchorYearForBand('medieval', 2026), 1000);
  assert.equal(anchorYearForBand('mid-20c', 2026), 1960);
  assert.equal(anchorYearForBand('ancient', 2026), -1250);
  assert.equal(anchorYearForBand('contemporary', 2026), 2026);
  assert.equal(anchorYearForBand('near-future', 2026), 2051);
  assert.equal(anchorYearForBand('far-future', 2026), 2176);
  assert.equal(anchorYearForBand('nonsense', 2026), null);
});

test('BC prints by 1 - astronomicalYear, because there is no year zero', () => {
  const pharaonic = findEraRow('Egypt', 'Pharaonic')!;
  assert.equal(describeRange(pharaonic, 2026), '3101 BC–333 BC');
  const modern = findEraRow('Egypt', 'Modern Egyptian')!;
  assert.equal(describeRange(modern, 2026), '1805–2026');
});

test('an era offset is days from the frozen storyYear, and a refused row gives none', () => {
  assert.equal(eraOffsetForEra('Japan', 'Edo / Tokugawa', 1735, 2026), 0);
  assert.equal(eraOffsetForEra('Japan', 'Edo / Tokugawa', 1745, 2026), -3653);
  assert.equal(eraOffsetForEra('Oman', 'Ibadi Imamate', 2026, 2026), null);
});

test('the map is ONE-DIRECTIONAL - asserting the absence of a year to era lookup IS the test', () => {
  // The era list is a creative menu, not a calendar: 34 gaps and 2 overlaps across the 91 rows.
  // A year -> era lookup would be undefined across the gaps and ambiguous across the overlaps, so
  // this module must never grow one. Adding it would otherwise fail silently for most years.
  const exported = Object.keys(map).filter((k) => typeof (map as any)[k] === 'function');
  const inverse = exported.filter((k) => /^(eraFor|eraAt|periodFor|periodAt|lookupYear|yearTo)/i.test(k));
  assert.deepEqual(inverse, [], 'a year -> era lookup was added: ' + inverse.join(', '));
  assert.deepEqual(exported.sort(), [
    'anchorYearForBand', 'anchorYearForEra', 'describeRange', 'eraOffsetForEra', 'findEraRow', 'midpointYear',
  ]);
});

test('the gaps the one-directional rule exists for are really there', () => {
  const uae = map.COUNTRY_ERA_YEARS.filter((r) => r.country === 'UAE').sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  const magan = uae.find((r) => r.label === 'Magan (Bronze Age)')!;
  const islamic = uae.find((r) => r.label === 'Islamic era')!;
  assert.equal((islamic.start as number) - (magan.end as number), 2430);

  let gaps = 0, overlaps = 0;
  const byCountry = new Map<string, typeof map.COUNTRY_ERA_YEARS>();
  for (const r of map.COUNTRY_ERA_YEARS) {
    if (!byCountry.has(r.country)) byCountry.set(r.country, []);
    byCountry.get(r.country)!.push(r);
  }
  for (const rows of byCountry.values()) {
    const v = rows.slice().sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
    for (let i = 1; i < v.length; i++) {
      const prevEnd = v[i - 1].end === null ? 2026 : (v[i - 1].end as number);
      const start = v[i].start ?? 0;
      if (start - prevEnd > 25) gaps++;
      if (start < prevEnd - 25) overlaps++;
    }
  }
  assert.equal(gaps, 34);
  assert.equal(overlaps, 2);
});

test('a row with no sourced start refuses for THAT reason, not the generic one', () => {
  // The only such row is also flagged unsound, so the branch order decides which reason the user
  // sees. Put the unsound check first and this branch becomes dead code that no test notices.
  const v = anchorYearForEra('Saudi Arabia', 'Pre-Islamic Arabia (Jāhiliyya)', 2026);
  assert.equal(v.year, null);
  assert.match(v.note, /no sourced start/);
  assert.doesNotMatch(v.note, /covers more than one period/);
});

test('describeRange refuses rather than throwing, because this file never throws', () => {
  assert.equal(describeRange(null as any, 2026), '');
  assert.equal(describeRange(undefined as any, 2026), '');
  assert.equal(describeRange({} as any, 2026), '?–2026');
  const jahiliyya = findEraRow('Saudi Arabia', 'Pre-Islamic Arabia (Jāhiliyya)')!;
  assert.equal(describeRange(jahiliyya, 2026), '?–610');
});

test('a junk storyYear refuses, rather than quietly reporting the present', () => {
  // yearsToDays clamps a non-finite input to 0, so without the guard a NaN storyYear does not
  // throw and does not refuse — it says the era sits exactly at the present. Confidently wrong.
  assert.equal(eraOffsetForEra('Japan', 'Edo / Tokugawa', NaN, 2026), null);
  assert.equal(eraOffsetForEra('Japan', 'Edo / Tokugawa', undefined as any, 2026), null);
  assert.equal(eraOffsetForEra('Japan', 'Edo / Tokugawa', null as any, 2026), null);
  // and the real thing still works
  assert.equal(eraOffsetForEra('Japan', 'Edo / Tokugawa', 1745, 2026), -3653);
});
