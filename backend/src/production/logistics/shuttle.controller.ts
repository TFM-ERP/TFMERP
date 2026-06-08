import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ShuttleService } from './shuttle.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Shuttle')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('logistics/shuttle')
export class ShuttleController {
  constructor(private service: ShuttleService) {}

  // Routes
  @Get('routes') routes(@Query('projectId') projectId?: string, @Query('scope') scope?: string) { return this.service.listRoutes({ projectId, scope }); }
  @Get('routes/:id') route(@Param('id') id: string) { return this.service.getRoute(id); }
  @Post('routes') @RequirePermission('production', 2) addRoute(@Body() b: any) { return this.service.createRoute(b); }
  @Put('routes/:id') @RequirePermission('production', 2) updRoute(@Param('id') id: string, @Body() b: any) { return this.service.updateRoute(id, b); }
  @Delete('routes/:id') @RequirePermission('production', 2) delRoute(@Param('id') id: string) { return this.service.removeRoute(id); }

  // Stops
  @Post('routes/:id/stops') @RequirePermission('production', 2) addStop(@Param('id') id: string, @Body() b: any) { return this.service.addStop(id, b); }
  @Put('stops/:id') @RequirePermission('production', 2) updStop(@Param('id') id: string, @Body() b: any) { return this.service.updateStop(id, b); }
  @Delete('stops/:id') @RequirePermission('production', 2) delStop(@Param('id') id: string) { return this.service.removeStop(id); }
  @Post('routes/:id/reorder-stops') @RequirePermission('production', 2) reorder(@Param('id') id: string, @Body() b: any) { return this.service.reorderStops(id, b.ids); }

  // Riders / manifest
  @Post('routes/:id/riders') @RequirePermission('production', 2) addRider(@Param('id') id: string, @Body() b: any) { return this.service.addRider(id, b); }
  @Delete('riders/:id') @RequirePermission('production', 2) delRider(@Param('id') id: string) { return this.service.removeRider(id); }
  @Get('routes/:id/manifest') manifest(@Param('id') id: string) { return this.service.manifest(id); }

  // Picker
  @Get('travelers') travelers(@Query('projectId') projectId: string) { return this.service.projectTravelers(projectId); }
}
