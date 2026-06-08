import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  private async nextJobNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({
      where: { prefix: 'VJ' },
      update: { lastNumber: { increment: 1 } },
      create: { prefix: 'VJ', lastNumber: 1, year },
    });
    return `VJ-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  async findAll(query: {
    search?: string;
    vendorId?: string;
    assetId?: string;
    status?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 25;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { jobNumber: { contains: query.search, mode: 'insensitive' } },
        { problemDescription: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.assetId) where.assetId = query.assetId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;

    const [items, total] = await Promise.all([
      this.prisma.vendorMaintenanceJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: {
          vendor: { select: { id: true, name: true, vendorType: true } },
          asset: { select: { id: true, name: true, assetType: true, plateNumber: true } },
          _count: { select: { spareParts: true, invoices: true } },
        },
      }),
      this.prisma.vendorMaintenanceJob.count({ where }),
    ]);

    return { items, total, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const job = await this.prisma.vendorMaintenanceJob.findUnique({
      where: { id },
      include: {
        vendor: true,
        asset: { select: { id: true, name: true, assetType: true, plateNumber: true, plateEmirate: true, vinNumber: true, condition: true } },
        spareParts: { include: { vendor: { select: { id: true, name: true } } } },
        quotations: { orderBy: { issuedAt: 'desc' } },
        invoices: { include: { payments: true } },
        tireRecords: true,
      },
    });
    if (!job) throw new NotFoundException('Maintenance job not found');
    return job;
  }

  async create(dto: any) {
    const jobNumber = await this.nextJobNumber();
    return this.prisma.vendorMaintenanceJob.create({
      data: {
        ...dto,
        jobNumber,
        laborCost: dto.laborCost ? Number(dto.laborCost) : undefined,
        partsCost: dto.partsCost ? Number(dto.partsCost) : undefined,
      },
      include: {
        vendor: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true, assetType: true } },
      },
    });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    // Recompute totals if labor/parts changed
    const labor = dto.laborCost !== undefined ? Number(dto.laborCost) : undefined;
    const parts = dto.partsCost !== undefined ? Number(dto.partsCost) : undefined;
    if (labor !== undefined || parts !== undefined) {
      const current = await this.prisma.vendorMaintenanceJob.findUnique({ where: { id } });
      const l = labor ?? Number(current!.laborCost ?? 0);
      const p = parts ?? Number(current!.partsCost ?? 0);
      const sub = l + p;
      dto.subtotal = sub;
      dto.vatAmount = Math.round(sub * 0.05 * 100) / 100;
      dto.totalCost = sub + dto.vatAmount;
    }
    return this.prisma.vendorMaintenanceJob.update({
      where: { id },
      data: dto,
      include: {
        vendor: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true, assetType: true } },
      },
    });
  }

  async updateStatus(id: string, status: string) {
    const data: any = { status };
    if (status === 'COMPLETED') data.actualCompletion = new Date();
    return this.prisma.vendorMaintenanceJob.update({ where: { id }, data });
  }

  async addPhoto(id: string, url: string) {
    const job = await this.findOne(id);
    const photos = [...(job.photos || []), url];
    return this.prisma.vendorMaintenanceJob.update({ where: { id }, data: { photos } });
  }

  async removePhoto(id: string, url: string) {
    const job = await this.findOne(id);
    const photos = (job.photos || []).filter((p: string) => p !== url);
    return this.prisma.vendorMaintenanceJob.update({ where: { id }, data: { photos } });
  }

  async getSummary() {
    const [byStatus, byPriority, recentJobs, totalCost] = await Promise.all([
      this.prisma.vendorMaintenanceJob.groupBy({ by: ['status'], _count: true }),
      this.prisma.vendorMaintenanceJob.groupBy({ by: ['priority'], _count: true, where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      this.prisma.vendorMaintenanceJob.findMany({ take: 5, orderBy: { openedAt: 'desc' }, include: { vendor: { select: { name: true } }, asset: { select: { name: true } } } }),
      this.prisma.vendorMaintenanceJob.aggregate({ _sum: { totalCost: true }, where: { status: 'COMPLETED' } }),
    ]);
    return { byStatus, byPriority, recentJobs, totalCompletedCost: Number(totalCost._sum.totalCost || 0) };
  }

  // Cost report per asset
  async getCostPerAsset() {
    return this.prisma.vendorMaintenanceJob.groupBy({
      by: ['assetId'],
      _sum: { totalCost: true },
      _count: true,
      where: { status: 'COMPLETED', assetId: { not: null } },
      orderBy: { _sum: { totalCost: 'desc' } },
    });
  }

  // Cost report per vendor
  async getCostPerVendor() {
    return this.prisma.vendorMaintenanceJob.groupBy({
      by: ['vendorId'],
      _sum: { totalCost: true },
      _count: true,
      where: { status: 'COMPLETED' },
      orderBy: { _sum: { totalCost: 'desc' } },
    });
  }
}
