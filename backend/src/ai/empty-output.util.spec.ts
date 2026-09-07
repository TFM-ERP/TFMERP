import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { stoppedAtCeiling, usageSummary, explainEmptyDraft, truncationWarning, wasRefused } from './empty-output.util';

// The exact run that cost 7 Sep: SYNOPSIS, cap 2,400, claude-opus-5, DONE, zero characters.
const THE_FAILURE = {
  text: '', inputTokens: 1924, outputTokens: 2400, maxTokens: 2400,
  stopReason: 'max_tokens', sawThinking: true, model: 'claude-opus-5', provider: 'anthropic',
};
// The same stage on the same model once the ceiling was raised to 8,000.
const THE_FIX = {
  text: 'x'.repeat(4851), inputTokens: 1924, outputTokens: 4051, maxTokens: 8000,
  stopReason: 'end_turn', sawThinking: true, model: 'claude-opus-5', provider: 'anthropic',
};

test('the run that failed six times is recognised as cut off, and the one that worked is not', () => {
  assert.equal(stoppedAtCeiling(THE_FAILURE), true);
  assert.equal(stoppedAtCeiling(THE_FIX), false);
});

test('a stop reason alone is enough — the token count can be missing', () => {
  assert.equal(stoppedAtCeiling({ stopReason: 'max_tokens' }), true);
  assert.equal(stoppedAtCeiling({ stopReason: 'length' }), true, 'the OpenAI-compatible spelling counts too');
});

test('the token count alone is enough — the stop reason can be missing (it was, on every streamed call)', () => {
  assert.equal(stoppedAtCeiling({ outputTokens: 2400, maxTokens: 2400 }), true);
  assert.equal(stoppedAtCeiling({ outputTokens: 2380, maxTokens: 2400 }), true, 'a provider may stop a token or two short');
  assert.equal(stoppedAtCeiling({ outputTokens: 1200, maxTokens: 2400 }), false);
});

test('a model that says it finished is believed, even sitting on its ceiling', () => {
  // Otherwise a complete draft that happened to land near the cap gets stamped "may be incomplete",
  // and a warning that fires on healthy drafts is one nobody reads when it matters.
  assert.equal(stoppedAtCeiling({ stopReason: 'end_turn', outputTokens: 7999, maxTokens: 8000 }), false);
  assert.equal(stoppedAtCeiling({ stopReason: 'stop', outputTokens: 8000, maxTokens: 8000 }), false);
});

test('nothing measured means nothing claimed — an unknown call is not reported as truncated', () => {
  assert.equal(stoppedAtCeiling({}), false);
  assert.equal(stoppedAtCeiling({ outputTokens: 500 }), false, 'no ceiling to compare against');
});

test('THE REGRESSION: a capped, textless response never again reports an empty draft', () => {
  const msg = explainEmptyDraft('SYNOPSIS', THE_FAILURE);
  // The words that sent the operator hunting for a prompt-length or rate-limit problem that did not exist.
  assert.ok(!/rate.?limit/i.test(msg), 'must not blame rate limiting: ' + msg);
  assert.ok(!/prompt may be too long/i.test(msg), 'must not blame prompt length: ' + msg);
  assert.ok(!/empty draft/i.test(msg), 'must not call a cut-off response an empty one: ' + msg);
});

test('the message carries the numbers that identify it: ceiling, spend, input, model', () => {
  const msg = explainEmptyDraft('SYNOPSIS', THE_FAILURE);
  assert.match(msg, /SYNOPSIS/);
  assert.match(msg, /2,400-token ceiling/, 'the ceiling that was hit');
  assert.match(msg, /output 2,400\/2,400 tokens/, 'what it spent against what it was allowed');
  assert.match(msg, /input 1,924 tokens/, 'the prompt size, so "too long" can be ruled out on sight');
  assert.match(msg, /claude-opus-5 via anthropic/, 'which model and provider');
  assert.match(msg, /stop reason "max_tokens"/);
});

