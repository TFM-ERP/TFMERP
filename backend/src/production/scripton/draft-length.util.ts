import { completionRatio, isLengthComplete, isLengthOver, FeatureLengthPlan } from './feature-length.util';

/**
 * F9 — A SEED MUST ANNOUNCE ITSELF.
 *
 * The ladder's DRAFT stage writes a screenplay in one pass. It is NOT the feature: the intended
 * route is LADDER → PROMOTE → EXTEND, and the DRAFT is the seed the feature writer expands. On
 * 18 Sep a ladder DRAFT came back at 59,335 characters — a real screenplay, with an ending — and
 * nothing on the version said whether that was a finished film or half of one. It was 57 pages
 * against a 110-page target. Both readings were available and the row was silent between them.
 *
 * So the version states its page count AGAINST the plan's target, in three states that cannot be
 * confused with each other:
 *
 *   SEED       — short of the completion floor. Not a deliverable draft; promote and extend.
 *   ON_TARGET  — inside the band the planner filed as complete.
 *   OVER       — past the overrun ratio or the hard page cap.
 *
 * THE NOTE STATES THE CONDITION AND PRESCRIBES NO REMEDY, deliberately. It said "promote it to a
 * script and extend it" until 19 Sep, when reading the code established that `extendFeatureAsync`
 * is a RESUME, not a grow: it keeps the existing pages as `out[0]` and appends planned scenes from
 * `startIdx = min(haveN, scenes.length)`, which assumes the draft is a PREFIX of the plan. This
 * draft is a complete film — climax, resolution and THE END inside 54 scenes — so extending it
 * would append scenes 55..84 AFTER the ending. A check that diagnoses correctly and then names the
 * wrong cure is worse than one that only diagnoses.
 *
 * REPORT-ONLY. Nothing here blocks, gates or trims a stage. The thresholds are the engine's own
 * (`isLengthComplete` / `isLengthOver`) so this check and the feature writer's length judgement can
 * never disagree about the same draft — a second opinion with its own constants would be a new
 * defect, not a new instrument.
 */

export type DraftLengthState = 'SEED' | 'ON_TARGET' | 'OVER';

export interface DraftLengthCheck {
  version: number;
  state: DraftLengthState;
  /** Pages by the service's own paginator — never a newline count. */
  pages: number;
  targetPages: number;
  /**
   * Whether that target was ASKED FOR or ASSUMED. Without it `targetPages: 110` reads identically
   * whether a producer typed 110 or the brief was empty and the genre profile supplied its default
   * — the same one-number-two-worlds conflation this check was built to end, reappearing inside the
   * check itself.
   */
  targetFrom: 'BRIEF' | 'DEFAULT';
  /** The floor the finished draft must clear to be filed as complete. */
  minPages: number;
  /** pages / targetPages, rounded to two places. */
  ratio: number;
  genreKey: string;
  /** Plain sentence, so the row reads without arithmetic. */
  note: string;
}

export const DRAFT_LENGTH_VERSION = 1;

export function draftLengthCheck(pages: number, plan: FeatureLengthPlan): DraftLengthCheck {
  const p = Math.max(0, Math.round(Number(pages) || 0));
  const target = plan.targetPages;
  const ratio = completionRatio(p, target);
  const state: DraftLengthState = isLengthOver(p, target) ? 'OVER' : isLengthComplete(p, target) ? 'ON_TARGET' : 'SEED';
  const pct = Math.round(ratio * 100);
  const note = state === 'SEED'
    ? p + ' pages against a target of ' + target + ' (' + pct + '%). THIS IS A SEED, NOT A FEATURE — '
      + 'it is ' + Math.max(0, plan.minPages - p) + ' pages short of the ' + plan.minPages
      + '-page floor, and must not be read as a deliverable draft.'
    : state === 'OVER'
      ? p + ' pages against a target of ' + target + ' (' + pct + '%) — over length.'
      : p + ' pages against a target of ' + target + ' (' + pct + '%) — within the completion band ('
        + plan.minPages + ' pages and up).';
  const assumed = plan.targetFrom === 'DEFAULT'
    ? ' The target was NOT asked for: the brief names no length, so ' + target + ' is the '
      + plan.genreKey + ' profile\'s default. Every judgement above is measured against an assumption.'
    : '';
  return { version: DRAFT_LENGTH_VERSION, state, pages: p, targetPages: target, targetFrom: plan.targetFrom, minPages: plan.minPages, ratio: Math.round(ratio * 100) / 100, genreKey: plan.genreKey, note: note + assumed };
}
