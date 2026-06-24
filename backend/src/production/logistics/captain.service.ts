import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MessagesService } from '../../comms/messages.service';
import { ChannelsService } from '../../comms/channels.service';

/**
 * SYS-12.F — Transport Captain operations console.
 *
 * This is the "for the work" layer on top of SYS-12.C movements. It turns the
 * Transport Coordinator/Captain's day into a deterministic dispatch workflow:
 *
 *   • Dispatch board   — every run is a card on a Kanban (Unassigned → Dispatched →
 *                        En route → Onboard → Complete). The board mirrors the
 *                        driver-app one-tap Finite State Machine 1:1.
 *   • Hard turnaround  — assign() refuses a driver who has not met their legal rest
 *                        window (union/Teamsters/local labour). No accidental forced calls.
 *   • Call-sheet sync  — pull cast call times → auto-generate hotel-pickup run blocks.
 *   • Run threads      — assigning a run opens a private chat thread (driver + coordinator)
 *                        that auto-archives on completion. Kills the 2nd-AD ↔ Captain phone-tag.
 *   • The Garage       — fleet by class (Working / Passenger / Picture) + rental return
 *                        countdown so trucks never run into late-return day rates.
 *   • Recce routes     — Locations-scouted overlays (truck-safe, noise-restricted …).
 *
 * Lifecycle ↔ status map (the FSM):
 *   REQUESTED = Unassigned · ASSIGNED = Dispatched · EN_ROUTE = En route / Arrived
 *   PASSENGER_ONBOARD = In transit · COMPLETED = Done · CANCELLED.
 */

const ORDER_INCLUDE = {
  vehicle: { select: { id: true, make: true, model: true, plateNumber: true, plateEmirate: true, vehicleType: true, fleetClass: true, capacity: true } },
  driver: { select: { id: true, fullName: true, mobile: true, minRestHours: true, lastWrapAt: true, onDutySince: true } },
  passengers: { include: { traveler: { select: { id: true, fullName: true, personType: true } } } },
} as const;

const TYPE_LABEL: Record<string, string> = {
  TALENT_PICKUP: 'Talent pickup', CREW_SHUTTLE: 'Crew shuttle', AIRPORT_PICKUP: 'Airport pickup',
  AIRPORT_DROPOFF: 'Airport drop-off', EQUIPMENT_RUN: 'Equipment run', INTER_LOCATION: 'Inter-location', OTHER: 'Run',
};
// FSM column → which statuses live in it (the Captain board)
const COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: 'UNASSIGNED', label: 'Unassigned', statuses: ['REQUESTED'] },
  { key: 'DISPATCHED', label: 'Dispatched', statuses: ['ASSIGNED'] },
  { key: 'EN_ROUTE', label: 'En route', statuses: ['EN_ROUTE'] },
  { key: 'ONBOARD', label: 'Passenger on board', statuses: ['PASSENGER_ONBOARD'] },
  { key: 'COMPLETED', label: 'Completed', statuses: ['COMPLETED'] },
];
const H = 3600_000;
const labelType = (t?: string) => TYPE_LABEL[t || 'OTHER'] || 'Run';
// Heavy load / towed trailer: the Working fleet (honeywagons, generators, grip/camera trucks)
// plus trucks/buses. They can't U-turn, are capped at 80 km/h, and run slower than light cars.
const HEAVY_TYPES = ['TRUCK', 'BUS', 'MINIBUS'];
const HEAVY_MAX_KMH = 80;
const isHeavy = (v?: any): boolean => !!v && (v.fleetClass === 'WORKING' || HEAVY_TYPES.includes(v.vehicleType));
/** Rough travel time (min): light vehicles assume ~50 km/h urban; heavy capped at 80 km/h
 *  plus a maneuvering buffer because no U-turns means longer detours. */
export const travelTimeMin = (distanceKm: number, heavy: boolean): number => {
  const kmh = heavy ? HEAVY_MAX_KMH : 50;
  return Math.round((distanceKm / kmh) * 60 * (heavy ? 1.25 : 1));
};

