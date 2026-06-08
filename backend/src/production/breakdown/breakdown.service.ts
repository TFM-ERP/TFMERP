import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class BreakdownService {
  constructor(private prisma: PrismaService) {}

  byStrip(stripId: string) {
    return this.prisma.breakdownElement.findMany({ where: { stripId }, orderBy: [{ category: 'asc' }, { createdAt: 'asc' }] });
  }

  /** Single scene + its elements + project (for the printable breakdown sheet). */
  sheet(stripId: string) {
    return this.prisma.productionStrip.findUnique({
      where: { id: stripId },
      include: {
        project: { select: { id: true, title: true, projectNumber: true, projectType: true, currency: true } },
        elements: { orderBy: [{ category: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  /**
   * Location Breakdown (computed, no new tables) — groups the AI-generated
   * ProductionStrips by location and rolls up everything needed to shoot there:
   * scenes, cast, page count / est. time, shooting days, and all tagged elements
   * (props, vehicles, animals, wardrobe, SFX, camera…) grouped by category.
   * Mirrors RK-Scheduler's Location Breakdown, on top of TFM's richer data.
   */
  async locationBreakdown(projectId: string) {
    const strips = await this.prisma.productionStrip.findMany({
      where: { projectId },
      include: { elements: { orderBy: [{ category: 'asc' }, { name: 'asc' }] } },
      orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }, { sceneNumber: 'asc' }],
    });

    const asArray = (v: any): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? v.split(',').map((s) => s.trim()) : []).filter(Boolean);
    const groups = new Map<string, any>();

    for (const s of strips) {
      const key = (s.location || s.setName || 'Unassigned').trim() || 'Unassigned';
      let g = groups.get(key);
      if (!g) {
        g = {
          location: key, locationId: s.locationId || null,
          intExt: new Set<string>(), sets: new Set<string>(), shootingDays: new Set<number>(),
          cast: new Set<string>(), scenes: [] as any[],
          elements: new Map<string, Map<string, number>>(), // category → (name → qty)
          pages: 0, estMinutes: 0,
        };
        groups.set(key, g);
      }
      if (!g.locationId && s.locationId) g.locationId = s.locationId;
      if (s.intExt) g.intExt.add(String(s.intExt));
      if (s.setName) g.sets.add(s.setName);
      if (s.shootDay && s.shootDay > 0) g.shootingDays.add(s.shootDay);
      const cast = asArray(s.cast);
      cast.forEach((c) => g.cast.add(c));
      g.pages += Number(s.pages || 0);
      g.estMinutes += Number(s.estMinutes || 0);
      g.scenes.push({
        stripId: s.id, sceneNumber: s.sceneNumber || '', set: s.setName || '', intExt: String(s.intExt || ''),
        dayNight: String(s.dayNight || ''), synopsis: s.description || '', cast, pages: Number(s.pages || 0),
        estMinutes: s.estMinutes || null, shootDay: s.shootDay || 0, notes: s.notes || '',
      });
      // element roll-up by category
      for (const e of s.elements) {
        const cat = String(e.category);
        if (!g.elements.has(cat)) g.elements.set(cat, new Map());
        const m = g.elements.get(cat)!;
        m.set(e.name, (m.get(e.name) || 0) + (e.quantity || 1));
      }
    }

    const out = Array.from(groups.values()).map((g) => ({
      location: g.location,
      locationId: g.locationId,
      intExt: Array.from(g.intExt),
      sets: Array.from(g.sets),
      shootingDays: Array.from(g.shootingDays).sort((a: number, b: number) => a - b),
      cast: Array.from(g.cast).sort(),
      sceneCount: g.scenes.length,
      pages: Number(g.pages.toFixed(3)),
      estMinutes: g.estMinutes,
      scenes: g.scenes,
      elementsByCategory: Array.from(g.elements.entries()).map(([category, names]: any) => ({
        category,
        items: Array.from(names.entries()).map(([name, quantity]: any) => ({ name, quantity })),
      })).sort((a: any, b: any) => a.category.localeCompare(b.category)),
    }));

    // Order: earliest shooting day first, then by name; unscheduled last.
    out.sort((a, b) => {
      const da = Number(a.shootingDays[0] ?? 9999), db = Number(b.shootingDays[0] ?? 9999);
      return da - db || a.location.localeCompare(b.location);
    });

    const totalSets = new Set(out.flatMap((l) => l.sets)).size;
    const totalScenes = out.reduce((n, l) => n + l.sceneCount, 0);
    return { projectId, locationCount: out.length, totalSets, totalScenes, locations: out };
  }

  /** Create budget line items from breakdown estimated costs, tagged to their cost centers. Idempotent. */
  async pushToBudget(projectId: string) {
    const version = await this.prisma.budgetVersion.findFirst({
      where: { projectId, isActive: true },
      include: { sections: { include: { accounts: true } } },
    });
    if (!version) throw new BadRequestException('No active budget version to push into.');
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });

    const codeToAccount: Record<string, string> = {};
    const accountIds: string[] = [];
    for (const s of version.sections) for (const a of s.accounts) { codeToAccount[a.code] = a.id; accountIds.push(a.id); }

    // Remove any previously pushed breakdown lines so re-runs don't duplicate
    await this.prisma.budgetLineItem.deleteMany({ where: { accountId: { in: accountIds }, subTitle: 'Breakdown' } });

    const els = await this.prisma.breakdownElement.findMany({ where: { projectId, estCost: { gt: 0 }, costCenterCode: { not: null } } });
    let created = 0;
    for (const e of els) {
      const accId = e.costCenterCode ? codeToAccount[e.costCenterCode] : null;
      if (!accId) continue;
      const total = Number(e.estCost);
      const qty = e.quantity || 1;
      const rate = qty ? total / qty : total;
      const count = await this.prisma.budgetLineItem.count({ where: { accountId: accId } });
      await this.prisma.budgetLineItem.create({
        data: {
          accountId: accId, sortOrder: count, subTitle: 'Breakdown',
          description: `${e.name} · ${String(e.category).replace(/_/g, ' ').toLowerCase()}`,
          quantity: qty, units: 'unit', rate, currency: (project?.currency as any) || 'AED', exchangeRate: 1,
          fringePct: 0, origin: 'AUTO_BREAKDOWN', aiSuggestedRate: rate, aiSuggestedQuantity: qty,
          subtotal: total, fringeAmount: 0, total,
        },
      });
      created++;
    }

    // Recalculate the active version's grand total onto the project
    const fresh = await this.prisma.budgetVersion.findUnique({
      where: { id: version.id },
      include: { sections: { include: { accounts: { include: { lineItems: { select: { total: true } } } } } } },
    });
    let grand = 0;
    for (const s of fresh!.sections) for (const a of s.accounts) for (const i of a.lineItems) grand += Number(i.total);
    await this.prisma.productionProject.update({ where: { id: projectId }, data: { totalBudget: grand } });

    return { created, grandTotal: grand };
  }

  create(data: any) {
    return this.prisma.breakdownElement.create({
      data: {
        projectId: data.projectId, stripId: data.stripId,
        category: data.category, name: data.name || 'Element',
        quantity: Number(data.quantity) || 1,
        costCenterCode: data.costCenterCode || null, costCenterTitle: data.costCenterTitle || null,
        estCost: Number(data.estCost) || 0, notes: data.notes || null,
      },
    });
  }

  update(id: string, data: any) {
    const { id: _i, projectId, stripId, project, strip, createdAt, ...rest } = data || {};
    if (rest.quantity !== undefined) rest.quantity = Number(rest.quantity) || 1;
    if (rest.estCost !== undefined) rest.estCost = Number(rest.estCost) || 0;
    return this.prisma.breakdownElement.update({ where: { id }, data: rest });
  }

  remove(id: string) { return this.prisma.breakdownElement.delete({ where: { id } }); }

  // ── Breakdown → Budget generator ────────────────────────────────────────────────
  // Aggregates breakdown element counts by category, maps each category to the best-
  // matching budget account (by title keyword), and creates budget lines at a rate
  // card. Cast/BG/Stunts carry a labor classification so fringes apply. Idempotent.

  private static CATEGORY_MAP: Record<string, { keywords: string[]; unit: string; classification?: string }> = {
    CAST: { keywords: ['cast', 'principal', 'performer', 'actor', 'lead'], unit: 'role', classification: 'PERFORMER' },
    BACKGROUND: { keywords: ['extra', 'atmosphere', 'background', 'crowd'], unit: 'person-day', classification: 'BG' },
    STUNTS: { keywords: ['stunt'], unit: 'day', classification: 'STUNT' },
    VEHICLES: { keywords: ['vehicle', 'picture car', 'action vehicle', 'transport', 'pic car'], unit: 'unit' },
    ANIMALS: { keywords: ['animal', 'livestock'], unit: 'unit' },
    ANIMAL_WRANGLER: { keywords: ['wrangler', 'animal handler', 'animal trainer'], unit: 'day', classification: 'CREW' },
    PROPS: { keywords: ['prop'], unit: 'unit' },
    SET_DRESSING: { keywords: ['set dressing', 'dressing'], unit: 'unit' },
    WARDROBE: { keywords: ['wardrobe', 'costume'], unit: 'unit' },
    MAKEUP_HAIR: { keywords: ['makeup', 'make-up', 'make up', 'hair'], unit: 'unit' },
    SFX: { keywords: ['special effect', 'sfx', 'pyro'], unit: 'unit' },
    MECHANICAL_FX: { keywords: ['mechanical effect', 'mechanical rig', 'gimbal rig'], unit: 'unit' },
    VFX: { keywords: ['visual effect', 'vfx', 'post', 'cgi'], unit: 'shot' },
    SPECIAL_EQUIPMENT: { keywords: ['special equipment', 'crane', 'rigging', 'equipment', 'steadicam'], unit: 'unit' },
    CAMERA: { keywords: ['camera', 'lens', 'drone'], unit: 'unit', classification: 'CREW' },
    ADDITIONAL_LABOR: { keywords: ['additional labor', 'additional labour', 'day player crew', 'standby labor', 'swing gang', 'grip', 'set operations'], unit: 'person-day', classification: 'CREW' },
    SOUND_MUSIC: { keywords: ['sound', 'music', 'playback'], unit: 'unit' },
    ART: { keywords: ['art department', 'art director', 'construction', 'set design', 'set construction'], unit: 'unit' },
    GREENERY: { keywords: ['greens', 'greenery', 'plants', 'set construction'], unit: 'unit' },
    SECURITY: { keywords: ['security', 'location'], unit: 'day' },
    OTHER: { keywords: [], unit: 'unit' },
  };
  private static DEFAULT_RATES: Record<string, number> = {
    CAST: 2500, BACKGROUND: 200, STUNTS: 1200, VEHICLES: 500, ANIMALS: 800, ANIMAL_WRANGLER: 900, PROPS: 150,
    SET_DRESSING: 300, WARDROBE: 250, MAKEUP_HAIR: 300, SFX: 1000, MECHANICAL_FX: 1200, VFX: 2000,
    SPECIAL_EQUIPMENT: 800, CAMERA: 1500, ADDITIONAL_LABOR: 600, SOUND_MUSIC: 500, ART: 400, GREENERY: 300, SECURITY: 400, OTHER: 100,
  };

  /** Default rate card + category quantities preview, so the UI can confirm before generating. */
  async budgetPreview(projectId: string) {
    const els = await this.prisma.breakdownElement.findMany({ where: { projectId } });
    const qtyByCat: Record<string, number> = {};
    const castNames = new Set<string>();
    for (const e of els) {
      if (e.category === 'CAST') { castNames.add(e.name.toUpperCase()); continue; }
      qtyByCat[e.category] = (qtyByCat[e.category] || 0) + (e.quantity || 1);
    }
    qtyByCat['CAST'] = castNames.size;
    const rows = Object.keys(BreakdownService.CATEGORY_MAP)
      .filter((c) => (qtyByCat[c] || 0) > 0)
      .map((c) => ({ category: c, quantity: qtyByCat[c], unit: BreakdownService.CATEGORY_MAP[c].unit, rate: BreakdownService.DEFAULT_RATES[c] ?? 0, classification: BreakdownService.CATEGORY_MAP[c].classification || null }));
    return { rows };
  }

  /** Generate budget line items from breakdown element counts using a rate card. Idempotent. */
  async budgetFromBreakdown(projectId: string, rateCard: Record<string, number> = {}) {
    const version = await this.prisma.budgetVersion.findFirst({
      where: { projectId, isActive: true },
      include: { sections: { include: { accounts: true } } },
    });
    if (!version) throw new BadRequestException('No active budget version. Create one first.');
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });

    // flat account list (across sections), for keyword matching
    const accounts: { id: string; code: string; title: string }[] = [];
    const accountIds: string[] = [];
    for (const s of version.sections) for (const a of s.accounts) { accounts.push({ id: a.id, code: a.code, title: a.title }); accountIds.push(a.id); }
    const findAccount = (keywords: string[]) => {
      for (const kw of keywords) {
        const hit = accounts.find((a) => a.title.toLowerCase().includes(kw));
        if (hit) return hit;
      }
      return null;
    };

    const preview = await this.budgetPreview(projectId);

    // remove previously generated breakdown lines (idempotent)
    await this.prisma.budgetLineItem.deleteMany({ where: { accountId: { in: accountIds }, subTitle: 'Auto-Breakdown' } });

    let created = 0; const unmapped: any[] = [];
    for (const row of preview.rows) {
      const map = BreakdownService.CATEGORY_MAP[row.category];
      const acct = findAccount(map.keywords);
      const rate = rateCard[row.category] != null ? Number(rateCard[row.category]) : row.rate;
      const qty = row.quantity;
      const total = qty * rate;
      if (!acct) { unmapped.push({ category: row.category, quantity: qty, rate, total }); continue; }
      const count = await this.prisma.budgetLineItem.count({ where: { accountId: acct.id } });
      await this.prisma.budgetLineItem.create({
        data: {
          accountId: acct.id, sortOrder: count, subTitle: 'Auto-Breakdown',
          description: `${row.category.replace(/_/g, ' ')} (from script breakdown)`,
          quantity: qty, units: map.unit, rate, currency: (project?.currency as any) || 'AED', exchangeRate: 1,
          fringePct: 0, classificationCode: map.classification || null,
          origin: 'SCRIPT_IMPORT', aiSuggestedRate: rate, aiSuggestedQuantity: qty,
          subtotal: total, fringeAmount: 0, total,
        },
      });
      created++;
    }

    // recalc project total
    const fresh = await this.prisma.budgetVersion.findUnique({
      where: { id: version.id },
      include: { sections: { include: { accounts: { include: { lineItems: { select: { total: true } } } } } } },
    });
    let grand = 0;
    for (const s of fresh!.sections) for (const a of s.accounts) for (const i of a.lineItems) grand += Number(i.total);
    await this.prisma.productionProject.update({ where: { id: projectId }, data: { totalBudget: grand } });

    return { created, unmapped, grandTotal: grand };
  }

  // ── Visual drag-and-drop mapping (intercepts the auto-budget step) ─────────────────

  /** Data for the DnD mapping UI: AI category cards (left) + budget account buckets (right). */
  async mappingPreview(projectId: string) {
    const version = await this.prisma.budgetVersion.findFirst({
      where: { projectId, isActive: true },
      include: { sections: { orderBy: { sortOrder: 'asc' }, include: { accounts: { orderBy: { sortOrder: 'asc' } } } } },
    });
    if (!version) throw new BadRequestException('No active budget version. Create one first.');

    const accounts: { id: string; code: string; title: string; tier: string | null }[] = [];
    for (const s of version.sections) for (const a of s.accounts) accounts.push({ id: a.id, code: a.code, title: a.title, tier: s.tier });
    const findAccount = (keywords: string[]) => {
      for (const kw of keywords) { const hit = accounts.find(a => a.title.toLowerCase().includes(kw)); if (hit) return hit; }
      return null;
    };

    const preview = await this.budgetPreview(projectId);
    const categories = preview.rows.map(r => {
      const map = BreakdownService.CATEGORY_MAP[r.category];
      const suggested = findAccount(map.keywords);
      return {
        category: r.category,
        label: r.category.replace(/_/g, ' '),
        quantity: r.quantity,
        unit: r.unit,
        aiRate: r.rate,                       // the AI/default suggested rate (archived on override)
        classification: r.classification,
        suggestedAccountCode: suggested?.code || null,
        estTotal: r.quantity * r.rate,
      };
    });
    return { categories, accounts };
  }

  /**
   * Create budget line items from a user-confirmed mapping. Each mapping line:
   *   { category, accountCode, rate }
   * The origin is AUTO-flagged MANUAL_OVERRIDE when the user moved the category to a
   * different account than the AI suggested OR changed the rate; otherwise it stays
   * SCRIPT_IMPORT. The AI's original rate/quantity are always archived in aiSuggested*.
   * Idempotent: clears prior 'Auto-Breakdown' lines first.
   */
  async applyMapping(projectId: string, mappings: any[]) {
    const version = await this.prisma.budgetVersion.findFirst({
      where: { projectId, isActive: true },
      include: { sections: { include: { accounts: true } } },
    });
    if (!version) throw new BadRequestException('No active budget version. Create one first.');
    if (version.status === 'LOCKED') throw new BadRequestException('The active budget is locked. Create a working copy before generating lines.');
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });

    const accounts: { id: string; code: string; title: string }[] = [];
    const accountIds: string[] = [];
    for (const s of version.sections) for (const a of s.accounts) { accounts.push({ id: a.id, code: a.code, title: a.title }); accountIds.push(a.id); }
    const byCode = new Map(accounts.map(a => [a.code, a]));

    const preview = await this.budgetPreview(projectId);
    const previewByCat = new Map(preview.rows.map(r => [r.category, r]));
    const findAccount = (keywords: string[]) => {
      for (const kw of keywords) { const hit = accounts.find(a => a.title.toLowerCase().includes(kw)); if (hit) return hit; }
      return null;
    };

    // idempotent
    await this.prisma.budgetLineItem.deleteMany({ where: { accountId: { in: accountIds }, subTitle: 'Auto-Breakdown' } });

    let created = 0; const skipped: any[] = [];
    for (const m of mappings || []) {
      const cat = m.category;
      const map = BreakdownService.CATEGORY_MAP[cat];
      const pv = previewByCat.get(cat);
      if (!map || !pv) { skipped.push({ category: cat, reason: 'no breakdown data' }); continue; }
      const acct = byCode.get(m.accountCode);
      if (!acct) { skipped.push({ category: cat, reason: 'account not found' }); continue; }

      const qty = pv.quantity;
      const aiRate = BreakdownService.DEFAULT_RATES[cat] ?? pv.rate;
      const rate = m.rate != null ? Number(m.rate) : aiRate;
      const suggestedAcct = findAccount(map.keywords);
      const movedAccount = !suggestedAcct || suggestedAcct.code !== acct.code;
      const changedRate = Math.abs(rate - aiRate) > 0.001;
      const isOverride = movedAccount || changedRate;
      const total = qty * rate;

      const count = await this.prisma.budgetLineItem.count({ where: { accountId: acct.id } });
      await this.prisma.budgetLineItem.create({
        data: {
          accountId: acct.id, sortOrder: count, subTitle: 'Auto-Breakdown',
          description: `${cat.replace(/_/g, ' ')} (from script breakdown)`,
          quantity: qty, units: map.unit, rate, currency: (project?.currency as any) || 'AED', exchangeRate: 1,
          fringePct: 0, classificationCode: map.classification || null,
          origin: isOverride ? 'MANUAL_OVERRIDE' : 'SCRIPT_IMPORT',
          aiSuggestedRate: aiRate, aiSuggestedQuantity: qty,
          subtotal: total, fringeAmount: 0, total,
        },
      });
      created++;
    }

    const fresh = await this.prisma.budgetVersion.findUnique({
      where: { id: version.id },
      include: { sections: { include: { accounts: { include: { lineItems: { select: { total: true } } } } } } },
    });
    let grand = 0;
    for (const s of fresh!.sections) for (const a of s.accounts) for (const i of a.lineItems) grand += Number(i.total);
    await this.prisma.productionProject.update({ where: { id: projectId }, data: { totalBudget: grand } });

    return { created, skipped, grandTotal: grand };
  }

  /** Project-wide rollup by category and by cost center. */
  async summary(projectId: string) {
    const els = await this.prisma.breakdownElement.findMany({ where: { projectId } });
    const byCategory: Record<string, { count: number; qty: number; estCost: number }> = {};
    const byCostCenter: Record<string, { code: string; title: string; estCost: number; count: number }> = {};
    let totalCost = 0;
    for (const e of els) {
      const c = (byCategory[e.category] = byCategory[e.category] || { count: 0, qty: 0, estCost: 0 });
      c.count++; c.qty += e.quantity; c.estCost += Number(e.estCost);
      totalCost += Number(e.estCost);
      if (e.costCenterCode) {
        const cc = (byCostCenter[e.costCenterCode] = byCostCenter[e.costCenterCode] || { code: e.costCenterCode, title: e.costCenterTitle || '', estCost: 0, count: 0 });
        cc.estCost += Number(e.estCost); cc.count++;
      }
    }
    return {
      total: els.length, totalCost,
      byCategory: Object.entries(byCategory).map(([category, v]) => ({ category, ...v })),
      byCostCenter: Object.values(byCostCenter).sort((a, b) => a.code.localeCompare(b.code)),
    };
  }

  /**
   * Element Breakdown (computed) — every tagged element grouped by category, then by
   * element name, with the scenes and shooting days it appears in, cost centers and
   * est. cost. Drives the per-category inner tabs under the Breakdowns hub.
   */
  async categoryBreakdown(projectId: string) {
    const strips = await this.prisma.productionStrip.findMany({
      where: { projectId },
      include: { elements: { orderBy: [{ category: 'asc' }, { name: 'asc' }] } },
      orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }, { sceneNumber: 'asc' }],
    });

    const cats = new Map<string, Map<string, any>>();
    for (const s of strips) {
      for (const e of s.elements) {
        const cat = String(e.category);
        if (!cats.has(cat)) cats.set(cat, new Map());
        const m = cats.get(cat)!;
        let it = m.get(e.name);
        if (!it) { it = { name: e.name, qty: 0, estCost: 0, scenes: new Set<string>(), days: new Set<number>(), costCenters: new Set<string>() }; m.set(e.name, it); }
        it.qty += e.quantity || 1;
        it.estCost += Number(e.estCost || 0);
        if (s.sceneNumber) it.scenes.add(String(s.sceneNumber));
        if (s.shootDay && s.shootDay > 0) it.days.add(s.shootDay);
        if (e.costCenterCode) it.costCenters.add(`${e.costCenterCode}${e.costCenterTitle ? ' · ' + e.costCenterTitle : ''}`);
      }
    }

    const categories = Array.from(cats.entries()).map(([category, m]) => {
      const items = Array.from(m.values()).map((it: any) => ({
        name: it.name,
        qty: it.qty,
        estCost: Number(it.estCost.toFixed(2)),
        scenes: Array.from(it.scenes),
        days: Array.from(it.days).sort((a: number, b: number) => a - b),
        costCenters: Array.from(it.costCenters),
      })).sort((a: any, b: any) => b.qty - a.qty || a.name.localeCompare(b.name));
      return {
        category,
        itemCount: items.length,
        totalQty: items.reduce((n: number, i: any) => n + i.qty, 0),
        estCost: Number(items.reduce((n: number, i: any) => n + i.estCost, 0).toFixed(2)),
        items,
      };
    }).sort((a, b) => a.category.localeCompare(b.category));

    return {
      projectId,
      categoryCount: categories.length,
      totalElements: categories.reduce((n, c) => n + c.itemCount, 0),
      categories,
    };
  }

  /**
   * Per-day rollup (computed) — the call-sheet view. Groups scheduled scenes by shoot
   * day and rolls up locations, sets, cast and elements-by-category for each day.
   * When the project has a shootStartDate, each day is mapped to a real calendar date
   * (start + day - 1). Unscheduled scenes (shootDay 0) are returned separately so the
   * coordinator can see what still needs a day before call sheets are generated.
   */
  async dayRollup(projectId: string) {
    const project = await this.prisma.productionProject.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, shootStartDate: true, startDate: true },
    });
    const strips = await this.prisma.productionStrip.findMany({
      where: { projectId },
      include: { elements: { orderBy: [{ category: 'asc' }, { name: 'asc' }] } },
      orderBy: [{ shootDay: 'asc' }, { sortOrder: 'asc' }, { sceneNumber: 'asc' }],
    });

    const asArray = (v: any): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? v.split(',').map((s) => s.trim()) : []).filter(Boolean);
    const anchor = project?.shootStartDate || project?.startDate || null;
    const dateForDay = (day: number): string | null => {
      if (!anchor || day <= 0) return null;
      const d = new Date(anchor);
      d.setDate(d.getDate() + (day - 1));
      return d.toISOString().slice(0, 10);
    };

    const days = new Map<number, any>();
    const unscheduled: any[] = [];

    for (const s of strips) {
      const day = s.shootDay && s.shootDay > 0 ? s.shootDay : 0;
      const sceneRow = {
        stripId: s.id, sceneNumber: s.sceneNumber || '', set: s.setName || '', location: s.location || '',
        intExt: String(s.intExt || ''), dayNight: String(s.dayNight || ''), synopsis: s.description || '',
        cast: asArray(s.cast), pages: Number(s.pages || 0), estMinutes: s.estMinutes || null,
      };
      if (day === 0) { unscheduled.push(sceneRow); continue; }

      let g = days.get(day);
      if (!g) {
        g = { day, date: dateForDay(day), locations: new Set<string>(), sets: new Set<string>(), intExt: new Set<string>(), cast: new Set<string>(), scenes: [] as any[], elements: new Map<string, Map<string, number>>(), pages: 0, estMinutes: 0 };
        days.set(day, g);
      }
      if (s.location) g.locations.add(s.location);
      if (s.setName) g.sets.add(s.setName);
      if (s.intExt) g.intExt.add(String(s.intExt));
      sceneRow.cast.forEach((c) => g.cast.add(c));
      g.pages += Number(s.pages || 0);
      g.estMinutes += Number(s.estMinutes || 0);
      g.scenes.push(sceneRow);
      for (const e of s.elements) {
        const cat = String(e.category);
        if (!g.elements.has(cat)) g.elements.set(cat, new Map());
        const mm = g.elements.get(cat)!;
        mm.set(e.name, (mm.get(e.name) || 0) + (e.quantity || 1));
      }
    }

    const out = Array.from(days.values()).map((g) => ({
      day: g.day,
      date: g.date,
      locations: Array.from(g.locations),
      sets: Array.from(g.sets),
      intExt: Array.from(g.intExt),
      cast: Array.from(g.cast).sort(),
      sceneCount: g.scenes.length,
      pages: Number(g.pages.toFixed(3)),
      estMinutes: g.estMinutes,
      scenes: g.scenes,
      elementsByCategory: Array.from(g.elements.entries()).map(([category, names]: any) => ({
        category,
        items: Array.from(names.entries()).map(([name, quantity]: any) => ({ name, quantity })),
      })).sort((a: any, b: any) => a.category.localeCompare(b.category)),
    })).sort((a, b) => a.day - b.day);

    return {
      projectId,
      shootStartDate: anchor,
      hasSchedule: out.length > 0,
      dayCount: out.length,
      unscheduledCount: unscheduled.length,
      days: out,
      unscheduled,
    };
  }

  // ── In-app sharing — "share to selected project users" (read-only) ──────────────
  async shareBreakdown(userId: string, dto: { projectId: string; kind?: string; refKey?: string; title: string; message?: string; toUserIds: string[] }) {
    if (!userId) throw new BadRequestException('No sender.');
    const ids = Array.from(new Set((dto.toUserIds || []).filter(Boolean)));
    if (!dto.projectId || !dto.title || ids.length === 0) throw new BadRequestException('Project, title and at least one recipient are required.');
    await this.prisma.breakdownShare.createMany({
      data: ids.map((to) => ({
        projectId: dto.projectId, kind: dto.kind || 'REPORT', refKey: dto.refKey || null,
        title: dto.title, message: dto.message || null, sharedById: userId, sharedToId: to,
      })),
    });
    return { shared: ids.length };
  }

  /** Shares addressed to the current user for one project (most recent first). */
  mySharesForProject(userId: string, projectId: string) {
    if (!userId) return [];
    return this.prisma.breakdownShare.findMany({
      where: { sharedToId: userId, projectId },
      include: { sharedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markShareRead(userId: string, id: string) {
    await this.prisma.breakdownShare.updateMany({ where: { id, sharedToId: userId }, data: { readAt: new Date() } });
    return { ok: true };
  }
}
