import { stoppedAtCeiling } from '../../ai/empty-output.util';

/**
 * PLAN 01 TASK 3 — A PLAN-STATE CALL THAT CANNOT RUN OUT OF ROOM, AND A FAILURE THAT SURVIVES.
 *
 * WHAT THE 2 OCT RUN MEASURED. extractPlanState walked the plan in `const CHUNK = 50` asking for
 * `maxTokens: 16000`. The 81-scene plan made two calls:
 *
 *   12:42:52Z  scenes 1-50   prompt 18,073 chars  out 16,000  stop max_tokens  $0.4398
 *   12:45:21Z  scenes 51-81  prompt 12,410 chars  out 10,099  stop end_turn    $0.2792
 *
 * The complete call is the only honest per-scene figure: 10,099 / 31 = 326 output tokens per scene.
 * 50 x 326 = 16,300 against a 16,000 ceiling — THE REQUEST COULD NOT FIT BEFORE IT WAS SENT. The
 * first call ended mid-array, the parse threw "Expected ',' or ']' after array element in JSON at
 * position 14687", the catch logged "scenes 1-50 returned nothing usable — the ledger loses
 * knowledge and geography for this span" and then ran `continue`. The run proceeded with no plan
 * state for 50 of 81 scenes — 62% of the plan — and the closing log line still reported 41
 * knowledge facts and 103 place observations as though it had read all of it.
 *
 * 326 IS ONE SAMPLE AND IS TREATED AS ONE. It comes from a single complete call on a single story.
 * It is named _OBSERVED, it carries explicit headroom, and the bounded retry below makes being
 * wrong survivable. A size measured once and then trusted is CHUNK = 50 with better arithmetic.
 *
 * Pure; never throws. The only import is stoppedAtCeiling, deliberately: a second notion of "cut
 * off" living next to the first is how the two drift apart.
 */

export interface Slice { start: number; end: number }

/**
 * Output tokens per scene, measured on the one extractPlanState call that completed.
 * 10,099 tokens / 31 scenes (51-81 of 81) = 325.8.
 */
export const TOKENS_PER_SCENE_OBSERVED = 326;

/**
 * The margin on that single sample. At 0.75 a 36-scene slice is budgeted 11,736 of 16,000 tokens,
 * which leaves room for a story 25% denser than the one it was measured on:
 * 36 x 326 x 1.25 = 14,670, still inside the ceiling.
 */
export const HEADROOM = 0.75;

/** Where a call that did not stop at its ceiling is close enough to be the next one that does. */
export const NEAR_CEILING = 0.9;

const intOr0 = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/**
 * Index ranges sized so the EXPECTED output fits the ceiling with headroom.
 *
 * Every scene appears in exactly one slice. That is asserted rather than assumed because a gap here
 * reproduces the original defect — a span of the plan silently unread — with no log line at all to
 * betray it.
 */
export function planStateSlices(sceneCount: any, opts?: { maxTokens?: any } | null): Slice[] {
  const n = intOr0(sceneCount);
  if (n <= 0) return [];
  const cap = intOr0(opts && opts.maxTokens);
  const budget = Math.floor((cap > 0 ? cap : 0) * HEADROOM / TOKENS_PER_SCENE_OBSERVED);
  // At least one scene per slice whatever the ceiling: a zero-width slice would loop forever, and a
  // ceiling too small for even one scene is a fact for the caller to report, not to hang on.
  const per = Math.max(1, budget);
  const out: Slice[] = [];
  for (let start = 0; start < n; start += per) out.push({ start, end: Math.min(n - 1, start + per - 1) });
  return out;
}

/** Two halves, or nothing when a single scene is already the smallest a slice can be. */
export function halve(s: Slice): Slice[] {
  const start = intOr0(s && s.start);
  const end = intOr0(s && s.end);
  const width = end - start + 1;
  if (width <= 1) return [];
  const mid = start + Math.floor(width / 2) - 1;
  return [{ start, end: mid }, { start: mid + 1, end }];
}

/**
 * THE RETRY IS BOUNDED AT TWO HALVINGS.
 *
 * Unbounded, a 50-scene span would be retried six times down to single scenes — fifty more calls to
 * learn what the first failure already said. Two halvings take a 36-scene slice to nine, which is
 * well inside any ceiling this call has ever used; if nine scenes still cannot be read, the problem
 * is not the size and a third halving will not find it.
 */
export function retryPlan(s: Slice, rounds = 2): Slice[][] {
  const attempts: Slice[][] = [];
  let current = [s];
  for (let i = 0; i < rounds; i++) {
    const next = current.flatMap((x) => halve(x));
    if (!next.length) break;
    attempts.push(next);
    current = next;
  }
  return attempts;
}

export type PlanStateFailureKind = 'CEILING' | 'UNPARSEABLE';

/**
 * Halvings allowed below the original slice. Two takes 36 scenes to nine, which is well inside any
 * ceiling this call has used; if nine cannot be read, the problem is not the size.
 */
export const MAX_HALVINGS = 2;

export type AskResult = { rows: any[] } | { fail: PlanStateFailureKind; why?: string };

/**
 * WHY A CALL FAILED — STOP REASON FIRST, PARSE SECOND.
 *
 * The order is the rule. A cut-off call is a FACT THE PROVIDER REPORTS; an unparseable body is an
 * inference from the damage. On 2 Oct the body was unparseable BECAUSE the call was cut off, and a
 * parse-first reading blames the model for malformed JSON and retries the same impossible request.
 * Valid JSON after a max_tokens stop is still a truncated answer — the array closed early, or the
 * model happened to finish an object before the ceiling fell — so the stop reason settles it even
 * when the body parses.
 */
