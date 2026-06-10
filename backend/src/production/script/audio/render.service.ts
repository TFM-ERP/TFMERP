import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { join, basename } from 'path';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AudioEnginesService } from './audio-engines.service';
import { PronunciationService } from './pronunciation.service';
import { LayersService } from './layers.service';
import { buildAdapter, type Segment } from './adapters';

/**
 * SYS-13c — Render orchestrator (MVP). Segments a revision into narration + dialogue, resolves
 * voices + pronunciation + routing, estimates cost (with cache projection + quota), and runs a
 * dialogue table-read render via the resolved engine. Browser tier returns a client render-plan
 * ($0); provider tier synthesizes per line (cached), concatenates, stores an AudioAsset, and
 * writes the usage ledger + debits the quota. Layer mixing (ffmpeg) is a later slice.
 */
@Injectable()
export class RenderService implements OnModuleInit {
  constructor(private prisma: PrismaService, private engines: AudioEnginesService, private pron: PronunciationService, private layers: LayersService) {}

  private bullQueue: any = null;

  /** Stand up a BullMQ queue+worker if Redis is configured; otherwise renders run in-process. */
  async onModuleInit() {
    if (!process.env.REDIS_URL && !process.env.REDIS_HOST) return;
    try {
      // String-typed specifiers so TS doesn't require these optional deps at compile time.
      const bullName: string = 'bullmq'; const ioName: string = 'ioredis';
      const bull: any = await import(bullName);
      const IORedis: any = (await import(ioName)).default;
      const conn = process.env.REDIS_URL
        ? new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
        : new IORedis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT || 6379), maxRetriesPerRequest: null });
      this.bullQueue = new bull.Queue('scripton-render', { connection: conn });
      new bull.Worker('scripton-render', async (job: any) => { await this.runSafe(job.data.jobId); }, { connection: conn, concurrency: 2 });
    } catch { this.bullQueue = null; /* fall back to in-process */ }
  }

  /** Enqueue a render job (BullMQ → worker; else in-process async). Never blocks the request. */
  private enqueue(jobId: string) {
    if (this.bullQueue) { this.bullQueue.add('render', { jobId }, { removeOnComplete: 50, removeOnFail: 50 }).catch(() => this.runSafe(jobId)); return; }
    setImmediate(() => this.runSafe(jobId));
  }
  private async runSafe(jobId: string) {
    try { await this.run(jobId); }
    catch (e: any) { await this.prisma.audioRenderJob.update({ where: { id: jobId }, data: { status: 'FAILED', error: String(e?.message || e), finishedAt: new Date() } }).catch(() => {}); }
  }

  getJob(id: string) { return this.prisma.audioRenderJob.findUnique({ where: { id } }); }

  private readonly CUE_RE = /^\s*([A-Z][A-Z0-9 .'\-]{1,30})(\s*\((?:V\.?O\.?|O\.?S\.?|CONT'?D)\.?\))?\s*$/;
  private readonly SLUG_RE = /^\s*(INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)\b/i;
  private absPath(name: string) { return join(process.cwd(), 'uploads', basename(name)); }

  /** Ordered narration + dialogue segments. */
  private async buildSegments(revisionId: string, opts: any): Promise<{ segments: Segment[]; speakers: Set<string> }> {
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId }, select: { pageText: true } });
    if (!rev) throw new NotFoundException('Revision not found.');
    const wantNarration = opts?.scope !== 'DIALOGUE_ONLY' && opts?.options?.narration !== false;
    const dialogueOnly = opts?.scope === 'CHARACTER_ONLY' || opts?.scope === 'DIALOGUE_ONLY';
    const narratorOnly = opts?.scope === 'NARRATOR_ONLY';

    // Optional page/scene scoping. selection = { pages: number[], scenes: sceneNumber[] }
    let includedPages: Set<number> | null = null;
    const sel = opts?.selection || {};
    if (opts?.scope === 'PAGES' && Array.isArray(sel.pages) && sel.pages.length) {
      includedPages = new Set(sel.pages.map((n: any) => Number(n)));
    } else if (opts?.scope === 'SELECTED_SCENES' && Array.isArray(sel.scenes) && sel.scenes.length) {
      const want = new Set(sel.scenes.map((s: any) => String(s)));
      const scenes = await this.prisma.scriptScene.findMany({ where: { revisionId }, select: { sceneNumber: true, pageStart: true, pageEnd: true } });
      includedPages = new Set();
      for (const s of scenes) if (want.has(String(s.sceneNumber))) for (let p = s.pageStart; p <= s.pageEnd; p++) includedPages.add(p);
    }

    const segments: Segment[] = [];
    const speakers = new Set<string>();
    let i = 0, speaker: string | null = null;
    for (const pg of ((rev.pageText as any[]) || [])) {
      if (includedPages && !includedPages.has(pg.page)) { speaker = null; continue; }
      for (const raw of String(pg.text || '').split('\n')) {
        const line = raw.trim();
        if (!line) { speaker = null; continue; }
        const cue = line.match(this.CUE_RE);
        if (cue && line.split(' ').length <= 4 && !this.SLUG_RE.test(line)) { speaker = cue[1].trim().replace(/\s+/g, ' '); speakers.add(speaker); continue; }
        if (speaker) {
          if (!narratorOnly) { segments.push({ id: `s${i++}`, kind: 'dialogue', character: speaker, text: line }); }
        } else if (wantNarration && !dialogueOnly) {
          segments.push({ id: `s${i++}`, kind: 'narration', text: line });
        }
      }
      speaker = null;
    }
    return { segments, speakers };
  }

  private async voiceFor(revisionId: string, character: string | undefined, isNarr: boolean) {
    const name = isNarr ? 'NARRATOR' : (character || '');
    const a = await this.prisma.characterVoiceAssignment.findUnique({ where: { revisionId_characterName: { revisionId, characterName: name } } }).catch(() => null);
    const profile = a?.voiceProfileId ? await this.prisma.voiceProfile.findUnique({ where: { id: a.voiceProfileId } }) : null;
    return { assignment: a, profile };
  }

  // ── Estimate ──────────────────────────────────────────────────────────────────
  async estimate(revisionId: string, opts: any, projectId?: string) {
    const { segments } = await this.buildSegments(revisionId, opts);
    const routing = await this.engines.resolve('TTS', projectId);
    const engineRow = routing.engine ? await this.prisma.audioEngine.findUnique({ where: { id: routing.engine.id } }) : null;
    const cost = (engineRow?.costModel as any)?.tts || { unit: 'CHAR', rate: 0 };
    const totalChars = segments.reduce((t, s) => t + s.text.length, 0);

    // project cache hits
    let cachedChars = 0;
    if (engineRow && engineRow.key !== 'BROWSER') {
      for (const s of segments) {
        const key = this.cacheKey(s, engineRow.key);
        const hit = await this.prisma.lineSynthesisCache.findUnique({ where: { cacheKey: key } }).catch(() => null);
        if (hit) cachedChars += s.text.length;
      }
    }
    const billable = Math.max(0, totalChars - cachedChars);
    const rate = Number(cost.rate || 0);
    const total = engineRow?.key === 'BROWSER' ? 0 : Math.round(billable * rate * 100) / 100;
    const wpm = 150; const durationSec = Math.round((totalChars / 5) / wpm * 60);
    const quota = projectId ? await this.getQuota('PROJECT', projectId) : null;
    return {
      engine: routing.engine, locked: routing.locked, currency: (engineRow?.costModel as any)?.currency || 'USD',
      segments: segments.length, totalChars, cachedChars, billableChars: billable, cacheSavings: Math.round(cachedChars * rate * 100) / 100,
      estimate: total, durationSec,
      quota: quota ? { costLimit: quota.costLimit, usedCost: quota.usedCost, hardStop: quota.hardStop } : null,
      overQuota: !!(quota?.costLimit && Number(quota.usedCost) + total > Number(quota.costLimit)),
    };
  }

  /** Estimate deriving the project from the revision. */
  async estimateForRevision(revisionId: string, opts: any) {
    const doc = await this.prisma.scriptDocument.findFirst({ where: { revisions: { some: { id: revisionId } } }, select: { projectId: true } });
    return this.estimate(revisionId, opts, doc?.projectId || undefined);
  }

  // ── Browser render-plan ($0, client synthesizes) ───────────────────────────────
  async renderPlan(revisionId: string) {
    const { segments } = await this.buildSegments(revisionId, {});
    const assigns = await this.prisma.characterVoiceAssignment.findMany({ where: { revisionId } });
    const profIds = assigns.map((a) => a.voiceProfileId).filter(Boolean) as string[];
    const profs = profIds.length ? await this.prisma.voiceProfile.findMany({ where: { id: { in: profIds } } }) : [];
    const pById = new Map(profs.map((p) => [p.id, p]));
    const voiceByChar: Record<string, any> = {};
    for (const a of assigns) { const p = a.voiceProfileId ? pById.get(a.voiceProfileId) : null; voiceByChar[a.characterName] = { rate: p?.defaultRate ?? 1, pitch: p?.defaultPitch ?? 1, externalVoiceId: p?.externalVoiceId, engineKey: p?.engineKey }; }
    return { engine: 'BROWSER', segments: segments.map((s) => ({ ...s, voice: s.kind === 'narration' ? voiceByChar['NARRATOR'] : voiceByChar[s.character || ''] || null })) };
  }

  // ── Queue + run ────────────────────────────────────────────────────────────────
  async queue(revisionId: string, opts: any, userId?: string) {
    const doc = await this.prisma.scriptDocument.findFirst({ where: { revisions: { some: { id: revisionId } } }, select: { id: true, projectId: true } });
    const projectId = doc?.projectId;
    const est = await this.estimate(revisionId, opts, projectId);
    if (est.overQuota && est.quota?.hardStop) throw new BadRequestException('Render would exceed the project audio quota (hard stop). Raise the quota or wait for reset.');
    const job = await this.prisma.audioRenderJob.create({ data: {
      projectId: projectId || null, scriptId: doc?.id || null, revisionId, profileId: opts?.profileId || null,
      scope: opts?.scope || 'TABLE_READ', selection: opts?.selection ?? null, engineKey: est.engine?.key || 'BROWSER',
      format: opts?.format || 'MP3', options: opts?.options ?? null, status: 'QUEUED', costEstimate: est.estimate, currency: est.currency,
      charsBilled: est.billableChars, durationSec: est.durationSec, requestedById: userId || null,
    } });
    if ((est.engine?.key || 'BROWSER') === 'BROWSER') {
      // Browser tier: nothing to render server-side; the client plays the render-plan.
      await this.prisma.audioRenderJob.update({ where: { id: job.id }, data: { status: 'DONE', costActual: 0, finishedAt: new Date(), progress: 100 } });
      return { job: await this.prisma.audioRenderJob.findUnique({ where: { id: job.id } }), tier: 'BROWSER', plan: await this.renderPlan(revisionId) };
    }
    // Provider tier: enqueue (BullMQ worker or in-process async). Poll the job for status.
    this.enqueue(job.id);
    return { job, tier: 'STUDIO', queued: true };
  }

  private cacheKey(seg: Segment, engineKey: string, voiceSig = '') {
    return createHash('sha256').update(`${engineKey}|${voiceSig}|${seg.character || 'NARR'}|${seg.text}`).digest('hex');
  }

  async run(jobId: string) {
    const fs = await import('fs');
    const job = await this.prisma.audioRenderJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found.');
    const engineRow = await this.prisma.audioEngine.findUnique({ where: { key: job.engineKey || 'BROWSER' } });
    if (!engineRow || !engineRow.enabled) throw new BadRequestException('Engine not available/enabled.');
    const adapter = buildAdapter(engineRow);
    if (!adapter.synthesize) throw new BadRequestException('Engine has no server-side TTS.');

    await this.prisma.audioRenderJob.update({ where: { id: jobId }, data: { status: 'SYNTHESIZING', startedAt: new Date() } });
    const { segments } = await this.buildSegments(job.revisionId, { scope: job.scope, options: job.options });
    const dict = await this.pron.resolveMap({ projectId: job.projectId || undefined, revisionId: job.revisionId });
    const rate = Number((engineRow.costModel as any)?.tts?.rate || 0);
    const currency = (engineRow.costModel as any)?.currency || 'USD';

    const buffers: Buffer[] = []; let billed = 0; let cost = 0;
    for (const seg of segments) {
      const { profile } = await this.voiceFor(job.revisionId, seg.character, seg.kind === 'narration');
      const cfg = { externalVoiceId: profile?.externalVoiceId || undefined, rate: Number(profile?.defaultRate ?? 1) };
      const text = this.pron.applyTo(seg.text, dict);
      const key = this.cacheKey({ ...seg, text }, engineRow.key, profile?.externalVoiceId || '');
      const hit = await this.prisma.lineSynthesisCache.findUnique({ where: { cacheKey: key } }).catch(() => null);
      if (hit && fs.existsSync(this.absPath(hit.url))) {
        buffers.push(fs.readFileSync(this.absPath(hit.url)));
        await this.prisma.lineSynthesisCache.update({ where: { id: hit.id }, data: { hitCount: { increment: 1 }, lastUsedAt: new Date() } });
        await this.prisma.voiceUsageRecord.create({ data: { jobId, engineKey: engineRow.key, projectId: job.projectId, userId: job.requestedById, charsBilled: 0, totalCost: 0, currency, cacheHit: true } });
        continue;
      }
      const res = await adapter.synthesize({ ...seg, text }, cfg);
      const fn = `tts-${key.slice(0, 24)}.mp3`;
      fs.writeFileSync(this.absPath(fn), res.audio);
      buffers.push(res.audio);
      await this.prisma.lineSynthesisCache.create({ data: { cacheKey: key, engineKey: engineRow.key, url: `/uploads/${fn}`, charsBilled: res.charsBilled } });
      const lineCost = Math.round(res.charsBilled * rate * 100) / 100;
      billed += res.charsBilled; cost += lineCost;
      await this.prisma.voiceUsageRecord.create({ data: { jobId, engineKey: engineRow.key, projectId: job.projectId, userId: job.requestedById, charsBilled: res.charsBilled, unitCost: rate, totalCost: lineCost, currency, cacheHit: false } });
    }

    // Dialogue stem = sequential concat of mp3 segments.
    const dialogueName = `dialogue-${jobId}.mp3`;
    fs.writeFileSync(this.absPath(dialogueName), Buffer.concat(buffers));

    // Layer mix (ffmpeg) — optional. Falls back to the dialogue stem on any failure / no ffmpeg.
    let outName = dialogueName; let layered = false;
    if (job.options && (job.options as any).layers !== false) {
      await this.prisma.audioRenderJob.update({ where: { id: jobId }, data: { status: 'MIXING' } }).catch(() => {});
      try {
        const cues = await this.layers.mixableCues(job.revisionId);
        if (cues.length) {
          const mixedName = await this.mixLayers(jobId, dialogueName, cues, engineRow, job);
          if (mixedName) { outName = mixedName; layered = true; }
        }
      } catch { /* keep dialogue stem */ }
    }

    const finalBytes = fs.statSync(this.absPath(outName)).size;
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: job.revisionId }, select: { revisionLabel: true } });
    const asset = await this.prisma.audioAsset.create({ data: {
      projectId: job.projectId, scriptId: job.scriptId, revisionId: job.revisionId, scriptVersionLabel: rev?.revisionLabel || null,
      jobId, kind: 'FULL_MIX', title: `${job.scope}${layered ? ' (mixed)' : ''} · ${rev?.revisionLabel || ''}`.trim(), url: `/uploads/${outName}`, format: 'MP3',
      durationSec: job.durationSec, fileSizeBytes: BigInt(finalBytes), engineKey: engineRow.key, generatedById: job.requestedById,
      exportConfigSnapshot: { layered },
    } });
    await this.prisma.audioRenderJob.update({ where: { id: jobId }, data: { status: 'DONE', progress: 100, costActual: cost, charsBilled: billed, outputAssetId: asset.id, finishedAt: new Date() } });
    await this.debitQuota(job.projectId || undefined, billed, cost);
    return this.prisma.audioRenderJob.findUnique({ where: { id: jobId } });
  }

  // ── Layer mixing (ffmpeg) ─────────────────────────────────────────────────────────
  private ffmpegAvailable(): Promise<boolean> {
    return new Promise((res) => {
      try { const p = spawn('ffmpeg', ['-version']); p.on('error', () => res(false)); p.on('close', (c) => res(c === 0)); }
      catch { res(false); }
    });
  }
  private runFfmpeg(args: string[]): Promise<boolean> {
    return new Promise((res) => {
      try { const p = spawn('ffmpeg', args); p.on('error', () => res(false)); p.stderr?.on('data', () => {}); p.on('close', (code) => res(code === 0)); }
      catch { res(false); }
    });
  }

  /** Resolve a cue to a local audio file: uploaded → library asset → generate via engine (cached). */
  private async resolveCueAudio(cue: any, engineRow: any, job: any): Promise<string | null> {
    const fs = await import('fs');
    if (cue.uploadUrl && fs.existsSync(this.absPath(cue.uploadUrl))) return this.absPath(cue.uploadUrl);
    if (cue.layerAssetId) {
      const a = await this.prisma.audioLayerAsset.findUnique({ where: { id: cue.layerAssetId } });
      if (a?.url && fs.existsSync(this.absPath(a.url))) return this.absPath(a.url);
    }
    if (cue.genPrompt) {
      const caps = (engineRow.capabilities as any) || {};
      const isMusic = cue.layerType === 'MUSIC';
      const adapter = buildAdapter(engineRow);
      const gen = isMusic ? adapter.generateMusic?.bind(adapter) : adapter.generateSfx?.bind(adapter);
      if (!gen || (isMusic ? !caps.music : !caps.sfx)) return null;
      const key = createHash('sha256').update(`${engineRow.key}|${cue.layerType}|${cue.genPrompt}`).digest('hex');
      const fn = `layer-${key.slice(0, 24)}.mp3`;
      if (!fs.existsSync(this.absPath(fn))) {
        const res = await gen(cue.genPrompt, { durationMs: cue.endMs ? cue.endMs - (cue.startMs || 0) : 6000 });
        fs.writeFileSync(this.absPath(fn), res.audio);
        const cm = (engineRow.costModel as any) || {};
        const unit = isMusic ? cm.music : cm.sfx;
        await this.prisma.voiceUsageRecord.create({ data: { jobId: job.id, engineKey: engineRow.key, capability: isMusic ? 'MUSIC' : 'SFX', projectId: job.projectId, userId: job.requestedById, charsBilled: 0, totalCost: Number(unit?.rate || 0), currency: cm.currency || 'USD', cacheHit: false } });
      }
      return this.absPath(fn);
    }
    return null;
  }

  /** Mix approved layer cues under the dialogue stem: per-layer delay+volume(+duck), amix, loudnorm. */
  private async mixLayers(jobId: string, dialogueName: string, cues: any[], engineRow: any, job: any): Promise<string | null> {
    if (!(await this.ffmpegAvailable())) return null;
    const layerFiles: { path: string; cue: any }[] = [];
    for (const c of cues) { const p = await this.resolveCueAudio(c, engineRow, job); if (p) layerFiles.push({ path: p, cue: c }); }
    if (!layerFiles.length) return null;

    const inputs = ['-i', this.absPath(dialogueName)];
    layerFiles.forEach((l) => inputs.push('-i', l.path));
    const filters: string[] = [];
    const labels = ['[0:a]'];
    layerFiles.forEach((l, i) => {
      const idx = i + 1; const delay = Math.max(0, l.cue.startMs || 0);
      const duck = l.cue.duckDialogue ? -12 : 0;
      const vol = (typeof l.cue.volumeDb === 'number' ? l.cue.volumeDb : 0) + duck;
      filters.push(`[${idx}:a]adelay=${delay}|${delay},volume=${vol}dB[l${idx}]`);
      labels.push(`[l${idx}]`);
    });
    filters.push(`${labels.join('')}amix=inputs=${labels.length}:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]`);
    const outName = `render-${jobId}.mp3`;
    const args = [...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-c:a', 'libmp3lame', '-q:a', '4', '-y', this.absPath(outName)];
    return (await this.runFfmpeg(args)) ? outName : null;
  }

  // ── Library + jobs + quota ──────────────────────────────────────────────────────
  listJobs(projectId: string) { return this.prisma.audioRenderJob.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 50 }); }
  listAssets(projectId: string) { return this.prisma.audioAsset.findMany({ where: { projectId, status: { not: 'DELETED' } }, orderBy: { generatedAt: 'desc' } }); }
  archiveAsset(id: string) { return this.prisma.audioAsset.update({ where: { id }, data: { status: 'ARCHIVED' } }); }

  async getQuota(scope: string, projectId?: string, userId?: string) {
    // findFirst (not findUnique): the compound unique contains nullable projectId/userId.
    return this.prisma.usageQuota.findFirst({ where: { scope, projectId: projectId || null, userId: userId || null, period: 'MONTH' } }).catch(() => null);
  }
  private async debitQuota(projectId: string | undefined, chars: number, cost: number) {
    if (!projectId) return;
    const existing = await this.prisma.usageQuota.findFirst({ where: { scope: 'PROJECT', projectId, userId: null, period: 'MONTH' } });
    if (existing) await this.prisma.usageQuota.update({ where: { id: existing.id }, data: { usedChars: { increment: chars }, usedCost: { increment: cost } } });
    else await this.prisma.usageQuota.create({ data: { scope: 'PROJECT', projectId, period: 'MONTH', usedChars: chars, usedCost: cost } });
  }

  /** Cost rollups for reporting. */
  async usageSummary(projectId: string) {
    const records = await this.prisma.voiceUsageRecord.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 500 });
    const total = records.reduce((t, r) => t + Number(r.totalCost || 0), 0);
    const byEngine: Record<string, number> = {};
    for (const r of records) byEngine[r.engineKey] = (byEngine[r.engineKey] || 0) + Number(r.totalCost || 0);
    const cacheHits = records.filter((r) => r.cacheHit).length;
    return { totalCost: Math.round(total * 100) / 100, byEngine, generations: records.length, cacheHits };
  }
}
