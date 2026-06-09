import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LiningService } from './lining.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/lining')
export class LiningController {
  constructor(private service: LiningService) {}

  // Coverage
  @Get('revision/:revisionId') list(@Param('revisionId') revisionId: string) { return this.service.listForRevision(revisionId); }
  @Post('scene/:sceneId') @RequirePermission('production', 2) addCoverage(@Param('sceneId') sceneId: string, @Body() b: any, @Req() req: any) { return this.service.addCoverage(sceneId, b, req.user?.id); }
  @Put('coverage/:id') @RequirePermission('production', 2) updateCoverage(@Param('id') id: string, @Body() b: any) { return this.service.updateCoverage(id, b); }
  @Delete('coverage/:id') @RequirePermission('production', 2) removeCoverage(@Param('id') id: string) { return this.service.removeCoverage(id); }

  // Takes
  @Post('coverage/:id/takes') @RequirePermission('production', 2) addTake(@Param('id') id: string, @Body() b: any) { return this.service.addTake(id, b); }
  @Put('takes/:id') @RequirePermission('production', 2) updateTake(@Param('id') id: string, @Body() b: any) { return this.service.updateTake(id, b); }
  @Post('takes/:id/wrap') @RequirePermission('production', 2) wrapTake(@Param('id') id: string) { return this.service.wrapTake(id); }
  @Delete('takes/:id') @RequirePermission('production', 2) removeTake(@Param('id') id: string) { return this.service.removeTake(id); }

  // Hot Cost
  @Post('hot-cost/:projectId') hotCost(@Param('projectId') projectId: string, @Body() b: any) { return this.service.computeHotCost(projectId, b); }
  @Post('hot-cost/:projectId/push') @RequirePermission('production', 2) push(@Param('projectId') projectId: string, @Body() b: any, @Req() req: any) { return this.service.pushAccrual(projectId, b, req.user?.id); }
  @Get('accruals/:projectId') accruals(@Param('projectId') projectId: string) { return this.service.listAccruals(projectId); }
  @Delete('accruals/:id') @RequirePermission('production', 2) removeAccrual(@Param('id') id: string) { return this.service.removeAccrual(id); }
}
