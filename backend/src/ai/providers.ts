/**
 * Multi-provider LLM adapter layer for the Unified Engine Switchboard.
 *
 * Anthropic uses its native Messages API; DeepSeek / Gemini / OpenRouter / Local
 * all speak the OpenAI Chat-Completions shape. Each call returns a normalized
 * { text, usage, raw } or throws a *classified* ProviderError so the router
 * (AiService) can fail over to the next provider and put the failed one on a
 * short cooldown. Keys are passed in by the caller and are never logged here.
 */

export type LlmProvider = 'anthropic' | 'deepseek' | 'gemini' | 'openrouter' | 'local';

export type ProviderErrorKind =
  | 'CREDIT' | 'RATE' | 'AUTH' | 'TIMEOUT' | 'NETWORK' | 'BAD_REQUEST' | 'MODEL' | 'SERVER' | 'UNKNOWN';

export interface ProviderCall {
  provider: LlmProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  system?: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  idleTimeoutMs?: number; // streaming only: abort if no bytes arrive for this long - fast stall detection so we fail over quickly
  stream?: boolean; // stream the response server-side: keeps the connection live (no single long blocking request) and sidesteps the non-streaming long-request ceiling
  beta?: string; // anthropic only
}

export interface ProviderResult {
  text: string;
  usage: { input_tokens?: number; output_tokens?: number };
  raw: any;
}

export class ProviderError extends Error {
  kind: ProviderErrorKind;
  status?: number;
  provider: LlmProvider;
  constructor(provider: LlmProvider, kind: ProviderErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.kind = kind;
    this.status = status;
  }
}

/** OpenAI-compatible base URLs (no trailing slash). Local comes from the caller. */
const OPENAI_COMPAT_BASE: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  openrouter: 'https://openrouter.ai/api/v1',
};

/** Default base URL we'd seed/display for a provider (informational). */
export function defaultBaseUrl(provider: LlmProvider): string {
  if (provider === 'anthropic') return 'https://api.anthropic.com';
  if (provider === 'local') return 'http://127.0.0.1:11434/v1';
  return OPENAI_COMPAT_BASE[provider] || '';
}

/** Take this provider out of rotation (cooldown) on this error class? */
export function isExhausting(kind: ProviderErrorKind): boolean {
  // MODEL is deliberately absent: a bad model id is a CONFIG error, not an exhausted provider.
  // Cooling the provider down would hide the real problem behind a generic "unavailable".
  return kind === 'CREDIT' || kind === 'RATE' || kind === 'AUTH';
}

function classify(status: number, body: string, provider: LlmProvider): ProviderError {
  const b = String(body || '').toLowerCase();
  const credit = ['credit balance', 'insufficient', 'insufficient_quota', 'out of credit', 'not enough balance',
    'billing', 'payment required', 'exceeded your current quota', 'no credits'];
  const rate = ['rate limit', 'rate_limit', 'too many requests', 'overloaded', 'resource_exhausted', 'quota exceeded'];
  // Google answers a bad key with HTTP 400 + "API key not valid. Please pass a valid API key."
  // and reason API_KEY_INVALID — none of which matched the old list, so a plain wrong Gemini key
  // was reported to the operator as a generic "failed" instead of "bad or missing key".
  const auth = ['invalid api key', 'invalid_api_key', 'api key not valid', 'api_key_invalid', 'incorrect api key',
    'missing api key', 'api key expired', 'expired api key', 'invalid authentication',
    'unauthorized', 'authentication', 'no auth credentials', 'permission denied'];
  // A model id the provider does not serve. Ollama: "model 'llama3.1' not found"; Anthropic/OpenAI:
  // model_not_found / "does not exist". Worth its own class because the fix is to change the model,
  // not to add credit or wait out a rate limit — and the old catch-all told the operator neither.
  const model = ['model_not_found', 'not found, try pulling it', "' not found", '" not found',
    'unknown model', 'does not exist or you do not have access', 'is not a valid model'];
  if (status === 402 || credit.some((h) => b.includes(h))) return new ProviderError(provider, 'CREDIT', body, status);
  if (status === 429 || rate.some((h) => b.includes(h))) return new ProviderError(provider, 'RATE', body, status);
  if (status === 401 || status === 403 || auth.some((h) => b.includes(h))) return new ProviderError(provider, 'AUTH', body, status);
  if (model.some((h) => b.includes(h))) return new ProviderError(provider, 'MODEL', body, status);
  if (status >= 500) return new ProviderError(provider, 'SERVER', body, status);
  return new ProviderError(provider, 'BAD_REQUEST', body, status);
}

