import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { VideoEnginesService } from './video-engines.service';
import { VideoService } from './video.service';

const Auth = () => UseGuards(JwtAuthGuard, PermissionsGuard);

/**
 * Video Engines & Routing (admin) — the render-side switchboard, mirroring the
 * `production/ai` (LLM) and `production/audio` engines controllers. Reads require
 * production:1; mutations require production:2. No raw keys are ever returned (only
 * env-var references). `health` + `engines/:key/status` power the on/live indicators.
 */
@ApiTags('Video') @ApiBearerAuth() @Auth() @RequirePermission('production', 1)
@Controller('production/video')
export class VideoEnginesController {
  constructor(private video: VideoEnginesService, private render: VideoService) {}

  @Get('engines') list() { return this.video.listEngines(); }
  @Get('engines/:key/status') status(@Param('key') key: string) { return this.video.engineStatus(key); }
  @Get('health') health() { return this.video.health(); }
  @Post('engines/seed') @RequirePermission('production', 2) seed() { return this.video.seedDefaults(); }
  @Post('engines') @RequirePermission('production', 2) create(@Body() b: any) { return this.video.createEngine(b); }
  @Put('engines/:id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() b: any) { return this.video.updateEngine(id, b); }
  @Delete('engines/:id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.video.removeEngine(id); }

  @Get('routing') getRouting(@Query('scope') scope = 'ORG', @Query('projectId') projectId?: string) { return this.video.getRouting(scope, projectId); }
  @Put('routing/:capability') @RequirePermission('production', 2) setRouting(@Param('capability') c: string, @Body() b: any, @Req() req: any) { return this.video.setRouting(c, { ...b, userId: req.user?.id }); }
  @Get('routing-resolved') resolveAll(@Query('projectId') projectId?: string) { return this.video.resolveAll(projectId); }

  // ── render trigger + status (the "Generate video" path) ──
  @Post('generate') async generate(@Body() b: any) {
    const params: any = { prompt: String(b?.prompt || ''), negativePrompt: b?.negativePrompt || undefined, durationSec: Number(b?.durationSec) || 5, aspectRatio: b?.aspectRatio || '9:16', seed: b?.seed != null ? Number(b.seed) : undefined };
    // Cohesive-episode pipeline: anchor identity + last-clip continuity + native audio.
    if (b?.imageUrl) params.imageUrl = String(b.imageUrl);
    if (b?.endImageUrl) params.endImageUrl = String(b.endImageUrl);
    if (Array.isArray(b?.imageUrls) && b.imageUrls.length) params.imageUrls = b.imageUrls.map(String);
    if (Array.isArray(b?.videoUrls) && b.videoUrls.length) params.videoUrls = b.videoUrls.map(String);
    if (b?.generateAudio != null) params.generateAudio = !!b.generateAudio;
    if (!params.prompt.trim()) throw new BadRequestException('No prompt to render — generate the VIDEO_PROMPT stage first.');
    try {
      const runId = await this.render.generateShot(String(b?.projectId || ''), params, b?.stageVersionId || undefined, b?.engineId || undefined);
      return { runId };
    } catch (e: any) {
      // Surface a clean, actionable message instead of a 500 (e.g. no enabled engine, missing key/workflow, ComfyUI offline).
      throw new BadRequestException(e?.message || 'Video render could not start — enable a video engine and set its key/workflow in AI Governance → Video engines.');
    }
  }
  @Get('runs') listRuns(@Query('projectId') projectId: string) { return this.render.listRuns(projectId); }
  @Get('runs/:id') runStatus(@Param('id') id: string) { return this.render.checkJobStatus(id); }

  // Generate a character-anchor image (Seedream via FAL_KEY) — approved before any video spend.
  @Post('anchor') async anchor(@Body() b: any) {
    const prompt = String(b?.prompt || '').trim();
    if (!prompt) throw new BadRequestException('No prompt for the character anchor.');
    try {
      const url = await this.render.generateImage(prompt, { width: b?.width, height: b?.height, seed: b?.seed != null ? Number(b.seed) : undefined });
      return { imageUrl: url };
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Could not generate the character anchor image.');
    }
  }

  // Cohesive episode render (server-side job: anchor identity → chained voiced clips → stitch). UI polls it.
  @Post('episode') async episode(@Body() b: any) {
    if (!b?.projectId) throw new BadRequestException('A projectId is required.');
    if (!Array.isArray(b?.beats) || !b.beats.length) throw new BadRequestException('Provide at least one beat.');
    try {
      return await this.render.renderEpisode({ projectId: String(b.projectId), stageVersionId: b?.stageVersionId || undefined, anchorUrl: b?.anchorUrl || undefined, title: b?.title || undefined, aspectRatio: b?.aspectRatio || '9:16', beats: b.beats });
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Could not start the episode render.');
    }
  }
  @Get('episode/:id') episodeStatus(@Param('id') id: string) {
    const job = this.render.getEpisode(id);
    if (!job) throw new BadRequestException('Episode not found (it may have been cleared on restart).');
    return job;
  }
  @Get('episodes') episodeList(@Query('projectId') projectId: string) { return this.render.listEpisodes(projectId); }

  // Stitch the project's completed scene clips into one continuous MP4 (the full episode).
  @Post('stitch') async stitch(@Body() b: any) {
    try {
      return await this.render.stitchProject(String(b?.projectId || ''), b?.stageVersionId || undefined, Array.isArray(b?.runIds) ? b.runIds.map(String) : undefined);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'Could not stitch the clips.');
    }
  }
}
