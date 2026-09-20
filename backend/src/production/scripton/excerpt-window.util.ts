/**
 * A SHORTENED STAGE MUST STILL CARRY HOW IT ENDS.
 *
 * Every builder that puts a stage body into a prompt cut it with `body.slice(0, n)` — the head, and
 * nothing else. For a synopsis that loses the resolution. For an ordered document — a beat map, a
 * step outline — it deletes the climax, which is the one part the reader is being asked to plan or
 * write toward.
 *
 * MEASURED ON Jason Quick V3.2 (19 Sep), before this existed:
 *
 *   buildSpine     BEAT MAP 11,996 chars sliced to 9,000, then the 20,000 global cap cut it again
 *                  7,604 in. The 2,996 discarded characters were Jason taking the recording to
 *                  Ward, Reyes's court application, Vex surrendering the records, and the ENTIRE
 *                  Resolution/Climax beat — 1,986 characters ending on "Jason's enough". The STEP
 *                  OUTLINE (14,399 chars) contributed ZERO characters: it never arrived at all.
 *   buildFeatureCtx  BEAT MAP 11,996 -> 2,200. 82% discarded from the tail, on EVERY one of the
 *                  40-84 per-scene calls. The writer composing scene 80 had never seen the ending.
 *
 * And the planner received that under the header "FULL DEVELOPED OUTLINE TO COVER (expand every
 * beat, in order, all the way to the end)". The ending gate that catches "never dramatising the
 * outlined climax" was built to repair a planner skipping an ending it was never shown.
 *
 * WHAT THIS DOES: takes the head AND the tail, marks the interior omission, and says on the face of
 * the block what it holds. The budget does not change. The window does.
 *
 * Pure; never throws.
 */

export interface Window {
  /** The windowed text, marker included. '' when the budget was too small to be worth a fragment. */
  text: string;
  /** Characters of the ORIGINAL carried (marker excluded). */
  sent: number;
  total: number;
  complete: boolean;
  /** Characters omitted from the middle. 0 when complete. */
  elided: number;
  /** True when the budget could not fund a useful window; the caller must NAME the part as omitted. */
  dropped: boolean;
}

/**
 * The head's share of the available space. 0.6 leaves 40% for the tail, which on the planner's
 * 9,000-character beat-map budget is 3,551 characters — the whole 1,986-character Resolution/Climax
 * beat, with margin.
 */
export const DEFAULT_HEAD_SHARE = 0.6;

/**
 * A FIXED SHARE IS NOT ENOUGH AT SMALL BUDGETS, which is where the worst cut is.
 *
 * At buildFeatureCtx's 2,200 the share alone yields a 831-character tail — 42% of the final beat,
 * so the per-scene writer would still be shown an ending that stops mid-beat. Measured at 2,200
 * with MIN_SIDE_CHARS 400 (tail | head | share of the 1,986-char final beat):
 *
 *     share only   831 | 1,246 | 42%
 *     MIN_TAIL 1,200  1,200 |   877 | 60%
 *     MIN_TAIL 1,600  1,600 |   477 | 81%     <- chosen
 *     MIN_TAIL 1,800  1,677 |   400 | 84%     (clipped by the bound; buys 3 points for the head's floor)
 *
 * 1,600 is chosen because it is BELOW the hard bound at that budget (1,677), so it is actually
 * achieved rather than silently clipped, and it still leaves a 477-character opening. At 9,000 it
 * is inert — the share already gives more — so it costs the planner nothing.
 *
 * It does NOT make 2,200 sufficient: no value carries the 1,986-character final beat whole at that
 * budget. That is a cap question for buildFeatureCtx, not a windowing one.
 */
export const MIN_TAIL_CHARS = 1600;

/**
 * THE HEAD HAS A FLOOR TOO, and it was missing until buildFeatureCtx made the omission visible.
 *
 * At that site's old 2,200 budget, MIN_TAIL 1,600 left a 477-character head: 81% of the ending and
 * 4% of the opening. That is not a window, it is a tail with an apology. Both ends have to be
 * legible or the part should say it was not carried.
 *
 * Below marker + MIN_HEAD + MIN_TAIL there is no legible window, and the part is DROPPED and NAMED
 * rather than degraded silently. The way to stay above the floor is to fund the part properly —
 * which is why commit 3 raises buildFeatureCtx's per-part caps rather than only windowing them.
 */
