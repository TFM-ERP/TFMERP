import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { LlmProvider } from './providers';

/**
 * LLM Engines & Routing — the text-side mirror of AudioEnginesService.
 * Holds the registry of LLM providers (Anthropic/DeepSeek/Gemini/OpenRouter/Local),
 * the per-capability failover order, and tier-aware telemetry. AiService asks this
 * service for an ordered failover chain on every call. Tolerant pre-db:push: every
 * Prisma access is guarded, and a built-in default chain is used until seeded.
 */

export interface ProviderPlan {
  engineId: string;
  key: string;
  provider: LlmProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  tier: string;
  usable: boolean; // enabled AND has a credential (or a REACHABLE Local server)
  unreachable?: boolean; // local only: configured, but nothing answered on its base URL
  modelMissing?: boolean; // local only: server is up, but it has not pulled this model
}

const CAPABILITIES = ['LLM_DEFAULT', 'BREAKDOWN', 'DRAFTING', 'POLISH', 'LEGAL'];

/**
 * Single source of truth for the Anthropic model used whenever no engine row and no env var
 * supplies one. AiService imports this too, so the gateway and the switchboard can never drift
 * onto different defaults.
 */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

/**
 * Model ids the provider no longer serves. A call against one fails with model-not-found, which
 * classify() reads as BAD_REQUEST — a NON-transient class, so there is no retry and no failover
 * and the whole request dies. Any engine row still pinned to a retired id is migrated forward on
 * boot, and toPlan() refuses to hand one to a provider.
 * Only add an id here once its retirement is CONFIRMED: a live model listed here would be
 * silently swapped out from under the operator's choice.
 */
export const RETIRED_MODELS: ReadonlySet<string> = new Set<string>([
  'claude-3-5-sonnet-20241022', // Anthropic retired this on 28 Oct 2025
]);

/** Is this model id one the provider has stopped serving? Empty/absent counts as "no model set". */
export function isRetiredModel(id?: string | null): boolean { return !!id && RETIRED_MODELS.has(String(id)); }
const PROVIDERS: LlmProvider[] = ['anthropic', 'deepseek', 'gemini', 'openrouter', 'local'];