export function whyFailed(facts: any, body: any): PlanStateFailureKind | null {
  if (stoppedAtCeiling(facts || {})) return 'CEILING';
  const text = String(body == null ? '' : body);
  if (!text.trim()) return 'UNPARSEABLE';
  try {
    JSON.parse(text);
    return null;
  } catch {
    return 'UNPARSEABLE';
  }
}

/**
 * A CALL THAT CAME CLOSE. Reported, never acted on.
 *
 * planScenes call 2 on 2 Oct used 14,097 of 15,000 — 94% — and stopped `end_turn`. It was not cut
 * off, so stoppedAtCeiling is correctly false, and nothing noticed. A call that close is the next
 * truncation, and the only reason anyone knows is that someone read the ledger afterwards. This is
 * detection only: no retry, no resize. The next run's row is how a person decides to raise it.
 */
export function nearCeiling(facts: any): boolean {
  const cap = intOr0(facts && facts.maxTokens);
  const used = intOr0(facts && facts.outputTokens);
  return cap > 0 && used >= cap * NEAR_CEILING;
}

/** 1-based, because the log line, the plan and the reader all are. */
export function sliceLabel(s: Slice): string {
  const a = intOr0(s && s.start) + 1;
  const b = intOr0(s && s.end) + 1;
  return a === b ? 'scene ' + a : 'scenes ' + a + '-' + b;
}

export interface PlanStateFailure {
  state: 'NOT_RUN';
  reason: string;
  scenesLost: number;
  slice: Slice;
  kind: PlanStateFailureKind;
  /**
   * THE SAME WORDS, WHERE checkItems WILL FIND THEM.
   *
   * findingsEntry turns a sweep's findings into items through checkItems, which reads `detail` for
   * the body and `scenes` for the location. This shape carried neither, so a lost 50-scene span
   * reached the revision as `{ scene: null, kind: 'CEILING', detail: 'no detail was recorded on
   * this planState finding' }` — a row that looks like a record and says nothing. That is worse
   * than the log line it replaced.
   */
  detail: string;
  /**
   * The scene a reader should open: the FIRST of the span, because the gap begins there. A span is
   * not a defect at a point — the detail carries the whole range — and a single-element array keeps
   * it clear of the rule that a multi-scene finding points at its latest scene.
   */
  scenes: number[];
}

/**
 * What a span that could not be read leaves behind. The point is that it leaves something: the old
 * path logged one line and ran `continue`, so the revision could not distinguish "this span has no
 * facts" from "this span was never read", and the final tally reported the partial figures as whole.
 */
export function ceilingFailure(slice: Slice, kind: PlanStateFailureKind, halvings: number): PlanStateFailure {
  const start = intOr0(slice && slice.start);
  const end = intOr0(slice && slice.end);
  const lost = Math.max(0, end - start + 1);
  const what = kind === 'CEILING'
    ? 'was cut off at its ceiling every time'
    : 'returned nothing that could be parsed';
  const reason = sliceLabel({ start, end }) + ' ' + what + ', after ' + halvings + ' halving'
    + (halvings === 1 ? '' : 's') + ' — the ledger has no knowledge or geography for this span';
  return {
    state: 'NOT_RUN',
    reason,
    scenesLost: lost,
    slice: { start, end },
    kind,
    detail: reason,
    scenes: [start + 1],
  };
}

/**
 * READ A SPAN, KEEPING WHATEVER CAME BACK.
 *
 * The first wiring of this retry re-asked the WHOLE partition each round and threw away a half that
 * had already answered: whole slice, then both halves, then all four quarters — up to seven calls,
 * with the good half paid for twice and discarded twice. It also reported the entire original slice
 * as lost when any part of it failed, so 28 scenes that had been read fine were recorded as gone.
 *
 * This descends instead. A half that answers is kept and never asked again; only the half that
 * failed is halved. One half failing costs five calls where the partition cost seven, and the
 * failure that reaches the revision names ONLY the sub-span actually lost.
 *
 * `ask` is injected so the descent is testable without a model: the call-count assertions in the
 * spec are the whole point of this function existing separately from the service.
 */
export async function readSpanWithRetry(
  sl: Slice,
  ask: (s: Slice) => Promise<AskResult>,
  maxHalvings = MAX_HALVINGS,
  onHalve?: (s: Slice, why: string) => void,
): Promise<{ rows: any[]; failures: PlanStateFailure[]; calls: number }> {
  let calls = 0;

  const walk = async (s: Slice, depth: number): Promise<{ rows: any[]; failures: PlanStateFailure[] }> => {
    calls++;
    const res = await ask(s);
    if ('rows' in res) return { rows: Array.isArray(res.rows) ? res.rows : [], failures: [] };

    const halves = depth < maxHalvings ? halve(s) : [];
    // Out of halvings, or a single scene that cannot be split: this span is lost, and it says so.
    if (!halves.length) return { rows: [], failures: [ceilingFailure(s, res.fail, depth)] };

    if (onHalve) onHalve(s, String(res.why || res.fail));
    const rows: any[] = [];
    const failures: PlanStateFailure[] = [];
    for (const h of halves) {
      const r = await walk(h, depth + 1);
      rows.push(...r.rows);
      failures.push(...r.failures);
    }
    return { rows, failures };
  };

  const out = await walk(sl, 0);
  return { rows: out.rows, failures: out.failures, calls };
}
