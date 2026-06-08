import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IncidentType, IncidentUrgency, IncidentStatus } from '@prisma/client';

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) {}

  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.incidentReport.count({
      where: { incidentNumber: { startsWith: `INC-${year}-` } },
    });
    return `INC-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async findAll(query: {
    status?: IncidentStatus;
    incidentType?: IncidentType;
    urgency?: IncidentUrgency;
    driverId?: string;
    assetId?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, incidentType, urgency, driverId, assetId, page = 1, limit = 25 } = query;
    const where: any = {};
    if (status) where.status = status;
    if (incidentType) where.incidentType = incidentType;
    if (urgency) where.urgency = urgency;
    if (driverId) where.driverId = driverId;
    if (assetId) where.assetId = assetId;

    const [items, total] = await Promise.all([
      this.prisma.incidentReport.findMany({
        where,
        include: {
          driver: { select: { id: true, fullName: true, mobile: true } },
          asset: { select: { id: true, name: true, assetType: true, plateNumber: true } },
          booking: { select: { id: true, bookingNumber: true } },
        },
        orderBy: [{ urgency: 'desc' }, { occurredAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.incidentReport.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const incident = await this.prisma.incidentReport.findUnique({
      where: { id },
      include: {
        driver: { select: { id: true, fullName: true, mobile: true, driverType: true } },
        asset: { select: { id: true, name: true, assetType: true, plateNumber: true } },
        booking: { select: { id: true, bookingNumber: true, startDate: true, endDate: true } },
      },
    });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  async create(data: any) {
    const incidentNumber = await this.nextNumber();
    return this.prisma.incidentReport.create({
      data: {
        incidentNumber,
        incidentType: data.incidentType,
        urgency: data.urgency || 'MEDIUM',
        title: data.title,
        description: data.description,
        location: data.location,
        gpsLocation: data.gpsLocation,
        occurredAt: data.occurredAt ? new Date(data.occurredAt) : new Date(),
        photos: data.photos || [],
        driverId: data.driverId || undefined,
        assetId: data.assetId || undefined,
        bookingId: data.bookingId || undefined,
      },
      include: {
        driver: { select: { id: true, fullName: true } },
        asset: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.incidentReport.update({
      where: { id },
      data: {
        incidentType: data.incidentType,
        urgency: data.urgency,
        title: data.title,
        description: data.description,
        location: data.location,
        photos: data.photos,
        driverId: data.driverId || undefined,
        assetId: data.assetId || undefined,
        bookingId: data.bookingId || undefined,
      },
    });
  }

  async resolve(id: string, data: { resolutionNotes: string; resolutionCost?: number }) {
    await this.findOne(id);
    return this.prisma.incidentReport.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionNotes: data.resolutionNotes,
        resolutionCost: data.resolutionCost ? data.resolutionCost : undefined,
      },
    });
  }

  async updateStatus(id: string, status: IncidentStatus) {
    await this.findOne(id);
    return this.prisma.incidentReport.update({
      where: { id },
      data: { status },
    });
  }

  async getSummary() {
    const [byStatus, byType, byUrgency, openCount] = await Promise.all([
      this.prisma.incidentReport.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.incidentReport.groupBy({ by: ['incidentType'], _count: { id: true } }),
      this.prisma.incidentReport.groupBy({
        by: ['urgency'],
        _count: { id: true },
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.incidentReport.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ]);
    return { byStatus, byType, byUrgency, openCount };
  }
}
