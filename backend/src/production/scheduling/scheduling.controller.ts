import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulingService } from './scheduling.service';
import { DoodCalculationService } from './dood-calculation.service';
import { CalendarAnchoringService } from './calendar-anchoring.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/scheduling')
export class SchedulingController {
  constructor(private service: SchedulingService, private dood2: DoodCalculationService, private calendar: CalendarAnchoringService) {}

  // Production calendar: Prep/Shoot/Wrap/Strike dates rippling from the locked anchor
  @Get('calendar/:projectId')
  projectCalendar(@Param('projectId') projectId: string) { return this.calendar.projectCalendar(projectId); }

  // Call-sheet data for one date: scenes + DOOD-filtered requirements (SW/W/WF only)
  @Get('callsheet-data/:projectId')
  callsheetData(@Param('projectId') projectId: string, @Query('date') date: string, @Query('dropAfter') dropAfter?: string) {
    return this.dood2.generateCallSheet(projectId, date, { dropAfter: dropAfter ? Number(dropAfter) : undefined });
  }

  @Get('calendar-config/:projectId') getCalConfig(@Param('projectId') projectId: string) { return this.calendar.getConfig(projectId); }
  @Put('calendar-config/:projectId') @RequirePermission('production', 2) setCalConfig(@Param('projectId') projectId: string, @Body() body: any) { return this.calendar.setConfig(projectId, body); }
  @Get('board/:projectId') board(@Param('projectId') projectId: string) { return this.service.board(projectId); }
  @Get('dood/:projectId') dood(@Param('projectId') projectId: string) { return this.service.dood(projectId); }
  @Get('conflicts/:projectId') conflicts(@Param('projectId') projectId: string) { return this.service.conflicts(projectId); }
  @Get('shooting-schedule/:projectId') shootingSchedule(@Param('projectId') projectId: string) { return this.service.shootingSchedule(projectId); }
  // M6 — multi-board scenarios (additive JSON snapshots; live board untouched)
  @Get('scenarios/:projectId') listScenarios(@Param('projectId') projectId: string) { return this.service.listScenarios(projectId); }
  @Post('scenarios/:projectId') @RequirePermission('production', 2) snapshotScenario(@Param('projectId') projectId: string, @Body() body: any) { return this.service.snapshotScenario(projectId, body || {}); }
  @Post('scenarios/:projectId/optimized') @RequirePermission('production', 2) optimizedScenario(@Param('projectId') projectId: string, @Body() body: any) { return this.service.optimizedScenario(projectId, body || {}); }
  @Post('scenarios/:projectId/compare') compareScenarios(@Param('projectId') projectId: string, @Body() body: any) { return this.service.compareScenarios(projectId, body?.ids || []); }
  @Get('scenario/:id') getScenario(@Param('id') id: string) { return this.service.getScenario(id); }
  @Put('scenario/:id') @RequirePermission('production', 2) updateScenario(@Param('id') id: string, @Body() body: any) { return this.service.updateScenario(id, body || {}); }
  @Delete('scenario/:id') @RequirePermission('production', 2) deleteScenario(@Param('id') id: string) { return this.service.deleteScenario(id); }
  @Post('scenario/:id/apply') @RequirePermission('production', 2) applyScenario(@Param('id') id: string) { return this.service.applyScenario(id); }
  // M6 — script <-> strip reconciliation (populates ScriptScene.productionStripId)
  @Get('script-strip-status/:projectId') scriptStripStatus(@Param('projectId') projectId: string) { return this.service.scriptStripStatus(projectId, { apply: false }); }
  @Post('script-strip-reconcile/:projectId') @RequirePermission('production', 2) reconcileScriptStrips(@Param('projectId') projectId: string) { return this.service.scriptStripStatus(projectId, { apply: true }); }

  // Dynamic multi-category DOOD — computed live from strips × breakdown elements
  @Get('dood-matrix/:projectId')
  doodMatrix(@Param('projectId') projectId: string, @Query('category') category?: string, @Query('dropAfter') dropAfter?: string) {
    return this.dood2.generateDoodMatrix(projectId, category || 'CAST', { dropAfter: dropAfter ? Number(dropAfter) : undefined });
  }
  @Get('dood-categories/:projectId')
  doodCategories(@Param('projectId') projectId: string) { return this.dood2.categoriesInUse(projectId); }
  // Aggregate DOOD tallies → Production Globals STAGING (never a budget version directly)
  @Post('dood-to-globals/:projectId')
  @RequirePermission('production', 2)
  doodToGlobals(@Param('projectId') projectId: string, @Body() body: any) {
    return this.dood2.refreshGlobalsStaging(projectId, { dropAfter: body?.dropAfter });
  }
  @Get('strips') strips(@Query('projectId') projectId: string) { return this.service.listStrips(projectId); }
  @Post('strips') createStrip(@Body() body: any) { return this.service.createStrip(body); }
  @Put('strips/:id') updateStrip(@Param('id') id: string, @Body() body: any) { return this.service.updateStrip(id, body); }
  @Post('reorder') reorder(@Body() body: { items: any[] }) { return this.service.reorder(body?.items || []); }
  @Post('auto-schedule/:projectId') @RequirePermission('production', 2) autoSchedule(@Param('projectId') projectId: string, @Body() body: any) { return this.service.autoSchedule(projectId, body || {}); }
  @Post('optimize/:projectId') @RequirePermission('production', 2) optimize(@Param('projectId') projectId: string, @Body() body: any) { return this.service.optimizeOrder(projectId, body || {}); }
  @Delete('strips/:id') removeStrip(@Param('id') id: string) { return this.service.removeStrip(id); }
}
