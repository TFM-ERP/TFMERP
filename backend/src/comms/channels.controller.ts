import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Comms · Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('comms/channels')
export class ChannelsController {
  constructor(private service: ChannelsService) {}

  @Get() list(@Req() r: any, @Query('projectId') projectId?: string) { return this.service.listForUser(r.user?.id, projectId); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @Post() create(@Body() b: any, @Req() r: any) { return this.service.create(b, r.user?.id); }
  @Post(':id/members') addMembers(@Param('id') id: string, @Body() b: any) { return this.service.addMembers(id, b.userIds || [], b.derived ?? true, b.role); }
  @Delete(':id/members/:userId') removeMember(@Param('id') id: string, @Param('userId') userId: string) { return this.service.removeMember(id, userId); }
  @Post(':id/read') markRead(@Param('id') id: string, @Req() r: any) { return this.service.markRead(id, r.user?.id); }
  @Put(':id/archive') archive(@Param('id') id: string) { return this.service.archive(id); }
  @Post('hierarchy') hierarchy(@Body() b: any, @Req() r: any) { return this.service.createHierarchyGroups(b.projectId, b.projectTitle, r.user?.id); }
  @Post('dm') createDm(@Body() b: any, @Req() r: any) { return this.service.createDm(r.user?.id, b.userId); }

  // PTT live sessions (presence for walkie channels)
  @Post(':id/ptt/start') startPtt(@Param('id') id: string, @Req() r: any) { return this.service.startPtt(id, r.user?.id); }
  @Post('ptt/:sessionId/end') endPtt(@Param('sessionId') sessionId: string) { return this.service.endPtt(sessionId); }
  @Get(':id/ptt/active') activePtt(@Param('id') id: string) { return this.service.activePtt(id); }
  @Post(':id/ptt/rtc-token') rtcToken(@Param('id') id: string, @Req() r: any) { return this.service.rtcToken(id, r.user?.id, r.user?.fullName); }
}
