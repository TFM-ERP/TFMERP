import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { FxService, BASE_CURRENCY } from '../fx/fx.service';

const num = (d: any) => Number(d || 0);
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService, private fx: FxService) {}

  async executive() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const last30 = new Date(Date.now() - 30 * 86400000);

    // ── Finance ──
    const openInvoices = await safe(() => this.prisma.invoice.findMany({
      where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] as any } },
      select: { amountDue: true, dueDate: true, total: true, client: { select: { companyName: true } } },
    }), [] as any[]);
    let arOutstanding = 0, overdueAmount = 0, overdueCount = 0;
    for (const i of openInvoices) {
      arOutstanding += num(i.amountDue);
      if (i.dueDate && new Date(i.dueDate) < now && num(i.amountDue) > 0) { overdueAmount += num(i.amountDue); overdueCount++; }
    }
    const revenueYtd = await safe(async () => {
      const r = await this.prisma.invoice.aggregate({ _sum: { total: true }, where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] as any }, issueDate: { gte: yearStart } } });
      return num(r._sum.total);
    }, 0);
    const paymentsLast30 = await safe(async () => {
      const r = await this.prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: last30 } } });
      return num(r._sum.amount);
    }, 0);
    const expensesMtd = await safe(async () => {
      const r = await this.prisma.expense.aggregate({ _sum: { totalAmount: true }, where: { status: { in: ['APPROVED', 'PAID'] as any }, expenseDate: { gte: monthStart } } });
      return num(r._sum.totalAmount);
    }, 0);

    // ── Production (converted to base currency) ──
    const fxRates = await safe(() => this.fx.rates(), { [BASE_CURRENCY]: 1 } as Record<string, number>);
    const conv = (amt: number, cur?: string) => (!cur || cur === BASE_CURRENCY) ? amt : amt * (fxRates[cur] ?? 1);
    const projects = await safe(() => this.prisma.productionProject.findMany({ select: { id: true, status: true, totalBudget: true, currency: true } }), [] as any[]);
    const activeProjects = projects.filter(p => !['DELIVERED', 'CANCELLED'].includes(p.status)).length;
    const totalBudget = projects.reduce((s, p) => s + conv(num(p.totalBudget), p.currency), 0);
    const txns = await safe(() => this.prisma.projectTransaction.findMany({ select: { kind: true, status: true, total: true, currency: true } }), [] as any[]);
    let prodRevenue = 0, prodCost = 0;
    for (const t of txns) {
      if (t.kind === 'INCOME' && ['INVOICED', 'RECEIVED', 'PAID', 'APPROVED'].includes(t.status)) prodRevenue += conv(num(t.total), t.currency);
      if (t.kind === 'COST' && ['APPROVED', 'PAID'].includes(t.status)) prodCost += conv(num(t.total), t.currency);
    }

    // ── People / inventory / rentals ──
    const headcount = await safe(() => this.prisma.employee.count(), 0);
    const crewCount = await safe(() => this.prisma.crewMember.count({ where: { status: 'ACTIVE' } }), 0);
    const invItems = await safe(() => this.prisma.inventoryItem.findMany({ where: { isActive: true }, select: { quantity: true, unitCost: true, reorderLevel: true } }), [] as any[]);
    let stockValue = 0, lowStock = 0;
    for (const i of invItems) { stockValue += num(i.quantity) * num(i.unitCost); if (num(i.quantity) <= num(i.reorderLevel)) lowStock++; }
    const assets = await safe(() => this.prisma.asset.count(), 0);
    const bookings = await safe(() => this.prisma.rentalBooking.count(), 0);

    // ── Approvals / compliance ──
    const pendingApprovals = await safe(() => this.prisma.approvalRequest.count({ where: { status: 'PENDING' } }), 0);

    return {
      finance: { arOutstanding, overdueAmount, overdueCount, revenueYtd, paymentsLast30, expensesMtd },
      production: { activeProjects, totalProjects: projects.length, totalBudget, revenue: prodRevenue, cost: prodCost, net: prodRevenue - prodCost },
      people: { headcount, crew: crewCount },
      inventory: { stockValue, lowStock, items: invItems.length },
      rentals: { assets, bookings },
      ops: { pendingApprovals },
      topDebtors: openInvoices
        .filter((i: any) => num(i.amountDue) > 0)
        .map((i: any) => ({ client: i.client?.companyName || '—', due: num(i.amountDue) }))
        .reduce((acc: any[], cur) => { const e = acc.find(a => a.client === cur.client); if (e) e.due += cur.due; else acc.push({ ...cur }); return acc; }, [])
        .sort((a: any, b: any) => b.due - a.due).slice(0, 5),
      generatedAt: now.toISOString(),
    };
  }
}
