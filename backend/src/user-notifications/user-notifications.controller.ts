import { Controller, Get, Param, Put, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserNotificationsService } from './user-notifications.service';

@ApiTags('User notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/notifications')
export class UserNotificationsController {
  constructor(private readonly svc: UserNotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'My notification feed' })
  list(@Request() req) { return this.svc.list(req.user.id); }

  @Get('unread-count')
  @ApiOperation({ summary: 'My unread count' })
  unread(@Request() req) { return this.svc.unreadCount(req.user.id); }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all my notifications read' })
  readAll(@Request() req) { return this.svc.markAll(req.user.id); }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark one notification read' })
  read(@Request() req, @Param('id') id: string) { return this.svc.markRead(req.user.id, id); }
}
