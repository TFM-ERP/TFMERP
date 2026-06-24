import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-09 × scheduling — DOOD-driven chat presence + access expiry.
 * Presence: a crew member is ON_SET when today falls inside their ProductionCrew working
 * window AND it's a shoot day; WRAPPED once their end date has passed; UPCOMING before they
 * start; otherwise UNSCHEDULED. Auto-expiry strips a wrapped daily-hire's *derived* channel
 * memberships (leads / explicit members are never touched), so they leave the sandbox the
 * moment they wrap.
 */
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

@Injectable()
export class PresenceService {
  constructor(private prisma: PrismaService) {}

  /** Per-crew schedule status for a project on a given date (default today). */
  async presence(projectId: string, dateStr?: string) {
    const day = startOfDay(dateStr ? new Date(dateStr) : new Date());
    const next = addDays(day, 1);
    const crew = await this.prisma.productionCrew.findMany({
      where: { projectId, userId: { not: null } },
      select: { userId: true, name: true, department: true, roleTitle: true, startDate: true, endDate: true },
    });
    const isShootDay = (await this.prisma.productionSchedule.count({ where: { projectId, date: { gte: day, lt: next } } })) > 0;

    const crewStatus = crew.map((c) => {
      const s = c.startDate ? startOfDay(c.startDate) : null;
      const e = c.endDate ? startOfDay(c.endDate) : null;
      let status = 'UNSCHEDULED';
      if (e && e < day) status = 'WRAPPED';
      else if (s && s > day) status = 'UPCOMING';
      else if ((!s || s <= day) && (!e || e >= day)) status = isShootDay ? 'ON_SET' : 'ON_CALL';
      return { userId: c.userId, name: c.name, department: c.department, roleTitle: c.roleTitle, endDate: c.endDate, status };
    });
    const counts = crewStatus.reduce((m: Record<string, number>, c) => { m[c.status] = (m[c.status] || 0) + 1; return m; }, {});
    const byUser: Record<string, string> = {};
    for (const c of crewStatus) if (c.userId) byUser[c.userId] = c.status;
    return { date: day, isShootDay, counts, crew: crewStatus, byUser };
  }

  /**
   * Auto-expire: remove wrapped crew (endDate < today) from this project's DERIVED channel
   * memberships only. Returns how many memberships were revoked. Idempotent — safe to run daily.
   */
  async syncChatAccess(projectId: string) {
    const today = startOfDay(new Date());
    const wrapped = await this.prisma.productionCrew.findMany({
      where: { projectId, userId: { not: null }, endDate: { lt: today } },
      select: { userId: true },
    });
    const wrappedIds = [...new Set(wrapped.map((w) => w.userId).filter(Boolean) as string[])];
    if (!wrappedIds.length) return { revoked: 0, users: [] as string[] };
    const channels = await this.prisma.channel.findMany({ where: { projectId }, select: { id: true } });
    const chIds = channels.map((c) => c.id);
    if (!chIds.length) return { revoked: 0, users: wrappedIds };
    const res = await this.prisma.channelMember.deleteMany({
      where: { channelId: { in: chIds }, userId: { in: wrappedIds }, derivedFromAssignment: true },
    });
    return { revoked: res.count, users: wrappedIds };
  }
}
