import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { buildAdapter, VoiceOption, VoiceSearch } from './adapters';

/** Curated model catalog per engine — what each is FOR, so admins pick by intent. */
export const ENGINE_MODELS: Record<string, { id: string; label: string; hint: string }[]> = {
  ELEVENLABS: [
    { id: 'eleven_v3', label: 'Eleven v3 — flagship', hint: 'Richest emotion via audio tags, dialogue mode, 70+ languages' },
    { id: 'eleven_multilingual_v2', label: 'Multilingual v2 — stable', hint: 'Proven quality, voice-settings modulation, 29 languages' },
    { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5 — balanced', hint: 'Low latency + language pinning (language_code)' },
    { id: 'eleven_flash_v2_5', label: 'Flash v2.5 — fastest', hint: '~75ms latency, best for live reading on a budget' },
  ],
  OPENAI: [
    { id: 'gpt-4o-mini-tts', label: 'GPT-4o mini TTS', hint: 'Free-text voice direction (accents, emotions via instructions)' },
    { id: 'tts-1-hd', label: 'TTS-1 HD', hint: 'Higher fidelity, no instructions' },
    { id: 'tts-1', label: 'TTS-1', hint: 'Fastest/cheapest OpenAI voice' },
  ],
  LOCAL: [
    { id: 'chatterbox', label: 'Chatterbox (local)', hint: 'MIT, emotion exaggeration + voice cloning — chatterbox-tts-api server' },
    { id: 'piper', label: 'Piper (local)', hint: '900+ voices, ultra-fast CPU — via openedai-speech server' },
    { id: 'melo', label: 'MeloTTS (local)', hint: 'Multi-language + English accents (US/UK/AU/IN), real-time CPU' },
  ],
};

const CAPABILITIES = ['LIVE_READ', 'TTS', 'SFX', 'MUSIC', 'DUBBING'];

/**
 * SYS-13c — Audio engines registry + per-capability routing policy.
 * The free Browser engine is a seeded, always-available peer; Tier-1 engines (ElevenLabs,
 * OpenAI, …) are added by an admin. Routing decides, per capability, the default engine +
 * allowed alternates, with admin-gated project override and per-render override (off by default).
 */
@Injectable()
export class AudioEnginesService {
  constructor(private prisma: PrismaService) {}

  /** Ensure the free Browser engine exists (idempotent). */
  async seedDefaults() {
    const exists = await this.prisma.audioEngine.findUnique({ where: { key: 'BROWSER' } });
    if (!exists) {
      await this.prisma.audioEngine.create({
        data: { key: 'BROWSER', displayName: 'Live Reader (Browser)', tier: 'LIVE', enabled: true,
          capabilities: { tts: true, sfx: false, music: false, dubbing: false }, costModel: { tts: { unit: 'CHAR', rate: 0 }, currency: 'USD' } },
      });
    }
    // pre-seed disabled studio engines so admins just add a key + enable
    for (const e of [
      { key: 'ELEVENLABS', displayName: 'ElevenLabs', caps: { tts: true, sfx: true, music: true, dubbing: true }, cloning: true, credentialRef: 'ELEVENLABS_API_KEY', defaultModel: 'eleven_v3' },
      { key: 'OPENAI', displayName: 'OpenAI', caps: { tts: true, sfx: false, music: false, dubbing: false }, cloning: false, credentialRef: 'OPENAI_API_KEY' },
      { key: 'LOCAL', displayName: 'Local server (free)', caps: { tts: true, sfx: false, music: false, dubbing: false }, cloning: true, credentialRef: null, defaultModel: 'chatterbox', baseUrl: 'http://localhost:4123', included: true },
    ]) {
      const r = await this.prisma.audioEngine.findUnique({ where: { key: e.key } });
      if (!r) await this.prisma.audioEngine.create({ data: {
        key: e.key, displayName: e.displayName, tier: 'STUDIO', enabled: false, supportsCloning: e.cloning,
        credentialRef: e.credentialRef, baseUrl: (e as any).baseUrl || null, defaultModel: (e as any).defaultModel || null, capabilities: e.caps,
        costModel: (e as any).included
          ? { billing: 'INCLUDED', tts: { unit: 'CHAR', rate: 0 }, currency: 'USD' }
          : { tts: { unit: 'CHAR', rate: e.key === 'ELEVENLABS' ? 0.00018 : 0.000015 }, sfx: { unit: 'GENERATION', rate: 0.08 }, music: { unit: 'GENERATION', rate: 0.2 }, currency: 'USD' },
      } });
    }
    return this.listEngines();
  }

  listEngines() { return this.prisma.audioEngine.findMany({ orderBy: [{ tier: 'asc' }, { displayName: 'asc' }] }); }
  getEngine(id: string) { return this.prisma.audioEngine.findUnique({ where: { id } }); }

  /** Voices available in an engine's library (ElevenLabs account voices, OpenAI fixed set, …). */
  async listEngineVoices(key: string): Promise<VoiceOption[]> {
    const engine = await this.prisma.audioEngine.findUnique({ where: { key: String(key).toUpperCase() } });
    if (!engine) throw new NotFoundException(`Unknown audio engine "${key}".`);
    const adapter = buildAdapter(engine as any);
    if (!adapter.listVoices) return []; // BROWSER: the client enumerates window.speechSynthesis voices itself
    try { return await adapter.listVoices(); }
    catch (e: any) { throw new BadRequestException(e?.message || `Could not fetch voices for ${engine.displayName}.`); }
  }

  createEngine(b: any) {
    if (!b?.key || !b?.displayName) throw new BadRequestException('key and displayName are required.');
    return this.prisma.audioEngine.create({ data: {
      key: String(b.key).toUpperCase(), displayName: b.displayName, tier: b.tier === 'LIVE' ? 'LIVE' : 'STUDIO',
      enabled: !!b.enabled, credentialRef: b.credentialRef || null, capabilities: b.capabilities ?? null,
      defaultModel: b.defaultModel || null, supportsCloning: !!b.supportsCloning, costModel: b.costModel ?? null,
      rateLimit: b.rateLimit ?? null, roleAllowList: b.roleAllowList ?? null,
    } });
  }
  updateEngine(id: string, b: any) {
    const d: any = {};
    for (const k of ['displayName', 'tier', 'enabled', 'credentialRef', 'baseUrl', 'capabilities', 'defaultModel', 'supportsCloning', 'costModel', 'rateLimit', 'roleAllowList', 'status']) if (b?.[k] !== undefined) d[k] = b[k];
    return this.prisma.audioEngine.update({ where: { id }, data: d });
  }
  removeEngine(id: string) { return this.prisma.audioEngine.delete({ where: { id } }); }

  /** Search the engine's FULL voice library (shared voices) with label filters. */
  async searchEngineVoices(key: string, f: VoiceSearch): Promise<VoiceOption[]> {
    const engine = await this.prisma.audioEngine.findUnique({ where: { key: String(key).toUpperCase() } });
    if (!engine) throw new NotFoundException(`Unknown audio engine "${key}".`);
    const adapter: any = buildAdapter(engine as any);
    if (!adapter.searchVoices) {
      // Engines without a shared library (LOCAL, OPENAI): filter their own catalog by the same criteria.
      const all = await this.listEngineVoices(key);
      const n = (s?: string) => String(s || '').toLowerCase();
      return all.filter((v: any) =>
        (!f.gender || n(v.gender).includes(n(f.gender))) &&
        (!f.age || n(v.age).includes(n(f.age))) &&
        (!f.accent || n(v.accent).includes(n(f.accent))) &&
        (!f.language || n(v.language).includes(n(f.language))) &&
        (!f.search || `${n(v.name)} ${n(v.description)}`.includes(n(f.search))));
    }
    try { return await adapter.searchVoices(f); }
    catch (e: any) { throw new BadRequestException(e?.message || 'Voice library search failed.'); }
  }

  /** Add a shared-library voice to the provider account (so it becomes castable). */
  async addEngineVoice(key: string, b: { publicOwnerId: string; voiceId: string; name: string }) {
    const engine = await this.prisma.audioEngine.findUnique({ where: { key: String(key).toUpperCase() } });
    if (!engine) throw new NotFoundException(`Unknown audio engine "${key}".`);
    const adapter: any = buildAdapter(engine as any);
    if (!adapter.addSharedVoice) throw new BadRequestException('This engine has no shared voice library.');
    if (!b?.publicOwnerId || !b?.voiceId) throw new BadRequestException('publicOwnerId and voiceId are required.');
    try { const id = await adapter.addSharedVoice(b.publicOwnerId, b.voiceId, b.name || 'TFM voice'); return { voiceId: id }; }
    catch (e: any) { throw new BadRequestException(e?.message || 'Could not add the voice.'); }
  }

  /** Engine health for the admin page + studio: credits, voice count, model catalog. */
  async engineStatus(key: string) {
    const engine = await this.prisma.audioEngine.findUnique({ where: { key: String(key).toUpperCase() } });
    if (!engine) throw new NotFoundException(`Unknown audio engine "${key}".`);
    const adapter: any = buildAdapter(engine as any);
    const out: any = { key: engine.key, enabled: engine.enabled, defaultModel: engine.defaultModel, models: ENGINE_MODELS[engine.key] || [] };
    if (engine.enabled && adapter.accountStatus) {
      try { out.credits = await adapter.accountStatus(); } catch (e: any) { out.creditsError = String(e?.message || e).slice(0, 120); }
    }
    if (engine.enabled && adapter.listVoices) {
      try { out.voiceCount = (await adapter.listVoices()).length; } catch { /* non-fatal */ }
    }
    return out;
  }

  // ── Routing policy ──────────────────────────────────────────────────────────
  async getRouting(scope: string, projectId?: string) {
    const rows = await this.prisma.audioRoutingPolicy.findMany({ where: { scope, projectId: projectId || null } });
    const byCap: Record<string, any> = {};
    for (const r of rows) byCap[r.capability] = r;
    return CAPABILITIES.map((capability) => byCap[capability] || { scope, projectId: projectId || null, capability, defaultEngineId: null, allowedEngineIds: [], fallbackChain: [], projectOverrideAllowed: false, userMayOverride: false });
  }

  async setRouting(capability: string, b: any) {
    if (!CAPABILITIES.includes(capability)) throw new BadRequestException('Unknown capability.');
    const scope = b?.scope === 'PROJECT' ? 'PROJECT' : 'ORG';
    const projectId = scope === 'PROJECT' ? (b?.projectId || null) : null;
    // Manual find→update/create: Prisma can't match a compound-unique that contains a null
    // (projectId is null for ORG scope), so upsert would throw.
    const existing = await this.prisma.audioRoutingPolicy.findFirst({ where: { scope, projectId, capability } });
    const data: any = {
      defaultEngineId: b?.defaultEngineId || null,
      allowedEngineIds: b?.allowedEngineIds ?? [],
      fallbackChain: b?.fallbackChain ?? [],
      projectOverrideAllowed: !!b?.projectOverrideAllowed,
      userMayOverride: !!b?.userMayOverride,
      updatedById: b?.userId || null,
    };
    if (existing) return this.prisma.audioRoutingPolicy.update({ where: { id: existing.id }, data });
    return this.prisma.audioRoutingPolicy.create({ data: { scope, projectId, capability, ...data } });
  }

  /** Effective routing for a capability at a project: PROJECT override (if allowed) → ORG → Browser fallback. */
  async resolve(capability: string, projectId?: string) {
    const org = await this.prisma.audioRoutingPolicy.findFirst({ where: { scope: 'ORG', projectId: null, capability } }).catch(() => null);
    let policy: any = org;
    if (projectId) {
      const proj = await this.prisma.audioRoutingPolicy.findFirst({ where: { scope: 'PROJECT', projectId, capability } }).catch(() => null);
      if (proj && (org?.projectOverrideAllowed || proj.projectOverrideAllowed)) policy = proj;
    }
    const engines = await this.listEngines();
    const byId = new Map(engines.map((e) => [e.id, e]));
    let chosen = policy?.defaultEngineId ? byId.get(policy.defaultEngineId) : null;
    // fallback to first enabled engine that supports the capability (Browser for LIVE_READ/TTS)
    if (!chosen || !chosen.enabled) {
      const capKey = capability === 'LIVE_READ' ? 'tts' : capability.toLowerCase();
      chosen = engines.find((e) => e.enabled && (e.capabilities as any)?.[capKey]) || engines.find((e) => e.key === 'BROWSER') || null;
    }
    const allowedIds: string[] = (policy?.allowedEngineIds as string[]) || [];
    return {
      capability,
      engine: chosen ? { id: chosen.id, key: chosen.key, displayName: chosen.displayName, tier: chosen.tier } : null,
      allowed: engines.filter((e) => allowedIds.includes(e.id)).map((e) => ({ id: e.id, key: e.key, displayName: e.displayName })),
      userMayOverride: !!policy?.userMayOverride,
      locked: !policy?.userMayOverride,
    };
  }

  /** Whole-revision resolution summary the UI shows (read-only unless userMayOverride). */
  async resolveAll(projectId?: string) {
    const out: Record<string, any> = {};
    for (const c of CAPABILITIES) out[c] = await this.resolve(c, projectId);
    return out;
  }
}
