import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AssetStatus, AssetType } from '@prisma/client';

@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rental/assets')
export class AssetsController {
  constructor(private service: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'List all assets with filters' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('expiry-alerts')
  @ApiOperation({ summary: 'Assets with registration or insurance expiring in 60 days' })
  expiryAlerts() { return this.service.getExpiryAlerts(); }

  @Get('utilization')
  @ApiOperation({ summary: 'Asset utilization report for a date range' })
  utilization(@Query('startDate') start: string, @Query('endDate') end: string) {
    return this.service.getUtilizationReport(start, end);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Check asset availability for a date range' })
  checkAvailability(
    @Param('id') id: string,
    @Query('startDate') start: string,
    @Query('endDate') end: string,
    @Query('excludeBookingId') excludeId?: string,
  ) { return this.service.checkAvailability(id, start, end, excludeId); }

  @Post()
  @ApiOperation({ summary: 'Add a new asset (trailer, generator, vehicle, etc.)' })
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update asset status (AVAILABLE, ON_HIRE, IN_MAINTENANCE, etc.)' })
  updateStatus(@Param('id') id: string, @Body('status') status: AssetStatus) {
    return this.service.updateStatus(id, status);
  }
}
