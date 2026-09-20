/**
 * Pure lifecycle helpers for the invoice detail page (archive/void/delete), extracted out of
 * page.tsx.
 *
 * page.tsx is a 'use client' React component file (.tsx). Node's `node --test` runner strips
 * TypeScript *types* but has no JSX transform, so a test whose import chain reaches a .tsx file
 * dies with ERR_UNKNOWN_FILE_EXTENSION — see frontend/src/test-support/README.md. This module has
 * no React import and nothing here touches the DOM, `window`, or the system clock directly, so it
 * can be imported straight into a plain node:test file: see invoice-lifecycle.logic.test.ts.
 *
 * `computeLockoutUntil` below takes `now` as a parameter rather than reading `Date.now()` itself —
 * page.tsx used to write `Date.now() + parseLockoutMinutes(message) * 60000` inline at both call
 * sites; that arithmetic is pulled out here with the clock as an explicit input so it is testable
 * without faking the system clock, and page.tsx now just passes `Date.now()` in.
 */

/**
 * The five-wrong-passwords lockout (InvoicesService.assertPassword) throws a 403 whose
 * message is `Too many failed attempts. Try again in ${minutes} minute(s).` — this pulls
 * the number back out so the dialog can show a real clock time instead of a countdown.
 * Falls back to 15 (the server's LOCK_MS) if the message shape ever changes.
 */
export function parseLockoutMinutes(message?: string): number {
  if (!message) return 15;
  const m = message.match(/(\d+)\s*minute/);
  return m ? parseInt(m[1], 10) : 15;
}

/**
 * The timestamp a lockout started `now` ends at, given the 403's message. Pure: `now` is a
 * parameter, not an internal `Date.now()` read (see header comment above).
 */
export function computeLockoutUntil(message: string | undefined, now: number): number {
  return now + parseLockoutMinutes(message) * 60000;
}

/**
 * A 403 alone doesn't mean the five-wrong-passwords lockout fired — RequirePermission
 * also returns 403, e.g. when a role changes mid-session. Only treat it as the lockout
 * when the message actually looks like the one InvoicesService.assertPassword throws:
 * `Too many failed attempts. Try again in ${minutes} minute(s).`
 * (backend/src/finance/invoices/invoices.service.ts, InvoicesService.assertPassword).
 */
export function isLockoutMessage(message?: string): boolean {
  return !!message && /^Too many failed attempts\./.test(message);
}

/**
 * Pulls the date and reason back out of `internalNotes` for a voided invoice.
 *
 * The Invoice model has no voidedAt, voidedBy or voidReason column — confirmed by
 * reading prisma/schema.prisma — and GET /finance/invoices/:id does not include audit
 * log rows. The only place the void's date and reason genuinely survive on the object
 * this page already has is the stamp InvoicesService.voidInvoice concatenates onto
 * internalNotes: `[VOIDED YYYY-MM-DD] <reason>` optionally followed by
 * ` Reversed by journal <entryNumber> against <entryNumber>.`. There is no voided-by
 * user anywhere in the response, so the banner never claims one.
 */
export function parseVoidStamp(
  notes: string | null | undefined,
): { date: string; reason: string; reversed: boolean } | null {
  if (!notes) return null;
  const m = notes.match(/\[VOIDED (\d{4}-\d{2}-\d{2})\]\s*([\s\S]*)/);
  if (!m) return null;
  let reason = m[2];
  const idx = reason.indexOf(' Reversed by journal ');
  const reversed = idx !== -1;
  if (reversed) reason = reason.slice(0, idx);
  return { date: m[1], reason: reason.trim(), reversed };
}

/**
 * Mirrors DELETABLE_STATUSES in backend/src/finance/invoices/invoice-lifecycle.rules.ts —
 * canDelete() refuses every other status. Kept in sync by hand since page.tsx has no import
 * path into that backend-only module (this module's own test file imports it directly to
 * catch drift between the two lists — see invoice-lifecycle.logic.test.ts).
 */
export const DELETABLE_STATUSES: readonly string[] = ['DRAFT', 'CANCELLED'];

/** Whether MoreMenu offers Delete for an invoice at this status. */
export function isInvoiceDeletable(status: string): boolean {
  return DELETABLE_STATUSES.includes(status);
}
