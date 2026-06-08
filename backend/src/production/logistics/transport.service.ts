import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { ENGAGED_STATUSES } from '../casting/pipeline';

/**
 * SYS-12.C — Transport operations.
 *
 * PURPOSE: hire vehicles & drivers from external rental companies FOR a production
 * (distinct from the Rentals module, which rents OUT in-house vehicles/caravans).
 * A TransportVehicle is a thin wrapper that is EITHER in-house (links a fleet Asset)
 * OR hired (links a rental-company Supplier + rate/period). Same for drivers
 * (in-house Driver vs supplier-provided). Movements (TransportOrder) carry identity
 * passengers (TravelerProfile) from A → B and feed the Daily Movement Board.
 */
@Injectable()
export class TransportService {
  constructor(private prisma: PrismaService, private ledger: LedgerService) {}

  // ── Vehicles ─────────────────────────────────────────────────────────────────
  listVehicles(query: { projectId?: string; scope?: string; source?: string } = {}) {
    const where: any = { isActive: true };
    if (query.projectId) where.projectId = query.projectId;
    else if (query.scope === 'standalone') where.projectId = null;
    if (query.source) where.source = query.source;
    return this.prisma.transportVehicle.findMany({
      where, orderBy: [{ source: 'asc' }, { vehicleType: 'asc' }],
      include: {
        supplier: { select: { id: true, name: true, ranking: true } },
        asset: { select: { id: true, name: true, plateNumber: true, plateEmirate: true } },
        project: { select: { title: true } },
        _count: { select: { orders: true } },
      },
    });
  }

  async createVehicle(d: any) {
    if (d?.source === 'IN_HOUSE') {
      if (!d.assetId) throw new BadRequestException('assetId is required for an in-house vehicle');
      const asset = await this.prisma.asset.findUnique({ where: { id: d.assetId } });
      if (!asset) throw new NotFoundException('Asset not found');
      // Inherit display fields from the fleet asset when not overridden.
      d.plateNumber = d.plateNumber ?? asset.plateNumber;
      d.plateEmirate = d.plateEmirate ?? asset.plateEmirate;
      d.make = d.make ?? asset.name;
    } else if (!d?.supplierId) {
      throw new BadRequestException('supplierId (rental company) is required for a hired vehicle');
    }
    return this.prisma.transportVehicle.create({ data: this.cleanVehicle(d) });
  }
  updateVehicle(id: string, d: any) { return this.prisma.transportVehicle.update({ where: { id }, data: this.cleanVehicle(d, true) }); }
  removeVehicle(id: string) { return this.prisma.transportVehicle.update({ where: { id }, data: { isActive: false } }); }
  private cleanVehicle(d: any, partial = false) {
    const num = (v: any) => (v != null && v !== '' ? Number(v) : null);
    const out: any = {
      source: d.source ?? undefined,
      assetId: d.source === 'IN_HOUSE' ? (d.assetId ?? null) : (partial ? undefined : null),
      supplierId: d.source === 'HIRED' ? (d.supplierId ?? null) : (partial && d.supplierId === undefined ? undefined : (d.supplierId ?? null)),
      vehicleType: d.vehicleType ?? undefined,
      make: d.make ?? null, model: d.model ?? null,
      plateNumber: d.plateNumber ?? null, plateEmirate: d.plateEmirate ?? null,
      year: num(d.year), capacity: num(d.capacity), color: d.color ?? null,
      dailyRate: num(d.dailyRate), monthlyRate: num(d.monthlyRate), currency: d.currency ?? undefined,
      rentalStart: d.rentalStart ? new Date(d.rentalStart) : (partial ? undefined : null),
      rentalEnd: d.rentalEnd ? new Date(d.rentalEnd) : (partial ? undefined : null),
      mileageLimit: num(d.mileageLimit), insuranceRef: d.insuranceRef ?? null,
      projectId: d.projectId ?? (partial ? undefined : null),
      status: d.status ?? undefined, notes: d.notes ?? null,
    };
    if (partial) Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }

