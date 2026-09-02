import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  LINES_PER_PAGE, PAGE_WEIGHTS, DEFAULT_TARGET_PAGES, MIN_TARGET_PAGES, MAX_TARGET_PAGES,
  resolveGenreProfile, briefTargetPages, planFeatureLength, snapPageWeight, applyPageWeights,
  lineBudgetFor, countVisualLines, completionRatio, isLengthComplete, expansionCandidates,
  isLengthOver, remainingBudgetScale, WORDS_PER_PAGE,
  TOKENS_PER_WORD, CAP_HEADROOM, MIN_SCENE_TOKENS, OBSERVED_OVERRUN,
  DELIVERY_FACTOR, MIN_ASK_WORDS,
  planSliceBudget, planSliceInstruction, MIN_PLAN_SLICE,
} from './feature-length.util';

test('genre resolution falls back cleanly and reads the Json genres array', () => {
  assert.equal(resolveGenreProfile(null).key, 'DEFAULT');
  assert.equal(resolveGenreProfile({}).key, 'DEFAULT');
  assert.equal(resolveGenreProfile({ genres: ['Comedy'] }).key, 'COMEDY');
  assert.equal(resolveGenreProfile({ genre: 'psychological horror' }).key, 'HORROR');
  assert.equal(resolveGenreProfile({ genres: ['تاريخي'] }).key, 'HISTORICAL');
  // action wins over historical in a "historical action epic" — scene volume drives the page maths
  assert.equal(resolveGenreProfile({ genres: ['Historical', 'Action'] }).key, 'ACTION');
});

test('target pages are read from pages, minutes or a free-text length', () => {
  assert.equal(briefTargetPages({ targetPages: 112 }, 1.1), 112);
  assert.equal(briefTargetPages({ targetMinutes: 100 }, 1.1), 110);
  assert.equal(briefTargetPages({ length: '95' }, 1.1), 95);
  assert.equal(briefTargetPages({ length: '100 min' }, 1.1), 110);
  assert.equal(briefTargetPages({ length: '90 دقيقة' }, 1.1), 99);
  assert.equal(briefTargetPages({}, 1.1), null);
});

test('planFeatureLength produces a real feature, not the old 60-scene short', () => {
  const p = planFeatureLength({});
  assert.equal(p.targetPages, DEFAULT_TARGET_PAGES);
  // the whole point: comfortably above the old ceiling of 90
  assert.ok(p.targetScenes >= 105, 'expected >=105 scenes, got ' + p.targetScenes);
  assert.ok(p.planCap > p.targetScenes);
  assert.equal(p.minPages, Math.round(DEFAULT_TARGET_PAGES * 0.9));
  assert.ok(p.targetMinutes >= 90 && p.targetMinutes <= 100);
});

test('genre changes the scene count without changing the page count', () => {
  const action = planFeatureLength({ genres: ['Action'], targetPages: 105 });
  const comedy = planFeatureLength({ genres: ['Comedy'], targetPages: 105 });
  assert.equal(action.targetPages, comedy.targetPages);
  assert.ok(action.targetScenes > comedy.targetScenes, 'action should be denser than comedy');
  assert.equal(action.targetScenes, Math.round(105 * 1.25));
  assert.equal(comedy.targetScenes, Math.round(105 * 0.93));
});

test('page targets are clamped to the feature band', () => {
  assert.equal(planFeatureLength({ targetPages: 20 }).targetPages, MIN_TARGET_PAGES);
  assert.equal(planFeatureLength({ targetPages: 400 }).targetPages, MAX_TARGET_PAGES);
});

test('beat count acts as a floor, never as the driver', () => {
  const many = planFeatureLength({ targetPages: 90 }, 140);
  assert.equal(many.targetScenes, 140, 'every beat must still be dramatised');
  const few = planFeatureLength({ targetPages: 105 }, 12);
  assert.ok(few.targetScenes > 12, 'a thin outline must not shrink the feature');
});

