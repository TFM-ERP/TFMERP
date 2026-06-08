import {
  Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('maintenance/jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly svc: JobsService) {}

  @Get()
  list(@Query() q: any) { return this.svc.findAll(q); }

  @Get('summary')
  summary() { return this.svc.getSummary(); }

  @Get('reports/cost-per-asset')
  costPerAsset() { return this.svc.getCostPerAsset(); }

  @Get('reports/cost-per-vendor')
  costPerVendor() { return this.svc.getCostPerVendor(); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  create(@Body() dto: any) { return this.svc.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.svc.updateStatus(id, status);
  }

  @Patch(':id/photos/add')
  addPhoto(@Param('id') id: string, @Body('url') url: string) { return this.svc.addPhoto(id, url); }

  @Patch(':id/photos/remove')
  removePhoto(@Param('id') id: string, @Body('url') url: string) { return this.svc.removePhoto(id, url); }
}
