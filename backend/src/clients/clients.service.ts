import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { search?: string; status?: string; isActive?: boolean }) {
    const { search, status, isActive } = query;
    const where: any = {};
    if (status) where.status = status;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { tradeName: { contains: search, mode: 'insensitive' } },
        { trn: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.findMany({
      where,
      include: {
        contacts: { where: { isPrimary: true }, take: 1 },
        _count: { select: { quotations: true, invoices: true } },
      },
      orderBy: { companyName: 'asc' },
    });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { isPrimary: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
        _count: { select: { quotations: true, invoices: true, payments: true, rentalBookings: true } },
      },
    });
    if (!client) throw new NotFoundException(`Client ${id} not found`);
    return client;
  }

  // ── Contacts ────────────────────────────────────────────────────────────
  async addContact(clientId: string, data: any) {
    await this.findOne(clientId);
    const { id, clientId: _c, ...clean } = data || {};
    if (clean.isPrimary) {
      await this.prisma.clientContact.updateMany({ where: { clientId }, data: { isPrimary: false } });
    }
    return this.prisma.clientContact.create({ data: { ...clean, clientId } });
  }

  async updateContact(contactId: string, data: any) {
    const { id, clientId, ...clean } = data || {};
    if (clean.isPrimary && clientId) {
      await this.prisma.clientContact.updateMany({ where: { clientId }, data: { isPrimary: false } });
    }
    return this.prisma.clientContact.update({ where: { id: contactId }, data: clean });
  }

  async removeContact(contactId: string) {
    return this.prisma.clientContact.delete({ where: { id: contactId } });
  }

  // ── Documents ───────────────────────────────────────────────────────────
  async addDocument(clientId: string, data: any) {
    await this.findOne(clientId);
    const { id, clientId: _c, expiryDate, ...rest } = data || {};
    return this.prisma.clientDocument.create({
      data: { ...rest, clientId, expiryDate: expiryDate ? new Date(expiryDate) : undefined },
    });
  }

  async removeDocument(docId: string) {
    return this.prisma.clientDocument.delete({ where: { id: docId } });
  }

  async create(data: any) {
    const { contacts, documents, tradeLicenseExpiry, id, createdAt, updatedAt, _count, ...clientData } = data || {};
    if (tradeLicenseExpiry) clientData.tradeLicenseExpiry = new Date(tradeLicenseExpiry);
    if (clientData.paymentTermDays !== undefined && clientData.paymentTermDays !== '') {
      clientData.paymentTermDays = Number(clientData.paymentTermDays);
    } else {
      delete clientData.paymentTermDays;
    }
    if (clientData.creditLimit !== undefined && clientData.creditLimit !== '') {
      clientData.creditLimit = Number(clientData.creditLimit);
    } else {
      delete clientData.creditLimit;
    }
    return this.prisma.client.create({
      data: {
        ...clientData,
        contacts: contacts?.length ? { create: contacts } : undefined,
      },
      include: { contacts: true },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { contacts, documents, tradeLicenseExpiry, id: _i, createdAt, updatedAt, _count, ...clientData } = data || {};
    if (tradeLicenseExpiry !== undefined) clientData.tradeLicenseExpiry = tradeLicenseExpiry ? new Date(tradeLicenseExpiry) : null;
    if (clientData.paymentTermDays !== undefined && clientData.paymentTermDays !== '') {
      clientData.paymentTermDays = Number(clientData.paymentTermDays);
    } else {
      delete clientData.paymentTermDays;
    }
    if (clientData.creditLimit === '') delete clientData.creditLimit;
    return this.prisma.client.update({
      where: { id },
      data: clientData,
      include: { contacts: true },
    });
  }

  /** Block / activate a client. status = ACTIVE | INACTIVE | BLOCKED */
  async updateStatus(id: string, status: string, blockReason?: string) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: {
        status,
        isActive: status === 'ACTIVE',
        blockReason: status === 'BLOCKED' ? (blockReason || 'Blocked') : null,
      },
      include: { contacts: true },
    });
  }

  /** Financial summary: total sales, pending invoices/quotations, payments. */
  async financialSummary(id: string) {
    await this.findOne(id);

    const [invAgg, paidAgg, pendingInvoices, pendingQuotations, recentPayments, quotationsAgg] =
      await Promise.all([
        this.prisma.invoice.aggregate({
          where: { clientId: id, status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT'] } },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.payment.aggregate({
          where: { clientId: id, status: 'CLEARED' },
          _sum: { amount: true },
        }),
        this.prisma.invoice.findMany({
          where: { clientId: id, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
          select: { id: true, invoiceNumber: true, total: true, amountDue: true, dueDate: true, status: true },
          orderBy: { issueDate: 'desc' },
          take: 50,
        }),
        this.prisma.quotation.findMany({
          where: { clientId: id, status: { in: ['DRAFT', 'PENDING_REVIEW', 'SENT', 'VIEWED', 'REVISION_REQUESTED', 'APPROVED'] } },
          select: { id: true, quotationNumber: true, total: true, status: true, validUntil: true },
          orderBy: { issueDate: 'desc' },
          take: 50,
        }),
        this.prisma.payment.findMany({
          where: { clientId: id },
          select: { id: true, paymentNumber: true, amount: true, status: true, paymentDate: true, method: true },
          orderBy: { paymentDate: 'desc' },
          take: 20,
        }),
        this.prisma.quotation.aggregate({
          where: { clientId: id, status: { notIn: ['CANCELLED', 'REJECTED', 'EXPIRED'] } },
          _sum: { total: true },
          _count: true,
        }),
      ]);

    const totalSales = Number(invAgg._sum.total || 0);
    const totalPaid = Number(paidAgg._sum.amount || 0);
    const outstanding = pendingInvoices.reduce((s, i) => s + Number(i.amountDue || 0), 0);

    return {
      totalSales,
      totalPaid,
      outstanding,
      invoiceCount: invAgg._count,
      quotationCount: quotationsAgg._count,
      quotationsValue: Number(quotationsAgg._sum.total || 0),
      pendingInvoices,
      pendingQuotations,
      recentPayments,
    };
  }

  async getOutstandingBalance(id: string) {
    await this.findOne(id);
    const result = await this.prisma.invoice.aggregate({
      where: { clientId: id, status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
      _sum: { amountDue: true },
    });
    return { clientId: id, outstandingBalance: result._sum.amountDue || 0 };
  }
}
