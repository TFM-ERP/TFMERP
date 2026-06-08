import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PartsService } from './parts.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('maintenance/parts')
@UseGuards(JwtAuthGuard)
export class PartsController {
  constructor(private readonly svc: PartsService) {}

  @Get() list(@Query() q: any) { return this.svc.findAll(q); }
  @Get('warranty-alerts') warrantyAlerts() { return this.svc.getWarrantyAlerts(); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.findOne(id); }
  @Post() create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }
}
