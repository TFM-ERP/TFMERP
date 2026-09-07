/**
 * WHAT MAKES ONE BUILD TELLABLE FROM ANOTHER.
 *
 * PROVENANCE — read this before changing the shape. The script layer has a MEASURED industry
 * standard: a version is COLOUR + DATE ("BLUE REVISIONS 12/18/25"), and revision-wheel.util.ts
 * implements it. The BUILD layer has no such convention — a development container is our own
 * invention, so everything below is OUR CHOICE and is marked as such rather than presented as
 * practice. No opaque id goes on a card; nobody in the industry reads a cuid.
 *
 * WHY IT EXISTS AT ALL. Three builds are named "Jason Quick" and carry 4,066 / 44,733 / 66,128
 * characters of DIFFERENT source with different casts. On 7 Sep both a person and an automated
 * audit worked from the wrong one, at different moments, because the cards were identical apart
 * from "6d ago" and "7d ago". Six more builds are all named "MINUTEMEN" with byte-identical
 * sources — for those, nothing content-derived can help, which is precisely why a short KEY is
 * justified here and would be gratuitous on the script layer.
 *
 * Pure functions, no Prisma, so the identity a card depends on is testable without a database.
 */

/** Stable, non-cryptographic 32-bit hash (FNV-1a). For telling things apart, never for secrecy. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

const hex6 = (n: number): string => n.toString(16).toUpperCase().padStart(8, '0').slice(0, 6);

/**
 * OUR CHOICE: a short, sayable key for a build — initials of the name plus six hex of its id.
 *
 *     "Jason Quick" + cmti694l6…  ->  "JQ-7F3A9C"
 *
 * Derived from the ID, not the content, because the six MINUTEMEN builds share name, size and
 * content hash; only identity separates them. Short enough to read aloud in a note, long enough
 * that two builds in one project will not collide.
 */
export function buildShortKey(name?: string | null, id?: string | null): string {
  const initials = String(name || '')
    .split(/[^A-Za-z0-9]+/).filter(Boolean).slice(0, 3)
    .map((w) => w[0].toUpperCase()).join('') || 'B';
  return initials + '-' + hex6(fnv1a(String(id || name || '')));
}

export interface SourceFingerprint {
  chars: number;
  hash: string | null;
  /** Ready to render. Null ONLY when there is no source — the card must say so, not fall silent. */
  label: string;
  empty: boolean;
}

/** Human size: 66,128 -> "66k", 4,066 -> "4.1k", 900 -> "900". */
function shortSize(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return (k < 10 ? k.toFixed(1) : String(Math.round(k))) + 'k';
}

/**
 * OUR CHOICE: size + a short content hash of the build's source.
 *
 * SIZE ALONE IS NOT IDENTITY — the six MINUTEMEN builds are all 44,363 characters. The hash is what
 * makes "different foundation" visible at a glance; the size is what makes it legible. Both, or the
 * line is decoration.
 *
 * AN EMPTY SOURCE IS THE LOUDEST STATE THIS FUNCTION HAS. A build with no source is the one that
 * produced a film with an invented cast, and the intake wizard already warns about it — the card
 * must not be the single place that stays quiet. `empty` is returned so the UI can colour it as a
 * warning rather than print an empty cell.
 */
export function sourceFingerprint(sourceText?: string | null): SourceFingerprint {
  const t = typeof sourceText === 'string' ? sourceText : '';
  if (!t.trim()) return { chars: 0, hash: null, label: 'no source', empty: true };
  return { chars: t.length, hash: hex6(fnv1a(t)).toLowerCase(), label: 'source ' + shortSize(t.length) + ' ' + hex6(fnv1a(t)).toLowerCase(), empty: false };
}

/**
 * OUR CHOICE: "V2 of 3", or an em dash when the build has never been versioned.
 * A dash is deliberate — "V1 of 1" on an unversioned build would invent a version that does not
 * exist, and this whole exercise is about cards that do not overstate what they know.
 */
export function versionLabel(activeN?: number | null, total?: number | null): string {
  const n = Number(activeN) > 0 ? Math.floor(Number(activeN)) : 0;
  const t = Number(total) > 0 ? Math.floor(Number(total)) : 0;
  if (!t) return '—';
  return n ? ('V' + n + ' of ' + t) : (t + (t === 1 ? ' version' : ' versions'));
}
