/**
 * F2 TIER 1 — THE WIRING, OFFLINE. A wiring bug should cost a test run, not a paid canon run.
 *
 * The silent one is canon-map's whitelist. `mapAiFactsToCore` maps an unlisted kind to 'PLOT', so a
 * MOTIVE fact from a model would arrive as a PLOT row: no error, no warning, and an acceptance that
 * looks at prompts or fact counts would pass while the kind never existed. That is the same shape as
 * a kind missing from the analysis prompt's partition, and it is why this file runs before any
 * extraction is paid for.
 *
 * Tier 2 — MOTIVE rows for Jason, Gideon, Alexander and Nora on the real bible, and Gideon's want in
 * a SCENES prompt — needs a live extraction and is not in here.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mapAiFactsToCore } from './canon-map.util';
import { DEFAULT_FLOORS } from './canon-quota.util';
import { SOURCE_CANON_SYSTEM, CANON_EXTRACTOR_VERSION } from './canon-prompt.util';

const scene = { id: 's1', order: 1 };
const row = (kind: string, subject = 'GIDEON VALE', predicate = 'wants', object = 'to survive exposure') =>
  ({ kind, subject, predicate, object, statement: 'Gideon wants to survive exposure.' });

test('THE SILENT ONE: a MOTIVE fact survives the map as MOTIVE, not as PLOT', () => {
  const [f] = mapAiFactsToCore([row('MOTIVE')], scene);
  assert.equal(f.kind, 'MOTIVE', 'a MOTIVE fact collapsed to the fallback kind — the whitelist does not list it');
  assert.equal(f.subject, 'GIDEON VALE');
  assert.equal(f.predicate, 'wants');
});

test('both predicates survive, and an unknown kind still falls back as before', () => {
  assert.equal(mapAiFactsToCore([row('MOTIVE', 'NORA BELL', 'needs', 'to stop deciding for other people')], scene)[0].predicate, 'needs');
  assert.equal(mapAiFactsToCore([row('motive')], scene)[0].kind, 'MOTIVE', 'lower case is not normalised');
  // The fallback itself must be untouched: this is the behaviour that made the omission silent, and
  // it is correct for a genuinely unknown kind.
  assert.equal(mapAiFactsToCore([row('FEELING')], scene)[0].kind, 'PLOT');
});

test('the extraction prompt asks for MOTIVE, in both the vocabulary and the quota line', () => {
  // Declared, whitelisted and never requested is a field that can never be filled — the F0 lesson.
  assert.match(SOURCE_CANON_SYSTEM, /MOTIVE - what a NAMED character WANTS/);
  assert.match(SOURCE_CANON_SYSTEM, /predicate: wants\|needs/);
  assert.match(SOURCE_CANON_SYSTEM, /12 MOTIVE/, 'MOTIVE has no quota line, so biography will swamp it as it always has');
  assert.match(SOURCE_CANON_SYSTEM, /a want and a\s*need for EVERY principal including the antagonist/);
});

test('the quota gives MOTIVE a floor, so an ensemble is not trimmed to two motives', () => {
  assert.equal(DEFAULT_FLOORS.MOTIVE, 12, 'a 6-9 principal bible is 12-18 lines of want and need');
});

test('the extractor version was bumped, because the kinds and the prompt changed', () => {
  // canon-prompt.util.ts:97 — "BUMP THIS WHENEVER THE EXTRACTION CHANGES — the prompt, the kinds,
  // the quota, or the parser." F2 changes three of the four. Without the bump the stored v2 canons
  // would be served again for the same digest, and they contain no MOTIVE rows at all.
  assert.ok(CANON_EXTRACTOR_VERSION >= 3, 'stored MOTIVE-less canons would still be served for the same source');
});
