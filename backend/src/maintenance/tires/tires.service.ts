import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TiresService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { assetId?: string; vendorId?: string; page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 50;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.assetId) where.assetId = query.assetId;
    if (query.vendorId) where.vendorId = query.vendorId;

    const [items, total] = await Promise.all([
      this.prisma.tireRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { installationDate: 'desc' },
        include: {
          asset: { select: { id: true, name: true, assetType: true, plateNumber: true } },
          vendor: { select: { id: true, name: true } },
        },
      }),
      this.prisma.tireRecord.count({ where }),
    ]);

    return { items, total, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const tire = await this.prisma.tireRecord.findUnique({
      where: { id },
      include: {
        asset: true,
        vendor: { select: { id: true, name: true } },
        job: { select: { id: true, jobNumber: true } },
      },
    });
    if (!tire) throw new NotFoundException('Tire record not found');
    return tire;
  }

  async create(dto: any) {
    return this.prisma.tireRecord.create({ data: { ...dto, purchasePrice: dto.purchasePrice ? Number(dto.purchasePrice) : undefined } });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.tireRecord.update({ where: { id }, data: dto });
  }

  async getWarrantyAlerts() {
    const in60Days = new Date(Date.now() + 60 * 86400000);
    return this.prisma.tireRecord.findMany({
      where: { warrantyEnd: { lte: in60Days, gte: new Date() }, isActive: true },
      include: { asset: { select: { id: true, name: true, plateNumber: true } } },
      orderBy: { warrantyEnd: 'asc' },
    });
  }

  async getByAsset(assetId: string) {
    return this.prisma.tireRecord.findMany({
      where: { assetId },
      orderBy: [{ isActive: 'desc' }, { installationDate: 'desc' }],
      include: { vendor: { select: { id: true, name: true } } },
    });
  }
}
