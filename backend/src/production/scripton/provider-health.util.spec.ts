import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  isProviderExhausted, isStubRunaway, isHalt,
  ScriptGenerationHalted, STUB_STREAK_ABORT,
  TERMINAL_REASONS, RETRYABLE_REASONS,
} from './provider-health.util';

// The two sentences that ended the 1 Sep run, copied out of the backend log verbatim (truncated at
// the same 220 characters ai.service.ts slices the provider body to). If these ever stop being
// recognised, twenty-one scenes get manufactured again.
const REAL_GEMINI_THEN_ANTHROPIC =
  'No AI provider could complete the request. Tried — GEMINI (out of credit/quota — gemini-2.5-flash: '
  + '[{ "error": { "code": 429, "message": "You exceeded your current quota, please check your plan and billing details. '
  + 'For more information on this error, head to: https://ai.google.dev/gemini-api/docs/ra); '
  + 'ANTHROPIC (out of credit/quota — claude-opus-5: {"type":"error","error":{"type":"invalid_request_error",'
  + '"message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade '
  + 'or purchase credits."},"request_id).';

const REAL_ANTHROPIC_ONLY =
  'No AI provider could complete the request. Tried — ANTHROPIC (out of credit/quota — claude-opus-5: '
  + '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access '
  + 'the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id).';

const REAL_TIMEOUT =
  'No AI provider could complete the request. Tried — ANTHROPIC (timed out — claude-sonnet-4-6).';

// ── terminal: retrying cannot change the answer ─────────────────────────────────────────────

test('the 1 Sep chain — Gemini quota then Anthropic credit — is terminal', () => {
  assert.equal(isProviderExhausted(new Error(REAL_GEMINI_THEN_ANTHROPIC)), true);
});

test('a single out-of-credit provider is terminal when it is the only one tried', () => {
  assert.equal(isProviderExhausted(new Error(REAL_ANTHROPIC_ONLY)), true);
});

test('a bad key is terminal — the next request carries the same key', () => {
  assert.equal(isProviderExhausted(new Error(
    'No AI provider could complete the request. Tried — OPENAI (bad or missing key — gpt-4o: 401 Unauthorized).')), true);
});

test('no provider configured at all is terminal', () => {
  assert.equal(isProviderExhausted(new Error(
    'AI is not configured. Add a provider key (e.g. ANTHROPIC_API_KEY) or a Local server URL '
    + '(LOCAL_LLM_SERVER_URL) in the backend .env, then enable it in Engines & Routing.')), true);
});

test('providers listed as not enabled do not soften a terminal chain', () => {
  assert.equal(isProviderExhausted(new Error(
    'No AI provider could complete the request. Tried — ANTHROPIC (out of credit/quota — claude-opus-5: empty balance). '
    + 'Not enabled (add a key in Engines & Routing, or a server URL for Local): OPENAI, GEMINI, LOCAL.')), true);
});

test('every terminal reason the router can print is recognised', () => {
  for (const reason of TERMINAL_REASONS) {
    assert.equal(
      isProviderExhausted(new Error('No AI provider could complete the request. Tried — X (' + reason + ' — m: d).')),
      true, reason);
  }
});

// ── transient: a retry is a real bet, so never abort ────────────────────────────────────────

test('a timeout is not terminal', () => {
  assert.equal(isProviderExhausted(new Error(REAL_TIMEOUT)), false);
});

test('every retryable reason the router can print stays retryable', () => {
  for (const reason of RETRYABLE_REASONS) {
    assert.equal(
      isProviderExhausted(new Error('No AI provider could complete the request. Tried — X (' + reason + ' — m: d).')),
      false, reason);
  }
});

test('ONE survivable provider in the chain keeps the whole chain retryable', () => {
  // Anthropic's wallet is empty, but Gemini merely timed out — Gemini may answer the next scene.
  assert.equal(isProviderExhausted(new Error(
    'No AI provider could complete the request. Tried — ANTHROPIC (out of credit/quota — claude-opus-5: empty); '
    + 'GEMINI (timed out — gemini-2.5-flash).')), false);
});

test('a sweep cut short by the time budget is never terminal — providers went untried', () => {
  assert.equal(isProviderExhausted(new Error(
    'No AI provider could complete the request. Tried — ANTHROPIC (out of credit/quota — claude-opus-5: empty); '
    + '(stopped after 412s — overall time budget reached).')), false);
});

test('a provider body that merely QUOTES the phrase does not make the chain terminal', () => {
  // The reason is matched only in its own slot — "(<reason> — " — never anywhere in the raw body.
  assert.equal(isProviderExhausted(new Error(
    'No AI provider could complete the request. Tried — LOCAL (provider error — llama3: '
    + '500 {"hint":"looks like you are out of credit/quota upstream"}).')), false);
});

// ── everything that is not a routing failure ────────────────────────────────────────────────

test('unrelated errors, and nothing at all, are not terminal', () => {
  assert.equal(isProviderExhausted(new Error('read ECONNRESET')), false);
  assert.equal(isProviderExhausted(new Error('')), false);
  assert.equal(isProviderExhausted(null), false);
  assert.equal(isProviderExhausted(undefined), false);
  assert.equal(isProviderExhausted({}), false);
  assert.equal(isProviderExhausted('No AI provider could complete the request.'), false);
});

test('a Nest-shaped { response: { message } } is read', () => {
  assert.equal(isProviderExhausted({ response: { message: REAL_ANTHROPIC_ONLY } }), true);
});

// ── the streak guard ────────────────────────────────────────────────────────────────────────

test('isolated stubs never trip the runaway guard', () => {
  // 1 Sep: scenes 53 and 108 stubbed with healthy scenes either side. The longest streak was one.
  assert.equal(isStubRunaway(0), false);
  assert.equal(isStubRunaway(1), false);
  assert.equal(isStubRunaway(STUB_STREAK_ABORT - 1), false);
});

test('the guard trips at the threshold and stays tripped', () => {
  assert.equal(isStubRunaway(STUB_STREAK_ABORT), true);
  assert.equal(isStubRunaway(21), true);   // the real streak, scenes 118 and 121-139
});

test('the threshold is far below the run that got through — 15% of 139 passed the old ratio gate', () => {
  assert.ok(STUB_STREAK_ABORT < 21);
  assert.ok(21 / 139 < 0.5, 'the whole-run ratio gate could not see the dead third act');
});

// ── the halt signal ─────────────────────────────────────────────────────────────────────────

test('a halt is recognisable without instanceof, and carries its kind', () => {
  const h = new ScriptGenerationHalted('PROVIDER_EXHAUSTED', 'credit balance is too low');
  assert.equal(isHalt(h), true);
  assert.equal(h.kind, 'PROVIDER_EXHAUSTED');
  assert.equal(h.message, 'credit balance is too low');
  assert.ok(h instanceof Error, 'must still unwind like an Error');
});

test('an ordinary error is not a halt — the loops must rethrow it', () => {
  assert.equal(isHalt(new Error('boom')), false);
  assert.equal(isHalt(null), false);
  assert.equal(isHalt({ halted: false }), false);
});
