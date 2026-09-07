/**
 * WHY THIS IS A FILE AND NOT A STRING LITERAL AT THE THROW SITE.
 *
 * On 7 Sep the ScripON SYNOPSIS stage failed six times in a row with:
 *
 *     "The model returned an empty draft for SYNOPSIS. Try again - the prompt may be too long
 *      or the model was rate-limited."
 *
 * Every clause of that sentence was wrong. The prompt was not too long (1,924 tokens). The model was
 * not rate-limited — the provider reported SUCCESS, and the AiRun row was written DONE. What actually
 * happened was that the stage asked for at most 2,400 output tokens, claude-opus-5 spent all 2,400 of
 * them on adaptive reasoning (it thinks by default, that thinking is billed against the same
 * max_tokens as the prose, and its thinking blocks carry no visible text), and the response therefore
 * came back with no text block at all. Six runs, each logging outputTokens 2400 / outputChars 0.
 *
 * The numbers that would have identified this in seconds were all in hand at the throw site and none
 * of them were printed. That is the bug this file exists to prevent: a stage that cannot produce a
 * draft must say WHAT it asked for, WHAT it got, WHICH model, and WHY that combination produced
 * nothing — and must never again describe a cut-off response as an empty one.
 *
 * Pure functions, no I/O, so the wording is testable without a provider or a database.
 */

export interface EmptyOutputFacts {
  /** The raw text the provider returned. Empty means the response carried no text at all. */
  text?: string;
  outputTokens?: number;
  inputTokens?: number;
  /** The ceiling this call asked for (max_tokens). */
  maxTokens?: number;
  /** Anthropic `stop_reason` or OpenAI-compatible `finish_reason`. */
  stopReason?: string;
  /** A thinking block was present in the response. */
  sawThinking?: boolean;
  model?: string;
  provider?: string;
}

const n = (v?: number): string => (typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US') : '?');

/**
 * Did this response stop because it ran out of room, rather than because it was finished?
 *
 * Two independent signals, because neither is always present. `stop_reason` is authoritative but was
 * historically dropped on the streaming path; the token count is always there. The 98% band (rather
 * than equality) covers providers that stop a token or two short of the ceiling.
 */
/** Did the model DECLINE, rather than run out of room? A refusal needs opposite advice to everything
 *  else here: an identical retry will be refused identically. `stop_details` is not plumbed through,
 *  so we report the fact and not a category we did not receive. */
export function wasRefused(f?: EmptyOutputFacts): boolean {
  return String((f || {}).stopReason || '').toLowerCase() === 'refusal';
}

export function stoppedAtCeiling(f?: EmptyOutputFacts): boolean {
  f = f || {};
  const reason = String(f.stopReason || '').toLowerCase();
  // An explicit stop reason is the model's own account of why it stopped, so it settles the question
  // BOTH ways — a stage that reports "end_turn" finished, even if it finished a few tokens under its
  // ceiling. Letting the ratio below overrule that would stamp "may be incomplete" onto drafts that
  // are complete, and a warning that cries wolf is a warning nobody reads.
  if (reason) return reason === 'max_tokens' || reason === 'length';
  // No stop reason (an older provider, or a stream that dropped it): fall back to the spend. The 98%
  // band rather than equality covers providers that stop a token or two short of the ceiling.
  const cap = Number(f.maxTokens) || 0;
  const used = Number(f.outputTokens) || 0;
  return cap > 0 && used >= cap * 0.98;
}

/** The measured facts, in one clause, for appending to any message about this call. */
export function usageSummary(f?: EmptyOutputFacts): string {
  f = f || {};
  const bits = [
    'input ' + n(f.inputTokens) + ' tokens',
    'output ' + n(f.outputTokens) + '/' + n(f.maxTokens) + ' tokens',
  ];
  if (f.stopReason) bits.push('stop reason "' + f.stopReason + '"');
  if (f.model) bits.push(f.model + (f.provider ? ' via ' + f.provider : ''));
  return bits.join(', ');
}

/**
 * Why this stage has no draft, in the operator's terms. ALWAYS returns a sentence — a stage that
 * cannot explain its own failure is the thing that went wrong here.
 *
 * Three distinct failures, three distinct messages, because they have three different fixes:
 *   1. The model declined       → an identical retry is refused identically. Change the request.
 *   2. Cut off with nothing written  → the ceiling is too low for this model. Raise it.
 *   3. Cut off mid-prose, unsalvageable → the ceiling is too low for this stage's length.
 *   4. Not cut off, still nothing    → a genuinely empty answer; retrying is reasonable.
 *
 * Tolerant of junk input by design — this runs on the failure path, and a diagnostic that throws
 * while explaining a failure replaces a bad message with no message at all.
 */
export function explainEmptyDraft(label: string, f?: EmptyOutputFacts): string {
  f = f || {};
  label = String(label || 'this stage');
  const chars = String(f.text || '').length;
  const capped = stoppedAtCeiling(f);
  const head = 'No ' + label + ' draft was produced. ';
  const facts = ' (' + usageSummary(f) + ')';

  if (wasRefused(f)) {
    // Checked FIRST, and before the ceiling test, because a refusal is not a capacity problem: it
    // would otherwise fall through to "retrying is worth one attempt", which is the one piece of
    // advice guaranteed not to work here.
    return head + 'The model DECLINED this request — it stopped with a refusal rather than running out'
      + ' of room. Retrying it unchanged will be declined again; the prompt or the source material for'
      + ' this stage has to change.' + facts;
  }
  if (capped && chars === 0) {
    // The 7 Sep failure. Note what is NOT said: "the model returned nothing". It returned a full
    // ceiling's worth of tokens — they simply were not prose, and the operator needs to know that,
    // because the fix is the ceiling and not the prompt, the key, or a retry.
    return head + 'The model hit its ' + n(f.maxTokens) + '-token ceiling having written no text'
      + (f.sawThinking
        ? ' — the whole budget went to the model\'s internal reasoning, which is billed against this same ceiling and returns no visible text.'
        : ' — the entire budget was consumed before any text was emitted.')
      + ' This is a ceiling that is too low for this model, not a failed request: the provider reported success.'
      + ' Raise this stage\'s ceiling'
      // Only advise on reasoning where reasoning was actually OBSERVED. Naming it on a response that
      // carried no thinking block would be the same species of mistake as the message this replaces:
      // a confident explanation of something we did not measure.
      + (f.sawThinking ? ' — on a model that reasons by default it must cover the reasoning as well as the writing — or lower the reasoning effort.' : '.')
      + facts;
  }
  if (capped) {
    return head + 'The model hit its ' + n(f.maxTokens) + '-token ceiling mid-way, and the '
      + n(chars) + ' characters it did return could not be salvaged into a draft.'
      + ' Raise this stage\'s ceiling.' + facts;
  }
  if (chars === 0) {
    return head + 'The model stopped on its own having written nothing.'
      + ' The provider reported success, so this is not a key, quota or rate-limit problem — retrying is worth one attempt.'
      + facts;
  }
  return head + 'The model returned ' + n(chars) + ' characters, but none of it could be read as a draft'
    + ' (it was not prose, and not JSON this stage could parse).' + facts;
}

/** The note pinned to a draft that WAS salvaged off a cut-off response — persisted, never silent. */
export function truncationWarning(label: string, f: EmptyOutputFacts): string {
  return label + ' may be incomplete: the model hit its ' + n(f.maxTokens)
    + '-token ceiling, and this draft was recovered from the partial response. Re-run to get a complete one.'
    + ' (' + usageSummary(f) + ')';
}
