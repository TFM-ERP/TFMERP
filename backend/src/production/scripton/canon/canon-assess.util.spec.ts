import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { assessPass } from './canon-assess.util';
import type { CanonFactCore } from './canon.types';

const f = (p: Partial<CanonFactCore>): CanonFactCore => ({
  kind: 'CHARACTER', subject: 'MARIAM', predicate: 'status', object: 'dead',
  statement: 'Mariam is killed in the raid.', validFrom: 12, validTo: null,
  status: 'ACTIVE', recordedAt: 0, sourceSceneId: 'sc12', ...p,
});

test('THE LOOP: established dead@12 vs candidate alive@20 → caught, score < 1', () => {
  const established = [f({ object: 'dead', validFrom: 12, sourceSceneId: 'sc12' })];
  const candidates = [f({ object: 'alive', validFrom: 20, sourceSceneId: 'sc20',
                          statement: 'Mariam laughs at the table.' })];
  const r = assessPass(established, candidates, ['sc20'], 1);
  assert.equal(r.conflicts.length, 1);
  assert.ok(r.continuityScore < 1);
  assert.match(r.conflicts[0].reason, /MARIAM/);
});

test('re-rendering the SAME scene (alive→dead @sc12) is not a self-conflict, score 1', () => {
  const established = [f({ object: 'alive', validFrom: 12, sourceSceneId: 'sc12' })];
  const candidates = [f({ object: 'dead', validFrom: 12, sourceSceneId: 'sc12' })];
  const r = assessPass(established, candidates, ['sc12'], 1);
  assert.equal(r.conflicts.length, 0);
  assert.equal(r.continuityScore, 1);
});
