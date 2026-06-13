import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Live Logistics — aggregates the standalone rental module into a field-operations view:
 * active hires grouped by location, each location's units (+ tow links, mileage, crew),
 * drivers, and a status/alert roll-up for the command-center map.
 */
@Injectable()
export class LogisticsService {
  constructor(private prisma: PrismaService) {}

  /** Command-center overview: on-hire bookings → locations → units, with mileage,
   *  fuel efficiency, excess-mileage flags, driver compliance and alert roll-up. */
  async overview() {
    const activeStatuses = ['DISPATCHED', 'DELIVERED', 'ACTIVE', 'ON_HIRE', 'EXTENDED', 'PICKUP_SCHEDULED'];
    const bookings = await this.prisma.rentalBooking.findMany({
      where: { status: { in: activeStatuses as any } },
      include: {
        client: { select: { id: true, companyName: true } },
        locations: { orderBy: { sequence: 'asc' } },
        items: { include: { asset: { select: { id: true, name: true, assetType: true, category: true, plateNumber: true, serialNumber: true, tracksMileage: true, currentOdometer: true } } } },
        conditionReports: { select: { assetId: true, type: true } },
        driverJobs: {
          where: { status: { notIn: ['COMPLETED', 'CANCELLED'] as any } },
          include: { driver: { select: { id: true, fullName: true, mobile: true, licenseExpiry: true, visaExpiry: true } } },
          orderBy: { scheduledAt: 'desc' },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // Fuel litres per asset within each booking window → km/L.
    const assetIds = [...new Set(bookings.flatMap((b) => b.items.map((i) => i.assetId)))];
    const fuelByAsset = new Map<string, number>();
    if (assetIds.length) {
      const logs = await this.prisma.fuelLog.findMany({ where: { assetId: { in: assetIds } }, select: { assetId: true, litres: true } });
      for (const l of logs) if (l.assetId) fuelByAsset.set(l.assetId, (fuelByAsset.get(l.assetId) || 0) + Number(l.litres || 0));
    }
    const now = new Date();
    const driverCompliance = (d: any) => {
      const issues: string[] = [];
      if (d?.licenseExpiry && new Date(d.licenseExpiry) < now) issues.push('licence expired');
      if (d?.visaExpiry && new Date(d.visaExpiry) < now) issues.push('visa expired');
      return issues;
    };

    let onHire = 0, onLocation = 0, inTransit = 0, alerts = 0;
    const hires = bookings.map((b) => {
      const inspected = new Set(b.conditionReports.map((c) => `${c.assetId}|${c.type}`));
      const byLoc = new Map<string, any[]>();
      const unplaced: any[] = [];
      for (const it of b.items) {
        onHire += 1;
        const miles = it.checkoutOdometer != null && it.returnOdometer != null ? it.returnOdometer - it.checkoutOdometer : null;
        const litres = fuelByAsset.get(it.assetId) || 0;
        const kmPerL = miles && litres > 0 ? Math.round((miles / litres) * 10) / 10 : null;
        const excessKm = miles != null && it.mileageAllowanceKm != null && miles > it.mileageAllowanceKm ? miles - it.mileageAllowanceKm : 0;
        if (excessKm > 0) alerts += 1;
        const u = {
          itemId: it.id, asset: it.asset, towedById: it.towedById, allocationStatus: it.allocationStatus,
          checkoutOdometer: it.checkoutOdometer, returnOdometer: it.returnOdometer, milesThisHire: miles,
          mileageAllowanceKm: it.mileageAllowanceKm, excessKm, kmPerL,
          inspectedOut: inspected.has(`${it.assetId}|DELIVERY`), inspectedIn: inspected.has(`${it.assetId}|RETURN`),
        };
        if (it.bookingLocationId) {
          if (!byLoc.has(it.bookingLocationId)) byLoc.set(it.bookingLocationId, []);
          byLoc.get(it.bookingLocationId)!.push(u);
        } else unplaced.push(u);
      }
      const locations = b.locations.map((loc) => {
        const units = byLoc.get(loc.id) || [];
        if (loc.status === 'ON_LOCATION') onLocation += units.length;
        if (loc.status === 'IN_TRANSIT') inTransit += units.length;
        return {
          id: loc.id, siteName: loc.siteName, address: loc.address, locationUrl: loc.locationUrl,
          lat: loc.lat, lng: loc.lng, crewCount: loc.crewCount, arrivedAt: loc.arrivedAt,
          fromDate: loc.fromDate, toDate: loc.toDate, status: loc.status, units,
        };
      });
      const drivers = b.driverJobs.map((j) => {
        const issues = driverCompliance(j.driver);
        if (issues.length) alerts += 1;
        return { id: j.driver?.id, name: j.driver?.fullName, phone: j.driver?.mobile, jobType: j.jobType, status: j.status, locationId: j.bookingLocationId, compliance: issues };
      });
      return { id: b.id, bookingNumber: b.bookingNumber, client: b.client, startDate: b.startDate, endDate: b.endDate, status: b.status, locations, unplaced, drivers };
    });

    return { summary: { onHire, onLocation, inTransit, alerts }, hires };
  }

  /** Log a check-out (DELIVERY) or check-in (RETURN) inspection for a unit's asset. */
  async logInspection(itemId: string, b: { type: 'DELIVERY' | 'RETURN'; odometer?: number; fuelLevel?: string; damageNotes?: string; photos?: string[]; checklist?: any }) {
    const item = await this.prisma.bookingItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Booking item not found.');
    if (!['DELIVERY', 'RETURN'].includes(b.type)) throw new BadRequestException('type must be DELIVERY or RETURN.');
    return this.prisma.conditionReport.create({
      data: {
        bookingId: item.bookingId, assetId: item.assetId, type: b.type,
        odometer: b.odometer != null ? Number(b.odometer) : null,
        fuelLevel: b.fuelLevel || null, damageNotes: b.damageNotes || null,
        photos: Array.isArray(b.photos) ? b.photos : [], checklist: b.checklist ?? undefined,
      },
    });
  }

  /** Assign a unit (booking item) to a site within its hire. */
  async assignUnit(itemId: string, bookingLocationId: string | null) {
    const item = await this.prisma.bookingItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Booking item not found.');
    return this.prisma.bookingItem.update({ where: { id: itemId }, data: { bookingLocationId: bookingLocationId || null } });
  }

  /** Set a unit's tow vehicle (towed units only). */
  async setTow(itemId: string, towedById: string | null) {
    return this.prisma.bookingItem.update({ where: { id: itemId }, data: { towedById: towedById || null } });
  }

  /** Move a location through its status (PLANNED → IN_TRANSIT → ON_LOCATION → DONE). */
  async setLocationStatus(locationId: string, status: string) {
    const allowed = ['PLANNED', 'IN_TRANSIT', 'ON_LOCATION', 'DONE'];
    if (!allowed.includes(status)) throw new BadRequestException(`Status must be one of ${allowed.join(', ')}.`);
    const data: any = { status };
    if (status === 'ON_LOCATION') data.arrivedAt = new Date();
    return this.prisma.bookingLocation.update({ where: { id: locationId }, data });
  }

  /** Update a site's map pin / crew count. */
  async updateLocation(locationId: string, b: { lat?: number; lng?: number; crewCount?: number; siteName?: string; address?: string; locationUrl?: string }) {
    const d: any = {};
    for (const k of ['siteName', 'address', 'locationUrl'] as const) if (b[k] !== undefined) d[k] = b[k] || null;
    for (const k of ['lat', 'lng', 'crewCount'] as const) if (b[k] !== undefined) d[k] = b[k] === null ? null : Number(b[k]);
    return this.prisma.bookingLocation.update({ where: { id: locationId }, data: d });
  }

  /** Record check-out or return odometer on a self-driven unit; advances allocation status. */
  async recordReading(itemId: string, b: { kind: 'CHECKOUT' | 'RETURN'; odometer: number }) {
    const item = await this.prisma.bookingItem.findUnique({ where: { id: itemId }, include: { asset: true } });
    if (!item) throw new NotFoundException('Booking item not found.');
    if (!item.asset?.tracksMileage) throw new BadRequestException('This unit is towed — it does not track its own mileage.');
    const odo = Number(b.odometer);
    if (!Number.isFinite(odo) || odo < 0) throw new BadRequestException('Odometer must be a positive number.');
    const data: any = {};
    if (b.kind === 'CHECKOUT') { data.checkoutOdometer = odo; data.checkoutAt = new Date(); data.allocationStatus = 'DISPATCHED'; }
    else { data.returnOdometer = odo; data.returnAt = new Date(); data.allocationStatus = 'RETURNED'; }
    const updated = await this.prisma.bookingItem.update({ where: { id: itemId }, data });
    // Keep the asset's current odometer in sync (feeds preventive maintenance).
    if (odo > (item.asset.currentOdometer || 0)) {
      await this.prisma.asset.update({ where: { id: item.assetId }, data: { currentOdometer: odo } }).catch(() => {});
    }
    return updated;
  }
}
