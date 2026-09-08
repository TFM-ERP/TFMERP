import type { CanonFactCore } from './canon.types';

/**
 * WHERE IN THE SOURCE EACH FACT CAME FROM — coverage you can see, instead of a count inside noise.
 *
 * The prohibition COUNT read 23, then 20, then 22 across three identical extractions of the same
 * bible. All noise, and it could not answer the only question that mattered: whether §29 Continuity
 * foundations and §31 Rules for keeping Jason distinctive — which sat beyond the old 60,000-character
 * slice and had never been read by anything — now reach the canon at all. A one-off script answered
 * it once (23 of 75 located facts lay beyond the old cut, 10 of them prohibitions). Storing the
 * answer makes it answerable for every build, by anyone, without a script and without a model call.
 *
 * IT REPORTS, IT NEVER GATES. Locating a fact is a text search and text searches fail honestly: a
 * model that paraphrases rather than quotes leaves nothing to find. `null` therefore means "not
 * located", never "not in the source" — the difference matters, and conflating them would turn a
 * reporting aid into a censor that deletes the facts it cannot match.
 *
 * Pure and dependency-free.
 */

export interface SourceSection {
  /** Character offset where the section's heading begins. */
  at: number;
  /** The heading text, trimmed of its marker. */
  title: string;
}

/**
 * WHAT THE RECORD KNOWS ABOUT WHERE A FACT CAME FROM.
 *
 * `unlocated` and `synthesis` used to share a null, and they are not the same finding. A synthesis
 * draws on two or more passages and legitimately has no single offset — often the most valuable
 * facts are exactly these ("Gideon expanded the operation. Alexander kept it survivable."). An
 * unlocated fact matches nothing anywhere, and that is the shape an invention takes. Collapsing them
 * means a reader scanning for inventions is handed syntheses to wade through, and the one number
 * that should alarm them is diluted by the healthy case.
 */
export type FactProvenance = 'located' | 'synthesis' | 'unlocated';

export interface FactLocation {
  /** Character offset of the matched text. Null for a synthesis and for an unlocated fact alike. */
  at: number | null;
  /** Title of the section the match falls in, or null. */
  section: string | null;
  provenance: FactProvenance;
  /** For a synthesis: the sections its parts were found in, in document order. */
  parts?: { at: number; section: string | null }[];
}

/**
 * Section boundaries in a source document.
 *
 * Markdown headings first, because that is what these bibles are. Falls back to numbered and
 * all-caps heading lines so a plain-text document is not simply reported as one section. A document
 * with no headings at all yields an empty list, and everything then locates with a null section but
 * a real offset — still useful, because the offset alone says how deep into the document it lies.
 */
export function sectionsOf(source: string): SourceSection[] {
  const src = typeof source === 'string' ? source : '';
  if (!src) return [];
  const out: SourceSection[] = [];
  let at = 0;
  for (const line of src.split('\n')) {
    const t = line.trim();
    const md = /^(#{1,3})\s+(.{1,90})$/.exec(t);
    if (md) out.push({ at, title: md[2].trim() });
    else if (/^\d{1,2}[.)]\s+\S.{2,80}$/.test(t)) out.push({ at, title: t });
    else if (t.length > 6 && t.length < 70 && t === t.toUpperCase() && /[A-Z]{4}/.test(t) && !/[.!?]$/.test(t)) {
      out.push({ at, title: t });
    }
    at += line.length + 1;
  }
  return out;
}

/** The section a character offset falls inside. */
export function sectionAt(sections: SourceSection[], offset: number): string | null {
  if (!Array.isArray(sections) || !sections.length || typeof offset !== 'number' || offset < 0) return null;
  let best: SourceSection | null = null;
  for (const s of sections) { if (s.at <= offset) best = s; else break; }
  return best ? best.title : null;
}

const MIN_PROBE = 14;   // shorter than this matches half the document and means nothing

/**
 * Normalise for comparison only — never for storage, and offsets are reported against the ORIGINAL.
 *
 * Two shapes accounted for five "not located" facts on a real extraction, and neither was a
 * synthesis: a quote captured with its trailing comma inside it ("Adrian delivers Jason into the
 * setup,") which no longer matches the source, and curly quotes in the document against straight
 * ones in the statement. Reporting those as unlocated is worse than useless — it inflates the number
 * a reader is meant to scan for inventions with matches that simply failed on punctuation.
 */
const norm = (s: string): string => s
  .replace(/[‘’‛′]/g, "'")
  .replace(/[“”‟″]/g, '"')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ');

