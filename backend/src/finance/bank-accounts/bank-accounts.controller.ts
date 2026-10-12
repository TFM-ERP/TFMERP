import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { PermissionsService } from '../../permissions/permissions.service';
import { visibleBankAccounts, visibleBankAccount, visibleBankAccountOrNull } from './bank-account-visibility';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance', 1)
@Controller('finance/bank-accounts')
export class BankAccountsController {
  constructor(private service: BankAccountsService, private permissions: PermissionsService) {}

  // THE READS BELOW ANSWER THROUGH bank-account-visibility. The class-level finance:1 lets a
  // caller in; which rows come back depends on the caller's level — an OWNER account, the GM's
  // own, needs finance:2. The service is left returning everything: update() and remove() call
  // findOne() themselves and must not be handed a role-filtered answer.

  @Get()
  @ApiOperation({ summary: 'List all bank accounts' })
  async findAll(@Req() req: any, @Query('includeOwner') includeOwner?: string) {
    const rows = await this.service.findAll(includeOwner === 'true' || includeOwner === '1');
    return visibleBankAccounts(this.permissions, req.user, rows);
  }

  @Get('defaults')
  @ApiOperation({ summary: 'Get default bank accounts for invoice/quotation/receiving' })
  async getDefaults(@Req() req: any) {
    // A default should never be an owner account, but nothing in this service enforces that —
    // so the three slots are checked like any other row rather than trusted.
    const d = await this.service.getDefault();
    return {
      invoice: await visibleBankAccountOrNull(this.permissions, req.user, d.invoice),
      quotation: await visibleBankAccountOrNull(this.permissions, req.user, d.quotation),
      receiving: await visibleBankAccountOrNull(this.permissions, req.user, d.receiving),
    };
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    // Without this, any finance:1 role holding an id fetched an owner account directly, past
    // every list rule. Hidden is answered as not found.
    return visibleBankAccount(this.permissions, req.user, await this.service.findOne(id), id);
  }

  // Mutating bank accounts changes where money is sent → require 'manage' (finance:3).
  // These are the SAME prisma.bankAccount rows company.controller.ts writes, and that door is at
  // finance:3; a lower level here would leave the rows writable through this one. No screen calls
  // these three — every bank-account write in the app goes through the company door.
  @Post()
  @RequirePermission('finance', 3)
  @ApiOperation({ summary: 'Add a new bank account' })
  create(@Body() dto: CreateBankAccountDto) { return this.service.create(dto); }

  @Put(':id')
  @RequirePermission('finance', 3)
  update(@Param('id') id: string, @Body() dto: UpdateBankAccountDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('finance', 3)
  @ApiOperation({ summary: 'Deactivate a bank account' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
