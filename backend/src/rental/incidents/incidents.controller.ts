import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { IncidentStatus } from '@prisma/client';

@ApiTags('Rental')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rental/incidents')
export class IncidentsController {
  constructor(private service: IncidentsService) {}

  @Get()
  @ApiOperation({ summary: 'List incident reports' })
  findAll(@Query() q: any) { return this.service.findAll(q); }

  @Get('summary')
  @ApiOperation({ summary: 'Incident summary stats' })
  summary() { return this.service.getSummary(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Log a new incident' })
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Resolve an incident' })
  resolve(@Param('id') id: string, @Body() body: any) { return this.service.resolve(id, body); }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: IncidentStatus) {
    return this.service.updateStatus(id, status);
  }
}
