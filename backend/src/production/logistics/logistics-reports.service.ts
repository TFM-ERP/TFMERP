import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-12.G — Logistics & executive reports.
 *
 * Computed views over accommodation, transport, shuttle and arrival data plus
 * the executive roll-up: total accommodation cost, total transport cost,
 * cost-per-person and cost-per-shooting-day. No new tables — pure aggregation.
 */
@Injectable()
export class LogisticsReportsService {
  constructor(private prisma: PrismaService) {}

  private nights(a?: Date | null, b?: Date | null) {
    if (!a || !b) return 0;
    const d = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
    return d > 0 ? d : 0;
  }

  // ── Accommodation ─────────────────────────────────────────────────────────────
  async accommodation(projectId: string) {
    const rows = await this.prisma.accommodationAssignment.findMany({
      where: { projectId },
      include: { room: { select: { nightlyRate: true, currency: true } }, property: { select: { name: true } } },
    });
    let cost = 0, roomNights = 0;
    const byStatus: Record<string, number> = {};
    const byProperty: Record<string, { name: string; people: number; cost: number }> = {};
    for (const a of rows) {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      if (['CANCELLED'].includes(a.status)) continue;
      const n = this.nights(a.checkIn, a.checkOut) || 1;
      const rate = a.room?.nightlyRate ? Number(a.room.nightlyRate) : 0;
      const lineCost = n * rate;
      roomNights += n; cost += lineCost;
      const key = a.propertyId || 'unassigned';
      byProperty[key] ||= { name: a.property?.name || 'Unassigned', people: 0, cost: 0 };
      byProperty[key].people++; byProperty[key].cost += lineCost;
    }
    const peopleHoused = new Set(rows.filter((r) => !['CANCELLED'].includes(r.status)).map((r) => r.travelerId)).size;
    return { assignments: rows.length, peopleHoused, roomNights, cost, byStatus, byProperty: Object.values(byProperty) };
  }

