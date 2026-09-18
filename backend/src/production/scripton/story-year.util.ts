import { createHash } from 'crypto';
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

/**
 * What `storyYearFor` returns: the answer, plus whether the row actually holds it.
 *
 * A PERSIST THAT FAILED IS NOT A FREEZE. The write is deliberately not fatal — an anchor is worth
 * having even when it could not be saved — but if the caller cannot tell, every later call silently
 * re-resolves and the freeze this task exists for does not exist. So the outcome is carried, and
 * Task 3's data.eraCheck says "anchor not persisted" rather than leaving it to a log line.
 */
export interface StoryYearForBuild extends StoryYearResult {
  /** True when brief.storyYear now holds this answer. */
  stored: boolean;
  /** True when it came from the row rather than being resolved on this call. */
  fromStore: boolean;
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
 * A NEWLINE BREAKS UNCONDITIONALLY; only . ! ? need the lookahead, which keeps a decimal like "7.5"
 * whole. It does NOT keep an abbreviation whole: in "Dr. Hale arrived in 1994, seven years before."
 * the full stop is followed by a space, so that splits into two spans. A KNOWN, BENIGN FALSE
 * NEGATIVE — the cost is a legitimate pair dropped, never a wrong year computed, and this ladder
 * degrades to ASK rather than to a guess. Widening it to recognise abbreviations is a change to make
 * on evidence of refused pairs, with its own test.
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
 * EVERY absolute/relative pair in a text, as the present each implies. Exported because the era check
 * runs the same reading over a finished STAGE, and a second implementation of this would be a second
 * parser — the thing Plan 02 spent a task removing.
 *
 * Rung 1 uses it thus. EVERY pair, not the first: a single pair cannot disagree with itself, and disagreement is
 * the finding — the material dating its own history two incompatible ways, caught before a word is
 * written.
 *
 * A ranged phrase ("fifteen to ten years before") is skipped: it implies a span of presents, not one.
 * A zero offset ("the present") is skipped: pairing "now" with a year says nothing about the story.
 */
export function datingPairs(material: string): { year: number; text: string }[] {
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

/**
 * Years stated in the ERA FIELD, where a bare number needs no cue.
 *
 * `matchYears` licenses a four-digit number only when a cue precedes it — "in 1994", "before 1994"
 * — and that is right for prose, where a bare 1994 could be a quantity, a case number or a hull
 * number. It is wrong here: this field's entire purpose is to say WHEN, so the field supplies the
 * cue the sentence would have. Without this, a writer typing "1987" fell past every rung to ASK and
 * was told to set the year they had just set.
 *
 * Same tokenizer, one relaxed rule — not a second parser. The UNIT guard is kept, so "1987 days"
 * is still a duration rather than a year, and cued years ("set in 1987") continue to resolve
 * through matchYears exactly as they do in prose.
 */
function yearsInEraField(era: string): number[] {
  const tokens = tokenize(era);
  const out = matchYears(tokens).map((y) => y.year);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t || t.value === undefined) continue;
    if (t.kind === 'YEAR') { out.push(t.value); continue; }
    if (t.kind !== 'NUMBER' || !/^\d{4}$/.test(t.text) || t.value < 1000 || t.value > 2999) continue;
    if (tokens[i + 1] && tokens[i + 1].kind === 'UNIT') continue;
    // A DECADE IS A BAND, NOT A STATED YEAR. The tokenizer splits "1920s" into NUMBER 1920 and the
    // bare word "s", so without this "a contemporary retelling of the 1920s" answered COMPUTED 1920
    // — a period piece pinned to its first year, and precisely the laundering this ladder refuses.
    // The existing negative guard caught it; a decade belongs to the band lookup or to ASK.
    const next = tokens[i + 1];
    if (next && next.kind === 'WORD' && /^s$/i.test(next.text) && next.start === t.end) continue;
    out.push(t.value);
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
  const pairs = datingPairs(material);
  if (pairs.length) {
    const distinct = [...new Set(pairs.map((p) => p.year))];
    if (distinct.length === 1) {
      // REPORT-ONLY: the material's arithmetic wins, and says so when a typed year disagrees.
      //
      // Rung 2b reads a year the writer typed into the Era control. If the material ALSO dates
      // itself, this rung returns first and that typed year is never compared — a disagreement
      // between the two most specific sources of the same fact, decided silently. Resolving it
      // needs the rungs restructured to collect before they decide, which is its own change; what
      // is cheap now is to stop it being invisible, and to collect the observations that would
      // tell us which source should win.
      const typed = [...new Set(yearsInEraField(String((input && input.settingEra) || '')))];
      const disagreement = typed.length === 1 && typed[0] !== distinct[0]
        ? ` The period field says ${typed[0]}; the material's own dating wins here, and the two disagree.`
        : '';
      return {
        year: distinct[0],
        provenance: 'COMPUTED',
        note: `${pairs[0].text} puts the present at ${distinct[0]}.` + disagreement,
        evidence: pairs.map((p) => p.text).concat(disagreement ? [`period field: ${era}`] : []),
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
    // ── 2b · COMPUTED, FROM A YEAR THE WRITER TYPED ───────────────────────────────────────────
    //
    // The Era control is free text, and a writer who types "1987" has STATED the present. Without
    // this rung that answer fell past every lookup to the final branch and came back ASK — "…is not
    // a period this map knows, and your material never dates itself, so the present year cannot be
    // worked out. Set it yourself." The writer had just set it, in the field provided.
    //
    // AFTER THE TAXONOMY, NOT BEFORE, and that ordering is load-bearing. Placed first it hijacked
    // every band label carrying digits — "Medieval (500–1500)", "Mid-century (1940s–70s)" — and
    // answered COMPUTED 500 for a period the map already anchors properly. Six era-family tests
    // said so immediately. A recognised period wins; a typed year is read only when nothing in the
    // taxonomy matches.
    //
    // COMPUTED is the honest provenance, and the distinction the ladder turns on is preserved:
    // provenance describes WHAT THE MATERIAL SAID, never which component supplied the number. A year
    // a person typed is a stated year; a year INFERRED from "present day" is not, and still resolves
    // DEFAULTED_PRESENT below however it arrives.
    //
    // Two different years in one era string is a contradiction the writer must settle, exactly as
    // two disagreeing datings in the material are.
    //
    // NOT HANDLED, and said rather than hidden: if the material dates itself AND the writer types a
    // different year, rung 1 returns first and the typed year is never compared. That disagreement
    // is real and currently silent; surfacing it needs the rungs restructured to collect before they
    // decide, which is its own change.
    const eraYears = [...new Set(yearsInEraField(era))];
    if (eraYears.length === 1) {
      return { year: eraYears[0], provenance: 'COMPUTED', note: `You set the period to "${era}", so the present is ${eraYears[0]}.`, evidence: [era] };
    }
    if (eraYears.length > 1) {
      return {
        year: null, provenance: 'ASK',
        note: `"${era}" names more than one year — ${eraYears.join(' and ')}. Set the present year yourself.`,
        evidence: [era], conflict: { years: eraYears, pairs: [era] },
      };
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

// ── WHAT IS STORED ON THE BUILD ─────────────────────────────────────────────────────────────────

/**
 * `brief.storyYear` — a Json key on DevelopmentBuild.brief. No column, no migration, the same shape
 * of storage as `spine.want`.
 *
 * FROZEN WHILE ITS INPUTS ARE. A build made today and re-run in January must not shift every era by
 * a year (§2), so a stored anchor is used and never recomputed — unless the inputs it was computed
 * FROM have changed. Hence `inputsSha` over all three: the material, `settingEra` and
 * `settingCountry`. A writer who corrects a prose era to "Medieval (500–1500)" changes no material,
 * and a source-only hash would keep the stale ASK for ever.
 */
export interface StoredStoryYear {
  year: number | null;
  provenance: StoryYearProvenance;
  note: string;
  evidence: string[];
  conflict?: { years: number[]; pairs: string[] };
  /** sha256 of the three resolution inputs. Differ → recompute; equal → never. */
  inputsSha: string;
  at: string;
}

/** The hash of everything the answer was computed from. Length-prefixed, so no field can impersonate another. */
export function storyYearInputsSha(material: unknown, settingEra: unknown, settingCountry: unknown): string {
  const part = (v: unknown) => { const s = String(v == null ? '' : v); return s.length + ':' + s; };
  return createHash('sha256').update(part(material) + part(settingEra) + part(settingCountry)).digest('hex').slice(0, 32);
}

/** Use what is stored only when it was computed from exactly these inputs. */
export function storedStoryYearIsFresh(stored: unknown, inputsSha: string): stored is StoredStoryYear {
  const s = stored as StoredStoryYear | null;
  return !!s && typeof s === 'object' && typeof s.inputsSha === 'string' && !!inputsSha && s.inputsSha === inputsSha;
}

/** The record to persist. Carries the whole result, so nothing has to be recomputed to explain it. */
export function makeStoredStoryYear(r: StoryYearResult, inputsSha: string, at = new Date().toISOString()): StoredStoryYear {
  return {
    year: r.year, provenance: r.provenance, note: r.note, evidence: r.evidence,
    ...(r.conflict ? { conflict: r.conflict } : {}),
    inputsSha, at,
  };
}

/** A stored record read back as a result, for the two helpers above it. */
export function storedAsResult(s: StoredStoryYear): StoryYearResult {
  return { year: s.year, provenance: s.provenance, note: s.note, evidence: Array.isArray(s.evidence) ? s.evidence : [], ...(s.conflict ? { conflict: s.conflict } : {}) };
}
