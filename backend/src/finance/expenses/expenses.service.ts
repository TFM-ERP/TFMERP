import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ExpenseStatus } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({
      where: { prefix: 'EXP' },
      update: { lastNumber: { increment: 1 } },
      create: { prefix: 'EXP', lastNumber: 1, year },
    });
    return `EXP-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  async findAll(query: {
    status?: ExpenseStatus;
    activity?: string;
    category?: string;
    createdById?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const { status, activity, category, createdById, page = 1, limit = 25, startDate, endDate } = query;
    const where: any = {};
    if (status) where.status = status;
    if (activity) where.activity = activity;
    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (createdById) where.createdById = createdById;
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) where.expenseDate.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          createdBy: { select: { id: true, fullName: true } },
          approvedBy: { select: { id: true, fullName: true } },
          supplier: { select: { id: true, name: true, trn: true, vatId: true } },
        },
        orderBy: { expenseDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    return expense;
  }

  async create(data: {
    activity?: string;
    category: string;
    description: string;
    amount: number;
    currency?: string;
    vatAmount?: number;
    expenseDate?: string;
    receiptUrl?: string;
    notes?: string;
    projectRef?: string;
    productionAccountCode?: string;
    vendorName?: string;
    supplierId?: string;
    supplierVatId?: string;
    createdById: string;
  }) {
    const expenseNumber = await this.nextNumber();
    const amount = data.amount;
    const vatAmount = data.vatAmount ?? 0;
    return this.prisma.expense.create({
      data: {
        expenseNumber,
        activity: (data.activity as any) ?? 'RENTAL',
        category: data.category,
        description: data.description,
        amount,
        currency: (data.currency as any) ?? 'AED',
        vatAmount,
        totalAmount: amount + vatAmount,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
        receiptUrl: data.receiptUrl,
        notes: data.notes,
        projectRef: data.projectRef,
        productionAccountCode: data.productionAccountCode || null,
        vendorName: data.vendorName,
        supplierId: data.supplierId || null,
        supplierVatId: data.supplierVatId || null,
        createdById: data.createdById,
        status: 'PENDING_APPROVAL',
      },
    });
  }

  async update(id: string, data: Partial<{
    category: string;
    description: string;
    amount: number;
    vatAmount: number;
    expenseDate: string;
    receiptUrl: string;
    notes: string;
    vendorName: string;
    projectRef: string;
    productionAccountCode: string;
  }>) {
    const expense = await this.findOne(id);
    if (expense.status !== 'PENDING_APPROVAL') {
      throw new ForbiddenException('Only pending expenses can be edited');
    }
    const amount = data.amount ?? Number(expense.amount);
    const vatAmount = data.vatAmount ?? Number(expense.vatAmount);
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...data,
        ...(data.expenseDate && { expenseDate: new Date(data.expenseDate) }),
        amount,
        vatAmount,
        totalAmount: amount + vatAmount,
      },
    });
  }

  async approve(id: string, approverId: string) {
    await this.findOne(id);
    return this.prisma.expense.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: approverId, approvedAt: new Date() },
    });
  }

  async reject(id: string, approverId: string) {
    await this.findOne(id);
    return this.prisma.expense.update({
      where: { id },
      data: { status: 'REJECTED', approvedById: approverId, approvedAt: new Date() },
    });
  }

  async markPaid(id: string) {
    const expense = await this.findOne(id);
    if (expense.status !== 'APPROVED') throw new ForbiddenException('Only approved expenses can be marked paid');
    return this.prisma.expense.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  async getSummary(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate);
      if (endDate) where.expenseDate.lte = new Date(endDate);
    }

    const [byStatus, byCategory, byActivity, total] = await Promise.all([
      this.prisma.expense.groupBy({
        by: ['status'], where,
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.expense.groupBy({
        by: ['category'],
        where: { ...where, status: { in: ['APPROVED', 'PAID'] } },
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
      this.prisma.expense.groupBy({
        by: ['activity'],
        where: { ...where, status: { in: ['APPROVED', 'PAID'] } },
        _sum: { totalAmount: true },
      }),
      this.prisma.expense.aggregate({
        where: { ...where, status: { in: ['APPROVED', 'PAID'] } },
        _sum: { totalAmount: true },
      }),
    ]);

    return { byStatus, byCategory, byActivity, total: total._sum.totalAmount || 0 };
  }

  async getCategories(): Promise<string[]> {
    const results = await this.prisma.expense.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return results.map(r => r.category);
  }
}
