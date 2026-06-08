import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CastingService } from './casting.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Casting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('casting')
export class CastingController {
  constructor(private service: CastingService) {}

  // Master talent
  @Get('unions') unions() { return this.service.listPerformerUnions(); }
  @Get('talent') talent(@Query('search') search?: string, @Query('status') status?: string, @Req() req?: any) { return this.service.listTalent({ search, status }, req?.user?.role, req?.user?.id); }
  @Get('talent/:id') getTalent(@Param('id') id: string, @Req() req: any) { return this.service.getTalent(id, req?.user?.role, req?.user?.id); }
  @Get('talent/:id/readiness') readiness(@Param('id') id: string, @Query('projectId') projectId?: string) { return this.service.talentReadiness(id, { projectId }); }
  @Post('talent') @RequirePermission('production', 2) addTalent(@Body() b: any) { return this.service.createTalent(b); }
  @Put('talent/:id') @RequirePermission('production', 2) updTalent(@Param('id') id: string, @Body() b: any) { return this.service.updateTalent(id, b); }
  @Post('talent/:id/withdraw-consent') @RequirePermission('production', 2) withdraw(@Param('id') id: string, @Body() b: any) { return this.service.withdrawConsent(id, b?.reason); }

  // Casting calls
  @Get('dashboard') dashboard() { return this.service.dashboard(); }
  @Get('calls') calls(@Query('projectId') projectId?: string, @Query('scope') scope?: string) { return this.service.listCalls({ projectId, scope }); }
  @Get('calls/:id') call(@Param('id') id: string) { return this.service.getCall(id); }
  @Post('calls') @RequirePermission('production', 2) addCall(@Body() b: any, @Req() r: any) { return this.service.createCall(b, r.user?.id); }
  @Post('calls/from-breakdown') @RequirePermission('production', 2) fromBreakdown(@Body() b: any, @Req() r: any) { return this.service.createCallsFromBreakdown(b, r.user?.id); }
  @Put('calls/:id') @RequirePermission('production', 2) updCall(@Param('id') id: string, @Body() b: any) { return this.service.updateCall(id, b); }
  @Patch('calls/:id/status') @RequirePermission('production', 2) callStatus(@Param('id') id: string, @Body() b: any) { return this.service.setCallStatus(id, b.status); }

  // Character profiles (V2.0)
  @Get('characters') characters(@Query('projectId') projectId?: string) { return this.service.listCharacters(projectId); }
  @Get('characters/:id') character(@Param('id') id: string) { return this.service.getCharacter(id); }
  @Post('characters') @RequirePermission('production', 2) addCharacter(@Body() b: any) { return this.service.createCharacter(b); }
  @Put('characters/:id') @RequirePermission('production', 2) updCharacter(@Param('id') id: string, @Body() b: any) { return this.service.updateCharacter(id, b); }

  // Submissions / review
  @Get('calls/:id/submissions') submissions(@Param('id') id: string) { return this.service.listSubmissions(id); }
  @Post('submissions') @RequirePermission('production', 2) submit(@Body() b: any) { return this.service.submitProfile(b); }
  @Patch('submissions/:id/review') @RequirePermission('production', 2) review(@Param('id') id: string, @Body() b: any) { return this.service.reviewSubmission(id, b); }
  @Patch('submissions/:id/verdict') @RequirePermission('production', 2) verdict(@Param('id') id: string, @Body() b: any, @Req() r: any) { return this.service.setVerdict(id, b.verdict, r.user?.id); }
  @Post('submissions/:id/select') @RequirePermission('production', 2) select(@Param('id') id: string, @Body() b: any, @Req() r: any) { return this.service.selectCandidate(id, b, r.user?.id); }

