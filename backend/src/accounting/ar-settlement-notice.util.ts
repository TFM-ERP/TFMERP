/**
 * The settlement caveat carried by every receivables report.
 *
 * `Invoice.amountPaid` / `amountDue` live on the invoice. `Payment` is a separate
 * table, and `postAll()` posts cash from `Payment` only. Nothing keeps the two in
 * step, so an invoice can claim to be settled with no receipt behind it.
 *
 * That is exactly what happened here. `backend/tools/import-history.js` imported
 * 18 invoices from filed VAT returns and hardcoded, per row:
 *
 *     status: 'PAID',  amountPaid: total,  amountDue: 0
 *
 * with no `Payment` row created. A VAT return declares output tax on supplies
 * *made* — it is an accrual document and says nothing about cash *collected*.
 * So the settlement is an assertion, not evidence.
 *
 * The consequence runs the opposite way to the obvious reading: ageing does not
 * overstate what is owed, it **understates** it. It reports `amountDue`, which
 * those rows set to zero. The general ledger — which only ever saw the invoice —
 * is the more honest of the two.
 *
 * Pure: no Nest, no Prisma types. `collectArSettlementFacts` below is the one
 * impure helper, kept here so the two receivables endpoints cannot drift apart
 * in how they measure this.
 */

export interface ArSettlementFacts {
  /** Rows in the `Payment` table. */
  paymentCount: number;
  /** Debit-minus-credit balance of GL 1100 Accounts Receivable. */
  glReceivable: number;
  /** Sum of `amountDue` over open invoices — what the ageing report totals. */
  subLedgerOpen: number;
  /** Sum of `amountPaid` over invoices with NO Payment row behind them. */
  assertedSettlement: number;
  /** How many invoices that is. */
  assertedInvoiceCount: number;
}

export interface ArSettlementNotice {
  level: 'warning';
  /** `asserted` = settlement with no receipt. `unreconciled` = a gap despite payments. */
  kind: 'asserted' | 'unreconciled';
  headline: string;
  detail: string;
  glReceivable: number;
  subLedgerOpen: number;
  unpostedSettlement: number;
  assertedSettlement: number;
  assertedInvoiceCount: number;
  paymentCount: number;
}

/** Two-decimal comparison; these are Decimal(15,2) values arriving as numbers. */
const cents = (n: number) => Math.round(n * 100);
const money = (n: number) => n.toFixed(2);

/**
 * Returns the notice, or `null` when receivables reconcile and no settlement is
 * merely asserted — so the badge clears itself once payments are entered.
 */
export function arSettlementNotice(facts: ArSettlementFacts): ArSettlementNotice | null {
  const gap = facts.glReceivable - facts.subLedgerOpen;
  const asserted = cents(facts.assertedSettlement) !== 0;
  if (cents(gap) === 0 && !asserted) return null;

  const base = {
    level: 'warning' as const,
    glReceivable: facts.glReceivable,
    subLedgerOpen: facts.subLedgerOpen,
    unpostedSettlement: Math.round(gap * 100) / 100,
    assertedSettlement: Math.round(facts.assertedSettlement * 100) / 100,
    assertedInvoiceCount: facts.assertedInvoiceCount,
    paymentCount: facts.paymentCount,
  };

  if (asserted) {
    return {
      ...base,
      kind: 'asserted',
      headline: 'Settlement is asserted, not evidenced — receivables may be understated',
      detail:
        `${facts.assertedInvoiceCount} invoice(s) carry amountPaid totalling ` +
        `${money(facts.assertedSettlement)} with no payment record behind them` +
        (facts.paymentCount === 0 ? ' (the Payment table is empty)' : '') +
        `. Those values were written by backend/tools/import-history.js, which hardcodes ` +
        `status: 'PAID' and amountPaid: total for every row imported from a filed VAT ` +
        `return — a return declares tax on supplies made, not cash collected. Ageing below ` +
        `reflects that assertion, so it may understate what is genuinely owed. The general ` +
        `ledger shows Accounts Receivable of ${money(facts.glReceivable)} and Bank of 0.00, ` +
        `which is what the evidence actually supports. Confirm settlement against bank ` +
        `records before treating any invoice here as collected.`,
    };
  }

  return {
    ...base,
    kind: 'unreconciled',
    headline: 'Receivables do not reconcile to the ledger',
    detail:
      `General ledger Accounts Receivable is ${money(facts.glReceivable)} against ` +
      `${money(facts.subLedgerOpen)} outstanding here, a difference of ${money(gap)}. ` +
      `Some settlement is recorded on the invoice but not posted to the ledger.`,
  };
}

/** Minimal structural view of the Prisma client, so this stays stubbable in tests. */
interface ArPrismaLike {
  payment: { count(args?: any): Promise<number> };
  invoice: { findMany(args: any): Promise<{ amountPaid: any }[]> };
  glAccount: { findUnique(args: any): Promise<{ id: string } | null> };
  journalLine: { aggregate(args: any): Promise<{ _sum: { debit: any; credit: any } }> };
}

/**
 * Gather the facts from the database. Shared by `/reports/ar-aging` and
 * `/finance/collections/aging` so the two can never measure this differently.
 */
export async function collectArSettlementFacts(
  prisma: ArPrismaLike,
  subLedgerOpen: number,
): Promise<ArSettlementFacts> {
  const [paymentCount, arAccount, assertedRows] = await Promise.all([
    prisma.payment.count({ where: { direction: 'RECEIPT' } }),
    prisma.glAccount.findUnique({ where: { code: '1100' } }),
    // Settlement claimed on the invoice with nothing in Payment to support it.
    prisma.invoice.findMany({
      where: { amountPaid: { gt: 0 }, payments: { none: {} } },
      select: { amountPaid: true },
    }),
  ]);

  let glReceivable = 0;
  if (arAccount) {
    const s = await prisma.journalLine.aggregate({
      where: { accountId: arAccount.id, entry: { status: 'POSTED' } },
      _sum: { debit: true, credit: true },
    });
    glReceivable = Number(s._sum.debit ?? 0) - Number(s._sum.credit ?? 0);
  }

  return {
    paymentCount,
    glReceivable,
    subLedgerOpen,
    assertedSettlement: assertedRows.reduce((t, r) => t + Number(r.amountPaid ?? 0), 0),
    assertedInvoiceCount: assertedRows.length,
  };
}