/** Trailing punctuation belongs to the sentence that quoted it, not to the quoted text. */
const trimEdges = (s: string): string => s.replace(/^[\s"'.,;:—-]+/, '').replace(/[\s"'.,;:—-]+$/, '');

/**
 * Locate one fact in the source.
 *
 * QUOTED TEXT FIRST, longest first. The extraction prompt asks for statements that quote the source
 * where it is explicit, so a quoted run is both the most reliable anchor and the strongest evidence
 * that the fact was read rather than composed. Only if there is no usable quote does it fall back to
 * a distinctive prefix of the statement, which finds verbatim facts and misses paraphrases — as it
 * should, because a paraphrase genuinely is not in the source as written.
 */
export function locateFact(source: string, sections: SourceSection[], fact: CanonFactCore | { statement?: string }): FactLocation {
  const src = typeof source === 'string' ? source : '';
  const st = String((fact && (fact as any).statement) || '');
  if (!src || !st) return { at: null, section: null, provenance: 'unlocated' };

  // The search runs on normalised text; the OFFSET RETURNED IS INTO THE ORIGINAL, via an index map,
  // because a reader following the number back into the document must land where the text is.
  const map: number[] = [];
  let flat = '';
  {
    const n = norm(src);
    // norm only collapses whitespace runs and swaps single characters, so walk both in step.
    let i = 0;
    for (let j = 0; j < n.length; j++) {
      while (i < src.length && norm(src[i]) === '' ) i++;
      map[j] = Math.min(i, src.length - 1);
      // advance past the source characters this normalised character consumed
      if (n[j] === ' ') { while (i < src.length && /\s/.test(src[i])) i++; } else { i++; }
    }
    flat = n;
  }
  const find = (probe: string): number => {
    const p = trimEdges(norm(probe));
    if (p.length < MIN_PROBE) return -1;
    const at = flat.indexOf(p);
    return at >= 0 ? (map[at] ?? at) : -1;
  };

  const quotes: string[] = [];
  const re = /["“”'']([^"“”'']{12,})["“”'']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(st))) quotes.push(m[1]);
  quotes.sort((a, b) => b.length - a.length);

  // Every quote is located, not just the first that hits — because WHICH ONES matched is the
  // difference between a fact read off one passage and a fact composed from several.
  const hits: { at: number; section: string | null }[] = [];
  for (const q of quotes) {
    const at = find(q.slice(0, 60));
    if (at >= 0) hits.push({ at, section: sectionAt(sections, at) });
  }
  if (hits.length === 1) return { at: hits[0].at, section: hits[0].section, provenance: 'located' };
  if (hits.length > 1) {
    // A SYNTHESIS, and it is a healthy finding rather than a failure. Two or more quoted passages
    // that each exist in the source, drawn together into one statement — "Gideon expanded the
    // operation. Alexander kept it survivable." Reporting it as unlocated, beside the facts that
    // match nothing at all, buries the one number that should alarm a reader.
    hits.sort((a, b) => a.at - b.at);
    const far = hits[hits.length - 1].at - hits[0].at;
    const sections2 = new Set(hits.map((h) => h.section));
    if (far > 400 || sections2.size > 1) {
      return { at: null, section: null, provenance: 'synthesis', parts: hits };
    }
    return { at: hits[0].at, section: hits[0].section, provenance: 'located' };   // same passage, quoted twice
  }
  const at = find(st.replace(/["“”'']/g, '').trim().slice(0, 40));
  if (at >= 0) return { at, section: sectionAt(sections, at), provenance: 'located' };
  return { at: null, section: null, provenance: 'unlocated' };
}

export interface CoverageReport {
  located: number;
  /** Composed from two or more passages that DO exist in the source. A healthy finding. */
  synthesis: number;
  /** Matched nothing anywhere. This is the number to read — an invention takes this shape. */
  unlocated: number;
  /** Facts per section title, in document order. */
  bySection: { section: string; at: number; facts: number }[];
  /** Statements that matched nothing at all. Syntheses are deliberately NOT in here. */
  unlocatedStatements: string[];
}

/**
 * Attach a location to every fact and summarise the coverage.
 *
 * UNLOCATED IS A FINDING, NOT AN ERROR. A statement that cannot be found in the source is either a
 * synthesis across passages — legitimate, and often the most valuable kind of fact — or an
 * invention, which is the one failure the canon exists to prevent. The record cannot tell them
 * apart, so it reports them verbatim and lets a person read them. Silently dropping them would hide
 * inventions; silently trusting them would enforce inventions.
 */
export function locateFacts(source: string, facts: CanonFactCore[]): { facts: CanonFactCore[]; coverage: CoverageReport } {
  const list = Array.isArray(facts) ? facts.filter(Boolean) : [];
  const sections = sectionsOf(source);
  const counts = new Map<string, number>();
  const unlocatedStatements: string[] = [];
  let located = 0;

  let synthesis = 0;
  const out = list.map((f) => {
    const loc = locateFact(source, sections, f);
    if (loc.provenance === 'synthesis') {
      synthesis++;
      // Counted against every section it drew on, because coverage is the question here.
      for (const p of loc.parts || []) counts.set(p.section || '(no heading)', (counts.get(p.section || '(no heading)') || 0) + 1);
      return { ...f, sourceOffset: null, sourceSection: null, sourceProvenance: 'synthesis' as const };
    }
    if (loc.at == null) {
      unlocatedStatements.push(String(f.statement || '').slice(0, 240));
      return { ...f, sourceOffset: null, sourceSection: null, sourceProvenance: 'unlocated' as const };
    }
    located++;
    counts.set(loc.section || '(no heading)', (counts.get(loc.section || '(no heading)') || 0) + 1);
    return { ...f, sourceOffset: loc.at, sourceSection: loc.section, sourceProvenance: 'located' as const };
  });

  const order = new Map<string, number>();
  for (const s of sections) if (!order.has(s.title)) order.set(s.title, s.at);
  const bySection = Array.from(counts.entries())
    .map(([section, n]) => ({ section, at: order.get(section) ?? -1, facts: n }))
    .sort((a, b) => a.at - b.at);

  return { facts: out, coverage: { located, synthesis, unlocated: list.length - located - synthesis, bySection, unlocatedStatements } };
}
