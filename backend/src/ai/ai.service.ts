import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { LlmRoutingService } from './llm-routing.service';
import { callProvider, isExhausting, ProviderErrorKind } from './providers';

export interface AiRunOpts { task: string; system: string; user: string; projectId?: string | null; refType?: string | null; refId?: string | null; maxTokens?: number; model?: string; temperature?: number; timeoutMs?: number; idleTimeoutMs?: number; stream?: boolean; }
export interface AiRawOpts { task: string; system?: string; messages: any[]; tools?: any[]; toolChoice?: any; beta?: string; projectId?: string | null; refType?: string | null; refId?: string | null; maxTokens?: number; model?: string; temperature?: number; timeoutMs?: number; }
export interface AiResult { text: string; json: any; model: string; usage: any; runId?: string; provider?: string; }
export interface AiRawResult { data: any; text: string; toolUse: any[]; usage: any; model: string; runId?: string; }

/**
 * Unified AI gateway — every model call in the platform routes through here.
 *
 * run()/complete()/json() now walk a DB-driven provider failover chain (the
 * "LLM Engines & Routing" switchboard): if one provider is out of credit /
 * rate-limited / unauthorized, the next configured provider is tried automatically
 * and the failed one is put on a short in-memory cooldown so later calls skip it.
 * Long generations are STREAMED by default (idle-timeout failover; see run()).
 * raw() (vision image blocks, tool-use) stays on Anthropic by design. Token
 * accounting + a governed audit record (AiRun, now provider-tagged) are written
 * per attempt. Tolerant pre-db:push (logging + chain reads are guarded).
 */
@Injectable()
export class AiService {
  constructor(private prisma: PrismaService, private routing: LlmRoutingService) {}

