import {
  Injectable, NotFoundException, BadRequestException,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { StatusService } from '../../status/status.service';
import { sumLineItems, computeDocumentTotals } from '../totals.util';
import * as bcrypt from 'bcryptjs';
import { canDelete, canVoid, canArchive, buildReversalLines, LifecycleState } from './invoice-lifecycle.rules';
import { VoidInvoiceDto, DeleteInvoiceDto } from './dto/lifecycle.dto';

// A real bcrypt hash compared against when no user is found, so a missing user takes
// the same time as a wrong password (defeats user-enumeration via timing).
const DUMMY_HASH = bcrypt.hashSync('no-such-user-constant-time-guard', 12);

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private statusService: StatusService,
  ) {}

  /**
   * Failed confirmation attempts, per user. In memory on purpose: a restart
   * clears it, which is fine for a single-tenant system and adds no dependency.
   */
  private readonly failures = new Map<string, { count: number; until: number }>();
  private static readonly MAX_FAILURES = 5;
  private static readonly LOCK_MS = 15 * 60 * 1000;

  /**
   * Confirms the caller is who they say they are, using the password they log
   * in with. There is no separate admin password: a shared secret makes the
   * audit log say "someone who knew it", and this makes it say who.
   */
  private async assertPassword(
    userId: string,
    password: string,
    action: string,
    invoiceId: string,
    ip?: string,
  ): Promise<void> {
    const now = Date.now();
    const record = this.failures.get(userId);
    if (record && record.count >= InvoicesService.MAX_FAILURES && now < record.until) {
      const minutes = Math.ceil((record.until - now) / 60000);
      throw new ForbiddenException(
        `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    // Always run exactly one bcrypt comparison, against a dummy hash when no user is
    // found, so a missing user takes the same time as a wrong password (defeats
    // timing-based enumeration of which userId exists).
    const hash = user ? user.passwordHash : DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);

    if (!ok) {
      const count = (record && now < record.until ? record.count : 0) + 1;
      this.failures.set(userId, { count, until: now + InvoicesService.LOCK_MS });
      await this.writeAudit(userId, `${action}_DENIED`, invoiceId, null, ip);
      throw new UnauthorizedException('That password is not correct.');
    }

    this.failures.delete(userId);
  }

  /**
   * Every lifecycle action lands in the audit log, successful or not.
   *
   * Takes an optional Prisma transaction client, defaulting to the plain
   * `this.prisma`. When called with a `tx` from inside a `$transaction`
   * callback (voidInvoice, remove), the audit row is written through that
   * same client, so it commits or rolls back with the mutation it describes
   * instead of being a separate, possibly-lost write after the fact. This
   * method does not catch its own errors — a failed `auditLog.create` throws
   * out to the caller, and inside a transaction that means the whole
   * transaction rolls back, exactly as it must for the audit row to be a
   * reliable guarantee rather than a best-effort side effect.
   */
  private async writeAudit(
    userId: string,
    action: string,
    invoiceId: string,
    oldValue: unknown,
    ip?: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        userId,
        action,
        resource: 'Invoice',
        resourceId: invoiceId,
        oldValue: oldValue === null ? undefined : (oldValue as any),
        ipAddress: ip || null,
      },
    });
  }

  /** Loads exactly what the rules module needs to reach a verdict. */
  private async lifecycleState(id: string): Promise<{ state: LifecycleState; invoice: any }> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { items: true, client: { select: { companyName: true } } },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} was not found`);

    const [journals, clearedReceipts] = await Promise.all([
      this.prisma.journalEntry.count({
        where: { sourceType: 'INVOICE', sourceId: id, status: 'POSTED' },
      }),
      this.prisma.payment.count({
        where: { invoiceId: id, direction: 'RECEIPT', status: 'CLEARED' },
      }),
    ]);

    return {
      invoice,
      state: {
        status: invoice.status,
        hasJournal: journals > 0,
        clearedReceipts,
        archivedAt: invoice.archivedAt,
      },
    };
  }

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
  // Manual fixed deduction is applied BEFORE VAT (see totals.util.ts).
  private computeTotals(items: any[], discountAmount = 0, deductionAmount = 0) {
    const { subtotal, rawVat } = sumLineItems(items);
    return computeDocumentTotals({ subtotal, rawVat, discountAmount, deductionAmount });
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

  // ── Lifecycle: archive, unarchive, void, delete ─────────────────────────
  //
  // archive/unarchive are single-field mutations, audited right after they
  // commit — there is one statement to lose, and losing the audit row for it
  // is a minor gap, not a hole in the books.
  //
  // voidInvoice and remove are different. For remove, the audit payload is
  // the ONLY surviving copy of the invoice, its line items and its
  // attachment list once the rows are gone — an audit insert that fails
  // after the delete has already committed would erase the invoice with no
  // record at all, which the five-year FTA retention rule cannot tolerate.
  // For voidInvoice, the audit row is what names the reversing journal entry
  // the void created. So for both, `writeAudit` is called with `tx` and runs
  // INSIDE the same `$transaction` as the mutation: either the audit row and
  // the mutation both land, or neither does. `writeAudit` does not catch its
  // own errors, so a failed audit insert — a dropped connection, pool
  // exhaustion, oversized JSON — throws inside the callback and rolls the
  // whole transaction back, same as any other failed statement in it.

  /** Hides an invoice from the default list. Changes nothing else. */
  async archive(id: string, userId: string, ip?: string) {
    const { state, invoice } = await this.lifecycleState(id);
    const verdict = canArchive(state);
    if (verdict.allowed === false) throw new BadRequestException(verdict.reason);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    await this.writeAudit(userId, 'ARCHIVE', id, { invoiceNumber: invoice.invoiceNumber }, ip);
    return updated;
  }

  /** Un-hides an invoice. The inverse of archive; nothing else changes. */
  async unarchive(id: string, userId: string, ip?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: { invoiceNumber: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} was not found`);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { archivedAt: null },
    });
    await this.writeAudit(userId, 'UNARCHIVE', id, { invoiceNumber: invoice.invoiceNumber }, ip);
    return updated;
  }

  /**
   * Cancels an invoice that really happened. The number and the document stay;
   * a reversing journal takes the money back out, so the trial balance still
   * nets to zero and an auditor can see both halves.
   *
   * The status change and the reversing journal are written in one
   * `$transaction`: either both land or neither does. An invoice marked
   * VOIDED with its debit still sitting in Accounts Receivable, or a
   * reversal posted against an invoice still open, is exactly the kind of
   * half-done write that corrupts the books.
   */
  async voidInvoice(id: string, dto: VoidInvoiceDto, userId: string, ip?: string) {
    await this.assertPassword(userId, dto.password, 'VOID', id, ip);

    const { state, invoice } = await this.lifecycleState(id);
    const verdict = canVoid(state);
    if (verdict.allowed === false) throw new BadRequestException(verdict.reason);

    // The only journal-writing convention in this codebase is
    // AccountingService.je()/postAll(): SYSTEM source, POSTED status, an
    // entryNumber from the `document_sequences` row, and a debit/credit pair
    // per GL line that must balance before it is written. The reversal
    // mirrors that shape exactly rather than inventing a second style.
    const original = await this.prisma.journalEntry.findFirst({
      where: { sourceType: 'INVOICE', sourceId: id, status: 'POSTED' },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });

    const voided = await this.prisma.$transaction(async (tx) => {
      // This catches an already-committed prior reversal (e.g. the invoice
      // was left in a state where canVoid wrongly allowed a second pass) —
      // it does NOT catch a concurrent one. Under READ COMMITTED this
      // `findFirst` cannot see another transaction's uncommitted insert, and
      // `JournalEntry` has only `@@index([sourceType, sourceId])`, not a
      // unique constraint, so two interleaved voids could both pass this
      // check. The conditional `updateMany` on the invoice's status below is
      // what actually prevents a double reversal in that case. A partial
      // unique index on `(sourceType, sourceId) WHERE sourceType =
      // 'INVOICE_VOID'` would close this at the database level too.
      const existingReversal = await tx.journalEntry.findFirst({
        where: { sourceType: 'INVOICE_VOID', sourceId: id },
        select: { id: true },
      });
      if (existingReversal) {
        throw new BadRequestException('This invoice is already voided.');
      }

      let reversalEntryNumber: string | null = null;

      if (original) {
        // A POSTED journal entry with no lines is not something
        // AccountingService.je() would ever create, and reversing one here
        // would post exactly that: a hollow, unbalanced entry. Refuse
        // instead of writing it.
        if (!original.lines || original.lines.length === 0) {
          throw new BadRequestException(
            `Cannot void invoice ${invoice.invoiceNumber}: its posted journal entry ` +
              `${original.entryNumber} has no lines to reverse, so it has to be corrected ` +
              `or reversed in the journal before this invoice can be voided.`,
          );
        }

        // Same atomic-increment sequence AccountingService.nextEntryNumber()
        // and this service's own nextNumber() use (documentSequence.upsert
        // with { increment: 1 }) — run through `tx` so a failure below rolls
        // the counter back too, instead of the brief's find-the-max-and-add-1
        // read, which two concurrent voids could race on.
        const year = new Date().getFullYear();
        const seq = await tx.documentSequence.upsert({
          where: { prefix: 'JE' },
          update: { lastNumber: { increment: 1 } },
          create: { prefix: 'JE', lastNumber: 1, year },
        });
        reversalEntryNumber = `JE-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
      }

      // `invoice.internalNotes` was read by `lifecycleState` outside and
      // before this transaction — a note added by anyone in between would be
      // silently overwritten by concatenating onto that stale value. Re-read
      // it fresh through `tx`, immediately before building the stamp, and
      // concatenate onto that instead.
      const current = await tx.invoice.findUnique({
        where: { id },
        select: { internalNotes: true },
      });

      const stamp =
        `[VOIDED ${new Date().toISOString().slice(0, 10)}] ${dto.reason}` +
        (original
          ? ` Reversed by journal ${reversalEntryNumber} against ${original.entryNumber}.`
          : '');

      // The status flip IS the concurrency guard. `lifecycleState`/`canVoid`
      // and the `original` lookup above all ran outside this transaction, so
      // two interleaved voids of the same invoice can both reach here having
      // seen a non-VOIDED status. Only one `updateMany` can match a row that
      // is still not VOIDED — the other gets flipped.count === 0, throws,
      // and its reversal (built above but not yet written) never gets
      // created, because the journalEntry.create below only runs after this
      // guard passes. Two concurrent voids therefore commit at most one
      // reversal between them, never two.
      const flipped = await tx.invoice.updateMany({
        where: { id, status: { not: 'VOIDED' } },
        data: {
          status: 'VOIDED',
          amountDue: 0,
          internalNotes: current?.internalNotes
            ? `${current.internalNotes}\n\n${stamp}`
            : stamp,
        },
      });
      if (flipped.count !== 1) {
        throw new BadRequestException('This invoice is already voided.');
      }

      if (original) {
        await tx.journalEntry.create({
          data: {
            entryNumber: reversalEntryNumber!,
            date: new Date(),
            memo:
              `Void of invoice ${invoice.invoiceNumber} — reverses ${original.entryNumber}. ` +
              `Reason: ${dto.reason}`,
            source: 'SYSTEM',
            sourceType: 'INVOICE_VOID',
            sourceId: id,
            status: 'POSTED',
            postedAt: new Date(),
            lines: { create: buildReversalLines(original.lines) },
          },
        });
      }

      // `updateMany` returns only a count, not the row, so the updated
      // invoice is re-fetched here for the return value — through `tx`, so
      // it reflects exactly what this transaction just wrote and nothing a
      // concurrent request wrote after it.
      await this.writeAudit(
        userId,
        'VOID',
        id,
        {
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          total: String(invoice.total),
          reason: dto.reason,
          reversedEntry: original?.entryNumber ?? null,
          reversalEntry: reversalEntryNumber,
        },
        ip,
        tx,
      );

      return tx.invoice.findUnique({ where: { id } });
    });

    return voided;
  }

  /**
   * Removes an invoice that should never have existed. Refused the moment
   * anything has posted against it — see invoice-lifecycle.rules.ts for why;
   * that module, not this method, is where that judgment is made. The
   * uploaded files stay on disk; only the rows go.
   */
  async remove(id: string, dto: DeleteInvoiceDto, userId: string, ip?: string) {
    await this.assertPassword(userId, dto.password, 'DELETE', id, ip);

    const { state, invoice } = await this.lifecycleState(id);

    if (dto.confirmNumber.trim() !== invoice.invoiceNumber) {
      throw new BadRequestException(
        `Type the invoice number exactly to confirm. Expected ${invoice.invoiceNumber}.`,
      );
    }

    const verdict = canDelete(state);
    if (verdict.allowed === false) {
      throw new BadRequestException(verdict.reason);
    }

    const attachments = await this.prisma.documentAttachment.findMany({
      where: { entityType: 'INVOICE', entityId: id },
      select: { id: true, name: true, url: true },
    });

    // `canDelete` only blocks deletion when a receipt has CLEARED, so a
    // PENDING or BOUNCED payment can still be attached here. `Payment.invoiceId`
    // is an optional relation with no explicit `onDelete`, so Prisma's default
    // (SetNull) silently orphans that payment row when the invoice below is
    // deleted, rather than blocking the delete — that rule is kept as-is by
    // design. This just makes sure the audit row still records that the
    // payment was ever attached, so the delete stays fully reconstructable.
    const payments = await this.prisma.payment.findMany({
      where: { invoiceId: id },
      select: { id: true, paymentNumber: true, direction: true, status: true, amount: true },
    });

    await this.prisma.$transaction(async (tx) => {
      // The audit row is the ONLY surviving copy of this invoice, its line
      // items and its attachment list once the deletes below run — so it is
      // written FIRST, through `tx`, before any delete. If the audit insert
      // fails, this throws and the whole transaction (including the deletes
      // that haven't happened yet) rolls back: the invoice stays exactly as
      // it was, rather than being gone with no record of it ever existing.
      await this.writeAudit(
        userId,
        'DELETE',
        id,
        {
          invoice: {
            invoiceNumber: invoice.invoiceNumber,
            clientId: invoice.clientId,
            client: invoice.client?.companyName ?? null,
            issueDate: invoice.issueDate,
            subtotal: String(invoice.subtotal),
            vatAmount: String(invoice.vatAmount),
            total: String(invoice.total),
            status: invoice.status,
            internalNotes: invoice.internalNotes,
          },
          items: invoice.items.map((i: any) => ({
            description: i.description,
            quantity: String(i.quantity),
            unitPrice: String(i.unitPrice),
            lineTotal: String(i.lineTotal),
          })),
          attachments,
          payments,
          reason: dto.reason,
        },
        ip,
        tx,
      );

      await tx.documentAttachment.deleteMany({ where: { entityType: 'INVOICE', entityId: id } });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    return { deleted: true, invoiceNumber: invoice.invoiceNumber };
  }
}
