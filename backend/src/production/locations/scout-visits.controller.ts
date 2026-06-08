import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScoutVisitsService } from './scout-visits.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/scout-visits')
export class ScoutVisitsController {
  constructor(private service: ScoutVisitsService) {}

  // List — pass ?projectId= for a project scope; omit for master/library scope.
  @Get() list(@Query('projectId') projectId?: string) { return this.service.list(projectId); }
  @Get('master-options') masterOptions() { return this.service.masterOptions(); }
  @Get('crew-pool/:projectId') crewPool(@Param('projectId') projectId: string) { return this.service.crewPool(projectId); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @Get(':id/call-sheet') callSheet(@Param('id') id: string) { return this.service.callSheet(id); }
  @Get(':id/headcount') headcount(@Param('id') id: string) { return this.service.headcount(id); }

  @Post() @RequirePermission('production', 2) create(@Body() b: any) { return this.service.create(b); }
  @Put(':id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() b: any) { return this.service.updateVisit(id, b); }
  @Delete(':id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.service.remove(id); }

  // Stops (route)
  @Post(':id/stops') @RequirePermission('production', 2) addStop(@Param('id') id: string, @Body() b: any) { return this.service.addStop(id, b); }
  @Put('stops/:stopId') @RequirePermission('production', 2) updateStop(@Param('stopId') stopId: string, @Body() b: any) { return this.service.updateStop(stopId, b); }
  @Delete('stops/:stopId') @RequirePermission('production', 2) removeStop(@Param('stopId') stopId: string) { return this.service.removeStop(stopId); }
  @Post(':id/stops/reorder') @RequirePermission('production', 2) reorderStops(@Param('id') id: string, @Body() b: any) { return this.service.reorderStops(id, b?.ids || []); }

  // Party (scout team)
  @Post(':id/members') @RequirePermission('production', 2) addMember(@Param('id') id: string, @Body() b: any) { return this.service.addMember(id, b); }
  @Put('members/:memberId') @RequirePermission('production', 2) updateMember(@Param('memberId') memberId: string, @Body() b: any) { return this.service.updateMember(memberId, b); }
  @Delete('members/:memberId') @RequirePermission('production', 2) removeMember(@Param('memberId') memberId: string) { return this.service.removeMember(memberId); }

  // Transport request (S4)
  @Get(':id/transport') transportStatus(@Param('id') id: string) { return this.service.transportStatus(id); }
  @Post(':id/transport') @RequirePermission('production', 2) requestTransport(@Param('id') id: string, @Body() b: any, @Req() req: any) { return this.service.requestTransport(id, { ...b, createdById: req.user?.id }); }
  @Delete(':id/transport') @RequirePermission('production', 2) cancelTransport(@Param('id') id: string) { return this.service.cancelTransport(id); }
}
