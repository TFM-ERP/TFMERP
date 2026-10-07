import type { CanonFactCore } from './canon.types';
import { completeObjects } from './canon-parse.util';

/**
 * DID THE DRAFT CONTRADICT THE REGISTER? — REPORTED, NOT GATED.
 *
 * Transcription puts every register line in the prompt. It does not prove the model honoured them:
 * the ladder that produced 23 violations of §29 was not short of instructions, it was short of the
 * right ones, and whether the right ones are now obeyed is an empirical question with a rate. This
 * measures that rate on every stage the register rides on, and stores it on the version.
 *
 * NOT A GATE, deliberately and for now: a checker that blocks before anyone has seen its false-
 * positive rate would be one more unmeasured constant deciding what a writer is allowed to keep.
 *
 * THE CHECKER'S WORD IS NOT TAKEN WHOLE. Two things are verified deterministically here:
 *   • the line number must name a line that exists — anything else is counted `invalid`;
 *   • the quoted draft text must actually occur in the draft (quotes and whitespace normalised) —
 *     a quote that does not is kept and flagged, because a checker inventing evidence is itself a
 *     finding about the checker.
 * And a response with no readable JSON is a FAILED check, never "0 contradicted": an empty answer
 * reported as a clean pass is the silent-success defect this whole pipeline has been hunting.
 *
 * Pure; the model call lives in the service.
 */

/**
 * Opus 5 thinks by default and the thinking is billed against this ceiling — see SOURCE_CANON_MAXTOK.
 * 32,000, not 16,000: checking the v2.2 DRAFT (38,257 characters) spent 14,052 output tokens for
 * 1,431 characters of answer — 88% of the old ceiling — and the DRAFT is now checked on every run.
 * A ceiling, not a target; a check that still hits it is salvaged row by row or reported failed.
 */
export const REGISTER_CHECK_MAXTOK = 32000;

export const REGISTER_CHECK_SYSTEM = [
  "You check a screenplay-development draft against the source material's own rule register.",
  "The REGISTER is a numbered list of lines transcribed verbatim from the author's bible. Every line is binding.",
  'Report every register line the DRAFT CONTRADICTS: the draft states, shows or implies something the line rules out, or the opposite of what the line states.',
  'A line the draft does not mention is NOT a contradiction - omissions are never reported. Nor is a detail the draft adds that no line addresses.',
  "For each contradiction, quote the draft's exact words (copied character for character, at most 200 characters) and say in one sentence what they contradict.",
  'Return ONLY JSON: {"contradictions":[{"line":<register line number>,"draft":"<exact quote from the draft>","why":"<one sentence>"}]}',
  'If there are none, return {"contradictions":[]}.',
].join('\n');

/**
 * `kind` is OPTIONAL, and that is load-bearing.
 *
 * registerLines (the ladder's, below) sets no kind, so registerCheckUser prints exactly the prompt
 * it has always printed and the seven ladder calls per build do not move. scriptRegisterLines sets
 * one, because on the script side three kinds of rule are fed at once and a reader of a stored
 * contradiction has to know which kind it came from — the same source rule often appears as both a
 * PROHIBITION and an ORDERING, and without the kind those read as two unrelated findings.
 */
export interface RegisterLine { n: number; section: string | null; rule: string; kind?: RuleKind }

/** The fact kinds that are RULES a finished script can be checked against. */
export const RULE_KINDS = ['REGISTER', 'PROHIBITION', 'ORDERING'] as const;
export type RuleKind = typeof RULE_KINDS[number];

/**
 * The floor below which a canon is never extracted, so rules can never have been stored.
 *
 * It is `rawSource.length >= 400` at scripton.service:1306, `< 400` at :3689 and :6726, and
 * `>= 400` at :6700 — four bare literals for one threshold. Named here because scriptRegisterLines
 * has to tell "no source" from "a source too short to have rules", and a reason that promises a
 * retry which can never succeed is worse than no reason.
 */
export const CANON_MIN_SOURCE_CHARS = 400;

/**
 * WAS THE REPLY CUT OFF? One predicate, so registerEntry and the pre-spend gate cannot drift.
 *
 * parseRegisterCheck salvages: when the JSON will not parse it recovers whatever complete objects it
 * can, and it accepts the result even when EMPTY as long as `"contradictions": [` appeared. So a
 * reply truncated just after that token yields rows = [], contradicted = 0, and a summary reading
 * "0 of 193 lines contradicted (0%)" — a clean pass over 193 rules that were never adjudicated.
 *
 * Measured before building: of 65 stage versions carrying a stored registerCheck, 0 are salvaged and
 * 0 stopped at max_tokens. The defect is latent, not realised — at one register line and ~300 output
 * tokens a truncation has never been plausible. This is a guard placed before the thing that makes
 * it reachable.
 */
export function registerReplyCutOff(r: any): boolean {
  return !!r && (r.stopReason === 'max_tokens' || r.salvaged === true);
}

