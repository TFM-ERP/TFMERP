import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { yearsToDays, daysToYears, DAYS_PER_YEAR } from './era.util';

test('a decade is 3652.5 days, so ten years is a tie — and ties round AWAY from zero', () => {
  assert.equal(DAYS_PER_YEAR, 365.25);
  assert.equal(yearsToDays(10), 3653);
  assert.equal(yearsToDays(-10), -3653);
  assert.equal(yearsToDays(30), 10958);
  assert.equal(yearsToDays(-30), -10958);
  assert.equal(yearsToDays(20), 7305);
  assert.equal(yearsToDays(-20), -7305);
  assert.equal(yearsToDays(-7), -2557);
  assert.equal(yearsToDays(-15), -5479);
  assert.equal(yearsToDays(1.5), 548);
  assert.equal(yearsToDays(-1.5), -548);
  assert.equal(yearsToDays(0), 0);
});

test('Math.round alone would split a symmetric pair — the guard is the sign handling', () => {
  assert.equal(Math.round(-10 * DAYS_PER_YEAR), -3652);
  assert.notEqual(yearsToDays(-10), Math.round(-10 * DAYS_PER_YEAR));
  assert.equal(Math.abs(yearsToDays(10)), Math.abs(yearsToDays(-10)));
});

test('yearsToDays never throws on junk', () => {
  assert.equal(yearsToDays(NaN), 0);
  assert.equal(yearsToDays(Infinity), 0);
  assert.equal(yearsToDays(null as any), 0);
});

test('daysToYears is the exported inverse, and round-trips with yearsToDays', () => {
  for (const n of [-3000, -100, -20, -7, 0, 7, 25, 150]) {
    assert.equal(daysToYears(yearsToDays(n)), n);
  }
  assert.equal(daysToYears(NaN), 0);
});

import { wordsToNumber } from './era.util';

test('word numbers, including tens+unit and hundreds', () => {
  assert.equal(wordsToNumber('seven'), 7);
  assert.equal(wordsToNumber('Seventeen'), 17);
  assert.equal(wordsToNumber('twenty-seven'), 27);
  assert.equal(wordsToNumber('twenty seven'), 27);
  assert.equal(wordsToNumber('three hundred'), 300);
  assert.equal(wordsToNumber('three hundred and fifty'), 350);
  assert.equal(wordsToNumber('two thousand'), 2000);
  assert.equal(wordsToNumber('a'), 1);
  assert.equal(wordsToNumber('18'), 18);
});

test('an unknown token refuses the whole phrase rather than scoring the part it understood', () => {
  assert.equal(wordsToNumber('seven-odd'), null);
  assert.equal(wordsToNumber('several'), null);
  assert.equal(wordsToNumber(''), null);
  assert.equal(wordsToNumber(null as any), null);
});

import { parseEraPhrase } from './era.util';

test('the spec table, phrase by phrase', () => {
  assert.deepEqual(parseEraPhrase('Twenty years before the film'), { from: -7305, to: -7305 });
  assert.deepEqual(parseEraPhrase('Fifteen to ten years before the film'), { from: -5479, to: -3653 });
  assert.deepEqual(parseEraPhrase('about seven years ago'), { from: -2557, to: -2557 });
  assert.deepEqual(parseEraPhrase('18 months before the story'), { from: -548, to: -548 });
  assert.deepEqual(parseEraPhrase('the present'), { from: 0, to: 0 });
  assert.deepEqual(parseEraPhrase('now'), { from: 0, to: 0 });
});

test('a range is tried BEFORE a single, or the span silently narrows to its later bound', () => {
  const r = parseEraPhrase('fifteen to ten years ago');
  assert.deepEqual(r, { from: -5479, to: -3653 });
  assert.notDeepEqual(r, parseEraPhrase('ten years ago'));
  assert.deepEqual(parseEraPhrase('10-15 years ago'), { from: -5479, to: -3653 });
});

test('hedges are discarded, so "about seven" and "seven" are ONE timeline', () => {
  assert.deepEqual(parseEraPhrase('about seven years ago'), parseEraPhrase('seven years ago'));
  assert.deepEqual(parseEraPhrase('roughly seven years ago'), parseEraPhrase('seven years ago'));
  assert.deepEqual(parseEraPhrase('some seven years ago'), parseEraPhrase('seven years ago'));
});

