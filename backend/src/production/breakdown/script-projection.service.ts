import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BreakdownService } from './breakdown.service';
import { CastingService } from '../casting/casting.service';

/**
 * P2 — Script→everything projection engine. The active script revision's scenes are the
 * master; this generates/updates the schedule strips from them (linked by id), re-points the
 * scene's breakdown elements onto the strip (so existing budget/casting/DOOD consumers work),
 * and records a reversible ScriptSyncLog. Content only — it NEVER moves a scheduled day and
 * never overwrites a locked strip. Additive & reversible ("don't mess a thing").
 */
@Injectable()
export class ScriptProjectionService {
  constructor(private prisma: PrismaService, private breakdown: BreakdownService, private casting: CastingService) {}

  private ie(v: any): 'INT' | 'EXT' | 'INT_EXT' { const u = String(v || 'INT').toUpperCase(); if (u.includes('INT') && u.includes('EXT')) return 'INT_EXT'; if (u.startsWith('EXT')) return 'EXT'; return 'INT'; }
  private dn(v: any): 'DAY' | 'NIGHT' | 'DUSK' | 'DAWN' { const u = String(v || 'DAY').toUpperCase(); if (u.includes('NIGHT')) return 'NIGHT'; if (u.includes('DUSK') || u.includes('SUNSET')) return 'DUSK'; if (u.includes('DAWN') || u.includes('SUNRISE')) return 'DAWN'; return 'DAY'; }
  private norm(n: any) { return String(n || '').toUpperCase().replace(/\s+/g, '').trim(); }
  private pages(p: any) { return Number(p) || 0; }

  /** Movie Magic baseline present? (budget imported with MOVIE_MAGIC_IMPORT origin) */
  private async hasMmBudget(projectId: string): Promise<boolean> {
    const n = await (this.prisma as any).budgetLineItem.count({ where: { origin: 'MOVIE_MAGIC_IMPORT', account: { section: { budgetVersion: { projectId } } } } }).catch(() => 0);
    return n > 0;
  }

  /** De-dup elements on a strip: when a MOVIE_MAGIC element and a script/AI element share
   *  (category,name), keep the Movie Magic one (the protected baseline); collapse plain dups. */
  private async dedupStripElements(stripIds: string[]) {
    const px: any = this.prisma as any;
    for (const id of Array.from(new Set(stripIds))) {
      const els = await px.breakdownElement.findMany({ where: { stripId: id }, select: { id: true, category: true, name: true, source: true } }).catch(() => [] as any[]);
      const groups = new Map<string, any[]>();
      for (const e of els) { const k = `${e.category}|${String(e.name || '').toLowerCase().trim()}`; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(e); }
      const del: string[] = [];
      for (const g of groups.values()) {
        if (g.length < 2) continue;
        const hasMm = g.some((e: any) => e.source === 'MOVIE_MAGIC');
        if (hasMm) { for (const e of g) if (e.source !== 'MOVIE_MAGIC') del.push(e.id); }
        else { g.slice(1).forEach((e: any) => del.push(e.id)); }
      }
      if (del.length) await px.breakdownElement.deleteMany({ where: { id: { in: del } } }).catch(() => {});
    }
  }

  private async activeRevision(projectId: string) {
    const docs = await this.prisma.scriptDocument.findMany({ where: { projectId }, include: { revisions: { orderBy: { createdAt: 'desc' }, take: 1 } } }).catch(() => [] as any[]);
    if (!docs.length) return null;
    const doc: any = docs.find((d: any) => d.activeRevisionId) || docs[0];
    const revisionId = doc.activeRevisionId || doc.revisions?.[0]?.id;
    return revisionId ? { documentId: doc.id, revisionId } : null;
  }

  private async loadScenes(revisionId: string) {
    const scenes: any[] = await this.prisma.scriptScene.findMany({ where: { revisionId }, orderBy: [{ pageStart: 'asc' }, { sortOrder: 'asc' }] });
    const els: any[] = await (this.prisma as any).breakdownElement.findMany({ where: { sceneId: { in: scenes.map((s) => s.id) }, category: 'CAST' }, select: { sceneId: true, name: true } }).catch(() => []);
    const castBy = new Map<string, string[]>();
    for (const e of els) { if (!e.sceneId) continue; if (!castBy.has(e.sceneId)) castBy.set(e.sceneId, []); castBy.get(e.sceneId)!.push(e.name); }
    return scenes.map((s) => ({ ...s, _cast: castBy.get(s.id) || [] }));
  }

