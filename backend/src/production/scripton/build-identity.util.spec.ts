import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildShortKey, sourceFingerprint, versionCountLabel, draftLabel } from './build-identity.util';

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
  assert.equal(versionCountLabel(2, 3), 'V2 of 3');
  assert.equal(versionCountLabel(1, 1), 'V1 of 1');
  assert.equal(versionCountLabel(null, 0), '—', 'unversioned builds do not invent a V1');
  assert.equal(versionCountLabel(0, 0), '—');
  assert.equal(versionCountLabel(null, 3), '3 versions', 'versions exist but none is active');
  assert.equal(versionCountLabel(null, 1), '1 version');
});

test('junk in, a card line out — this renders on every build in the list', () => {
  for (const bad of [null, undefined, '', 42 as any, {} as any]) {
    assert.ok(buildShortKey(bad as any, bad as any).length > 1);
    assert.doesNotThrow(() => sourceFingerprint(bad as any));
    assert.doesNotThrow(() => versionCountLabel(bad as any, bad as any));
  }
  assert.match(buildShortKey('', 'abc'), /^B-/, 'a nameless build still gets a key');
  assert.match(buildShortKey('The Key', 'x'), /^TK-/, 'noise words are not stripped - initials are literal');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE WRITER'S OWN LABEL beats the machine count
//
// Two things were called versionLabel: the free-text box in the intake ("Version / draft label",
// landing on brief.versionLabel) and the function that counts BuildVersion rows. The card showed
// the second. There are ZERO BuildVersion rows on all 18 builds, so every card printed an em dash
// while the one label actually typed — "V 1.01", on the 44,733-character Jason Quick bible — went
// nowhere at all.

test('a typed label is taken as the writer wrote it', () => {
  assert.equal(draftLabel('V 1.01'), 'V 1.01', 'the real value from the contested bible');
  assert.equal(draftLabel("Director's pass"), "Director's pass");
  assert.equal(draftLabel('  v2  '), 'v2', 'trimmed, because a stray space is not a name');
});

test('AN EMPTY BOX IS NOT A LABEL — one build has "" from typing then clearing', () => {
  for (const bad of ['', '   ', null, undefined, 42, {}, []]) assert.equal(draftLabel(bad as any), '',
    'must be falsy so it falls through to the count: ' + JSON.stringify(bad));
});

test('it honours the 60-character limit the input enforces', () => {
  assert.equal(draftLabel('x'.repeat(200)).length, 60);
});

test('the two are now distinct functions and cannot be confused at a call site', () => {
  assert.equal(draftLabel('V 1.01'), 'V 1.01');
  assert.equal(versionCountLabel(null, 0), '—', 'the count still says nothing when there is nothing to say');
  assert.notEqual(draftLabel('V 1.01'), versionCountLabel(1, 1), 'different questions, different answers');
});

test('the precedence the card depends on: typed label first, count only as fallback', () => {
  const pick = (typed: unknown, n: number | null, total: number) => draftLabel(typed) || versionCountLabel(n, total);
  assert.equal(pick('V 1.01', null, 0), 'V 1.01', 'his label wins even when there are no version rows');
  assert.equal(pick('V 1.01', 2, 3), 'V 1.01', 'and even when there ARE');
  assert.equal(pick('', 2, 3), 'V2 of 3', 'empty box falls through to the count');
  assert.equal(pick(null, null, 0), '—', 'nothing typed and nothing counted still overstates nothing');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// NON-LATIN NAMES
//
// The split was [^A-Za-z0-9]+, which discards every Arabic letter — so داس and عنترة both fell to
// the "B-" fallback and every Arabic-titled build shared a prefix. This product writes Arabic
// screenplays; عنترة is one of the eleven builds recovered from the orphan inventory.

test('Arabic names produce Arabic initials, not the fallback', () => {
  assert.match(buildShortKey('داس', 'id-das'), /^د-[0-9A-F]{6}$/);
  assert.match(buildShortKey('عنترة', 'id-antara'), /^ع-[0-9A-F]{6}$/);
  assert.notEqual(buildShortKey('داس', 'a').split('-')[0], 'B', 'the old behaviour');
});

test('multi-word non-Latin names take one initial per word, up to three', () => {
  assert.equal(buildShortKey('عنترة بن شداد', 'x').split('-')[0], 'عبش');
});

test('Latin behaviour is unchanged', () => {
  assert.match(buildShortKey('Jason Quick', 'cmti694l6'), /^JQ-[0-9A-F]{6}$/);
  assert.match(buildShortKey('The Key', 'x'), /^TK-/);
  assert.match(buildShortKey('MINUTEMEN', 'y'), /^M-/);
});

test('mixed scripts and digits still work', () => {
  assert.match(buildShortKey('داس 2', 'x'), /^د2-/);
  assert.match(buildShortKey('Das "The Movie"', 'x'), /^DTM-/);
});

test('a name with no letters at all still yields a key', () => {
  assert.match(buildShortKey('!!! ---', 'x'), /^B-/);
  assert.match(buildShortKey('🎬', 'x'), /^B-/, 'an emoji is not a letter');
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE DIGEST IS A KEY. `hash` IS NOT.
//
// The canon cache used to key on length plus three 120-character samples (head, middle, tail):
// an edit anywhere between those points reused the old canon. `digest` is sha256 of the whole
// document. `hash` stays six hex for the card — at that width two bibles collide roughly once in
// sixteen million, and the consequence here is a build being served another build's canon.

test('the digest changes when ANY character changes, not just the sampled ones', () => {
  const base = 'A'.repeat(50000) + 'MIDDLE' + 'B'.repeat(50000);
  // an edit far from head, middle and tail — exactly what the old sampled key could not see
  const edited = base.slice(0, 25000) + 'X' + base.slice(25001);
  assert.equal(base.length, edited.length, 'same length, so length alone cannot tell them apart');
  assert.notEqual(sourceFingerprint(base).digest, sourceFingerprint(edited).digest,
    'a canon extracted from one would be served for the other');
});

test('the digest is full-strength and stable', () => {
  const f = sourceFingerprint('the whole bible');
  assert.match(String(f.digest), /^[0-9a-f]{64}$/, 'sha256 hex: ' + f.digest);
  assert.equal(f.digest, sourceFingerprint('the whole bible').digest, 'same input, same key');
});

test('hash stays six hex for the card, and is NOT the digest', () => {
  const f = sourceFingerprint('x'.repeat(66128));
  assert.match(String(f.hash), /^[0-9a-f]{6}$/);
  assert.notEqual(f.hash, f.digest);
  assert.match(f.label, /^source 66k [0-9a-f]{6}$/, 'the display value is unchanged');
});

test('an empty source has no digest to key on', () => {
  for (const bad of ['', '   ', null, undefined]) {
    const f = sourceFingerprint(bad as any);
    assert.equal(f.digest, null, JSON.stringify(bad));
    assert.equal(f.hash, null);
  }
});
