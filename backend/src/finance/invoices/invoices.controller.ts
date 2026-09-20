import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { VoidInvoiceDto, DeleteInvoiceDto } from './dto/lifecycle.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { SkipAudit } from '../../audit/skip-audit.decorator';
import { InvoiceStatus } from '@prisma/client';

/** Same derivation the app-wide AuditInterceptor uses, so lifecycle rows and its rows agree. */
const clientIp = (req: any): string | undefined => req.ip || req.headers?.['x-forwarded-for'] || undefined;

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('finance', 1)
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
  @RequirePermission('finance', 2)
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
  @RequirePermission('finance', 2)
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  recordPayment(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body() paymentData: any,
    @Request() req,
  ) {
    return this.service.recordPayment(id, amount, paymentData, req.user.id);
  }

  // ── Lifecycle: archive, unarchive, void, delete ──────────────────────────
  // @SkipAudit() on every one of these: the service writes its own, richer
  // audit row (reason, before-values, reversing journal entry, IP) — logging
  // through the app-wide AuditInterceptor as well would double-log every
  // archive, void and delete in two different shapes.

  @Post(':id/archive')
  @RequirePermission('finance', 2)
  @SkipAudit()
  @ApiOperation({ summary: 'Hide an invoice from the default list. Reversible.' })
  archive(@Param('id') id: string, @Request() req) {
    return this.service.archive(id, req.user.id, clientIp(req));
  }

  @Post(':id/unarchive')
  @RequirePermission('finance', 2)
  @SkipAudit()
  @ApiOperation({ summary: 'Bring an archived invoice back into the list' })
  unarchive(@Param('id') id: string, @Request() req) {
    return this.service.unarchive(id, req.user.id, clientIp(req));
  }

  @Post(':id/void')
  @RequirePermission('finance', 3)
  @SkipAudit()
  @ApiOperation({
    summary: 'Void an invoice — keeps the number, posts a reversing journal',
  })
  voidInvoice(@Param('id') id: string, @Body() dto: VoidInvoiceDto, @Request() req) {
    return this.service.voidInvoice(id, dto, req.user.id, clientIp(req));
  }

  @Delete(':id')
  @RequirePermission('finance', 3)
  @SkipAudit()
  @ApiOperation({
    summary: 'Delete an invoice. Refused once anything has posted against it.',
  })
  remove(@Param('id') id: string, @Body() dto: DeleteInvoiceDto, @Request() req) {
    return this.service.remove(id, dto, req.user.id, clientIp(req));
  }
}
