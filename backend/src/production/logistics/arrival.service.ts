import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ENGAGED_STATUSES } from '../casting/pipeline';

/**
 * SYS-12.F — Arrival operations.
 *
 * Extends the SYS-11 TravelArrival into a real-time meet-&-greet pipeline:
 * Scheduled → Landed → Collected → Checked-in → Completed (or No-show). Each
 * transition stamps a timestamp. Vehicle & driver reuse SYS-12.C.
 */
const FLOW = ['SCHEDULED', 'LANDED', 'COLLECTED', 'CHECKED_IN', 'COMPLETED'];

@Injectable()
export class ArrivalService {
  constructor(private prisma: PrismaService) {}

  private include = {
    traveler: { select: { id: true, fullName: true, personType: true, nationality: true, photoUrl: true } },
    vehicle: { select: { id: true, vehicleType: true, make: true, model: true, plateNumber: true } },
    transportDriver: { select: { id: true, fullName: true, mobile: true } },
  };

  list(query: { projectId?: string; scope?: string; date?: string; status?: string } = {}) {
    const where: any = {};
    if (query.projectId) where.projectId = query.projectId;
    else if (query.scope === 'standalone') where.projectId = null;
    if (query.status) where.status = query.status;
    if (query.date) {
      where.arrivalTime = { gte: new Date(query.date + 'T00:00:00'), lte: new Date(query.date + 'T23:59:59.999') };
    }
    return this.prisma.travelArrival.findMany({ where, orderBy: { arrivalTime: 'asc' }, include: this.include });
  }

  async create(d: any) {
    if (!d?.travelerId) throw new BadRequestException('travelerId is required');
    return this.prisma.travelArrival.create({
      data: {
        travelerId: d.travelerId, projectId: d.projectId || null, tripId: d.tripId || null,
        airport: d.airport || null, flightNumber: d.flightNumber || null,
        arrivalTime: d.arrivalTime ? new Date(d.arrivalTime) : null, terminal: d.terminal || null,
        meetGreetRep: d.meetGreetRep || d.coordinatorAssigned || null, coordinatorAssigned: d.coordinatorAssigned || null,
        vehicleId: d.vehicleId || null, transportDriverId: d.transportDriverId || null,
        status: d.status || 'SCHEDULED', notes: d.notes || null,
      },
      include: this.include,
    });
  }

  async update(id: string, d: any) {
    const cur = await this.prisma.travelArrival.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException();
    const data: any = {};
    for (const k of ['airport', 'flightNumber', 'terminal', 'meetGreetRep', 'coordinatorAssigned', 'vehicleId', 'transportDriverId', 'arrivalPhotoUrl', 'notes'])
      if (d[k] !== undefined) data[k] = d[k] || null;
    if (d.arrivalTime !== undefined) data.arrivalTime = d.arrivalTime ? new Date(d.arrivalTime) : null;
    if (d.projectId !== undefined) data.projectId = d.projectId || null;
    if (d.status !== undefined) Object.assign(data, this.stampFor(d.status, cur));
    return this.prisma.travelArrival.update({ where: { id }, data, include: this.include });
  }

  /** Advance one step along the pipeline. */
  async advance(id: string) {
    const cur = await this.prisma.travelArrival.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException();
    const i = FLOW.indexOf(cur.status as string);
    if (i < 0 || i >= FLOW.length - 1) return cur; // already complete or off-flow (NO_SHOW/CANCELLED)
    const next = FLOW[i + 1];
    return this.prisma.travelArrival.update({ where: { id }, data: this.stampFor(next, cur), include: this.include });
  }

  /** Compute the status + the timeline stamp for a transition. */
  private stampFor(status: string, cur: any) {
    const out: any = { status };
    const now = new Date();
    if (status === 'LANDED' && !cur.landedAt) out.landedAt = now;
    if (status === 'COLLECTED' && !cur.collectedAt) out.collectedAt = now;
    if (status === 'CHECKED_IN' && !cur.checkedInAt) out.checkedInAt = now;
    return out;
  }

  remove(id: string) { return this.prisma.travelArrival.delete({ where: { id } }); }

  /** Real-time arrival dashboard — a day's arrivals grouped by pipeline stage. */
  async dashboard(projectId: string | undefined, date?: string) {
    const list = await this.list({ projectId, date });
    const byStatus: Record<string, any[]> = { SCHEDULED: [], LANDED: [], COLLECTED: [], CHECKED_IN: [], COMPLETED: [], NO_SHOW: [], CANCELLED: [] };
    for (const a of list as any[]) (byStatus[a.status] ||= []).push(a);
    const counts: Record<string, number> = {};
    for (const [s, arr] of Object.entries(byStatus)) counts[s] = arr.length;
    const inProgress = counts.LANDED + counts.COLLECTED;
    return { date: date || null, total: list.length, inProgress, counts, byStatus };
  }

  /** People expected for a project (arrival picker) — confirmed casting or trips. */
  expectedTravelers(projectId: string) {
    if (!projectId) throw new BadRequestException('projectId is required');
    return this.prisma.travelerProfile.findMany({
      where: {
        travelRequired: true,
        arrivals: { none: { projectId } },
        OR: [
          { trips: { some: { projectId } } },
          { talentProfile: { submissions: { some: { status: { in: ENGAGED_STATUSES as any }, castingCall: { projectId } } } } },
        ],
      },
      select: { id: true, fullName: true, personType: true, nationality: true },
      orderBy: { fullName: 'asc' },
      take: 300,
    });
  }
}
