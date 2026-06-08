import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  private async nextNumber(prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({
      where: { prefix },
      update: { lastNumber: { increment: 1 } },
      create: { prefix, lastNumber: 1, year },
    });
    return `${prefix}-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  // ── Quotations ────────────────────────────────────────────────────────────

  async listQuotations(query: { vendorId?: string; jobId?: string; status?: string }) {
    const where: any = {};
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.jobId) where.jobId = query.jobId;
    if (query.status) where.status = query.status;
    return this.prisma.vendorQuotation.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      include: {
        vendor: { select: { id: true, name: true } },
        job: { select: { id: true, jobNumber: true } },
      },
    });
  }

  async createQuotation(dto: any) {
    const quotationNumber = await this.nextNumber('VQ');
    const subtotal = Number(dto.subtotal || 0);
    const vatAmount = Math.round(subtotal * 0.05 * 100) / 100;
    const total = subtotal + vatAmount;
    return this.prisma.vendorQuotation.create({
      data: { ...dto, quotationNumber, vatAmount, total },
    });
  }

  async approveQuotation(id: string) {
    return this.prisma.vendorQuotation.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
  }

  async updateQuotation(id: string, dto: any) {
    return this.prisma.vendorQuotation.update({ where: { id }, data: dto });
  }

  // ── Invoices ──────────────────────────────────────────────────────────────

  async listInvoices(query: { vendorId?: string; jobId?: string; status?: string; page?: number; limit?: number }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 25;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.jobId) where.jobId = query.jobId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.vendorInvoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issuedAt: 'desc' },
        include: {
          vendor: { select: { id: true, name: true } },
          job: { select: { id: true, jobNumber: true } },
          payments: true,
        },
      }),
      this.prisma.vendorInvoice.count({ where }),
    ]);
    return { items, total, pages: Math.ceil(total / limit) };
  }

  async getInvoice(id: string) {
    const inv = await this.prisma.vendorInvoice.findUnique({
      where: { id },
      include: {
        vendor: true,
        job: true,
        quotation: true,
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  async createInvoice(dto: any) {
    const invoiceNumber = await this.nextNumber('VIN');
    const subtotal = Number(dto.subtotal || 0);
    const vatAmount = dto.vatAmount !== undefined ? Number(dto.vatAmount) : Math.round(subtotal * 0.05 * 100) / 100;
    const total = subtotal + vatAmount;
    return this.prisma.vendorInvoice.create({
      data: {
        ...dto,
        invoiceNumber,
        subtotal,
        vatAmount,
        total,
        amountDue: total,
        laborCost: dto.laborCost ? Number(dto.laborCost) : 0,
        partsCost: dto.partsCost ? Number(dto.partsCost) : 0,
      },
    });
  }

  async updateInvoice(id: string, dto: any) {
    return this.prisma.vendorInvoice.update({ where: { id }, data: dto });
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  async listPayments(query: { vendorId?: string; invoiceId?: string }) {
    const where: any = {};
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.invoiceId) where.invoiceId = query.invoiceId;
    return this.prisma.vendorPayment.findMany({
      where,
      orderBy: { paymentDate: 'desc' },
      include: {
        vendor: { select: { id: true, name: true } },
        invoice: { select: { id: true, invoiceNumber: true, total: true } },
      },
    });
  }

  async createPayment(dto: any) {
    const paymentNumber = await this.nextNumber('VP');
    const amount = Number(dto.amount);
    const payment = await this.prisma.vendorPayment.create({
      data: { ...dto, paymentNumber, amount },
    });

    // Update invoice amountPaid and amountDue
    if (dto.invoiceId) {
      const inv = await this.prisma.vendorInvoice.findUnique({ where: { id: dto.invoiceId } });
      if (inv) {
        const newPaid = Number(inv.amountPaid) + amount;
        const newDue = Math.max(0, Number(inv.total) - newPaid);
        const newStatus = newDue <= 0 ? 'PAID' : 'APPROVED';
        await this.prisma.vendorInvoice.update({
          where: { id: dto.invoiceId },
          data: { amountPaid: newPaid, amountDue: newDue, status: newStatus },
        });
      }
    }
    return payment;
  }

  async clearPayment(id: string) {
    return this.prisma.vendorPayment.update({
      where: { id },
      data: { status: 'CLEARED', clearedAt: new Date() },
    });
  }

  // Outstanding vendor balances report
  async getOutstandingBalances() {
    const raw = await this.prisma.vendorInvoice.groupBy({
      by: ['vendorId'],
      where: { status: { notIn: ['CANCELLED', 'PAID'] } },
      _sum: { amountDue: true, total: true },
      orderBy: { _sum: { amountDue: 'desc' } },
    });
    const vendorIds = raw.map((r) => r.vendorId);
    const vendors = await this.prisma.maintenanceVendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, name: true, vendorType: true, mobile: true },
    });
    const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v]));
    return raw.map((r) => ({
      vendor: vendorMap[r.vendorId],
      outstandingBalance: Number(r._sum.amountDue || 0),
      totalInvoiced: Number(r._sum.total || 0),
    }));
  }
}
