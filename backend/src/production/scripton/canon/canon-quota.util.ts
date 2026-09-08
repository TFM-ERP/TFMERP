import type { CanonFactCore, CanonKind } from './canon.types';

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
 * PROHIBITIONS ARE NOT IN THE BUDGET AT ALL. They do not render as facts (see prohibitionDirective),
 * they are rules about the output, and dropping one silently permits the thing it forbids. They are
 * returned separately and capped only by a sanity limit.
 */

export const DEFAULT_FLOORS: Partial<Record<CanonKind, number>> = {
  ROLE: 6,        // who the antagonist is, who the betrayer is — one line each, and they decide the film
  CRIME: 5,       // the crime itself, and what is only a mechanism serving it
  CAUSATION: 6,   // authorised / permitted / expanded / executed
  OUTCOME: 5,     // who lives, who dies, who is delivered to whom
  ORDERING: 5,    // what must occur before what
};

/**
 * A SANITY LIMIT, NOT A BUDGET — and it was measured, not guessed.
 *
 * The first real extraction against the 66,128-character bible returned 23 prohibitions. At the
 * original limit of 12, eleven real rules would have been dropped silently, and a dropped
 * prohibition does not merely go unstated: it PERMITS the thing it forbids. Among the eleven were
 * "she is never kidnapped to motivate Jason" and "no flashback without new information" — exactly
 * the shortcuts the bible exists to forbid.
 *
 * 40 is high enough that a normal bible never reaches it and low enough that a runaway response
 * cannot fill the prompt with them.
 */
export const PROHIBITION_LIMIT = 40;

export interface QuotaResult {
  /** Facts to render as CANON, structure first so it survives any later truncation. */
  facts: CanonFactCore[];
  /** Rules about the output. Never mixed into `facts`. */
  prohibitions: CanonFactCore[];
  /** What was actually allocated, for the log line — this is how a regression is noticed. */
  counts: Record<string, number>;
  dropped: number;
}

/**
 * Allocate `total` fact slots across kinds, honouring floors, and split prohibitions out.
 * Pure. Input order is preserved within each kind, so the model's own ranking still counts.
 */
export function selectCanonByQuota(
  facts: CanonFactCore[],
  opts?: { total?: number; floors?: Partial<Record<CanonKind, number>>; prohibitionLimit?: number },
): QuotaResult {
  const total = opts?.total ?? 60;
  const floors = opts?.floors ?? DEFAULT_FLOORS;
  const pLimit = opts?.prohibitionLimit ?? PROHIBITION_LIMIT;
  const all = Array.isArray(facts) ? facts.filter(Boolean) : [];

  const prohibitions = all.filter((f) => f.kind === 'PROHIBITION').slice(0, pLimit);
  const rest = all.filter((f) => f.kind !== 'PROHIBITION');

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
  if (prohibitions.length) counts.PROHIBITION = prohibitions.length;

  return { facts: out, prohibitions, counts, dropped: Math.max(0, rest.length - out.length) };
}

/** One-line summary for the log: "ROLE 4 · CAUSATION 3 · CHARACTER 18 · PROHIBITION 5". */
export function quotaSummary(counts: Record<string, number>): string {
  const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  return keys.map((k) => k + ' ' + counts[k]).join(' · ') || 'none';
}
