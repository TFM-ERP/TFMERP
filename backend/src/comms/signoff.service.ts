import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { MessagesService } from './messages.service';

/**
 * SYS-09 — Read-&-Sign blasts.
 * A call sheet or safety addendum can be posted as a *gated* message: the crew must
 * tap-sign before they proceed. The blast is a normal ENTITY_CARD carrying JSON
 * (kind:'signoff'); each signature is an AuditAccessLog row (action 'ACK') — so this
 * needs no schema change and produces an undeniable, append-only compliance log.
 */
const safeParse = (s?: string | null) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };

@Injectable()
export class SignoffService {
  constructor(private prisma: PrismaService, private messages: MessagesService) {}

  /** Post a read-&-sign blast (leads only on announce channels — enforced by MessagesService). */
  async create(channelId: string, d: { title: string; body?: string }, userId?: string) {
    if (!d?.title) throw new BadRequestException('a title is required');
    const cardBody = JSON.stringify({ kind: 'signoff', title: d.title, body: d.body || '', requireSign: true, by: userId ?? null });
    return this.messages.send(channelId, { type: 'ENTITY_CARD', body: cardBody }, userId);
  }

  /** Record a user's acknowledgement / signature. Idempotent — one signature per person. */
  async ack(messageId: string, userId?: string) {
    if (!userId) throw new BadRequestException('user required');
    const existing = await this.prisma.auditAccessLog.findFirst({ where: { targetId: messageId, adminId: userId, action: 'ACK' } });
    if (existing) return existing;
    return this.prisma.auditAccessLog.create({ data: { adminId: userId, targetType: 'signoff', targetId: messageId, action: 'ACK' } });
  }

  /** Signoff blasts in the user's channels they haven't signed yet — the UI gate reads this. */
  async pending(userId: string) {
    if (!userId) throw new BadRequestException('user required');
    const memberships = await this.prisma.channelMember.findMany({ where: { userId }, select: { channelId: true } });
    const chIds = memberships.map((m) => m.channelId);
    if (!chIds.length) return [];
    const blasts = await this.prisma.message.findMany({
      where: { channelId: { in: chIds }, type: 'ENTITY_CARD', deletedAt: null, body: { contains: '"kind":"signoff"' } },
      orderBy: { createdAt: 'desc' }, take: 50,
      include: { channel: { select: { title: true } } },
    });
    if (!blasts.length) return [];
    const acks = await this.prisma.auditAccessLog.findMany({ where: { adminId: userId, action: 'ACK', targetId: { in: blasts.map((b) => b.id) } }, select: { targetId: true } });
    const acked = new Set(acks.map((a) => a.targetId));
    return blasts
      .filter((b) => !acked.has(b.id))
      .map((b) => ({ id: b.id, channelId: b.channelId, channelTitle: b.channel?.title, createdAt: b.createdAt, ...safeParse(b.body) }));
  }

  /** Compliance: everyone who has signed a given blast, newest first. */
  async signers(messageId: string) {
    return this.prisma.auditAccessLog.findMany({ where: { targetId: messageId, action: 'ACK' }, orderBy: { at: 'desc' } });
  }
}