test('"seven" and "eight" stay two timelines — merging is the author\'s call, not ours', () => {
  assert.notDeepEqual(parseEraPhrase('seven years ago'), parseEraPhrase('eight years ago'));
});

test('flash-forwards are the same shape with the sign flipped', () => {
  assert.deepEqual(parseEraPhrase('three years later'), { from: 1096, to: 1096 });
  assert.deepEqual(parseEraPhrase('two decades hence'), { from: 7305, to: 7305 });
});

test('every unit converts through the one constant', () => {
  assert.deepEqual(parseEraPhrase('ten days ago'), { from: -10, to: -10 });
  assert.deepEqual(parseEraPhrase('three weeks ago'), { from: -21, to: -21 });
  assert.deepEqual(parseEraPhrase('three centuries ago'), { from: -109575, to: -109575 });
});

test('a measured wait is a duration, not a date — "before" must point at the story', () => {
  assert.equal(parseEraPhrase('seven years before speaking'), null);
  assert.equal(parseEraPhrase('two years before the wedding'), null);
  assert.deepEqual(parseEraPhrase('seven years before the film'), { from: -2557, to: -2557 });
  assert.deepEqual(parseEraPhrase('seven years before, in Cairo'), { from: -2557, to: -2557 });
  assert.deepEqual(parseEraPhrase('seven years ago in Cairo'), { from: -2557, to: -2557 });
});

test('an unresolvable phrase returns null and never a confident number', () => {
  assert.equal(parseEraPhrase('several years ago'), null);
  assert.equal(parseEraPhrase('a long time ago'), null);
  assert.equal(parseEraPhrase('in the old days'), null);
  assert.equal(parseEraPhrase(''), null);
  assert.equal(parseEraPhrase(null as any), null);
});

test('the dating object may arrive inline or separately, and they agree', () => {
  assert.deepEqual(parseEraPhrase('seven years before', ' the film'), { from: -2557, to: -2557 });
  assert.deepEqual(parseEraPhrase('seven years before the film'), parseEraPhrase('seven years before', ' the film'));
  assert.equal(parseEraPhrase('seven years before', ' speaking'), null);
});

test('object-taking tails (before, prior, ahead) refuse a non-story object and resolve a story one', () => {
  assert.equal(parseEraPhrase('three years prior to the divorce'), null);
  assert.equal(parseEraPhrase('two years ahead of the wedding'), null);
  assert.deepEqual(parseEraPhrase('three years prior to the film'), { from: -1096, to: -1096 });
  assert.deepEqual(parseEraPhrase('two years ahead of the film'), { from: 731, to: 731 });
  assert.deepEqual(parseEraPhrase('seven years prior, in Cairo'), { from: -2557, to: -2557 });
  assert.deepEqual(parseEraPhrase('two years ahead'), { from: 731, to: 731 });
});

test('zero years is a real answer, not a falsy sign artifact — no negative zero', () => {
  assert.deepEqual(parseEraPhrase('zero years ago'), { from: 0, to: 0 });
});

test('a story word only dates when the clause ends there', () => {
  assert.equal(parseEraPhrase('three years prior to the story he told her'), null);
  assert.equal(parseEraPhrase('three years prior to the present he gave her'), null);
  assert.equal(parseEraPhrase('two years ahead of the series he was watching'), null);
  assert.equal(parseEraPhrase('ten years before the filming of the wedding video'), null);
  assert.equal(parseEraPhrase('seven years before nowhere near the house'), null);
  assert.equal(parseEraPhrase('seven years before that morning'), null);
  assert.deepEqual(parseEraPhrase('twenty years before the film'), { from: -7305, to: -7305 });
  assert.deepEqual(parseEraPhrase('18 months before the story'), { from: -548, to: -548 });
});

import { parseYear } from './era.util';

test('a bare year becomes an offset from the frozen present', () => {
  assert.deepEqual(parseYear('2019', 2026), { from: -2557, to: -2557 });
  assert.deepEqual(parseYear('2026', 2026), { from: 0, to: 0 });
  assert.deepEqual(parseYear('2030', 2026), { from: 1461, to: 1461 });
});

