import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { tokenize, matchPhrases, matchYears } from './era-tokens.util';

const kinds = (s: string) => tokenize(s).map((t) => t.kind);
const values = (s: string) => tokenize(s).filter((t) => t.value !== undefined).map((t) => t.value);
const spans = (s: string) => matchPhrases(tokenize(s)).map((m) => s.slice(m.start, m.end));

test('a numeral is one token however it is written', () => {
  assert.deepEqual(values('twenty-five years ago'), [25]);
  assert.deepEqual(values('twenty five years ago'), [25]);
  assert.deepEqual(values('three hundred and fifty years ago'), [350]);
  assert.deepEqual(values('two thousand years back'), [2000]);
  assert.deepEqual(values('10,000 years ago'), [10000]);
  assert.deepEqual(values('a decade before'), [1]);
});

test('a hyphen joins a numeral or separates a range, decided by its NEIGHBOURS', () => {
  // The old rule was a lookaround guessing from raw characters, and it read "twenty-five years
  // ago" as a range from twenty to five - a confident wrong answer on the commonest compound in
  // English. Here the kinds of the tokens on either side decide, in one place.
  assert.deepEqual(kinds('twenty-five years ago'), ['NUMBER', 'UNIT', 'TAIL']);
  assert.deepEqual(kinds('10-15 years ago'), ['NUMBER', 'CONNECTOR', 'NUMBER', 'UNIT', 'TAIL']);
  assert.deepEqual(kinds('15 - 20 years ago'), ['NUMBER', 'CONNECTOR', 'NUMBER', 'UNIT', 'TAIL']);
  assert.equal(tokenize('10-15 years ago')[1].link, 'range');
  assert.deepEqual(kinds('fifteen to ten years before'), ['NUMBER', 'CONNECTOR', 'NUMBER', 'UNIT', 'TAIL']);
  // A dash with nothing numeric on both sides is not a connector at all.
  assert.deepEqual(kinds('Cairo - a city'), ['WORD', 'WORD', 'WORD', 'WORD']);
});

test("the 'compound' link value IS producible, and collapsing it recreates the range defect", () => {
  // The break sweep filed this branch as dead code and carried it forward for DELETION. It is not
  // dead. A hyphen unspaced on the LEFT and spaced on the RIGHT makes both `spaced` and `digitBoth`
  // false, which is the only combination that reaches 'compound' - and it is ordinary typing.
  assert.equal(tokenize('twenty- five years ago')[1].link, 'compound');
  // Because the link is compound rather than range, the grammar refuses to read the pair as a
  // span and dates only what it can defend. Collapse the branch to always-'range' and this becomes
  // the whole string read as a RANGE -7305..-1826: "twenty-five" understood as twenty TO five,
  // the exact defect named in this module's header as the reason the port was written.
  assert.deepEqual(spans('twenty- five years ago'), ['five years ago']);
});

test('two bare digit runs side by side are unreadable, and refuse', () => {
  // "2 500" is a thousands separator typed as a space, or two numbers run together, and nothing
  // on the page says which. Summing them said 502; summing "10 000" said 10, which normalises to
  // the same offset as "the present day" - the worst value this module can emit.
  assert.deepEqual(matchPhrases(tokenize('2 500 years before the film')), []);
  assert.deepEqual(matchPhrases(tokenize('10 000 years ago')), []);
});

test('a malformed comma group splits into two UNSPACED digit runs, and still refuses', () => {
  // The break sweep filed this refusal as unreachable, reasoning that the outer loop's spaced-digit
  // guard already stops every pair. It does not. The lexer splits "11,5001" into `11,500` and `1`
  // with space:false, so the run absorbs BOTH and only this refusal stands between the reader and
  // a confident answer. Neutralise it and "11,5001 years ago" dates at -4200740 days.
  assert.deepEqual(kinds('11,5001 years ago'), ['WORD', 'UNIT', 'TAIL']);
  assert.deepEqual(matchPhrases(tokenize('11,5001 years ago')), []);
  // The well-formed group is still one number, so the refusal has not been widened into a ban.
  assert.deepEqual(values('11,500 years ago'), [11500]);
});

test('`and` joining two BARE DIGIT runs refuses - only WORD numerals may be joined by it', () => {
  // `and` used to clear the bare-digit refusal above, so "10 and 15 years ago" summed to a
  // confident 25. That is a refusal turned into an answer, the one direction this module forbids.
  // Nobody writes "300 and 50" meaning 350; a writer who types it means two separate numbers.
  assert.deepEqual(matchPhrases(tokenize('10 and 15 years ago')), []);
  assert.deepEqual(matchPhrases(tokenize('300 and 50 years ago')), []);
  assert.deepEqual(matchPhrases(tokenize('20 and 30 years ago')), []);
  assert.deepEqual(matchPhrases(tokenize('1 and 2 years ago')), []);
  // WORD numerals legitimately need `and`, and are untouched - this is the narrowing's whole point.
  assert.deepEqual(values('three hundred and fifty years ago'), [350]);
  assert.deepEqual(values('two and three years ago'), [5]);
  assert.deepEqual(values('a hundred and one years ago'), [101]);
});

