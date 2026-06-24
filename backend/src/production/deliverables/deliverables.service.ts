import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** TVC P2 — Deliverables & Versions: the cutdown × aspect-ratio matrix + post pipeline. */
@Injectable()
export class DeliverablesService {
  constructor(private prisma: PrismaService) {}

  list(projectId: string) { return (this.prisma as any).deliverable.findMany({ where: { projectId }, orderBy: [{ durationSec: 'desc' }, { sortOrder: 'asc' }] }).catch(() => [] as any[]); }
  create(projectId: string, body: any) {
    return (this.prisma as any).deliverable.create({ data: {
      projectId, name: body?.name || `${body?.durationSec || ''}s ${body?.aspectRatio || ''}`.trim() || 'Deliverable',
      durationSec: body?.durationSec != null ? Number(body.durationSec) || null : null, aspectRatio: body?.aspectRatio || null,
      parentId: body?.parentId || null, pipelineStatus: body?.pipelineStatus || 'PLANNED',
      dueDate: body?.dueDate ? new Date(body.dueDate) : null, channel: body?.channel || null, notes: body?.notes || null,
    } });
  }
  update(id: string, body: any) {
    const data: any = {};
    for (const k of ['name', 'aspectRatio', 'pipelineStatus', 'channel', 'notes', 'parentId']) if (body?.[k] !== undefined) data[k] = body[k];
    if (body?.durationSec !== undefined) data.durationSec = Number(body.durationSec) || null;
    if (body?.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (body?.spec !== undefined) data.spec = body.spec;
    return (this.prisma as any).deliverable.update({ where: { id }, data });
  }
  setStatus(id: string, status: string) { return (this.prisma as any).deliverable.update({ where: { id }, data: { pipelineStatus: status } }); }
  remove(id: string) { return (this.prisma as any).deliverable.delete({ where: { id } }); }

  /** Build the deliverables matrix from the latest brief: durations × aspect ratios. */
  async generateFromBrief(projectId: string) {
    const briefs: any[] = await (this.prisma as any).creativeBrief.findMany({ where: { projectId }, orderBy: { updatedAt: 'desc' } }).catch(() => []);
    const brief: any = briefs.find((b) => b.status !== 'RAW') || briefs[0];
    if (!brief) throw new BadRequestException('No brief yet — add a creative brief first.');
    const durations: any[] = Array.isArray(brief.durations) && brief.durations.length ? brief.durations : [30];
    const ratios: any[] = Array.isArray(brief.aspectRatios) && brief.aspectRatios.length ? brief.aspectRatios : ['16:9'];
    const existing: any[] = await (this.prisma as any).deliverable.findMany({ where: { projectId }, select: { durationSec: true, aspectRatio: true } }).catch(() => []);
    const seen = new Set(existing.map((d) => `${d.durationSec}|${d.aspectRatio}`));
    let created = 0, order = existing.length;
    for (const d of durations) for (const r of ratios) {
      const dur = Number(d) || null; const key = `${dur}|${r}`;
      if (seen.has(key)) continue;
      await (this.prisma as any).deliverable.create({ data: { projectId, name: `${d}s · ${r}`, durationSec: dur, aspectRatio: String(r), pipelineStatus: 'PLANNED', sortOrder: order++ } });
      seen.add(key); created++;
    }
    return { created, durations: durations.length, ratios: ratios.length };
  }
}
