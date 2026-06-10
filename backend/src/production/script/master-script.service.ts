import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScriptService } from './script.service';

/**
 * SYS-13b · P5 — Standalone Script Library master.
 * Mirrors the MasterLocation → Location dual-target pattern. A MasterScript is a company-level
 * script (+ canonical revisions) that can be LINKED into any project (read-through copy into a
 * project ScriptDocument so all per-project tooling works unchanged), PROMOTED up from a project
 * script, or PULLED into a linked project as a fresh revision (so Transfer re-anchors notes).
 * Carries reusable palettes (tag categories + saved character voices) inherited on link.
 */
@Injectable()
export class MasterScriptService {
  constructor(private prisma: PrismaService, private script: ScriptService) {}

  // ── Library CRUD ──────────────────────────────────────────────────────────────
  list(query?: { search?: string; status?: string }) {
    const where: any = {};
    if (query?.status) where.status = query.status;
    if (query?.search) where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { writer: { contains: query.search, mode: 'insensitive' } },
      { logline: { contains: query.search, mode: 'insensitive' } },
    ];
    return this.prisma.masterScript.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        revisions: { orderBy: { createdAt: 'desc' }, select: { id: true, revisionLabel: true, colorCode: true, pageCount: true, createdAt: true } },
        _count: { select: { linkedDocs: true, revisions: true } },
      },
    });
  }

  async stats() {
    const all = await this.prisma.masterScript.findMany({ select: { status: true } });
    const byStatus: Record<string, number> = {};
    for (const m of all) byStatus[m.status] = (byStatus[m.status] || 0) + 1;
    const revisions = await this.prisma.masterScriptRevision.count();
    return { total: all.length, byStatus, revisions };
  }

  async get(id: string) {
    const m = await this.prisma.masterScript.findUnique({
      where: { id },
      include: {
        revisions: { orderBy: { createdAt: 'desc' } },
        linkedDocs: { select: { id: true, title: true, projectId: true, createdAt: true } },
      },
    });
    if (!m) throw new NotFoundException('Master script not found.');
    return m;
  }

  create(body: any, userId?: string) {
    if (!body?.title) throw new BadRequestException('A title is required.');
    return this.prisma.masterScript.create({
      data: {
        title: body.title, logline: body.logline || null, kind: body.kind || 'FEATURE',
        writer: body.writer || null, status: body.status || 'DEVELOPMENT', summary: body.summary || null,
        tags: body.tags ?? null, createdById: userId || null,
      },
    });
  }

  update(id: string, body: any) {
    const d: any = {};
    for (const k of ['title', 'logline', 'kind', 'writer', 'status', 'summary', 'tags', 'tagPalette', 'voicePalette']) if (body?.[k] !== undefined) d[k] = body[k];
    return this.prisma.masterScript.update({ where: { id }, data: d });
  }

  remove(id: string) { return this.prisma.masterScript.delete({ where: { id } }); }

  // ── Revisions ─────────────────────────────────────────────────────────────────
  async addRevision(masterScriptId: string, fileUrl: string, absPath: string, body: any, userId?: string) {
    const master = await this.prisma.masterScript.findUnique({ where: { id: masterScriptId } });
    if (!master) throw new NotFoundException('Master script not found.');
    const { pages, scenes, viewPdfUrl } = await this.script.extractAndParse(absPath);
    const rev = await this.prisma.masterScriptRevision.create({
      data: {
        masterScriptId,
        revisionLabel: body?.revisionLabel || 'Draft',
        colorCode: body?.colorCode || null,
        pdfUrl: viewPdfUrl || fileUrl,
        pageCount: pages.length,
        pageText: pages.map((text, i) => ({ page: i + 1, text })),
        scenes,
        uploadedById: userId || null,
      },
    });
    await this.prisma.masterScript.update({ where: { id: masterScriptId }, data: { updatedAt: new Date() } });
    return rev;
  }

  removeRevision(id: string) { return this.prisma.masterScriptRevision.delete({ where: { id } }); }

  // ── Palettes ──────────────────────────────────────────────────────────────────
  setPalette(id: string, body: any) {
    const d: any = {};
    if (body?.tagPalette !== undefined) d.tagPalette = body.tagPalette;
    if (body?.voicePalette !== undefined) d.voicePalette = body.voicePalette;
    return this.prisma.masterScript.update({ where: { id }, data: d });
  }

  // ── Link / promote / pull ───────────────────────────────────────────────────────
  private async copyRevisionToDocument(documentId: string, projectId: string, mrev: any, userId?: string) {
    const rev = await this.prisma.scriptRevision.create({
      data: {
        documentId,
        revisionLabel: mrev.revisionLabel,
        colorCode: mrev.colorCode || null,
        pdfUrl: mrev.pdfUrl,
        pageCount: mrev.pageCount,
        pageText: mrev.pageText ?? null,
        uploadedById: userId || null,
      },
    });
    const scenes: any[] = Array.isArray(mrev.scenes) ? mrev.scenes : [];
    if (scenes.length) {
      await this.prisma.scriptScene.createMany({
        data: scenes.map((s, i) => ({
          revisionId: rev.id, projectId, sortOrder: i,
          sceneNumber: s.sceneNumber ?? null, slugline: s.slugline ?? null, intExt: s.intExt ?? null,
          dayNight: s.dayNight ?? null, pageStart: s.pageStart ?? 1, pageEnd: s.pageEnd ?? 1, charStart: s.charStart ?? null,
        })),
      });
    }
    return rev;
  }

  /** Seed the project's tag categories from the master palette (idempotent on key). */
  private async seedTagPalette(projectId: string, palette: any[]) {
    if (!Array.isArray(palette) || !palette.length) return;
    const existing = new Set((await this.prisma.tagCategory.findMany({ where: { projectId }, select: { key: true } })).map((c) => c.key));
    const toAdd = palette.filter((c) => c?.key && !existing.has(c.key));
    if (toAdd.length) {
      await this.prisma.tagCategory.createMany({
        data: toAdd.map((c, i) => ({
          projectId, key: c.key, label: c.label || c.key, color: c.color || '#0ea5e9',
          sortOrder: c.sortOrder ?? i, hidden: !!c.hidden, breakdownCategory: c.breakdownCategory || null, budgetCode: c.budgetCode || null,
        })),
      });
    }
  }

  /** Link a library script into a project: new project document + copied latest revision. */
  async linkToProject(masterScriptId: string, projectId: string, userId?: string) {
    const master = await this.prisma.masterScript.findUnique({
      where: { id: masterScriptId },
      include: { revisions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!master) throw new NotFoundException('Master script not found.');
    const doc = await this.prisma.scriptDocument.create({
      data: { projectId, title: master.title, kind: 'SCRIPT', masterScriptId, createdById: userId || null },
    });
    const latest = master.revisions[0];
    if (latest) {
      const rev = await this.copyRevisionToDocument(doc.id, projectId, latest, userId);
      await this.prisma.scriptDocument.update({ where: { id: doc.id }, data: { activeRevisionId: rev.id } });
    }
    await this.seedTagPalette(projectId, (master.tagPalette as any[]) || []);
    await this.prisma.masterScript.update({ where: { id: masterScriptId }, data: { timesUsed: { increment: 1 } } });
    return this.prisma.scriptDocument.findUnique({ where: { id: doc.id }, include: { revisions: { orderBy: { createdAt: 'desc' } } } });
  }

  /** Promote a project's active revision up into the library as a new MasterScript. */
  async promoteFromDocument(documentId: string, body: any, userId?: string) {
    const doc = await this.prisma.scriptDocument.findUnique({
      where: { id: documentId },
      include: { revisions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!doc) throw new NotFoundException('Script document not found.');
    if (doc.masterScriptId) throw new BadRequestException('This document is already linked to a library script.');
    const active = doc.revisions.find((r) => r.id === doc.activeRevisionId) || doc.revisions[0];
    if (!active) throw new BadRequestException('Upload a revision before promoting to the library.');

    const scenes = await this.prisma.scriptScene.findMany({ where: { revisionId: active.id }, orderBy: { sortOrder: 'asc' } });
    const master = await this.prisma.masterScript.create({
      data: {
        title: body?.title || doc.title, logline: body?.logline || null, kind: body?.kind || 'FEATURE',
        writer: body?.writer || null, status: 'ACTIVE', createdById: userId || null,
        revisions: {
          create: {
            revisionLabel: active.revisionLabel, colorCode: active.colorCode || null, pdfUrl: active.pdfUrl,
            pageCount: active.pageCount, pageText: active.pageText ?? null, uploadedById: userId || null,
            scenes: scenes.map((s) => ({
              sceneNumber: s.sceneNumber, slugline: s.slugline, intExt: s.intExt, dayNight: s.dayNight,
              pageStart: s.pageStart, pageEnd: s.pageEnd, charStart: s.charStart,
            })),
          },
        },
      },
    });
    await this.prisma.scriptDocument.update({ where: { id: documentId }, data: { masterScriptId: master.id } });
    return this.get(master.id);
  }

  /** Pull the master's latest revision into a linked project document as a NEW revision. */
  async pullLatest(documentId: string, userId?: string) {
    const doc = await this.prisma.scriptDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Script document not found.');
    if (!doc.masterScriptId) throw new BadRequestException('This document is not linked to a library script.');
    const latest = await this.prisma.masterScriptRevision.findFirst({ where: { masterScriptId: doc.masterScriptId }, orderBy: { createdAt: 'desc' } });
    if (!latest) throw new BadRequestException('The library script has no revisions to pull.');
    const rev = await this.copyRevisionToDocument(doc.id, doc.projectId, latest, userId);
    await this.prisma.scriptDocument.update({ where: { id: documentId }, data: { activeRevisionId: rev.id } });
    return this.script.getRevision(rev.id);
  }
}