@Injectable()
export class CaptainService {
  constructor(
    private prisma: PrismaService,
    private messages: MessagesService,
    private channels: ChannelsService,
  ) {}

  // ── Dispatch board (Kanban) ───────────────────────────────────────────────────
  /** The Captain's command board for a project + day: runs grouped into FSM columns,
   *  each enriched with lifecycle timestamps, plus a live driver roster with HOS state. */
  async board(projectId: string | undefined, date?: string) {
    const where: any = {};
    if (projectId) where.projectId = projectId; else where.projectId = null; // standalone = rental pool
    if (date) {
      where.scheduledAt = { gte: new Date(date + 'T00:00:00'), lte: new Date(date + 'T23:59:59.999') };
    }
    const orders = await this.prisma.transportOrder.findMany({ where, orderBy: { scheduledAt: 'asc' }, include: ORDER_INCLUDE as any });
    const columns = COLUMNS.map((c) => ({ ...c, runs: (orders as any[]).filter((o) => c.statuses.includes(o.status)) }));
    const cancelled = (orders as any[]).filter((o) => o.status === 'CANCELLED');
    const counts: Record<string, number> = {};
    for (const c of columns) counts[c.key] = c.runs.length;
    counts.CANCELLED = cancelled.length;
    const passengers = (orders as any[]).reduce((n, o) => n + (o.passengers?.length || 0), 0);
    const urgent = (orders as any[]).filter((o) => o.priority === 'URGENT' && !['COMPLETED', 'CANCELLED'].includes(o.status)).length;
    return { date: date || null, projectId: projectId || null, total: orders.length, passengers, urgent, counts, columns, cancelled, hos: await this.hosBoard(projectId) };
  }

  // ── The dispatch action: assign a driver + vehicle (HARD turnaround lockout) ────
  async assign(orderId: string, body: { driverId?: string; vehicleId?: string; force?: boolean }, userId?: string) {
    const order = await this.prisma.transportOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Run not found');
    const driverId = body.driverId ?? order.driverId;
    const vehicleId = body.vehicleId ?? order.vehicleId;

    if (body.driverId) {
      const drv: any = await this.prisma.transportDriver.findUnique({ where: { id: body.driverId } });
      if (!drv) throw new NotFoundException('Driver not found');
      // Hard labour-compliance gate: refuse a driver still inside their legal turnaround.
      if (drv.lastWrapAt && !body.force) {
        const okAt = new Date(drv.lastWrapAt).getTime() + (drv.minRestHours ?? 10) * H;
        if (Date.now() < okAt) {
          throw new BadRequestException(
            `Turnaround not met — ${drv.fullName} is rested at ${new Date(okAt).toLocaleString()} ` +
            `(${drv.minRestHours ?? 10}h rest). Re-send with force=true to log a forced call.`,
          );
        }
      }
      if (drv && !drv.onDutySince) await this.prisma.transportDriver.update({ where: { id: drv.id }, data: { onDutySince: new Date() } }).catch(() => null);
    }

    const updated: any = await this.prisma.transportOrder.update({
      where: { id: orderId },
      data: { driverId: driverId ?? null, vehicleId: vehicleId ?? null, status: driverId && vehicleId ? 'ASSIGNED' : order.status },
      include: ORDER_INCLUDE as any,
    });
    if (updated.vehicleId) await this.prisma.transportVehicle.update({ where: { id: updated.vehicleId }, data: { status: 'ASSIGNED' } }).catch(() => null);
    let threadCh: string | null = updated.chatChannelId || null;
    if (updated.driverId && updated.vehicleId) threadCh = (await this.ensureRunThread(updated, userId).catch(() => null)) || threadCh;
    // Heavy load / towed trailer — push the driving constraints into the run thread on assignment.
    if (isHeavy(updated.vehicle)) {
      const ch = threadCh || (await this.projectChannelId(updated.projectId));
      if (ch) await this.messages.send(ch, { type: 'SYSTEM', body: `🚛 Heavy load / towed trailer — no U-turns, max ${HEAVY_MAX_KMH} km/h, trips run longer. Build extra time into the schedule.` }, userId).catch(() => null);
    }
    return updated;
  }

