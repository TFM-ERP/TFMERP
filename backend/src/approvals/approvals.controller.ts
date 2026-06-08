import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance', 1)
@Controller('finance/approvals')
export class ApprovalsController {
  constructor(private service: ApprovalsService) {}

  @Get('pending')
  pending() { return this.service.listPending(); }

  @Get()
  listAll(@Query('status') status?: string) { return this.service.listAll(status); }

  @Get('entity/:type/:id')
  forEntity(@Param('type') type: string, @Param('id') id: string) {
    return this.service.getForEntity(type, id);
  }

  @Post('expense/:id/route')
  @ApiOperation({ summary: 'Route an expense into the approval chain (by amount)' })
  routeExpense(@Param('id') id: string, @Req() req: any) {
    return this.service.routeExpense(id, req.user?.id);
  }

  @Post('po/:id/route')
  @ApiOperation({ summary: 'Route a purchase order into the approval chain (by amount)' })
  routePo(@Param('id') id: string, @Req() req: any) {
    return this.service.routePo(id, req.user?.id);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() body: { comment?: string }, @Req() req: any) {
    return this.service.act(id, 'APPROVED', body, req.user);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() body: { comment?: string }, @Req() req: any) {
    return this.service.act(id, 'REJECTED', body, req.user);
  }
}
