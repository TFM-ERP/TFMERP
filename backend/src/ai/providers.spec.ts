import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  redactSecrets, isValidEngineKey,
  isTemperatureRejection, rejectsTemperature, noteTemperatureRejected, resetTemperatureMemory,
  callProvider, ProviderError,
  reduceAnthropicEvents, reduceOpenAiChunks,
  isEffortRejection, rejectsEffort, noteEffortRejected, resetEffortMemory,
  anthropicUsage,
} from './providers';

// A synthetic key of the exact shape that leaked. Never put a real one in a test.
const FAKE = 'SK-ANT-API03-AA4PBGKSUASFR6LUYRUJXEVXKH_BKJERIW1O_UYKQZRWWA1BNVOUGW2WFQ15ZGNLS';

test('the 1 Sep failure message no longer carries the key', () => {
  const real = 'No AI provider could complete the request. Tried — ANTHROPIC (timed out — claude-sonnet-4-6).'
    + ' Not enabled (add a key in Engines & Routing, or a server URL for Local): GEMINI, DEEPSEEK,'
    + ' OPENROUTER, LOCAL, ANTHROPIC_API_KEY=' + FAKE;
  const out = redactSecrets(real);
  assert.equal(out.indexOf(FAKE), -1, 'the key must not survive');
  assert.equal(out.indexOf('BKJERIW1O'), -1, 'no fragment of it either');
  // the name survives, because "which credential" is the actionable half of the message
  assert.match(out, /ANTHROPIC_API_KEY=\[redacted\]/);
  // and everything else is untouched
  assert.match(out, /Tried — ANTHROPIC \(timed out — claude-sonnet-4-6\)/);
  assert.match(out, /GEMINI, DEEPSEEK, OPENROUTER, LOCAL/);
});

test('a bare key is masked in either case — createEngine upper-cases what it stores', () => {
  assert.equal(redactSecrets('token ' + FAKE).indexOf('AA4PBG'), -1);
  assert.equal(redactSecrets('token ' + FAKE.toLowerCase()).indexOf('aa4pbg'), -1);
  assert.match(redactSecrets(FAKE), /^\[redacted\]$/);
});

test('other providers are covered', () => {
  assert.match(redactSecrets('AIzaSyD-1234567890abcdefghijklmnopqrstu'), /\[redacted\]/);
  assert.match(redactSecrets('ghp_1234567890abcdefghijklmnopqrstuvwx'), /\[redacted\]/);
  assert.match(redactSecrets('xoxb-1234567890-abcdefghij'), /\[redacted\]/);
  assert.match(redactSecrets('Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345'), /\[redacted\]/);
});

test('an assignment is masked even when the value matches no known prefix', () => {
  assert.equal(redactSecrets('DEEPSEEK_API_KEY=hunter2hunter2hunter2'), 'DEEPSEEK_API_KEY=[redacted]');
  assert.equal(redactSecrets('DB_PASSWORD: "p@ss w0rd"'), 'DB_PASSWORD=[redacted]');
  assert.equal(redactSecrets('SOME_TOKEN = abc123'), 'SOME_TOKEN=[redacted]');
});

test('it does NOT mask the things an error needs to stay useful', () => {
  const msg = 'Tried — ANTHROPIC (timed out — claude-sonnet-4-6); LOCAL (network — llama3.1).';
  assert.equal(redactSecrets(msg), msg, 'model names, provider names and prose survive intact');
  assert.equal(redactSecrets('gemini-2.5-flash'), 'gemini-2.5-flash');
  assert.equal(redactSecrets('deepseek/deepseek-r1:free'), 'deepseek/deepseek-r1:free');
  assert.equal(redactSecrets('http://127.0.0.1:11434/v1'), 'http://127.0.0.1:11434/v1');
  assert.equal(redactSecrets('run cmqocmg0g00002jvk3v9666sw failed'), 'run cmqocmg0g00002jvk3v9666sw failed');
});

