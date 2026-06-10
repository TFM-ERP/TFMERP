import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Personal Identity & Security — self-service account area (Phase 1).
 * Scope: avatar, legal/preferred name (with an HR/Finance guardrail on the legal name),
 * and active sessions (list + revoke). 2FA lives in AuthService and is surfaced in Phase 2.
 */
@Injectable()
export class AccountService {
  constructor(private prisma: PrismaService) {}

  /** The signed-in user's identity card. */
  async profile(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, fullName: true, email: true, role: true, jobTitle: true, department: true,
        avatarUrl: true, legalName: true, preferredName: true,
        legalNameProposed: true, legalNamePending: true,
        twoFactorEnabled: true, lastLoginAt: true,
      },
    });
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  /**
   * Preferred (display) name is editable immediately — it's cosmetic.
   * The legal name is the HR/Finance record of truth, so a change is *parked* in
   * legalNameProposed + legalNamePending and only takes effect once HR/Finance verify it
   * against the person's documents (clearLegalName). Nothing on the official record moves here.
   */
  async updateProfile(userId: string, body: { preferredName?: string; legalName?: string }) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { legalName: true },
    });
    if (!u) throw new NotFoundException('User not found');

    const data: Record<string, any> = {};
    if (body.preferredName !== undefined) {
      data.preferredName = body.preferredName.trim() || null;
    }
    let legalNameQueued = false;
    if (body.legalName !== undefined) {
      const proposed = body.legalName.trim();
      if (proposed && proposed !== (u.legalName || '')) {
        data.legalNameProposed = proposed;
        data.legalNamePending = true;
        legalNameQueued = true;
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        preferredName: true, legalName: true, legalNameProposed: true, legalNamePending: true,
      },
    });
    return { ...updated, legalNameQueued };
  }

  /** Everyone with a legal-name change awaiting HR/Finance sign-off. */
  async pendingLegalNames() {
    return this.prisma.user.findMany({
      where: { legalNamePending: true },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, fullName: true, email: true, department: true, jobTitle: true,
        legalName: true, legalNameProposed: true, updatedAt: true,
      },
    });
  }

  /** HR/Finance sign-off: promote the parked legal name to the record (or reject it). */
  async clearLegalName(userId: string, approve: boolean) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { legalNameProposed: true, legalNamePending: true },
    });
    if (!u || !u.legalNamePending) throw new NotFoundException('No pending legal-name change');
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        legalName: approve ? u.legalNameProposed : undefined,
        legalNameProposed: null,
        legalNamePending: false,
      },
      select: { legalName: true, legalNamePending: true },
    });
  }

  /** Point the avatar at an already-uploaded asset (served from /uploads). */
  async setAvatar(userId: string, url: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
      select: { avatarUrl: true },
    });
  }

  /** Every live device for this user, current one flagged. Most-recent first. */
  async sessions(userId: string, currentSid?: string) {
    const rows = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, deviceInfo: true, ipAddress: true, lastSeenAt: true, createdAt: true },
    });
    return rows.map((s) => ({ ...s, current: s.id === currentSid }));
  }

  /** Revoke a device. Deleting the row makes that token 401 on its next request. */
  async revokeSession(userId: string, sessionId: string) {
    const s = await this.prisma.userSession.findUnique({ where: { id: sessionId } });
    if (!s || s.userId !== userId) throw new ForbiddenException('Not your session');
    await this.prisma.userSession.delete({ where: { id: sessionId } });
    return { revoked: true };
  }

  /** Sign out everywhere else — keep only the current session. */
  async revokeOthers(userId: string, currentSid?: string) {
    const r = await this.prisma.userSession.deleteMany({
      where: { userId, NOT: currentSid ? { id: currentSid } : undefined },
    });
    return { revoked: r.count };
  }
}
