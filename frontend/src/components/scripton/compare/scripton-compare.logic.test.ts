import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineDiff, isSlugLine, toSceneDiffs, detectBridge } from './scripton-compare.logic.ts';

test('identical text → every line plain on both sides', () => {
  const { prev, next } = lineDiff('A\nB\nC', 'A\nB\nC');
  assert.deepEqual(prev.map((l) => l.cls), ['', '', '']);
  assert.deepEqual(next.map((l) => l.cls), ['', '', '']);
  assert.deepEqual(prev.map((l) => l.t), ['A', 'B', 'C']);
});

test('pure addition → prev all plain, next has the added lines', () => {
  const { prev, next } = lineDiff('A\nB', 'A\nX\nB\nY');
  assert.deepEqual(prev.map((l) => l.cls), ['', '']);
  assert.deepEqual(next.filter((l) => l.cls === 'add').map((l) => l.t), ['X', 'Y']);
  assert.equal(next.length, 4);
});

test('pure deletion → prev marks the removed lines del, next all plain', () => {
  const { prev, next } = lineDiff('A\nGONE\nB', 'A\nB');
  assert.deepEqual(prev.filter((l) => l.cls === 'del').map((l) => l.t), ['GONE']);
  assert.deepEqual(next.map((l) => l.cls), ['', '']);
});

test('mixed change keeps the common lines and marks the swap (del before / add after)', () => {
  const before = '65  EXT. CLIFFS — DAY\nAntarah scales the cliff in three easy pulls.\nHe reaches the cave mouth.';
  const after = '65  EXT. CLIFFS — DAY\nHe freezes — breathes — then climbs, knuckles white.\nHe reaches the cave mouth.';
  const { prev, next } = lineDiff(before, after);
  // slug + last line are common (plain); the middle line is del on prev, add on next
  assert.equal(prev[0].cls, ''); // slug common
  assert.deepEqual(prev.filter((l) => l.cls === 'del').map((l) => l.t), ['Antarah scales the cliff in three easy pulls.']);
  assert.deepEqual(next.filter((l) => l.cls === 'add').map((l) => l.t), ['He freezes — breathes — then climbs, knuckles white.']);
  assert.ok(prev.some((l) => l.t === 'He reaches the cave mouth.' && l.cls === ''));
});

test('empty sides degrade cleanly (all add / all del)', () => {
  assert.deepEqual(lineDiff('', 'X\nY').next.map((l) => l.cls), ['add', 'add']);
  assert.deepEqual(lineDiff('X\nY', '').prev.map((l) => l.cls), ['del', 'del']);
});

test('isSlugLine matches a numbered INT/EXT heading, not body prose', () => {
  assert.ok(isSlugLine('65  EXT. CLIFFS — DAY'));
  assert.ok(isSlugLine('12 INT. TENT - NIGHT'));
  assert.ok(!isSlugLine('Antarah sets his hands to the stone.'));
});

test('toSceneDiffs labels each block by its slug, falls back to scene number', () => {
  const blocks = toSceneDiffs([
    { sceneId: 's65', sceneNumber: 65, label: 're-ending', before: '65  EXT. CLIFFS — DAY\nold.', after: '65  EXT. CLIFFS — DAY\nnew.' },
    { sceneId: 's12', sceneNumber: 12, label: 'strengthen setup', before: 'old setup', after: 'new setup' },
  ]);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].head, '65  EXT. CLIFFS — DAY');
  assert.equal(blocks[1].head, 'Scene 12 · strengthen setup'); // no slug → labelled
});

test('detectBridge flags a DAWN opener ADDED in the rendered scene; null otherwise', () => {
  // DAWN line on the second row (after the slug) is still detected
  assert.deepEqual(detectBridge([{ sceneNumber: 65, before: '65  EXT. CLIFFS — DAY\nDawn breaks soft.', after: '65  EXT. CLIFFS — DAY\nDAWN. A wall of red rock.' }]),
    { count: 1, note: 'DAWN time-bridge inserted (S64 night → S65 dawn)' });
  assert.deepEqual(detectBridge([{ sceneNumber: 65, after: 'DAWN. A wall of red rock.' }]),
    { count: 1, note: 'DAWN time-bridge inserted (S64 night → S65 dawn)' });
  // already DAWN in the previous version → nothing inserted
  assert.deepEqual(detectBridge([{ sceneNumber: 65, before: 'DAWN. Same as before.', after: 'DAWN. Same as before.' }]), { count: 0, note: null });
  assert.deepEqual(detectBridge([{ sceneNumber: 12, after: 'INT. TENT — NIGHT\nfoo' }]), { count: 0, note: null });
  assert.deepEqual(detectBridge([]), { count: 0, note: null });
});
