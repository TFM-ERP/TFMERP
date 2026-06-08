import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InvoiceStatus } from '@prisma/client';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { StatusService } from '../../status/status.service';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private statusService: StatusService,
  ) {}

  private async nextNumber(prefix: string) {
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({
      where: { prefix },
      update: { lastNumber: { increment: 1 } },
      create: { prefix, lastNumber: 1, year },
    });
    return `${prefix}-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  // ── Totals calculation ──────────────────────────────────────────────────
  // Manual fixed deduction is applied BEFORE VAT: it reduces the taxable base,
  // so VAT is recalculated proportionally on the reduced base.
  private computeTotals(items: any[], discountAmount = 0, deductionAmount = 0) {
    let subtotal = 0, rawVat = 0;
    for (const item of items) {
      const days = item.days || 1;
      subtotal += item.quantity * days * item.unitPrice * (1 - (item.discountPct || 0) / 100);
      rawVat += item.taxAmount || 0;
    }
    const disc = discountAmount || 0;
    const taxableBase = subtotal - disc;
    const deduction = Math.min(Math.max(deductionAmount || 0, 0), Math.max(taxableBase, 0));
    const vatRatio = taxableBase > 0 ? (taxableBase - deduction) / taxableBase : 0;
    const vatAmount = rawVat * vatRatio;
    const total = subtotal - disc - deduction + vatAmount;
    const r = (n: number) => Math.round(n * 100) / 100;
    return { subtotal: r(subtotal), discountAmount: r(disc), deductionAmount: r(deduction), vatAmount: r(vatAmount), total: r(total) };
  }

  async findAll(query: QueryInvoiceDto) {
    const { status, clientId, activity, invoiceType, search, page = 1, limit = 20, overdueOnly } = query;
    const where: any = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (activity) where.activity = activity;
    if (invoiceType) where.invoiceType = invoiceType;
    if (overdueOnly) {
      where.dueDate = { lt: new Date() };
      where.status = { in: ['SENT', 'PARTIALLY_PAID'] };
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { poNumber: { contains: search, mode: 'insensitive' } },
        { client: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          client: { select: { id: true, companyName: true } },
          createdBy: { select: { id: true, fullName: true } },
          bankAccount: { select: { id: true, bankName: true } },
          _count: { select: { payments: true } },
        },
        orderBy: { issueDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { include: { contacts: true } },
        bankAccount: true,
        quotation: { select: { id: true, quotationNumber: true } },
        items: { include: { taxRate: true }, orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        deductionAppliedBy: { select: { id: true, fullName: true } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });
    if (!inv) throw new NotFoundException(`Invoice ${id} not found`);
    return inv;
  }

  async create(dto: CreateInvoiceDto, userId: string) {
    const invoiceNumber = await this.nextNumber(
      dto.invoiceType === 'PROFORMA' ? 'PI' : 'INV',
    );
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })();

    // Calculate totals from items (deduction applied before VAT)
    const totals = this.computeTotals(dto.items, dto.discountAmount, dto.deductionAmount);
    const hasDeduction = (totals.deductionAmount || 0) > 0;

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: dto.clientId,
        bankAccountId: dto.bankAccountId,
        quotationId: dto.quotationId,
        activity: dto.activity || 'RENTAL',
        invoiceType: dto.invoiceType || 'TAX_INVOICE',
        status: 'DRAFT',
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        dueDate,
        currency: dto.currency || 'AED',
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        deductionAmount: totals.deductionAmount,
        deductionReason: hasDeduction ? dto.deductionReason : null,
        deductionAppliedById: hasDeduction ? userId : null,
        deductionAppliedAt: hasDeduction ? new Date() : null,
        vatAmount: totals.vatAmount,
        total: totals.total,
        amountPaid: 0,
        amountDue: totals.total,
        vatDisplay: dto.vatDisplay || 'SEPARATE',
        subject: dto.subject,
        notes: dto.notes,
        termsConditions: dto.termsConditions,
        internalNotes: dto.internalNotes,
        poNumber: dto.poNumber,
        createdById: userId,
        items: {
          create: dto.items.map((item, i) => ({
            sortOrder: i,
            kind: (item as any).kind || 'ASSET',
            serviceItemId: (item as any).serviceItemId || undefined,
            description: item.description,
            details: item.details,
            quantity: item.quantity,
            unit: item.unit,
            days: item.days || 1,
            unitPrice: item.unitPrice,
            discountPct: item.discountPct || 0,
            lineTotal: item.quantity * (item.days || 1) * item.unitPrice * (1 - (item.discountPct || 0) / 100),
            taxRateId: item.taxRateId,
            taxAmount: item.taxAmount || 0,
          })),
        },
      },
      include: {
        client: { select: { id: true, companyName: true } },
        items: { include: { taxRate: true } },
      },
    });
  }

  async update(id: string, dto: UpdateInvoiceDto, userId: string) {
    const existing = await this.findOne(id);
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be edited');
    }

    const items = dto.items ?? existing.items.map((i: any) => ({
      kind: i.kind,
      serviceItemId: i.serviceItemId,
      description: i.description,
      details: i.details,
      quantity: Number(i.quantity),
      unit: i.unit,
      days: i.days,
      unitPrice: Number(i.unitPrice),
      discountPct: Number(i.discountPct),
      taxRateId: i.taxRateId,
      taxAmount: Number(i.taxAmount),
    }));

    const discountInput = dto.discountAmount ?? Number(existing.discountAmount || 0);
    const deductionInput = dto.deductionAmount ?? Number(existing.deductionAmount || 0);
    const totals = this.computeTotals(items, discountInput, deductionInput);
    const hasDeduction = (totals.deductionAmount || 0) > 0;
    const deductionChanged = dto.deductionAmount !== undefined && Number(dto.deductionAmount) !== Number(existing.deductionAmount || 0);

    if (dto.items) {
      await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...(dto.clientId && { clientId: dto.clientId }),
        ...(dto.bankAccountId !== undefined && { bankAccountId: dto.bankAccountId || null }),
        ...(dto.activity && { activity: dto.activity }),
        ...(dto.invoiceType && { invoiceType: dto.invoiceType }),
        ...(dto.issueDate && { issueDate: new Date(dto.issueDate) }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.vatDisplay && { vatDisplay: dto.vatDisplay }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.termsConditions !== undefined && { termsConditions: dto.termsConditions }),
        ...(dto.internalNotes !== undefined && { internalNotes: dto.internalNotes }),
        ...(dto.poNumber !== undefined && { poNumber: dto.poNumber }),
        ...(dto.deductionReason !== undefined && { deductionReason: hasDeduction ? dto.deductionReason : null }),
        ...(deductionChanged && {
          deductionAppliedById: hasDeduction ? userId : null,
          deductionAppliedAt: hasDeduction ? new Date() : null,
        }),
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        deductionAmount: totals.deductionAmount,
        vatAmount: totals.vatAmount,
        total: totals.total,
        amountDue: totals.total,
        ...(dto.items && {
          items: {
            create: dto.items.map((item: any, i: number) => ({
              sortOrder: i,
              kind: item.kind || 'ASSET',
              serviceItemId: item.serviceItemId || undefined,
              description: item.description,
              details: item.details,
              quantity: item.quantity,
              unit: item.unit,
              days: item.days || 1,
              unitPrice: item.unitPrice,
              discountPct: item.discountPct || 0,
              lineTotal: item.quantity * (item.days || 1) * item.unitPrice * (1 - (item.discountPct || 0) / 100),
              taxRateId: item.taxRateId,
              taxAmount: item.taxAmount || 0,
            })),
          },
        }),
      },
      include: {
        client: { select: { id: true, companyName: true } },
        items: { include: { taxRate: true } },
      },
    });
  }

  async updateStatus(id: string, status: InvoiceStatus, userId?: string, notes?: string) {
    const invoice = await this.findOne(id);
    const previousStatus = invoice.status as string;
    const updateData: any = { status };
    if (status === InvoiceStatus.SENT) updateData.sentAt = new Date();
    const updated = await this.prisma.invoice.update({ where: { id }, data: updateData });
    // Log status change
    if (userId) {
      await this.statusService.log({
        module: 'Invoice',
        recordId: id,
        recordRef: invoice.invoiceNumber,
        previousStatus,
        newStatus: status,
        changedById: userId,
        notes,
      });
    }
    return updated;
  }

  async recordPayment(invoiceId: string, amount: number, paymentData: any, userId: string) {
    const invoice = await this.findOne(invoiceId);
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Invoice is already paid or cancelled');
    }
    if (amount > Number(invoice.amountDue)) {
      throw new BadRequestException(`Payment amount (${amount}) exceeds amount due (${invoice.amountDue})`);
    }

    const paymentNumber = await this.nextNumber('RCP');
    const newAmountPaid = Number(invoice.amountPaid) + amount;
    const newAmountDue = Number(invoice.total) - newAmountPaid;
    const newStatus = newAmountDue <= 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          paymentNumber,
          invoiceId,
          clientId: invoice.clientId,
          bankAccountId: paymentData.bankAccountId,
          amount,
          currency: invoice.currency,
          paymentDate: paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date(),
          method: paymentData.method || 'BANK_TRANSFER',
          status: 'PENDING',
          reference: paymentData.reference,
          notes: paymentData.notes,
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: newAmountPaid,
          amountDue: Math.max(0, newAmountDue),
          status: newStatus,
        },
      }),
    ]);

    return payment;
  }

  async getAgingReport() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
      include: { client: { select: { companyName: true } } },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();
    const buckets = { current: [], days30: [], days60: [], days90: [], over90: [] };

    for (const inv of invoices) {
      const daysOverdue = inv.dueDate
        ? Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000)
        : 0;
      const entry = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        client: inv.client.companyName,
        total: inv.total,
        amountDue: inv.amountDue,
        dueDate: inv.dueDate,
        daysOverdue,
      };
      if (daysOverdue <= 0) buckets.current.push(entry);
      else if (daysOverdue <= 30) buckets.days30.push(entry);
      else if (daysOverdue <= 60) buckets.days60.push(entry);
      else if (daysOverdue <= 90) buckets.days90.push(entry);
      else buckets.over90.push(entry);
    }

    return buckets;
  }
}
