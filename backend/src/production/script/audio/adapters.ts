/**
 * SYS-13c — ScriptON Audio provider adapters.
 * One interface, many engines. The orchestrator only ever talks to AudioProviderAdapter,
 * so adding/swapping a provider never triggers redevelopment. Credentials are read from the
 * engine's `credentialRef` (an env-var name), never stored raw.
 */
export type Capability = 'tts' | 'sfx' | 'music' | 'dubbing';

export interface VoiceConfig {
  externalVoiceId?: string;
  model?: string;
  rate?: number;
  pitch?: number;
  style?: string;
  language?: string;
  stability?: number;
  similarity?: number;
  /** Emotion-driven delivery (from script parentheticals / punctuation). */
  styleAmount?: number;   // ElevenLabs style exaggeration 0..1
  speed?: number;         // ElevenLabs voice_settings.speed (~0.7–1.2)
  emotionTag?: string;    // normalized label, e.g. "excited" — v3 audio tag / OpenAI instructions
}

export interface Segment {
  id: string; kind: 'dialogue' | 'narration'; character?: string; text: string;
  /** Delivery/effect hint from the script's parenthetical, e.g. "angry", "over radio". */
  hint?: string;
}
export interface SynthResult { audio: Buffer; mime: string; charsBilled: number; durationMs?: number; timings?: any[]; }
export interface CostEstimate { charsBilled: number; unitCost: number; total: number; currency: string; }

/** A selectable voice in the provider's library (powers the casting dropdown). */
export interface VoiceOption {
  id: string;             // externalVoiceId to store on the profile
  name: string;
  gender?: string;        // male / female / neutral (provider label)
  age?: string;           // young / middle_aged / old
  accent?: string;
  language?: string;
  description?: string;
  useCase?: string;
  previewUrl?: string;    // audition sample
}

export interface AudioProviderAdapter {
  key: string;
  capabilities: Record<Capability, boolean>;
  /** TTS — billed per character. */
  synthesize?(seg: Segment, cfg: VoiceConfig): Promise<SynthResult>;
  /** Voices available in the provider's library (for casting dropdowns / auto-cast matching). */
  listVoices?(): Promise<VoiceOption[]>;
  /** Generated layers — billed per generation. */
  generateSfx?(prompt: string, opts: { durationMs?: number; loop?: boolean }): Promise<SynthResult>;
  generateMusic?(prompt: string, opts: { durationMs?: number; genre?: string }): Promise<SynthResult>;
}

const cred = (ref?: string | null) => (ref ? process.env[ref] || '' : '');

/** BROWSER — degenerate adapter. The client synthesizes (window.speechSynthesis); $0, no server call. */
export class BrowserAdapter implements AudioProviderAdapter {
  key = 'BROWSER';
  capabilities = { tts: true, sfx: false, music: false, dubbing: false };
  // No server-side synthesize: the orchestrator returns a render-plan the client executes.
}

/** ELEVENLABS — TTS + Sound Effects + Music (Eleven Music). One key, many capabilities. */
export class ElevenLabsAdapter implements AudioProviderAdapter {
  key = 'ELEVENLABS';
  capabilities = { tts: true, sfx: true, music: true, dubbing: true };
  constructor(private credentialRef?: string | null, private defaultModel?: string | null) {}

  private apiKey() { const k = cred(this.credentialRef) || process.env.ELEVENLABS_API_KEY; if (!k) throw new Error('ElevenLabs API key not configured (set the engine credentialRef env var).'); return k; }

  /** Voices in the account's library (premade + cloned). Powers the casting dropdown. */
  async listVoices(): Promise<VoiceOption[]> {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': this.apiKey() } });
    if (!r.ok) throw new Error(`ElevenLabs voices ${r.status}: ${await r.text().catch(() => '')}`);
    const data: any = await r.json();
    return ((data?.voices || []) as any[]).map((v) => ({
      id: v.voice_id,
      name: v.name,
      gender: v.labels?.gender || undefined,
      age: v.labels?.age || undefined,
      accent: v.labels?.accent || undefined,
      language: v.labels?.language || undefined,
      description: v.labels?.descriptive || v.labels?.description || v.description || undefined,
      useCase: v.labels?.use_case || undefined,
      previewUrl: v.preview_url || undefined,
    }));
  }

