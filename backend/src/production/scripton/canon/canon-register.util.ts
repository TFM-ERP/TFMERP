import type { CanonFactCore } from './canon.types';
import { sectionsOf, sectionAt } from './canon-locate.util';

/**
 * REGISTER SECTIONS ARE TRANSCRIBED, NOT EXTRACTED.
 *
 * §29 Continuity foundations is 53 bullets. Extraction turned it into 9 to 11 facts, and the ladder
 * that ran on those facts produced 23 violations of it. Section coverage is not rule coverage: a
 * section can be "reached" by the canon while most of its lines are not, because extraction samples
 * and summarises by design. A register — a section whose body IS a list of rules — must not be
 * sampled at all. Every line of it goes to the prompt verbatim, and none of it is budgeted.
 *
 * THREE SHAPES, each measured on the real bible (105,179 characters) before any rule was written:
 *
 *   BULLET REGISTER  a top-level section most of whose lines are bullets. §29 is 53 of 53. The next
 *                    highest top-level section is §26 at 4 of 14. "Research grounding" is 6 of 7
 *                    but it is a SUBSECTION (###) of research citations with URLs — the level is
 *                    what excludes it, not a count threshold.
 *   LINE REGISTER    a top-level section most of whose lines open with an imperative. §31 is 9 of
 *                    10 and has no bullets at all, so bullet detection alone never finds it. The
 *                    next highest is §0 at 6 of 17. Every line of the section is transcribed,
 *                    including the one that does not open with an imperative ("His growth should…").
 *   RULE LINES       everywhere else, a line containing a sentence that opens with a strict
 *                    prohibition — "Do not", "Never", "Avoid", "There is no". The rules inside the
 *                    character entries are written mid-paragraph ("Dev carries the central
 *                    accounting-witness function. Do not introduce a second endangered keeper…"),
 *                    so they are found by sentence and transcribed by LINE: the line is the author's
 *                    own unit, and it carries the antecedent — "Do not introduce HIM again" is only
 *                    usable next to "Musa remains outside QMG custody".
 *
 * KNOWN GAP, STATED RATHER THAN PAPERED OVER. "He is not redeemed by usefulness" (§17) and "Her
 * future contains accountability, not automatic membership in Jason's team" (§19) are rules written
 * as description, and no precise opener catches them. Widening to any negation matches 201 sentences
 * on this bible against 23 for the strict openers — the register would become the document. Those
 * two reach the prompt only through extraction.
 *
 * NOTHING HERE IS A MODEL CALL, a budget or a sample. The same source always yields the same
 * register, which is why it is versioned separately from the paid extraction: changing a detection
 * rule re-transcribes for free and never re-extracts.
 *
 * Pure and dependency-free apart from the section index it shares with the locator, so a register
 * line carries exactly the section label a located fact would.
 */

/** Bump when a detection rule changes. Independent of CANON_EXTRACTOR_VERSION — see above. */
export const REGISTER_VERSION = 1;

