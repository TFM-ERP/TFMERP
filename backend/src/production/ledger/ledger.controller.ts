import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/ledger')
export class LedgerController {
  constructor(private service: LedgerService) {}

  @Get('portfolio')
  portfolio() { return this.service.portfolio(); }

  @Get('summary/:projectId')
  summary(@Param('projectId') projectId: string) { return this.service.summary(projectId); }

  // Accounts Payable
  @Get('ap-aging/:projectId') apAging(@Param('projectId') projectId: string) { return this.service.apAging(projectId); }
  @Get('paid/:projectId') paidRegister(@Param('projectId') projectId: string, @Query() q: any) { return this.service.paidRegister(projectId, q); }
  @Post('pay/:projectId') @RequirePermission('production', 2) pay(@Param('projectId') projectId: string, @Body() b: any, @Req() req: any) { return this.service.paySelected(projectId, b?.ids || [], b?.paidDate, req.user?.id); }

  // Cost coding / account drill-down
  @Get('by-account/:projectId') byAccount(@Param('projectId') projectId: string) { return this.service.byAccount(projectId); }
  @Get('account/:projectId/:code') accountLedger(@Param('projectId') projectId: string, @Param('code') code: string) { return this.service.accountLedger(projectId, code); }
  @Get('gl/:projectId') glByAccount(@Param('projectId') projectId: string) { return this.service.glByAccount(projectId); }

  // Period close
  @Get('periods/:projectId') periods(@Param('projectId') projectId: string) { return this.service.listPeriods(projectId); }
  @Post('periods/:projectId') @RequirePermission('production', 2) setPeriod(@Param('projectId') projectId: string, @Body() b: any, @Req() req: any) { return this.service.setPeriod(projectId, b?.period, b?.status === 'CLOSED' ? 'CLOSED' : 'OPEN', req.user?.id); }

  @Get()
  list(@Query('projectId') projectId: string, @Query() q: any) { return this.service.list(projectId, q); }

  @Post()
  create(@Body() body: any, @Req() req: any) { return this.service.create(body, req.user?.id); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() body: { status: string }, @Req() req: any) { return this.service.setStatus(id, body.status, req.user?.id); }

  // Submit a DRAFT project cost into its approval workflow (invoice/expense chain)
  @Post(':id/submit-approval')
  submitApproval(@Param('id') id: string, @Req() req: any) { return this.service.submitForApproval(id, req.user?.id); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
