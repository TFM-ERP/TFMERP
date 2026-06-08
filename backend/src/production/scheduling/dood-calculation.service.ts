import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CalendarAnchoringService } from './calendar-anchoring.service';

const ON_SET_CODES = new Set(['SW', 'W', 'WF', 'SWF']); // H and D never make the call sheet

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
    const dropAfter = Math.max(2, Number(opts.dropAfter) || 4);
    const cat = String(category || '').toUpperCase();

    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { id: true, title: true } });
    if (!project) throw new NotFoundException('Project not found');

    // scheduled strips only (shootDay > 0), chronological
    const strips = await this.prisma.productionStrip.findMany({
      where: { projectId, shootDay: { gt: 0 } },
      orderBy: { shootDay: 'asc' },
      select: { id: true, shootDay: true, sceneNumber: true, cast: true },
    });
    const days = [...new Set(strips.map((s) => s.shootDay))].sort((a, b) => a - b);

    // calendar dates for the day header, when the production schedule has them
    const schedule = await this.prisma.productionSchedule.findMany({
      where: { projectId }, select: { dayNumber: true, date: true },
    });
    const dateByDay = new Map(schedule.map((d) => [d.dayNumber, d.date]));

    // element name → set of working days (merged across strips by normalised name)
    const stripDay = new Map(strips.map((s) => [s.id, s.shootDay]));
    const rowsByKey = new Map<string, { name: string; quantity: number; days: Set<number>; elementIds: string[] }>();
    const addAppearance = (name: string, day: number | undefined, quantity = 1, elementId?: string) => {
      const label = (name || '').trim();
      if (!label || !day) return;
      const key = label.toLowerCase();
      const row = rowsByKey.get(key) || { name: label, quantity: 0, days: new Set<number>(), elementIds: [] };
      row.days.add(day);
      row.quantity = Math.max(row.quantity, quantity);
      if (elementId) row.elementIds.push(elementId);
      rowsByKey.set(key, row);
    };

    const elements = await this.prisma.breakdownElement.findMany({
      where: { projectId, category: cat as any, stripId: { in: strips.map((s) => s.id) } },
      select: { id: true, name: true, quantity: true, stripId: true },
    });
    for (const el of elements) addAppearance(el.name, stripDay.get(el.stripId), el.quantity, el.id);

    // CAST: strips also carry a legacy cast[] JSON list — merge it so older
    // projects without CAST breakdown elements still get a full cast DOOD.
    if (cat === 'CAST') {
      for (const s of strips) {
        const cast: string[] = Array.isArray(s.cast) ? (s.cast as any) : [];
        for (const name of cast) addAppearance(name, s.shootDay);
      }
    }

    // ── the algorithmic timeline per row ─────────────────────────────────────────
    const rows = [...rowsByKey.values()].map((r) => {
      const work = [...r.days].sort((a, b) => a - b);
      const start = work[0];
      const finish = work[work.length - 1];
      const cells: Record<number, string> = {};
      let holdDays = 0, dropDays = 0;

      // pre-compute gap lengths between consecutive work days (in scheduled-day steps)
      for (const d of days) {
        if (d < start || d > finish) { cells[d] = ''; continue; }
        if (r.days.has(d)) {
          if (d === start && d === finish) cells[d] = 'SWF';
          else if (d === start) cells[d] = 'SW';
          else if (d === finish) cells[d] = 'WF';
          else cells[d] = 'W';
          continue;
        }
        // idle day inside the engagement: Hold or Drop depending on the gap length
        const prevWork = work.filter((w) => w < d).pop()!;
        const nextWork = work.find((w) => w > d)!;
        const gapLen = days.filter((x) => x > prevWork && x < nextWork).length;
        if (gapLen >= dropAfter) { cells[d] = 'D'; dropDays++; }
        else { cells[d] = 'H'; holdDays++; }
      }

      return {
        name: r.name,
        quantity: r.quantity,
        elementIds: r.elementIds,
        start, finish,
        cells,
        totalWorkDays: work.length,
        totalHoldDays: holdDays,
        totalDropDays: dropDays,
      };
    }).sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));

    return {
      projectId,
      category: cat,
      dropAfter,
      days: days.map((d) => ({ day: d, date: dateByDay.get(d) || null })),
      rows,
      totals: {
        elements: rows.length,
        workDays: rows.reduce((t, r) => t + r.totalWorkDays, 0),
        holdDays: rows.reduce((t, r) => t + r.totalHoldDays, 0),
        shootDays: days.length,
      },
    };
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
    if (!shootDay) throw new BadRequestException('Date is before the anchored shoot start — no shoot day maps to it.');

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
