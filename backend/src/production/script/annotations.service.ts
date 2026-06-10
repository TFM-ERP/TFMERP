import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-13 · D2 — Annotation layers + decoupled annotations.
 * Layers belong to the document and carry across revisions; annotations bind to a revision.
 * Accessible-layer filtering here is the D2 baseline (PROJECT + own PERSONAL + SHARED_ROLE);
 * the full role-by-role IAM wall lands in D4.
 */
@Injectable()
export class AnnotationsService {
  constructor(private prisma: PrismaService) {}

  private readonly TOOLS = ['HIGHLIGHT', 'PEN', 'TEXT', 'STICKY', 'TAG', 'TRAMLINE'];
  private readonly VIS = ['PRIVATE', 'SHARED_ROLE', 'PROJECT'];
  private readonly TYPES = ['PERSONAL', 'DEPARTMENT', 'MEETING', 'SCRIPT_SUPE', 'EXEC'];

  // ── SYS-13b P2 — bookmarks (carry forward across revisions via sceneNumber) ──
  listBookmarks(revisionId: string) {
    return this.prisma.scriptBookmark.findMany({ where: { revisionId }, orderBy: [{ page: 'asc' }, { createdAt: 'asc' }] });
  }
  createBookmark(revisionId: string, b: any, userId?: string) {
    return this.prisma.scriptBookmark.create({ data: {
      revisionId, page: Number(b.page) || 1, sceneNumber: b.sceneNumber || null,
      label: String(b.label || 'Bookmark').slice(0, 120), note: b.note || null,
      color: b.color || '#0ea5e9', createdById: userId || null,
    } });
  }
  updateBookmark(id: string, b: any) {
    return this.prisma.scriptBookmark.update({ where: { id }, data: {
      ...(b.label !== undefined ? { label: String(b.label).slice(0, 120) } : {}),
      ...(b.note !== undefined ? { note: b.note || null } : {}),
      ...(b.color !== undefined ? { color: b.color } : {}),
      ...(b.page !== undefined ? { page: Number(b.page) || 1 } : {}),
    } });
  }
  deleteBookmark(id: string) { return this.prisma.scriptBookmark.delete({ where: { id } }); }

  // ── SYS-13b P3 — custom tag categories ──────────────────────────────────────
  private readonly DEFAULT_CATS: [string, string, string][] = [
    ['CAST', 'Cast', '#7c3aed'], ['BACKGROUND', 'Background', '#a78bfa'], ['STUNTS', 'Stunts', '#ef4444'],
    ['PROPS', 'Props', '#f59e0b'], ['SET_DRESSING', 'Set Dressing', '#3b82f6'], ['WARDROBE', 'Wardrobe', '#ec4899'],
    ['MAKEUP_HAIR', 'Make-up / Hair', '#f472b6'], ['VEHICLES', 'Vehicles', '#0ea5e9'], ['ANIMALS', 'Animals', '#84cc16'],
    ['SFX', 'Special FX', '#dc2626'], ['VFX', 'Visual FX', '#14b8a6'], ['CAMERA', 'Camera', '#64748b'],
    ['SOUND_MUSIC', 'Sound / Music', '#22c55e'], ['ART', 'Art', '#8b5cf6'], ['GREENERY', 'Greenery', '#16a34a'],
    ['SPECIAL_EQUIPMENT', 'Special Equipment', '#0891b2'],
  ];
  private readonly BREAKDOWN_KEYS = new Set(this.DEFAULT_CATS.map((c) => c[0]));

