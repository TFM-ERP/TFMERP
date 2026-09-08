import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStudioView } from './studio-view.logic.ts';

// The rail's Build item, verbatim from os-workspaces.ts, and the URL a build opens at.
const RAIL_BUILD = 'tab=builds';
const OPEN_BUILD = 'build=cmti694l600005av8jpavemer';

test('THE REGRESSION: clicking Build while a build is open returns to the board', () => {
  const open = resolveStudioView(OPEN_BUILD);
  assert.equal(open.mode, 'develop', 'precondition: a build is open');
  const after = resolveStudioView(RAIL_BUILD);
  assert.equal(after.mode, 'builds', 'the rail must always return to the board');
  assert.equal(after.buildId, undefined, 'and the open build must be cleared, or render takes the develop branch again');
});

test('tab wins over build — ?tab=builds&build=X is the board, not the build', () => {
  const v = resolveStudioView('tab=builds&build=abc');
  assert.equal(v.mode, 'builds');
  assert.equal(v.buildId, undefined, 'left set, this lands straight back on the bug');
});

test('a refresh lands where he was', () => {
  assert.equal(resolveStudioView(OPEN_BUILD).mode, 'develop');
  assert.equal(resolveStudioView(OPEN_BUILD).buildId, 'cmti694l600005av8jpavemer');
  assert.equal(resolveStudioView(RAIL_BUILD).mode, 'builds');
});

test('no query at all is the board — the studio landing', () => {
  const v = resolveStudioView('');
  assert.equal(v.mode, 'builds');
  assert.equal(v.buildId, undefined);
});

test('Back from the board to an open build re-opens it', () => {
  // Browser Back replays the previous query string; the rule must be a pure function of it.
  const history = [RAIL_BUILD, OPEN_BUILD, RAIL_BUILD];
  assert.deepEqual(history.map((h) => resolveStudioView(h).mode), ['builds', 'develop', 'builds']);
});

test('the other tabs still address themselves', () => {
  assert.equal(resolveStudioView('tab=adapt').mode, 'adapt');
  assert.equal(resolveStudioView('tab=format').mode, 'format');
  assert.equal(resolveStudioView('tab=develop').mode, 'develop');
  assert.equal(resolveStudioView('tab=develop&build=x').buildId, 'x', 'develop keeps its build');
});

test('junk in the query does not strand him on a blank screen', () => {
  for (const bad of ['', '?', 'tab=', 'build=', 'tab=&build=', 'nonsense', '=&=']) {
    const v = resolveStudioView(bad);
    assert.ok(v.mode, 'always resolves to a screen: ' + JSON.stringify(bad));
  }
  assert.equal(resolveStudioView('tab=&build=').mode, 'builds', 'empty params are absent params');
});

test('a leading ? is accepted, since window.location.search carries one', () => {
  assert.equal(resolveStudioView('?tab=builds').mode, 'builds');
  assert.equal(resolveStudioView('?build=x').mode, 'develop');
});
