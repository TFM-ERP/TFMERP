import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  // ── Service catalog items ─────────────────────────────────────────────────
  async findAll(query: { search?: string; category?: string; isActive?: string | boolean } = {}) {
    const where: any = {};
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true' || query.isActive === true;
    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { category: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.serviceItem.findMany({
      where,
      include: { taxRate: true, costCenter: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.serviceItem.findUnique({
      where: { id },
      include: { taxRate: true, costCenter: true },
    });
    if (!item) throw new NotFoundException(`Service ${id} not found`);
    return item;
  }

  private clean(data: any) {
    const out: any = {};
    for (const k of ['name', 'category', 'unitOfMeasure', 'description']) {
      if (data[k] !== undefined) out[k] = data[k] || undefined;
    }
    if (data.unitPrice !== undefined && data.unitPrice !== '') out.unitPrice = Number(data.unitPrice);
    if (data.taxRateId !== undefined) out.taxRateId = data.taxRateId || null;
    if (data.costCenterId !== undefined) out.costCenterId = data.costCenterId || null;
    if (data.isActive !== undefined) out.isActive = !!data.isActive;
    return out;
  }

  async create(data: any) {
    return this.prisma.serviceItem.create({ data: this.clean(data), include: { taxRate: true, costCenter: true } });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.serviceItem.update({ where: { id }, data: this.clean(data), include: { taxRate: true, costCenter: true } });
  }

  async toggleActive(id: string) {
    const item = await this.findOne(id);
    return this.prisma.serviceItem.update({ where: { id }, data: { isActive: !item.isActive } });
  }

  async categories() {
    const rows = await this.prisma.serviceItem.findMany({ select: { category: true }, distinct: ['category'] });
    return rows.map((r) => r.category).filter(Boolean);
  }

  // ── Cost centers ──────────────────────────────────────────────────────────
  async listCostCenters() {
    return this.prisma.costCenter.findMany({ orderBy: { name: 'asc' } });
  }

  async createCostCenter(data: any) {
    return this.prisma.costCenter.create({
      data: { name: data.name, code: data.code || undefined, isActive: data.isActive ?? true },
    });
  }

  async updateCostCenter(id: string, data: any) {
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.code !== undefined) patch.code = data.code || null;
    if (data.isActive !== undefined) patch.isActive = !!data.isActive;
    return this.prisma.costCenter.update({ where: { id }, data: patch });
  }

  async deleteCostCenter(id: string) {
    // Soft-delete to preserve links from services
    return this.prisma.costCenter.update({ where: { id }, data: { isActive: false } });
  }
}
