import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { detectConflicts, factsExcludingScenes } from './canon-verify.util';
import type { CanonFactCore } from './canon.types';

const f = (p: Partial<CanonFactCore>): CanonFactCore => ({
  kind: 'CHARACTER', subject: 'MARIAM', predicate: 'status', object: 'alive',
  statement: '', validFrom: 0, validTo: null, status: 'ACTIVE', recordedAt: 0, sourceSceneId: null, ...p,
});

test('contradiction: dead character spoken of as alive later', () => {
  const established = [f({ object: 'dead', validFrom: 10, validTo: null })];
  const candidate = [f({ object: 'alive', validFrom: 20, statement: 'Mariam laughs at the table.' })];
  const conflicts = detectConflicts(established, candidate);
  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0].reason, /MARIAM/);
});

test('no conflict when objects agree', () => {
  const established = [f({ object: 'dead', validFrom: 10 })];
  const candidate = [f({ object: 'dead', validFrom: 20 })];
  assert.equal(detectConflicts(established, candidate).length, 0);
});

test('no conflict when validity windows do not overlap', () => {
  const established = [f({ object: 'alive', validFrom: 0, validTo: 10 })];
  const candidate = [f({ object: 'dead', validFrom: 10, validTo: null })];
  assert.equal(detectConflicts(established, candidate).length, 0);
});

test('different predicate is not a conflict', () => {
  const established = [f({ predicate: 'status', object: 'dead' })];
  const candidate = [f({ predicate: 'location', object: 'CAIRO' })];
  assert.equal(detectConflicts(established, candidate).length, 0);
});

test('fail-safe on empty/null', () => {
  assert.deepEqual(detectConflicts(null as any, null as any), []);
  assert.deepEqual(detectConflicts([f({})], []), []);
});

test('factsExcludingScenes drops same-scene facts (re-render is not a self-conflict)', () => {
  const facts = [
    f({ object: 'alive', sourceSceneId: 'sc12' }),
    f({ object: 'dead',  sourceSceneId: 'sc40' }),
  ];
  const kept = factsExcludingScenes(facts, ['sc12']);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].sourceSceneId, 'sc40');
});

test('re-rendering scene 12 (alive→dead) is NOT a conflict once its old facts are excluded', () => {
  const established = [f({ object: 'alive', validFrom: 12, sourceSceneId: 'sc12' })];
  const candidate = [f({ object: 'dead', validFrom: 12, sourceSceneId: 'sc12' })];
  const checkAgainst = factsExcludingScenes(established, ['sc12']);
  assert.equal(detectConflicts(checkAgainst, candidate).length, 0);
});

test('factsExcludingScenes is fail-safe', () => {
  assert.deepEqual(factsExcludingScenes(null as any, ['x']), []);
});

test('KNOWN P0 LIMITATION: new-scene state evolution (alive@12 → dead@30) is conservatively flagged', () => {
  // mapAiFactsToCore stores facts open-ended (validTo: null), so detectConflicts cannot tell a
  // legitimate later death from a resurrection bug — it flags BOTH for human review. The render
  // still completes non-destructively; this only lowers continuityScore. Pinned intentionally:
  // change this test consciously (P2 closes validTo on supersede), never by accident.
  const established = [f({ subject: 'MARIAM', predicate: 'status', object: 'alive', validFrom: 12, sourceSceneId: 'sc12' })];
  const candidate = [f({ subject: 'MARIAM', predicate: 'status', object: 'dead', validFrom: 30, sourceSceneId: 'sc30' })];
  // sc30 !== sc12, so factsExcludingScenes does not shield this; detectConflicts flags it.
  assert.equal(detectConflicts(established, candidate).length, 1);
});
