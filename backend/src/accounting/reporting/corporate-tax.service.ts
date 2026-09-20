import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StatementsService } from './statements.service';
import {
  SMALL_PROFIT_BAND,
  HEADLINE_RATE,
  SMALL_BUSINESS_RELIEF_REVENUE_CAP,
  SMALL_BUSINESS_RELIEF_LAST_PERIOD_END,
  taxOn,
  filingDeadline,
} from './corporate-tax.util';

/**
 * The corporate tax computation for a tax period, in the shape the EmaraTax
 * return asks for.
 *
 * Starts from accounting profit per the financial statements and works down to
 * tax payable, showing every adjustment on its own line. That reconciliation is
 * not decoration: the return itself requires "supporting schedules reconciling to
 * financial statements", and it is the first thing an FTA reviewer compares.
 *
 * The service computes. It does not file, and it does not elect Small Business
 * Relief on the taxpayer's behalf — it reports whether the relief is available
 * and what it would cost or save, because the election has consequences the
 * software cannot weigh: it forfeits the period's tax loss carry-forward and it
 * cannot be combined with Qualifying Free Zone Person status.
 */
@Injectable()
export class CorporateTaxService {
  constructor(
    private prisma: PrismaService,
    private statements: StatementsService,
  ) {}

  /**
   * Full computation for a tax period.
   *
   * `addBacks` and `exemptIncome` are passed in rather than inferred. Nothing in
   * the chart of accounts identifies a fine, a penalty or entertainment
   * expenditure, and guessing at them would put an invented adjustment on a tax
   * return. They are the preparer's declarations, recorded with the computation.
   */
  async computation(args: {
    year: number;
    addBacks?: { label: string; amount: number }[];
    exemptIncome?: { label: string; amount: number }[];
    lossesBroughtForward?: number;
    electSmallBusinessRelief?: boolean;
  }) {
    const from = `${args.year}-01-01`;
    const to = `${args.year}-12-31`;
    const periodEnd = new Date(to);

    const income = await this.statements.incomeStatement({ from, to, comparative: false });
    const accountingProfit = income.profitForThePeriod;
    const revenue = round2(income.revenue + income.otherIncome);

    const addBacks = args.addBacks ?? [];
    const exemptIncome = args.exemptIncome ?? [];
    const totalAddBacks = round2(addBacks.reduce((s, a) => s + a.amount, 0));
    const totalExempt = round2(exemptIncome.reduce((s, a) => s + a.amount, 0));

    const adjustedProfit = round2(accountingProfit + totalAddBacks - totalExempt);
    const lossesUsed = Math.max(0, Math.min(args.lossesBroughtForward ?? 0, Math.max(adjustedProfit, 0)));
    const taxableIncomeBeforeRelief = round2(Math.max(adjustedProfit - lossesUsed, 0));

    const reliefAvailable =
      revenue <= SMALL_BUSINESS_RELIEF_REVENUE_CAP &&
      to <= SMALL_BUSINESS_RELIEF_LAST_PERIOD_END;
    const reliefElected = !!args.electSmallBusinessRelief && reliefAvailable;

    // An electing person is treated as having no taxable income for the period.
    const taxableIncome = reliefElected ? 0 : taxableIncomeBeforeRelief;
    const taxPayable = reliefElected ? 0 : taxOn(taxableIncome);
    const taxWithoutRelief = taxOn(taxableIncomeBeforeRelief);

    const lossThisPeriod = adjustedProfit < 0 ? round2(-adjustedProfit) : 0;
    const due = filingDeadline(periodEnd);

    return {
      entity: 'The Film Makers FZ LLC',
      taxPeriod: { from, to },
      filingDeadline: due.toISOString().slice(0, 10),
      currency: 'AED',

      /** The reconciliation the return requires, line by line. */
      computation: [
        { line: 'Accounting profit or loss per the financial statements', amount: accountingProfit },
        ...addBacks.map(a => ({ line: `Add back: ${a.label}`, amount: a.amount })),
        ...exemptIncome.map(a => ({ line: `Less exempt income: ${a.label}`, amount: -a.amount })),
        { line: 'Adjusted profit or loss', amount: adjustedProfit, subtotal: true },
        ...(lossesUsed ? [{ line: 'Less tax losses brought forward and utilised', amount: -lossesUsed }] : []),
        { line: 'Taxable income before relief', amount: taxableIncomeBeforeRelief, subtotal: true },
        ...(reliefElected
          ? [{ line: 'Small Business Relief elected — treated as no taxable income', amount: -taxableIncomeBeforeRelief }]
          : []),
        { line: 'Taxable income', amount: taxableIncome, subtotal: true },
        { line: `First ${fmt(SMALL_PROFIT_BAND)} at 0%`, amount: 0 },
        {
          line: `Balance at ${(HEADLINE_RATE * 100).toFixed(0)}%`,
          amount: taxPayable,
        },
        { line: 'Corporate tax payable', amount: taxPayable, total: true },
      ],

      smallBusinessRelief: {
        available: reliefAvailable,
        elected: reliefElected,
        revenueTested: revenue,
        revenueCap: SMALL_BUSINESS_RELIEF_REVENUE_CAP,
        lastEligiblePeriodEnd: SMALL_BUSINESS_RELIEF_LAST_PERIOD_END,
        taxSaved: round2(taxWithoutRelief - taxPayable),
        /**
         * What electing costs. The relief is not free: the period's loss cannot be
         * carried forward, and the election is incompatible with Qualifying Free
         * Zone Person status.
         */
        lossForfeitedByElecting: reliefElected ? lossThisPeriod : 0,
        conditions: [
          'Must be actively elected in the corporate tax return through EmaraTax. It is not automatic.',
          'Revenue must not exceed AED 3,000,000 in this tax period and in every previous one.',
          'Available to resident persons only, not to a Qualifying Free Zone Person.',
          'Electing forfeits the carry-forward of any tax loss arising in the period.',
        ],
      },

      losses: {
        broughtForward: args.lossesBroughtForward ?? 0,
        utilised: lossesUsed,
        arisingThisPeriod: lossThisPeriod,
        carriedForward: reliefElected ? 0 : round2((args.lossesBroughtForward ?? 0) - lossesUsed + lossThisPeriod),
      },

      /** What the return reports as revenue, and where it came from. */
      revenueReported: {
        amount: revenue,
        source: 'General ledger income accounts for the tax period',
      },

      taxPayable,
      taxWithoutRelief,
    };
  }