test('BC is stored astronomically (1 - n) — there is no year zero', () => {
  assert.deepEqual(parseYear('1 BC', 1), { from: -365, to: -365 });   // 1 BC is ONE year before AD 1
  assert.deepEqual(parseYear('2 BC', 1), { from: -731, to: -731 });   // and 2 BC is two, not three
  assert.deepEqual(parseYear('500 BC', 500), { from: -364885, to: -364885 });
  assert.deepEqual(parseYear('500 BCE', 500), parseYear('500 BC', 500));
  assert.deepEqual(parseYear('500 AD', 500), { from: 0, to: 0 });
});

test('a number that is not a plausible year is refused rather than dated', () => {
  assert.equal(parseYear('300', 2026), null);
  assert.equal(parseYear('9999', 2026), null);
  assert.equal(parseYear('', 2026), null);
  assert.equal(parseYear('2019', NaN), null);
});

test('the plausible band disambiguates a BARE number - a marked era needs no guard', () => {
  // A bare 300 in a screenplay is far more likely a count than a date, so it is refused.
  assert.equal(parseYear('300', 2026), null);
  assert.equal(parseYear('9999', 2026), null);
  // Marked eras are unambiguously years, and deep time is legitimate: One Million Years B.C.
  assert.notEqual(parseYear('300 BC', 2026), null);
  assert.notEqual(parseYear('9999 BC', 2026), null);
  assert.notEqual(parseYear('3000 AD', 2026), null);
  // The band's exact edges, so an off-by-one at the boundary cannot pass unnoticed.
  assert.equal(parseYear('999', 2026), null);
  assert.notEqual(parseYear('1000', 2026), null);
  assert.notEqual(parseYear('2999', 2026), null);
  assert.equal(parseYear('3000', 2026), null);
});

test('the plausible band tests the WRITTEN SHAPE too, not the value alone', () => {
  // Found unpinned by the break sweep: drop the four-digit shape test and all 295 still passed,
  // because every case in the suite that reaches the band is already written as four digits. The
  // band ALONE asks only "is this value between 1000 and 2999" - and a word numeral or a
  // comma-grouped count both answer yes while naming no year whatsoever.
  assert.equal(parseYear('two thousand', 2026), null);   // without the shape test: -9497
  assert.equal(parseYear('1,500', 2026), null);          // without the shape test: -192122
  // A year genuinely written as four digits is untouched, so this refuses only the wrong shapes.
  assert.deepEqual(parseYear('1994', 2026), { from: -11688, to: -11688 });
});

import { sweepEras } from './era.util';

test('the sweep finds every stratum in a real passage, in order', () => {
  const material = [
    'Twenty years before the film, Vex buys the boy.',
    'Fifteen to ten years before, he is educated in Cairo.',
    'About seven years ago Jason vanished.',
    'The present day: Jason walks into the bar.',
  ].join('\n');
  const hits = sweepEras(material, 2026);
  const offs = hits.map((h) => h.offset);
  assert.deepEqual(offs, [
    { from: -7305, to: -7305 },
    { from: -5479, to: -3653 },
    { from: -2557, to: -2557 },
    { from: 0, to: 0 },
  ]);
  assert.ok(hits.every((h) => material.slice(h.start, h.end).trim() === h.text));
});

test('a phrase anchored to a DATE is captured unresolved, beside the date it needs', () => {
  const hits = sweepEras('Seven years before 1994 he left.', 2026);
  assert.equal(hits.length, 2);
  assert.equal(hits[0].text, 'Seven years before');   // the span is the dating words, nothing more
  assert.equal(hits[0].offset, null);                 // "before 1994" is not "before the present"
  assert.deepEqual(hits[1].offset, { from: -11688, to: -11688 });  // 1994, which pass two will use
});

test('a phrase and the bare year it sits beside never overlap', () => {
  const hits = sweepEras('Seven years ago, in 1994, he left.', 2026);
  assert.equal(hits.length, 2);
  assert.deepEqual(hits[0].offset, { from: -2557, to: -2557 });
  assert.deepEqual(hits[1].offset, { from: -11688, to: -11688 });
});

test('material with no temporal language yields nothing — the commonest case costs nothing', () => {
  assert.deepEqual(sweepEras('INT. SILO - DAY\n\nCROSS waits. Nothing happens.', 2026), []);
  assert.deepEqual(sweepEras('', 2026), []);
  assert.deepEqual(sweepEras(null as any, 2026), []);
});