/** Built-in provider catalog — what each is for + sane default models + priority. */
export const LLM_PROVIDER_DEFAULTS: Array<{
  key: string; provider: LlmProvider; displayName: string; credentialRef: string | null;
  tier: string; defaultModel: string; priority: number; baseUrl?: string;
  models: { id: string; label: string; hint: string; tier: 'free' | 'paid' }[];
}> = [
  { key: 'ANTHROPIC', provider: 'anthropic', displayName: 'Anthropic Claude', credentialRef: 'ANTHROPIC_API_KEY', tier: 'PAID', defaultModel: 'claude-sonnet-4-6', priority: 10,
    models: [
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced', hint: 'Best price/quality for drafting + long output', tier: 'paid' },
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — most capable', hint: 'Highest quality; premium price — best for final polish', tier: 'paid' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — fast/cheap', hint: 'Quick, low-cost tasks', tier: 'paid' },
      { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — newest balanced', hint: 'Current Sonnet generation', tier: 'paid' },
      { id: 'claude-opus-5', label: 'Claude Opus 5 — newest, most capable', hint: 'Current Opus generation; premium price', tier: 'paid' },
      // claude-3-5-sonnet-20241022 removed: Anthropic retired it on 28 Oct 2025 and it now fails.
      // It survives only in RETIRED_MODELS, so a row still pinned to it is migrated forward on boot.
    ] },
  { key: 'DEEPSEEK', provider: 'deepseek', displayName: 'DeepSeek', credentialRef: 'DEEPSEEK_API_KEY', tier: 'PAID', defaultModel: 'deepseek-v4-flash', priority: 20,
    models: [
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash — cheap drafting', hint: 'Frontier-class, lowest cost; 1M context (replaces deepseek-chat)', tier: 'paid' },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro — reasoning/agentic', hint: 'High-value reasoning, coding, long-context polish', tier: 'paid' },
      { id: 'deepseek-chat', label: 'DeepSeek Chat (legacy alias)', hint: 'Maps to V4 Flash non-thinking; deprecates Jul 2026', tier: 'paid' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (legacy alias)', hint: 'Maps to V4 Flash thinking; deprecates Jul 2026', tier: 'paid' },
    ] },
  { key: 'GEMINI', provider: 'gemini', displayName: 'Google Gemini', credentialRef: 'GEMINI_API_KEY', tier: 'LIMITED_FREE', defaultModel: 'gemini-2.5-flash', priority: 30,
    models: [
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash — newest, near-Pro', hint: 'Free key · top Flash intelligence + coding (May 2026)', tier: 'free' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — workhorse', hint: 'Free key · 1,500 req/day, 1M context — best default', tier: 'free' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite — fastest/cheapest', hint: 'Free key · high-volume, low-latency', tier: 'free' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite — cost-efficient', hint: 'Free key · newest lite, high-throughput', tier: 'free' },
      { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (legacy)', hint: 'Free key · long context, older', tier: 'free' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro — most advanced', hint: 'Paid only (billing) · highest reasoning, agentic', tier: 'paid' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro — high quality', hint: 'Paid (only 50 req/day free) · complex reasoning, 1M context', tier: 'paid' },
      { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (legacy)', hint: 'Paid · older Pro tier', tier: 'paid' },
    ] },
  { key: 'OPENROUTER', provider: 'openrouter', displayName: 'OpenRouter', credentialRef: 'OPENROUTER_API_KEY', tier: 'PAID', defaultModel: 'deepseek/deepseek-r1:free', priority: 40,
    models: [
      { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 (free) — reasoning', hint: 'Free · strong reasoning, ~20 req/min through one key', tier: 'free' },
      { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (free)', hint: 'Free · balanced open model, rate-limited', tier: 'free' },
      { id: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder (free) — code/long-ctx', hint: 'Free · strongest free coder, 262K context', tier: 'free' },
      { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6 (via OpenRouter)', hint: 'Paid · Anthropic through one key', tier: 'paid' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek V4 (via OpenRouter)', hint: 'Paid · cheap drafting, higher limits', tier: 'paid' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (paid)', hint: 'Paid · higher rate limits', tier: 'paid' },
    ] },
  { key: 'LOCAL', provider: 'local', displayName: 'Local server (free)', credentialRef: null, tier: 'ULTIMATE_FREE', defaultModel: process.env.LOCAL_LLM_MODEL || 'llama3.1', priority: 50, baseUrl: 'http://127.0.0.1:11434/v1',
    models: [
      { id: 'llama3.3', label: 'Llama 3.3 (local)', hint: 'Ollama / LM Studio — no limits', tier: 'free' },
      { id: 'qwen2.5', label: 'Qwen 2.5 (local)', hint: 'Strong multilingual incl. Arabic', tier: 'free' },
      { id: 'llama3.1', label: 'Llama 3.1 (local)', hint: 'Widely available Ollama tag', tier: 'free' },
      { id: 'mistral', label: 'Mistral (local)', hint: 'Fast general-purpose', tier: 'free' },
      { id: 'gemma3', label: 'Gemma 3 (local)', hint: 'Google open model', tier: 'free' },
    ] },
];

@Injectable()
export class LlmRoutingService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  /** Refresh the provider catalog (model lists + credential refs) on every boot, so the
   *  Engines UI dropdowns always reflect the latest models without needing a manual "Seed defaults". */
  async onModuleInit(): Promise<void> { try { await this.seedDefaults(); } catch { /* tolerant: pre-db:push / transient DB */ } }

  // ── catalog / seed ───────────────────────────────────────────────────────────
  /** Seed the 5 providers (Anthropic + Local enabled; rest present but disabled) + a default chain. */
  async seedDefaults() {
    for (const d of LLM_PROVIDER_DEFAULTS) {
      const existing = await (this.prisma as any).llmEngine.findUnique({ where: { key: d.key } }).catch(() => null);
      if (existing) continue;
      const enabled = d.provider === 'anthropic' || d.provider === 'local';
      await (this.prisma as any).llmEngine.create({ data: {
        key: d.key, provider: d.provider, displayName: d.displayName, tier: d.tier, enabled,
        credentialRef: d.credentialRef, defaultModel: d.defaultModel, priority: d.priority,
        baseUrl: d.provider === 'local' ? (process.env.LOCAL_LLM_SERVER_URL || d.baseUrl || null) : null,
        models: d.models as any, capabilities: { llm: true },
      } });
    }
    const engines = await (this.prisma as any).llmEngine.findMany({ orderBy: { priority: 'asc' } });
    const existingPolicy = await (this.prisma as any).llmRoutingPolicy.findFirst({ where: { scope: 'ORG', projectId: null, capability: 'LLM_DEFAULT' } }).catch(() => null);
    if (!existingPolicy) {
      await (this.prisma as any).llmRoutingPolicy.create({ data: {
        scope: 'ORG', projectId: null, capability: 'LLM_DEFAULT',
        defaultEngineId: engines[0]?.id || null, allowedEngineIds: engines.map((e: any) => e.id),
        fallbackChain: engines.map((e: any) => e.id), projectOverrideAllowed: false, userMayOverride: false,
      } });
    }
    // Idempotent refresh: keep existing engines' model catalogs current (so the UI dropdown shows the
    // latest models) and migrate any row pinned to a RETIRED model forward — without overwriting the
    // operator's own choices.
    for (const d of LLM_PROVIDER_DEFAULTS) {
      const ex = await (this.prisma as any).llmEngine.findUnique({ where: { key: d.key } }).catch(() => null);
      if (!ex) continue;
      const patch: any = { models: d.models as any };
      // Only fill in a MISSING credentialRef. Overwriting it unconditionally silently reverted any
      // env-var mapping set in the Engines & Routing UI on every single restart.
      if (!ex.credentialRef && d.credentialRef) patch.credentialRef = d.credentialRef;
      // A blank or retired model is not a user choice worth preserving — it is a dead engine.
      if (!ex.defaultModel || isRetiredModel(ex.defaultModel)) patch.defaultModel = d.defaultModel;
      await (this.prisma as any).llmEngine.update({ where: { id: ex.id }, data: patch }).catch(() => {});
    }
    return this.listEngines();
  }

  listEngines() { return (this.prisma as any).llmEngine.findMany({ orderBy: [{ priority: 'asc' }, { displayName: 'asc' }] }); }
  getEngine(id: string) { return (this.prisma as any).llmEngine.findUnique({ where: { id } }); }

  createEngine(b: any) {
    if (!b?.key || !b?.provider || !b?.displayName) throw new BadRequestException('key, provider and displayName are required.');
    if (!PROVIDERS.includes(String(b.provider).toLowerCase() as LlmProvider)) throw new BadRequestException('provider must be one of: ' + PROVIDERS.join(', '));
    return (this.prisma as any).llmEngine.create({ data: {
      key: String(b.key).toUpperCase(), provider: String(b.provider).toLowerCase(), displayName: b.displayName,
      tier: b.tier || 'PAID', enabled: !!b.enabled, credentialRef: b.credentialRef || null, baseUrl: b.baseUrl || null,
      defaultModel: b.defaultModel || null, models: b.models ?? null, capabilities: b.capabilities ?? { llm: true },
      priority: typeof b.priority === 'number' ? b.priority : 100, monthlyTokenCap: b.monthlyTokenCap ?? null,
      freeTokenCap: b.freeTokenCap ?? null, costModel: b.costModel ?? null, notes: b.notes || null,
    } });
  }
  updateEngine(id: string, b: any) {
    const d: any = {};
    for (const k of ['displayName', 'provider', 'tier', 'enabled', 'credentialRef', 'baseUrl', 'defaultModel', 'models', 'capabilities', 'priority', 'monthlyTokenCap', 'freeTokenCap', 'costModel', 'status', 'notes']) if (b?.[k] !== undefined) d[k] = b[k];
    if (d.provider) d.provider = String(d.provider).toLowerCase();
    return (this.prisma as any).llmEngine.update({ where: { id }, data: d });
  }
  removeEngine(id: string) { return (this.prisma as any).llmEngine.delete({ where: { id } }); }

  // ── failover chain resolution (consumed by AiService.run) ─────────────────────
  /** Which routing bucket a task maps to. Phase 1: one global chain (UI wires the rest). */
  capabilityForTask(_task?: string): string { return 'LLM_DEFAULT'; }

  private fallbackModel(provider: LlmProvider): string {
    if (provider === 'anthropic') return DEFAULT_ANTHROPIC_MODEL;
    const d = LLM_PROVIDER_DEFAULTS.find((x) => x.provider === provider);
    return d?.defaultModel || 'gpt-4o-mini';
  }

  // ── Local-engine reachability (cached) ───────────────────────────────────────
  /**
   * A Local engine counts as "configured" the moment it has a base URL — which says nothing about
   * whether a server is actually listening there. Local is seeded ENABLED with a default localhost
   * URL, so without this probe the chain always contains one "usable" provider: the actionable
   * "AI is not configured" message can never fire, and every failing call burns a doomed attempt on
   * a dead port (on Railway there is no Ollama on 127.0.0.1 at all).
   * Cached for 60s and re-probed after, so starting Ollama recovers without a backend restart.
   */
  private localProbe: { at: number; url: string; ok: boolean; models: string[] } | null = null;
  private async probeLocal(baseUrl?: string): Promise<{ ok: boolean; models: string[] }> {
    const url = String(baseUrl || '');
    if (!url) return { ok: false, models: [] };
    const c = this.localProbe;
    if (c && c.url === url && Date.now() - c.at < 60_000) return { ok: c.ok, models: c.models };
    let ok = false; let models: string[] = [];
    if (typeof fetch !== 'undefined') {
      const AC: any = (globalThis as any).AbortController;
      const ctrl: any = typeof AC !== 'undefined' ? new AC() : null;
      const timer: any = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch { /* noop */ } }, 1200) : null;
      try {
        const r: any = await fetch(url.replace(/\/+$/, '') + '/models', { signal: ctrl ? ctrl.signal : undefined } as any);
        ok = !!r && r.status < 500; // any answer at all means something is listening
        if (ok) {
          const j: any = await r.json().catch(() => null);
          const rows: any[] = Array.isArray(j?.data) ? j.data : (Array.isArray(j?.models) ? j.models : []);
          models = rows.map((m: any) => String(m?.id || m?.name || '')).filter(Boolean);
        }
      } catch { ok = false; } finally { if (timer) clearTimeout(timer); }
    }
    this.localProbe = { at: Date.now(), url, ok, models };
    return { ok, models };
  }

  /**
   * Demote a Local engine that cannot actually serve the call, so it stops occupying a chain slot
   * and the operator is told which of the two problems they have:
   *   - nothing listening on the base URL  → unreachable
   *   - listening, but the model was never pulled → modelMissing
   * The second one is real: the seeded default is `llama3.1`, and an Ollama install without that
   * tag answers every request with "model 'llama3.1' not found".
   */
  private async withLocalReachability(plans: ProviderPlan[]): Promise<ProviderPlan[]> {
    const local = plans.find((p) => p.provider === 'local' && p.usable);
    if (!local) return plans;
    const probe = await this.probeLocal(local.baseUrl);
    if (!probe.ok) { local.usable = false; local.unreachable = true; return plans; }
    // Ollama reports tags ("llama3.1:latest"); match on the bare name too. An empty list means the
    // server did not tell us what it has — assume it can serve, rather than falsely demoting it.
    const has = (want: string) => probe.models.some((m) => m === want || m.split(':')[0] === want.split(':')[0]);
    if (probe.models.length && local.model && !has(local.model)) { local.usable = false; local.modelMissing = true; }
    return plans;
  }

  /**
   * The Anthropic model raw() (vision / forced tool-use) should use: the engine row's configured
   * model when it is set and still served, then the env override, then the shared default.
   * raw() is Anthropic-only with NO failover, so a retired id here kills the call outright —
   * this must never return one.
   */
  async anthropicModel(): Promise<string> {
    let row: any = null;
    try { row = await (this.prisma as any).llmEngine.findUnique({ where: { key: 'ANTHROPIC' } }); } catch { row = null; }
    for (const c of [row?.defaultModel, process.env.LABOR_AI_MODEL, process.env.ANTHROPIC_MODEL]) {
      if (c && !isRetiredModel(c)) return String(c);
    }
    return DEFAULT_ANTHROPIC_MODEL;
  }

  private toPlan(e: any): ProviderPlan | null {
    const provider = String(e?.provider || '').toLowerCase() as LlmProvider;
    if (!PROVIDERS.includes(provider)) return null;
    const apiKey = e?.credentialRef ? process.env[e.credentialRef] : undefined;
    const baseUrl = provider === 'local' ? (process.env.LOCAL_LLM_SERVER_URL || e?.baseUrl || undefined) : (e?.baseUrl || undefined);
    const hasCred = provider === 'local' ? !!baseUrl : !!apiKey;
    // Anthropic: honor the existing LABOR_AI_MODEL / ANTHROPIC_MODEL env (the model the app used before the
    // switchboard, e.g. a higher-output Sonnet/Opus) over the seeded default, so output limits match what worked.
    // The engine's defaultModel (set in the Engines & Routing UI) is the master switch; the ANTHROPIC_MODEL env
    // is only a fallback when no model is set on the engine row.
    // A retired id is treated as "no model set" at every level, so a stale row or a stale env var
    // falls through to the current default instead of hard-failing the call with model-not-found.
    const envModel = provider === 'anthropic' ? (process.env.LABOR_AI_MODEL || process.env.ANTHROPIC_MODEL) : undefined;
    const model = [e?.defaultModel, envModel].find((m) => m && !isRetiredModel(m)) || this.fallbackModel(provider);
    return {
      engineId: e?.id || '', key: e?.key || provider.toUpperCase(), provider,
      model, apiKey, baseUrl,
      enabled: !!e?.enabled, tier: e?.tier || 'PAID', usable: !!e?.enabled && hasCred,
    };
  }

  /** Built-in chain used before the engines are seeded (or if the tables don't exist yet). */
  private defaultChain(): ProviderPlan[] {
    return LLM_PROVIDER_DEFAULTS.map((d) => {
      const provider = d.provider;
      const apiKey = d.credentialRef ? process.env[d.credentialRef] : undefined;
      const baseUrl = provider === 'local' ? (process.env.LOCAL_LLM_SERVER_URL || d.baseUrl) : undefined;
      const hasCred = provider === 'local' ? !!baseUrl : !!apiKey;
      const enabled = provider === 'anthropic' || provider === 'local' ? true : !!apiKey;
      const envModel = provider === 'anthropic' ? (process.env.LABOR_AI_MODEL || process.env.ANTHROPIC_MODEL) : undefined;
      const model = (envModel && !isRetiredModel(envModel)) ? envModel : d.defaultModel;
      return { engineId: '', key: d.key, provider, model, apiKey, baseUrl, enabled, tier: d.tier, usable: enabled && hasCred };
    });
  }

  /** Ordered failover plan for a task. DB-driven; falls back to the in-code default chain. */
  async resolveChain(task?: string, projectId?: string): Promise<ProviderPlan[]> {
    const capability = this.capabilityForTask(task);
    let engines: any[] = [];
    let policy: any = null;
    try {
      engines = await (this.prisma as any).llmEngine.findMany();
      policy = await (this.prisma as any).llmRoutingPolicy.findFirst({ where: { scope: 'ORG', projectId: null, capability } });
      if (projectId) {
        const proj = await (this.prisma as any).llmRoutingPolicy.findFirst({ where: { scope: 'PROJECT', projectId, capability } });
        if (proj && (policy?.projectOverrideAllowed || proj.projectOverrideAllowed)) policy = proj;
      }
    } catch { engines = []; policy = null; }
    if (!engines.length) return this.withLocalReachability(this.defaultChain());
    const byId = new Map<string, any>(engines.map((e: any) => [e.id, e]));
    const chain: string[] = Array.isArray(policy?.fallbackChain) ? policy.fallbackChain : [];
    const ordered: any[] = [];
    for (const id of chain) { const e = byId.get(id); if (e) ordered.push(e); }
    const inChain = new Set(ordered.map((e) => e.id));
    const rest = engines.filter((e: any) => !inChain.has(e.id)).sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100));
    const plans = [...ordered, ...rest].map((e) => this.toPlan(e)).filter((p): p is ProviderPlan => !!p);
    return this.withLocalReachability(plans);
  }

  /** Non-secret view of the resolved chain for the admin/health UI. */
  async health() {
    const chain = await this.resolveChain();
    return {
      capability: 'LLM_DEFAULT',
      providers: chain.map((p) => ({
        key: p.key, provider: p.provider, model: p.model, tier: p.tier,
        enabled: p.enabled, usable: p.usable,
        unreachable: !!p.unreachable, // local: has a URL, but nothing answered on it
        modelMissing: !!p.modelMissing, // local: server is up, but this model was never pulled
        hasCredential: p.provider === 'local' ? !!p.baseUrl : !!p.apiKey,
      })),
    };
  }

  // ── telemetry (tier-aware) ────────────────────────────────────────────────────
  /** Usage this billing month (from provider-tagged AiRun rows) + tier-appropriate fields. */
  async engineStatus(key: string) {
    const e = await (this.prisma as any).llmEngine.findUnique({ where: { key: String(key).toUpperCase() } }).catch(() => null);
    if (!e) throw new NotFoundException('Unknown LLM engine "' + key + '".');
    const out: any = {
      key: e.key, provider: e.provider, enabled: e.enabled, tier: e.tier, defaultModel: e.defaultModel,
      models: e.models || [], credentialRef: e.credentialRef,
      hasCredential: e.provider === 'local' ? !!(process.env.LOCAL_LLM_SERVER_URL || e.baseUrl) : !!(e.credentialRef && process.env[e.credentialRef]),
    };
    const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
    try {
      // THE CACHE COLUMNS BELONG IN THIS TOTAL. inputTokens is only the uncached remainder once a
      // call carries a cache breakpoint, so summing the old two columns would make this meter drift
      // DOWNWARD as caching starts working — under-reporting against a cap, on the very screen whose
      // cap being set below the workload is what looked like an expensive pipeline. Cached tokens are
      // cheaper, not absent; a token cap counts tokens, and the cost view prices them (ai-cost.util).
      const agg = await (this.prisma as any).aiRun.aggregate({ _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheCreationTokens: true }, _count: true, where: { provider: e.provider, createdAt: { gte: since } } });
      out.tokensUsed = (agg?._sum?.inputTokens || 0) + (agg?._sum?.outputTokens || 0)
        + (agg?._sum?.cacheReadTokens || 0) + (agg?._sum?.cacheCreationTokens || 0);
      out.callsThisMonth = agg?._count || 0;
    } catch { out.tokensUsed = null; }
    // PLAN TYPE 3 — Ultimate free: suppress all counters.
    if (e.tier === 'ULTIMATE_FREE') { out.label = 'Ultimate Free — No limits'; return out; }
    // PLAN TYPE 1/2 — usage % against a user-set cap (no provider returns a live "plan limit").
    const cap = e.tier === 'LIMITED_FREE' ? e.freeTokenCap : e.monthlyTokenCap;
    if (cap && out.tokensUsed != null) {
      out.cap = cap;
      out.remaining = Math.max(0, cap - out.tokensUsed);
      out.percentageUsed = Math.min(100, Math.round((out.tokensUsed / cap) * 1000) / 10);
      out.low = out.tokensUsed / cap >= 0.85; // LIMITED_FREE warns when <15% remains
    }
    // Live balance for providers that actually expose one.
    if (e.enabled) { try { const bal = await this.providerBalance(e); if (bal != null) out.balance = bal; } catch (err: any) { out.balanceError = String(err?.message || err).slice(0, 120); } }
    return out;
  }

  /** Best-effort live balance for DeepSeek + OpenRouter (the two that expose it). */
  private async providerBalance(e: any): Promise<any> {
    if (typeof fetch === 'undefined') return null;
    const key = e?.credentialRef ? process.env[e.credentialRef] : undefined;
    if (!key) return null;
    const ctrl: any = typeof (globalThis as any).AbortController !== 'undefined' ? new (globalThis as any).AbortController() : null;
    const timer: any = ctrl ? setTimeout(() => { try { ctrl.abort(); } catch { /* noop */ } }, 8000) : null;
    try {
      if (e.provider === 'deepseek') {
        const r = await fetch('https://api.deepseek.com/user/balance', { headers: { authorization: 'Bearer ' + key }, signal: ctrl ? ctrl.signal : undefined } as any);
        if (timer) clearTimeout(timer);
        if (!r.ok) return null;
        const j: any = await r.json();
        const info = Array.isArray(j?.balance_infos) ? j.balance_infos[0] : null;
        return info ? { amount: info.total_balance, currency: info.currency, available: !!j?.is_available } : null;
      }
      if (e.provider === 'openrouter') {
        const r = await fetch('https://openrouter.ai/api/v1/credits', { headers: { authorization: 'Bearer ' + key }, signal: ctrl ? ctrl.signal : undefined } as any);
        if (timer) clearTimeout(timer);
        if (!r.ok) return null;
        const j: any = await r.json();
        const d = j?.data || {};
        return { totalCredits: d.total_credits, usage: d.total_usage, remaining: (d.total_credits != null && d.total_usage != null) ? d.total_credits - d.total_usage : null };
      }
      if (timer) clearTimeout(timer);
    } catch { if (timer) clearTimeout(timer); return null; }
    return null;
  }

  // ── routing policy CRUD (mirrors AudioRoutingPolicy) ──────────────────────────
  async getRouting(scope: string, projectId?: string) {
    let rows: any[] = [];
    try { rows = await (this.prisma as any).llmRoutingPolicy.findMany({ where: { scope, projectId: projectId || null } }); } catch { rows = []; }
    const byCap: Record<string, any> = {};
    for (const r of rows) byCap[r.capability] = r;
    return CAPABILITIES.map((capability) => byCap[capability] || { scope, projectId: projectId || null, capability, defaultEngineId: null, allowedEngineIds: [], fallbackChain: [], projectOverrideAllowed: false, userMayOverride: false });
  }

  async setRouting(capability: string, b: any) {
    if (!CAPABILITIES.includes(capability)) throw new BadRequestException('Unknown capability.');
    const scope = b?.scope === 'PROJECT' ? 'PROJECT' : 'ORG';
    const projectId = scope === 'PROJECT' ? (b?.projectId || null) : null;
    // Manual find→update/create: a compound-unique containing a null projectId can't be upserted.
    const existing = await (this.prisma as any).llmRoutingPolicy.findFirst({ where: { scope, projectId, capability } });
    const data: any = {
      defaultEngineId: b?.defaultEngineId || null,
      allowedEngineIds: b?.allowedEngineIds ?? [],
      fallbackChain: b?.fallbackChain ?? [],
      projectOverrideAllowed: !!b?.projectOverrideAllowed,
      userMayOverride: !!b?.userMayOverride,
      updatedById: b?.userId || null,
    };
    if (existing) return (this.prisma as any).llmRoutingPolicy.update({ where: { id: existing.id }, data });
    return (this.prisma as any).llmRoutingPolicy.create({ data: { scope, projectId, capability, ...data } });
  }

  async resolveAll(projectId?: string) {
    return { capabilities: CAPABILITIES, org: await this.getRouting('ORG'), project: projectId ? await this.getRouting('PROJECT', projectId) : null };
  }

  // ── Recent runs feed (AiRun ∪ VideoRun) — powers the AI Governance "Recent Runs" section ──
  private sizeBucket(t: number): string {
    if (!t || t < 1000) return 'Tiny';
    if (t < 5000) return 'Small';
    if (t < 15000) return 'Medium';
    if (t < 40000) return 'Large';
    if (t < 100000) return 'X-Large';
    return 'Massive';
  }

  /** Recent AI + video runs, normalized + filterable. Surface/purpose/stage parse from the task string. */
  async recentRuns(opts: { hours?: number; limit?: number; projectId?: string; surface?: string; status?: string; size?: string } = {}) {
    const hours = Math.min(Number(opts.hours) || 24, 24 * 30);
    const limit = Math.min(Number(opts.limit) || 80, 300);
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const where: any = { createdAt: { gte: since } };
    if (opts.projectId) where.projectId = opts.projectId;
    let ai: any[] = []; let vid: any[] = [];
    try { ai = await (this.prisma as any).aiRun.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit * 2 }); } catch { ai = []; }
    try { vid = await (this.prisma as any).videoRun.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit * 2 }); } catch { vid = []; }
    const norm: any[] = [];
    for (const r of ai) {
      const parts = String(r.task || '').split('.');
      const tokens = (r.inputTokens || 0) + (r.outputTokens || 0);
      norm.push({ kind: 'LLM', id: r.id, when: r.createdAt, surface: parts[0] || 'system', purpose: parts[1] || '', stage: parts.slice(2).join('.') || '', task: r.task, model: r.model, provider: r.provider || '', tokens, size: this.sizeBucket(tokens), status: r.status, result: r.status === 'DONE' ? 'success' : r.status === 'ERROR' ? 'error' : 'running', durationMs: r.latencyMs ?? null, confidence: r.confidence != null ? Number(r.confidence) : null, error: r.error || null });
    }
    for (const r of vid) {
      norm.push({ kind: 'VIDEO', id: r.id, when: r.createdAt, surface: 'video', purpose: 'render', stage: r.provider || '', task: 'video.render.' + (r.provider || ''), model: r.model, provider: r.provider || '', tokens: null, size: null, durationSec: r.durationSec ?? null, status: r.status, result: r.status === 'COMPLETED' ? 'success' : r.status === 'FAILED' ? 'error' : 'running', durationMs: r.latencyMs ?? null, videoUrl: r.videoUrl || null, error: r.error || null });
    }
    norm.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
    const surfaces = Array.from(new Set(norm.map((r) => r.surface).filter(Boolean))).sort();
    const models = Array.from(new Set(norm.map((r) => r.model).filter(Boolean))).sort();
    let rows = norm;
    if (opts.surface) rows = rows.filter((r) => r.surface === opts.surface);
    if (opts.status) rows = rows.filter((r) => r.result === opts.status || r.status === opts.status);
    if (opts.size) rows = rows.filter((r) => r.size === opts.size);
    return { runs: rows.slice(0, limit), total: norm.length, surfaces, models, sizes: ['Tiny', 'Small', 'Medium', 'Large', 'X-Large', 'Massive'], window: { hours } };
  }
}