async function httpJson(url: string, headers: any, body: any, timeoutMs: number, provider: LlmProvider): Promise<any> {
  let res: any, lastErr: any;
  for (let i = 0; i < 2; i++) {
    const ctrl: any = typeof (globalThis as any).AbortController !== 'undefined' ? new (globalThis as any).AbortController() : null;
    const timer: any = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch { /* noop */ } }, timeoutMs) : null;
    try {
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined } as any);
      if (timer) clearTimeout(timer);
      if (res.status >= 500 && i < 1) { lastErr = new Error('HTTP ' + res.status); continue; }
      break;
    } catch (e: any) {
      if (timer) clearTimeout(timer);
      lastErr = e;
      const aborted = e?.name === 'AbortError' || /abort/i.test(String(e?.message || ''));
      if (i < 1 && !aborted) continue;
      throw new ProviderError(provider, aborted ? 'TIMEOUT' : 'NETWORK', String(e?.message || e).slice(0, 200));
    }
  }
  if (!res) throw new ProviderError(provider, 'NETWORK', String(lastErr || 'no response').slice(0, 200));
  if (!res.ok) { const t = await res.text().catch(() => ''); throw classify(res.status, t, provider); }
  return await res.json();
}

/** Pure reducer: fold the sequence of Anthropic SSE event objects into normalized {text, usage}. Exported for unit tests. */
export function reduceAnthropicEvents(events: any[]): { text: string; usage: { input_tokens?: number; output_tokens?: number } } {
  let text = '';
  let input_tokens: number | undefined;
  let output_tokens: number | undefined;
  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    if (e.type === 'message_start') { const u = e.message && e.message.usage; if (u) { if (typeof u.input_tokens === 'number') input_tokens = u.input_tokens; if (typeof u.output_tokens === 'number') output_tokens = u.output_tokens; } }
    else if (e.type === 'content_block_delta' && e.delta && e.delta.type === 'text_delta') { text += String(e.delta.text || ''); }
    else if (e.type === 'message_delta' && e.usage && typeof e.usage.output_tokens === 'number') { output_tokens = e.usage.output_tokens; }
  }
  return { text, usage: { input_tokens, output_tokens } };
}

/** Pure reducer: fold OpenAI-compatible streaming chunks (deepseek/gemini/openrouter/local) into normalized {text, usage}. Exported for unit tests. */
export function reduceOpenAiChunks(chunks: any[]): { text: string; usage: { input_tokens?: number; output_tokens?: number } } {
  let text = '';
  let input_tokens: number | undefined;
  let output_tokens: number | undefined;
  for (const c of chunks) {
    if (!c || typeof c !== 'object') continue;
    const choice = Array.isArray(c.choices) ? c.choices[0] : null;
    const piece = choice && choice.delta && choice.delta.content;
    if (typeof piece === 'string') text += piece;
    if (c.usage) { if (typeof c.usage.prompt_tokens === 'number') input_tokens = c.usage.prompt_tokens; if (typeof c.usage.completion_tokens === 'number') output_tokens = c.usage.completion_tokens; }
  }
  return { text, usage: { input_tokens, output_tokens } };
}

