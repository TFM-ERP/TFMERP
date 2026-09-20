import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { REVENUE_LINES, POSTABLE_INVOICE_STATUSES } from '../accounting/revenue-mapping.util';
import { buildRevenueMatrix, reconcile, toReportRows, MatrixInvoice } from './revenue-matrix.util';
import { arSettlementNotice, collectArSettlementFacts } from '../accounting/ar-settlement-notice.util';

type Col = { key: string; label: string; align?: 'left' | 'right' | 'center'; format?: 'currency' | 'number' | 'date' | 'text' };
type Report = { key: string; title: string; columns: Col[]; rows: any[]; totals?: any; period?: { from: string; to: string }; notice?: any };

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  catalog() {
    return [
      // Financial
      { key: 'pl', name: 'Profit & Loss', category: 'Financial', dateRange: true },
      { key: 'revenue-by-client', name: 'Revenue by Client', category: 'Financial', dateRange: true },
      { key: 'revenue-matrix', name: 'Revenue Matrix (client x revenue line)', category: 'Financial', dateRange: true },
      { key: 'expenses-by-category', name: 'Expenses by Category', category: 'Financial', dateRange: true },
      { key: 'payments-received', name: 'Payments Received', category: 'Financial', dateRange: true },
      { key: 'cash-flow', name: 'Cash Flow (monthly)', category: 'Financial', dateRange: true },
      { key: 'ar-aging', name: 'Receivables Aging', category: 'Financial', dateRange: false },
      { key: 'supplier-spend', name: 'Supplier Spend', category: 'Financial', dateRange: true },
      { key: 'vat-detail', name: 'VAT Detail (output & input)', category: 'Financial', dateRange: true },
      { key: 'profitability-by-booking', name: 'Profitability by Booking', category: 'Financial', dateRange: true },
      // Rental
      { key: 'fleet-register', name: 'Fleet / Asset Register', category: 'Rental', dateRange: false },
      { key: 'booking-revenue', name: 'Booking Revenue', category: 'Rental', dateRange: true },
      { key: 'fuel-by-asset', name: 'Fuel Cost by Asset', category: 'Rental', dateRange: true },
      { key: 'maintenance-cost', name: 'Maintenance Cost by Asset', category: 'Rental', dateRange: true },
      { key: 'damage-log', name: 'Damage Reports Log', category: 'Rental', dateRange: true },
      { key: 'incident-log', name: 'Incident Log', category: 'Rental', dateRange: true },
      { key: 'driver-jobs', name: 'Driver Job Log', category: 'Rental', dateRange: true },
      { key: 'driver-payouts', name: 'Driver Payouts', category: 'Rental', dateRange: false },
      { key: 'parts-cost', name: 'Spare Parts & Tyres Cost', category: 'Rental', dateRange: false },
      // HR
      { key: 'employee-directory', name: 'Employee Directory', category: 'HR', dateRange: false },
      { key: 'payroll-summary', name: 'Payroll Summary (latest run)', category: 'HR', dateRange: false },
      { key: 'leave-summary', name: 'Leave Requests', category: 'HR', dateRange: true },
      { key: 'attendance-summary', name: 'Attendance Summary', category: 'HR', dateRange: true },
    ];
  }

  async run(key: string, q: any): Promise<Report> {
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getFullYear(), 0, 1);
    const period = { from: from.toISOString(), to: to.toISOString() };
    const map: Record<string, () => Promise<Report>> = {
      'pl': () => this.pl(from, to, period),
      'revenue-by-client': () => this.revenueByClient(from, to, period),
      'revenue-matrix': () => this.revenueMatrix(from, to, period),
      'expenses-by-category': () => this.expensesByCategory(from, to, period),
      'payments-received': () => this.paymentsReceived(from, to, period),
      'cash-flow': () => this.cashFlow(from, to, period),
      'ar-aging': () => this.arAging(),
      'supplier-spend': () => this.supplierSpend(from, to, period),
      'vat-detail': () => this.vatDetail(from, to, period),
      'profitability-by-booking': () => this.profitabilityByBooking(from, to, period),
      'fleet-register': () => this.fleetRegister(),
      'booking-revenue': () => this.bookingRevenue(from, to, period),
      'fuel-by-asset': () => this.fuelByAsset(from, to, period),
      'maintenance-cost': () => this.maintenanceCost(from, to, period),
      'damage-log': () => this.damageLog(from, to, period),
      'incident-log': () => this.incidentLog(from, to, period),
      'driver-jobs': () => this.driverJobs(from, to, period),
      'driver-payouts': () => this.driverPayouts(),
      'parts-cost': () => this.partsCost(),
      'employee-directory': () => this.employeeDirectory(),
      'payroll-summary': () => this.payrollSummary(),
      'leave-summary': () => this.leaveSummary(from, to, period),
      'attendance-summary': () => this.attendanceSummary(from, to, period),
    };
    if (!map[key]) throw new BadRequestException(`Unknown report: ${key}`);
    return map[key]();
  }

  // ── Financial ──
  private async pl(from: Date, to: Date, period: any): Promise<Report> {
    const [inv, exp] = await Promise.all([
      this.prisma.invoice.aggregate({ where: { issueDate: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT'] as any } }, _sum: { total: true, vatAmount: true } }),
      this.prisma.expense.groupBy({ by: ['category'], where: { expenseDate: { gte: from, lte: to }, status: { in: ['APPROVED', 'PAID'] as any } }, _sum: { totalAmount: true } }),
    ]);
    const revenue = Number(inv._sum.total || 0);
    const rows: any[] = [{ label: 'Revenue (invoiced)', amount: revenue }];
    let expTotal = 0;
    exp.forEach(e => { const v = Number(e._sum.totalAmount || 0); expTotal += v; rows.push({ label: `Expense — ${e.category}`, amount: -v }); });
    const net = revenue - expTotal;
    return {
      key: 'pl', title: 'Profit & Loss', period,
      columns: [{ key: 'label', label: 'Item' }, { key: 'amount', label: 'Amount', align: 'right', format: 'currency' }],
      rows, totals: { 'Total expenses': -expTotal, 'Net profit / (loss)': net },
    };
  }

  /**
   * Revenue by client, NET of VAT.
   *
   * Was summing `Invoice.total`, which is VAT-inclusive — every client was
   * overstated by the VAT rate (5% on standard-rated sales). Revenue is
   * `total - vatAmount`, which is also exactly what `postAll()` credits to the
   * revenue accounts, so this column now ties to the general ledger.
   *
   * `total - vatAmount` is used rather than `subtotal` deliberately: `subtotal`
   * is struck before `discountAmount` and `deductionAmount`, so the two diverge
   * on any discounted invoice. They coincide today only because every discount
   * and deduction in the data is zero.
   *
   * Arithmetic stays on Prisma.Decimal and converts to number once, at the
   * response boundary, because the Report row shape is JSON.
   *
   * Note: the status filter here (`notIn CANCELLED, VOIDED, DRAFT`) is WIDER
   * than the one `postAll()` posts on (`in SENT, PARTIALLY_PAID, PAID,
   * OVERDUE`) — it also admits PENDING_APPROVAL, REFUNDED and BAD_DEBT. This
   * report therefore need not equal GL revenue. Left as-is: narrowing it
   * changes which invoices appear, which is a separate decision from the VAT
   * defect.
   */
  private async revenueByClient(from: Date, to: Date, period: any): Promise<Report> {
    const grp = await this.prisma.invoice.groupBy({ by: ['clientId'], where: { issueDate: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT'] as any } }, _sum: { total: true, vatAmount: true, amountDue: true }, _count: { _all: true } });
    const clients = await this.prisma.client.findMany({ where: { id: { in: grp.map(g => g.clientId) } }, select: { id: true, companyName: true } });
    const cmap = Object.fromEntries(clients.map(c => [c.id, c.companyName]));
    const D = Prisma.Decimal;
    const rows = grp.map(g => {
      const net = new D(g._sum.total ?? 0).minus(new D(g._sum.vatAmount ?? 0));
      return { client: cmap[g.clientId] || '—', invoices: g._count._all, _net: net, _due: new D(g._sum.amountDue ?? 0) };
    }).sort((a, b) => b._net.comparedTo(a._net));
    const netTotal = rows.reduce((s, r) => s.plus(r._net), new D(0));
    const dueTotal = rows.reduce((s, r) => s.plus(r._due), new D(0));
    return {
      key: 'revenue-by-client', title: 'Revenue by Client (net of VAT)', period,
      columns: [{ key: 'client', label: 'Client' }, { key: 'invoices', label: 'Invoices', align: 'right', format: 'number' }, { key: 'invoiced', label: 'Revenue (excl. VAT)', align: 'right', format: 'currency' }, { key: 'outstanding', label: 'Outstanding (incl. VAT)', align: 'right', format: 'currency' }],
      rows: rows.map(r => ({ client: r.client, invoices: r.invoices, invoiced: r._net.toNumber(), outstanding: r._due.toNumber() })),
      totals: { 'Revenue (excl. VAT)': netTotal.toNumber(), 'Outstanding (incl. VAT)': dueTotal.toNumber() },
    };
  }

  /**
   * Revenue matrix — client (rows) x GL revenue line (columns), net of VAT.
   * Contract: src/reports/revenue-matrix.contract.md
   *
   * Reads Invoice (Layer A), never JournalLine — the ledger gains no client
   * dimension. The two are tied together by the invariant instead: the grand
   * total must equal GL revenue for the same period, to the fils. If it does
   * not, the report says so in a variance row rather than appearing to balance.
   */
  private async revenueMatrix(from: Date, to: Date, period: any): Promise<Report> {
    const invoices = await this.prisma.invoice.findMany({
      where: { issueDate: { gte: from, lte: to }, status: { in: POSTABLE_INVOICE_STATUSES as any } },
      select: {
        id: true, clientId: true, activity: true, invoiceType: true, total: true, vatAmount: true,
        client: { select: { companyName: true } },
      },
      // Deterministic: a report whose row order shifts between runs cannot be diffed.
      orderBy: [{ issueDate: 'asc' }, { id: 'asc' }],
    });

    const input: MatrixInvoice[] = invoices.map(i => ({
      clientId: i.clientId,
      clientName: (i as any).client?.companyName || '—',
      activity: i.activity as any,
      invoiceType: i.invoiceType as any,
      total: i.total as any,
      vatAmount: i.vatAmount as any,
    }));
    const matrix = buildRevenueMatrix(input);

    // GL revenue for the same window, from POSTED entries only.
    const glLines = await this.prisma.journalLine.findMany({
      where: {
        account: { type: 'INCOME' as any },
        entry: { status: 'POSTED' as any, date: { gte: from, lte: to } },
      },
      select: { debit: true, credit: true },
    });
    const glRevenue = glLines.reduce(
      (s, l) => s.plus(new Prisma.Decimal(l.credit as any)).minus(new Prisma.Decimal(l.debit as any)),
      new Prisma.Decimal(0),
    );
    const check = reconcile(matrix, glRevenue);
    const unpostedInvoices = await this.prisma.invoice.count({
      where: {
        issueDate: { gte: from, lte: to }, status: { in: POSTABLE_INVOICE_STATUSES as any },
        NOT: { id: { in: (await this.prisma.journalEntry.findMany({
          where: { sourceType: 'INVOICE' }, select: { sourceId: true },
        })).map(e => e.sourceId as string) } },
      },
    });

    const rows: any[] = toReportRows(matrix);
    if (!rows.length) rows.push({ client: 'No invoices for this period', invoices: 0, total: 0 });

    return {
      key: 'revenue-matrix', title: 'Revenue Matrix — client x revenue line (net of VAT)', period,
      columns: [
        { key: 'client', label: 'Client' },
        { key: 'invoices', label: 'Invoices', align: 'right', format: 'number' },
        ...REVENUE_LINES.map(l => ({ key: l.code, label: l.label, align: 'right' as const, format: 'currency' as const })),
        { key: 'total', label: 'Total (excl. VAT)', align: 'right', format: 'currency' },
      ],
      rows,
      totals: {
        ...REVENUE_LINES.reduce((o, l) => ({ ...o, [l.label]: matrix.columnTotals[l.code].toNumber() }), {}),
        'Total (excl. VAT)': matrix.grandTotal.toNumber(),
        'GL revenue (same period)': check.glRevenue.toNumber(),
        // Surfaced, never plugged. A non-zero variance means posting is incomplete
        // or a mapping changed without a re-post.
        ...(check.reconciled ? {} : {
          'VARIANCE — does not reconcile': check.variance.toNumber(),
          'Unposted invoices in period': unpostedInvoices,
        }),
      },
    };
  }

  private async expensesByCategory(from: Date, to: Date, period: any): Promise<Report> {
    const grp = await this.prisma.expense.groupBy({ by: ['category'], where: { expenseDate: { gte: from, lte: to }, status: { in: ['APPROVED', 'PAID'] as any } }, _sum: { totalAmount: true }, _count: { _all: true } });
    const rows = grp.map(g => ({ category: g.category, count: g._count._all, amount: Number(g._sum.totalAmount || 0) })).sort((a, b) => b.amount - a.amount);
    return {
      key: 'expenses-by-category', title: 'Expenses by Category', period,
      columns: [{ key: 'category', label: 'Category' }, { key: 'count', label: 'Count', align: 'right', format: 'number' }, { key: 'amount', label: 'Amount', align: 'right', format: 'currency' }],
      rows, totals: { Total: rows.reduce((s, r) => s + r.amount, 0) },
    };
  }

  private async paymentsReceived(from: Date, to: Date, period: any): Promise<Report> {
    const pays = await this.prisma.payment.findMany({ where: { direction: 'RECEIPT', paymentDate: { gte: from, lte: to } }, include: { client: { select: { companyName: true } } }, orderBy: { paymentDate: 'desc' } });
    const rows = pays.map(p => ({ date: p.paymentDate, ref: p.paymentNumber, client: (p as any).client?.companyName || '—', method: p.method, status: p.status, amount: Number(p.amount) }));
    return {
      key: 'payments-received', title: 'Payments Received', period,
      columns: [{ key: 'date', label: 'Date', format: 'date' }, { key: 'ref', label: 'Receipt' }, { key: 'client', label: 'Client' }, { key: 'method', label: 'Method' }, { key: 'status', label: 'Status' }, { key: 'amount', label: 'Amount', align: 'right', format: 'currency' }],
      rows, totals: { Total: rows.reduce((s, r) => s + r.amount, 0) },
    };
  }

  private async cashFlow(from: Date, to: Date, period: any): Promise<Report> {
    const [pays, exps] = await Promise.all([
      this.prisma.payment.findMany({ where: { direction: 'RECEIPT', paymentDate: { gte: from, lte: to } }, select: { paymentDate: true, amount: true } }),
      this.prisma.expense.findMany({ where: { expenseDate: { gte: from, lte: to }, status: { in: ['APPROVED', 'PAID'] as any } }, select: { expenseDate: true, totalAmount: true } }),
    ]);
    const m: Record<string, { inflow: number; outflow: number }> = {};
    const mk = (d: any) => `${new Date(d).getFullYear()}-${String(new Date(d).getMonth() + 1).padStart(2, '0')}`;
    pays.forEach(p => { const k = mk(p.paymentDate); (m[k] = m[k] || { inflow: 0, outflow: 0 }).inflow += Number(p.amount); });
    exps.forEach(e => { const k = mk(e.expenseDate); (m[k] = m[k] || { inflow: 0, outflow: 0 }).outflow += Number(e.totalAmount); });
    const rows = Object.keys(m).sort().map(k => ({ month: k, inflow: m[k].inflow, outflow: m[k].outflow, net: m[k].inflow - m[k].outflow }));
    return {
      key: 'cash-flow', title: 'Cash Flow (monthly)', period,
      columns: [{ key: 'month', label: 'Month' }, { key: 'inflow', label: 'Inflow', align: 'right', format: 'currency' }, { key: 'outflow', label: 'Outflow', align: 'right', format: 'currency' }, { key: 'net', label: 'Net', align: 'right', format: 'currency' }],
      rows, totals: { Inflow: rows.reduce((s, r) => s + r.inflow, 0), Outflow: rows.reduce((s, r) => s + r.outflow, 0), Net: rows.reduce((s, r) => s + r.net, 0) },
    };
  }

  private async arAging(): Promise<Report> {
    const inv = await this.prisma.invoice.findMany({ where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] as any } }, include: { client: { select: { companyName: true } } } });
    const now = Date.now();
    const rows = inv.map(i => {
      const d = i.dueDate ? Math.floor((now - new Date(i.dueDate).getTime()) / 86_400_000) : 0;
      return { invoice: i.invoiceNumber, client: (i as any).client?.companyName || '—', due: i.dueDate, daysOverdue: d, amount: Number(i.amountDue) };
    }).sort((a, b) => b.daysOverdue - a.daysOverdue);
    return {
      key: 'ar-aging', title: 'Receivables Aging',
      columns: [{ key: 'invoice', label: 'Invoice' }, { key: 'client', label: 'Client' }, { key: 'due', label: 'Due', format: 'date' }, { key: 'daysOverdue', label: 'Days overdue', align: 'right', format: 'number' }, { key: 'amount', label: 'Amount due', align: 'right', format: 'currency' }],
      rows,
      totals: { 'Total outstanding': rows.reduce((s, r) => s + r.amount, 0) },
      // Ageing reads Invoice.amountDue, which reflects settlement recorded on the
      // invoice. That is not the same as cash posted to the ledger — see the util.
      notice: await this.arSettlementNotice(rows.reduce((s, r) => s + r.amount, 0)),
    };
  }

  /** Shared receivables caveat — see ar-settlement-notice.util for what it detects. */
  private async arSettlementNotice(subLedgerOpen: number) {
    return arSettlementNotice(await collectArSettlementFacts(this.prisma as any, subLedgerOpen));
  }

  // ── Rental ──
  private async fleetRegister(): Promise<Report> {
    const assets = await this.prisma.asset.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    const rows = assets.map(a => ({ name: a.name, type: String(a.assetType).replace(/_/g, ' '), plate: a.plateNumber || a.serialNumber || '—', status: a.status, value: Number(a.currentValue || a.purchaseValue || 0), registration: a.registrationExpiry, insurance: a.insuranceExpiry }));
    return {
      key: 'fleet-register', title: 'Fleet / Asset Register',
      columns: [{ key: 'name', label: 'Asset' }, { key: 'type', label: 'Type' }, { key: 'plate', label: 'Plate / Serial' }, { key: 'status', label: 'Status' }, { key: 'value', label: 'Value', align: 'right', format: 'currency' }, { key: 'registration', label: 'Reg. expiry', format: 'date' }, { key: 'insurance', label: 'Insurance', format: 'date' }],
      rows, totals: { 'Fleet value': rows.reduce((s, r) => s + r.value, 0), Assets: rows.length },
    };
  }

  private async bookingRevenue(from: Date, to: Date, period: any): Promise<Report> {
    const bk = await this.prisma.rentalBooking.findMany({ where: { startDate: { lte: to }, endDate: { gte: from }, status: { notIn: ['CANCELLED'] as any } }, include: { client: { select: { companyName: true } } }, orderBy: { startDate: 'desc' } });
    const rows = bk.map(b => ({ ref: b.bookingNumber, client: (b as any).client?.companyName || '—', start: b.startDate, end: b.endDate, status: b.status, total: Number(b.total) }));
    return {
      key: 'booking-revenue', title: 'Booking Revenue', period,
      columns: [{ key: 'ref', label: 'Booking' }, { key: 'client', label: 'Client' }, { key: 'start', label: 'Start', format: 'date' }, { key: 'end', label: 'End', format: 'date' }, { key: 'status', label: 'Status' }, { key: 'total', label: 'Total', align: 'right', format: 'currency' }],
      rows, totals: { Total: rows.reduce((s, r) => s + r.total, 0), Bookings: rows.length },
    };
  }

  private async fuelByAsset(from: Date, to: Date, period: any): Promise<Report> {
    const grp = await this.prisma.fuelLog.groupBy({ by: ['assetId'], where: { logDate: { gte: from, lte: to } }, _sum: { litres: true, totalCost: true }, _count: { _all: true } });
    const assets = await this.prisma.asset.findMany({ where: { id: { in: grp.map(g => g.assetId) } }, select: { id: true, name: true } });
    const amap = Object.fromEntries(assets.map(a => [a.id, a.name]));
    const rows = grp.map(g => ({ asset: amap[g.assetId] || '—', fills: g._count._all, litres: Number(g._sum.litres || 0), cost: Number(g._sum.totalCost || 0) })).sort((a, b) => b.cost - a.cost);
    return {
      key: 'fuel-by-asset', title: 'Fuel Cost by Asset', period,
      columns: [{ key: 'asset', label: 'Asset' }, { key: 'fills', label: 'Fills', align: 'right', format: 'number' }, { key: 'litres', label: 'Litres', align: 'right', format: 'number' }, { key: 'cost', label: 'Cost', align: 'right', format: 'currency' }],
      rows, totals: { Litres: rows.reduce((s, r) => s + r.litres, 0), Cost: rows.reduce((s, r) => s + r.cost, 0) },
    };
  }

  // ── HR ──
  private async employeeDirectory(): Promise<Report> {
    const emps = await this.prisma.employee.findMany({ orderBy: { firstName: 'asc' } });
    const rows = emps.map((e: any) => ({ name: e.displayName || [e.firstName, e.lastName].filter(Boolean).join(' '), department: e.department || '—', position: e.position || '—', type: e.employmentType, status: e.status, joined: e.joiningDate }));
    return {
      key: 'employee-directory', title: 'Employee Directory',
      columns: [{ key: 'name', label: 'Name' }, { key: 'department', label: 'Department' }, { key: 'position', label: 'Position' }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'joined', label: 'Joined', format: 'date' }],
      rows, totals: { Headcount: rows.length },
    };
  }

  private async payrollSummary(): Promise<Report> {
    const run = await this.prisma.payrollRun.findFirst({ orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }], include: { payslips: { orderBy: { employeeName: 'asc' } } } });
    const rows = (run?.payslips || []).map((p: any) => ({ employee: p.employeeName, basic: p.basicSalary, allowances: p.allowances, additions: p.overtimePay, deductions: p.deductions, net: p.netPay }));
    return {
      key: 'payroll-summary', title: `Payroll Summary${run ? ` — ${run.reference}` : ''}`,
      columns: [{ key: 'employee', label: 'Employee' }, { key: 'basic', label: 'Basic', align: 'right', format: 'currency' }, { key: 'allowances', label: 'Allowances', align: 'right', format: 'currency' }, { key: 'additions', label: 'Additions', align: 'right', format: 'currency' }, { key: 'deductions', label: 'Deductions', align: 'right', format: 'currency' }, { key: 'net', label: 'Net pay', align: 'right', format: 'currency' }],
      rows, totals: { 'Net total': rows.reduce((s, r) => s + Number(r.net || 0), 0) },
    };
  }

  private async leaveSummary(from: Date, to: Date, period: any): Promise<Report> {
    const lv = await this.prisma.leaveRequest.findMany({ where: { startDate: { lte: to }, endDate: { gte: from } }, include: { employee: { select: { displayName: true, firstName: true, lastName: true } } }, orderBy: { startDate: 'desc' } });
    const rows = lv.map((l: any) => ({ employee: l.employee?.displayName || [l.employee?.firstName, l.employee?.lastName].filter(Boolean).join(' '), type: l.type, start: l.startDate, end: l.endDate, days: l.days, status: l.status }));
    return {
      key: 'leave-summary', title: 'Leave Requests', period,
      columns: [{ key: 'employee', label: 'Employee' }, { key: 'type', label: 'Type' }, { key: 'start', label: 'From', format: 'date' }, { key: 'end', label: 'To', format: 'date' }, { key: 'days', label: 'Days', align: 'right', format: 'number' }, { key: 'status', label: 'Status' }],
      rows, totals: { 'Total days': rows.reduce((s, r) => s + Number(r.days || 0), 0) },
    };
  }

  // ── Additional financial ──
  private async supplierSpend(from: Date, to: Date, period: any): Promise<Report> {
    const exps = await this.prisma.expense.findMany({ where: { expenseDate: { gte: from, lte: to }, status: { in: ['APPROVED', 'PAID'] as any } }, include: { supplier: { select: { name: true } } } });
    const m: Record<string, { count: number; amount: number }> = {};
    for (const e of exps) { const name = (e as any).supplier?.name || e.vendorName || 'Unspecified'; (m[name] = m[name] || { count: 0, amount: 0 }); m[name].count++; m[name].amount += Number(e.totalAmount); }
    const rows = Object.entries(m).map(([supplier, v]) => ({ supplier, count: v.count, amount: v.amount })).sort((a, b) => b.amount - a.amount);
    return {
      key: 'supplier-spend', title: 'Supplier Spend', period,
      columns: [{ key: 'supplier', label: 'Supplier' }, { key: 'count', label: 'Bills', align: 'right', format: 'number' }, { key: 'amount', label: 'Spend', align: 'right', format: 'currency' }],
      rows, totals: { Total: rows.reduce((s, r) => s + r.amount, 0) },
    };
  }

  private async vatDetail(from: Date, to: Date, period: any): Promise<Report> {
    const [inv, exp] = await Promise.all([
      this.prisma.invoice.findMany({ where: { issueDate: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT'] as any } }, include: { client: { select: { companyName: true } } }, orderBy: { issueDate: 'asc' } }),
      this.prisma.expense.aggregate({ where: { expenseDate: { gte: from, lte: to }, status: { in: ['APPROVED', 'PAID'] as any } }, _sum: { vatAmount: true } }),
    ]);
    const rows = inv.map(i => ({ date: i.issueDate, ref: i.invoiceNumber, client: (i as any).client?.companyName || '—', net: Number(i.subtotal), vat: Number(i.vatAmount) }));
    const outputVat = rows.reduce((s, r) => s + r.vat, 0);
    const inputVat = Number(exp._sum.vatAmount || 0);
    return {
      key: 'vat-detail', title: 'VAT Detail (output supplies)', period,
      columns: [{ key: 'date', label: 'Date', format: 'date' }, { key: 'ref', label: 'Invoice' }, { key: 'client', label: 'Client' }, { key: 'net', label: 'Net', align: 'right', format: 'currency' }, { key: 'vat', label: 'Output VAT', align: 'right', format: 'currency' }],
      rows, totals: { 'Output VAT': outputVat, 'Input VAT (expenses)': inputVat, 'Net VAT payable': outputVat - inputVat },
    };
  }

  private async profitabilityByBooking(from: Date, to: Date, period: any): Promise<Report> {
    const bookings = await this.prisma.rentalBooking.findMany({ where: { startDate: { lte: to }, endDate: { gte: from }, status: { notIn: ['CANCELLED'] as any } }, include: { client: { select: { companyName: true } } } });
    const ids = bookings.map(b => b.id);
    const [jobs, fuel] = await Promise.all([
      this.prisma.driverJob.findMany({ where: { bookingId: { in: ids } }, select: { bookingId: true, fuelExpense: true, tollExpense: true, parkingExpense: true, foodAllowance: true, otherExpense: true, bonusAmount: true } }),
      this.prisma.fuelLog.findMany({ where: { bookingRef: { in: ids } }, select: { bookingRef: true, totalCost: true } }),
    ]);
    const costByBk: Record<string, number> = {};
    for (const j of jobs) { const c = ['fuelExpense', 'tollExpense', 'parkingExpense', 'foodAllowance', 'otherExpense', 'bonusAmount'].reduce((s, k) => s + Number((j as any)[k] || 0), 0); costByBk[j.bookingId!] = (costByBk[j.bookingId!] || 0) + c; }
    for (const f of fuel) { if (f.bookingRef) costByBk[f.bookingRef] = (costByBk[f.bookingRef] || 0) + Number(f.totalCost); }
    const rows = bookings.map(b => { const rev = Number(b.total); const cost = costByBk[b.id] || 0; return { ref: b.bookingNumber, client: (b as any).client?.companyName || '—', revenue: rev, cost, margin: rev - cost }; }).sort((a, b) => b.margin - a.margin);
    return {
      key: 'profitability-by-booking', title: 'Profitability by Booking', period,
      columns: [{ key: 'ref', label: 'Booking' }, { key: 'client', label: 'Client' }, { key: 'revenue', label: 'Revenue', align: 'right', format: 'currency' }, { key: 'cost', label: 'Direct cost', align: 'right', format: 'currency' }, { key: 'margin', label: 'Margin', align: 'right', format: 'currency' }],
      rows, totals: { Revenue: rows.reduce((s, r) => s + r.revenue, 0), 'Direct cost': rows.reduce((s, r) => s + r.cost, 0), Margin: rows.reduce((s, r) => s + r.margin, 0) },
    };
  }

  // ── Additional rental ──
  private async maintenanceCost(from: Date, to: Date, period: any): Promise<Report> {
    const logs = await this.prisma.maintenanceLog.findMany({ where: { scheduledDate: { gte: from, lte: to } }, include: { asset: { select: { name: true } } } });
    const m: Record<string, { count: number; cost: number }> = {};
    for (const l of logs) { const n = (l as any).asset?.name || '—'; (m[n] = m[n] || { count: 0, cost: 0 }); m[n].count++; m[n].cost += Number(l.cost || 0); }
    const rows = Object.entries(m).map(([asset, v]) => ({ asset, jobs: v.count, cost: v.cost })).sort((a, b) => b.cost - a.cost);
    return {
      key: 'maintenance-cost', title: 'Maintenance Cost by Asset', period,
      columns: [{ key: 'asset', label: 'Asset' }, { key: 'jobs', label: 'Jobs', align: 'right', format: 'number' }, { key: 'cost', label: 'Cost', align: 'right', format: 'currency' }],
      rows, totals: { Total: rows.reduce((s, r) => s + r.cost, 0) },
    };
  }

  private async damageLog(from: Date, to: Date, period: any): Promise<Report> {
    const dr = await this.prisma.damageReport.findMany({ where: { reportedAt: { gte: from, lte: to } }, include: { asset: { select: { name: true } } }, orderBy: { reportedAt: 'desc' } });
    const rows = dr.map(d => ({ ref: d.reportNumber, asset: (d as any).asset?.name || '—', severity: d.severity, date: d.reportedAt, cost: Number(d.repairCost || 0), resolved: d.resolvedAt ? 'Yes' : 'No' }));
    return {
      key: 'damage-log', title: 'Damage Reports Log', period,
      columns: [{ key: 'ref', label: 'Report' }, { key: 'asset', label: 'Asset' }, { key: 'severity', label: 'Severity' }, { key: 'date', label: 'Date', format: 'date' }, { key: 'cost', label: 'Repair cost', align: 'right', format: 'currency' }, { key: 'resolved', label: 'Resolved' }],
      rows, totals: { 'Repair cost': rows.reduce((s, r) => s + r.cost, 0), Reports: rows.length },
    };
  }

  private async incidentLog(from: Date, to: Date, period: any): Promise<Report> {
    const inc = await this.prisma.incidentReport.findMany({ where: { occurredAt: { gte: from, lte: to } }, include: { asset: { select: { name: true } }, driver: { select: { fullName: true } } }, orderBy: { occurredAt: 'desc' } });
    const rows = inc.map(i => ({ ref: i.incidentNumber, type: String(i.incidentType).replace(/_/g, ' '), urgency: i.urgency, asset: (i as any).asset?.name || '—', driver: (i as any).driver?.fullName || '—', date: i.occurredAt, status: i.status }));
    return {
      key: 'incident-log', title: 'Incident Log', period,
      columns: [{ key: 'ref', label: 'Incident' }, { key: 'type', label: 'Type' }, { key: 'urgency', label: 'Urgency' }, { key: 'asset', label: 'Asset' }, { key: 'driver', label: 'Driver' }, { key: 'date', label: 'Date', format: 'date' }, { key: 'status', label: 'Status' }],
      rows, totals: { Incidents: rows.length },
    };
  }

  private async driverJobs(from: Date, to: Date, period: any): Promise<Report> {
    const jobs = await this.prisma.driverJob.findMany({ where: { scheduledAt: { gte: from, lte: to } }, include: { driver: { select: { fullName: true } }, booking: { select: { bookingNumber: true } } }, orderBy: { scheduledAt: 'desc' } });
    const rows = jobs.map(j => ({ driver: (j as any).driver?.fullName || '—', type: j.jobType, booking: (j as any).booking?.bookingNumber || '—', date: j.scheduledAt, status: j.status, expenses: ['fuelExpense', 'tollExpense', 'parkingExpense', 'foodAllowance', 'otherExpense', 'bonusAmount'].reduce((s, k) => s + Number((j as any)[k] || 0), 0) }));
    return {
      key: 'driver-jobs', title: 'Driver Job Log', period,
      columns: [{ key: 'driver', label: 'Driver' }, { key: 'type', label: 'Type' }, { key: 'booking', label: 'Booking' }, { key: 'date', label: 'Scheduled', format: 'date' }, { key: 'status', label: 'Status' }, { key: 'expenses', label: 'Expenses', align: 'right', format: 'currency' }],
      rows, totals: { Jobs: rows.length, Expenses: rows.reduce((s, r) => s + r.expenses, 0) },
    };
  }

  private async driverPayouts(): Promise<Report> {
    const pos = await this.prisma.driverPayout.findMany({ orderBy: { createdAt: 'desc' } });
    const drivers = await this.prisma.driver.findMany({ where: { id: { in: pos.map(p => p.driverId) } }, select: { id: true, fullName: true } });
    const dmap = Object.fromEntries(drivers.map(d => [d.id, d.fullName]));
    const rows = pos.map(p => ({ ref: p.payoutNumber, driver: dmap[p.driverId] || '—', status: p.status, date: p.createdAt, total: Number(p.total) }));
    return {
      key: 'driver-payouts', title: 'Driver Payouts',
      columns: [{ key: 'ref', label: 'Payout' }, { key: 'driver', label: 'Driver' }, { key: 'status', label: 'Status' }, { key: 'date', label: 'Date', format: 'date' }, { key: 'total', label: 'Total', align: 'right', format: 'currency' }],
      rows, totals: { Total: rows.reduce((s, r) => s + r.total, 0) },
    };
  }

  private async partsCost(): Promise<Report> {
    const [parts, tyres] = await Promise.all([
      this.prisma.sparePart.findMany({ include: { asset: { select: { name: true } } } }),
      this.prisma.tireRecord.findMany({ include: { asset: { select: { name: true } } } }),
    ]);
    const rows = [
      ...parts.map(p => ({ item: p.name, kind: 'Spare part', asset: (p as any).asset?.name || '—', cost: Number(p.purchasePrice || 0) })),
      ...tyres.map(t => ({ item: `${t.manufacturer || ''} ${t.size || ''}`.trim() || 'Tyre', kind: 'Tyre', asset: (t as any).asset?.name || '—', cost: Number(t.purchasePrice || 0) })),
    ].sort((a, b) => b.cost - a.cost);
    return {
      key: 'parts-cost', title: 'Spare Parts & Tyres Cost',
      columns: [{ key: 'item', label: 'Item' }, { key: 'kind', label: 'Kind' }, { key: 'asset', label: 'Asset' }, { key: 'cost', label: 'Cost', align: 'right', format: 'currency' }],
      rows, totals: { Total: rows.reduce((s, r) => s + r.cost, 0), Items: rows.length },
    };
  }

  // ── Additional HR ──
  private async attendanceSummary(from: Date, to: Date, period: any): Promise<Report> {
    const recs = await this.prisma.attendanceRecord.findMany({ where: { date: { gte: from, lte: to } } });
    const m: Record<string, { days: number; hours: number; present: number }> = {};
    for (const r of recs) { (m[r.employeeId] = m[r.employeeId] || { days: 0, hours: 0, present: 0 }); m[r.employeeId].days++; m[r.employeeId].hours += Number(r.hours || 0); if (r.status === 'Present') m[r.employeeId].present++; }
    const emps = await this.prisma.employee.findMany({ where: { id: { in: Object.keys(m) } } });
    const nmap = Object.fromEntries(emps.map((e: any) => [e.id, e.displayName || [e.firstName, e.lastName].filter(Boolean).join(' ')]));
    const rows = Object.entries(m).map(([id, v]) => ({ employee: nmap[id] || '—', days: v.days, present: v.present, hours: Math.round(v.hours * 10) / 10 })).sort((a, b) => b.hours - a.hours);
    return {
      key: 'attendance-summary', title: 'Attendance Summary', period,
      columns: [{ key: 'employee', label: 'Employee' }, { key: 'days', label: 'Records', align: 'right', format: 'number' }, { key: 'present', label: 'Present', align: 'right', format: 'number' }, { key: 'hours', label: 'Hours', align: 'right', format: 'number' }],
      rows, totals: { Hours: rows.reduce((s, r) => s + r.hours, 0) },
    };
  }
}
