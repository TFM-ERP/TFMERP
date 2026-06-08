import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClearancePacksService } from './clearance-packs.service';
import { MailService } from '../mail/mail.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

// ── Authenticated — build / manage / share clearance packs ──────────────────────────
@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/clearance-packs')
export class ClearancePacksController {
  constructor(private service: ClearancePacksService, private mail: MailService) {}

  @Get() list(@Query('projectId') projectId?: string) { return this.service.list(projectId); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }

  @Post('from-visit/:visitId') @RequirePermission('production', 2)
  buildFromVisit(@Param('visitId') visitId: string, @Body() b: any, @Req() req: any) {
    return this.service.buildFromVisit(visitId, { ...b, createdById: req.user?.id });
  }
  @Put(':id') @RequirePermission('production', 2) update(@Param('id') id: string, @Body() b: any) { return this.service.updatePack(id, b); }
  @Post(':id/refresh') @RequirePermission('production', 2) refresh(@Param('id') id: string) { return this.service.refresh(id); }
  @Delete(':id') @RequirePermission('production', 2) remove(@Param('id') id: string) { return this.service.remove(id); }

  // Crew consent toggle (surfaced from the party UI)
  @Post('consent/:crewId') @RequirePermission('production', 2)
  setConsent(@Param('crewId') crewId: string, @Body() b: any) { return this.service.setConsent(crewId, !!b?.consent); }

  // Share — mark shared, audit, and email the secure link (never the docs inline)
  @Post(':id/share') @RequirePermission('production', 2)
  async share(@Param('id') id: string, @Body() b: any, @Req() req: any) {
    const updated = await this.service.share(id, { ...b, actor: req.user?.id });
    const sent = await this.mail.sendClearancePack(id, b).catch((e: any) => ({ error: e?.message || 'Email failed' }));
    return { ...updated, email: sent };
  }
  @Post(':id/revoke') @RequirePermission('production', 2) revoke(@Param('id') id: string, @Req() req: any) { return this.service.revoke(id, req.user?.id); }
  @Post(':id/log-download') logDownload(@Param('id') id: string, @Req() req: any) { return this.service.logDownload(id, req.user?.id); }
}

// ── Public — venues open the time-limited link (gated by the unguessable token) ──────
@ApiTags('Clearance (public)')
@Controller('public/clearance')
export class ClearancePacksPublicController {
  constructor(private service: ClearancePacksService) {}

  @Get(':token') resolve(@Param('token') token: string, @Req() req: any) {
    const ip = (req.headers?.['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim() || undefined;
    return this.service.resolvePublic(token, ip);
  }
}
