import { Injectable, Logger } from '@nestjs/common';
import { readFile, writeFile, mkdir, rm, copyFile } from 'fs/promises';
import { spawn } from 'child_process';
import { join } from 'path';
import { PrismaService } from '../common/prisma/prisma.service';
import { VideoGenerationParams, VideoJobResponse } from './providers';
import { VideoEnginesService } from './video-engines.service';

/**
 * VideoService — async text-to-video job orchestration for VERTICAL_AI_VIDEO.
 * Primary path = local ComfyUI (RTX 5080); cloud fallback = Runway Gen-4.5.
 *
 * Required env:
 *   COMFYUI_BASE_URL        (default http://127.0.0.1:8188)
 *   COMFYUI_WORKFLOW_PATH   path to your 9:16 workflow exported as ComfyUI API-format JSON
 *   COMFYUI_NODE_POSITIVE/_NEGATIVE/_LATENT/_SAMPLER  node-id overrides (default 4/5/6/3)
 *   RUNWAYML_API_SECRET     Runway developer key (fallback path only)
 *
 * Prisma access is via `(this.prisma as any).videoRun` until `prisma generate` runs after
 * the VideoRun migration — consistent with the rest of the ScriptON services.
 */
@Injectable()
export class VideoService {
  private readonly logger = new Logger(VideoService.name);
  // In-memory episode-render jobs (server-side orchestration; the finished episode is also persisted as a
  // VideoRun so it survives a restart and shows in the gallery). Keyed by episodeId.
  private episodeJobs = new Map<string, any>();

  constructor(private prisma: PrismaService, private engines: VideoEnginesService) {}

  /** Kick off one shot render: resolve the engine from the Video routing policy (with failover), record a VideoRun. */
  async generateShot(
    projectId: string,
    params: VideoGenerationParams,
    stageVersionId?: string,
    overrideEngineId?: string,
  ): Promise<string> {
    // Governed switchboard: resolve the ordered failover chain from VideoRoutingPolicy.
    let chain = await this.engines.resolveChain('VIDEO_DEFAULT', projectId);
    if (overrideEngineId) {
      const i = chain.findIndex((p) => p.engineId === overrideEngineId);
      if (i > 0) chain = [chain[i], ...chain.filter((_, j) => j !== i)];
    }

    let jobResponse: VideoJobResponse | null = null;
    let used: any = null;
    let lastErr: any = null;
    for (const plan of chain) {
      if (!plan.usable) continue; // skip disabled / no-credential engines
      try {
        jobResponse = await this.callProvider(plan.provider, plan.model, params);
        if (jobResponse && jobResponse.status !== 'FAILED') { used = plan; break; }
      } catch (e: any) {
        lastErr = e; jobResponse = null;
        this.logger.warn(`Video engine ${plan.key} failed; trying next: ${e?.message || e}`);
      }
    }
    if (!jobResponse || !used) {
      throw lastErr || new Error('No usable video engine in the failover chain — enable an engine and set its credentials in AI Governance → Video engines.');
    }

    const run = await (this.prisma as any).videoRun.create({
      data: {
        projectId,
        stageVersionId: stageVersionId || null,
        provider: used.provider,
        model: used.model,
        jobId: jobResponse.jobId,
        status: jobResponse.status,
        prompt: params.prompt,
        negativePrompt: params.negativePrompt || null,
        durationSec: params.durationSec,
        aspectRatio: params.aspectRatio,
      },
    });

    return run.id;
  }

  /** Route to the concrete provider adapter for a resolved engine. */
  private async callProvider(provider: string, model: string, params: VideoGenerationParams): Promise<VideoJobResponse> {
    switch (provider) {
      case 'local_comfy': return this.callLocalComfyUI(model, params);
      case 'runway': return this.callRunwayApi(model, params);
      case 'seedance': return this.callSeedance(model, params);
      default: throw new Error(`No video adapter for provider "${provider}". Supported: local_comfy, runway, seedance.`);
    }
  }

