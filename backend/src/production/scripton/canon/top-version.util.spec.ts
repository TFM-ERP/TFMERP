import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { pickRenderedScriptId } from './top-version.util';

// The bug this guards: عنترة exists as multiple builds (tatweel-elongated draft
// title "عنتـــــرة" vs the rendered build "عنترة"). Title/order can't disambiguate —
// only "the build's linked script actually has a RENDERED pass" can.

test('picks the linked script that has a rendered pass — not the one matched by title/order', () => {
  const linkedScriptIds = ['cmqv6998z', 'cmqqiliff']; // draft-build's link first, rendered second
  const renderedPasses = [{ scriptId: 'cmqqiliff', createdAt: '2026-06-20T00:00:00Z' }];
  assert.equal(pickRenderedScriptId(linkedScriptIds, renderedPasses), 'cmqqiliff');
});

test('returns null when no workspace build has a rendered pass (ring hides uniformly)', () => {
  assert.equal(pickRenderedScriptId(['cmqv6998z', 'cmqodoj8w'], []), null);
});

test('ignores rendered passes from scripts outside this workspace', () => {
  const renderedPasses = [{ scriptId: 'other-ws-script', createdAt: '2026-06-25T00:00:00Z' }];
  assert.equal(pickRenderedScriptId(['cmqv6998z'], renderedPasses), null);
});

test('with multiple rendered scripts, picks the most recently rendered', () => {
  const linkedScriptIds = ['scriptA', 'scriptB'];
  const renderedPasses = [
    { scriptId: 'scriptA', createdAt: '2026-06-10T00:00:00Z' },
    { scriptId: 'scriptB', createdAt: '2026-06-28T00:00:00Z' },
    { scriptId: 'scriptA', createdAt: '2026-06-12T00:00:00Z' },
  ];
  assert.equal(pickRenderedScriptId(linkedScriptIds, renderedPasses), 'scriptB');
});

test('handles empty / missing inputs without throwing', () => {
  assert.equal(pickRenderedScriptId([], [{ scriptId: 'x', createdAt: '2026-01-01' }]), null);
  assert.equal(pickRenderedScriptId(['x'], undefined as any), null);
});
