import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { createHash, randomBytes } from 'crypto';

const BACKUP_CODE_COUNT = 10;
const normalizeCode = (c: string) => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const hashCode = (c: string) => createHash('sha256').update(normalizeCode(c)).digest('hex');
import { UsersService } from '../users/users.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.validateUser(dto.email, dto.password);

    // 2FA check — accepts a TOTP code or a single-use recovery code
    if (user.twoFactorEnabled) {
      if (!dto.totpCode) {
        return { requires2FA: true };
      }
      const valid = await this.verifyTwoFactor(user.id, dto.totpCode, user.twoFactorSecret);
      if (!valid) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Log login
    await this.prisma.loginHistory.create({
      data: { userId: user.id, ipAddress, success: true },
    });

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Mint an active-session row; its id rides in the JWT as `sid`, so revoking the row 401s the token.
    const session = await this.prisma.userSession.create({
      data: { userId: user.id, ipAddress, deviceInfo: userAgent || null },
    });

    const payload = { sub: user.id, email: user.email, role: user.role, sid: session.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        activity: user.activity,
      },
    };
  }

  /** Begin enrolment: mint a fresh secret + a locally-rendered QR (no third-party API). */
  async setup2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor is already enabled. Disable it first to re-enrol.');
    }
    const secret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(user.email, 'TFM ERP', secret);
    // Store the secret pending verification (not enabled until a code is confirmed)
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, { margin: 1, width: 220 });
    return { secret, otpAuthUrl, qrDataUrl };
  }

  /** Confirm enrolment: a valid code flips twoFactorEnabled on and issues recovery codes (shown once). */
  async enable2FA(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user.twoFactorSecret) throw new BadRequestException('Run setup2FA first');
    const valid = authenticator.verify({ token: (code || '').trim(), secret: user.twoFactorSecret });
    if (!valid) throw new BadRequestException('Invalid code');
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    const backupCodes = await this.regenerateBackupCodesInternal(userId);
    return { enabled: true, backupCodes };
  }

  /** Turn 2FA off — accepts a TOTP or recovery code so a lost authenticator isn't a lockout. */
  async disable2FA(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled) throw new BadRequestException('Two-factor is not enabled');
    const valid = await this.verifyTwoFactor(userId, code, user.twoFactorSecret);
    if (!valid) throw new BadRequestException('Invalid code');
    await this.prisma.$transaction([
      this.prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
      this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false, twoFactorSecret: null } }),
    ]);
    return { enabled: false };
  }

  /** How many unused recovery codes remain (for the account UI). */
  async backupCodesStatus(userId: string) {
    const remaining = await this.prisma.twoFactorBackupCode.count({ where: { userId, usedAt: null } });
    return { remaining, total: BACKUP_CODE_COUNT };
  }

  /** Re-issue a fresh set of recovery codes (invalidates the old ones); requires a current code. */
  async regenerateBackupCodes(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled) throw new BadRequestException('Two-factor is not enabled');
    const valid = await this.verifyTwoFactor(userId, code, user.twoFactorSecret);
    if (!valid) throw new BadRequestException('Invalid code');
    const backupCodes = await this.regenerateBackupCodesInternal(userId);
    return { backupCodes };
  }

  /** Verify a 2FA challenge: a current TOTP, else a single-use recovery code (which is consumed). */
  private async verifyTwoFactor(userId: string, code: string, secret?: string | null): Promise<boolean> {
    const token = (code || '').trim();
    if (!token) return false;
    const sec = secret ?? (await this.prisma.user.findUnique({ where: { id: userId } }))?.twoFactorSecret;
    if (sec && authenticator.verify({ token, secret: sec })) return true;
    // Recovery-code fallback — match an unused hash, then burn it.
    const hash = hashCode(token);
    const match = await this.prisma.twoFactorBackupCode.findFirst({ where: { userId, codeHash: hash, usedAt: null } });
    if (!match) return false;
    await this.prisma.twoFactorBackupCode.update({ where: { id: match.id }, data: { usedAt: new Date() } });
    return true;
  }

  /** Wipe + mint BACKUP_CODE_COUNT codes; returns the plaintext (the only time it's ever available). */
  private async regenerateBackupCodesInternal(userId: string): Promise<string[]> {
    const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => {
      const raw = randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;               // e.g. A1B2C-3D4E5
    });
    await this.prisma.twoFactorBackupCode.deleteMany({ where: { userId } });
    await this.prisma.twoFactorBackupCode.createMany({
      data: codes.map((c) => ({ userId, codeHash: hashCode(c) })),
    });
    return codes;
  }
}
