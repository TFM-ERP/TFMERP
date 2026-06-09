import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
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

    // 2FA check
    if (user.twoFactorEnabled) {
      if (!dto.totpCode) {
        return { requires2FA: true };
      }
      const valid = authenticator.verify({
        token: dto.totpCode,
        secret: user.twoFactorSecret,
      });
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

  async setup2FA(userId: string) {
    const secret = authenticator.generateSecret();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const otpAuthUrl = authenticator.keyuri(user.email, 'TFM ERP', secret);
    // Store secret temporarily (not enabled until verified)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });
    return { secret, otpAuthUrl };
  }

  async enable2FA(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user.twoFactorSecret) throw new BadRequestException('Run setup2FA first');
    const valid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!valid) throw new BadRequestException('Invalid code');
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
    return { enabled: true };
  }
}