  /**
   * Cross-check between the revenue this computation reports and the revenue
   * declared across the VAT returns for the same year.
   *
   * The FTA compares the two. A difference is not necessarily an error — zero-rated
   * and out-of-scope supplies, and timing differences at a quarter boundary, all
   * produce one legitimately — but an unexplained difference is the single most
   * common trigger for a query, so it is surfaced before filing rather than after.
   */
  async revenueReconciliation(year: number) {
    const from = new Date(`${year}-01-01`);
    const to = new Date(`${year}-12-31`);

    const income = await this.statements.incomeStatement({
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      comparative: false,
    });

    const invoices = await this.prisma.invoice.findMany({
      where: {
        issueDate: { gte: from, lte: to },
        status: { notIn: ['CANCELLED', 'VOIDED', 'DRAFT'] as any },
      },
      select: { invoiceNumber: true, issueDate: true, subtotal: true, vatAmount: true, total: true },
      orderBy: { issueDate: 'asc' },
    });

    const invoicedNet = round2(invoices.reduce((s, i) => s + (Number(i.total) - Number(i.vatAmount)), 0));
    const ledgerRevenue = round2(income.revenue + income.otherIncome);
    const difference = round2(ledgerRevenue - invoicedNet);

    return {
      year,
      ledgerRevenue,
      invoicedNet,
      invoiceCount: invoices.length,
      difference,
      agrees: difference === 0,
      note:
        difference === 0
          ? 'Ledger revenue agrees with the sales invoices for the year.'
          : 'Ledger revenue and the sales invoices differ. Resolve before filing — the FTA compares the corporate tax return against the VAT returns for the same period.',
    };
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function fmt(n: number): string {
  return `AED ${n.toLocaleString('en-US')}`;
}
