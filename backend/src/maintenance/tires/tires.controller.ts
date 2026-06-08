import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TiresService } from './tires.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('maintenance/tires')
@UseGuards(JwtAuthGuard)
export class TiresController {
  constructor(private readonly svc: TiresService) {}

  @Get() list(@Query() q: any) { return this.svc.findAll(q); }
  @Get('warranty-alerts') warrantyAlerts() { return this.svc.getWarrantyAlerts(); }
  @Get('by-asset/:assetId') byAsset(@Param('assetId') assetId: string) { return this.svc.getByAsset(assetId); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.findOne(id); }
  @Post() create(@Body() dto: any) { return this.svc.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }
}
