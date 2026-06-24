import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductionReportsService } from './production-reports.service';
import { PaymentsExportService } from './payments-export.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/reports')
export class ProductionReportsController {
  constructor(private service: ProductionReportsService, private payments: PaymentsExportService) {}
  @Get('catalog') catalog() { return this.service.catalog(); }
  @Get('po-log/:projectId') poLog(@Param('projectId') projectId: string) { return this.service.poLog(projectId); }
  @Get('payroll-register/:projectId') payroll(@Param('projectId') projectId: string, @Query('period') period?: string) { return this.service.payrollRegister(projectId, period); }
  @Get('petty-cash/:projectId') pettyCash(@Param('projectId') projectId: string) { return this.service.pettyCash(projectId); }
  @Get('vendor-ytd/:projectId') vendorYtd(@Param('projectId') projectId: string) { return this.service.vendorYtd(projectId); }
  @Get('cost-to-complete/:projectId') costToComplete(@Param('projectId') projectId: string) { return this.service.costToComplete(projectId); }
  @Get('cost-overage/:projectId') costOverage(@Param('projectId') projectId: string) { return this.service.costOverage(projectId); }
  @Get('weekly-green/:projectId') weeklyGreen(@Param('projectId') projectId: string) { return this.service.weeklyGreen(projectId); }
  @Get('check-register/:projectId') checkRegister(@Param('projectId') projectId: string) { return this.service.checkRegister(projectId); }
  @Get('fringe-detail/:projectId') fringeDetail(@Param('projectId') projectId: string) { return this.service.fringeDetail(projectId); }
  @Get('box-1099/:projectId') box1099(@Param('projectId') projectId: string) { return this.service.box1099(projectId); }
  @Get('trial-balance/:projectId') trialBalance(@Param('projectId') projectId: string) { return this.service.trialBalance(projectId); }
  @Get('aicp-bid/:projectId') aicpBid(@Param('projectId') projectId: string) { return this.service.aicpBid(projectId); }
  // Bank payment-file export (EXPORT ONLY — never initiates a transfer)
  @Get('payments/eligible/:projectId') payEligible(@Param('projectId') projectId: string) { return this.payments.eligible(projectId); }
  @Post('payments/ach/:projectId') @RequirePermission('production', 2) payAch(@Param('projectId') projectId: string, @Body() body: any) { return this.payments.achFile(projectId, body || {}); }
  @Get('payments/csv/:projectId') payCsv(@Param('projectId') projectId: string) { return this.payments.csvBatch(projectId); }
}
