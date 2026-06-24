import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TelemetryGateway } from './telemetry.gateway';
import { MessagesService } from '../comms/messages.service';

/** Great-circle distance in metres between two lat/lng points. */
function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * SYS-06 — Transport GPS telemetry.
 * Backs the driver "on shift" live map and dispatch live status. Drivers stream GPS
 * pings (batched from the offline outbox); dispatch reads the live map by polling
 * (a socket.io gateway can be layered on later without schema changes).
 */
@Injectable()
export class TelemetryService {
  constructor(private prisma: PrismaService, private gateway: TelemetryGateway, private messages: MessagesService) {}

  // ── Shifts ──────────────────────────────────────────────────────────────────
  startShift(d: any) {
    if (!d?.driverId) throw new BadRequestException('driverId required');
    return this.prisma.driverShift.create({
      data: { driverId: d.driverId, vehicleId: d.vehicleId ?? null, projectId: d.projectId ?? null, status: 'ON_SHIFT' },
    });
  }

  async setShiftStatus(id: string, status: string) {
    const updated = await this.prisma.driverShift.update({
      where: { id },
      data: { status: (status || 'ON_SHIFT') as any, ...(status === 'OFF_SHIFT' ? { endedAt: new Date() } : {}) },
    });
    this.gateway.emitDrivers(await this.liveMap(), updated.projectId);
    return updated;
  }

  activeShiftForDriver(driverId: string) {
    return this.prisma.driverShift.findFirst({ where: { driverId, status: { not: 'OFF_SHIFT' } }, orderBy: { startedAt: 'desc' } });
  }

  // ── Pings ───────────────────────────────────────────────────────────────────
  /** Ingest a batch of pings (offline outbox flush). Advances each shift's head. */
  async ingest(pings: any[]) {
    const rows = (pings || [])
      .filter((p) => p && p.lat != null && p.lng != null)
      .map((p) => ({
        driverId: p.driverId ?? null, vehicleId: p.vehicleId ?? null, transportOrderId: p.transportOrderId ?? null, shiftId: p.shiftId ?? null,
        lat: p.lat, lng: p.lng, speedKph: p.speedKph ?? null, headingDeg: p.headingDeg ?? null, accuracyM: p.accuracyM ?? null,
        recordedAt: p.recordedAt ? new Date(p.recordedAt) : new Date(),
      }));
    if (!rows.length) return { ingested: 0 };
    await this.prisma.locationPing.createMany({ data: rows });
    const emitLive = () => this.liveMap().then((live) => this.gateway.emitDrivers(live)).catch(() => null);
    const latestByShift = new Map<string, any>();
    for (const r of rows) if (r.shiftId) {
      const cur = latestByShift.get(r.shiftId);
      if (!cur || r.recordedAt > cur.recordedAt) latestByShift.set(r.shiftId, r);
    }
    for (const [shiftId, r] of latestByShift) {
      const shift = await this.prisma.driverShift.findUnique({ where: { id: shiftId } }).catch(() => null);
      if (shift) await this.checkArrivals(shift, r).catch(() => null); // compare old head vs new ping → fire on ENTER
      await this.prisma.driverShift
        .update({ where: { id: shiftId }, data: { lastLat: r.lat, lastLng: r.lng, lastPingAt: r.recordedAt } })
        .catch(() => null);
    }
    await emitLive();
    return { ingested: rows.length };
  }

  /** Live map: active shifts with their last known position (for dispatch). */
  liveMap(projectId?: string) {
    return this.prisma.driverShift.findMany({
      where: { status: { not: 'OFF_SHIFT' }, lastPingAt: { not: null }, ...(projectId ? { projectId } : {}) },
      orderBy: { lastPingAt: 'desc' },
    });
  }

  /** Recent trail for a driver or transport order. */
  track(q: { driverId?: string; transportOrderId?: string; sinceMin?: string }) {
    const where: any = {};
    if (q.driverId) where.driverId = q.driverId;
    if (q.transportOrderId) where.transportOrderId = q.transportOrderId;
    if (q.sinceMin) where.recordedAt = { gte: new Date(Date.now() - Number(q.sinceMin) * 60000) };
    return this.prisma.locationPing.findMany({ where, orderBy: { recordedAt: 'asc' }, take: 1000 });
  }