test('a non-finite storyYear dates NOTHING rather than collapsing the timeline onto today', () => {
  // Found unpinned by the break sweep: neutralise the finiteness guard around the year loop and
  // all 295 still passed. Without it every bare year is dated at yearsToDays(year - NaN), which
  // the rounding helper resolves to 0 - so 1994 and 2001 BOTH land on offset 0, the story's
  // present day. A build that lost its storyYear would silently date its whole timeline to today,
  // which is the collapse-to-present-day class this plan's predecessor raised as CRITICAL.
  assert.deepEqual(sweepEras('We open in 1994, and again in 2001.', NaN), []);
  // With a real storyYear the same material still yields both years, so the guard refuses only
  // the unusable input rather than suppressing the feature.
  const ok = sweepEras('We open in 1994, and again in 2001.', 2026);
  assert.equal(ok.length, 2);
  assert.deepEqual(ok[0].offset, { from: -11688, to: -11688 });
  assert.deepEqual(ok[1].offset, { from: -9131, to: -9131 });
});

test('an overlapping bare year is dropped, and the phrase that contains it wins', () => {
  // What this pins NOW: the phrase grammar reads "1994 to 2000 years ago" as ONE range measured
  // from the present, rather than as the bare year 1994 followed by something else. The number
  // token accepting digits is what lets the range start at a four-digit numeral at all.
  //
  // What it NO LONGER pins, despite the rationale it carried until this review: the two sweepEras
  // guards. That rationale named PHRASE_RE and YEAR_RE, two interpolated regexes this branch
  // deleted when it moved to the tokenizer, and under the token grammar this input reaches neither
  // guard - its bare "1994" has no year cue in front of it, so matchYears returns [] here and no
  // overlap is ever proposed. The assertions below are still correct and stay frozen; they simply
  // no longer exercise the overlap check or the phrase-before-year ordering.
  //
  // Those two guards are pinned instead by 'a CUED year inside an accepted phrase is dropped, and
  // phrases are placed first' below, which adds the cue that makes the two proposals collide.
  const hits = sweepEras('1994 to 2000 years ago the ice retreated.', 2026);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].text, '1994 to 2000 years ago');
  assert.equal(hits[0].start, 0);
  assert.equal(hits[0].end, 22);
  assert.deepEqual(hits[0].offset, { from: -730500, to: -728309 });
});

test('a CUED year inside an accepted phrase is dropped, and phrases are placed first', () => {
  // The test above no longer reaches either sweepEras guard. Under the token grammar its bare
  // "1994" has no year cue in front of it, so matchYears returns [] for that input and nothing
  // ever overlaps - the two guards it was written to pin became unreachable from it.
  //
  // Adding the cue is what makes the two proposals genuinely collide: for this input
  // matchPhrases offers "1994 to 2000 years ago" at [3,25) and matchYears offers 1994 at [3,7).
  const hits = sweepEras('in 1994 to 2000 years ago', 2026);

  // THE OVERLAP CHECK (era.util.ts, inside `take`). Drop it and 1994 is emitted a SECOND time as
  // a cued year at -11688: two strata for one moment, which raises a conflict deterministically
  // before generation rather than surfacing as drift.
  assert.equal(hits.length, 1);

  // THE LOOP ORDERING (phrases before years). Run the year loop first and the bare year wins the
  // span, the range is swallowed whole, and the only surviving offset is -11688 - about 62x off.
  assert.equal(hits[0].text, '1994 to 2000 years ago');
  assert.equal(hits[0].start, 3);
  assert.equal(hits[0].end, 25);
  assert.deepEqual(hits[0].offset, { from: -730500, to: -728309 });
});

test('a phrase mid-sentence is detected, and its span is only the dating words', () => {
  // With a number token of `[\w-]+` this matched from "Jason", wordsToNumber refused the swollen
  // match, and the commonest phrasing in a treatment produced no timeline at all.
  const a = sweepEras('Jason vanished about seven years ago.', 2026);
  assert.equal(a.length, 1);
  assert.equal(a[0].text, 'about seven years ago');
  assert.deepEqual(a[0].offset, { from: -2557, to: -2557 });

  const b = sweepEras('It happened three years ago on a rainy night.', 2026);
  assert.equal(b[0].text, 'three years ago');
  assert.deepEqual(b[0].offset, { from: -1096, to: -1096 });

  const c = sweepEras('He waited three years before leaving for good.', 2026);
  assert.equal(c[0].text, 'three years before');   // the span stops at the tail word
  assert.equal(c[0].offset, null);                 // and a measured wait still refuses
});

