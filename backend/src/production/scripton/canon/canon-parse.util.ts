/**
 * SALVAGE FACTS FROM A TRUNCATED RESPONSE — because all-or-nothing is the wrong trade here.
 *
 * Measured, on the 66,128-character bible: the extraction ran to its ceiling (stop_reason=max_tokens,
 * 8,000 output tokens) and the JSON was cut mid-string. `JSON.parse` threw, the service caught it and
 * returned [], and the whole ladder would then have written with NO canon at all — worse than before
 * the structural categories were added, because the prompt now asks for more and therefore truncates
 * sooner. Thirty-four complete facts had already been emitted and every one was thrown away.
 *
 * Raising the ceiling is the primary fix. This is the guard for when it happens anyway: a truncated
 * array still yields every COMPLETE object in it. Nothing partial is admitted — a half-written fact
 * is exactly the invented-fact failure the canon exists to prevent — so the last, incomplete object
 * is dropped rather than repaired.
 *
 * Pure and dependency-free, so it can be tested without a model.
 */

export interface LooseParse {
  facts: any[];
  /** True when the input was not valid JSON and objects had to be recovered individually. */
  salvaged: boolean;
  /** Complete objects that were recovered after the parse failure. */
  recovered: number;
}

/**
 * Scan for every balanced `{...}` region AT ANY DEPTH, respecting strings and escapes.
 *
 * Depth matters and getting it wrong makes this function useless: in a truncated response the outer
 * `{"facts":[` wrapper NEVER CLOSES, so every fact object sits at depth 2 and a scanner that only
 * emits at depth 0 recovers nothing at all — which is the whole failure this exists to prevent.
 * A stack emits each object as it closes, whatever encloses it; non-facts are filtered afterwards.
 */
export function completeObjects(s: string): any[] {
  const out: any[] = [];
  const stack: number[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '{') { stack.push(i); continue; }
    if (c === '}' && stack.length) {
      const start = stack.pop() as number;
      try { out.push(JSON.parse(s.slice(start, i + 1))); } catch { /* not a complete object; skip */ }
    }
  }
  return out;
}

/**
 * Parse `{facts:[...]}` from a model response, tolerating truncation.
 * Returns every complete fact object it can account for, and says whether it had to salvage.
 */
export function parseFactsLoose(text: unknown): LooseParse {
  const s = typeof text === 'string' ? text : '';
  if (!s.trim()) return { facts: [], salvaged: false, recovered: 0 };

  // 1. The response as it should be.
  for (const candidate of [s, (s.match(/\{[\s\S]*\}/) || [])[0]]) {
    if (!candidate) continue;
    try {
      const j = JSON.parse(candidate);
      if (j && Array.isArray(j.facts)) return { facts: j.facts, salvaged: false, recovered: 0 };
      if (Array.isArray(j)) return { facts: j, salvaged: false, recovered: 0 };
    } catch { /* fall through to salvage */ }
  }

  // 2. Truncated: recover the complete objects. The outer {"facts": [ wrapper is itself incomplete,
  //    so this deliberately looks for the fact objects rather than for valid JSON.
  const objs = completeObjects(s).filter((o) => o && typeof o === 'object' && !Array.isArray(o)
    && (o.kind || o.subject || o.statement));
  return { facts: objs, salvaged: objs.length > 0, recovered: objs.length };
}
