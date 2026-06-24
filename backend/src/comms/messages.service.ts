import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { CommsGateway } from './comms.gateway';

const LEAD_ROLES = ['OWNER', 'ADMIN'];

/**
 * SYS-09 — Comms backbone · Messages.
 * Append-only: edits keep prior versions, deletes insert a tombstone. Offline outbox
 * items reconcile via the idempotent (channelId, clientId) key. Every message carries
 * a content hash so the audit vault can prove it wasn't altered. Broadcast channels are
 * one-way (leads only); @mentions and reply previews are resolved without schema changes.
 */
@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService, private gateway: CommsGateway) {}

  /** Thread oldest→newest, with reply previews resolved (no self-relation needed). */
  async list(channelId: string, q: { before?: string; limit?: string } = {}) {
    const take = Math.min(Number(q.limit) || 50, 200);
    const rows = await this.prisma.message.findMany({
      where: { channelId, ...(q.before ? { createdAt: { lt: new Date(q.before) } } : {}) },
      orderBy: { createdAt: 'desc' }, take,
      include: { attachments: true },
    });
    const replyIds = [...new Set(rows.map((r) => r.replyToId).filter(Boolean))] as string[];
    const replies = replyIds.length
      ? await this.prisma.message.findMany({ where: { id: { in: replyIds } }, select: { id: true, body: true, authorId: true, type: true, deletedAt: true } })
      : [];
    const byId = new Map(replies.map((r) => [r.id, r]));
    const preview = (id?: string | null) => {
      if (!id) return null;
      const r = byId.get(id);
      if (!r) return null;
      return { id: r.id, authorId: r.authorId, type: r.type, body: r.deletedAt ? null : r.body, deleted: !!r.deletedAt };
    };
    return rows
      .map((m) => (m.deletedAt ? { ...m, body: null, attachments: [], deleted: true, replyTo: preview(m.replyToId) } : { ...m, replyTo: preview(m.replyToId) }))
      .reverse();
  }

  /** Send a message. Idempotent on (channelId, clientId). One-way broadcasts + @mention fan-out. */
  async send(channelId: string, d: any, userId?: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('channel not found');
    // One-way broadcast: only channel leads (OWNER/ADMIN) may post; everyone else is read-only.
    if (channel.isBroadcast) {
      const mem = userId ? await this.prisma.channelMember.findUnique({ where: { channelId_userId: { channelId, userId } } }) : null;
      if (!mem || !LEAD_ROLES.includes(mem.role)) throw new ForbiddenException('Announcements are read-only — only leads can post here.');
    }

    const body: string | null = d.body ?? null;
    const contentHash = body ? createHash('sha256').update(body).digest('hex') : null;
    const base = {
      authorId: userId ?? null, body, type: d.type || 'TEXT', replyToId: d.replyToId ?? null,
      lat: d.lat ?? null, lng: d.lng ?? null, contentHash,
    };
    const msg = d.clientId
      ? await this.prisma.message.upsert({
          where: { channelId_clientId: { channelId, clientId: d.clientId } },
          create: { channelId, clientId: d.clientId, ...base },
          update: {},
        })
      : await this.prisma.message.create({ data: { channelId, ...base } });

    if (Array.isArray(d.attachments) && d.attachments.length) {
      await this.prisma.attachment.createMany({
        data: d.attachments.map((a: any) => ({
          messageId: msg.id, kind: a.kind || 'FILE',
          sharedPath: a.sharedPath ?? null, sharedBytes: a.sharedBytes ?? null,
          originalPath: a.originalPath ?? a.sharedPath ?? null, originalBytes: a.originalBytes ?? a.sharedBytes ?? null,
          transcript: a.transcript ?? null, contentHash: a.contentHash ?? null,
        })),
      });
    }
    await this.prisma.channel.update({ where: { id: channelId }, data: { updatedAt: new Date() } });
    const full = await this.prisma.message.findUnique({ where: { id: msg.id }, include: { attachments: true } });

    // realtime: push to the open thread + bump each member's inbox
    this.gateway.emitMessage(channelId, full);
    const members = await this.prisma.channelMember.findMany({ where: { channelId }, select: { userId: true } });
    const memberIds = members.map((m) => m.userId);
    this.gateway.emitInbox(memberIds, { channelId, message: full });

    // @mentions: explicit ids + @all/@channel/@here (everyone) + @<dept> (e.g. @Camera → the camera crew)
    const explicit: string[] = Array.isArray(d.mentions) ? d.mentions.filter(Boolean) : [];
    const tokens = ((body || '').match(/@([A-Za-z][A-Za-z0-9_]+)/g) || []).map((t) => t.slice(1).toLowerCase());
    const wantsAll = tokens.some((t) => t === 'all' || t === 'channel' || t === 'here');
    const mentioned = new Set<string>([...explicit, ...(wantsAll ? memberIds : [])]);
    const deptTokens = tokens.filter((t) => !['all', 'channel', 'here'].includes(t));
    if (deptTokens.length && channel.projectId) {
      // resolve role/department tags against this project's crew (only members of the channel)
      const crew = await this.prisma.productionCrew.findMany({
        where: { projectId: channel.projectId, userId: { in: memberIds } },
        select: { userId: true, department: true, roleTitle: true },
      });
      for (const c of crew) {
        const hay = `${c.department || ''} ${c.roleTitle || ''}`.toLowerCase();
        if (c.userId && deptTokens.some((t) => hay.includes(t))) mentioned.add(c.userId);
      }
    }
    const targets = [...mentioned].filter((id) => id && id !== userId);
    if (targets.length) this.gateway.emitMention(targets, { channelId, message: full, by: userId });

    return full;
  }

  /** Edit keeps the prior body as a version (append-only edit trail). */
  async edit(messageId: string, body: string, _userId?: string) {
    const cur = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!cur) throw new NotFoundException();
    if (cur.deletedAt) throw new BadRequestException('message deleted');
    const prior = await this.prisma.messageVersion.count({ where: { messageId } });
    await this.prisma.messageVersion.create({ data: { messageId, version: prior + 1, body: cur.body } });
    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { body, editedAt: new Date(), contentHash: body ? createHash('sha256').update(body).digest('hex') : null },
    });
    this.gateway.emitMessageUpdate(updated.channelId, updated);
    return updated;
  }

  /** Delete is cosmetic — a tombstone. Original + versions + files are retained for the vault. */
  async remove(messageId: string, userId?: string) {
    const tomb = await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), deletedById: userId ?? null },
    });
    this.gateway.emitMessageUpdate(tomb.channelId, { id: tomb.id, channelId: tomb.channelId, deleted: true, body: null, deletedAt: tomb.deletedAt });
    return tomb;
  }

  /** Search messages across every channel the user belongs to. Filter by text, sender, date. */
  async search(userId: string, q: { q?: string; channelId?: string; authorId?: string; from?: string; to?: string } = {}) {
    if (!userId) throw new BadRequestException('user required');
    const memberships = await this.prisma.channelMember.findMany({ where: { userId }, select: { channelId: true } });
    const channelIds = memberships.map((m) => m.channelId);
    if (!channelIds.length) return [];
    const where: any = {
      channelId: q.channelId && channelIds.includes(q.channelId) ? q.channelId : { in: channelIds },
      deletedAt: null,
    };
    if (q.q) where.body = { contains: q.q, mode: 'insensitive' };
    if (q.authorId) where.authorId = q.authorId;
    if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
    return this.prisma.message.findMany({
      where, orderBy: { createdAt: 'desc' }, take: 100,
      include: { attachments: true, channel: { select: { id: true, title: true, scopeType: true } } },
    });
  }
}
