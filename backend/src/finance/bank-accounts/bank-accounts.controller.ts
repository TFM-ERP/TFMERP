import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance', 1)
@Controller('finance/bank-accounts')
export class BankAccountsController {
  constructor(private service: BankAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List all bank accounts' })
  findAll(@Query('includeOwner') includeOwner?: string) {
    return this.service.findAll(includeOwner === 'true' || includeOwner === '1');
  }

  @Get('defaults')
  @ApiOperation({ summary: 'Get default bank accounts for invoice/quotation/receiving' })
  getDefaults() { return this.service.getDefault(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

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
