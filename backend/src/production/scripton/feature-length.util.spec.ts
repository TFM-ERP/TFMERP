import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  LINES_PER_PAGE, PAGE_WEIGHTS, DEFAULT_TARGET_PAGES, MIN_TARGET_PAGES, MAX_TARGET_PAGES,
  resolveGenreProfile, briefTargetPages, planFeatureLength, snapPageWeight, applyPageWeights,
  lineBudgetFor, countVisualLines, completionRatio, isLengthComplete, expansionCandidates,
  FORMAT_BANDS, resolveFormatBand, resolveTexture, effectiveSceneDensity, pagesPerSceneFloor,
  sceneCeilingFor, PRODUCED_TEXTURE_FACTOR, MIN_PLANNED_SCENES,
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

test('planFeatureLength produces a real feature — at PRODUCED texture, not spec-competition density', () => {
  const p = planFeatureLength({});
  assert.equal(p.targetPages, DEFAULT_TARGET_PAGES);
  // THIS ASSERTION USED TO READ `>= 105`, and that number was the defect. It encoded the Follows
  // SPEC corpus (0.96 pages per scene) as the definition of "a real feature". The ScriptBase
  // PRODUCED corpus measures ~80 scenes over ~110 pages, so a 105-page drama is ~76 scenes.
  assert.equal(p.texture, 'PRODUCED');
  assert.ok(p.targetScenes >= 70 && p.targetScenes <= 85, 'expected produced density, got ' + p.targetScenes);
  assert.ok(p.pagesPerScene > 1.2, 'a scene should average over a page, got ' + p.pagesPerScene);
  assert.ok(p.planCap > p.targetScenes);
  assert.equal(p.minPages, Math.round(DEFAULT_TARGET_PAGES * 0.9));
  assert.ok(p.targetMinutes >= 90 && p.targetMinutes <= 100);
});

test('genre changes the scene count without changing the page count', () => {
  const action = planFeatureLength({ genres: ['Action'], targetPages: 105 });
  const comedy = planFeatureLength({ genres: ['Comedy'], targetPages: 105 });
  assert.equal(action.targetPages, comedy.targetPages);
  assert.ok(action.targetScenes > comedy.targetScenes, 'action should be denser than comedy');
  // Floored, not rounded — it is a ceiling — and damped by the produced-texture factor.
  assert.equal(action.targetScenes, Math.floor(105 * 1.25 * PRODUCED_TEXTURE_FACTOR));   // 91
  assert.equal(comedy.targetScenes, Math.floor(105 * 0.93 * PRODUCED_TEXTURE_FACTOR));   // 68
});

test('the ceiling lands on the produced corpus, which is the evidence it is right', () => {
  // ScriptBase measured, scaled from its ~110-page average to 105 pages, against what we now plan:
  //   ACTION 97 vs 91 · THRILLER 88 vs 84 · DRAMA 76 vs 76 · COMEDY 63 vs 68
  const at = (g: string) => planFeatureLength({ genres: [g], targetPages: 105 }).targetScenes;
  assert.equal(at('Action'), 91);
  assert.equal(at('Thriller'), 84);
  assert.equal(at('Drama'), 76);
  assert.equal(at('Comedy'), 68);
});

test('SPEC texture restores the old numbers exactly — the switch is honest in both directions', () => {
  const spec = planFeatureLength({ genres: ['Action'], targetPages: 105, texture: 'SPEC' });
  assert.equal(spec.texture, 'SPEC');
  assert.equal(spec.targetScenes, Math.floor(105 * 1.25));   // 131 — the number that fragmented
  assert.ok(spec.pagesPerScene < 0.85);
});

test('the floor is the density inverted, and it is what a reader actually feels', () => {
  assert.equal(pagesPerSceneFloor(1.25, 'PRODUCED'), 1.14);
  assert.equal(pagesPerSceneFloor(1.25, 'SPEC'), 0.8);
  assert.ok(effectiveSceneDensity(1.25, 'PRODUCED') < effectiveSceneDensity(1.25, 'SPEC'));
});