  async synthesize(seg: Segment, cfg: VoiceConfig): Promise<SynthResult> {
    const voice = cfg.externalVoiceId; if (!voice) throw new Error('No ElevenLabs voice id on this assignment.');
    const model = cfg.model || this.defaultModel || 'eleven_multilingual_v2';
    // v3 models take inline audio tags ([excited] …); v2 models take voice_settings modulation.
    const isV3 = /v3/i.test(model);
    const text = isV3 && cfg.emotionTag ? `[${cfg.emotionTag}] ${seg.text}` : seg.text;
    const vs: any = { stability: cfg.stability ?? 0.5, similarity_boost: cfg.similarity ?? 0.75, style: cfg.styleAmount ?? 0, use_speaker_boost: true };
    if (cfg.speed && !isV3) vs.speed = Math.min(1.2, Math.max(0.7, cfg.speed));
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey(), 'Content-Type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model, voice_settings: vs }),
    });
    if (!r.ok) throw new Error(`ElevenLabs TTS ${r.status}: ${await r.text().catch(() => '')}`);
    return { audio: Buffer.from(await r.arrayBuffer()), mime: 'audio/mpeg', charsBilled: seg.text.length };
  }

  async generateSfx(prompt: string, opts: { durationMs?: number }): Promise<SynthResult> {
    const r = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST', headers: { 'xi-api-key': this.apiKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt, duration_seconds: opts.durationMs ? opts.durationMs / 1000 : undefined }),
    });
    if (!r.ok) throw new Error(`ElevenLabs SFX ${r.status}`);
    return { audio: Buffer.from(await r.arrayBuffer()), mime: 'audio/mpeg', charsBilled: 0, durationMs: opts.durationMs };
  }

  async generateMusic(prompt: string, opts: { durationMs?: number }): Promise<SynthResult> {
    const r = await fetch('https://api.elevenlabs.io/v1/music', {
      method: 'POST', headers: { 'xi-api-key': this.apiKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, music_length_ms: opts.durationMs }),
    });
    if (!r.ok) throw new Error(`ElevenLabs Music ${r.status}`);
    return { audio: Buffer.from(await r.arrayBuffer()), mime: 'audio/mpeg', charsBilled: 0, durationMs: opts.durationMs };
  }
}

/** OPENAI — TTS only (allowed alternate voice engine). */
export class OpenAiAdapter implements AudioProviderAdapter {
  key = 'OPENAI';
  capabilities = { tts: true, sfx: false, music: false, dubbing: false };
  constructor(private credentialRef?: string | null, private defaultModel?: string | null) {}
  private apiKey() { const k = cred(this.credentialRef) || process.env.OPENAI_API_KEY; if (!k) throw new Error('OpenAI API key not configured.'); return k; }

  /** OpenAI TTS has a fixed, named voice set (no per-account library API). */
  async listVoices(): Promise<VoiceOption[]> {
    return [
      { id: 'alloy', name: 'Alloy', gender: 'neutral' }, { id: 'ash', name: 'Ash', gender: 'male' },
      { id: 'coral', name: 'Coral', gender: 'female' }, { id: 'echo', name: 'Echo', gender: 'male' },
      { id: 'fable', name: 'Fable', gender: 'neutral', accent: 'british' }, { id: 'nova', name: 'Nova', gender: 'female' },
      { id: 'onyx', name: 'Onyx', gender: 'male', age: 'middle_aged' }, { id: 'sage', name: 'Sage', gender: 'female' },
      { id: 'shimmer', name: 'Shimmer', gender: 'female' },
    ];
  }

  async synthesize(seg: Segment, cfg: VoiceConfig): Promise<SynthResult> {
    const body: any = { model: cfg.model || this.defaultModel || 'gpt-4o-mini-tts', voice: cfg.externalVoiceId || 'alloy', input: seg.text, response_format: 'mp3', speed: cfg.rate ?? 1 };
    if (cfg.emotionTag) body.instructions = `Deliver the line in a ${cfg.emotionTag} tone.`; // supported by gpt-4o-mini-tts
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${this.apiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`OpenAI TTS ${r.status}: ${await r.text().catch(() => '')}`);
    return { audio: Buffer.from(await r.arrayBuffer()), mime: 'audio/mpeg', charsBilled: seg.text.length };
  }
}

/** Build the adapter for an engine row. */
export function buildAdapter(engine: { key: string; credentialRef?: string | null; defaultModel?: string | null }): AudioProviderAdapter {
  switch (engine.key) {
    case 'ELEVENLABS': return new ElevenLabsAdapter(engine.credentialRef, engine.defaultModel);
    case 'OPENAI': return new OpenAiAdapter(engine.credentialRef, engine.defaultModel);
    case 'BROWSER': default: return new BrowserAdapter();
  }
}
