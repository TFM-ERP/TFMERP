import { tokenize, matchPhrases, matchYears } from './era-tokens.util';
import { daysToYears, roundHalfAwayFromZero } from './era-days.util';
import { anchorYearForEra, anchorYearForBand, findEraRow } from './era-map.util';

/**
 * WHAT YEAR IS THE STORY'S PRESENT — and, inseparably, HOW WE KNOW.
 *
 * Every era offset in the timeline axis is measured from one number, so that number decides every
 * marker, every implied age and every dated finding. A year that cannot say where it came from is a
 * year nobody can audit, which is why the answer is a provenance as much as a value:
 *
 *   COMPUTED           the material dated one event both absolutely and relatively, and the
 *                      arithmetic fixes the present:  storyYear = absoluteYear - eraOffsetYears
 *   ERA_MIDPOINT       derived from the chosen settingEra through the sourced era map
 *   DEFAULTED_PRESENT  the current calendar year, because the story is contemporary or says nothing
 *   ASK                nothing here may answer: the user is asked, and told why
 *
 * THE LADDER IS SPEC §7.2, IN ORDER, AND IT REFUSES RATHER THAN APPROXIMATES. `anchorYearForEra`
 * distinguishes a row it cannot anchor (`refused` — 29 of the 91 country rows bundle several
 * polities, and their midpoints land in years when the named thing did not exist) from a row it does
 * not have (`missing`). A refusal must NEVER fall through to the next rung: falling through
 * manufactures exactly the approximation those rows exist to refuse.
 *
 * A YEAR REACHES A WRITING PROMPT ONLY WHEN THE MATERIAL SAID IT — see storyYearForPrompt. A band
 * midpoint and a defaulted "now" are inputs to checks, never facts to write from.
 *
 * NO SECOND PARSER. Every number here comes from the tokenizer and grammar built in Plans 01 and 02
 * (`tokenize`, `matchPhrases`, `matchYears`) and the sourced map (`anchorYearForEra`,
 * `anchorYearForBand`). Pure; never throws.
 */

export type StoryYearProvenance = 'COMPUTED' | 'ERA_MIDPOINT' | 'DEFAULTED_PRESENT' | 'ASK';

export interface StoryYearResult {
  /** The story's present. null only when provenance is 'ASK'. */
  year: number | null;
  provenance: StoryYearProvenance;
  /** What the user is told. '' when nothing needs saying. */
  note: string;
  /**
   * What produced the answer — the pairs, the row, or the band. Empty when there was nothing to
   * cite: an unset era defaulting to this year, or an ASK with no candidate to name.
   */
  evidence: string[];
  /** ERA_ANCHOR_CONFLICT: two datings of the history implying different presents. */
  conflict?: { years: number[]; pairs: string[] };
}

export interface StoryYearInput {
  material: string;
  settingEra?: string | null;
  settingCountry?: string | null;
  /** Injected, never read from the clock in here — a pure function cannot depend on today. */
  currentYear: number;
}

/**
 * The nine generic bands, by the LABEL the form stores, mapped to the id `era-map.util` knows.
 *
 * settingEra is free prose (`FIELD_SPECS: { kind: 'text', max: 120 }`), so this is an exact match on
 * a trimmed string and nothing looser. THE GUARD IS IN THE SPEC FILE: it reads the frontend taxonomy
 * and fails if a label there is renamed or added, because a silent miss here would quietly demote a
 * Medieval story to "now".
 */
export const BAND_LABELS: Record<string, string> = {
  'Ancient (pre-500 AD)': 'ancient',
  'Medieval (500–1500)': 'medieval',
  'Early modern (1500–1800)': 'early-modern',
  '19th century': '19c',
  'Early 20th century': 'early-20c',
  'Mid-century (1940s–70s)': 'mid-20c',
  Contemporary: 'contemporary',
  'Near future': 'near-future',
  'Far future': 'far-future',
};

/**
 * The only prose this file reads as "now". DELETE THIS LIST and every prose case becomes ASK —
 * which is what the spec's own rung 3 says ("Contemporary or unset"), and the tests name the rows
 * that flip.
 */
export const CONTEMPORARY_PHRASES = ['contemporary', 'present day', 'modern day', 'today'];

