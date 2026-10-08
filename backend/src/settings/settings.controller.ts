import { Controller, Get, Put, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { SettingsService } from './settings.service';
import { EmailService } from '../collections/email.service';

/**
 * THE GUARD IS ON THE CLASS; THE REQUIREMENT IS ON THE WRITES ONLY.
 *
 * This controller ran JwtAuthGuard alone, so any authenticated user of any role could change the
 * company's SMTP credentials and letterhead. PermissionsGuard was never attached — and because it
 * returns true for a route with no requirement (permissions.guard.ts:14), attaching it at class
 * level costs the reads nothing while making the writes gateable at all.
 *
 * GET STAYS OPEN DELIBERATELY. layout.tsx:282 reads it on every dashboard page for the company name
 * and logo, and sixteen app/print/* letterheads read it to render at all. A requirement on the
 * class would blank the branding for every role below the level, everywhere, on every page.
 */
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService, private readonly email: EmailService) {}

  @Get()
  get() {
    return this.settingsService.get();
  }

  /** setup:2 — held by SYSTEM_ADMIN alone on the live matrix, asserted before this was written. */
  @Put()
  @RequirePermission('setup', 2)
  update(@Body() body: any) {
    return this.settingsService.update(body);
  }

  /** Gated with the same key: this sends real mail to a real address. */
  @Post('email-test')
  @RequirePermission('setup', 2)
  async emailTest(@Body() body: any, @Req() req: any) {
    const to = body?.to || req.user?.email;
    if (!to) return { ok: false, message: 'No recipient address.' };
    await this.email.send(to, 'Test email — your ERP', '<p>SMTP is working. This is a test message from your ERP.</p>');
    return { ok: true, to };
  }
}
