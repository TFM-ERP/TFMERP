/**
 * Pure shooting-order optimizer core (no Nest/Prisma imports, so unit-testable).
 * SchedulingService fetches the strips and persists the result; the planning math lives here:
 * shoot a location out before moving, keep each cast member contiguous, cluster DAY/NIGHT,
 * never move locked/banner days. Returns the proposed plan + before/after metrics + rationale.
 */
export function planShootingOrder(all: any[], opts: { pagesPerDay?: number; respectLocks?: boolean; groupByDayNight?: boolean } = {}) {
  const pagesPerDay = Number(opts.pagesPerDay) || 5;
  const respectLocks = opts.respectLocks !== false;
  const groupDN = opts.groupByDayNight !== false;
    const strips = all.filter((s: any) => !s.isBanner);
    const banners = all.filter((s: any) => s.isBanner);
    if (!strips.length) return { ok: false, message: 'No scenes to optimise.' };

    // Days that must stay exactly as-is: any day holding a locked strip or a banner/day-break.
    const pinnedDays = new Set<number>();
    if (respectLocks) for (const s of strips as any[]) if (s.isLocked && s.shootDay > 0) pinnedDays.add(s.shootDay);
    for (const b of banners as any[]) if (b.shootDay > 0) pinnedDays.add(b.shootDay);

    const pinned = strips.filter((s: any) => pinnedDays.has(s.shootDay));
    const pool = strips.filter((s: any) => !pinnedDays.has(s.shootDay));

    const locKey = (s: any) => String(s.locationId || s.location || s.setName || '—');
    const locName = (s: any) => String(s.location || s.setName || s.locationId || 'Location');
    const sceneNo = (s: any) => parseInt(String(s.sceneNumber || '').replace(/\D/g, '')) || 0;
    const castOf = (s: any) => ((Array.isArray(s.cast) ? s.cast : []) as string[]).filter(Boolean);

    // group the pool into location blocks; order each block DAY-then-NIGHT, by scene #
    const blockMap = new Map<string, any[]>();
    for (const s of pool) { const k = locKey(s); if (!blockMap.has(k)) blockMap.set(k, []); blockMap.get(k)!.push(s); }
    const blocks = [...blockMap.entries()].map(([key, list]) => {
      const ordered = [...list].sort((a, b) => {
        if (groupDN) { const da = a.dayNight === 'NIGHT' ? 1 : 0, db = b.dayNight === 'NIGHT' ? 1 : 0; if (da !== db) return da - db; }
        return sceneNo(a) - sceneNo(b);
      });
      const cast = new Set<string>(); for (const s of list) for (const c of castOf(s)) cast.add(c);
      const pages = list.reduce((t, s: any) => t + Number(s.pages || 0), 0);
      return { key, name: locName(list[0]), strips: ordered, cast, pages };
    });

    // greedy: chain blocks by shared cast so actors work consecutively (minimise hold days)
    const remaining = [...blocks].sort((a, b) => (b.cast.size - a.cast.size) || (b.pages - a.pages));
    const seq: any[] = [];
    let active = new Set<string>();
    while (remaining.length) {
      let bestI = 0, bestScore = -1;
      for (let i = 0; i < remaining.length; i++) {
        const blk = remaining[i];
        let overlap = 0; for (const c of blk.cast) if (active.has(c)) overlap++;
        const score = overlap * 1000 + blk.cast.size + blk.pages / 100;
        if (score > bestScore) { bestScore = score; bestI = i; }
      }
      const next = remaining.splice(bestI, 1)[0];
      seq.push(next);
      active = new Set<string>([...next.cast]); // recency window = the block we just placed
    }

    // assign pool strips to day numbers, skipping pinned days (locked/banner days kept in place)
    let day = 1; while (pinnedDays.has(day)) day++;
    let dayPages = 0, order = 0;
    const plan: any[] = [];
    const advanceDay = () => { day++; while (pinnedDays.has(day)) day++; dayPages = 0; order = 0; };
    for (let bi = 0; bi < seq.length; bi++) {
      const blk = seq[bi];
      if (bi > 0) advanceDay(); // each new location block starts a new day (a company move)
      for (const s of blk.strips) {
        const p = Number(s.pages || 0);
        if (dayPages > 0 && dayPages + p > pagesPerDay + 0.001) advanceDay();
        plan.push({ id: s.id, shootDay: day, sortOrder: order++, sceneNumber: s.sceneNumber, location: blk.name, dayNight: s.dayNight, pages: p, cast: castOf(s) });
        dayPages += p;
      }
    }
    // pinned strips keep their day/order (echoed for the metrics + a complete plan view)
    for (const s of pinned as any[]) plan.push({ id: s.id, shootDay: s.shootDay, sortOrder: s.sortOrder, sceneNumber: s.sceneNumber, location: locName(s), dayNight: s.dayNight, pages: Number(s.pages || 0), cast: castOf(s), pinned: true });

    // metrics — company moves, multi-location days, cast hold days, day/night switches
    const metric = (rows: any[]) => {
      const days = [...new Set(rows.map(r => r.shootDay))].filter(d => d > 0).sort((a, b) => a - b);
      const byDay = new Map<number, any[]>();
      for (const r of rows) { if (r.shootDay > 0) { if (!byDay.has(r.shootDay)) byDay.set(r.shootDay, []); byDay.get(r.shootDay)!.push(r); } }
      let moves = 0, dnSwitch = 0, multiLocDays = 0; let prevLoc: string | null = null;
      for (const d of days) {
        const list = (byDay.get(d) || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
        const locs = [...new Set(list.map(r => r.location))];
        if (locs.length > 1) multiLocDays++;
        const dayPrimary = locs.length ? locs[0] : null;
        if (prevLoc !== null && dayPrimary !== prevLoc) moves++;
        prevLoc = dayPrimary;
        for (let i = 1; i < list.length; i++) if (list[i].dayNight !== list[i - 1].dayNight) dnSwitch++;
      }
      const castDays = new Map<string, Set<number>>();
      for (const r of rows) for (const c of (r.cast || [])) { if (!c || r.shootDay <= 0) continue; if (!castDays.has(c)) castDays.set(c, new Set<number>()); castDays.get(c)!.add(r.shootDay); }
      const dayIndex = new Map<number, number>(); days.forEach((d, i) => dayIndex.set(d, i));
      let hold = 0;
      for (const set of castDays.values()) {
        const ws = [...set].sort((a, b) => a - b); if (ws.length < 2) continue;
        const span = (dayIndex.get(ws[ws.length - 1])! - dayIndex.get(ws[0])!) + 1;
        hold += span - ws.length;
      }
      return { shootDays: days.length, companyMoves: moves, multiLocationDays: multiLocDays, castHoldDays: hold, dayNightSwitches: dnSwitch };
    };

    const beforeRows = (strips as any[]).map(s => ({ shootDay: s.shootDay, sortOrder: s.sortOrder, location: locName(s), dayNight: s.dayNight, cast: castOf(s) }));
    const afterRows = plan.map((p: any) => ({ shootDay: p.shootDay, sortOrder: p.sortOrder, location: p.location, dayNight: p.dayNight, cast: p.cast || [] }));
    const before = metric(beforeRows); const after = metric(afterRows);

    const rationale: string[] = [];
    rationale.push(`Grouped ${pool.length} scene${pool.length === 1 ? '' : 's'} into ${blocks.length} location block${blocks.length === 1 ? '' : 's'}, sequenced to keep cast working consecutively.`);
    const dMoves = before.companyMoves - after.companyMoves;
    rationale.push(dMoves > 0 ? `Company moves ${before.companyMoves} → ${after.companyMoves} (−${dMoves} fewer).` : `Company moves ${before.companyMoves} → ${after.companyMoves}.`);
    const dHold = before.castHoldDays - after.castHoldDays;
    rationale.push(dHold > 0 ? `Cast hold/idle days ${before.castHoldDays} → ${after.castHoldDays} (−${dHold} paid days saved).` : `Cast hold/idle days ${before.castHoldDays} → ${after.castHoldDays}.`);
    if (groupDN) rationale.push(`Day/Night relight switches ${before.dayNightSwitches} → ${after.dayNightSwitches}.`);
    if (pinnedDays.size) rationale.push(`${pinnedDays.size} locked/banner day${pinnedDays.size === 1 ? '' : 's'} left untouched.`);
  return { ok: true, pagesPerDay, before, after, rationale, plan: plan.sort((a: any, b: any) => (a.shootDay - b.shootDay) || (a.sortOrder - b.sortOrder)) };
}
