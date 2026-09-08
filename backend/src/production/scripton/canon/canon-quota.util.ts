import type { CanonFactCore, CanonKind } from './canon.types';
import { CANON_KEEP_BUDGET } from './canon-prompt.util';

/**
 * PER-CATEGORY QUOTA — so biography cannot crowd out structure again.
 *
 * Measured on a real extraction: of 30 facts, CHARACTER 21, RELATIONSHIP 6, TIMELINE 1, WORLD 1,
 * PLOT 1. Structure got nothing. A flat `.slice(0, 30)` over a list the model returns in its own
 * order means the cheapest, most numerous facts — names and ages — take every slot, and raising the
 * cap buys more ages rather than the four sentences that actually went missing.
 *
 * So the budget is allocated, not first-come. Each structural kind gets a guaranteed FLOOR; whatever
 * remains goes to biography; and only then is any leftover space given back to structure. A floor is
 * a minimum, never a maximum — when there is room, more structure is better than more ages.
 *
 * NOTHING IS DROPPED SILENTLY. Every caller receives a full account — extracted, kept, and dropped
 * per kind, plus whether any limit actually bound — because a truncating quota is the same defect as
 * a truncating cap: a rule or a fact that vanishes with no line anywhere is how "do not rename the
 * hero" quietly stops applying. The service warns on any drop and persists the account on the stage
 * version, next to the existing truncation warning.
 */

/**
 * FLOORS, RAISED AGAINST A MEASURED DOCUMENT. They were 6/5/6/5/5 here and 4/3/4/3/3 in the prompt —
 * two different sets of numbers for one idea, and both close to no floor at all on a bible this
 * dense. At a stated cap of 120 the same source yields ROLE 16, CAUSATION 16, ORDERING 18,
 * OUTCOME 17, CRIME 11, so a floor of 4 was never going to bind on anything real; it existed only to
 * stop biography taking every slot, and it should also express what a serious document contains.
 *
 * They match the prompt's "aim for at least" line, and canon-prompt.util.spec.ts fails if they drift.
 */
export const DEFAULT_FLOORS: Partial<Record<CanonKind, number>> = {
  ROLE: 10,       // who the antagonist is, who the betrayer is — one line each, and they decide the film
  CRIME: 8,       // the crime itself, and what is only a mechanism serving it
  CAUSATION: 10,  // authorised / permitted / expanded / executed
  OUTCOME: 8,     // who lives, who dies, who is delivered to whom
  ORDERING: 8,    // what must occur before what
};

/**
 * NO CAP ON PROHIBITIONS, deliberately.
 *
 * They were capped at 12, then 40. Both numbers move the defect rather than retire it: a real bible
 * is dense in rules — the measured 66k source yielded 23, and a denser one (≈40 continuity bullets
 * in one section alone, many negative, plus more elsewhere) exceeds any figure worth guessing. And a
 * dropped prohibition does not merely go unstated: it PERMITS the thing it forbids.
 *
 * They are short strings and they are the cheapest thing in the prompt, so the right cap is none.
 * A caller may still pass `prohibitionLimit` — and if it binds, `capBound` says so and the account
 * names the count, so it can never bind quietly.
 */
export const PROHIBITION_LIMIT = Infinity;

/**
 * KINDS NO BUDGET MAY DISCARD — not the allocator's, not a stage's, not a ceiling's.
 *
 * PROHIBITION was already outside the fact budget. ORDERING joins it because the first run at a cap
 * of 120 dropped twelve ORDERING facts and reported it: "CANON TRUNCATED: dropped 14 (ORDERING 12 ·
 * OUTCOME 2)". Reporting a loss is better than hiding one, but neither of these is a fact that can
 * be thinned. A dropped prohibition PERMITS the thing it forbids; a dropped ordering constraint lets
 * the confrontation land after the climax, and no later stage can tell that the requirement existed.
 *
 * Both are short, both are the cheapest lines in the prompt, and both are rules rather than colour.
 * Any future "CANON TRUNCATED" naming either of them is a defect, not a state.
 */
export const UNDROPPABLE_KINDS: CanonKind[] = ['PROHIBITION', 'ORDERING'];

export interface QuotaResult {
  /** Facts to render as CANON, structure first so it survives any later truncation. */
  facts: CanonFactCore[];
  /**
   * THE UNDROPPABLE KINDS — PROHIBITION and ORDERING. Named for what it holds: it was called
   * `prohibitions` and then ORDERING joined it, at which point the field lied about its contents and
   * two tests read it as a prohibition count. Never mixed into `facts`, never touched by the budget.
   */
  undroppable: CanonFactCore[];
  /** How many came out of the model. */
  extracted: number;
  /** How many reach the prompt (facts + prohibitions). */
  kept: number;
  /** Kept, by kind — the mix, which is how a regression back to biography-only is noticed. */
  counts: Record<string, number>;
  /** Dropped, by kind. Empty when nothing was dropped. */
  droppedByKind: Record<string, number>;
  dropped: number;
  /** True when a limit actually bit. The caller MUST report this rather than swallow it. */
  capBound: boolean;
}

