/**
 * DEVELOPMENT SO FAR — AND IT SAYS WHAT IT ACTUALLY HOLDS.
 *
 * Every stage is written "consistent with everything already written", and the block above it said
 * exactly that — while carrying the first 2,400 characters of each earlier stage and nothing else.
 * On 11 Sep that cut, measured: V2.6's BEATS received 5,095 characters of a 15,067-character ladder,
 * and the three things it then invented were all past the cut — the bracelet's owner (TREATMENT
 * @6,041), "four days" (TREATMENT @5,626) and "thirty hours" (SYNOPSIS @2,807). BEATS wrote "Moira's
 * bracelet" for a bracelet the TREATMENT had already called Celeste's own, and a third duration for a
 * delay the source never timed. A stage cannot be consistent with text it was never shown.
 *
 * THE LABEL IS THE HONEST HALF, AND IT IS FREE. This module changes no content and no cap: it names
 * what each entry is — "(first 2,400 of 9,792 characters)" or "(complete, 241 characters)" — so a
 * fragment is legible as a fragment. It is source-excerpt.util's argument in the same codebase: a
 * reader told it holds an excerpt behaves differently from one that believes it holds the document.
 *
 * The cap's SHAPE (whole stages, most recent first) is a separate change, measured before it is
 * chosen. Pure; never throws.
 */

export interface SoFarStage { kind: string; body: string }
export interface SoFarPart { kind: string; sent: number; total: number; complete: boolean }
export interface SoFarResult {
  /** The block as it goes into the prompt, header included; '' when there is nothing to carry. */
  block: string;
  /** What was carried, in ladder order. */
  parts: SoFarPart[];
  /** What the budget could not carry — named in the block, never silently absent. */
  omitted: { kind: string; total: number }[];
}

/**
 * THE BUDGET IS SPENT ON WHOLE STAGES, MOST RECENT FIRST — and 64,000 was chosen from the ledger,
 * not from respect for the old number. The largest prior ladder on any build measured is 60,265
 * characters (cmttt92yx at DRAFT), so this carries every one of them whole at every rung. The old
 * 14,000 never once bound (the largest block built was 12,377): it was a default, not a fit.
 *
 * PRICED: 2.85–3.70 characters per input token measured across the develop tasks, $5/M input on
 * claude-opus-5 (ai-cost.util), no caching in use on these calls. Carrying the whole ladder at every
 * rung costs +$0.18 on the largest build measured, and $0.10 for the single DRAFT call — against the
 * $4/script this project is planned around.
 */
export const SOFAR_BUDGET = 64000;
/** Below this, the remaining space is not worth a fragment: the stage is named as omitted instead. */
export const SOFAR_MIN_FRAGMENT = 500;
const HEADER = '\nDEVELOPMENT SO FAR (everything already written - stay fully consistent with all of it; build directly on it):';
const num = (n: number) => n.toLocaleString('en-US');

/** '--- TREATMENT (first 2,400 of 9,792 characters) ---' / '--- LOGLINE (complete, 241 characters) ---' */
export function soFarLabel(kind: string, sent: number, total: number): string {
  return '--- ' + kind + (sent < total ? ' (first ' + num(sent) + ' of ' + num(total) + ' characters)' : ' (complete, ' + num(total) + ' characters)') + ' ---';
}

export function developmentSoFar(stages: SoFarStage[], budget = SOFAR_BUDGET): SoFarResult {
  const all = (Array.isArray(stages) ? stages : [])
    .map((st) => ({ kind: String((st && st.kind) || ''), body: String((st && st.body) || '') }))
    .filter((st) => st.body);
  if (!all.length) return { block: '', parts: [], omitted: [] };

  // NEWEST FIRST, WHOLE. The stage a rung must not contradict is the one just below it, so the budget
  // is spent from the bottom up. The first stage that does not fit whole goes in as ONE fragment of
  // what is left — a dropped stage is the failure this replaces, so nothing is dropped while there is
  // room to carry part of it. Anything past that is omitted, and named in the block.
  const taken = new Map<string, number>();          // kind → characters carried
  let used = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    const st = all[i];
    const room = budget - used;
    if (st.body.length <= room) { taken.set(st.kind, st.body.length); used += st.body.length; continue; }
    if (room >= SOFAR_MIN_FRAGMENT) { taken.set(st.kind, room); used += room; }
    break;
  }
  const omitted = all.filter((st) => !taken.has(st.kind)).map((st) => ({ kind: st.kind, total: st.body.length }));

  // Printed oldest first: it reads as a ladder, and the newest — the one that matters most — ends up
  // closest to the instruction that follows it.
  const parts: SoFarPart[] = [];
  let body = '';
  for (const st of all) {
    const sent = taken.get(st.kind);
    if (sent === undefined) continue;
    const piece = st.body.slice(0, sent);
    parts.push({ kind: st.kind, sent: piece.length, total: st.body.length, complete: piece.length === st.body.length });
    body += '\n' + soFarLabel(st.kind, piece.length, st.body.length) + '\n' + piece;
  }
  const note = omitted.length
    ? '\n[Not carried here, for length: ' + omitted.map((o) => o.kind + ' (' + num(o.total) + ' characters)').join(', ') + '. Everything below this line is present as labelled.]'
    : '';
  return { block: HEADER + note + body, parts, omitted };
}