test('snapPageWeight lands on an allowed allocation', () => {
  for (const w of PAGE_WEIGHTS) assert.equal(snapPageWeight(w), w);
  assert.equal(snapPageWeight(0.9), 1);
  assert.equal(snapPageWeight(2.6), 3);
  assert.equal(snapPageWeight(0), 1);
  assert.equal(snapPageWeight('nonsense'), 1);
  assert.equal(snapPageWeight(undefined), 1);
});

test('applyPageWeights makes the allocations sum to the page target', () => {
  const scenes = Array.from({ length: 110 }, () => ({ pageWeight: 1 }));
  const out = applyPageWeights(scenes, 105);
  const total = out.reduce((a, s) => a + s.pageWeight, 0);
  assert.ok(Math.abs(total - 105) < 1, 'total was ' + total);
  assert.ok(out.every((s) => PAGE_WEIGHTS.includes(s.pageWeight)));
});

test('applyPageWeights preserves relative scale and survives junk input', () => {
  const scenes = [{ pageWeight: 3 }, { pageWeight: 1 }, { pageWeight: 0.25 }, {} as any, { pageWeight: 'x' } as any];
  const out = applyPageWeights(scenes, 10);
  assert.ok(out[0].pageWeight >= out[1].pageWeight, 'the set piece must stay the longest scene');
  assert.ok(out.every((s) => PAGE_WEIGHTS.includes(s.pageWeight)));
  assert.deepEqual(applyPageWeights([], 105), []);
});

test('lineBudgetFor converts pages to the line count paginate counts', () => {
  const one = lineBudgetFor(1);
  assert.equal(one.target, LINES_PER_PAGE);
  assert.ok(one.min < one.target && one.max > one.target);
  assert.equal(lineBudgetFor(2).target, 110);
  // the old prompt asked for 8-16 lines and called it a page; a quarter page is ~14
  assert.equal(lineBudgetFor(0.25).target, 14);
});

test('countVisualLines matches how paginate wraps', () => {
  assert.equal(countVisualLines(''), 1);
  assert.equal(countVisualLines('a\nb\nc'), 3);
  assert.equal(countVisualLines('x'.repeat(120)), 3);
});

test('completion gate rejects a draft that reached the ending but not the length', () => {
  assert.equal(isLengthComplete(105, 105), true);
  assert.equal(isLengthComplete(95, 105), true);
  assert.equal(isLengthComplete(70, 105), false);
  // the exact failure this fix exists to catch
  assert.equal(isLengthComplete(16, 105), false);
  assert.ok(Math.abs(completionRatio(52, 104) - 0.5) < 1e-9);
  assert.equal(completionRatio(50, 0), 1);
});

test('expansionCandidates ranks the worst underdelivery first', () => {
  const written = [
    { text: 'x\n'.repeat(55), pageWeight: 1 },   // on budget
    { text: 'x\n'.repeat(10), pageWeight: 2 },   // 100 short
    { text: 'x\n'.repeat(30), pageWeight: 1 },   // 25 short
  ];
  const rows = expansionCandidates(written);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].index, 1);
  assert.equal(rows[1].index, 2);
  assert.ok(rows[0].shortfall > rows[1].shortfall);
  assert.equal(expansionCandidates(written, 1).length, 1);
});

test('lineBudgetFor gives a word budget and a token cap that can actually bind', () => {
  const one = lineBudgetFor(1);
  assert.equal(one.wordsBudget, WORDS_PER_PAGE);
  assert.ok(one.wordsMax > one.wordsAsk && one.wordsMin < one.wordsAsk);
  // the old cap was b.max*34+600 = 2844 for one page, ~5x the ~500 a page needs
  assert.ok(one.maxTokens < 1200, 'one-page cap was ' + one.maxTokens);
  assert.ok(one.maxTokens > one.wordsBudget, 'must still leave room to finish the scene');
  assert.ok(lineBudgetFor(3).maxTokens > one.maxTokens, 'a set piece needs more room');
});

