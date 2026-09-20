/**
 * The single mapping from a GL account to the line it occupies on a statutory
 * financial statement.
 *
 * Companion to `revenue-mapping.util.ts` and `expense-mapping.util.ts`: the same
 * rule applies here — the mapping exists exactly once, so the statement of
 * financial position, the income statement and the notes can never disagree
 * about where an account belongs.
 *
 * No Nest or Prisma imports, so it is unit-testable on its own.
 *
 * Classification is driven by `GlAccount.subtype`, which `STANDARD_COA` already
 * sets on every seeded account ('Current Asset', 'Fixed Asset', 'Current
 * Liability', 'Long-term Liability', 'Equity', 'Operating Income', 'Other
 * Income', 'Cost of Sales', 'Operating Expense'). Subtype is used in preference
 * to the account code because codes are extensible by the user through
 * `createAccount()` while subtype is a closed set. An account created without a
 * subtype falls back to its type, which always yields a defensible — if coarse —
 * placement rather than dropping off the statement.
 *
 * Presentation follows the IFRS for SMEs Accounting Standard, Section 4
 * (statement of financial position) and Section 5 (statement of comprehensive
 * income), in the order a UAE auditor expects to read them.
 */

export type GlType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

/** Where a single account sits on the face of the statements. */
export type StatementSection =
  | 'CURRENT_ASSET'
  | 'NON_CURRENT_ASSET'
  | 'CURRENT_LIABILITY'
  | 'NON_CURRENT_LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'OTHER_INCOME'
  | 'COST_OF_SALES'
  | 'OPERATING_EXPENSE';

/** Which statement a section appears on. */
export const SECTION_STATEMENT: Record<StatementSection, 'SOFP' | 'PL'> = {
  CURRENT_ASSET: 'SOFP',
  NON_CURRENT_ASSET: 'SOFP',
  CURRENT_LIABILITY: 'SOFP',
  NON_CURRENT_LIABILITY: 'SOFP',
  EQUITY: 'SOFP',
  REVENUE: 'PL',
  OTHER_INCOME: 'PL',
  COST_OF_SALES: 'PL',
  OPERATING_EXPENSE: 'PL',
};

/** Heading shown for each section. */
export const SECTION_LABEL: Record<StatementSection, string> = {
  CURRENT_ASSET: 'Current assets',
  NON_CURRENT_ASSET: 'Non-current assets',
  CURRENT_LIABILITY: 'Current liabilities',
  NON_CURRENT_LIABILITY: 'Non-current liabilities',
  EQUITY: 'Equity',
  REVENUE: 'Revenue',
  OTHER_INCOME: 'Other income',
  COST_OF_SALES: 'Cost of sales',
  OPERATING_EXPENSE: 'Operating expenses',
};

/** Presentation order within each statement. Lower sorts first. */
export const SECTION_ORDER: Record<StatementSection, number> = {
  CURRENT_ASSET: 1,
  NON_CURRENT_ASSET: 2,
  CURRENT_LIABILITY: 3,
  NON_CURRENT_LIABILITY: 4,
  EQUITY: 5,
  REVENUE: 1,
  COST_OF_SALES: 2,
  OPERATING_EXPENSE: 3,
  OTHER_INCOME: 4,
};

/** Accounts whose normal balance is a debit. Mirrors `DEBIT_TYPES` in AccountingService. */
export const DEBIT_TYPES: GlType[] = ['ASSET', 'EXPENSE'];

/** Exact subtype to section. Keys are compared lower-cased and trimmed. */
const SUBTYPE_SECTIONS: Record<string, StatementSection> = {
  'current asset': 'CURRENT_ASSET',
  'fixed asset': 'NON_CURRENT_ASSET',
  'non-current asset': 'NON_CURRENT_ASSET',
  'current liability': 'CURRENT_LIABILITY',
  'long-term liability': 'NON_CURRENT_LIABILITY',
  'non-current liability': 'NON_CURRENT_LIABILITY',
  equity: 'EQUITY',
  'operating income': 'REVENUE',
  'other income': 'OTHER_INCOME',
  'cost of sales': 'COST_OF_SALES',
  'operating expense': 'OPERATING_EXPENSE',
};

/** Fallback when an account carries no subtype, or one nobody has classified. */
const TYPE_SECTIONS: Record<GlType, StatementSection> = {
  ASSET: 'CURRENT_ASSET',
  LIABILITY: 'CURRENT_LIABILITY',
  EQUITY: 'EQUITY',
  INCOME: 'REVENUE',
  EXPENSE: 'OPERATING_EXPENSE',
};

/**
 * Which statement section an account belongs to. Subtype wins; type is the
 * fallback. Never returns null — an unclassified account lands somewhere visible
 * rather than vanishing from the face of the statements, which is the failure
 * mode that matters.
 */
export function sectionFor(type: GlType, subtype?: string | null): StatementSection {
  const key = (subtype || '').trim().toLowerCase();
  return SUBTYPE_SECTIONS[key] ?? TYPE_SECTIONS[type] ?? 'OPERATING_EXPENSE';
}

/** Two-decimal rounding that does not drift on repeated addition. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Sum a list of numbers at two decimal places. */
export function sum2(values: number[]): number {
  return round2(values.reduce((s, v) => s + v, 0));
}

/**
 * The signed amount to present for an account, given its debit and credit totals.
 *
 * Returns the figure as it should READ on the statement, not the raw net. Assets
 * and expenses read positive when they carry a debit balance; liabilities, equity
 * and income read positive when they carry a credit balance. A contra account —
 * 1510 Accumulated Depreciation is the one in the standard chart — therefore
 * returns a negative, which is correct: it reduces the non-current asset total it
 * sits within.
 */
export function presentedAmount(type: GlType, debit: number, credit: number): number {
  const net = round2(debit - credit);
  return DEBIT_TYPES.includes(type) ? net : round2(-net);
}

/** Cash-flow classification for the indirect-method statement (IFRS for SMEs §7). */
export type CashFlowClass = 'OPERATING' | 'INVESTING' | 'FINANCING' | 'CASH';

/**
 * Which cash-flow activity a balance-sheet movement belongs to.
 *
 * Cash and bank accounts are the subject of the statement, not a movement within
 * it, so they classify as CASH and are excluded from the reconciling items.
 * Non-current assets are investing; equity and owner-account movements are
 * financing; everything else is working capital, hence operating.
 */
export function cashFlowClassFor(
  section: StatementSection,
  isBank: boolean,
  code: string,
): CashFlowClass {
  if (isBank || code === '1000' || code === '1010') return 'CASH';
  if (section === 'NON_CURRENT_ASSET') return 'INVESTING';
  if (section === 'EQUITY') return 'FINANCING';
  // 2400 Owner Account (Loan) is owner financing despite sitting in liabilities.
  if (code === '2400') return 'FINANCING';
  if (section === 'NON_CURRENT_LIABILITY') return 'FINANCING';
  return 'OPERATING';
}

/**
 * Whether an account is an accumulated-depreciation contra account.
 *
 * Matched on the standard code first, then on name, so a company that adds its
 * own accumulated-depreciation account under a different code is still handled.
 * Used by the cash-flow statement, which must exclude the movement on these
 * accounts because the depreciation charge is already added back to profit.
 */
export function isAccumulatedDepreciation(code: string, name: string): boolean {
  if (code === '1510') return true;
  return /accumulated\s+depreciation|accumulated\s+amorti[sz]ation/i.test(name);
}
