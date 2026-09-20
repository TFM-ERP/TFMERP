import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  GlType,
  StatementSection,
  SECTION_LABEL,
  SECTION_ORDER,
  sectionFor,
  presentedAmount,
  cashFlowClassFor,
  isAccumulatedDepreciation,
  round2,
  sum2,
} from './statement-lines.util';

/**
 * Statutory financial statements, built from the general ledger and nothing else.
 *
 * Every figure on every statement here is the sum of posted journal lines. No
 * report in this service reads `Invoice`, `Expense` or `Payment` directly, which
 * is deliberate: the 2025 reconstruction found that `finance-reports.getVatReturn()`
 * computes input VAT from `Expense.vatAmount` while the ledger computes it from
 * account 1200, so the two can disagree with nothing to reconcile them. Statements
 * that tie to the trial balance by construction cannot drift from it.
 *
 * Presentation follows the IFRS for SMEs Accounting Standard. The complete set in
 * Section 3.17 is: statement of financial position, statement of comprehensive
 * income, statement of changes in equity, statement of cash flows, and notes.
 * Section 3.18 permits a combined statement of income and retained earnings in
 * place of the second and third of those when the only movements in equity are
 * profit or loss, dividends, corrections of errors and changes in accounting
 * policy — which is the normal case for a single-owner company, so `fullSet()`
 * reports whether that condition holds.
 */

/** One account as it appears on the face of a statement. */
export interface StatementLine {
  code: string;
  name: string;
  section: StatementSection;
  amount: number;
  /** Prior-period comparative, when one was requested. */
  comparative?: number;
}

/** A headed group of lines with its own total. */
export interface StatementGroup {
  section: StatementSection;
  label: string;
  lines: StatementLine[];
  total: number;
  comparativeTotal?: number;
}

/** Per-account debit and credit totals over a window, with the account's own attributes. */
interface AccountMovement {
  code: string;
  name: string;
  type: GlType;
  subtype: string | null;
  isBank: boolean;
  debit: number;
  credit: number;
}

export interface PeriodRange {
  /** Inclusive start. Omit for cumulative-to-date, which is what a balance sheet needs. */
  from?: string | null;
  /** Inclusive end. */
  to: string;
}