test('remainingBudgetScale pulls a hot run back onto target', () => {
  // exactly on plan -> no change
  assert.ok(Math.abs(remainingBudgetScale(105, 50, 55) - 1) < 1e-9);
  // 40% over at the halfway mark -> the remaining scenes tighten
  assert.ok(remainingBudgetScale(105, 70, 55) < 1);
  // running short -> the remaining scenes get more room
  assert.ok(remainingBudgetScale(105, 30, 55) > 1);
  // already past target -> floor, so it stops digging
  assert.equal(remainingBudgetScale(105, 130, 20), 0.25);
  // clamped both ways, and safe on junk
  assert.ok(remainingBudgetScale(105, 0, 1) <= 2);
  assert.equal(remainingBudgetScale(105, 10, 0), 1);
  assert.equal(remainingBudgetScale(0, 10, 10), 1);
});

test('the gate rejects a draft that runs LONG, not just one that runs short', () => {
  assert.equal(isLengthOver(105, 105), false);
  assert.equal(isLengthOver(120, 105), false);   // inside the 115% tolerance
  assert.equal(isLengthOver(190, 105), true);    // the run that prompted this fix
  assert.equal(isLengthComplete(190, 105), true, 'long drafts still clear the FLOOR - hence the ceiling');
});

test('the cap NEVER truncates: it sits above what the model actually writes', () => {
  // The rule this encodes: max_tokens is not a budget the model negotiates with, it is where the
  // API stops emitting — mid-word if that is where the count lands. A cap set to the INTENDED
  // output truncates every scene the model writes long, and the 31 Aug draft ran OBSERVED_OVERRUN
  // (1.67x) over budget at every weight. So the guard is sized against real delivery, not intent.
  for (const w of PAGE_WEIGHTS) {
    const b = lineBudgetFor(w);
    const observed = b.wordsBudget * TOKENS_PER_WORD * OBSERVED_OVERRUN;   // what the model actually produces
    assert.ok(b.maxTokens > observed * 1.4,
      'weight ' + w + ': cap ' + b.maxTokens + ' is only ' + (b.maxTokens / observed).toFixed(2)
      + 'x the observed output — it will truncate scenes mid-speech');
  }
});

test('the cap is still a guard, not an open tap', () => {
  // It must stop a genuine runaway, and must not be looser than the formula it replaced.
  for (const w of PAGE_WEIGHTS) {
    const b = lineBudgetFor(w);
    const oldCap = Math.max(700, Math.round(w * 700) + 300);
    assert.ok(b.maxTokens < oldCap, 'weight ' + w + ': cap ' + b.maxTokens + ' is looser than the old ' + oldCap);
    assert.ok(b.maxTokens < b.wordsBudget * TOKENS_PER_WORD * 4,
      'weight ' + w + ': cap is more than 4x the intended output — that is not a guard');
  }
});

test('the cap is derived from the word budget, so it cannot drift away from it', () => {
  // The regression this guards: someone retunes WORDS_PER_PAGE and the ceiling silently stops matching.
  for (const w of PAGE_WEIGHTS) {
    const b = lineBudgetFor(w);
    assert.equal(b.maxTokens, Math.max(MIN_SCENE_TOKENS, Math.round(b.wordsBudget * TOKENS_PER_WORD * CAP_HEADROOM) + 48));
  }
  // A floor that binds is exactly the bug this rewrite removed — it must sit below the smallest derived cap.
  assert.ok(MIN_SCENE_TOKENS < lineBudgetFor(PAGE_WEIGHTS[0]).maxTokens,
    'MIN_SCENE_TOKENS ' + MIN_SCENE_TOKENS + ' is binding at the smallest weight');
});

test('WORDS_PER_PAGE is the measured figure, not the optimistic one', () => {
  // 190 was an 18% overshoot baked into the arithmetic: it converted a page allocation into more
  // words than a page can physically hold. Measured on the 31 Aug draft: 203,837 chars / 207 pages
  // = 985 chars per page, at 6.11 chars per word = 161 words per page.
  assert.ok(WORDS_PER_PAGE <= 170, 'WORDS_PER_PAGE ' + WORDS_PER_PAGE + ' is above the measured ~161');
  assert.ok(WORDS_PER_PAGE >= 150, 'below ~150 the budget starves scenes');
  // The page budget must also land inside the WORD band for a feature, not just the page band.
  const words = DEFAULT_TARGET_PAGES * WORDS_PER_PAGE;
  assert.ok(words >= 7500 && words <= 20000,
    DEFAULT_TARGET_PAGES + ' pages x ' + WORDS_PER_PAGE + ' = ' + words + ' words, outside the 7,500-20,000 feature band');
});

