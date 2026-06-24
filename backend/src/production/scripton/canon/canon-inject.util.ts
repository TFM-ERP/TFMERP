import type { CanonFactCore } from './canon.types';
import { resolveCanonAt } from './canon-resolve.util';

export function canonDirective(
  facts: CanonFactCore[],
  opts: { at: number; subjects?: string[]; max?: number },
): string {
  if (!Array.isArray(facts) || !facts.length || !opts) return '';
  let live = resolveCanonAt(facts, opts.at);
  if (opts.subjects && opts.subjects.length) {
    const want = new Set(opts.subjects.map((s) => s.toUpperCase()));
    live = live.filter((x) => want.has(x.subject.toUpperCase()));
  }
  if (!live.length) return '';
  const max = opts.max ?? 40;
  const lines = live.slice(0, max).map((x) => `- ${x.subject} — ${x.statement}`.trim());
  return 'CANON (honour — do not contradict):\n' + lines.join('\n');
}
