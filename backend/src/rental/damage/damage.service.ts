import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DamageService {
  constructor(private prisma: PrismaService) {}

  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({
      where: { prefix: 'DR' },
      update: { lastNumber: { increment: 1 } },
      create: { prefix: 'DR', lastNumber: 1, year },
    });
    return `DR-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  async findAll(query: {
    bookingId?: string;
    assetId?: string;
    severity?: string;
    page?: number;
    limit?: number;
  }) {
    const { bookingId, assetId, severity, page = 1, limit = 25 } = query;
    const where: any = {};
    if (bookingId) where.bookingId = bookingId;
    if (assetId) where.assetId = assetId;
    if (severity) where.severity = severity;

    const [items, total] = await Promise.all([
      this.prisma.damageReport.findMany({
        where,
        include: {
          booking: { select: { id: true, bookingNumber: true } },
          asset: { select: { id: true, name: true, assetType: true } },
          reportedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { reportedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.damageReport.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const report = await this.prisma.damageReport.findUnique({
      where: { id },
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            client: { select: { id: true, companyName: true } },
          },
        },
        asset: { select: { id: true, name: true, assetType: true, plateNumber: true } },
        reportedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!report) throw new NotFoundException(`Damage report ${id} not found`);
    return report;
  }

  async create(data: any, userId: string) {
    const reportNumber = await this.nextNumber();

    return this.prisma.damageReport.create({
      data: {
        reportNumber,
        bookingId: data.bookingId,
        assetId: data.assetId,
        reportedById: userId,
        severity: data.severity || 'MINOR',
        description: data.description,
        repairCost: data.repairCost ? Number(data.repairCost) : undefined,
        clientLiable: data.chargeToClient ?? data.clientLiable ?? false,
        photos: data.photoUrls || data.photos || [],
        resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : undefined,
        resolutionNotes: data.notes,
      },
      include: {
        booking: { select: { id: true, bookingNumber: true } },
        asset: { select: { id: true, name: true, assetType: true } },
        reportedBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.damageReport.update({
      where: { id },
      data: {
        severity: data.severity,
        description: data.description,
        repairCost: data.repairCost ? Number(data.repairCost) : undefined,
        clientLiable: data.chargeToClient ?? data.clientLiable,
        photos: data.photoUrls || data.photos,
        resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : undefined,
        resolutionNotes: data.notes,
      },
    });
  }

  async resolve(id: string, repairCost: number) {
    await this.findOne(id);
    return this.prisma.damageReport.update({
      where: { id },
      data: { resolvedAt: new Date(), repairCost },
    });
  }
}
