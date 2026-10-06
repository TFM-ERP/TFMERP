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
   * BOTH COUNTS, SO "THE CARDS WON" IS CHECKABLE RATHER THAN ASSERTED.
   *
   * `source` says which list the writer got; these say what the alternative was. On run 1 the cards
   * won 34 to roughly 7, and that 7 could only be INFERRED from the planning call's output tokens
   * because the planner's own list is stored nowhere. null means the caller did not say — never 0,
   * which would read as "the planner returned none".
   */
  plannerCount: number | null;
  cardsCount: number | null;
  /**
   * How many scenes in the stored list declare an exit.
   *
   * Run 1 stored 0 of 34, and the reason was not that the planner saw no deaths: sceneCards maps
   * five fields and no `exits` at all, so a cards-sourced plan CANNOT declare one. A zero here with
   * source 'cards' is a statement about the pipeline, not about the story.
   */
  exitsDeclared: number;
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
  opts?: {
    wroteFrom?: number | null;
    /** What the planner's own list held, and what the SCENES cards held. See StoredScenePlan. */
    plannerCount?: number | null;
    cardsCount?: number | null;
  } | null,
  now: Date = new Date(),
): StoredScenePlan | null {
  if (!Array.isArray(handed)) return null;
  const from = opts && opts.wroteFrom != null ? Number(opts.wroteFrom) : null;
  const num = (v: any): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const scenes = handed.map((sc: any) => ({
    intExt: str(sc && sc.intExt),
    location: str(sc && sc.location),
    dayNight: str(sc && sc.dayNight),
    brief: str(sc && sc.brief),
    characters: str(sc && sc.characters),
    exits: exitsOf(sc && sc.exits),
    pageWeight: weight(sc && sc.pageWeight),
    heading: planHeading(sc),
  }));
  return {
    count: handed.length,
    at: now.toISOString(),
    source,
    wroteFrom: Number.isFinite(from as number) ? (from as number) : null,
    plannerCount: num(opts && opts.plannerCount),
    cardsCount: num(opts && opts.cardsCount),
    exitsDeclared: scenes.filter((x) => x.exits.length > 0).length,
    scenes,
  };
}

/**
 * WHAT THE RUN KNEW AND THE ROW DID NOT SAY.
 *
 * Appended to the planState entry's reason, never folded into its state: none of this is a defect
 * in the plan state, and a clean sweep must stay clean. Two facts, both measured on run 1 and both
 * reaching nothing but a log line:
 *
 *   THE DISCARDED CLOCK. extractPlanState drops the WHOLE planned clock when it runs backwards at
 *   any point (clock.clear()), on the sound grounds that handing a broken timeline to a hundred
 *   scene prompts spreads the damage. Run 1 discarded it at 1 point and the row still read "the
 *   planState sweep ran and found nothing" — so a reader could not tell a draft written WITH a
 *   planned clock from one written without. The discard rule is untouched; only the silence is.
 *
 *   THE UNDECLARED EXITS. 0 of 34, because the cards carry no exits field. Said plainly, with the
 *   source beside it, so the zero cannot be read as "nobody dies in this film".
 */
export function planStateNote(
  plan: StoredScenePlan | null | undefined,
  facts?: { clockDiscardedAt?: number } | null,
): string {
  const bits: string[] = [];
  const dropped = Number((facts && facts.clockDiscardedAt) || 0);
  if (dropped > 0) {
    bits.push('the planned clock ran backwards at ' + dropped + ' point' + (dropped === 1 ? '' : 's')
      + ' and was discarded in full — this draft was written with no planned clock');
  }
  if (plan && plan.count > 0 && plan.exitsDeclared === 0) {
    const where = plan.source === 'cards'
      ? ' (the SCENES cards carry no exits field, so a cards-sourced plan cannot declare one)'
      : '';
    bits.push('no exits declared in ' + plan.count + ' scene(s) from the ' + plan.source + where);
  }
  if (plan && plan.plannerCount != null && plan.cardsCount != null) {
    bits.push('planner ' + plan.plannerCount + ' vs cards ' + plan.cardsCount + ' — the ' + plan.source + ' won');
  }
  return bits.join(' · ');
}

/**
 * THE SUBJECT A planState VERDICT IS FINGERPRINTED OVER — reproducible from the column.
 *
 * Run 1 stored planState CLEAN and a reader saw STALE. The hash had been taken over
 * JSON.stringify(scenes), the RAW handed array, while the column stores the normalised projection:
 * no reader could reproduce it from anything available, so the row read STALE for ever. That is the
 * failure readCheckEntry avoids by refusing to staleness-check plan.tail at all — making `plan`
 * comparable and then hashing something unstorable was worse than leaving it uncomparable.
 *
 * `at` IS EXCLUDED DELIBERATELY. It changes on every store, so including it would make the
 * fingerprint depend on WHEN it was taken rather than on what it describes, and a second store of
 * an identical plan would read as a change. What is hashed is the content: the count, where the
 * list came from, where writing began, and the scenes themselves.
 */
export function scenePlanSubject(plan: StoredScenePlan | null | undefined): string {
  if (!plan || typeof plan !== 'object') return '';
  const scenes = Array.isArray(plan.scenes) ? plan.scenes : [];
  // POSITIONAL TUPLES, NOT OBJECTS. JSON.stringify follows insertion order and Postgres normalises
  // jsonb key order, so an object-shaped subject differs between the plan written and the plan read
  // back — measured on the real column: written intExt,location,dayNight,brief,characters,exits,
  // pageWeight,heading; read back brief,exits,intExt,heading,dayNight,location,characters,
  // pageWeight. A tuple has no key order to lose, so the fixed field order below IS the format.
  return JSON.stringify([
    plan.count,
    plan.source,
    plan.wroteFrom === undefined ? null : plan.wroteFrom,
    scenes.map((sc: any) => [
      sc && sc.intExt, sc && sc.location, sc && sc.dayNight, sc && sc.brief, sc && sc.characters,
      (Array.isArray(sc && sc.exits) ? sc.exits : []).map((e: any) => [e && e.name, e && e.how]),
      sc && sc.pageWeight, sc && sc.heading,
    ]),
  ]);
}
