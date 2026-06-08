import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { QuotationStatus } from '@prisma/client';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { StatusService } from '../../status/status.service';
import { QueryQuotationDto } from './dto/query-quotation.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class QuotationsService {
  constructor(
    private prisma: PrismaService,
    private statusService: StatusService,
  ) {}

  // ── Document numbering ──────────────────────────────────────────────────
  private async nextNumber(prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({
      where: { prefix },
      update: { lastNumber: { increment: 1 } },
      create: { prefix, lastNumber: 1, year },
    });
    return `${prefix}-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  // ── Totals calculation ──────────────────────────────────────────────────
  private calculateTotals(items: CreateQuotationDto['items'], discountType?: string, discountValue?: number, deductionAmount?: number) {
    let subtotal = 0;
    let rawVat = 0;

    for (const item of items) {
      const days = (item as any).days || 1;
      const lineTotal = item.quantity * days * item.unitPrice * (1 - (item.discountPct || 0) / 100);
      subtotal += lineTotal;
      rawVat += item.taxAmount || 0;
    }

    let discountAmount = 0;
    if (discountType === 'PERCENT' && discountValue) {
      discountAmount = subtotal * (discountValue / 100);
    } else if (discountType === 'FIXED' && discountValue) {
      discountAmount = discountValue;
    }

    // Manual fixed deduction is applied BEFORE VAT: it reduces the taxable base,
    // so VAT is recalculated proportionally on the reduced base.
    const taxableBase = subtotal - discountAmount;
    const deduction = Math.min(Math.max(deductionAmount || 0, 0), Math.max(taxableBase, 0));
    const vatRatio = taxableBase > 0 ? (taxableBase - deduction) / taxableBase : 0;
    const vatAmount = rawVat * vatRatio;

    const total = subtotal - discountAmount - deduction + vatAmount;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      deductionAmount: Math.round(deduction * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  // ── CRUD ────────────────────────────────────────────────────────────────
  async findAll(query: QueryQuotationDto) {
    const { status, clientId, activity, search, page = 1, limit = 20 } = query;
    const where: any = {};
    if (status) where.status = status;
    if (clientId) where.clientId = clientId;
    if (activity) where.activity = activity;
    if (search) {
      where.OR = [
        { quotationNumber: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { client: { companyName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        include: {
          client: { select: { id: true, companyName: true } },
          createdBy: { select: { id: true, fullName: true } },
          bankAccount: { select: { id: true, bankName: true, accountName: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const q = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        client: { include: { contacts: true } },
        bankAccount: true,
        items: { include: { taxRate: true }, orderBy: { sortOrder: 'asc' } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        approvedBy: { select: { id: true, fullName: true } },
        deductionAppliedBy: { select: { id: true, fullName: true } },
        invoices: { select: { id: true, invoiceNumber: true, status: true, total: true } },
      },
    });
    if (!q) throw new NotFoundException(`Quotation ${id} not found`);
    return q;
  }

  async create(dto: CreateQuotationDto, userId: string) {
    const quotationNumber = await this.nextNumber('QT');
    const totals = this.calculateTotals(dto.items, dto.discountType, dto.discountValue, dto.deductionAmount);
    const hasDeduction = (totals.deductionAmount || 0) > 0;

    return this.prisma.quotation.create({
      data: {
        quotationNumber,
        clientId: dto.clientId,
        bankAccountId: dto.bankAccountId,
        activity: dto.activity,
        status: QuotationStatus.DRAFT,
        issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        currency: dto.currency || 'AED',
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        deductionReason: hasDeduction ? dto.deductionReason : null,
        deductionAppliedById: hasDeduction ? userId : null,
        deductionAppliedAt: hasDeduction ? new Date() : null,
        vatDisplay: dto.vatDisplay || 'SEPARATE',
        vatNote: dto.vatNote,
        subject: dto.subject,
        notes: dto.notes,
        termsConditions: dto.termsConditions,
        internalNotes: dto.internalNotes,
        createdById: userId,
        ...totals,
        items: {
          create: dto.items.map((item, i) => ({
            sortOrder: i,
            kind: (item as any).kind || 'ASSET',
            serviceItemId: (item as any).serviceItemId || undefined,
            description: item.description,
            details: item.details,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            discountPct: item.discountPct || 0,
            days: (item as any).days || 1,
            lineTotal: item.quantity * ((item as any).days || 1) * item.unitPrice * (1 - (item.discountPct || 0) / 100),
            taxRateId: item.taxRateId,
            taxAmount: item.taxAmount || 0,
          })),
        },
      },
      include: {
        client: { select: { id: true, companyName: true } },
        items: { include: { taxRate: true } },
        bankAccount: true,
        createdBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async update(id: string, dto: UpdateQuotationDto, userId: string) {
    const existing = await this.findOne(id);
    if (([QuotationStatus.CONVERTED, QuotationStatus.CANCELLED] as string[]).includes(existing.status)) {
      throw new BadRequestException('Cannot edit a converted or cancelled quotation');
    }

    const items = dto.items || existing.items.map(i => ({
      description: i.description,
      details: i.details,
      quantity: Number(i.quantity),
      unit: i.unit,
      unitPrice: Number(i.unitPrice),
      discountPct: Number(i.discountPct),
      taxRateId: i.taxRateId,
      taxAmount: Number(i.taxAmount),
    }));

    const deductionInput = dto.deductionAmount ?? Number(existing.deductionAmount || 0);
    const totals = this.calculateTotals(items, dto.discountType ?? existing.discountType, dto.discountValue ?? Number(existing.discountValue), deductionInput);
    const hasDeduction = (totals.deductionAmount || 0) > 0;
    const deductionChanged = dto.deductionAmount !== undefined && Number(dto.deductionAmount) !== Number(existing.deductionAmount || 0);

    // Replace items if provided
    if (dto.items) {
      await this.prisma.quotationItem.deleteMany({ where: { quotationId: id } });
    }

    return this.prisma.quotation.update({
      where: { id },
      data: {
        ...(dto.clientId && { clientId: dto.clientId }),
        ...(dto.bankAccountId !== undefined && { bankAccountId: dto.bankAccountId }),
        ...(dto.activity && { activity: dto.activity }),
        ...(dto.issueDate && { issueDate: new Date(dto.issueDate) }),
        ...(dto.validUntil && { validUntil: new Date(dto.validUntil) }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.discountType !== undefined && { discountType: dto.discountType }),
        ...(dto.discountValue !== undefined && { discountValue: dto.discountValue }),
        ...(dto.deductionReason !== undefined && { deductionReason: hasDeduction ? dto.deductionReason : null }),
        ...(deductionChanged && {
          deductionAppliedById: hasDeduction ? userId : null,
          deductionAppliedAt: hasDeduction ? new Date() : null,
        }),
        ...(dto.vatDisplay && { vatDisplay: dto.vatDisplay }),
        ...(dto.vatNote !== undefined && { vatNote: dto.vatNote }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.termsConditions !== undefined && { termsConditions: dto.termsConditions }),
        ...(dto.internalNotes !== undefined && { internalNotes: dto.internalNotes }),
        ...totals,
        ...(dto.items && {
          items: {
            create: dto.items.map((item, i) => ({
              sortOrder: i,
              kind: (item as any).kind || 'ASSET',
              serviceItemId: (item as any).serviceItemId || undefined,
              description: item.description,
              details: item.details,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              discountPct: item.discountPct || 0,
              days: (item as any).days || 1,
            lineTotal: item.quantity * ((item as any).days || 1) * item.unitPrice * (1 - (item.discountPct || 0) / 100),
              taxRateId: item.taxRateId,
              taxAmount: item.taxAmount || 0,
            })),
          },
        }),
      },
      include: {
        client: { select: { id: true, companyName: true } },
        items: { include: { taxRate: true } },
        bankAccount: true,
      },
    });
  }

  async updateStatus(id: string, status: QuotationStatus, userId: string, notes?: string) {
    const q = await this.findOne(id);
    const previousStatus = q.status as string;
    const updateData: any = { status };
    if (status === QuotationStatus.APPROVED) {
      updateData.approvedById = userId;
      updateData.approvedAt = new Date();
    }
    if (status === QuotationStatus.SENT) {
      updateData.sentAt = new Date();
    }
    const updated = await this.prisma.quotation.update({ where: { id }, data: updateData });
    await this.statusService.log({
      module: 'Quotation',
      recordId: id,
      recordRef: q.quotationNumber,
      previousStatus,
      newStatus: status,
      changedById: userId,
      notes,
    });
    return updated;
  }

  async convertToInvoice(id: string, userId: string) {
    const q = await this.findOne(id);
    if (q.status === QuotationStatus.CONVERTED) {
      throw new BadRequestException('Quotation already converted to invoice');
    }
    if (!([QuotationStatus.APPROVED, QuotationStatus.SENT] as string[]).includes(q.status)) {
      throw new BadRequestException('Quotation must be Approved or Sent before converting');
    }

    const invoiceNumber = await this.nextNumber('INV');
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (q.client.paymentTermDays || 30));

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: q.clientId,
        bankAccountId: q.bankAccountId,
        quotationId: q.id,
        activity: q.activity,
        invoiceType: 'TAX_INVOICE',
        status: 'DRAFT',
        issueDate: new Date(),
        dueDate,
        currency: q.currency,
        subtotal: q.subtotal,
        discountAmount: q.discountAmount,
        deductionAmount: q.deductionAmount,
        deductionReason: q.deductionReason,
        deductionAppliedById: q.deductionAppliedById,
        deductionAppliedAt: q.deductionAppliedAt,
        vatAmount: q.vatAmount,
        total: q.total,
        amountPaid: 0,
        amountDue: q.total,
        vatDisplay: q.vatDisplay,
        subject: q.subject,
        notes: q.notes,
        termsConditions: q.termsConditions,
        createdById: userId,
        items: {
          create: q.items.map((item, i) => ({
            sortOrder: i,
            kind: (item as any).kind || 'ASSET',
            serviceItemId: (item as any).serviceItemId || undefined,
            description: item.description,
            details: item.details,
            quantity: item.quantity,
            unit: item.unit,
            days: (item as any).days || 1,
            unitPrice: item.unitPrice,
            discountPct: item.discountPct,
            lineTotal: item.lineTotal,
            taxRateId: item.taxRateId,
            taxAmount: item.taxAmount,
          })),
        },
      },
    });

    await this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.CONVERTED },
    });

    return invoice;
  }

  async remove(id: string) {
    const q = await this.findOne(id);
    if (q.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException('Only draft quotations can be deleted');
    }
    return this.prisma.quotation.delete({ where: { id } });
  }
}
