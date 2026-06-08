import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LaborService } from './labor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Labor & Fringe')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('labor')
export class LaborController {
  constructor(private service: LaborService) {}

  // ── Geography ──────────────────────────────────────────────────────────────
  @Get('geo/tree') @RequirePermission('production', 1) geoTree() { return this.service.geoTree(); }
  @Get('geo') @RequirePermission('production', 1) geoList() { return this.service.geoList(); }
  @Post('geo') @RequirePermission('setup', 2) createGeo(@Body() b: any) { return this.service.createGeo(b); }
  @Put('geo/:id') @RequirePermission('setup', 2) updateGeo(@Param('id') id: string, @Body() b: any) { return this.service.updateGeo(id, b); }
  @Delete('geo/:id') @RequirePermission('setup', 2) removeGeo(@Param('id') id: string) { return this.service.removeGeo(id); }

  // ── Labor bodies ────────────────────────────────────────────────────────────
  @Get('bodies') @RequirePermission('production', 1) bodies(@Query() q: any) { return this.service.laborBodies(q); }
  @Post('bodies') @RequirePermission('setup', 2) createBody(@Body() b: any) { return this.service.createLaborBody(b); }
  @Put('bodies/:id') @RequirePermission('setup', 2) updateBody(@Param('id') id: string, @Body() b: any) { return this.service.updateLaborBody(id, b); }
  @Delete('bodies/:id') @RequirePermission('setup', 2) removeBody(@Param('id') id: string) { return this.service.removeLaborBody(id); }

  // ── Agreements ────────────────────────────────────────────────────────────────
  @Get('agreements') @RequirePermission('production', 1) agreements(@Query('laborBodyId') id?: string) { return this.service.agreements(id); }
  @Get('agreements/:id') @RequirePermission('production', 1) agreement(@Param('id') id: string) { return this.service.agreement(id); }
  @Post('agreements') @RequirePermission('setup', 2) createAgreement(@Body() b: any) { return this.service.createAgreement(b); }
  @Put('agreements/:id') @RequirePermission('setup', 2) updateAgreement(@Param('id') id: string, @Body() b: any) { return this.service.updateAgreement(id, b); }
  @Delete('agreements/:id') @RequirePermission('setup', 2) removeAgreement(@Param('id') id: string) { return this.service.removeAgreement(id); }

  // ── Classifications ─────────────────────────────────────────────────────────────
  @Post('classifications') @RequirePermission('setup', 2) createClass(@Body() b: any) { return this.service.createClassification(b); }
  @Put('classifications/:id') @RequirePermission('setup', 2) updateClass(@Param('id') id: string, @Body() b: any) { return this.service.updateClassification(id, b); }
  @Delete('classifications/:id') @RequirePermission('setup', 2) removeClass(@Param('id') id: string) { return this.service.removeClassification(id); }

  // ── Rate rules ──────────────────────────────────────────────────────────────────
  @Get('rate-rules') @RequirePermission('production', 1) rateRules(@Query('agreementId') id: string) { return this.service.rateRules(id); }
  @Post('rate-rules') @RequirePermission('setup', 2) createRule(@Body() b: any) { return this.service.createRateRule(b); }
  @Put('rate-rules/:id') @RequirePermission('setup', 2) updateRule(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.updateRateRule(id, b, req.user?.id); }
  @Delete('rate-rules/:id') @RequirePermission('setup', 2) removeRule(@Param('id') id: string) { return this.service.removeRateRule(id); }

  // ── Sources ───────────────────────────────────────────────────────────────────
  @Get('sources') @RequirePermission('production', 1) sources(@Query('laborBodyId') id?: string) { return this.service.sources(id); }
  @Post('sources') @RequirePermission('setup', 2) createSource(@Body() b: any) { return this.service.createSource(b); }
  @Put('sources/:id') @RequirePermission('setup', 2) updateSource(@Param('id') id: string, @Body() b: any) { return this.service.updateSource(id, b); }
  @Delete('sources/:id') @RequirePermission('setup', 2) removeSource(@Param('id') id: string) { return this.service.removeSource(id); }

  // ── Refresh engine (allow-listed fetch → review proposals) ────────────────────────
  @Post('refresh') @RequirePermission('setup', 2) refresh(@Body() b: any) { return this.service.refreshRates(b?.laborBodyIds || []); }
  @Post('ai-research') @RequirePermission('setup', 2) aiResearch(@Body() b: any) { return this.service.aiResearch(b); }
  @Post('ai-update-all') @RequirePermission('setup', 2) aiUpdateAll() { return this.service.aiUpdateAll(); }

