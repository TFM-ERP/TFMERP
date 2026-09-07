/**
 * The source-material block a development stage is handed — and the cap it has to admit to.
 *
 * THE DEFECT THIS EXISTS FOR. A 44,733-character design document reached the ladder as
 * `sourceText.slice(0, 6000)`: thirteen percent, taken off the front, with nothing saying so. The
 * model read the title page and the tagline hierarchy, then completed the rest of the film
 * plausibly and confidently. Every first name survived; every surname, profession, relationship
 * and the entire backstory did not. Jason Richard Quick became Jason Vane; Quick Maritime Group
 * became Rourke Line; Moira stopped being a medic and became a mechanic.
 *
 * That distribution is not damage, it is a fingerprint: a writer who read the front of a document
 * and invented the rest. And it is the more dangerous of the two failures a cap can produce,
 * because a truncated document announces itself and a confidently completed one does not.
 *
 * TWO RULES, AND THEY ARE THE WHOLE FILE.
 *
 *   1. FIXED FACTS COME FIRST. The facts are extracted from the WHOLE source; the excerpt is the
 *      front of it. Whatever is read last wins an argument in a prompt, so the block that was
 *      derived from everything must not sit underneath the fragment that was derived from a tenth
 *      of it. Facts first, excerpt second, and the excerpt is labelled as an excerpt.
 *
 *   2. A CAP THAT FIRES SAYS SO. The note states the real numbers - what was sent, out of what -
 *      because a model told it is holding a fragment behaves differently from one that believes it
 *      is holding the document. Widening the cap is NOT the fix and never was: 44,733 characters
 *      against every ladder stage and then every scene call is an enormous bill for material that
 *      is mostly irrelevant to any one call. Extract once, inject what is needed, say what is
 *      missing.
 *
 * WHAT THIS FILE DOES NOT DO. It does not choose a cleverer excerpt. Taking the front is arbitrary,
 * and every alternative - the middle, the longest section, whatever mentions the protagonist - is a
 * heuristic that would be wrong on some document and could not say why it chose. The front is at
 * least honest about being arbitrary, and the facts block is what actually carries the meaning.
 *
 * PURE, AND NEVER THROWS.
 */

/**
 * The ladder's source cap, in characters. It lives here so the number has ONE home: it was
 * previously a bare 6000 inline in the service, which is how a constant becomes unauditable.
 * OUR CHOICE - fitted to prompt cost, not to any property of screenplays.
 */
export const SOURCE_EXCERPT_CHARS = 6000;

/**
 * How far back the cut may walk to land on a boundary rather than mid-word. Bounded, because a cut
 * that discards a page to find a paragraph break has stopped being tidying. OUR CHOICE.
 */
export const BOUNDARY_LOOKBACK = 400;

export interface SourceExcerpt {
  /** The text actually sent. */
  text: string;
  /** Characters in the whole source. */
  total: number;
  /** Characters sent. */
  sent: number;
  /** True when anything at all was left behind. */
  truncated: boolean;
}

const str = (v: any): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/**
 * Cut the source to the cap, landing on a paragraph or sentence boundary when one is close enough.
 *
 * The boundary walk is cosmetic and deliberately small: a half-sentence at the cut is noise the
 * model has to resolve, and resolving it is exactly the invention this file is trying to prevent.
 * It never walks further than BOUNDARY_LOOKBACK, so it can never quietly discard real material to
 * make the seam pretty.
 */
export function excerptSource(raw: any, limit?: number): SourceExcerpt {
  const src = str(raw);
  const cap = typeof limit === 'number' && isFinite(limit) && limit > 0 ? Math.floor(limit) : SOURCE_EXCERPT_CHARS;
  const total = src.length;
  if (total <= cap) return { text: src, total, sent: total, truncated: false };

  const head = src.slice(0, cap);
  // Never below zero. A negative floor let a lastIndexOf miss (-1) pass the boundary test, and
  // slice(0, -1) then quietly removed the final character of every excerpt with no seam in reach.
  const floor = Math.max(0, cap - BOUNDARY_LOOKBACK);
  // A paragraph break is the best seam; a sentence end is the next best. Anything earlier than the
  // floor is not worth the material it would cost.
  let cut = head.lastIndexOf('\n\n');
  if (cut < floor) {
    const dots = Math.max(head.lastIndexOf('. '), head.lastIndexOf('.\n'), head.lastIndexOf('؟ '), head.lastIndexOf('! '));
    cut = dots >= floor ? dots + 1 : -1;
  }
  const text = (cut > 0 && cut >= floor ? head.slice(0, cut) : head).trimEnd();
  return { text, total, sent: text.length, truncated: true };
}

/**
 * The sentence that stops a cap being silent. Empty when nothing was cut — a note that fires on a
 * complete document would train the reader to ignore it.
 */
export function excerptNote(ex: SourceExcerpt | null | undefined): string {
  if (!ex || !ex.truncated) return '';
  const pct = ex.total > 0 ? Math.max(1, Math.round((ex.sent / ex.total) * 100)) : 0;
  return 'NOTE: this is an EXCERPT — the first ' + ex.sent + ' characters of ' + ex.total
    + ' (' + pct + '%). The rest of the document is NOT below. Anything it establishes that is not'
    + ' stated in the fixed facts above or in this excerpt is unknown to you: leave it out rather'
    + ' than inventing it. Names, companies, professions and relationships you have not been shown'
    + ' are the ones most often invented, and each one is a defect.';
}

/**
 * Assemble the block. `canonBlock` is whatever the canon formatter produced from the WHOLE source
 * (empty string when there was none); `ex` is the excerpt that will follow it.
 *
 * Returns '' when there is no source at all, so a caller can concatenate unconditionally.
 */
export function sourceMaterialBlock(canonBlock: any, ex: SourceExcerpt | null | undefined): string {
  const canon = str(canonBlock).trim();
  const body = ex && typeof ex.text === 'string' ? ex.text : '';
  if (!body && !canon) return '';

  const parts: string[] = [];
  // Rule 1: facts first. They come from all 44,733 characters; the excerpt comes from 6,000 of them.
  if (canon) {
    parts.push('\nFIXED FACTS FROM THE SOURCE MATERIAL (extracted from the WHOLE document — these are'
      + ' stated, not inferred, and they OVERRIDE anything you would otherwise assume. Do not rename,'
      + ' re-profess or re-relate anyone named here):\n' + canon);
  }
  if (body) {
    parts.push('\nSOURCE MATERIAL (the work to adapt - stay faithful to it unless the brief overrides):\n' + body);
    // Rule 2: and it says when it fired.
    const note = excerptNote(ex);
    if (note) parts.push('\n' + note);
  }
  return parts.join('\n');
}
