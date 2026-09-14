import type { EraHit } from './era.util';
import type { StoryYearProvenance } from './story-year.util';

/**
 * WHAT THE TIMELINE AXIS CAN SAY ABOUT A FINISHED STAGE — WITHOUT A MODEL CALL.
 *
 * The first check in this system that asks nothing of an AI. Every number in it comes from the
 * tokenizer and the sourced map; every judgement is arithmetic. That is the whole reason it is wired
 * before the injection: it can be wrong at no cost to a build, and it is cheapest to be certain of
 * it now.
 *
 * THREE STATES, THE SAME SHAPE AS keepCheck, AND NEVER A SCORE:
 *   FINDINGS     something in the material contradicts itself
 *   NO FINDINGS  it ran, and found none
 *   NOT RUN      it could not run, and says why
 *
 * AND NOTES, WHICH ARE NOT FINDINGS. A stratum nobody dramatised, a phrase measured from an event
 * this build cannot date, a build with no source material at all — none of those is a defect in the
 * writing (§5, §8). But "no findings" printed over nine unread expressions is silence reported as
 * health, and this project has already paid for that once. So they are counted, quoted, and said.
 *
 * Pure; never throws. The sweep, the anchor and the storage live in the service.
 */

/** Finding codes are constants, never strings retyped at the emitter and the reader. */
export const ERA_ANCHOR_CONFLICT = 'ERA_ANCHOR_CONFLICT';

export type EraCheckState = 'FINDINGS' | 'NO FINDINGS' | 'NOT RUN';

export interface EraFinding { code: string; note: string; evidence: string[] }

export interface EraCheckReport {
  state: EraCheckState;
  /** Present only on NOT RUN. */
  reason?: string;
  /** Never null on a run; empty when there are none. */
  findings: EraFinding[];
  /** Said plainly, once, where the map is read. Never a finding. */
  notes: string[];
  /** What the arithmetic was done against, so an assumed anchor cannot pass as a computed one. */
  anchor: { year: number | null; provenance: StoryYearProvenance | 'NONE'; stored: boolean };
  /** How much temporal language the stage carries, and how much of it resolved. */
  expressions: { total: number; resolved: number; unresolved: number; samples: string[] };
  summary: string;
  at: string;
}

export interface EraCheckInput {
  hits: EraHit[];
  /**
   * Every present the STAGE ITSELF implies, from `datingPairs` over its body: an absolute year and a
   * relative distance in one sentence. This is the only thing in a stage that can disagree with the
   * anchor in a way arithmetic can prove — see the comparison below.
   */
  bodyPairs?: { year: number; text: string }[];
  anchor: { year: number | null; provenance: StoryYearProvenance | 'NONE'; stored: boolean; note?: string; conflict?: { years: number[]; pairs: string[] } } | null;
  /** Characters of source material this build holds. 0 is a stated condition, not a fault. */
  materialChars: number;
  at?: string;
}

const SAMPLE_MAX = 5;
const quote = (xs: string[]) => xs.map((x) => '"' + String(x).replace(/\s+/g, ' ').trim().slice(0, 60) + '"').join(', ');

