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
  parts: SoFarPart[];
  /** True when the block cap cut the front off — the first entry below it may begin mid-sentence. */
  frontCut: boolean;
}

export const SOFAR_PER_STAGE = 2400;
export const SOFAR_BLOCK = 14000;
const HEADER = '\nDEVELOPMENT SO FAR (everything already written - stay fully consistent with all of it; build directly on it):';
const CUT_NOTE = '\n[The start of this block was cut to fit ' + SOFAR_BLOCK.toLocaleString('en-US')
  + ' characters: the first entry below may begin mid-sentence.]';

const num = (n: number) => n.toLocaleString('en-US');

/** '--- TREATMENT (first 2,400 of 9,792 characters) ---' / '--- LOGLINE (complete, 241 characters) ---' */
export function soFarLabel(kind: string, sent: number, total: number): string {
  return '--- ' + kind + (sent < total ? ' (first ' + num(sent) + ' of ' + num(total) + ' characters)' : ' (complete, ' + num(total) + ' characters)') + ' ---';
}

export function developmentSoFar(stages: SoFarStage[], perStage = SOFAR_PER_STAGE, blockCap = SOFAR_BLOCK): SoFarResult {
  const parts: SoFarPart[] = [];
  let soFar = '';
  for (const st of Array.isArray(stages) ? stages : []) {
    const body = String((st && st.body) || '');
    if (!body) continue;
    const piece = body.slice(0, perStage);
    parts.push({ kind: String(st.kind || ''), sent: piece.length, total: body.length, complete: piece.length === body.length });
    soFar += '\n' + soFarLabel(String(st.kind || ''), piece.length, body.length) + '\n' + piece;
  }
  if (!soFar) return { block: '', parts: [], frontCut: false };
  const frontCut = soFar.length > blockCap;
  if (frontCut) soFar = soFar.slice(soFar.length - blockCap);
  // The tail slice starts mid-content, so the note needs its own line to be readable as a note.
  return { block: HEADER + (frontCut ? CUT_NOTE + '\n' : '') + soFar, parts, frontCut };
}
