import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initials, showRing, ringOffset, activeVersion } from './scripton-topbar.logic.ts';

test('initials from name and email; empty → ?', () => {
  assert.equal(initials('Qais Okonkwo'), 'QO');
  assert.equal(initials('عنترة'), 'عن'); // single name → first two letters
  assert.equal(initials('admin@tfm.ae'), 'AD');
  assert.equal(initials(''), '?');
  assert.equal(initials(null), '?');
});

test('showRing gates on a real numeric score only (no fake %)', () => {
  assert.equal(showRing(96), true);
  assert.equal(showRing(0), true);
  assert.equal(showRing(100), true);
  assert.equal(showRing(null), false);
  assert.equal(showRing(undefined), false);
  assert.equal(showRing(NaN), false);
  assert.equal(showRing(120), false);
});

test('ringOffset maps pct→dashoffset (full at 0, empty at 100), clamped', () => {
  assert.equal(ringOffset(0, 100), 100); // 0% → full offset (no arc)
  assert.equal(ringOffset(100, 100), 0); // 100% → no offset (full arc)
  assert.equal(ringOffset(50, 100), 50);
  assert.equal(ringOffset(200, 100), 0); // clamped to 100
});

test('activeVersion: active flag wins, else highest n, null when empty', () => {
  assert.equal(activeVersion([])?.label ?? null, null);
  assert.equal(activeVersion([{ id: 'a', n: 1, label: 'V1' }, { id: 'b', n: 2, label: 'V2', active: true }])?.label, 'V2');
  assert.equal(activeVersion([{ id: 'a', n: 1, label: 'V1' }, { id: 'b', n: 3, label: 'V3' }])?.label, 'V3');
});