test('the model is asked for LESS than the budget, because it delivers more', () => {
  // The 31 Aug draft came back 1.61x over its word budget while tracking the budget's direction
  // perfectly (bimodal output, one cluster per page allocation). So the lever is the ask, not a cap.
  for (const w of PAGE_WEIGHTS) {
    const b = lineBudgetFor(w);
    assert.ok(b.wordsAsk < b.wordsBudget || b.wordsAsk === MIN_ASK_WORDS,
      'weight ' + w + ': asking for ' + b.wordsAsk + ' against a budget of ' + b.wordsBudget + ' — the discount is missing');
    // What we expect back is the ask times the measured factor; it must land on the budget.
    if (b.wordsAsk > MIN_ASK_WORDS) {
      const expected = b.wordsAsk * DELIVERY_FACTOR;
      assert.ok(Math.abs(expected - b.wordsBudget) / b.wordsBudget < 0.02,
        'weight ' + w + ': ask x factor = ' + Math.round(expected) + ', budget = ' + b.wordsBudget);
    }
  }
});

test('the prompt bounds bracket the ASK, never the budget', () => {
  // Quoting wordsMax off the budget would hand back exactly the headroom the division removed —
  // "aim for 103 words but do not exceed 206" is not a constraint.
  for (const w of PAGE_WEIGHTS) {
    const b = lineBudgetFor(w);
    assert.ok(b.wordsMin < b.wordsAsk && b.wordsAsk < b.wordsMax, 'weight ' + w + ': bounds do not bracket the ask');
    assert.ok(b.wordsMax < b.wordsBudget * 1.05,
      'weight ' + w + ': wordsMax ' + b.wordsMax + ' is at or above the budget ' + b.wordsBudget + ' — no discount survives');
  }
});

