/**
 * THE CANON EXTRACTION PROMPT, as its own module.
 *
 * It lives here rather than inline because the acceptance test for it is an EXTRACTION, not an
 * inspection: a script runs this exact text against real source material and asserts that the four
 * sentences which previously reached nothing are represented. A copy of the prompt in the harness
 * would drift from the one that ships and the test would stop meaning anything.
 */

export function canonSystemPrompt(cap: number = CANON_FACT_CAP): string {
  return [
    'You are building the CANON for a screenplay going into production: the hard facts and rules',
    'the script must never contradict. Return ONLY JSON',
    '{facts:[{kind,subject,predicate,object,statement}]}. subject = the entity, upper-case.',
    'object = the value. statement = one sentence a writer can read, quoting the source where it is',
    'explicit. No text outside the JSON.',
    '',
    'kind is one of:',
    'ROLE - narrative FUNCTION, not job title. Who is the antagonist, who is the betrayer, who is',
    'the protagonist, whose betrayal is the deepest. predicate: is_antagonist|is_protagonist|',
    'is_betrayer|narrative_function.',
    'CRIME - what the crime IS, and separately what is only a MECHANISM serving it (laundering,',
    'false invoices and shell companies are usually mechanisms, not the crime). Say which is which.',
    'predicate: is_crime|is_mechanism_for.',
    'CAUSATION - who AUTHORISED, who PERMITTED, who EXPANDED, who EXECUTED. These are different and',
    'the source distinguishes them deliberately; do not collapse them into "was involved in".',
    'predicate: authorised|permitted|expanded|executed|concealed.',
    'OUTCOME - who lives, who dies, who is delivered to whom, what is destroyed or survives.',
    'predicate: survives|dies|delivered_to|destroyed.',
    'ORDERING - what must occur BEFORE what. predicate: occurs_before|occurs_after.',
    'PROHIBITION - an explicit "do not" / "never" / "no X" in the source. State it as the',
    'INSTRUCTION it is ("Do not rename the hero"), never as a fact about the story. predicate: must_not.',
    'CHARACTER|RELATIONSHIP|TIMELINE|WORLD|LORE|PLOT - biography: full names exactly as written, ages,',
    'who is whose sister or father or employer, durations, dates, places, companies, vessels.',
    '',
    'QUOTAS, and they matter more than the total. Biography is the easiest thing to extract and it has',
    'swamped every previous run. Before returning, check you have looked SPECIFICALLY for: every ROLE',
    'the source assigns; what the crime is versus what merely serves it; every authorised / permitted /',
    'expanded / executed distinction; every stated outcome; every ordering requirement; and EVERY',
    'prohibition. Aim for at least 10 ROLE, 8 CRIME, 10 CAUSATION, 8 OUTCOME and 8 ORDERING facts where',
    'the source supports them, and ALL prohibitions without limit. If the source supports fewer, return',
    'fewer - but do not fill the space with more names and ages.',
    '',
    'Include ONLY what the material actually STATES. Do NOT invent or infer: a missing fact is harmless,',
    'an invented one is a bug. At most ' + cap + ' facts NOT COUNTING PROHIBITIONS - return EVERY',
    'prohibition the source states, however many that is; they are never part of this budget.',
  ].join('\n');
}

/**
 * The cap the prompt states — and it counts NON-PROHIBITION facts only.
 *
 * A/B MEASURED on the 105,179-character bible: same source, same everything, only this number.
 *
 *     cap   total   prohibitions   out_tokens
 *      60      72             19        8,946
 *     120     145             44       18,604
 *
 * The cap is the anchor, not a limit the model ignores. The yield tracked it almost exactly, at a
 * consistent ~20% overshoot, and prohibitions more than doubled — the number that had to move, since
 * §29 alone holds around forty negative continuity bullets and only nineteen were coming back.
 *
 * THE BOUNDARY IS NOW STATED. It read "At most 60 facts" while selectCanonByQuota budgeted 60
 * EXCLUDING prohibitions, so the prompt and the allocator disagreed about what they were counting
 * and neither could be checked against the other. One population, named in both places, and
 * canon-prompt.util.spec.ts fails if they drift apart.
 */
export const CANON_FACT_CAP = 120;

/**
 * WHAT THE ALLOCATOR KEEPS — deliberately far above what the prompt ASKS for.
 *
 * These were one number, and that was the mistake behind "CANON TRUNCATED: extracted 226, kept 212".
 * The ask and the keep are different jobs: the ask shapes what the model looks for, and a ~20%
 * overshoot on it is normal and harmless; the keep exists only to stop a runaway response filling
 * the record, and if it ever binds on a real document it has thinned a canon that was correctly
 * extracted. The densest bible here produced 226 facts, of which 112 are undroppable.
 *
 * Any future "CANON TRUNCATED" is therefore a defect to fix, not a state to report.
 */
export const CANON_KEEP_BUDGET = 500;

/** The shipped prompt. Built from the cap so the two cannot drift. */
export const SOURCE_CANON_SYSTEM: string = canonSystemPrompt();

/**
 * PAST WHAT THE DENSEST REAL DOCUMENT PRODUCES, with room. Measured at a cap of 120 on the
 * 105,179-character bible: out=27,752 against 32,000 — 87% of the ceiling, one denser document away
 * from a truncated extraction. This has been the single most repeated defect of the night (SYNOPSIS
 * at 2,400, canon at 8,000, directions at 3,000), and every instance looked like something else
 * until the numbers were read. A ceiling should be a number nothing reaches, not a number the
 * biggest real input brushes.
 */
export const SOURCE_CANON_MAXTOK = 64000;

/**
 * BUMP THIS WHENEVER THE EXTRACTION CHANGES — the prompt, the kinds, the quota, or the parser.
 *
 * It is half the cache key. V2.1's canon was extracted from a 60,000-character head slice of a
 * 105,179-character bible: 57%, missing the entire story section and both rule-dense sections
 * (§29 Continuity foundations, §31 Rules for keeping Jason distinctive). A canon built from that is
 * not a smaller canon, it is a wrong one — it certifies as "ready" while the rules it exists to
 * carry were never read. Without a version in the key, the digest alone would happily serve it
 * again, because the SOURCE did not change; what changed is what we did with it.
 *
 *   1 - head slice, 60,000 chars, six structural kinds
 *   2 - the WHOLE source, no slice
 */
export const CANON_EXTRACTOR_VERSION = 2;

/**
 * The most source a single extraction will accept, in characters.
 *
 * A HARD ERROR ABOVE THIS, NOT A MERGE. A chunk-and-merge path would run only on the largest bible
 * in the system and nowhere else, so it would be the least exercised and most trusted code in the
 * pipeline — and a canon silently assembled from merged fragments is exactly the failure this whole
 * exercise is about. Refusing names the problem and leaves the choice to a person.
 *
 * 400,000 characters is ~125k tokens: comfortably inside the model's window, and roughly four times
 * the largest real bible here (105,179).
 */
export const CANON_MAX_SOURCE_CHARS = 400000;
