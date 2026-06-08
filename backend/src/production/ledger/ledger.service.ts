import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FxService, BASE_CURRENCY } from '../../fx/fx.service';
import { WorkflowService } from '../../workflow/workflow.service';

const COST_ACTUAL = ['APPROVED', 'PAID'];
const INCOME_RECOGNISED = ['INVOICED', 'RECEIVED', 'PAID', 'APPROVED'];
const periodOf = (d: Date | string) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService, private fx: FxService, private workflow: WorkflowService) {}

  /** Submit a DRAFT project cost into its approval workflow (invoice/expense chain). */
  async submitForApproval(id: string, userId?: string) {
    const t = await this.prisma.projectTransaction.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Transaction not found');
    if (t.status !== 'DRAFT') throw new BadRequestException(`Only DRAFT entries can be submitted (this is ${t.status}).`);
    if (t.kind !== 'COST' && t.kind !== 'CORPORATE_OVERHEAD') throw new BadRequestException('Only cost entries route through approval.');
    const entityType = t.invoiceNumber ? 'INVOICE' : 'EXPENSE';
    return this.workflow.start({
      entityType, entityId: id, projectId: t.projectId,
      label: `${t.invoiceNumber || t.description || 'Cost'} · ${Number(t.total).toLocaleString()} ${t.currency}`,
    }, userId);
  }

  async list(projectId: string, query: { kind?: string; status?: string } = {}) {
    const where: any = { projectId };
    if (query.kind) where.kind = query.kind;
    if (query.status) where.status = query.status;
    return this.prisma.projectTransaction.findMany({ where, orderBy: { date: 'desc' } });
  }

  private computeTotals(items: any[]) {
    let income = 0, cost = 0, incomeReceived = 0, costPaid = 0;
    for (const t of items) {
      const v = Number(t.total);
      // SALES_REVENUE behaves like income; CORPORATE_OVERHEAD like cost (kept distinct for reporting)
      if (t.kind === 'INCOME' || t.kind === 'SALES_REVENUE') {
        if (INCOME_RECOGNISED.includes(t.status)) income += v;
        if (['RECEIVED', 'PAID'].includes(t.status)) incomeReceived += v;
      } else if (t.kind === 'COST' || t.kind === 'CORPORATE_OVERHEAD') {
        if (COST_ACTUAL.includes(t.status)) cost += v;
        if (t.status === 'PAID') costPaid += v;
      }
    }
    return { income, cost, net: income - cost, incomeReceived, costPaid, cashPosition: incomeReceived - costPaid };
  }

  async summary(projectId: string) {
    const project = await this.prisma.productionProject.findUnique({
      where: { id: projectId },
      include: { budgetVersions: { where: { isActive: true }, select: { id: true } } },
    });
    if (!project) throw new NotFoundException('Project not found');
    const items = await this.prisma.projectTransaction.findMany({ where: { projectId } });
    const totals = this.computeTotals(items);
    const budget = Number(project.totalBudget || 0);
    return {
      ...totals,
      budget,
      currency: project.currency,
      spentPct: budget > 0 ? Math.round((totals.cost / budget) * 100) : 0,
      marginPct: totals.income > 0 ? Math.round((totals.net / totals.income) * 100) : 0,
      count: items.length,
    };
  }

  /** Combined portfolio across all projects + per-project rollup (for the dashboard). */
  async portfolio() {
    const projects = await this.prisma.productionProject.findMany({
      include: { client: { select: { companyName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const txns = await this.prisma.projectTransaction.findMany();
    const byProject: Record<string, any[]> = {};
    for (const t of txns) (byProject[t.projectId] = byProject[t.projectId] || []).push(t);

    const rows = projects.map(p => {
      const totals = this.computeTotals(byProject[p.id] || []);
      const budget = Number(p.totalBudget || 0);
      return {
        id: p.id, projectNumber: p.projectNumber, title: p.title, status: p.status,
        projectType: p.projectType, currency: p.currency, client: p.client?.companyName || null,
        budget, income: totals.income, cost: totals.cost, net: totals.net,
        cashPosition: totals.cashPosition,
        spentPct: budget > 0 ? Math.round((totals.cost / budget) * 100) : 0,
      };
    });

    // Combined totals converted to the base reporting currency (handles mixed currencies)
    const fxRates = await this.fx.rates();
    const conv = (amt: number, cur: string) => (!cur || cur === BASE_CURRENCY) ? amt : amt * (fxRates[cur] ?? 1);
    const combined = rows.reduce((a, r) => ({
      budget: a.budget + conv(r.budget, r.currency), income: a.income + conv(r.income, r.currency), cost: a.cost + conv(r.cost, r.currency),
      net: a.net + conv(r.net, r.currency), cash: a.cash + conv(r.cashPosition, r.currency),
    }), { budget: 0, income: 0, cost: 0, net: 0, cash: 0 });
    (combined as any).currency = BASE_CURRENCY;

    const byStatus: Record<string, number> = {};
    for (const p of projects) byStatus[p.status] = (byStatus[p.status] || 0) + 1;

    return { projects: rows, combined, totalProjects: projects.length, byStatus };
  }

  /** Throw if the date falls in a closed accounting period. */
  private async assertOpen(projectId: string, date: Date | string) {
    const p = await this.prisma.accountingPeriod.findUnique({ where: { projectId_period: { projectId, period: periodOf(date) } } });
    if (p?.status === 'CLOSED') throw new BadRequestException(`Accounting period ${periodOf(date)} is closed. Reopen it to post or edit entries.`);
  }

  /**
   * Public Two-Ledger guard for OTHER modules creating commitments/actuals
   * (e.g. Travel, Contracts). Mirrors assertOpen so every financial impact
   * respects the same period lock. Use before writing a PurchaseOrder or
   * ProjectTransaction outside this service.
   */
  async assertPeriodOpen(projectId: string, date: Date | string) {
    return this.assertOpen(projectId, date);
  }

  /**
   * The single House/Corporate project that owns STANDALONE (project-less)
   * postings from Travel/Contracts/Casting. Seeded by seed-house-project.js.
   * Cached after first lookup.
   */
  private _houseProjectId: string | null = null;
  async getHouseProjectId(): Promise<string> {
    if (this._houseProjectId) return this._houseProjectId;
    const house = await this.prisma.productionProject.findFirst({ where: { isHouse: true }, select: { id: true } });
    if (!house) throw new BadRequestException('No House/Corporate project configured. Run: node prisma/seed-house-project.js');
    this._houseProjectId = house.id;
    return this._houseProjectId;
  }

  async create(data: any, userId?: string) {
    const amount = Number(data.amount) || 0;
    const tax = Number(data.taxAmount) || 0;
    const date = data.date ? new Date(data.date) : new Date();
    await this.assertOpen(data.projectId, date);
    return this.prisma.projectTransaction.create({
      data: {
        projectId: data.projectId,
        kind: data.kind,
        date,
        accountCode: data.accountCode || null,
        accountTitle: data.accountTitle || null,
        category: data.category || null,
        description: data.description || (data.kind === 'INCOME' ? 'Income' : 'Cost'),
        party: data.party || null,
        reference: data.reference || null,
        invoiceNumber: data.invoiceNumber || null,
        vendorId: data.vendorId || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        amount, taxAmount: tax, total: amount + tax,
        currency: data.currency || 'AED',
        status: data.status || 'DRAFT',
        createdById: userId || null,
      },
    });
  }

  async update(id: string, data: any) {
    const { id: _i, projectId, project, createdAt, updatedAt, ...rest } = data || {};
    const cur = await this.prisma.projectTransaction.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException();
    await this.assertOpen(cur.projectId, cur.date);
    if (rest.date) await this.assertOpen(cur.projectId, rest.date);
    if (rest.amount !== undefined || rest.taxAmount !== undefined) {
      const amount = rest.amount !== undefined ? Number(rest.amount) : Number(cur?.amount || 0);
      const tax = rest.taxAmount !== undefined ? Number(rest.taxAmount) : Number(cur?.taxAmount || 0);
      rest.total = amount + tax;
    }
    if (rest.date) rest.date = new Date(rest.date);
    if (rest.dueDate !== undefined) rest.dueDate = rest.dueDate ? new Date(rest.dueDate) : null;
    return this.prisma.projectTransaction.update({ where: { id }, data: rest });
  }

  async setStatus(id: string, status: string, userId?: string) {
    const cur = await this.prisma.projectTransaction.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException();
    const to = String(status).toUpperCase();
    // Status changes alter recognised actuals, so they respect the period lock.
    await this.assertOpen(cur.projectId, cur.date);

    // ── Accounting controls ──────────────────────────────────────────────────────
    // 1. Payments are RELEASED through the payment run (three-way-match + SoD gates),
    //    never by flipping status — so the controls can't be bypassed.
    if (to === 'PAID') throw new BadRequestException('Payments are released through the payment run (AP), not by changing status — this enforces the invoice-match and segregation-of-duties checks.');
    // 2. A COST becomes an APPROVED actual only through the approval workflow when one
    //    is configured (segregation of duties + audit trail). Manual approval is blocked
    //    where a workflow exists; small productions with no workflow keep manual approval.
    if (to === 'APPROVED' && (cur.kind === 'COST' || cur.kind === 'CORPORATE_OVERHEAD') && cur.status === 'DRAFT') {
      const wf = await this.prisma.workflowDefinition.findFirst({ where: { entityType: { in: ['INVOICE', 'EXPENSE'] }, isActive: true } });
      if (wf) throw new BadRequestException('Submit this cost for approval (it routes through the approval workflow) — manual approval is disabled while an approval workflow is active.');
      await this.prisma.projectTransaction.update({ where: { id }, data: { approvedById: userId || null } });
    }
    return this.prisma.projectTransaction.update({ where: { id }, data: { status: to as any } });
  }

  async remove(id: string) {
    const cur = await this.prisma.projectTransaction.findUnique({ where: { id } });
    if (cur) await this.assertOpen(cur.projectId, cur.date);
    return this.prisma.projectTransaction.delete({ where: { id } });
  }

  // ── Accounts Payable ────────────────────────────────────────────────────────────
  /** Open payables (approved, unpaid COSTs) with aging buckets by due date. */
  async apAging(projectId: string) {
    const items = await this.prisma.projectTransaction.findMany({
      where: { projectId, kind: 'COST', status: { in: ['APPROVED'] } },
      orderBy: { dueDate: 'asc' },
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 };
    const rows = items.map((t) => {
      const outstanding = Number(t.total) - Number(t.paidAmount || 0);
      const due = t.dueDate ? new Date(t.dueDate) : null;
      const overdueDays = due ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0;
      let bucket = 'current';
      if (overdueDays > 90) bucket = 'd90';
      else if (overdueDays > 60) bucket = 'd61_90';
      else if (overdueDays > 30) bucket = 'd31_60';
      else if (overdueDays > 0) bucket = 'd1_30';
      (buckets as any)[bucket] += outstanding;
      return {
        id: t.id, date: t.date, dueDate: t.dueDate, invoiceNumber: t.invoiceNumber,
        vendor: t.party, accountCode: t.accountCode, accountTitle: t.accountTitle,
        description: t.description, total: Number(t.total), paidAmount: Number(t.paidAmount || 0),
        outstanding, overdueDays: Math.max(0, overdueDays), bucket,
      };
    }).filter((r) => r.outstanding > 0.0001);
    const totalOpen = rows.reduce((s, r) => s + r.outstanding, 0);
    return { rows, buckets, totalOpen, count: rows.length, currency: (await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { currency: true } }))?.currency || 'AED' };
  }

  /** Mark selected payables as PAID (payment run). Full AP control gate. */
  async paySelected(projectId: string, ids: string[], paidDate?: string, releasedById?: string) {
    if (!ids?.length) throw new BadRequestException('No invoices selected.');
    const when = paidDate ? new Date(paidDate) : new Date();
    // ── Payment-release controls (accounting standard) ───────────────────────────
    //   a) APPROVED only (an unapproved cost can never be paid)
    //   b) vendor-invoice DETAILS present (invoice number)
    //   c) vendor invoice DOCUMENT attached  ← three-way evidence
    //   d) Segregation of duties: the releaser may NOT be the person who approved it
    const blocked: string[] = [];
    for (const id of ids) {
      const t = await this.prisma.projectTransaction.findUnique({ where: { id } });
      if (!t || t.projectId !== projectId || t.kind !== 'COST') continue;
      const label = t.description || id;
      if (t.status !== 'APPROVED') { blocked.push(`${label}: not APPROVED`); continue; }
      if (!(t.invoiceNumber && String(t.invoiceNumber).trim())) { blocked.push(`${label}: missing invoice number`); continue; }
      const docs = await this.prisma.projectDocument.count({ where: { projectId, entityType: 'TRANSACTION', entityId: id } }).catch(() => 0);
      if (docs === 0) { blocked.push(`${label}: no vendor invoice attached`); continue; }
      // SoD: who approved it (direct field, or the workflow approvers)?
      const approvers = new Set<string>();
      if ((t as any).approvedById) approvers.add((t as any).approvedById);
      const inst = await this.prisma.workflowInstance.findFirst({ where: { entityType: { in: ['INVOICE', 'EXPENSE'] }, entityId: id }, orderBy: { createdAt: 'desc' } });
      if (inst) { const acts = await this.prisma.approvalAction.findMany({ where: { instanceId: inst.id, action: 'APPROVED' }, select: { actorId: true } }); acts.forEach(a => a.actorId && approvers.add(a.actorId)); }
      if (releasedById && approvers.has(releasedById)) { blocked.push(`${label}: segregation of duties — you approved this, so you cannot release its payment`); continue; }
    }
    if (blocked.length) {
      throw new BadRequestException(`Cannot release payment — controls not met:\n• ${blocked.join('\n• ')}`);
    }

    let paid = 0; let totalPaid = 0;
    for (const id of ids) {
      const t = await this.prisma.projectTransaction.findUnique({ where: { id } });
      if (!t || t.projectId !== projectId || t.kind !== 'COST' || t.status !== 'APPROVED') continue;
      await this.assertOpen(projectId, when);
      await this.prisma.projectTransaction.update({ where: { id }, data: { status: 'PAID', paidDate: when, paidAmount: t.total, paidById: releasedById || null } });
      paid++; totalPaid += Number(t.total);
    }
    return { paid, totalPaid: Math.round(totalPaid * 100) / 100 };
  }

  /**
   * Disbursements register — every PAID cost with vendor, invoice details, who
   * released it, and the attached vendor-invoice documents. The audit/finance view.
   */
  async paidRegister(projectId: string, query: { from?: string; to?: string } = {}) {
    const where: any = { projectId, kind: 'COST', status: 'PAID' };
    if (query.from || query.to) {
      where.paidDate = {};
      if (query.from) where.paidDate.gte = new Date(query.from);
      if (query.to) where.paidDate.lte = new Date(query.to);
    }
    const items = await this.prisma.projectTransaction.findMany({ where, orderBy: { paidDate: 'desc' } });
    // resolve releaser + approver names and attachments in bulk
    const userIds = [...new Set(items.flatMap((t) => [t.paidById, (t as any).approvedById, t.createdById]).filter(Boolean) as string[])];
    const users = userIds.length ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
    const nameOf = (id?: string | null) => users.find((u) => u.id === id)?.fullName || null;
    const docs = await this.prisma.projectDocument.findMany({ where: { projectId, entityType: 'TRANSACTION', entityId: { in: items.map((t) => t.id) } }, select: { entityId: true, name: true, url: true, category: true } });
    const docsByTxn: Record<string, any[]> = {};
    for (const d of docs) (docsByTxn[d.entityId!] = docsByTxn[d.entityId!] || []).push({ name: d.name, url: d.url, category: d.category });

    const rows = items.map((t) => ({
      id: t.id, paidDate: t.paidDate, date: t.date,
      vendor: t.party, invoiceNumber: t.invoiceNumber, reference: t.reference,
      accountCode: t.accountCode, accountTitle: t.accountTitle, description: t.description,
      amount: Number(t.total), currency: t.currency,
      releasedBy: nameOf(t.paidById), approvedBy: nameOf((t as any).approvedById), enteredBy: nameOf(t.createdById),
      documents: docsByTxn[t.id] || [],
    }));
    return {
      rows, count: rows.length,
      total: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
      currency: (await this.prisma.productionProject.findUnique({ where: { id: projectId }, select: { currency: true } }))?.currency || 'AED',
    };
  }

  // ── Account ledger / cost coding drill-down ──────────────────────────────────────
  /** Group transactions by budget account code → totals + uncoded flag. */
  async byAccount(projectId: string) {
    const items = await this.prisma.projectTransaction.findMany({ where: { projectId, kind: 'COST' } });
    const groups: Record<string, any> = {};
    let uncoded = 0;
    for (const t of items) {
      const actual = COST_ACTUAL.includes(t.status) ? Number(t.total) : 0;
      const code = t.accountCode || '__uncoded__';
      if (code === '__uncoded__' && actual > 0) uncoded += actual;
      const g = (groups[code] = groups[code] || { code: t.accountCode || null, title: t.accountTitle || null, actual: 0, count: 0 });
      g.actual += actual; g.count++;
    }
    return { accounts: Object.values(groups).sort((a: any, b: any) => String(a.code).localeCompare(String(b.code))), uncoded };
  }

  /** Transactions behind a single account code (the drill-down). */
  accountLedger(projectId: string, code: string) {
    const where: any = { projectId, kind: 'COST' };
    if (code === '__uncoded__') where.accountCode = null; else where.accountCode = code;
    return this.prisma.projectTransaction.findMany({ where, orderBy: { date: 'desc' } });
  }

  // ── Period close ──────────────────────────────────────────────────────────────────
  listPeriods(projectId: string) {
    return this.prisma.accountingPeriod.findMany({ where: { projectId }, orderBy: { period: 'desc' } });
  }
  async setPeriod(projectId: string, period: string, status: 'OPEN' | 'CLOSED', userId?: string) {
    if (!/^\d{4}-\d{2}$/.test(period || '')) throw new BadRequestException('Period must be YYYY-MM.');
    return this.prisma.accountingPeriod.upsert({
      where: { projectId_period: { projectId, period } },
      update: { status, closedAt: status === 'CLOSED' ? new Date() : null, closedBy: status === 'CLOSED' ? (userId || null) : null },
      create: { projectId, period, status, closedAt: status === 'CLOSED' ? new Date() : null, closedBy: status === 'CLOSED' ? (userId || null) : null },
    });
  }

  // ── Reports: GL by account (account ledger summary) ────────────────────────────────
  async glByAccount(projectId: string) {
    const items = await this.prisma.projectTransaction.findMany({ where: { projectId }, orderBy: [{ accountCode: 'asc' }, { date: 'asc' }] });
    const groups: Record<string, any> = {};
    for (const t of items) {
      const code = t.accountCode || (t.kind === 'INCOME' ? '__income__' : '__uncoded__');
      const g = (groups[code] = groups[code] || { code: t.accountCode || null, title: t.accountTitle || (t.kind === 'INCOME' ? 'Income' : 'Uncoded'), debit: 0, credit: 0, lines: [] });
      const v = Number(t.total);
      if (t.kind === 'COST') g.debit += COST_ACTUAL.includes(t.status) ? v : 0;
      else g.credit += INCOME_RECOGNISED.includes(t.status) ? v : 0;
      g.lines.push({ date: t.date, description: t.description, party: t.party, status: t.status, kind: t.kind, total: v });
    }
    return { accounts: Object.values(groups) };
  }
}
