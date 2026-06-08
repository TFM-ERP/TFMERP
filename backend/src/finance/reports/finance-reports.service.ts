import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

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
        where: { status: { not: 'CANCELLED' }, issueDate: { gte: startOfYear } },
        _sum: { total: true },
      }),
      // Total collected YTD
      this.prisma.payment.aggregate({
        where: { status: 'CLEARED', paymentDate: { gte: startOfYear } },
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
        where: { status: { not: 'CANCELLED' }, issueDate: { gte: startOfMonth } },
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

  async getRevenueByActivity(year: number) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: { issueDate: { gte: startDate, lte: endDate }, status: { not: 'CANCELLED' } },
      select: { activity: true, total: true, issueDate: true },
    });

    // Group by activity and month
    const result: Record<string, Record<string, number>> = {
      RENTAL: {}, PRODUCTION: {}, BOTH: {},
    };

    for (const inv of invoices) {
      const month = `${year}-${String(new Date(inv.issueDate).getMonth() + 1).padStart(2, '0')}`;
      result[inv.activity][month] = (result[inv.activity][month] || 0) + Number(inv.total);
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
