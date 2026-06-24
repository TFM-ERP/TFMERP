import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CommercialService } from './commercial.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/commercial')
export class CommercialController {
  constructor(private service: CommercialService) {}
  @Get('usage/:projectId') listUsage(@Param('projectId') projectId: string) { return this.service.listUsage(projectId); }
  @Post('usage/:projectId') @RequirePermission('production', 2) createUsage(@Param('projectId') projectId: string, @Body() body: any) { return this.service.createUsage(projectId, body || {}); }
  @Put('usage/:id') @RequirePermission('production', 2) updateUsage(@Param('id') id: string, @Body() body: any) { return this.service.updateUsage(id, body || {}); }
  @Post('usage/:id/advance') @RequirePermission('production', 2) advance(@Param('id') id: string) { return this.service.advanceHoldingFee(id); }
  @Post('usage/:id/status') @RequirePermission('production', 2) setStatus(@Param('id') id: string, @Body() body: any) { return this.service.setUsageStatus(id, body?.status || 'ACTIVE'); }
  @Delete('usage/:id') @RequirePermission('production', 2) removeUsage(@Param('id') id: string) { return this.service.removeUsage(id); }
  @Put('parties/:projectId') @RequirePermission('production', 2) setParties(@Param('projectId') projectId: string, @Body() body: any) { return this.service.setParties(projectId, body || {}); }
  @Get('alerts/:projectId') alerts(@Param('projectId') projectId: string) { return this.service.alerts(projectId); }
  @Get('ppm/:projectId') getPpm(@Param('projectId') projectId: string) { return this.service.getPpm(projectId); }
  @Put('ppm/:projectId') @RequirePermission('production', 2) updatePpm(@Param('projectId') projectId: string, @Body() body: any) { return this.service.updatePpm(projectId, body || {}); }
}
