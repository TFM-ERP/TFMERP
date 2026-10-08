import { completeObjects } from './canon-parse.util';
import { splitKeep } from './keep-items.util';

/**
 * IS WHAT THE DIRECTION SAID TO KEEP ON THE PAGE? — PRESENCE ONLY, REPORTED, NOT GATED.
 *
 * The picked direction's KEEP list (split by keep-items.util) names the scenes, lines, props and
 * beats that survive from the source. This asks, item by item, whether each named thing is IN the
 * draft, and demands the draft's own words as evidence.
 *
 * PRESENCE IS NOT CORRECTNESS. It measures ONE failure class — named and absent. A thing that is
 * present but transformed (the lapel line spoken by the wrong man, the coat moved to the wrong
 * year) passes here, and the register check cannot see it either. So the verdict is "named and
 * found", never a claim that the direction was carried out. A check that claims more than it
 * measures is the defect this whole pipeline has been hunting.
 *
 * THE CHECKER'S WORD IS NOT TAKEN WHOLE, as in register-check.util:
 *   • every "found" must carry a quote that occurs in the draft (quotes, dashes and whitespace
 *     normalised); a quote that does not is kept, flagged, and NOT counted as found;
 *   • an item number that names no item is counted `invalid`;
 *   • an item the checker never mentions is NOT REPORTED — never assumed found;
 *   • a response with no readable answer is a FAILED check, never "0 missing".
 *
 * A QUOTED LINE IS FOUND ONLY IF ITS WORDS ARE THERE. A keep item that quotes dialogue — 'You don't
 * get to disappear' — names words, not a sentiment. The checker judges presence by meaning, so it
 * once passed "tells him he does not get to disappear" as that line (cmtwm0eka TREATMENT n1). The
 * evidence check above could not catch it: the paraphrase WAS in the draft, it just was not the line.
 * So every quoted line in an item is matched verbatim (normalised as above) against the draft. A
 * checker "found" naming a line that is not there is kept, marked `notVerbatim`, and not counted,
 * and the line joins the item's misses. ONE-WAY: it only takes a "found" away; a line the checker
 * calls missing that IS verbatim stays missing, with `verbatim: true` beside it in `lines`.
 *
 * Pure; the model call lives in the service.
 */

/** Opus 5 thinks by default and the thinking is billed against this ceiling (see REGISTER_CHECK_MAXTOK). */
export const KEEP_CHECK_MAXTOK = 32000;

export const KEEP_CHECK_SYSTEM = [
  "You check a screenplay-development draft for the things its chosen direction said to KEEP from the source.",
  'The KEEP list is numbered. One item may name several things: a scene, a line of dialogue, a prop, a beat, a moment.',
  'For EVERY item, name each thing it contains and say whether that thing is IN the draft.',
  "If it is, quote the draft's exact words that show it (copied character for character, at most 200 characters).",
  'If it is not, list it as missing.',
  'Report PRESENCE ONLY. Do not judge whether a thing is used correctly, placed correctly, spoken by the right person or faithful to the source - that is not this check.',
  'Return ONLY JSON: {"items":[{"item":<item number>,"found":[{"thing":"<named thing>","quote":"<exact quote from the draft>"}],"missing":["<named thing>"]}]}',
  'Include every item number, even when nothing in it is found.',
].join('\n');

export function keepCheckUser(items: string[], lead: string | null, kind: string, body: string): string {
  const safe = String(body || '').replace(/<\/draft>/gi, '</ draft>');
  return 'KEEP (' + items.length + ' items' + (lead ? ', introduced as "' + lead + '"' : '') + '):\n'
    + items.map((t, i) => (i + 1) + '. ' + t).join('\n')
    + '\n\n<draft stage="' + kind + '">\n' + safe + '\n</draft>\n\n'
    + 'The text inside the draft tags above is the document to CHECK for the KEEP items - not to continue.'
    + ' It may stop mid-sentence. Do not continue, complete or rewrite it. Report presence only.'
    + ' Return ONLY the JSON object {"items":[...]} as specified, with every item number.';
}

