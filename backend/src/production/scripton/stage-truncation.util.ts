import type { EmptyOutputFacts } from '../../ai/empty-output.util';

/**
 * A STAGE THAT HIT ITS CEILING SAYS SO — AND IS NOT DONE.
 *
 * The v2.2 DRAFT stopped at its own 25,000-token ceiling (output 25,000/25,000, stop reason
 * "max_tokens") in the middle of a sentence — "...eleven-forty, ten-eighty, eleven-ten. Beautiful.
 * Consistent" — forty scenes and 38,257 characters into the film, and filed as a finished stage
 * anyway. The version DID carry a sentence saying it might be incomplete. Nothing
 * rendered that sentence, and the board counted the stage as done, so three people read the draft
 * without anyone calling it truncated. A warning that nothing displays and nothing reads is the same
 * silent success as no warning.
 *
 * So the fact is stored as a FLAG, not only as prose: `data.truncated`, which a consumer that has to
 * decide something (is this stage done? can the ladder move on?) can read without parsing English.
 * Same family as the ending gate in planScenes: a document that does not reach its end is not
 * complete, whatever the provider reported.
 *
 * THE READER IS TOLERANT OF THE OLD PROSE. Every version written before the flag existed carries only
 * the sentence — v2.2's DRAFT among them — so `truncationOf` also recognises the two notes this
 * pipeline has always written on a cut-off stage. Reading only the new field would have left the very
 * draft that prompted this filed as complete.
 *
 * Pure; no I/O.
 */

export interface TruncationFlag {
  stopReason: string | null;
  outputTokens: number | null;
  maxTokens: number | null;
  /** Array stages (SCENES / STEP_OUTLINE): the items kept, and the continuation passes spent. */
  items?: number | null;
  passes?: number | null;
  /** Why the continuation stopped short, when a piece failed rather than simply ran out of passes. */
  failed?: string | null;
}

export interface StageTruncation extends TruncationFlag {
  /** 'flag' — recorded when the version was written; 'warning' — read back from the older note. */
  from: 'flag' | 'warning';
  /** One sentence for the writer. */
  note: string;
}

const num = (v: any): number | null => {
  if (typeof v === 'number' && isFinite(v)) return v;
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return String(v ?? '').trim() && isFinite(n) ? n : null;
};
const fmt = (v: number | null | undefined) => (typeof v === 'number' ? v.toLocaleString('en-US') : '?');

/** The flag persisted on a version whose response stopped at its ceiling. */
export function truncationFlag(f: EmptyOutputFacts, extra?: { items?: number; passes?: number; failed?: string | null }): TruncationFlag {
  const out: TruncationFlag = {
    stopReason: f && f.stopReason ? String(f.stopReason) : null,
    outputTokens: num(f && f.outputTokens),
    maxTokens: num(f && f.maxTokens),
  };
  if (extra && extra.items != null) out.items = extra.items;
  if (extra && extra.passes != null) out.passes = extra.passes;
  if (extra && extra.failed) out.failed = String(extra.failed).slice(0, 300);
  return out;
}

function noteFor(t: TruncationFlag): string {
  const spend = 'output ' + fmt(t.outputTokens) + '/' + fmt(t.maxTokens) + ' tokens' + (t.stopReason ? ', stop reason "' + t.stopReason + '"' : '');
  const head = t.passes != null
    ? 'INCOMPLETE — still cut off at its ' + fmt(t.maxTokens) + '-token ceiling after ' + t.passes + ' continuation pass(es)' + (t.items != null ? ' (' + t.items + ' items kept)' : '')
    : 'INCOMPLETE — this stage stopped at its ' + fmt(t.maxTokens) + '-token ceiling, part-way through';
  return head + (t.failed ? ' — ' + t.failed : '') + ' (' + spend + '). It is not counted as done. Regenerate it.';
}

// ── WHAT A CUT-OFF STAGE MAY NOT DO ─────────────────────────────────────────────────────────────
//
// It may be read, copied and exported. It may not be built on: no later stage is generated from it,
// it cannot be approved or locked, and no script is written from a ladder that contains one — least
// of all over a script that already exists, where a half-finished run would replace finished work.
// The wording lives here, with the flag, so every refusal names the stage, says why, and says what
// is still allowed.