test('it never throws on the error path it exists to serve', () => {
  assert.equal(redactSecrets(null), '');
  assert.equal(redactSecrets(undefined), '');
  assert.equal(redactSecrets(0), '0');
  assert.equal(redactSecrets({}), '[object Object]');
});

test('an engine key is an identifier, not a credential', () => {
  assert.equal(isValidEngineKey('ANTHROPIC'), true);
  assert.equal(isValidEngineKey('anthropic'), true, 'the caller upper-cases; so does the check');
  assert.equal(isValidEngineKey('MY-ENGINE_2'), true);
  assert.equal(isValidEngineKey('ANTHROPIC_API_KEY=' + FAKE), false, 'the row that leaked the key');
  assert.equal(isValidEngineKey(FAKE), false, 'too long, and it is a secret');
  assert.equal(isValidEngineKey('A'), false);
  assert.equal(isValidEngineKey(''), false);
  assert.equal(isValidEngineKey(null), false);
  assert.equal(isValidEngineKey('HAS SPACE'), false);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// TEMPERATURE ADAPTATION
// The 1 Sep Jason Quick rewrite planned 80 scenes and wrote none of them: 240 identical 400s in
// 117 seconds, because the writer sends temperature 0.85 and the configured model no longer takes
// one. These tests are built around that exact response body.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_400 = '{"type":"error","error":{"type":"invalid_request_error",'
  + '"message":"`temperature` is deprecated for this model."},"request_id":"req_011CecgZi"}';

const err = (kind: any, message: string, status?: number) =>
  new ProviderError('anthropic', kind, message, status);

test('the exact 400 that killed all 80 scenes is recognised', () => {
  assert.equal(isTemperatureRejection(err('BAD_REQUEST', ANTHROPIC_400, 400)), true);
});

test('the OpenAI-compatible phrasings are recognised too', () => {
  assert.equal(isTemperatureRejection(err('BAD_REQUEST',
    "Unsupported value: 'temperature' does not support 0.85 with this model. Only the default (1) is supported.", 400)), true);
  assert.equal(isTemperatureRejection(err('BAD_REQUEST',
    'temperature is not supported with this model', 400)), true);
  assert.equal(isTemperatureRejection(err('BAD_REQUEST',
    '`temperature` is no longer accepted.', 400)), true);
});

test('it does NOT fire on a different bad request — a retry with a changed body would hide it', () => {
  assert.equal(isTemperatureRejection(err('BAD_REQUEST', 'max_tokens: 200000 > 64000, the maximum', 400)), false);
  assert.equal(isTemperatureRejection(err('BAD_REQUEST', 'messages: at least one message is required', 400)), false);
  assert.equal(isTemperatureRejection(err('BAD_REQUEST',
    'temperature must be between 0 and 1', 400)), false, 'a bad VALUE is the caller\'s bug, not the parameter being refused');
});

test('only a 400 counts — a timeout or an outage that happens to say the word does not', () => {
  assert.equal(isTemperatureRejection(err('TIMEOUT', '`temperature` is deprecated for this model.')), false);
  assert.equal(isTemperatureRejection(err('SERVER', 'temperature is not supported', 503)), false);
  assert.equal(isTemperatureRejection(err('AUTH', ANTHROPIC_400, 401)), false);
  assert.equal(isTemperatureRejection(null), false);
  assert.equal(isTemperatureRejection({}), false);
  assert.equal(isTemperatureRejection(new Error(ANTHROPIC_400)), false, 'a plain Error carries no kind');
});

test('what the model told us is remembered per model, so scene two costs nothing extra', () => {
  resetTemperatureMemory();
  assert.equal(rejectsTemperature('anthropic', 'claude-opus-4-8'), false, 'nothing is assumed up front');
  noteTemperatureRejected('anthropic', 'claude-opus-4-8');
  assert.equal(rejectsTemperature('anthropic', 'claude-opus-4-8'), true);
  // Scoped to the model that actually refused — one model's contract is not another's.
  assert.equal(rejectsTemperature('anthropic', 'claude-sonnet-4-6'), false);
  assert.equal(rejectsTemperature('openrouter', 'claude-opus-4-8'), false, 'and not to another provider serving the same id');
  resetTemperatureMemory();
  assert.equal(rejectsTemperature('anthropic', 'claude-opus-4-8'), false, 'a config change starts from a clean slate');
});

// ── and the behaviour that actually matters: the call recovers by itself ─────────────────────

/** Stand in for the network. Records every request body; answers from a queued list of responses. */
function stubFetch(responses: Array<{ ok: boolean; status: number; body: any }>) {
  const sent: any[] = [];
  const original = (globalThis as any).fetch;
  let i = 0;
  (globalThis as any).fetch = async (_url: string, init: any) => {
    sent.push(JSON.parse(init.body));
    const r = responses[Math.min(i++, responses.length - 1)];
    return {
      ok: r.ok,
      status: r.status,
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
      body: null, // forces the non-streaming path
    } as any;
  };
  return { sent, restore: () => { (globalThis as any).fetch = original; } };
}

const REFUSAL = { ok: false, status: 400, body: JSON.parse(ANTHROPIC_400) };
const PROSE = { ok: true, status: 200, body: { content: [{ type: 'text', text: 'The trawler lists. NORA grabs the rail.' }], usage: { input_tokens: 10, output_tokens: 9 } } };

test('a scene that would have stubbed now writes itself — the retry drops temperature and succeeds', async () => {
  resetTemperatureMemory();
  const net = stubFetch([REFUSAL, PROSE]);
  try {
    const r = await callProvider({ provider: 'anthropic', model: 'claude-opus-4-8', apiKey: 'x', user: 'write scene 1', temperature: 0.85, maxTokens: 1200 });
    assert.equal(r.text, 'The trawler lists. NORA grabs the rail.', 'the scene comes back as prose, not a stub');
    assert.equal(net.sent.length, 2, 'exactly one retry — never a loop');
    assert.equal(net.sent[0].temperature, 0.85, 'the first attempt asks for the writer\'s temperature');
    assert.equal('temperature' in net.sent[1], false, 'the retry omits the parameter entirely, not sends null');
    assert.equal(net.sent[1].max_tokens, 1200, 'and changes nothing else about the request');
    assert.equal(net.sent[1].messages[0].content, 'write scene 1');
  } finally { net.restore(); }
});

test('scene two costs nothing extra — the model is only asked once', async () => {
  resetTemperatureMemory();
  const first = stubFetch([REFUSAL, PROSE]);
  try { await callProvider({ provider: 'anthropic', model: 'claude-opus-4-8', apiKey: 'x', user: 'scene 1', temperature: 0.85 }); }
  finally { first.restore(); }

  const second = stubFetch([PROSE]);
  try {
    await callProvider({ provider: 'anthropic', model: 'claude-opus-4-8', apiKey: 'x', user: 'scene 2', temperature: 0.85 });
    assert.equal(second.sent.length, 1, 'no wasted 400 on every one of the remaining 79 scenes');
    assert.equal('temperature' in second.sent[0], false);
  } finally { second.restore(); }
});

test('a real bad request is still a real bad request — it is not retried, and it is not swallowed', async () => {
  resetTemperatureMemory();
  const net = stubFetch([{ ok: false, status: 400, body: { error: { message: 'max_tokens: 200000 > 64000' } } }, PROSE]);
  try {
    await assert.rejects(
      () => callProvider({ provider: 'anthropic', model: 'claude-opus-4-8', apiKey: 'x', user: 'scene 1', temperature: 0.85 }),
      (e: any) => e.kind === 'BAD_REQUEST' && /max_tokens/.test(String(e.message)),
    );
    assert.equal(net.sent.length, 1, 'one request, one error — the caller sees the truth');
  } finally { net.restore(); }
});

test('a call that never asked for a temperature is untouched by any of this', async () => {
  resetTemperatureMemory();
  const net = stubFetch([PROSE]);
  try {
    await callProvider({ provider: 'anthropic', model: 'claude-opus-4-8', apiKey: 'x', user: 'plan the scenes' });
    assert.equal(net.sent.length, 1);
    assert.equal('temperature' in net.sent[0], false, 'the planner never sent one, and still does not');
  } finally { net.restore(); }
});

test('the OpenAI-compatible providers adapt the same way', async () => {
  resetTemperatureMemory();
  const openaiRefusal = { ok: false, status: 400, body: { error: { message: "Unsupported value: 'temperature' does not support 0.6 with this model." } } };
  const openaiProse = { ok: true, status: 200, body: { choices: [{ message: { content: 'INT. COURTHOUSE - DAY' } }], usage: { prompt_tokens: 5, completion_tokens: 4 } } };
  const net = stubFetch([openaiRefusal, openaiProse]);
  try {
    const r = await callProvider({ provider: 'openrouter', model: 'some/reasoning-model', apiKey: 'x', user: 'repair the scene', temperature: 0.6 });
    assert.equal(r.text, 'INT. COURTHOUSE - DAY');
    assert.equal(net.sent.length, 2);
    assert.equal(net.sent[0].temperature, 0.6);
    assert.equal('temperature' in net.sent[1], false);
  } finally { net.restore(); }
});

// ── Gemini's thinking budget ─────────────────────────────────────────────────────────────────
// Rerouted to gemini-2.5-flash on 1 Sep, every scene came back at 3-19% of its word ask: the
// model reasons before answering and charges that reasoning to the same max_tokens the prose
// needs. Turning it off hands the whole allowance back to the page.

test('Gemini is told not to spend the scene budget on thinking', async () => {
  const net = stubFetch([{ ok: true, status: 200, body: { choices: [{ message: { content: 'INT. HARBOR SHACK - DAY' } }], usage: {} } }]);
  try {
    await callProvider({ provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'x', user: 'write the scene', maxTokens: 1133 });
    assert.equal(net.sent[0].reasoning_effort, 'none');
    assert.equal(net.sent[0].max_tokens, 1133, 'and the whole budget still goes to the request');
  } finally { net.restore(); }
});

test('no other provider is sent the parameter', async () => {
  for (const provider of ['deepseek', 'openrouter', 'local'] as const) {
    const net = stubFetch([{ ok: true, status: 200, body: { choices: [{ message: { content: 'ok' } }], usage: {} } }]);
    try {
      await callProvider({ provider, model: 'm', apiKey: 'x', baseUrl: 'https://example.invalid', user: 'u' });
      assert.equal('reasoning_effort' in net.sent[0], false, provider + ' must not receive it');
    } finally { net.restore(); }
  }
  const anth = stubFetch([PROSE]);
  try {
    await callProvider({ provider: 'anthropic', model: 'claude-opus-4-8', apiKey: 'x', user: 'u' });
    assert.equal('reasoning_effort' in anth.sent[0], false);
  } finally { anth.restore(); }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE STREAM THAT FOLDS TO NOTHING
//
// claude-opus-5 reasons by default, that reasoning is billed against the same max_tokens as the
// prose, and with the default display its thinking blocks carry no text. Spend the whole ceiling
// thinking and the stream contains real events, a real token count, and not one character of
// answer. The reducer must fold that to empty text AND report why — reporting only the emptiness
// is what made six SYNOPSIS runs look like an unexplained "empty draft".

test('a thinking-only stream folds to empty text and says it was cut off at the ceiling', () => {
  const folded = reduceAnthropicEvents([
    { type: 'message_start', message: { usage: { input_tokens: 1924, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: '' } },
    { type: 'message_delta', delta: { stop_reason: 'max_tokens' }, usage: { output_tokens: 2400 } },
  ]);
  assert.equal(folded.text, '', 'thinking is not the answer and must never be folded into the prose');
  assert.equal(folded.stopReason, 'max_tokens', 'without this the caller cannot tell empty from cut off');
  assert.equal(folded.sawThinking, true, 'this is what turns "returned nothing" into "spent it all reasoning"');
  assert.equal(folded.usage.output_tokens, 2400);
  assert.equal(folded.usage.input_tokens, 1924);
});

test('the stop reason survives a message_delta that carries no usage', () => {
  // The old reducer read stop_reason only inside `if (e.usage)`, so this event was skipped whole.
  const folded = reduceAnthropicEvents([
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'half a synopsis' } },
    { type: 'message_delta', delta: { stop_reason: 'max_tokens' } },
  ]);
  assert.equal(folded.stopReason, 'max_tokens');
  assert.equal(folded.text, 'half a synopsis');
});

test('a normal completed stream is unchanged — text folded, end_turn reported, no thinking claimed', () => {
  const folded = reduceAnthropicEvents([
    { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'A synopsis. ' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'It ends.' } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 42 } },
  ]);
  assert.equal(folded.text, 'A synopsis. It ends.');
  assert.equal(folded.stopReason, 'end_turn');
  assert.equal(folded.sawThinking, false);
});

test('the OpenAI-compatible reducer reports "length" — that family spells max_tokens differently', () => {
  const folded = reduceOpenAiChunks([
    { choices: [{ delta: { content: 'cut' } }] },
    { choices: [{ delta: {}, finish_reason: 'length' }], usage: { prompt_tokens: 5, completion_tokens: 300 } },
  ]);
  assert.equal(folded.text, 'cut');
  assert.equal(folded.stopReason, 'length');
  assert.equal(folded.usage.output_tokens, 300);
});

test('junk in the event list still cannot throw — this runs on the failure path', () => {
  const folded = reduceAnthropicEvents([null, 'nonsense', 42, {}, { type: 'message_delta' }] as any);
  assert.equal(folded.text, '');
  assert.equal(folded.stopReason, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// EFFORT
//
// output_config.effort is the only thing that bounds reasoning: max_tokens is a ceiling the model
// is not aware of. A stage that spends its whole ceiling thinking returns NO text - 79 runs did
// exactly that here. These pin the plumbing and, more importantly, the adaptation: the field is
// GA on 4.6-and-later models and rejected outright by the 4.5-era ones, so the call must survive
// meeting one without a hard-coded model list.

const EFFORT_400 = { ok: false, status: 400, body: { error: { message: 'output_config: Extra inputs are not permitted' } } };

test('effort is sent as a top-level output_config field, not a header and not nested in the message', () => {
  resetEffortMemory();
  const net = stubFetch([PROSE]);
  return callProvider({ provider: 'anthropic', model: 'claude-opus-5', apiKey: 'x', user: 'write', effort: 'medium' })
    .then(() => {
      assert.deepEqual(net.sent[0].output_config, { effort: 'medium' });
      assert.equal('effort' in net.sent[0], false, 'it is not a top-level `effort`');
    })
    .finally(() => net.restore());
});

test('a model that refuses the field is retried once without it, and remembered', async () => {
  resetEffortMemory();
  const net = stubFetch([EFFORT_400, PROSE]);
  try {
    const r = await callProvider({ provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'x', user: 'write', effort: 'low' });
    assert.equal(r.text, 'The trawler lists. NORA grabs the rail.', 'the call still returns prose');
    assert.equal(net.sent.length, 2, 'exactly one retry - never a loop');
    assert.equal('output_config' in net.sent[1], false, 'the retry omits the field entirely');
    assert.equal(net.sent[1].messages[0].content, 'write', 'and changes nothing else');
    assert.equal(rejectsEffort('anthropic', 'claude-haiku-4-5'), true, 'remembered for the rest of the process');
  } finally { net.restore(); }

  const second = stubFetch([PROSE]);
  try {
    await callProvider({ provider: 'anthropic', model: 'claude-haiku-4-5', apiKey: 'x', user: 'again', effort: 'low' });
    assert.equal(second.sent.length, 1, 'the second call does not re-buy the 400');
    assert.equal('output_config' in second.sent[0], false);
  } finally { second.restore(); }
});

test('temperature and effort adapt independently - a model refusing both still converges', async () => {
  resetEffortMemory(); resetTemperatureMemory();
  const net = stubFetch([EFFORT_400, REFUSAL, PROSE]);
  try {
    const r = await callProvider({ provider: 'anthropic', model: 'claude-opus-4-8', apiKey: 'x', user: 'write', temperature: 0.85, effort: 'medium' });
    assert.equal(r.text, 'The trawler lists. NORA grabs the rail.');
    assert.equal(net.sent.length, 3, 'at most one extra request per refused parameter');
    assert.equal('output_config' in net.sent[2], false);
    assert.equal('temperature' in net.sent[2], false);
  } finally { net.restore(); }
});

test('a real bad request is not resent with a mutated body just because effort was in it', async () => {
  resetEffortMemory();
  const net = stubFetch([{ ok: false, status: 400, body: { error: { message: 'max_tokens: 200000 > 64000' } } }, PROSE]);
  try {
    await assert.rejects(
      () => callProvider({ provider: 'anthropic', model: 'claude-opus-5', apiKey: 'x', user: 'write', effort: 'medium' }),
      (e: any) => e.kind === 'BAD_REQUEST' && /max_tokens/.test(String(e.message)),
    );
    assert.equal(net.sent.length, 1, 'one request, one error');
  } finally { net.restore(); }
});

test('the rejection matcher names the field or does not fire', () => {
  const bad = (message: string) => new ProviderError('anthropic', 'BAD_REQUEST', message, 400);
  assert.equal(isEffortRejection(bad('output_config: Extra inputs are not permitted')), true);
  assert.equal(isEffortRejection(bad('effort is not supported for this model')), true);
  assert.equal(isEffortRejection(bad('Unrecognized field output_config')), true);
  // Must NOT fire: a genuine 400 that says nothing about effort would be resent with a changed body.
  assert.equal(isEffortRejection(bad('max_tokens: 200000 > 64000, the maximum')), false);
  assert.equal(isEffortRejection(bad('messages: at least one message is required')), false);
  assert.equal(isEffortRejection(new ProviderError('anthropic', 'TIMEOUT', 'output_config not supported')), false, 'only a 400 counts');
  assert.equal(isEffortRejection(null), false);
});

test('effort is Anthropic-only - no OpenAI-compatible provider is ever sent output_config', async () => {
  resetEffortMemory();
  for (const provider of ['deepseek', 'gemini', 'openrouter', 'local'] as const) {
    const net = stubFetch([{ ok: true, status: 200, body: { choices: [{ message: { content: 'ok' } }], usage: {} } }]);
    try {
      await callProvider({ provider, model: 'm', apiKey: 'x', baseUrl: 'https://example.invalid', user: 'u', effort: 'low' });
      assert.equal('output_config' in net.sent[0], false, provider + ' must not receive output_config');
      assert.equal('effort' in net.sent[0], false, provider + ' must not receive a bare effort either');
    } finally { net.restore(); }
  }
});

test('a call that asks for no effort is untouched - the field never appears', async () => {
  resetEffortMemory();
  const net = stubFetch([PROSE]);
  try {
    await callProvider({ provider: 'anthropic', model: 'claude-opus-5', apiKey: 'x', user: 'write' });
    assert.equal(net.sent.length, 1);
    assert.equal('output_config' in net.sent[0], false);
    assert.equal(noteEffortRejected as any instanceof Function, true, 'exported for the health view');
  } finally { net.restore(); }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PROMPT CACHING
//
// cache_control attaches to a content BLOCK, so a flat-string payload has nowhere to put a
// breakpoint - splitting it is the whole refactor. Caching is a PREFIX match, so the static half
// must come first and everything varying after it; a breakpoint on changing content never hits,
// silently. These pin the request shape and the accounting that proves it worked.

const CACHED = { ok: true, status: 200, body: { content: [{ type: 'text', text: 'INT. BOAT - DAY' }],
  usage: { input_tokens: 400, output_tokens: 9, cache_read_input_tokens: 2892, cache_creation_input_tokens: 0 } } };

test('a cachePrefix splits the payload into blocks and puts the breakpoint on the STATIC one', async () => {
  const net = stubFetch([CACHED]);
  try {
    await callProvider({ provider: 'anthropic', model: 'claude-opus-5', apiKey: 'x',
      cachePrefix: 'THE STORY CONTEXT', user: 'SCENE 12: they argue' });
    const content = net.sent[0].messages[0].content;
    assert.ok(Array.isArray(content), 'the payload must be blocks, not a flat string');
    assert.equal(content.length, 2);
    assert.equal(content[0].text, 'THE STORY CONTEXT', 'the static half comes FIRST - a prefix match');
    assert.deepEqual(content[0].cache_control, { type: 'ephemeral' }, '5-minute TTL: refreshes free on reuse');
    assert.equal(content[1].text, 'SCENE 12: they argue', 'the varying half sits after the breakpoint');
    assert.equal('cache_control' in content[1], false, 'and carries no breakpoint of its own');
  } finally { net.restore(); }
});

test('no cachePrefix means the request is shaped exactly as it always was', async () => {
  const net = stubFetch([PROSE]);
  try {
    await callProvider({ provider: 'anthropic', model: 'claude-opus-5', apiKey: 'x', user: 'write' });
    assert.equal(net.sent[0].messages[0].content, 'write', 'still a flat string for every other caller');
  } finally { net.restore(); }
});

test('the cache counters are carried back, blocking path', async () => {
  const net = stubFetch([CACHED]);
  try {
    const r = await callProvider({ provider: 'anthropic', model: 'claude-opus-5', apiKey: 'x', cachePrefix: 'ctx', user: 'u' });
    assert.equal(r.usage.cache_read_input_tokens, 2892);
    assert.equal(r.usage.cache_creation_input_tokens, 0);
    assert.equal(r.usage.input_tokens, 400, 'and input_tokens stays the UNCACHED remainder, not the total');
  } finally { net.restore(); }
});

test('the cache counters survive the stream - they arrive on message_start and nowhere else', () => {
  const folded = reduceAnthropicEvents([
    { type: 'message_start', message: { usage: { input_tokens: 400, output_tokens: 0,
      cache_read_input_tokens: 2892, cache_creation_input_tokens: 0 } } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'INT. BOAT - DAY' } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 9 } },
  ]);
  assert.equal(folded.usage.cache_read_input_tokens, 2892, 'dropped here = every streamed call looks uncached');
  assert.equal(folded.usage.cache_creation_input_tokens, 0);
  assert.equal(folded.usage.input_tokens, 400);
  assert.equal(folded.usage.output_tokens, 9, 'the later message_delta still wins on output');
});

test('anthropicUsage carries all four counters and invents none', () => {
  assert.deepEqual(anthropicUsage({ input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 }),
    { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 });
  const empty = anthropicUsage(undefined);
  assert.equal(empty.cache_read_input_tokens, undefined, 'absent stays absent - never coerced to 0');
  assert.equal(empty.input_tokens, undefined);
});

test('caching is Anthropic-only - no OpenAI-compatible provider is sent a cache_control block', async () => {
  for (const provider of ['deepseek', 'gemini', 'openrouter', 'local'] as const) {
    const net = stubFetch([{ ok: true, status: 200, body: { choices: [{ message: { content: 'ok' } }], usage: {} } }]);
    try {
      await callProvider({ provider, model: 'm', apiKey: 'x', baseUrl: 'https://example.invalid', cachePrefix: 'ctx', user: 'u' });
      const body = JSON.stringify(net.sent[0]);
      assert.equal(body.includes('cache_control'), false, provider + ' must not receive cache_control');
    } finally { net.restore(); }
  }
});
