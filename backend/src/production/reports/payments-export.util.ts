/**
 * Pure helpers for the NACHA/ACH + CSV payment-file export (no Nest/Prisma imports, so unit-testable).
 * PaymentsExportService imports these; the fixed-width formatting + ABA check-digit logic lives here.
 */
export const n = (v: any) => Number(v) || 0;
export const padR = (s: any, len: number) => String(s ?? '').slice(0, len).padEnd(len, ' ');
export const padL0 = (v: any, len: number) => String(Math.round(n(v))).slice(-len).padStart(len, '0');
export const digits = (s: any) => String(s ?? '').replace(/\D/g, '');

/** ABA routing-number check digit (the 9th digit) from the first 8 digits — the 3-7-1 weighted mod-10. */
export function abaCheckDigit(routing8: string): string {
  const d = digits(routing8).slice(0, 8).padStart(8, '0').split('').map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + 1 * (d[2] + d[5]);
  return String((10 - (sum % 10)) % 10);
}
