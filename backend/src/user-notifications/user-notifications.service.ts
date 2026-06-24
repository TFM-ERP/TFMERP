import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * SYS-UX Phase 3 — per-user notifications feed (route /me/notifications).
 * Distinct from the existing role-alert NotificationsService (route /notifications).
 * Backed by the additive Prisma model UserNotification.
 * NOTE: compiles once `prisma db:push` has regenerated the client with UserNotification.
 */
@Injectable()
export class UserNotificationsService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.userNotification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  unreadCount(userId: string) {
    return this.prisma.userNotification.count({ where: { userId, readAt: null } });
  }

  markRead(userId: string, id: string) {
    return this.prisma.userNotification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  }

  markAll(userId: string) {
    return this.prisma.userNotification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  /** Internal helper other modules call to surface an event to a user. */
  emit(userId: string, data: { type: string; title: string; body?: string; href?: string; projectId?: string }) {
    return this.prisma.userNotification.create({ data: { userId, ...data } });
  }
}
