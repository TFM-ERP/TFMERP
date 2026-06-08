import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MaintenanceType, MaintenanceStatus } from '@prisma/client';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    assetId?: string;
    maintenanceType?: MaintenanceType;
    status?: MaintenanceStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    // NestJS passes query params as strings — always coerce to numbers
    const page  = Math.max(1, Number(query.page)  || 1);
    const limit = Math.max(1, Number(query.limit) || 25);
    const skip  = (page - 1) * limit;
    const { assetId, maintenanceType, status, search } = query;

    const where: any = {};
    if (assetId)         where.assetId         = assetId;
    if (maintenanceType) where.maintenanceType = maintenanceType;
    if (status)          where.status          = status;
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { vendorName:  { contains: search, mode: 'insensitive' } },
        { asset: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.maintenanceLog.findMany({
        where,
        include: {
          asset: { select: { id: true, name: true, assetType: true, plateNumber: true, status: true } },
        },
        orderBy: { scheduledDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.maintenanceLog.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const log = await this.prisma.maintenanceLog.findUnique({
      where: { id },
      include: {
        asset: { select: { id: true, name: true, assetType: true, plateNumber: true, status: true } },
      },
    });
    if (!log) throw new NotFoundException(`Maintenance log ${id} not found`);
    return log;
  }

  async create(data: any) {
    const asset = await this.prisma.asset.findUnique({ where: { id: data.assetId } });
    if (!asset) throw new NotFoundException(`Asset ${data.assetId} not found`);

    const log = await this.prisma.maintenanceLog.create({
      data: {
        assetId:         data.assetId,
        maintenanceType: data.maintenanceType || 'PREVENTIVE',
        status:          'SCHEDULED',
        scheduledDate:   new Date(data.scheduledDate),
        description:     data.description,
        vendorName:      data.vendorName || undefined,
        cost:            data.cost !== undefined && data.cost !== '' ? Number(data.cost) : undefined,
        technicianNotes: data.notes || undefined,
        nextServiceDate: data.nextServiceDate ? new Date(data.nextServiceDate) : undefined,
        nextServiceKm:   data.nextServiceKm   ? Number(data.nextServiceKm)   : undefined,
        downTimeDays:    data.downTimeDays     ? Number(data.downTimeDays)    : undefined,
      },
      include: {
        asset: { select: { id: true, name: true, assetType: true, plateNumber: true, status: true } },
      },
    });

    // Mark asset IN_MAINTENANCE if scheduled for today
    const today        = new Date(); today.setHours(0, 0, 0, 0);
    const scheduledDay = new Date(data.scheduledDate); scheduledDay.setHours(0, 0, 0, 0);
    if (scheduledDay.getTime() === today.getTime()) {
      await this.prisma.asset.update({
        where: { id: data.assetId },
        data:  { status: 'IN_MAINTENANCE' },
      });
    }

    return log;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const d: any = {};
    if (data.maintenanceType !== undefined) d.maintenanceType = data.maintenanceType;
    if (data.status          !== undefined) d.status          = data.status;
    if (data.scheduledDate)   d.scheduledDate   = new Date(data.scheduledDate);
    if (data.completedDate)   d.completedDate   = new Date(data.completedDate);
    if (data.description     !== undefined) d.description     = data.description;
    if (data.vendorName      !== undefined) d.vendorName      = data.vendorName || null;
    if (data.cost            !== undefined && data.cost !== '') d.cost = Number(data.cost);
    if (data.notes           !== undefined) d.technicianNotes = data.notes;
    if (data.nextServiceDate)  d.nextServiceDate = new Date(data.nextServiceDate);
    if (data.nextServiceKm   !== undefined) d.nextServiceKm   = Number(data.nextServiceKm);
    if (data.downTimeDays    !== undefined) d.downTimeDays    = Number(data.downTimeDays);
    if (data.invoiceRef      !== undefined) d.invoiceRef      = data.invoiceRef;
    if (data.partsReplaced   !== undefined) d.partsReplaced   = data.partsReplaced;

    return this.prisma.maintenanceLog.update({
      where: { id },
      data:  d,
      include: {
        asset: { select: { id: true, name: true, assetType: true, plateNumber: true, status: true } },
      },
    });
  }

  async start(id: string) {
    const log = await this.findOne(id);
    if (log.status !== 'SCHEDULED') {
      throw new BadRequestException('Only SCHEDULED maintenance can be started');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceLog.update({
        where: { id },
        data:  { status: 'IN_PROGRESS' },
        include: { asset: { select: { id: true, name: true, assetType: true, plateNumber: true, status: true } } },
      });
      await tx.asset.update({
        where: { id: updated.assetId },
        data:  { status: 'IN_MAINTENANCE' },
      });
      return updated;
    });
  }

  async complete(id: string, actualCost: number, notes?: string, invoiceRef?: string, partsReplaced?: string, nextServiceDate?: string, downTimeDays?: number) {
    const log = await this.findOne(id);
    if (log.status === 'COMPLETED') throw new BadRequestException('Already completed');
    if (log.status === 'CANCELLED') throw new BadRequestException('Cannot complete a cancelled log');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceLog.update({
        where: { id },
        data: {
          status:          'COMPLETED',
          completedDate:   new Date(),
          cost:            actualCost !== undefined ? Number(actualCost) : undefined,
          technicianNotes: notes || undefined,
          invoiceRef:      invoiceRef || undefined,
          partsReplaced:   partsReplaced || undefined,
          nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : undefined,
          downTimeDays:    downTimeDays ? Number(downTimeDays) : undefined,
        },
        include: { asset: { select: { id: true, name: true, assetType: true, plateNumber: true, status: true } } },
      });
      await tx.asset.update({
        where: { id: updated.assetId },
        data:  { status: 'AVAILABLE' },
      });
      return updated;
    });
  }

  async cancel(id: string, reason?: string) {
    const log = await this.findOne(id);
    if (log.status === 'COMPLETED') throw new BadRequestException('Cannot cancel a completed log');
    if (log.status === 'CANCELLED') throw new BadRequestException('Already cancelled');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceLog.update({
        where: { id },
        data: {
          status:          'CANCELLED',
          technicianNotes: reason ? `[Cancelled] ${reason}` : undefined,
        },
        include: { asset: { select: { id: true, name: true, assetType: true, plateNumber: true, status: true } } },
      });
      // If asset was set IN_MAINTENANCE by this log, restore it
      const asset = await tx.asset.findUnique({ where: { id: updated.assetId } });
      if (asset?.status === 'IN_MAINTENANCE') {
        await tx.asset.update({
          where: { id: updated.assetId },
          data:  { status: 'AVAILABLE' },
        });
      }
      return updated;
    });
  }

  async getSchedule(assetId?: string) {
    const now       = new Date();
    const in30Days  = new Date(now.getTime() + 30 * 86400000);
    return this.prisma.maintenanceLog.findMany({
      where: {
        status:        { in: ['SCHEDULED', 'IN_PROGRESS'] },
        scheduledDate: { gte: now, lte: in30Days },
        ...(assetId && { assetId }),
      },
      include: {
        asset: { select: { id: true, name: true, assetType: true } },
      },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  async getOverdue() {
    const now = new Date();
    return this.prisma.maintenanceLog.findMany({
      where: {
        status:        { in: ['SCHEDULED', 'IN_PROGRESS'] },
        scheduledDate: { lt: now },
      },
      include: {
        asset: { select: { id: true, name: true, assetType: true, plateNumber: true } },
      },
      orderBy: { scheduledDate: 'asc' },
    });
  }
}
