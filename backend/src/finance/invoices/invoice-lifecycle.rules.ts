/**
 * When an invoice may be archived, voided or deleted.
 *
 * Pure functions: no Nest, no Prisma, no I/O. Everything here is a decision
 * about state, which is why it can be tested exhaustively without a database.
 *
 * The rule that matters: an invoice that has touched the ledger can never be
 * deleted, only voided. Deleting it would leave a hole nobody can see, and the
 * FTA requires records to be kept five years. Xero, QuickBooks, Oracle JD
 * Edwards and Dynamics all draw the line in exactly this place.
 */

export interface LifecycleState {
  /** InvoiceStatus as a plain string, so this module stays free of Prisma. */
  status: string;
  /** True when a POSTED journal entry exists with sourceType INVOICE for it. */
  hasJournal: boolean;
  /** Count of Payment rows, direction RECEIPT, status CLEARED, against it. */
  clearedReceipts: number;
  archivedAt: Date | null;
}

export type Verdict =
  | { allowed: true }
  | { allowed: false; reason: string; suggest?: 'VOID' | 'ARCHIVE' };

const ALLOW: Verdict = { allowed: true };

/** The only statuses an invoice may be deleted from. */
export const DELETABLE_STATUSES: readonly string[] = ['DRAFT', 'CANCELLED'];

const receipts = (n: number): string =>
  `${n} cleared receipt${n === 1 ? '' : 's'} are recorded against this invoice`;

export function canDelete(state: LifecycleState): Verdict {
  if (state.hasJournal) {
    return {
      allowed: false,
      reason:
        'This invoice has a posted journal entry, so it is already in the ledger. ' +
        'Deleting it would remove money from the accounts without a trace. Void it instead.',
      suggest: 'VOID',
    };
  }
  if (state.clearedReceipts > 0) {
    return {
      allowed: false,
      reason:
        `${receipts(state.clearedReceipts)}. Reverse or refund them first, ` +
        'then the invoice can be voided.',
      suggest: 'VOID',
    };
  }
  if (!DELETABLE_STATUSES.includes(state.status)) {
    return {
      allowed: false,
      reason:
        `An invoice at status ${state.status} has been issued to a customer. ` +
        `Only ${DELETABLE_STATUSES.join(' or ')} invoices can be deleted.`,
      suggest: 'VOID',
    };
  }
  return ALLOW;
}

export function canVoid(state: LifecycleState): Verdict {
  if (state.status === 'VOIDED') {
    return { allowed: false, reason: 'This invoice is already voided.' };
  }
  if (state.clearedReceipts > 0) {
    return {
      allowed: false,
      reason:
        `${receipts(state.clearedReceipts)}. Voiding would leave money in the bank ` +
        'with nothing to match it against. Reverse or refund the receipts first.',
    };
  }
  return ALLOW;
}

export function canArchive(state: LifecycleState): Verdict {
  if (state.archivedAt !== null) {
    return { allowed: false, reason: 'This invoice is already archived.' };
  }
  return ALLOW;
}

/**
 * Turns a posted journal entry's lines into the lines of its reversal: debit
 * becomes credit and credit becomes debit, line for line. Nothing is
 * re-derived from the invoice — only the entry that was actually posted is
 * mirrored, so the reversal is exact even if the invoice was edited or the
 * chart of accounts changed since.
 *
 * This is why the result always balances: for any set of lines (balanced or
 * not), swapping every debit and credit swaps the two totals, so the new
 * debit total equals the old credit total and vice versa. A balanced input
 * (debit total == credit total) therefore reverses to an equally balanced
 * output — see invoice-lifecycle.rules.spec.ts.
 */
export function buildReversalLines<D>(
  lines: ReadonlyArray<{
    accountId: string;
    debit: D;
    credit: D;
    description?: string | null;
  }>,
): Array<{ accountId: string; debit: D; credit: D; description: string; sortOrder: number }> {
  return lines.map((line, i) => ({
    accountId: line.accountId,
    debit: line.credit,
    credit: line.debit,
    description: `Reversal — ${line.description ?? ''}`.trim(),
    sortOrder: i,
  }));
}