// Stream an LLM completion over SSE, accumulating server-side. overallMs caps the whole stream; idleMs resets on
// every chunk and aborts if no bytes arrive for that long -- a true stall fails over fast, while a slow-but-
// progressing long generation keeps running (the point of streaming: a 25k-token scene map can take minutes, but
// as long as tokens keep flowing it won't time out). Returns the same { text, usage, raw }; throws ProviderError.
async function httpStream(url: string, headers: any, body: any, provider: LlmProvider, opts: { idleMs: number; overallMs: number }): Promise<ProviderResult> {
  const AC: any = (globalThis as any).AbortController;
  const ctrl: any = typeof AC !== 'undefined' ? new AC() : null;
  let idleTimer: any = null;
  const overallTimer: any = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch { /* noop */ } }, opts.overallMs) : null;
  const armIdle = () => { if (!ctrl) return; if (idleTimer) clearTimeout(idleTimer); idleTimer = setTimeout(() => { try { ctrl.abort(); } catch { /* noop */ } }, opts.idleMs); };
  const clearAll = () => { if (idleTimer) clearTimeout(idleTimer); if (overallTimer) clearTimeout(overallTimer); };
  armIdle();

  let res: any;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined } as any);
  } catch (e: any) {
    clearAll();
    const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
    throw new ProviderError(provider, aborted ? 'TIMEOUT' : 'NETWORK', String((e && e.message) || e).slice(0, 200));
  }
  if (!res.ok) { clearAll(); const t = await res.text().catch(() => ''); throw classify(res.status, t, provider); }
  if (!res.body || typeof res.body.getReader !== 'function') {
    clearAll();
    const data = await res.json().catch(() => null);
    if (provider === 'anthropic') { const blocks = Array.isArray(data?.content) ? data.content : []; const tb = blocks.find((c: any) => c?.type === 'text'); return { text: String((tb && tb.text) || '').trim(), usage: { input_tokens: data?.usage?.input_tokens, output_tokens: data?.usage?.output_tokens }, raw: data }; }
    const ch = Array.isArray(data?.choices) ? data.choices[0] : null; const u = data?.usage || {}; return { text: String(ch?.message?.content || '').trim(), usage: { input_tokens: u.prompt_tokens, output_tokens: u.completion_tokens }, raw: data };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let done = false;
  const events: any[] = [];
  try {
    while (!done) {
      const r = await reader.read();
      if (r.done) break;
      armIdle();
      buf += decoder.decode(r.value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line || line.startsWith(':') || line.startsWith('event:')) continue;
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') { done = true; break; }
        let obj: any; try { obj = JSON.parse(payload); } catch { continue; }
        if (obj && (obj.type === 'error' || obj.error)) { clearAll(); const errBody = JSON.stringify(obj.error || obj); throw classify((obj.error && obj.error.status) || 500, errBody, provider); }
        events.push(obj);
      }
    }
  } catch (e: any) {
    clearAll();
    if (e instanceof ProviderError) throw e;
    const aborted = e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
    throw new ProviderError(provider, aborted ? 'TIMEOUT' : 'NETWORK', String((e && e.message) || e).slice(0, 200));
  }
  clearAll();
  const folded = provider === 'anthropic' ? reduceAnthropicEvents(events) : reduceOpenAiChunks(events);
  return { text: String(folded.text || '').trim(), usage: folded.usage, raw: { streamed: true, events: events.length } };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// TEMPERATURE ADAPTATION
//
// WHY THIS EXISTS. On 1 Sep a full Jason Quick rewrite planned 80 scenes, read 30 fixed facts out
// of the source material and tracked three cast exits — and then wrote none of it. All 80 scenes,
// three attempts each: 240 identical 400s in 117 seconds.
//
//   invalid_request_error: `temperature` is deprecated for this model.      (claude-opus-4-8)
//
// Every call that carries NO temperature succeeded — the scene planner, the canon pass, the
// coverage gate — which is exactly why the run looked healthy right up to the point where it
// produced nothing. Only the scene writer (0.85) and the scene repairer (0.6) set one, and
// BAD_REQUEST is non-transient, so the router correctly refused to retry its way out of it.
//
// A hard-coded list of "models that reject temperature" would be stale the day the next model
// ships. The provider's own 400 is the better signal: drop the parameter, send the same call once
// more, and remember the model for the rest of the process so scene two costs nothing extra. The
// memory lives in this process and clears on restart, which is the right lifetime for a fact about
// a model id — switching models in Engines & Routing starts from a clean slate.
//
// Dropping it is not a degradation. A model that deprecates `temperature` manages its own sampling;
// sending the parameter is the error, and omitting it is the documented way to call that model.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const TEMPERATURE_REJECTED = new Set<string>();
const temperatureKey = (provider: LlmProvider, model: string): string => provider + ':' + String(model || '');

/** Has this provider/model already told us it will not take `temperature`? */
export function rejectsTemperature(provider: LlmProvider, model: string): boolean {
  return TEMPERATURE_REJECTED.has(temperatureKey(provider, model));
}

/** Record that it did. Exported so a health view — and the tests — can drive it directly. */
export function noteTemperatureRejected(provider: LlmProvider, model: string): void {
  TEMPERATURE_REJECTED.add(temperatureKey(provider, model));
}

/** Forget what has been learned about temperature support. Test seam; also usable on a config change. */
export function resetTemperatureMemory(): void { TEMPERATURE_REJECTED.clear(); }

