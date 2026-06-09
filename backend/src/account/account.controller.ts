import {
  Controller, Get, Patch, Post, Delete, Body, Param, Request,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { AccountService } from './account.service';

const IMG_TYPES = /\.(jpg|jpeg|png|webp|heic)$/i;
const AVATAR_MAX_MB = 5;
const LEGAL_NAME_CLEARERS = ['SYSTEM_ADMIN', 'HR_MANAGER', 'FINANCE_MANAGER'];

const avatarStorage = diskStorage({
  destination: join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => cb(null, `avatar-${randomUUID()}${extname(file.originalname).toLowerCase()}`),
});

@ApiTags('Account')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('profile')
  @ApiOperation({ summary: 'My identity card (names, avatar, role, 2FA state)' })
  profile(@Request() req) {
    return this.account.profile(req.user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update preferred name (instant) / propose legal name (HR sign-off)' })
  updateProfile(@Request() req, @Body() body: { preferredName?: string; legalName?: string }) {
    return this.account.updateProfile(req.user.id, body);
  }

  @Post('avatar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload + set my avatar (image, max 5 MB)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: avatarStorage,
      limits: { fileSize: AVATAR_MAX_MB * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        IMG_TYPES.test(extname(file.originalname))
          ? cb(null, true)
          : cb(new BadRequestException('Only images (jpg, png, webp, heic) are allowed'), false),
    }),
  )
  uploadAvatar(@Request() req, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file provided');
    return this.account.setAvatar(req.user.id, `/uploads/${file.filename}`);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'My active sessions (current device flagged)' })
  sessions(@Request() req) {
    return this.account.sessions(req.user.id, req.user.sessionId);
  }

  @Delete('sessions/others')
  @ApiOperation({ summary: 'Sign out of every other device' })
  revokeOthers(@Request() req) {
    return this.account.revokeOthers(req.user.id, req.user.sessionId);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Revoke one device (its token 401s next request)' })
  revokeSession(@Request() req, @Param('id') id: string) {
    return this.account.revokeSession(req.user.id, id);
  }

  // HR / Finance only: confirm or reject a parked legal-name change for any user.
  @Patch(':userId/legal-name/clear')
  @ApiOperation({ summary: 'HR/Finance: approve or reject a pending legal-name change' })
  clearLegalName(@Request() req, @Param('userId') userId: string, @Body('approve') approve: boolean) {
    if (!LEGAL_NAME_CLEARERS.includes(req.user.role)) {
      throw new ForbiddenException('Only HR or Finance can clear legal-name changes');
    }
    return this.account.clearLegalName(userId, approve !== false);
  }
}
