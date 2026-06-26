import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { seriesSceneCount } from './series-scene-count.util';

test('#45: Ramadan musalsal 30×40 → 20 scenes/ep, season 600', () => {
  const r = seriesSceneCount(30, 40);
  assert.equal(r.scenesPerEp, 20);
  assert.equal(r.episodes, 30);
  assert.equal(r.seasonScenes, 600);
});

test('#45: K-drama 16×65 → 33 scenes/ep, season 528', () => {
  const r = seriesSceneCount(16, 65);
  assert.equal(r.scenesPerEp, 33); // round(32.5) = 33
  assert.equal(r.seasonScenes, 528);
});

test('#45: per-episode density tracks runtime', () => {
  assert.equal(seriesSceneCount(10, 60).scenesPerEp, 30); // US streaming hour
  assert.equal(seriesSceneCount(22, 44).scenesPerEp, 22); // US network
  assert.equal(seriesSceneCount(12, 24).scenesPerEp, 12); // anime
  assert.equal(seriesSceneCount(6, 55).scenesPerEp, 28); // limited (round 27.5)
  assert.equal(seriesSceneCount(8, 58).scenesPerEp, 29); // nordic noir
});

test('#45: clamp band — long episodes cap, never collapses', () => {
  assert.equal(seriesSceneCount(36, 130).scenesPerEp, 60); // Turkish dizi capped at 60 (round 65 → 60)
  assert.equal(seriesSceneCount(1, 1).scenesPerEp, 6); // floor
});

test('#45: defensive inputs (missing/garbage) never throw', () => {
  assert.equal(seriesSceneCount(undefined, undefined).scenesPerEp, 6);
  assert.equal(seriesSceneCount(0, 0).episodes, 1);
  assert.ok(seriesSceneCount('30', '40').seasonScenes === 600);
});