/**
 * Per item, from verified evidence only:
 *   FOUND — every thing the checker named is found with a quote in the draft;
 *   PARTIAL — at least one found and verified, and something missing or unproven;
 *   MISSING — nothing found, at least one thing named as absent;
 *   UNPROVEN — claimed found, but no quote occurs in the draft;
 *   NOT REPORTED — the checker said nothing about the item. Never read as found or missing.
 */
export type KeepItemStatus = 'FOUND' | 'PARTIAL' | 'MISSING' | 'UNPROVEN' | 'NOT REPORTED';
/** `notVerbatim`: the quoted line this "found" names, whose words are not in the draft. Not counted. */
export interface KeepFound { thing: string; quote: string; quoteFound: boolean; notVerbatim?: string }
export interface KeepLine { line: string; verbatim: boolean }
export interface KeepCheckItem { item: number; text: string; status: KeepItemStatus; found: KeepFound[]; missing: string[]; lines: KeepLine[] }
export interface KeepCheckReport {
  /** False when the response held no readable answer; the counts are then null, never 0. */
  ok: boolean;
  checked: number;
  itemsFound: number | null;
  itemsPartial: number | null;
  itemsMissing: number | null;
  itemsUnproven: number | null;
  itemsNotReported: number | null;
  /** Found with a quote that occurs in the draft. */
  thingsFound: number | null;
  /** Named by the checker as absent. Kept apart from unverifiedQuotes: "absent" is not "claimed and unproven". */
  thingsMissing: number | null;
  /** Claimed found with a quote the draft does not hold — counted as neither found nor missing. */
  unverifiedQuotes: number;
  /** Claimed found for a quoted line whose words are not in the draft — not counted as found. */
  notVerbatim: number;
  invalid: number;
  salvaged: boolean;
  items: KeepCheckItem[];
  summary: string;
  /** Present only when a re-ask actually happened. Absent means nobody asked twice. */
  reask?: KeepReaskRecord;
}

/**
 * WHAT THE SECOND ASK SETTLED. Absent on a report nobody asked twice, which is how the gate knows
 * which closing line is true: "its own evidence failed" before a re-ask, "asked again and still
 * could not quote the words" after one.
 *
 * `failed` is the second call's own failure — thrown, timed out, or no readable answer. It resolves
 * nothing and must never read as a confirmation.
 */
export interface KeepReaskRecord {
  asked: number;
  proved: number;
  absent: number;
  stillUnproven: number;
  failed?: string;
}