  /** In-house fleet vehicles available to wrap (not already wrapped). */
  async fleetVehicles() {
    const wrapped = await this.prisma.transportVehicle.findMany({ where: { assetId: { not: null } }, select: { assetId: true } });
    const used = wrapped.map((w) => w.assetId!).filter(Boolean);
    return this.prisma.asset.findMany({
      where: { category: 'VEHICLE', isActive: true, id: { notIn: used.length ? used : ['__none__'] } },
      select: { id: true, name: true, plateNumber: true, plateEmirate: true, status: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Drivers ──────────────────────────────────────────────────────────────────
  listDrivers(query: { source?: string } = {}) {
    const where: any = { isActive: true };
    if (query.source) where.source = query.source;
    return this.prisma.transportDriver.findMany({
      where, orderBy: { fullName: 'asc' },
      include: { supplier: { select: { id: true, name: true } }, driver: { select: { id: true, fullName: true } }, _count: { select: { orders: true } } },
    });
  }
  async createDriver(d: any) {
    if (d?.source === 'IN_HOUSE') {
      if (!d.driverId) throw new BadRequestException('driverId is required for an in-house driver');
      const drv = await this.prisma.driver.findUnique({ where: { id: d.driverId } });
      if (!drv) throw new NotFoundException('Driver not found');
      d.fullName = d.fullName || drv.fullName;
      d.mobile = d.mobile ?? drv.mobile;
      d.licenseNumber = d.licenseNumber ?? drv.licenseNumber;
      d.licenseExpiry = d.licenseExpiry ?? drv.licenseExpiry;
    } else {
      if (!d?.fullName) throw new BadRequestException('fullName is required');
      if (d?.source === 'HIRED' && !d.supplierId) throw new BadRequestException('supplierId (company) is required for a hired driver');
    }
    return this.prisma.transportDriver.create({ data: this.cleanDriver(d) });
  }
  updateDriver(id: string, d: any) { return this.prisma.transportDriver.update({ where: { id }, data: this.cleanDriver(d, true) }); }
  removeDriver(id: string) { return this.prisma.transportDriver.update({ where: { id }, data: { isActive: false } }); }
  private cleanDriver(d: any, partial = false) {
    const out: any = {
      source: d.source ?? undefined,
      driverId: d.source === 'IN_HOUSE' ? (d.driverId ?? null) : (partial && d.driverId === undefined ? undefined : (d.driverId ?? null)),
      supplierId: d.source === 'HIRED' ? (d.supplierId ?? null) : (partial && d.supplierId === undefined ? undefined : (d.supplierId ?? null)),
      fullName: d.fullName ?? undefined, mobile: d.mobile ?? null,
      licenseNumber: d.licenseNumber ?? null,
      licenseExpiry: d.licenseExpiry ? new Date(d.licenseExpiry) : (partial ? undefined : null),
      languages: Array.isArray(d.languages) ? d.languages : undefined,
      notes: d.notes ?? null,
    };
    if (partial) Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
    return out;
  }
  /** In-house fleet drivers available to wrap (not already wrapped). */
  async fleetDrivers() {
    const wrapped = await this.prisma.transportDriver.findMany({ where: { driverId: { not: null } }, select: { driverId: true } });
    const used = wrapped.map((w) => w.driverId!).filter(Boolean);
    return this.prisma.driver.findMany({
      where: { isActive: true, id: { notIn: used.length ? used : ['__none__'] } },
      select: { id: true, fullName: true, mobile: true, licenseNumber: true },
      orderBy: { fullName: 'asc' },
    });
  }

  /** Rental / chauffeur companies for the hired pickers. */
  rentalSuppliers() {
    return this.prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, ranking: true, category: true },
      orderBy: { name: 'asc' },
    });
  }

  // ── Orders / movements ───────────────────────────────────────────────────────
  private orderInclude = {
    vehicle: { select: { id: true, vehicleType: true, make: true, model: true, plateNumber: true, source: true, capacity: true } },
    driver: { select: { id: true, fullName: true, mobile: true, source: true } },
    project: { select: { title: true } },
    passengers: { include: { traveler: { select: { id: true, fullName: true, personType: true } } } },
  };

  listOrders(query: { projectId?: string; scope?: string; date?: string; status?: string } = {}) {
    const where: any = {};
    if (query.projectId) where.projectId = query.projectId;
    else if (query.scope === 'standalone') where.projectId = null;
    if (query.status) where.status = query.status;
    if (query.date) {
      const start = new Date(query.date + 'T00:00:00');
      const end = new Date(query.date + 'T23:59:59.999');
      where.scheduledAt = { gte: start, lte: end };
    }
    return this.prisma.transportOrder.findMany({ where, orderBy: { scheduledAt: 'asc' }, include: this.orderInclude });
  }

  async createOrder(d: any, userId?: string) {
    const order = await this.prisma.transportOrder.create({
      data: {
        projectId: d.projectId || null, type: d.type || 'TALENT_PICKUP',
        fromLocation: d.fromLocation || null, toLocation: d.toLocation || null,
        scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
        vehicleId: d.vehicleId || null, driverId: d.driverId || null,
        status: d.vehicleId && d.driverId ? 'ASSIGNED' : (d.status || 'REQUESTED'),
        purpose: d.purpose || null, passengerNote: d.passengerNote || null, notes: d.notes || null,
        createdById: userId || null,
        passengers: Array.isArray(d.travelerIds) && d.travelerIds.length
          ? { create: d.travelerIds.map((tid: string) => ({ travelerId: tid })) } : undefined,
      },
      include: this.orderInclude,
    });
    return order;
  }

  async updateOrder(id: string, d: any) {
    const cur = await this.prisma.transportOrder.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException();
    const data: any = {};
    for (const k of ['type', 'fromLocation', 'toLocation', 'vehicleId', 'driverId', 'status', 'purpose', 'passengerNote', 'notes'])
      if (d[k] !== undefined) data[k] = d[k] || null;
    if (d.scheduledAt !== undefined) data.scheduledAt = d.scheduledAt ? new Date(d.scheduledAt) : null;
    // Auto-advance to ASSIGNED once both vehicle & driver are set (unless explicitly set).
    const vehId = d.vehicleId !== undefined ? d.vehicleId : cur.vehicleId;
    const drvId = d.driverId !== undefined ? d.driverId : cur.driverId;
    if (d.status === undefined && vehId && drvId && cur.status === 'REQUESTED') data.status = 'ASSIGNED';
    const order = await this.prisma.transportOrder.update({ where: { id }, data, include: this.orderInclude });
    // Keep vehicle status roughly in sync.
    if (vehId) {
      const active = ['ASSIGNED', 'EN_ROUTE'].includes(order.status);
      await this.prisma.transportVehicle.update({ where: { id: vehId }, data: { status: active ? 'ASSIGNED' : 'AVAILABLE' } }).catch(() => {});
    }
    return order;
  }

  removeOrder(id: string) { return this.prisma.transportOrder.delete({ where: { id } }); }

  async addPassenger(orderId: string, travelerId: string) {
    if (!travelerId) throw new BadRequestException('travelerId is required');
    return this.prisma.transportPassenger.upsert({
      where: { orderId_travelerId: { orderId, travelerId } },
      create: { orderId, travelerId }, update: {},
    });
  }
  removePassenger(id: string) { return this.prisma.transportPassenger.delete({ where: { id } }); }

  /** People linked to a project (passenger picker) — via trips or confirmed casting. */
  projectTravelers(projectId: string) {
    if (!projectId) throw new BadRequestException('projectId is required');
    return this.prisma.travelerProfile.findMany({
      where: {
        OR: [
          { trips: { some: { projectId } } },
          { talentProfile: { submissions: { some: { status: { in: ENGAGED_STATUSES as any }, castingCall: { projectId } } } } },
          { transportPassengers: { some: { order: { projectId } } } },
        ],
      },
      select: { id: true, fullName: true, personType: true, nationality: true },
      orderBy: { fullName: 'asc' },
      take: 200,
    });
  }

  /** Daily Movement Board — a day's movements grouped by status + headline counts. */
  async movementBoard(projectId: string | undefined, date: string) {
    const orders = await this.listOrders({ projectId, date });
    const byStatus: Record<string, any[]> = { REQUESTED: [], ASSIGNED: [], EN_ROUTE: [], COMPLETED: [], CANCELLED: [] };
    for (const o of orders as any[]) (byStatus[o.status] ||= []).push(o);
    const counts: Record<string, number> = {};
    for (const [s, arr] of Object.entries(byStatus)) counts[s] = arr.length;
    const passengers = (orders as any[]).reduce((n, o) => n + (o.passengers?.length || 0), 0);
    return { date, total: orders.length, passengers, counts, byStatus };
  }

  // ── SYS-12.E — Fuel logging (reuses FuelLog, broadened to hired vehicles) ──────
  listFuel(query: { projectId?: string; transportVehicleId?: string } = {}) {
    const where: any = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.transportVehicleId) where.transportVehicleId = query.transportVehicleId;
    return this.prisma.fuelLog.findMany({
      where, orderBy: { logDate: 'desc' }, take: 500,
      include: {
        transportVehicle: { select: { id: true, make: true, model: true, plateNumber: true, vehicleType: true } },
        transportDriver: { select: { id: true, fullName: true } },
        asset: { select: { id: true, name: true, plateNumber: true } },
      },
    });
  }

