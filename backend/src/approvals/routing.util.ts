/**
 * Pure approval-routing core (no Nest/Prisma imports, so unit-testable).
 * Used by ApprovalsService for expenses and purchase orders.
 */

/** Approval ladder by amount (AED). Each tier defines the ordered approver roles. */
export function chainForAmount(amount: number): string[] {
  if (amount <= 5000) return ['Finance Manager'];
  if (amount <= 25000) return ['Finance Manager', 'General Manager'];
  return ['Finance Manager', 'General Manager', 'Director'];
}
