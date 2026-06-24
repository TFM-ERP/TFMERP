import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';

@ApiTags('Meetings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('meetings')
export class MeetingsController {
  constructor(private service: MeetingsService) {}

  @Get() list(@Query() q: any) { return this.service.list(q); }
  @Get('action-items') actionItems(@Query() q: any) { return this.service.listActionItems(q); }
  @Patch('action-items/:id') updAction(@Param('id') id: string, @Body() b: any) { return this.service.updateActionItem(id, b); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @Post() @RequirePermission('production', 2) create(@Body() b: any, @Req() r: any) { return this.service.create(b, r.user?.id); }
  @Put(':id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() b: any) { return this.service.update(id, b); }
  @Delete(':id') @RequirePermission('production', 2) cancel(@Param('id') id: string) { return this.service.cancel(id); }
  @Post(':id/attendees') @RequirePermission('production', 2) addAttendees(@Param('id') id: string, @Body() b: any) { return this.service.addAttendees(id, b.attendees || []); }
  @Put(':id/agenda') @RequirePermission('production', 2) setAgenda(@Param('id') id: string, @Body() b: any) { return this.service.setAgenda(id, b.items || []); }
  @Post(':id/minutes') minute(@Param('id') id: string, @Body() b: any, @Req() r: any) { return this.service.addMinute(id, b, r.user?.id); }
  @Post(':id/action-items') @RequirePermission('production', 2) addAction(@Param('id') id: string, @Body() b: any) { return this.service.addActionItem(id, b); }
  @Post(':id/recurring') @RequirePermission('production', 2) recurring(@Param('id') id: string, @Body() b: any) { return this.service.generateWeekly(id, b.until); }
}