  async addFuel(d: any) {
    const litres = Number(d.litres || 0);
    const cpl = Number(d.costPerLitre || 0);
    if (litres <= 0) throw new BadRequestException('litres must be > 0');
    const totalCost = d.totalCost != null && d.totalCost !== '' ? Number(d.totalCost) : Number((litres * cpl).toFixed(2));
    if (!d.transportVehicleId && !d.assetId) throw new BadRequestException('a vehicle (transportVehicleId or assetId) is required');
    return this.prisma.fuelLog.create({
      data: {
        assetId: d.assetId || null, transportVehicleId: d.transportVehicleId || null,
        projectId: d.projectId || null, transportDriverId: d.transportDriverId || null,
        logDate: d.logDate ? new Date(d.logDate) : new Date(),
        litres, costPerLitre: cpl, totalCost,
        odometer: d.odometer != null && d.odometer !== '' ? Number(d.odometer) : null,
        receiptUrl: d.receiptUrl || null, notes: d.notes || null,
      },
    });
  }
  removeFuel(id: string) { return this.prisma.fuelLog.delete({ where: { id } }); }

  /** Project fuel report: totals + by-vehicle + by-driver + cost-per-km estimate. */
  async fuelReport(projectId: string) {
    if (!projectId) throw new BadRequestException('projectId is required');
    const logs = await this.listFuel({ projectId });
    let litres = 0, cost = 0;
    const byVehicle: Record<string, { label: string; litres: number; cost: number; odoMin?: number; odoMax?: number }> = {};
    const byDriver: Record<string, { label: string; litres: number; cost: number }> = {};
    for (const l of logs as any[]) {
      const li = Number(l.litres), c = Number(l.totalCost);
      litres += li; cost += c;
      const vk = l.transportVehicleId || l.assetId || 'unknown';
      const vlabel = l.transportVehicle ? ([l.transportVehicle.make, l.transportVehicle.model].filter(Boolean).join(' ') || l.transportVehicle.vehicleType) : (l.asset?.name || 'Unknown');
      byVehicle[vk] ||= { label: vlabel, litres: 0, cost: 0 };
      byVehicle[vk].litres += li; byVehicle[vk].cost += c;
      if (l.odometer != null) {
        byVehicle[vk].odoMin = byVehicle[vk].odoMin == null ? l.odometer : Math.min(byVehicle[vk].odoMin!, l.odometer);
        byVehicle[vk].odoMax = byVehicle[vk].odoMax == null ? l.odometer : Math.max(byVehicle[vk].odoMax!, l.odometer);
      }
      if (l.transportDriverId) { byDriver[l.transportDriverId] ||= { label: l.transportDriver?.fullName || '—', litres: 0, cost: 0 }; byDriver[l.transportDriverId].litres += li; byDriver[l.transportDriverId].cost += c; }
    }
    const vehicles = Object.values(byVehicle).map((v) => {
      const km = v.odoMax != null && v.odoMin != null ? v.odoMax - v.odoMin : null;
      return { ...v, km, costPerKm: km && km > 0 ? Number((v.cost / km).toFixed(2)) : null };
    });
    return { entries: logs.length, litres: Number(litres.toFixed(2)), cost: Number(cost.toFixed(2)), byVehicle: vehicles, byDriver: Object.values(byDriver) };
  }

