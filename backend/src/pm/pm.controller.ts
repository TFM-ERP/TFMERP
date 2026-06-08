import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PmService } from './pm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Preventive Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pm')
export class PmController {
  constructor(private service: PmService) {}

  @Get('plans')
  plans(@Query('assetId') assetId?: string) { return this.service.listPlans(assetId); }

  @Get('due')
  due() { return this.service.due(); }

  @Post('plans')
  create(@Body() body: any) { return this.service.createPlan(body); }

  @Put('plans/:id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.updatePlan(id, body); }

  @Post('plans/:id/complete')
  complete(@Param('id') id: string, @Body() body: any) { return this.service.complete(id, body); }

  @Delete('plans/:id')
  remove(@Param('id') id: string) { return this.service.deletePlan(id); }

  @Patch('assets/:id/readings')
  readings(@Param('id') id: string, @Body() body: any) { return this.service.updateReadings(id, body); }
}
