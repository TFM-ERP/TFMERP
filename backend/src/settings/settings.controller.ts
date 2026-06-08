import { Controller, Get, Put, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';
import { EmailService } from '../collections/email.service';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService, private readonly email: EmailService) {}

  @Get()
  get() {
    return this.settingsService.get();
  }

  @Put()
  update(@Body() body: any) {
    return this.settingsService.update(body);
  }

  @Post('email-test')
  async emailTest(@Body() body: any, @Req() req: any) {
    const to = body?.to || req.user?.email;
    if (!to) return { ok: false, message: 'No recipient address.' };
    await this.email.send(to, 'Test email — your ERP', '<p>SMTP is working. This is a test message from your ERP.</p>');
    return { ok: true, to };
  }
}