test('it names the actual cause — reasoning billed against the same ceiling — and the actual fix', () => {
  const msg = explainEmptyDraft('SYNOPSIS', THE_FAILURE);
  assert.match(msg, /internal reasoning/i);
  assert.match(msg, /Raise this stage's ceiling/i);
  assert.match(msg, /provider reported success/i, 'the reason nothing surfaced upstream');
});

test('a capped response with no thinking block is explained without inventing one', () => {
  const msg = explainEmptyDraft('COVERAGE', { ...THE_FAILURE, sawThinking: false, maxTokens: 2000, outputTokens: 2000 });
  assert.ok(!/reasoning/i.test(msg), 'do not claim reasoning we did not observe: ' + msg);
  assert.match(msg, /consumed before any text was emitted/);
});

test('cut off mid-prose is a different message from cut off before prose', () => {
  const msg = explainEmptyDraft('TREATMENT', { ...THE_FAILURE, text: 'x'.repeat(3515) });
  assert.match(msg, /mid-way/);
  assert.match(msg, /3,515 characters/);
});

test('a model that stopped on its own having written nothing is told apart from one that was cut off', () => {
  const msg = explainEmptyDraft('PREMISE', { text: '', inputTokens: 900, outputTokens: 0, maxTokens: 8000, stopReason: 'end_turn' });
  assert.match(msg, /stopped on its own/);
  assert.match(msg, /retrying is worth one attempt/, 'this is the only branch where a retry is the advice');
  assert.ok(!/Raise this stage's ceiling/i.test(msg), 'the ceiling was not the problem here: ' + msg);
});

test('text that arrived but could not be read as a draft says exactly that', () => {
  const msg = explainEmptyDraft('THESIS', { text: '<<<garbage>>>', outputTokens: 120, maxTokens: 8000, stopReason: 'end_turn' });
  assert.match(msg, /none of it could be read as a draft/);
  assert.match(msg, /13 characters/);
});

test('every branch returns a sentence — a stage that cannot explain itself is the original bug', () => {
  for (const facts of [THE_FAILURE, {}, { text: '' }, { text: 'abc' }, { outputTokens: 5, maxTokens: 5 }]) {
    const msg = explainEmptyDraft('LOGLINE', facts as any);
    assert.equal(typeof msg, 'string');
    assert.ok(msg.length > 40, 'refused to explain: ' + JSON.stringify(facts));
  }
});

test('a refusal is not a ceiling problem, and is not answered with "try again"', () => {
  const f = { text: '', inputTokens: 900, outputTokens: 12, maxTokens: 8000, stopReason: 'refusal', model: 'claude-opus-5' };
  assert.equal(wasRefused(f), true);
  assert.equal(stoppedAtCeiling(f), false, 'a refusal did not run out of room');
  const msg = explainEmptyDraft('SYNOPSIS', f);
  assert.match(msg, /DECLINED/);
  assert.match(msg, /declined again/, 'the operator must know an identical retry is pointless');
  assert.ok(!/retrying is worth one attempt/i.test(msg), 'the one piece of advice that cannot work here: ' + msg);
  assert.ok(!/Raise this stage's ceiling/i.test(msg), 'the ceiling was not the problem: ' + msg);
});

test('junk in, a sentence out — the failure path must not fail', () => {
  // A diagnostic that throws while explaining a failure replaces a bad message with no message.
  for (const bad of [undefined, null, {}, { text: null }, { outputTokens: NaN, maxTokens: NaN }]) {
    assert.doesNotThrow(() => explainEmptyDraft('SYNOPSIS', bad as any));
    assert.ok(explainEmptyDraft('SYNOPSIS', bad as any).length > 40);
  }
  for (const bad of [undefined, null, {}]) {
    assert.doesNotThrow(() => stoppedAtCeiling(bad as any));
    assert.doesNotThrow(() => usageSummary(bad as any));
    assert.doesNotThrow(() => wasRefused(bad as any));
  }
  assert.match(explainEmptyDraft('' as any, undefined), /this stage/, 'a missing label still reads as English');
  assert.ok(!/NaN|undefined|null/.test(explainEmptyDraft('SYNOPSIS', { outputTokens: NaN } as any)));
});

test('unknown numbers print as ? rather than as NaN or a wrong figure', () => {
  const s = usageSummary({});
  assert.match(s, /input \? tokens/);
  assert.match(s, /output \?\/\? tokens/);
  assert.ok(!/NaN|undefined/.test(s), s);
});

test('a salvaged partial carries a warning that says it may be incomplete, with the numbers', () => {
  const w = truncationWarning('TREATMENT', THE_FAILURE);
  assert.match(w, /may be incomplete/);
  assert.match(w, /2,400-token ceiling/);
  assert.match(w, /Re-run/);
});
