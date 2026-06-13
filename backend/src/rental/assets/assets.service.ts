import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AssetStatus, AssetType } from '@prisma/client';

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    assetType?: AssetType;
    status?: AssetStatus;
    category?: string;
    search?: string;
    availableFrom?: string;
    availableTo?: string;
    page?: number;
    limit?: number;
  }) {
    // NestJS passes query params as strings — always coerce to numbers
    const page  = Math.max(1, Number(query.page)  || 1);
    const limit = Math.max(1, Number(query.limit) || 30);
    const skip  = (page - 1) * limit;
    const { assetType, status, search, category } = query;

    const where: any = { isActive: true };
    if (assetType) where.assetType = assetType;
    if (status)    where.status    = status;
    if (category)  where.category  = category;
    if (search) {
      where.OR = [
        { name:         { contains: search, mode: 'insensitive' } },
        { plateNumber:  { contains: search, mode: 'insensitive' } },
        { vinNumber:    { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: {
          linkedGenerator: { select: { id: true, name: true, status: true } },
          _count: {
            select: { bookingItems: true, maintenanceLogs: true, damageReports: true },
          },
        },
        orderBy: [{ assetType: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.asset.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        linkedGenerator: true,
        connectedTrailers: { select: { id: true, name: true, assetType: true, status: true } },
        maintenanceLogs: {
          orderBy: { scheduledDate: 'desc' },
          take: 10,
        },
        damageReports: {
          orderBy: { reportedAt: 'desc' },
          take: 5,
        },
        fuelLogs: {
          orderBy: { logDate: 'desc' },
          take: 10,
        },
      },
    });
    if (!asset) throw new NotFoundException(`Asset ${id} not found`);
    return asset;
  }

  async create(data: any) {
    return this.prisma.asset.create({ data: this.sanitize(data) });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.asset.update({ where: { id }, data: this.sanitize(data) });
  }

  private sanitize(data: any) {
    const d: any = {};

    // Required strings
    if (data.name !== undefined) d.name = data.name;
    if (data.assetType !== undefined) d.assetType = data.assetType;

    // Optional strings — drop empty string so nullable cols stay NULL
    const optStr = [
      'category', 'serialNumber', 'warrantyProvider',
      'plateNumber', 'plateEmirate', 'vinNumber', 'condition', 'notes', 'qrCode', 'status',
      'registrationDocUrl', 'insurancePolicyRef', 'insuranceDocUrl',
      'tilePhoto', // photo tagged as the tile background (grid view)
    ];
    for (const k of optStr) {
      if (data[k] !== undefined) d[k] = data[k] || undefined;
    }

    // Dates — parse ISO string, reject empty
    for (const k of ['registrationExpiry', 'insuranceExpiry', 'warrantyExpiry', 'purchaseDate']) {
      if (data[k]) d[k] = new Date(data[k]);
    }

    // Decimals
    for (const k of ['purchaseValue', 'currentValue', 'depreciation']) {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
        d[k] = Number(data[k]);
      }
    }

    // Photo gallery (array of /uploads URLs, capped at 15)
    if (Array.isArray(data.photos)) {
      d.photos = data.photos.filter((p: any) => typeof p === 'string' && p).slice(0, 15);
    }

    // JSON (legacy trailer specs + new category-specific specs)
    if (data.trailerSpecs !== undefined && data.trailerSpecs !== null) {
      d.trailerSpecs = data.trailerSpecs;
    }
    if (data.specs !== undefined && data.specs !== null) {
      d.specs = data.specs;
    }

    // FK
    if (data.linkedGeneratorId) d.linkedGeneratorId = data.linkedGeneratorId;
    if (data.isActive !== undefined) d.isActive = data.isActive;

    return d;
  }

  async updateStatus(id: string, status: AssetStatus) {
    await this.findOne(id);
    return this.prisma.asset.update({ where: { id }, data: { status } });
  }

  async checkAvailability(assetId: string, startDate: string, endDate: string, excludeBookingId?: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const conflicts = await this.prisma.bookingItem.findMany({
      where: {
        assetId,
        booking: {
          status: { notIn: ['CANCELLED', 'COMPLETED'] },
          id: excludeBookingId ? { not: excludeBookingId } : undefined,
          AND: [
            { startDate: { lte: end } },
            { endDate: { gte: start } },
          ],
        },
      },
      include: {
        booking: {
          select: {
            id: true, bookingNumber: true, status: true,
            startDate: true, endDate: true,
            client: { select: { companyName: true } },
          },
        },
      },
    });

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.map(c => c.booking),
    };
  }

  async getUtilizationReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);

    const assets = await this.prisma.asset.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, assetType: true,
        bookingItems: {
          where: {
            booking: {
              startDate: { lte: end },
              endDate: { gte: start },
              status: { notIn: ['CANCELLED'] },
            },
          },
          select: { days: true },
        },
      },
    });

    return assets.map(a => {
      const hiredDays = a.bookingItems.reduce((s, i) => s + i.days, 0);
      return {
        id: a.id,
        name: a.name,
        assetType: a.assetType,
        hiredDays: Math.min(hiredDays, totalDays),
        availableDays: totalDays,
        utilizationRate: totalDays > 0 ? Math.min(100, (hiredDays / totalDays) * 100).toFixed(1) : 0,
      };
    }).sort((a, b) => Number(b.utilizationRate) - Number(a.utilizationRate));
  }

  async getExpiryAlerts() {
    const now = new Date();
    const in60Days = new Date(now.getTime() + 60 * 86400000);

    return this.prisma.asset.findMany({
      where: {
        isActive: true,
        OR: [
          { registrationExpiry: { lte: in60Days } },
          { insuranceExpiry: { lte: in60Days } },
        ],
      },
      select: {
        id: true, name: true, assetType: true, plateNumber: true,
        registrationExpiry: true, insuranceExpiry: true,
      },
      orderBy: { registrationExpiry: 'asc' },
    });
  }
}
