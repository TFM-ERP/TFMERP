import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * SYS-13c — Sound layers. Heuristic ($0, on-machine) cue suggestion over scene text, plus cue
 * CRUD/approve. Suggested cues carry a genPrompt so a capable engine (ElevenLabs Sound Effects /
 * Music) can generate the audio at render time; uploaded/library assets are used as-is.
 */
@Injectable()
export class LayersService {
  constructor(private prisma: PrismaService) {}

  private AMBIENCE: [RegExp, string][] = [
    [/\b(rain|storm|thunder|downpour)\b/i, 'rain ambience with distant thunder'],
    [/\b(beach|ocean|sea|waves|shore)\b/i, 'ocean waves on a beach'],
    [/\b(forest|woods|jungle)\b/i, 'forest ambience, birds and wind'],
    [/\b(desert|dunes|sand)\b/i, 'desert wind over open dunes'],
    [/\b(city|street|traffic|downtown)\b/i, 'busy city street with traffic'],
    [/\b(office)\b/i, 'quiet office room tone, distant keyboards'],
    [/\b(restaurant|cafe|café|diner|bar)\b/i, 'busy restaurant ambience, chatter and cutlery'],
    [/\b(airport|terminal)\b/i, 'airport terminal ambience with announcements'],
    [/\b(hospital|clinic)\b/i, 'hospital corridor ambience, faint monitors'],
    [/\b(warehouse|factory)\b/i, 'large empty warehouse hum'],
    [/\b(crowd|stadium|party)\b/i, 'large crowd murmur'],
  ];
  private SFX: [RegExp, string][] = [
    [/\b(gun ?shot|fires?|shoots?)\b/i, 'single gunshot'],
    [/\b(door)\b/i, 'door opening and closing'],
    [/\b(phone|rings?)\b/i, 'phone ringing'],
    [/\b(car|engine|drives?)\b/i, 'car engine starting and driving off'],
    [/\b(glass|shatters?|breaks?)\b/i, 'glass shattering'],
    [/\b(explos|blast)\b/i, 'large explosion'],
    [/\b(footsteps?|runs?|walks?)\b/i, 'footsteps on a hard floor'],
    [/\b(thunder)\b/i, 'thunder crack'],
  ];

  listCues(revisionId: string) {
    return this.prisma.sceneAudioCue.findMany({ where: { revisionId, status: { not: 'REMOVED' } }, orderBy: [{ sceneNumber: 'asc' }, { startMs: 'asc' }] });
  }