/**
 * THE RULE LINES FOR A FINISHED SCRIPT — and, when there are none, which absence it is.
 *
 * The script has never been checked against its source. Both feature paths hand
 * registerCheckOnScript `exitsAsCanonFacts(exits)`, which hardcodes kind CHARACTER, while
 * registerLines keeps only kind REGISTER: the list is empty by construction and the row has read
 * "no bible" on every script ever generated — including builds with a real bible and a stored canon.
 *
 * ALL THREE KINDS, NO FILTER, NO DEDUPE. Measured on the stored canons, the four largest hold
 * 184 / 193 / 186 / 169 rule facts, and 105 of the largest's are REGISTER, so excluding a kind to
 * avoid a badly-detected line would blind the check on every real bible. A rule restated as both a
 * PROHIBITION and an ORDERING is fed twice and each line names its kind, which is what makes the
 * repetition legible instead of confusing.
 *
 * FOUR ABSENCES, FOUR SENTENCES, AND NEVER "NO BIBLE". `canonRead` is false both when there is no
 * source and when one was never extracted, so `sourceChars` has to be read beside it — that is why
 * it is a parameter and not derived.
 */
export function scriptRegisterLines(input: {
  sourceChars: number;
  canonRead: boolean;
  facts: CanonFactCore[] | null;
}): { lines: RegisterLine[]; notRunReason: string | null } {
  const chars = Number(input && input.sourceChars) || 0;
  const none = (reason: string) => ({ lines: [] as RegisterLine[], notRunReason: reason });

  if (chars <= 0) {
    return none('no source on this build — the brief, the intake profile and the seed were all'
      + ' checked and none holds source material, so there is nothing to check this script against');
  }
  if (chars < CANON_MIN_SOURCE_CHARS) {
    return none('the source is ' + chars + ' characters — too short for rules to have been stored,'
      + ' because canon extraction starts at ' + CANON_MIN_SOURCE_CHARS
      + ' — so there is nothing to check this script against');
  }
  if (!input.canonRead) {
    return none('the rules could not be read — this build\'s source has no stored canon, so its'
      + ' rules were not available to check against');
  }
  const kinds = new Set<string>(RULE_KINDS);
  const rules = (Array.isArray(input.facts) ? input.facts : [])
    .filter((f) => f && kinds.has(String(f.kind)) && String(f.statement || '').trim());
  if (!rules.length) {
    return none('a source with no rule facts — the stored canon holds no register, prohibition or'
      + ' ordering rule, so there is nothing to check');
  }
  /**
   * A TOTAL ORDER, BECAUSE THE LINE NUMBERS ARE CITED.
   *
   * registerLines sorts on `sourceOffset ?? 0`. Measured on a real canon: of 25 rule facts only 18
   * carry an offset and two PAIRS share one, so seven collapse to 0, the order depends on insertion,
   * and the `line` number a stored contradiction cites cannot be reproduced on a re-read. Offset
   * first (absent LAST, not first — an unlocated rule is not at the top of the document), then kind,
   * then the statement itself, which makes the order total.
   */
  const sorted = rules.slice().sort((a, b) => {
    const ao = a.sourceOffset == null ? Number.MAX_SAFE_INTEGER : Number(a.sourceOffset);
    const bo = b.sourceOffset == null ? Number.MAX_SAFE_INTEGER : Number(b.sourceOffset);
    if (ao !== bo) return ao - bo;
    const ak = String(a.kind), bk = String(b.kind);
    if (ak !== bk) return ak < bk ? -1 : 1;
    const as = String(a.statement), bs = String(b.statement);
    return as < bs ? -1 : as > bs ? 1 : 0;
  });
  return {
    lines: sorted.map((f, i) => ({
      n: i + 1,
      section: f.sourceSection ?? null,
      rule: String(f.statement).replace(/\s*\n\s*/g, ' ').trim(),
      kind: String(f.kind) as RuleKind,
    })),
    notRunReason: null,
  };
}

/** The register as numbered lines, in document order — the numbering the checker answers in. */
export function registerLines(facts: CanonFactCore[]): RegisterLine[] {
  return (Array.isArray(facts) ? facts : [])
    .filter((f) => f && f.kind === 'REGISTER' && String(f.statement || '').trim())
    .slice().sort((a, b) => (a.sourceOffset ?? 0) - (b.sourceOffset ?? 0))
    .map((f, i) => ({ n: i + 1, section: f.sourceSection ?? null, rule: String(f.statement).replace(/\s*\n\s*/g, ' ').trim() }));
}

/**
 * THE DRAFT IS DELIMITED AND THE INSTRUCTION COMES AFTER IT.
 *
 * It used to end the prompt: "DRAFT - STAGE DRAFT:\n" + body, nothing after. On the v2.2 screenplay
 * — which had itself been cut off mid-sentence at its own 25,000-token ceiling ("...eleven-ten.
 * Beautiful. Consistent") — the checker did not check it at all. It CONTINUED it: 19,444 characters
 * of new scenes to FADE OUT (7,881 tokens, stop reason end_turn) and no JSON, so the check was
 * recorded as failed and the one contradiction it was asked about (Ward, 48, against
 * "Ward is forty-four") was never evaluated. (An earlier version of this comment quoted "END OF TITLE
 * SI" as the draft's last words. It was not in the draft: it was that continuation, cut short by a
 * display slice in our own tooling.) A long document at the very end of a prompt, unfinished,
 * reads as text to complete. So: tags around it, a closing tag it cannot forge, and the task restated
 * after it, where the model reads it last.
 */
