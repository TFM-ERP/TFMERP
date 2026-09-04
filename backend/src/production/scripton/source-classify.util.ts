/**
 * SOURCE CLASSIFICATION — telling one kind of material from another.
 *
 * The system reads everything a user attaches as one undifferentiated blob. `develop()` labels the
 * first 6,000 characters of it "the work to adapt - stay faithful to it" and carries that into eight
 * ladder stages; `extractCanon()` reads a 60,000-character prefix as "the hard facts the script must
 * never contradict". So a comp screenplay becomes the work to adapt, a Wikipedia page becomes binding
 * canon, and "make the ending ambiguous" becomes something to dramatise. Two pages of THE TRUMAN SHOW
 * reached scene 32 of a delivered draft through exactly this path.
 *
 * This module is PURE: no Nest, no Prisma, no filesystem, no network, and NO AI CLIENT. The single
 * model call is made by the service and its parsed reply is passed to `applyVerdicts` — the same
 * shape as `checkDraftContinuity`, which is handed scenes rather than fetching them. That is what
 * makes the whole module testable without a model.
 *
 * NEVER THROWS. Every entry point tolerates null, junk and truncated input, because an unclassified
 * corpus must behave exactly as it does today rather than failing a build.
 */
import { normaliseForCompare, jaccard, trimToSentence } from './continuity.util';

export type Role = 'CANON' | 'RESEARCH' | 'REFERENCE' | 'INSTRUCTION';
export type StoredRole = Role | 'UNCLASSIFIED';
export type SubjectKind = 'CHARACTER' | 'PLACE' | 'RULE' | 'EVENT' | 'OTHER';

export interface SourceDoc { id: string; name: string; text: string }
export interface Subject { name: string; kind: SubjectKind }
export interface Passage { id: string; docId: string; start: number; end: number; chars: number }
export interface StoredPassage extends Passage { role: StoredRole; subjects: Subject[]; confidence: number }
export interface Verdict { id: string; role: Role; subjects: Subject[]; confidence: number }

export interface SourceBible {
  brief: string;
  full: string;
  canonText: string;
  instructions: string[];
  research: Array<{ subject: string; passages: number; docs: string[] }>;
  references: Array<{ doc: string; why: string }>;
  counts: Record<string, number>;
}

/** A passage accretes paragraphs until it reaches this, then closes. */
export const PASSAGE_TARGET_CHARS = 900;
/** No passage may exceed this. A single paragraph over it is split on sentence boundaries. */
export const PASSAGE_MAX_CHARS = 2400;
/** Material sent to the model in one classification call. */
export const CLASSIFY_BATCH_CHARS = 24000;
/** Hard ceiling on model calls per build. Passages beyond it stay UNCLASSIFIED, which is safe. */
export const MAX_CLASSIFY_BATCHES = 12;
/** Token overlap above which two passages are the same text, not two similar ones. */
export const DEDUPE_SIMILARITY = 0.9;

export const ROLES: Role[] = ['CANON', 'RESEARCH', 'REFERENCE', 'INSTRUCTION'];
export const SUBJECT_KINDS: SubjectKind[] = ['CHARACTER', 'PLACE', 'RULE', 'EVENT', 'OTHER'];

/**
 * Tie-break order when a document's passages split evenly between roles.
 *
 * REFERENCE first, deliberately. The cost of over-quarantining is one paragraph the writer never
 * sees; the cost of under-quarantining has already shipped once.
 */
const PLURALITY_ORDER: Role[] = ['REFERENCE', 'INSTRUCTION', 'RESEARCH', 'CANON'];

// ---------------------------------------------------------------------------------------------
// Segmentation — pure, deterministic, offset-based
// ---------------------------------------------------------------------------------------------

/** Push [from,to) onto `spans` with surrounding whitespace trimmed off, skipping empty regions. */
function pushSpan(spans: Array<[number, number]>, text: string, from: number, to: number): void {
  let s = from;
  let e = to;
  while (s < e && /\s/.test(text.charAt(s))) s++;
  while (e > s && /\s/.test(text.charAt(e - 1))) e--;
  if (e > s) spans.push([s, e]);
}

