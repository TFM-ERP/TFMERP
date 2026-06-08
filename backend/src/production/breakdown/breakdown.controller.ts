import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BreakdownService } from './breakdown.service';
import { ScriptImportService } from './script-import.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/breakdown')
export class BreakdownController {
  constructor(private service: BreakdownService, private scriptImport: ScriptImportService) {}

  @Post('import-script/:projectId') @RequirePermission('production', 2)
  importScript(@Param('projectId') projectId: string, @Body() body: any) { return this.scriptImport.importScript(projectId, body); }

  @Post('import-script-full/:projectId') @RequirePermission('production', 2)
  fullSetup(@Param('projectId') projectId: string, @Body() body: any) { return this.scriptImport.fullSetup(projectId, body); }

  @Get('strip/:stripId') byStrip(@Param('stripId') stripId: string) { return this.service.byStrip(stripId); }
  @Get('sheet/:stripId') sheet(@Param('stripId') stripId: string) { return this.service.sheet(stripId); }
  @Get('summary/:projectId') summary(@Param('projectId') projectId: string) { return this.service.summary(projectId); }
  @Get('location-breakdown/:projectId') locationBreakdown(@Param('projectId') projectId: string) { return this.service.locationBreakdown(projectId); }
  @Get('category-breakdown/:projectId') categoryBreakdown(@Param('projectId') projectId: string) { return this.service.categoryBreakdown(projectId); }
  @Get('day-rollup/:projectId') dayRollup(@Param('projectId') projectId: string) { return this.service.dayRollup(projectId); }
  @Post('push-to-budget/:projectId') pushToBudget(@Param('projectId') projectId: string) { return this.service.pushToBudget(projectId); }
  @Get('budget-preview/:projectId') budgetPreview(@Param('projectId') projectId: string) { return this.service.budgetPreview(projectId); }
  @Get('mapping-preview/:projectId') mappingPreview(@Param('projectId') projectId: string) { return this.service.mappingPreview(projectId); }
  @Post('apply-mapping/:projectId') @RequirePermission('production', 2)
  applyMapping(@Param('projectId') projectId: string, @Body() body: any) { return this.service.applyMapping(projectId, body?.mappings || []); }
  @Post('budget-generate/:projectId') @RequirePermission('production', 2)
  budgetGenerate(@Param('projectId') projectId: string, @Body() body: any) { return this.service.budgetFromBreakdown(projectId, body?.rateCard || {}); }
  @Post('share') share(@Request() req: any, @Body() body: any) { return this.service.shareBreakdown(req.user?.id, body); }
  @Get('shares/:projectId') myShares(@Request() req: any, @Param('projectId') projectId: string) { return this.service.mySharesForProject(req.user?.id, projectId); }
  @Post('shares/:id/read') markShareRead(@Request() req: any, @Param('id') id: string) { return this.service.markShareRead(req.user?.id, id); }
  @Post() create(@Body() body: any) { return this.service.create(body); }
  @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
