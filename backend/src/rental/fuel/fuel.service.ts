import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FuelService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { assetId?: string; page?: number; limit?: number }) {
    const { assetId, page = 1, limit = 25 } = query;
    const where: any = {};
    if (assetId) where.assetId = assetId;

    const [items, total] = await Promise.all([
      this.prisma.fuelLog.findMany({
        where,
        include: {
          asset: { select: { id: true, name: true, assetType: true, plateNumber: true } },
        },
        orderBy: { logDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.fuelLog.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async create(data: any) {
    const asset = await this.prisma.asset.findUnique({ where: { id: data.assetId } });
    if (!asset) throw new NotFoundException(`Asset ${data.assetId} not found`);

    const litres = Number(data.litres || data.liters);
    const costPerLitre = Number(data.costPerLitre || data.pricePerLiter);
    const totalCost = litres * costPerLitre;

    return this.prisma.fuelLog.create({
      data: {
        assetId: data.assetId,
        logDate: new Date(data.logDate),
        litres,
        costPerLitre,
        totalCost,
        odometer: data.odometer,
        notes: data.fuelStation ? `Station: ${data.fuelStation}` : data.notes,
      },
      include: {
        asset: { select: { id: true, name: true, assetType: true } },
      },
    });
  }

  async delete(id: string) {
    const log = await this.prisma.fuelLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException(`Fuel log ${id} not found`);
    return this.prisma.fuelLog.delete({ where: { id } });
  }

  async getSummary(assetId?: string, startDate?: string, endDate?: string) {
    const where: any = {};
    if (assetId) where.assetId = assetId;
    if (startDate || endDate) {
      where.logDate = {};
      if (startDate) where.logDate.gte = new Date(startDate);
      if (endDate) where.logDate.lte = new Date(endDate);
    }

    const totals = await this.prisma.fuelLog.aggregate({
      where,
      _sum: { litres: true, totalCost: true },
      _count: { id: true },
      _avg: { costPerLitre: true },
    });

    // Group by asset using findMany + reduce (avoids groupBy type complexity)
    const logs = await this.prisma.fuelLog.findMany({
      where,
      select: { assetId: true, litres: true, totalCost: true },
    });

    const byAssetMap: Record<string, { fills: number; litres: number; totalCost: number }> = {};
    for (const log of logs) {
      if (!byAssetMap[log.assetId]) byAssetMap[log.assetId] = { fills: 0, litres: 0, totalCost: 0 };
      byAssetMap[log.assetId].fills += 1;
      byAssetMap[log.assetId].litres += Number(log.litres);
      byAssetMap[log.assetId].totalCost += Number(log.totalCost);
    }

    const assetIds = Object.keys(byAssetMap);
    const assets = await this.prisma.asset.findMany({
      where: { id: { in: assetIds } },
      select: { id: true, name: true, assetType: true },
    });
    const assetMap = Object.fromEntries(assets.map(a => [a.id, a]));

    return {
      totalLitres: totals._sum.litres || 0,
      totalCost: totals._sum.totalCost || 0,
      totalFills: totals._count.id,
      avgCostPerLitre: totals._avg.costPerLitre || 0,
      byAsset: Object.entries(byAssetMap)
        .map(([id, stats]) => ({ asset: assetMap[id], ...stats }))
        .sort((a, b) => b.totalCost - a.totalCost),
    };
  }
}
