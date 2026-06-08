import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ArrivalService } from './arrival.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Arrivals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('logistics/arrivals')
export class ArrivalController {
  constructor(private service: ArrivalService) {}

  @Get() list(@Query('projectId') projectId?: string, @Query('scope') scope?: string, @Query('date') date?: string, @Query('status') status?: string) { return this.service.list({ projectId, scope, date, status }); }
  @Get('dashboard') dashboard(@Query('projectId') projectId?: string, @Query('date') date?: string) { return this.service.dashboard(projectId, date); }
  @Get('expected') expected(@Query('projectId') projectId: string) { return this.service.expectedTravelers(projectId); }
  @Post() @RequirePermission('production', 2) create(@Body() b: any) { return this.service.create(b); }
  @Put(':id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() b: any) { return this.service.update(id, b); }
  @Post(':id/advance') @RequirePermission('production', 2) advance(@Param('id') id: string) { return this.service.advance(id); }
  @Delete(':id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.service.remove(id); }
}
