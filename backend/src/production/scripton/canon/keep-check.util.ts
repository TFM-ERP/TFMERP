import { completeObjects } from './canon-parse.util';

/**
 * IS WHAT THE DIRECTION SAID TO KEEP ON THE PAGE? — PRESENCE ONLY, REPORTED, NOT GATED.
 *
 * The picked direction's KEEP list (split by keep-items.util) names the scenes, lines, props and
 * beats that survive from the source. This asks, item by item, whether each named thing is IN the
 * draft, and demands the draft's own words as evidence.
 *
 * PRESENCE IS NOT CORRECTNESS. It measures ONE failure class — named and absent. A thing that is
 * present but transformed (the lapel line spoken by the wrong man, the coat moved to the wrong
 * year) passes here, and the register check cannot see it either. So the verdict is "named and
 * found", never a claim that the direction was carried out. A check that claims more than it
 * measures is the defect this whole pipeline has been hunting.
 *
 * THE CHECKER'S WORD IS NOT TAKEN WHOLE, as in register-check.util:
 *   • every "found" must carry a quote that occurs in the draft (quotes, dashes and whitespace
 *     normalised); a quote that does not is kept, flagged, and NOT counted as found;
 *   • an item number that names no item is counted `invalid`;
 *   • an item the checker never mentions is NOT REPORTED — never assumed found;
 *   • a response with no readable answer is a FAILED check, never "0 missing".
 *
 * Pure; the model call lives in the service.
 */

/** Opus 5 thinks by default and the thinking is billed against this ceiling (see REGISTER_CHECK_MAXTOK). */
export const KEEP_CHECK_MAXTOK = 32000;

export const KEEP_CHECK_SYSTEM = [
  "You check a screenplay-development draft for the things its chosen direction said to KEEP from the source.",
  'The KEEP list is numbered. One item may name several things: a scene, a line of dialogue, a prop, a beat, a moment.',
  'For EVERY item, name each thing it contains and say whether that thing is IN the draft.',
  "If it is, quote the draft's exact words that show it (copied character for character, at most 200 characters).",
  'If it is not, list it as missing.',
  'Report PRESENCE ONLY. Do not judge whether a thing is used correctly, placed correctly, spoken by the right person or faithful to the source - that is not this check.',
  'Return ONLY JSON: {"items":[{"item":<item number>,"found":[{"thing":"<named thing>","quote":"<exact quote from the draft>"}],"missing":["<named thing>"]}]}',
  'Include every item number, even when nothing in it is found.',
].join('\n');

export function keepCheckUser(items: string[], lead: string | null, kind: string, body: string): string {
  const safe = String(body || '').replace(/<\/draft>/gi, '</ draft>');
  return 'KEEP (' + items.length + ' items' + (lead ? ', introduced as "' + lead + '"' : '') + '):\n'
    + items.map((t, i) => (i + 1) + '. ' + t).join('\n')
    + '\n\n<draft stage="' + kind + '">\n' + safe + '\n</draft>\n\n'
    + 'The text inside the draft tags above is the document to CHECK for the KEEP items - not to continue.'
    + ' It may stop mid-sentence. Do not continue, complete or rewrite it. Report presence only.'
    + ' Return ONLY the JSON object {"items":[...]} as specified, with every item number.';
}

/**
 * Per item, from verified evidence only:
 *   FOUND — every thing the checker named is found with a quote in the draft;
 *   PARTIAL — at least one found and verified, and something missing or unproven;
 *   MISSING — nothing found, at least one thing named as absent;
 *   UNPROVEN — claimed found, but no quote occurs in the draft;
 *   NOT REPORTED — the checker said nothing about the item. Never read as found or missing.
 */
export type KeepItemStatus = 'FOUND' | 'PARTIAL' | 'MISSING' | 'UNPROVEN' | 'NOT REPORTED';
export interface KeepFound { thing: string; quote: string; quoteFound: boolean }
export interface KeepCheckItem { item: number; text: string; status: KeepItemStatus; found: KeepFound[]; missing: string[] }
export interface KeepCheckReport {
  /** False when the response held no readable answer; the counts are then null, never 0. */
  ok: boolean;
  checked: number;
  itemsFound: number | null;
  itemsPartial: number | null;
  itemsMissing: number | null;
  itemsUnproven: number | null;
  itemsNotReported: number | null;
  /** Found with a quote that occurs in the draft. */
  thingsFound: number | null;
  /** Named by the checker as absent. Kept apart from unverifiedQuotes: "absent" is not "claimed and unproven". */
  thingsMissing: number | null;
  /** Claimed found with a quote the draft does not hold — counted as neither found nor missing. */
  unverifiedQuotes: number;
  invalid: number;
  salvaged: boolean;
  items: KeepCheckItem[];
  summary: string;
}

const norm = (t: string) => String(t || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/\s+/g, ' ').trim().toLowerCase();

