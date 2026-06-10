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

  /** Heuristic suggestion: scan each scene's slugline + action for ambience/SFX/music cues. */
  async suggest(revisionId: string, userId?: string) {
    const scenes = await this.prisma.scriptScene.findMany({ where: { revisionId }, orderBy: { sortOrder: 'asc' } });
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId }, select: { pageText: true } });
    const pages: { page: number; text: string }[] = (rev?.pageText as any[]) || [];
    const textForScene = (s: any) => pages.filter((p) => p.page >= s.pageStart && p.page <= s.pageEnd).map((p) => p.text).join('\n');

    const existing = await this.prisma.sceneAudioCue.findMany({ where: { revisionId, source: 'AUTO' }, select: { sceneNumber: true, layerType: true, genPrompt: true } });
    const have = new Set(existing.map((e) => `${e.sceneNumber}|${e.layerType}|${e.genPrompt}`));
    let created = 0;
    for (const s of scenes) {
      const sc = s.sceneNumber || String(s.sortOrder);
      const text = `${s.slugline || ''}\n${textForScene(s)}`;
      const add = async (layerType: string, prompt: string, confidence: number) => {
        if (have.has(`${sc}|${layerType}|${prompt}`)) return;
        await this.prisma.sceneAudioCue.create({ data: { revisionId, sceneNumber: sc, layerType, genPrompt: prompt, source: 'AUTO', status: 'SUGGESTED', confidence, duckDialogue: layerType === 'MUSIC' || layerType === 'AMBIENCE', createdById: userId || null } });
        created += 1;
      };
      for (const [re, prompt] of this.AMBIENCE) if (re.test(text)) { await add('AMBIENCE', prompt, 0.6); break; }
      for (const [re, prompt] of this.SFX) if (re.test(text)) await add('SFX', prompt, 0.5);
      // a tension music bed for NIGHT / action-heavy scenes
      if (/\bnight\b/i.test(s.dayNight || s.slugline || '') || /\b(chase|fight|run|gun|explos)\b/i.test(text)) await add('MUSIC', 'tense underscore bed', 0.45);
    }
    return { created, cues: await this.listCues(revisionId) };
  }

  upsertCue(b: any, userId?: string) {
    if (b?.id) {
      const d: any = {};
      for (const k of ['sceneNumber', 'layerType', 'layerAssetId', 'uploadUrl', 'genPrompt', 'startMs', 'endMs', 'volumeDb', 'fadeInMs', 'fadeOutMs', 'duckDialogue', 'status']) if (b[k] !== undefined) d[k] = b[k];
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