  /** ETA for a transport order. Stub — plug a routing/flight-status provider for live ETA. */
  async eta(transportOrderId: string) {
    const last = await this.prisma.locationPing.findFirst({ where: { transportOrderId }, orderBy: { recordedAt: 'desc' } });
    return { transportOrderId, lastPing: last, etaMinutes: null, note: 'wire a routing/flight-status provider for live ETA' };
  }

  // ── Geofenced basecamp pins + arrival check-in ────────────────────────────────
  pins(projectId: string) { return this.prisma.geofencePin.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }); }

  createPin(d: any, userId?: string) {
    if (!d?.projectId || d.lat == null || d.lng == null || !d.label) throw new BadRequestException('projectId, label, lat and lng are required');
    return this.prisma.geofencePin.create({
      data: {
        projectId: d.projectId, kind: (d.kind || 'BASECAMP') as any, label: d.label,
        lat: d.lat, lng: d.lng, radiusM: Number(d.radiusM) || 120,
        notifyChannelId: d.notifyChannelId ?? null, createdById: userId ?? null,
      },
    });
  }

  updatePin(id: string, d: any) {
    return this.prisma.geofencePin.update({
      where: { id },
      data: {
        ...(d.label != null ? { label: d.label } : {}), ...(d.kind ? { kind: d.kind as any } : {}),
        ...(d.lat != null ? { lat: d.lat } : {}), ...(d.lng != null ? { lng: d.lng } : {}),
        ...(d.radiusM != null ? { radiusM: Number(d.radiusM) } : {}), ...(d.active != null ? { active: !!d.active } : {}),
        ...(d.notifyChannelId !== undefined ? { notifyChannelId: d.notifyChannelId } : {}),
      },
    });
  }

  removePin(id: string) { return this.prisma.geofencePin.delete({ where: { id } }).catch(() => null); }

  checkins(projectId: string) {
    return this.prisma.geofenceCheckin.findMany({
      where: { pin: { projectId } }, orderBy: { at: 'desc' }, take: 100,
      include: { pin: { select: { label: true, kind: true } } },
    });
  }

  /** Fire an arrival check-in when a shift crosses INTO a project geofence (outside→inside). */
  private async checkArrivals(shift: any, ping: any) {
    if (!shift.projectId) return;
    const pins = await this.prisma.geofencePin.findMany({ where: { projectId: shift.projectId, active: true } });
    if (!pins.length) return;
    const oLat = shift.lastLat != null ? Number(shift.lastLat) : null;
    const oLng = shift.lastLng != null ? Number(shift.lastLng) : null;
    const nLat = Number(ping.lat), nLng = Number(ping.lng);
    for (const pin of pins) {
      const pLat = Number(pin.lat), pLng = Number(pin.lng);
      const wasIn = oLat != null && oLng != null && haversineM(oLat, oLng, pLat, pLng) <= pin.radiusM;
      const isIn = haversineM(nLat, nLng, pLat, pLng) <= pin.radiusM;
      if (isIn && !wasIn) {
        await this.prisma.geofenceCheckin.create({ data: { pinId: pin.id, driverId: shift.driverId ?? null, vehicleId: shift.vehicleId ?? null, lat: ping.lat, lng: ping.lng } }).catch(() => null);
        const channelId = pin.notifyChannelId || (await this.prisma.channel.findFirst({ where: { scopeType: 'PROJECT', scopeId: shift.projectId } }))?.id;
        if (channelId) await this.messages.send(channelId, { type: 'SYSTEM', body: `📍 Driver ${String(shift.driverId || '').slice(0, 6)} arrived at ${pin.label} (${String(pin.kind).replace(/_/g, ' ').toLowerCase()}).` }, undefined).catch(() => null);
        // Geofence → run FSM: if this driver is en route on a run, auto-mark "arrived"
        // and notify the run thread / 2nd AD. (SYS-12.F automated arrival.)
        if (shift.driverId) {
          const run: any = await this.prisma.transportOrder.findFirst({ where: { driverId: shift.driverId, status: 'EN_ROUTE', arrivedAt: null }, orderBy: { scheduledAt: 'asc' } }).catch(() => null);
          if (run) {
            await this.prisma.transportOrder.update({ where: { id: run.id }, data: { arrivedAt: new Date() } }).catch(() => null);
            const rc = run.chatChannelId || channelId;
            if (rc) await this.messages.send(rc, { type: 'SYSTEM', body: `✅ Vehicle in position at ${pin.label} — auto-detected by geofence.` }, undefined).catch(() => null);
          }
        }
      }
    }
  }
}
