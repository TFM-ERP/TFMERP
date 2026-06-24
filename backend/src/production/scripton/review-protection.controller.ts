import { Controller, Get, Post, Body, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewProtectionService } from './review-protection.service';
import { ProtectedExportService } from './protected-export.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';

@ApiTags('Production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 1)
@Controller('production/scripton/review-protection')
export class ReviewProtectionController {
  constructor(private service: ReviewProtectionService, private exporter: ProtectedExportService) {}

  // Produce a recipient-watermarked, permission-locked, audit-logged protected PDF and stream it back.
  @Post('export') @RequirePermission('production', 1)
  async exportProtected(@Body() body: any, @Req() req: any, @Res() res: any) {
    try {
      const out = await this.exporter.produce({ ...(body || {}), userId: req?.user?.id });
      res.setHeader('Content-Type', 'application/pdf');
      // Headers must be Latin-1; Arabic/Unicode filenames need RFC 6266 encoding (ASCII fallback + UTF-8 filename*).
      const asciiName = String(out.fileName || 'protected.pdf').replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
      res.setHeader('Content-Disposition', 'attachment; filename="' + asciiName + '"; filename*=UTF-8\'\'' + encodeURIComponent(out.fileName || 'protected.pdf'));
      res.setHeader('X-Copy-Id', out.copyId);
      res.setHeader('X-Protection-Mode', out.mode);
      if (out.degraded && out.degraded.length) res.setHeader('X-Protection-Degraded', out.degraded.join(','));
      res.setHeader('Access-Control-Expose-Headers', 'X-Copy-Id, X-Protection-Mode, X-Protection-Degraded, Content-Disposition');
      return res.status(200).send(out.buffer);
    } catch (e: any) {
      const code = e && e.code;
      if (code === 'NO_PUPPETEER' || code === 'NO_CHROMIUM') return res.status(501).json({ message: e.message, code });
      if (code === 'PROTECTION_FAILED') return res.status(502).json({ message: e.message, code });
      const status = e && (e.status || (e.response && e.response.statusCode)) ? (e.status || e.response.statusCode) : 500;
      return res.status(status).json({ message: (e && e.message) || 'Protected export failed' });
    }
  }

  @Get('settings') getSettings(@Query('projectId') projectId?: string) { return this.service.getSettings(projectId || undefined); }
  @Post('settings') @RequirePermission('production', 2) saveSettings(@Body() body: any, @Req() req: any) { return this.service.saveSettings(body?.projectId || null, body || {}, req?.user?.id); }

  @Get('profiles') listProfiles() { return this.service.listProfiles(); }
  @Post('profiles') @RequirePermission('production', 2) saveProfile(@Body() body: any, @Req() req: any) { return this.service.saveProfile(body || {}, req?.user?.id); }
  @Post('profiles/:id/delete') @RequirePermission('production', 2) deleteProfile(@Param('id') id: string) { return this.service.deleteProfile(id); }

  @Get('notices') listNotices() { return this.service.listNotices(); }
  @Post('notices') @RequirePermission('production', 2) saveNotice(@Body() body: any, @Req() req: any) { return this.service.saveNotice(body || {}, req?.user?.id); }
  @Post('notices/:id/delete') @RequirePermission('production', 2) deleteNotice(@Param('id') id: string) { return this.service.deleteNotice(id); }

  @Get('exports') listExports(@Query('projectId') projectId?: string) { return this.service.listExports(projectId || undefined); }
}
