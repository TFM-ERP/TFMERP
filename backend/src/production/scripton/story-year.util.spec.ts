/**
 * What year is the story's present, and how do we know. Run: npm run test:unit
 *
 * Spec §7.2's ladder: COMPUTED from the material, else the settingEra midpoint, else the current
 * year — and ASK rather than a guess. Every rung has a test, and the six deliberate breaks at the
 * bottom each have a test that catches them, because a test that passes with the feature deleted is
 * not a test.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveStoryYear, storyYearForPrompt, storyYearForCheck,
  readsAsContemporary, BAND_LABELS, CONTEMPORARY_PHRASES,
} from './story-year.util';

const NOW = 2026;
const r = (material: string, settingEra?: string, settingCountry?: string) =>
  resolveStoryYear({ material, settingEra, settingCountry, currentYear: NOW });

// ── 1 · COMPUTED ────────────────────────────────────────────────────────────────────────────────

test('an absolute and a relative dating of one event fix the present', () => {
  const out = r('In 2019, seven years before the film, Jason was attacked on the dock.');
  assert.equal(out.year, 2026);
  assert.equal(out.provenance, 'COMPUTED');
  assert.match(out.note, /puts the present at 2026/);
  assert.ok(out.evidence.length >= 1);
});

test('EVERY pair is computed, and two that disagree are the conflict, not the first answer', () => {
  const out = r('In 2019, seven years before the film, he was attacked. In 1994, thirty years before the film, the company was founded.');
  assert.equal(out.provenance, 'ASK');
  assert.equal(out.year, null);
  assert.deepEqual(out.conflict?.years, [2026, 2024]);
  assert.match(out.note, /disagree — 2026 and 2024/);
});

test('THE SENTENCE IS THE WINDOW: a year and a phrase in different sentences do not pair', () => {
  const out = r('He vanished in 1994. Seven years before the film, Sophie began asking.', 'Contemporary');
  assert.notEqual(out.provenance, 'COMPUTED');
  assert.equal(out.year, NOW, 'it degrades to the contemporary rung, never to a year built from two unrelated mentions');
});

test('a range and a zero offset never anchor', () => {
  assert.notEqual(r('In 2019, fifteen to ten years before the film, the yard closed.').provenance, 'COMPUTED');
  assert.notEqual(r('In 2019, the present, the yard closed.').provenance, 'COMPUTED');
});

// ── 2 · ERA_MIDPOINT ────────────────────────────────────────────────────────────────────────────

test('a band label with no pair in the material gives the band midpoint, NOT the current year', () => {
  const out = r('A story of monks and a burned library.', 'Medieval (500–1500)');
  assert.equal(out.year, 1000);
  assert.equal(out.provenance, 'ERA_MIDPOINT');
  assert.match(out.note, /taken as around 1000/);
});

test('a country row anchors, and a disputed boundary is disclosed with its year', () => {
  const out = r('London, smoke and steam.', 'Modern Britain', 'Britain');
  assert.equal(out.provenance, 'ERA_MIDPOINT');
  assert.equal(typeof out.year, 'number');
  assert.match(out.note, /disputed/i);
});

test('A REFUSED ROW ASKS — it never falls through to a band or to now', () => {
  const out = r('Muscat, the interior, a disputed succession.', 'Ibadi Imamate', 'Oman');
  assert.equal(out.provenance, 'ASK');
  assert.equal(out.year, null);
  assert.match(out.note, /more than one period|no sourced start/);
});

test('the forward bands are offsets from the present, not fixed years', () => {
  assert.equal(r('Domes and dust.', 'Near future').year, NOW + 25);
  assert.equal(r('Domes and dust.', 'Far future').year, NOW + 150);
});

// ── 3 · DEFAULTED_PRESENT, and the concession ───────────────────────────────────────────────────

test('no era and no dating gives this year, marked as the default it is', () => {
  const out = r('Two brothers, a boat, a debt.');
  assert.equal(out.year, NOW);
  assert.equal(out.provenance, 'DEFAULTED_PRESENT');
});

test('THE CONCESSION: leading phrase, separator, no date token', () => {
  const out = r('A studio and a deadline.', 'Present day — contemporary software development');
  assert.equal(out.provenance, 'DEFAULTED_PRESENT');
  assert.equal(out.year, NOW);
});

test('THE NEGATIVE GUARD: prose that dates itself is never answered with "now"', () => {
  const out = r('Jazz, a courthouse, a long summer.', 'a contemporary retelling of the 1920s');
  assert.notEqual(out.provenance, 'DEFAULTED_PRESENT');
  assert.equal(out.provenance, 'ASK');
  for (const era of ['set in the 19th century', 'modern day, 1994', 'today, before 500 BC', 'contemporary — the 90s']) {
    assert.equal(readsAsContemporary(era), false, era);
  }
});

test('NOT A SUBSTRING TEST: the phrase must lead', () => {
  assert.equal(readsAsContemporary('seven years before present day'), false);
  assert.equal(readsAsContemporary('a story of today'), false);
  assert.equal(readsAsContemporary('Present day — contemporary software development'), true);
  assert.equal(readsAsContemporary('today'), true);
  assert.equal(readsAsContemporary('Modern day: a harbour town'), true);
});

test('DELETE THE LIST AND ALL THREE FLIP TO ASK — the concession is one constant and one predicate', () => {
  const rows = ['Present day — contemporary software development', 'today', 'Modern day: a harbour town'];
  for (const era of rows) assert.equal(r('A studio and a deadline.', era).provenance, 'DEFAULTED_PRESENT', era);
  const saved = CONTEMPORARY_PHRASES.splice(0, CONTEMPORARY_PHRASES.length);
  try {
    for (const era of rows) assert.equal(r('A studio and a deadline.', era).provenance, 'ASK', era + ' with the list emptied');
  } finally {
    CONTEMPORARY_PHRASES.push(...saved);
  }
  for (const era of rows) assert.equal(r('A studio and a deadline.', era).provenance, 'DEFAULTED_PRESENT', era + ' restored');
});

test('UNRECOGNISED PROSE ASKS: it is neither Contemporary nor unset', () => {
  const out = r('A war, and afterwards.', 'Sometime after the war');
  assert.equal(out.provenance, 'ASK');
  assert.equal(out.year, null);
  assert.match(out.note, /not a period this map knows/);
});

test('a non-finite current year asks rather than inventing one', () => {
  const out = resolveStoryYear({ material: 'x', currentYear: NaN as any });
  assert.equal(out.provenance, 'ASK');
});

// ── printability ────────────────────────────────────────────────────────────────────────────────

test('ONLY A COMPUTED YEAR MAY REACH A PROMPT', () => {
  const computed = r('In 2019, seven years before the film, he was attacked.');
  const midpoint = r('Monks.', 'Medieval (500–1500)');
  const defaulted = r('Two brothers.');
  const ask = r('A war.', 'Sometime after the war');
  assert.equal(storyYearForPrompt(computed), 2026);
  assert.equal(storyYearForPrompt(midpoint), null, 'a band midpoint is an approximation, not a fact about this story');
  assert.equal(storyYearForPrompt(defaulted), null);
  assert.equal(storyYearForPrompt(ask), null);
  assert.equal(storyYearForPrompt(null), null);
});

test('a check gets all four, always with the provenance', () => {
  assert.deepEqual(storyYearForCheck(r('Monks.', 'Medieval (500–1500)')), { year: 1000, provenance: 'ERA_MIDPOINT' });
  assert.deepEqual(storyYearForCheck(r('Two brothers.')), { year: NOW, provenance: 'DEFAULTED_PRESENT' });
  assert.deepEqual(storyYearForCheck(r('A war.', 'Sometime after the war')), { year: null, provenance: 'ASK' });
  assert.deepEqual(storyYearForCheck(undefined), { year: null, provenance: 'ASK' });
});

// ── the cross-boundary guard ────────────────────────────────────────────────────────────────────

test('THE BAND LABELS MATCH THE FORM, or this file silently demotes a period story to "now"', () => {
  const taxonomy = join(__dirname, '../../../../frontend/src/components/scripton/taxonomy.ts');
  if (!existsSync(taxonomy)) {
    assert.fail(`the frontend taxonomy is not at ${taxonomy} — if it moved, fix this path rather than deleting the test: `
      + 'it is the only thing standing between a renamed era label and a Medieval story anchored to this year');
  }
  const src = readFileSync(taxonomy, 'utf8');
  const block = /export const SETTING_ERAS[^[]*\[([\s\S]*?)\];/.exec(src);
  assert.ok(block, 'SETTING_ERAS not found in the taxonomy');
  const labels = [...block[1].matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.equal(labels.length, 9, 'the form offers nine bands');
  assert.deepEqual(labels.filter((l) => !BAND_LABELS[l]), [], 'every form label must map to a band id');
  assert.deepEqual(Object.keys(BAND_LABELS).filter((l) => !labels.includes(l)), [], 'this table must not carry a label the form no longer offers');
});

// ── the six deliberate breaks ───────────────────────────────────────────────────────────────────
//
// Each assertion below fails if the named guard is removed. They are the reason the tests above are
// worth running: without them, a resolver that always answered "2026" would pass most of this file.

test('BREAK 1 — treat a refused row as missing: the row\'s own reason would be lost', () => {
  const out = r('Muscat.', 'Ibadi Imamate', 'Oman');
  assert.equal(out.year, null);
  assert.match(out.note, /more than one period|no sourced start/, 'the refusal must carry the map row\'s reason, not a generic one');
  assert.deepEqual(out.evidence, ['Oman · Ibadi Imamate']);
});

test('BREAK 2 — pair across sentences: a stray year would hijack the anchor', () => {
  assert.notEqual(r('He vanished in 1994. Seven years before the film, Sophie began asking.', 'Contemporary').provenance, 'COMPUTED');
});

test('BREAK 3 — take the first pair only: the conflict would disappear', () => {
  assert.ok(r('In 2019, seven years before the film, he was attacked. In 1994, thirty years before the film, it was founded.').conflict);
});

test('BREAK 4 — default on unrecognised prose: a period story would be anchored to this year', () => {
  assert.notEqual(r('A war.', 'Sometime after the war').year, NOW);
});

test('BREAK 5 — make the concession a substring test: the 1920s row would go contemporary', () => {
  assert.equal(readsAsContemporary('a contemporary retelling of the 1920s'), false);
});

test('BREAK 6 — let a midpoint print: an approximation would reach the page as fact', () => {
  assert.equal(storyYearForPrompt(r('Monks.', 'Medieval (500–1500)')), null);
});