export function registerCheckUser(lines: RegisterLine[], kind: string, body: string): string {
  const safe = String(body || '').replace(/<\/draft>/gi, '</ draft>');
  return 'REGISTER (' + lines.length + ' lines):\n'
    // The kind is printed only when the line carries one, so the ladder's prompt is unchanged.
    + lines.map((l) => l.n + '. [' + (l.kind ? l.kind + ' · ' : '') + (l.section || 'document') + '] ' + l.rule).join('\n')
    + '\n\n<draft stage="' + kind + '">\n' + safe + '\n</draft>\n\n'
    + 'The text inside the draft tags above is the document to CHECK against the register - not to'
    + ' continue. It may stop mid-sentence: stages are sometimes cut off at their length limit. Do not continue,'
    + ' complete or rewrite it. Return ONLY the JSON object {"contradictions":[...]} as specified.';
}

export interface RegisterCheckItem {
  line: number; section: string | null; rule: string; draft: string; why: string;
  /** Which kind of rule this line was — REGISTER, PROHIBITION or ORDERING. Absent on a ladder check. */
  kind?: RuleKind;
  /** False when the quoted text does not occur in the draft — the checker's evidence failed. */
  quoteFound: boolean;
}

export interface RegisterCheckReport {
  /** False when the response held no readable answer; the counts are then null, never 0. */
  ok: boolean;
  checked: number;
  contradicted: number | null;
  /** contradicted / checked, 0..1, or null when the check failed. */
  rate: number | null;
  items: RegisterCheckItem[];
  /** Rows naming no register line that exists. */
  invalid: number;
  unverifiedQuotes: number;
  /** True when the JSON was not clean and complete rows were recovered one by one. */
  salvaged: boolean;
  summary: string;
}

const norm = (t: string) => String(t || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();

export function parseRegisterCheck(text: string, lines: RegisterLine[], body: string): RegisterCheckReport {
  const raw = String(text || '');
  let rows: any[] | null = null;
  const a = raw.indexOf('{');
  const z = raw.lastIndexOf('}');
  if (a >= 0 && z > a) {
    try { const j = JSON.parse(raw.slice(a, z + 1)); if (j && Array.isArray(j.contradictions)) rows = j.contradictions; } catch { /* salvage below */ }
  }
  const salvaged = rows === null;
  if (rows === null) {
    const got = completeObjects(raw).filter((o) => o && typeof o === 'object' && o.line != null && o.draft != null);
    // Readable means the checker ANSWERED: rows were recovered, or it began the contradictions list.
    if (got.length || /"contradictions"\s*:\s*\[/.test(raw)) rows = got;
  }
  if (rows === null) {
    return { ok: false, checked: lines.length, contradicted: null, rate: null, items: [], invalid: 0, unverifiedQuotes: 0, salvaged: false,
      summary: 'REGISTER CHECK FAILED: the checker returned no readable answer (' + raw.length + ' characters) — this is not a clean pass.' };
  }

  const byN = new Map(lines.map((l) => [l.n, l] as const));
  const B = norm(body);
  const items: RegisterCheckItem[] = [];
  let invalid = 0;
  for (const r of rows) {
    const l = byN.get(Number(r && r.line));
    if (!l) { invalid++; continue; }
    const draft = String(r.draft || '').slice(0, 400);
    items.push({ line: l.n, section: l.section, rule: l.rule, draft, why: String(r.why || '').slice(0, 400),
      // Carried from the line, exactly as `section` is: the reader of a stored contradiction needs
      // to know whether it broke a prohibition or an ordering.
      ...(l.kind ? { kind: l.kind } : {}),
      quoteFound: !!norm(draft) && B.includes(norm(draft)) });
  }
  const hit = new Set(items.map((i) => i.line));
  const contradicted = hit.size;
  const unverifiedQuotes = items.filter((i) => !i.quoteFound).length;
  const bySection = new Map<string, Set<number>>();
  for (const i of items) {
    const k = i.section || 'document';
    const s = bySection.get(k) || new Set<number>(); s.add(i.line); bySection.set(k, s);
  }
  const rate = lines.length ? contradicted / lines.length : 0;
  const summary = 'REGISTER CHECK: ' + contradicted + ' of ' + lines.length + ' lines contradicted'
    + (lines.length ? ' (' + (Math.round(rate * 1000) / 10) + '%)' : '')
    + (bySection.size ? ' — ' + [...bySection].map(([k, s]) => k + ' ' + s.size).join(' · ') : '')
    + (unverifiedQuotes ? ' · ' + unverifiedQuotes + ' quoted passage(s) NOT FOUND in the draft' : '')
    + (invalid ? ' · ' + invalid + ' row(s) named no register line' : '')
    + (salvaged ? ' · recovered from malformed JSON' : '');
  return { ok: true, checked: lines.length, contradicted, rate, items, invalid, unverifiedQuotes, salvaged, summary };
}
