/**
 * F5 — the truncation predicate's inputs are recorded on EVERY array-stage run, for BOTH calls.
 *
 * They were persisted only inside `if (ext.warning)`, so the stage row carried them exactly when a
 * continuation fired and discarded them exactly when one did not. "Did not" is the branch the
 * stop-reason rule exists for: a SCENES run that finished at 24,494 of 25,000 (98.0%) with
 * `end_turn` and made zero continuations is the first live evidence that the rule changes an
 * outcome, and the stage row it produced recorded none of the three numbers behind that.
 *
 * THE SECOND DEFECT, found on the first real row this field produced: the seed from the first call
 * was OVERWRITTEN by the continuation's numbers, so a run with passes >= 1 described only its tail.
 * v4 read "end_turn, 93.3%, comfortable" for a stage that had continued — meaning its FIRST call
 * returned max_tokens or unparsable JSON, the fact that made it continue, and the one fact the row
 * did not carry. Both calls are kept now.
 *
 * Bookkeeping rather than a hole — AiRun's finish() writes per-call numbers either way — so what
 * this buys is that the evidence sits on the row a reader is already looking at.
 *
 * These tests pin the SHAPE. The live half is re-reading a real stage row and finding it there.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { truncationFlag } from './stage-truncation.util';

/** Exactly what the service assembles: seed from the first call, tail from ext, never replacing. */
const ceilingOf = (res: any, ext: any, cap: number) => {
  const first = { stopReason: res?.stopReason ?? null, outputTokens: res?.usage?.output_tokens ?? null };
  if (!ext) return { first, last: first, maxTokens: cap, passes: 0 };
  return { first, last: { stopReason: ext.last?.stopReason ?? null, outputTokens: ext.last?.outputTokens ?? null }, maxTokens: cap, passes: ext.passes ?? 0 };
};

test('a CLEAN run records both calls, identical — the case that used to record nothing', () => {
  // The 17 Sep SCENES run: 98.0% of the ceiling, end_turn, no continuation.
  const res: any = { stopReason: 'end_turn', usage: { output_tokens: 24494 } };
  const c: any = ceilingOf(res, { passes: 0, last: { stopReason: 'end_turn', outputTokens: 24494 } }, 25000);
  assert.deepEqual(c.first, { stopReason: 'end_turn', outputTokens: 24494 });
  assert.deepEqual(c.last, c.first, 'at passes 0 the two calls are the same call');
  assert.equal(c.passes, 0);
  assert.ok(c.first.outputTokens / c.maxTokens > 0.9, 'above the proportion the old rule used — the discriminating case');
  assert.equal(c.first.stopReason === 'max_tokens', false, 'the provider did not report a ceiling stop');
});

test('passes >= 1: BOTH calls are present and DIFFERENT — the tail must not stand for the stage', () => {
  // The defect this replaces: the row described only the continuation, so the reason the stage
  // continued at all was absent. `first` is what made the predicate return true.
  const res: any = { stopReason: 'max_tokens', usage: { output_tokens: 25000 } };
  const ext: any = { passes: 1, warning: '', last: { stopReason: 'end_turn', outputTokens: 23313 } };
  const c: any = ceilingOf(res, ext, 25000);
  assert.deepEqual(c.first, { stopReason: 'max_tokens', outputTokens: 25000 }, 'the first call was overwritten by the tail');
  assert.deepEqual(c.last, { stopReason: 'end_turn', outputTokens: 23313 });
  assert.notDeepEqual(c.first, c.last, 'a continued run whose two calls read identically has lost one of them');
  assert.equal(c.passes, 1);
  // And the row alone now answers "why did this continue?" without joining to AiRun.
  assert.equal(c.first.stopReason, 'max_tokens');
});

test('a ZERO-ITEM stage still records its ceiling — the outcome that most needs it', () => {
  // extendStageArray is guarded on having at least one parsed item, so a stage that produced
  // nothing never reaches it. That is exactly when "did it hit the wall?" is the first question.
  const res: any = { stopReason: 'max_tokens', usage: { output_tokens: 25000 } };
  const c: any = ceilingOf(res, null, 25000);
  assert.deepEqual(c, { first: { stopReason: 'max_tokens', outputTokens: 25000 }, last: { stopReason: 'max_tokens', outputTokens: 25000 }, maxTokens: 25000, passes: 0 });
});

test('a provider that reports no stop reason yields nulls rather than absence', () => {
  // An absent `ceiling` key and a `ceiling` of nulls are different facts: the first says nobody
  // looked, the second says the provider did not say.
  const c: any = ceilingOf({}, null, 25000);
  assert.deepEqual(c.first, { stopReason: null, outputTokens: null });
  assert.equal(c.maxTokens, 25000);
});

test('the recorded numbers feed truncationFlag unchanged — it is a record, not a verdict', () => {
  // The verdict lives in extendStageArray's predicate and is tested where that predicate lives;
  // re-deriving it here would be a second implementation of the rule under test.
  const flag = truncationFlag({ stopReason: 'end_turn', outputTokens: 24494, maxTokens: 25000 }, { items: 40, passes: 0 });
  assert.deepEqual({ stopReason: flag.stopReason, outputTokens: flag.outputTokens, maxTokens: flag.maxTokens },
    { stopReason: 'end_turn', outputTokens: 24494, maxTokens: 25000 });
});
