import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LocationNeedsService } from './location-needs.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/location-needs')
export class LocationNeedsController {
  constructor(private service: LocationNeedsService) {}

  @Get(':projectId') list(@Param('projectId') projectId: string) { return this.service.list(projectId); }
  @Post('sync/:projectId') @RequirePermission('production', 2) sync(@Param('projectId') projectId: string) { return this.service.sync(projectId); }
  @Put('need/:id') @RequirePermission('production', 2) updateNeed(@Param('id') id: string, @Body() b: any) { return this.service.updateNeed(id, b); }
  @Post('need/:id/options') @RequirePermission('production', 2) addOption(@Param('id') id: string, @Body() b: any) { return this.service.addOption(id, b); }
  @Put('options/:id') @RequirePermission('production', 2) updateOption(@Param('id') id: string, @Body() b: any) { return this.service.updateOption(id, b); }
  @Delete('options/:id') @RequirePermission('production', 2) removeOption(@Param('id') id: string) { return this.service.removeOption(id); }
  @Post('need/:id/lock/:optionId') @RequirePermission('production', 2) lock(@Param('id') id: string, @Param('optionId') optionId: string) { return this.service.lock(id, optionId); }
  @Post('need/:id/unlock') @RequirePermission('production', 2) unlock(@Param('id') id: string) { return this.service.unlock(id); }
}
