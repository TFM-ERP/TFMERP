import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProcurementTxnsService } from './procurement-txns.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/procurement')
export class ProcurementTxnsController {
  constructor(private s: ProcurementTxnsService) {}

  // Cash advances
  @Get('cash-advances') listCa(@Query('projectId') p: string) { return this.s.cashAdvances(p); }
  @Post('cash-advances') createCa(@Body() b: any, @Request() r: any) { return this.s.createCashAdvance(b, r.user?.id); }
  @Put('cash-advances/:id') updateCa(@Param('id') id: string, @Body() b: any) { return this.s.updateCashAdvance(id, b); }
  @Post('cash-advances/:id/clear') clearCa(@Param('id') id: string, @Body() b: any, @Request() r: any) { return this.s.clearCashAdvance(id, b, r.user?.id); }
  @Post('cash-advances/:id/return') returnCa(@Param('id') id: string, @Body() b: any) { return this.s.returnCashAdvance(id, b); }
  @Delete('cash-advances/:id') removeCa(@Param('id') id: string) { return this.s.removeCashAdvance(id); }

  // Credit-card transactions
  @Get('card-txns') listCard(@Query('projectId') p: string, @Query('status') st?: string) { return this.s.cardTxns(p, st); }
  @Post('card-txns') createCard(@Body() b: any, @Request() r: any) { return this.s.createCardTxn(b, r.user?.id); }
  @Put('card-txns/:id') updateCard(@Param('id') id: string, @Body() b: any) { return this.s.updateCardTxn(id, b); }
  @Post('card-txns/:id/post') postCard(@Param('id') id: string, @Request() r: any) { return this.s.postCardTxn(id, r.user?.id); }
  @Delete('card-txns/:id') removeCard(@Param('id') id: string) { return this.s.removeCardTxn(id); }

  // Expense claims
  @Get('expense-claims') listEx(@Query('projectId') p: string, @Query('status') st?: string) { return this.s.expenseClaims(p, st); }
  @Post('expense-claims') createEx(@Body() b: any, @Request() r: any) { return this.s.createExpenseClaim(b, r.user?.id); }
  @Patch('expense-claims/:id/status') statusEx(@Param('id') id: string, @Body() b: any, @Request() r: any) { return this.s.setExpenseStatus(id, b.status, r.user?.id); }
  @Post('expense-claims/:id/reimburse') reimburseEx(@Param('id') id: string, @Request() r: any) { return this.s.reimburseExpenseClaim(id, r.user?.id); }
  @Delete('expense-claims/:id') removeEx(@Param('id') id: string) { return this.s.removeExpenseClaim(id); }
}
