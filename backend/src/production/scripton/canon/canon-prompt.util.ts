/**
 * THE CANON EXTRACTION PROMPT, as its own module.
 *
 * It lives here rather than inline because the acceptance test for it is an EXTRACTION, not an
 * inspection: a script runs this exact text against real source material and asserts that the four
 * sentences which previously reached nothing are represented. A copy of the prompt in the harness
 * would drift from the one that ships and the test would stop meaning anything.
 */

export const SOURCE_CANON_SYSTEM: string = [
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
  'prohibition. Aim for at least 4 ROLE, 3 CRIME, 4 CAUSATION, 3 OUTCOME and 3 ORDERING facts where',
  'the source supports them, and ALL prohibitions without limit. If the source supports fewer, return',
  'fewer - but do not fill the space with more names and ages.',
  '',
  'Include ONLY what the material actually STATES. Do NOT invent or infer: a missing fact is harmless,',
  'an invented one is a bug. At most 60 facts.',
].join('\n');

/**
 * MEASURED, NOT CHOSEN. At 8,000 this call ran to its ceiling on a 66,128-character bible
 * (stop_reason=max_tokens, 8,000 output tokens) and the JSON came back cut mid-string — so the
 * whole extraction returned nothing and every stage was written with no canon. Sixty facts with
 * quoted statements is simply a larger response than the old thirty biographical ones, and on a
 * model that reasons by default the reasoning is billed against this same ceiling.
 */
export const SOURCE_CANON_MAXTOK = 32000;
