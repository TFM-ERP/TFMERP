/**
 * Pure money + date formatters for the collections (AR dunning) emails — no Nest/Prisma imports.
 * fmt: AED-style amount with 2 decimals; fmtD: short GB date, or an em-dash when absent.
 */
export const fmt = (n: any) => Number(n ?? 0).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtD = (d: any) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
