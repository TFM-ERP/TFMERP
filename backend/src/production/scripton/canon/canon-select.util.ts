import type { CanonFactCore } from './canon.types';
import { UNDROPPABLE_KINDS } from './canon-quota.util';

/**
 * WHAT A SINGLE STAGE PROMPT CARRIES — a different question from what the record holds.
 *
 * These were one thing, and the cost said so: at a cap of 120 the canon block reached 26,651 bytes,
 * riding all eight ladder stages and then every scene call. The RECORD should hold everything the
 * source states — that is the point of extracting it — but a stage prompt has a budget, and the two
 * must not be the same number or one will quietly govern the other.
 *
 * ROUTED BY SECTION, NOT RANKED BY CONSEQUENCE. There is no validated way to say which prohibition
 * matters most, and a constant asserting one would be exactly the kind of unmeasured number this
 * pipeline has been full of. What IS known is where each fact came from (sourceSection), so the
 * selector takes them round-robin across sections: every part of the document is represented before
 * any part is represented twice. A document's own structure is the only ranking available that
 * nobody had to invent.
 *
 * AND IT SAYS WHAT IT SENT. "sent 84 of 212 (PROHIBITION 40 of 92, ORDERING all)" — because a block
 * that silently carries a third of the canon is the same defect as a quota that silently truncates.
 *
 * Pure.
 */

export interface StageSelection {
  facts: CanonFactCore[];
  /** Ready to print: "sent 84 of 212 (PROHIBITION 40 of 92 · ORDERING 20 of 20 · CAUSATION 12 of 21)". */
  note: string;
  sent: number;
  total: number;
  /** Per kind: how many were sent of how many exist. */
  byKind: Record<string, { sent: number; total: number }>;
  /** True when everything in the record reached this prompt. */
  complete: boolean;
}

const chars = (f: CanonFactCore): number => String(f.statement || '').length + String(f.subject || '').length + 6;

/**
 * Choose the facts one stage prompt carries, inside a character budget.
 *
 * Undroppable kinds go first and whole. They are the cheapest lines in the block and the only ones
 * whose absence changes what the draft is ALLOWED to be rather than how well informed it is — so a
 * budget that cannot fit them is a budget that is too small, and it says so rather than trimming
 * them. Everything else is taken round-robin by section.
 */
export function selectForStage(facts: CanonFactCore[], opts?: { budgetChars?: number }): StageSelection {
  // THE BUDGET GOVERNS THE DROPPABLE FACTS ONLY, and that is not a detail. It first governed the
  // whole block, and the A/B caught what that does: the undroppable set alone is 12,746 bytes on
  // this bible against a 12,000 budget, so it consumed everything and ROLE, CRIME, CAUSATION and
  // OUTCOME each got ZERO — "who the antagonist is" left the prompt entirely. A mandatory set inside
  // a budget means the budget silently decides how much of the rest survives, which here was none.
  // Rules are carried because they must be; this number decides what rides ON TOP of them.
  const budget = opts?.budgetChars ?? 9000;
  const all = Array.isArray(facts) ? facts.filter(Boolean) : [];

  const byKindTotal: Record<string, number> = {};
  for (const f of all) byKindTotal[f.kind] = (byKindTotal[f.kind] || 0) + 1;

  const must = all.filter((f) => UNDROPPABLE_KINDS.includes(f.kind));
  const rest = all.filter((f) => !UNDROPPABLE_KINDS.includes(f.kind));

  const chosen: CanonFactCore[] = [...must];
  let used = 0;   // the undroppable set is not charged against the budget — see above

  // Round-robin across sections: every section is represented before any is represented twice.
  const bySection = new Map<string, CanonFactCore[]>();
  for (const f of rest) {
    const k = (f as any).sourceSection || '(unplaced)';
    const a = bySection.get(k) || []; a.push(f); bySection.set(k, a);
  }
  const queues = Array.from(bySection.values());
  let drained = false;
  while (!drained && used < budget) {
    drained = true;
    for (const q of queues) {
      const f = q.shift();
      if (!f) continue;
      drained = false;
      const c = chars(f);
      if (used + c > budget) continue;
      chosen.push(f);
      used += c;
    }
  }

  const byKind: Record<string, { sent: number; total: number }> = {};
  for (const k of Object.keys(byKindTotal)) byKind[k] = { sent: 0, total: byKindTotal[k] };
  for (const f of chosen) byKind[f.kind].sent++;

  const parts = Object.keys(byKind).sort((a, b) => byKind[b].total - byKind[a].total).map((k) => {
    const { sent, total } = byKind[k];
    return k + ' ' + (sent === total ? ('all ' + total) : (sent + ' of ' + total));
  });
  const complete = chosen.length === all.length;
  const note = 'CANON SENT: ' + chosen.length + ' of ' + all.length + ' facts'
    + (complete ? ' (complete)' : ' — ' + parts.join(' · '));

  return { facts: chosen, note, sent: chosen.length, total: all.length, byKind, complete };
}
