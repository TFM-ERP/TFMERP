import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * SYS-09 — Comms backbone · Channels.
 * One messaging service surfaced as a global inbox + in-module threads. A channel
 * is keyed to an entity (scopeType + scopeId) and membership is derived from who is
 * assigned to it. Delete is cosmetic; history is retained for the admin audit vault.
 */
@Injectable()
export class ChannelsService {
  constructor(private prisma: PrismaService) {}

  /** Channels the user belongs to, newest-activity first, with unread counts. */
  async listForUser(userId: string, projectId?: string) {
    if (!userId) throw new BadRequestException('user required');
    const memberships = await this.prisma.channelMember.findMany({
      where: { userId, channel: projectId ? { projectId, archivedAt: null } : { archivedAt: null } },
      include: { channel: { include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } } } },
    });
    const out: any[] = [];
    for (const m of memberships) {
      const unread = await this.prisma.message.count({
        where: { channelId: m.channelId, deletedAt: null, ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}) },
      });
      const last = m.channel.messages[0] || null;
      out.push({
        ...m.channel,
        messages: undefined,
        lastMessage: last ? (last.deletedAt ? { ...last, body: null, deleted: true } : last) : null,
        unread,
        myRole: m.role,
      });
    }
    out.sort((a, b) =>
      new Date(b.lastMessage?.createdAt || b.updatedAt).getTime() -
      new Date(a.lastMessage?.createdAt || a.updatedAt).getTime());
    return out;
  }

  get(id: string) {
    return this.prisma.channel.findUnique({
      where: { id },
      include: { members: true, _count: { select: { messages: true } } },
    });
  }

  async create(d: any, userId?: string) {
    if (!d?.title || !d?.scopeType) throw new BadRequestException('title and scopeType are required');
    const channel = await this.prisma.channel.create({
      data: {
        scopeType: d.scopeType, scopeId: d.scopeId ?? null, title: d.title,
        isPTT: !!d.isPTT, isBroadcast: !!d.isBroadcast, projectId: d.projectId ?? null, createdById: userId ?? null,
      },
    });
    if (userId) await this.addMembers(channel.id, [userId], false, 'OWNER');
    return channel;
  }

  /** Idempotent get-or-create for an entity's channel. */
  async ensureScoped(scopeType: string, scopeId: string, title: string, projectId?: string) {
    const existing = await this.prisma.channel.findFirst({ where: { scopeType: scopeType as any, scopeId } });
    if (existing) return existing;
    return this.prisma.channel.create({
      data: { scopeType: scopeType as any, scopeId, title, projectId: projectId ?? null },
    });
  }

  /** Add members derived from an assignment (unit/department/trip). Idempotent. */
  async addMembers(channelId: string, userIds: string[], derived = true, role = 'MEMBER') {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    await this.prisma.$transaction(ids.map((userId) =>
      this.prisma.channelMember.upsert({
        where: { channelId_userId: { channelId, userId } },
        create: { channelId, userId, role: role as any, derivedFromAssignment: derived },
        update: {},
      })));
    return { added: ids.length };
  }

  removeMember(channelId: string, userId: string) {
    return this.prisma.channelMember
      .delete({ where: { channelId_userId: { channelId, userId } } })
      .catch(() => null);
  }

  markRead(channelId: string, userId: string) {
    return this.prisma.channelMember
      .update({ where: { channelId_userId: { channelId, userId } }, data: { lastReadAt: new Date() } })
      .catch(() => null);
  }

  archive(id: string) {
    return this.prisma.channel.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /**
   * Open (or reuse) a direct-message channel. Restricted: a lead (OWNER/ADMIN of any
   * channel) may DM anyone; crew may only DM a lead they already share a channel with —
   * so a daily hire can reach their department head, not the lead actor or Line Producer.
   */
  async createDm(initiatorId: string, targetUserId: string) {
    if (!initiatorId || !targetUserId) throw new BadRequestException('both users are required');
    if (initiatorId === targetUserId) throw new BadRequestException('cannot DM yourself');
    const initiatorIsLead = await this.prisma.channelMember.findFirst({ where: { userId: initiatorId, role: { in: ['OWNER', 'ADMIN'] as any } } });
    if (!initiatorIsLead) {
      const targetSharedLead = await this.prisma.channelMember.findFirst({
        where: { userId: targetUserId, role: { in: ['OWNER', 'ADMIN'] as any }, channel: { members: { some: { userId: initiatorId } } } },
      });
      if (!targetSharedLead) throw new ForbiddenException('You can only message your department lead.');
    }
    const pair = [initiatorId, targetUserId].sort();
    const scopeId = `dm:${pair[0]}:${pair[1]}`;
    const existing = await this.prisma.channel.findFirst({ where: { scopeType: 'DM', scopeId } });
    const ch = existing || (await this.prisma.channel.create({ data: { scopeType: 'DM', scopeId, title: 'Direct message' } }));
    await this.addMembers(ch.id, pair, false, 'MEMBER');
    return ch;
  }

  /**
   * Spin up the standard channel set for a project along the production hierarchy.
   * Producers/Line Producers/UPM/dept heads add their members via addMembers() from
   * the project's role assignments (the integration point the production side calls).
   */
  async createHierarchyGroups(projectId: string, projectTitle = 'Project', creatorId?: string) {
    if (!projectId) throw new BadRequestException('projectId required');
    const defs = [
      { scopeType: 'PROJECT', scopeId: projectId, title: `${projectTitle} · all`, isBroadcast: false, isPTT: false },
      { scopeType: 'BROADCAST', scopeId: `${projectId}:announce`, title: 'Announcements', isBroadcast: true, isPTT: false },
      { scopeType: 'TEAM', scopeId: `${projectId}:btl`, title: 'BTL crew', isBroadcast: false, isPTT: false },
      { scopeType: 'UNIT', scopeId: `${projectId}:main`, title: 'Main unit', isBroadcast: false, isPTT: false },
      { scopeType: 'UNIT', scopeId: `${projectId}:second`, title: 'Second unit', isBroadcast: false, isPTT: false },
      { scopeType: 'PTT', scopeId: `${projectId}:drivers`, title: 'Drivers on shift', isBroadcast: false, isPTT: true },
    ];
    const created: any[] = [];
    for (const def of defs) {
      const ch = await this.ensureScoped(def.scopeType, def.scopeId, def.title, projectId);
      if (def.isBroadcast || def.isPTT) {
        await this.prisma.channel.update({ where: { id: ch.id }, data: { isBroadcast: def.isBroadcast, isPTT: def.isPTT } });
      }
      if (creatorId) await this.addMembers(ch.id, [creatorId], false, 'OWNER');
      created.push(ch);
    }
    return created;
  }

  // ── PTT live sessions (presence for walkie / "drivers on shift" channels) ────
  /** Join (or open) the channel's live push-to-talk session. Idempotent per channel. */
  async startPtt(channelId: string, userId?: string) {
    const live = await this.prisma.pttSession.findFirst({ where: { channelId, status: 'LIVE' } });
    if (live) {
      if (userId && !live.participants.includes(userId)) {
        return this.prisma.pttSession.update({
          where: { id: live.id },
          data: { participants: { set: [...live.participants, userId] } },
        });
      }
      return live;
    }
    return this.prisma.pttSession.create({
      data: { channelId, status: 'LIVE', participants: userId ? [userId] : [] },
    });
  }

  /** End a live session (last participant out / dispatcher closes it). */
  endPtt(sessionId: string) {
    return this.prisma.pttSession
      .update({ where: { id: sessionId }, data: { status: 'ENDED', endedAt: new Date() } })
      .catch(() => null);
  }

  /** The channel's current live session, if any (for the dispatcher's "on air" indicator). */
  activePtt(channelId: string) {
    return this.prisma.pttSession.findFirst({
      where: { channelId, status: 'LIVE' },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Mint a LiveKit access token for live walkie audio on a PTT channel. Optional: returns
   * { configured:false } when the LiveKit env vars / SDK aren't set up, so clients gracefully
   * fall back to the voice-note PTT. The channel id maps 1:1 to the LiveKit room.
   */
  async rtcToken(channelId: string, userId?: string, name?: string) {
    const url = process.env.LIVEKIT_URL, key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
    if (!url || !key || !secret) return { configured: false as const };
    let AccessToken: any;
    try { AccessToken = require('livekit-server-sdk').AccessToken; } catch { return { configured: false as const, reason: 'livekit-server-sdk not installed' }; }
    const at = new AccessToken(key, secret, { identity: userId || `anon-${Date.now()}`, name: name || 'crew' });
    at.addGrant({ roomJoin: true, room: `ptt:${channelId}`, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();
    return { configured: true as const, url, token, room: `ptt:${channelId}` };
  }
}
