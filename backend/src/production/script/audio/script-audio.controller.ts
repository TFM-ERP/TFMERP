import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../permissions/permissions.guard';
import { RequirePermission } from '../../../permissions/require-permission.decorator';
import { AudioEnginesService } from './audio-engines.service';
import { VoiceCastingService } from './voice-casting.service';
import { PronunciationService } from './pronunciation.service';
import { RenderService } from './render.service';
import { LayersService } from './layers.service';
import { AudioShareService } from './audio-share.service';

const Auth = () => UseGuards(JwtAuthGuard, PermissionsGuard);

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const audioUpload = {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_r: any, file: any, cb: any) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_r: any, file: any, cb: any) =>
    /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(extname(file.originalname)) ? cb(null, true) : cb(new BadRequestException('Upload an audio file (mp3, wav, ogg, m4a, aac, flac).'), false),
};

// ── Engines + routing (admin) ───────────────────────────────────────────────────
@ApiTags('Production') @ApiBearerAuth() @Auth() @RequirePermission('production', 1)
@Controller('production/audio')
export class AudioEnginesController {
  constructor(private engines: AudioEnginesService) {}
  @Get('engines') listEngines() { return this.engines.listEngines(); }
  @Get('engines/:key/voices') engineVoices(@Param('key') key: string) { return this.engines.listEngineVoices(key); }
  @Post('engines/seed') @RequirePermission('production', 2) seed() { return this.engines.seedDefaults(); }
  @Post('engines') @RequirePermission('production', 2) createEngine(@Body() b: any) { return this.engines.createEngine(b); }
  @Put('engines/:id') @RequirePermission('production', 2) updateEngine(@Param('id') id: string, @Body() b: any) { return this.engines.updateEngine(id, b); }
  @Delete('engines/:id') @RequirePermission('production', 2) removeEngine(@Param('id') id: string) { return this.engines.removeEngine(id); }

  @Get('routing') getRouting(@Query('scope') scope = 'ORG', @Query('projectId') projectId?: string) { return this.engines.getRouting(scope, projectId); }
  @Put('routing/:capability') @RequirePermission('production', 2) setRouting(@Param('capability') c: string, @Body() b: any, @Req() req: any) { return this.engines.setRouting(c, { ...b, userId: req.user?.id }); }
  @Get('routing-resolved') resolveAll(@Query('projectId') projectId?: string) { return this.engines.resolveAll(projectId); }
}

// ── Voice casting + profiles ─────────────────────────────────────────────────────
@ApiTags('Production') @ApiBearerAuth() @Auth() @RequirePermission('production', 1)
@Controller('production/audio')
export class VoiceCastingController {
  constructor(private casting: VoiceCastingService) {}
  @Get('casting/:revisionId') detect(@Param('revisionId') id: string) { return this.casting.detect(id); }
  @Post('casting/:revisionId/autocast') @RequirePermission('production', 2) autoCast(@Param('revisionId') id: string, @Body() b: any, @Req() req: any) { return this.casting.autoCast(id, b?.projectId, req.user?.id); }
  @Put('casting/:revisionId/character/:name') @RequirePermission('production', 2) assign(@Param('revisionId') id: string, @Param('name') name: string, @Body() b: any, @Req() req: any) { return this.casting.assign(id, name, b, req.user?.id); }
  @Delete('casting/assignment/:id') @RequirePermission('production', 2) unassign(@Param('id') id: string) { return this.casting.unassign(id); }

  @Get('voice-profiles') listProfiles(@Query() q: any) { return this.casting.listProfiles(q); }
  @Post('voice-profiles') @RequirePermission('production', 2) createProfile(@Body() b: any, @Req() req: any) { return this.casting.createProfile(b, req.user?.id); }
  @Put('voice-profiles/:id') @RequirePermission('production', 2) updateProfile(@Param('id') id: string, @Body() b: any) { return this.casting.updateProfile(id, b); }
  @Delete('voice-profiles/:id') @RequirePermission('production', 2) removeProfile(@Param('id') id: string) { return this.casting.removeProfile(id); }
}

