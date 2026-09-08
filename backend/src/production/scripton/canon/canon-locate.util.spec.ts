import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { sectionsOf, sectionAt, locateFact, locateFacts } from './canon-locate.util';
import type { CanonFactCore, CanonKind } from './canon.types';

/**
 * WHY THIS EXISTS. The prohibition COUNT read 23, then 20, then 22 across three identical
 * extractions of the same bible — all noise — and could not answer the only question that mattered:
 * whether §29 Continuity foundations and §31 Rules for keeping Jason distinctive, which lay beyond
 * the old 60,000-character slice and had never been read by anything, now reach the canon. The
 * section can. Measured once by a script: 23 of 75 located facts lay beyond the old cut, 10 of them
 * prohibitions. Storing it makes that answerable per build, for free.
 */

const f = (statement: string, kind: CanonKind = 'PROHIBITION'): CanonFactCore => ({
  kind, subject: 'X', predicate: 'p', object: 'o', statement, validFrom: 0, validTo: null, status: 'ACTIVE',
});

// Shaped like the real bible: markdown headings, quoted rules deep in the document.
const BIBLE = [
  '# JASON QUICK',
  '## 1. The film',
  'A presumed-dead heir returns to the harbour that killed him.',
  'x'.repeat(400),
  '## 29. Continuity foundations',
  'A cover name never replaces Jason Alexander Quick as the hero\'s actual identity.',
  'y'.repeat(400),
  '## 31. Rules for keeping Jason distinctive',
  'Do not restart his story by repeatedly murdering someone he loves.',
].join('\n');

test('sections are found, in document order', () => {
  const s = sectionsOf(BIBLE);
  assert.deepEqual(s.map((x) => x.title), [
    'JASON QUICK', '1. The film', '29. Continuity foundations', '31. Rules for keeping Jason distinctive',
  ]);
  assert.ok(s[2].at < s[3].at, 'offsets ascend');
});

test('THE MEASUREMENT THAT MATTERED: a rule from §31 is attributed to §31', () => {
  const s = sectionsOf(BIBLE);
  const loc = locateFact(BIBLE, s, f('Rules for keeping Jason distinctive: "Do not restart his story by repeatedly murdering someone he loves."'));
  assert.equal(loc.section, '31. Rules for keeping Jason distinctive');
  assert.ok((loc.at as number) > 800, 'and deep in the document, past the old cut');
});

test('a quoted run is preferred over the statement prefix', () => {
  const s = sectionsOf(BIBLE);
  // the prose before the quote appears nowhere in the source; only the quote can locate it
  const loc = locateFact(BIBLE, s, f('The bible is explicit that "A cover name never replaces Jason Alexander Quick"'));
  assert.equal(loc.section, '29. Continuity foundations');
});

test('the LONGEST quote wins — a short one can match the wrong passage', () => {
  const src = '## A\nthe harbour\n' + 'z'.repeat(300) + '\n## B\nthe harbour at first light, and the pumps\n';
  const s = sectionsOf(src);
  const loc = locateFact(src, s, f('It says "the harbour" and also "the harbour at first light, and the pumps"'));
  assert.equal(loc.section, 'B', 'the longer, more specific quote is the better anchor');
});

test('UNLOCATED IS NULL, AND NULL MEANS NOT LOCATED — never "not in the source"', () => {
  const s = sectionsOf(BIBLE);
  const loc = locateFact(BIBLE, s, f('A synthesis drawn across three separate passages of the document.'));
  assert.equal(loc.at, null);
  assert.equal(loc.section, null);
});

test('a probe shorter than 14 characters is refused — it would match half the document', () => {
  const s = sectionsOf(BIBLE);
  assert.equal(locateFact(BIBLE, s, f('He "returns".')).at, null, 'a three-character quote is not evidence');
});

