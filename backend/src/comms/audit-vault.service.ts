import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * SYS-09 — Comms backbone · Audit vault (admin-only).
 * Deleted/edited messages, original files and edit trails are retained permanently.
 * Every read here is itself written to AuditAccessLog, so there's a record of who
 * looked at what.
 */
@Injectable()
export class AuditVaultService {
  constructor(private prisma: PrismaService) {}

  deleted(projectId?: string) {
    return this.prisma.message.findMany({
      where: { deletedAt: { not: null }, ...(projectId ? { channel: { projectId } } : {}) },
      orderBy: { deletedAt: 'desc' }, take: 200,
      include: { attachments: true, channel: { select: { title: true, projectId: true } } },
    });
  }

  async view(messageId: string, adminId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        attachments: true,
        versions: { orderBy: { version: 'asc' } },
        channel: { select: { title: true, projectId: true } },
      },
    });
    if (!msg) throw new NotFoundException();
    await this.prisma.auditAccessLog.create({
      data: { adminId, targetType: 'message', targetId: messageId, action: 'VIEW' },
    });
    return msg;
  }

  accessLog(targetId?: string) {
    return this.prisma.auditAccessLog.findMany({
      where: targetId ? { targetId } : {},
      orderBy: { at: 'desc' }, take: 200,
    });
  }
}