// ── Pronunciation ────────────────────────────────────────────────────────────────
@ApiTags('Production') @ApiBearerAuth() @Auth() @RequirePermission('production', 1)
@Controller('production/audio/pronunciation')
export class PronunciationController {
  constructor(private pron: PronunciationService) {}
  @Get() list(@Query() q: any) { return this.pron.list(q); }
  @Post() @RequirePermission('production', 2) create(@Body() b: any, @Req() req: any) { return this.pron.create(b, req.user?.id); }
  @Put(':id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() b: any) { return this.pron.update(id, b); }
  @Delete(':id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.pron.remove(id); }
}

// ── Render + library + usage ─────────────────────────────────────────────────────
@ApiTags('Production') @ApiBearerAuth() @Auth() @RequirePermission('production', 1)
@Controller('production/audio')
export class RenderController {
  constructor(private render: RenderService) {}
  @Post('render/estimate/:revisionId') estimate(@Param('revisionId') id: string, @Body() b: any) { return this.render.estimateForRevision(id, b); }
  /** Live line synthesis for the Reader/transport — cached, billed to the ledger, quota-guarded. */
  @Post('speak/:revisionId') speak(@Param('revisionId') id: string, @Body() b: any, @Req() req: any) { return this.render.speakLine(id, b, req.user?.id); }
  @Post('render/:revisionId') @RequirePermission('production', 2) queue(@Param('revisionId') id: string, @Body() b: any, @Req() req: any) { return this.render.queue(id, b, req.user?.id); }
  @Post('render/run/:jobId') @RequirePermission('production', 2) run(@Param('jobId') id: string) { return this.render.run(id); }
  @Get('render/plan/:revisionId') plan(@Param('revisionId') id: string) { return this.render.renderPlan(id); }
  @Get('jobs/:projectId') jobs(@Param('projectId') id: string) { return this.render.listJobs(id); }
  @Get('job/:id') job(@Param('id') id: string) { return this.render.getJob(id); }
  @Get('jobs-for-revision/:revisionId') jobsForRevision(@Param('revisionId') id: string) { return this.render.jobsForRevision(id); }
  /** S4 — generate a layer cue's audio on demand (SFX/ambience/foley/Eleven Music). */
  @Post('cue-generate/:cueId') @RequirePermission('production', 2) generateCue(@Param('cueId') id: string, @Req() req: any) { return this.render.generateCueAudio(id, req.user?.id); }
  @Get('library/:projectId') library(@Param('projectId') id: string, @Query('revisionId') revisionId?: string) { return this.render.listAssets(id, revisionId); }
  @Post('library/:id/archive') @RequirePermission('production', 2) archive(@Param('id') id: string) { return this.render.archiveAsset(id); }
  @Get('usage/:projectId') usage(@Param('projectId') id: string) { return this.render.usageSummary(id); }
  @Get('quota/:projectId') quota(@Param('projectId') id: string) { return this.render.getQuota('PROJECT', id); }
}

// ── Sound layers ─────────────────────────────────────────────────────────────────
@ApiTags('Production') @ApiBearerAuth() @Auth() @RequirePermission('production', 1)
@Controller('production/audio/layers')
export class LayersController {
  constructor(private layers: LayersService) {}
  @Get('cues/:revisionId') cues(@Param('revisionId') id: string) { return this.layers.listCues(id); }
  @Post('suggest/:revisionId') @RequirePermission('production', 2) suggest(@Param('revisionId') id: string, @Req() req: any) { return this.layers.suggest(id, req.user?.id); }
  @Post('cue') @RequirePermission('production', 2) upsert(@Body() b: any, @Req() req: any) { return this.layers.upsertCue(b, req.user?.id); }
  @Put('cue/:id/status') @RequirePermission('production', 2) status(@Param('id') id: string, @Body() b: any) { return this.layers.setStatus(id, b?.status); }
  @Post('approve-all/:revisionId') @RequirePermission('production', 2) approveAll(@Param('revisionId') id: string) { return this.layers.approveAll(id); }
  @Delete('cue/:id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.layers.removeCue(id); }
  @Get('assets') assets(@Query() q: any) { return this.layers.listAssets(q); }

  // Upload your own sound → reusable library asset
  @Post('upload') @RequirePermission('production', 2) @UseInterceptors(FileInterceptor('file', audioUpload))
  uploadAsset(@UploadedFile() file: any, @Body() b: any, @Req() req: any) {
    if (!file) throw new BadRequestException('No audio file uploaded.');
    return this.layers.createUploadAsset(`/uploads/${file.filename}`, b, req.user?.id);
  }
  // Upload your own sound → attach directly to a cue
  @Post('cue/:id/upload') @RequirePermission('production', 2) @UseInterceptors(FileInterceptor('file', audioUpload))
  uploadToCue(@Param('id') id: string, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No audio file uploaded.');
    return this.layers.attachUploadToCue(id, `/uploads/${file.filename}`);
  }
}

// ── Share & deliver ──────────────────────────────────────────────────────────────
@ApiTags('Production') @ApiBearerAuth() @Auth() @RequirePermission('production', 1)
@Controller('production/audio/share')
export class AudioShareController {
  constructor(private share: AudioShareService) {}
  @Get('asset/:assetId') forAsset(@Param('assetId') id: string) { return this.share.listForAsset(id); }
  @Post() @RequirePermission('production', 2) create(@Body() b: any, @Req() req: any) { return this.share.create(b, req.user?.id); }
  @Post(':id/revoke') @RequirePermission('production', 2) revoke(@Param('id') id: string) { return this.share.revoke(id); }
  @Post(':id/email') @RequirePermission('production', 2) email(@Param('id') id: string, @Body() b: any) { return this.share.email(id, b); }
}

// ── Public listen (token-gated, no auth) ───────────────────────────────────────────
@ApiTags('Audio share (public)')
@Controller('public/audio-share')
export class AudioSharePublicController {
  constructor(private share: AudioShareService) {}
  @Get(':token') resolve(@Param('token') token: string, @Query('passcode') passcode?: string) { return this.share.resolvePublic(token, passcode); }
}