  // ── SYS-12.E — Car rental → Two-Ledger ────────────────────────────────────────
  private hireAmount(v: any): number {
    const days = (v.rentalStart && v.rentalEnd) ? Math.max(1, Math.round((new Date(v.rentalEnd).getTime() - new Date(v.rentalStart).getTime()) / 86400000)) : 1;
    if (v.dailyRate) return Number(v.dailyRate) * days;
    if (v.monthlyRate) return Number(v.monthlyRate);
    return 0;
  }

  /** Commit a hired vehicle as an AP PurchaseOrder (encumbrance). */
  async commitVehicle(vehicleId: string, userId?: string) {
    const v = await this.prisma.transportVehicle.findUnique({ where: { id: vehicleId }, include: { supplier: { select: { name: true } } } });
    if (!v) throw new NotFoundException('Vehicle not found');
    if (v.source !== 'HIRED') throw new BadRequestException('Only hired vehicles can be committed to a PO.');
    if (v.purchaseOrderId) return { committed: true, purchaseOrderId: v.purchaseOrderId, note: 'Already committed.' };
    const amount = this.hireAmount(v);
    if (amount <= 0) throw new BadRequestException('Vehicle has no rate to commit (set a daily/monthly rate).');
    const projectId = v.projectId || (await this.ledger.getHouseProjectId());
    const po = await this.prisma.purchaseOrder.create({
      data: {
        projectId, poNumber: `VEH-${Date.now().toString(36).toUpperCase()}`,
        vendorName: v.supplier?.name || 'Vehicle rental',
        description: `Vehicle hire — ${[v.make, v.model].filter(Boolean).join(' ') || v.vehicleType}${v.plateNumber ? ` (${v.plateNumber})` : ''}`,
        amount, taxAmount: 0, total: amount, currency: (v.currency as any) || 'AED', status: 'DRAFT', createdById: userId || null,
      },
    });
    await this.prisma.transportVehicle.update({ where: { id: vehicleId }, data: { purchaseOrderId: po.id } });
    return { committed: true, purchaseOrderId: po.id, poNumber: po.poNumber, amount };
  }

