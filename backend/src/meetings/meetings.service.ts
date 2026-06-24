import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * SYS-08 — Meetings & notes (net-new).
 * Schedule pre-pro/production meetings, invite by role/department ("who's concerned"),
 * run a time-boxed agenda, capture minutes + decisions, and raise action items that can
 * be promoted to assignable tasks. Agenda items can link to project entities.
 */
@Injectable()
export class MeetingsService {
  constructor(private prisma: PrismaService) {}

  list(q: { projectId?: string; from?: string; to?: string } = {}) {
    const where: any = {};
    if (q.projectId) where.projectId = q.projectId;
    if (q.from || q.to) where.startsAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) };
    return this.prisma.meeting.findMany({
      where, orderBy: { startsAt: 'asc' },
      include: { _count: { select: { attendees: true, agenda: true, actionItems: true } } },
    });
  }

  get(id: string) {
    return this.prisma.meeting.findUnique({
      where: { id },
      include: {
        attendees: true,
        agenda: { orderBy: { order: 'asc' } },
        minutes: { orderBy: { createdAt: 'asc' } },
        actionItems: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  create(d: any, userId?: string) {
    if (!d?.title || !d?.startsAt) throw new BadRequestException('title and startsAt are required');
    return this.prisma.meeting.create({
      data: {
        projectId: d.projectId ?? null, title: d.title, type: d.type || 'PRODUCTION', status: 'SCHEDULED',
        startsAt: new Date(d.startsAt), endsAt: d.endsAt ? new Date(d.endsAt) : null,
        room: d.room ?? null, location: d.location ?? null, recurrenceRule: d.recurrenceRule ?? null, createdById: userId ?? null,
        attendees: Array.isArray(d.attendees) ? { create: d.attendees.map((a: any) => ({
          userId: a.userId ?? null, name: a.name ?? null, role: a.role ?? null, department: a.department ?? null, required: a.required ?? true,
        })) } : undefined,
        agenda: Array.isArray(d.agenda) ? { create: d.agenda.map((it: any, i: number) => ({
          order: it.order ?? i, title: it.title, kind: it.kind || 'DISCUSSION', minutes: it.minutes ?? null,
          presenter: it.presenter ?? null, entityType: it.entityType ?? null, entityId: it.entityId ?? null,
        })) } : undefined,
      },
      include: { attendees: true, agenda: true },
    });
  }

  update(id: string, d: any) {
    const data: any = {};
    for (const k of ['title', 'type', 'status', 'room', 'location', 'recurrenceRule']) if (d[k] !== undefined) data[k] = d[k] ?? null;
    for (const k of ['startsAt', 'endsAt']) if (d[k] !== undefined) data[k] = d[k] ? new Date(d[k]) : null;
    return this.prisma.meeting.update({ where: { id }, data });
  }

  cancel(id: string) { return this.prisma.meeting.update({ where: { id }, data: { status: 'CANCELLED' } }); }

  addAttendees(meetingId: string, attendees: any[]) {
    return this.prisma.meetingAttendee.createMany({
      data: (attendees || []).map((a) => ({
        meetingId, userId: a.userId ?? null, name: a.name ?? null, role: a.role ?? null, department: a.department ?? null, required: a.required ?? true,
      })),
    });
  }

  async setAgenda(meetingId: string, items: any[]) {
    await this.prisma.agendaItem.deleteMany({ where: { meetingId } });
    await this.prisma.agendaItem.createMany({
      data: (items || []).map((it, i) => ({
        meetingId, order: it.order ?? i, title: it.title, kind: it.kind || 'DISCUSSION', minutes: it.minutes ?? null,
        presenter: it.presenter ?? null, entityType: it.entityType ?? null, entityId: it.entityId ?? null,
      })),
    });
    return this.prisma.agendaItem.findMany({ where: { meetingId }, orderBy: { order: 'asc' } });
  }

  addMinute(meetingId: string, d: any, userId?: string) {
    if (!d?.body) throw new BadRequestException('body required');
    return this.prisma.meetingMinute.create({ data: { meetingId, body: d.body, decision: !!d.decision, authorId: userId ?? null } });
  }

  // ── Action items (can be promoted to assignable tasks via taskId) ───────────────
  addActionItem(meetingId: string, d: any) {
    if (!d?.title) throw new BadRequestException('title required');
    return this.prisma.actionItem.create({
      data: {
        meetingId, projectId: d.projectId ?? null, title: d.title, ownerId: d.ownerId ?? null, ownerName: d.ownerName ?? null,
        dueAt: d.dueAt ? new Date(d.dueAt) : null, status: d.status || 'OPEN',
      },
    });
  }

  listActionItems(q: { projectId?: string; status?: string; ownerId?: string } = {}) {
    const where: any = {};
    if (q.projectId) where.projectId = q.projectId;
    if (q.status) where.status = q.status;
    if (q.ownerId) where.ownerId = q.ownerId;
    return this.prisma.actionItem.findMany({
      where, orderBy: { dueAt: 'asc' },
      include: { meeting: { select: { title: true, startsAt: true } } },
    });
  }

  updateActionItem(id: string, d: any) {
    const data: any = {};
    for (const k of ['title', 'ownerId', 'ownerName', 'status', 'taskId']) if (d[k] !== undefined) data[k] = d[k] ?? null;
    if (d.dueAt !== undefined) data.dueAt = d.dueAt ? new Date(d.dueAt) : null;
    return this.prisma.actionItem.update({ where: { id }, data });
  }

  /** Generate weekly instances of a recurring meeting until a date (common cadence). */
  async generateWeekly(meetingId: string, untilISO: string) {
    if (!untilISO) throw new BadRequestException('until required');
    const src = await this.prisma.meeting.findUnique({ where: { id: meetingId }, include: { agenda: true, attendees: true } });
    if (!src) throw new NotFoundException();
    const until = new Date(untilISO);
    const span = src.endsAt ? src.endsAt.getTime() - src.startsAt.getTime() : 0;
    const created: any[] = [];
    let next = new Date(src.startsAt);
    while (created.length < 52) {
      next = new Date(next.getTime() + 7 * 24 * 3600 * 1000);
      if (next > until) break;
      const m = await this.prisma.meeting.create({
        data: {
          projectId: src.projectId, title: src.title, type: src.type, status: 'SCHEDULED',
          startsAt: next, endsAt: span ? new Date(next.getTime() + span) : null,
          room: src.room, location: src.location, parentId: src.id, recurrenceRule: src.recurrenceRule,
          attendees: { create: src.attendees.map((a) => ({ userId: a.userId, name: a.name, role: a.role, department: a.department, required: a.required })) },
          agenda: { create: src.agenda.map((it) => ({ order: it.order, title: it.title, kind: it.kind, minutes: it.minutes, presenter: it.presenter, entityType: it.entityType, entityId: it.entityId })) },
        },
      });
      created.push(m);
    }
    return created;
  }
}