  // Negotiation (V2.0)
  @Get('submissions/:id/negotiation') negotiation(@Param('id') id: string) { return this.service.getNegotiation(id); }
  @Post('submissions/:id/negotiation') @RequirePermission('production', 2) openNeg(@Param('id') id: string) { return this.service.ensureNegotiation(id); }
  @Put('negotiations/:id') @RequirePermission('production', 2) updNeg(@Param('id') id: string, @Body() b: any) { return this.service.updateNegotiation(id, b); }
  @Post('negotiations/:id/agree') @RequirePermission('production', 2) agreeNeg(@Param('id') id: string, @Body() b: any, @Req() r: any) { return this.service.agreeNegotiation(id, b, r.user?.id); }

  // Talent Intelligence — performance reviews (V2.0, internal: production level 2 = excludes TALENT_REP)
  @Get('talent/:id/reviews') @RequirePermission('production', 2) reviews(@Param('id') id: string) { return this.service.talentIntelligence(id); }

  // V3-B — Representation
  @Get('talent/:id/representations') reps(@Param('id') id: string) { return this.service.listReps(id); }
  @Post('talent/:id/representations') @RequirePermission('production', 2) addRep(@Param('id') id: string, @Body() b: any) { return this.service.addRep(id, b); }
  @Put('representations/:id') @RequirePermission('production', 2) updRep(@Param('id') id: string, @Body() b: any) { return this.service.updRep(id, b); }
  @Delete('representations/:id') @RequirePermission('production', 2) delRep(@Param('id') id: string) { return this.service.delRep(id); }
  // V3-B — Credits
  @Get('talent/:id/credits') credits(@Param('id') id: string) { return this.service.listCredits(id); }
  @Post('talent/:id/credits') @RequirePermission('production', 2) addCredit(@Param('id') id: string, @Body() b: any) { return this.service.addCredit(id, b); }
  @Delete('credits/:id') @RequirePermission('production', 2) delCredit(@Param('id') id: string) { return this.service.delCredit(id); }
  // V3-C — CRM interactions + scores
  @Get('talent/:id/interactions') interactions(@Param('id') id: string, @Query('projectId') projectId?: string) { return this.service.listInteractions(id, projectId); }
  @Post('talent/:id/interactions') @RequirePermission('production', 2) addInteraction(@Param('id') id: string, @Body() b: any, @Req() r: any) { return this.service.addInteraction(id, b, r.user?.id); }
  @Delete('interactions/:id') @RequirePermission('production', 2) delInteraction(@Param('id') id: string) { return this.service.delInteraction(id); }
  @Get('talent/:id/relationship-scores') relScores(@Param('id') id: string) { return this.service.relationshipScores(id); }
  // V3-D — Character history
  @Get('characters/:id/history') characterHistory(@Param('id') id: string) { return this.service.characterHistory(id); }
  // V3-F — Matching engine
  @Get('characters/:id/matches') characterMatches(@Param('id') id: string) { return this.service.characterMatches(id); }

  // V3-G — Expanded pipeline
  @Get('pipeline') pipeline() { return this.service.pipeline(); }
  @Patch('submissions/:id/pipeline') @RequirePermission('production', 2) setStage(@Param('id') id: string, @Body() b: any, @Req() r: any) { return this.service.setSubmissionStatus(id, b.status, r?.user?.id); }

  // V3-H — Self-tape management (metadata-only)
  @Get('calls/:id/packages') packages(@Param('id') id: string) { return this.service.listPackages(id); }
  @Post('calls/:id/packages') @RequirePermission('production', 2) addPackage(@Param('id') id: string, @Body() b: any) { return this.service.createPackage({ ...b, castingCallId: id }); }
  @Put('packages/:id') @RequirePermission('production', 2) updPackage(@Param('id') id: string, @Body() b: any) { return this.service.updatePackage(id, b); }
  @Delete('packages/:id') @RequirePermission('production', 2) delPackage(@Param('id') id: string) { return this.service.deletePackage(id); }
  @Get('self-tapes') selfTapes(@Query('packageId') packageId?: string, @Query('submissionId') submissionId?: string) { return this.service.listSelfTapes({ packageId, submissionId }); }
  @Post('self-tapes') @RequirePermission('production', 2) addSelfTape(@Body() b: any) { return this.service.submitSelfTape(b); }
  @Patch('self-tapes/:id/status') @RequirePermission('production', 2) setSelfTapeStatus(@Param('id') id: string, @Body() b: any) { return this.service.setSelfTapeStatus(id, b.status); }
  @Delete('self-tapes/:id') @RequirePermission('production', 2) delSelfTape(@Param('id') id: string) { return this.service.deleteSelfTape(id); }
  @Get('match') match(@Query('characterId') characterId: string, @Query('talentId') talentId: string) { return this.service.matchTalentToCharacter(characterId, talentId); }

