import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('maintenance/vendors')
@UseGuards(JwtAuthGuard)
export class VendorsController {
  constructor(private readonly svc: VendorsService) {}

  @Get()
  list(@Query() q: any) { return this.svc.findAll(q); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.findOne(id); }

  @Get(':id/financial-summary')
  financialSummary(@Param('id') id: string) { return this.svc.getFinancialSummary(id); }

  @Post()
  create(@Body() dto: any) { return this.svc.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }

  @Post(':id/documents')
  addDoc(@Param('id') id: string, @Body() dto: any) { return this.svc.addDocument(id, dto); }

  @Delete('documents/:docId')
  removeDoc(@Param('docId') docId: string) { return this.svc.removeDocument(docId); }
}
