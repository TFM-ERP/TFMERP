import { Controller, Get, Post, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollBankService } from './payroll-bank.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/payroll-bank')
export class PayrollBankController {
  constructor(private s: PayrollBankService) {}
  // Payroll runs
  @Get('payroll-runs') listRuns(@Query('projectId') p: string) { return this.s.listRuns(p); }
  @Get('payroll-runs/preview') preview(@Query('projectId') p: string, @Query('weekEnding') w?: string) { return this.s.previewRun(p, w); }
  @Get('payroll-runs/:id') getRun(@Param('id') id: string) { return this.s.getRun(id); }
  @Post('payroll-runs') postRun(@Body() b: any, @Request() r: any) { return this.s.postRun(b.projectId, b, r.user?.id); }
  // Bank reconciliation
  @Get('bank-recon') listRecons(@Query('projectId') p: string) { return this.s.listRecons(p); }
  @Get('bank-recon/:id') getRecon(@Param('id') id: string) { return this.s.getRecon(id); }
  @Post('bank-recon') createRecon(@Body() b: any, @Request() r: any) { return this.s.createRecon(b, r.user?.id); }
  @Post('bank-recon/:id/toggle') toggle(@Param('id') id: string, @Body() b: any) { return this.s.toggleCleared(id, b.txnId); }
  @Post('bank-recon/:id/finalize') finalize(@Param('id') id: string) { return this.s.finalizeRecon(id); }
  @Delete('bank-recon/:id') removeRecon(@Param('id') id: string) { return this.s.removeRecon(id); }
}
