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
  // Nor does a REGISTER line: it is the author's own sentence and renders verbatim in
  // registerDirective(). Here it would be prefixed with a subject, and resolveCanonAt would keep ONE
  // line per section — it collapses facts that share subject + predicate, which every line of a
  // register does.
  let live = resolveCanonAt(facts.filter((f) => f && f.kind !== 'PROHIBITION' && f.kind !== 'REGISTER'), opts.at);
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

/**
 * THE SOURCE'S OWN REGISTER, VERBATIM — every line, grouped under the section it came from.
 *
 * Not a summary, not a selection: each line is the author's sentence exactly as written (only line
 * breaks inside a wrapped bullet are flattened, for layout). No resolveCanonAt, no cap, no dedupe
 * against the extracted facts — a line the model ALSO extracted appears twice, and that is cheaper
 * than any rule for deciding which of two wordings the author meant.
 */
export function registerDirective(facts: CanonFactCore[]): string {
  if (!Array.isArray(facts)) return '';
  const reg = facts.filter((f) => f && f.kind === 'REGISTER' && String(f.statement || '').trim())
    .slice().sort((a, b) => (a.sourceOffset ?? 0) - (b.sourceOffset ?? 0));
  if (!reg.length) return '';
  const out: string[] = [
    "THE SOURCE'S OWN RULES — transcribed VERBATIM from the source material, not summarised and not",
    'interpreted. Every line below is binding. Your output may not contradict any of them:',
  ];
  let section: string | null | undefined;
  for (const r of reg) {
    if (r.sourceSection !== section) {
      section = r.sourceSection;
      out.push('', '[' + (section || 'document') + ']');
    }
    out.push('- ' + String(r.statement).replace(/\s*\n\s*/g, ' ').trim());
  }
  return out.join('\n');
}
