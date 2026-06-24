/**
 * Screenplay page math (pure; no Nest/Prisma imports, so unit-testable).
 * pagesToEighthsLabel: decimal pages → the industry "2 4/8" eighths label.
 * estimateEighthsPages: rough decimal-page estimate from a scene's body length (~1400 chars/page), min 1/8.
 */
export function pagesToEighthsLabel(p: number): string {
  let whole = Math.floor(p);
  let e = Math.round((p - whole) * 8);
  if (e === 8) { whole += 1; e = 0; } // carry: 8/8 of a page is a whole page
  return `${whole || (e ? '' : '0')}${e ? ` ${e}/8` : ''}`.trim() || '0';
}

export function estimateEighthsPages(body: string): number {
  const eighths = Math.max(1, Math.round(((body || '').length / 1400) * 8));
  return Math.round((eighths / 8) * 1000) / 1000;
}
