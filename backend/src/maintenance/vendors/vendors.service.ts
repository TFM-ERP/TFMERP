import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    search?: string;
    vendorType?: string;
    isActive?: string;
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
        { contactPerson: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { mobile: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.vendorType) where.vendorType = query.vendorType;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [items, total] = await Promise.all([
      this.prisma.maintenanceVendor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { jobs: true, invoices: true } },
        },
      }),
      this.prisma.maintenanceVendor.count({ where }),
    ]);

    // Attach outstanding balance per vendor
    const vendorIds = items.map((v) => v.id);
    const balances = await this.getBalanceMap(vendorIds);

    return {
      items: items.map((v) => ({ ...v, ...balances[v.id] })),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const vendor = await (this.prisma.maintenanceVendor as any).findUnique({
      where: { id },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        jobs: {
          orderBy: { openedAt: 'desc' },
          take: 20,
          include: {
            asset: { select: { id: true, name: true, assetType: true, plateNumber: true } },
          },
        },
        quotations: { orderBy: { issuedAt: 'desc' }, take: 10 },
        invoices: { orderBy: { issuedAt: 'desc' }, take: 20 },
        payments: { orderBy: { paymentDate: 'desc' }, take: 20 },
        supplier: { select: { id: true, name: true, supplierCode: true } },
        _count: { select: { jobs: true, invoices: true, payments: true } },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const [balance] = await Promise.all([this.getBalanceMap([id])]);
    return { ...vendor, ...balance[id] };
  }

  async create(dto: any) {
    return (this.prisma.maintenanceVendor as any).create({ data: dto });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return (this.prisma.maintenanceVendor as any).update({ where: { id }, data: dto });
  }

  async addDocument(vendorId: string, dto: any) {
    await this.findOne(vendorId);
    return this.prisma.vendorDocument.create({ data: { ...dto, vendorId } });
  }

  async removeDocument(docId: string) {
    return this.prisma.vendorDocument.delete({ where: { id: docId } });
  }

  async getFinancialSummary(id: string) {
    const [invoices, payments] = await Promise.all([
      this.prisma.vendorInvoice.groupBy({
        by: ['status'],
        where: { vendorId: id },
        _sum: { total: true, amountPaid: true, amountDue: true },
      }),
      this.prisma.vendorPayment.aggregate({
        where: { vendorId: id, status: 'CLEARED' },
        _sum: { amount: true },
      }),
    ]);

    const totalInvoiced = invoices.reduce(
      (acc, g) => acc + Number(g._sum.total || 0),
      0,
    );
    const totalPaid = Number(payments._sum.amount || 0);
    const outstanding = invoices.reduce(
      (acc, g) => acc + Number(g._sum.amountDue || 0),
      0,
    );

    return { totalInvoiced, totalPaid, outstanding, invoicesByStatus: invoices };
  }

  private async getBalanceMap(vendorIds: string[]) {
    const result: Record<string, { outstandingBalance: number; totalPaid: number }> = {};
    for (const id of vendorIds) {
      result[id] = { outstandingBalance: 0, totalPaid: 0 };
    }
    const [dues, paid] = await Promise.all([
      this.prisma.vendorInvoice.groupBy({
        by: ['vendorId'],
        where: { vendorId: { in: vendorIds }, status: { notIn: ['CANCELLED'] } },
        _sum: { amountDue: true },
      }),
      this.prisma.vendorPayment.groupBy({
        by: ['vendorId'],
        where: { vendorId: { in: vendorIds }, status: 'CLEARED' },
        _sum: { amount: true },
      }),
    ]);
    for (const d of dues) {
      if (result[d.vendorId]) result[d.vendorId].outstandingBalance = Number(d._sum.amountDue || 0);
    }
    for (const p of paid) {
      if (result[p.vendorId]) result[p.vendorId].totalPaid = Number(p._sum.amount || 0);
    }
    return result;
  }
}