  async listTagCategories(projectId: string) {
    let cats = await this.prisma.tagCategory.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } });
    if (!cats.length) {
      await this.prisma.tagCategory.createMany({
        data: this.DEFAULT_CATS.map(([key, label, color], i) => ({ projectId, key, label, color, sortOrder: i, breakdownCategory: this.BREAKDOWN_KEYS.has(key) ? key : null })),
      });
      cats = await this.prisma.tagCategory.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } });
    }
    return cats;
  }
  createTagCategory(projectId: string, b: any) {
    const key = String(b.key || b.label || 'TAG').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
    return this.prisma.tagCategory.create({ data: {
      projectId, key, label: b.label || 'New category', color: b.color || '#0ea5e9',
      sortOrder: Number(b.sortOrder) || 999, breakdownCategory: b.breakdownCategory || null, budgetCode: b.budgetCode || null,
    } });
  }
  updateTagCategory(id: string, b: any) {
    return this.prisma.tagCategory.update({ where: { id }, data: {
      ...(b.label !== undefined ? { label: String(b.label) } : {}),
      ...(b.color !== undefined ? { color: b.color } : {}),
      ...(b.hidden !== undefined ? { hidden: !!b.hidden } : {}),
      ...(b.sortOrder !== undefined ? { sortOrder: Number(b.sortOrder) } : {}),
      ...(b.budgetCode !== undefined ? { budgetCode: b.budgetCode || null } : {}),
      ...(b.breakdownCategory !== undefined ? { breakdownCategory: b.breakdownCategory || null } : {}),
    } });
  }
  deleteTagCategory(id: string) { return this.prisma.tagCategory.delete({ where: { id } }); }
  reorderTagCategories(ids: string[]) {
    return this.prisma.$transaction((ids || []).map((id, i) => this.prisma.tagCategory.update({ where: { id }, data: { sortOrder: i } })));
  }

  // ── Auto-Tag Cast — one pass: tag every speaking character in every scene ────
  private cueCharacters(text: string): string[] {
    const out = new Set<string>();
    const lines = String(text || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t) continue;
      if (/^(\d+[A-Z]?\s+)?(INT|EXT|I\/E)[\.\s]/i.test(t)) continue;
      const next = (lines[i + 1] || '').trim();
      if (t === t.toUpperCase() && /[A-Z]/.test(t) && t.length <= 38 && /^[A-Z0-9 .,'()\-/&]+$/.test(t) && next) {
        const name = t.replace(/\s*\((CONT'D|V\.?O\.?|O\.?S\.?|O\.?C\.?|PRE-?LAP)\)\s*$/i, '').replace(/\s*\(.*\)\s*$/, '').trim();
        if (name && !/^(CUT|FADE|DISSOLVE|SMASH|MATCH|THE END|OMITTED)/.test(name) && name.length >= 2) out.add(name);
      }
    }
    return [...out];
  }

  async autoTagCast(revisionId: string, userId?: string) {
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId }, include: { scenes: { orderBy: { sortOrder: 'asc' } } } });
    if (!rev) throw new NotFoundException('Revision not found');
    const pages = (rev.pageText as any[]) || [];
    const pageMap = new Map<number, string>(pages.map((p: any) => [p.page, String(p.text || '')]));

    let layer = await this.prisma.annotationLayer.findFirst({ where: { documentId: rev.documentId, name: 'Cast' } });
    if (!layer) layer = await this.prisma.annotationLayer.create({ data: { documentId: rev.documentId, name: 'Cast', type: 'DEPARTMENT', color: '#7c3aed', visibility: 'PROJECT', ownerUserId: userId || null } });

    const existing = await this.prisma.annotation.findMany({ where: { revisionId, tool: 'TAG' }, select: { page: true, anchorText: true, payload: true } });
    const has = new Set(existing.filter((a) => (a.payload as any)?.tagKey === 'CAST').map((a) => `${a.page}|${(a.anchorText || '').toLowerCase()}`));

    let created = 0;
    for (const sc of rev.scenes) {
      const chars = new Set<string>();
      for (let p = sc.pageStart; p <= sc.pageEnd; p++) for (const c of this.cueCharacters(pageMap.get(p) || '')) chars.add(c);
      let yi = 0;
      for (const name of chars) {
        const k = `${sc.pageStart}|${name.toLowerCase()}`;
        if (has.has(k)) continue;
        await this.prisma.annotation.create({ data: {
          layerId: layer.id, revisionId, documentId: rev.documentId, page: sc.pageStart, tool: 'TAG',
          payload: { text: name, tagKey: 'CAST', color: '#7c3aed', auto: true } as any,
          anchorText: name, x: 0.05, y: Math.min(0.92, 0.1 + yi * 0.035), w: 0.02, h: 0.02, createdById: userId || null,
        } });
        has.add(k); created++; yi++;
      }
    }
    return { created, scenes: rev.scenes.length, layerId: layer.id };
  }

  // ── Tag report — Element/Category report from TAG annotations ────────────────
  async tagReport(revisionId: string) {
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId }, include: { scenes: { orderBy: { sortOrder: 'asc' } } } });
    if (!rev) throw new NotFoundException('Revision not found');
    const scenes = rev.scenes;
    const sceneForPage = (page: number) => scenes.find((s) => page >= s.pageStart && page <= s.pageEnd)?.sceneNumber || `p.${page}`;
    const tags = await this.prisma.annotation.findMany({ where: { revisionId, tool: 'TAG' } });
    const byCat = new Map<string, { color?: string; elements: Map<string, { scenes: Set<string>; count: number }> }>();
    for (const t of tags) {
      const pl: any = t.payload || {};
      const cat = String(pl.tagKey || 'TAG');
      const name = String(pl.text || t.anchorText || 'element').trim();
      if (!byCat.has(cat)) byCat.set(cat, { color: pl.color, elements: new Map() });
      const m = byCat.get(cat)!;
      const e = m.elements.get(name) || { scenes: new Set<string>(), count: 0 };
      e.scenes.add(sceneForPage(t.page)); e.count++; m.elements.set(name, e);
    }
    return {
      revisionId,
      categories: [...byCat.entries()].map(([category, v]) => ({
        category, color: v.color || null,
        elements: [...v.elements.entries()].map(([name, e]) => ({ name, scenes: [...e.scenes], count: e.count })).sort((a, b) => a.name.localeCompare(b.name)),
      })).sort((a, b) => a.category.localeCompare(b.category)),
      totals: { categories: byCat.size, tags: tags.length },
    };
  }

  // ── Scene special tags (description / story day / note) ──────────────────────
  updateScene(id: string, b: any) {
    return this.prisma.scriptScene.update({ where: { id }, data: {
      ...(b.description !== undefined ? { description: b.description || null } : {}),
      ...(b.storyDay !== undefined ? { storyDay: b.storyDay || null } : {}),
      ...(b.tagNote !== undefined ? { tagNote: b.tagNote || null } : {}),
      ...(b.slugline !== undefined ? { slugline: b.slugline || null } : {}),
    } });
  }

  // ── IAM resolution (D4) ─────────────────────────────────────────────────────
  /** The requester's project context: role template key, department, producer flag. */
  private async resolveUserCtx(projectId: string, userId?: string) {
    if (!userId) return { templateKey: '', department: '', isProducer: false };
    const [role, crew] = await Promise.all([
      this.prisma.projectRoleAssignment.findUnique({ where: { projectId_userId: { projectId, userId } }, include: { template: { select: { key: true, name: true } } } }),
      this.prisma.productionCrew.findFirst({ where: { projectId, userId }, select: { department: true } }),
    ]);
    const tag = `${role?.template?.key || ''} ${role?.template?.name || ''}`.toLowerCase();
    return { templateKey: role?.template?.key || '', department: crew?.department || '', isProducer: tag.includes('producer') };
  }

  /** Can the user SEE this layer? PRIVATE=owner · EXEC=producers · PROJECT=all · SHARED_ROLE=share match. */
  private canSee(layer: any, ctx: { templateKey: string; department: string; isProducer: boolean }, userId?: string) {
    if (layer.ownerUserId && layer.ownerUserId === userId) return true; // always see your own
    if (layer.type === 'EXEC') return ctx.isProducer;                   // exec/financial deny-by-default
    if (layer.visibility === 'PROJECT') return true;
    if (layer.visibility === 'PRIVATE') return false;
    if (layer.visibility === 'SHARED_ROLE') {
      if (layer.department && ctx.department && layer.department === ctx.department) return true;
      return (layer.shares || []).some((s: any) =>
        (s.templateKey && s.templateKey === ctx.templateKey) ||
        (s.department && ctx.department && s.department === ctx.department));
    }
    return false;
  }

  /** Can the user create/edit on this layer? Owner, PROJECT, or a share granting EDIT. */
  private canEdit(layer: any, ctx: any, userId?: string) {
    if (layer.ownerUserId && layer.ownerUserId === userId) return true;
    if (layer.type === 'EXEC') return ctx.isProducer;
    if (layer.visibility === 'PROJECT') return true;
    return (layer.shares || []).some((s: any) => s.access === 'EDIT' &&
      ((s.templateKey && s.templateKey === ctx.templateKey) || (s.department && ctx.department && s.department === ctx.department)));
  }

  // ── Layers ───────────────────────────────────────────────────────────────────
  /** Layers a user may see on a document; guarantees a personal "My Notes" layer exists. */
  async listLayers(documentId: string, userId?: string) {
    const doc = await this.prisma.scriptDocument.findUnique({ where: { id: documentId }, select: { id: true, projectId: true } });
    if (!doc) throw new NotFoundException('Script document not found.');
    if (userId) {
      const mine = await this.prisma.annotationLayer.findFirst({ where: { documentId, ownerUserId: userId, type: 'PERSONAL' } });
      if (!mine) await this.prisma.annotationLayer.create({ data: { documentId, name: 'My Notes', type: 'PERSONAL', visibility: 'PRIVATE', ownerUserId: userId } });
    }
    const ctx = await this.resolveUserCtx(doc.projectId, userId);
    const layers = await this.prisma.annotationLayer.findMany({ where: { documentId }, include: { shares: true }, orderBy: { createdAt: 'asc' } });
    return layers.filter((l) => this.canSee(l, ctx, userId)).map((l) => ({ ...l, canEdit: this.canEdit(l, ctx, userId) }));
  }

  async createLayer(documentId: string, body: any, userId?: string) {
    if (!body?.name) throw new BadRequestException('Layer name is required.');
    return this.prisma.annotationLayer.create({
      data: {
        documentId,
        name: body.name,
        type: this.TYPES.includes(body.type) ? body.type : 'PERSONAL',
        department: body.department || null,
        color: body.color || '#eab308',
        visibility: this.VIS.includes(body.visibility) ? body.visibility : 'PRIVATE',
        ownerUserId: userId || null,
      },
    });
  }

  updateLayer(id: string, data: any) {
    const d: any = {};
    for (const k of ['name', 'department', 'color']) if (data?.[k] !== undefined) d[k] = data[k];
    if (data?.visibility !== undefined && this.VIS.includes(data.visibility)) d.visibility = data.visibility;
    if (data?.type !== undefined && this.TYPES.includes(data.type)) d.type = data.type;
    return this.prisma.annotationLayer.update({ where: { id }, data: d });
  }

  removeLayer(id: string) { return this.prisma.annotationLayer.delete({ where: { id } }); }

  // ── Layer shares (D4 IAM grants) ───────────────────────────────────────────────
  listShares(layerId: string) { return this.prisma.layerShare.findMany({ where: { layerId }, orderBy: { createdAt: 'asc' } }); }

  async addShare(layerId: string, body: any) {
    if (!body?.templateKey && !body?.department) throw new BadRequestException('Provide a role (templateKey) or a department.');
    return this.prisma.layerShare.create({
      data: {
        layerId,
        templateKey: body.templateKey || null,
        department: body.department || null,
        access: body.access === 'EDIT' ? 'EDIT' : 'VIEW',
      },
    });
  }

  removeShare(id: string) { return this.prisma.layerShare.delete({ where: { id } }); }

  // ── Annotations ──────────────────────────────────────────────────────────────
  /** All annotations on a revision whose layer the user may see. */
  async listAnnotations(revisionId: string, userId?: string) {
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId }, select: { document: { select: { projectId: true } } } });
    const ctx = await this.resolveUserCtx(rev?.document?.projectId || '', userId);
    const rows = await this.prisma.annotation.findMany({
      where: { revisionId },
      include: { layer: { include: { shares: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.filter((a) => this.canSee(a.layer, ctx, userId));
  }

  async createAnnotation(body: any, userId?: string) {
    if (!body?.layerId || !body?.revisionId) throw new BadRequestException('layerId and revisionId are required.');
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: body.revisionId }, select: { documentId: true, document: { select: { projectId: true } } } });
    if (!rev) throw new NotFoundException('Revision not found.');
    // Enforce the IAM wall on writes too.
    const layer = await this.prisma.annotationLayer.findUnique({ where: { id: body.layerId }, include: { shares: true } });
    if (!layer) throw new NotFoundException('Layer not found.');
    const ctx = await this.resolveUserCtx(rev.document?.projectId || '', userId);
    if (!this.canEdit(layer, ctx, userId)) throw new ForbiddenException('You do not have edit access to this layer.');
    // Idempotent offline re-send: a client-minted id that already exists returns the original.
    const clientId = body.clientId || body.id;
    if (clientId) {
      const existing = await this.prisma.annotation.findUnique({ where: { id: clientId } });
      if (existing) return existing;
    }
    return this.prisma.annotation.create({
      data: {
        ...(clientId ? { id: clientId } : {}),
        layerId: body.layerId,
        revisionId: body.revisionId,
        documentId: rev.documentId,
        page: Number(body.page) || 1,
        tool: this.TOOLS.includes(body.tool) ? body.tool : 'HIGHLIGHT',
        payload: body.payload ?? null,
        anchorText: body.anchorText ?? null,
        anchorHash: body.anchorHash ?? null,
        anchorOffset: body.anchorOffset ?? null,
        surroundingContext: body.surroundingContext ?? null,
        x: Number(body.x) || 0, y: Number(body.y) || 0, w: Number(body.w) || 0, h: Number(body.h) || 0,
        associatedLineItemId: body.associatedLineItemId ?? null,
        createdById: userId || null,
      },
    });
  }

  /** Only the note's author may change or delete it (your own layer's notes count as yours;
   *  legacy unowned notes stay editable so old data isn't locked). */
  private async assertOwn(id: string, userId?: string) {
    const a = await this.prisma.annotation.findUnique({ where: { id }, include: { layer: { select: { ownerUserId: true } } } });
    if (!a) throw new NotFoundException('Annotation not found.');
    const owns = (a.createdById && userId && a.createdById === userId)
      || (a.layer?.ownerUserId && a.layer.ownerUserId === userId)
      || (!a.createdById && !a.layer?.ownerUserId);
    if (!owns) throw new ForbiddenException('Only the author can edit or delete this note.');
    return a;
  }

  async updateAnnotation(id: string, data: any, userId?: string) {
    await this.assertOwn(id, userId);
    const d: any = {};
    if (data?.payload !== undefined) d.payload = data.payload;
    if (data?.layerId !== undefined) d.layerId = data.layerId;
    if (data?.associatedLineItemId !== undefined) d.associatedLineItemId = data.associatedLineItemId;
    if (data?.conflict !== undefined) d.conflict = !!data.conflict;
    for (const k of ['x', 'y', 'w', 'h'] as const) if (data?.[k] !== undefined) d[k] = Number(data[k]);
    return this.prisma.annotation.update({ where: { id }, data: d });
  }

  async removeAnnotation(id: string, userId?: string) {
    await this.assertOwn(id, userId);
    return this.prisma.annotation.delete({ where: { id } });
  }
}
