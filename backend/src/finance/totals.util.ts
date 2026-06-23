/**
 * Pure finance document-totals core (no Nest/Prisma imports, so unit-testable).
 * Shared by InvoicesService and QuotationsService.
 *
 * Key rule: a manual fixed deduction is applied BEFORE VAT — it reduces the taxable
 * base, so VAT is recalculated proportionally on the reduced base.
 */

export interface LineItemLike {
  quantity: number;
  unitPrice: number;
  days?: number;
  discountPct?: number;
  taxAmount?: number;
}

export interface DocumentTotals {
  subtotal: number;
  discountAmount: number;
  deductionAmount: number;
  vatAmount: number;
  total: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Fold line items into a pre-discount subtotal and the raw (pre-deduction) VAT. */
export function sumLineItems(items: LineItemLike[]): { subtotal: number; rawVat: number } {
  let subtotal = 0, rawVat = 0;
  for (const item of items || []) {
    const days = item.days || 1;
    subtotal += item.quantity * days * item.unitPrice * (1 - (item.discountPct || 0) / 100);
    rawVat += item.taxAmount || 0;
  }
  return { subtotal, rawVat };
}

/** Resolve a header-level discount: PERCENT of subtotal, FIXED amount, or none. */
export function resolveDiscount(subtotal: number, discountType?: string, discountValue?: number): number {
  if (discountType === 'PERCENT' && discountValue) return subtotal * (discountValue / 100);
  if (discountType === 'FIXED' && discountValue) return discountValue;
  return 0;
}

/**
 * Compute document totals from a subtotal + raw VAT, applying a header discount and a
 * pre-VAT deduction. The deduction is clamped to [0, taxableBase]; VAT scales by the
 * ratio of the post-deduction base to the taxable base.
 */
export function computeDocumentTotals(input: {
  subtotal: number;
  rawVat: number;
  discountAmount?: number;
  deductionAmount?: number;
}): DocumentTotals {
  const subtotal = input.subtotal;
  const disc = input.discountAmount || 0;
  const taxableBase = subtotal - disc;
  const deduction = Math.min(Math.max(input.deductionAmount || 0, 0), Math.max(taxableBase, 0));
  const vatRatio = taxableBase > 0 ? (taxableBase - deduction) / taxableBase : 0;
  const vatAmount = input.rawVat * vatRatio;
  const total = subtotal - disc - deduction + vatAmount;
  return { subtotal: r2(subtotal), discountAmount: r2(disc), deductionAmount: r2(deduction), vatAmount: r2(vatAmount), total: r2(total) };
}
