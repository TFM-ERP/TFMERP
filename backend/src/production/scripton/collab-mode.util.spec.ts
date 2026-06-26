import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCollabMode } from './collab-mode.util';

test('AUTO follows membership: 1 member → solo, 2+ → team', () => {
  assert.equal(resolveCollabMode('AUTO', 1), 'solo');
  assert.equal(resolveCollabMode('AUTO', 0), 'solo');
  assert.equal(resolveCollabMode('AUTO', 2), 'team');
  assert.equal(resolveCollabMode('AUTO', 7), 'team');
});

test('manual override wins over membership', () => {
  assert.equal(resolveCollabMode('SOLO', 5), 'solo'); // collaborators present, still solo
  assert.equal(resolveCollabMode('TEAM', 1), 'team'); // sole member, pre-armed team
});

test('missing/unknown mode defaults to AUTO behaviour', () => {
  assert.equal(resolveCollabMode(null, 1), 'solo');
  assert.equal(resolveCollabMode(undefined, 3), 'team');
  assert.equal(resolveCollabMode('garbage', 3), 'team');
});