  /** Cue suggestion. AI-first (Claude reads each scene's REAL text and sound-designs it:
   *  ambience, SFX with placement, foley, music mood). Heuristic keyword scan as fallback. */
  async suggest(revisionId: string, userId?: string) {
    const scenes = await this.prisma.scriptScene.findMany({ where: { revisionId }, orderBy: { sortOrder: 'asc' } });
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId }, select: { pageText: true } });
    const pages: { page: number; text: string }[] = (rev?.pageText as any[]) || [];
    const textForScene = (s: any) => pages.filter((p) => p.page >= s.pageStart && p.page <= s.pageEnd).map((p) => p.text).join('\n');

    const existing = await this.prisma.sceneAudioCue.findMany({ where: { revisionId, source: 'AUTO' }, select: { sceneNumber: true, layerType: true, genPrompt: true } });
    const have = new Set(existing.map((e) => `${e.sceneNumber}|${e.layerType}|${e.genPrompt}`));
    let created = 0;
    const add = async (sc: string, layerType: string, prompt: string, confidence: number, startMs = 0, duck?: boolean) => {
      if (have.has(`${sc}|${layerType}|${prompt}`)) return;
      have.add(`${sc}|${layerType}|${prompt}`);
      await this.prisma.sceneAudioCue.create({ data: { revisionId, sceneNumber: sc, layerType, genPrompt: prompt, startMs, source: 'AUTO', status: 'SUGGESTED', confidence, duckDialogue: duck ?? (layerType === 'MUSIC' || layerType === 'AMBIENCE'), createdById: userId || null } });
      created += 1;
    };

    // ── AI sound design (scene-precise) ──────────────────────────────────────────
    if (process.env.ANTHROPIC_API_KEY && scenes.length) {
      try {
        const BATCH = 6;
        for (let i = 0; i < scenes.length; i += BATCH) {
          const batch = scenes.slice(i, i + BATCH).map((s) => ({
            scene: s.sceneNumber || String(s.sortOrder),
            slugline: s.slugline, dayNight: s.dayNight, intExt: s.intExt,
            text: `${textForScene(s)}`.slice(0, 1600),
            durationSec: Math.max(10, Math.round(textForScene(s).length / 14)),
          }));
          const cuesOut = await this.callSoundDesigner(batch);
          for (const c of cuesOut) {
            const sc = String(c.scene || '');
            const lt = ['AMBIENCE', 'ROOMTONE', 'SFX', 'FOLEY', 'MUSIC'].includes(String(c.layerType)) ? c.layerType : null;
            const prompt = String(c.prompt || '').trim().slice(0, 180);
            if (!sc || !lt || !prompt) continue;
            const dur = (batch.find((b) => b.scene === sc)?.durationSec || 60) * 1000;
            const startMs = Math.max(0, Math.min(dur, Math.round((Number(c.position) || 0) * dur)));
            await add(sc, lt, prompt, Math.min(1, Math.max(0, Number(c.confidence) || 0.6)), startMs, c.duck === undefined ? undefined : !!c.duck);
          }
        }
        return { created, cues: await this.listCues(revisionId), ai: true };
      } catch { /* fall through to the heuristic below */ }
    }

    // ── Heuristic fallback ($0, offline) ─────────────────────────────────────────
    for (const s of scenes) {
      const sc = s.sceneNumber || String(s.sortOrder);
      const text = `${s.slugline || ''}\n${textForScene(s)}`;
      for (const [re, prompt] of this.AMBIENCE) if (re.test(text)) { await add(sc, 'AMBIENCE', prompt, 0.6); break; }
      for (const [re, prompt] of this.SFX) if (re.test(text)) await add(sc, 'SFX', prompt, 0.5);
      if (/\bnight\b/i.test(s.dayNight || s.slugline || '') || /\b(chase|fight|run|gun|explos)\b/i.test(text)) await add(sc, 'MUSIC', 'tense underscore bed', 0.45);
    }
    return { created, cues: await this.listCues(revisionId), ai: false };
  }

  /** Claude as sound designer: reads scene text, returns concrete generation-ready cues. */
  private async callSoundDesigner(scenes: any[]): Promise<any[]> {
    const tool = {
      name: 'submit_sound_design',
      description: 'Submit the cue plan for the provided scenes.',
      input_schema: {
        type: 'object',
        properties: {
          cues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                scene: { type: 'string', description: 'sceneNumber exactly as given' },
                layerType: { type: 'string', enum: ['AMBIENCE', 'ROOMTONE', 'SFX', 'FOLEY', 'MUSIC'] },
                prompt: { type: 'string', description: 'concrete, generation-ready description, e.g. "heavy rain on metal skylights, occasional distant thunder"' },
                position: { type: 'number', description: '0..1 — where in the scene it starts (0 = scene top)' },
                duck: { type: 'boolean', description: 'lower under dialogue' },
                confidence: { type: 'number' },
              },
              required: ['scene', 'layerType', 'prompt', 'position'],
            },
          },
        },
        required: ['cues'],
      },
    };
    const system = [
      'You are a film sound designer doing a spotting pass on screenplay scenes.',
      'For EACH scene, propose the cues its soundscape actually needs, based on what HAPPENS in the text:',
      '- ONE ambience/roomtone bed matching the real location and time (position 0).',
      '- SFX for concrete events in the action lines (a shot, a door, a vault over a rail) placed at their approximate position in the scene.',
      '- FOLEY for sustained physical activity (footsteps on the gantry, handling props).',
      '- MUSIC only when the scene\'s tension/emotion warrants it; describe mood, instrumentation, energy.',
      'Be specific and concrete — prompts go straight to a sound-generation model. 2–5 cues per scene. No invented events.',
      'Respond ONLY by calling submit_sound_design.',
    ].join('\n');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' } as any,
      body: JSON.stringify({
        model: process.env.SCRIPT_AUDIO_AI_MODEL || process.env.MM_AI_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 4000, system, tools: [tool],
        tool_choice: { type: 'tool', name: 'submit_sound_design' },
        messages: [{ role: 'user', content: JSON.stringify({ scenes }) }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const data: any = await res.json().catch(() => null);
    const toolUse = (data?.content || []).find((b: any) => b?.type === 'tool_use' && b?.name === 'submit_sound_design');
    return Array.isArray(toolUse?.input?.cues) ? toolUse.input.cues : [];
  }

  upsertCue(b: any, userId?: string) {
    if (b?.id) {
      const d: any = {};
      for (const k of ['sceneNumber', 'layerType', 'layerAssetId', 'uploadUrl', 'genPrompt', 'startMs', 'endMs', 'volumeDb', 'fadeInMs', 'fadeOutMs', 'duckDialogue', 'status', 'anchorSeg', 'anchorOffsetMs']) if (b[k] !== undefined) d[k] = b[k];
      return this.prisma.sceneAudioCue.update({ where: { id: b.id }, data: d });
    }
    return this.prisma.sceneAudioCue.create({ data: {
      revisionId: b.revisionId, sceneNumber: b.sceneNumber || null, layerType: b.layerType || 'SFX',
      layerAssetId: b.layerAssetId || null, uploadUrl: b.uploadUrl || null, genPrompt: b.genPrompt || null,
      startMs: b.startMs ?? 0, endMs: b.endMs ?? null, volumeDb: b.volumeDb ?? 0, fadeInMs: b.fadeInMs ?? 0, fadeOutMs: b.fadeOutMs ?? 0,
      duckDialogue: b.duckDialogue ?? true, source: 'MANUAL', status: b.status || 'APPROVED', createdById: userId || null,
    } });
  }
  setStatus(id: string, status: string) { return this.prisma.sceneAudioCue.update({ where: { id }, data: { status } }); }
  approveAll(revisionId: string) { return this.prisma.sceneAudioCue.updateMany({ where: { revisionId, status: 'SUGGESTED' }, data: { status: 'APPROVED' } }); }
  removeCue(id: string) { return this.prisma.sceneAudioCue.update({ where: { id }, data: { status: 'REMOVED' } }); }

  // ── Uploads ──────────────────────────────────────────────────────────────────────
  /** Register an uploaded sound file as a reusable library asset (source=UPLOAD). */
  async createUploadAsset(fileUrl: string, b: any, userId?: string) {
    return this.prisma.audioLayerAsset.create({ data: {
      scope: b?.projectId ? 'PROJECT' : 'GLOBAL',
      projectId: b?.projectId || null,
      type: b?.type || 'SFX',
      category: b?.category || null,
      name: b?.name || 'Uploaded sound',
      url: fileUrl,
      durationMs: b?.durationMs ? Number(b.durationMs) : null,
      tags: b?.tags || null,
      source: 'UPLOAD',
      loopable: b?.loopable === 'true' || b?.loopable === true,
      createdById: userId || null,
    } });
  }

  /** Attach an uploaded sound file directly to a cue (sets uploadUrl, clears any genPrompt/asset link). */
  async attachUploadToCue(cueId: string, fileUrl: string) {
    const cue = await this.prisma.sceneAudioCue.findUnique({ where: { id: cueId } });
    if (!cue) throw new NotFoundException('Cue not found.');
    return this.prisma.sceneAudioCue.update({ where: { id: cueId }, data: { uploadUrl: fileUrl, layerAssetId: null, genPrompt: null } });
  }

  // ── Layer asset library ─────────────────────────────────────────────────────────
  listAssets(q: { type?: string; projectId?: string }) {
    const where: any = {};
    if (q.type) where.type = q.type;
    if (q.projectId) where.OR = [{ scope: 'GLOBAL' }, { projectId: q.projectId }];
    return this.prisma.audioLayerAsset.findMany({ where, orderBy: { createdAt: 'desc' } });
  }
  /** Approved cues that actually have (or can generate) audio — what the mixer consumes. */
  mixableCues(revisionId: string) {
    return this.prisma.sceneAudioCue.findMany({ where: { revisionId, status: 'APPROVED' }, orderBy: { startMs: 'asc' } });
  }
}