export const MIN_HEAD_CHARS = 1200;

/** Neither side may fall below this absolute minimum. */
export const MIN_SIDE_CHARS = 400;

const num = (n: number) => n.toLocaleString('en-US');

/**
 * The seam. It states three things and claims nothing more: what was removed, how much, and that
 * the omission is INTERIOR — so a marked gap cannot be read as "the document stops here".
 *
 * "runs to the end of the document, verbatim" is exactly what boundary snapping guarantees and no
 * more. An earlier draft said "the ending below is complete", which claims the ending is whole —
 * unearned, since a small budget can start the tail inside the final beat.
 */
export function elisionMarker(elided: number, total: number): string {
  return '--- ' + num(elided) + ' of ' + num(total) + ' characters omitted here, from the MIDDLE. '
    + 'What follows runs to the end of the document, verbatim. ---';
}

/** 'BEAT MAP (complete, 11,996 characters)' / 'BEAT MAP (opening and ending - 9,000 of 11,996 characters; 2,996 omitted from the middle)' */
export function windowLabel(kind: string, w: Window): string {
  if (w.complete) return kind + ' (complete, ' + num(w.total) + ' characters)';
  return kind + ' (opening and ending - ' + num(w.sent) + ' of ' + num(w.total)
    + ' characters; ' + num(w.elided) + ' omitted from the middle)';
}

/**
 * SNAPPING ONLY EVER REMOVES CHARACTERS — the head snaps BACKWARDS and the tail's start snaps
 * FORWARDS. That is what keeps the result inside its budget without a second measurement: a
 * boundary search that could grow the window would need the budget re-checked after it, and the
 * defect being fixed here is exactly a budget nobody re-checked.
 */
const TOLERANCE = 300;

/** Last paragraph break at or before `at`, else line break, else word break, else `at` itself. */
function snapBack(s: string, at: number): number {
  const from = Math.max(0, at - TOLERANCE);
  const win = s.slice(from, at);
  const p = win.lastIndexOf('\n\n');
  if (p >= 0) return from + p;
  const l = win.lastIndexOf('\n');
  if (l >= 0) return from + l;
  const w = win.lastIndexOf(' ');
  if (w >= 0) return from + w;
  return at;
}

/** First paragraph break at or after `at`, else line break, else word break, else `at` itself. */
function snapForward(s: string, at: number): number {
  const to = Math.min(s.length, at + TOLERANCE);
  const win = s.slice(at, to);
  const p = win.indexOf('\n\n');
  if (p >= 0) return at + p + 2;
  const l = win.indexOf('\n');
  if (l >= 0) return at + l + 1;
  const w = win.indexOf(' ');
  if (w >= 0) return at + w + 1;
  return at;
}

