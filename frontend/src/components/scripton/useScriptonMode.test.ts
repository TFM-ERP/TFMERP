import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterWorkspaces, OS_WORKSPACES } from './os-workspaces.ts';

test('solo mode hides the Room workspace; team keeps it', () => {
  const solo = filterWorkspaces(OS_WORKSPACES, 'solo').map((w) => w.key);
  const team = filterWorkspaces(OS_WORKSPACES, 'team').map((w) => w.key);
  assert.ok(!solo.includes('room'));
  assert.ok(team.includes('room'));
  assert.equal(team.length - solo.length, 1); // only Room differs
});
