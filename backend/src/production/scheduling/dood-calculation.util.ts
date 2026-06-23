/**
 * Pure Day-Out-of-Days core (no Nest/Prisma imports, so unit-testable).
 * DoodCalculationService fetches the scheduled strips, breakdown elements and the
 * schedule's day→date map; the timeline math lives here. Nothing is stored — the
 * matrix is derived live from ProductionStrip (scene, shootDay) ⇄ BreakdownElement
 * (person/item, category).
 *
 * Industry codes per row:
 *   SW = Start Work · W = Work · WF = Work Finish · SWF = start+finish same day
 *   H  = Hold (idle gap shorter than the drop threshold)
 *   D  = Drop (idle stretch ≥ dropAfter days)
 *   PU = Pick-up (a work day resuming after a Drop stretch)
 */

export interface DoodStrip {
  id: string;
  shootDay: number;
  cast?: any; // legacy strip.cast[] is stored as JSON; guarded with Array.isArray below
}

export interface DoodElement {
  id: string;
  name: string;
  quantity?: number | null;
  stripId: string;
}

export interface DoodRow {
  name: string;
  quantity: number;
  elementIds: string[];
  start: number;
  finish: number;
  cells: Record<number, string>;
  totalWorkDays: number;
  totalHoldDays: number;
  totalDropDays: number;
  totalPickupDays: number;
}

export interface BuildDoodInput {
  category: string;
  strips: DoodStrip[];
  elements: DoodElement[];
  dropAfter?: number;
  /** day number → calendar date, for the column header. Optional (date is null when absent). */
  dateByDay?: Map<number, any> | null;
}

export interface DoodMatrix {
  category: string;
  dropAfter: number;
  days: { day: number; date: any }[];
  rows: DoodRow[];
  totals: { elements: number; workDays: number; holdDays: number; pickupDays: number; shootDays: number };
}

/** Build the live DOOD matrix for one breakdown category. */
export function buildDoodMatrix(input: BuildDoodInput): DoodMatrix {
  const dropAfter = Math.max(2, Number(input.dropAfter) || 4);
  const cat = String(input.category || '').toUpperCase();
  const strips = input.strips || [];
  const dateByDay = input.dateByDay || null;

  // scheduled strips only (shootDay > 0), chronological
  const scheduled = strips.filter((s) => s.shootDay > 0).sort((a, b) => a.shootDay - b.shootDay);
  const days = [...new Set(scheduled.map((s) => s.shootDay))].sort((a, b) => a - b);

  // element name → set of working days (merged across strips by normalised name)
  const stripDay = new Map(scheduled.map((s) => [s.id, s.shootDay]));
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

  for (const el of input.elements || []) addAppearance(el.name, stripDay.get(el.stripId), el.quantity as any, el.id);

  // CAST: strips also carry a legacy cast[] JSON list — merge it so older
  // projects without CAST breakdown elements still get a full cast DOOD.
  if (cat === 'CAST') {
    for (const s of scheduled) {
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
    let holdDays = 0, dropDays = 0, pickupDays = 0;

    for (const d of days) {
      if (d < start || d > finish) { cells[d] = ''; continue; }
      if (r.days.has(d)) {
        const prevW = work.filter((w) => w < d).pop();
        const gapBefore = prevW != null ? days.filter((x) => x > prevW && x < d).length : 0;
        const pickedUp = gapBefore >= dropAfter; // resumes after a Drop stretch
        if (d === start && d === finish) cells[d] = 'SWF';
        else if (d === start) cells[d] = 'SW';
        else if (d === finish) cells[d] = 'WF';
        else if (pickedUp) { cells[d] = 'PU'; pickupDays++; }
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
      totalPickupDays: pickupDays,
    };
  }).sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));

  return {
    category: cat,
    dropAfter,
    days: days.map((d) => ({ day: d, date: (dateByDay && dateByDay.get(d)) || null })),
    rows,
    totals: {
      elements: rows.length,
      workDays: rows.reduce((t, r) => t + r.totalWorkDays, 0),
      holdDays: rows.reduce((t, r) => t + r.totalHoldDays, 0),
      pickupDays: rows.reduce((t, r) => t + (r.totalPickupDays || 0), 0),
      shootDays: days.length,
    },
  };
}
