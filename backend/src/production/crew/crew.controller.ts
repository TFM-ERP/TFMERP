import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CrewService } from './crew.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/crew')
export class CrewController {
  constructor(private service: CrewService) {}

  @Get('project/:projectId')
  findByProject(@Param('projectId') projectId: string, @Req() req: any) {
    return this.service.findByProject(projectId, req.user?.id);
  }

  // V1.2 — workforce lifecycle summary (prep / active / wrapped from contract dates)
  @Get('project/:projectId/workforce-status')
  workforceStatus(@Param('projectId') projectId: string) {
    return this.service.workforceStatus(projectId);
  }

  @Get('assignment/:id')
  findAssignment(@Param('id') id: string) {
    return this.service.findAssignment(id);
  }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  // Schedule
  @Get('schedule/:projectId')
  getSchedule(@Param('projectId') projectId: string) { return this.service.getSchedule(projectId); }

  @Post('schedule/:projectId')
  createScheduleDay(@Param('projectId') projectId: string, @Body() body: any) {
    return this.service.createScheduleDay(projectId, body);
  }

  @Put('schedule/day/:dayId')
  updateScheduleDay(@Param('dayId') dayId: string, @Body() body: any) {
    return this.service.updateScheduleDay(dayId, body);
  }

  @Delete('schedule/day/:dayId')
  deleteScheduleDay(@Param('dayId') dayId: string) {
    return this.service.deleteScheduleDay(dayId);
  }
}
