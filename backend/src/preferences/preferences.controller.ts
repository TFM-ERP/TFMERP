import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PreferencesService } from './preferences.service';

/**
 * SYS-UX Phase 0 — Appearance & theme governance endpoints.
 *   GET/PUT /me/preferences      — the signed-in user's look
 *   GET     /org/theme-policy    — read policy (any user, to resolve their theme)
 *   PUT     /org/theme-policy    — change policy (admin only; enforced in the service)
 */
@ApiTags('Preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PreferencesController {
  constructor(private readonly svc: PreferencesService) {}

  @Get('me/preferences')
  @ApiOperation({ summary: 'My appearance preference' })
  getMine(@Request() req) {
    return this.svc.getPreference(req.user.id);
  }

  @Put('me/preferences')
  @ApiOperation({ summary: 'Update my appearance preference' })
  setMine(@Request() req, @Body() body: any) {
    return this.svc.setPreference(req.user.id, body);
  }

  @Get('org/theme-policy')
  @ApiOperation({ summary: 'Read the org theme policy' })
  getPolicy() {
    return this.svc.getPolicy();
  }

  @Put('org/theme-policy')
  @ApiOperation({ summary: 'Update the org theme policy (admin only)' })
  setPolicy(@Request() req, @Body() body: any) {
    return this.svc.setPolicy(req.user.id, body);
  }
}
