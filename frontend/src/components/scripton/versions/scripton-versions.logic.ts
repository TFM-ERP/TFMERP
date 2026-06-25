/**
 * Pure logic for the Versions screen — the semantic change tags and the +/~
 * annotation lines derived from a render result. No React, no kernel calls; tested
 * with node:test. The line diff itself is reused from scripton-compare.logic.
 */

export type ChangeTag = { label: string; kind: 'scenes' | 'canon' | 'tone' | 'budget' };

/**
 * The semantic change tags for a render: scene count, canon-change count, and any
 * budget / tone signal lifted from the applied changes' tag strings. Order: scenes,
 * canon, tone, budget (matches the frame).
 */
export function deriveTags(applied: any[] | null | undefined, canonWritten: any[] | null | undefined): ChangeTag[] {
  const tags: ChangeTag[] = [];
  const n = Array.isArray(applied) ? applied.length : 0;
  if (n) tags.push({ label: `+${n} scene${n > 1 ? 's' : ''}`, kind: 'scenes' });
  const cn = Array.isArray(canonWritten) ? canonWritten.length : 0;
  if (cn) tags.push({ label: `${cn} canon change${cn > 1 ? 's' : ''}`, kind: 'canon' });
  const tagStr = (Array.isArray(applied) ? applied : []).map((c) => String(c?.tag || '')).join('  ');
  if (/dread|tension|fear|emotion|tone/i.test(tagStr)) tags.push({ label: 'tone: +dread', kind: 'tone' });
  const budget = tagStr.match(/[−-]\s?\$\s?\d+(?:[.,]\d+)?\s?[kKmM]?/);
  if (budget) tags.push({ label: `budget ${budget[0].replace(/\s+/g, '')}`, kind: 'budget' });
  return tags;
}

/**
 * The semantic annotation lines below the diff: `+` for an inserted bridge,
 * `~` for each canon fact this render wrote (the "meaning changed" notes). `bridge`
 * is the note from detectBridge (or null).
 */
export function diffAnnotations(canonWritten: any[] | null | undefined, bridge: string | null): string[] {
  const out: string[] = [];
  if (bridge) out.push(`+ ${bridge}`);
  for (const f of Array.isArray(canonWritten) ? canonWritten : []) {
    if (!f || !f.subject) continue;
    const at = f.validFrom != null ? ` (canon S${f.validFrom})` : '';
    out.push(`~ ${cap(f.subject)} → ${f.object}${at}`);
  }
  return out;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);

/** The "V{a} → V{b}" label for a selected timeline node, from its position — never
 *  from possibly-null render-result fields. Pending (open) node → "{prev} → pending". */
export function diffPairLabel(node: { label?: string; n?: number } | null, prevLabel: string | null, pending = false): string {
  const to = pending ? 'pending' : node?.label || (node?.n != null ? 'V' + node.n : '—');
  const from = prevLabel || '—';
  return `${from} → ${to}`;
}
