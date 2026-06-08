import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance/suppliers')
export class SuppliersController {
  constructor(private service: SuppliersService) {}

  // ── Static / Utility ──────────────────────────────────────────────────────

  @Get('expiry-alerts')
  @ApiOperation({ summary: 'Suppliers/documents expiring within 60 days' })
  expiryAlerts() { return this.service.getExpiryAlerts(); }

  @Get('categories')
  categories() { return this.service.getCategories(); }

  @Get('search')
  @ApiOperation({ summary: 'Quick search for dropdown (returns minimal fields)' })
  search(@Query('q') q: string) { return this.service.search(q || ''); }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  @Get()
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/financial-summary')
  @ApiOperation({ summary: 'Financial summary: total spend, pending, VAT reclaimed' })
  financialSummary(@Param('id') id: string) { return this.service.getFinancialSummary(id); }

  @Post()
  @ApiOperation({ summary: 'Create a new supplier' })
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update supplier status (ACTIVE/INACTIVE/BLACKLISTED)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('blacklistReason') blacklistReason?: string,
  ) { return this.service.updateStatus(id, status, blacklistReason); }

  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string) { return this.service.toggleActive(id); }

  // ── Contacts ──────────────────────────────────────────────────────────────

  @Post(':id/contacts')
  addContact(@Param('id') supplierId: string, @Body() body: any) {
    return this.service.addContact(supplierId, body);
  }

  @Put('contacts/:contactId')
  updateContact(@Param('contactId') contactId: string, @Body() body: any) {
    return this.service.updateContact(contactId, body);
  }

  @Delete('contacts/:contactId')
  removeContact(@Param('contactId') contactId: string) {
    return this.service.removeContact(contactId);
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  @Post(':id/documents')
  addDocument(@Param('id') supplierId: string, @Body() body: any) {
    return this.service.addDocument(supplierId, body);
  }

  @Delete('documents/:docId')
  removeDocument(@Param('docId') docId: string) {
    return this.service.removeDocument(docId);
  }
}
