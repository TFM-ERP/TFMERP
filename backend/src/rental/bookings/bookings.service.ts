import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BookingStatus } from '@prisma/client';

// Status transition rules
const ALLOWED_TRANSITIONS: Record<string, BookingStatus[]> = {
  INQUIRY:          ['QUOTED', 'CANCELLED'],
  QUOTED:           ['APPROVED', 'CANCELLED'],
  APPROVED:         ['CONTRACT_SENT', 'CANCELLED'],
  CONTRACT_SENT:    ['CONTRACT_SIGNED', 'CANCELLED'],
  CONTRACT_SIGNED:  ['SCHEDULED', 'CANCELLED'],
  SCHEDULED:        ['DELIVERED', 'CANCELLED'],
  DELIVERED:        ['ACTIVE'],
  ACTIVE:           ['PICKUP_SCHEDULED'],
  PICKUP_SCHEDULED: ['RETURNED'],
  RETURNED:         ['COMPLETED'],
  COMPLETED:        [],
  CANCELLED:        [],
};

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({
      where: { prefix: 'RB' },
      update: { lastNumber: { increment: 1 } },
      create: { prefix: 'RB', lastNumber: 1, year },
    });
    return `RB-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  // ── Double-booking / conflict detection ───────────────────────────────────
  async checkConflicts(assetIds: string[], startDate: string, endDate: string, excludeBookingId?: string) {
    if (!assetIds?.length || !startDate || !endDate) return { hasConflicts: false, conflicts: [] };
    const start = new Date(startDate);
    const end = new Date(endDate);
    const rows = await this.prisma.bookingItem.findMany({
      where: {
        assetId: { in: assetIds },
        booking: {
          status: { notIn: ['CANCELLED', 'COMPLETED', 'CLOSED', 'INQUIRY', 'QUOTED'] },
          id: excludeBookingId ? { not: excludeBookingId } : undefined,
          AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
        },
      },
      include: {
        asset: { select: { id: true, name: true } },
        booking: { select: { id: true, bookingNumber: true, status: true, startDate: true, endDate: true, client: { select: { companyName: true } } } },
      },
    });
    const conflicts = rows.map(r => ({
      assetId: r.assetId,
      assetName: r.asset?.name,
      bookingId: r.booking.id,
      bookingNumber: r.booking.bookingNumber,
      status: r.booking.status,
      client: r.booking.client?.companyName,
      startDate: r.booking.startDate,
      endDate: r.booking.endDate,
    }));
    return { hasConflicts: conflicts.length > 0, conflicts };
  }

  // ── Availability timeline (assets × dates) ────────────────────────────────
  async assetTimeline(from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);
    const [assets, bookings] = await Promise.all([
      this.prisma.asset.findMany({
        where: { isActive: true },
        select: { id: true, name: true, assetType: true, status: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.rentalBooking.findMany({
        where: {
          status: { notIn: ['CANCELLED'] },
          AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
        },
        select: {
          id: true, bookingNumber: true, status: true, startDate: true, endDate: true,
          client: { select: { companyName: true } },
          items: { select: { assetId: true } },
        },
        orderBy: { startDate: 'asc' },
      }),
    ]);
    const ranges: any[] = [];
    for (const b of bookings) {
      for (const it of b.items) {
        ranges.push({
          assetId: it.assetId, bookingId: b.id, bookingNumber: b.bookingNumber,
          status: b.status, client: b.client?.companyName,
          startDate: b.startDate, endDate: b.endDate,
        });
      }
    }
    return { from, to, assets, ranges };
  }

  // ── Utilization & revenue per asset ───────────────────────────────────────
  async assetUtilization(from: string, to: string) {
    const start = new Date(from);
    const end = new Date(to);
    const windowDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1);

    const [assets, items] = await Promise.all([
      this.prisma.asset.findMany({ where: { isActive: true }, select: { id: true, name: true, assetType: true } }),
      this.prisma.bookingItem.findMany({
        where: {
          booking: {
            status: { notIn: ['CANCELLED', 'INQUIRY', 'QUOTED'] },
            AND: [{ startDate: { lte: end } }, { endDate: { gte: start } }],
          },
        },
        select: { assetId: true, lineTotal: true, booking: { select: { startDate: true, endDate: true } } },
      }),
    ]);

    const map: Record<string, { daysBooked: number; revenue: number }> = {};
    for (const it of items) {
      const bs = new Date(it.booking.startDate);
      const be = new Date(it.booking.endDate);
      const os = bs > start ? bs : start;
      const oe = be < end ? be : end;
      const overlap = Math.max(0, Math.ceil((oe.getTime() - os.getTime()) / 86_400_000) + 1);
      if (!map[it.assetId]) map[it.assetId] = { daysBooked: 0, revenue: 0 };
      map[it.assetId].daysBooked += overlap;
      map[it.assetId].revenue += Number(it.lineTotal);
    }

    const rows = assets.map(a => {
      const m = map[a.id] || { daysBooked: 0, revenue: 0 };
      const utilizationPct = Math.min(100, Math.round((m.daysBooked / windowDays) * 100));
      return {
        assetId: a.id, name: a.name, assetType: a.assetType,
        daysBooked: m.daysBooked, windowDays, utilizationPct,
        revenue: Math.round(m.revenue * 100) / 100,
        revenuePerDay: m.daysBooked ? Math.round((m.revenue / m.daysBooked) * 100) / 100 : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    const totals = {
      revenue: Math.round(rows.reduce((s, r) => s + r.revenue, 0) * 100) / 100,
      avgUtilization: rows.length ? Math.round(rows.reduce((s, r) => s + r.utilizationPct, 0) / rows.length) : 0,
      activeAssets: rows.filter(r => r.daysBooked > 0).length,
    };
    return { from, to, windowDays, rows, totals };
  }

  async findAll(query: {
    status?: BookingStatus;
    clientId?: string;
    search?: string;
    startFrom?: string;
    startTo?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, clientId, search, startFrom, startTo, page = 1, limit = 25 } = query;
    const where: any = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (startFrom || startTo) {
      where.startDate = {};
      if (startFrom) where.startDate.gte = new Date(startFrom);
      if (startTo) where.startDate.lte = new Date(startTo);
    }
    if (search) {
      where.OR = [
        { bookingNumber: { contains: search, mode: 'insensitive' } },
        { client: { companyName: { contains: search, mode: 'insensitive' } } },
        { poNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.rentalBooking.findMany({
        where,
        include: {
          client: { select: { id: true, companyName: true } },
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { items: true, driverJobs: true } },
        },
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.rentalBooking.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const booking = await this.prisma.rentalBooking.findUnique({
      where: { id },
      include: {
        client: { include: { contacts: true } },
        quotation: { select: { id: true, quotationNumber: true } },
        items: {
          include: { asset: { select: { id: true, name: true, assetType: true, plateNumber: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        contract: true,
        driverJobs: {
          include: {
            driver: { select: { id: true, fullName: true, mobile: true } },
            asset: { select: { id: true, name: true } },
          },
        },
        invoices: { select: { id: true, invoiceNumber: true, status: true, total: true, amountDue: true } },
        damageReports: { select: { id: true, reportNumber: true, severity: true, reportedAt: true } },
        locations: { orderBy: { sequence: 'asc' } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    return booking;
  }

  // ── Location schedule (hire moving between sites) ──────────────────────────
  listLocations(bookingId: string) {
    return this.prisma.bookingLocation.findMany({ where: { bookingId }, orderBy: { sequence: 'asc' } });
  }
  async addLocation(bookingId: string, data: any) {
    const count = await this.prisma.bookingLocation.count({ where: { bookingId } });
    return this.prisma.bookingLocation.create({
      data: {
        bookingId, sequence: data.sequence ?? count,
        siteName: data.siteName, address: data.address, locationUrl: data.locationUrl,
        fromDate: data.fromDate ? new Date(data.fromDate) : null,
        toDate: data.toDate ? new Date(data.toDate) : null,
        status: data.status || 'PLANNED', notes: data.notes,
      },
    });
  }
  updateLocation(id: string, data: any) {
    const patch: any = {};
    for (const k of ['siteName', 'address', 'locationUrl', 'status', 'notes']) if (data[k] !== undefined) patch[k] = data[k];
    if (data.sequence !== undefined) patch.sequence = Number(data.sequence);
    if (data.fromDate !== undefined) patch.fromDate = data.fromDate ? new Date(data.fromDate) : null;
    if (data.toDate !== undefined) patch.toDate = data.toDate ? new Date(data.toDate) : null;
    return this.prisma.bookingLocation.update({ where: { id }, data: patch });
  }
  removeLocation(id: string) {
    return this.prisma.bookingLocation.delete({ where: { id } });
  }

  async create(data: any, userId: string) {
    // Double-booking guard (unless explicitly overridden)
    if (!data.allowConflicts && data.items?.length && data.startDate && data.endDate) {
      const assetIds = data.items.map((i: any) => i.assetId).filter(Boolean);
      const { hasConflicts, conflicts } = await this.checkConflicts(assetIds, data.startDate, data.endDate);
      if (hasConflicts) {
        const list = conflicts.map(c => `${c.assetName} is on ${c.bookingNumber} (${c.client})`).join('; ');
        throw new BadRequestException(`Scheduling conflict — ${list}. Choose different dates/assets, or confirm override.`);
      }
    }
    const bookingNumber = await this.nextNumber();

    // Calculate totals from items
    let subtotal = 0, vatAmount = 0;
    for (const item of (data.items || [])) {
      const lineTotal = item.unitPrice * item.days * (item.quantity || 1);
      subtotal += lineTotal;
      vatAmount += item.taxAmount || 0;
    }
    const total = subtotal - (data.discountAmount || 0) + vatAmount;

    return this.prisma.rentalBooking.create({
      data: {
        bookingNumber,
        clientId: data.clientId,
        quotationId: data.quotationId,
        status: 'INQUIRY',
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
        pickupDate: data.pickupDate ? new Date(data.pickupDate) : undefined,
        deliveryAddress: data.deliveryAddress,
        deliveryCity: data.deliveryCity,
        deliveryNotes: data.deliveryNotes,
        pickupAddress: data.pickupAddress,
        currency: data.currency || 'AED',
        subtotal,
        discountAmount: data.discountAmount || 0,
        vatAmount,
        total,
        depositAmount: data.depositAmount,
        notes: data.notes,
        internalNotes: data.internalNotes,
        poNumber: data.poNumber,
        createdById: userId,
        items: data.items ? {
          create: data.items.map((item: any, i: number) => ({
            assetId: item.assetId,
            sortOrder: i,
            description: item.description,
            quantity: item.quantity || 1,
            unit: item.unit || 'day',
            unitPrice: item.unitPrice,
            days: item.days,
            lineTotal: item.unitPrice * item.days * (item.quantity || 1),
            taxAmount: item.taxAmount || 0,
          })),
        } : undefined,
      },
      include: {
        client: { select: { id: true, companyName: true } },
        items: { include: { asset: { select: { id: true, name: true, assetType: true } } } },
      },
    });
  }

  async updateStatus(id: string, newStatus: BookingStatus) {
    const booking = await this.findOne(id);
    const allowed = ALLOWED_TRANSITIONS[booking.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${booking.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`
      );
    }
    return this.prisma.rentalBooking.update({ where: { id }, data: { status: newStatus } });
  }

  async update(id: string, data: any) {
    const booking = await this.findOne(id);
    if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
      throw new BadRequestException('Cannot edit a completed or cancelled booking');
    }
    const { items, ...bookingData } = data;
    return this.prisma.rentalBooking.update({
      where: { id },
      data: {
        ...bookingData,
        ...(bookingData.startDate && { startDate: new Date(bookingData.startDate) }),
        ...(bookingData.endDate && { endDate: new Date(bookingData.endDate) }),
        ...(bookingData.deliveryDate && { deliveryDate: new Date(bookingData.deliveryDate) }),
        ...(bookingData.pickupDate && { pickupDate: new Date(bookingData.pickupDate) }),
      },
    });
  }

  async getCalendar(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    return this.prisma.rentalBooking.findMany({
      where: {
        status: { notIn: ['CANCELLED'] },
        OR: [
          { startDate: { lte: end, gte: start } },
          { endDate: { gte: start, lte: end } },
          { AND: [{ startDate: { lte: start } }, { endDate: { gte: end } }] },
        ],
      },
      include: {
        client: { select: { companyName: true } },
        items: { include: { asset: { select: { id: true, name: true, assetType: true } } } },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async getDashboard() {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const year  = now.getFullYear();
    const yearStart = new Date(year, 0, 1);

    const [active, scheduled, todayDeliveries, todayPickups, statusCounts,
           recentBookings, ytdRevenue, assetStatusCounts] = await Promise.all([
      this.prisma.rentalBooking.count({ where: { status: 'ACTIVE' as any } }),
      this.prisma.rentalBooking.count({ where: { status: 'SCHEDULED' as any } }),
      this.prisma.rentalBooking.count({
        where: { deliveryDate: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED'] as any[] } },
      }),
      this.prisma.rentalBooking.count({
        where: { pickupDate: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED'] as any[] } },
      }),
      this.prisma.rentalBooking.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { status: { notIn: ['CANCELLED', 'COMPLETED'] as any[] } },
      }),
      this.prisma.rentalBooking.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, bookingNumber: true, status: true, total: true,
          startDate: true, endDate: true, createdAt: true,
          client: { select: { companyName: true } },
        },
      }),
      // YTD revenue from completed/active bookings
      this.prisma.rentalBooking.aggregate({
        where: { status: { in: ['COMPLETED', 'CLOSED', 'ACTIVE', 'ON_HIRE'] as any[] }, createdAt: { gte: yearStart } },
        _sum: { total: true },
      }),
      // Asset availability counts
      this.prisma.asset.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    // Monthly booking totals for chart (YTD)
    const allYtdBookings = await this.prisma.rentalBooking.findMany({
      where: { createdAt: { gte: yearStart }, status: { notIn: ['CANCELLED'] as any[] } },
      select: { createdAt: true, total: true },
    });

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthlyChart = months.map((name, i) => {
      const bookings = allYtdBookings.filter(b => new Date(b.createdAt).getMonth() === i);
      return {
        name,
        Revenue: Math.round(bookings.reduce((sum, b) => sum + Number(b.total), 0)),
        Bookings: bookings.length,
      };
    });

    return {
      active, scheduled, todayDeliveries, todayPickups, statusCounts,
      recentBookings,
      ytdRevenue: Number(ytdRevenue._sum.total ?? 0),
      monthlyChart,
      assetStatusCounts,
    };
  }
}
