import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Role-aware action items for the current user' })
  list(@Request() req) { return this.service.list(req.user?.role); }

  @Post('email-digest')
  @ApiOperation({ summary: 'Email a digest of current alerts (for manual or scheduled sending)' })
  emailDigest(@Request() req, @Body() body: any) { return this.service.emailDigest(req.user?.role, body?.to); }
}
