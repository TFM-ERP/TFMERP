import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/bank-accounts')
export class BankAccountsController {
  constructor(private service: BankAccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List all bank accounts' })
  findAll() { return this.service.findAll(); }

  @Get('defaults')
  @ApiOperation({ summary: 'Get default bank accounts for invoice/quotation/receiving' })
  getDefaults() { return this.service.getDefault(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Add a new bank account' })
  create(@Body() dto: CreateBankAccountDto) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBankAccountDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a bank account' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
