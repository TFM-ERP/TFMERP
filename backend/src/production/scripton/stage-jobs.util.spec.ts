import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  FINISHED_TTL_MS, ABANDON_FLOOR_MS, ABANDON_ESTIMATE_MULTIPLE,
  abandonAfterMs, isExpired, isAbandoned, verdictFor, abandonedMessage,
  type StageJobLike,
} from './stage-jobs.util';

const NOW = 1_700_000_000_000;
const MIN = 60 * 1000;

const running = (startedMinAgo: number, estimateSec = 30): StageJobLike =>
  ({ status: 'RUNNING', startedAt: NOW - startedMinAgo * MIN, estimateSec });
const finished = (finishedMinAgo: number, status: 'DONE' | 'ERROR' = 'DONE'): StageJobLike =>
  ({ status, startedAt: NOW - (finishedMinAgo + 1) * MIN, finishedAt: NOW - finishedMinAgo * MIN, estimateSec: 30 });

test('THE BUG: a RUNNING job used to be immortal — it is now reaped once it outlives any plausible run', () => {
  // The exact shape that bricked the SYNOPSIS stage: started, never settled, still marked RUNNING.
  const stuck = running(120);                       // two hours
  assert.equal(isAbandoned(stuck, NOW), true);
  assert.equal(verdictFor(stuck, NOW), 'abandoned');

  // and the old rule's own test, restated: it would have kept this forever
  assert.equal(stuck.status !== 'RUNNING' && (stuck.finishedAt || 0) < NOW - FINISHED_TTL_MS, false);
});

test('a live run is NOT reaped — being wrong here is worse than the bug it fixes', () => {
  // A double-click on Generate buying two seven-minute calls is what the RUNNING guard prevents.
  // Reaping a live job re-opens exactly that, so every one of these must survive.
  assert.equal(isAbandoned(running(1, 30), NOW), false);
  assert.equal(isAbandoned(running(10, 30), NOW), false);
  assert.equal(isAbandoned(running(29, 5), NOW), false);        // LOGLINE, 29 minutes in, still safe
  assert.equal(isAbandoned(running(29.9, 5), NOW), false);
  assert.equal(isAbandoned(running(60, 420), NOW), false);      // DRAFT at an hour — a real rewrite
  assert.equal(isAbandoned(running(69, 420), NOW), false);      // still inside DRAFT's 70-minute rope
  assert.equal(isAbandoned(running(71, 420), NOW), true);       // past it
});

test('the threshold scales with the stage ETA and never falls below the floor', () => {
  assert.equal(abandonAfterMs(5), ABANDON_FLOOR_MS);        // LOGLINE — floor wins
  assert.equal(abandonAfterMs(30), ABANDON_FLOOR_MS);       // SYNOPSIS — floor wins
  assert.equal(abandonAfterMs(130), ABANDON_FLOOR_MS);      // SCENES — 21.6 min, floor still wins
  assert.equal(abandonAfterMs(420), 420 * 1000 * ABANDON_ESTIMATE_MULTIPLE);   // DRAFT — 70 min
  assert.equal(abandonAfterMs(420), 70 * MIN);
});

test('a broken estimate falls back to the floor and NEVER to zero', () => {
  // A zero threshold would reap every running job on the next sweep — the one outcome
  // worse than the original bug. Every unusable input must land on the floor.
  for (const bad of [0, -1, -9999, NaN, Infinity, -Infinity, null, undefined, 'abc', {}, [], true]) {
    assert.equal(abandonAfterMs(bad as any), ABANDON_FLOOR_MS, 'estimate ' + String(bad) + ' produced a non-floor threshold');
  }
  // and a job carrying one is judged on the floor, not reaped instantly
  assert.equal(isAbandoned({ status: 'RUNNING', startedAt: NOW - 5 * MIN, estimateSec: 0 as any }, NOW), false);
  assert.equal(isAbandoned({ status: 'RUNNING', startedAt: NOW - 31 * MIN, estimateSec: 0 as any }, NOW), true);
});

test('finished jobs keep the old 10-minute window, exactly as before', () => {
  assert.equal(isExpired(finished(1), NOW), false);
  assert.equal(isExpired(finished(9), NOW), false);
  assert.equal(isExpired(finished(11), NOW), true);
  assert.equal(isExpired(finished(11, 'ERROR'), NOW), true);
  assert.equal(verdictFor(finished(11), NOW), 'expired');
  assert.equal(verdictFor(finished(1), NOW), '');
});

test('the two rules never both fire, and neither fires on the other kind of job', () => {
  // isExpired must ignore RUNNING (that is the abandonment question) and isAbandoned must
  // ignore finished (that is the TTL question). Crossing them is how the original bug read.
  assert.equal(isExpired(running(600), NOW), false);
  assert.equal(isAbandoned(finished(600), NOW), false);
  const stuck = running(120);
  assert.equal(verdictFor(stuck, NOW), 'abandoned');   // one verdict, never both
});

test('PURE AND NEVER THROWS: null, undefined and junk are verdicts, not exceptions', () => {
  // pruneStageJobs sweeps a live map on every poll. A throw here would take down the poll
  // endpoint for every stage at once — strictly worse than a stale row.
  for (const junk of [null, undefined, {} as any, { status: 'RUNNING' } as any, { status: 'WAT' } as any]) {
    assert.doesNotThrow(() => verdictFor(junk, NOW));
    assert.doesNotThrow(() => isExpired(junk, NOW));
    assert.doesNotThrow(() => isAbandoned(junk, NOW));
  }
  assert.equal(verdictFor(null, NOW), '');
  assert.equal(verdictFor(undefined, NOW), '');
  // a RUNNING job with no startedAt reads as epoch — old, therefore abandoned, which is safe:
  // it cannot be a live run, because a live run recorded its start.
  assert.equal(isAbandoned({ status: 'RUNNING', estimateSec: 30 } as any, NOW), true);
});

test('the message says what happened, not what a timeout would have said', () => {
  const m = abandonedMessage('SYNOPSIS', NOW - 47 * MIN, NOW);
  assert.match(m, /SYNOPSIS/);
  assert.match(m, /47 minute/);
  assert.match(m, /Nothing was written/);
  assert.doesNotMatch(m, /timed out/i);        // it did not time out; nothing was watching it
  // never reports "0 minutes", however the clock behaves
  assert.match(abandonedMessage('LOGLINE', NOW, NOW), /1 minute/);
  assert.doesNotThrow(() => abandonedMessage('', 0, NOW));
});

test('BREAK SWEEP: restoring the old rule fails this suite', () => {
  // The old pruner in one line. If someone reinstates it, these assertions are what stop them.
  const oldRuleWouldDelete = (j: StageJobLike, now: number) =>
    j.status !== 'RUNNING' && (j.finishedAt || 0) < now - FINISHED_TTL_MS;

  const stuck = running(9999);
  assert.equal(oldRuleWouldDelete(stuck, NOW), false, 'the old rule kept it');
  assert.equal(verdictFor(stuck, NOW), 'abandoned', 'the new rule reaps it');

  // and the new rule must still agree with the old one everywhere the old one was right
  for (const mins of [0, 5, 9, 10, 11, 60, 600]) {
    const f = finished(mins);
    assert.equal(isExpired(f, NOW), oldRuleWouldDelete(f, NOW), 'finished behaviour changed at ' + mins + ' min');
  }
});
