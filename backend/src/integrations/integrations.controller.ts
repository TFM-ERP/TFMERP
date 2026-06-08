import { Controller, Get, Post, Delete, Param, Query, Body, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private service: IntegrationsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  status() { return this.service.status(); }

  @Get(':provider/connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  connect(@Param('provider') provider: string) { return this.service.authUrl(provider.toUpperCase()); }

  // Public — hit by the provider's browser redirect (no JWT)
  @Get(':provider/callback')
  async callback(@Param('provider') provider: string, @Query('code') code: string, @Res() res: any) {
    try {
      const back = await this.service.handleCallback(provider.toUpperCase(), code);
      return res.redirect(back);
    } catch (e: any) {
      const app = process.env.APP_URL || 'http://localhost:3000';
      return res.redirect(`${app}/setup/integrations?error=${encodeURIComponent(e?.message || 'failed')}`);
    }
  }

  @Delete(':provider')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  disconnect(@Param('provider') provider: string) { return this.service.disconnect(provider.toUpperCase()); }

  @Get(':provider/files')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  files(@Param('provider') provider: string, @Query('q') q: string) { return this.service.listFiles(provider.toUpperCase(), q); }

  @Post(':provider/import')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  importFile(@Param('provider') provider: string, @Body() body: any, @Req() req: any) {
    return this.service.importToVault(provider.toUpperCase(), body, req.user?.id);
  }
}