  /** Recent video render runs for a project (for the render panel / Recent Runs feed). */
  async listRuns(projectId: string) {
    return (this.prisma as any).videoRun.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /** Poll the provider for a run's status; persist COMPLETED/FAILED transitions. */
  async checkJobStatus(runId: string): Promise<VideoJobResponse> {
    const run = await (this.prisma as any).videoRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error(`VideoRun not found: ${runId}`);

    if (run.status === 'COMPLETED' || run.status === 'FAILED') {
      return { jobId: run.jobId, status: run.status, videoUrl: run.videoUrl ?? undefined };
    }

    let next: VideoJobResponse;
    if (run.provider === 'local_comfy') next = await this.pollLocalComfyUI(run.jobId);
    else if (run.provider === 'runway') next = await this.pollRunwayApi(run.jobId);
    else if (run.provider === 'seedance') next = await this.pollSeedance(run.jobId, run.model);
    else next = { jobId: run.jobId, status: run.status };

    if (next.status !== run.status || (next.videoUrl && next.videoUrl !== run.videoUrl)) {
      await (this.prisma as any).videoRun.update({
        where: { id: runId },
        data: { status: next.status, videoUrl: next.videoUrl ?? null, error: next.error ?? null },
      });
    }
    return next;
  }

  // ── Provider adapters — real calls (ComfyUI primary, Runway Gen-4.5 fallback) ──

  private comfyBase(): string {
    return (process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '');
  }

  /** POST the mutated 9:16 API-format workflow to ComfyUI's /prompt queue; return its prompt_id. */
  private async callLocalComfyUI(model: string, params: VideoGenerationParams): Promise<VideoJobResponse> {
    const wfPath = process.env.COMFYUI_WORKFLOW_PATH;
    if (!wfPath) throw new Error('COMFYUI_WORKFLOW_PATH is not set — export your 9:16 workflow from ComfyUI as API-format JSON and point this env at the file.');
    let workflow: any;
    try { workflow = JSON.parse(await readFile(wfPath, 'utf8')); }
    catch (e: any) { throw new Error(`Could not read ComfyUI workflow at ${wfPath}: ${e?.message || e}`); }

    // Node IDs in the exported API-format graph (override via env to match your workflow).
    const nPos = process.env.COMFYUI_NODE_POSITIVE || '4';    // CLIPTextEncode (positive)
    const nNeg = process.env.COMFYUI_NODE_NEGATIVE || '5';    // CLIPTextEncode (negative)
    const nLat = process.env.COMFYUI_NODE_LATENT || '6';      // EmptyLatentImage / resolution
    const nSampler = process.env.COMFYUI_NODE_SAMPLER || '3'; // KSampler (seed)
    const seed = params.seed || Math.floor(Math.random() * 1000000000);
    if (workflow[nPos]?.inputs) workflow[nPos].inputs.text = params.prompt;
    if (workflow[nNeg]?.inputs) workflow[nNeg].inputs.text = params.negativePrompt || '';
    if (workflow[nLat]?.inputs) {
      workflow[nLat].inputs.width = params.aspectRatio === '16:9' ? 1024 : 576;
      workflow[nLat].inputs.height = params.aspectRatio === '16:9' ? 576 : 1024;
    }
    if (workflow[nSampler]?.inputs) workflow[nSampler].inputs.seed = seed;

    const res = await fetch(`${this.comfyBase()}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: `scripton_${Date.now()}` }),
    });
    if (!res.ok) throw new Error(`ComfyUI API error: ${res.status} ${res.statusText} — ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const data: any = await res.json();
    if (!data?.prompt_id) throw new Error('ComfyUI returned no prompt_id (the workflow was rejected — check node validation).');
    this.logger.log(`ComfyUI queued prompt ${data.prompt_id} (${params.aspectRatio}, seed ${seed})`);
    return { jobId: String(data.prompt_id), status: 'PROCESSING' };
  }

  /** POST a Gen-4.5 text-to-video task to Runway; return the task id to poll. */
  private async callRunwayApi(model: string, params: VideoGenerationParams): Promise<VideoJobResponse> {
    const key = process.env.RUNWAYML_API_SECRET;
    if (!key) throw new Error('RUNWAYML_API_SECRET is not set.');
    // ratio is a RESOLUTION string (Gen-4.5 no longer accepts 9:16). Portrait default for vertical.
    const ratio = params.aspectRatio === '16:9' ? '1280:720' : '720:1280';
    const res = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'X-Runway-Version': '2024-11-06',
        'Content-Type': 'application/json',
      },
      // gen4.5 supports text-to-video — omit promptImage for a pure-text brief.
      body: JSON.stringify({ model: model || 'gen4.5', promptText: params.prompt, ratio, duration: params.durationSec || 5 }),
    });
    if (!res.ok) throw new Error(`Runway API error: ${res.status} ${res.statusText} — ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const data: any = await res.json();
    if (!data?.id) throw new Error('Runway returned no task id.');
    this.logger.log(`Runway task ${data.id} queued (${model || 'gen4.5'}, ${ratio})`);
    return { jobId: String(data.id), status: 'PENDING' };
  }

  /** Poll ComfyUI /history/{promptId}; resolve the saved output file URL when done. */
  private async pollLocalComfyUI(jobId: string): Promise<VideoJobResponse> {
    const base = this.comfyBase();
    const res = await fetch(`${base}/history/${jobId}`);
    if (!res.ok) return { jobId, status: 'PROCESSING' };
    const hist: any = await res.json();
    const entry = hist?.[jobId];
    if (!entry) return { jobId, status: 'PROCESSING' };          // still queued / running
    if (entry.status?.status_str === 'error') return { jobId, status: 'FAILED', error: 'ComfyUI workflow execution error' };
    const outputs = entry.outputs || {};
    for (const nodeId of Object.keys(outputs)) {
      const files = outputs[nodeId].gifs || outputs[nodeId].videos || outputs[nodeId].images;
      if (Array.isArray(files) && files.length) {
        const f = files[0];
        const url = `${base}/view?filename=${encodeURIComponent(f.filename)}`
          + `&subfolder=${encodeURIComponent(f.subfolder || '')}`
          + `&type=${encodeURIComponent(f.type || 'output')}`;
        return { jobId, status: 'COMPLETED', videoUrl: url };
      }
    }
    return { jobId, status: 'PROCESSING' };
  }

  /** Poll Runway /v1/tasks/{id}; map SUCCEEDED→COMPLETED, FAILED→FAILED. */
  private async pollRunwayApi(jobId: string): Promise<VideoJobResponse> {
    const res = await fetch(`https://api.dev.runwayml.com/v1/tasks/${jobId}`, {
      headers: { 'Authorization': `Bearer ${process.env.RUNWAYML_API_SECRET}`, 'X-Runway-Version': '2024-11-06' },
    });
    if (!res.ok) return { jobId, status: 'PROCESSING' };
    const data: any = await res.json();
    // Runway task status: PENDING | RUNNING | THROTTLED | SUCCEEDED | FAILED
    if (data.status === 'SUCCEEDED') return { jobId, status: 'COMPLETED', videoUrl: Array.isArray(data.output) ? data.output[0] : undefined };
    if (data.status === 'FAILED') return { jobId, status: 'FAILED', error: data.failure || data.failureCode || 'Runway task failed' };
    return { jobId, status: 'PROCESSING' };
  }

  // ── Seedance 2.0 (ByteDance) — config-driven so a model/endpoint change is a settings edit, not code ──
  /**
   * Defaults target fal.ai (an authorized Seedance provider — it tracks the latest model and keeps a
   * stable REST schema, which is exactly what makes a "params keep changing" model safe to depend on).
   * Override via env to point at BytePlus/Volcengine ModelArk or any aggregator:
   *   SEEDANCE_BASE_URL       queue root (default https://queue.fal.run; use https://fal.run for sync)
   *   SEEDANCE_API_KEY        key (falls back to FAL_KEY)
   *   SEEDANCE_AUTH_SCHEME    Authorization scheme: 'Key' (fal, default) | 'Bearer' (ModelArk)
   *   SEEDANCE_RESOLUTION     '720p' (default) | '480p'
   *   SEEDANCE_GENERATE_AUDIO 'false' to mute (default true)
   * The model id (e.g. bumping to bytedance/seedance-2.5/text-to-video) is the engine's editable
   * defaultModel — change it in AI Governance → Video engines, no redeploy.
   */
  private seedanceCfg() {
    return {
      base: (process.env.SEEDANCE_BASE_URL || 'https://queue.fal.run').replace(/\/+$/, ''),
      key: process.env.SEEDANCE_API_KEY || process.env.FAL_KEY || '',
      scheme: process.env.SEEDANCE_AUTH_SCHEME || 'Key',
      resolution: process.env.SEEDANCE_RESOLUTION || '720p',
      audio: process.env.SEEDANCE_GENERATE_AUDIO !== 'false',
    };
  }

  private seedanceAspect(ar: string): string {
    const ok = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];
    if (ok.includes(ar)) return ar;
    return ar === '16:9' ? '16:9' : '9:16'; // vertical AI video → 9:16 default
  }

  /** POST one shot to Seedance via the fal queue; map ScriptON shot params → Seedance inputs. */
  private async callSeedance(model: string, params: VideoGenerationParams): Promise<VideoJobResponse> {
    const cfg = this.seedanceCfg();
    if (!cfg.key) throw new Error('Seedance key missing — set SEEDANCE_API_KEY (or FAL_KEY) in the backend env.');
    // Seedance has no negative-prompt concept (only ComfyUI does), so params.negativePrompt is intentionally dropped.
    const body: any = {
      prompt: params.prompt,
      resolution: cfg.resolution,
      duration: params.durationSec ? String(Math.max(4, Math.min(15, Math.round(params.durationSec)))) : 'auto',
      aspect_ratio: this.seedanceAspect(params.aspectRatio),
      generate_audio: params.generateAudio != null ? !!params.generateAudio : cfg.audio,
    };
    // Pick the endpoint by what we're given (cohesive-episode pipeline):
    //   reference images → reference-to-video (Face Lock identity across shots)
    //   a start frame     → image-to-video (+ optional end frame = last-frame chaining)
    //   neither           → text-to-video (the original independent path)
    const refs = Array.isArray(params.imageUrls) ? params.imageUrls.filter(Boolean) : [];
    const vids = Array.isArray(params.videoUrls) ? params.videoUrls.filter(Boolean) : [];
    let m = model || 'bytedance/seedance-2.0/text-to-video';
    if (refs.length || vids.length) {
      m = 'bytedance/seedance-2.0/reference-to-video';        // identity (image_urls) + continuity (video_urls)
      if (refs.length) body.image_urls = refs.slice(0, 9);
      if (vids.length) body.video_urls = vids.slice(0, 3);
    } else if (params.imageUrl) {
      m = 'bytedance/seedance-2.0/image-to-video';            // start frame (+ optional end frame = chaining)
      body.image_url = params.imageUrl;
      if (params.endImageUrl) body.end_image_url = params.endImageUrl;
    }
    if (params.seed) body.seed = params.seed;
    const res = await fetch(`${cfg.base}/${m}`, {
      method: 'POST',
      headers: { 'Authorization': `${cfg.scheme} ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Seedance API error: ${res.status} ${res.statusText} — ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const data: any = await res.json();
    // Sync endpoint (fal.run) returns the result inline; queue endpoint returns a request id to poll.
    const inlineUrl = data?.video?.url || (Array.isArray(data?.videos) ? data.videos[0]?.url : undefined);
    if (inlineUrl) return { jobId: String(data.request_id || `sync_${Date.now()}`), status: 'COMPLETED', videoUrl: inlineUrl };
    const id = data?.request_id || data?.id;
    if (!id) throw new Error('Seedance returned no request id (and no inline video).');
    // Persist fal's own response_url as the poll handle — fal drops the endpoint segment for sub-path
    // models (status lives at .../bytedance/seedance-2.0/requests/<id>), so reconstructing the full path 404s.
    const pollHandle = data?.response_url || `${cfg.base}/${m}/requests/${id}`;
    this.logger.log(`Seedance queued ${id} (${m}, ${body.aspect_ratio}, ${body.duration}s) → ${pollHandle}`);
    return { jobId: String(pollHandle), status: 'PENDING' };
  }

  /** Poll the fal queue: <base>/<model>/requests/<id>/status, then .../requests/<id> for the result. */
  private async pollSeedance(jobId: string, model: string): Promise<VideoJobResponse> {
    const cfg = this.seedanceCfg();
    const m = model || 'bytedance/seedance-2.0/text-to-video';
    if (jobId.startsWith('sync_')) return { jobId, status: 'PROCESSING' }; // a sync result was already captured at submit
    const headers = { 'Authorization': `${cfg.scheme} ${cfg.key}` };
    // jobId holds fal's response_url for new runs; fall back to reconstruction only for legacy bare ids.
    const resultUrl = /^https?:\/\//.test(jobId) ? jobId : `${cfg.base}/${m}/requests/${jobId}`;
    const sres = await fetch(`${resultUrl}/status`, { headers });
    if (!sres.ok) return { jobId, status: 'PROCESSING' };
    const s: any = await sres.json();
    const st = String(s?.status || '').toUpperCase();
    if (st === 'FAILED' || st === 'ERROR') return { jobId, status: 'FAILED', error: s?.error || s?.detail || 'Seedance task failed' };
    if (!['COMPLETED', 'OK', 'SUCCEEDED', 'FINISHED'].includes(st)) return { jobId, status: 'PROCESSING' };
    const rres = await fetch(resultUrl, { headers });
    if (!rres.ok) return { jobId, status: 'PROCESSING' };
    const r: any = await rres.json();
    const url = r?.video?.url || (Array.isArray(r?.videos) ? r.videos[0]?.url : undefined) || r?.output?.video?.url;
    if (url) return { jobId, status: 'COMPLETED', videoUrl: url };
    return { jobId, status: 'PROCESSING' };
  }

  /** Is ffmpeg on PATH? */
  private ffmpegAvailable(): Promise<boolean> {
    return new Promise((res) => { try { const p = spawn('ffmpeg', ['-version']); p.on('error', () => res(false)); p.on('close', (c) => res(c === 0)); } catch { res(false); } });
  }
  private runFfmpeg(args: string[]): Promise<boolean> {
    return new Promise((res) => { try { const p = spawn('ffmpeg', args); p.stderr.on('data', () => {}); p.on('error', () => res(false)); p.on('close', (c) => res(c === 0)); } catch { res(false); } });
  }

  /**
   * Stitch this project's COMPLETED scene clips — in render order (createdAt) — into ONE continuous vertical
   * MP4, served from /uploads. Downloads each clip (fal/remote or local), concatenates with ffmpeg (stream-copy
   * fast path, re-encode fallback for mixed params), and returns the served path. This is the "full episode" the
   * per-scene renders add up to.
   */
  async stitchProject(projectId: string, stageVersionId?: string, runIds?: string[]): Promise<{ url: string; count: number; durationSec: number }> {
    let runs: any[];
    if (runIds && runIds.length) {
      // Caller-supplied order (the batch's scene order) — authoritative, no createdAt ambiguity or re-render dupes.
      const found = await (this.prisma as any).videoRun.findMany({ where: { id: { in: runIds }, status: 'COMPLETED', videoUrl: { not: null } } });
      const byId = new Map(found.map((r: any) => [r.id, r]));
      runs = runIds.map((id) => byId.get(id)).filter(Boolean);
    } else {
      const where: any = { projectId, status: 'COMPLETED', videoUrl: { not: null } };
      if (stageVersionId) where.stageVersionId = stageVersionId;
      runs = await (this.prisma as any).videoRun.findMany({ where, orderBy: { createdAt: 'asc' } });
    }
    if (!runs.length) throw new Error('No completed clips to stitch yet — render the scenes first.');
    if (runs.length < 2) throw new Error('Only one clip is ready — render more scenes before stitching them together.');
    if (!(await this.ffmpegAvailable())) throw new Error('ffmpeg is not installed on the server — install ffmpeg to stitch clips into one video.');

    const work = join(process.cwd(), 'uploads', `stitch-${projectId}-${Date.now()}`);
    await mkdir(work, { recursive: true });
    try {
      const files: string[] = [];
      let durationSec = 0;
      for (let i = 0; i < runs.length; i++) {
        const url = String(runs[i].videoUrl);
        const local = join(work, `clip-${String(i).padStart(3, '0')}.mp4`);
        if (url.startsWith('/uploads/')) {
          await copyFile(join(process.cwd(), url.replace(/^\//, '')), local);
        } else {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`Could not download clip ${i + 1} of ${runs.length} (HTTP ${r.status}).`);
          await writeFile(local, Buffer.from(await r.arrayBuffer()));
        }
        files.push(local);
        durationSec += Number(runs[i].durationSec) || 5;
      }
      const listPath = join(work, 'list.txt');
      await writeFile(listPath, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
      const outName = `episode-${projectId}-${Date.now()}.mp4`;
      const outAbs = join(process.cwd(), 'uploads', outName);
      // Fast path: stream-copy (clips from one engine share codec/params). Fallback: normalise + re-encode.
      let done = await this.runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', outAbs]);
      if (!done) done = await this.runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', outAbs]);
      if (!done) throw new Error('ffmpeg failed to stitch the clips into one video.');
      return { url: `/uploads/${outName}`, count: runs.length, durationSec };
    } finally {
      await rm(work, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Generate a CHARACTER ANCHOR image via Seedream (fal queue, same FAL_KEY) — the approved portrait whose face,
   * outfit and look every scene then locks onto. Returns fal's hosted image URL (public → can be fed straight
   * into Seedance reference-to-video). Vertical 9:16 by default for vertical drama.
   */
  async generateImage(prompt: string, opts?: { width?: number; height?: number; model?: string; seed?: number }): Promise<string> {
    const cfg = this.seedanceCfg();
    if (!cfg.key) throw new Error('Image key missing — set FAL_KEY in the backend env.');
    const model = opts?.model || process.env.SEEDREAM_MODEL || 'fal-ai/bytedance/seedream/v4/text-to-image';
    const body: any = { prompt, image_size: { width: opts?.width || 1080, height: opts?.height || 1920 }, num_images: 1 };
    if (opts?.seed) body.seed = opts.seed;
    const headers = { 'Authorization': `${cfg.scheme} ${cfg.key}`, 'Content-Type': 'application/json' };
    const res = await fetch(`${cfg.base}/${model}`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Image API error: ${res.status} ${res.statusText} — ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const data: any = await res.json();
    const pick = (j: any) => j?.images?.[0]?.url || j?.image?.url || (Array.isArray(j?.output) ? j.output[0]?.url || j.output[0] : undefined);
    let url = pick(data);
    if (url) return String(url);
    // Queue mode: poll fal's response_url (drops the endpoint segment for sub-path models, like Seedance).
    const poll = data?.response_url || (data?.request_id ? `${cfg.base}/${model}/requests/${data.request_id}` : null);
    if (!poll) throw new Error('Image gen returned neither an image nor a poll handle.');
    for (let k = 0; k < 60; k++) {
      await new Promise((r) => setTimeout(r, 2000));
      const sres = await fetch(poll + '/status', { headers: { 'Authorization': `${cfg.scheme} ${cfg.key}` } });
      if (sres.ok) { const sj: any = await sres.json(); const st = String(sj?.status || '').toUpperCase(); if (['COMPLETED', 'OK', 'SUCCEEDED', 'FINISHED'].includes(st)) break; if (st === 'FAILED' || st === 'ERROR') throw new Error('Image generation failed.'); }
    }
    const rres = await fetch(poll, { headers: { 'Authorization': `${cfg.scheme} ${cfg.key}` } });
    url = pick(await rres.json().catch(() => ({})));
    if (!url) throw new Error('Image generation completed but returned no image URL.');
    return String(url);
  }

  // ── Cohesive episode render (server-side job) ──────────────────────────────────────────────────
  /** Kick off an episode render: each beat → reference-to-video (anchor identity + prev-clip continuity +
   *  native audio), then stitch. Returns immediately with an episodeId the UI polls. */
  async renderEpisode(input: { projectId: string; stageVersionId?: string; anchorUrl?: string; title?: string; aspectRatio?: string; beats: Array<{ prompt: string; durationSec?: number; seed?: number }> }): Promise<{ episodeId: string }> {
    const beats = (input.beats || []).filter((b) => b && String(b.prompt || '').trim());
    if (!beats.length) throw new Error('No beats to render — provide at least one beat prompt.');
    const id = 'ep_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const job: any = {
      id, projectId: input.projectId, stageVersionId: input.stageVersionId || null,
      title: input.title || 'Episode', status: 'RENDERING', anchorUrl: input.anchorUrl || null,
      episodeUrl: null, aspectRatio: input.aspectRatio || '9:16',
      beats: beats.map((b, i) => ({ index: i, prompt: String(b.prompt), durationSec: Math.max(4, Math.min(15, Number(b.durationSec) || 14)), seed: b.seed, runId: null, status: 'PENDING', url: null, error: null })),
      totalBeats: beats.length, doneBeats: 0, durationSec: 0, error: null, createdAt: new Date().toISOString(),
    };
    this.episodeJobs.set(id, job);
    void this.runEpisode(id).catch((e) => { const j = this.episodeJobs.get(id); if (j) { j.status = 'FAILED'; j.error = String(e?.message || e); } });
    return { episodeId: id };
  }

  getEpisode(id: string) { return this.episodeJobs.get(id) || null; }
  listEpisodes(projectId: string) { return Array.from(this.episodeJobs.values()).filter((j) => j.projectId === projectId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); }

  /** Background runner: render each beat in order (chaining the previous clip), then stitch + persist. */
  private async runEpisode(id: string) {
    const job = this.episodeJobs.get(id); if (!job) return;
    let prevUrl: string | null = null;
    for (let i = 0; i < job.beats.length; i++) {
      const beat = job.beats[i];
      beat.status = 'RENDERING';
      const params: any = { prompt: beat.prompt, durationSec: beat.durationSec, aspectRatio: job.aspectRatio, generateAudio: true, seed: beat.seed };
      if (job.anchorUrl) params.imageUrls = [job.anchorUrl];   // identity (Face Lock)
      if (prevUrl) params.videoUrls = [prevUrl];               // continuity (chain from previous clip)
      let runId: string;
      try { runId = await this.generateShot(job.projectId, params, job.stageVersionId || undefined); }
      catch (e: any) { beat.status = 'FAILED'; beat.error = String(e?.message || e); throw new Error(`Beat ${i + 1} failed to start: ${e?.message || e}`); }
      beat.runId = runId;
      const url = await this.pollRun(runId, 240);
      if (!url) { beat.status = 'FAILED'; beat.error = 'render failed'; throw new Error(`Beat ${i + 1} render did not complete.`); }
      beat.status = 'COMPLETED'; beat.url = url; job.doneBeats++; prevUrl = url;
    }
    job.status = 'STITCHING';
    const runIds = job.beats.map((b: any) => b.runId).filter(Boolean);
    const stitched = await this.stitchProject(job.projectId, job.stageVersionId || undefined, runIds);
    job.episodeUrl = stitched.url; job.durationSec = stitched.durationSec;
    // Persist the finished episode as a VideoRun → survives restart + appears in the render-bay gallery.
    try {
      await (this.prisma as any).videoRun.create({ data: { projectId: job.projectId, stageVersionId: job.stageVersionId || null, provider: 'seedance', model: 'episode', jobId: id, status: 'COMPLETED', videoUrl: stitched.url, prompt: job.title || 'Episode', durationSec: stitched.durationSec || 0, aspectRatio: job.aspectRatio } });
    } catch { /* gallery persistence is best-effort */ }
    job.status = 'COMPLETED';
  }

  /** Poll one VideoRun to a terminal state (server-side); returns its videoUrl or '' on failure. */
  private async pollRun(runId: string, maxTries: number): Promise<string> {
    for (let k = 0; k < maxTries; k++) {
      await new Promise((r) => setTimeout(r, 4000));
      try { const s = await this.checkJobStatus(runId); if (s.status === 'COMPLETED') return String(s.videoUrl || ''); if (s.status === 'FAILED') return ''; } catch { /* transient — keep polling */ }
    }
    return '';
  }
}
