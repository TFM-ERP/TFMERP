import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/payroll')
export class PayrollController {
  constructor(private service: PayrollService) {}

  @Get(':projectId') list(@Param('projectId') projectId: string) { return this.service.list(projectId); }
  @Post(':projectId/preview') preview(@Param('projectId') projectId: string, @Body() b: any) { return this.service.preview(projectId, b); }
  @Post(':projectId') @RequirePermission('production', 2) create(@Param('projectId') projectId: string, @Body() b: any) { return this.service.create(projectId, b); }
  @Put('card/:id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() b: any) { return this.service.update(id, b); }
  @Delete('card/:id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.service.remove(id); }
  @Post('card/:id/post') @RequirePermission('production', 2) post(@Param('id') id: string, @Req() req: any) { return this.service.post(id, req.user?.id); }
  @Post('card/:id/reverse') @RequirePermission('production', 2) reverse(@Param('id') id: string) { return this.service.reverse(id); }
}
