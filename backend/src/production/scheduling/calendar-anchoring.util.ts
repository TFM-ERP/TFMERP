/**
 * Pure calendar-anchoring core (no Nest/Prisma imports, so unit-testable).
 * CalendarAnchoringService fetches the project, phase lengths, work-week config and strips,
 * then delegates the date math here: ripple Prep → Shoot → Wrap → Strike out from the locked
 * anchor (Day 1 of Principal Photography), mapping each abstract shoot-day number onto the
 * Nth working calendar day and turning weekends/holidays into labelled day-off rows.
 */

export type CalendarPhase = 'PREP' | 'SHOOT' | 'WRAP' | 'STRIKE';

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  phase: CalendarPhase;
  shootDay: number | null; // 1..N during SHOOT, null otherwise
  sceneCount: number;
  strips: { id: string; sceneNumber: string | null; setName: string | null }[];
  dayOff?: boolean;
  label?: string;
}

export interface StripLite {
  id: string;
  shootDay: number;
  sceneNumber: string | null;
  setName: string | null;
}

export interface PhaseLengths {
  prep: number;
  shoot: number;
  wrap: number;
  strike: number;
  source?: string;
}

export interface BuildCalendarInput {
  anchor: Date | string;
  lengths: PhaseLengths;
  weekendDays: number[];
  holidays: Set<string> | string[];
  strips: StripLite[];
}

export interface ProjectCalendar {
  anchor: string;
  phases: any;
  days: CalendarDay[];
  unscheduledScenes: number;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export function isWorkingDay(d: Date, weekendDays: number[], holidays: Set<string>): boolean {
  // Weekday and holiday are both decided by the UTC calendar date, so the result is
  // independent of the host timezone (isoDate is already UTC). Avoids an off-by-one
  // on negative-UTC-offset hosts where local getDay() lags the UTC date.
  return !weekendDays.includes(d.getUTCDay()) && !holidays.has(isoDate(d));
}

/** Full production calendar: Prep → Shoot (strips mapped to dates) → Wrap → Strike. */
export function buildProjectCalendar(input: BuildCalendarInput): ProjectCalendar {
  const { lengths } = input;
  const weekendDays = input.weekendDays;
  const holidays = input.holidays instanceof Set ? input.holidays : new Set(input.holidays);
  const working = (d: Date) => isWorkingDay(d, weekendDays, holidays);
  const offLabel = (d: Date) => (holidays.has(isoDate(d)) ? 'Holiday' : 'Day off');

  const strips = input.strips;
  const scheduled = strips.filter((s) => s.shootDay > 0);
  const byDay = new Map<number, StripLite[]>();
  for (const s of scheduled) byDay.set(s.shootDay, [...(byDay.get(s.shootDay) || []), s]);
  const maxBoardDay = Math.max(0, ...scheduled.map((s) => s.shootDay));
  const shootLen = Math.max(lengths.shoot, maxBoardDay);

  const anchorDate = new Date(isoDate(new Date(input.anchor)));
  const prepRows: CalendarDay[] = [], shootRows: CalendarDay[] = [], tailRows: CalendarDay[] = [];

  // Loop bound that scales with the actual work-week instead of a fixed heuristic:
  // with W working days per week we may step ~7 calendar days per working day, and each
  // holiday can cost up to a further week, plus slack. If no weekday is ever working the
  // calendar is empty (and we never spin).
  const offDays = new Set((weekendDays || []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  const hasWorkdays = offDays.size < 7;
  const span = (needed: number) => needed * 7 + holidays.size * 7 + 30;

  // SHOOT — Day N = the Nth WORKING day from the anchor; weekends/holidays become day-off rows.
  let cur = new Date(anchorDate), placed = 0, guard = 0; let lastShoot = new Date(anchorDate);
  while (hasWorkdays && placed < shootLen && guard++ < span(shootLen)) {
    if (working(cur)) {
      placed++;
      const ds = byDay.get(placed) || [];
      shootRows.push({ date: isoDate(cur), phase: 'SHOOT', shootDay: placed, sceneCount: ds.length, strips: ds.map((s) => ({ id: s.id, sceneNumber: s.sceneNumber, setName: s.setName })) });
      lastShoot = new Date(cur);
    } else {
      shootRows.push({ date: isoDate(cur), phase: 'SHOOT', shootDay: null, sceneCount: 0, strips: [], dayOff: true, label: offLabel(cur) });
    }
    if (placed < shootLen) cur = addDays(cur, 1);
  }
  // PREP — count back N working days from the day before the anchor.
  let pc = addDays(anchorDate, -1), p = lengths.prep, pg = 0;
  while (hasWorkdays && p > 0 && pg++ < span(lengths.prep)) { if (working(pc)) { prepRows.push({ date: isoDate(pc), phase: 'PREP', shootDay: null, sceneCount: 0, strips: [] }); p--; } pc = addDays(pc, -1); }
  prepRows.reverse();
  // WRAP then STRIKE — working days after the last shoot day.
  let wc = addDays(lastShoot, 1);
  const tailFill = (n: number, phase: CalendarPhase) => { let k = n, g = 0; while (hasWorkdays && k > 0 && g++ < span(n)) { if (working(wc)) { tailRows.push({ date: isoDate(wc), phase, shootDay: null, sceneCount: 0, strips: [] }); k--; } wc = addDays(wc, 1); } };
  tailFill(lengths.wrap, 'WRAP'); tailFill(lengths.strike, 'STRIKE');

  return {
    anchor: isoDate(anchorDate),
    phases: { ...lengths, shootEffective: shootLen, weekendDays, holidays: Array.from(holidays) },
    days: [...prepRows, ...shootRows, ...tailRows],
    unscheduledScenes: strips.length - scheduled.length,
  };
}

export interface ShootDayForDateInput {
  anchor: Date | string | null | undefined;
  weekendDays: number[];
  holidays: Set<string> | string[];
  date: string;
  /** Effective shoot length (max of planned shoot days and highest board day). When given,
   *  dates past the window (wrap/strike and beyond) return null instead of a bogus number. */
  shootLen?: number | null;
}

/**
 * Which shoot day (1..N) falls on a calendar date — null if before the anchor, on a day off,
 * or (when shootLen is supplied) past the end of the shoot window.
 */
export function shootDayForDate(input: ShootDayForDateInput): number | null {
  if (!input.anchor) return null;
  const weekendDays = input.weekendDays;
  const holidays = input.holidays instanceof Set ? input.holidays : new Set(input.holidays);
  const shootLen = input.shootLen ?? null;
  const working = (d: Date) => isWorkingDay(d, weekendDays, holidays);
  const target = isoDate(new Date(input.date));
  let c = new Date(isoDate(new Date(input.anchor))), n = 0, guard = 0;
  while (guard++ < 4000) {
    const iso = isoDate(c);
    if (working(c)) n++;
    if (iso === target) return working(c) && (shootLen == null || n <= shootLen) ? n : null;
    if (iso > target) return null;
    c = addDays(c, 1);
  }
  return null;
}
