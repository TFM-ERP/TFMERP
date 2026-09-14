/**
 * A RUN THAT NEVER CAME BACK IS NOT STILL RUNNING.
 *
 * `begin()` writes an AiRun at RUNNING and `finish()`/`fail()` close it. When the process dies
 * mid-call — a harness that disconnects while a check is in flight, a restart during a long
 * generation — neither ever runs, and the row stays RUNNING for ever. On 15 Sep there were 18 of
 * them, from 21 Jun to the night before, across seven task types. Nothing in the codebase deleted,
 * swept or aged them: AiRun had exactly three writers, all in ai.service.ts.
 *
 * WHY ONE HOUR, measured rather than picked. The slowest call this ledger has ever completed took
 * 591s (p99.9 526s, p99 242s), and the longest timeout in the code is the register check's 900,000ms
 * ceiling. One hour is 6.1x the slowest completed call and clears that ceiling, so it cannot reap a
 * call that is genuinely still running. All 18 orphans were older than an hour; the two populations
 * do not overlap.
 *
 * WHY ABANDONED AND NOT ERROR. ERROR means the provider answered with a failure — and that bucket is
 * already 1,685 rows. "We never found out" is a different fact, and folding it into ERROR would lose
 * it. The word is only honest if the reader knows it: llm-routing's ledger view maps status to a
 * result, and its `else` renders anything unrecognised as 'running' — so a sweep without that third
 * branch turns 18 stuck rows into 18 lying ones. Both land together, by ruling.
 *
 * Pure and side-effect free so the threshold can be tested without a database.
 */

/** 6.1x the slowest completed call in the ledger; clears the 900,000ms register-check ceiling. */
export const ABANDONED_AFTER_MS = 60 * 60 * 1000;

/** The status a run gets when the process that started it never came back. */
export const ABANDONED = 'ABANDONED';

/** The cutoff a sweep run at `now` should use. Everything created before this is abandoned. */
export function abandonedBefore(now: Date | number, afterMs: number = ABANDONED_AFTER_MS): Date {
  const t = now instanceof Date ? now.getTime() : Number(now);
  return new Date(t - afterMs);
}

/**
 * How the ledger view should render a status. Extracted so the reader and the writer of the new
 * word cannot drift apart: the sweep and the view agree by construction, not by both being edited.
 */
export function runResult(status: string): 'success' | 'error' | 'abandoned' | 'running' {
  if (status === 'DONE') return 'success';
  if (status === 'ERROR') return 'error';
  if (status === ABANDONED) return 'abandoned';
  return 'running';
}
