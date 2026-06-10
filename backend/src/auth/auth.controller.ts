import { Controller, Post, Body, Request, UseGuards, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email + password (+ optional 2FA code)' })
  login(@Body() dto: LoginDto, @Request() req) {
    return this.authService.login(dto, req.ip, req.headers?.['user-agent']);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  me(@Request() req) {
    return req.user;
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setup2FA(@Request() req) {
    return this.authService.setup2FA(req.user.id);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  enable2FA(@Request() req, @Body('code') code: string) {
    return this.authService.enable2FA(req.user.id, code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA (accepts a TOTP or recovery code)' })
  disable2FA(@Request() req, @Body('code') code: string) {
    return this.authService.disable2FA(req.user.id, code);
  }

  @Get('2fa/backup-codes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remaining recovery-code count' })
  backupCodesStatus(@Request() req) {
    return this.authService.backupCodesStatus(req.user.id);
  }

  @Post('2fa/backup-codes/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Re-issue recovery codes (requires a current code)' })
  regenerateBackupCodes(@Request() req, @Body('code') code: string) {
    return this.authService.regenerateBackupCodes(req.user.id, code);
  }
}