  /** Legacy: the default Anthropic model (used by raw() + callers that read .model). */
  get model(): string { return process.env.LABOR_AI_MODEL || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'; }

  // ── Provider cooldown (in-memory; clears on restart) ─────────────────────────
  private cooldown = new Map<string, number>();
  private isCooling(p: string): boolean { const until = this.cooldown.get(p); return !!until && until > Date.now(); }
  private cool(p: string, kind: ProviderErrorKind) { const mins = kind === 'RATE' ? 1 : 10; this.cooldown.set(p, Date.now() + mins * 60 * 1000); }

  async run(opts: AiRunOpts): Promise<AiResult> {
    if (typeof fetch === 'undefined') throw new BadRequestException('AI needs Node 18+ on the backend (global fetch is missing).');
    const chain = await this.routing.resolveChain(opts.task, opts.projectId || undefined);
    const ready = chain.filter((p) => p.usable);
    const hot = ready.filter((p) => !this.isCooling(p.provider));
    const cooling = ready.filter((p) => this.isCooling(p.provider));
    const attempt = [...hot, ...cooling]; // cooled providers are DEPRIORITIZED, never excluded — a refilled/recovered provider is still retried when the others fail
    if (!attempt.length) throw new BadRequestException('AI is not configured. Add a provider key (e.g. ANTHROPIC_API_KEY) or a Local server URL (LOCAL_LLM_SERVER_URL) in the backend .env, then enable it in Engines & Routing.');
    const reason = (k: string) => k === 'CREDIT' ? 'out of credit/quota' : k === 'RATE' ? 'rate-limited' : k === 'AUTH' ? 'bad or missing key' : k === 'TIMEOUT' ? 'timed out' : k === 'NETWORK' ? 'unreachable' : k === 'SERVER' ? 'provider error' : 'failed';
    // Stream long generations by default — any big-output or long-timeout call streams (server-side, idle-timeout
    // failover) so it can't hit the single-blocking-request wall; quick calls stay simple blocking requests. A caller
    // can always force it on/off via opts.stream.
    const wantStream = opts.stream ?? (((opts.maxTokens ?? 0) >= 6000) || ((opts.timeoutMs ?? 0) >= 180000));
    // Transient classes can succeed on a second try; CREDIT/AUTH/BAD_REQUEST won't, so those never trigger an auto-retry.
    const TRANSIENT = new Set<ProviderErrorKind>(['TIMEOUT', 'SERVER', 'RATE', 'NETWORK']);
    const MAX_PASSES = 2; // at most one extra full sweep of the chain, and only when EVERY provider failed transiently
    let tried: string[] = [];
    let lastErr: any;
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      tried = [];
      let sawFailure = false;
      let allTransient = true;
      for (const plan of attempt) {
        // opts.model is a legacy Anthropic-model override; honor it only on the Anthropic attempt.
        const model = (opts.model && plan.provider === 'anthropic') ? opts.model : plan.model;
        const runId = await this.begin({ task: opts.task, provider: plan.provider, model, projectId: opts.projectId, refType: opts.refType, refId: opts.refId, promptChars: (opts.system || '').length + (opts.user || '').length });
        const started = Date.now();
        try {
          const r = await callProvider({ provider: plan.provider, model, apiKey: plan.apiKey, baseUrl: plan.baseUrl, system: opts.system, user: opts.user, maxTokens: opts.maxTokens, temperature: opts.temperature, timeoutMs: opts.timeoutMs, idleTimeoutMs: opts.idleTimeoutMs, stream: wantStream });
          await this.finish(runId, { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens }, r.text, Date.now() - started);
          return { text: r.text, json: this.extractJson(r.text), model, usage: r.usage, runId, provider: plan.provider };
        } catch (e: any) {
          lastErr = e;
          sawFailure = true;
          const kind: ProviderErrorKind = e?.kind || 'UNKNOWN';
          if (!TRANSIENT.has(kind)) allTransient = false;
          const detail = (kind === 'BAD_REQUEST' || kind === 'SERVER' || kind === 'UNKNOWN') ? (': ' + String(e?.message || '').replace(/\s+/g, ' ').slice(0, 140)) : '';
          tried.push(plan.key + ' (' + reason(kind) + detail + ')');
          await this.fail(runId, '[' + plan.provider + ':' + kind + '] ' + String(e?.message || e).slice(0, 300));
          if (isExhausting(kind)) this.cool(plan.provider, kind);
          // fall through to the next provider in the chain
        }
      }
      // Every provider failed this sweep. If they ALL failed on a transient condition, wait briefly and sweep once more.
      if (pass < MAX_PASSES - 1 && sawFailure && allTransient) { await new Promise((res) => setTimeout(res, 1500)); continue; }
      break;
    }
    // Nothing succeeded — return an actionable, per-provider breakdown.
    const offline = chain.filter((p) => !p.usable).map((p) => p.key);
    const parts: string[] = [];
    if (tried.length) parts.push('Tried — ' + tried.join('; ') + '.');
    if (offline.length) parts.push('Not enabled (add a key in Engines & Routing, or a server URL for Local): ' + offline.join(', ') + '.');
    if (attempt.some((p) => p.provider === 'local') && lastErr?.kind === 'NETWORK') parts.push('Your Local engine looks offline — start Ollama / LM Studio, or fix LOCAL_LLM_SERVER_URL.');
    throw new BadRequestException(('No AI provider could complete the request. ' + parts.join(' ')).trim());
  }
  async complete(opts: AiRunOpts): Promise<string> { return (await this.run(opts)).text; }
  async json<T = any>(opts: AiRunOpts): Promise<T | null> { return (await this.run(opts)).json as T | null; }