test('a ceiling is floored and never collapses to nothing', () => {
  assert.equal(sceneCeilingFor(105, 1.04, 'PRODUCED'), 76);
  assert.equal(sceneCeilingFor(0, 1.04, 'PRODUCED'), MIN_PLANNED_SCENES);
  assert.equal(sceneCeilingFor(1, 1.04, 'PRODUCED'), MIN_PLANNED_SCENES);
});

test('page targets are clamped to the feature band', () => {
  assert.equal(planFeatureLength({ targetPages: 20 }).targetPages, MIN_TARGET_PAGES);
  assert.equal(planFeatureLength({ targetPages: 400 }).targetPages, MAX_TARGET_PAGES);
});

test('beats no longer force scenes — they are folded, and the pages keep authority', () => {
  // THIS TEST USED TO ASSERT `many.targetScenes === 140`. A 140-beat outline over 90 pages is 0.64
  // pages per scene, and the planner obeyed. Beats can share a scene, and over a fixed page budget
  // they must; coverage is a promise about the STORY, not about the scene count.
  const many = planFeatureLength({ targetPages: 90 }, 140);
  assert.ok(many.targetScenes < 140, 'the outline must not dictate the scene count');
  assert.equal(many.targetScenes, sceneCeilingFor(90, many.sceneDensity, 'PRODUCED'));
  assert.ok(many.beatsPerScene > 2, 'the planner is told how much to fold: ' + many.beatsPerScene);

  const few = planFeatureLength({ targetPages: 105 }, 12);
  assert.ok(few.targetScenes > 12, 'a thin outline must not shrink the feature either');
  assert.ok(few.beatsPerScene < 1, 'and folding is not asked for when there is nothing to fold');

  assert.equal(planFeatureLength({ targetPages: 105 }).beatsPerScene, 0, 'no outline, no claim');
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
  // 120 USED to pass here: 120/105 = 1.14, inside the 115% ratio. It no longer does, because 115
  // is the top of the band whatever the target was — the ratio is not the only ceiling any more.
  assert.equal(isLengthOver(120, 105), true);
  assert.equal(isLengthOver(114, 105), false);  // still inside both the ratio and the band
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
  // = 985 chars per page, at 6.11 chars per word = 161 words per page — on A4.
  // Re-fitted 2 Sep for US Letter, whose text column is 9in against A4's 9.96in:
  //   985 x (9 / 9.96) = 890 chars/page, / 6.11 = 146 words per page.
  assert.ok(WORDS_PER_PAGE <= 155, 'WORDS_PER_PAGE ' + WORDS_PER_PAGE + ' is above the measured ~146 for US Letter');
  assert.ok(WORDS_PER_PAGE >= 135, 'below ~135 the budget starves scenes');
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

// ─── the feature band: 90 to 115 ────────────────────────────────────────────────────────────

test('the band is 90 to 115 and a target outside it is pulled back in', () => {
  assert.equal(MIN_TARGET_PAGES, 90);
  assert.equal(MAX_TARGET_PAGES, 115);
  assert.equal(planFeatureLength({ targetPages: 60 }).targetPages, 90);
  assert.equal(planFeatureLength({ targetPages: 200 }).targetPages, 115);
  assert.equal(planFeatureLength({ targetPages: 97 }).targetPages, 97);
});

test('no target and no ratio can carry a draft past the top of the band', () => {
  // The old ceiling was purely relative, so the longest allowed target dragged it with it.
  assert.equal(isLengthOver(132, 115), true);
  assert.equal(isLengthOver(116, 115), true);
  assert.equal(isLengthOver(115, 115), false);
});

test('an explicit page target beats the genre default, in either direction', () => {
  assert.equal(planFeatureLength({ genres: ['Thriller'], targetPages: 112 }).targetPages, 112);
  assert.equal(planFeatureLength({ genres: ['Drama'], targetPages: 92 }).targetPages, 92);
});

test('a runtime in minutes still works, and is read through the genre page rate', () => {
  // 100 minutes of thriller at 1.02 pages/minute is a 102-page script.
  assert.equal(planFeatureLength({ genres: ['Thriller'], targetMinutes: 100 }).targetPages, 102);
  assert.equal(planFeatureLength({ genres: ['Drama'], runtimeMinutes: 95 }).targetPages, 106);
});

test('THE DEFECT: two unrelated films no longer collect the same default', () => {
  // MINUTEMEN (thriller) and a drama both fell through to 105 and delivered 100 and 103 pages.
  const thriller = planFeatureLength({ genres: ['Thriller'] }).targetPages;
  const drama = planFeatureLength({ genres: ['Drama'] }).targetPages;
  const action = planFeatureLength({ genres: ['Action'] }).targetPages;
  const romance = planFeatureLength({ genres: ['Romance'] }).targetPages;
  assert.notEqual(thriller, drama);
  assert.notEqual(action, drama);
  assert.notEqual(romance, drama);
  for (const p of [thriller, drama, action, romance]) {
    assert.ok(p >= MIN_TARGET_PAGES && p <= MAX_TARGET_PAGES, 'default ' + p + ' left the band');
  }
});

test('every genre default sits inside the band', () => {
  for (const g of ['Action', 'Thriller', 'Comedy', 'Drama', 'Horror', 'Historical', 'Romance', 'Fantasy', 'Sci-Fi', 'Musical', 'Western']) {
    const p = planFeatureLength({ genres: [g] }).targetPages;
    assert.ok(p >= MIN_TARGET_PAGES && p <= MAX_TARGET_PAGES, g + ' defaulted to ' + p);
  }
});

// ─── format bands: a short film is not a ninety-page feature ────────────────────────────────

test('a MOVIE gets the feature band and the genre default', () => {
  const band = resolveFormatBand({ projectType: 'MOVIE' });
  assert.equal(band.key, 'FEATURE');
  assert.equal(band.defaultPages, null, 'a feature lets the genre decide');
  assert.equal(planFeatureLength({ projectType: 'MOVIE', genres: ['Drama'] }).targetPages, 108);
});

test('THE DEFECT: a short film was silently planned as a ninety-page feature', () => {
  const p = planFeatureLength({ projectType: 'SHORT', genres: ['Drama'] });
  assert.equal(p.formatKey, 'SHORT');
  assert.equal(p.targetPages, 12, 'the short band decides, not the genre default of 108');
  assert.ok(p.targetPages < MIN_TARGET_PAGES, 'and the feature floor must not drag it back up');
  assert.ok(p.targetScenes >= MIN_PLANNED_SCENES && p.targetScenes < 20);
});

test('a short still honours an explicit length, inside its own band', () => {
  assert.equal(planFeatureLength({ projectType: 'SHORT', targetPages: 25 }).targetPages, 25);
  assert.equal(planFeatureLength({ projectType: 'SHORT', targetMinutes: 20 }).targetPages, 22);
  assert.equal(planFeatureLength({ projectType: 'SHORT', targetPages: 300 }).targetPages, 40);
  assert.equal(planFeatureLength({ projectType: 'SHORT', targetPages: 1 }).targetPages, 3);
});

test('an unknown or missing project type is a feature, never a crash', () => {
  assert.equal(resolveFormatBand(null).key, 'FEATURE');
  assert.equal(resolveFormatBand({ projectType: 'WHAT' }).key, 'FEATURE');
  assert.equal(resolveFormatBand({}).key, 'FEATURE');
  assert.equal(planFeatureLength({ projectType: 'WHAT' }).targetPages, DEFAULT_TARGET_PAGES);
});

test('every band is internally coherent', () => {
  for (const k of Object.keys(FORMAT_BANDS)) {
    const b = FORMAT_BANDS[k];
    assert.ok(b.minPages > 0 && b.minPages < b.maxPages, k + ' band is inverted');
    if (b.defaultPages !== null) {
      assert.ok(b.defaultPages >= b.minPages && b.defaultPages <= b.maxPages, k + ' default sits outside its own band');
    }
  }
});

test('texture defaults to PRODUCED and only SPEC by name', () => {
  assert.equal(resolveTexture({}), 'PRODUCED');
  assert.equal(resolveTexture(null), 'PRODUCED');
  assert.equal(resolveTexture({ texture: 'spec' }), 'SPEC');
  assert.equal(resolveTexture({ texture: 'PRODUCED' }), 'PRODUCED');
  assert.equal(resolveTexture({ texture: 'anything else' }), 'PRODUCED');
});
