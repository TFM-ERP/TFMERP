/**
 * WGA revision colour wheel + auto-advance (pure; no Nest/Prisma imports, so unit-testable).
 * ScriptService imports nextRevisionColor; the first revision is WHITE/round 0, and each new
 * revision steps one colour, incrementing the round on every full wrap back to WHITE.
 */
export const REV_WHEEL: { key: string; hex: string }[] = [
  { key: 'WHITE', hex: '#ffffff' }, { key: 'BLUE', hex: '#9ec5ff' }, { key: 'PINK', hex: '#ffc0cb' },
  { key: 'YELLOW', hex: '#fff27a' }, { key: 'GREEN', hex: '#b6e7a0' }, { key: 'GOLDENROD', hex: '#e7c84e' },
  { key: 'BUFF', hex: '#f3e4c0' }, { key: 'SALMON', hex: '#ff9e80' }, { key: 'CHERRY', hex: '#d6444a' }, { key: 'TAN', hex: '#d8c39a' },
];

export function nextRevisionColor(priorColor: string | null | undefined, priorRound = 0): { key: string; hex: string; round: number; index: number } {
  if (priorColor == null) return { key: REV_WHEEL[0].key, hex: REV_WHEEL[0].hex, round: 0, index: 0 };
  const base = REV_WHEEL.findIndex((c) => c.key === priorColor);
  const index = ((base >= 0 ? base : 0) + 1) % REV_WHEEL.length;
  const round = (priorRound || 0) + (index === 0 ? 1 : 0);
  return { key: REV_WHEEL[index].key, hex: REV_WHEEL[index].hex, round, index };
}

/**
 * ORDINAL PREFIXES FOR ROUNDS AFTER THE FIRST.
 *
 * WGA West does not stop at the end of the wheel. Once a production has burned through
 * White -> ... -> Tan, the next cycle is "Second Blue", then "Third Blue", and so on. nextRevisionColor
 * has always tracked this in `round`; nothing has ever RENDERED it, so a tenth revision and a first
 * revision both displayed as "BLUE" and were indistinguishable on a card — which is the same
 * class of failure as two builds sharing a name.
 */
const ORDINALS = ['', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'];

/**
 * The human name of a revision, the way a crew member reads it off a title page.
 *
 *   WHITE round 0  -> "WHITE DRAFT"      the first pass is a draft, not revisions
 *   BLUE  round 0  -> "BLUE"             (industry long form: "BLUE REVISIONS")
 *   BLUE  round 1  -> "SECOND BLUE"
 *   BLUE  round 11 -> "ROUND 12 BLUE"    past the named ordinals, stay unambiguous rather than clever
 *
 * MEASURED, NOT CHOSEN: colour + round is the industry identifier for a script version. The date
 * that completes the slug is stamped per revision (ScriptRevision.revisionDate) and rendered beside
 * this, never inside it — a label is not a date.
 */
export function revisionLabel(key: string | null | undefined, round = 0): string {
  const colour = String(key || REV_WHEEL[0].key).toUpperCase();
  const r = Number(round) > 0 ? Math.floor(Number(round)) : 0;
  const base = (r === 0 && colour === 'WHITE') ? 'WHITE DRAFT' : colour;
  if (r === 0) return base;
  const ordinal = ORDINALS[r];
  return (ordinal ? ordinal.toUpperCase() : 'ROUND ' + (r + 1)) + ' ' + colour;
}

/** The wheel as the UI needs it: key, display label and the canonical hex. Exposed over the wire so
 *  the frontend consumes this list instead of restating it — two copies of one convention is how the
 *  frontend came to hold a nine-colour pastel palette while the backend assigned from ten. */
export function revisionWheel(): { key: string; label: string; hex: string }[] {
  return REV_WHEEL.map((c) => ({ key: c.key, label: revisionLabel(c.key, 0), hex: c.hex }));
}
