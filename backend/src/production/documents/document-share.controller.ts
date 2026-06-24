import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

/**
 * Document share — serves a per-user watermarked PDF. Gated by JWT only (not the
 * production-view permission) so a vault link shared into a channel opens for any
 * authenticated recipient — and every copy carries their identity for leak tracing.
 */
@ApiTags('Production · Document share')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('production/documents')
export class DocumentShareController {
  constructor(private service: DocumentsService) {}

  @Get(':id/watermarked')
  async watermarked(@Param('id') id: string, @Req() r: any, @Res() res: Response) {
    const buf = await this.service.watermark(id, r.user);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="document.pdf"', 'Cache-Control': 'no-store' });
    res.send(buf);
  }
}
