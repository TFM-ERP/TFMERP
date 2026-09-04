import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { COUNTRY_ERA_YEARS } from './era-map.util';

/**
 * THE CROSS-BOUNDARY GUARD.
 *
 * `findEraRow` matches `country` and `label` by strict equality, and the labels come from the
 * form: `eraOptionsFor(country)` in the frontend taxonomy, set verbatim onto `settingEra`. A
 * mismatch is SILENT BY DESIGN — a miss falls through to the generic band and then to the current
 * year — so a renamed label, a different dash, or a decomposed accent would quietly date a Heian
 * story to the present, with no error, no note and no failing test.
 *
 * Nothing in the module can protect that, because the two lists live on opposite sides of the
 * repo. This test is the only thing that can. It reads the taxonomy as TEXT rather than importing
 * it, so the backend suite takes no build dependency on the frontend.
 *
 * The row/label count is NOT hardcoded here on purpose: the map grows (occupying-power eras,
 * periodisations) and a literal total would either bit-rot into a false failure on every addition
 * or, worse, get bumped reflexively without anyone re-reading what changed. The guard instead
 * asserts over the whole collection every run: every row must be offered, and every offering must
 * be a row, whatever their number turns out to be today.
 */
const TAXONOMY = join(__dirname, '../../../../frontend/src/components/scripton/taxonomy.ts');

test('every era row is a label the form actually offers, and every label has a row', () => {
  if (!existsSync(TAXONOMY)) {
    assert.fail(`the frontend taxonomy is not at ${TAXONOMY} — if it moved, fix this path rather than deleting the test: it is the only thing standing between a renamed label and a story silently dated to the present year`);
  }
  const src = readFileSync(TAXONOMY, 'utf8');
  const block = src.slice(src.indexOf('COUNTRY_ERA_TIMELINES'), src.indexOf('eraOptionsFor'));

  const offered = new Set<string>();
  let country = '';
  for (const line of block.split('\n')) {
    // The key may be quoted and may contain anything a country name contains - a slash in
    // 'Iran / Persia', parentheses in 'Mesopotamia (ancient)', and one day an accent or an
    // apostrophe. An ASCII-letters-only key silently DROPPED such a country, so its rows showed up
    // as orphans and its real drift showed up as nothing. Anchor on the bracket, not the alphabet.
    const c = /^\s*(?:'([^']+)'|([A-Za-z][A-Za-z ]*?))\s*:\s*\[/.exec(line);
    if (c) country = (c[1] !== undefined ? c[1] : c[2]).trim();
    // A label may legally contain an escaped apostrophe - "Babylon (Hammurabi\\'s Empire)" - and the
    // file stores it escaped while COUNTRY_ERA_YEARS holds the real character. Match the escape and
    // unescape it, or every such row reads as drift in BOTH directions at once.
    for (const m of line.matchAll(/\{ label: '((?:[^'\\]|\\.)*)', ar:/g)) {
      if (country) offered.add(`${country} | ${m[1].replace(/\\'/g, "'")}`);
    }
  }
  const mapped = new Set(COUNTRY_ERA_YEARS.map((r) => `${r.country} | ${r.label}`));

  // Sanity on the parse itself: if either side collapsed under duplicate keys, the two
  // directional diffs below could both pass empty while actually comparing a shrunk set against
  // itself. Comparing sizes against the source collections (not a literal) catches that without
  // hardcoding a total that would need bumping every time a country's timeline grows.
  assert.equal(mapped.size, COUNTRY_ERA_YEARS.length, 'COUNTRY_ERA_YEARS has two rows with the same country+label — they are indistinguishable to findEraRow');
  assert.equal(offered.size, [...block.matchAll(/\{ label: '(?:[^'\\]|\\.)*', ar:/g)].length, 'the taxonomy offers two identical country+label pairs — they are indistinguishable in the form');

  const unmapped = [...offered].filter((k) => !mapped.has(k));
  const orphaned = [...mapped].filter((k) => !offered.has(k));
  // Reported together, not as two sequential asserts: a single sequential assert would abort on
  // the first direction and hide the second, and a rename always breaks both at once (the new
  // label is offered-but-unmapped, the old one is mapped-but-now-orphaned) — the message a
  // maintainer needs is the pair, not half of it.
  assert.ok(
    unmapped.length === 0 && orphaned.length === 0,
    'offered but no row (dates to the present year if chosen): ' + JSON.stringify(unmapped) +
      ' | mapped but never offered (dead row, can never be reached): ' + JSON.stringify(orphaned),
  );

  // Unicode normalisation is the silent one: labels such as Jāhiliyya, Marj Dābiq and Jund
  // Filasṭīn carry diacritics, and NFC vs NFD compare unequal while looking identical on screen.
  for (const k of mapped) assert.equal(k, k.normalize('NFC'), `${k} is not in NFC`);
  for (const k of offered) assert.equal(k, k.normalize('NFC'), `${k} is not in NFC`);
});
