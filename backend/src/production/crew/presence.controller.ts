import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PresenceService } from './presence.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

/** DOOD-driven chat presence + access expiry. */
@ApiTags('Production · Presence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('production/presence')
export class PresenceController {
  constructor(private service: PresenceService) {}

  @Get(':projectId') presence(@Param('projectId') projectId: string, @Query('date') date?: string) { return this.service.presence(projectId, date); }
  @Post(':projectId/sync-access') sync(@Param('projectId') projectId: string) { return this.service.syncChatAccess(projectId); }
}