  // ── Transport ─────────────────────────────────────────────────────────────────
  async transport(projectId: string) {
    const orders = await this.prisma.transportOrder.findMany({
      where: { projectId },
      include: { vehicle: { select: { id: true, make: true, model: true, vehicleType: true, plateNumber: true, source: true } }, driver: { select: { id: true, fullName: true } }, _count: { select: { passengers: true } } },
    });
    const byStatus: Record<string, number> = {};
    const vehUtil: Record<string, { label: string; trips: number }> = {};
    const drvUtil: Record<string, { label: string; trips: number }> = {};
    let passengers = 0;
    for (const o of orders) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
      passengers += o._count.passengers;
      if (o.vehicle) { vehUtil[o.vehicle.id] ||= { label: [o.vehicle.make, o.vehicle.model].filter(Boolean).join(' ') || o.vehicle.vehicleType, trips: 0 }; vehUtil[o.vehicle.id].trips++; }
      if (o.driver) { drvUtil[o.driver.id] ||= { label: o.driver.fullName, trips: 0 }; drvUtil[o.driver.id].trips++; }
    }
    // Hired-vehicle cost: dailyRate × hire days for vehicles scoped to the project.
    const vehicles = await this.prisma.transportVehicle.findMany({ where: { OR: [{ projectId }, { orders: { some: { projectId } } }], source: 'HIRED' } });
    let vehicleCost = 0;
    for (const v of vehicles) {
      const days = this.nights(v.rentalStart, v.rentalEnd) || 1;
      if (v.dailyRate) vehicleCost += days * Number(v.dailyRate);
    }
    return {
      movements: orders.length, passengers, byStatus,
      vehicleCost, hiredVehicles: vehicles.length,
      vehicleUtilisation: Object.values(vehUtil).sort((a, b) => b.trips - a.trips),
      driverUtilisation: Object.values(drvUtil).sort((a, b) => b.trips - a.trips),
    };
  }

  // ── Shuttle ───────────────────────────────────────────────────────────────────
  async shuttle(projectId: string) {
    const routes = await this.prisma.shuttleRoute.findMany({ where: { projectId }, include: { vehicle: { select: { capacity: true } }, _count: { select: { riders: true, stops: true } } } });
    const out = routes.map((r) => {
      const cap = r.capacity ?? r.vehicle?.capacity ?? null;
      return { id: r.id, name: r.name, status: r.status, stops: r._count.stops, riders: r._count.riders, capacity: cap, utilisation: cap ? Math.round((r._count.riders / cap) * 100) : null };
    });
    return { routes: out.length, riders: out.reduce((n, r) => n + r.riders, 0), detail: out };
  }

  // ── Arrivals ──────────────────────────────────────────────────────────────────
  async arrivals(projectId: string) {
    const rows = await this.prisma.travelArrival.findMany({ where: { projectId }, select: { status: true } });
    const byStatus: Record<string, number> = {};
    for (const a of rows) byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    return { total: rows.length, completed: byStatus.COMPLETED || 0, byStatus };
  }

  // ── Shoot days (best available source) ────────────────────────────────────────
  private async shootDays(projectId: string): Promise<number | null> {
    const g = await this.prisma.projectGlobalsStaging.findUnique({ where: { projectId }, select: { shootDays: true } });
    if (g?.shootDays) return g.shootDays;
    const p = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { shootStartDate: true, shootEndDate: true } });
    if (p?.shootStartDate && p?.shootEndDate) { const d = this.nights(p.shootStartDate, p.shootEndDate) + 1; if (d > 0) return d; }
    const cs = await this.prisma.callSheet.count({ where: { projectId } });
    return cs || null;
  }

  // ── Executive roll-up ─────────────────────────────────────────────────────────
  async summary(projectId: string) {
    if (!projectId) throw new BadRequestException('projectId is required');
    const [acc, tr, sh, ar, shootDays] = await Promise.all([
      this.accommodation(projectId), this.transport(projectId), this.shuttle(projectId), this.arrivals(projectId), this.shootDays(projectId),
    ]);
    // People in logistics scope = distinct across housed + moved + arrivals.
    const housed = await this.prisma.accommodationAssignment.findMany({ where: { projectId, NOT: { status: 'CANCELLED' } }, select: { travelerId: true } });
    const moved = await this.prisma.transportPassenger.findMany({ where: { order: { projectId } }, select: { travelerId: true } });
    const riders = await this.prisma.shuttleRider.findMany({ where: { route: { projectId } }, select: { travelerId: true } });
    const arrived = await this.prisma.travelArrival.findMany({ where: { projectId }, select: { travelerId: true } });
    const people = new Set([...housed, ...moved, ...riders, ...arrived].map((x) => x.travelerId)).size;

    const totalCost = acc.cost + tr.vehicleCost;
    return {
      shootDays, peopleInScope: people,
      accommodationCost: acc.cost, transportCost: tr.vehicleCost, totalLogisticsCost: totalCost,
      costPerPerson: people ? Math.round(totalCost / people) : null,
      costPerShootDay: shootDays ? Math.round(totalCost / shootDays) : null,
      headline: {
        peopleHoused: acc.peopleHoused, roomNights: acc.roomNights,
        movements: tr.movements, passengersMoved: tr.passengers,
        shuttleRoutes: sh.routes, shuttleRiders: sh.riders,
        arrivals: ar.total, arrivalsCompleted: ar.completed,
      },
      accommodation: acc, transport: tr, shuttle: sh, arrivalsReport: ar,
    };
  }

  /** Cross-project rollup for the master Logistics dashboard. */
  async overview() {
    const projects = await this.prisma.productionProject.findMany({
      where: { isHouse: false, status: { not: 'ARCHIVED' } },
      select: { id: true, title: true, projectNumber: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const rows = [];
    for (const p of projects) {
      const [acc, tr, ar] = await Promise.all([this.accommodation(p.id), this.transport(p.id), this.arrivals(p.id)]);
      const cost = acc.cost + tr.vehicleCost;
      if (acc.assignments + tr.movements + ar.total === 0) continue; // skip projects with no logistics activity
      rows.push({ id: p.id, title: p.title, code: p.projectNumber, peopleHoused: acc.peopleHoused, roomNights: acc.roomNights, movements: tr.movements, arrivals: ar.total, cost });
    }
    const totals = rows.reduce((t, r) => ({ peopleHoused: t.peopleHoused + r.peopleHoused, movements: t.movements + r.movements, arrivals: t.arrivals + r.arrivals, cost: t.cost + r.cost }), { peopleHoused: 0, movements: 0, arrivals: 0, cost: 0 });
    return { projects: rows, totals };
  }
}
