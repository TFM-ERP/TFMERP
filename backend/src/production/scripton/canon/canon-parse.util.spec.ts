import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseFactsLoose } from './canon-parse.util';

/**
 * MEASURED, on the real 66,128-character bible: the extraction ran to its ceiling
 * (stop_reason=max_tokens, 8,000 output tokens) and the JSON came back cut mid-string. JSON.parse
 * threw, the service caught it and returned [], and the ladder would then have written every stage
 * with NO canon at all — worse than before the structural categories existed, because the richer
 * prompt truncates sooner. Thirty-four complete facts had already been emitted and all were lost.
 */

const fact = (k: string, s: string) => '{"kind":"' + k + '","subject":"X","predicate":"p","object":"o","statement":"' + s + '"}';
const good = '{"facts":[' + fact('ROLE', 'Gideon is the antagonist.') + ',' + fact('CRIME', 'The crime is trafficking.') + ']}';

test('a well-formed response parses normally and reports no salvage', () => {
  const r = parseFactsLoose(good);
  assert.equal(r.facts.length, 2);
  assert.equal(r.salvaged, false);
  assert.equal(r.recovered, 0);
});

test('THE REGRESSION: a response cut mid-string still yields every COMPLETE fact', () => {
  // exactly the shape observed: two whole objects, then one severed inside a string value
  const truncated = '{"facts":[' + fact('ROLE', 'Gideon is the antagonist.') + ',' + fact('CRIME', 'The crime is trafficking.')
    + ',{"kind":"OUTCOME","subject":"JASON","predicate":"survives","object":"yes","statement":"Jason destroys the false identity documents but keeps Call';
  const r = parseFactsLoose(truncated);
  assert.equal(r.salvaged, true, 'the whole extraction was thrown away instead of salvaged');
  assert.equal(r.facts.length, 2, 'both complete facts survive');
  assert.equal(r.recovered, 2);
  assert.equal(JSON.parse(JSON.stringify(r.facts[0])).kind, 'ROLE');
});

test('NOTHING PARTIAL IS ADMITTED — a half-written fact is the invented fact this guards against', () => {
  const cut = '{"facts":[{"kind":"ROLE","subject":"GIDEON","predicate":"is_antagon';
  const r = parseFactsLoose(cut);
  assert.deepEqual(r.facts, [], 'a repaired fragment would be a fact nobody wrote');
});

test('braces and quotes INSIDE statements do not split an object', () => {
  const tricky = '{"facts":[{"kind":"PROHIBITION","subject":"HERO","predicate":"must_not","object":"x",'
    + '"statement":"Do not write \\"a {curly} aside\\" or an escaped backslash \\\\ here."}]}';
  const r = parseFactsLoose(tricky);
  assert.equal(r.facts.length, 1);
  assert.match(r.facts[0].statement, /curly/);
});

test('prose before or after the JSON is tolerated', () => {
  const r = parseFactsLoose('Here are the facts:\n' + good + '\nThat is all.');
  assert.equal(r.facts.length, 2);
  assert.equal(r.salvaged, false, 'the embedded-JSON path is not salvage');
});

test('a bare array of facts is accepted', () => {
  const r = parseFactsLoose('[' + fact('ROLE', 'A.') + ']');
  assert.equal(r.facts.length, 1);
});

test('objects that are not facts are ignored during salvage', () => {
  const junk = '{"meta":{"note":"hello"},"facts":[' + fact('ROLE', 'A.') + ',{"unrelated":1}';
  const r = parseFactsLoose(junk);
  assert.equal(r.salvaged, true);
  assert.equal(r.facts.length, 1, 'only objects that look like facts are recovered');
});

test('empty and junk input returns nothing rather than throwing', () => {
  for (const bad of ['', '   ', null, undefined, 42, {}, [], 'not json at all']) {
    const r = parseFactsLoose(bad as any);
    assert.deepEqual(r.facts, [], JSON.stringify(bad));
    assert.equal(r.salvaged, false);
  }
});