  // ── Rate-change proposals (approval-gated) ────────────────────────────────────────
  @Get('proposals') @RequirePermission('production', 1) proposals(@Query('status') status?: string) { return this.service.listProposals(status); }
  @Get('proposals/pending-count') @RequirePermission('production', 1) pendingCount() { return this.service.pendingCount(); }
  @Post('proposals') @RequirePermission('production', 1) createProposal(@Body() b: any, @Req() req: any) { return this.service.createProposal(b, req.user?.id); }
  @Post('proposals/:id/approve') @RequirePermission('production', 1) approveProposal(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.approveProposal(id, req.user?.id, req.user?.role, b?.notes); }
  @Post('proposals/:id/reject') @RequirePermission('production', 1) rejectProposal(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.rejectProposal(id, req.user?.id, req.user?.role, b?.notes); }

  // ── Resolution / preview ────────────────────────────────────────────────────────
  @Post('resolve') @RequirePermission('production', 1) resolve(@Body() b: any) { return this.service.resolvePreview(b); }

  // ── Project snapshot ──────────────────────────────────────────────────────────────
  @Get('project/:projectId/config') @RequirePermission('production', 1) projectConfig(@Param('projectId') id: string) { return this.service.getProjectConfig(id); }
  @Put('project/:projectId/config') @RequirePermission('production', 2) saveConfig(@Param('projectId') id: string, @Body() b: any) { return this.service.saveConfig(id, b); }
  @Post('project/:projectId/snapshot') @RequirePermission('production', 2) snapshot(@Param('projectId') id: string, @Body() b: any) { return this.service.snapshot(id, b); }
  @Put('project-rule/:id/toggle') @RequirePermission('production', 2) toggleRule(@Param('id') id: string, @Body() b: any) { return this.service.toggleProjectRule(id, !!b.enabled); }
  @Get('project/:projectId/updates') @RequirePermission('production', 1) updates(@Param('projectId') id: string) { return this.service.checkUpdates(id); }
  @Post('project/:projectId/apply-updates') @RequirePermission('production', 2) applyUpdates(@Param('projectId') id: string, @Body() b: any) { return this.service.applyUpdates(id, b.projectRateRuleIds || []); }

  // ── Budget integration ────────────────────────────────────────────────────────────
  @Post('budget/:versionId/apply-fringes') @RequirePermission('production', 2) applyFringes(@Param('versionId') id: string) { return this.service.applyFringesToVersion(id); }
  @Get('budget/:versionId/fringe-detail') @RequirePermission('production', 1) fringeDetail(@Param('versionId') id: string) { return this.service.fringeDetail(id); }

  // ── Incentives & tax credits ────────────────────────────────────────────────────
  @Get('incentives') @RequirePermission('production', 1) incentives(@Query('geoNodeId') geoNodeId?: string) { return this.service.incentivePrograms(geoNodeId); }
  @Post('incentives') @RequirePermission('setup', 2) createIncentive(@Body() b: any) { return this.service.createIncentiveProgram(b); }
  @Put('incentives/:id') @RequirePermission('setup', 2) updateIncentive(@Param('id') id: string, @Body() b: any) { return this.service.updateIncentiveProgram(id, b); }
  @Delete('incentives/:id') @RequirePermission('setup', 2) removeIncentive(@Param('id') id: string) { return this.service.removeIncentiveProgram(id); }
  @Get('project/:projectId/incentives') @RequirePermission('production', 1) projectIncentives(@Param('projectId') id: string) { return this.service.projectIncentives(id); }
  @Post('project/:projectId/incentives') @RequirePermission('production', 2) addProjectIncentive(@Param('projectId') id: string, @Body() b: any) { return this.service.addProjectIncentive(id, b); }
  @Put('project-incentive/:id') @RequirePermission('production', 2) updateProjectIncentive(@Param('id') id: string, @Body() b: any) { return this.service.updateProjectIncentive(id, b); }
  @Delete('project-incentive/:id') @RequirePermission('production', 2) removeProjectIncentive(@Param('id') id: string) { return this.service.removeProjectIncentive(id); }

  // ── Abu Dhabi rebate claim tracker ───────────────────────────────────────────────
  @Get('project/:projectId/claim') @RequirePermission('production', 1) getClaim(@Param('projectId') id: string) { return this.service.getClaim(id); }
  @Put('project/:projectId/claim') @RequirePermission('production', 2) saveClaim(@Param('projectId') id: string, @Body() b: any) { return this.service.saveClaim(id, b); }
}
