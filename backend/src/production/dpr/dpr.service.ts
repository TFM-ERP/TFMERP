import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** SYS-FIN — Daily Production Report (DPR) + hot costs. Daily companion to the call sheet:
 *  scenes/pages shot, times, cast meal penalties, incidents, and the day's raw "hot cost".
 *  Seeds a DRAFT from the day's call sheet. (prisma cast to any so it compiles before db:push.) */
const n = (v: any) => Number(v) || 0;
function pagesToNum(s: any): number {
  if (!s) return 0; let t = 0;
  for (const part of String(s).split(/\s+/)) {
    if (part.includes('/')) { const [a, b] = part.split('/').map(Number); if (b) t += a / b; }
    else { const v = Number(part); if (!isNaN(v)) t += v; }
  }
  return Math.round(t * 100) / 100;
}

@Injectable()
export class DprService {
  constructor(private prisma: PrismaService) {}
  private d() { return (this.prisma as any).dailyProductionReport; }

  list(projectId: string) { return this.d().findMany({ where: { projectId }, orderBy: [{ reportDate: 'desc' }, { dayNumber: 'desc' }] }); }
  get(id: string) { return this.d().findUnique({ where: { id } }); }
  create(data: any, userId?: string) { return this.d().create({ data: this.clean(data, userId) }); }
  async update(id: string, data: any) {
    const { id: _i, projectId, createdAt, updatedAt, ...rest } = data || {};
    if (rest.reportDate) rest.reportDate = new Date(rest.reportDate);
    return this.d().update({ where: { id }, data: rest });
  }
  setStatus(id: string, status: string) { return this.d().update({ where: { id }, data: { status } }); }
  remove(id: string) { return this.d().delete({ where: { id } }); }

  private clean(data: any, userId?: string) {
    return {
      projectId: data.projectId, callSheetId: data.callSheetId || null, dayNumber: data.dayNumber ?? 1,
      reportDate: data.reportDate ? new Date(data.reportDate) : new Date(), unitName: data.unitName || null, status: 'DRAFT',
      crewCall: data.crewCall || null, firstShot: data.firstShot || null, lunchOut: data.lunchOut || null, lunchIn: data.lunchIn || null, lastShot: data.lastShot || null, unitWrap: data.unitWrap || null,
      scenesScheduled: data.scenesScheduled ?? null, scenesShot: data.scenesShot ?? null, pagesScheduled: data.pagesScheduled ?? null, pagesShot: data.pagesShot ?? null,
      setupsPlanned: data.setupsPlanned ?? null, setupsActual: data.setupsActual ?? null, scheduleDayVariance: data.scheduleDayVariance ?? null,
      weather: data.weather || null, locationName: data.locationName || null,
      scenesCompleted: data.scenesCompleted || [], castDays: data.castDays || [], incidents: data.incidents || [], hotCosts: data.hotCosts || [],
      otHours: data.otHours ?? null, mealPenalties: data.mealPenalties ?? null, estimatedDayCost: data.estimatedDayCost ?? null,
      notes: data.notes || null, preparedBy: data.preparedBy || null, createdById: userId || null,
    };
  }

  /** Seed a DRAFT DPR from the day's call sheet — scheduled scenes/pages, cast, times, weather. */
  async generateFromCallSheet(callSheetId: string, userId?: string) {
    const cs = await this.prisma.callSheet.findUnique({ where: { id: callSheetId } });
    if (!cs) throw new NotFoundException('Call sheet not found');
    const sched: any[] = Array.isArray(cs.scheduleItems) ? (cs.scheduleItems as any[]) : [];
    const pagesScheduled = Math.round(sched.reduce((t, r) => t + pagesToNum(r.pages), 0) * 100) / 100;
    const cast: any[] = Array.isArray(cs.castCalls) ? (cs.castCalls as any[]) : [];
    const castDays = cast.map((c: any) => ({ cast: c.cast || c.name, character: c.character || '', status: c.status || 'W', callTime: c.callTime || c.pickup || '', wrap: '', mealPenalty: 0 }));
    return this.d().create({ data: {
      projectId: cs.projectId, callSheetId: cs.id, dayNumber: cs.dayNumber || 1, reportDate: cs.shootDate, status: 'DRAFT',
      crewCall: cs.generalCall || null, firstShot: cs.shootingCall || null, unitWrap: cs.estWrap || null,
      weather: cs.weather || null, locationName: cs.locationName || null,
      scenesScheduled: sched.length, pagesScheduled,
      scenesCompleted: sched.map((r: any) => ({ scene: r.scene, pages: r.pages, status: '' })),
      castDays, incidents: [], hotCosts: [], createdById: userId || null,
    } });
  }

  /** Hot-cost roll-up across the project's DPRs (daily + cumulative). */
  async hotCosts(projectId: string) {
    const dprs = await this.d().findMany({ where: { projectId }, orderBy: { reportDate: 'asc' } });
    let cum = 0;
    const days = dprs.map((d: any) => {
      const hot = (Array.isArray(d.hotCosts) ? d.hotCosts : []).reduce((t: number, h: any) => t + n(h.amount), 0);
      const day = n(d.estimatedDayCost) || hot; cum += day;
      return { dayNumber: d.dayNumber, reportDate: d.reportDate, otHours: n(d.otHours), mealPenalties: d.mealPenalties || 0, hot, estimatedDayCost: day, cumulative: cum, scenesShot: n(d.scenesShot), pagesShot: n(d.pagesShot) };
    });
    return { days, totals: { count: days.length, hot: days.reduce((t: number, d: any) => t + d.hot, 0), estimated: cum, mealPenalties: days.reduce((t: number, d: any) => t + d.mealPenalties, 0), otHours: days.reduce((t: number, d: any) => t + d.otHours, 0) } };
  }
}
