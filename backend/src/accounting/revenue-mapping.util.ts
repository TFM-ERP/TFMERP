/**
 * The single mapping from `Invoice.activity` to a GL revenue account.
 *
 * Imported by `AccountingService.postAll()` — which posts it — and by the revenue
 * matrix report — which groups by it. They must never disagree about which
 * revenue line an invoice belongs to, so the mapping exists exactly once.
 *
 * No Nest or Prisma imports, so it is unit-testable on its own.
 *
 * `BOTH` maps to its own account (4150) rather than being folded into Other or
 * arbitrarily assigned to Rental or Production. It is 91.8% of posted revenue and
 * nothing in the schema can substantiate a split: `InvoiceItem` has no activity
 * field, and its only proxy, `kind`, is `SERVICE` on every line item in the
 * database. Allocating it would be invention; giving it a named line keeps the
 * ambiguity visible on the face of the report. Decision recorded in
 * `src/reports/revenue-matrix.contract.md` §3.
 */

export type RevenueCode = '4000' | '4100' | '4150' | '4200';

/** Column order for the revenue matrix, and the accounts each column ties to. */
export const REVENUE_LINES: { code: RevenueCode; label: string; accountName: string }[] = [
  { code: '4000', label: 'Rental', accountName: 'Rental Revenue' },
  { code: '4100', label: 'Production', accountName: 'Production Services Revenue' },
  { code: '4150', label: 'Rental + Production', accountName: 'Rental & Production (combined)' },
  { code: '4200', label: 'Other', accountName: 'Other Income' },
];

/**
 * Invoice statuses that `postAll()` posts to the ledger.
 *
 * The revenue matrix filters on exactly this set. Any other filter breaks the
 * matrix-to-ledger invariant — note that `/reports/revenue-by-client` uses a
 * wider one (`notIn CANCELLED, DRAFT`), which also admits PENDING_APPROVAL,
 * VOIDED, REFUNDED and BAD_DEBT.
 */
export const POSTABLE_INVOICE_STATUSES = ['SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] as const;

/** Which GL revenue account an invoice's activity credits. Unknown activity falls to Other. */
export function revenueAccountFor(activity?: string | null): RevenueCode {
  switch (activity) {
    case 'RENTAL':
      return '4000';
    case 'PRODUCTION':
    case 'PRODUCTION_SERVICE':
      return '4100';
    case 'BOTH':
      return '4150';
    case 'BOOK_DESIGN':
    case 'WEB_DESIGN':
    case 'EVENTS':
      return '4200';
    default:
      return '4200';
  }
}