/**
 * Is this failure the provider refusing the `temperature` PARAMETER, rather than the request?
 *
 *   Anthropic          `temperature` is deprecated for this model.
 *   OpenAI-compatible  Unsupported value: 'temperature' does not support 0.85 with this model.
 *                      temperature is not supported with this model.
 *
 * Deliberately narrow: it must be a 400-class error, AND name temperature, AND carry one of the
 * refusal phrasings. A genuinely malformed request must never be quietly resent with a different
 * body — that would turn one clear error into two confusing ones.
 */
export function isTemperatureRejection(err: any): boolean {
  if (!err || err.kind !== 'BAD_REQUEST') return false;
  const m = String((err && err.message) || '').toLowerCase();
  if (!m.includes('temperature')) return false;
  return /deprecat|unsupported|not supported|does not support|no longer|only the default|must be 1|only supports/.test(m);
}

/**
 * Send once with `temperature`; if the provider refuses that parameter, remember it and send once
 * without. At most one extra request, and only on a 400 that names temperature — every other
 * failure is re-thrown untouched, so the router's classification, cooldown and failover are
 * exactly as they were.
 */
async function sendAdaptingTemperature(
  provider: LlmProvider,
  model: string,
  wanted: boolean,
  send: (withTemperature: boolean) => Promise<ProviderResult>,
): Promise<ProviderResult> {
  const useTemperature = wanted && !rejectsTemperature(provider, model);
  try {
    return await send(useTemperature);
  } catch (e: any) {
    if (!useTemperature || !isTemperatureRejection(e)) throw e;
    noteTemperatureRejected(provider, model);
    return await send(false);
  }
}

/** Execute one LLM completion against the given provider, normalized. Throws ProviderError. */
export async function callProvider(call: ProviderCall): Promise<ProviderResult> {
  const timeoutMs = call.timeoutMs || 200000;
  const maxTokens = call.maxTokens || 1500; // let the chosen model's real limit apply (it returns a clear 400 if exceeded)
  const stream = !!call.stream;
  const idleMs = call.idleTimeoutMs || 120000;
  const wantsTemperature = typeof call.temperature === 'number';

  if (call.provider === 'anthropic') {
    const headers: any = { 'content-type': 'application/json', 'x-api-key': call.apiKey, 'anthropic-version': '2023-06-01' };
    if (call.beta) headers['anthropic-beta'] = call.beta;
    const url = (call.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '') + '/v1/messages';
    // The body is rebuilt per attempt rather than mutated, so a retry inherits nothing from the
    // request the provider just rejected.
    const send = async (withTemperature: boolean): Promise<ProviderResult> => {
      const body: any = { model: call.model, max_tokens: maxTokens, system: call.system, messages: [{ role: 'user', content: call.user }] };
      if (withTemperature) body.temperature = call.temperature;
      if (stream) { body.stream = true; return httpStream(url, headers, body, 'anthropic', { idleMs, overallMs: timeoutMs }); }
      const data = await httpJson(url, headers, body, timeoutMs, 'anthropic');
      const blocks = Array.isArray(data?.content) ? data.content : [];
      const t = blocks.find((c: any) => c?.type === 'text');
      const text = String((t && t.text) || data?.content?.[0]?.text || '').trim();
      return { text, usage: { input_tokens: data?.usage?.input_tokens, output_tokens: data?.usage?.output_tokens }, raw: data };
    };
    return sendAdaptingTemperature('anthropic', call.model, wantsTemperature, send);
  }

  // OpenAI-compatible: deepseek | gemini | openrouter | local
  const base = (call.baseUrl || OPENAI_COMPAT_BASE[call.provider] || '').replace(/\/+$/, '');
  if (!base) throw new ProviderError(call.provider, 'BAD_REQUEST', 'No base URL configured for provider ' + call.provider);
  const headers: any = { 'content-type': 'application/json' };
  if (call.apiKey) headers['authorization'] = 'Bearer ' + call.apiKey;
  if (call.provider === 'openrouter') { headers['HTTP-Referer'] = process.env.APP_URL || 'https://app.thefilmmakers.io'; headers['X-Title'] = 'FilmOS'; }
  const messages: any[] = [];
  if (call.system) messages.push({ role: 'system', content: call.system });
  messages.push({ role: 'user', content: call.user });
  const send = async (withTemperature: boolean): Promise<ProviderResult> => {
    const body: any = { model: call.model, messages, max_tokens: maxTokens };
    if (withTemperature) body.temperature = call.temperature;
    // GEMINI THINKS BY DEFAULT, AND ITS THINKING IS BILLED AGAINST max_tokens.
    //
    // On 1 Sep, with Anthropic out of credit, the whole feature was rerouted to gemini-2.5-flash and
    // every scene came back at a fraction of its ask — 2 words, 5 words, 28 words against asks of 61
    // to 182 (ratios 0.03 to 0.19). Not stubs, so mostlyStub never fired; just scenes with nothing in
    // them. The cause is that 2.5-era Gemini reasons before it answers and the reasoning is charged
    // to the SAME budget as the output, so our runaway guard — sized for prose — was spent thinking
    // and the model emitted whatever was left. It is a widely reported failure mode.
    //
    // A screenplay scene does not want a reasoning pass; it wants the words. Turning it off returns
    // the whole allowance to the prose. Sent only to Gemini, because it is the only provider here
    // whose default behaviour silently consumes the caller's budget.
    if (call.provider === 'gemini') body.reasoning_effort = 'none';
    if (stream) { body.stream = true; if (call.provider !== 'gemini') body.stream_options = { include_usage: true }; return httpStream(base + '/chat/completions', headers, body, call.provider, { idleMs, overallMs: timeoutMs }); }
    const data = await httpJson(base + '/chat/completions', headers, body, timeoutMs, call.provider);
    const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
    const text = String(choice?.message?.content || '').trim();
    const u = data?.usage || {};
    return { text, usage: { input_tokens: u.prompt_tokens, output_tokens: u.completion_tokens }, raw: data };
  };
  return sendAdaptingTemperature(call.provider, call.model, wantsTemperature, send);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// CREDENTIAL SAFETY
//
// WHY THIS EXISTS. On 1 Sep a ScriptON run failed to plan and the error it raised read:
//
//   No AI provider could complete the request. Tried — ANTHROPIC (timed out — claude-sonnet-4-6).
//   Not enabled (...): GEMINI, DEEPSEEK, OPENROUTER, LOCAL, ANTHROPIC_API_KEY=sk-ant-api03-…
//
// A live Anthropic key, in full, in a user-facing message, in the terminal, and in the log file the
// operator was tailing. The proximate cause was DATA — an LlmEngine row whose `key` column held a
// pasted .env line, which the failure report prints because it lists engines that are not enabled.
// Deleting that row fixes today. This fixes the class: nothing credential-shaped reaches a user, a
// log or an exception, whatever the database happens to contain.
//
// Placed in providers.ts because both ai.service and llm-routing import from here and neither
// imports the other — anywhere else would be a cycle.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Known credential shapes, by prefix. Case-insensitive on purpose: `createEngine` upper-cases the
 * key it is given, so the leaked value arrived as SK-ANT-… rather than sk-ant-… .
 */
const SECRET_SHAPES: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{16,}/gi,            // OpenAI, Anthropic, OpenRouter, DeepSeek
  /\bAIza[A-Za-z0-9_-]{20,}/g,            // Google
  /\bgh[pousr]_[A-Za-z0-9]{20,}/gi,       // GitHub
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/gi,     // Slack
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/gi,
];

