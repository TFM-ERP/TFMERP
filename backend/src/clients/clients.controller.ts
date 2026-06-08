import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('clients')
export class ClientsController {
  constructor(private service: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'List all clients with optional search/status filter' })
  findAll(@Query() query: any) { return this.service.findAll(query); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/balance')
  balance(@Param('id') id: string) { return this.service.getOutstandingBalance(id); }

  @Get(':id/financial-summary')
  @ApiOperation({ summary: 'Sales, pending invoices/quotations and payments for a client' })
  financialSummary(@Param('id') id: string) { return this.service.financialSummary(id); }

  @Post()
  @ApiOperation({ summary: 'Create a new client with contacts' })
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Block / activate a client' })
  updateStatus(@Param('id') id: string, @Body() body: { status: string; blockReason?: string }) {
    return this.service.updateStatus(id, body.status, body.blockReason);
  }

  // Contacts
  @Post(':id/contacts')
  addContact(@Param('id') id: string, @Body() body: any) { return this.service.addContact(id, body); }

  @Put('contacts/:contactId')
  updateContact(@Param('contactId') contactId: string, @Body() body: any) { return this.service.updateContact(contactId, body); }

  @Delete('contacts/:contactId')
  removeContact(@Param('contactId') contactId: string) { return this.service.removeContact(contactId); }

  // Documents
  @Post(':id/documents')
  addDocument(@Param('id') id: string, @Body() body: any) { return this.service.addDocument(id, body); }

  @Delete('documents/:docId')
  removeDocument(@Param('docId') docId: string) { return this.service.removeDocument(docId); }
}
