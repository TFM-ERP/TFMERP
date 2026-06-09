import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-13 · D9 — Prop → draft budget line bridge.
 * A script TAG annotation (e.g. "Prop: Vintage Watch") can spawn a DRAFT BudgetLineItem under a
 * chosen account; the annotation keeps a link (associatedLineItemId) and the line carries
 * sourceAnnotationId + isDraft + origin=SCRIPT_TAG so accounting can review/confirm it later.
 */
@Injectable()
export class ScriptProcurementService {
  constructor(private prisma: PrismaService) {}

  /** Accounts of the project's active budget version (for the staging picker). */
  async accounts(projectId: string) {
    const version = await this.prisma.budgetVersion.findFirst({
      where: { projectId, isActive: true },
      include: { sections: { orderBy: { sortOrder: 'asc' }, include: { accounts: { orderBy: { sortOrder: 'asc' } } } } },
    }) || await this.prisma.budgetVersion.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' }, include: { sections: { include: { accounts: true } } } });
    if (!version) return [];
    return version.sections.flatMap((s) => s.accounts.map((a) => ({ id: a.id, code: a.code, title: a.title, section: s.title })));
  }

  /** All TAG annotations on a revision + their linked draft line (the Procurement Staging list). */
  async stagingList(revisionId: string) {
    const tags = await this.prisma.annotation.findMany({ where: { revisionId, tool: 'TAG' }, orderBy: { createdAt: 'asc' } });
    const lineIds = tags.map((t) => t.associatedLineItemId).filter(Boolean) as string[];
    const lines = lineIds.length
      ? await this.prisma.budgetLineItem.findMany({ where: { id: { in: lineIds } }, include: { account: { select: { code: true, title: true } } } })
      : [];
    const lineMap = new Map(lines.map((l) => [l.id, l]));
    return tags.map((t) => ({
      id: t.id, page: t.page, text: (t.payload as any)?.text || '', tagKey: (t.payload as any)?.tagKey || null,
      line: t.associatedLineItemId ? lineMap.get(t.associatedLineItemId) || null : null,
    }));
  }

  /** Stage a tag → create the draft budget line + link it back to the annotation. */
  async stage(annotationId: string, body: any) {
    const anno = await this.prisma.annotation.findUnique({ where: { id: annotationId } });
    if (!anno) throw new NotFoundException('Annotation not found.');
    if (!body?.accountId) throw new BadRequestException('Pick a budget account.');
    const account = await this.prisma.budgetAccount.findUnique({ where: { id: body.accountId }, include: { section: { select: { budgetVersion: { select: { projectId: true } } } } } });
    if (!account) throw new NotFoundException('Budget account not found.');
    const project = await this.prisma.productionProject.findUnique({ where: { id: account.section.budgetVersion.projectId }, select: { currency: true } });

    const qty = Number(body.quantity) > 0 ? Number(body.quantity) : 1;
    const rate = Number(body.rate) || 0;
    const subtotal = Math.round(qty * rate * 100) / 100;
    const max = await this.prisma.budgetLineItem.aggregate({ where: { accountId: account.id }, _max: { sortOrder: true } });

    const line = await this.prisma.budgetLineItem.create({
      data: {
        accountId: account.id,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        description: (anno.payload as any)?.text || 'Script prop',
        subTitle: (anno.payload as any)?.tagKey || 'Prop',
        quantity: qty, units: body.units || 'units', rate,
        currency: project?.currency || 'AED',
        origin: 'SCRIPT_TAG', isDraft: true, sourceAnnotationId: annotationId,
        subtotal, total: subtotal,
      },
    });
    await this.prisma.annotation.update({ where: { id: annotationId }, data: { associatedLineItemId: line.id } });
    return line;
  }

  /** Unstage — delete the draft line (only if still a draft) and clear the annotation link. */
  async unstage(annotationId: string) {
    const anno = await this.prisma.annotation.findUnique({ where: { id: annotationId } });
    if (!anno?.associatedLineItemId) return { ok: true };
    const line = await this.prisma.budgetLineItem.findUnique({ where: { id: anno.associatedLineItemId }, select: { id: true, isDraft: true } });
    if (line?.isDraft) await this.prisma.budgetLineItem.delete({ where: { id: line.id } });
    await this.prisma.annotation.update({ where: { id: annotationId }, data: { associatedLineItemId: null } });
    return { ok: true };
  }

  /** Confirm — promote the draft line to a real budget line (accounting accepts it). */
  async confirm(annotationId: string) {
    const anno = await this.prisma.annotation.findUnique({ where: { id: annotationId } });
    if (!anno?.associatedLineItemId) throw new BadRequestException('Nothing staged.');
    return this.prisma.budgetLineItem.update({ where: { id: anno.associatedLineItemId }, data: { isDraft: false } });
  }
}
