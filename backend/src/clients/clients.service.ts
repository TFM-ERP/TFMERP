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
          where: { direction: 'RECEIPT', clientId: id, status: 'CLEARED' },
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
          where: { direction: 'RECEIPT', clientId: id },
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

  /**
   * Every transaction on one client's account, oldest first, with a running
   * balance — the account statement a client would recognise.
   *
   * An invoice is a debit (what they owe), a receipt a credit (what they have
   * paid), a credit note a negative debit. The running balance is what is owed
   * after each line, so the last line is the current position.
   *
   * Cancelled and voided invoices are left out: they were never owed. Drafts
   * are left out too — an unissued invoice is not a transaction. Bounced
   * receipts are included but contribute nothing, because the money came back.
   */
  async transactions(id: string) {
    await this.findOne(id);

    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { clientId: id, status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT'] } },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceType: true,
          issueDate: true,
          dueDate: true,
          subject: true,
          currency: true,
          total: true,
          amountPaid: true,
          amountDue: true,
          status: true,
        },
        orderBy: { issueDate: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { direction: 'RECEIPT', clientId: id },
        select: {
          id: true,
          paymentNumber: true,
          paymentDate: true,
          method: true,
          reference: true,
          currency: true,
          amount: true,
          status: true,
          invoice: { select: { id: true, invoiceNumber: true } },
        },
        orderBy: { paymentDate: 'asc' },
      }),
    ]);

    type Row = {
      kind: 'INVOICE' | 'CREDIT_NOTE' | 'RECEIPT';
      id: string;
      date: Date;
      ref: string;
      description: string;
      status: string;
      currency: string;
      debit: number;
      credit: number;
      balance: number;
      /** For a receipt, the invoice it settles; for an invoice, what is still due. */
      link?: { id: string; invoiceNumber: string } | null;
      amountDue?: number;
    };

    const rows: Row[] = [];

    for (const inv of invoices) {
      const isCredit = inv.invoiceType === 'CREDIT_NOTE';
      const amount = Number(inv.total ?? 0);
      rows.push({
        kind: isCredit ? 'CREDIT_NOTE' : 'INVOICE',
        id: inv.id,
        date: inv.issueDate,
        ref: inv.invoiceNumber,
        description: inv.subject || (isCredit ? 'Credit note' : 'Tax invoice'),
        status: inv.status,
        currency: inv.currency ?? 'AED',
        debit: isCredit ? 0 : amount,
        credit: isCredit ? amount : 0,
        balance: 0,
        amountDue: Number(inv.amountDue ?? 0),
        link: null,
      });
    }

    for (const p of payments) {
      // A bounced receipt stays on the statement — it is part of the story —
      // but the money came back, so it moves nothing.
      const effective = p.status === 'BOUNCED' ? 0 : Number(p.amount ?? 0);
      rows.push({
        kind: 'RECEIPT',
        id: p.id,
        date: p.paymentDate,
        ref: p.paymentNumber,
        description: [p.method?.replace(/_/g, ' ').toLowerCase(), p.reference]
          .filter(Boolean)
          .join(' · '),
        status: p.status,
        currency: p.currency ?? 'AED',
        debit: 0,
        credit: effective,
        balance: 0,
        link: p.invoice ?? null,
      });
    }

    rows.sort((a, b) => {
      const d = a.date.getTime() - b.date.getTime();
      if (d !== 0) return d;
      // Same day: the invoice comes before the receipt that settles it.
      if (a.kind === 'RECEIPT' && b.kind !== 'RECEIPT') return 1;
      if (b.kind === 'RECEIPT' && a.kind !== 'RECEIPT') return -1;
      return a.ref.localeCompare(b.ref);
    });

    let balance = 0;
    for (const r of rows) {
      balance = Math.round((balance + r.debit - r.credit) * 100) / 100;
      r.balance = balance;
    }

    const invoiced = rows.reduce((s, r) => s + r.debit, 0);
    const received = rows
      .filter((r) => r.kind === 'RECEIPT')
      .reduce((s, r) => s + r.credit, 0);
    const credited = rows
      .filter((r) => r.kind === 'CREDIT_NOTE')
      .reduce((s, r) => s + r.credit, 0);

    return {
      rows,
      totals: {
        invoiced: Math.round(invoiced * 100) / 100,
        received: Math.round(received * 100) / 100,
        credited: Math.round(credited * 100) / 100,
        balance,
      },
      counts: {
        invoices: rows.filter((r) => r.kind === 'INVOICE').length,
        creditNotes: rows.filter((r) => r.kind === 'CREDIT_NOTE').length,
        receipts: rows.filter((r) => r.kind === 'RECEIPT').length,
      },
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
