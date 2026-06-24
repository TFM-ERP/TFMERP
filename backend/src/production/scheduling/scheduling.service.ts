import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { planShootingOrder } from './scheduling.util';
import { CalendarAnchoringService } from './calendar-anchoring.service';
import { SunPathService } from '../locations/sun-path.service';

@Injectable()
export class SchedulingService {
  constructor(private prisma: PrismaService, private calendar: CalendarAnchoringService, private sun: SunPathService) {}

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
        isLocked: !!data.isLocked, isBanner: !!data.isBanner, bannerText: data.bannerText || null,
      } as any,
    });
  }

  updateStrip(id: string, data: any) {
    const { id: _i, projectId, project, createdAt, updatedAt, ...rest } = data || {};
    if (rest.pages !== undefined) rest.pages = Number(rest.pages) || 0;
    if (rest.estMinutes !== undefined) rest.estMinutes = rest.estMinutes ? Number(rest.estMinutes) : null;
    return this.prisma.productionStrip.update({ where: { id }, data: rest as any });
  }

  removeStrip(id: string) { return this.prisma.productionStrip.delete({ where: { id } }); }

  /** Conflict & gating engine — location-availability / permit windows, cast clashes, over-target
   *  days, plus per-day daylight ("light plan") notes for EXT scenes from the sun engine. */
  async conflicts(projectId: string) {
    const PAGES_TARGET = 6;
    const fd = (d: any) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const cal = await this.calendar.projectCalendar(projectId).catch(() => null as any);
    const dateOf = new Map<number, string>();
    if (cal) for (const d of cal.days) if (d.shootDay) dateOf.set(d.shootDay, d.date);
    const strips = await this.prisma.productionStrip.findMany({ where: { projectId, shootDay: { gt: 0 } }, orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }] });
    const locIds = Array.from(new Set(strips.map((s: any) => s.locationId).filter(Boolean))) as string[];
    const locs = locIds.length ? await this.prisma.location.findMany({ where: { id: { in: locIds } }, select: { id: true, name: true, lat: true, lng: true, shootStart: true, shootEnd: true, permitRequired: true, permitStatus: true, permitExpiry: true } }) : [];
    const locMap = new Map(locs.map((l: any) => [l.id, l]));
    const warnings: any[] = [];
    const byDay: Record<number, any[]> = {};
    for (const s of strips) (byDay[s.shootDay] ||= []).push(s);

    for (const [dayStr, list] of Object.entries(byDay)) {
      const day = Number(dayStr); const date = dateOf.get(day);
      const pages = list.reduce((t, s: any) => t + Number(s.pages || 0), 0);
      if (pages > PAGES_TARGET + 0.01) warnings.push({ type: 'OVER_TARGET', severity: 'low', day, message: `Day ${day} is ${pages.toFixed(2)} pages (target ${PAGES_TARGET}).` });
      const dayLocs = Array.from(new Set(list.map((s: any) => s.locationId).filter(Boolean)));
      if (dayLocs.length > 1) warnings.push({ type: 'COMPANY_MOVE', severity: 'medium', day, message: `Day ${day} shoots ${dayLocs.length} locations — needs a company move or unit split.` });
      const castLoc: Record<string, Set<string>> = {};
      for (const s of list) for (const c of (Array.isArray(s.cast) ? s.cast : [])) (castLoc[c] ||= new Set()).add(s.locationId || s.location || '—');
      for (const [c, set] of Object.entries(castLoc)) if (set.size > 1) warnings.push({ type: 'CAST_CLASH', severity: 'high', day, message: `${c} is required at ${set.size} places on Day ${day}.` });
      for (const s of list) {
        if (!s.locationId || !date) continue;
        const loc: any = locMap.get(s.locationId); if (!loc) continue;
        const dd = new Date(date);
        if (loc.shootStart && dd < new Date(loc.shootStart)) warnings.push({ type: 'LOCATION', severity: 'high', day, message: `${loc.name}: Day ${day} (${fd(date)}) is before its available-from ${fd(loc.shootStart)}.` });
        if (loc.shootEnd && dd > new Date(loc.shootEnd)) warnings.push({ type: 'LOCATION', severity: 'high', day, message: `${loc.name}: Day ${day} (${fd(date)}) is after its available-until ${fd(loc.shootEnd)}.` });
        if (loc.permitRequired) {
          if (loc.permitStatus !== 'APPROVED') warnings.push({ type: 'PERMIT', severity: 'high', day, message: `${loc.name}: permit not approved (${loc.permitStatus || 'NONE'}) for Day ${day}.` });
          else if (loc.permitExpiry && dd > new Date(loc.permitExpiry)) warnings.push({ type: 'PERMIT', severity: 'high', day, message: `${loc.name}: permit expires ${fd(loc.permitExpiry)} before Day ${day} (${fd(date)}).` });
        }
      }
    }
    // light plan — daylight window for EXT days
    const light: any[] = [];
    for (const [dayStr, list] of Object.entries(byDay)) {
      const day = Number(dayStr); const date = dateOf.get(day); if (!date) continue;
      const ext = list.find((s: any) => s.intExt !== 'INT' && s.locationId && (locMap.get(s.locationId) as any)?.lat != null);
      if (!ext) continue;
      const loc: any = locMap.get(ext.locationId);
      try {
        const sun: any = this.sun.compute(Number(loc.lat), Number(loc.lng), new Date(date).toISOString(), 240);
        light.push({ day, date, location: loc.name, sunrise: sun.sunrise, sunset: sun.sunset, goldenAm: sun.goldenHourAm, goldenPm: sun.goldenHourPm, dayLength: sun.dayLength, extScenes: list.filter((s: any) => s.intExt !== 'INT').map((s: any) => s.sceneNumber).filter(Boolean) });
      } catch { /* no coords */ }
    }
    const rank: any = { high: 0, medium: 1, low: 2 };
    warnings.sort((a, b) => (rank[a.severity] - rank[b.severity]) || (a.day - b.day));
    return { count: warnings.length, warnings, light };
  }

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

  /**
   * Shooting-order optimizer (PREVIEW by default; pass apply:true to persist).
   * Levers, in priority order: (1) shoot a location out before moving (fewer company
   * moves), (2) keep each cast member's scenes contiguous (fewer paid hold/idle days),
   * (3) cluster DAY vs NIGHT within a location (fewer relights) — while never moving
   * locked strips or banner/day-break rows. Returns the proposed plan + before/after
   * metrics + a plain-English rationale ("why this order").
   */
  async optimizeOrder(projectId: string, opts: { pagesPerDay?: number; respectLocks?: boolean; groupByDayNight?: boolean; apply?: boolean } = {}) {
    const apply = opts.apply === true;
    const all = await this.prisma.productionStrip.findMany({ where: { projectId }, orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }] });
    const res: any = planShootingOrder(all, opts);
    if (!res.ok) return res;
    if (apply) {
      const writes = res.plan.filter((p: any) => !p.pinned).map((p: any) => this.prisma.productionStrip.update({ where: { id: p.id }, data: { shootDay: p.shootDay, sortOrder: p.sortOrder } }));
      if (writes.length) await this.prisma.$transaction(writes);
    }
    return { ...res, applied: apply };
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
      const dropAfter = 4;
      const codes: Record<number, string> = {};
      for (const d of days) {
        if (d < start || d > finish) { codes[d] = ''; continue; }
        if (set.has(d)) {
          const prevW = work.filter((w) => w < d).pop();
          const gapBefore = prevW != null ? days.filter((x) => x > prevW && x < d).length : 0;
          if (d === start && d === finish) codes[d] = 'SWF';
          else if (d === start) codes[d] = 'SW';
          else if (d === finish) codes[d] = 'WF';
          else if (gapBefore >= dropAfter) codes[d] = 'PU';
          else codes[d] = 'W';
        } else {
          const prevW = work.filter((w) => w < d).pop()!;
          const nextW = work.find((w) => w > d)!;
          const gapLen = days.filter((x) => x > prevW && x < nextW).length;
          codes[d] = gapLen >= dropAfter ? 'D' : 'H';
        }
      }
      return { name, codes, start, finish, workDays: work.length };
    }).sort((a, b) => a.name.localeCompare(b.name));
    return { days, rows };
  }
  /** Distributable schedule outputs — the one-liner and the full shooting schedule
   *  share this payload. Per shoot day: scenes (with location + breakdown elements),
   *  day-break banners, page totals and the day's cast; plus a cast index. */
  async shootingSchedule(projectId: string) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { id: true, title: true } }).catch(() => null);
    const strips = await this.prisma.productionStrip.findMany({ where: { projectId, shootDay: { gt: 0 } }, orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }] });
    const cal = await this.calendar.projectCalendar(projectId).catch(() => null as any);
    const dateOf = new Map<number, string>();
    if (cal) for (const d of cal.days) if (d.shootDay) dateOf.set(d.shootDay, d.date);
    const locIds = Array.from(new Set(strips.map((s: any) => s.locationId).filter(Boolean))) as string[];
    const locs = locIds.length ? await this.prisma.location.findMany({ where: { id: { in: locIds } }, select: { id: true, name: true } }) : [];
    const locMap = new Map(locs.map((l: any) => [l.id, l]));
    const els = strips.length ? await this.prisma.breakdownElement.findMany({ where: { stripId: { in: strips.map((s: any) => s.id) } }, select: { stripId: true, category: true, name: true } }).catch(() => [] as any[]) : [];
    const elByStrip = new Map<string, Record<string, string[]>>();
    for (const e of els as any[]) { if (!e.stripId) continue; const g = elByStrip.get(e.stripId) || {}; (g[e.category] = g[e.category] || []).push(e.name); elByStrip.set(e.stripId, g); }

    const nonBanner = strips.filter((s: any) => !s.isBanner);
    const dayNums = [...new Set(nonBanner.map((s: any) => s.shootDay))].sort((a, b) => a - b);
    const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : null;

    const days = dayNums.map((day) => {
      const list = strips.filter((s: any) => s.shootDay === day);
      const banners = list.filter((s: any) => s.isBanner).map((s: any) => s.bannerText).filter(Boolean);
      const scenes = list.filter((s: any) => !s.isBanner).sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((s: any) => ({
        sceneNumber: s.sceneNumber, intExt: s.intExt, dayNight: s.dayNight,
        setName: s.setName, location: (locMap.get(s.locationId) as any)?.name || s.location || null,
        description: s.description, pages: Number(s.pages || 0),
        cast: Array.isArray(s.cast) ? s.cast : [],
        elements: elByStrip.get(s.id) || {},
      }));
      const dayLocs = Array.from(new Set(scenes.map((sc) => sc.location).filter(Boolean)));
      const pages = scenes.reduce((t, sc) => t + sc.pages, 0);
      const castSet = new Set<string>(); for (const sc of scenes) for (const c of sc.cast) if (c) castSet.add(c);
      const iso = dateOf.get(day) || null;
      return { day, date: iso, dateLabel: fmtDate(iso || undefined), locations: dayLocs, banners, scenes, pages, sceneCount: scenes.length, cast: [...castSet].sort() };
    });

    const castDays: Record<string, number[]> = {};
    for (const s of nonBanner) for (const c of (Array.isArray((s as any).cast) ? (s as any).cast : [])) { if (!c) continue; (castDays[c] = castDays[c] || []).push((s as any).shootDay); }
    const cast = Object.entries(castDays).map(([name, ds]) => { const w = [...new Set(ds)].sort((a, b) => a - b); return { name, firstDay: w[0], lastDay: w[w.length - 1], workDays: w.length }; }).sort((a, b) => a.name.localeCompare(b.name));

    return {
      project: project || { id: projectId, title: 'Production' },
      generatedAt: new Date().toISOString(),
      days, cast,
      totalScenes: nonBanner.length,
      totalPages: nonBanner.reduce((t: number, s: any) => t + Number(s.pages || 0), 0),
      shootDays: dayNums.length,
    };
  }
  // ── M6: scenario metrics + row helpers ───────────────────────────────────────
  /** Schedule-quality metrics for a flat row set (drives scenario compare). */
  private scenarioMetrics(rows: any[]) {
    const real = (rows || []).filter((r: any) => !r.isBanner);
    const days = [...new Set(real.map((r: any) => Number(r.shootDay)))].filter((d) => d > 0).sort((a, b) => a - b);
    const byDay = new Map<number, any[]>();
    for (const r of real) { const d = Number(r.shootDay); if (d > 0) { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d)!.push(r); } }
    const locOf = (r: any) => String(r.location || r.setName || r.locationId || '');
    let moves = 0, dnSwitch = 0, multiLocDays = 0; let prevLoc: string | null = null;
    for (const d of days) {
      const list = (byDay.get(d) || []).slice().sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
      const locs = [...new Set(list.map(locOf))];
      if (locs.length > 1) multiLocDays++;
      const primary = locs.length ? locs[0] : null;
      if (prevLoc !== null && primary !== prevLoc) moves++;
      prevLoc = primary;
      for (let i = 1; i < list.length; i++) if (list[i].dayNight !== list[i - 1].dayNight) dnSwitch++;
    }
    const castDays = new Map<string, Set<number>>();
    for (const r of real) { const d = Number(r.shootDay); if (d <= 0) continue; for (const c of (Array.isArray(r.cast) ? r.cast : [])) { if (!c) continue; if (!castDays.has(c)) castDays.set(c, new Set<number>()); castDays.get(c)!.add(d); } }
    const dayIndex = new Map<number, number>(); days.forEach((d, i) => dayIndex.set(d, i));
    let hold = 0;
    for (const set of castDays.values()) { const ws = [...set].sort((a, b) => a - b); if (ws.length < 2) continue; hold += (dayIndex.get(ws[ws.length - 1])! - dayIndex.get(ws[0])!) + 1 - ws.length; }
    return { shootDays: days.length, companyMoves: moves, multiLocationDays: multiLocDays, castHoldDays: hold, dayNightSwitches: dnSwitch, totalPages: real.reduce((t: number, r: any) => t + Number(r.pages || 0), 0), totalScenes: real.length };
  }

  private stripToRow(s: any) {
    return { stripId: s.id, sceneNumber: s.sceneNumber, intExt: s.intExt, dayNight: s.dayNight, setName: s.setName, location: s.location, locationId: s.locationId, description: s.description, pages: Number(s.pages || 0), cast: Array.isArray(s.cast) ? s.cast : [], shootDay: s.shootDay, sortOrder: s.sortOrder, isBanner: !!s.isBanner, bannerText: s.bannerText || null };
  }

  // ── M6: scenario CRUD + apply/compare ────────────────────────────────────────
  async listScenarios(projectId: string) {
    const rows = await (this.prisma as any).scheduleScenario.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }).catch(() => [] as any[]);
    return rows.map((r: any) => ({ id: r.id, name: r.name, notes: r.notes, kind: r.kind, metrics: r.metrics, sceneCount: Array.isArray(r.strips) ? r.strips.filter((x: any) => !x.isBanner).length : 0, createdAt: r.createdAt }));
  }
  getScenario(id: string) { return (this.prisma as any).scheduleScenario.findUnique({ where: { id } }); }

  async snapshotScenario(projectId: string, body: { name?: string; notes?: string; kind?: string } = {}) {
    const strips = await this.prisma.productionStrip.findMany({ where: { projectId }, orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }] });
    const rows = strips.map((s: any) => this.stripToRow(s));
    const metrics = this.scenarioMetrics(rows);
    const name = body.name || `Snapshot ${new Date().toLocaleString('en-GB')}`;
    return (this.prisma as any).scheduleScenario.create({ data: { projectId, name, notes: body.notes || null, kind: body.kind || 'SNAPSHOT', strips: rows, metrics } });
  }

  /** Build an OPTIMIZED scenario by running the optimizer in preview — never touches live. */
  async optimizedScenario(projectId: string, opts: { pagesPerDay?: number; respectLocks?: boolean; groupByDayNight?: boolean; name?: string } = {}) {
    const res: any = await this.optimizeOrder(projectId, { pagesPerDay: opts.pagesPerDay, respectLocks: opts.respectLocks, groupByDayNight: opts.groupByDayNight, apply: false });
    if (!res?.ok) return res;
    const strips = await this.prisma.productionStrip.findMany({ where: { projectId } });
    const byId = new Map(strips.map((s: any) => [s.id, s]));
    const rows: any[] = (res.plan || []).map((p: any) => { const s: any = byId.get(p.id) || {}; return { stripId: p.id, sceneNumber: p.sceneNumber ?? s.sceneNumber, intExt: s.intExt, dayNight: p.dayNight ?? s.dayNight, setName: s.setName, location: p.location ?? s.location, locationId: s.locationId, description: s.description, pages: Number(p.pages ?? s.pages ?? 0), cast: p.cast ?? (Array.isArray(s.cast) ? s.cast : []), shootDay: p.shootDay, sortOrder: p.sortOrder, isBanner: !!s.isBanner, bannerText: s.bannerText || null }; });
    for (const s of strips as any[]) if (s.isBanner) rows.push(this.stripToRow(s));
    const metrics = this.scenarioMetrics(rows);
    const name = opts.name || `Optimised ${new Date().toLocaleString('en-GB')}`;
    return (this.prisma as any).scheduleScenario.create({ data: { projectId, name, notes: `pages/day ${res.pagesPerDay}`, kind: 'OPTIMIZED', strips: rows, metrics } });
  }

  updateScenario(id: string, body: { name?: string; notes?: string }) {
    const data: any = {}; if (body?.name !== undefined) data.name = body.name; if (body?.notes !== undefined) data.notes = body.notes;
    return (this.prisma as any).scheduleScenario.update({ where: { id }, data });
  }
  deleteScenario(id: string) { return (this.prisma as any).scheduleScenario.delete({ where: { id } }); }

  async compareScenarios(projectId: string, ids: string[]) {
    const liveStrips = await this.prisma.productionStrip.findMany({ where: { projectId } });
    const live = { id: 'live', name: 'Live board', kind: 'LIVE', metrics: this.scenarioMetrics(liveStrips.map((s: any) => this.stripToRow(s))) };
    const scenarios = ids?.length ? await (this.prisma as any).scheduleScenario.findMany({ where: { id: { in: ids }, projectId } }).catch(() => [] as any[]) : [];
    const rows = scenarios.map((s: any) => ({ id: s.id, name: s.name, kind: s.kind, metrics: s.metrics || this.scenarioMetrics(Array.isArray(s.strips) ? s.strips : []) }));
    return { columns: [live, ...rows] };
  }

  /** Apply a scenario to the live board (auto-snapshots live first as a rollback baseline). */
  async applyScenario(id: string) {
    const sc: any = await (this.prisma as any).scheduleScenario.findUnique({ where: { id } });
    if (!sc) throw new Error('Scenario not found');
    await this.snapshotScenario(sc.projectId, { name: `Before applying "${sc.name}" · ${new Date().toLocaleString('en-GB')}`, kind: 'BASELINE' }).catch(() => null);
    const rows: any[] = Array.isArray(sc.strips) ? sc.strips : [];
    const liveIds = new Set((await this.prisma.productionStrip.findMany({ where: { projectId: sc.projectId }, select: { id: true } })).map((s: any) => s.id));
    const writes = rows.filter((r) => r.stripId && liveIds.has(r.stripId)).map((r) => this.prisma.productionStrip.update({ where: { id: r.stripId }, data: { shootDay: Number(r.shootDay) || 0, sortOrder: Number(r.sortOrder) || 0 } }));
    if (writes.length) await this.prisma.$transaction(writes);
    return { applied: writes.length, of: rows.length, baseline: true };
  }

  // ── M6: script ↔ strip reconciliation (populates ScriptScene.productionStripId) ──
  private async activeSceneRows(projectId: string) {
    const docs = await this.prisma.scriptDocument.findMany({ where: { projectId }, select: { activeRevisionId: true, revisions: { select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 } } }).catch(() => [] as any[]);
    const revIds = Array.from(new Set((docs as any[]).map((d) => d.activeRevisionId || d.revisions?.[0]?.id).filter(Boolean)));
    if (!revIds.length) return [] as any[];
    return this.prisma.scriptScene.findMany({ where: { revisionId: { in: revIds as string[] } }, select: { id: true, sceneNumber: true, slugline: true, productionStripId: true } });
  }
  private normScene(n: any) { return String(n || '').toUpperCase().replace(/\s+/g, '').trim(); }

  /** Reconcile script scenes ↔ production strips by scene number; with apply, writes the FK. */
  async scriptStripStatus(projectId: string, opts: { apply?: boolean } = {}) {
    const apply = opts.apply === true;
    const scenes = await this.activeSceneRows(projectId);
    const strips = await this.prisma.productionStrip.findMany({ where: { projectId, isBanner: false }, select: { id: true, sceneNumber: true, setName: true } });
    const stripByNum = new Map<string, any[]>();
    for (const s of strips as any[]) { const k = this.normScene(s.sceneNumber); if (!k) continue; if (!stripByNum.has(k)) stripByNum.set(k, []); stripByNum.get(k)!.push(s); }
    const sceneNums = new Set((scenes as any[]).map((s) => this.normScene(s.sceneNumber)).filter(Boolean));

    let already = 0; const toLink: { sceneId: string; stripId: string }[] = [];
    const unmatchedScenes: any[] = [], conflicts: any[] = [];
    for (const sc of scenes as any[]) {
      const k = this.normScene(sc.sceneNumber); if (!k) continue;
      const cands = stripByNum.get(k) || [];
      if (cands.length === 0) { unmatchedScenes.push({ sceneNumber: sc.sceneNumber, slugline: sc.slugline }); continue; }
      if (cands.length > 1) { conflicts.push({ sceneNumber: sc.sceneNumber, count: cands.length }); continue; }
      if (sc.productionStripId === cands[0].id) { already++; continue; }
      toLink.push({ sceneId: sc.id, stripId: cands[0].id });
    }
    const orphanStrips = (strips as any[]).filter((s) => { const k = this.normScene(s.sceneNumber); return k && !sceneNums.has(k); }).map((s) => ({ sceneNumber: s.sceneNumber, setName: s.setName }));

    let newlyLinked = 0;
    if (apply && toLink.length) { await this.prisma.$transaction(toLink.map((l) => this.prisma.scriptScene.update({ where: { id: l.sceneId }, data: { productionStripId: l.stripId } }))); newlyLinked = toLink.length; }
    return {
      applied: apply, scenes: scenes.length, strips: strips.length,
      alreadyLinked: already, newlyLinked, linkable: toLink.length,
      unmatchedScenes, orphanStrips, conflicts,
      inSync: toLink.length === 0 && unmatchedScenes.length === 0 && orphanStrips.length === 0 && conflicts.length === 0,
    };
  }

}