/** Paragraph spans: blank-line separated, each trimmed, offsets absolute into `text`. */
function paragraphSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const re = /\n[ \t]*\r?\n/g;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    pushSpan(spans, text, cursor, m.index);
    cursor = m.index + m[0].length;
    re.lastIndex = cursor;
  }
  pushSpan(spans, text, cursor, text.length);
  return spans;
}

/**
 * Split one over-long paragraph on sentence boundaries, then on whitespace, then hard.
 *
 * A cut is only accepted past 30% of the window so a paragraph opening with "Mr." does not produce a
 * four-character passage. The hard cut is a last resort for text with no sentences and no spaces
 * (minified HTML, a table dump) — it never drops a character, so reconstruction stays exact.
 */
function splitLongParagraph(text: string, from: number, to: number, max: number): Array<[number, number]> {
  if (to - from <= max) return [[from, to]];
  const out: Array<[number, number]> = [];
  let cur = from;
  while (to - cur > max) {
    const window = text.slice(cur, cur + max);
    let cut = -1;
    const re = /[.!?]["'’”)\]]?\s/g;
    let mm: RegExpExecArray | null;
    let last = -1;
    while ((mm = re.exec(window)) !== null) last = mm.index + mm[0].length;
    if (last > max * 0.3) cut = cur + last;
    if (cut < 0) {
      const ws = window.lastIndexOf(' ');
      cut = ws > max * 0.3 ? cur + ws + 1 : cur + max;
    }
    out.push([cur, cut]);
    cur = cut;
  }
  if (to > cur) out.push([cur, to]);
  return out;
}

/**
 * Segment every document into addressable passages.
 *
 * A passage stores OFFSETS, never text. Three reasons, in order of importance: it leaves exactly one
 * function that turns a passage into words, so the REFERENCE quarantine is structural rather than
 * promised; a 300 KB corpus does not become a 600 KB Json column; and no second copy can drift from
 * the first across re-saves.
 *
 * Ids are `<docId>#<ordinal>` — stable under re-save while the text is unchanged, and greppable in a
 * log line, which matters when a classification looks wrong and you need the passage it came from.
 */
export function segmentPassages(
  docs: SourceDoc[] | null | undefined,
  target = PASSAGE_TARGET_CHARS,
  max = PASSAGE_MAX_CHARS,
): Passage[] {
  const out: Passage[] = [];
  const lo = Math.max(1, Number(target) || PASSAGE_TARGET_CHARS);
  const hi = Math.max(lo, Number(max) || PASSAGE_MAX_CHARS);
  for (const doc of Array.isArray(docs) ? docs : []) {
    const docId = String(doc && doc.id != null ? doc.id : '');
    const text = String((doc && doc.text) || '');
    if (!docId || !text.trim()) continue;
    const paras: Array<[number, number]> = [];
    for (const [s, e] of paragraphSpans(text)) {
      for (const span of splitLongParagraph(text, s, e, hi)) paras.push(span);
    }
    let ordinal = 0;
    let curS = -1;
    let curE = -1;
    for (const [s, e] of paras) {
      if (curS < 0) { curS = s; curE = e; }
      else if (e - curS <= hi) { curE = e; }
      else {
        out.push({ id: docId + '#' + ordinal, docId, start: curS, end: curE, chars: curE - curS });
        ordinal++;
        curS = s; curE = e;
      }
      if (curE - curS >= lo) {
        out.push({ id: docId + '#' + ordinal, docId, start: curS, end: curE, chars: curE - curS });
        ordinal++;
        curS = -1; curE = -1;
      }
    }
    if (curS >= 0) {
      out.push({ id: docId + '#' + ordinal, docId, start: curS, end: curE, chars: curE - curS });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------------------------

/**
 * Group passages into model calls.
 *
 * A batch NEVER straddles documents. The document is the strongest prior available for its own
 * passages' role — a file called `truman-show.pdf` is a reference from its first page to its last —
 * and splitting one across calls throws that prior away for no saving.
 *
 * Passages past `maxBatches` are simply not returned. They stay UNCLASSIFIED, which is a defined,
 * safe state: they remain in the corpus and every existing consumer still reads them.
 */
export function batchPassages(
  passages: Passage[] | null | undefined,
  maxChars = CLASSIFY_BATCH_CHARS,
  maxBatches = MAX_CLASSIFY_BATCHES,
): Passage[][] {
  const cap = Math.max(1, Number(maxChars) || CLASSIFY_BATCH_CHARS);
  const limit = Math.max(1, Number(maxBatches) || MAX_CLASSIFY_BATCHES);
  const batches: Passage[][] = [];
  let cur: Passage[] = [];
  let curChars = 0;
  let curDoc = '';
  for (const p of Array.isArray(passages) ? passages : []) {
    if (!p || !p.id) continue;
    const chars = Math.max(0, Number(p.chars) || 0);
    if (cur.length && (String(p.docId) !== curDoc || curChars + chars > cap)) {
      batches.push(cur);
      if (batches.length >= limit) return batches;
      cur = []; curChars = 0;
    }
    cur.push(p);
    curChars += chars;
    curDoc = String(p.docId);
  }
  if (cur.length && batches.length < limit) batches.push(cur);
  return batches;
}

// ---------------------------------------------------------------------------------------------
// Verdict merge — the whole failure design lives here
// ---------------------------------------------------------------------------------------------

/**
 * Merge model verdicts onto passages. Anything the model did not answer for, or answered badly, is
 * UNCLASSIFIED — which behaves exactly as the material behaves today.
 *
 * So: one batch throwing costs that batch. Every batch throwing costs nothing at all — the build is
 * byte-for-byte the build it would have been without this module. Classification can never make a
 * draft worse than the draft it replaces, which is the same doctrine that governs every check in
 * this system: a check that reports nine defects in a clean draft is worse than no check.
 */
export function applyVerdicts(
  passages: Passage[] | null | undefined,
  verdicts: any,
): StoredPassage[] {
  const byId = new Map<string, Verdict>();
  for (const v of Array.isArray(verdicts) ? verdicts : []) {
    if (!v) continue;
    const id = String(v.id == null ? '' : v.id).trim();
    if (!id) continue;
    const role = String(v.role || '').trim().toUpperCase();
    if (ROLES.indexOf(role as Role) < 0) continue;
    const subjects: Subject[] = [];
    const seen = new Set<string>();
    for (const s of Array.isArray(v.subjects) ? v.subjects : []) {
      const name = String((s && typeof s === 'object' ? s.name : s) || '').trim().slice(0, 80);
      if (!name) continue;
      const key = name.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const kind = String((s && typeof s === 'object' && s.kind) || '').trim().toUpperCase();
      subjects.push({ name, kind: (SUBJECT_KINDS.indexOf(kind as SubjectKind) >= 0 ? kind : 'OTHER') as SubjectKind });
      if (subjects.length >= 12) break;
    }
    let confidence = Number(v.confidence);
    if (!isFinite(confidence)) confidence = 0.5;
    confidence = Math.max(0, Math.min(1, confidence));
    byId.set(id, { id, role: role as Role, subjects, confidence });
  }
  const out: StoredPassage[] = [];
  for (const p of Array.isArray(passages) ? passages : []) {
    if (!p || !p.id) continue;
    const v = byId.get(String(p.id));
    out.push(v
      ? { ...p, role: v.role as StoredRole, subjects: v.subjects, confidence: v.confidence }
      : { ...p, role: 'UNCLASSIFIED', subjects: [], confidence: 0 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The quarantine
// ---------------------------------------------------------------------------------------------

/**
 * Which documents are references, wholesale.
 *
 * A document's plurality role wins over any single passage's own tag. A comp screenplay IS a
 * reference from cover to cover, and one stray CANON tag on its page 40 must not be able to leak two
 * pages of another film into scene 32 — which is the exact shape of the contamination that shipped.
 */
export function quarantinedDocs(passages: StoredPassage[] | null | undefined): Set<string> {
  const tally = new Map<string, Map<string, number>>();
  for (const p of Array.isArray(passages) ? passages : []) {
    if (!p || !p.docId) continue;
    const role = String(p.role || '');
    if (ROLES.indexOf(role as Role) < 0) continue;
    const docId = String(p.docId);
    if (!tally.has(docId)) tally.set(docId, new Map());
    const m = tally.get(docId) as Map<string, number>;
    m.set(role, (m.get(role) || 0) + 1);
  }
  const out = new Set<string>();
  tally.forEach((m, docId) => {
    let best: Role | null = null;
    let bestN = 0;
    for (const role of PLURALITY_ORDER) {
      const n = m.get(role) || 0;
      if (n > bestN) { best = role; bestN = n; }
    }
    if (best === 'REFERENCE') out.add(docId);
  });
  return out;
}

/**
 * THE SINGLE BODY-FETCH FUNCTION. A passage becomes words here and nowhere else.
 *
 * It refuses on two independent grounds — the passage's own REFERENCE tag, and its document's
 * quarantine — so the guarantee is structural. A REFERENCE passage is not deprioritised in a ranking
 * that some future caller could re-sort; it is unreachable.
 */
export function passageBody(
  docs: SourceDoc[] | null | undefined,
  p: { docId?: any; start?: any; end?: any; role?: any } | null | undefined,
  quarantined?: Set<string> | null,
): string {
  if (!p) return '';
  const docId = String(p.docId == null ? '' : p.docId);
  if (!docId) return '';
  if (String(p.role || '') === 'REFERENCE') return '';
  if (quarantined && quarantined.has(docId)) return '';
  let text = '';
  for (const d of Array.isArray(docs) ? docs : []) {
    if (d && String(d.id) === docId) { text = String(d.text || ''); break; }
  }
  if (!text) return '';
  const s = Math.max(0, Math.min(text.length, Math.floor(Number(p.start) || 0)));
  const e = Math.max(s, Math.min(text.length, Math.floor(Number(p.end) || 0)));
  return text.slice(s, e);
}

// ---------------------------------------------------------------------------------------------
// The distiller — deterministic, no second AI call
// ---------------------------------------------------------------------------------------------

function docName(docs: SourceDoc[] | null | undefined, docId: string): string {
  for (const d of Array.isArray(docs) ? docs : []) {
    if (d && String(d.id) === String(docId)) return String(d.name || d.id || docId);
  }
  return String(docId);
}

/** Drop near-identical strings, keeping the first. Doc "paste" overlaps the extra-paste sources. */
function dedupeTexts(list: string[], threshold = DEDUPE_SIMILARITY): string[] {
  const kept: string[] = [];
  const keptTokens: string[][] = [];
  for (const raw of list) {
    const t = String(raw || '').trim();
    if (!t) continue;
    const tokens = normaliseForCompare(t);
    let dup = false;
    for (let i = 0; i < kept.length; i++) {
      if (kept[i] === t) { dup = true; break; }
      if (tokens.length && jaccard(tokens, keptTokens[i]) >= threshold) { dup = true; break; }
    }
    if (dup) continue;
    kept.push(t);
    keptTokens.push(tokens);
  }
  return kept;
}

function capLines(lines: string[], budget: number): string[] {
  const out: string[] = [];
  let used = 0;
  for (const l of lines) {
    const cost = l.length + 1;
    if (used + cost > budget) break;
    out.push(l);
    used += cost;
  }
  return out;
}

/**
 * Build the Source Bible. DETERMINISTIC — same inputs, same string, every time, so it is
 * snapshot-testable and a change to it shows up as a test diff rather than as a mysteriously
 * different script.
 *
 * The REFERENCE LEDGER is assembled from document METADATA ONLY. There is no code path in this
 * function that reads a quarantined body — not a filtered one, not a truncated one. The leak is
 * impossible rather than prevented.
 */
export function buildSourceBible(
  docs: SourceDoc[] | null | undefined,
  passages: StoredPassage[] | null | undefined,
  briefBudget = 1800,
  fullBudget = 12000,
): SourceBible {
  const list = (Array.isArray(passages) ? passages : []).filter((p) => p && p.docId);
  const quarantined = quarantinedDocs(list);
  const counts: Record<string, number> = { CANON: 0, RESEARCH: 0, REFERENCE: 0, INSTRUCTION: 0, UNCLASSIFIED: 0 };

  const canonBodies: string[] = [];
  const instructionBodies: string[] = [];
  const researchBySubject = new Map<string, { subject: string; passages: number; docs: Set<string> }>();
  const canonSubjects = new Map<string, { subject: string; kind: SubjectKind; hits: number; first: number; line: string }>();
  const referenceDocs = new Map<string, string>();

  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const own = String(p.role || 'UNCLASSIFIED');
    const eff = quarantined.has(String(p.docId)) ? 'REFERENCE' : own;
    counts[eff] = (counts[eff] || 0) + 1;

    if (eff === 'REFERENCE') {
      const id = String(p.docId);
      if (!referenceDocs.has(id)) referenceDocs.set(id, docName(docs, id));
      continue;
    }
    // Every read below goes through passageBody, which refuses quarantined material on its own.
    const body = passageBody(docs, p, quarantined);
    if (!body.trim()) continue;

    if (eff === 'CANON') {
      canonBodies.push(body.trim());
      for (const s of p.subjects || []) {
        const key = String(s.name || '').trim().toUpperCase();
        if (!key) continue;
        const prev = canonSubjects.get(key);
        if (prev) prev.hits++;
        else canonSubjects.set(key, { subject: key, kind: s.kind || 'OTHER', hits: 1, first: i, line: trimToSentence(body, 160) });
      }
    } else if (eff === 'INSTRUCTION') {
      instructionBodies.push(body.trim());
    } else if (eff === 'RESEARCH') {
      for (const s of p.subjects || []) {
        const key = String(s.name || '').trim().toUpperCase();
        if (!key) continue;
        const prev = researchBySubject.get(key);
        if (prev) { prev.passages++; prev.docs.add(docName(docs, String(p.docId))); }
        else researchBySubject.set(key, { subject: key, passages: 1, docs: new Set([docName(docs, String(p.docId))]) });
      }
    }
  }

  const instructions = dedupeTexts(instructionBodies);
  const canonText = dedupeTexts(canonBodies).join('\n\n');

  const research = Array.from(researchBySubject.values())
    .sort((a, b) => (b.passages - a.passages) || a.subject.localeCompare(b.subject))
    .map((r) => ({ subject: r.subject, passages: r.passages, docs: Array.from(r.docs).sort() }));

  const references = Array.from(referenceDocs.entries())
    .map(([, name]) => ({ doc: name, why: 'cited as a reference; its text is never used' }))
    .sort((a, b) => a.doc.localeCompare(b.doc));

  const subjectsRanked = Array.from(canonSubjects.values())
    .sort((a, b) => (b.hits - a.hits) || (a.first - b.first) || a.subject.localeCompare(b.subject))
    .slice(0, 40);

  const canonLines: string[] = [];
  for (const kind of SUBJECT_KINDS) {
    const inKind = subjectsRanked.filter((s) => s.kind === kind);
    if (!inKind.length) continue;
    canonLines.push(kind + 'S');
    for (const s of inKind) canonLines.push('· ' + s.subject + ' — ' + s.line);
  }
  const instructionLines = instructions.map((t) => '· ' + t.replace(/\s+/g, ' ').trim());
  const researchLines = research.map((r) => '· ' + r.subject + ' — ' + r.passages + ' passage' + (r.passages === 1 ? '' : 's') + ' · ' + r.docs.join(', '));
  const referenceLines = references.map((r) => '· ' + r.doc + ' — ' + r.why);

  const section = (title: string, lines: string[]) => (lines.length ? [title, ...lines, ''] : []);

  const fullParts: string[] = ([] as string[])
    .concat(section('CANON BIBLE', canonLines))
    .concat(section('INSTRUCTION BLOCK', instructionLines))
    .concat(section('RESEARCH INDEX', researchLines))
    .concat(section('REFERENCE LEDGER', referenceLines));
  const full = capLines(fullParts, Math.max(0, Number(fullBudget) || 0)).join('\n').trim();

  // The brief rides on EVERY scene prompt beside buildFeatureCtx's existing slices, so instructions
  // come first and take their budget before canon subjects: a rule the writer breaks is worse than a
  // name the writer had to be reminded of by the canon block instead.
  const instructionBudget = Math.min(Math.floor(briefBudget * 0.45), instructionLines.reduce((n, l) => n + l.length + 1, 0));
  const briefInstr = capLines(instructionLines, instructionBudget);
  const briefCanon = capLines(canonLines, Math.max(0, briefBudget - briefInstr.reduce((n, l) => n + l.length + 1, 0) - 40));
  const brief = ([] as string[])
    .concat(section('INSTRUCTION BLOCK', briefInstr))
    .concat(section('CANON BIBLE', briefCanon))
    .join('\n').trim();

  return { brief, full, canonText, instructions, research, references, counts };
}

/**
 * The part of the assembled corpus that no source record accounts for — the main paste box.
 *
 * THIS FUNCTION EXISTS TO CLOSE A LEAK, and the leak is worth stating because it is not obvious.
 * After (1), `intake.sourceText` is the WHOLE corpus: the main paste box plus every file and URL,
 * joined by assembleCorpus. Treating that aggregate as its own document puts a copy of every comp
 * screenplay inside a document whose plurality is decided by the mixed corpus around it — so the
 * comp is quarantined under its own file name and readable under `paste`. Demonstrated: with
 * truman-show.pdf correctly quarantined, its text still reached canonText through the aggregate.
 *
 * So the paste document is the RESIDUE: the aggregate with each source's own text removed once. If
 * any source's text survives the removal — a shape assembleCorpus should never produce — the residue
 * is refused entirely rather than trusted. Losing the main paste box from classification costs one
 * UNCLASSIFIED document, which is the defined safe state; keeping a reference in it costs a lawsuit.
 */
export function residualPaste(sourceText: any, sources: Array<{ text?: any }> | null | undefined): string {
  let rest = String(sourceText == null ? '' : sourceText);
  if (!rest.trim()) return '';
  const texts: string[] = [];
  for (const s of Array.isArray(sources) ? sources : []) {
    const t = String((s && s.text) || '').trim();
    if (t) texts.push(t);
  }
  // Longest first: a short source whose text is a substring of a longer one must not consume the
  // longer one's occurrence and leave the remainder stranded in the residue.
  texts.sort((a, b) => b.length - a.length);
  for (const t of texts) {
    const i = rest.indexOf(t);
    if (i >= 0) rest = rest.slice(0, i) + rest.slice(i + t.length);
  }
  rest = rest.trim();
  if (!rest) return '';
  for (const t of texts) if (rest.indexOf(t) >= 0) return '';
  return rest;
}

/** Reuse a stored classification only when the source's TEXT is byte-identical. */
export function canReuseClassification(
  incoming: { text?: any } | null | undefined,
  previous: { text?: any; passages?: any } | null | undefined,
): boolean {
  if (!incoming || !previous) return false;
  if (!Array.isArray(previous.passages) || !previous.passages.length) return false;
  const cur = String(incoming.text == null ? '' : incoming.text);
  if (!cur.trim()) return false;
  return cur === String(previous.text == null ? '' : previous.text);
}
