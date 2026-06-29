import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Video Engines & Routing — the render-side mirror of LlmRoutingService / AudioEnginesService.
 * Holds the registry of video providers (Local ComfyUI / Runway / + custom), the per-capability
 * failover order, and on/live status. VideoService asks this service for an ordered failover chain
 * on every render. Editable like the LLM engines (full CRUD + routing). Tolerant pre-db:push: every
 * Prisma access is guarded and a built-in default chain is used until the tables are seeded.
 *
 * New-model Prisma access is via `(this.prisma as any)` until `prisma generate` runs after the
 * VideoEngine/VideoRoutingPolicy migration — consistent with the rest of the ScriptON services.
 */

export type VideoProvider = 'local_comfy' | 'runway' | 'seedance' | 'luma' | 'kling';

export interface VideoProviderPlan {
  engineId: string;
  key: string;
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  tier: string;
  usable: boolean; // enabled AND has a credential (or a Local server URL)
}

const CAPABILITIES = ['VIDEO_DEFAULT', 'PREVIEW', 'FINAL'];
const VIDEO_PROVIDERS = ['local_comfy', 'runway', 'seedance', 'luma', 'kling'];

/** Built-in provider catalog — what each is for + sane default models + priority. */
export const VIDEO_PROVIDER_DEFAULTS: Array<{
  key: string; provider: VideoProvider; displayName: string; credentialRef: string | null;
  tier: string; defaultModel: string; priority: number; baseUrl?: string;
  models: { id: string; label: string; hint: string; tier: 'free' | 'paid' }[];
}> = [
  { key: 'LOCAL_COMFY', provider: 'local_comfy', displayName: 'Local ComfyUI (RTX)', credentialRef: null, tier: 'ULTIMATE_FREE', defaultModel: 'comfy-workflow', priority: 10, baseUrl: 'http://127.0.0.1:8188',
    models: [
      { id: 'comfy-workflow', label: 'ComfyUI workflow — your graph', hint: '9:16 text-to-video via your exported API-format workflow (COMFYUI_WORKFLOW_PATH)', tier: 'free' },
    ] },
  { key: 'RUNWAY', provider: 'runway', displayName: 'Runway Gen-4.5', credentialRef: 'RUNWAYML_API_SECRET', tier: 'PAID', defaultModel: 'gen4.5', priority: 20,
    models: [
      { id: 'gen4.5', label: 'Gen-4.5 — text/image-to-video', hint: '720:1280 vertical · api.dev.runwayml.com', tier: 'paid' },
    ] },
  { key: 'SEEDANCE', provider: 'seedance', displayName: 'Seedance 2.0 (ByteDance)', credentialRef: 'FAL_KEY', tier: 'PAID', defaultModel: 'bytedance/seedance-2.0/text-to-video', priority: 30, baseUrl: 'https://queue.fal.run',
    models: [
      { id: 'bytedance/seedance-2.0/text-to-video', label: 'Seedance 2.0 — text-to-video', hint: '720p · 4-15s · 9:16/16:9 · native audio · via fal.ai (queue)', tier: 'paid' },
      { id: 'bytedance/seedance-2.0/fast/text-to-video', label: 'Seedance 2.0 Fast — text-to-video', hint: 'cheaper / faster tier · via fal.ai', tier: 'paid' },
      { id: 'bytedance/seedance-2.0/image-to-video', label: 'Seedance 2.0 — image-to-video', hint: 'animate a still frame · via fal.ai', tier: 'paid' },
    ] },
];