const norm = (t: string) => String(t || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * The quoted lines inside one keep item, in order. Double and curly double quotes pair plainly. A
 * single quote OPENS only after start, whitespace or a bracket and before a non-space; it CLOSES
 * only after a non-space and before end, whitespace or punctuation — so the quote in "you're" or
 * "Nora's", with letters on both sides, is an apostrophe and never a delimiter. Trailing , . ; : ! ?
 * inside the span are dropped ('Monday. Nine.' → "Monday. Nine"); a span under two words is not a
 * line. Limit: a plural possessive inside a single-quoted line (workers' boat) closes it early.
 */
export function quotedLines(item: any): string[] {
  const s = String(item || '');
  const out: string[] = [];
  const push = (t: string) => { const l = t.trim().replace(/[\s,.;:!?]+$/, ''); if (l.split(/\s+/).filter(Boolean).length >= 2) out.push(l); };
  let open = -1;
  let kind = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = i ? s[i - 1] : '';
    const next = s[i + 1] || '';
    if (open < 0) {
      if (ch === '"' || ch === '“') { open = i + 1; kind = ch; }
      else if ((ch === "'" || ch === '‘') && (!prev || /[\s(\[]/.test(prev)) && next && !/\s/.test(next)) { open = i + 1; kind = "'"; }
      continue;
    }
    const closes = kind === "'" ? ((ch === "'" || ch === '’') && !!prev && !/\s/.test(prev) && (!next || /[\s,.;:!?)\]]/.test(next)))
      : kind === '“' ? ch === '”' : ch === '"';
    if (closes) { push(s.slice(open, i)); open = -1; }
  }
  return out;
}

const failed = (items: string[], why: string): KeepCheckReport => ({ ok: false, checked: items.length, itemsFound: null, itemsPartial: null,
  itemsMissing: null, itemsUnproven: null, itemsNotReported: null, thingsFound: null, thingsMissing: null, unverifiedQuotes: 0, notVerbatim: 0, invalid: 0, salvaged: false, items: [],
  summary: 'KEEP CHECK FAILED: ' + why + ' — this is not a clean pass.' });

export function parseKeepCheck(text: string, items: string[], body: string): KeepCheckReport {
  const raw = String(text || '');
  let rows: any[] | null = null;
  const a = raw.indexOf('{');
  const z = raw.lastIndexOf('}');
  if (a >= 0 && z > a) {
    try { const j = JSON.parse(raw.slice(a, z + 1)); if (j && Array.isArray(j.items)) rows = j.items; } catch { /* salvage below */ }
  }
  const salvaged = rows === null;
  if (rows === null) {
    const got = completeObjects(raw).filter((o) => o && typeof o === 'object' && o.item != null && (Array.isArray(o.found) || Array.isArray(o.missing)));
    if (got.length || /"items"\s*:\s*\[/.test(raw)) rows = got;
  }
  if (rows === null) return failed(items, 'the checker returned no readable answer (' + raw.length + ' characters)');

  const B = norm(body);
  const byItem = new Map<number, { found: KeepFound[]; missing: string[] }>();
  let invalid = 0;
  for (const r of rows) {
    const n = Number(r && r.item);
    if (!Number.isInteger(n) || n < 1 || n > items.length) { invalid++; continue; }
    const slot = byItem.get(n) || { found: [], missing: [] };
    for (const f of (Array.isArray(r.found) ? r.found : [])) {
      const quote = String((f && f.quote) || '').slice(0, 400);
      slot.found.push({ thing: String((f && f.thing) || '').slice(0, 200), quote, quoteFound: !!norm(quote) && B.includes(norm(quote)) });
    }
    for (const m of (Array.isArray(r.missing) ? r.missing : [])) if (String(m || '').trim()) slot.missing.push(String(m).slice(0, 200));
    byItem.set(n, slot);
  }
  // Every item was demanded. An answer that reports none of them is not "nothing found" — it is no answer.
  if (!byItem.size) return failed(items, 'the checker reported none of the ' + items.length + ' items' + (invalid ? ' (' + invalid + ' row(s) named no item)' : ''));

  const counted = (f: KeepFound) => f.quoteFound && !f.notVerbatim;
  const out: KeepCheckItem[] = items.map((text, i) => {
    const s = byItem.get(i + 1);
    const lines: KeepLine[] = quotedLines(text).map((line) => ({ line, verbatim: B.includes(norm(line)) }));
    if (!s || (!s.found.length && !s.missing.length)) return { item: i + 1, text, status: 'NOT REPORTED', found: s ? s.found : [], missing: [], lines };
    for (const { line, verbatim } of lines) {
      if (verbatim) continue;
      const L = norm(line);
      for (const f of s.found) if (norm(f.thing).includes(L)) f.notVerbatim = line;
      if (!s.missing.some((m) => norm(m).includes(L))) s.missing.push("'" + line + "'");
    }
    const verified = s.found.filter(counted).length;
    const unverified = s.found.filter((f) => !f.quoteFound).length;
    const demoted = s.found.filter((f) => f.quoteFound && f.notVerbatim).length;
    const status: KeepItemStatus = verified ? ((s.missing.length || unverified || demoted) ? 'PARTIAL' : 'FOUND')
      : unverified ? 'UNPROVEN' : 'MISSING';
    return { item: i + 1, text, status, found: s.found, missing: s.missing, lines };
  });
  const count = (st: KeepItemStatus) => out.filter((i) => i.status === st).length;
  const thingsFound = out.reduce((n, i) => n + i.found.filter(counted).length, 0);
  const unverifiedQuotes = out.reduce((n, i) => n + i.found.filter((f) => !f.quoteFound).length, 0);
  const notVerbatim = out.reduce((n, i) => n + i.found.filter((f) => f.quoteFound && f.notVerbatim).length, 0);
  const thingsMissing = out.reduce((n, i) => n + i.missing.length, 0);
  const missingNames = out.flatMap((i) => i.missing.map((m) => '#' + i.item + ' ' + m));
  const summary = 'KEEP CHECK (presence only — named and found; not a judgment of use): '
    + count('FOUND') + ' of ' + items.length + ' items named and found'
    + ' · ' + count('PARTIAL') + ' partial · ' + count('MISSING') + ' missing'
    + (count('UNPROVEN') ? ' · ' + count('UNPROVEN') + ' claimed found with no quote in the draft' : '')
    + (count('NOT REPORTED') ? ' · ' + count('NOT REPORTED') + ' NOT REPORTED by the checker' : '')
    + (missingNames.length ? ' — not found: ' + missingNames.join('; ') : '')
    + (unverifiedQuotes ? ' · ' + unverifiedQuotes + ' quoted passage(s) are not in the draft, so'
      + ' those things are unproven rather than missing (not counted as found)' : '')
    + (notVerbatim ? ' · ' + notVerbatim + ' quoted line(s) claimed found whose words are not in the draft (not counted as found)' : '')
    + (invalid ? ' · ' + invalid + ' row(s) named no item' : '')
    + (salvaged ? ' · recovered from malformed JSON' : '');
  return { ok: true, checked: items.length, itemsFound: count('FOUND'), itemsPartial: count('PARTIAL'), itemsMissing: count('MISSING'),
    itemsUnproven: count('UNPROVEN'), itemsNotReported: count('NOT REPORTED'), thingsFound, thingsMissing, unverifiedQuotes, notVerbatim, invalid, salvaged, items: out, summary };
}

// ── WHAT IS STORED ────────────────────────────────────────────────────────────────────────────────
// THREE STATES, AND NEVER A SCORE. A fraction is misleading by construction: a draft that never saw
// the Keep list scored 6 of 10 (cmtwm0eka TREATMENT n1), because a draft and its Keep share a source.
// So the stored result names what is MISSING and nothing else, and says outright when the check did
// not run — a version with no result must not look like a version with nothing missing (SYNOPSIS v2's
// register check was killed by a restart and left no trace at all).

/**
 * FOUR STATES. UNPROVEN was folded into MISSES and that cost a build two blanket waivers.
 *
 * Run 2's TREATMENT named NOTHING absent (`missing: []`) and proved fifteen of sixteen things. The
 * sixteenth was claimed found on a line the checker had composed from two scene headings — "7. 03:50
 * — THE THIRD DOOR", where the draft has "7. 03:00 — THE COURTEOUS HOUR" and "8. 03:50 — THE THIRD
 * DOOR". That is a bad citation, not an absent beat, and two entries later the same item proved the
 * same beat with a quote that does match. It was stored "MISSES — not found: Rashid at 3 a.m.", the
 * gate stopped the build on it twice, and because waiveChecks is a blanket boolean each waiver
 * cleared every other finding on those versions too. A false positive on an all-or-nothing lever
 * teaches the operator to pull it.
 *
 * So UNPROVEN stops — nothing has been shown either way, and that is not a pass — but it stops in
 * its own words and is never reported as the draft missing something.
 */
export type KeepCheckState = 'NO MISSES' | 'MISSES' | 'UNPROVEN' | 'NOT RUN';

/** The Keep a TREATMENT prompt carried — or why it carried none. Mirrors directionSteerText. */
export function keepSent(buildId: any, dirRow: any): { keep: string | null; reason: string | null } {
  if (!buildId) return { keep: null, reason: 'no build: the legacy project path carries no KEEP list' };
  if (!dirRow) return { keep: null, reason: 'this build has no direction row; its prompt used the workspace direction, which has no KEEP list' };
  if (dirRow.legacyText != null) return { keep: null, reason: "this build's direction is inherited project text; it carries no KEEP list" };
  if (!splitKeep(dirRow.keep).items.length) return { keep: null, reason: 'the picked direction has no KEEP list' };
  return { keep: String(dirRow.keep), reason: null };
}

export function keepCheckNotRun(reason: string, extra?: Record<string, any>): any {
  return { state: 'NOT RUN' as KeepCheckState, reason, misses: null, summary: 'KEEP CHECK DID NOT RUN: ' + reason, ...(extra || {}) };
}

/** The suffix that marks an item the checker never answered on, so the summary can give it its own verb. */
const NOT_CHECKED = ' (not checked)';

/**
 * WHAT IS NOT ON THE PAGE, in item order — and only that.
 *
 * Two kinds, both of which stop: a thing the checker NAMED as absent, and an item it never reported
 * at all. The third kind — claimed present, quoted on words the draft does not hold — used to be
 * appended here and is now keepUnproven's. Folding it in made a mis-citation indistinguishable from
 * a missing beat, and the headline word was "not found".
 */
export function keepMisses(report: KeepCheckReport): string[] {
  const out: string[] = [];
  for (const it of report.items) {
    if (it.status === 'NOT REPORTED') { out.push(it.text + NOT_CHECKED); continue; }
    out.push(...it.missing);
  }
  return out;
}

/** One unproven claim, as the re-ask needs it: which item, which thing, and the quote that failed. */
export interface KeepUnprovenThing { item: number; thing: string; quote: string }

/**
 * The unproven claims, structured — the re-ask's entire subject.
 *
 * Empty is the caller's signal to make NO second call. An unconditional re-ask would bill every run
 * for a question nobody has.
 */
export function keepUnprovenThings(report: KeepCheckReport): KeepUnprovenThing[] {
  const out: KeepUnprovenThing[] = [];
  for (const it of report.items) {
    for (const f of it.found) {
      if (f.quoteFound) continue;
      out.push({ item: it.item, thing: f.thing || 'item ' + it.item, quote: String(f.quote || '') });
    }
  }
  return out;
}

/**
 * Claimed present on words that are not in the draft — neither proved nor shown missing.
 *
 * The quote travels with it, because the quote is the whole evidence: a reader who can see
 * "7. 03:50 — THE THIRD DOOR" beside a draft that says "8. 03:50" can tell a bad citation from a
 * missing beat in one glance, and that is the judgement this check kept taking away from them.
 */
export function keepUnproven(report: KeepCheckReport): string[] {
  const asked = report.reask;
  const out: string[] = [];
  for (const it of report.items) {
    for (const f of it.found) {
      if (f.quoteFound) continue;
      const thing = f.thing || 'item ' + it.item;
      const quote = String(f.quote || '').replace(/\s+/g, ' ').trim();
      // THREE DIFFERENT SITUATIONS, THREE SENTENCES. A reader deciding whether to waive needs to
      // know whether anyone looked twice, and whether the second look happened at all.
      if (asked && asked.failed) {
        out.push(thing + ' — the checker was asked again and the second call failed ('
          + asked.failed + '), so this is still neither proved nor shown missing: "' + quote + '"');
      } else if (asked) {
        out.push(thing + ' — the checker was asked again and still could not quote words that are'
          + ' in the draft: "' + quote + '"');
      } else {
        out.push(thing + ' — the checker claimed this is in the draft but quoted words that are not: "'
          + quote + '"');
      }
    }
  }
  return out;
}

/**
 * The second ask is small: a handful of things and one draft. Nothing like the first call's ceiling. */
export const KEEP_REASK_MAXTOK = 4000;

export const KEEP_REASK_SYSTEM = [
  'You checked a screenplay-development draft against a KEEP list and reported some things as present,'
  + ' quoting the draft to show it. For the things below, the words you quoted are NOT in the draft.',
  'For each one, do exactly one of two things:',
  '  - quote the draft\'s exact words that show the thing IS there (copied character for character,'
  + ' at most 200 characters); or',
  '  - say the thing is NOT in the draft.',
  'Do not re-quote the words that were not found. Do not judge whether a thing is used correctly —'
  + ' presence only.',
  'Return ONLY JSON: {"answers":[{"n":<number>,"quote":"<exact quote>"},{"n":<number>,"absent":true}]}',
  'Include every number listed.',
].join('\n');

export function keepReaskUser(things: KeepUnprovenThing[], kind: string, body: string): string {
  const safe = String(body || '').replace(/<\/draft>/gi, '</ draft>');
  return 'THINGS YOU REPORTED AS PRESENT, WHOSE QUOTED WORDS ARE NOT IN THE DRAFT ('
    + things.length + '):\n'
    + things.map((t, i) => (i + 1) + '. ' + t.thing + '\n   you quoted: "'
      + String(t.quote || '').replace(/\s+/g, ' ').trim() + '"').join('\n')
    + '\n\n<draft stage="' + kind + '">\n' + safe + '\n</draft>\n\n'
    + 'The text inside the draft tags above is the document to CHECK - not to continue. It may stop'
    + ' mid-sentence. Do not continue, complete or rewrite it.'
    + ' Return ONLY the JSON object {"answers":[...]} as specified, with every number above.';
}

/** One answer to the second ask: a fresh quote, or "not there". */
export interface KeepReaskAnswer { n: number; quote: string | null; absent: boolean }

/**
 * AN UNREADABLE REPLY IS A FAILURE, NOT AN EMPTY ANSWER.
 *
 * `ok: false` means nobody answered, and applyKeepReask then leaves every thing exactly as it was.
 * An answer naming a number that was never asked about is dropped: the re-ask may only resolve the
 * things it was given.
 */
export function parseKeepReask(
  text: string, things: KeepUnprovenThing[],
): { ok: boolean; answers: KeepReaskAnswer[]; summary: string } {
  const raw = String(text || '');
  let rows: any[] | null = null;
  const a = raw.indexOf('{');
  const z = raw.lastIndexOf('}');
  if (a >= 0 && z > a) {
    try { const j = JSON.parse(raw.slice(a, z + 1)); if (j && Array.isArray(j.answers)) rows = j.answers; } catch { /* salvage below */ }
  }
  if (rows === null) {
    const got = completeObjects(raw).filter((o) => o && typeof o === 'object' && o.n != null);
    if (got.length || /"answers"\s*:\s*\[/.test(raw)) rows = got;
  }
  if (rows === null) {
    return { ok: false, answers: [], summary: 'the checker returned no readable answer ('
      + raw.length + ' characters)' };
  }
  const answers: KeepReaskAnswer[] = [];
  const seen = new Set<number>();
  for (const r of rows) {
    const n = Number(r && r.n);
    if (!Number.isInteger(n) || n < 1 || n > things.length || seen.has(n)) continue;
    seen.add(n);
    const quote = String((r && r.quote) || '').slice(0, 400);
    answers.push({ n, quote: quote || null, absent: !!(r && r.absent) && !quote });
  }
  return { ok: true, answers,
    summary: answers.length + ' of ' + things.length + ' answered' };
}

/**
 * FOLD THE SECOND ASK BACK INTO THE REPORT. Pure — the report given is never mutated, so a caller
 * can still print what the first ask said.
 *
 *   a quote that IS in the draft   -> that `found` entry is proved, and the thing counts as found
 *   "not there"                    -> the entry is removed and the thing joins the item's `missing`
 *   a quote still not in the draft -> left unproven, and the record says it was asked twice
 *   no answer, or a failed call    -> left exactly as it was
 *
 * `failure` is the second call's own failure. It resolves nothing and promotes nothing.
 */
export function applyKeepReask(
  report: KeepCheckReport,
  things: KeepUnprovenThing[],
  parsed: { ok: boolean; answers: KeepReaskAnswer[] } | null,
  body: string,
  failure?: string | null,
): KeepCheckReport {
  const B = norm(body);
  const byN = new Map<number, KeepReaskAnswer>();
  if (parsed && parsed.ok) for (const ans of parsed.answers) byN.set(ans.n, ans);
  const asked = things.length;
  let proved = 0, absent = 0;

  // A deep copy of just what can change, so the input stays readable.
  const items: KeepCheckItem[] = report.items.map((it) => ({
    ...it, found: it.found.map((f) => ({ ...f })), missing: it.missing.slice(), lines: it.lines.slice(),
  }));

  things.forEach((t, i) => {
    const ans = byN.get(i + 1);
    if (!ans) return;                                  // unanswered, or the call failed
    const item = items.find((x) => x.item === t.item);
    if (!item) return;
    const slot = item.found.find((f) => !f.quoteFound && (f.thing || '') === t.thing && String(f.quote || '') === t.quote);
    if (!slot) return;
    if (ans.quote && B.includes(norm(ans.quote))) {
      slot.quote = ans.quote;
      slot.quoteFound = true;
      proved++;
      return;
    }
    if (ans.absent) {
      item.found = item.found.filter((f) => f !== slot);
      if (!item.missing.some((m) => norm(m) === norm(t.thing))) item.missing.push(t.thing);
      absent++;
      return;
    }
    // a second quote that is also absent: keep the FIRST one on the record, since that is the
    // evidence the reader has already been shown. Still unproven.
  });

  // The statuses are recomputed from the evidence, by the same rule parseKeepCheck uses.
  const counted = (f: KeepFound) => f.quoteFound && !f.notVerbatim;
  for (const it of items) {
    if (it.status === 'NOT REPORTED') continue;
    const verified = it.found.filter(counted).length;
    const unverified = it.found.filter((f) => !f.quoteFound).length;
    const demoted = it.found.filter((f) => f.quoteFound && f.notVerbatim).length;
    it.status = verified ? ((it.missing.length || unverified || demoted) ? 'PARTIAL' : 'FOUND')
      : unverified ? 'UNPROVEN' : 'MISSING';
  }

  const stillUnproven = items.reduce((n, it) => n + it.found.filter((f) => !f.quoteFound).length, 0);
  const reask: KeepReaskRecord = { asked, proved, absent, stillUnproven };
  const why = String(failure || (parsed && !parsed.ok ? 'the checker returned no readable answer' : '') || '').trim();
  if (why) reask.failed = why;
  return { ...report, items, reask };
}

/**
 * The stored result. No count and no fraction — the per-item audit is kept for traceability only.
 *
 * THREE FACTS, THREE VERBS. They used to share one sentence that opened "not found", which is a
 * claim about the DRAFT, and only one of the three is:
 *
 *   named absent   the checker says it is not there           "not found"
 *   not reported   the checker said nothing about the item     "not checked"
 *   unproven       claimed there, quoted words that are not    "claimed but not shown"
 *
 * THE PARSER'S OWN SENTENCE IS STILL NOT STORED, AND THAT IS DELIBERATE. It distinguishes these
 * three too, which is why keeping it looked like the fix — but it opens "N of M items named and
 * found", and never showing a score is a standing rule here: a draft that had never seen the Keep
 * list once scored 6 of 10, because a draft and its Keep share a source. The spec's `noScore`
 * control refuses it. The composed summary below draws the same distinction with three verbs and no
 * arithmetic, so the sentence is reworded at the parser (where it is logged) and composed afresh
 * here (where it is stored).
 */
export function keepCheckOutcome(report: KeepCheckReport, meta: Record<string, any>): any {
  if (!report.ok) return keepCheckNotRun('the check failed: ' + report.summary.replace(/^KEEP CHECK FAILED: /, ''), meta);
  const misses = keepMisses(report);
  const unproven = keepUnproven(report);
  // MISSES is the stronger claim and wins when both are present: something IS named absent.
  const state: KeepCheckState = misses.length ? 'MISSES' : (unproven.length ? 'UNPROVEN' : 'NO MISSES');
  const items = report.items.map((i) => ({ item: i.item, text: i.text, status: i.status, found: i.found, missing: i.missing, lines: i.lines }));
  const namedAbsent = misses.filter((m) => !m.endsWith(NOT_CHECKED));
  const notChecked = misses.filter((m) => m.endsWith(NOT_CHECKED)).map((m) => m.slice(0, -NOT_CHECKED.length));
  const parts: string[] = [];
  if (namedAbsent.length) parts.push('not found: ' + namedAbsent.join('; '));
  if (notChecked.length) parts.push('not checked: ' + notChecked.join('; '));
  if (unproven.length) parts.push('claimed but not shown: ' + unproven.join('; '));
  return { state, misses, unproven, items, salvaged: report.salvaged, invalid: report.invalid,
    // Absent when nobody asked twice — the gate reads this to choose its closing line.
    ...(report.reask ? { reask: report.reask } : {}), ...meta,
    summary: parts.length ? 'KEEP CHECK — ' + parts.join(' · ')
      : 'KEEP CHECK — nothing named in the KEEP list is missing from the draft (presence only; not a judgment of how it is used)' };
}
