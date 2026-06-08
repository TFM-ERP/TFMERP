import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkflowService } from '../../workflow/workflow.service';

const OPEN_PO: any[] = ['APPROVED', 'PARTIALLY_INVOICED'];
const COST_ACTUAL: any[] = ['APPROVED', 'PAID'];
const periodOf = (d: Date | string) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
// capability rank for the project-role layer
const CAP_RANK: Record<string, number> = { none: 0, view: 1, edit: 2, approve: 3, lock: 4 };

@Injectable()
export class CostingService {
  constructor(private prisma: PrismaService, private workflow: WorkflowService) {}

  /** Submit a PO into its approval workflow (if one is defined for the type). */
  async submitPoForApproval(id: string, userId?: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException('PO not found');
    if (!['DRAFT', 'REJECTED'].includes(po.status as any)) throw new BadRequestException(`Only DRAFT/REJECTED POs can be submitted (this is ${po.status}).`);
    const inst = await this.workflow.start({
      entityType: 'PURCHASE_ORDER', entityId: id, projectId: po.projectId,
      label: `${po.poNumber} · ${Number(po.total).toLocaleString()} ${po.currency}`,
    }, userId);
    // move out of DRAFT so the direct-approve/route buttons disappear while it's pending
    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'SUBMITTED' } });
    return inst;
  }

  /** Send a REJECTED PO back to DRAFT to revise & resubmit. */
  async revisePo(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException('PO not found');
    if (po.status !== 'REJECTED') throw new BadRequestException('Only a rejected PO can be revised.');
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'DRAFT' } });
  }

  /**
   * Per-project capability gate (V1.2 §2). FAIL-OPEN: if the user has NO project
   * role assignment, the global RBAC guard already governs — we don't restrict.
   * Only when a user HAS a project role do we enforce its capability flag, so the
   * change can never lock out existing admins/operators who aren't assigned a role.
   */
  private async assertProjectCapability(projectId: string, userId: string | undefined, capability: string, minLevel: string) {
    if (!userId) return;
    const a = await this.prisma.projectRoleAssignment.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { template: { select: { name: true, permissions: true } } },
    });
    if (!a) return; // no project role → defer to global RBAC (unchanged behavior)
    const have = CAP_RANK[String((a.template.permissions as any)?.[capability] ?? 'none')] ?? 0;
    if (have < (CAP_RANK[minLevel] ?? 0)) {
      throw new ForbiddenException(`Your project role (${a.template.name}) cannot ${capability} at the required level on this project.`);
    }
  }

  /** Throw if the date falls in a closed accounting period (shared lock with the Accounting tab). */
  private async assertOpen(projectId: string, date: Date | string) {
    const p = await this.prisma.accountingPeriod.findUnique({ where: { projectId_period: { projectId, period: periodOf(date) } } });
    if (p?.status === 'CLOSED') throw new BadRequestException(`Accounting period ${periodOf(date)} is closed. Reopen it to post or edit entries.`);
  }

  // ── Vendors ───────────────────────────────────────────────────────────────────
  vendors(projectId: string) {
    return this.prisma.productionVendor.findMany({ where: { projectId }, orderBy: { name: 'asc' } });
  }
  createVendor(data: any) {
    return this.prisma.productionVendor.create({ data: {
      projectId: data.projectId, supplierId: data.supplierId || null,
      name: data.name || 'Vendor', category: data.category || null,
      contactName: data.contactName || null, phone: data.phone || null, email: data.email || null,
      trn: data.trn || null, notes: data.notes || null,
    } });
  }
  updateVendor(id: string, data: any) {
    const { id: _i, projectId, project, purchaseOrders, createdAt, ...rest } = data || {};
    return this.prisma.productionVendor.update({ where: { id }, data: rest });
  }
  removeVendor(id: string) { return this.prisma.productionVendor.delete({ where: { id } }); }

  // ── Add-from-suppliers (linked master, single source of truth) ─────────────────
  // The company Supplier list on the Partners tab is the master. A project vendor
  // links to it via supplierId and snapshots name/TRN/contact for stable PO records.
  private vendorSnapshot(s: any) {
    return {
      supplierId: s.id,
      name: s.tradeName || s.name,
      category: (s.categories && s.categories[0]) || s.category || null,
      contactName: s.contactName || null,
      phone: s.phone || null,
      email: s.email || null,
      trn: s.trn || null,
    };
  }

  // Suppliers available to import, flagged with whether they're already linked to the project.
  async supplierCatalog(projectId: string) {
    const [suppliers, linked] = await Promise.all([
      this.prisma.supplier.findMany({
        where: { status: 'ACTIVE' as any },
        orderBy: { name: 'asc' },
        select: {
          id: true, supplierCode: true, name: true, tradeName: true, category: true,
          categories: true, contactName: true, phone: true, email: true, trn: true, city: true, country: true,
        },
      }),
      this.prisma.productionVendor.findMany({ where: { projectId, supplierId: { not: null } }, select: { supplierId: true } }),
    ]);
    const linkedSet = new Set(linked.map((v) => v.supplierId));
    return suppliers.map((s) => ({ ...s, linked: linkedSet.has(s.id) }));
  }

  // Import one / several / all suppliers into a project as linked vendor rows. Skips already-linked.
  async addFromSuppliers(projectId: string, supplierIds: string[]) {
    if (!projectId) throw new BadRequestException('projectId required');
    let ids = Array.isArray(supplierIds) ? supplierIds.filter(Boolean) : [];
    if (ids.length === 0) {
      // "Add all" → every active supplier
      const all = await this.prisma.supplier.findMany({ where: { status: 'ACTIVE' as any }, select: { id: true } });
      ids = all.map((s) => s.id);
    }
    const already = await this.prisma.productionVendor.findMany({
      where: { projectId, supplierId: { in: ids } }, select: { supplierId: true },
    });
    const skip = new Set(already.map((v) => v.supplierId));
    const toAdd = ids.filter((id) => !skip.has(id));
    if (toAdd.length === 0) return { added: 0, skipped: ids.length };
    const suppliers = await this.prisma.supplier.findMany({ where: { id: { in: toAdd } } });
    await this.prisma.productionVendor.createMany({
      data: suppliers.map((s) => ({ projectId, ...this.vendorSnapshot(s) })),
    });
    return { added: suppliers.length, skipped: ids.length - suppliers.length };
  }

  // Re-pull the snapshot from the linked Supplier master (keeps project vendor current).
  async refreshVendorFromSupplier(id: string) {
    const v = await this.prisma.productionVendor.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Vendor not found');
    if (!v.supplierId) throw new BadRequestException('This vendor is ad-hoc (not linked to a supplier).');
    const s = await this.prisma.supplier.findUnique({ where: { id: v.supplierId } });
    if (!s) throw new NotFoundException('Linked supplier no longer exists.');
    const { supplierId, ...snap } = this.vendorSnapshot(s);
    return this.prisma.productionVendor.update({ where: { id }, data: snap });
  }

  // ── Purchase Orders ───────────────────────────────────────────────────────────
  private async nextPo(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await this.prisma.documentSequence.upsert({
      where: { prefix: 'PO' }, update: { lastNumber: { increment: 1 } }, create: { prefix: 'PO', lastNumber: 1, year },
    });
    return `PO-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
  }

  listPos(projectId: string, query: { status?: string } = {}) {
    const where: any = { projectId };
    if (query.status) where.status = query.status;
    return this.prisma.purchaseOrder.findMany({ where, include: { vendor: { select: { name: true } } }, orderBy: { date: 'desc' } });
  }

  async createPo(data: any, userId?: string) {
    const amount = Number(data.amount) || 0;
    const tax = Number(data.taxAmount) || 0;
    const poNumber = await this.nextPo();
    let vendorName = data.vendorName || null;
    if (data.vendorId) {
      const v = await this.prisma.productionVendor.findUnique({ where: { id: data.vendorId } });
      if (v) vendorName = v.name;
    }
    return this.prisma.purchaseOrder.create({
      data: {
        projectId: data.projectId, poNumber,
        vendorId: data.vendorId || null, vendorName,
        costCenterCode: data.costCenterCode || null, costCenterTitle: data.costCenterTitle || null,
        description: data.description || 'Purchase order',
        date: data.date ? new Date(data.date) : new Date(),
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        amount, taxAmount: tax, total: amount + tax, currency: data.currency || 'AED',
        status: data.status || 'DRAFT', notes: data.notes || null, createdById: userId || null,
      },
    });
  }

  async updatePo(id: string, data: any) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException('PO not found');
    if (['CLOSED', 'CANCELLED'].includes(po.status) && !data.status) throw new BadRequestException('Closed/cancelled POs cannot be edited.');
    const { id: _i, projectId, project, vendor, createdAt, updatedAt, poNumber, invoicedAmount, ...rest } = data || {};
    if (rest.amount !== undefined || rest.taxAmount !== undefined) {
      const amount = rest.amount !== undefined ? Number(rest.amount) : Number(po.amount);
      const tax = rest.taxAmount !== undefined ? Number(rest.taxAmount) : Number(po.taxAmount);
      rest.total = amount + tax;
    }
    if (rest.date) rest.date = new Date(rest.date);
    if (rest.expectedDate) rest.expectedDate = new Date(rest.expectedDate);
    return this.prisma.purchaseOrder.update({ where: { id }, data: rest });
  }

  async setPoStatus(id: string, status: string, userId?: string) {
    // Approving a PO (commitment authority) requires 'approve' on the project.
    if (String(status).toUpperCase() === 'APPROVED') {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id }, select: { projectId: true } });
      if (po) await this.assertProjectCapability(po.projectId, userId, 'po', 'approve');
    }
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: status as any } });
  }

  removePo(id: string) { return this.prisma.purchaseOrder.delete({ where: { id } }); }

  /** Invoice a PO (full or partial): posts a ledger COST and advances the PO. */
  async invoicePo(id: string, body: { amount?: number; invoiceNumber?: string; invoiceDate?: string }, userId?: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new NotFoundException('PO not found');
    const remaining = Number(po.total) - Number(po.invoicedAmount);
    const amount = body.amount != null ? Number(body.amount) : remaining;
    if (amount <= 0) throw new BadRequestException('Nothing left to invoice.');
    if (amount > remaining + 0.01) throw new BadRequestException(`Amount exceeds remaining ${remaining.toFixed(2)}.`);
    // Vendor-invoice details are required to log a payable (so the payment gate is satisfiable).
    const invoiceNumber = (body.invoiceNumber || '').trim();
    if (!invoiceNumber) throw new BadRequestException('Vendor invoice number is required to record this payable.');

    const invDate = (body.invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(body.invoiceDate)) ? new Date(body.invoiceDate) : new Date();
    await this.assertOpen(po.projectId, invDate);
    await this.prisma.projectTransaction.create({
      data: {
        projectId: po.projectId, kind: 'COST', date: invDate,
        accountCode: po.costCenterCode, accountTitle: po.costCenterTitle,
        description: `Invoice — ${po.poNumber}${po.description ? ` (${po.description})` : ''}`,
        party: po.vendorName, reference: po.poNumber, invoiceNumber,
        vendorId: po.vendorId || null,
        dueDate: po.expectedDate || null, // payable due date carries from the PO's expected date
        amount, taxAmount: 0, total: amount, currency: po.currency,
        status: 'APPROVED', createdById: userId || null,
      },
    });
    const invoiced = Number(po.invoicedAmount) + amount;
    const status = invoiced >= Number(po.total) - 0.01 ? 'CLOSED' : 'PARTIALLY_INVOICED';
    return this.prisma.purchaseOrder.update({ where: { id }, data: { invoicedAmount: invoiced, status } });
  }

  setEtc(accountId: string, etcAmount: number | null) {
    return this.prisma.budgetAccount.update({ where: { id: accountId }, data: { etcAmount } });
  }

  // ── OCR intake (Anthropic vision) — invoices · petty-cash receipts · timesheets ────
  // One vision extractor, three task prompts. Every result is suggestion-only and
  // lands as a DRAFT transaction or PENDING timecard with a confidence score —
  // never a live actual. (V1.2 — doc system/05 §4)
  private static OCR_PROMPTS: Record<string, string> = {
    INVOICE:
      'You are an accounts-payable OCR assistant. Read this vendor invoice and return ONLY strict JSON ' +
      '(no prose, no markdown) with keys: total (number — grand total incl. tax), subtotal (number|null), ' +
      'taxAmount (number|null), currency (ISO code|null), vendorName (string|null), ' +
      'poRef (the purchase-order reference printed on the invoice|null), invoiceNumber (string|null), ' +
      'invoiceDate (YYYY-MM-DD|null), confidence (0-1).',
    PETTY_CASH_RECEIPT:
      'You are a petty-cash OCR assistant. Read this receipt and return ONLY strict JSON with keys: ' +
      'total (number — amount paid incl. tax), taxAmount (number|null), currency (ISO code|null), ' +
      'merchant (string|null), category (a short spend category like "Catering","Fuel","Supplies"|null), ' +
      'date (YYYY-MM-DD|null), description (one short line|null), confidence (0-1).',
    DIGITAL_TIMESHEET:
      'You are a payroll OCR assistant. Read this crew timesheet and return ONLY strict JSON with keys: ' +
      'name (crew member full name|null), role (job title|null), weekEnding (YYYY-MM-DD|null), ' +
      'days (number of days worked|null), dailyRate (number|null), otHours (overtime hours|null), ' +
      'otRate (overtime hourly rate|null), boxRental (number|null), kitRental (number|null), ' +
      'perDiemDays (number|null), perDiemRate (number|null), currency (ISO code|null), confidence (0-1).',
  };

  /** Vision OCR for a given task type. Returns the parsed JSON (or {} on failure). */
  private async extractDocFields(filePath: string, mime: string, task = 'INVOICE'): Promise<any> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new BadRequestException('OCR not configured. Set ANTHROPIC_API_KEY in the backend .env.');
    const model = process.env.LABOR_AI_MODEL || 'claude-3-5-sonnet-20241022';
    const b64 = readFileSync(filePath).toString('base64');
    const isPdf = /pdf$/i.test(mime || '') || filePath.toLowerCase().endsWith('.pdf');
    const mediaBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
      : { type: 'image', source: { type: 'base64', media_type: mime || 'image/jpeg', data: b64 } };
    const instruction = CostingService.OCR_PROMPTS[task] || CostingService.OCR_PROMPTS.INVOICE;
    const headers: any = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers,
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text: instruction }] }] }),
    } as any);
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new BadRequestException(`OCR failed (HTTP ${res.status}). ${t.slice(0, 180)}`); }
    const data: any = await res.json();
    let text = (data?.content?.[0]?.text || '').trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) text = fence[1].trim();
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) text = text.slice(s, e + 1);
    try { return JSON.parse(text); } catch { return {}; }
  }

  /** Back-compat alias — the invoice path still calls this name. */
  private extractInvoiceFields(filePath: string, mime: string) { return this.extractDocFields(filePath, mime, 'INVOICE'); }

  /**
   * Petty-cash receipt OCR → a DRAFT petty-cash spend on the given float.
   * Suggestion-only: posted as DRAFT, period-guarded, awaits human approval.
   */
  async uploadReceipt(floatId: string, file: any, body: any, userId?: string) {
    if (!file) throw new BadRequestException('No receipt file provided.');
    const float = await this.prisma.pettyCashFloat.findUnique({ where: { id: floatId } });
    if (!float) throw new NotFoundException('Float not found');
    const ext = await this.extractDocFields(file.path, file.mimetype, 'PETTY_CASH_RECEIPT');
    const amount = Number(ext.total) || 0;
    const date = (ext.date && /^\d{4}-\d{2}-\d{2}$/.test(ext.date)) ? ext.date : new Date().toISOString().slice(0, 10);
    return {
      ocr: { ...ext, fileUrl: `/uploads/${file.filename}` },
      draft: {
        floatId, type: 'SPEND', amount, date,
        description: `${ext.merchant ? ext.merchant + ' — ' : ''}${ext.description || ext.category || 'Petty cash'}`.trim(),
        costCenterCode: body?.costCenterCode || null, costCenterTitle: body?.costCenterTitle || null,
        receiptUrl: `/uploads/${file.filename}`, confidence: Number(ext.confidence) || 0,
      },
      note: 'Review the extracted figures, set a cost center, then confirm to post the petty-cash spend.',
    };
  }

  /**
   * Digital timesheet OCR → a PENDING Timecard draft for the project.
   * Suggestion-only: nothing burdens the budget until a person approves it.
   */
  async uploadTimesheet(projectId: string, file: any, userId?: string) {
    if (!file) throw new BadRequestException('No timesheet file provided.');
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { id: true, currency: true } });
    if (!project) throw new NotFoundException('Project not found');
    const ext = await this.extractDocFields(file.path, file.mimetype, 'DIGITAL_TIMESHEET');
    const num = (v: any) => (v == null || v === '' || isNaN(Number(v)) ? 0 : Number(v));
    // Shaped to drop straight into the Timecard create form (DRAFT, awaits review).
    return {
      ocr: { ...ext, fileUrl: `/uploads/${file.filename}` },
      draft: {
        name: ext.name || '', role: ext.role || '',
        weekEnding: (ext.weekEnding && /^\d{4}-\d{2}-\d{2}$/.test(ext.weekEnding)) ? ext.weekEnding : '',
        days: num(ext.days), dailyRate: num(ext.dailyRate),
        otHours: num(ext.otHours), otRate: num(ext.otRate),
        boxRental: num(ext.boxRental), kitRental: num(ext.kitRental),
        perDiemDays: num(ext.perDiemDays), perDiemRate: num(ext.perDiemRate),
        currency: ext.currency || project.currency,
        notes: `Scanned timesheet · /uploads/${file.filename}`,
        confidence: num(ext.confidence),
      },
      note: 'Review the extracted figures, set the cost center/classification, then save as a DRAFT timecard.',
    };
  }

  /**
   * OCR a vendor invoice against an open PO and DRAFT a COST transaction for human review.
   * The draft is status=DRAFT so it does NOT count as an actual until a person approves it.
   * Respects the closed-period guard exactly like every other posting.
   */
  async uploadInvoice(poId: string, file: any, userId?: string) {
    if (!file) throw new BadRequestException('No invoice file provided.');
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new NotFoundException('PO not found');
    if (!['APPROVED', 'PARTIALLY_INVOICED'].includes(po.status as any)) {
      throw new BadRequestException(`Invoices can only be matched to an open (APPROVED) PO. This PO is ${po.status}.`);
    }

    const ext = await this.extractInvoiceFields(file.path, file.mimetype);
    const gross = Number(ext.total) || 0;
    const tax = Number(ext.taxAmount) || 0;
    const sub = ext.subtotal != null ? Number(ext.subtotal) : Math.max(0, gross - tax);
    const invoiceDate = (ext.invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(ext.invoiceDate)) ? new Date(ext.invoiceDate) : new Date();

    // SAME accounting-period guard as manual postings, PO invoicing and petty cash
    await this.assertOpen(po.projectId, invoiceDate);

    const norm = (s: string) => (s || '').replace(/\s+/g, '').toUpperCase();
    const poRefMatches = !!ext.poRef && norm(String(ext.poRef)).includes(norm(po.poNumber));
    const fileUrl = `/uploads/${file.filename}`;

    // Draft a COST transaction (status DRAFT → awaits human review, not yet an actual)
    const transaction = await this.prisma.projectTransaction.create({
      data: {
        projectId: po.projectId, kind: 'COST', date: invoiceDate,
        accountCode: po.costCenterCode, accountTitle: po.costCenterTitle,
        description: `Invoice (OCR) — ${po.poNumber}${po.description ? ` (${po.description})` : ''}`,
        party: ext.vendorName || po.vendorName, reference: po.poNumber,
        vendorId: po.vendorId || null,
        invoiceNumber: ext.invoiceNumber || null,
        dueDate: po.expectedDate || null,
        amount: sub, taxAmount: tax, total: gross,
        currency: po.currency, status: 'DRAFT', createdById: userId || null,
      },
    });

    // Keep the scanned invoice in the document vault, linked to the TRANSACTION so the
    // payment-release gate finds it (the PO number is carried on the txn's reference).
    await this.prisma.projectDocument.create({
      data: {
        projectId: po.projectId, name: file.originalname || 'Vendor invoice', kind: 'FILE', provider: 'UPLOAD',
        url: fileUrl, category: 'Invoice', mimeType: file.mimetype, sizeBytes: file.size,
        entityType: 'TRANSACTION', entityId: transaction.id, uploadedById: userId || null,
      },
    }).catch(() => {});

    return {
      transaction,
      extracted: { ...ext, total: gross, subtotal: sub, taxAmount: tax },
      match: {
        poNumber: po.poNumber,
        poRefOnInvoice: ext.poRef || null,
        poRefMatches,
        vendorExpected: po.vendorName,
        poRemaining: Number(po.total) - Number(po.invoicedAmount),
        amountWithinRemaining: gross <= (Number(po.total) - Number(po.invoicedAmount)) + 0.01,
        confidence: ext.confidence ?? null,
      },
      fileUrl,
      note: 'Drafted for review. Verify the figures, then Approve it in Accounting to recognise the cost (and invoice the PO).',
    };
  }

  // ── Cost Report (EFC) ───────────────────────────────────────────────────────────
  async costReport(projectId: string) {
    const project = await this.prisma.productionProject.findUnique({
      where: { id: projectId },
      include: {
        budgetVersions: {
          where: { isActive: true },
          include: { sections: { orderBy: { sortOrder: 'asc' }, include: { accounts: { orderBy: { sortOrder: 'asc' }, include: { lineItems: { select: { total: true, subtotal: true, fringeAmount: true } } } } } } },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    const version = project.budgetVersions[0];

    // committed (open PO remaining) by cost center
    const pos = await this.prisma.purchaseOrder.findMany({ where: { projectId, status: { in: OPEN_PO } } });
    const committedByCode: Record<string, number> = {};
    for (const p of pos) {
      const code = p.costCenterCode || '__none__';
      committedByCode[code] = (committedByCode[code] || 0) + (Number(p.total) - Number(p.invoicedAmount));
    }
    // actuals by cost center
    const costs = await this.prisma.projectTransaction.findMany({ where: { projectId, kind: 'COST', status: { in: COST_ACTUAL } }, select: { accountCode: true, total: true } });
    const actualByCode: Record<string, number> = {};
    for (const c of costs) {
      const code = c.accountCode || '__none__';
      actualByCode[code] = (actualByCode[code] || 0) + Number(c.total);
    }

    // approved budget changes (overages) by cost center → additive to the budget baseline
    const approvedOver = await this.prisma.overage.findMany({ where: { projectId, status: 'APPROVED' as any }, select: { accountCode: true, amount: true } });
    const approvedByCode: Record<string, number> = {};
    for (const o of approvedOver) {
      const code = o.accountCode || '__none__';
      approvedByCode[code] = (approvedByCode[code] || 0) + Number(o.amount);
    }

    // budget transfers (line-to-line reallocations) → net per cost center; sums to zero overall.
    // Only APPROVED transfers reshape the budget; pending ones wait for sign-off.
    const transfers = await this.prisma.budgetTransfer.findMany({ where: { projectId, status: 'APPROVED' as any }, select: { fromCode: true, toCode: true, amount: true } });
    const transferByCode: Record<string, number> = {};
    for (const tr of transfers) {
      const a = Number(tr.amount);
      transferByCode[tr.fromCode] = (transferByCode[tr.fromCode] || 0) - a;
      transferByCode[tr.toCode] = (transferByCode[tr.toCode] || 0) + a;
    }

    const sections = (version?.sections || []).map(s => {
      const accounts = s.accounts.map(a => {
        const budget = a.lineItems.reduce((t, i) => t + Number(i.total), 0);
        const fringe = a.lineItems.reduce((t, i) => t + Number(i.fringeAmount), 0);
        const wages = a.lineItems.reduce((t, i) => t + Number(i.subtotal), 0);
        const committed = committedByCode[a.code] || 0;
        const actual = actualByCode[a.code] || 0;
        const transfer = transferByCode[a.code] || 0;     // ± reallocations
        const approvedChange = approvedByCode[a.code] || 0; // approved overages
        const revisedBudget = budget + transfer + approvedChange;
        // ETC: manual override if set, else remaining commitments
        const etc = a.etcAmount != null ? Number(a.etcAmount) : committed;
        const efc = actual + etc;
        const variance = revisedBudget - efc;
        return {
          accountId: a.id, code: a.code, title: a.title,
          budget, wages, fringe, transfer, approvedChange, revisedBudget,
          committed, actual, etc, efc, variance,
          overspent: variance < -0.01,
          etcManual: a.etcAmount != null,
        };
      });
      const roll = (k: string) => accounts.reduce((t, x: any) => t + x[k], 0);
      return { code: s.code, title: s.title, color: s.color, accounts,
        budget: roll('budget'), transfer: roll('transfer'), approvedChange: roll('approvedChange'), revisedBudget: roll('revisedBudget'),
        fringe: roll('fringe'), committed: roll('committed'), actual: roll('actual'), efc: roll('efc'), variance: roll('variance') };
    });

    const totals = sections.reduce((t, s) => ({
      budget: t.budget + s.budget, transfer: t.transfer + s.transfer, approvedChange: t.approvedChange + s.approvedChange, revisedBudget: t.revisedBudget + s.revisedBudget,
      fringe: t.fringe + s.fringe, committed: t.committed + s.committed, actual: t.actual + s.actual,
      efc: t.efc + s.efc, variance: t.variance + s.variance,
    }), { budget: 0, transfer: 0, approvedChange: 0, revisedBudget: 0, fringe: 0, committed: 0, actual: 0, efc: 0, variance: 0 });

    return { projectId, currency: project.currency, versionName: version?.versionName, sections, totals };
  }

  async saveSnapshot(projectId: string, label?: string, userId?: string) {
    // Freezing a cost report (the financier/bond artifact) requires 'lock' authority.
    await this.assertProjectCapability(projectId, userId, 'costReport', 'lock');
    const report = await this.costReport(projectId);
    return this.prisma.costReportSnapshot.create({
      data: {
        projectId, label: label || null, data: report as any,
        budget: report.totals.budget, committed: report.totals.committed, actual: report.totals.actual,
        efc: report.totals.efc, variance: report.totals.variance,
      },
    });
  }

  listSnapshots(projectId: string) {
    return this.prisma.costReportSnapshot.findMany({
      where: { projectId }, orderBy: { asOf: 'desc' },
      select: { id: true, asOf: true, label: true, budget: true, committed: true, actual: true, efc: true, variance: true },
    });
  }

  // ── Petty Cash / Float ──────────────────────────────────────────────────────────
  async floats(projectId: string) {
    const floats = await this.prisma.pettyCashFloat.findMany({
      where: { projectId }, include: { transactions: true }, orderBy: { createdAt: 'desc' },
    });
    return floats.map(f => {
      let topups = 0, spends = 0;
      for (const t of f.transactions) (t.type === 'TOPUP' ? (topups += Number(t.amount)) : (spends += Number(t.amount)));
      return { ...f, transactions: undefined, topups, spends, balance: Number(f.openingAmount) + topups - spends, txnCount: f.transactions.length };
    });
  }

  createFloat(data: any) {
    return this.prisma.pettyCashFloat.create({ data: {
      projectId: data.projectId, holder: data.holder || 'Holder',
      openingAmount: Number(data.openingAmount) || 0, currency: data.currency || 'AED', notes: data.notes || null,
    } });
  }
  closeFloat(id: string) { return this.prisma.pettyCashFloat.update({ where: { id }, data: { status: 'CLOSED' } }); }

  pettyTxns(floatId: string) {
    return this.prisma.pettyCashTxn.findMany({ where: { floatId }, orderBy: { date: 'desc' } });
  }

  async addPettyTxn(floatId: string, data: any, userId?: string) {
    const float = await this.prisma.pettyCashFloat.findUnique({ where: { id: floatId } });
    if (!float) throw new NotFoundException('Float not found');
    // Idempotency for the offline PWA queue: if this client-generated id already exists,
    // it was already synced — return it instead of double-posting.
    if (data.clientId) {
      const existing = await this.prisma.pettyCashTxn.findUnique({ where: { id: data.clientId } });
      if (existing) return existing;
    }
    const amount = Number(data.amount) || 0;
    let ledgerTxnId: string | null = null;
    // A SPEND is an actual project cost — post it to the ledger so the cost report stays accurate
    if (data.type === 'SPEND') {
      const spendDate = data.date ? new Date(data.date) : new Date();
      await this.assertOpen(float.projectId, spendDate);
      const ledger = await this.prisma.projectTransaction.create({
        data: {
          projectId: float.projectId, kind: 'COST', date: spendDate,
          accountCode: data.costCenterCode || null, accountTitle: data.costCenterTitle || null,
          description: `Petty cash — ${data.description || ''}`.trim(), party: float.holder,
          amount, taxAmount: 0, total: amount, currency: float.currency, status: 'PAID', createdById: userId || null,
        },
      });
      ledgerTxnId = ledger.id;
    }
    return this.prisma.pettyCashTxn.create({
      data: {
        id: data.clientId || undefined, // reuse the offline-minted cuid when present
        floatId, type: data.type, date: data.date ? new Date(data.date) : new Date(),
        description: data.description || (data.type === 'TOPUP' ? 'Top-up' : 'Spend'),
        costCenterCode: data.costCenterCode || null, costCenterTitle: data.costCenterTitle || null,
        amount, ledgerTxnId, createdById: userId || null,
      },
    });
  }

  async removePettyTxn(id: string) {
    const t = await this.prisma.pettyCashTxn.findUnique({ where: { id } });
    if (t?.ledgerTxnId) {
      const ledger = await this.prisma.projectTransaction.findUnique({ where: { id: t.ledgerTxnId } });
      if (ledger) {
        // Removing the linked SPEND deletes a posted actual — period lock applies.
        await this.assertOpen(ledger.projectId, ledger.date);
        await this.prisma.projectTransaction.delete({ where: { id: ledger.id } }).catch(() => {});
      }
    }
    return this.prisma.pettyCashTxn.delete({ where: { id } });
  }

  // ── Cash-Flow Forecast (weekly) ───────────────────────────────────────────────────
  private weekStart(d: Date): string {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // Monday=0
    x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
  }

  async cashflow(projectId: string) {
    const project = await this.prisma.productionProject.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const txns = await this.prisma.projectTransaction.findMany({ where: { projectId } });
    const pos = await this.prisma.purchaseOrder.findMany({ where: { projectId, status: { in: OPEN_PO } } });

    const weeks: Record<string, any> = {};
    const bucket = (k: string) => (weeks[k] = weeks[k] || { week: k, inflow: 0, outflow: 0, forecastIn: 0, forecastOut: 0 });

    for (const t of txns) {
      const k = this.weekStart(new Date(t.date));
      const amt = Number(t.total);
      if (t.kind === 'INCOME') {
        if (['RECEIVED', 'PAID'].includes(t.status)) bucket(k).inflow += amt;
        else if (t.status === 'INVOICED') bucket(k).forecastIn += amt;
      } else if (t.kind === 'COST') {
        if (['PAID', 'APPROVED'].includes(t.status)) bucket(k).outflow += amt;
      }
    }
    // open PO commitments → forecast outflow at expected date (or PO date)
    for (const p of pos) {
      const k = this.weekStart(new Date(p.expectedDate || p.date));
      bucket(k).forecastOut += Number(p.total) - Number(p.invoicedAmount);
    }

    const rows = Object.values(weeks).sort((a: any, b: any) => a.week.localeCompare(b.week));
    let cum = 0;
    for (const r of rows as any[]) {
      r.net = (r.inflow + r.forecastIn) - (r.outflow + r.forecastOut);
      cum += r.net;
      r.cumulative = cum;
    }
    const totals = (rows as any[]).reduce((a, r) => ({
      inflow: a.inflow + r.inflow, outflow: a.outflow + r.outflow,
      forecastIn: a.forecastIn + r.forecastIn, forecastOut: a.forecastOut + r.forecastOut,
    }), { inflow: 0, outflow: 0, forecastIn: 0, forecastOut: 0 });
    return { currency: project.currency, rows, totals, closingCash: cum };
  }

  // ── Budget transfers (line-to-line reallocation) ──────────────────────────────────
  listTransfers(projectId: string) {
    return this.prisma.budgetTransfer.findMany({ where: { projectId }, orderBy: { date: 'desc' } });
  }

  async createTransfer(data: any, userId?: string) {
    const amount = Number(data.amount) || 0;
    if (amount <= 0) throw new BadRequestException('Transfer amount must be greater than zero.');
    if (!data.fromCode || !data.toCode) throw new BadRequestException('Both donor and recipient cost centers are required.');
    if (data.fromCode === data.toCode) throw new BadRequestException('Donor and recipient must be different cost centers.');
    // resolve account titles from the active budget version
    const version = await this.prisma.budgetVersion.findFirst({
      where: { projectId: data.projectId, isActive: true },
      include: { sections: { include: { accounts: { select: { code: true, title: true } } } } },
    });
    const accounts = (version?.sections || []).flatMap(s => s.accounts);
    const byCode = new Map(accounts.map(a => [a.code, a.title]));
    if (!byCode.has(data.fromCode)) throw new BadRequestException(`Donor cost center ${data.fromCode} not found in the active budget.`);
    if (!byCode.has(data.toCode)) throw new BadRequestException(`Recipient cost center ${data.toCode} not found in the active budget.`);
    return this.prisma.budgetTransfer.create({
      data: {
        projectId: data.projectId,
        fromCode: data.fromCode, fromTitle: byCode.get(data.fromCode) || null,
        toCode: data.toCode, toTitle: byCode.get(data.toCode) || null,
        amount, reason: data.reason || null,
        date: data.date ? new Date(data.date) : new Date(),
        createdById: userId || null,
      },
    });
  }

  async setTransferStatus(id: string, status: string, userId?: string) {
    const decided = status === 'APPROVED' || status === 'REJECTED';
    if (decided) {
      // Approving/rejecting a budget transfer requires 'approve' authority on the project.
      const t = await this.prisma.budgetTransfer.findUnique({ where: { id }, select: { projectId: true } });
      if (t) await this.assertProjectCapability(t.projectId, userId, 'transfers', 'approve');
    }
    return this.prisma.budgetTransfer.update({
      where: { id },
      data: {
        status: status as any,
        approvedById: decided ? (userId || null) : null,
        approvedAt: decided ? new Date() : null,
      },
    });
  }

  removeTransfer(id: string) { return this.prisma.budgetTransfer.delete({ where: { id } }); }

  // ── Cost-center accounts overspent vs revised budget (for "raise overage" prompts) ──
  async overspendSuggestions(projectId: string) {
    const report = await this.costReport(projectId);
    const rows: any[] = [];
    for (const s of report.sections) for (const a of (s as any).accounts) {
      if (a.overspent) rows.push({
        code: a.code, title: a.title, sectionCode: s.code, sectionTitle: s.title,
        budget: a.budget, revisedBudget: a.revisedBudget, efc: a.efc, actual: a.actual,
        overBy: Math.round((a.efc - a.revisedBudget) * 100) / 100,
      });
    }
    rows.sort((x, y) => y.overBy - x.overBy);
    return { currency: report.currency, rows };
  }

  // ── Unified project finance summary (the header strip shared across finance tabs) ──
  async financeSummary(projectId: string) {
    const report = await this.costReport(projectId);
    // cash position from the ledger (received income − paid costs)
    const txns = await this.prisma.projectTransaction.findMany({ where: { projectId }, select: { kind: true, status: true, total: true } });
    let incomeReceived = 0, costPaid = 0, incomeRecognised = 0;
    for (const t of txns) {
      const v = Number(t.total);
      if (t.kind === 'INCOME') {
        if (['INVOICED', 'RECEIVED', 'PAID', 'APPROVED'].includes(t.status)) incomeRecognised += v;
        if (['RECEIVED', 'PAID'].includes(t.status)) incomeReceived += v;
      } else if (t.kind === 'COST' && t.status === 'PAID') costPaid += v;
    }
    const t = report.totals;
    return {
      currency: report.currency,
      budget: t.budget, transfer: t.transfer, approvedChange: t.approvedChange, revisedBudget: t.revisedBudget,
      committed: t.committed, actual: t.actual, efc: t.efc, variance: t.variance,
      incomeRecognised, cashPosition: incomeReceived - costPaid,
      overBudget: t.variance < -0.01,
    };
  }
}
