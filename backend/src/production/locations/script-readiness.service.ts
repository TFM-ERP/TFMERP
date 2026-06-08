import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-07 V2 · Slice 8 — Script feedback loop + readiness board.
 * SceneChangeRequest: raised from a recce/scout note against specific scenes, routed to the
 * writer/script dept and tracked to resolution. Readiness board: rolls each project location's
 * recce blockers (S5) + Need sign-off (S6) + permit/availability gating (S7) + open scene
 * changes into one READY / OUTSTANDING / BLOCKED view for the producers.
 */
@Injectable()
export class ScriptReadinessService {
  constructor(private prisma: PrismaService) {}

  private readonly STATUSES = ['OPEN', 'ACK', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
  private readonly PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  // ── Scene-change requests ────────────────────────────────────────────────────
  listRequests(projectId: string, status?: string) {
    return this.prisma.sceneChangeRequest.findMany({
      where: { projectId, ...(status ? { status } : {}) },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createRequest(projectId: string, body: any) {
    if (!body?.title) throw new BadRequestException('A request title is required.');
    return this.prisma.sceneChangeRequest.create({
      data: {
        projectId,
        locationId: body.locationId || null,
        needId: body.needId || null,
        visitId: body.visitId || null,
        recceNoteId: body.recceNoteId || null,
        sceneRefs: body.sceneRefs || null,
        title: body.title,
        detail: body.detail || null,
        reason: body.reason || null,
        department: body.department || null,
        priority: this.PRIORITIES.includes(body.priority) ? body.priority : 'MEDIUM',
        raisedBy: body.raisedBy || null,
        raisedByName: body.raisedByName || null,
      },
    });
  }

  async updateRequest(id: string, data: any) {
    const d: any = {};
    for (const k of ['title', 'detail', 'reason', 'department', 'sceneRefs', 'resolution']) if (data?.[k] !== undefined) d[k] = data[k];
    if (data?.priority !== undefined && this.PRIORITIES.includes(data.priority)) d.priority = data.priority;
    if (data?.status !== undefined && this.STATUSES.includes(data.status)) {
      d.status = data.status;
      if (data.status === 'RESOLVED' || data.status === 'REJECTED') {
        d.resolvedAt = new Date();
        d.resolvedBy = data.resolvedBy || null;
      } else {
        d.resolvedAt = null;
      }
    }
    return this.prisma.sceneChangeRequest.update({ where: { id }, data: d });
  }

  removeRequest(id: string) { return this.prisma.sceneChangeRequest.delete({ where: { id } }); }

  // ── Readiness board ──────────────────────────────────────────────────────────
  async readinessBoard(projectId: string) {
    const [locations, needs, changes] = await Promise.all([
      this.prisma.location.findMany({
        where: { projectId },
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        include: { techRecces: { include: { notes: true } } },
        // permit/availability fields are scalar — included by default
      }),
      this.prisma.locationNeed.findMany({ where: { projectId }, include: { options: true } }),
      this.prisma.sceneChangeRequest.findMany({ where: { projectId, status: { notIn: ['RESOLVED', 'REJECTED'] } } }),
    ]);

    // Map a Location → its Need sign-off (via the Need's selected option pointing at it).
    const signOffByLoc = new Map<string, { name: string; status: string }>();
    for (const n of needs) {
      const sel = n.options.find(o => o.isSelected);
      if (sel) signOffByLoc.set(sel.locationId, { name: n.name, status: n.signOffStatus });
    }
    const changeByLoc = new Map<string, number>();
    for (const c of changes) if (c.locationId) changeByLoc.set(c.locationId, (changeByLoc.get(c.locationId) || 0) + 1);

    const rows = locations.map((loc) => {
      const notes = loc.techRecces.flatMap(r => r.notes);
      const blockers = notes.filter(n => (n.severity === 'BLOCKER' || n.severity === 'HIGH') && !n.resolved).length;
      const openActions = notes.filter(n => n.actionItem && !n.resolved).length;
      const signOff = signOffByLoc.get(loc.id);
      const openChanges = changeByLoc.get(loc.id) || 0;

      // Permit / availability gating (date-agnostic presence check)
      const permitOk = !loc.permitRequired || loc.permitStatus === 'APPROVED';
      const hasWindow = !!(loc.shootStart || loc.shootEnd);

      // Overall readiness
      let readiness: 'READY' | 'OUTSTANDING' | 'BLOCKED';
      if (blockers > 0 || !permitOk || signOff?.status === 'REJECTED' || openChanges > 0) readiness = 'BLOCKED';
      else if (openActions > 0 || signOff?.status !== 'APPROVED' || loc.techRecces.length === 0) readiness = 'OUTSTANDING';
      else readiness = 'READY';

      return {
        locationId: loc.id, name: loc.name, status: loc.status, scenes: loc.scenes,
        recceCount: loc.techRecces.length, blockers, openActions,
        signOff: signOff ? signOff.status : null,
        permitRequired: loc.permitRequired, permitStatus: loc.permitStatus, permitOk, hasWindow,
        openChanges, readiness,
      };
    });

    const summary = {
      total: rows.length,
      ready: rows.filter(r => r.readiness === 'READY').length,
      outstanding: rows.filter(r => r.readiness === 'OUTSTANDING').length,
      blocked: rows.filter(r => r.readiness === 'BLOCKED').length,
      openChangeRequests: changes.length,
    };
    return { summary, rows };
  }
}
