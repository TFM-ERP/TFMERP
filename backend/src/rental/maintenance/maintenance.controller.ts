import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rental/maintenance')
export class MaintenanceController {
  constructor(private service: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'List maintenance logs' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('schedule')
  @ApiOperation({ summary: 'Upcoming maintenance in next 30 days' })
  schedule(@Query('assetId') assetId?: string) { return this.service.getSchedule(assetId); }

  @Get('overdue')
  @ApiOperation({ summary: 'Overdue maintenance (past scheduled date, not completed)' })
  overdue() { return this.service.getOverdue(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Schedule maintenance for an asset' })
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Mark maintenance as started (SCHEDULED → IN_PROGRESS)' })
  start(@Param('id') id: string) { return this.service.start(id); }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Mark maintenance as completed and restore asset to AVAILABLE' })
  complete(
    @Param('id') id: string,
    @Body('actualCost')     actualCost?: number,
    @Body('notes')          notes?: string,
    @Body('invoiceRef')     invoiceRef?: string,
    @Body('partsReplaced')  partsReplaced?: string,
    @Body('nextServiceDate') nextServiceDate?: string,
    @Body('downTimeDays')   downTimeDays?: number,
  ) {
    return this.service.complete(id, actualCost, notes, invoiceRef, partsReplaced, nextServiceDate, downTimeDays);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a maintenance log' })
  cancel(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) { return this.service.cancel(id, reason); }
}
