/**
 * Plan 01 task 3A — slicing, and a cut-off call that does not survive as silence.
 *
 * The decisive tests are (1) the slice is sized from a measured per-scene cost and the slices cover
 * every scene exactly once; (2) the STOP REASON decides before the parse is attempted; and (3) a
 * slice that fails through both halvings produces a typed failure rather than a `continue`.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  TOKENS_PER_SCENE_OBSERVED, HEADROOM, NEAR_CEILING,
  planStateSlices, halve, retryPlan, whyFailed, nearCeiling, ceilingFailure, sliceLabel,
  readSpanWithRetry, MAX_HALVINGS, type Slice,
} from './plan-state-slices.util';
import { stoppedAtCeiling } from '../../ai/empty-output.util';
import { findingsEntry, sweepFailed } from './revision-checks.util';

test('TASK 3A — a slice is sized so the expected output fits the ceiling with headroom', () => {
  // 10,099 output tokens for scenes 51-81 = 31 scenes = 325.8. The only COMPLETE measurement of
  // this call, and ONE SAMPLE.
  assert.equal(TOKENS_PER_SCENE_OBSERVED, 326);
  assert.equal(HEADROOM, 0.75);
  const s = planStateSlices(81, { maxTokens: 16000 });      // 16,000 x 0.75 / 326 = 36
  assert.ok(s.every((x) => x.end - x.start + 1 <= 36), JSON.stringify(s));
  assert.deepEqual(s[0], { start: 0, end: 35 });
  assert.equal(s.length, 3, '81 scenes in slices of 36 is three calls, against the measured two');
});

test('TASK 3A — the slices cover every scene exactly once', () => {
  for (const n of [1, 2, 35, 36, 37, 72, 81, 85, 131, 400]) {
    const s = planStateSlices(n, { maxTokens: 16000 });
    assert.equal(s.reduce((a, x) => a + (x.end - x.start + 1), 0), n, 'total for ' + n);
    assert.equal(s[0].start, 0, 'start for ' + n);
    assert.equal(s[s.length - 1].end, n - 1, 'end for ' + n);
    for (let i = 1; i < s.length; i++) assert.equal(s[i].start, s[i - 1].end + 1, 'gap/overlap at ' + i + ' for ' + n);
  }
});

test('TASK 3A — CONTROL: the arithmetic nobody did — 50 scenes never fitted 16,000', () => {
  assert.ok(50 * TOKENS_PER_SCENE_OBSERVED > 16000, '50 x 326 = 16,300 > 16,000');
  // and the old constant would have produced a slice that cannot fit
  assert.ok(50 > 36, 'CHUNK = 50 against a 36-scene budget');
});

test('TASK 3A — a denser story than the sample still fits, because of the margin', () => {
  assert.ok(36 * TOKENS_PER_SCENE_OBSERVED * 1.25 <= 16000, '36 x 326 x 1.25 = 14,670');
});

test('TASK 3A — a smaller ceiling makes smaller slices, not a wrong promise', () => {
  assert.equal(planStateSlices(81, { maxTokens: 8000 })[0].end, 17, '8,000 x 0.75 / 326 = 18 scenes');
  // never zero-width, whatever the ceiling
  assert.deepEqual(planStateSlices(3, { maxTokens: 1 }), [{ start: 0, end: 0 }, { start: 1, end: 1 }, { start: 2, end: 2 }]);
});

test('TASK 3A — nothing to slice is no slices, not one empty slice', () => {
  assert.deepEqual(planStateSlices(0, { maxTokens: 16000 }), []);
  assert.deepEqual(planStateSlices(-5, { maxTokens: 16000 }), []);
  assert.deepEqual(planStateSlices(NaN as any, { maxTokens: 16000 }), []);
});

// ── THE TRIGGER ORDER IS THE RULE ───────────────────────────────────────────────────────────

test('TASK 3A — the stop reason decides, and it decides BEFORE the parse is attempted', () => {
  const cut = { outputTokens: 16000, maxTokens: 16000, stopReason: 'max_tokens' };
  assert.equal(whyFailed(cut, '{"scenes":[{"i":1}]}'), 'CEILING',
    'valid JSON after a max_tokens stop is still a truncated answer');
  assert.equal(whyFailed({ outputTokens: 900, maxTokens: 16000, stopReason: 'end_turn' }, 'not json'), 'UNPARSEABLE');
  assert.equal(whyFailed({ outputTokens: 900, maxTokens: 16000, stopReason: 'end_turn' }, '{"scenes":[]}'), null);
  assert.equal(whyFailed(null, ''), 'UNPARSEABLE', 'no facts and no body is still a failure');
});

test('TASK 3A — CONTROL: parsing first mislabels the 2 Oct failure as a bad body', () => {
  // The real one: out=16,000 of 16,000, stop=max_tokens, and the parse threw
  // "Expected ',' or ']' after array element in JSON at position 14687".
  const real = { outputTokens: 16000, maxTokens: 16000, stopReason: 'max_tokens' };
  const parseFirst = (body: string) => { try { JSON.parse(body); return null; } catch { return 'UNPARSEABLE'; } };
  assert.equal(parseFirst('{"scenes":[{"i":1},'), 'UNPARSEABLE', 'the defect: blames the body');
  assert.equal(whyFailed(real, '{"scenes":[{"i":1},'), 'CEILING', 'the cause is the ceiling, and the provider said so');
});

test('TASK 3A — reusing stoppedAtCeiling rather than growing a second notion of cut off', () => {
  const cut = { outputTokens: 16000, maxTokens: 16000, stopReason: 'max_tokens' };
  assert.equal(stoppedAtCeiling(cut), true);
  assert.equal(whyFailed(cut, 'anything'), 'CEILING');
});

// ── THE BOUNDED RETRY ───────────────────────────────────────────────────────────────────────

test('TASK 3A — a failed slice halves AT MOST TWICE, then is reported', () => {
  const attempts = retryPlan({ start: 0, end: 35 });
  assert.equal(attempts.length, 2, 'two halvings, no further');
  assert.deepEqual(attempts[0], [{ start: 0, end: 17 }, { start: 18, end: 35 }]);
  assert.equal(attempts[1].length, 4);
  assert.equal(attempts[1].reduce((a, x) => a + (x.end - x.start + 1), 0), 36, 'a halving loses no scene');
});

test('TASK 3A — one scene cannot be halved; it is reported', () => {
  assert.deepEqual(halve({ start: 5, end: 5 }), []);
  assert.deepEqual(retryPlan({ start: 5, end: 5 }), []);
  assert.deepEqual(halve({ start: 4, end: 5 }), [{ start: 4, end: 4 }, { start: 5, end: 5 }]);
});

test('TASK 3A — CONTROL: unbounded halving would retry a 50-scene span six times', () => {
  let n = 50, rounds = 0;
  while (n > 1) { n = Math.ceil(n / 2); rounds++; }
  assert.equal(rounds, 6, 'the cost of no bound');
  assert.equal(retryPlan({ start: 0, end: 49 }).length, 2, 'the bound');
});

test('TASK 3A — a slice that fails through both halvings produces a FAILURE, never silence', () => {
  const f = ceilingFailure({ start: 0, end: 49 }, 'CEILING', 2);
  assert.equal(f.state, 'NOT_RUN');
  assert.match(f.reason, /scenes 1-50/);
  assert.match(f.reason, /cut off at its ceiling/);
  assert.match(f.reason, /after 2 halving/);
  assert.equal(f.scenesLost, 50);
});

test('TASK 3A — the failure says WHICH failure it was', () => {
  assert.match(ceilingFailure({ start: 0, end: 9 }, 'UNPARSEABLE', 2).reason, /nothing that could be parsed/);
  assert.doesNotMatch(ceilingFailure({ start: 0, end: 9 }, 'UNPARSEABLE', 2).reason, /cut off/);
});

test('TASK 3A — CONTROL: a bare continue loses 62% of the plan and says nothing', () => {
  // The 2 Oct run: scenes 1-50 of 81 came back truncated and the loop ran `continue`.
  const lost = 50 / 81;
  assert.ok(lost > 0.6, 'the span that was dropped: ' + Math.round(lost * 100) + '%');
  const f = ceilingFailure({ start: 0, end: 49 }, 'CEILING', 2);
  assert.equal(f.state, 'NOT_RUN', 'a continue leaves no row at all; this leaves one');
  assert.equal(f.scenesLost, 50);
});

test('TASK 3A — the label is 1-based, because the log line and the reader are', () => {
  assert.equal(sliceLabel({ start: 0, end: 49 }), 'scenes 1-50');
  assert.equal(sliceLabel({ start: 50, end: 80 }), 'scenes 51-81');
  assert.equal(sliceLabel({ start: 7, end: 7 }), 'scene 8');
});

// ── 3C: THE NEAR MISS ───────────────────────────────────────────────────────────────────────

test('TASK 3C — 94% of a ceiling is a near-miss: recorded, not acted on', () => {
  assert.equal(NEAR_CEILING, 0.9);
  assert.equal(nearCeiling({ outputTokens: 14097, maxTokens: 15000, stopReason: 'end_turn' }), true);  // 93.98%
  assert.equal(nearCeiling({ outputTokens: 11589, maxTokens: 15000, stopReason: 'end_turn' }), false); // 77.3%
  assert.equal(nearCeiling(null), false);
  assert.equal(nearCeiling({ outputTokens: 0, maxTokens: 0, stopReason: 'end_turn' }), false, 'no ceiling, no near-miss');
});

test('TASK 3C — CONTROL: stoppedAtCeiling alone misses it, which is why it went unnoticed', () => {
  const planCall2 = { outputTokens: 14097, maxTokens: 15000, stopReason: 'end_turn' };
  assert.equal(stoppedAtCeiling(planCall2), false, 'it did not stop at the ceiling — it stopped 903 tokens short');
  assert.equal(nearCeiling(planCall2), true);
});

test('TASK 3C — a call that DID stop at the ceiling is also near it, by definition', () => {
  assert.equal(nearCeiling({ outputTokens: 16000, maxTokens: 16000, stopReason: 'max_tokens' }), true);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLAN 01 TASK 3D — THE FAULTS IN 3A's WIRING.
//
// 3A stored a lost span and a wholesale failure, but neither said anything a reader could use:
// a 50-scene gap reached the revision as scene null, "no detail was recorded on this planState
// finding". That is worse than the log line it replaced, because it looks like a record.
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('TASK 3D — a real ceilingFailure through the real findingsEntry names the span and the cause', () => {
  const f = ceilingFailure({ start: 0, end: 49 }, 'CEILING', 2);
  const e = findingsEntry('planState', [f], 'TEXT');
  assert.equal(e.state, 'FINDINGS');
  assert.equal(e.items!.length, 1);
  const it = e.items![0];
  assert.match(it.detail, /scenes 1-50/, 'the span');
  assert.match(it.detail, /cut off at its ceiling/, 'the cause');
  assert.match(it.detail, /no knowledge or geography/, 'what was lost');
  assert.equal(it.kind, 'CEILING');
  assert.equal(it.scene, 1, 'a lost span is anchored where the gap begins');
  assert.equal(e.subject, 'plan', 'planState judges the plan, not the page');
});

test('TASK 3D — CONTROL: without detail/scenes the item says nothing at all', () => {
  const bare = { state: 'NOT_RUN', reason: 'scenes 1-50 was cut off', scenesLost: 50, slice: { start: 0, end: 49 }, kind: 'CEILING' };
  const e = findingsEntry('planState', [bare], 'TEXT');
  assert.match(e.items![0].detail, /no detail was recorded/, 'the 3A defect, reproduced');
  assert.equal(e.items![0].scene, null);
  // and the fix
  const fixed = findingsEntry('planState', [ceilingFailure({ start: 0, end: 49 }, 'CEILING', 2)], 'TEXT');
  assert.doesNotMatch(fixed.items![0].detail, /no detail was recorded/);
});

test('TASK 3D — an unparseable span says so, and a one-scene span reads as one scene', () => {
  const u = findingsEntry('planState', [ceilingFailure({ start: 10, end: 10 }, 'UNPARSEABLE', 0)], 'T');
  assert.match(u.items![0].detail, /scene 11/);
  assert.match(u.items![0].detail, /nothing that could be parsed/);
  assert.equal(u.items![0].scene, 11);
  assert.equal(u.items![0].kind, 'UNPARSEABLE');
});

// ── THE RETRY KEEPS WHAT SUCCEEDED ──────────────────────────────────────────────────────────

const rowsFor = (s: Slice) => Array.from({ length: s.end - s.start + 1 }, (_, i) => ({ n: s.start + i + 1 }));

test('TASK 3D — a half that succeeded is not re-asked', async () => {
  // the first half answers, the second does not until its quarters are asked
  const asked: string[] = [];
  const ask = async (s: Slice) => {
    asked.push(sliceLabel(s));
    if (s.start === 0 && s.end === 35) return { fail: 'CEILING' as const };   // the whole span
    if (s.start === 18 && s.end === 35) return { fail: 'CEILING' as const };  // the second half
    return { rows: rowsFor(s) };
  };
  const out = await readSpanWithRetry({ start: 0, end: 35 }, ask);
  assert.equal(out.calls, 5, 'whole + 2 halves + 2 quarters of the half that failed');
  assert.equal(out.failures.length, 0);
  assert.equal(out.rows.length, 36, 'every scene came back exactly once');
  assert.deepEqual(asked, ['scenes 1-36', 'scenes 1-18', 'scenes 19-36', 'scenes 19-27', 'scenes 28-36']);
});

test('TASK 3D — CONTROL: re-asking the whole partition costs 7 where 5 would do', async () => {
  const ask = async (s: Slice) => (
    (s.start === 0 && s.end === 35) || (s.start === 18 && s.end === 35)
      ? { fail: 'CEILING' as const } : { rows: rowsFor(s) }
  );
  const kept = await readSpanWithRetry({ start: 0, end: 35 }, ask);
  // the 3A loop: whole, then BOTH halves, then ALL FOUR quarters, discarding the good half twice
  const wholePartition = 1 + 2 + 4;
  assert.equal(kept.calls, 5);
  assert.ok(kept.calls < wholePartition, kept.calls + ' < ' + wholePartition);
});

test('TASK 3D — only the sub-span that failed is reported lost, not the whole slice', async () => {
  // halve({18,35}) splits at 26, so the second half's quarters are {18,26} and {27,35}
  const ask = async (s: Slice) => (
    (s.start === 0 && s.end === 35) || (s.start === 18 && s.end === 35) || (s.start === 27 && s.end === 35)
      ? { fail: 'CEILING' as const } : { rows: rowsFor(s) }
  );
  const out = await readSpanWithRetry({ start: 0, end: 35 }, ask);
  assert.equal(out.failures.length, 1);
  assert.equal(out.failures[0].scenesLost, 9, 'scenes 28-36 only — the other 27 were read');
  assert.match(out.failures[0].reason, /scenes 28-36/);
  assert.equal(out.rows.length, 27);
  assert.equal(out.failures[0].scenes[0], 28, 'anchored where the gap begins');
});

test('TASK 3D — CONTROL: reporting the whole slice would claim 36 lost scenes where 9 are', async () => {
  const ask = async (s: Slice) => (
    (s.start === 0 && s.end === 35) || (s.start === 18 && s.end === 35) || (s.start === 27 && s.end === 35)
      ? { fail: 'CEILING' as const } : { rows: rowsFor(s) }
  );
  const out = await readSpanWithRetry({ start: 0, end: 35 }, ask);
  const wholeSlice = ceilingFailure({ start: 0, end: 35 }, 'CEILING', 2);
  assert.equal(wholeSlice.scenesLost, 36, 'the 3A behaviour: the entire slice declared lost');
  assert.equal(out.failures.reduce((a, f) => a + f.scenesLost, 0), 9, 'what was actually lost');
});

test('TASK 3D — everything failing is bounded at two halvings and loses nothing silently', async () => {
  let calls = 0;
  const ask = async () => { calls++; return { fail: 'CEILING' as const }; };
  const out = await readSpanWithRetry({ start: 0, end: 35 }, ask);
  assert.equal(out.calls, 7, 'whole + 2 + 4, and no further');
  assert.equal(out.rows.length, 0);
  assert.equal(out.failures.reduce((a, f) => a + f.scenesLost, 0), 36, 'every lost scene is accounted for');
});

test('TASK 3D — a span of one scene is not halved; it is reported', async () => {
  const out = await readSpanWithRetry({ start: 4, end: 4 }, async () => ({ fail: 'UNPARSEABLE' as const }));
  assert.equal(out.calls, 1);
  assert.equal(out.failures.length, 1);
  assert.equal(out.failures[0].scenesLost, 1);
});

test('TASK 3D — a span that answers first time costs one call', async () => {
  const out = await readSpanWithRetry({ start: 0, end: 35 }, async (s) => ({ rows: rowsFor(s) }));
  assert.equal(out.calls, 1);
  assert.equal(out.rows.length, 36);
  assert.deepEqual(out.failures, []);
});

test('TASK 3D — extractPlanState throwing outright reaches the row as NOT_RUN, with the reason', () => {
  // Both catch fallbacks returned `failures: []`, and an empty array means "ran, found nothing".
  // So the one case where NOTHING was read recorded the strongest possible statement about the plan.
  const clean = findingsEntry('planState', [], 'TEXT');
  assert.equal(clean.state, 'CLEAN', 'an empty failure list IS clean — that part was right');

  const threw = sweepFailed('planState', new Error('Connection terminated unexpectedly'), 'TEXT');
  assert.equal(threw.state, 'NOT_RUN');
  assert.match(threw.reason, /Connection terminated unexpectedly/);
  assert.equal(threw.countsAsFinding, false);
  assert.equal(threw.subject, 'plan', 'it judges the plan, so it is fingerprinted over the plan');
});

test('TASK 3D — CONTROL: the throw path and the clean path must not produce the same state', () => {
  const asIfClean = findingsEntry('planState', [], 'TEXT');          // what 3A stored on a throw
  const honest = sweepFailed('planState', new Error('boom'), 'TEXT');
  assert.equal(asIfClean.state, 'CLEAN', 'the 3A defect');
  assert.notEqual(honest.state, asIfClean.state);
  assert.equal(honest.state, 'NOT_RUN');
});
