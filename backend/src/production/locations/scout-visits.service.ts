import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-07 V2 · Slice 2 — Scout Visit (the field event + scout call sheet).
 * Generalizes per-location TechRecce into a multi-stop day: a visit has a route of
 * stops (each over a LocationNeed and/or a candidate Location), a party (crew/users
 * scouting), and printable scout-call-sheet data. Dual-target: projectId null = a
 * master/library-scope visit that never touches a project. Plain-FK pattern keeps the
 * big Project/Location/Crew models untouched (resolved in the service).
 */
@Injectable()
export class ScoutVisitsService {
  constructor(private prisma: PrismaService) {}

  private readonly VISIT_TYPES = ['RECON', 'PRELIMINARY', 'TECH_RECCE'];
  private readonly VISIT_STATUSES = ['PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

  /** All visits for a scope (project or, when projectId omitted, the master/library scope). */
  async list(projectId?: string) {
    const where = projectId ? { projectId } : { projectId: null };
    const visits = await this.prisma.scoutVisit.findMany({
      where,
      include: {
        stops: { orderBy: { ordering: 'asc' } },
        members: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
    });
    return this.enrich(visits);
  }

  async get(id: string) {
    const visit = await this.prisma.scoutVisit.findUnique({
      where: { id },
      include: { stops: { orderBy: { ordering: 'asc' } }, members: { orderBy: { createdAt: 'asc' } } },
    });
    if (!visit) throw new BadRequestException('Scout visit not found.');
    const [enriched] = await this.enrich([visit]);
    return enriched;
  }

  /** Resolve plain-FK names (Need + Location) for stops so the UI/call-sheet can render. */
  private async enrich(visits: any[]) {
    const needIds = Array.from(new Set(visits.flatMap(v => v.stops.map((s: any) => s.needId).filter(Boolean))));
    const locIds = Array.from(new Set(visits.flatMap(v => v.stops.map((s: any) => s.locationId).filter(Boolean))));
    const [needs, locs] = await Promise.all([
      needIds.length ? this.prisma.locationNeed.findMany({ where: { id: { in: needIds } }, select: { id: true, name: true, intExt: true, sceneRefs: true } }) : [],
      locIds.length ? this.prisma.location.findMany({ where: { id: { in: locIds } }, select: { id: true, name: true, emirate: true, area: true, fullAddress: true, googleMapsUrl: true, lat: true, lng: true, ownerContactName: true, ownerPhone: true } }) : [],
    ]);
    const needMap = new Map(needs.map(n => [n.id, n] as const));
    const locMap = new Map(locs.map(l => [l.id, l] as const));
    return visits.map(v => ({
      ...v,
      stops: v.stops.map((s: any) => ({ ...s, need: s.needId ? needMap.get(s.needId) || null : null, location: s.locationId ? locMap.get(s.locationId) || null : null })),
    }));
  }

  async create(body: any) {
    if (!body?.title) throw new BadRequestException('A visit title is required.');
    const type = this.VISIT_TYPES.includes(body.type) ? body.type : 'RECON';
    return this.prisma.scoutVisit.create({
      data: {
        projectId: body.projectId || null,
        masterLocationId: body.masterLocationId || null,
        title: body.title,
        type,
        purpose: body.purpose || null,
        date: body.date ? new Date(body.date) : null,
        callTime: body.callTime || null,
        meetingPoint: body.meetingPoint || null,
        notes: body.notes || null,
        createdById: body.createdById || null,
      },
    });
  }

  updateVisit(id: string, data: any) {
    const d: any = {};
    if (data?.title !== undefined) d.title = data.title;
    if (data?.type !== undefined && this.VISIT_TYPES.includes(data.type)) d.type = data.type;
    if (data?.status !== undefined && this.VISIT_STATUSES.includes(data.status)) d.status = data.status;
    if (data?.purpose !== undefined) d.purpose = data.purpose;
    if (data?.date !== undefined) d.date = data.date ? new Date(data.date) : null;
    if (data?.callTime !== undefined) d.callTime = data.callTime;
    if (data?.meetingPoint !== undefined) d.meetingPoint = data.meetingPoint;
    if (data?.notes !== undefined) d.notes = data.notes;
    if (data?.transportRequested !== undefined) d.transportRequested = !!data.transportRequested;
    return this.prisma.scoutVisit.update({ where: { id }, data: d });
  }

  remove(id: string) { return this.prisma.scoutVisit.delete({ where: { id } }); }

  // ── Stops (the route) ─────────────────────────────────────────────────────
  async addStop(visitId: string, body: any) {
    const visit = await this.prisma.scoutVisit.findUnique({ where: { id: visitId } });
    if (!visit) throw new BadRequestException('Scout visit not found.');
    if (!body?.needId && !body?.locationId && !body?.label) throw new BadRequestException('A stop needs a Need, a Location, or a label.');
    const max = await this.prisma.scoutVisitStop.aggregate({ where: { visitId }, _max: { ordering: true } });
    return this.prisma.scoutVisitStop.create({
      data: {
        visitId,
        needId: body.needId || null,
        locationId: body.locationId || null,
        label: body.label || null,
        ordering: (max._max.ordering ?? -1) + 1,
        arriveAt: body.arriveAt || null,
        departAt: body.departAt || null,
        notes: body.notes || null,
      },
    });
  }

  updateStop(id: string, data: any) {
    const d: any = {};
    if (data?.needId !== undefined) d.needId = data.needId || null;
    if (data?.locationId !== undefined) d.locationId = data.locationId || null;
    if (data?.label !== undefined) d.label = data.label;
    if (data?.ordering !== undefined) d.ordering = Number(data.ordering);
    if (data?.arriveAt !== undefined) d.arriveAt = data.arriveAt;
    if (data?.departAt !== undefined) d.departAt = data.departAt;
    if (data?.notes !== undefined) d.notes = data.notes;
    if (data?.techRecceId !== undefined) d.techRecceId = data.techRecceId || null;
    return this.prisma.scoutVisitStop.update({ where: { id }, data: d });
  }

  removeStop(id: string) { return this.prisma.scoutVisitStop.delete({ where: { id } }); }

  /** Reorder a visit's stops to the given array of stop ids. */
  async reorderStops(visitId: string, ids: string[]) {
    if (!Array.isArray(ids)) throw new BadRequestException('ids must be an array.');
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.scoutVisitStop.update({ where: { id }, data: { ordering: i } })));
    return { ok: true };
  }