test('a whole feature, asked and delivered, lands inside the word band', () => {
  // 105 pages at the current constants, if the model delivers at DELIVERY_FACTOR.
  const delivered = DEFAULT_TARGET_PAGES * WORDS_PER_PAGE;
  assert.ok(delivered >= 7500 && delivered <= 20000, delivered + ' words is outside 7,500-20,000');
  // And the ask that produces it must not be absurdly small at any allocation.
  for (const w of PAGE_WEIGHTS) assert.ok(lineBudgetFor(w).wordsAsk >= MIN_ASK_WORDS);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLANNER SLICE BUDGET
// Built around the 1 Sep plan: ACTION, 105 pages, target 131 scenes, PLAN_CHUNK 40 — and the planner
// returned 80, because slice two was invited to end the film and did.
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('the slice that ended the film early is now forbidden from ending it', () => {
  // Where the 1 Sep run was when it wrapped the story up: 40 scenes mapped, 91 still to go.
  const s = planSliceBudget(40, 131, 40, 33, 105);
  assert.equal(s.from, 41);
  assert.equal(s.ask, 40);
  assert.equal(s.after, 51);
  assert.equal(s.isFinal, false, 'scene 80 of 131 is not the end of the film');
  const text = planSliceInstruction(s);
  assert.match(text, /NOT the end of the film/);
  assert.match(text, /Do NOT dramatise the climax/);
  assert.match(text, /51 more scenes come after this slice/);
  assert.doesNotMatch(text, /MUST end the film/);
  // the invitation that caused it must be gone from the vocabulary entirely
  assert.doesNotMatch(text, /stop there/);
});

test('the last slice is the one that carries the climax, and it is told so', () => {
  const s = planSliceBudget(100, 131, 40, 82, 105);
  assert.equal(s.isFinal, true);
  assert.equal(s.from, 101);
  assert.equal(s.ask, 39, '31 remaining plus the tail headroom, capped by the chunk');
  const text = planSliceInstruction(s);
  assert.match(text, /LAST slice/);
  assert.match(text, /MUST dramatise the climax AND the final resolution/);
  assert.match(text, /About 23 pages remain/);
  assert.doesNotMatch(text, /NOT the end of the film/);
});

test('walking a whole 131-scene plan, exactly one slice may end the film — and it is the last', () => {
  let mapped = 0;
  const finals: number[] = [];
  const passes: number[] = [];
  for (let i = 0; i < 12 && mapped < 131; i++) {
    const s = planSliceBudget(mapped, 131, 40, mapped * 0.8, 105);
    passes.push(s.ask);
    if (s.isFinal) finals.push(i);
    // every non-final slice must refuse to end; the final one must demand it
    const text = planSliceInstruction(s);
    assert.equal(/MUST end the film/.test(text), s.isFinal, 'pass ' + i + ' disagrees with itself');
    mapped += s.ask;
  }
  assert.equal(finals.length, 1, 'exactly one slice is allowed to end the story');
  assert.equal(finals[0], passes.length - 1, 'and it is the last one');
  assert.ok(mapped >= 131, 'the walk actually reaches the target: ' + mapped);
  assert.ok(passes.length <= 5, '131 scenes at 40 a slice is four or five calls, not eight: ' + passes.length);
});

test('a barren pass provokes a correction instead of counting down to giving up', () => {
  const s = planSliceBudget(80, 131, 40, 88, 105);
  const quiet = planSliceInstruction(s, false);
  const stalled = planSliceInstruction(s, true);
  assert.doesNotMatch(quiet, /added NO new scenes/);
  assert.match(stalled, /added NO new scenes/);
  assert.match(stalled, /51 scenes of it are still unmapped/);
  assert.match(stalled, /continue past it/);
});

test('a series pilot has no page plan, and is not told it has zero pages', () => {
  const s = planSliceBudget(0, 24, 40, 0, 0);
  assert.equal(s.totalPages, 0);
  assert.equal(s.isFinal, true, '24 scenes fits in one slice');
  const text = planSliceInstruction(s);
  assert.doesNotMatch(text, /0 pages/);
  assert.doesNotMatch(text, /pages remain/);
  assert.match(text, /24 scenes mapped|0 of 24 scenes mapped/);
});

test('the ask stays inside its bounds whatever it is handed', () => {
  assert.equal(planSliceBudget(0, 131, 40, 0, 105).ask, 40, 'never more than the chunk');
  assert.equal(planSliceBudget(130, 131, 40, 104, 105).ask, 9, 'one scene left plus the tail headroom — never a 1-scene afterthought');
  assert.equal(planSliceBudget(131, 131, 40, 105, 105).ask, MIN_PLAN_SLICE, 'and never below the floor');
  assert.equal(planSliceBudget(200, 131, 40, 160, 105).ask, MIN_PLAN_SLICE, 'already over target');
  assert.equal(planSliceBudget(200, 131, 40, 160, 105).after, 0);
  // junk in, sane out — this runs inside a generation and must never throw or emit NaN
  for (const s of [planSliceBudget(null, null, null, null, null), planSliceBudget('x', 'y', 'z', 'w', 'v'), planSliceBudget(-5, -5, -5, -5, -5)]) {
    assert.ok(Number.isFinite(s.ask) && s.ask >= MIN_PLAN_SLICE, 'ask is a real number');
    assert.ok(Number.isFinite(s.progress) && s.progress >= 0 && s.progress <= 1);
    assert.ok(!/NaN|undefined|null/.test(planSliceInstruction(s)), 'the prompt never carries junk to the model');
  }
});

test('progress is reported against the plan, not against the pages already written', () => {
  const s = planSliceBudget(66, 131, 40, 53, 105);
  assert.equal(s.progress, 66 / 131);
  assert.equal(s.progressAfter, 106 / 131);
  assert.match(planSliceInstruction(s), /50% of the film/);
  assert.match(planSliceInstruction(s), /about 53 of its 105 pages/);
  assert.match(planSliceInstruction(s), /from about 50% to about 81% of the outline/);
});
