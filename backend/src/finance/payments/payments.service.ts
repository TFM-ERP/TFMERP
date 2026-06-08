import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { clientId?: string; status?: PaymentStatus; page?: number; limit?: number }) {
    const { clientId, status, page = 1, limit = 20 } = query;
    const where: any = {};
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
          client: { select: { id: true, companyName: true } },
          bankAccount: { select: { id: true, bankName: true, accountName: true } },
        },
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: true,
        client: true,
        bankAccount: true,
      },
    });
    if (!payment) throw new NotFoundException(`Payment ${id} not found`);
    return payment;
  }

  async updateStatus(id: string, status: PaymentStatus) {
    await this.findOne(id);
    const data: any = { status };
    if (status === PaymentStatus.CLEARED) data.clearedAt = new Date();
    return this.prisma.payment.update({ where: { id }, data });
  }

  async getSummary(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    const [totalCleared, totalPending, totalBounced] = await Promise.all([
      this.prisma.payment.aggregate({ where: { ...where, status: 'CLEARED' }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { ...where, status: 'PENDING' }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { ...where, status: 'BOUNCED' }, _sum: { amount: true } }),
    ]);

    return {
      cleared: totalCleared._sum.amount || 0,
      pending: totalPending._sum.amount || 0,
      bounced: totalBounced._sum.amount || 0,
    };
  }
}
