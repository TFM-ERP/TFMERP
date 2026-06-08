import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PartsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    search?: string;
    assetId?: string;
    vendorId?: string;
    expiringWarranty?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 25;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { partNumber: { contains: query.search, mode: 'insensitive' } },
        { manufacturer: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.assetId) where.assetId = query.assetId;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.expiringWarranty === 'true') {
      const in90Days = new Date(Date.now() + 90 * 86400000);
      where.warrantyEnd = { lte: in90Days, gte: new Date() };
    }

    const [items, total] = await Promise.all([
      this.prisma.sparePart.findMany({
        where,
        skip,
        take: limit,
        orderBy: { installationDate: 'desc' },
        include: {
          asset: { select: { id: true, name: true, assetType: true } },
          vendor: { select: { id: true, name: true } },
          job: { select: { id: true, jobNumber: true } },
        },
      }),
      this.prisma.sparePart.count({ where }),
    ]);

    return { items, total, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const part = await this.prisma.sparePart.findUnique({
      where: { id },
      include: {
        asset: true,
        vendor: { select: { id: true, name: true, vendorType: true } },
        job: { select: { id: true, jobNumber: true } },
      },
    });
    if (!part) throw new NotFoundException('Part not found');
    return part;
  }

  async create(dto: any) {
    return this.prisma.sparePart.create({
      data: {
        ...dto,
        purchasePrice: dto.purchasePrice ? Number(dto.purchasePrice) : undefined,
        vatAmount: dto.vatAmount ? Number(dto.vatAmount) : undefined,
        expectedLifespanYears: dto.expectedLifespanYears ? Number(dto.expectedLifespanYears) : undefined,
      },
    });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.sparePart.update({ where: { id }, data: dto });
  }

  async getWarrantyAlerts() {
    const in60Days = new Date(Date.now() + 60 * 86400000);
    return this.prisma.sparePart.findMany({
      where: { warrantyEnd: { lte: in60Days }, isActive: true },
      include: {
        asset: { select: { id: true, name: true } },
        vendor: { select: { id: true, name: true } },
      },
      orderBy: { warrantyEnd: 'asc' },
    });
  }
}
