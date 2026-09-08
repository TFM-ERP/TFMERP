import type { CanonFactCore } from './canon.types';
import { resolveCanonAt } from './canon-resolve.util';

export function canonDirective(
  facts: CanonFactCore[],
  opts: { at: number; subjects?: string[]; max?: number },
): string {
  if (!Array.isArray(facts) || !facts.length || !opts) return '';
  // A PROHIBITION IS NOT A FACT AND MUST NOT RENDER IN THIS LIST. "Do not rename the hero" listed
  // under "CANON (honour — do not contradict)" reads as a statement about the story rather than a
  // rule about the output, and a model asked not to contradict it can satisfy that by writing about
  // the prohibition. They go to prohibitionDirective() instead, as constraints.
  let live = resolveCanonAt(facts.filter((f) => f && f.kind !== 'PROHIBITION'), opts.at);
  if (opts.subjects && opts.subjects.length) {
    const want = new Set(opts.subjects.map((s) => s.toUpperCase()));
    live = live.filter((x) => want.has(x.subject.toUpperCase()));
  }
  if (!live.length) return '';
  const max = opts.max ?? 40;
  const lines = live.slice(0, max).map((x) => `- ${x.subject} — ${x.statement}`.trim());
  return 'CANON (honour — do not contradict):\n' + lines.join('\n');
}

/**
 * PROHIBITIONS AS RULES ABOUT THE OUTPUT — deliberately not part of the canon list.
 *
 * A fact schema has no slot for a thing that must NOT happen, and the bibles this pipeline is fed
 * are full of them. Stating a prohibition as a fact inverts it: "the hero is never renamed" is a
 * claim the model can honour by describing a man who kept his name, while "do not rename the hero"
 * is an instruction it can only honour by not doing it.
 *
 * Placed LAST in the prompt and phrased as failure conditions, because that is where an instruction
 * carries most weight and because these are the constraints whose violation makes a draft unusable
 * rather than merely inaccurate.
 */
export function prohibitionDirective(facts: CanonFactCore[]): string {
  if (!Array.isArray(facts)) return '';
  const rules = facts.filter((f) => f && f.kind === 'PROHIBITION' && String(f.statement || '').trim());
  if (!rules.length) return '';
  const lines = rules.map((r) => '- ' + String(r.statement).trim());
  const head = [
    'ABSOLUTE CONSTRAINTS — these are rules about YOUR OUTPUT, not facts about the story.',
    'They are stated in the source material as things that must not happen. Violating any one of',
    'them makes the draft unusable, however good the rest is:',
  ];
  return head.concat(lines).join('\n');
}