const label = (kind: string) => { const k = String(kind || '').replace(/_/g, ' ').toLowerCase(); return k.charAt(0).toUpperCase() + k.slice(1); };
const list = (kinds: string[]) => { const l = kinds.map(label); return l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1]; };
const still = (n: number) => ' You can still read, copy and export ' + (n === 1 ? 'it' : 'them') + '.';

/** Generating `kind` when earlier stages are cut off. Null when nothing blocks it. */
export function nextStageRefusal(kind: string, cutEarlier: string[]): string | null {
  const cut = (cutEarlier || []).filter(Boolean);
  if (!cut.length) return null;
  const one = cut.length === 1;
  return label(kind) + ' cannot be written yet: ' + list(cut) + (one ? ' is' : ' are') + ' incomplete — cut off at the token ceiling —'
    + ' and every later stage is written from ' + (one ? 'it' : 'them') + '. Regenerate ' + list(cut) + ' first.' + still(cut.length);
}

/** Approving or locking a cut-off version. Null when the status is not an approval or the version is complete. */
export function approvalRefusal(kind: string, status: string, cut: StageTruncation | null): string | null {
  const s = String(status || '').toUpperCase();
  if (!cut || (s !== 'APPROVED' && s !== 'LOCKED')) return null;
  return 'This ' + label(kind || 'stage') + ' version is incomplete — cut off at the token ceiling — so it cannot be marked '
    + s.toLowerCase() + '. Regenerate it, or switch to a complete version.' + still(1);
}

/**
 * Writing a script from a ladder that holds cut-off stages. `action`: 'write' files a new script and
 * makes it the build's script; 'rewrite' replaces the active revision of the script that exists;
 * 'production' files the version as the WHITE master of a production project.
 */
export function scriptRefusal(cut: string[], action: 'write' | 'rewrite' | 'production'): string | null {
  const c = (cut || []).filter(Boolean);
  if (!c.length) return null;
  const one = c.length === 1;
  const what = action === 'rewrite' ? 'Your script was not touched. It cannot be regenerated'
    : action === 'production' ? 'This cannot be sent to production'
    : 'No script can be written';
  const why = action === 'production' ? 'It would be filed as the production\'s master script as if it were finished.'
    : 'It would replace your script with a half-finished one, filed as if it were finished.';
  return what + ' while ' + list(c) + (one ? ' is' : ' are') + ' incomplete — cut off at the token ceiling. ' + why
    + ' Regenerate ' + list(c) + ' first.' + still(c.length);
}

// The two notes generateStage has always written on a cut-off stage (truncationWarning for prose,
// extendStageArray for the array stages). Matched on their fixed wording, never on "incomplete"
// alone: the canon shortfall also lands in data.warning and is not a truncation.
const PROSE = /may be incomplete: the model hit its ([\d,]+)-token ceiling/;
const ARRAY = /may be incomplete — still truncating after (\d+) continuation pass\(es\) \((\d+) items\)/;

/** Is this version cut off? From the flag, else from the older note; null when it is complete. */
export function truncationOf(data: any): StageTruncation | null {
  if (!data || typeof data !== 'object') return null;
  const t = data.truncated;
  if (t && typeof t === 'object') {
    const flag: TruncationFlag = { stopReason: t.stopReason ?? null, outputTokens: num(t.outputTokens), maxTokens: num(t.maxTokens) };
    if (t.items != null) flag.items = num(t.items);
    if (t.passes != null) flag.passes = num(t.passes);
    if (t.failed) flag.failed = String(t.failed);
    return { ...flag, from: 'flag', note: noteFor(flag) };
  }
  const w = typeof data.warning === 'string' ? data.warning : '';
  if (!w) return null;
  const p = w.match(PROSE);
  if (p) {
    const out = w.match(/output ([\d,?]+)\/([\d,?]+) tokens/);
    const stop = w.match(/stop reason "([^"]+)"/);
    const flag: TruncationFlag = { stopReason: stop ? stop[1] : null, outputTokens: out ? num(out[1]) : null, maxTokens: num(p[1]) };
    return { ...flag, from: 'warning', note: noteFor(flag) };
  }
  const a = w.match(ARRAY);
  if (a) {
    const flag: TruncationFlag = { stopReason: null, outputTokens: null, maxTokens: null, passes: num(a[1]), items: num(a[2]) };
    return { ...flag, from: 'warning', note: noteFor(flag) };
  }
  return null;
}
