import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { stagedCandidates } from './render-extract.util';

test('returns [] for a change with no staged facts (caller falls back to AI extraction)', () => {
  assert.deepEqual(stagedCandidates({ sceneId: 's-1', spec: { after: 'prose' } }), []);
  assert.deepEqual(stagedCandidates({ sceneId: 's-1', spec: {} }), []);
  assert.deepEqual(stagedCandidates(null), []);
  assert.deepEqual(stagedCandidates({ spec: { facts: 'nope' } }), []);
});

test('anchors each fact to the change\'s own scene (sourceSceneId) so a re-render supersedes its own facts', () => {
  const out = stagedCandidates({
    sceneId: 's-65',
    spec: { sceneOrder: 65, facts: [{ kind: 'WORLD', subject: 'climax_site', predicate: 'Location', object: 'gorge ledge' }] },
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].sourceSceneId, 's-65');
  assert.equal(out[0].status, 'ACTIVE');
  assert.equal(out[0].subject, 'CLIMAX_SITE'); // normalized upper
  assert.equal(out[0].predicate, 'location'); // normalized lower
  assert.equal(out[0].validFrom, 65); // from sceneOrder when fact omits validFrom
});

test('a fact\'s own validFrom wins over sceneOrder; validTo defaults null', () => {
  const out = stagedCandidates({ sceneId: 's-30', spec: { sceneOrder: 30, facts: [{ kind: 'TIMELINE', subject: 'ACT_BREAK', predicate: 'set_at', object: 'scene 65', validFrom: 30 }] } });
  assert.equal(out[0].validFrom, 30);
  assert.equal(out[0].validTo, null);
});

test('drops incomplete facts (missing subject/predicate/object) but keeps the valid ones', () => {
  const out = stagedCandidates({ sceneId: 's-1', spec: { facts: [
    { kind: 'PLOT', subject: 'A', predicate: 'p', object: 'o' },
    { kind: 'PLOT', subject: 'B', predicate: 'p' }, // no object → dropped
    { object: 'orphan' }, // no subject/predicate → dropped
  ] } });
  assert.equal(out.length, 1);
  assert.equal(out[0].subject, 'A');
});

test('unknown kind falls back to PLOT', () => {
  const out = stagedCandidates({ sceneId: 's-1', spec: { facts: [{ kind: 'banana', subject: 'X', predicate: 'p', object: 'o' }] } });
  assert.equal(out[0].kind, 'PLOT');
});