test('a multi-syllable numeral is read whole, and `and` stays outside the span', () => {
  const n = sweepEras('Nineteen years ago he left.', 2026);
  assert.equal(n.length, 1);
  assert.equal(n[0].text, 'Nineteen years ago');
  assert.deepEqual(n[0].offset, { from: -6940, to: -6940 });
  // `and` joins two numbers but never opens one, so it stays outside the span.
  const t = sweepEras('Twenty years ago and twenty years ago again, nothing changed.', 2026);
  assert.equal(t.length, 2);
  assert.equal(t[0].text, 'Twenty years ago');
  assert.equal(t[1].text, 'twenty years ago');
});

test('a hyphen inside a compound numeral is not a range separator', () => {
  // "twenty-five" is one number. Read as a range it became -7305..-1826, a confident wrong answer
  // on the commonest compound in English. A hyphen ranges only between digits, or when spaced.
  assert.deepEqual(sweepEras('Twenty-five years ago, she vanished.', 2026)[0].offset, { from: -9131, to: -9131 });
  assert.deepEqual(sweepEras('Thirty-two years later, he returned.', 2026)[0].offset, { from: 11688, to: 11688 });
  assert.deepEqual(sweepEras('Ninety-nine years ago, the treaty was signed.', 2026)[0].offset, { from: -36160, to: -36160 });
  // the spaced form has always been right, and must stay right
  assert.deepEqual(sweepEras('Twenty five years ago', 2026)[0].offset, { from: -9131, to: -9131 });
  // and every genuine range form still ranges
  assert.deepEqual(sweepEras('10-15 years ago', 2026)[0].offset, { from: -5479, to: -3653 });
  assert.deepEqual(sweepEras('15 - 20 years ago', 2026)[0].offset, { from: -7305, to: -5479 });
  assert.deepEqual(sweepEras('fifteen to ten years before the film', 2026)[0].offset, { from: -5479, to: -3653 });
});

import { resolveEventAnchored } from './era.util';

test('a phrase measured from a DATE resolves in the second pass, not the first', () => {
  const text = 'Seven years before 1994 he left.';
  const pass1 = sweepEras(text, 2026);
  assert.equal(pass1[0].offset, null);
  const pass2 = resolveEventAnchored(text, pass1, []);
  assert.deepEqual(pass2[0].offset, { from: yearsToDays(-39), to: yearsToDays(-39) });
  assert.equal(yearsToDays(-39), -14245);   // 1987, seven years before 1994
});

test('a phrase measured from an EVENT resolves against that event own era', () => {
  const text = 'Two years before Jason vanished, Vex bought the boy.';
  const pass1 = sweepEras(text, 2026);
  assert.equal(pass1[0].offset, null);
  const pass2 = resolveEventAnchored(text, pass1, [{ name: 'Jason vanished', offset: yearsToDays(-7) }]);
  assert.deepEqual(pass2[0].offset, { from: yearsToDays(-7) + yearsToDays(-2), to: yearsToDays(-7) + yearsToDays(-2) });
});

test('the longest event name wins, so a prefix cannot steal the anchor', () => {
  const text = 'One year before Jason vanished in Cairo, it began.';
  const pass1 = sweepEras(text, 2026);
  const pass2 = resolveEventAnchored(text, pass1, [
    { name: 'Jason vanished', offset: yearsToDays(-7) },
    { name: 'Jason vanished in Cairo', offset: yearsToDays(-20) },
  ]);
  assert.deepEqual(pass2[0].offset, { from: yearsToDays(-21), to: yearsToDays(-21) });
});

test('an event nobody dated leaves the hit null - unresolvable stays unresolvable', () => {
  const text = 'Two years before Jason vanished, Vex bought the boy.';
  const pass1 = sweepEras(text, 2026);
  const pass2 = resolveEventAnchored(text, pass1, []);
  assert.equal(pass2[0].offset, null);
  assert.deepEqual(resolveEventAnchored(text, pass1, [{ name: 'x', offset: NaN }])[0].offset, null);
});