  /** Post the hire as an ACTUAL to the project ledger (period-locked via ledger.create→assertOpen). */
  async postVehicleActual(vehicleId: string, userId?: string) {
    const v = await this.prisma.transportVehicle.findUnique({ where: { id: vehicleId }, include: { supplier: { select: { name: true } } } });
    if (!v) throw new NotFoundException('Vehicle not found');
    if (v.source !== 'HIRED') throw new BadRequestException('Only hired vehicles can be posted.');
    if (v.postedTxnId) return { posted: true, transactionId: v.postedTxnId, note: 'Already posted.' };
    const amount = this.hireAmount(v);
    if (amount <= 0) throw new BadRequestException('Vehicle has no rate to post.');
    const standalone = !v.projectId;
    const projectId = v.projectId || (await this.ledger.getHouseProjectId());
    const txn = await this.ledger.create({
      projectId, kind: standalone ? 'CORPORATE_OVERHEAD' : 'COST', date: new Date(), category: 'Transport',
      description: `Vehicle hire — ${[v.make, v.model].filter(Boolean).join(' ') || v.vehicleType}${v.plateNumber ? ` (${v.plateNumber})` : ''}${standalone ? ' [standalone]' : ''}`,
      party: v.supplier?.name || 'Vehicle rental', amount, taxAmount: 0, status: 'APPROVED', currency: (v.currency as any) || 'AED',
    } as any, userId);
    await this.prisma.transportVehicle.update({ where: { id: vehicleId }, data: { postedTxnId: txn.id } });
    return { posted: true, transactionId: txn.id, amount };
  }
}
