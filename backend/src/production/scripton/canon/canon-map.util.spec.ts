import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mapAiFactsToCore } from './canon-map.util';

test('maps AI rows to CanonFactCore with story-order validFrom from the scene', () => {
  const scene = { id: 'sc1', order: 12, text: '' };
  const raw = [{ kind: 'CHARACTER', subject: 'mariam', predicate: 'status', object: 'dead', statement: 'Mariam dies.' }];
  const out = mapAiFactsToCore(raw, scene);
  assert.equal(out.length, 1);
  assert.equal(out[0].subject, 'MARIAM');         // upper-cased
  assert.equal(out[0].validFrom, 12);             // from scene.order
  assert.equal(out[0].validTo, null);
  assert.equal(out[0].sourceSceneId, 'sc1');
  assert.equal(out[0].status, 'ACTIVE');
});

test('drops malformed rows fail-safe', () => {
  const scene = { id: 'sc1', order: 1, text: '' };
  assert.deepEqual(mapAiFactsToCore(null as any, scene), []);
  assert.deepEqual(mapAiFactsToCore([{ subject: '' }], scene), []);
});
