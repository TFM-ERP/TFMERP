import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('maintenance')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}

  // Quotations
  @Get('quotations') listQuotations(@Query() q: any) { return this.svc.listQuotations(q); }
  @Post('quotations') createQuotation(@Body() dto: any) { return this.svc.createQuotation(dto); }
  @Put('quotations/:id') updateQuotation(@Param('id') id: string, @Body() dto: any) { return this.svc.updateQuotation(id, dto); }
  @Patch('quotations/:id/approve') approveQuotation(@Param('id') id: string) { return this.svc.approveQuotation(id); }

  // Invoices
  @Get('vendor-invoices') listInvoices(@Query() q: any) { return this.svc.listInvoices(q); }
  @Get('vendor-invoices/outstanding') outstanding() { return this.svc.getOutstandingBalances(); }
  @Get('vendor-invoices/:id') getInvoice(@Param('id') id: string) { return this.svc.getInvoice(id); }
  @Post('vendor-invoices') createInvoice(@Body() dto: any) { return this.svc.createInvoice(dto); }
  @Put('vendor-invoices/:id') updateInvoice(@Param('id') id: string, @Body() dto: any) { return this.svc.updateInvoice(id, dto); }

  // Payments
  @Get('vendor-payments') listPayments(@Query() q: any) { return this.svc.listPayments(q); }
  @Post('vendor-payments') createPayment(@Body() dto: any) { return this.svc.createPayment(dto); }
  @Patch('vendor-payments/:id/clear') clearPayment(@Param('id') id: string) { return this.svc.clearPayment(id); }
}