  /** Arbitrary messages (vision image blocks, tool-use). Anthropic-only by design. */
  async raw(opts: AiRawOpts): Promise<AiRawResult> {
    if (!process.env.ANTHROPIC_API_KEY) throw new BadRequestException('Vision/tool calls use Anthropic — set ANTHROPIC_API_KEY in the backend .env.');
    if (typeof fetch === 'undefined') throw new BadRequestException('AI needs Node 18+ on the backend (global fetch is missing).');
    const model = opts.model || this.model;
    let promptChars = 0; try { promptChars = (opts.system || '').length + JSON.stringify(opts.messages || []).length; } catch { promptChars = 0; }
    const runId = await this.begin({ task: opts.task, provider: 'anthropic', model, projectId: opts.projectId, refType: opts.refType, refId: opts.refId, promptChars });
    const body: any = { model, max_tokens: opts.maxTokens || 1500, temperature: opts.temperature, system: opts.system, messages: opts.messages };
    if (opts.tools) body.tools = opts.tools;
    if (opts.toolChoice) body.tool_choice = opts.toolChoice;
    const started = Date.now();
    const data = await this.post(body, runId, opts.beta, opts.timeoutMs);
    const text = this.firstText(data);
    const toolUse = Array.isArray(data?.content) ? data.content.filter((c: any) => c?.type === 'tool_use') : [];
    await this.finish(runId, data?.usage, text, Date.now() - started);
    return { data, text, toolUse, usage: data?.usage, model, runId };
  }

  private firstText(data: any): string {
    const blocks = Array.isArray(data?.content) ? data.content : [];
    const t = blocks.find((c: any) => c?.type === 'text');
    return String((t && t.text) || data?.content?.[0]?.text || '').trim();
  }

  /** Anthropic Messages POST with retry-on-5xx + timeout. Used by raw() (vision/tools). */
  private async post(body: any, runId?: string, beta?: string, timeoutMs?: number): Promise<any> {
    const key = process.env.ANTHROPIC_API_KEY as string;
    let res: any, last: any;
    for (let i = 0; i < 2; i++) {
      const ctrl: any = typeof (globalThis as any).AbortController !== 'undefined' ? new (globalThis as any).AbortController() : null;
      const timer: any = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch { /* noop */ } }, timeoutMs || 200000) : null;
      try {
        res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: ((): any => { const h: any = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }; if (beta) h['anthropic-beta'] = beta; return h; })(), body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined } as any);
        if (timer) clearTimeout(timer);
        if (res.status >= 500 && i < 1) { last = new Error('HTTP ' + res.status); continue; }
        break;
      } catch (e) { if (timer) clearTimeout(timer); last = e; if (i < 1) continue; await this.fail(runId, 'network: ' + String((e as any)?.message || e)); throw new BadRequestException('AI could not reach the model: ' + String((e as any)?.message || e).slice(0, 160)); }
    }
    if (!res) { await this.fail(runId, 'no response ' + String(last || '')); throw new BadRequestException('AI request failed to send.'); }
    if (!res.ok) { const t = await res.text().catch(() => ''); await this.fail(runId, 'HTTP ' + res.status + ' ' + String(t).slice(0, 160)); throw new BadRequestException('AI request failed (HTTP ' + res.status + '). ' + String(t).slice(0, 160)); }
    return await res.json();
  }

  private extractJson(t: string): any {
    let s = String(t || '');
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) s = fence[1].trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a >= 0 && b > a) s = s.slice(a, b + 1);
    try { return JSON.parse(s); } catch { return null; }
  }

  private async begin(o: { task: string; provider?: string; model: string; projectId?: string | null; refType?: string | null; refId?: string | null; promptChars?: number }): Promise<string | undefined> {
    try { const r: any = await (this.prisma as any).aiRun.create({ data: { task: o.task, model: o.model, provider: o.provider || null, status: 'RUNNING', projectId: o.projectId || null, refType: o.refType || null, refId: o.refId || null, promptChars: o.promptChars || 0 } }); return r?.id; } catch { return undefined; }
  }
  private async finish(id: string | undefined, usage: any, text: string, ms: number): Promise<void> {
    if (!id) return;
    try { await (this.prisma as any).aiRun.update({ where: { id }, data: { status: 'DONE', inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null, outputChars: (text || '').length, latencyMs: ms } }); } catch { /* logging never breaks the request */ }
  }
  private async fail(id: string | undefined, msg: string): Promise<void> {
    if (!id) return;
    try { await (this.prisma as any).aiRun.update({ where: { id }, data: { status: 'ERROR', error: String(msg).slice(0, 500) } }); } catch { /* noop */ }
  }
}
