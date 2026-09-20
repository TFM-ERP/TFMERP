import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StatementsService } from './statements.service';

/**
 * The management reports a finance function runs weekly rather than annually:
 * who owes money, who is owed, and whether the business can pay its bills.
 *
 * Aged analyses are computed from invoice and expense documents rather than from
 * the ledger, because ageing needs a due date and the ledger holds none. They are
 * reconciled back to the control accounts — 1100 for receivables, 2000 for
 * payables — and the difference is reported. A difference means documents and
 * ledger disagree, which during the 2025 reconstruction they did by more than
 * AED 900,000 because customer receipts were never posted.
 */

const BUCKETS = [
  { label: 'Not yet due', from: -Infinity, to: 0 },
  { label: '1–30 days', from: 1, to: 30 },
  { label: '31–60 days', from: 31, to: 60 },
  { label: '61–90 days', from: 61, to: 90 },
  { label: 'Over 90 days', from: 91, to: Infinity },
];

function bucketFor(daysOverdue: number): string {
  return BUCKETS.find(b => daysOverdue >= b.from && daysOverdue <= b.to)!.label;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class ManagementReportsService {
  constructor(
    private prisma: PrismaService,
    private statements: StatementsService,
  ) {}

  /** Outstanding customer invoices, aged, reconciled to account 1100. */
  async agedReceivables(asAt = new Date()) {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT', 'PAID'] as any } },
      select: {
        invoiceNumber: true,
        issueDate: true,
        dueDate: true,
        total: true,
        amountPaid: true,
        client: { select: { companyName: true, email: true } },
      },
      orderBy: { issueDate: 'asc' },
    });

    const rows = invoices
      .map(i => {
        const outstanding = r2(Number(i.total) - Number(i.amountPaid));
        const due = i.dueDate ?? i.issueDate;
        const daysOverdue = daysBetween(asAt, due);
        return {
          invoiceNumber: i.invoiceNumber,
          client: i.client.companyName,
          email: i.client.email ?? null,
          issueDate: i.issueDate,
          dueDate: due,
          outstanding,
          daysOverdue: Math.max(daysOverdue, 0),
          bucket: bucketFor(daysOverdue),
        };
      })
      .filter(r => r.outstanding > 0);

    const byBucket = BUCKETS.map(b => ({
      bucket: b.label,
      total: r2(rows.filter(r => r.bucket === b.label).reduce((s, r) => s + r.outstanding, 0)),
      count: rows.filter(r => r.bucket === b.label).length,
    }));

    const total = r2(rows.reduce((s, r) => s + r.outstanding, 0));
    const control = await this.controlAccount('1100', asAt);

    return {
      asAt: asAt.toISOString().slice(0, 10),
      rows: rows.sort((a, b) => b.daysOverdue - a.daysOverdue),
      byBucket,
      total,
      controlAccount: control,
      difference: r2(total - control),
      agrees: r2(total - control) === 0,
    };
  }

  /**
   * Supplier balances, aged, reconciled to account 2000.
   *
   * Expenses carry no `amountPaid`, so an APPROVED expense is treated as
   * outstanding and a PAID one as settled. That is the only signal the schema
   * offers, and it is why the control-account difference matters: until supplier
   * payments post to the ledger, account 2000 carries every invoice ever raised
   * and this report will not agree with it.
   */
  async agedPayables(asAt = new Date()) {
    const expenses = await this.prisma.expense.findMany({
      where: { status: 'APPROVED' as any },
      select: {
        expenseNumber: true,
        invoiceNumber: true,
        expenseDate: true,
        invoiceDate: true,
        dueDate: true,
        totalAmount: true,
        vendorName: true,
        category: true,
        supplier: { select: { name: true } },
      },
      orderBy: { expenseDate: 'asc' },
    });

    const rows = expenses.map(e => {
      const due = e.dueDate ?? e.invoiceDate ?? e.expenseDate;
      const daysOverdue = daysBetween(asAt, due);
      return {
        reference: e.invoiceNumber ?? e.expenseNumber,
        supplier: e.supplier?.name ?? e.vendorName ?? 'Unidentified',
        category: e.category,
        date: e.invoiceDate ?? e.expenseDate,
        dueDate: due,
        outstanding: r2(Number(e.totalAmount)),
        daysOverdue: Math.max(daysOverdue, 0),
        bucket: bucketFor(daysOverdue),
      };
    });

    const byBucket = BUCKETS.map(b => ({
      bucket: b.label,
      total: r2(rows.filter(r => r.bucket === b.label).reduce((s, r) => s + r.outstanding, 0)),
      count: rows.filter(r => r.bucket === b.label).length,
    }));

    const total = r2(rows.reduce((s, r) => s + r.outstanding, 0));
    const control = await this.controlAccount('2000', asAt);

    return {
      asAt: asAt.toISOString().slice(0, 10),
      rows: rows.sort((a, b) => b.daysOverdue - a.daysOverdue),
      byBucket,
      total,
      controlAccount: control,
      difference: r2(total - control),
      agrees: r2(total - control) === 0,
      note:
        r2(total - control) === 0
          ? undefined
          : 'The ledger control account and the supplier documents disagree. Supplier payments are not posted to the ledger, so account 2000 still carries invoices that were settled.',
    };
  }

  /** The balance on a control account at a date, in its natural sign. */
  private async controlAccount(code: string, asAt: Date): Promise<number> {
    const lines = await this.prisma.journalLine.findMany({
      where: { entry: { status: 'POSTED', date: { lte: asAt } }, account: { code } },
      select: { debit: true, credit: true, account: { select: { type: true } } },
    });
    let net = 0;
    for (const l of lines) net += Number(l.debit) - Number(l.credit);
    const type = lines[0]?.account.type;
    return r2(type === 'ASSET' || type === 'EXPENSE' ? net : -net);
  }

  /**
   * The one-page view: what the business earned, what it owes, and how long its
   * cash lasts at the current burn.
   */
  async executiveSummary(year: number) {
    const to = new Date(`${year}-12-31`);
    const [income, position, receivables, payables] = await Promise.all([
      this.statements.incomeStatement({ from: `${year}-01-01`, to: `${year}-12-31`, comparative: true }),
      this.statements.statementOfFinancialPosition({ asAt: `${year}-12-31`, comparative: false }),
      this.agedReceivables(to),
      this.agedPayables(to),
    ]);

    const cash = r2(
      position.groups
        .find(g => g.section === 'CURRENT_ASSET')
        ?.lines.filter(l => l.code === '1000' || l.code === '1010')
        .reduce((s, l) => s + l.amount, 0) ?? 0,
    );

    const currentAssets = position.groups.find(g => g.section === 'CURRENT_ASSET')?.total ?? 0;
    const currentLiabilities = position.groups.find(g => g.section === 'CURRENT_LIABILITY')?.total ?? 0;
    const monthlyCost = r2((income.costOfSales + income.operatingExpenses) / 12);

    const prior = income.comparative?.revenue ?? 0;

    return {
      year,
      revenue: income.revenue,
      revenueGrowth: prior ? r2(((income.revenue - prior) / prior) * 100) : null,
      grossMargin: income.revenue ? r2((income.grossProfit / income.revenue) * 100) : null,
      netMargin: income.revenue ? r2((income.profitForThePeriod / income.revenue) * 100) : null,
      profitForTheYear: income.profitForThePeriod,
      cash,
      currentRatio: currentLiabilities ? r2(currentAssets / currentLiabilities) : null,
      workingCapital: r2(currentAssets - currentLiabilities),
      /** Months of cost the cash balance covers at the year's average run rate. */
      cashRunwayMonths: monthlyCost > 0 ? r2(cash / monthlyCost) : null,
      receivables: { total: receivables.total, overNinetyDays: receivables.byBucket.find(b => b.bucket === 'Over 90 days')?.total ?? 0 },
      payables: { total: payables.total, overNinetyDays: payables.byBucket.find(b => b.bucket === 'Over 90 days')?.total ?? 0 },
      netAssets: r2(position.totalAssets - position.totalLiabilities),
      balanceSheetBalances: position.balances,
    };
  }
}
