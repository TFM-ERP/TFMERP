import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

const DAY = 86400000;
const PPM_DEFAULTS = [
  { key: 'boards', label: 'Storyboards / boards locked' },
  { key: 'cast', label: 'Cast approved' },
  { key: 'wardrobe', label: 'Wardrobe / styling approved' },
  { key: 'locations', label: 'Locations locked' },
  { key: 'schedule', label: 'Shoot schedule agreed' },
  { key: 'equipment', label: 'Camera / equipment confirmed' },
  { key: 'legal', label: 'Legal / clearances / usage' },
  { key: 'budget', label: 'Budget locked' },
  { key: 'logistics', label: 'Travel / catering / logistics' },
];

/** TVC P3 — commercial controls: usage/buyout (holding-fee clock) + the PPM sign-off gate. */
@Injectable()
export class CommercialService {
  constructor(private prisma: PrismaService) {}

  // ── Usage / buyout / licence ──────────────────────────────────────────────────
  listUsage(projectId: string) { return (this.prisma as any).usageRight.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }).catch(() => [] as any[]); }

  async createUsage(projectId: string, body: any) {
    const weeks = body?.holdingFeeEveryWeeks != null ? Number(body.holdingFeeEveryWeeks) || null : (String(body?.kind || 'TALENT') === 'TALENT' ? 13 : null);
    const start = body?.windowStart ? new Date(body.windowStart) : null;
    const next = weeks && start ? new Date(start.getTime() + weeks * 7 * DAY) : null;
    return (this.prisma as any).usageRight.create({ data: {
      projectId, kind: body?.kind || 'TALENT', title: body?.title || 'Untitled', deliverableId: body?.deliverableId || null,
      territory: body?.territory || null, media: body?.media || null,
      windowStart: start, windowEnd: body?.windowEnd ? new Date(body.windowEnd) : null,
      exclusivity: !!body?.exclusivity, fee: body?.fee != null ? Number(body.fee) : null, sessionFee: body?.sessionFee != null ? Number(body.sessionFee) : null,
      holdingFeeEveryWeeks: weeks, holdingFeeAmount: body?.holdingFeeAmount != null ? Number(body.holdingFeeAmount) : null,
      nextHoldingFeeAt: next, status: 'ACTIVE', notes: body?.notes || null,
    } });
  }
  updateUsage(id: string, body: any) {
    const data: any = {};
    for (const k of ['kind', 'title', 'deliverableId', 'territory', 'media', 'status', 'notes']) if (body?.[k] !== undefined) data[k] = body[k];
    if (body?.exclusivity !== undefined) data.exclusivity = !!body.exclusivity;
    for (const k of ['fee', 'sessionFee', 'holdingFeeAmount']) if (body?.[k] !== undefined) data[k] = body[k] != null ? Number(body[k]) : null;
    if (body?.holdingFeeEveryWeeks !== undefined) data.holdingFeeEveryWeeks = body.holdingFeeEveryWeeks != null ? Number(body.holdingFeeEveryWeeks) : null;
    for (const k of ['windowStart', 'windowEnd', 'nextHoldingFeeAt']) if (body?.[k] !== undefined) data[k] = body[k] ? new Date(body[k]) : null;
    return (this.prisma as any).usageRight.update({ where: { id }, data });
  }
  async advanceHoldingFee(id: string) {
    const r: any = await (this.prisma as any).usageRight.findUnique({ where: { id } });
    if (!r) return { ok: false };
    const weeks = Number(r.holdingFeeEveryWeeks) || 13;
    const base = r.nextHoldingFeeAt ? new Date(r.nextHoldingFeeAt) : new Date();
    return (this.prisma as any).usageRight.update({ where: { id }, data: { nextHoldingFeeAt: new Date(base.getTime() + weeks * 7 * DAY) } });
  }
  setUsageStatus(id: string, status: string) { return (this.prisma as any).usageRight.update({ where: { id }, data: { status } }); }
  removeUsage(id: string) { return (this.prisma as any).usageRight.delete({ where: { id } }); }

  /** Alerts — holding fees due/overdue, usage windows expiring/expired. */
  async alerts(projectId: string) {
    const rows: any[] = await this.listUsage(projectId);
    const now = Date.now(); const items: any[] = [];
    for (const r of rows) {
      if (r.status === 'RELEASED') continue;
      if (r.nextHoldingFeeAt) { const due = new Date(r.nextHoldingFeeAt).getTime(); if (due <= now) items.push({ type: 'HOLDING', severity: 'high', usageId: r.id, message: `Holding fee OVERDUE — ${r.title}`, date: r.nextHoldingFeeAt }); else if (due <= now + 21 * DAY) items.push({ type: 'HOLDING', severity: 'medium', usageId: r.id, message: `Holding fee due soon — ${r.title}`, date: r.nextHoldingFeeAt }); }
      if (r.windowEnd) { const end = new Date(r.windowEnd).getTime(); if (end <= now) items.push({ type: 'USAGE', severity: 'high', usageId: r.id, message: `Usage EXPIRED — ${r.title}`, date: r.windowEnd }); else if (end <= now + 30 * DAY) items.push({ type: 'USAGE', severity: 'medium', usageId: r.id, message: `Usage window expiring — ${r.title}`, date: r.windowEnd }); }
    }
    const rank: any = { high: 0, medium: 1 };
    items.sort((a, b) => rank[a.severity] - rank[b.severity]);
    return { count: items.length, items };
  }

  // ── Agency / brand (client-vendor parties) ──────────────────────────────────
  setParties(projectId: string, body: any) {
    return (this.prisma as any).productionProject.update({ where: { id: projectId }, data: { agencyName: body?.agencyName ?? null, brandName: body?.brandName ?? null } });
  }

  // ── PPM checklist ───────────────────────────────────────────────────────────
  async getPpm(projectId: string) {
    const px: any = this.prisma as any;
    let p: any = await px.ppmChecklist.findUnique({ where: { projectId } }).catch(() => null);
    if (!p) {
      const items = PPM_DEFAULTS.map((i) => ({ ...i, done: false }));
      p = await px.ppmChecklist.create({ data: { projectId, items, status: 'DRAFT' } }).catch(() => ({ projectId, items, status: 'DRAFT', agencyApproved: false, clientApproved: false, transient: true }));
    }
    return p;
  }
  async updatePpm(projectId: string, body: any) {
    const px: any = this.prisma as any;
    await this.getPpm(projectId);
    const data: any = {};
    if (body?.items !== undefined) data.items = body.items;
    if (body?.agencyApproved !== undefined) data.agencyApproved = !!body.agencyApproved;
    if (body?.clientApproved !== undefined) data.clientApproved = !!body.clientApproved;
    const cur: any = await px.ppmChecklist.findUnique({ where: { projectId } }).catch(() => null);
    const agency = data.agencyApproved ?? cur?.agencyApproved; const client = data.clientApproved ?? cur?.clientApproved;
    if (agency && client) { data.status = 'APPROVED'; data.approvedAt = new Date(); } else { data.status = 'DRAFT'; data.approvedAt = null; }
    return px.ppmChecklist.update({ where: { projectId }, data });
  }
}