/**
 * Prose that dates itself is never answered with "now", whatever it begins with: a 4-digit year, a
 * decade, a century, or an era token. "a contemporary retelling of the 1920s" is a period piece.
 *
 * `bc` and `bce` stand alone; `ad` and `ce` are ordinary English words ("an ad agency", "ce n'est"),
 * so they disqualify only when a number is against them — "500 AD", "AD 500". Without that, a
 * present-day advertising story would be refused for containing the word "ad".
 */
const DATED_PROSE = /\b\d{4}\b|\b\d{2,4}s\b|\bcentur(?:y|ies)\b|\b(?:bc|bce)\b|\b\d{1,4}\s?(?:ad|ce)\b|\b(?:ad|ce)\s?\d{1,4}\b/;

const norm = (s: unknown): string => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');

/** The same nine bands, keyed by the normalised label — see the lookup in resolveStoryYear. */
const BAND_BY_NORM: Record<string, string> = Object.keys(BAND_LABELS)
  .reduce((acc, label) => { acc[norm(label)] = BAND_LABELS[label]; return acc; }, {} as Record<string, string>);

/**
 * LEADING-PHRASE, NOT SUBSTRING. A substring test makes "seven years before present day" contemporary,
 * and that phrase is the measurement's base, not the story's period.
 */
export function readsAsContemporary(settingEra: unknown): boolean {
  const s = norm(settingEra);
  if (!s || DATED_PROSE.test(s)) return false;
  return CONTEMPORARY_PHRASES.some((p) => s === p || (s.startsWith(p) && /^[\s\-–—:,;/()[\]]/.test(s.slice(p.length))));
}

/**
 * Sentence spans over the material. Pairing may not cross one — see the plan's note on the dial.
 *
 * A NEWLINE BREAKS UNCONDITIONALLY; only . ! ? need the lookahead that keeps "7.5" and "Dr." whole.
 * Requiring one for the newline too was measured wrong on the commonest shape this system reads: in
 * "- He vanished in 1994\n- Seven years before the film, Sophie began asking" the next character is
 * "-", not whitespace, so the two bullets were one span and the resolver answered COMPUTED 2001 —
 * a year built from a date on one bullet and a distance on the next. §29 Continuity foundations is
 * 45 such bullets, and no bullet ends in a full stop.
 */
