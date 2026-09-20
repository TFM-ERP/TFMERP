import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { REVENUE_LINES, POSTABLE_INVOICE_STATUSES, revenueAccountFor } from '../../accounting/revenue-mapping.util';
import { netRevenue } from '../../reports/revenue-matrix.util';

@Injectable()
export class FinanceReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardSummary() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      overdueCount,
      activeQuotations,
      monthInvoiced,
      recentInvoices,
    ] = await Promise.all([
      // Total invoiced YTD
      this.prisma.invoice.aggregate({
        where: { status: { notIn: ['CANCELLED', 'VOIDED'] }, issueDate: { gte: startOfYear } },
        _sum: { total: true },
      }),
      // Total collected YTD
      this.prisma.payment.aggregate({
        where: { direction: 'RECEIPT', status: 'CLEARED', paymentDate: { gte: startOfYear } },
        _sum: { amount: true },
      }),
      // Outstanding
      this.prisma.invoice.aggregate({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { amountDue: true },
      }),
      // Overdue invoices count
      this.prisma.invoice.count({
        where: {
          status: { in: ['SENT', 'PARTIALLY_PAID'] },
          dueDate: { lt: now },
        },
      }),
      // Active quotations
      this.prisma.quotation.count({
        where: { status: { in: ['DRAFT', 'SENT', 'APPROVED'] } },
      }),
      // This month invoiced
      this.prisma.invoice.aggregate({
        where: { status: { notIn: ['CANCELLED', 'VOIDED'] }, issueDate: { gte: startOfMonth } },
        _sum: { total: true },
      }),
      // Recent 5 invoices
      this.prisma.invoice.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { companyName: true } } },
      }),
    ]);

    return {
      ytd: {
        invoiced: totalInvoiced._sum.total || 0,
        collected: totalCollected._sum.amount || 0,
        outstanding: totalOutstanding._sum.amountDue || 0,
      },
      thisMonth: { invoiced: monthInvoiced._sum.total || 0 },
      counts: { overdueInvoices: overdueCount, activeQuotations },
      recentInvoices,
    };
  }

  /**
   * Monthly revenue by GL revenue line, net of VAT.
   *
   * Previously keyed a literal `{ RENTAL, PRODUCTION, BOTH }` object by
   * `inv.activity` and wrote straight into it. The `Activity` enum has SEVEN
   * values, so any PRODUCTION_SERVICE / BOOK_DESIGN / WEB_DESIGN / EVENTS
   * invoice hit `undefined[month]` and threw — this endpoint 500'd on live data.
   *
   * The mapping now comes from `revenue-mapping.util`, the same one `postAll()`
   * posts on and `revenue-matrix` groups by, so a new enum value can never
   * reintroduce the crash: unknown activities fall to Other.
   *
   * Keys are the revenue-line labels, so the series a caller charts are the
   * accounts the ledger actually holds. Measure and status filter now match the
   * ledger too — `total - vatAmount` over posted statuses — because a series
   * named after a GL account that does not equal that account is worse than
   * either an unlabelled chart or a crash.
   */
  async getRevenueByActivity(year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        issueDate: { gte: startDate, lte: endDate },
        status: { in: POSTABLE_INVOICE_STATUSES as any },
      },
      select: { activity: true, invoiceType: true, total: true, vatAmount: true, issueDate: true },
      orderBy: [{ issueDate: 'asc' }, { id: 'asc' }],
    });

    // Every line is present and zeroed, so a caller never indexes undefined.
    const result: Record<string, Record<string, number>> = {};
    for (const line of REVENUE_LINES) result[line.label] = {};

    const byLabel = new Map(REVENUE_LINES.map(l => [l.code, l.label]));
    const acc = new Map<string, Prisma.Decimal>();
    for (const inv of invoices) {
      const month = `${year}-${String(new Date(inv.issueDate).getMonth() + 1).padStart(2, '0')}`;
      const label = byLabel.get(revenueAccountFor(inv.activity))!;
      // Net of VAT and signed, exactly as the matrix and the ledger compute it.
      const net = netRevenue({
        clientId: '', clientName: '', activity: inv.activity as any,
        invoiceType: inv.invoiceType as any, total: inv.total as any, vatAmount: inv.vatAmount as any,
      });
      const k = `${label}|${month}`;
      acc.set(k, (acc.get(k) ?? new Prisma.Decimal(0)).plus(net));
    }
    // Single Decimal -> number boundary, at the response.
    for (const [k, v] of acc) {
      const [label, month] = k.split('|');
      result[label][month] = v.toNumber();
    }
    return result;
  }

  async getOutstandingByClient() {
    return this.prisma.invoice.groupBy({
      by: ['clientId'],
      where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } },
      _sum: { amountDue: true, total: true },
      orderBy: { _sum: { amountDue: 'desc' } },
      take: 20,
    });
  }

  async getVatReturn(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const [invoiceItems, expenses] = await Promise.all([
      this.prisma.invoiceItem.findMany({
        where: {
          invoice: {
            issueDate: { gte: start, lte: end },
            status: { notIn: ['CANCELLED', 'VOIDED'] },
          },
        },
        include: {
          taxRate: true,
          invoice: {
            select: {
              id: true, invoiceNumber: true, issueDate: true,
              client: { select: { companyName: true, trn: true } },
            },
          },
        },
      }),
      this.prisma.expense.findMany({
        where: {
          expenseDate: { gte: start, lte: end },
          status: { in: ['APPROVED', 'PAID'] },
          vatAmount: { gt: 0 },
        },
      }),
    ]);

    let standardRatedSales = 0;
    let zeroRatedSales = 0;
    let exemptSales = 0;
    let outputVat = 0;

    for (const item of invoiceItems) {
      const lineTotal = Number(item.lineTotal);
      const taxAmt = Number(item.taxAmount);
      const vatType = item.taxRate?.vatType ?? 'STANDARD';
      if (vatType === 'STANDARD') { standardRatedSales += lineTotal; outputVat += taxAmt; }
      else if (vatType === 'ZERO_RATED') zeroRatedSales += lineTotal;
      else exemptSales += lineTotal;
    }

    const inputVat = expenses.reduce((s, e) => s + Number(e.vatAmount), 0);
    const netVatPayable = outputVat - inputVat;

    const clientMap: Record<string, { companyName: string; trn: string; sales: number; vat: number }> = {};
    for (const item of invoiceItems) {
      const { companyName, trn } = item.invoice.client;
      if (!clientMap[companyName]) clientMap[companyName] = { companyName, trn: trn || '', sales: 0, vat: 0 };
      clientMap[companyName].sales += Number(item.lineTotal);
      clientMap[companyName].vat += Number(item.taxAmount);
    }

    return {
      period: { startDate, endDate },
      box1_standardRatedSales: standardRatedSales,
      box2_zeroRatedSales: zeroRatedSales,
      box3_exemptSales: exemptSales,
      box4_totalSales: standardRatedSales + zeroRatedSales + exemptSales,
      box6_outputVat: outputVat,
      box9_inputVat: inputVat,
      box10_adjustments: 0,
      box11_netVatPayable: netVatPayable,
      expenseCount: expenses.length,
      invoiceCount: new Set(invoiceItems.map(i => i.invoice.id)).size,
      clientBreakdown: Object.values(clientMap).sort((a, b) => b.sales - a.sales),
    };
  }
}