const BULLET = /^\s*[-*•]\s+/;
/** Opens a LINE of a line register. Only ever tested against a whole top-level section. */
const IMPERATIVE = /^(Do not|Don['’]t|Never|Avoid|Let|Allow|Keep|Make|Give|Use|Preserve|Resolve|Show|Treat|Ensure|Maintain|Remember|Include|Introduce|Reserve|Withhold|Protect|Limit)\b/;
/** Opens a RULE SENTENCE anywhere in the document. Strict on purpose — see the known gap above. */
const RULE_OPENER = /^(Do not|Don['’]t|Never|Avoid|There is no|There are no)\b/;
/** Sentence boundary: terminal punctuation, an optional closing quote, space, then a capital or an opening quote. */
const SENTENCE_BREAK = /(?<=[.!?]["”’)]?)\s+(?=["“‘(A-Z])/;

export type RegisterShape = 'bullets' | 'lines';

export interface RegisterSectionReport {
  section: string;
  shape: RegisterShape;
  /** Bullet lines in a bullet register; lines in a line register. */
  counted: number;
  /** Non-empty lines in the section body. */
  lines: number;
  facts: number;
}

export interface RegisterReport {
  version: number;
  /** The heading level registers are read at (the document's own top level), or null if none. */
  level: number | null;
  registers: RegisterSectionReport[];
  ruleLines: { facts: number; sentences: number; sections: { section: string; facts: number }[] };
  total: number;
  /** "29. Continuity foundations: 53 bullets → 53 facts · …" — what the verification reads. */
  summary: string;
}

interface Line { text: string; at: number }
interface Heading { level: number; title: string; at: number; body: Line[] }

function headingsOf(src: string): { preamble: Line[]; heads: Heading[] } {
  const preamble: Line[] = [];
  const heads: Heading[] = [];
  let at = 0;
  for (const raw of src.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const m = /^\s*(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) heads.push({ level: m[1].length, title: m[2], at, body: [] });
    else if (line.trim()) (heads.length ? heads[heads.length - 1].body : preamble).push({ text: line, at });
    at += raw.length + 1;
  }
  return { preamble, heads };
}

/** The document's own top level: the shallowest heading level that holds more than one section. */
function topLevel(heads: Heading[]): number | null {
  const n = new Map<number, number>();
  for (const h of heads) n.set(h.level, (n.get(h.level) || 0) + 1);
  const levels = [...n.keys()].sort((a, b) => a - b);
  for (const l of levels) if ((n.get(l) || 0) >= 2) return l;
  return null;
}

/** Trim a line to its content and return the offset the content starts at, so the fact is verbatim. */
function content(line: Line): { text: string; at: number } {
  const lead = line.text.length - line.text.trimStart().length;
  const marker = BULLET.exec(line.text);
  const start = marker ? marker[0].length : lead;
  return { text: line.text.slice(start).trimEnd(), at: line.at + start };
}

function sentencesOf(text: string): string[] {
  return text.split(SENTENCE_BREAK).map((s) => s.trim()).filter(Boolean);
}

export function transcribeRegister(source: string): { facts: CanonFactCore[]; report: RegisterReport } {
  const src = typeof source === 'string' ? source : '';
  const index = sectionsOf(src);
  const { preamble, heads } = headingsOf(src);
  const level = topLevel(heads);
  const facts: CanonFactCore[] = [];
  const registers: RegisterSectionReport[] = [];
  const inRegister = new Set<Heading>();

  const push = (c: { text: string; at: number }, predicate: string, object: string) => {
    if (!c.text) return;
    const section = sectionAt(index, c.at);
    facts.push({
      kind: 'REGISTER',
      subject: section || '(document)',
      predicate,
      object,
      statement: c.text,             // VERBATIM. No slice, no normalisation, no rewording.
      validFrom: 0,
      validTo: null,
      status: 'ACTIVE',
      sourceOffset: c.at,
      sourceSection: section,
      sourceProvenance: 'located',
    });
  };

  if (level != null) {
    for (const h of heads) {
      if (h.level !== level || !h.body.length) continue;
      const lines = h.body.length;
      const bullets = h.body.filter((l) => BULLET.test(l.text)).length;
      const imperative = h.body.filter((l) => IMPERATIVE.test(l.text.trim().replace(BULLET, ''))).length;
      if (bullets * 2 > lines) {
        // A bullet that wraps onto a following unmarked line is one bullet, not two half-facts.
        let items: { text: string; at: number }[] = [];
        let prev: Line | null = null;
        for (const l of h.body) {
          const contiguous = prev && src.slice(prev.at + prev.text.length, l.at).split('\n').length === 2;
          if (!BULLET.test(l.text) && items.length && contiguous) {
            const last = items[items.length - 1];
            last.text = src.slice(last.at, l.at + l.text.trimEnd().length);
          } else items.push(content(l));
          prev = l;
        }
        items = items.filter((c) => c.text.trim());
        for (const c of items) push(c, 'register_bullet', '');
        registers.push({ section: h.title, shape: 'bullets', counted: bullets, lines, facts: items.length });
        inRegister.add(h);
      } else if (imperative * 2 > lines) {
        for (const l of h.body) push(content(l), 'register_line', '');
        registers.push({ section: h.title, shape: 'lines', counted: lines, lines, facts: lines });
        inRegister.add(h);
      }
    }
  }

  // RULE LINES — every line outside a register that states a strict prohibition.
  const ruleBySection = new Map<string, number>();
  let ruleSentences = 0;
  const scan = (lines: Line[]) => {
    for (const l of lines) {
      const c = content(l);
      const hits = sentencesOf(c.text).filter((s) => RULE_OPENER.test(s));
      if (!hits.length) continue;
      ruleSentences += hits.length;
      push(c, 'register_rule', hits.join(' '));
      const s = sectionAt(index, c.at) || '(document)';
      ruleBySection.set(s, (ruleBySection.get(s) || 0) + 1);
    }
  };
  scan(preamble);
  for (const h of heads) if (!inRegister.has(h)) scan(h.body);

  facts.sort((a, b) => (a.sourceOffset as number) - (b.sourceOffset as number));

  const ruleFacts = [...ruleBySection.values()].reduce((a, b) => a + b, 0);
  const parts = registers.map((r) => r.section + ': ' + r.counted + ' ' + (r.shape === 'bullets' ? 'bullets' : 'lines') + ' → ' + r.facts + ' facts');
  parts.push('rule lines: ' + ruleFacts + ' from ' + ruleBySection.size + ' sections (' + ruleSentences + ' rule sentences)');
  const report: RegisterReport = {
    version: REGISTER_VERSION,
    level,
    registers,
    ruleLines: { facts: ruleFacts, sentences: ruleSentences, sections: [...ruleBySection].map(([section, n]) => ({ section, facts: n })) },
    total: facts.length,
    summary: (level == null ? 'no top-level sections — registers not detected · ' : '') + parts.join(' · ') + ' · total ' + facts.length + ', all undroppable',
  };
  return { facts, report };
}
