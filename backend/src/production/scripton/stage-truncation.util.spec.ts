import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { truncationFlag, truncationOf, nextStageRefusal, approvalRefusal, scriptRefusal } from './stage-truncation.util';
import { truncationWarning } from '../../ai/empty-output.util';

// The note on the v2.2 DRAFT, character for character as it is stored — the draft that prompted this.
const V22_DRAFT_WARNING = truncationWarning('DRAFT', { inputTokens: 9_870, outputTokens: 25_000, maxTokens: 25_000, stopReason: 'max_tokens', model: 'claude-opus-5', provider: 'anthropic' });

test('a stage cut off at its ceiling is flagged with the numbers, and the note says it is not done', () => {
  const flag = truncationFlag({ outputTokens: 25_000, maxTokens: 25_000, stopReason: 'max_tokens' });
  assert.deepEqual(flag, { stopReason: 'max_tokens', outputTokens: 25_000, maxTokens: 25_000 });
  const t = truncationOf({ truncated: flag });
  assert.equal(t!.from, 'flag');
  assert.match(t!.note, /^INCOMPLETE — this stage stopped at its 25,000-token ceiling/);
  assert.match(t!.note, /output 25,000\/25,000 tokens, stop reason "max_tokens"/);
  assert.match(t!.note, /not counted as done/);
});

test('THE OLD NOTE STILL COUNTS: the v2.2 draft, written before the flag, reads as truncated', () => {
  const t = truncationOf({ warning: V22_DRAFT_WARNING, canon: { facts: 289 } });
  assert.ok(t, 'a reader of the new field alone would have left this draft filed as complete');
  assert.equal(t!.from, 'warning');
  assert.equal(t!.maxTokens, 25_000);
  assert.equal(t!.outputTokens, 25_000);
  assert.equal(t!.stopReason, 'max_tokens');
});

test('an array stage still truncating after its continuation passes reads as truncated, with its count', () => {
  const t = truncationOf({ warning: 'STEP_OUTLINE outline may be incomplete — still truncating after 4 continuation pass(es) (61 items). Re-run.' });
  assert.equal(t!.from, 'warning');
  assert.equal(t!.passes, 4);
  assert.equal(t!.items, 61);
  assert.match(t!.note, /after 4 continuation pass\(es\) \(61 items kept\)/);
  const f = truncationOf({ truncated: truncationFlag({ outputTokens: 24_700, maxTokens: 25_000 }, { items: 61, passes: 4 }) });
  assert.equal(f!.items, 61);
  assert.equal(f!.passes, 4);
});

test('A WARNING THAT IS NOT A TRUNCATION IS NOT ONE: the canon shortfall also lives in data.warning', () => {
  assert.equal(truncationOf({ warning: 'CANON SHORTFALL: 12 of 30 rules could not be located in the source.' }), null);
  assert.equal(truncationOf({ warning: 'Something may be incomplete.' }), null);
});

test('complete, empty and junk data are all "not truncated"', () => {
  for (const d of [null, undefined, {}, { scenes: [] }, 'x', 7, { truncated: null }, { truncated: false }]) {
    assert.equal(truncationOf(d as any), null, JSON.stringify(d));
  }
});

test('a draft written in pieces that still ran short says which piece failed, and why', () => {
  const flag = truncationFlag({ outputTokens: 25_000, maxTokens: 25_000, stopReason: 'max_tokens' }, { passes: 2, failed: 'piece 3 failed: TIMEOUT after 600s' });
  const t = truncationOf({ truncated: flag });
  assert.equal(t!.failed, 'piece 3 failed: TIMEOUT after 600s');
  assert.match(t!.note, /after 2 continuation pass\(es\) — piece 3 failed: TIMEOUT after 600s \(output 25,000\/25,000/);
});

test('NEXT STAGE: blocked by a cut-off stage before it, named, with what is still allowed', () => {
  assert.equal(nextStageRefusal('COVERAGE', []), null);
  const one = nextStageRefusal('COVERAGE', ['DRAFT'])!;
  assert.match(one, /^Coverage cannot be written yet: Draft is incomplete — cut off at the token ceiling — and every later stage is written from it\. Regenerate Draft first\./);
  assert.match(one, /You can still read, copy and export it\.$/);
  assert.match(nextStageRefusal('DRAFT', ['SCENES', 'STEP_OUTLINE'])!, /Scenes and Step outline are incomplete[\s\S]*Regenerate Scenes and Step outline first[\s\S]*export them\.$/);
});

test('APPROVAL: a cut-off version cannot be approved or locked; other statuses are untouched', () => {
  const cut = truncationOf({ truncated: truncationFlag({ outputTokens: 25_000, maxTokens: 25_000, stopReason: 'max_tokens' }) });
  assert.match(approvalRefusal('DRAFT', 'APPROVED', cut)!, /^This Draft version is incomplete — cut off at the token ceiling — so it cannot be marked approved\./);
  assert.match(approvalRefusal('DRAFT', 'locked', cut)!, /cannot be marked locked/);
  assert.equal(approvalRefusal('DRAFT', 'REVIEW', cut), null);
  assert.equal(approvalRefusal('DRAFT', 'DRAFT', cut), null);
  assert.equal(approvalRefusal('DRAFT', 'APPROVED', null), null);
});

test('SCRIPT: nothing is written over a script from a ladder holding a cut-off stage — and a rewrite says the script was not touched', () => {
  assert.equal(scriptRefusal([], 'write'), null);
  assert.match(scriptRefusal(['DRAFT'], 'write')!, /^No script can be written while Draft is incomplete[\s\S]*replace your script with a half-finished one/);
  assert.match(scriptRefusal(['SCENES'], 'rewrite')!, /^Your script was not touched\. It cannot be regenerated while Scenes is incomplete/);
  assert.match(scriptRefusal(['DRAFT'], 'production')!, /^This cannot be sent to production while Draft is incomplete[\s\S]*master script/);
});

test('unknown numbers are printed as "?", never as 0', () => {
  const t = truncationOf({ truncated: { stopReason: null } });
  assert.match(t!.note, /output \?\/\? tokens/);
});