@Injectable()
export class VideoEnginesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  /** Refresh the provider catalog on every boot so the Engines UI dropdowns reflect the latest models. */
  async onModuleInit(): Promise<void> { try { await this.seedDefaults(); } catch { /* tolerant: pre-db:push / transient DB */ } }

  // ── catalog / seed ───────────────────────────────────────────────────────────
  /** Seed the providers (Local ComfyUI enabled; cloud present but disabled) + a default chain. */
  async seedDefaults() {
    for (const d of VIDEO_PROVIDER_DEFAULTS) {
      const existing = await (this.prisma as any).videoEngine.findUnique({ where: { key: d.key } }).catch(() => null);
      if (existing) continue;
      const enabled = d.provider === 'local_comfy';
      await (this.prisma as any).videoEngine.create({ data: {
        key: d.key, provider: d.provider, displayName: d.displayName, tier: d.tier, enabled,
        credentialRef: d.credentialRef, defaultModel: d.defaultModel, priority: d.priority,
        baseUrl: d.provider === 'local_comfy' ? (process.env.COMFYUI_BASE_URL || d.baseUrl || null) : (d.baseUrl || null),
        models: d.models as any, capabilities: { text_to_video: true, image_to_video: d.provider === 'runway' || d.provider === 'seedance' },
      } });
    }
    const engines = await (this.prisma as any).videoEngine.findMany({ orderBy: { priority: 'asc' } });
    const existingPolicy = await (this.prisma as any).videoRoutingPolicy.findFirst({ where: { scope: 'ORG', projectId: null, capability: 'VIDEO_DEFAULT' } }).catch(() => null);
    if (!existingPolicy) {
      await (this.prisma as any).videoRoutingPolicy.create({ data: {
        scope: 'ORG', projectId: null, capability: 'VIDEO_DEFAULT',
        defaultEngineId: engines.find((e: any) => e.key === 'LOCAL_COMFY')?.id || engines[0]?.id || null,
        allowedEngineIds: engines.map((e: any) => e.id), fallbackChain: engines.map((e: any) => e.id),
        projectOverrideAllowed: false, userMayOverride: false,
      } });
    }
    // Idempotent refresh: keep existing engines' model catalogs current (so the UI dropdown shows the latest).
    for (const d of VIDEO_PROVIDER_DEFAULTS) {
      const ex = await (this.prisma as any).videoEngine.findUnique({ where: { key: d.key } }).catch(() => null);
      if (!ex) continue;
      await (this.prisma as any).videoEngine.update({ where: { id: ex.id }, data: { models: d.models as any, credentialRef: d.credentialRef } }).catch(() => {});
    }
    return this.listEngines();
  }

  listEngines() { return (this.prisma as any).videoEngine.findMany({ orderBy: [{ priority: 'asc' }, { displayName: 'asc' }] }); }
  getEngine(id: string) { return (this.prisma as any).videoEngine.findUnique({ where: { id } }); }

  createEngine(b: any) {
    if (!b?.key || !b?.provider || !b?.displayName) throw new BadRequestException('key, provider and displayName are required.');
    if (!VIDEO_PROVIDERS.includes(String(b.provider).toLowerCase())) throw new BadRequestException('provider must be one of: ' + VIDEO_PROVIDERS.join(', '));
    return (this.prisma as any).videoEngine.create({ data: {
      key: String(b.key).toUpperCase(), provider: String(b.provider).toLowerCase(), displayName: b.displayName,
      tier: b.tier || 'PAID', enabled: !!b.enabled, credentialRef: b.credentialRef || null, baseUrl: b.baseUrl || null,
      defaultModel: b.defaultModel || null, models: b.models ?? null, capabilities: b.capabilities ?? { text_to_video: true, image_to_video: false },
      priority: typeof b.priority === 'number' ? b.priority : 100, costModel: b.costModel ?? null, notes: b.notes || null,
    } });
  }
  updateEngine(id: string, b: any) {
    const d: any = {};
    for (const k of ['displayName', 'provider', 'tier', 'enabled', 'credentialRef', 'baseUrl', 'defaultModel', 'models', 'capabilities', 'priority', 'costModel', 'status', 'notes']) if (b?.[k] !== undefined) d[k] = b[k];
    if (d.provider) d.provider = String(d.provider).toLowerCase();
    return (this.prisma as any).videoEngine.update({ where: { id }, data: d });
  }
  removeEngine(id: string) { return (this.prisma as any).videoEngine.delete({ where: { id } }); }

  // ── failover chain resolution (consumed by VideoService.generateShot) ─────────
  capabilityForTask(_task?: string): string { return 'VIDEO_DEFAULT'; }

  private fallbackModel(provider: string): string {
    const d = VIDEO_PROVIDER_DEFAULTS.find((x) => x.provider === provider);
    return d?.defaultModel || 'gen4.5';
  }

  private toPlan(e: any): VideoProviderPlan | null {
    const provider = String(e?.provider || '').toLowerCase();
    if (!provider) return null;
    const apiKey = e?.credentialRef ? process.env[e.credentialRef] : undefined;
    const baseUrl = provider === 'local_comfy' ? (process.env.COMFYUI_BASE_URL || e?.baseUrl || undefined) : (e?.baseUrl || undefined);
    const hasCred = provider === 'local_comfy' ? !!baseUrl : !!apiKey;
    const model = e?.defaultModel || this.fallbackModel(provider);
    return {
      engineId: e?.id || '', key: e?.key || provider.toUpperCase(), provider, model, apiKey, baseUrl,
      enabled: !!e?.enabled, tier: e?.tier || 'PAID', usable: !!e?.enabled && hasCred,
    };
  }

  /** Built-in chain used before the engines are seeded (or if the tables don't exist yet). */
  private defaultChain(): VideoProviderPlan[] {
    return VIDEO_PROVIDER_DEFAULTS.map((d) => {
      const provider = d.provider;
      const apiKey = d.credentialRef ? process.env[d.credentialRef] : undefined;
      const baseUrl = provider === 'local_comfy' ? (process.env.COMFYUI_BASE_URL || d.baseUrl) : undefined;
      const hasCred = provider === 'local_comfy' ? !!baseUrl : !!apiKey;
      const enabled = provider === 'local_comfy' ? true : !!apiKey;
      return { engineId: '', key: d.key, provider, model: d.defaultModel, apiKey, baseUrl, enabled, tier: d.tier, usable: enabled && hasCred };
    });
  }

  /** Ordered failover plan for a task. DB-driven; falls back to the in-code default chain. */
  async resolveChain(task?: string, projectId?: string): Promise<VideoProviderPlan[]> {
    const capability = this.capabilityForTask(task);
    let engines: any[] = [];
    let policy: any = null;
    try {
      engines = await (this.prisma as any).videoEngine.findMany();
      policy = await (this.prisma as any).videoRoutingPolicy.findFirst({ where: { scope: 'ORG', projectId: null, capability } });
      if (projectId) {
        const proj = await (this.prisma as any).videoRoutingPolicy.findFirst({ where: { scope: 'PROJECT', projectId, capability } });
        if (proj && (policy?.projectOverrideAllowed || proj.projectOverrideAllowed)) policy = proj;
      }
    } catch { engines = []; policy = null; }
    if (!engines.length) return this.defaultChain();
    const byId = new Map<string, any>(engines.map((e: any) => [e.id, e]));
    const chain: string[] = Array.isArray(policy?.fallbackChain) ? policy.fallbackChain : [];
    const ordered: any[] = [];
    for (const id of chain) { const e = byId.get(id); if (e) ordered.push(e); }
    const inChain = new Set(ordered.map((e) => e.id));
    const rest = engines.filter((e: any) => !inChain.has(e.id)).sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100));
    return [...ordered, ...rest].map((e) => this.toPlan(e)).filter((p): p is VideoProviderPlan => !!p);
  }

  /** Non-secret view of the resolved chain for the admin/health UI (the on/live indicator). */
  async health() {
    const chain = await this.resolveChain();
    return {
      capability: 'VIDEO_DEFAULT',
      providers: chain.map((p) => ({
        key: p.key, provider: p.provider, model: p.model, tier: p.tier,
        enabled: p.enabled, usable: p.usable,
        hasCredential: p.provider === 'local_comfy' ? !!p.baseUrl : !!p.apiKey,
      })),
    };
  }

  /** Per-engine on/live status for the Engines UI. */
  async engineStatus(key: string) {
    const e = await (this.prisma as any).videoEngine.findUnique({ where: { key: String(key).toUpperCase() } }).catch(() => null);
    if (!e) throw new NotFoundException('Unknown video engine "' + key + '".');
    const hasCredential = e.provider === 'local_comfy'
      ? !!(process.env.COMFYUI_BASE_URL || e.baseUrl)
      : !!(e.credentialRef && process.env[e.credentialRef]);
    const out: any = {
      key: e.key, provider: e.provider, enabled: e.enabled, tier: e.tier, defaultModel: e.defaultModel,
      models: e.models || [], credentialRef: e.credentialRef, baseUrl: e.baseUrl,
      hasCredential, live: !!e.enabled && hasCredential,
    };
    if (e.provider === 'local_comfy') out.workflowConfigured = !!process.env.COMFYUI_WORKFLOW_PATH;
    return out;
  }

  // ── routing policy CRUD (mirrors LlmRoutingPolicy) ────────────────────────────
  async getRouting(scope: string, projectId?: string) {
    let rows: any[] = [];
    try { rows = await (this.prisma as any).videoRoutingPolicy.findMany({ where: { scope, projectId: projectId || null } }); } catch { rows = []; }
    const byCap: Record<string, any> = {};
    for (const r of rows) byCap[r.capability] = r;
    return CAPABILITIES.map((capability) => byCap[capability] || { scope, projectId: projectId || null, capability, defaultEngineId: null, allowedEngineIds: [], fallbackChain: [], projectOverrideAllowed: false, userMayOverride: false });
  }

  async setRouting(capability: string, b: any) {
    if (!CAPABILITIES.includes(capability)) throw new BadRequestException('Unknown capability.');
    const scope = b?.scope === 'PROJECT' ? 'PROJECT' : 'ORG';
    const projectId = scope === 'PROJECT' ? (b?.projectId || null) : null;
    // Manual find→update/create: a compound-unique containing a null projectId can't be upserted.
    const existing = await (this.prisma as any).videoRoutingPolicy.findFirst({ where: { scope, projectId, capability } });
    const data: any = {
      defaultEngineId: b?.defaultEngineId || null,
      allowedEngineIds: b?.allowedEngineIds ?? [],
      fallbackChain: b?.fallbackChain ?? [],
      projectOverrideAllowed: !!b?.projectOverrideAllowed,
      userMayOverride: !!b?.userMayOverride,
      updatedById: b?.userId || null,
    };
    if (existing) return (this.prisma as any).videoRoutingPolicy.update({ where: { id: existing.id }, data });
    return (this.prisma as any).videoRoutingPolicy.create({ data: { scope, projectId, capability, ...data } });
  }

  async resolveAll(projectId?: string) {
    return { capabilities: CAPABILITIES, org: await this.getRouting('ORG'), project: projectId ? await this.getRouting('PROJECT', projectId) : null };
  }
}
