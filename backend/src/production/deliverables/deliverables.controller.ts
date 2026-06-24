import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DeliverablesService } from './deliverables.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/deliverables')
export class DeliverablesController {
  constructor(private service: DeliverablesService) {}
  @Get('project/:projectId') list(@Param('projectId') projectId: string) { return this.service.list(projectId); }
  @Post('project/:projectId') @RequirePermission('production', 2) create(@Param('projectId') projectId: string, @Body() body: any) { return this.service.create(projectId, body || {}); }
  @Post('generate/:projectId') @RequirePermission('production', 2) generate(@Param('projectId') projectId: string) { return this.service.generateFromBrief(projectId); }
  @Put(':id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body || {}); }
  @Post(':id/status') @RequirePermission('production', 2) setStatus(@Param('id') id: string, @Body() body: any) { return this.service.setStatus(id, body?.status || 'PLANNED'); }
  @Delete(':id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.service.remove(id); }
}