test('coverage counts per section, in document order', () => {
  const { facts, coverage } = locateFacts(BIBLE, [
    f('"A cover name never replaces Jason Alexander Quick"'),
    f('"Do not restart his story by repeatedly murdering someone he loves."'),
    f('A synthesis that appears nowhere verbatim.'),
  ]);
  assert.equal(coverage.located, 2);
  assert.equal(coverage.unlocated, 1);
  assert.deepEqual(coverage.bySection.map((x) => x.section), ['29. Continuity foundations', '31. Rules for keeping Jason distinctive']);
  assert.equal(facts[0].sourceSection, '29. Continuity foundations');
  assert.equal(typeof facts[0].sourceOffset, 'number');
});

test('THE UNLOCATED ARE REPORTED VERBATIM — synthesis and invention are indistinguishable here', () => {
  const { coverage } = locateFacts(BIBLE, [f('Gideon secretly owns a second terminal in Halifax.')]);
  assert.equal(coverage.unlocated, 1);
  assert.deepEqual(coverage.unlocatedStatements, ['Gideon secretly owns a second terminal in Halifax.']);
  // Dropping them would hide inventions; trusting them silently would enforce inventions.
});

test('NOTHING IS DROPPED — every fact in is a fact out, located or not', () => {
  const input = [f('"A cover name never replaces Jason Alexander Quick"'), f('unfindable'), f('also unfindable')];
  const { facts } = locateFacts(BIBLE, input);
  assert.equal(facts.length, 3, 'this reports, it must never censor');
});

test('a document with no headings still yields offsets', () => {
  const plain = 'a'.repeat(200) + ' the decisive quoted phrase here ' + 'b'.repeat(200);
  const { facts, coverage } = locateFacts(plain, [f('It states "the decisive quoted phrase here".')]);
  assert.equal(coverage.located, 1);
  assert.equal(facts[0].sourceSection, null, 'no heading to attribute it to');
  assert.ok((facts[0].sourceOffset as number) > 100, 'but the offset still says how deep it lies');
});

test('junk in does not throw — this runs on every extraction', () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    assert.doesNotThrow(() => sectionsOf(bad as any));
    assert.doesNotThrow(() => locateFacts(bad as any, bad as any));
    assert.doesNotThrow(() => locateFact(bad as any, [], bad as any));
  }
  assert.deepEqual(locateFacts('x', null as any).facts, []);
  assert.equal(sectionAt([], 5), null);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// TWO SHAPES ACCOUNTED FOR MOST OF THE "NOT LOCATED" ON A REAL RUN, AND NEITHER WAS A SYNTHESIS.
//
// Of five unlocated facts, "Adrian delivers Jason into the setup," failed only because the comma
// sat inside the quotation marks, and the bible's curly quotes did not match the statement's
// straight ones. Reporting those as unlocated inflates the very number a reader is meant to scan
// for inventions.

const CURLY = ['## 29. Continuity foundations', 'Adrian delivers Jason into the setup and then drives him back.',
  'The mentors’ discovery is causal — not coincidence.'].join('\n');

test('a quote captured WITH its trailing comma still locates', () => {
  const s = sectionsOf(CURLY);
  const loc = locateFact(CURLY, s, f('"Adrian delivers Jason into the setup," offering him a meeting with the worker.'));
  assert.equal(loc.section, '29. Continuity foundations', 'the comma belongs to the sentence, not the quote');
});

test('curly quotes and em dashes in the source match straight ones in the statement', () => {
  const s = sectionsOf(CURLY);
  const loc = locateFact(CURLY, s, f("The bible says \"The mentors' discovery is causal - not coincidence\"."));
  assert.equal(loc.section, '29. Continuity foundations');
});

test('the offset points into the ORIGINAL text, not the normalised copy', () => {
  const src = '## A\n\n\n   spaced    out     phrase to find here\n';
  const s = sectionsOf(src);
  const loc = locateFact(src, s, f('It reads "spaced out phrase to find here".'));
  assert.ok(loc.at !== null, 'collapsed whitespace must still match');
  assert.ok(src.slice(loc.at as number).startsWith('spaced'), 'and the offset must land on the real text: '
    + JSON.stringify(src.slice(loc.at as number, (loc.at as number) + 12)));
});

test('normalisation does NOT lower the bar — a short quote is still refused', () => {
  const s = sectionsOf(CURLY);
  assert.equal(locateFact(CURLY, s, f('He "drives him".')).at, null);
});
