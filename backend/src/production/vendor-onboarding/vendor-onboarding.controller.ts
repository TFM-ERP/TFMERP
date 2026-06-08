import {
  Controller, Get, Post, Body, Param, Query, Req, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../permissions/permissions.guard';
import { RequirePermission } from '../../permissions/require-permission.decorator';
import { VendorOnboardingService } from './vendor-onboarding.service';

const DOC_TYPES = /\.(pdf|jpg|jpeg|png|webp)$/i;
const docUpload = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads'),
    filename: (_r: any, file: any, cb: any) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_r: any, file: any, cb: any) =>
    DOC_TYPES.test(extname(file.originalname)) ? cb(null, true) : cb(new BadRequestException('Only PDF or image files are allowed'), false),
};

// ── Admin (authenticated) ─────────────────────────────────────────────────────────
@ApiTags('Vendor Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('production', 2)
@Controller('production/vendor-onboarding')
export class VendorOnboardingController {
  constructor(private service: VendorOnboardingService) {}

  @Post('invite') invite(@Body() body: { projectId: string; hours?: number }) {
    return this.service.createInvite(body.projectId, body.hours);
  }
  @Get('pending') pending(@Query('projectId') projectId: string, @Query('status') status?: string) {
    return this.service.listPending(projectId, status ?? 'PENDING');
  }
  @Post(':id/approve') approve(@Param('id') id: string, @Req() req: any) {
    return this.service.approve(id, req.user?.id);
  }
  @Post(':id/reject') reject(@Param('id') id: string, @Req() req: any) {
    return this.service.reject(id, req.user?.id);
  }
}

// ── Public (no auth — gated by the JWT onboarding token) ────────────────────────────
@ApiTags('Vendor Onboarding (public)')
@Controller('public/vendor-onboarding')
export class VendorOnboardingPublicController {
  constructor(private service: VendorOnboardingService) {}

  @Get('info/:token') info(@Param('token') token: string) {
    return this.service.tokenInfo(token);
  }

  @Post('submit') submit(@Body() body: any, @Req() req: any) {
    const token = body?.token;
    if (!token) throw new BadRequestException('Missing onboarding token.');
    const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
    return this.service.submit(token, body, ip);
  }

  // Token-gated public upload: the file is saved by multer, then we verify the token;
  // if it's invalid we delete the file and reject so no anonymous uploads can persist.
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', docUpload))
  upload(@UploadedFile() file: any, @Body('token') token: string) {
    if (!file) throw new BadRequestException('No file provided.');
    try {
      this.service.verify(token); // throws if invalid/expired
    } catch (e) {
      const p = join(process.cwd(), 'uploads', file.filename);
      if (existsSync(p)) unlinkSync(p);
      throw e;
    }
    return { url: `/uploads/${file.filename}`, originalName: file.originalname, size: file.size };
  }
}
