import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BudgetService } from './budget.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/budget')
export class BudgetController {
  constructor(private service: BudgetService) {}

  // ── Budget Versions ───────────────────────────────────────────────────────

  @Get('versions/:versionId')
  @ApiOperation({ summary: 'Get a full budget version with all sections, accounts, and line items' })
  getVersion(@Param('versionId') versionId: string) {
    return this.service.getVersion(versionId);
  }

  @Post('versions')
  @ApiOperation({ summary: 'Create a new budget version for a project' })
  createVersion(@Body() body: { projectId: string; versionName: string; notes?: string }) {
    return this.service.createVersion(body.projectId, body);
  }

  @Patch('versions/:versionId/activate')
  activateVersion(@Param('versionId') versionId: string) {
    return this.service.setActiveVersion(versionId);
  }

  @Patch('versions/:versionId/lock')
  lockVersion(@Param('versionId') versionId: string, @Req() req: any) {
    return this.service.lockVersion(versionId, req.user?.id);
  }

  @Patch('versions/:versionId/status')
  @RequirePermission('production', 2)
  @ApiOperation({ summary: 'Role-gated lifecycle transition (DRAFT→REVIEW→APPROVED→LOCKED→WORKING) with audit log' })
  transitionStatus(@Param('versionId') versionId: string, @Body() body: { toStatus: string; notes?: string }, @Req() req: any) {
    return this.service.executeStatusTransition(versionId, body, req.user?.id, req.user?.role);
  }

  @Get('topsheet-comparison/:projectId')
  @ApiOperation({ summary: 'Dual-column topsheet: locked baseline vs current working copy with variance' })
  topsheetComparison(@Param('projectId') projectId: string, @Query('baselineId') baselineId?: string, @Query('workingId') workingId?: string) {
    return this.service.topsheetComparison(projectId, baselineId, workingId);
  }

  @Get('lifecycle/:projectId')
  @ApiOperation({ summary: 'Budget lifecycle audit trail' })
  lifecycle(@Param('projectId') projectId: string) {
    return this.service.lifecycleHistory(projectId);
  }

  @Post('versions/:versionId/clone')
  cloneVersion(@Param('versionId') versionId: string, @Body() body: { versionName?: string }) {
    return this.service.cloneVersion(versionId, body);
  }

  @Get('versions/:versionId/topsheet')
  @ApiOperation({ summary: 'Get the top-sheet summary for a budget version' })
  topSheet(@Param('versionId') versionId: string) {
    return this.service.getTopSheet(versionId);
  }

  @Get('versions/:versionId/budget-vs-actual')
  @ApiOperation({ summary: 'Compare budget to actual committed expenses tagged to the project' })
  budgetVsActual(@Param('versionId') versionId: string) {
    return this.service.getBudgetVsActual(versionId);
  }

  @Post('versions/:versionId/recalculate')
  @ApiOperation({ summary: 'Recalculate all formula-based line items using current globals' })
  recalculate(@Param('versionId') versionId: string) {
    return this.service.recalculateVersion(versionId);
  }

  // ── Globals ───────────────────────────────────────────────────────────────

  @Post('versions/:versionId/globals')
  upsertGlobal(@Param('versionId') versionId: string, @Body() body: any) {
    return this.service.upsertGlobal(versionId, body);
  }

  @Delete('globals/:globalId')
  deleteGlobal(@Param('globalId') globalId: string) {
    return this.service.deleteGlobal(globalId);
  }

  // ── Fringe Profiles ───────────────────────────────────────────────────────

  @Post('versions/:versionId/fringes')
  createFringe(@Param('versionId') versionId: string, @Body() body: any) {
    return this.service.createFringe(versionId, body);
  }

  @Put('fringes/:fringeId')
  updateFringe(@Param('fringeId') fringeId: string, @Body() body: any) {
    return this.service.updateFringe(fringeId, body);
  }

  @Delete('fringes/:fringeId')
  deleteFringe(@Param('fringeId') fringeId: string) {
    return this.service.deleteFringe(fringeId);
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  @Post('versions/:versionId/sections')
  createSection(@Param('versionId') versionId: string, @Body() body: any) {
    return this.service.createSection(versionId, body);
  }

  @Put('sections/:sectionId')
  updateSection(@Param('sectionId') sectionId: string, @Body() body: any) {
    return this.service.updateSection(sectionId, body);
  }

  // ── Accounts ──────────────────────────────────────────────────────────────

  @Post('sections/:sectionId/accounts')
  createAccount(@Param('sectionId') sectionId: string, @Body() body: any) {
    return this.service.createAccount(sectionId, body);
  }

  @Put('accounts/:accountId')
  updateAccount(@Param('accountId') accountId: string, @Body() body: any) {
    return this.service.updateAccount(accountId, body);
  }

  // ── Line Items ────────────────────────────────────────────────────────────

  @Post('accounts/:accountId/items')
  createLineItem(@Param('accountId') accountId: string, @Body() body: any) {
    return this.service.createLineItem(accountId, body);
  }

  @Put('items/:itemId')
  updateLineItem(@Param('itemId') itemId: string, @Body() body: any) {
    return this.service.updateLineItem(itemId, body);
  }

  @Delete('items/:itemId')
  deleteLineItem(@Param('itemId') itemId: string) {
    return this.service.deleteLineItem(itemId);
  }
}
