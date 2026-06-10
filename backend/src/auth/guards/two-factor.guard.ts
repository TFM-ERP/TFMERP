import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { authenticator } from 'otplib';
import { PrismaService } from '../../common/prisma/prisma.service';
import { REQUIRE_2FA } from '../require-2fa.decorator';

/**
 * Step-up authentication for sensitive actions. On routes marked @Require2FA():
 *  - the user must have two-factor enabled (else 403 — they're told to enable it), and
 *  - the request must carry a currently-valid authenticator code in `x-2fa-code` (else 401).
 * The 401 uses a stable `code` so the frontend knows to pop the step-up prompt and retry.
 */
@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_2FA, [ctx.getHandler(), ctx.getClass()]);
    if (!required) return true;

    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.id;
    if (!userId) throw new ForbiddenException('Not authenticated');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new ForbiddenException('Two-factor authentication is required for this action. Enable it in your account first.');
    }

    const code = String(req.headers['x-2fa-code'] || '').trim();
    if (!code) {
      throw new UnauthorizedException({ code: 'TWO_FACTOR_REQUIRED', message: 'Enter your authenticator code to continue.' });
    }
    if (!authenticator.verify({ token: code, secret: user.twoFactorSecret })) {
      throw new UnauthorizedException({ code: 'TWO_FACTOR_INVALID', message: 'Invalid authenticator code.' });
    }
    return true;
  }
}