test('already-resolved hits are never touched by the second pass', () => {
  const text = 'About seven years ago Jason vanished.';
  const pass1 = sweepEras(text, 2026);
  const pass2 = resolveEventAnchored(text, pass1, [{ name: 'Jason vanished', offset: yearsToDays(-99) }]);
  assert.deepEqual(pass2[0].offset, { from: yearsToDays(-7), to: yearsToDays(-7) });
});

test('never throws on junk', () => {
  assert.deepEqual(resolveEventAnchored(null as any, null as any, null as any), []);
  assert.deepEqual(resolveEventAnchored('', [], undefined as any), []);
});

test('an event is NAMED, not merely contained — and a blank name anchors nothing', () => {
  // "War" inside "Warehouse" anchored a hit to an event that never happened, and an empty name
  // was a wildcard, because ''.includes() is always true. Both produced confident wrong numbers.
  const a = 'Three years after Warehouse fire, they rebuilt.';
  assert.equal(resolveEventAnchored(a, sweepEras(a, 2026), [{ name: 'War', offset: yearsToDays(-50) }])[0].offset, null);
  const b = 'Two years before Marcus finally left the house for good.';
  assert.equal(resolveEventAnchored(b, sweepEras(b, 2026), [{ name: '', offset: yearsToDays(-500) }])[0].offset, null);
  assert.equal(resolveEventAnchored(b, sweepEras(b, 2026), [{ name: '   ', offset: yearsToDays(-500) }])[0].offset, null);
  // A name carrying regex metacharacters is matched literally, not compiled as a pattern.
  const c = 'Two years before the fall (part 2), it began.';
  assert.deepEqual(resolveEventAnchored(c, sweepEras(c, 2026), [{ name: 'the fall (part 2)', offset: yearsToDays(-9) }])[0].offset,
    { from: yearsToDays(-11), to: yearsToDays(-11) });
});

test('deep time in digits resolves, and an ambiguous digit run refuses', () => {
  // "10,000 years ago" summed to 10 and normalised to {0,0} — the same value as "the present day",
  // so a stratum ten thousand years back was indistinguishable from a present-day one.
  assert.deepEqual(sweepEras('10,000 years ago', 2026)[0].offset, { from: -3652500, to: -3652500 });
  assert.deepEqual(sweepEras('1,500 years ago', 2026)[0].offset, { from: -547875, to: -547875 });
  assert.deepEqual(sweepEras('1,000 to 2,000 years ago', 2026)[0].offset, { from: -730500, to: -365250 });
  // A space between digit runs is unreadable, so it refuses rather than summing to 10 or 502.
  assert.equal(sweepEras('10 000 years ago', 2026).length ? sweepEras('10 000 years ago', 2026)[0].offset : null, null);
  assert.equal(wordsToNumber('2 500'), null);
  assert.equal(wordsToNumber('10,000'), 10000);
});

test('a bare four-digit number is only a year when something says so', () => {
  // The 1000-2999 band answers "is this plausibly a year", not "is this a year HERE". Five
  // spurious strata came out of one paragraph containing no dates at all, and two are enough to
  // raise ERA_ANCHOR_CONFLICT deterministically before a word is generated.
  assert.deepEqual(sweepEras('At 1900 hours the convoy moved. It cost 1500 dollars. Room 1408. Flight 1620. He ran 2000 metres.', 2026), []);
  assert.equal(sweepEras('It cost 1500 dollars, and in 1994 he left.', 2026).length, 1);
  assert.equal(sweepEras('circa 1650 the city fell', 2026)[0].text, '1650');
  assert.equal(sweepEras('500 BC was long ago', 2026)[0].text, '500 BC');   // an era mark needs no cue
});

test('a phrase must start where the head starts, or the head is narration and refuses', () => {
  // parseEraPhrase is handed ONE phrase, not a passage. If the match begins somewhere inside the
  // string, the caller passed narration and the reading is not about the head at all - so it
  // refuses. Without the start check it answers confidently about a substring it was never asked
  // about, which is the same wrong-year class the sweep exists to prevent. Found unpinned by the
  // break sweep, row 20; sweepEras is the function that finds a phrase INSIDE prose.
  assert.equal(parseEraPhrase('foo seven years ago'), null);
  assert.equal(parseEraPhrase('Jason vanished about seven years ago'), null);
  assert.deepEqual(parseEraPhrase('seven years ago'), { from: -2557, to: -2557 });
  assert.deepEqual(parseEraPhrase('  seven years ago'), { from: -2557, to: -2557 });
});
