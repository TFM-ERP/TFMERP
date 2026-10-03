/**
 * PLAN 01 TASK 5 — WHAT A STORED PLAN IS.
 *
 * WHY THE PLAN IS WORTH A COLUMN. Every nameDrift, ledger and flashback finding is a disagreement
 * between the PLAN and the PAGE, and the plan half was discarded the moment a run ended. What
 * survived was misleading rather than absent: the ScriptScene rows come from materialiseScenes
 * re-parsing the WRITTEN pages, and on the 2 Oct run that produced 85 rows from an 81-scene plan.
 * The four extra rows are unnumbered "- CONTINUOUS" sub-headings. They are the output re-read, not
 * the plan it was written from, and they are not even the same length.
 *
 * JQ2-FINAL-plan.json exists only because the plan could not be read back out of the database at
 * all. Five searches went into establishing that, and the answer was that nothing stored it.
 *
 * EVERY PLANNER FIELD, AND `exits` ABOVE ALL. The planner's own contract is
 * { intExt, location, dayNight, brief, characters, exits, pageWeight } — the seven fields parse()
 * maps at scripton.service.ts:3082 — plus a heading derived from the first three. An earlier draft
 * of this projection kept four of the seven and dropped exits, which is the one field the planner's
 * prompt describes as "what stops a murdered character answering a telephone eighty pages later":
 * it feeds collectExits -> unavailableAt, so a stored plan without it cannot reproduce a single
 * exit finding and the column would be decorative.
 *
 * `recalled` IS NOT HERE. It is plan STATE, produced by extractPlanState from a separate model
 * call, not something the planner returned. Storing it beside the planner's own fields would file a
 * derived flag as though the model had said it.
 *
 * Pure; never throws. No imports.
 */

/** The planner's own seven, exactly as parse() maps them. */
export const PLANNER_FIELDS = [
  'intExt', 'location', 'dayNight', 'brief', 'characters', 'exits', 'pageWeight',
] as const;

export interface PlannedExit { name: string; how: string }

export interface PlannedScene {
  intExt: string;
  location: string;
  dayNight: string;
  brief: string;
  characters: string;
  /** [{ name, how }]. EMPTY, never absent — see the comment on emptiness below. */
  exits: PlannedExit[];
  pageWeight: number | null;
  /** Derived from intExt / location / dayNight, so a reader does not have to reassemble it. */
  heading: string;
}

/**
 * WHICH LIST THE WRITER WAS HANDED.
 *
 * `planned` is not it. When the developed SCENES cards outnumber the planner's list the cards win
 * (service :5170, :5739), and whichever list wins is then re-weighted by applyPageWeights and
 * cast-stripped by stripExitedCast before a single scene is written. A column holding `planned`
 * could therefore describe a list that never reached the writer, with nothing to say so.
 *
 * 'unknown' is the default rather than 'planner': a caller that does not say must not be recorded
 * as having said the common case.
 */
export type ScenePlanSource = 'planner' | 'cards' | 'unknown';

export interface StoredScenePlan {
  count: number;
  scenes: PlannedScene[];
  at: string;
  source: ScenePlanSource;
  /**
   * The index this run began writing at, on the extend path. NULL means "not an extend" — 0 would
   * say an extend found nothing written, which is a different fact and a real one.
   */
  wroteFrom: number | null;
}

const str = (v: any): string => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

const weight = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Exits, normalised to [{ name, how }].
 *
 * EMPTY RATHER THAN ABSENT, deliberately. The planner is told to omit the field entirely when a
 * scene has no exits, so `undefined` means "the planner said nothing" — but on a stored row that is
 * indistinguishable from "this projection lost it". Since this is the field that decides who may
 * speak again eighty pages later, the two must not look alike, and an explicit [] says the plan was
 * read and had none.
 */
function exitsOf(v: any): PlannedExit[] {
  const list = Array.isArray(v) ? v : (v ? [v] : []);
  return list
    .map((e: any) => ({ name: str(e && e.name), how: str(e && e.how) }))
    .filter((e) => !!e.name);
}

/**
 * The slug a planned scene describes. Assembled rather than stored by the planner, and empty when
 * there is nothing to assemble — "undefined. - undefined" on a row is worse than a blank.
 */
export function planHeading(sc: any): string {
  const ie = str(sc && sc.intExt).toUpperCase();
  const loc = str(sc && sc.location).toUpperCase();
  const dn = str(sc && sc.dayNight).toUpperCase();
  // No all-empty guard: with every part blank the assembly below already yields ''. A guard whose
  // removal changes no behaviour is code that cannot be verified, so it is not here.
  const left = [ie ? ie + '.' : '', loc].filter(Boolean).join(' ');
  return dn ? (left ? left + ' - ' + dn : dn) : left;
}

/**
 * The projection written to ScriptRevision.scenePlan.
 *
 * NULL AND EMPTY ARE DIFFERENT FACTS, and the column's whole comment rests on it. `null` means the
 * planner produced nothing — a failure — and reads back as "this revision predates the column or
 * was never planned". An empty plan means the planner ran and returned no scenes. Collapsing them
 * is the same conflation the three-state check shape exists to prevent, one table over.
 *
 * Junk inside a plan is carried as junk: `count` is what the planner returned, however poor, because
 * a projection that silently drops malformed scenes would make the stored count disagree with the
 * run that produced it.
 */
export function scenePlanFor(
  handed: any,
  source: ScenePlanSource = 'unknown',
  opts?: { wroteFrom?: number | null } | null,
  now: Date = new Date(),
): StoredScenePlan | null {
  if (!Array.isArray(handed)) return null;
  const from = opts && opts.wroteFrom != null ? Number(opts.wroteFrom) : null;
  return {
    count: handed.length,
    at: now.toISOString(),
    source,
    wroteFrom: Number.isFinite(from as number) ? (from as number) : null,
    scenes: handed.map((sc: any) => ({
      intExt: str(sc && sc.intExt),
      location: str(sc && sc.location),
      dayNight: str(sc && sc.dayNight),
      brief: str(sc && sc.brief),
      characters: str(sc && sc.characters),
      exits: exitsOf(sc && sc.exits),
      pageWeight: weight(sc && sc.pageWeight),
      heading: planHeading(sc),
    })),
  };
}