  // V3-E — Advanced search + saved searches + lists
  @Post('talent-search') search(@Body() b: any, @Req() r: any) { return this.service.searchTalent(b, r?.user?.role, r?.user?.id); }
  @Get('saved-searches') savedSearches(@Req() r: any) { return this.service.listSavedSearches(r?.user?.id); }
  @Post('saved-searches') @RequirePermission('production', 2) saveSearch(@Body() b: any, @Req() r: any) { return this.service.saveSearch(b, r?.user?.id); }
  @Delete('saved-searches/:id') @RequirePermission('production', 2) delSavedSearch(@Param('id') id: string) { return this.service.deleteSavedSearch(id); }
  @Get('talent-lists') talentLists(@Query('projectId') projectId?: string) { return this.service.listTalentLists({ projectId }); }
  @Get('talent-lists/:id') talentList(@Param('id') id: string) { return this.service.getTalentList(id); }
  @Post('talent-lists') @RequirePermission('production', 2) createList(@Body() b: any, @Req() r: any) { return this.service.createTalentList(b, r?.user?.id); }
  @Delete('talent-lists/:id') @RequirePermission('production', 2) delList(@Param('id') id: string) { return this.service.deleteTalentList(id); }
  @Post('talent-lists/:id/members') @RequirePermission('production', 2) addMember(@Param('id') id: string, @Body() b: any) { return this.service.addToList(id, b.talentId, b.notes); }
  @Delete('talent-list-members/:id') @RequirePermission('production', 2) delMember(@Param('id') id: string) { return this.service.removeFromList(id); }
  @Post('talent/:id/reviews') @RequirePermission('production', 2) addReview(@Param('id') id: string, @Body() b: any, @Req() r: any) { return this.service.createReview(id, b, r.user?.id); }

  // Talent Operations Hub (V2.0)
  @Get('operations') operations(@Query('projectId') projectId: string) { return this.service.operationsHub(projectId); }
  // Project Talent roster — every engaged talent in one project-level view
  @Get('project-talent') projectTalent(@Query('projectId') projectId: string) { return this.service.projectTalent(projectId); }
  @Put('submissions/:id/ops-checklist') @RequirePermission('production', 2) opsChecklist(@Param('id') id: string, @Body() b: any) { return this.service.upsertOpsChecklist(id, b); }

  // Auditions
  @Post('submissions/:id/auditions') @RequirePermission('production', 2) addAudition(@Param('id') id: string, @Body() b: any, @Req() r: any) { return this.service.scheduleAudition(id, b, r.user?.id); }
  @Put('auditions/:id') @RequirePermission('production', 2) updAudition(@Param('id') id: string, @Body() b: any) { return this.service.updateAudition(id, b); }
}

/**
 * Public-facing talent portal — actors apply without an account. No auth guard.
 * Consent is mandatory inside submitProfile(); in production add a captcha/HMAC.
 */
@ApiTags('Casting')
@Controller('casting/public')
export class CastingPublicController {
  constructor(private service: CastingService) {}

  @Get('calls/:id') openCall(@Param('id') id: string) { return this.service.getCall(id); }
  @Post('submit') apply(@Body() b: any) { return this.service.submitProfile(b); }
}
