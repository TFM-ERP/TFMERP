import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ENGAGED_STATUSES } from '../casting/pipeline';

/**
 * SYS-12.D — Shuttle & bus scheduling.
 *
 * Recurring multi-stop routes with an assigned vehicle + driver (SYS-12.C), an
 * ordered set of stops, and a regular-rider manifest (universal TravelerProfile).
 * Capacity = route override OR the assigned vehicle's capacity.
 */
@Injectable()
export class ShuttleService {
  constructor(private prisma: PrismaService) {}

  private routeInclude = {
    vehicle: { select: { id: true, vehicleType: true, make: true, model: true, plateNumber: true, capacity: true, source: true } },
    driver: { select: { id: true, fullName: true, mobile: true } },
    stops: { orderBy: { sequence: 'asc' as const } },
    _count: { select: { riders: true, stops: true } },
  };

  // ── Routes ───────────────────────────────────────────────────────────────────
  listRoutes(query: { projectId?: string; scope?: string } = {}) {
    const where: any = {};
    if (query.projectId) where.projectId = query.projectId;
    else if (query.scope === 'standalone') where.projectId = null;
    return this.prisma.shuttleRoute.findMany({ where, orderBy: [{ status: 'asc' }, { departureTime: 'asc' }], include: this.routeInclude });
  }

  async getRoute(id: string) {
    const route = await this.prisma.shuttleRoute.findUnique({
      where: { id },
      include: {
        vehicle: { select: { id: true, vehicleType: true, make: true, model: true, plateNumber: true, capacity: true, source: true } },
        driver: { select: { id: true, fullName: true, mobile: true } },
        stops: { orderBy: { sequence: 'asc' } },
        riders: { include: { traveler: { select: { id: true, fullName: true, personType: true } }, pickupStop: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!route) throw new NotFoundException();
    const capacity = route.capacity ?? route.vehicle?.capacity ?? null;
    return { ...route, capacity, seatsUsed: route.riders.length, seatsLeft: capacity != null ? capacity - route.riders.length : null };
  }

  createRoute(d: any) {
    if (!d?.name) throw new BadRequestException('name is required');
    return this.prisma.shuttleRoute.create({ data: this.cleanRoute(d) });
  }
  updateRoute(id: string, d: any) { return this.prisma.shuttleRoute.update({ where: { id }, data: this.cleanRoute(d, true) }); }
  removeRoute(id: string) { return this.prisma.shuttleRoute.delete({ where: { id } }); }
  private cleanRoute(d: any, partial = false) {
    const out: any = {
      projectId: d.projectId ?? (partial ? undefined : null),
      name: d.name ?? undefined, frequency: d.frequency ?? undefined,
      daysOfWeek: Array.isArray(d.daysOfWeek) ? d.daysOfWeek : undefined,
      departureTime: d.departureTime ?? null,
      capacity: d.capacity != null && d.capacity !== '' ? Number(d.capacity) : (partial ? undefined : null),
      vehicleId: d.vehicleId ?? (partial ? undefined : null),
      driverId: d.driverId ?? (partial ? undefined : null),
      status: d.status ?? undefined, notes: d.notes ?? null,
    };
    if (partial) Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }

  // ── Stops ────────────────────────────────────────────────────────────────────
  async addStop(routeId: string, d: any) {
    if (!d?.name) throw new BadRequestException('stop name is required');
    const count = await this.prisma.shuttleStop.count({ where: { routeId } });
    return this.prisma.shuttleStop.create({
      data: { routeId, sequence: d.sequence != null ? Number(d.sequence) : count + 1, name: d.name, arrivalTime: d.arrivalTime ?? null, gpsCoordinates: d.gpsCoordinates ?? null, notes: d.notes ?? null },
    });
  }
  updateStop(id: string, d: any) {
    const data: any = {};
    for (const k of ['name', 'arrivalTime', 'gpsCoordinates', 'notes']) if (d[k] !== undefined) data[k] = d[k] || null;
    if (d.sequence !== undefined) data.sequence = Number(d.sequence);
    return this.prisma.shuttleStop.update({ where: { id }, data });
  }
  removeStop(id: string) { return this.prisma.shuttleStop.delete({ where: { id } }); }
  /** Re-order: accepts an array of stop ids in the desired order. */
  async reorderStops(routeId: string, ids: string[]) {
    if (!Array.isArray(ids)) throw new BadRequestException('ids[] required');
    await this.prisma.$transaction(ids.map((id, i) => this.prisma.shuttleStop.update({ where: { id }, data: { sequence: i + 1 } })));
    return this.prisma.shuttleStop.findMany({ where: { routeId }, orderBy: { sequence: 'asc' } });
  }

  // ── Riders / manifest ────────────────────────────────────────────────────────
  async addRider(routeId: string, d: any) {
    if (!d?.travelerId) throw new BadRequestException('travelerId is required');
    // Capacity guard.
    const route = await this.getRoute(routeId);
    if (route.seatsLeft != null && route.seatsLeft <= 0) throw new BadRequestException('Shuttle is at capacity');
    return this.prisma.shuttleRider.upsert({
      where: { routeId_travelerId: { routeId, travelerId: d.travelerId } },
      create: { routeId, travelerId: d.travelerId, pickupStopId: d.pickupStopId || null, notes: d.notes || null },
      update: { pickupStopId: d.pickupStopId || null, notes: d.notes || null },
    });
  }
  removeRider(id: string) { return this.prisma.shuttleRider.delete({ where: { id } }); }

  /** Printable-style manifest: riders grouped by pickup stop. */
  async manifest(routeId: string) {
    const route = await this.getRoute(routeId);
    const byStop: Record<string, any[]> = { unassigned: [] };
    for (const s of route.stops) byStop[s.id] = [];
    for (const r of route.riders as any[]) (byStop[r.pickupStopId || 'unassigned'] ||= []).push(r);
    return { route, byStop };
  }

  /** People linked to the project (rider picker) — trips or confirmed casting. */
  projectTravelers(projectId: string) {
    if (!projectId) throw new BadRequestException('projectId is required');
    return this.prisma.travelerProfile.findMany({
      where: {
        OR: [
          { trips: { some: { projectId } } },
          { talentProfile: { submissions: { some: { status: { in: ENGAGED_STATUSES as any }, castingCall: { projectId } } } } },
          { accommodationAssignments: { some: { projectId } } },
        ],
      },
      select: { id: true, fullName: true, personType: true },
      orderBy: { fullName: 'asc' },
      take: 300,
    });
  }
}
