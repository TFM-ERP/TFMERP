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

  updateAnnotation(id: string, data: any) {
    const d: any = {};
    if (data?.payload !== undefined) d.payload = data.payload;
    if (data?.layerId !== undefined) d.layerId = data.layerId;
    if (data?.associatedLineItemId !== undefined) d.associatedLineItemId = data.associatedLineItemId;
    if (data?.conflict !== undefined) d.conflict = !!data.conflict;
    for (const k of ['x', 'y', 'w', 'h'] as const) if (data?.[k] !== undefined) d[k] = Number(data[k]);
    return this.prisma.annotation.update({ where: { id }, data: d });
  }

  removeAnnotation(id: string) { return this.prisma.annotation.delete({ where: { id } }); }
}
