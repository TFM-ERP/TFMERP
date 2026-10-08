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

import { windowKeepingEnd, type Window } from './excerpt-window.util';

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

/**
 * THIS BLOCK'S FLOORS ARE LOWER THAN THE PROMPT-PART DEFAULTS, AND THE REASON IS THE ALTERNATIVE.
 *
 * excerpt-window's defaults (head 1,200 / tail 1,600) suit a part competing for room in a prompt,
 * where a budget too small to give both ends means the part should say it was not carried. Here the
 * alternative is not a smaller part — it is DROPPING A WHOLE LADDER STAGE, which is the exact
 * failure this module was written to end: "a dropped stage is the failure this replaces, so nothing
 * is dropped while there is room to carry part of it."
 *
 * With the defaults, a 2,834-character room — enough for a real fragment — fell under the floor and
 * the stage vanished from the block entirely. That trades a known defect for a worse one. These
 * floors keep both ends legible at fragment sizes and leave the drop for rooms that genuinely
 * cannot carry a window.
 */
const FRAGMENT_FLOORS = { minHead: 400, minTail: 600, minSide: 200 };
const HEADER = '\nDEVELOPMENT SO FAR (everything already written - stay fully consistent with all of it; build directly on it):';
const num = (n: number) => n.toLocaleString('en-US');

/**
 * '--- LOGLINE (complete, 241 characters) ---'
 * '--- TREATMENT (opening and ending - 2,400 of 9,792 characters; 7,392 omitted from the middle) ---'
 *
 * The middle form is new. It used to read "(first 2,400 of 9,792 characters)", which was honest
 * about the QUANTITY and silent about the SHAPE — and the shape was a head slice, so every
 * shortened stage arrived without its ending. The `first` wording is kept for a caller that still
 * passes no elision, so the label never describes a window that was not made.
 */
export function soFarLabel(kind: string, sent: number, total: number, elided = 0): string {
  if (sent >= total) return '--- ' + kind + ' (complete, ' + num(total) + ' characters) ---';
  if (elided > 0) {
    return '--- ' + kind + ' (opening and ending - ' + num(sent) + ' of ' + num(total)
      + ' characters; ' + num(elided) + ' omitted from the middle) ---';
  }
  return '--- ' + kind + ' (first ' + num(sent) + ' of ' + num(total) + ' characters) ---';
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
  // THE SHAPE OF THE BUDGET IS UNCHANGED — whole stages, newest first, the one that does not fit
  // whole goes in as a single fragment. What changed is that the fragment is now a WINDOW: its head
  // AND its tail, with the omission marked, instead of its first N characters. A stage carried
  // whole is untouched, so on a ladder that fits inside the budget this block is byte-identical to
  // what it was.
  const taken = new Map<string, Window>();
  let used = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    const st = all[i];
    const room = budget - used;
    if (st.body.length <= room) { taken.set(st.kind, windowKeepingEnd(st.body, room)); used += st.body.length; continue; }
    if (room >= SOFAR_MIN_FRAGMENT) {
      // The window has its own floor — both ends must be legible or it is not a window. A room that
      // clears SOFAR_MIN_FRAGMENT but not that floor yields a dropped window, and the stage is then
      // NAMED as omitted rather than carried as a stub.
      const w = windowKeepingEnd(st.body, room, FRAGMENT_FLOORS);
      if (!w.dropped) { taken.set(st.kind, w); used += room; }
    }
    break;
  }
  const omitted = all.filter((st) => !taken.has(st.kind)).map((st) => ({ kind: st.kind, total: st.body.length }));

  // Printed oldest first: it reads as a ladder, and the newest — the one that matters most — ends up
  // closest to the instruction that follows it.
  const parts: SoFarPart[] = [];
  let body = '';
  for (const st of all) {
    const w = taken.get(st.kind);
    if (!w) continue;
    parts.push({ kind: st.kind, sent: w.sent, total: w.total, complete: w.complete });
    body += '\n' + soFarLabel(st.kind, w.sent, w.total, w.elided) + '\n' + w.text;
  }
  const note = omitted.length
    ? '\n[Not carried here, for length: ' + omitted.map((o) => o.kind + ' (' + num(o.total) + ' characters)').join(', ') + '. Everything below this line is present as labelled.]'
    : '';
  return { block: HEADER + note + body, parts, omitted };
}
