import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildShortKey, sourceFingerprint, versionLabel } from './build-identity.util';

// The real collisions on this install, which are the acceptance test for the whole feature:
//   3 x "Jason Quick"  — 4,066 / 44,733 / 66,128 chars of DIFFERENT source, different casts
//   6 x "MINUTEMEN"    — byte-identical 44,363-char source
const JQ = [
  { id: 'cmti694l600005av8jpavemer', name: 'Jason Quick', chars: 66128 },
  { id: 'cmtncegwk000p5ag899lov8i8', name: 'Jason Quick', chars: 44733 },
  { id: 'cmtl4mcvn00035aj8fttz5761', name: 'Jason Quick', chars: 4066 },
];
const MINUTEMEN = ['cmtb9edb7000x5acg96tpy1bx', 'cmtgwpqeq00045ats6kclagj3', 'cmtb8yhbl000c5acgfq15uhar',
  'cmtb9hfek001i5acgglti9p0f', 'cmtb9ilbo001t5acgplfom28s', 'cmtb9wqby002f5acg1gnr2rts'];

test('THE ACCEPTANCE TEST: the three Jason Quick builds are distinguishable', () => {
  const keys = JQ.map((b) => buildShortKey(b.name, b.id));
  assert.equal(new Set(keys).size, 3, 'same name, three keys: ' + keys.join(' '));
  keys.forEach((k) => assert.match(k, /^JQ-[0-9A-F]{6}$/, 'initials from the name, hex from the id: ' + k));
});

test('THE HARDER ONE: six MINUTEMEN with byte-identical source are still distinguishable', () => {
  // Nothing content-derived can separate these - same name, same size, same hash. Only the key can.
  const keys = MINUTEMEN.map((id) => buildShortKey('MINUTEMEN', id));
  assert.equal(new Set(keys).size, 6, 'six distinct keys: ' + keys.join(' '));
  const prints = MINUTEMEN.map(() => sourceFingerprint('x'.repeat(44363)).label);
  assert.equal(new Set(prints).size, 1, 'their fingerprints are IDENTICAL - which is why the key exists');
});

test('the key is stable — the same build reads the same way tomorrow', () => {
  assert.equal(buildShortKey('Jason Quick', JQ[0].id), buildShortKey('Jason Quick', JQ[0].id));
});

test('size alone is not identity: same length, different content, different fingerprint', () => {
  const a = sourceFingerprint('a'.repeat(44363));
  const b = sourceFingerprint('b'.repeat(44363));
  assert.equal(a.chars, b.chars, 'identical size');
  assert.notEqual(a.hash, b.hash, 'and that is exactly why size alone would have failed');
  assert.notEqual(a.label, b.label);
});

test('the fingerprint reads the way it must render', () => {
  const f = sourceFingerprint('x'.repeat(66128));
  assert.match(f.label, /^source 66k [0-9a-f]{6}$/, f.label);
  assert.equal(f.empty, false);
  assert.equal(sourceFingerprint('x'.repeat(4066)).label.startsWith('source 4.1k'), true, 'small sizes keep a decimal');
  assert.equal(sourceFingerprint('x'.repeat(900)).label.startsWith('source 900'), true);
});

test('AN EMPTY SOURCE IS NEVER BLANK — that state produced the wrong film', () => {
  for (const bad of ['', '   ', null, undefined]) {
    const f = sourceFingerprint(bad as any);
    assert.equal(f.empty, true, 'must be flagged so the UI can colour it: ' + JSON.stringify(bad));
    assert.equal(f.label, 'no source', 'and must SAY it, not render an empty cell');
    assert.equal(f.hash, null);
    assert.equal(f.chars, 0);
  }
});

test('version label states what it knows and nothing more', () => {
  assert.equal(versionLabel(2, 3), 'V2 of 3');
  assert.equal(versionLabel(1, 1), 'V1 of 1');
  assert.equal(versionLabel(null, 0), '—', 'unversioned builds do not invent a V1');
  assert.equal(versionLabel(0, 0), '—');
  assert.equal(versionLabel(null, 3), '3 versions', 'versions exist but none is active');
  assert.equal(versionLabel(null, 1), '1 version');
});

test('junk in, a card line out — this renders on every build in the list', () => {
  for (const bad of [null, undefined, '', 42 as any, {} as any]) {
    assert.ok(buildShortKey(bad as any, bad as any).length > 1);
    assert.doesNotThrow(() => sourceFingerprint(bad as any));
    assert.doesNotThrow(() => versionLabel(bad as any, bad as any));
  }
  assert.match(buildShortKey('', 'abc'), /^B-/, 'a nameless build still gets a key');
  assert.match(buildShortKey('The Key', 'x'), /^TK-/, 'noise words are not stripped - initials are literal');
});