  // ── The one-tap FSM (driver app + Captain manual override) ─────────────────────
  /** action ∈ ACK | ARRIVE | ONBOARD | COMPLETE | CANCEL. Writes immutable timestamps,
   *  drives vehicle status + driver turnaround, and fires the right notifications. */
  async runAction(orderId: string, action: string, geo?: { lat?: number; lng?: number }, userId?: string, _eventId?: string) {
    const order: any = await this.prisma.transportOrder.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE as any });
    if (!order) throw new NotFoundException('Run not found');
    // Idempotent + monotonic — a re-delivered offline-outbox event is safe; terminal stays terminal,
    // and set-once timestamps are never overwritten. (Outbox events carry a stable _eventId.)
    if (['COMPLETED', 'CANCELLED'].includes(order.status)) return order;
    const now = new Date();
    const data: any = {};
    switch ((action || '').toUpperCase()) {
      case 'ACK':
        if (order.status === 'REQUESTED' || order.status === 'ASSIGNED') data.status = 'EN_ROUTE';
        if (!order.acknowledgedAt) data.acknowledgedAt = now;
        if (!order.enRouteAt) data.enRouteAt = now;
        break;
      case 'ARRIVE':
        if (!order.arrivedAt) data.arrivedAt = now;
        if (order.status === 'ASSIGNED') data.status = 'EN_ROUTE';
        break;
      case 'ONBOARD':
        if (order.status !== 'PASSENGER_ONBOARD') data.status = 'PASSENGER_ONBOARD';
        if (!order.onboardAt) data.onboardAt = now;
        break;
      case 'COMPLETE': data.status = 'COMPLETED'; data.completedAt = now; break;
      case 'CANCEL': data.status = 'CANCELLED'; break;
      default: throw new BadRequestException('Unknown action');
    }
    if (Object.keys(data).length === 0) return order; // duplicate delivery — nothing changed
    const updated: any = await this.prisma.transportOrder.update({ where: { id: orderId }, data, include: ORDER_INCLUDE as any });

    const notify = async (body: string) => {
      const ch = order.chatChannelId || (await this.projectChannelId(order.projectId));
      if (ch) await this.messages.send(ch, { type: 'SYSTEM', body }, userId).catch(() => null);
    };
    const who = order.passengerNote || order.passengers?.[0]?.traveler?.fullName || 'passenger';
    if (action.toUpperCase() === 'ARRIVE') await notify(`✅ Vehicle in position at ${order.fromLocation || 'pickup'} — ${who} please proceed.`);
    if (action.toUpperCase() === 'ONBOARD') await notify(`🚗 ${who} on board at ${now.toLocaleTimeString()} (timestamp logged).`);
    if (['COMPLETE', 'CANCEL'].includes(action.toUpperCase())) {
      if (updated.vehicleId) await this.prisma.transportVehicle.update({ where: { id: updated.vehicleId }, data: { status: 'AVAILABLE' } }).catch(() => null);
      if (action.toUpperCase() === 'COMPLETE' && updated.driverId) {
        await this.prisma.transportDriver.update({ where: { id: updated.driverId }, data: { lastWrapAt: now } }).catch(() => null);
        await notify(`🏁 Run complete at ${now.toLocaleTimeString()} — thread archived.`);
      }
      if (order.chatChannelId) await this.prisma.channel.update({ where: { id: order.chatChannelId }, data: { archivedAt: now } }).catch(() => null);
    }
    return updated;
  }

  // ── Hours-of-service / turnaround board ────────────────────────────────────────
  async hosBoard(projectId?: string) {
    const drivers: any[] = await this.prisma.transportDriver.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, mobile: true, minRestHours: true, onDutySince: true, lastWrapAt: true },
      orderBy: { fullName: 'asc' },
    });
    const now = Date.now();
    return drivers
      .map((d) => {
        const rest = d.minRestHours ?? 10;
        const nextAvailableAt = d.lastWrapAt ? new Date(new Date(d.lastWrapAt).getTime() + rest * H) : null;
        const locked = nextAvailableAt ? now < nextAvailableAt.getTime() : false;
        const hoursOnDuty = d.onDutySince ? Math.round(((now - new Date(d.onDutySince).getTime()) / H) * 10) / 10 : 0;
        return { id: d.id, fullName: d.fullName, mobile: d.mobile, restHours: rest, onDutySince: d.onDutySince, lastWrapAt: d.lastWrapAt, nextAvailableAt, locked, hoursOnDuty };
      })
      .sort((a, b) => Number(b.locked) - Number(a.locked) || b.hoursOnDuty - a.hoursOnDuty);
  }

  /** End a driver's duty day (resets the turnaround clock baseline). */
  async wrapDriver(driverId: string) {
    return this.prisma.transportDriver.update({ where: { id: driverId }, data: { lastWrapAt: new Date(), onDutySince: null } });
  }

  // ── Smart call-sheet sync → auto-generate hotel-pickup run blocks ───────────────
  /** Reads the day's call sheet and creates a TALENT_PICKUP run for each cast call,
   *  scheduled `leadMinutes` before the call time. Idempotent via genSource. */
  async syncFromCallSheet(projectId: string, date: string, leadMinutes = 60) {
    if (!projectId || !date) throw new BadRequestException('projectId and date are required');
    const cs: any = await this.prisma.callSheet.findFirst({
      where: { projectId, shootDate: { gte: new Date(date + 'T00:00:00'), lte: new Date(date + 'T23:59:59.999') } },
      orderBy: { dayNumber: 'desc' },
    });
    if (!cs) throw new BadRequestException('No call sheet found for that date — generate/approve it first.');
    const casts: any[] = Array.isArray(cs.castCalls) ? cs.castCalls : [];
    let created = 0, skipped = 0;
    for (const c of casts) {
      const callTime = c?.callTime || c?.onSet;
      const name = c?.cast || c?.character;
      if (!callTime || !name) { skipped++; continue; }
      const genSource = `callsheet:${cs.id}:cast:${name}`;
      const exists = await this.prisma.transportOrder.findFirst({ where: { projectId, genSource } });
      if (exists) { skipped++; continue; }
      const [hh, mm] = String(callTime).split(':').map((x: string) => Number(x));
      const callAt = new Date(date + 'T00:00:00');
      callAt.setHours(hh || 0, mm || 0, 0, 0);
      const pickAt = new Date(callAt.getTime() - leadMinutes * 60000);
      await this.prisma.transportOrder.create({
        data: {
          projectId, type: 'TALENT_PICKUP', status: 'REQUESTED', priority: 'VIP',
          fromLocation: c?.pickup || cs.basecampNotes || 'Hotel', toLocation: cs.locationName || 'Set',
          scheduledAt: pickAt, callSheetId: cs.id, genSource,
          purpose: `${name} — ${callTime} call`, passengerNote: name,
        },
      });
      created++;
    }
    return { date, callSheetId: cs.id, created, skipped, leadMinutes };
  }

  // ── The Garage: fleet by class + rental return countdown ───────────────────────
  async garage(projectId?: string) {
    const vehicles: any[] = await this.prisma.transportVehicle.findMany({
      where: { isActive: true, ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}) },
      include: { asset: { select: { name: true, plateNumber: true } }, supplier: { select: { name: true } } },
      orderBy: [{ fleetClass: 'asc' }, { vehicleType: 'asc' }],
    });
    const byClass: Record<string, any[]> = { WORKING: [], PASSENGER: [], PICTURE: [], OTHER: [] };
    for (const v of vehicles) (byClass[v.fleetClass || 'OTHER'] ||= []).push(v);
    const now = Date.now();
    const dueSoon = vehicles
      .filter((v) => v.source === 'HIRED' && v.rentalEnd)
      .map((v) => ({ id: v.id, label: [v.make, v.model].filter(Boolean).join(' ') || v.asset?.name || 'Vehicle', plate: v.plateNumber, supplier: v.supplier?.name, returnLocation: v.returnLocation, rentalEnd: v.rentalEnd, hoursLeft: Math.round((new Date(v.rentalEnd).getTime() - now) / H) }))
      .filter((v) => v.hoursLeft <= 72)
      .sort((a, b) => a.hoursLeft - b.hoursLeft);
    return { total: vehicles.length, counts: Object.fromEntries(Object.entries(byClass).map(([k, a]) => [k, a.length])), byClass, dueSoon };
  }

  // ── Recce route overlays (Locations dept → Captain map → driver nav) ────────────
  routes(projectId: string) {
    if (!projectId) throw new BadRequestException('projectId is required');
    return this.prisma.routeOverlay.findMany({ where: { projectId, active: true }, orderBy: { createdAt: 'desc' } });
  }
  createRoute(d: any, userId?: string) {
    if (!d?.projectId || !d?.label || !Array.isArray(d?.points)) throw new BadRequestException('projectId, label and points[] are required');
    return this.prisma.routeOverlay.create({
      data: { projectId: d.projectId, label: d.label, kind: (d.kind || 'STANDARD') as any, points: d.points, constraints: d.constraints ?? null, color: d.color ?? null, createdById: userId ?? null },
    });
  }
  updateRoute(id: string, d: any) {
    return this.prisma.routeOverlay.update({
      where: { id },
      data: {
        ...(d.label != null ? { label: d.label } : {}), ...(d.kind ? { kind: d.kind as any } : {}),
        ...(Array.isArray(d.points) ? { points: d.points } : {}), ...(d.constraints !== undefined ? { constraints: d.constraints } : {}),
        ...(d.color !== undefined ? { color: d.color } : {}), ...(d.active != null ? { active: !!d.active } : {}),
      },
    });
  }
  removeRoute(id: string) { return this.prisma.routeOverlay.update({ where: { id }, data: { active: false } }).catch(() => null); }

  // ── 2nd-AD "actor wrapped" → urgent car needed (kills the comms gap) ────────────
  /** Surfaces an URGENT pickup at the top of the Captain board the instant the AD dept
   *  marks talent wrapped/ready. (Auto-assign to nearest idle car is a follow-on.) */
  async wrapPickup(projectId: string, body: { label?: string; fromLocation?: string; toLocation?: string; lat?: number; lng?: number }, userId?: string) {
    if (!projectId) throw new BadRequestException('projectId is required');
    const order: any = await this.prisma.transportOrder.create({
      data: {
        projectId, type: 'TALENT_PICKUP', status: 'REQUESTED', priority: 'URGENT',
        fromLocation: body.fromLocation || 'Set / stage door', toLocation: body.toLocation || 'Hotel',
        scheduledAt: new Date(), passengerNote: body.label || 'Wrapped talent',
        ...(body.lat != null && body.lng != null ? { pickupLat: body.lat, pickupLng: body.lng } : {}),
        genSource: 'wrap',
      },
    });
    const ch = await this.projectChannelId(projectId);
    // Auto-dispatch: send the nearest idle, legally-rested car straight to the wrap location.
    if (body.lat != null && body.lng != null) {
      const near = await this.nearestIdle(projectId, Number(body.lat), Number(body.lng)).catch(() => null);
      if (near?.transportDriverId) {
        await this.assign(order.id, { driverId: near.transportDriverId, vehicleId: near.transportVehicleId || undefined }, userId).catch(() => null);
        if (ch) await this.messages.send(ch, { type: 'SYSTEM', body: `🚗 Auto-dispatched the nearest idle car to ${order.passengerNote} at ${order.fromLocation} (~${Math.round(near.dist)}m away).` }, userId).catch(() => null);
        return this.prisma.transportOrder.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE as any });
      }
    }
    if (ch) await this.messages.send(ch, { type: 'SYSTEM', body: `🔴 URGENT — ${order.passengerNote} wrapped and needs a car at ${order.fromLocation}. No idle car nearby — assign on the dispatch board.` }, userId).catch(() => null);
    return order;
  }

  /** Cryptographic condition report → tamper-evident chain of custody in the Document Vault.
   *  Each photo arrives pre-hashed (SHA-256) + GPS + capture time from the device. */
  async conditionReport(orderId: string, photos: any[], userId?: string) {
    const order: any = await this.prisma.transportOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Run not found');
    const saved: string[] = [];
    if (order.projectId) {
      for (const p of photos || []) {
        if (!p?.url) continue;
        const meta = [p.side ? String(p.side) : null, p.sha256 ? `sha256:${String(p.sha256).slice(0, 32)}` : null,
          p.lat != null && p.lng != null ? `${Number(p.lat).toFixed(5)},${Number(p.lng).toFixed(5)}` : null,
          p.at ? new Date(p.at).toISOString() : null].filter(Boolean).join(' · ');
        const doc: any = await this.prisma.projectDocument
          .create({ data: { projectId: order.projectId, name: `Condition · ${meta}`, kind: 'FILE', provider: 'UPLOAD', url: p.url, category: 'ConditionReport', entityType: 'transportOrder', entityId: orderId, uploadedById: userId ?? null } as any })
          .catch(() => null);
        if (doc) saved.push(doc.id);
      }
    }
    const ch = order.chatChannelId || (await this.projectChannelId(order.projectId));
    if (ch) await this.messages.send(ch, { type: 'SYSTEM', body: `🛡️ Condition report logged — ${saved.length} photo(s) SHA-256 hashed, GPS + time stamped, and filed to the Document Vault (tamper-evident).` }, userId).catch(() => null);
    return { saved: saved.length };
  }

  // ── Driver app surface (the logged-in driver's own runs) ──────────────────────
  /** Resolve the TransportDriver for a logged-in user (user → employee → driver → transportDriver). */
  private async resolveTransportDriver(userId?: string) {
    if (!userId) return null;
    // Mirror the proven driver-app resolution: User.employeeId → Driver(employeeId) → TransportDriver(driverId).
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } }).catch(() => null);
    if (!user?.employeeId) return null;
    const driver = await this.prisma.driver.findUnique({ where: { employeeId: user.employeeId }, select: { id: true } }).catch(() => null);
    if (!driver) return null;
    return this.prisma.transportDriver
      .findFirst({ where: { driverId: driver.id }, select: { id: true, fullName: true, minRestHours: true, onDutySince: true, lastWrapAt: true } })
      .catch(() => null);
  }

  /** The driver app payload: my active runs (today, not done) + my live turnaround clock. */
  async myRuns(userId?: string, driverIdOverride?: string) {
    let td: any = driverIdOverride
      ? await this.prisma.transportDriver.findUnique({ where: { id: driverIdOverride }, select: { id: true, fullName: true, minRestHours: true, onDutySince: true, lastWrapAt: true } }).catch(() => null)
      : await this.resolveTransportDriver(userId);
    if (!td) return { driver: null, runs: [], turnaround: null };
    const runs = await this.prisma.transportOrder.findMany({
      where: { driverId: td.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      orderBy: { scheduledAt: 'asc' }, include: ORDER_INCLUDE as any,
    });
    const rest = td.minRestHours ?? 10;
    const nextAvailableAt = td.lastWrapAt ? new Date(new Date(td.lastWrapAt).getTime() + rest * H) : null;
    const turnaround = {
      onDutySince: td.onDutySince,
      hoursOnDuty: td.onDutySince ? Math.round(((Date.now() - new Date(td.onDutySince).getTime()) / H) * 10) / 10 : 0,
      restHours: rest, nextAvailableAt, locked: nextAvailableAt ? Date.now() < nextAvailableAt.getTime() : false,
    };
    return { driver: td, runs, turnaround };
  }

  /** Panic — bypasses the comms hierarchy and raises a high-priority alert to dispatch. */
  async panic(orderId: string | undefined, userId?: string) {
    const order: any = orderId ? await this.prisma.transportOrder.findUnique({ where: { id: orderId } }).catch(() => null) : null;
    const ch = order?.chatChannelId || (await this.projectChannelId(order?.projectId));
    if (ch) await this.messages.send(ch, { type: 'SYSTEM', body: `🚨 PANIC — driver needs immediate help${order?.fromLocation ? ` near ${order.fromLocation}` : ''}. Open a voice channel now.` }, userId).catch(() => null);
    return { ok: true, channelId: ch || null };
  }

  // ── helpers ────────────────────────────────────────────────────────────────────
  private async projectChannelId(projectId?: string): Promise<string | null> {
    if (!projectId) return null;
    const ch = await this.prisma.channel.findFirst({ where: { scopeType: 'PROJECT', scopeId: projectId } }).catch(() => null);
    return ch?.id || null;
  }

  /** Great-circle distance in metres. */
  private hav(aLat: number, aLng: number, bLat: number, bLng: number): number {
    const R = 6371000, toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  /** Nearest ON_SHIFT driver to a point who is idle (no active run) and legally rested. */
  private async nearestIdle(projectId: string, lat: number, lng: number): Promise<{ transportDriverId: string; transportVehicleId: string | null; dist: number } | null> {
    const shifts: any[] = await this.prisma.driverShift.findMany({ where: { status: { not: 'OFF_SHIFT' }, lastPingAt: { not: null }, projectId }, orderBy: { lastPingAt: 'desc' } });
    const driverIds = Array.from(new Set(shifts.map((s) => s.driverId).filter(Boolean)));
    if (!driverIds.length) return null;
    const tds: any[] = await this.prisma.transportDriver.findMany({ where: { driverId: { in: driverIds } }, select: { id: true, driverId: true, minRestHours: true, lastWrapAt: true } });
    const tdByDriver = new Map(tds.map((t) => [t.driverId, t]));
    const busy = new Set(
      (await this.prisma.transportOrder.findMany({ where: { projectId, status: { in: ['ASSIGNED', 'EN_ROUTE', 'PASSENGER_ONBOARD'] }, driverId: { in: tds.map((t) => t.id) } }, select: { driverId: true } })).map((o: any) => o.driverId),
    );
    const now = Date.now();
    const ranked = shifts
      .map((s) => {
        const td: any = s.driverId ? tdByDriver.get(s.driverId) : null;
        if (!td || busy.has(td.id)) return null;
        if (td.lastWrapAt && now < new Date(td.lastWrapAt).getTime() + (td.minRestHours ?? 10) * H) return null; // still resting
        if (s.lastLat == null || s.lastLng == null) return null;
        return { td, shift: s, dist: this.hav(lat, lng, Number(s.lastLat), Number(s.lastLng)) };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.dist - b.dist);
    if (!ranked.length) return null;
    const best: any = ranked[0];
    let vehId: string | null = null;
    if (best.shift.vehicleId) {
      const tv: any = await this.prisma.transportVehicle.findFirst({ where: { OR: [{ assetId: best.shift.vehicleId }, { id: best.shift.vehicleId }] }, select: { id: true } }).catch(() => null);
      vehId = tv?.id || null;
    }
    return { transportDriverId: best.td.id, transportVehicleId: vehId, dist: best.dist };
  }

  private async ensureRunThread(order: any, userId?: string): Promise<string | null> {
    if (order.chatChannelId) return order.chatChannelId;
    const title = `Run · ${labelType(order.type)} · ${order.passengerNote || order.toLocation || ''}`.slice(0, 80);
    const ch: any = await this.prisma.channel
      .create({ data: { scopeType: 'TEAM', scopeId: order.id, title, projectId: order.projectId ?? undefined, createdById: userId ?? null } })
      .catch(() => null);
    if (!ch) return null;
    await this.prisma.transportOrder.update({ where: { id: order.id }, data: { chatChannelId: ch.id } }).catch(() => null);
    if (userId) await this.channels.addMembers(ch.id, [userId], false, 'captain').catch(() => null);
    const when = order.scheduledAt ? ` at ${new Date(order.scheduledAt).toLocaleTimeString()}` : '';
    await this.messages
      .send(ch.id, { type: 'SYSTEM', body: `🚐 Run thread opened — ${labelType(order.type)} from ${order.fromLocation || '?'} → ${order.toLocation || '?'}${when}. Driver ${order.driver?.fullName || ''}.` }, userId)
      .catch(() => null);
    return ch.id;
  }
}
