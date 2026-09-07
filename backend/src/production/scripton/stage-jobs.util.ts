/**
 * Stage-job lifecycle rules — when an in-flight ladder generation is finished, and when it is dead.
 *
 * WHY THIS IS A FILE AND NOT THREE LINES IN THE SERVICE. `pruneStageJobs()` used to read:
 *
 *     if (j.status !== 'RUNNING' && (j.finishedAt || 0) < cutoff) this.stageJobs.delete(k);
 *
 * which is correct about finished jobs and silently catastrophic about running ones. A RUNNING job
 * was never collected at any age, and `startStage()` returns the existing handle whenever it finds
 * one — so a single generation that never settled made that stage permanently unclickable. No error,
 * no warning, no new version: the client received a valid response describing work that was not
 * happening. The only cure was a backend restart, because the map is in memory, which is why it read
 * as intermittence rather than as a lock.
 *
 * The rules now live here, pure and dependency-free, so each one has a test that does not need Nest,
 * Prisma or a clock. Everything takes `now` as an argument for the same reason.
 *
 * TWO THRESHOLDS, TWO DIFFERENT JOBS:
 *
 *   FINISHED_TTL_MS      how long a DONE/ERROR job stays readable so a client that polls late still
 *                        learns the outcome. Unchanged at 10 minutes.
 *
 *   abandonAfterMs()     how long a RUNNING job may go without settling before we stop believing it.
 *                        Deliberately generous, because the failure mode of being WRONG here is worse
 *                        than the bug: reaping a live run lets the next click start a second one, and
 *                        the guard being repaired exists precisely to stop a double-click buying two
 *                        seven-minute calls. So it scales with the stage's own measured ETA and never
 *                        drops below a floor.
 */

/** A DONE or ERROR job stays readable this long, so a late poll still learns the outcome. */
export const FINISHED_TTL_MS = 10 * 60 * 1000;

/**
 * No RUNNING job is presumed dead before this, however fast its stage normally is. LOGLINE has a
 * 5-second ETA; five seconds times any multiple is far too eager a trigger for a provider that is
 * merely slow today.
 */
export const ABANDON_FLOOR_MS = 30 * 60 * 1000;

/**
 * And beyond the floor it scales, so the long stages get proportionally longer rope. DRAFT's ETA is
 * 420s, giving it 70 minutes — comfortably past the 30–50 minutes a real feature rewrite takes.
 */
export const ABANDON_ESTIMATE_MULTIPLE = 10;

/** The shape these rules need. The service's job objects carry more; none of the rest matters here. */
export interface StageJobLike {
  status: 'RUNNING' | 'DONE' | 'ERROR';
  startedAt: number;
  finishedAt?: number;
  estimateSec: number;
}

/** What a sweep decided about one job. '' means leave it alone. */
export type StageJobVerdict = '' | 'expired' | 'abandoned';

/**
 * How long this stage may run before we stop believing it, from its own ETA.
 *
 * PURE, AND NEVER THROWS. A missing, negative, NaN or absurd estimate falls back to the floor rather
 * than producing a threshold of zero — a zero here would reap every running job on the next sweep,
 * which is the one outcome worse than the bug this file fixes.
 */
export function abandonAfterMs(estimateSec: any): number {
  const sec = typeof estimateSec === 'number' && isFinite(estimateSec) && estimateSec > 0 ? estimateSec : 0;
  return Math.max(ABANDON_FLOOR_MS, Math.round(sec * 1000 * ABANDON_ESTIMATE_MULTIPLE));
}

/**
 * A finished job whose readable window has passed. Note `finishedAt || 0`: a DONE job that somehow
 * carries no finish time reads as epoch and is collected, which is the safe direction — it is already
 * finished, so nothing is lost but a stale row.
 */
export function isExpired(job: StageJobLike | null | undefined, now: number): boolean {
  if (!job || job.status === 'RUNNING') return false;
  return (job.finishedAt || 0) < now - FINISHED_TTL_MS;
}

/**
 * A RUNNING job that has outlived any plausible completion. It did not fail — a failure settles the
 * promise and lands in the catch. It never settled at all, which on the generate path means the model
 * call hung with no timeout on it.
 */
export function isAbandoned(job: StageJobLike | null | undefined, now: number): boolean {
  if (!job || job.status !== 'RUNNING') return false;
  const startedAt = typeof job.startedAt === 'number' && isFinite(job.startedAt) ? job.startedAt : 0;
  return now - startedAt > abandonAfterMs(job.estimateSec);
}

/** One verdict per job, so a caller cannot ask the two questions in the wrong order. */
export function verdictFor(job: StageJobLike | null | undefined, now: number): StageJobVerdict {
  if (isAbandoned(job, now)) return 'abandoned';
  if (isExpired(job, now)) return 'expired';
  return '';
}

/**
 * What the writer is told when a job is reaped. It names the elapsed time rather than saying
 * "timed out", because the run did not time out — nothing was watching it long enough to time out.
 */
export function abandonedMessage(kind: string, startedAt: number, now: number): string {
  const mins = Math.max(1, Math.round((now - (startedAt || now)) / 60000));
  return String(kind || 'This stage').toUpperCase()
    + ' stopped responding after ' + mins + ' minute(s) and was abandoned. Nothing was written.'
    + ' Generate again — if it recurs, the model provider is not returning.';
}
