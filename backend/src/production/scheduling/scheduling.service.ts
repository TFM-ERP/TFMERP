import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SchedulingService {
  constructor(private prisma: PrismaService) {}

  listStrips(projectId: string) {
    return this.prisma.productionStrip.findMany({
      where: { projectId }, orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createStrip(data: any) {
    const count = await this.prisma.productionStrip.count({ where: { projectId: data.projectId, shootDay: data.shootDay ?? 0 } });
    return this.prisma.productionStrip.create({
      data: {
        projectId: data.projectId,
        sceneNumber: data.sceneNumber || null,
        intExt: data.intExt || 'INT', dayNight: data.dayNight || 'DAY',
        setName: data.setName || null, location: data.location || null,
        locationId: data.locationId || null,
        description: data.description || null,
        pages: Number(data.pages) || 0, cast: data.cast || [],
        estMinutes: data.estMinutes ? Number(data.estMinutes) : null,
        shootDay: data.shootDay ?? 0, sortOrder: data.sortOrder ?? count, notes: data.notes || null,
      },
    });
  }

  updateStrip(id: string, data: any) {
    const { id: _i, projectId, project, createdAt, updatedAt, ...rest } = data || {};
    if (rest.pages !== undefined) rest.pages = Number(rest.pages) || 0;
    if (rest.estMinutes !== undefined) rest.estMinutes = rest.estMinutes ? Number(rest.estMinutes) : null;
    return this.prisma.productionStrip.update({ where: { id }, data: rest });
  }

  removeStrip(id: string) { return this.prisma.productionStrip.delete({ where: { id } }); }

  /** Persist a new ordering / day assignment for a set of strips. */
  async reorder(items: { id: string; shootDay: number; sortOrder: number }[]) {
    await this.prisma.$transaction(
      (items || []).map(it => this.prisma.productionStrip.update({
        where: { id: it.id }, data: { shootDay: it.shootDay, sortOrder: it.sortOrder },
      })),
    );
    return { updated: (items || []).length };
  }

  /**
   * Auto-assign unscheduled scenes to shoot days — groups by set/location to minimise
   * company moves, then packs scenes to a target pages/day. Makes the DOOD meaningful.
   */
  async autoSchedule(projectId: string, opts: { pagesPerDay?: number; onlyUnscheduled?: boolean } = {}) {
    const pagesPerDay = Number(opts.pagesPerDay) || 5;
    const onlyUnscheduled = opts.onlyUnscheduled !== false;
    const where: any = { projectId };
    if (onlyUnscheduled) where.shootDay = 0;
    const strips = await this.prisma.productionStrip.findMany({ where });
    if (!strips.length) return { scheduled: 0, days: 0 };

    // group by set so the same location shoots together; preserve scene order within a set
    const sceneNo = (s: any) => parseInt(String(s.sceneNumber || '').replace(/\D/g, '')) || 0;
    const sorted = [...strips].sort((a, b) =>
      String(a.setName || '').localeCompare(String(b.setName || '')) || sceneNo(a) - sceneNo(b));

    // continue numbering after any already-scheduled days
    const maxDay = onlyUnscheduled
      ? (await this.prisma.productionStrip.aggregate({ where: { projectId, shootDay: { gt: 0 } }, _max: { shootDay: true } }))._max.shootDay || 0
      : 0;

    let day = maxDay + 1;
    let dayPages = 0;
    let order = 0;
    const updates: { id: string; shootDay: number; sortOrder: number }[] = [];
    let lastSet: string | null = null;
    for (const s of sorted) {
      const p = Number(s.pages) || 0;
      const setChanged = lastSet !== null && (s.setName || '') !== lastSet;
      // new day if this day already has scenes AND (adding exceeds target OR set changed at/over target)
      if (dayPages > 0 && (dayPages + p > pagesPerDay || (setChanged && dayPages >= pagesPerDay * 0.6))) {
        day++; dayPages = 0; order = 0;
      }
      updates.push({ id: s.id, shootDay: day, sortOrder: order++ });
      dayPages += p;
      lastSet = s.setName || '';
    }
    await this.prisma.$transaction(updates.map((u) => this.prisma.productionStrip.update({ where: { id: u.id }, data: { shootDay: u.shootDay, sortOrder: u.sortOrder } })));
    return { scheduled: updates.length, days: day - maxDay };
  }

  /** Board grouped by shoot day, enriched with schedule-day info. */
  async board(projectId: string) {
    const [strips, days] = await Promise.all([
      this.listStrips(projectId),
      this.prisma.productionSchedule.findMany({ where: { projectId }, orderBy: { dayNumber: 'asc' } }),
    ]);
    const dayInfo: Record<number, any> = {};
    for (const d of days) dayInfo[d.dayNumber] = d;

    const grouped: Record<string, any[]> = {};
    for (const s of strips) (grouped[s.shootDay] = grouped[s.shootDay] || []).push(s);

    const dayNumbers = Object.keys(grouped).map(Number).filter(n => n > 0).sort((a, b) => a - b);
    const board = dayNumbers.map(n => {
      const list = grouped[n] || [];
      const pages = list.reduce((t, s) => t + Number(s.pages), 0);
      const di = dayInfo[n] || {};
      return { dayNumber: n, date: di.date || null, location: di.location || null, callTime: di.callTime || null, strips: list, pages, sceneCount: list.length };
    });
    const unscheduled = grouped['0'] || [];
    const totalPages = strips.reduce((t, s) => t + Number(s.pages), 0);
    return { board, unscheduled, totalPages, totalScenes: strips.length, shootDays: dayNumbers.length };
  }

  /** Day Out of Days — cast working pattern across shoot days. */
  async dood(projectId: string) {
    const strips = await this.prisma.productionStrip.findMany({ where: { projectId, shootDay: { gt: 0 } }, orderBy: { shootDay: 'asc' } });
    const days = [...new Set(strips.map(s => s.shootDay))].sort((a, b) => a - b);
    const castDays: Record<string, Set<number>> = {};
    for (const s of strips) {
      const cast: string[] = Array.isArray(s.cast) ? (s.cast as any) : [];
      for (const name of cast) {
        if (!name) continue;
        (castDays[name] = castDays[name] || new Set()).add(s.shootDay);
      }
    }
    const rows = Object.entries(castDays).map(([name, set]) => {
      const work = [...set].sort((a, b) => a - b);
      const start = work[0], finish = work[work.length - 1];
      const codes: Record<number, string> = {};
      for (const d of days) {
        if (d < start || d > finish) { codes[d] = ''; continue; }
        const worksToday = set.has(d);
        let code = worksToday ? 'W' : 'H';
        if (d === start) code = worksToday ? (start === finish ? 'SWF' : 'SW') : code;
        if (d === finish && d !== start) code = worksToday ? 'WF' : code;
        codes[d] = code;
      }
      return { name, codes, start, finish, workDays: work.length };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return { days, rows };
  }
}
