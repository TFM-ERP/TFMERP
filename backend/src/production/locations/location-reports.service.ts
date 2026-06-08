import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-07 V2 · Slice 6 — Photo plates → Location Report, lookbook, and the option-comparison
 * deck with director sign-off. Plates are purpose-tagged field photos per Location (optionally
 * per scout visit); scene/shot refs make them reusable previs/storyboard references.
 */
@Injectable()
export class LocationReportsService {
  constructor(private prisma: PrismaService) {}

  static readonly PURPOSES = ['APPROACH', 'WIDE', 'FEATURE', 'SIGHTLINE', 'INFRASTRUCTURE', 'PROBLEM', 'AMBIENT', 'REFERENCE'];

  // ── Plates CRUD ─────────────────────────────────────────────────────────────
  listPlates(filter: { locationId?: string; visitId?: string; projectId?: string }) {
    const where: any = {};
    if (filter.locationId) where.locationId = filter.locationId;
    if (filter.visitId) where.visitId = filter.visitId;
    if (filter.projectId) where.projectId = filter.projectId;
    return this.prisma.photoPlate.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  async createPlate(body: any) {
    if (!body?.url) throw new BadRequestException('A plate needs an image url.');
    const purpose = LocationReportsService.PURPOSES.includes(body.purpose) ? body.purpose : 'WIDE';
    return this.prisma.photoPlate.create({
      data: {
        projectId: body.projectId || null,
        locationId: body.locationId || null,
        visitId: body.visitId || null,
        url: body.url,
        thumbnailUrl: body.thumbnailUrl || null,
        purpose,
        caption: body.caption || null,
        department: body.department || null,
        timeOfDay: body.timeOfDay || null,
        sceneRef: body.sceneRef || null,
        shotRef: body.shotRef || null,
        lat: body.lat != null ? Number(body.lat) : null,
        lng: body.lng != null ? Number(body.lng) : null,
        capturedAt: body.capturedAt ? new Date(body.capturedAt) : null,
        uploadedById: body.uploadedById || null,
      },
    });
  }

  updatePlate(id: string, data: any) {
    const d: any = {};
    for (const k of ['caption', 'department', 'timeOfDay', 'sceneRef', 'shotRef', 'thumbnailUrl']) if (data?.[k] !== undefined) d[k] = data[k];
    if (data?.purpose !== undefined && LocationReportsService.PURPOSES.includes(data.purpose)) d.purpose = data.purpose;
    if (data?.sortOrder !== undefined) d.sortOrder = Number(data.sortOrder);
    return this.prisma.photoPlate.update({ where: { id }, data: d });
  }

  removePlate(id: string) { return this.prisma.photoPlate.delete({ where: { id } }); }

  async reorderPlates(ids: string[]) {
    if (!Array.isArray(ids)) throw new BadRequestException('ids must be an array.');
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.photoPlate.update({ where: { id }, data: { sortOrder: i } })));
    return { ok: true };
  }

  // ── Location Report ──────────────────────────────────────────────────────────
  /** Assemble the tagged Location Report: plates by purpose + recce/eval/permits/logistics. */
  async report(locationId: string) {
    const loc = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: {
        techRecces: { include: { notes: true }, orderBy: { reccedAt: 'desc' } },
        evaluations: { orderBy: { createdAt: 'desc' }, take: 1 },
        permits: { orderBy: { createdAt: 'desc' } },
        risks: { orderBy: { riskScore: 'desc' } },
        masterLocation: { select: { id: true, name: true } },
      },
    });
    if (!loc) throw new NotFoundException('Location not found.');
    const plates = await this.prisma.photoPlate.findMany({ where: { locationId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    const platesByPurpose: Record<string, any[]> = {};
    for (const p of LocationReportsService.PURPOSES) platesByPurpose[p] = [];
    for (const pl of plates) (platesByPurpose[pl.purpose] ||= []).push(pl);

    // Department concern rollup (mirrors the assessment rollup, computed locally).
    const notes = loc.techRecces.flatMap(r => r.notes);
    const blockers = notes.filter(n => (n.severity === 'BLOCKER' || n.severity === 'HIGH') && !n.resolved).map(n => ({ department: n.department, note: n.note || n.actionItem, severity: n.severity }));
    const openActions = notes.filter(n => n.actionItem && !n.resolved).map(n => ({ department: n.department, actionItem: n.actionItem }));

    return {
      location: {
        id: loc.id, name: loc.name, type: loc.type, status: loc.status,
        emirate: loc.emirate, area: loc.area, fullAddress: loc.fullAddress,
        lat: loc.lat, lng: loc.lng, googleMapsUrl: loc.googleMapsUrl, scenes: loc.scenes,
      },
      logistics: {
        parkingNotes: loc.parkingNotes, basecampNotes: loc.basecampNotes, accessNotes: loc.accessNotes,
        facilities: loc.facilities, restrictions: loc.restrictions,
        hospital: { name: loc.nearestHospitalName, address: loc.nearestHospitalAddress, phone: loc.nearestHospitalPhone },
      },
      money: { feePerDay: loc.locationFeePerDay, currency: loc.currency },
      plateCount: plates.length,
      platesByPurpose,
      evaluation: loc.evaluations[0] || null,
      recceCount: loc.techRecces.length,
      blockers, openActions,
      permits: loc.permits, risks: loc.risks,
      generatedAt: new Date(),
    };
  }

  /** Lookbook / storyboard reference — scene-tagged plates grouped by scene then shot. */
  async lookbook(filter: { locationId?: string; projectId?: string }) {
    const where: any = { sceneRef: { not: null } };
    if (filter.locationId) where.locationId = filter.locationId;
    if (filter.projectId) where.projectId = filter.projectId;
    const plates = await this.prisma.photoPlate.findMany({ where, orderBy: [{ sceneRef: 'asc' }, { shotRef: 'asc' }, { sortOrder: 'asc' }] });
    const byScene: Record<string, any[]> = {};
    for (const p of plates) (byScene[p.sceneRef as string] ||= []).push(p);
    return { sceneCount: Object.keys(byScene).length, plateCount: plates.length, byScene };
  }

  /** Storyboard-reference API: flat list of scene/shot-tagged plates for a location/project. */
  storyboardPlates(filter: { locationId?: string; projectId?: string; sceneRef?: string }) {
    const where: any = {};
    if (filter.locationId) where.locationId = filter.locationId;
    if (filter.projectId) where.projectId = filter.projectId;
    if (filter.sceneRef) where.sceneRef = filter.sceneRef;
    return this.prisma.photoPlate.findMany({ where, orderBy: [{ sceneRef: 'asc' }, { shotRef: 'asc' }] });
  }

  // ── Option-comparison deck + director sign-off ───────────────────────────────
  /** Build the comparison deck for a Need's candidate options (for director sign-off). */
  async compareNeed(needId: string) {
    const need = await this.prisma.locationNeed.findUnique({ where: { id: needId }, include: { options: { orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }] } } });
    if (!need) throw new NotFoundException('Need not found.');
    const locIds = need.options.map(o => o.locationId);
    const locs = locIds.length
      ? await this.prisma.location.findMany({
          where: { id: { in: locIds } },
          include: { evaluations: { orderBy: { createdAt: 'desc' }, take: 1 }, techRecces: { include: { notes: true } } },
        })
      : [];
    const locMap = new Map(locs.map(l => [l.id, l] as const));
    const platesByLoc = new Map<string, any[]>();
    if (locIds.length) {
      const plates = await this.prisma.photoPlate.findMany({ where: { locationId: { in: locIds } }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
      for (const p of plates) { const a = platesByLoc.get(p.locationId as string) || []; a.push(p); platesByLoc.set(p.locationId as string, a); }
    }
    const options = need.options.map(o => {
      const l = locMap.get(o.locationId);
      const ev = l?.evaluations?.[0];
      const notes = (l?.techRecces || []).flatMap(r => r.notes);
      const blockers = notes.filter(n => (n.severity === 'BLOCKER' || n.severity === 'HIGH') && !n.resolved).length;
      return {
        optionId: o.id, locationId: o.locationId, isSelected: o.isSelected, optionStatus: o.optionStatus, rank: o.rank,
        name: l?.name || '—', emirate: l?.emirate || null, area: l?.area || null,
        weightedScore: ev ? Number(ev.weightedScore) : null, recommendation: ev?.recommendation || null,
        plates: (platesByLoc.get(o.locationId) || []).slice(0, 6),
        plateCount: (platesByLoc.get(o.locationId) || []).length,
        blockers,
      };
    });
    options.sort((a, b) => (b.weightedScore ?? -1) - (a.weightedScore ?? -1));
    return {
      need: { id: need.id, name: need.name, intExt: need.intExt, sceneRefs: need.sceneRefs, status: need.status,
        signOffStatus: need.signOffStatus, signOffBy: need.signOffBy, signOffAt: need.signOffAt, signOffNote: need.signOffNote },
      options,
    };
  }

  /** Director sign-off on the comparison (gate before lock). */
  signOffNeed(needId: string, body: any) {
    const status = ['PENDING', 'APPROVED', 'REJECTED'].includes(body?.status) ? body.status : 'APPROVED';
    return this.prisma.locationNeed.update({
      where: { id: needId },
      data: { signOffStatus: status, signOffBy: body?.by || null, signOffAt: new Date(), signOffNote: body?.note || null },
    });
  }
}