export function buildEraCheck(input: EraCheckInput): EraCheckReport {
  const at = (input && input.at) || new Date().toISOString();
  const hits = Array.isArray(input && input.hits) ? input.hits : [];
  const anchor = (input && input.anchor) || null;
  const a = { year: anchor ? anchor.year : null, provenance: anchor ? anchor.provenance : ('NONE' as const), stored: !!(anchor && anchor.stored) };
  const resolved = hits.filter((h) => h && h.offset != null);
  const unresolved = hits.filter((h) => !h || h.offset == null);
  const expressions = {
    total: hits.length,
    resolved: resolved.length,
    unresolved: unresolved.length,
    samples: unresolved.slice(0, SAMPLE_MAX).map((h) => String((h && h.text) || '')),
  };

  const notes: string[] = [];
  // A STATED CONDITION, NOT A FAULT. A from-scratch build has no source by design (spec §7 is written
  // for that tab), and 14 of the 35 builds here hold none. Saying so is the difference between "the
  // material was read and said nothing" and "there was no material".
  if (!input || !input.materialChars) {
    notes.push('This build has no source material, so no temporal expression could be read from it.');
  }
  // WHAT THIS COUNTS, EXACTLY: expressions that carry a DISTANCE whose base is missing — "seven
  // years before [the war]". A bare event reference with no number in it ("before the war", "the
  // year Jason vanished") is not swept at all, so it cannot be counted here and this note must not
  // imply otherwise. Finding those is Task 3a's own work, not something this check can report on.
  if (expressions.unresolved) {
    notes.push(expressions.unresolved + ' temporal expression' + (expressions.unresolved === 1 ? ' measures' : 's measure')
      + ' a distance from something this build cannot date — ' + quote(expressions.samples)
      + ' — so ' + (expressions.unresolved === 1 ? 'it carries' : 'they carry') + ' no offset.');
  }
  if (anchor && !anchor.stored && a.provenance !== 'NONE') {
    notes.push('The present year was resolved but NOT PERSISTED, so it will be worked out again on the next stage.');
  }
  if (a.provenance === 'ERA_MIDPOINT') notes.push('The present year is derived from the chosen period, not stated by the material' + (a.year === null ? '.' : ' — taken as ' + a.year + '.'));
  if (a.provenance === 'DEFAULTED_PRESENT') notes.push('The present year was assumed to be this year; nothing in the material dates the story.');

  const findings: EraFinding[] = [];

  /**
   * THE COMPARISON — the stage's own dating against the anchor, and against itself.
   *
   * Measured on four real stage bodies first (13 Sep): V2.6's TREATMENT, SCENES and SYNOPSIS and
   * n2's TREATMENT carry 27 temporal hits between them and NOT ONE absolute year — every hit is
   * "SEVEN YEARS EARLIER", "eight years ago", "two days later". So the comparisons that a lone hit
   * would allow are all unsound here:
   *   · a year on its own ("1850") is a reference, not a contradiction — stories name years;
   *   · a positive offset is a flash-forward, which the signed axis exists to express;
   *   · "seven years earlier" against "eight years ago" is only a contradiction if both name the SAME
   *     event, and event identity is Task 3a's work, not something a scalar offset carries.
   * What IS provable is a stage that DATES ITSELF: an absolute year and a distance in one sentence
   * imply a present, and that present can disagree with another one in the same stage, or with an
   * anchor the material itself computed.
   */
  const pairs = Array.isArray(input && input.bodyPairs) ? input.bodyPairs : [];
  const implied = [...new Set(pairs.map((p) => p.year))];
  if (implied.length > 1) {
    findings.push({
      code: ERA_ANCHOR_CONFLICT,
      note: 'This stage dates the present two ways — ' + implied.join(' and ') + '.',
      evidence: pairs.map((p) => p.text).slice(0, SAMPLE_MAX),
    });
  } else if (implied.length === 1 && a.year !== null && implied[0] !== a.year) {
    // AGAINST A COMPUTED ANCHOR THIS IS A FINDING; against an assumed one it is a NOTE. Accusing a
    // stage of contradicting a year nobody stated would be the PLACE_JUMP mistake: the stage is the
    // better evidence, and what the writer needs is the offer to set the anchor, not a defect.
    if (a.provenance === 'COMPUTED') {
      findings.push({
        code: ERA_ANCHOR_CONFLICT,
        note: 'This stage dates the present at ' + implied[0] + ', and the material dated it at ' + a.year + '.',
        evidence: pairs.map((p) => p.text).slice(0, SAMPLE_MAX),
      });
    } else {
      notes.push('This stage dates the present at ' + implied[0] + ', while the present year here was '
        + (a.provenance === 'ERA_MIDPOINT' ? 'derived from the chosen period' : 'assumed') + ' as ' + a.year + '. Set the present year if the stage is right.');
    }
  }

  if (anchor && anchor.conflict && Array.isArray(anchor.conflict.years) && anchor.conflict.years.length > 1) {
    findings.push({
      code: ERA_ANCHOR_CONFLICT,
      note: 'Two datings of the history imply different presents — ' + anchor.conflict.years.join(' and ') + '.',
      evidence: Array.isArray(anchor.conflict.pairs) ? anchor.conflict.pairs.slice(0, SAMPLE_MAX) : [],
    });
  }

  // NOT RUN when there is no year to reason from — unless the reason IS the finding. An anchor
  // refused because two datings disagree has already told the writer something true.
  if (a.year === null && !findings.length) {
    const reason = (anchor && anchor.note) || 'The story has no present year, so nothing could be measured from it.';
    return { state: 'NOT RUN', reason, findings: [], notes, anchor: a, expressions, summary: 'ERA CHECK DID NOT RUN: ' + reason, at };
  }

  const state: EraCheckState = findings.length ? 'FINDINGS' : 'NO FINDINGS';
  // NO FINDINGS MUST STATE ITS OWN BLINDNESS, and only this state needs to: it is the one a reader
  // takes as "the timeline is consistent". What it actually means is "no NUMERIC temporal expression
  // contradicted the anchor". Section coverage is not rule coverage.
  if (state === 'NO FINDINGS') {
    notes.push('What was checked: whether this stage dates the present in two different ways, or in a way the material\'s own dating contradicts'
      + (pairs.length ? '' : ' — and this stage dates the present in no way at all, so nothing was compared') + '. '
      + 'What was NOT: whether "seven years earlier" and "eight years ago" mean the same event, which needs the events named; '
      + 'and bare references like "before the war", which carry no number and are not read by this check at all.');
  }
  // NO FRACTION IN THE SUMMARY. "3 of 5 placed" is the shape the Keep check was forbidden, for the
  // same reason: a ratio invites confidence the denominator does not support. The counts stay in
  // `expressions`, where a reader who wants them asks for them, and what the summary says is what
  // was NOT placed.
  // THE HEAD LINE CLAIMS ONLY WHAT WAS COMPARED. "Nothing contradicts the timeline" was false: the
  // comparison is between datings, and a stage that never dates itself has had nothing compared.
  const head = findings.length
    ? 'ERA CHECK — ' + findings.map((f) => f.note).join(' ')
    : pairs.length
      ? 'ERA CHECK — this stage\'s own dating agrees with the story\'s present year'
      : 'ERA CHECK — this stage never dates the present, so there was nothing to compare it against';
  return { state, findings, notes, anchor: a, expressions, summary: head + (notes.length ? ' · ' + notes.join(' ') : ''), at };
}
