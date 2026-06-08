import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type CalendarPhase = 'PREP' | 'SHOOT' | 'WRAP' | 'STRIKE';
export interface CalendarDay {
  date: string; // YYYY-MM-DD
  phase: CalendarPhase;
  shootDay: number | null; // 1..N during SHOOT, null otherwise
  sceneCount: number;
  strips: { id: string; sceneNumber: string | null; setName: string | null }[];
}

/**
 * CalendarAnchoringService — maps the abstract schedule (strip shootDay numbers)
 * onto real calendar dates, rippling out from the project's locked anchor
 * (ProductionProject.shootStartDate = Day 1 of Principal Photography).
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

  private iso(d: Date): string { return d.toISOString().slice(0, 10); }
  private addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

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

    // scheduled strips, chronological
    const strips = await this.prisma.productionStrip.findMany({
      where: { projectId },
      orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, shootDay: true, sceneNumber: true, setName: true },
    });
    const scheduled = strips.filter((s) => s.shootDay > 0);
    const byDay = new Map<number, typeof scheduled>();
    for (const s of scheduled) byDay.set(s.shootDay, [...(byDay.get(s.shootDay) || []), s]);

    // shoot length: globals say one thing, the board may say more — honour the board
    const maxBoardDay = Math.max(0, ...scheduled.map((s) => s.shootDay));
    const shootLen = Math.max(lengths.shoot, maxBoardDay);

    const days: CalendarDay[] = [];
    const anchorDate = new Date(anchor);

    // PREP — counts back from the day before Day 1
    for (let i = lengths.prep; i >= 1; i--) {
      days.push({ date: this.iso(this.addDays(anchorDate, -i)), phase: 'PREP', shootDay: null, sceneCount: 0, strips: [] });
    }
    // SHOOT — Day N = anchor + (N − 1)
    for (let n = 1; n <= shootLen; n++) {
      const dayStrips = byDay.get(n) || [];
      days.push({
        date: this.iso(this.addDays(anchorDate, n - 1)),
        phase: 'SHOOT', shootDay: n,
        sceneCount: dayStrips.length,
        strips: dayStrips.map((s) => ({ id: s.id, sceneNumber: s.sceneNumber, setName: s.setName })),
      });
    }
    // WRAP then STRIKE — ripple on after the last shoot day
    let cursor = shootLen;
    for (let i = 1; i <= lengths.wrap; i++) {
      days.push({ date: this.iso(this.addDays(anchorDate, cursor + i - 1)), phase: 'WRAP', shootDay: null, sceneCount: 0, strips: [] });
    }
    cursor += lengths.wrap;
    for (let i = 1; i <= lengths.strike; i++) {
      days.push({ date: this.iso(this.addDays(anchorDate, cursor + i - 1)), phase: 'STRIKE', shootDay: null, sceneCount: 0, strips: [] });
    }

    return {
      anchor: this.iso(anchorDate),
      phases: { ...lengths, shootEffective: shootLen },
      days,
      unscheduledScenes: strips.length - scheduled.length,
    };
  }

  /** Which shoot day (1..N) falls on a calendar date — null if outside the shoot window. */
  async shootDayForDate(projectId: string, dateStr: string): Promise<number | null> {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { shootStartDate: true, startDate: true } });
    const anchor = project?.shootStartDate || project?.startDate;
    if (!anchor) return null;
    const a = new Date(this.iso(new Date(anchor)));
    const d = new Date(dateStr);
    const diff = Math.round((d.getTime() - a.getTime()) / 86400000);
    return diff >= 0 ? diff + 1 : null;
  }
}