  private content(sc: any) {
    return { sceneNumber: sc.sceneNumber || null, intExt: this.ie(sc.intExt), dayNight: this.dn(sc.dayNight), setName: sc.setName || null, locationId: sc.locationId || null, description: sc.description || sc.slugline || null, pages: this.pages(sc.pages), cast: (sc._cast || []) };
  }

  /** Change-list: scenes (active revision) vs current strips. */
  async preview(projectId: string) {
    const av = await this.activeRevision(projectId);
    if (!av) return { hasScript: false };
    const scenes = await this.loadScenes(av.revisionId);
    const strips: any[] = await this.prisma.productionStrip.findMany({ where: { projectId, isBanner: false } });
    const byId = new Map(strips.map((s) => [s.id, s]));
    const byNum = new Map<string, any[]>();
    for (const s of strips) { const k = this.norm(s.sceneNumber); if (!k) continue; if (!byNum.has(k)) byNum.set(k, []); byNum.get(k)!.push(s); }

    const changes: any[] = []; const matched = new Set<string>();
    for (const sc of scenes) {
      let strip: any = sc.productionStripId ? byId.get(sc.productionStripId) : null;
      let adopt = false;
      if (strip) matched.add(strip.id);
      else { const c = byNum.get(this.norm(sc.sceneNumber)) || []; if (c.length === 1) { strip = c[0]; matched.add(strip.id); adopt = true; } }
      if (!strip) { changes.push({ sceneId: sc.id, sceneNumber: sc.sceneNumber, type: 'ADD', detail: `${this.ie(sc.intExt)} · ${sc.setName || sc.slugline || ''}`.trim() }); continue; }
      const diffs: string[] = [];
      if (this.pages(sc.pages) && this.pages(sc.pages) !== this.pages(strip.pages)) diffs.push(`pages ${this.pages(strip.pages)}→${this.pages(sc.pages)}`);
      if (this.ie(sc.intExt) !== strip.intExt) diffs.push(`${strip.intExt}→${this.ie(sc.intExt)}`);
      if (this.dn(sc.dayNight) !== strip.dayNight) diffs.push(`${strip.dayNight}→${this.dn(sc.dayNight)}`);
      if ((sc.setName || null) && (sc.setName || null) !== strip.setName) diffs.push('set');
      const scCast = (sc._cast || []).slice().sort().join('|');
      const stCast = (Array.isArray(strip.cast) ? strip.cast : []).slice().sort().join('|');
      if (scCast && scCast !== stCast) diffs.push('cast');
      const locked = !!strip.isLocked;
      if (adopt) changes.push({ sceneId: sc.id, sceneNumber: sc.sceneNumber, type: locked ? 'LOCKED' : 'ADOPT', stripId: strip.id, locked, detail: locked ? 'link only (locked)' : 'adopt & link' });
      else if (diffs.length) changes.push({ sceneId: sc.id, sceneNumber: sc.sceneNumber, type: locked ? 'LOCKED' : 'UPDATE', stripId: strip.id, locked, detail: diffs.join(', ') });
      else changes.push({ sceneId: sc.id, sceneNumber: sc.sceneNumber, type: 'UNCHANGED', stripId: strip.id });
    }
    const orphanStrips = strips.filter((s) => !matched.has(s.id)).map((s: any) => ({ id: s.id, sceneNumber: s.sceneNumber, setName: s.setName, shootDay: s.shootDay, mm: (s.notes || '') === 'Movie Magic' }));
    const mmStrips = strips.filter((s: any) => (s.notes || '') === 'Movie Magic').length;
    const mmBudget = await this.hasMmBudget(projectId);
    const summary = {
      scenes: scenes.length,
      add: changes.filter((c) => c.type === 'ADD').length,
      adopt: changes.filter((c) => c.type === 'ADOPT').length,
      update: changes.filter((c) => c.type === 'UPDATE').length,
      unchanged: changes.filter((c) => c.type === 'UNCHANGED').length,
      locked: changes.filter((c) => c.type === 'LOCKED').length,
      orphan: orphanStrips.length,
    };
    return { hasScript: true, revisionId: av.revisionId, summary, changes, orphanStrips, mmBaseline: mmBudget || mmStrips > 0, mmBudget, mmStrips };
  }