export function windowKeepingEnd(
  body: any, budget: number, opts?: { headShare?: number; minTail?: number; minHead?: number; minSide?: number },
): Window {
  const s = String(body == null ? '' : body);
  const total = s.length;
  const cap = Math.max(0, Math.floor(Number(budget) || 0));
  if (!total) return { text: '', sent: 0, total: 0, complete: true, elided: 0, dropped: false };
  if (total <= cap) return { text: s, sent: total, total, complete: true, elided: 0, dropped: false };

  const headShare = opts && typeof opts.headShare === 'number' ? Math.min(1, Math.max(0, opts.headShare)) : DEFAULT_HEAD_SHARE;
  const minTail = opts && typeof opts.minTail === 'number' ? Math.max(0, opts.minTail) : MIN_TAIL_CHARS;
  const minSide = opts && typeof opts.minSide === 'number' ? Math.max(0, opts.minSide) : MIN_SIDE_CHARS;
  const minHead = opts && typeof opts.minHead === 'number' ? Math.max(0, opts.minHead) : MIN_HEAD_CHARS;

  // THE MARKER IS CHARGED INSIDE THE BUDGET. An uncharged marker overruns the cap silently, which
  // is this same defect one level up. Its own length is bounded by using `total` as the omitted
  // count — the widest the digits can ever be — so the finished block is always <= budget.
  const markerRoom = elisionMarker(total, total).length + 2;   // +2 for the newlines around it

  if (cap < markerRoom + Math.max(minHead, minSide) + Math.max(minTail, minSide)) {
    // NO USEFUL WINDOW. Emitting a sliver plus a marker would spend the budget saying nothing; the
    // caller names the part as omitted instead, the way developmentSoFar already names what it
    // could not carry.
    return { text: '', sent: 0, total, complete: false, elided: total, dropped: true };
  }

  const avail = cap - markerRoom;
  let tail = Math.max(Math.round(avail * (1 - headShare)), minTail);
  // The head's floor binds the tail's ceiling — MIN_TAIL may not eat the opening.
  tail = Math.min(tail, avail - Math.max(minHead, minSide));
  tail = Math.max(tail, minSide);
  const head = avail - tail;

  const headEnd = snapBack(s, head);
  const tailStart = snapForward(s, total - tail);
  const headText = s.slice(0, headEnd).replace(/\s+$/, '');
  const tailText = s.slice(tailStart).replace(/^\s+/, '');
  const elided = total - headText.length - tailText.length;

  return {
    text: headText + '\n\n' + elisionMarker(elided, total) + '\n\n' + tailText,
    sent: headText.length + tailText.length,
    total,
    complete: false,
    elided,
    dropped: false,
  };
}

// ── The budget, shared between competing parts ────────────────────────────────────────────────

export interface Ask {
  kind: string;
  body: string;
  /** The part's own ceiling, if it has one. Its want is the smaller of this and its length. */
  cap?: number;
}
export interface Allocation { kind: string; budget: number; want: number; dropped: boolean }

/**
 * MAX-MIN FAIR SHARE — every part gets an equal slice; a part wanting less than its slice releases
 * the surplus to the others; repeat until nothing more is released.
 *
 * ORDER-INDEPENDENT, and that is the whole point. buildSpine concatenated its parts general to
 * specific and then cut the tail, so the step outline — the stage nearest an actual scene list, and
 * the most expensive in the ladder — was first to be discarded. REVERSING the order does not fix
 * that, it only moves the victim: specific-first on the measured V3.2 bodies funds the outline and
 * the beat map, cuts the treatment to 1,972 of 8,382, and starves the synopsis to nothing.
 * Position cannot starve a part here, whatever order the parts are written in.
 */
export function allocate(asks: Ask[], total: number, opts?: { floor?: number }): Allocation[] {
  const floor = opts && typeof opts.floor === 'number' ? Math.max(0, opts.floor) : 0;
  const list = (Array.isArray(asks) ? asks : [])
    .map((a) => ({
      kind: String((a && a.kind) || ''),
      want: Math.min(String((a && a.body) || '').length, a && typeof a.cap === 'number' ? Math.max(0, a.cap) : Infinity),
    }))
    .filter((a) => a.want > 0);
  const out: Allocation[] = list.map((a) => ({ kind: a.kind, budget: 0, want: a.want, dropped: false }));
  let rem = Math.max(0, Math.floor(Number(total) || 0));
  const open = out.slice();

  while (open.length) {
    const share = rem / open.length;
    const satisfied = open.filter((a) => a.want <= share);
    if (!satisfied.length) {
      // Nobody can be fully funded: everyone left takes an equal floor-divided share.
      const each = Math.floor(rem / open.length);
      for (const a of open) { a.budget = each; rem -= each; }
      break;
    }
    for (const a of satisfied) { a.budget = a.want; rem -= a.want; open.splice(open.indexOf(a), 1); }
  }

  // A part funded below the floor is NAMED as dropped rather than emitted as a stub, and its budget
  // is released to nobody — the caller decides whether to say so in the block. An untested fallback
  // is the `|| true` pattern with better manners, so this branch has its own acceptance case.
  for (const a of out) if (a.budget < floor) { a.budget = 0; a.dropped = true; }
  return out;
}