const failed = (items: string[], why: string): KeepCheckReport => ({ ok: false, checked: items.length, itemsFound: null, itemsPartial: null,
  itemsMissing: null, itemsUnproven: null, itemsNotReported: null, thingsFound: null, thingsMissing: null, unverifiedQuotes: 0, invalid: 0, salvaged: false, items: [],
  summary: 'KEEP CHECK FAILED: ' + why + ' — this is not a clean pass.' });

export function parseKeepCheck(text: string, items: string[], body: string): KeepCheckReport {
  const raw = String(text || '');
  let rows: any[] | null = null;
  const a = raw.indexOf('{');
  const z = raw.lastIndexOf('}');
  if (a >= 0 && z > a) {
    try { const j = JSON.parse(raw.slice(a, z + 1)); if (j && Array.isArray(j.items)) rows = j.items; } catch { /* salvage below */ }
  }
  const salvaged = rows === null;
  if (rows === null) {
    const got = completeObjects(raw).filter((o) => o && typeof o === 'object' && o.item != null && (Array.isArray(o.found) || Array.isArray(o.missing)));
    if (got.length || /"items"\s*:\s*\[/.test(raw)) rows = got;
  }
  if (rows === null) return failed(items, 'the checker returned no readable answer (' + raw.length + ' characters)');

  const B = norm(body);
  const byItem = new Map<number, { found: KeepFound[]; missing: string[] }>();
  let invalid = 0;
  for (const r of rows) {
    const n = Number(r && r.item);
    if (!Number.isInteger(n) || n < 1 || n > items.length) { invalid++; continue; }
    const slot = byItem.get(n) || { found: [], missing: [] };
    for (const f of (Array.isArray(r.found) ? r.found : [])) {
      const quote = String((f && f.quote) || '').slice(0, 400);
      slot.found.push({ thing: String((f && f.thing) || '').slice(0, 200), quote, quoteFound: !!norm(quote) && B.includes(norm(quote)) });
    }
    for (const m of (Array.isArray(r.missing) ? r.missing : [])) if (String(m || '').trim()) slot.missing.push(String(m).slice(0, 200));
    byItem.set(n, slot);
  }
  // Every item was demanded. An answer that reports none of them is not "nothing found" — it is no answer.
  if (!byItem.size) return failed(items, 'the checker reported none of the ' + items.length + ' items' + (invalid ? ' (' + invalid + ' row(s) named no item)' : ''));

  const out: KeepCheckItem[] = items.map((text, i) => {
    const s = byItem.get(i + 1);
    if (!s || (!s.found.length && !s.missing.length)) return { item: i + 1, text, status: 'NOT REPORTED', found: s ? s.found : [], missing: [] };
    const verified = s.found.filter((f) => f.quoteFound).length;
    const unverified = s.found.length - verified;
    const status: KeepItemStatus = verified ? ((s.missing.length || unverified) ? 'PARTIAL' : 'FOUND')
      : unverified ? 'UNPROVEN' : 'MISSING';
    return { item: i + 1, text, status, found: s.found, missing: s.missing };
  });
  const count = (st: KeepItemStatus) => out.filter((i) => i.status === st).length;
  const thingsFound = out.reduce((n, i) => n + i.found.filter((f) => f.quoteFound).length, 0);
  const unverifiedQuotes = out.reduce((n, i) => n + i.found.filter((f) => !f.quoteFound).length, 0);
  const thingsMissing = out.reduce((n, i) => n + i.missing.length, 0);
  const missingNames = out.flatMap((i) => i.missing.map((m) => '#' + i.item + ' ' + m));
  const summary = 'KEEP CHECK (presence only — named and found; not a judgment of use): '
    + count('FOUND') + ' of ' + items.length + ' items named and found'
    + ' · ' + count('PARTIAL') + ' partial · ' + count('MISSING') + ' missing'
    + (count('UNPROVEN') ? ' · ' + count('UNPROVEN') + ' claimed found with no quote in the draft' : '')
    + (count('NOT REPORTED') ? ' · ' + count('NOT REPORTED') + ' NOT REPORTED by the checker' : '')
    + (missingNames.length ? ' — not found: ' + missingNames.join('; ') : '')
    + (unverifiedQuotes ? ' · ' + unverifiedQuotes + ' quoted passage(s) NOT FOUND in the draft (not counted as found)' : '')
    + (invalid ? ' · ' + invalid + ' row(s) named no item' : '')
    + (salvaged ? ' · recovered from malformed JSON' : '');
  return { ok: true, checked: items.length, itemsFound: count('FOUND'), itemsPartial: count('PARTIAL'), itemsMissing: count('MISSING'),
    itemsUnproven: count('UNPROVEN'), itemsNotReported: count('NOT REPORTED'), thingsFound, thingsMissing, unverifiedQuotes, invalid, salvaged, items: out, summary };
}