@Injectable()
export class StatementsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Posted journal lines aggregated by account over a window.
   *
   * `from` omitted means from the beginning of the ledger, which is what the
   * statement of financial position needs. Only POSTED entries are included —
   * a draft journal must never reach a statutory statement.
   */
  private async movements(from: Date | null, to: Date): Promise<AccountMovement[]> {
    const entryWhere: any = { status: 'POSTED' };
    entryWhere.date = from ? { gte: from, lte: to } : { lte: to };

    const lines = await this.prisma.journalLine.findMany({
      where: { entry: entryWhere },
      include: { account: true },
    });

    const byAccount = new Map<string, AccountMovement>();
    for (const line of lines) {
      const a = line.account;
      let row = byAccount.get(a.id);
      if (!row) {
        row = {
          code: a.code,
          name: a.name,
          type: a.type as GlType,
          subtype: a.subtype ?? null,
          isBank: a.isBank,
          debit: 0,
          credit: 0,
        };
        byAccount.set(a.id, row);
      }
      row.debit += Number(line.debit);
      row.credit += Number(line.credit);
    }

    return [...byAccount.values()]
      .map(r => ({ ...r, debit: round2(r.debit), credit: round2(r.credit) }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  /** Turn movements into statement lines, dropping accounts with no balance to show. */
  private toLines(movements: AccountMovement[], comparatives?: Map<string, number>): StatementLine[] {
    const lines: StatementLine[] = [];
    for (const m of movements) {
      const amount = presentedAmount(m.type, m.debit, m.credit);
      const comparative = comparatives?.get(m.code);
      // An account that is nil in both periods tells the reader nothing.
      if (amount === 0 && !comparative) continue;
      lines.push({
        code: m.code,
        name: m.name,
        section: sectionFor(m.type, m.subtype),
        amount,
        ...(comparatives ? { comparative: comparative ?? 0 } : {}),
      });
    }
    return lines;
  }

  /** Group lines under their section headings, in presentation order. */
  private group(lines: StatementLine[], sections: StatementSection[]): StatementGroup[] {
    return sections
      .slice()
      .sort((a, b) => SECTION_ORDER[a] - SECTION_ORDER[b])
      .map(section => {
        const own = lines.filter(l => l.section === section);
        const group: StatementGroup = {
          section,
          label: SECTION_LABEL[section],
          lines: own,
          total: sum2(own.map(l => l.amount)),
        };
        if (own.some(l => l.comparative !== undefined)) {
          group.comparativeTotal = sum2(own.map(l => l.comparative ?? 0));
        }
        return group;
      })
      .filter(g => g.lines.length > 0);
  }

  /** Comparative amounts keyed by account code, for a prior window. */
  private async comparativeMap(from: Date | null, to: Date): Promise<Map<string, number>> {
    const prior = await this.movements(from, to);
    return new Map(prior.map(m => [m.code, presentedAmount(m.type, m.debit, m.credit)]));
  }

  /**
   * Income statement for a period, with the prior period of equal length as the
   * comparative required by IFRS for SMEs §3.14.
   */
  async incomeStatement(range: PeriodRange & { comparative?: boolean }) {
    const from = range.from ? new Date(range.from) : null;
    const to = new Date(range.to);

    let comparatives: Map<string, number> | undefined;
    let comparativePeriod: { from: string; to: string } | undefined;
    if (range.comparative && from) {
      const priorTo = new Date(from);
      priorTo.setDate(priorTo.getDate() - 1);
      const priorFrom = new Date(from);
      priorFrom.setFullYear(priorFrom.getFullYear() - 1);
      comparatives = await this.comparativeMap(priorFrom, priorTo);
      comparativePeriod = {
        from: priorFrom.toISOString().slice(0, 10),
        to: priorTo.toISOString().slice(0, 10),
      };
    }

    const movements = await this.movements(from, to);
    const lines = this.toLines(movements, comparatives).filter(l =>
      ['REVENUE', 'OTHER_INCOME', 'COST_OF_SALES', 'OPERATING_EXPENSE'].includes(l.section),
    );
    const groups = this.group(lines, ['REVENUE', 'COST_OF_SALES', 'OPERATING_EXPENSE', 'OTHER_INCOME']);

    const totalFor = (s: StatementSection) => groups.find(g => g.section === s)?.total ?? 0;
    const compFor = (s: StatementSection) => groups.find(g => g.section === s)?.comparativeTotal ?? 0;

    const revenue = totalFor('REVENUE');
    const costOfSales = totalFor('COST_OF_SALES');
    const grossProfit = round2(revenue - costOfSales);
    const operatingExpenses = totalFor('OPERATING_EXPENSE');
    const operatingResult = round2(grossProfit - operatingExpenses);
    const otherIncome = totalFor('OTHER_INCOME');
    const profitForThePeriod = round2(operatingResult + otherIncome);

    const comparative = comparatives
      ? {
          period: comparativePeriod,
          revenue: compFor('REVENUE'),
          costOfSales: compFor('COST_OF_SALES'),
          grossProfit: round2(compFor('REVENUE') - compFor('COST_OF_SALES')),
          operatingExpenses: compFor('OPERATING_EXPENSE'),
          profitForThePeriod: round2(
            compFor('REVENUE') - compFor('COST_OF_SALES') - compFor('OPERATING_EXPENSE') + compFor('OTHER_INCOME'),
          ),
        }
      : undefined;

    return {
      period: { from: range.from ?? null, to: range.to },
      groups,
      revenue,
      costOfSales,
      grossProfit,
      operatingExpenses,
      operatingResult,
      otherIncome,
      profitForThePeriod,
      ...(comparative ? { comparative } : {}),
    };
  }

  /**
   * Statement of financial position as at a date, with the prior year end as the
   * comparative.
   *
   * Retained earnings are computed, not read from account 3100. There is no
   * year-end close in this system — nothing rolls income and expense into equity —
   * so the accumulated result to date is the sum of every posted income and
   * expense line since the ledger began. Reading 3100 instead would silently
   * understate equity by the whole of the company's trading history and the
   * statement would not balance. Any amount actually posted to 3100 is added on
   * top, so a manual close entry, if one is ever made, is not lost.
   */
  async statementOfFinancialPosition(args: { asAt: string; comparative?: boolean }) {
    const asAt = new Date(args.asAt);

    let comparatives: Map<string, number> | undefined;
    let comparativeDate: string | undefined;
    let comparativeRetained: number | undefined;
    if (args.comparative) {
      const prior = new Date(asAt);
      prior.setFullYear(prior.getFullYear() - 1);
      comparatives = await this.comparativeMap(null, prior);
      comparativeDate = prior.toISOString().slice(0, 10);
      const priorMovements = await this.movements(null, prior);
      comparativeRetained = this.accumulatedResult(priorMovements);
    }

    const movements = await this.movements(null, asAt);
    const retainedEarnings = this.accumulatedResult(movements);

    const balanceLines = this.toLines(movements, comparatives).filter(l =>
      ['CURRENT_ASSET', 'NON_CURRENT_ASSET', 'CURRENT_LIABILITY', 'NON_CURRENT_LIABILITY', 'EQUITY'].includes(
        l.section,
      ),
    );

    // The computed accumulated result joins equity as its own line.
    balanceLines.push({
      code: '3100',
      name: 'Retained earnings',
      section: 'EQUITY',
      amount: retainedEarnings,
      ...(comparatives ? { comparative: comparativeRetained ?? 0 } : {}),
    });

    const groups = this.group(balanceLines, [
      'CURRENT_ASSET',
      'NON_CURRENT_ASSET',
      'CURRENT_LIABILITY',
      'NON_CURRENT_LIABILITY',
      'EQUITY',
    ]);

    const totalFor = (s: StatementSection) => groups.find(g => g.section === s)?.total ?? 0;
    const compFor = (s: StatementSection) => groups.find(g => g.section === s)?.comparativeTotal ?? 0;

    const totalAssets = round2(totalFor('CURRENT_ASSET') + totalFor('NON_CURRENT_ASSET'));
    const totalLiabilities = round2(totalFor('CURRENT_LIABILITY') + totalFor('NON_CURRENT_LIABILITY'));
    const totalEquity = totalFor('EQUITY');
    const difference = round2(totalAssets - totalLiabilities - totalEquity);

    return {
      asAt: args.asAt,
      groups,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity: round2(totalLiabilities + totalEquity),
      /**
       * Zero when the ledger is internally consistent. A non-zero value is not
       * hidden or plugged: it is surfaced so the reader knows the statement does
       * not balance and by how much.
       */
      difference,
      balances: difference === 0,
      ...(args.comparative
        ? {
            comparative: {
              asAt: comparativeDate,
              totalAssets: round2(compFor('CURRENT_ASSET') + compFor('NON_CURRENT_ASSET')),
              totalLiabilities: round2(compFor('CURRENT_LIABILITY') + compFor('NON_CURRENT_LIABILITY')),
              totalEquity: compFor('EQUITY'),
            },
          }
        : {}),
    };
  }

  /** Cumulative income less expense across a set of movements — the accumulated result. */
  private accumulatedResult(movements: AccountMovement[]): number {
    let income = 0;
    let expense = 0;
    for (const m of movements) {
      if (m.type === 'INCOME') income += presentedAmount(m.type, m.debit, m.credit);
      if (m.type === 'EXPENSE') expense += presentedAmount(m.type, m.debit, m.credit);
    }
    return round2(income - expense);
  }

  /**
   * Statement of changes in equity for a period (IFRS for SMEs §6).
   *
   * Opening equity, the result for the period, and every movement posted directly
   * to an equity account during it.
   */
  async statementOfChangesInEquity(range: { from: string; to: string }) {
    const from = new Date(range.from);
    const to = new Date(range.to);
    const dayBefore = new Date(from);
    dayBefore.setDate(dayBefore.getDate() - 1);

    const opening = await this.movements(null, dayBefore);
    const inPeriod = await this.movements(from, to);

    const equityOf = (ms: AccountMovement[]) =>
      sum2(ms.filter(m => m.type === 'EQUITY').map(m => presentedAmount(m.type, m.debit, m.credit)));

    const openingEquity = round2(equityOf(opening) + this.accumulatedResult(opening));
    const profitForThePeriod = this.accumulatedResult(inPeriod);

    const equityMovements = inPeriod
      .filter(m => m.type === 'EQUITY')
      .map(m => ({
        code: m.code,
        name: m.name,
        amount: presentedAmount(m.type, m.debit, m.credit),
      }))
      .filter(m => m.amount !== 0);

    const closingEquity = round2(openingEquity + profitForThePeriod + sum2(equityMovements.map(m => m.amount)));

    return {
      period: { from: range.from, to: range.to },
      openingEquity,
      profitForThePeriod,
      equityMovements,
      closingEquity,
      /**
       * IFRS for SMEs §3.18 permits the combined statement of income and retained
       * earnings in place of this statement and the statement of comprehensive
       * income, but only when the period's equity movements are limited to profit
       * or loss, dividends, corrections of errors and changes in accounting policy.
       * Capital introduced or drawings taken break that condition.
       */
      combinedStatementPermitted: equityMovements.length === 0,
    };
  }

  /**
   * Statement of cash flows for a period, indirect method (IFRS for SMEs §7.7).
   *
   * Built entirely from balance-sheet movements, so it reconciles to the actual
   * change in cash by construction. `reconciles` reports whether the three
   * activity subtotals sum to the movement on the cash and bank accounts; if they
   * do not, the ledger itself is unbalanced and the difference is shown rather
   * than absorbed.
   */
  async statementOfCashFlows(range: { from: string; to: string }) {
    const from = new Date(range.from);
    const to = new Date(range.to);
    const dayBefore = new Date(from);
    dayBefore.setDate(dayBefore.getDate() - 1);

    const opening = await this.movements(null, dayBefore);
    const closing = await this.movements(null, to);
    const inPeriod = await this.movements(from, to);

    const balanceAt = (ms: AccountMovement[]) => {
      const map = new Map<string, { m: AccountMovement; amount: number }>();
      for (const m of ms) map.set(m.code, { m, amount: presentedAmount(m.type, m.debit, m.credit) });
      return map;
    };
    const open = balanceAt(opening);
    const close = balanceAt(closing);

    const codes = new Set<string>([...open.keys(), ...close.keys()]);
    const operating: { code: string; name: string; amount: number }[] = [];
    const investing: { code: string; name: string; amount: number }[] = [];
    const financing: { code: string; name: string; amount: number }[] = [];
    let openingCash = 0;
    let closingCash = 0;

    for (const code of codes) {
      const ref = close.get(code) ?? open.get(code);
      if (!ref) continue;
      const m = ref.m;
      if (m.type === 'INCOME' || m.type === 'EXPENSE') continue; // handled through profit

      // Accumulated depreciation moves by exactly the depreciation charge, which
      // is added back to profit below. Letting its movement into investing as
      // well would count the same non-cash amount twice. Investing therefore
      // shows additions and disposals at cost only.
      if (isAccumulatedDepreciation(m.code, m.name)) continue;

      const before = open.get(code)?.amount ?? 0;
      const after = close.get(code)?.amount ?? 0;
      const movement = round2(after - before);
      const section = sectionFor(m.type, m.subtype);
      const klass = cashFlowClassFor(section, m.isBank, m.code);

      if (klass === 'CASH') {
        openingCash = round2(openingCash + before);
        closingCash = round2(closingCash + after);
        continue;
      }
      if (movement === 0) continue;

      // An asset rising consumes cash; a liability or equity rising provides it.
      const cashEffect = m.type === 'ASSET' ? round2(-movement) : movement;
      const entry = { code: m.code, name: m.name, amount: cashEffect };
      if (klass === 'OPERATING') operating.push(entry);
      else if (klass === 'INVESTING') investing.push(entry);
      else financing.push(entry);
    }

    const profitForThePeriod = this.accumulatedResult(inPeriod);

    // Depreciation is charged to profit but moves no cash, so it is added back.
    // The matching movement on accumulated depreciation is excluded from investing
    // above, so the charge is reflected exactly once.
    const depreciation = sum2(
      inPeriod
        .filter(m => m.code === '6600')
        .map(m => presentedAmount(m.type, m.debit, m.credit)),
    );

    const netOperating = round2(profitForThePeriod + depreciation + sum2(operating.map(o => o.amount)));
    const netInvesting = sum2(investing.map(o => o.amount));
    const netFinancing = sum2(financing.map(o => o.amount));
    const netMovement = round2(netOperating + netInvesting + netFinancing);
    const actualMovement = round2(closingCash - openingCash);
    const difference = round2(netMovement - actualMovement);

    return {
      period: { from: range.from, to: range.to },
      operating: {
        profitForThePeriod,
        adjustments: [{ code: '6600', name: 'Depreciation', amount: depreciation }].filter(a => a.amount !== 0),
        workingCapital: operating.sort((a, b) => a.code.localeCompare(b.code)),
        net: netOperating,
      },
      investing: { items: investing.sort((a, b) => a.code.localeCompare(b.code)), net: netInvesting },
      financing: { items: financing.sort((a, b) => a.code.localeCompare(b.code)), net: netFinancing },
      netMovement,
      openingCash,
      closingCash,
      actualMovement,
      difference,
      reconciles: difference === 0,
    };
  }

  /**
   * The complete set of financial statements for a financial year, plus the
   * integrity checks an auditor asks for first.
   *
   * `checks` is deliberately part of the payload rather than a separate endpoint.
   * A statement that does not balance, or a cash flow that does not reconcile, is
   * a fact about the accounts — it belongs with them, not behind another click.
   */
  async fullSet(args: { year: number; comparative?: boolean }) {
    const from = `${args.year}-01-01`;
    const to = `${args.year}-12-31`;
    const comparative = args.comparative ?? true;

    const [income, position, equity, cashFlows, unpostedCount, draftJournals] = await Promise.all([
      this.incomeStatement({ from, to, comparative }),
      this.statementOfFinancialPosition({ asAt: to, comparative }),
      this.statementOfChangesInEquity({ from, to }),
      this.statementOfCashFlows({ from, to }),
      this.prisma.journalEntry.count({ where: { status: 'DRAFT', date: { gte: new Date(from), lte: new Date(to) } } }),
      this.prisma.journalEntry.findMany({
        where: { status: 'DRAFT', date: { gte: new Date(from), lte: new Date(to) } },
        select: { entryNumber: true, date: true, memo: true },
        orderBy: { date: 'asc' },
        take: 20,
      }),
    ]);

    const equityTiesToPosition =
      round2(equity.closingEquity - position.totalEquity) === 0;

    return {
      entity: 'The Film Makers FZ LLC',
      year: args.year,
      period: { from, to },
      basis: 'IFRS for SMEs Accounting Standard',
      currency: 'AED',
      incomeStatement: income,
      statementOfFinancialPosition: position,
      statementOfChangesInEquity: equity,
      statementOfCashFlows: cashFlows,
      checks: {
        positionBalances: position.balances,
        positionDifference: position.difference,
        cashFlowReconciles: cashFlows.reconciles,
        cashFlowDifference: cashFlows.difference,
        equityTiesToPosition,
        equityDifference: round2(equity.closingEquity - position.totalEquity),
        draftJournalsInPeriod: unpostedCount,
        draftJournals,
        combinedStatementPermitted: equity.combinedStatementPermitted,
      },
    };
  }
}
