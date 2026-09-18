import type { EraHit } from './era.util';
import { daysToYears, roundHalfAwayFromZero } from './era-days.util';
import type { StoryYearProvenance } from './story-year.util';

/**
 * THE STRATA A SCRIPT IS WRITTEN IN, NAMED ONCE AND GIVEN TO THE MODEL.
 *
 * WHY THIS EXISTS RATHER THAN ANOTHER CHECK. On V2.6 a flashback was slugged "(EIGHT YEARS EARLIER)"
 * where the material says seven. That happened with all 81 register lines in the prompt, including
 * the one stating the arithmetic in words — so more checking would not have caught it. The model was
 * asked to subtract, and it subtracted wrong. This removes the subtraction instead: the strata are
 * computed here, labelled, and the model is told to use the label rather than to recompute an offset
 * at each cut. It is also how multi-stratum scripts are actually made — one fixed label per stratum,
 * established once.
 *
 * TWO FORMS, KEYED ON PROVENANCE, AND THE MODEL IS NEVER GIVEN A YEAR IT WAS NOT GIVEN.
 *
 *   COMPUTED      PRESENT 2019 · STRATUM A 2012 (seven years earlier)
 *   anything else PRESENT the present · STRATUM A seven years earlier
 *
 * The table's job is FIXITY, not truth: it makes a relative offset resolve to the same stratum every
 * time, which is all that is needed to stop the recomputation. The absolute value is not required,
 * so a DEFAULTED_PRESENT or ERA_MIDPOINT anchor yields the offset form and `storyYearForPrompt`'s
 * COMPUTED-only rule stays intact — an assumed year still never reaches the page.
 *
 * Pure; never throws. Returns '' when the material names no stratum, so a single-period story gets
 * no heading rather than an empty one.
 */

export interface Stratum {
  /** A, B, C… in order of distance from the present. */
  label: string;
  /** Whole years before the present. Always positive; the present itself is not a stratum. */
  yearsEarlier: number;
  /** The material's own words for it, for the reader rather than the arithmetic. */
  phrase: string;
  /** Present only in the COMPUTED form. */
  year?: number;
}

const LETTERS = 'ABCDEFGH';

/**
 * Distinct past strata implied by the material's temporal phrases.
 *
 * ONE STRATUM PER DISTANCE, not one per mention: a bible says "seven years earlier" in four places
 * and means one flashback layer. Collapsing on the rounded year count is what makes the table short
 * enough to be a label set rather than a second copy of the text.
 */
export function strataFrom(hits: EraHit[], storyYear: number | null, provenance: StoryYearProvenance): Stratum[] {
  const byYears = new Map<number, string>();
  for (const h of Array.isArray(hits) ? hits : []) {
    if (!h || !h.offset || typeof h.offset.from !== 'number') continue;
    const years = roundHalfAwayFromZero(daysToYears(h.offset.from));
    // PAST ONLY. A positive offset is a flash-forward, which the signed axis expresses and which a
    // stratum table would misname as a layer of the past.
    if (!(years < 0)) continue;
    const back = Math.abs(years);
    if (!byYears.has(back)) byYears.set(back, String(h.text || '').trim());
  }
  const out = [...byYears.entries()].sort((a, b) => a[0] - b[0]);
  return out.slice(0, LETTERS.length).map(([yearsEarlier, phrase], i) => {
    const s: Stratum = { label: LETTERS[i], yearsEarlier, phrase };
    if (provenance === 'COMPUTED' && typeof storyYear === 'number') s.year = storyYear - yearsEarlier;
    return s;
  });
}

/** How many strata the material implied beyond the labels available. 0 when none were lost. */
export function strataDropped(hits: EraHit[]): number {
  const distinct = new Set<number>();
  for (const h of Array.isArray(hits) ? hits : []) {
    if (!h || !h.offset || typeof h.offset.from !== 'number') continue;
    const years = roundHalfAwayFromZero(daysToYears(h.offset.from));
    if (years < 0) distinct.add(Math.abs(years));
  }
  return Math.max(0, distinct.size - LETTERS.length);
}

/**
 * STRATA THAT MAY BE ONE STRATUM, SAID ON THE TABLE'S OWN FACE.
 *
 * The partition here is a rounded year count and nothing else, so "seven years earlier" and "eight
 * years ago" become two strata BY CONSTRUCTION — and the era check disclaims exactly this on every
 * run: whether they name the same event "needs the events named", which this file cannot do.
 *
 * That matters more for a table than for a check. Fixity applied to a wrong partition is worse than
 * no table: the model splits one night into two strata CONSISTENTLY, the draft obeys the table, and
 * the register check finds no contradiction in it. The error is held in place and reads as success.
 *
 * NOT COLLAPSED, DELIBERATELY. Merging two adjacent distances destroys a real distinction exactly as
 * blindly as splitting invents one — a story can hold a seventh-year and an eighth-year layer. The
 * honest move is to keep both and say the ambiguity out loud, which is the same rule the keep check
 * follows: report, never silently resolve.
 *
 * Adjacent means within one year, and only for strata whose phrases name no event — a phrase that
 * anchors itself ("the year Callum died") is not ambiguous in the way this warns about.
 */
export function ambiguityNotes(strata: Stratum[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < strata.length; i++) {
    const a = strata[i - 1];
    const b = strata[i];
    if (Math.abs(b.yearsEarlier - a.yearsEarlier) > 1) continue;
    out.push(a.label + ' and ' + b.label + ' may be one stratum — events not named');
  }
  return out;
}

/**
 * The block as it rides the prompt. '' when there is no second stratum to name.
 *
 * `dropped` is the count of strata the material implied beyond the eight labels. A table that
 * silently shortened itself would be the same defect as a check that reports nothing, so it is
 * stated on the face rather than left for someone to notice a missing layer.
 */
export function stratumTable(strata: Stratum[], storyYear: number | null, provenance: StoryYearProvenance, dropped = 0): string {
  if (!Array.isArray(strata) || !strata.length) return '';
  const computed = provenance === 'COMPUTED' && typeof storyYear === 'number';
  const rows = [computed ? 'PRESENT    ' + storyYear : 'PRESENT    the present'];
  for (const s of strata) {
    const left = ('STRATUM ' + s.label).padEnd(11);
    const when = computed && typeof s.year === 'number' ? String(s.year) : s.yearsEarlier + ' years earlier';
    const gloss = computed ? '   ' + s.yearsEarlier + ' years earlier' : '';
    rows.push(left + when + gloss + (s.phrase ? '   — "' + s.phrase + '"' : ''));
  }
  const notes = ambiguityNotes(strata);
  return 'TIME STRATA (fixed for this script — use the LABEL, never your own arithmetic):\n'
    + rows.join('\n')
    + (notes.length ? '\n' + notes.map((n) => 'NOTE       ' + n).join('\n') : '')
    + (dropped > 0 ? '\nNOTE       ' + dropped + ' further stratum/strata were found in the material and are NOT listed here.' : '')
    + '\nSlug a scene set in the past with its stratum label. Do NOT compute the offset yourself and do'
    + ' NOT invent a stratum that is not on this list.';
}