function sentences(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isBreak = ch === '\n'
      || ((ch === '.' || ch === '!' || ch === '?') && (i + 1 >= text.length || /[\s"'”’)\]]/.test(text[i + 1])));
    if (isBreak) {
      if (i + 1 > start) out.push({ start, end: i + 1 });
      start = i + 1;
    }
  }
  if (start < text.length) out.push({ start, end: text.length });
  return out;
}

/**
 * Rung 1. EVERY pair, not the first: a single pair cannot disagree with itself, and disagreement is
 * the finding — the material dating its own history two incompatible ways, caught before a word is
 * written.
 *
 * A ranged phrase ("fifteen to ten years before") is skipped: it implies a span of presents, not one.
 * A zero offset ("the present") is skipped: pairing "now" with a year says nothing about the story.
 */
function computedPairs(material: string): { year: number; text: string }[] {
  const tokens = tokenize(material);
  const phrases = matchPhrases(tokens).filter((p) => p.anchored && p.from === p.to && p.from !== 0);
  const years = matchYears(tokens);
  if (!phrases.length || !years.length) return [];
  const out: { year: number; text: string }[] = [];
  for (const s of sentences(material)) {
    const inSentence = <T extends { start: number; end: number }>(x: T) => x.start >= s.start && x.end <= s.end;
    for (const y of years.filter(inSentence)) {
      for (const p of phrases.filter(inSentence)) {
        const implied = roundHalfAwayFromZero(y.year - daysToYears(p.from));
        out.push({ year: implied, text: `${y.year} + "${material.slice(p.start, p.end).trim()}"` });
      }
    }
  }
  return out;
}

export function resolveStoryYear(input: StoryYearInput): StoryYearResult {
  const material = String((input && input.material) || '');
  const currentYear = input && Number.isFinite(input.currentYear) ? Math.trunc(input.currentYear) : NaN;
  const era = String((input && input.settingEra) || '').trim();
  const country = String((input && input.settingCountry) || '').trim();
  if (!Number.isFinite(currentYear)) {
    return { year: null, provenance: 'ASK', note: 'No current year was supplied, so there is nothing to fall back to. Set the present year.', evidence: [] };
  }

  // ── 1 · COMPUTED ────────────────────────────────────────────────────────────────────────────
  const pairs = computedPairs(material);
  if (pairs.length) {
    const distinct = [...new Set(pairs.map((p) => p.year))];
    if (distinct.length === 1) {
      return {
        year: distinct[0],
        provenance: 'COMPUTED',
        note: `${pairs[0].text} puts the present at ${distinct[0]}.`,
        evidence: pairs.map((p) => p.text),
      };
    }
    return {
      year: null,
      provenance: 'ASK',
      note: `Two datings of your history disagree — ${distinct.join(' and ')}. Set the present year yourself.`,
      evidence: pairs.map((p) => p.text),
      conflict: { years: distinct, pairs: pairs.map((p) => p.text) },
    };
  }

  // ── 2 · ERA_MIDPOINT ────────────────────────────────────────────────────────────────────────
  if (era) {
    if (country && findEraRow(country, era)) {
      const v = anchorYearForEra(country, era, currentYear);
      if (v.status === 'refused') {
        return { year: null, provenance: 'ASK', note: v.note, evidence: [`${country} · ${era}`] };
      }
      if (v.status === 'ok' && v.year !== null) {
        return { year: v.year, provenance: 'ERA_MIDPOINT', note: v.note, evidence: [`${country} · ${era}`] };
      }
      // 'missing' cannot happen here (findEraRow just matched), and falls through if it ever does.
    }
    // Normalised the way the concession is, so a hand-lowercased or re-spaced label still resolves.
    // The taxonomy guard in the spec stays EXACT: this leniency is for what a user types, not for a
    // renamed option the form now offers.
    const bandId = BAND_LABELS[era] || BAND_BY_NORM[norm(era)];
    if (bandId) {
      if (bandId === 'contemporary') {
        return { year: currentYear, provenance: 'DEFAULTED_PRESENT', note: 'Set in the present, so the present year is this year.', evidence: ['Contemporary'] };
      }
      const y = anchorYearForBand(bandId, currentYear);
      if (y !== null) {
        return {
          year: y,
          provenance: 'ERA_MIDPOINT',
          note: `You set this in ${era}, so the present is taken as around ${y} — change it if your story is more precise.`,
          evidence: [era],
        };
      }
    }
    if (readsAsContemporary(era)) {
      return { year: currentYear, provenance: 'DEFAULTED_PRESENT', note: 'Your setting reads as the present day, so the present year is this year.', evidence: [era] };
    }
    // UNRECOGNISED PROSE IS NOT "NOW". Rung 3 is for Contemporary or unset, and this is neither.
    return {
      year: null,
      provenance: 'ASK',
      note: `"${era}" is not a period this map knows, and your material never dates itself, so the present year cannot be worked out. Set it yourself.`,
      evidence: [],
    };
  }

  // ── 3 · DEFAULTED_PRESENT ───────────────────────────────────────────────────────────────────
  return { year: currentYear, provenance: 'DEFAULTED_PRESENT', note: 'Nothing in the brief or the material sets a period, so the present year is this year.', evidence: [] };
}

/**
 * THE YEAR A PROMPT MAY PRINT — COMPUTED only.
 *
 * A band midpoint is an approximation of a period, not a fact about this story, and a defaulted year
 * is an assumption. Either one printed as "the present is 1000" is a number the writer never gave,
 * arriving with the authority of the page. Checks may reason from all four; only the material's own
 * arithmetic may be written from.
 */
export function storyYearForPrompt(r: StoryYearResult | null | undefined): number | null {
  return r && r.provenance === 'COMPUTED' && typeof r.year === 'number' ? r.year : null;
}

/** What a check reasons from — always WITH the provenance, so an assumed anchor cannot pass as computed. */
export function storyYearForCheck(r: StoryYearResult | null | undefined): { year: number | null; provenance: StoryYearProvenance } {
  if (!r) return { year: null, provenance: 'ASK' };
  return { year: typeof r.year === 'number' ? r.year : null, provenance: r.provenance };
}