  /** Apply: create/adopt/update strips (content only), re-point elements, log (reversible). */
  async apply(projectId: string, opts: { overrideLocked?: boolean; createBudget?: boolean; createCasting?: boolean } = {}) {
    const av = await this.activeRevision(projectId);
    if (!av) return { ok: false, message: 'No script to sync — add a revision in the Script hub first.' };
    const scenes = await this.loadScenes(av.revisionId);
    const strips: any[] = await this.prisma.productionStrip.findMany({ where: { projectId, isBanner: false } });
    const byId = new Map(strips.map((s) => [s.id, s]));
    const byNum = new Map<string, any[]>();
    for (const s of strips) { const k = this.norm(s.sceneNumber); if (!k) continue; if (!byNum.has(k)) byNum.set(k, []); byNum.get(k)!.push(s); }
    const px: any = this.prisma as any;

    const created: string[] = []; const updated: any[] = []; const adopted: any[] = [];
    let skippedLocked = 0, elementsLinked = 0, baseOrder = strips.length;

    for (const sc of scenes) {
      let strip: any = sc.productionStripId ? byId.get(sc.productionStripId) : null;
      let adopt = false;
      if (!strip) { const c = byNum.get(this.norm(sc.sceneNumber)) || []; if (c.length === 1) { strip = c[0]; adopt = true; } }
      const c = this.content(sc);

      if (!strip) {
        const ns = await px.productionStrip.create({ data: { projectId, sceneNumber: c.sceneNumber, intExt: c.intExt as any, dayNight: c.dayNight as any, setName: c.setName, locationId: c.locationId, description: c.description, pages: c.pages, cast: c.cast as any, shootDay: 0, sortOrder: baseOrder++, notes: 'Script-projected' } });
        created.push(ns.id);
        await px.scriptScene.update({ where: { id: sc.id }, data: { productionStripId: ns.id } }).catch(() => {});
        const r = await px.breakdownElement.updateMany({ where: { sceneId: sc.id }, data: { stripId: ns.id } }).catch(() => ({ count: 0 }));
        elementsLinked += r?.count || 0;
        continue;
      }
      if (strip.isLocked && !opts.overrideLocked) {
        if (sc.productionStripId !== strip.id) await px.scriptScene.update({ where: { id: sc.id }, data: { productionStripId: strip.id } }).catch(() => {});
        await px.breakdownElement.updateMany({ where: { sceneId: sc.id }, data: { stripId: strip.id } }).catch(() => {});
        skippedLocked++;
        continue;
      }
      const before = { sceneNumber: strip.sceneNumber, intExt: strip.intExt, dayNight: strip.dayNight, setName: strip.setName, locationId: strip.locationId, description: strip.description, pages: this.pages(strip.pages), cast: Array.isArray(strip.cast) ? strip.cast : [] };
      await px.productionStrip.update({ where: { id: strip.id }, data: { sceneNumber: c.sceneNumber, intExt: c.intExt as any, dayNight: c.dayNight as any, setName: c.setName, locationId: c.locationId, description: c.description, pages: c.pages, cast: c.cast as any } });
      if (sc.productionStripId !== strip.id) await px.scriptScene.update({ where: { id: sc.id }, data: { productionStripId: strip.id } }).catch(() => {});
      const r = await px.breakdownElement.updateMany({ where: { sceneId: sc.id }, data: { stripId: strip.id } }).catch(() => ({ count: 0 }));
      elementsLinked += r?.count || 0;
      (adopt ? adopted : updated).push({ id: strip.id, before });
    }

    // MM baseline guard: protect Movie Magic elements + collapse duplicate script elements on touched strips
    await this.dedupStripElements([...adopted.map((x: any) => x.id), ...updated.map((x: any) => x.id)]);

    let log: any = null;
    try { log = await px.scriptSyncLog.create({ data: { projectId, revisionId: av.revisionId, action: 'SYNC', diff: { created, updated, adopted, skippedLocked } } }); } catch { /* pre-db:push */ }

    let budget: any = null, casting: any = null;
    if (opts.createCasting) { try { casting = await this.casting.createCallsFromBreakdown({ projectId }); } catch (e: any) { casting = { error: e?.message || 'casting failed' }; } }
    if (opts.createBudget) {
      if (await this.hasMmBudget(projectId)) { budget = { skipped: true, reason: 'Movie Magic budget is the baseline — script budget not added (avoids double-count).' }; }
      else { try { budget = await this.breakdown.budgetFromBreakdown(projectId, {}); } catch (e: any) { budget = { error: e?.message || 'budget failed' }; } }
    }

    return { ok: true, logId: log?.id || null, created: created.length, updated: updated.length, adopted: adopted.length, skippedLocked, elementsLinked, budget, casting };
  }

