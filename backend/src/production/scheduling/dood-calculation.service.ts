import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CalendarAnchoringService } from './calendar-anchoring.service';
import { buildDoodMatrix } from './dood-calculation.util';

const ON_SET_CODES = new Set(['SW', 'W', 'WF', 'SWF', 'PU']); // H and D never make the call sheet; PU works

/**
 * DoodCalculationService — dynamic Day-Out-of-Days for EVERY breakdown category.
 *
 * Nothing here is stored: the matrix is computed live from the relationship
 * ProductionStrip (scheduled scene, `shootDay`) ⇄ BreakdownElement (person/item,
 * `category`). Move a scene to another day and the next call returns the shifted
 * matrix automatically — no sync step, no stale table.
 *
 * Industry codes per element row:
 *   SW  = Start Work (first scheduled appearance)
 *   W   = Work
 *   WF  = Work Finish (last appearance)
 *   SWF = starts and finishes the same day
 *   H   = Hold (idle day between SW and WF, gap shorter than the drop threshold)
 *   D   = Drop (idle stretch ≥ dropAfter days — production stops paying/holding)
 *   PU  = Pick-up (a work day resuming after a Drop stretch — the actor is recalled)
 */
@Injectable()
export class DoodCalculationService {
  constructor(private prisma: PrismaService, private calendar: CalendarAnchoringService) {}

  /**
   * @param projectId  project
   * @param category   any BreakdownCategory value (CAST, PROPS, VEHICLES, …)
   * @param opts.dropAfter  idle days from which a gap counts as Drop instead of Hold (default 4)
   */
  async generateDoodMatrix(projectId: string, category: string, opts: { dropAfter?: number } = {}) {
    const cat = String(category || '').toUpperCase();

    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { id: true, title: true } });
    if (!project) throw new NotFoundException('Project not found');

    // scheduled strips only (shootDay > 0), chronological
    const strips = await this.prisma.productionStrip.findMany({
      where: { projectId, shootDay: { gt: 0 } },
      orderBy: { shootDay: 'asc' },
      select: { id: true, shootDay: true, sceneNumber: true, cast: true },
    });

    // calendar dates for the day header, when the production schedule has them
    const schedule = await this.prisma.productionSchedule.findMany({
      where: { projectId }, select: { dayNumber: true, date: true },
    });
    const dateByDay = new Map(schedule.map((d) => [d.dayNumber, d.date]));

    const elements = await this.prisma.breakdownElement.findMany({
      where: { projectId, category: cat as any, stripId: { in: strips.map((s) => s.id) } },
      select: { id: true, name: true, quantity: true, stripId: true },
    });

    // the timeline math is pure → dood-calculation.util.ts
    const matrix = buildDoodMatrix({ category, strips, elements, dropAfter: opts.dropAfter, dateByDay });
    return { projectId, ...matrix };
  }

  /** All categories that actually have elements on scheduled strips for this project. */
  async categoriesInUse(projectId: string): Promise<string[]> {
    const cats = await this.prisma.breakdownElement.groupBy({
      by: ['category'],
      where: { projectId, strip: { shootDay: { gt: 0 } } },
    }).catch(() => [] as any[]);
    const out = cats.map((c: any) => String(c.category));
    if (!out.includes('CAST')) out.unshift('CAST'); // legacy strip.cast[] support
    return out;
  }

  /**
   * Aggregate DOOD tallies for ALL categories → ProjectGlobalsStaging.
   * SAFE: writes only to the staging block — nothing touches any budget version
   * until the user explicitly pushes staging to a working copy.
   */
  async refreshGlobalsStaging(projectId: string, opts: { dropAfter?: number } = {}) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throw new BadRequestException('Project not found');

    const categories = await this.categoriesInUse(projectId);
    const tallies: Record<string, { elements: number; workDays: number; holdDays: number }> = {};
    let shootDays = 0;
    for (const cat of categories) {
      const m = await this.generateDoodMatrix(projectId, cat, opts);
      shootDays = Math.max(shootDays, m.totals.shootDays);
      tallies[cat] = { elements: m.totals.elements, workDays: m.totals.workDays, holdDays: m.totals.holdDays };
    }

    const stagingRow = await this.prisma.projectGlobalsStaging.upsert({
      where: { projectId },
      update: { shootDays: shootDays || null, doodTallies: { generatedAt: new Date().toISOString(), categories: tallies } as any, status: 'DRAFT' },
      create: { projectId, shootDays: shootDays || null, doodTallies: { generatedAt: new Date().toISOString(), categories: tallies } as any },
    });
    return { ok: true, shootDays, categories: tallies, stagingId: stagingRow.id, note: 'Staged only — push to a working budget version to apply.' };
  }

  /**
   * Call-sheet data for one calendar date: the day's scenes + ONLY the breakdown
   * elements whose DOOD code for that day is SW / W / WF / SWF. Holds and Drops
   * are filtered out — the call sheet lists what is actually required on set.
   */
  async generateCallSheet(projectId: string, dateStr: string, opts: { dropAfter?: number } = {}) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) throw new BadRequestException('Pass date=YYYY-MM-DD.');
    const shootDay = await this.calendar.shootDayForDate(projectId, dateStr);
    if (!shootDay) throw new BadRequestException('No shoot day maps to that date — it is before the shoot start, a day off, or after the shoot wraps.');

    // scenes scheduled on that day
    const strips = await this.prisma.productionStrip.findMany({
      where: { projectId, shootDay },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, sceneNumber: true, setName: true, location: true, description: true, intExt: true, dayNight: true, pages: true, cast: true },
    });

    // dynamic DOOD per category, filtered to on-set codes for this exact day
    const categories = await this.categoriesInUse(projectId);
    const requirements: Record<string, { name: string; quantity: number; code: string }[]> = {};
    for (const cat of categories) {
      const m = await this.generateDoodMatrix(projectId, cat, opts);
      const onSet = m.rows
        .map((r) => ({ name: r.name, quantity: r.quantity, code: r.cells[shootDay] || '' }))
        .filter((r) => ON_SET_CODES.has(r.code)); // strictly excludes H and D
      if (onSet.length) requirements[cat] = onSet;
    }

    return {
      projectId,
      date: dateStr,
      shootDay,
      scenes: strips.map((s) => ({
        id: s.id, sceneNumber: s.sceneNumber, setName: s.setName, location: s.location,
        description: s.description, intExt: s.intExt, dayNight: s.dayNight, pages: Number(s.pages),
      })),
      requirements, // { CAST: [{name, quantity, code}], VEHICLES: [...], … } — H/D filtered out
      totals: Object.fromEntries(Object.entries(requirements).map(([c, list]) => [c, list.length])),
    };
  }
}
