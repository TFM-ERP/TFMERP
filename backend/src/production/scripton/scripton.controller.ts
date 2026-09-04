import { Controller, Get, Post, Patch, Body, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScripOnService } from './scripton.service';
import { CanonService } from './canon/canon.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/scripton')
export class ScripOnController {
  constructor(private service: ScripOnService, private canon: CanonService) {}
  @Post('render-pdf') @RequirePermission('production', 1)
  async renderPdf(@Body() body: any, @Res() res: any) {
    try {
      const buf = await this.service.renderPdf(body?.html);
      const name = String(body?.filename || 'script.pdf').replace(/[^\w.\-]+/g, '_');
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="' + name + '"', 'Content-Length': buf.length });
      res.end(buf);
    } catch (e: any) {
      res.status(e?.code === 'NO_PUPPETEER' ? 501 : 500).json({ message: String((e && e.message) || 'render failed') });
    }
  }
  @Get('coverage/:projectId') latest(@Param('projectId') projectId: string) { return this.service.latestCoverage(projectId); }
  @Get('coverage-history/:projectId') history(@Param('projectId') projectId: string) { return this.service.coverageHistory(projectId); }
  @Post('coverage/:projectId') @RequirePermission('production', 2) coverage(@Param('projectId') projectId: string, @Body() body: any, @Req() req: any) { return this.service.coverage({ projectId, ...(body || {}) }, req?.user?.id); }
  @Post('diagnostics/:projectId') @RequirePermission('production', 2) diagnostics(@Param('projectId') projectId: string, @Body() body: any) { return this.service.diagnostics({ projectId, ...(body || {}) }); }
  @Post('compare/:projectId') @RequirePermission('production', 2) compare(@Param('projectId') projectId: string, @Body() body: any) { return this.service.compare({ projectId, ...(body || {}) }); }
  @Post('budget-fit/:projectId') @RequirePermission('production', 2) budgetFit(@Param('projectId') projectId: string, @Body() body: any) { return this.service.budgetFit({ projectId, ...(body || {}) }); }
  @Post('apply-budget-fit/:projectId') @RequirePermission('production', 2) applyBudgetFit(@Param('projectId') projectId: string, @Body() body: any) { return this.service.applyBudgetFit({ projectId, ...(body || {}) }); }
  @Post('transform/:projectId') @RequirePermission('production', 2) transform(@Param('projectId') projectId: string, @Body() body: any) { return this.service.transform({ projectId, ...(body || {}) }); }
  @Post('apply-transform/:projectId') @RequirePermission('production', 2) applyTransform(@Param('projectId') projectId: string, @Body() body: any) { return this.service.applyTransform({ projectId, ...(body || {}) }); }
  @Post('rating/:projectId') @RequirePermission('production', 2) rating(@Param('projectId') projectId: string, @Body() body: any) { return this.service.rating({ projectId, ...(body || {}) }); }
  @Post('culture-screen/:projectId') @RequirePermission('production', 2) cultureScreen(@Param('projectId') projectId: string, @Body() body: any) { return this.service.cultureScreen({ projectId, ...(body || {}) }); }
  @Post('develop/:projectId') @RequirePermission('production', 2) develop(@Param('projectId') projectId: string, @Body() body: any) { return this.service.develop({ projectId, ...(body || {}) }); }
  /** Read the attached material and pre-select the Brief. Returns suggestions; writes nothing. */
  @Post('recommend-brief/:projectId') @RequirePermission('production', 2) recommendBrief(@Param('projectId') projectId: string, @Body() body: any) { return this.service.recommendBrief(projectId, body || {}); }
  @Post('adapt/:projectId') @RequirePermission('production', 2) adapt(@Param('projectId') projectId: string, @Body() body: any) { return this.service.adapt({ projectId, ...(body || {}) }); }
  @Post('adapt-one/:projectId') @RequirePermission('production', 2) adaptOne(@Param('projectId') projectId: string, @Body() body: any) { return this.service.adaptOne({ projectId, ...(body || {}) }); }
  @Post('format-convert/:projectId') @RequirePermission('production', 2) formatConvert(@Param('projectId') projectId: string, @Body() body: any) { return this.service.formatConvert({ projectId, ...(body || {}) }); }
  @Post('market-forecast/:projectId') @RequirePermission('production', 2) marketForecast(@Param('projectId') projectId: string, @Body() body: any) { return this.service.marketForecast({ projectId, ...(body || {}) }); }
  @Post('greenlight-decision/:projectId') @RequirePermission('production', 2) greenlightDecision(@Param('projectId') projectId: string, @Body() body: any) { return this.service.greenlightDecision({ projectId, ...(body || {}) }); }
  @Get('development/pipeline/:projectId') devPipeline(@Param('projectId') projectId: string, @Query('buildId') buildId?: string) { return this.service.pipeline(projectId, buildId); }
  // Synchronous generation. Kept as-is so nothing that already calls it breaks, but the ladder should
  // use the async pair below: DRAFT is a single 25,000-token call that runs ~7 minutes, and holding an
  // HTTP request open that long means any proxy, tunnel or sleep loses the client's view of a run that
  // is actually succeeding.
  @Post('development/generate/:projectId') @RequirePermission('production', 2) devGenerate(@Param('projectId') projectId: string, @Body() body: any, @Req() req: any) { return this.service.generateStage({ projectId, ...(body || {}) }, req?.user?.id); }
  // Start a stage in the background and get a job handle back immediately. Re-requesting a stage that
  // is already running returns the same job instead of paying for a second generation.
  @Post('development/generate-async/:projectId') @RequirePermission('production', 2) devGenerateAsync(@Param('projectId') projectId: string, @Body() body: any, @Req() req: any) { return this.service.startStage({ projectId, ...(body || {}) }, req?.user?.id); }
  // Poll one job by key, or list everything in flight for a project so the ladder can restore state
  // after a reload without waiting for a stage to finish.
  @Get('development/stage-job') devStageJob(@Query('key') key: string) { return this.service.stageJob(key); }
  @Get('development/stage-jobs/:projectId') devStageJobs(@Param('projectId') projectId: string, @Query('buildId') buildId?: string) { return this.service.stageJobsFor(projectId, buildId); }
  @Post('development/version/:stageId/set') @RequirePermission('production', 2) devSetVersion(@Param('stageId') stageId: string, @Body() body: any) { return this.service.setStageVersion(stageId, body?.versionId); }
  @Post('development/version/:versionId/duplicate') @RequirePermission('production', 2) devDuplicate(@Param('versionId') versionId: string, @Body() body: any, @Req() req: any) { return this.service.duplicateVersion(versionId, req?.user?.id, body?.label); }
  @Post('development/version/:versionId/status') @RequirePermission('production', 2) devStatus(@Param('versionId') versionId: string, @Body() body: any) { return this.service.promoteVersion(versionId, body?.status); }
  @Get('development/compare') devCompare(@Query('a') a: string, @Query('b') b: string) { return this.service.compareVersions(a, b); }
  @Post('development/version/:versionId/read') @RequirePermission('production', 1) devRead(@Param('versionId') versionId: string) { return this.service.stageRead(versionId); }
  @Post('development/version/:versionId/promote-to-script') @RequirePermission('production', 2) devPromoteScript(@Param('versionId') versionId: string, @Req() req: any) { return this.service.promoteToScript(versionId, req?.user?.id); }
  @Post('development/script/:docId/regenerate') @RequirePermission('production', 2) devRegenerateFeature(@Param('docId') docId: string, @Body() body: any, @Req() req: any) { return this.service.regenerateFeature(docId, req?.user?.id, body?.mode === 'rewrite' ? 'rewrite' : 'extend'); }
  /** Stop a running generation. Cooperative: it lands after the scene in flight, and never activates the partial revision. */
  @Post('development/script/:docId/cancel') @RequirePermission('production', 2) devCancelFeature(@Param('docId') docId: string) { return this.service.cancelGeneration(docId); }
  @Get('development/package') devPackage(@Query('docId') docId?: string, @Query('projectId') projectId?: string, @Query('buildId') buildId?: string) { return this.service.developmentPackage({ docId, projectId, buildId }); }
  @Post('development/package/docx') @RequirePermission('production', 1)
  async devPackageDocx(@Body() body: any, @Res() res: any) {
    try {
      const { buffer, fileName } = await this.service.developmentPackageDocx({ docId: body?.docId, projectId: body?.projectId, buildId: body?.buildId }, body?.labels, body?.rtl);
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': 'attachment; filename="' + fileName + '"', 'Content-Length': buffer.length });
      res.end(buffer);
    } catch (e: any) {
      res.status(e?.status || 500).json({ message: String((e && e.message) || 'docx export failed') });
    }
  }
  @Post('development/character-bible/:projectId') @RequirePermission('production', 2) devCharBible(@Param('projectId') projectId: string, @Body() body: any, @Req() req: any) { return this.service.generateCharacterBible(projectId, req?.user?.id, body?.buildId); }
  @Get('development/versions/:buildId') devVersions(@Param('buildId') buildId: string) { return this.service.listBuildVersions(buildId); }
  @Post('development/versions/:buildId/new') @RequirePermission('production', 2) devNewVersion(@Param('buildId') buildId: string, @Body() body: any) { return this.service.newBuildVersion(buildId, body?.label); }
  @Post('development/versions/:buildId/switch') @RequirePermission('production', 2) devSwitchVersion(@Param('buildId') buildId: string, @Body() body: any) { return this.service.switchBuildVersion(buildId, body?.versionId); }
  @Post('development/version/:versionId/discard') @RequirePermission('production', 2) devDiscardVersion(@Param('versionId') versionId: string) { return this.service.discardBuildVersion(versionId); }
  @Get('development/versions/:buildId/brief') devVersionBrief(@Param('buildId') buildId: string, @Query('versionId') versionId?: string) { return this.service.buildVersionBrief(buildId, versionId); }
  @Get('dialect/exemplars') dialectExemplars(@Query('variety') variety?: string) { return this.service.listExemplars(variety); }
  @Post('dialect/exemplars') @RequirePermission('production', 2) dialectExemplarSave(@Body() body: any, @Req() req: any) { return this.service.saveExemplar(body || {}, req?.user?.id); }
  @Post('dialect/exemplars/:id/delete') @RequirePermission('production', 2) dialectExemplarDelete(@Param('id') id: string) { return this.service.deleteExemplar(id); }
  @Post('dialect/check') dialectCheck(@Body() body: any) { return this.service.dialectCheck(body || {}); }
  @Post('dialect/repair') @RequirePermission('production', 2) dialectRepairDoc(@Body() body: any, @Req() req: any) { return this.service.dialectRepairDoc(body || {}, req?.user?.id); }
  @Get('script-progress/:documentId') scriptProgress(@Param('documentId') documentId: string) { return this.service.scriptProgress(documentId); }
  @Get('intake/:projectId') intakeGet(@Param('projectId') projectId: string) { return this.service.getIntake(projectId); }
  @Post('intake/:projectId') @RequirePermission('production', 2) intakeSave(@Param('projectId') projectId: string, @Body() body: any) { return this.service.saveIntake(projectId, body); }
  @Post('research/:projectId') @RequirePermission('production', 2) research(@Param('projectId') projectId: string) { return this.service.research(projectId); }
  @Get('lore') loreLibrary(@Query('culture') culture?: string, @Query('genre') genre?: string, @Query('archetype') archetype?: string, @Query('q') q?: string, @Query('pantheon') pantheon?: string) { return this.service.loreLibrary({ culture, genre, archetype, q, pantheon }); }
  @Post('analytics/:projectId') @RequirePermission('production', 2) analytics(@Param('projectId') projectId: string, @Body() body: any) { return this.service.analytics({ projectId, ...(body || {}) }); }
  @Get('workspace') workspace() { return this.service.scriptonWorkspaceView(); }
  @Get('settings') scriptonSettings(@Query('projectId') projectId?: string) { return this.service.getScriptonSettings(projectId || ''); }
  @Patch('settings') @RequirePermission('production', 2) saveScriptonSettings(@Body() body: any) { return this.service.saveScriptonSettings(body || {}); }
  @Get('builds') buildsList(@Query('projectId') projectId?: string, @Query('bin') bin?: string) { return this.service.listBuilds(projectId, bin === '1' || bin === 'true'); }
  @Post('builds') @RequirePermission('production', 2) buildCreate(@Body() body: any) { return this.service.createBuild(body || {}); }
  @Post('builds/:id/rename') @RequirePermission('production', 2) buildRename(@Param('id') id: string, @Body() body: any) { return this.service.renameBuild(id, body?.name); }
  @Post('builds/:id/status') @RequirePermission('production', 2) buildStatus(@Param('id') id: string, @Body() body: any) { return this.service.setBuildStatus(id, body?.status); }
  @Post('builds/:id/delete') @RequirePermission('production', 2) buildDelete(@Param('id') id: string) { return this.service.deleteBuild(id); }
  @Post('builds/:id/restore') @RequirePermission('production', 2) buildRestore(@Param('id') id: string) { return this.service.restoreBuild(id); }
  @Post('builds/:id/purge') @RequirePermission('production', 2) buildPurge(@Param('id') id: string) { return this.service.purgeBuild(id); }
  @Post('development/stage/:stageId/reset') @RequirePermission('production', 2) stageReset(@Param('stageId') stageId: string, @Body() body: any) { return this.service.resetStage(stageId, !!(body && body.cascade)); }
  @Post('development/version/:versionId/promote-build') @RequirePermission('production', 2) promoteBuild(@Param('versionId') versionId: string, @Body() body: any, @Req() req: any) { return this.service.promoteBuild({ versionId, ...(body || {}) }, req?.user?.id); }
  @Post('development/build/:buildId/promote') @RequirePermission('production', 2) promoteFromBuild(@Param('buildId') buildId: string, @Body() body: any, @Req() req: any) { return this.service.promoteBuild({ buildId, ...(body || {}) }, req?.user?.id); }
  @Post('ingest') @RequirePermission('production', 2) ingest(@Body() body: any) { return (body && body.url) ? this.service.ingestUrl(body.url) : this.service.ingestHtml((body && body.html) || ''); }
  @Post('role-profiles/:projectId') @RequirePermission('production', 2) roleProfiles(@Param('projectId') projectId: string, @Body() body: any, @Req() req: any) { return this.service.roleProfiles({ projectId, ...(body || {}) }, req?.user?.id); }
  @Post('lookboard/:projectId') @RequirePermission('production', 2) lookboard(@Param('projectId') projectId: string, @Body() body: any, @Req() req: any) { return this.service.lookboardPlan({ projectId, ...(body || {}) }, req?.user?.id); }
  @Post('market-read/:projectId') @RequirePermission('production', 2) marketRead(@Param('projectId') projectId: string, @Body() body: any, @Req() req: any) { return this.service.marketRead({ projectId, ...(body || {}) }, req?.user?.id); }
  @Get('notes/:projectId') notesList(@Param('projectId') projectId: string, @Query('revisionId') revisionId?: string) { return this.service.listNotes(projectId, revisionId); }
  @Post('notes/:projectId') @RequirePermission('production', 2) noteAdd(@Param('projectId') projectId: string, @Body() body: any, @Req() req: any) { return this.service.addNote({ projectId, ...(body || {}) }, req?.user?.id); }
  @Post('notes/:projectId/seed') @RequirePermission('production', 2) notesSeed(@Param('projectId') projectId: string, @Body() body: any, @Req() req: any) { return this.service.seedNotes({ projectId, ...(body || {}) }, req?.user?.id); }
  @Post('note/:id/resolve') @RequirePermission('production', 2) noteResolve(@Param('id') id: string, @Body() body: any) { return this.service.resolveNote(id, body?.resolved); }
  @Post('note/:id/delete') @RequirePermission('production', 2) noteDelete(@Param('id') id: string) { return this.service.deleteNote(id); }
  @Post('notes-stale/:projectId') @RequirePermission('production', 2) notesStale(@Param('projectId') projectId: string, @Body() body: any) { return this.service.notesStale({ projectId, ...(body || {}) }); }
  @Get('lookbook/:projectId') lookbookGet(@Param('projectId') projectId: string) { return this.service.lookbook({ projectId }); }
  @Get('canon') @RequirePermission('production', 1)
  async listCanon(@Query('scriptId') scriptId: string) {
    return this.canon.listFacts(scriptId);
  }
  @Get('revision-pass') @RequirePermission('production', 1)
  async openPass(@Query('scriptId') scriptId: string) {
    return this.canon.openPass(scriptId);
  }
  @Post('revision-pass/stage') @RequirePermission('production', 2)
  async stageChange(@Body() body: any) {
    return this.canon.stageChange(body);
  }
  @Post('revision-pass/:passId/render') @RequirePermission('production', 2)
  async renderRevisionPass(@Param('passId') passId: string, @Body() body: any, @Req() req: any) {
    return this.canon.renderPass(passId, body?.projectId, req?.user?.id);
  }
  @Get('revision-pass/render-result') @RequirePermission('production', 1)
  async renderResult(@Query('passId') passId: string) {
    return this.canon.renderResult(passId);
  }
  @Get('versions') @RequirePermission('production', 1)
  async versionsView(@Query('scriptId') scriptId: string) {
    return this.canon.versionsView(scriptId);
  }
  // Shared top bar: the workspace's current continuity ring + active version. Resolves the SAME
  // source Develop uses (a build's linked kernel script), selected by "has a rendered pass" — so
  // every script-scoped screen shows the identical %·V, and hides uniformly when nothing rendered.
  @Get('top-version') @RequirePermission('production', 1)
  async topVersion(@Query('projectId') projectId: string, @Query('scriptId') scriptId?: string) {
    return this.canon.workspaceTopVersion(projectId, scriptId);
  }
}