/**
 * Allocate `total` fact slots across kinds, honouring floors, and split prohibitions out.
 * Pure. Input order is preserved within each kind, so the model's own ranking still counts.
 */
export function selectCanonByQuota(
  facts: CanonFactCore[],
  opts?: { total?: number; floors?: Partial<Record<CanonKind, number>>; prohibitionLimit?: number },
): QuotaResult {
  const total = opts?.total ?? CANON_KEEP_BUDGET;
  const floors = opts?.floors ?? DEFAULT_FLOORS;
  const pLimit = opts?.prohibitionLimit ?? PROHIBITION_LIMIT;
  const all = Array.isArray(facts) ? facts.filter(Boolean) : [];

  // The undroppable kinds are lifted out BEFORE any budget is applied, so no arithmetic below can
  // reach them. `prohibitionLimit` remains only so a caller can bind it deliberately and loudly.
  const undroppable = all.filter((f) => UNDROPPABLE_KINDS.includes(f.kind));
  const allProhibitions = undroppable.filter((f) => f.kind === 'PROHIBITION');
  const carried = Number.isFinite(pLimit)
    ? undroppable.filter((f) => f.kind !== 'PROHIBITION').concat(allProhibitions.slice(0, pLimit))
    : undroppable;
  const undroppable2 = carried;
  const rest = all.filter((f) => !UNDROPPABLE_KINDS.includes(f.kind));

  const byKind = new Map<string, CanonFactCore[]>();
  for (const f of rest) { const a = byKind.get(f.kind) || []; a.push(f); byKind.set(f.kind, a); }

  const taken = new Set<CanonFactCore>();
  const out: CanonFactCore[] = [];
  const take = (f: CanonFactCore) => { if (!taken.has(f) && out.length < total) { taken.add(f); out.push(f); } };

  // 1. Floors first, so structure is in before biography can consume the budget.
  for (const kind of Object.keys(floors) as CanonKind[]) {
    const n = floors[kind] || 0;
    for (const f of (byKind.get(kind) || []).slice(0, n)) take(f);
  }
  // 2. Biography fills what is left — in the model's own order.
  for (const f of rest) if (!floors[f.kind]) take(f);
  // 3. Any remaining space goes back to structure beyond its floor, not to more ages.
  for (const f of rest) take(f);

  const counts: Record<string, number> = {};
  for (const f of out) counts[f.kind] = (counts[f.kind] || 0) + 1;
  for (const f of undroppable2) counts[f.kind] = (counts[f.kind] || 0) + 1;

  // THE ACCOUNT. Every fact that did not make it is named by kind — a bare total would say that
  // something was lost without saying what, which is barely better than saying nothing.
  const droppedByKind: Record<string, number> = {};
  for (const f of rest) if (!taken.has(f)) droppedByKind[f.kind] = (droppedByKind[f.kind] || 0) + 1;
  const pDropped = allProhibitions.length - undroppable2.filter((f) => f.kind === 'PROHIBITION').length;
  if (pDropped > 0) droppedByKind.PROHIBITION = pDropped;
  const dropped = Object.values(droppedByKind).reduce((a, b) => a + b, 0);

  return {
    facts: out,
    undroppable: undroppable2,
    extracted: all.length,
    kept: out.length + undroppable2.length,
    counts,
    droppedByKind,
    dropped,
    capBound: dropped > 0,
  };
}

/** One-line summary for the log: "ROLE 4 · CAUSATION 3 · CHARACTER 18 · PROHIBITION 5". */
export function quotaSummary(counts: Record<string, number>): string {
  const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  return keys.map((k) => k + ' ' + counts[k]).join(' · ') || 'none';
}

/**
 * The sentence written to the log and persisted on the stage version when a limit binds.
 * Returns '' when nothing was dropped, so a healthy run adds no noise.
 */
export function quotaShortfall(r: QuotaResult): string {
  if (!r || !r.capBound) return '';
  const lost = quotaSummary(r.droppedByKind);
  const rules = r.droppedByKind.PROHIBITION || 0;
  return 'CANON TRUNCATED: extracted ' + r.extracted + ', kept ' + r.kept + ', dropped ' + r.dropped
    + ' (' + lost + ').'
    + (rules ? ' ' + rules + ' of these are PROHIBITIONS — a dropped rule permits what it forbids.' : '')
    + ' Raise the quota rather than accepting the loss.';
}
