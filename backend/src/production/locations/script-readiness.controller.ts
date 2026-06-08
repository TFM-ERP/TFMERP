import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScriptReadinessService } from './script-readiness.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/script-readiness')
export class ScriptReadinessController {
  constructor(private service: ScriptReadinessService) {}

  // Readiness board
  @Get('board/:projectId') board(@Param('projectId') projectId: string) { return this.service.readinessBoard(projectId); }

  // Scene-change requests
  @Get('requests/:projectId') list(@Param('projectId') projectId: string, @Query('status') status?: string) { return this.service.listRequests(projectId, status); }
  @Post('requests/:projectId') @RequirePermission('production', 2)
  create(@Param('projectId') projectId: string, @Body() b: any, @Req() req: any) {
    return this.service.createRequest(projectId, { ...b, raisedBy: req.user?.id, raisedByName: b?.raisedByName || req.user?.name });
  }
  @Put('requests/:id') @RequirePermission('production', 2)
  update(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.updateRequest(id, { ...b, resolvedBy: b?.resolvedBy || req.user?.id }); }
  @Delete('requests/:id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.service.removeRequest(id); }
}
