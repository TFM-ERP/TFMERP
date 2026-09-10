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
export function truncationFlag(f: EmptyOutputFacts, extra?: { items?: number; passes?: number }): TruncationFlag {
  const out: TruncationFlag = {
    stopReason: f && f.stopReason ? String(f.stopReason) : null,
    outputTokens: num(f && f.outputTokens),
    maxTokens: num(f && f.maxTokens),
  };
  if (extra && extra.items != null) out.items = extra.items;
  if (extra && extra.passes != null) out.passes = extra.passes;
  return out;
}

function noteFor(t: TruncationFlag): string {
  const spend = 'output ' + fmt(t.outputTokens) + '/' + fmt(t.maxTokens) + ' tokens' + (t.stopReason ? ', stop reason "' + t.stopReason + '"' : '');
  const head = t.passes != null
    ? 'INCOMPLETE — still cut off at its ' + fmt(t.maxTokens) + '-token ceiling after ' + t.passes + ' continuation pass(es)' + (t.items != null ? ' (' + t.items + ' items kept)' : '')
    : 'INCOMPLETE — this stage stopped at its ' + fmt(t.maxTokens) + '-token ceiling, part-way through';
  return head + ' (' + spend + '). It is not counted as done. Regenerate it.';
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
