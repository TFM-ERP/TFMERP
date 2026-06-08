import { Controller, Get, Post, Put, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { InvoiceStatus } from '@prisma/client';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/invoices')
export class InvoicesController {
  constructor(private service: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices with filters, search, and pagination' })
  findAll(@Query() query: QueryInvoiceDto) { return this.service.findAll(query); }

  @Get('aging-report')
  @ApiOperation({ summary: 'Accounts Receivable Aging Report (current, 30, 60, 90, 90+ days)' })
  agingReport() { return this.service.getAgingReport(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Create a new invoice (Proforma or Tax Invoice)' })
  create(@Body() dto: CreateInvoiceDto, @Request() req) {
    return this.service.create(dto, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a DRAFT invoice (replaces line items if items[] provided)' })
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto, @Request() req) {
    return this.service.update(id, dto, req.user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update invoice status' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: InvoiceStatus,
    @Body('notes') notes: string,
    @Request() req,
  ) {
    return this.service.updateStatus(id, status, req.user?.id, notes);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  recordPayment(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body() paymentData: any,
    @Request() req,
  ) {
    return this.service.recordPayment(id, amount, paymentData, req.user.id);
  }
}
