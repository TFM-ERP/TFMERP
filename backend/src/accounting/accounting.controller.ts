import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance', 1)
@Controller('accounting')
export class AccountingController {
  constructor(private service: AccountingService) {}

  // Chart of accounts
  @Get('accounts')
  listAccounts(@Query() q: any) { return this.service.listAccounts(q); }

  @Post('accounts')
  createAccount(@Body() body: any) { return this.service.createAccount(body); }

  @Post('accounts/seed')
  @ApiOperation({ summary: 'Seed the standard chart of accounts (only when empty)' })
  seed() { return this.service.seedChartOfAccounts(); }

  @Put('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() body: any) { return this.service.updateAccount(id, body); }

  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string) { return this.service.deleteAccount(id); }

  // Auto-posting
  @Get('posting-status') postingStatus() { return this.service.postingStatus(); }
  @Post('post-all') postAll() { return this.service.postAll(); }
  @Post('post-burden/:versionId') postBurden(@Param('versionId') versionId: string) { return this.service.postProjectBurden(versionId); }

  // Reports
  @Get('trial-balance')
  trialBalance(@Query() q: any) { return this.service.trialBalance(q); }

  @Get('summary')
  summary(@Query() q: any) { return this.service.financialSummary(q); }

  @Get('ledger/:accountId')
  ledger(@Param('accountId') accountId: string, @Query() q: any) { return this.service.generalLedger(accountId, q); }

  // Bank accounts + reconciliation
  @Get('bank-accounts')
  bankAccounts() { return this.service.listBankAccounts(); }

  @Post('bank-accounts')
  createBankAccount(@Body() body: any) { return this.service.createBankAccount(body); }

  @Get('bank-accounts/:id/reconcile')
  reconcileWorkspace(@Param('id') id: string) { return this.service.reconciliationWorkspace(id); }

  @Patch('lines/:lineId/clear')
  toggleClear(@Param('lineId') lineId: string, @Body() body: { reconciled: boolean }) {
    return this.service.toggleClear(lineId, body.reconciled);
  }

  @Post('reconciliations')
  complete(@Body() body: any) { return this.service.completeReconciliation(body); }

  // Journal entries
  @Get('journals')
  listJournals(@Query() q: any) { return this.service.listJournals(q); }

  @Get('journals/:id')
  getJournal(@Param('id') id: string) { return this.service.getJournal(id); }

  @Post('journals')
  createJournal(@Body() body: any, @Req() req: any) { return this.service.createJournal(body, req.user?.id); }

  @Put('journals/:id')
  updateJournal(@Param('id') id: string, @Body() body: any) { return this.service.updateJournal(id, body); }

  @Patch('journals/:id/post')
  postJournal(@Param('id') id: string) { return this.service.postJournal(id); }

  @Patch('journals/:id/void')
  voidJournal(@Param('id') id: string) { return this.service.voidJournal(id); }

  @Delete('journals/:id')
  deleteJournal(@Param('id') id: string) { return this.service.deleteJournal(id); }
}
