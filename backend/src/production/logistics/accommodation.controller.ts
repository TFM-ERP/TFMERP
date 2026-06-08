import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AccommodationService } from './accommodation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Accommodation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('logistics/accommodation')
export class AccommodationController {
  constructor(private service: AccommodationService) {}

  // Properties
  @Get('properties') properties(@Query('type') type?: string, @Query('q') q?: string) { return this.service.listProperties({ type, q }); }
  @Get('properties/:id') property(@Param('id') id: string) { return this.service.getProperty(id); }
  @Post('properties') @RequirePermission('production', 2) addProperty(@Body() b: any) { return this.service.createProperty(b); }
  @Put('properties/:id') @RequirePermission('production', 2) updProperty(@Param('id') id: string, @Body() b: any) { return this.service.updateProperty(id, b); }
  @Delete('properties/:id') @RequirePermission('production', 2) delProperty(@Param('id') id: string) { return this.service.removeProperty(id); }

  // Rooms
  @Post('properties/:id/rooms') @RequirePermission('production', 2) addRoom(@Param('id') id: string, @Body() b: any) { return this.service.addRoom(id, b); }
  @Put('rooms/:id') @RequirePermission('production', 2) updRoom(@Param('id') id: string, @Body() b: any) { return this.service.updateRoom(id, b); }
  @Delete('rooms/:id') @RequirePermission('production', 2) delRoom(@Param('id') id: string) { return this.service.removeRoom(id); }

  // Assignments
  @Get('assignments') assignments(@Query('projectId') projectId?: string, @Query('scope') scope?: string) { return this.service.listAssignments({ projectId, scope }); }
  @Post('assignments') @RequirePermission('production', 2) addAssignment(@Body() b: any, @Req() r: any) { return this.service.createAssignment(b, r.user?.id); }
  @Put('assignments/:id') @RequirePermission('production', 2) updAssignment(@Param('id') id: string, @Body() b: any) { return this.service.updateAssignment(id, b); }
  @Delete('assignments/:id') @RequirePermission('production', 2) delAssignment(@Param('id') id: string) { return this.service.removeAssignment(id); }

  // Smart + rooming
  @Get('needs') needs(@Query('projectId') projectId: string) { return this.service.needsAccommodation(projectId); }
  @Get('rooming') rooming(@Query('projectId') projectId: string) { return this.service.roomingList(projectId); }
}