  // ── Party (scout team) ────────────────────────────────────────────────────
  /** Add a party member explicitly, or pull denormalized details from a ProductionCrew row. */
  async addMember(visitId: string, body: any) {
    const visit = await this.prisma.scoutVisit.findUnique({ where: { id: visitId } });
    if (!visit) throw new BadRequestException('Scout visit not found.');
    let data: any = {
      visitId,
      crewId: body.crewId || null,
      userId: body.userId || null,
      name: body.name || null,
      department: body.department || null,
      roleTitle: body.roleTitle || null,
      phone: body.phone || null,
      email: body.email || null,
      isLead: !!body.isLead,
    };
    if (body.crewId) {
      const crew = await this.prisma.productionCrew.findUnique({ where: { id: body.crewId } });
      if (crew) {
        data.name = data.name || crew.name;
        data.department = data.department || crew.department || null;
        data.roleTitle = data.roleTitle || crew.roleTitle || null;
        data.phone = data.phone || crew.mobile || null;
        data.email = data.email || crew.email || null;
        data.userId = data.userId || crew.userId || null;
      }
    }
    if (!data.name) throw new BadRequestException('A member name (or a valid crewId) is required.');
    const dupe = body.crewId ? await this.prisma.scoutVisitMember.findFirst({ where: { visitId, crewId: body.crewId } }) : null;
    if (dupe) return dupe;
    return this.prisma.scoutVisitMember.create({ data });
  }

