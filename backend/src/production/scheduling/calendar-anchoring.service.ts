import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildProjectCalendar, shootDayForDate, type CalendarDay, type CalendarPhase } from './calendar-anchoring.util';

export type { CalendarDay, CalendarPhase };

/**
 * CalendarAnchoringService — maps the abstract schedule (strip shootDay numbers)
 * onto real calendar dates, rippling out from the project's locked anchor
 * (ProductionProject.shootStartDate = Day 1 of Principal Photography).
 *
 * Data access lives here; the pure date math lives in calendar-anchoring.util.ts.
 *
 * Phase lengths are NEVER hardcoded: Prep/Shoot/Wrap day counts come from the
 * Production Globals staging block (ProjectGlobalsStaging), falling back to the
 * active budget version's globals when staging is empty.
 */
@Injectable()
export class CalendarAnchoringService {
  constructor(private prisma: PrismaService) {}

  /** Phase lengths from staging first, then active budget globals. No hardcoding. */
  private async phaseLengths(projectId: string): Promise<{ prep: number; shoot: number; wrap: number; strike: number; source: string }> {
    const staging = await this.prisma.projectGlobalsStaging.findUnique({ where: { projectId } });
    if (staging && (staging.prepDays || staging.shootDays || staging.wrapDays)) {
      return { prep: staging.prepDays || 0, shoot: staging.shootDays || 0, wrap: staging.wrapDays || 0, strike: 0, source: 'globals-staging' };
    }
    const version = await this.prisma.budgetVersion.findFirst({ where: { projectId, isActive: true }, include: { globals: true } });
    const g = (key: string) => Number(version?.globals.find((x) => x.key === key)?.value) || 0;
    return { prep: g('prep_days'), shoot: g('shoot_days'), wrap: g('wrap_days'), strike: g('strike_days'), source: version ? `budget globals (${version.versionName})` : 'none' };
  }

  /**
   * Full production calendar: Prep → Shoot (strips mapped to dates) → Wrap → Strike.
   * Day 1 of SHOOT = ProductionProject.shootStartDate.
   */
  async projectCalendar(projectId: string): Promise<{ anchor: string; phases: any; days: CalendarDay[]; unscheduledScenes: number }> {
    const project = await this.prisma.productionProject.findUnique({
      where: { id: projectId },
      select: { shootStartDate: true, startDate: true, title: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    const anchor = project.shootStartDate || project.startDate;
    if (!anchor) throw new BadRequestException('No shoot start date anchored yet — set the project shoot start date (it is fixed automatically when a budget is LOCKED).');

    const lengths = await this.phaseLengths(projectId);
    const { weekendDays, holidays } = await this.getConfigRaw(projectId);
    const strips = await this.prisma.productionStrip.findMany({
      where: { projectId }, orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, shootDay: true, sceneNumber: true, setName: true },
    });

    return buildProjectCalendar({ anchor, lengths, weekendDays, holidays, strips });
  }

  /** Schedule config (work-week + holidays). Tolerant pre-db:push (column may not exist yet). */
  private async getConfigRaw(projectId: string): Promise<{ weekendDays: number[]; holidays: Set<string> }> {
    let cfg: any = {};
    try { const pr: any = await (this.prisma as any).productionProject.findUnique({ where: { id: projectId } }); cfg = pr?.scheduleConfig || {}; } catch { /* pre-migration */ }
    return { weekendDays: Array.isArray(cfg.weekendDays) ? cfg.weekendDays.map(Number) : [], holidays: new Set(Array.isArray(cfg.holidays) ? cfg.holidays : []) };
  }
  async getConfig(projectId: string) { const c = await this.getConfigRaw(projectId); return { weekendDays: c.weekendDays, holidays: Array.from(c.holidays) }; }
  async setConfig(projectId: string, cfg: any) {
    const data: any = { scheduleConfig: { weekendDays: Array.isArray(cfg?.weekendDays) ? cfg.weekendDays.map(Number) : [], holidays: Array.isArray(cfg?.holidays) ? cfg.holidays.filter(Boolean) : [] } };
    await (this.prisma as any).productionProject.update({ where: { id: projectId }, data });
    return this.getConfig(projectId);
  }

  /** Which shoot day (1..N) falls on a calendar date — null if outside the shoot window. */
  async shootDayForDate(projectId: string, dateStr: string): Promise<number | null> {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { shootStartDate: true, startDate: true } });
    const anchor = project?.shootStartDate || project?.startDate;
    const { weekendDays, holidays } = await this.getConfigRaw(projectId);
    // Bound by the effective shoot window (same as projectCalendar) so wrap/strike dates map to no shoot day.
    const lengths = await this.phaseLengths(projectId);
    const maxBoard = await this.prisma.productionStrip.aggregate({ where: { projectId }, _max: { shootDay: true } });
    const shootLen = Math.max(lengths.shoot, maxBoard._max.shootDay || 0);
    return shootDayForDate({ anchor, weekendDays, holidays, date: dateStr, shootLen });
  }
}
