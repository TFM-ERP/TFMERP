import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FuelService } from './fuel.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rental/fuel')
export class FuelController {
  constructor(private service: FuelService) {}

  @Get()
  @ApiOperation({ summary: 'List fuel logs' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('summary')
  @ApiOperation({ summary: 'Fuel consumption summary with optional asset/date filters' })
  summary(
    @Query('assetId') assetId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) { return this.service.getSummary(assetId, startDate, endDate); }

  @Post()
  @ApiOperation({ summary: 'Log a fuel fill-up for an asset' })
  create(@Body() body: any) { return this.service.create(body); }

  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}