  updateMember(id: string, data: any) {
    const d: any = {};
    for (const k of ['name', 'department', 'roleTitle', 'phone', 'email']) if (data?.[k] !== undefined) d[k] = data[k];
    if (data?.isLead !== undefined) d.isLead = !!data.isLead;
    return this.prisma.scoutVisitMember.update({ where: { id }, data: d });
  }

  removeMember(id: string) { return this.prisma.scoutVisitMember.delete({ where: { id } }); }

  /** Candidate crew for the party picker — the project's crew roster (party scope). */
  crewPool(projectId: string) {
    return this.prisma.productionCrew.findMany({
      where: { projectId },
      select: { id: true, name: true, department: true, roleTitle: true, mobile: true, email: true, userId: true },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * SYS-07 V2 · Slice 9 — master-scope "available options" for a standalone (project-less)
   * scout day: the crew directory, the available house fleet (vehicles + drivers), and the
   * master-library location candidates to build the route from.
   */
  async masterOptions() {
    const [crew, vehicles, drivers, masterLocations] = await Promise.all([
      this.prisma.crewMember.findMany({
        select: { id: true, name: true, department: true, role: true, phone: true, email: true, photoUrl: true },
        orderBy: [{ department: 'asc' }, { name: 'asc' }],
        take: 500,
      }),
      this.prisma.transportVehicle.findMany({
        where: { projectId: null, isActive: true, status: 'AVAILABLE' },
        select: { id: true, make: true, model: true, plateNumber: true, capacity: true, vehicleType: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transportDriver.findMany({
        where: { isActive: true },
        select: { id: true, fullName: true, mobile: true },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.masterLocation.findMany({
        select: { id: true, name: true, region: true, city: true, category: true, status: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
    ]);
    return {
      crew, vehicles, drivers, masterLocations,
      counts: { crew: crew.length, vehicles: vehicles.length, drivers: drivers.length, masterLocations: masterLocations.length },
    };
  }

  /** Headcount for transport request alignment (S5 hook). */
  async headcount(visitId: string) {
    const n = await this.prisma.scoutVisitMember.count({ where: { visitId } });
    return { headcount: n };
  }

  /** Scout call-sheet payload — everything the printable/sendable sheet needs. */
  async callSheet(id: string) {
    const visit = await this.get(id);
    let projectName: string | null = null;
    if (visit.projectId) {
      const p = await this.prisma.productionProject.findUnique({ where: { id: visit.projectId }, select: { title: true } });
      projectName = p?.title || null;
    }
    return {
      visit: {
        id: visit.id, title: visit.title, type: visit.type, purpose: visit.purpose,
        date: visit.date, callTime: visit.callTime, meetingPoint: visit.meetingPoint,
        status: visit.status, notes: visit.notes, projectName,
      },
      stops: visit.stops.map((s: any, i: number) => ({
        order: i + 1,
        need: s.need?.name || null,
        intExt: s.need?.intExt || null,
        sceneRefs: s.need?.sceneRefs || null,
        location: s.location?.name || s.label || null,
        address: s.location?.fullAddress || null,
        area: [s.location?.area, s.location?.emirate].filter(Boolean).join(', ') || null,
        googleMapsUrl: s.location?.googleMapsUrl || null,
        contactName: s.location?.ownerContactName || null,
        contactPhone: s.location?.ownerPhone || null,
        arriveAt: s.arriveAt, departAt: s.departAt, notes: s.notes,
      })),
      party: visit.members.map((m: any) => ({ name: m.name, department: m.department, roleTitle: m.roleTitle, phone: m.phone, email: m.email, isLead: m.isLead })),
      headcount: visit.members.length,
    };
  }

  // ── SYS-07 V2 · Slice 4 — Transport request alignment ──────────────────────
  /**
   * Raise a transport request sized by the scout party. Creates a REQUESTED TransportOrder
   * (the request the transport team accepts on their movement board — cleaner audit than a
   * silent order) and links it back to the visit. Crew aren't identity-tracked travelers, so
   * the party is captured in passengerNote (count + names).
   */
  async requestTransport(visitId: string, body: any) {
    const visit = await this.prisma.scoutVisit.findUnique({ where: { id: visitId }, include: { members: { orderBy: { createdAt: 'asc' } } } });
    if (!visit) throw new NotFoundException('Scout visit not found.');
    if (!visit.members.length) throw new BadRequestException('Assign a party first — there is no headcount to transport.');

    // If a live request already exists, re-size it instead of duplicating.
    if (visit.transportOrderId) {
      const existing = await this.prisma.transportOrder.findUnique({ where: { id: visit.transportOrderId } });
      if (existing && existing.status !== 'CANCELLED' && existing.status !== 'COMPLETED') {
        const updated = await this.prisma.transportOrder.update({ where: { id: existing.id }, data: { passengerNote: this.partyNote(visit.members), scheduledAt: visit.date || existing.scheduledAt } });
        return { order: updated, resized: true };
      }
    }

    const order = await this.prisma.transportOrder.create({
      data: {
        projectId: visit.projectId || null,
        type: 'CREW_SHUTTLE',
        status: 'REQUESTED',
        scheduledAt: visit.date || null,
        fromLocation: visit.meetingPoint || null,
        toLocation: body?.toLocation || null,
        purpose: `Scout visit — ${visit.title}`,
        passengerNote: this.partyNote(visit.members),
        notes: body?.notes || null,
        createdById: body?.createdById || null,
      },
    });
    await this.prisma.scoutVisit.update({ where: { id: visitId }, data: { transportRequested: true, transportOrderId: order.id } });
    return { order, resized: false };
  }

  private partyNote(members: { name: string; isLead: boolean }[]) {
    const names = members.map(m => (m.isLead ? `${m.name} (lead)` : m.name)).join(', ');
    return `${members.length} scout${members.length === 1 ? '' : 's'}: ${names}`;
  }

  /** Read the linked transport order's status (+ vehicle/driver) for the visit screen. */
  async transportStatus(visitId: string) {
    const visit = await this.prisma.scoutVisit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Scout visit not found.');
    if (!visit.transportOrderId) return { requested: false };
    const order = await this.prisma.transportOrder.findUnique({
      where: { id: visit.transportOrderId },
      include: { vehicle: { select: { make: true, model: true, plateNumber: true, capacity: true } }, driver: { select: { fullName: true, mobile: true } } },
    });
    if (!order) return { requested: false };
    const partyCount = await this.prisma.scoutVisitMember.count({ where: { visitId } });
    const requestedCount = (order.passengerNote?.match(/^(\d+)/)?.[1]) ? Number(order.passengerNote!.match(/^(\d+)/)![1]) : null;
    return {
      requested: true,
      orderId: order.id,
      status: order.status,
      scheduledAt: order.scheduledAt,
      vehicle: order.vehicle || null,
      driver: order.driver || null,
      passengerNote: order.passengerNote,
      needsResize: requestedCount !== null && requestedCount !== partyCount, // party changed since request
      partyCount,
    };
  }

  /** Cancel the linked transport request. */
  async cancelTransport(visitId: string) {
    const visit = await this.prisma.scoutVisit.findUnique({ where: { id: visitId } });
    if (!visit?.transportOrderId) throw new BadRequestException('No transport request to cancel.');
    await this.prisma.transportOrder.update({ where: { id: visit.transportOrderId }, data: { status: 'CANCELLED' } });
    await this.prisma.scoutVisit.update({ where: { id: visitId }, data: { transportRequested: false, transportOrderId: null } });
    return { ok: true };
  }
}
