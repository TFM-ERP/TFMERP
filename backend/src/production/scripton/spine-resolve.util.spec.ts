/**
 * Spine resolution — the build's own framework and ending first, the workspace as fallback.
 * Run: npm run test:unit
 *
 * The values are the real ones from Jason Quick (cmtvse1hu) and the ScripON Library workspace row,
 * where every stage was being written on the workspace's savecat / "Resolved + Twist" although the
 * build had chosen sequence8 / "Poetic justice + Resolved".
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveSpineField } from './spine-resolve.util';

const WORKSPACE = { spine: { framework: 'savecat', ending: 'Resolved / happy  +  Twist', endingIds: ['resolved', 'twist'] } };
const JASON = { spine: { framework: 'sequence8', ending: 'Poetic justice  +  Resolved / happy' } };

test('the BUILD wins: its own framework and ending, not the workspace row', () => {
  assert.deepEqual(resolveSpineField('framework', JASON, WORKSPACE), { value: 'sequence8', from: 'build' });
  assert.deepEqual(resolveSpineField('ending', JASON, WORKSPACE), { value: 'Poetic justice  +  Resolved / happy', from: 'build' });
});

test('a build with no value of its own falls back to the workspace', () => {
  assert.deepEqual(resolveSpineField('framework', {}, WORKSPACE), { value: 'savecat', from: 'workspace' });
  assert.deepEqual(resolveSpineField('ending', { spine: {} }, WORKSPACE), { value: 'Resolved / happy  +  Twist', from: 'workspace' });
  assert.deepEqual(resolveSpineField('ending', null, WORKSPACE), { value: 'Resolved / happy  +  Twist', from: 'workspace' });
});

test('FIELD BY FIELD: a build with a framework but no ending keeps the workspace ending (not undefined)', () => {
  const fe = { spine: { framework: 'savecat' } };   // the real "fe" build: own framework, no ending
  assert.deepEqual(resolveSpineField('framework', fe, WORKSPACE), { value: 'savecat', from: 'build' });
  assert.deepEqual(resolveSpineField('ending', fe, WORKSPACE), { value: 'Resolved / happy  +  Twist', from: 'workspace' });
});

test('blank is not a value: an empty or whitespace build field falls through to the workspace', () => {
  assert.equal(resolveSpineField('framework', { spine: { framework: '' } }, WORKSPACE).from, 'workspace');
  assert.equal(resolveSpineField('ending', { spine: { ending: '   ' } }, WORKSPACE).from, 'workspace');
  assert.equal(resolveSpineField('framework', { spine: { framework: 42 } }, WORKSPACE).from, 'workspace');
});

test('a framework picked on the request (BEATS re-pick) beats the build', () => {
  assert.deepEqual(resolveSpineField('framework', JASON, WORKSPACE, 'vogler'), { value: 'vogler', from: 'request' });
  assert.equal(resolveSpineField('framework', JASON, WORKSPACE, '').from, 'build', 'an empty request is not a pick');
});

test('no intake row at all: the build still reaches the prompt', () => {
  assert.deepEqual(resolveSpineField('ending', JASON, null), { value: 'Poetic justice  +  Resolved / happy', from: 'build' });
  assert.deepEqual(resolveSpineField('framework', JASON, {}), { value: 'sequence8', from: 'build' });
});

test('nothing anywhere: undefined, with no source — never a guessed default', () => {
  assert.deepEqual(resolveSpineField('framework', {}, {}), { value: undefined, from: null });
  assert.deepEqual(resolveSpineField('ending', null, null), { value: undefined, from: null });
});
