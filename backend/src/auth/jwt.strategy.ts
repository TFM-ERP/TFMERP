import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string; role: string; sid?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, fullName: true, email: true, role: true, activity: true, isActive: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException();

    // Session enforcement: tokens minted with a `sid` are valid only while that session row lives.
    // Revoking it (Account → Active sessions) makes the very next request 401. Legacy tokens
    // without a sid are still accepted so existing logins aren't force-killed by this rollout.
    if (payload.sid) {
      const session = await this.prisma.userSession.findUnique({ where: { id: payload.sid } });
      if (!session || session.userId !== user.id) throw new UnauthorizedException('Session revoked');
      this.prisma.userSession
        .update({ where: { id: payload.sid }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined); // best-effort heartbeat; never block the request
    }

    return { ...user, sessionId: payload.sid };
  }
}