test('an era mark binds to the number before it and stores the astronomical year', () => {
  assert.deepEqual(kinds('500 BC'), ['YEAR']);
  assert.deepEqual(values('500 BC'), [-499]);   // there is no year zero
  assert.deepEqual(values('1 BC'), [0]);
  assert.deepEqual(values('500 AD'), [500]);
  assert.deepEqual(values('500 bce'), [-499]);
  // There is no year zero, so "0 BC" is not a date at all - the mark must find a POSITIVE number
  // before it or bind to nothing. Without that condition it reads as AD 1: a confident wrong year
  // from a string that names no year. Found unpinned by the break sweep, row 4.
  assert.deepEqual(kinds('0 BC'), ['NUMBER', 'WORD']);
  assert.deepEqual(values('0 BC'), [0]);
});

test('a tail carries its direction and whether it can take an object', () => {
  const before = tokenize('before')[0];
  assert.equal(before.kind, 'TAIL');
  assert.equal(before.sign, -1);
  assert.equal(before.takesObject, true);
  const ago = tokenize('ago')[0];
  assert.equal(ago.sign, -1);
  assert.equal(ago.takesObject, false);
  assert.equal(tokenize('later')[0].sign, 1);
});

test('an object-taking tail dates only when the clause ends there or points at the story', () => {
  // A regex needed a word boundary AND a clause boundary AND an optional preposition, and three
  // review rounds, to say this. On tokens it is: the next token is the end, or the story.
  assert.deepEqual(spans('Twenty years before the film'), ['Twenty years before']);
  assert.equal(matchPhrases(tokenize('Twenty years before the film'))[0].anchored, true);
  assert.equal(matchPhrases(tokenize('three years prior to the film'))[0].anchored, true);
  assert.equal(matchPhrases(tokenize('seven years before, in Cairo'))[0].anchored, true);
  // Durations keep their span but are not anchored to the present.
  assert.equal(matchPhrases(tokenize('He waited three years before speaking.'))[0].anchored, false);
  assert.equal(matchPhrases(tokenize('two years before the wedding'))[0].anchored, false);
  // "the filming" is not "the film" - a prefix match was a real defect, and is now unreachable.
  assert.equal(matchPhrases(tokenize('ten years before the filming of the video'))[0].anchored, false);
  assert.equal(matchPhrases(tokenize('seven years before that morning'))[0].anchored, false);
});

test('a phrase measured from a DATE keeps its span for the second pass', () => {
  const m = matchPhrases(tokenize('Seven years before 1994 he left.'));
  assert.equal(m.length, 1);
  assert.equal(m[0].anchored, false);   // the magnitude is real; only the base is missing
});

test('a comparative BOUNDS the number rather than softening it', () => {
  // Two hedge lists that disagreed is why "at least twenty years ago" and "twenty years ago"
  // produced the identical offset with nothing able to tell them apart.
  assert.equal(matchPhrases(tokenize('at least twenty years ago'))[0].bound, 'atLeast');
  assert.equal(matchPhrases(tokenize('more than twenty years ago'))[0].bound, 'atLeast');
  assert.equal(matchPhrases(tokenize('nearly twenty years ago'))[0].bound, 'atMost');
  assert.equal(matchPhrases(tokenize('about twenty years ago'))[0].bound, undefined);
  // The offset itself is unchanged, so nothing downstream shifts.
  assert.equal(matchPhrases(tokenize('at least twenty years ago'))[0].from, -7305);
});

test('a hit span is the tokens it matched, so it cannot swallow the narration', () => {
  assert.deepEqual(spans('Jason vanished about seven years ago.'), ['about seven years ago']);
  assert.deepEqual(spans('It happened three years ago on a rainy night.'), ['three years ago']);
  assert.deepEqual(spans('INT. SILO - DAY. CROSS waits.'), []);
});

test('a bare four-digit number is a year only when something says so', () => {
  assert.deepEqual(matchYears(tokenize('At 1900 hours. It cost 1500 dollars. Room 1408.')), []);
  assert.deepEqual(matchYears(tokenize('in 1994')).map((y) => y.year), [1994]);
  assert.deepEqual(matchYears(tokenize('circa 1650')).map((y) => y.year), [1650]);
  assert.deepEqual(matchYears(tokenize('500 BC')).map((y) => y.year), [-499]);   // a mark needs no cue
  assert.deepEqual(matchYears(tokenize('before 1994')).map((y) => y.year), [1994]);
  assert.deepEqual(matchYears(tokenize('in 9999')), []);   // outside the plausible band
});

test('never throws on junk', () => {
  assert.deepEqual(tokenize(null as any), []);
  assert.deepEqual(tokenize(undefined as any), []);
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(12345 as any).map((t) => t.kind), ['NUMBER']);
  assert.deepEqual(matchPhrases([]), []);
  assert.deepEqual(matchYears([]), []);
  assert.deepEqual(matchPhrases(null as any), []);
  assert.deepEqual(matchYears(null as any), []);   // symmetry: the argument guard, not just the entry guard
  // A null ENTRY inside an otherwise valid array throws just as readily as a null argument -
  // both walks index straight into `.kind` with no guard.
  assert.deepEqual(matchPhrases([null as any]), []);
  assert.deepEqual(matchYears([null as any]), []);
});
