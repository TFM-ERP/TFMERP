import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConditionReportsService } from './condition-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Condition Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('condition-reports')
export class ConditionReportsController {
  constructor(private service: ConditionReportsService) {}

  @Get()
  list(@Query('bookingId') bookingId: string) { return this.service.listByBooking(bookingId); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
