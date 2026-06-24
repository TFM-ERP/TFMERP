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
  | 'CREDIT' | 'RATE' | 'AUTH' | 'TIMEOUT' | 'NETWORK' | 'BAD_REQUEST' | 'SERVER' | 'UNKNOWN';

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
  return kind === 'CREDIT' || kind === 'RATE' || kind === 'AUTH';
}

function classify(status: number, body: string, provider: LlmProvider): ProviderError {
  const b = String(body || '').toLowerCase();
  const credit = ['credit balance', 'insufficient', 'insufficient_quota', 'out of credit', 'not enough balance',
    'billing', 'payment required', 'exceeded your current quota', 'no credits'];
  const rate = ['rate limit', 'rate_limit', 'too many requests', 'overloaded', 'resource_exhausted', 'quota exceeded'];
  const auth = ['invalid api key', 'invalid_api_key', 'unauthorized', 'authentication', 'no auth credentials', 'permission denied'];
  if (status === 402 || credit.some((h) => b.includes(h))) return new ProviderError(provider, 'CREDIT', body, status);
  if (status === 429 || rate.some((h) => b.includes(h))) return new ProviderError(provider, 'RATE', body, status);
  if (status === 401 || status === 403 || auth.some((h) => b.includes(h))) return new ProviderError(provider, 'AUTH', body, status);
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

/** Execute one LLM completion against the given provider, normalized. Throws ProviderError. */
export async function callProvider(call: ProviderCall): Promise<ProviderResult> {
  const timeoutMs = call.timeoutMs || 200000;
  const maxTokens = call.maxTokens || 1500; // let the chosen model's real limit apply (it returns a clear 400 if exceeded)
  const stream = !!call.stream;
  const idleMs = call.idleTimeoutMs || 120000;

  if (call.provider === 'anthropic') {
    const headers: any = { 'content-type': 'application/json', 'x-api-key': call.apiKey, 'anthropic-version': '2023-06-01' };
    if (call.beta) headers['anthropic-beta'] = call.beta;
    const body: any = { model: call.model, max_tokens: maxTokens, system: call.system, messages: [{ role: 'user', content: call.user }] };
    if (typeof call.temperature === 'number') body.temperature = call.temperature;
    const url = (call.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '') + '/v1/messages';
    if (stream) { body.stream = true; return httpStream(url, headers, body, 'anthropic', { idleMs, overallMs: timeoutMs }); }
    const data = await httpJson(url, headers, body, timeoutMs, 'anthropic');
    const blocks = Array.isArray(data?.content) ? data.content : [];
    const t = blocks.find((c: any) => c?.type === 'text');
    const text = String((t && t.text) || data?.content?.[0]?.text || '').trim();
    return { text, usage: { input_tokens: data?.usage?.input_tokens, output_tokens: data?.usage?.output_tokens }, raw: data };
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
  const body: any = { model: call.model, messages, max_tokens: maxTokens };
  if (typeof call.temperature === 'number') body.temperature = call.temperature;
  if (stream) { body.stream = true; if (call.provider !== 'gemini') body.stream_options = { include_usage: true }; return httpStream(base + '/chat/completions', headers, body, call.provider, { idleMs, overallMs: timeoutMs }); }
  const data = await httpJson(base + '/chat/completions', headers, body, timeoutMs, call.provider);
  const choice = Array.isArray(data?.choices) ? data.choices[0] : null;
  const text = String(choice?.message?.content || '').trim();
  const u = data?.usage || {};
  return { text, usage: { input_tokens: u.prompt_tokens, output_tokens: u.completion_tokens }, raw: data };
}