/**
 * An environment assignment carrying a secret: NAME_KEY=value, API_TOKEN: value, and so on. Catches
 * the case where the value itself matches no known prefix, which is most of them.
 */
const SECRET_ASSIGNMENT = /\b([A-Za-z][A-Za-z0-9_]*_(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?))\s*[=:]\s*("[^"]*"|'[^']*'|\S+)/gi;

/**
 * Mask anything credential-shaped in a string, keeping the surrounding text readable.
 *
 * The assignment form keeps its NAME so the message stays actionable — "ANTHROPIC_API_KEY=[redacted]"
 * still tells an operator which credential is involved, which is the whole point of the error.
 * Fail-open on junk input: this runs on an error path and must never throw one of its own.
 */
export function redactSecrets(input: any): string {
  let s = String(input == null ? '' : input);
  try {
    s = s.replace(SECRET_ASSIGNMENT, (_m, name) => name + '=[redacted]');
    for (const re of SECRET_SHAPES) s = s.replace(re, '[redacted]');
  } catch { /* a redaction that throws would hide the error it was masking */ }
  return s;
}

/**
 * Engine keys are short identifiers — ANTHROPIC, GEMINI, LOCAL — not free text. Anything else is
 * almost certainly a paste into the wrong field, and the one we saw was a live credential. Rejecting
 * the shape makes that row impossible to create rather than merely embarrassing to print.
 */
export function isValidEngineKey(key: any): boolean {
  return /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(String(key == null ? '' : key).toUpperCase().trim());
}
