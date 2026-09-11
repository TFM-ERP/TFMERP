/**
 * A direction's KEEP field, split into the items a compliance check reports on.
 *
 * COARSE AND TRUTHFUL, BY DESIGN. The only separator is a semicolon (outside double or curly
 * quotes). Nothing finer is attempted:
 *   - a sentence split would cut inside quoted dialogue — "'Smile. This is the part you're good
 *     at.'" contains ". " — and mis-segment the very lines a check exists to find;
 *   - single quotes cannot be tracked at all, because the same character is every apostrophe
 *     ("you're", "Adrian's");
 *   - a prose keep with no semicolons therefore stays ONE item, whole.
 * An item reported whole is honest; the compliance check applies its quote requirement to each
 * named thing INSIDE an item, which is where the finer grain belongs.
 *
 * A LEAD IS REPORTED, NEVER DISCARDED. "The full spine as written: a; b; c" is a list with a label:
 * the label is returned as `lead` (it can carry an instruction — "as written"), and lead + ': ' +
 * items.join('; ') reproduces the original. Only a multi-item list has a lead, and only when the
 * label is short and carries no comma or quote — "The crime exactly as written: …" on a one-item
 * prose keep labels a sentence, not a list, and stays inside the item.
 *
 * Every item is a verbatim substring of the keep (ends trimmed, nothing rewritten). Pure; never
 * throws.
 */

export interface KeepItems { lead: string | null; items: string[] }

const LEAD_MAX = 60;

export function splitKeep(keep: any): KeepItems {
  if (typeof keep !== 'string' || !keep.trim()) return { lead: null, items: [] };
  const text = keep.trim();
  const segs: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (ch === '“') quoted = true;
    else if (ch === '”') quoted = false;
    if (ch === ';' && !quoted) { segs.push(cur); cur = ''; continue; }
    cur += ch;
  }
  segs.push(cur);
  const items = segs.map((s) => s.trim()).filter(Boolean);
  let lead: string | null = null;
  if (items.length >= 2) {
    const c = items[0].indexOf(': ');
    const pre = c > 0 ? items[0].slice(0, c) : '';
    if (pre && pre.length <= LEAD_MAX && !/[,"“”']/.test(pre)) {
      lead = pre;
      items[0] = items[0].slice(c + 2).trim();
    }
  }
  return { lead, items: items.filter(Boolean) };
}