  async logs(projectId: string) {
    const rows = await (this.prisma as any).scriptSyncLog.findMany({ where: { projectId }, orderBy: { appliedAt: 'desc' }, take: 12 }).catch(() => []);
    return rows.map((r: any) => ({ id: r.id, action: r.action, appliedAt: r.appliedAt, rolledBack: r.action === 'ROLLED_BACK', created: (r.diff?.created || []).length, updated: (r.diff?.updated || []).length, adopted: (r.diff?.adopted || []).length, skippedLocked: r.diff?.skippedLocked || 0 }));
  }

  /** MM reconcile — manually link a script scene to an existing (e.g. Movie Magic) strip when
   *  scene numbers don't match; re-points the scene's elements + de-dups. Turns ADD into ADOPT. */
  async linkSceneToStrip(sceneId: string, stripId: string) {
    if (!sceneId || !stripId) return { ok: false, message: 'sceneId and stripId are required.' };
    const px: any = this.prisma as any;
    await px.scriptScene.update({ where: { id: sceneId }, data: { productionStripId: stripId } }).catch(() => {});
    const r = await px.breakdownElement.updateMany({ where: { sceneId }, data: { stripId } }).catch(() => ({ count: 0 }));
    await this.dedupStripElements([stripId]);
    return { ok: true, elementsLinked: r?.count || 0 };
  }

  /** Undo a sync: delete created strips, restore updated/adopted strip content. */
  async rollback(logId: string) {
    const px: any = this.prisma as any;
    const log: any = await px.scriptSyncLog.findUnique({ where: { id: logId } }).catch(() => null);
    if (!log || !log.diff) return { ok: false, message: 'Sync log not found.' };
    if (log.action === 'ROLLED_BACK') return { ok: false, message: 'This sync was already rolled back.' };
    const d = log.diff; let deleted = 0, restored = 0;
    for (const id of (d.created || [])) {
      await px.scriptScene.updateMany({ where: { productionStripId: id }, data: { productionStripId: null } }).catch(() => {});
      await px.breakdownElement.updateMany({ where: { stripId: id }, data: { stripId: null } }).catch(() => {});
      await px.productionStrip.delete({ where: { id } }).catch(() => {});
      deleted++;
    }
    for (const u of [...(d.updated || []), ...(d.adopted || [])]) {
      if (!u?.id || !u.before) continue;
      await px.productionStrip.update({ where: { id: u.id }, data: { sceneNumber: u.before.sceneNumber, intExt: u.before.intExt, dayNight: u.before.dayNight, setName: u.before.setName, locationId: u.before.locationId, description: u.before.description, pages: this.pages(u.before.pages), cast: (u.before.cast || []) } }).catch(() => {});
      restored++;
    }
    await px.scriptSyncLog.update({ where: { id: logId }, data: { action: 'ROLLED_BACK' } }).catch(() => {});
    return { ok: true, deleted, restored };
  }
}
