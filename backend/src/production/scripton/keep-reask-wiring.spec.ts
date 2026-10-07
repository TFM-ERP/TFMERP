/**
 * THE RE-ASK IS CONDITIONAL, AND ITS FAILURE IS NOT A VERDICT — commit 2B.2.
 * Run: npm run test:unit
 *
 * checkAgainstKeep is called through the prototype with a fake `this` (ai, prisma, log, why), so the
 * real body runs with no Nest module, no database and no model call. What matters here is not the
 * fold — 2B.1 has 55 tests on that — but the three things only the caller can get wrong:
 *
 *   it must not call twice when nothing is unproven      (an unconditional re-ask bills every run)
 *   it must call exactly once when something is          (not once per unproven thing)
 *   a thrown second call must leave the result unproven  (never a confirmation, never a promotion)
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ScripOnService } from './scripton.service';

const KEEP = 'KEEP: the brass key; the locked shed';
const BODY = 'She turned the brass key over in her palm. The shed stayed shut until morning.';

/** The first reply: item 1 claimed on words that are NOT in the body, item 2 proved. */
const FIRST_UNPROVEN = JSON.stringify({ items: [
  { item: 1, found: [{ thing: 'the brass key', quote: 'She dropped the brass key down the drain' }] },
  { item: 2, found: [{ thing: 'the locked shed', quote: 'The shed stayed shut until morning' }] },
] });
const FIRST_CLEAN = JSON.stringify({ items: [
  { item: 1, found: [{ thing: 'the brass key', quote: 'She turned the brass key over in her palm' }] },
  { item: 2, found: [{ thing: 'the locked shed', quote: 'The shed stayed shut until morning' }] },
] });

interface Run { system: string; user: string; maxTokens: number; refId: string | null }

function ctxFor(replies: (string | Error)[]) {
  const runs: Run[] = [];
  const stored: any[] = [];
  const ctx: any = {
    ai: {
      run: (args: any) => {
        runs.push({ system: args.system, user: args.user, maxTokens: args.maxTokens, refId: args.refId ?? null });
        const r = replies[runs.length - 1];
        if (r instanceof Error) return Promise.reject(r);
        return Promise.resolve({ text: r, model: 'claude-opus-5', stopReason: 'end_turn' });
      },
    },
    // the store is one tagged-template $executeRaw; it only has to resolve a positive row count
    prisma: { $executeRaw: (_s: any, ...v: any[]) => { stored.push(v); return Promise.resolve(1); } },
    log: { log: () => {}, warn: () => {} },
    why: (e: any) => String((e && e.message) || e),
  };
  return { ctx, runs, stored };
}

const run = (ctx: any) => (ScripOnService.prototype as any).checkAgainstKeep.call(ctx, 'v-1', BODY, KEEP, 'proj-1');

test('CONTROL: nothing unproven, so no second call is made', async () => {
  const { ctx, runs } = ctxFor([FIRST_CLEAN]);
  const out = await run(ctx);
  assert.equal(runs.length, 1, 'an unconditional re-ask would bill every run for a question nobody has');
  assert.equal(out.state, 'NO MISSES');
  assert.ok(!('reask' in out) || out.reask == null, 'and the row must not claim a second ask');
});

test('something unproven: exactly ONE second call, carrying only that thing', async () => {
  const reply2 = JSON.stringify({ answers: [{ n: 1, quote: 'She turned the brass key over in her palm' }] });
  const { ctx, runs } = ctxFor([FIRST_UNPROVEN, reply2]);
  const out = await run(ctx);
  assert.equal(runs.length, 2, 'one re-ask for the lot, not one per unproven thing');
  assert.match(runs[1].user, /the brass key/);
  assert.ok(!runs[1].user.includes('the locked shed'), 'the proved thing must not be re-litigated');
  assert.ok(runs[1].maxTokens < runs[0].maxTokens, 'the second ask is small and must not carry the first ceiling');
  assert.equal(out.state, 'NO MISSES', 'it quoted words that are in the draft, so the thing is proved');
  assert.equal(out.reask.proved, 1);
});

test('"not there" on the second ask turns the thing into a miss', async () => {
  const { ctx } = ctxFor([FIRST_UNPROVEN, JSON.stringify({ answers: [{ n: 1, absent: true }] })]);
  const out = await run(ctx);
  assert.equal(out.state, 'MISSES');
  assert.deepEqual(out.misses, ['the brass key']);
  assert.equal(out.reask.absent, 1);
});

test('A THROWN second call leaves it unproven and says the call failed', async () => {
  const { ctx, runs } = ctxFor([FIRST_UNPROVEN, new Error('socket hang up')]);
  const out = await run(ctx);
  assert.equal(runs.length, 2);
  assert.equal(out.state, 'UNPROVEN', 'a failed second call resolves nothing');
  assert.match(out.reask.failed, /socket hang up/);
  assert.equal(out.reask.proved, 0);
  assert.match(out.unproven[0], /second call failed/);
});

test('CONTROL: a thrown second call does not fail the whole check', async () => {
  const { ctx, stored } = ctxFor([FIRST_UNPROVEN, new Error('socket hang up')]);
  const out = await run(ctx);
  assert.notEqual(out.state, 'NOT RUN',
    'the FIRST ask produced a usable result; losing it because the second call died would be worse '
    + 'than the defect this commit fixes');
  assert.equal(stored.length, 1, 'and it is still stored');
});

test('a thrown FIRST call is still NOT RUN, and nothing is re-asked', async () => {
  const { ctx, runs } = ctxFor([new Error('timeout')]);
  const out = await run(ctx);
  assert.equal(runs.length, 1, 'there is nothing to ask about');
  assert.equal(out.state, 'NOT RUN');
  assert.match(out.reason, /^the check failed: /);
});

test('the second call is billed against this version, like the first', async () => {
  const { ctx, runs } = ctxFor([FIRST_UNPROVEN, JSON.stringify({ answers: [{ n: 1, absent: true }] })]);
  await run(ctx);
  assert.equal(runs[1].refId, 'v-1', 'an unattributed call cannot be read back off the ledger');
});

test('the result is stored exactly once, whatever the re-ask does', async () => {
  for (const second of [JSON.stringify({ answers: [{ n: 1, absent: true }] }), 'unreadable', new Error('x')]) {
    const { ctx, stored } = ctxFor([FIRST_UNPROVEN, second]);
    await run(ctx);
    assert.equal(stored.length, 1, String(second).slice(0, 20));
  }
});
