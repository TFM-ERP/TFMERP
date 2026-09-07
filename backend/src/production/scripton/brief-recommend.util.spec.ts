import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  matchOption, coerceRecommendations, applyRecommendations, undoRecommendations,
  hasUserValue, explainRecommendations, recommendableFields, canonicalField, rowsFrom,
  FIELD_SPECS, MIN_WHY_CHARS, MAX_RECOMMENDATIONS, Recommendation, salvageRows, DECLARED_KINDS,
} from './brief-recommend.util';

/**
 * The option lists exactly as the Creative DNA panel sends them — BASE_GENRES, BLEND_LAYERS, TONES,
 * MOODS, TREATMENTS from taxonomy.ts, plus the pickers defined in ScriptOnIntake itself.
 */
const OPTS: Record<string, string[]> = {
  baseGenres: ['Action', 'Adventure', 'Comedy', 'Crime', 'Drama', 'Fantasy', 'Historical', 'Horror',
    'Musical', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'],
  blendLayers: ['War', 'Romance', 'Fantasy', 'Noir', 'Satire', 'Mystery', 'Coming-of-age',
    'Political', 'Supernatural', 'Survival'],
  tones: ['Epic', 'Grounded', 'Tragic', 'Ironic', 'Comic', 'Romantic', 'Satirical', 'Pulpy', 'Lyrical'],
  moods: ['Foreboding', 'Bittersweet', 'Hopeful', 'Tense', 'Melancholic', 'Whimsical', 'Dread', 'Warm'],
  treatment: ['Linear', 'Non-linear', 'Multi-POV', 'Frame / story-within'],
  projectType: ['MOVIE', 'TV_SERIES', 'LIMITED', 'VERTICAL', 'SHORT', 'DOC', 'VERTICAL_AI_VIDEO'],
  language: ['English', 'Arabic (Modern Standard)', 'French'],
  country: ['Global / International', 'United States', 'GCC / Gulf'],
  rating: ['US film · PG-13', 'US film · R', 'Teen (13+)', 'Mature (16+)'],
  loreDensity: ['OFF', 'ACCENT', 'SUBPLOT', 'WOVEN', 'DRIVER', 'SATURATED'],
  // Style packs and ending types are stored as IDS, not labels — the form keeps ids and the prompt
  // renders the human name beside them, so nothing has to be mapped back on either side.
  styles: ['fast_ensemble', 'slow_burn', 'mythic_quest', 'noir_voice', 'chamber'],
  endings: ['resolved', 'triumphant', 'tragic', 'bittersweet', 'twist', 'ambiguous', 'cliffhanger'],
  subgenres: ['Spy', 'Heist', 'Martial arts', 'Disaster', 'Survival', 'Military', 'Quest'],
  framework: ['STC', 'HERO', 'SEQ8'],
  // The six research lanes, exactly as the Research scope panel keys them.
  researchScope: ['subject', 'craft', 'mythology', 'comps', 'legal', 'general'],
};

/** The panel's own default: every lane on, which is what "ON BY DEFAULT" on the card means. */
const SCOPE_ALL_ON = { subject: true, craft: true, mythology: true, comps: true, legal: true, general: true };

const WHY = 'stated on page four of the treatment';
const rec = (field: string, value: any, why = WHY) => ({ field, value, why });

// ---------------------------------------------------------------------------------------------
// RULE 1 — the form sends its own lists, and nothing outside them survives
// ---------------------------------------------------------------------------------------------

test('matchOption takes the exact option, then case, then the spelling a model actually returns', () => {
  assert.equal(matchOption('Sci-Fi', OPTS.baseGenres), 'Sci-Fi');
  assert.equal(matchOption('sci-fi', OPTS.baseGenres), 'Sci-Fi');
  assert.equal(matchOption('Sci Fi', OPTS.baseGenres), 'Sci-Fi');
  assert.equal(matchOption('SciFi', OPTS.baseGenres), 'Sci-Fi');
  assert.equal(matchOption('coming of age', OPTS.blendLayers), 'Coming-of-age');
  assert.equal(matchOption('US film PG-13', OPTS.rating), 'US film · PG-13');
});

test('a value the form cannot display is DROPPED, never approximated to the nearest option', () => {
  // "Neo-noir" is not in the picker. The nearest neighbour is Noir — selecting it would be a choice
  // the user never made, silently. Empty is the correct answer.
  assert.equal(matchOption('Neo-noir', OPTS.baseGenres), null);
  assert.equal(matchOption('Techno-thriller', OPTS.baseGenres), null);
  assert.equal(matchOption('PG-13', OPTS.rating), null);
  assert.equal(matchOption('', OPTS.baseGenres), null);
  assert.equal(matchOption(null, OPTS.baseGenres), null);
  assert.equal(matchOption('Action', null), null);
  assert.equal(matchOption('Action', []), null);
});

test('THE SAFETY RULE: an invented genre cannot reach the form', () => {
  const out = coerceRecommendations({ fields: [
    rec('baseGenres', ['Thriller', 'Techno-thriller', 'Neo-noir', 'Drama']),
  ] }, OPTS);
  assert.deepEqual(out[0].value, ['Thriller', 'Drama']);
});

test('an enum field with no match contributes nothing at all, rather than a bad value', () => {
  const out = coerceRecommendations({ fields: [
    rec('rating', 'PEGI 16'), rec('projectType', 'FEATURE'), rec('language', 'Klingon'),
  ] }, OPTS);
  assert.deepEqual(out, []);
});

// ---------------------------------------------------------------------------------------------
// THE EMPTY-FORM BUG — the analysis worked and the form stayed blank
// ---------------------------------------------------------------------------------------------

test('THE EMPTY-FORM BUG: `genres` and `tone` are DERIVED and can never be recommended into', () => {
  // ScriptOnIntake's reDna() computes genres = [...baseGenres, ...blendLayers] and tone by joining
  // tones and moods. Writing either shows the user nothing and is overwritten by their next click.
  assert.equal(FIELD_SPECS['genres'], undefined, 'genres is derived — it must not be writable');
  assert.equal(FIELD_SPECS['tone'], undefined, 'tone is derived — it must not be writable');
  assert.ok(FIELD_SPECS['baseGenres'], 'the picker binds to baseGenres');
  assert.ok(FIELD_SPECS['tones'] && FIELD_SPECS['moods'], 'the picker binds to tones and moods');
});

test('THE EMPTY-FORM BUG: a model naming the derived fields still reaches the real ones', () => {
  const out = coerceRecommendations({ fields: [
    rec('genre', ['Thriller']), rec('tone', ['Grounded']), rec('mood', ['Foreboding']),
    rec('era', '1987'), rec('setting', 'Montana'), rec('market', 'United States'),
    rec('want', 'to stop the launch'), rec('theme', 'obedience'), rec('comparables', ['WarGames']),
  ] }, OPTS);
  assert.deepEqual(out.map((r) => r.field).sort(),
    ['baseGenres', 'comps', 'country', 'moods', 'settingCountry', 'settingEra', 'spine.theme',
      'spine.want', 'tones']);
});

test('canonicalField resolves aliases, casing and punctuation — and still refuses the unknown', () => {
  assert.equal(canonicalField('baseGenres'), 'baseGenres');
  assert.equal(canonicalField('genres'), 'baseGenres');
  assert.equal(canonicalField('Genre'), 'baseGenres');
  assert.equal(canonicalField('tone'), 'tones');
  assert.equal(canonicalField('mood'), 'moods');
  assert.equal(canonicalField('project_type'), 'projectType');
  assert.equal(canonicalField('Setting Era'), 'settingEra');
  assert.equal(canonicalField('spinewant'), 'spine.want');
  assert.equal(canonicalField('spine.want'), 'spine.want');
  assert.equal(canonicalField('collabMode'), null, 'a field outside the allow-list is still refused');
  assert.equal(canonicalField('buildId'), null);
  assert.equal(canonicalField(''), null);
  assert.equal(canonicalField(null), null);
});

test('every reply shape a model actually returns is unpacked', () => {
  const row = rec('baseGenres', ['Drama']);
  assert.equal(rowsFrom([row]).length, 1);
  assert.equal(rowsFrom({ fields: [row] }).length, 1);
  assert.equal(rowsFrom({ recommendations: [row] }).length, 1);
  assert.equal(rowsFrom({ brief: { fields: [row] } }).length, 1);
  // The object-map form, which is what models reach for when not told otherwise.
  const mapped = rowsFrom({ baseGenres: { value: ['Drama'], why: 'the material is a chamber piece' } });
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].field, 'baseGenres');
  assert.deepEqual(rowsFrom(null), []);
  assert.deepEqual(rowsFrom('nope'), []);
});

test('tolerance is about PACKAGING only — the option lists still refuse an invented value', () => {
  const out = coerceRecommendations({ genre: { value: ['Techno-thriller'], why: 'it reads that way' } }, OPTS);
  assert.deepEqual(out, [], 'a real option list is still the only thing that can reach the form');
});

// ---------------------------------------------------------------------------------------------
// RULE 2 — no reason, no recommendation
// ---------------------------------------------------------------------------------------------

test('a value with no evidence behind it is dropped, so "See why" is always answerable', () => {
  const out = coerceRecommendations({ fields: [
    rec('baseGenres', ['Thriller'], ''),
    rec('projectType', 'MOVIE', '   '),
    rec('rating', 'US film · R', 'the material describes on-screen killings in detail'),
  ] }, OPTS);
  assert.equal(out.length, 1);
  assert.equal(out[0].field, 'rating');
});

test('a SHORT reason is still a reason — the old 12-character floor was invented, not measured', () => {
  const out = coerceRecommendations({ fields: [rec('settingEra', '1987', 'p. 4')] }, OPTS);
  assert.equal(out.length, 1);
  assert.equal(out[0].why, 'p. 4');
  assert.equal(MIN_WHY_CHARS, 1);
});

test('"reason" is accepted where a model uses it instead of "why"', () => {
  const out = coerceRecommendations({ fields: [{ field: 'settingEra', value: '1987', reason: 'the duty log is dated' }] }, OPTS);
  assert.equal(out.length, 1);
  assert.equal(out[0].why, 'the duty log is dated');
});

test('the evidence is trimmed rather than allowed to become an essay', () => {
  const out = coerceRecommendations({ fields: [rec('settingEra', '1987', 'x'.repeat(2000))] }, OPTS);
  assert.ok(out[0].why.length <= 240);
});

// ---------------------------------------------------------------------------------------------
// The allow-list
// ---------------------------------------------------------------------------------------------

test('a field outside FIELD_SPECS can never be written, whatever the model returns', () => {
  const out = coerceRecommendations({ fields: [
    rec('baseGenres', ['Drama']), rec('collabMode', 'SOLO'), rec('buildId', 'abc'),
    rec('__proto__', 'x'), rec('scriptonDefaults', { a: 1 }),
  ] }, OPTS);
  assert.deepEqual(out.map((r) => r.field), ['baseGenres']);
});

test('every field the analysis may fill is declared, and the table is coherent', () => {
  const fields = recommendableFields();
  assert.ok(fields.length > 20);
  for (const f of fields) {
    const s = FIELD_SPECS[f];
    assert.ok(['enum', 'enumList', 'text', 'textList', 'number', 'flags'].indexOf(s.kind) >= 0, f);
    if (s.kind === 'enum' || s.kind === 'enumList' || s.kind === 'flags') assert.ok(s.options, f + ' needs an options key');
    if (s.kind === 'text' || s.kind === 'textList') assert.ok((s.max || 0) > 0, f + ' needs a cap');
    if (s.kind === 'number') {
      assert.equal(typeof s.min, 'number', f);
      assert.equal(typeof s.maxNum, 'number', f);
      assert.ok((s.maxNum as number) > (s.min as number), f);
    }
  }
});

test('text is capped and whitespace-normalised; a list is capped in both directions', () => {
  const out = coerceRecommendations({ fields: [
    rec('settingEra', '  1980s cold war,\n\n  procedural   '),
    rec('comps', ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']),
    rec('baseGenres', ['Thriller', 'Drama', 'War', 'Crime', 'Mystery']),
  ] }, OPTS);
  const by = new Map(out.map((r) => [r.field, r.value]));
  assert.equal(by.get('settingEra'), '1980s cold war, procedural');
  assert.equal((by.get('comps') as string[]).length, 8);
  assert.equal((by.get('baseGenres') as string[]).length, 3, 'the picker allows at most three');
});

test('a number outside its range is DROPPED, not clamped — a clamped guess reads as a measurement', () => {
  const out = coerceRecommendations({ fields: [
    rec('targetPages', 140), rec('researchAmount', 55), rec('seasons', 0), rec('episodes', 'ten'),
  ] }, OPTS);
  assert.deepEqual(out.map((r) => r.field), ['researchAmount']);
  assert.equal(out[0].value, 55);
});

test('duplicate fields keep the first, and the whole reply is capped', () => {
  const many = Array.from({ length: 80 }, () => rec('settingEra', '1987'));
  assert.equal(coerceRecommendations({ fields: many }, OPTS).length, 1);
  const wide = recommendableFields().map((f) => rec(f, 'x'.repeat(20)));
  assert.ok(coerceRecommendations({ fields: wide }, OPTS).length <= MAX_RECOMMENDATIONS);
});

test('coerceRecommendations is fail-safe on every junk shape a model can return', () => {
  for (const junk of [null, undefined, {}, [], 'text', 42, { fields: null }, { fields: 'x' },
    { fields: [null, 0, 'x', []] }]) {
    assert.deepEqual(coerceRecommendations(junk as any, OPTS), []);
  }
  assert.deepEqual(coerceRecommendations({ fields: [rec('baseGenres', ['Drama'])] }, null), []);
});

// ---------------------------------------------------------------------------------------------
// Applying — soft selections, and the user always wins
// ---------------------------------------------------------------------------------------------

const FORM = {
  baseGenres: [], tones: [], moods: [], blendLayers: [], cultureEra: '', rating: '',
  settingEra: '', spine: { want: '', theme: '' }, projectType: 'MOVIE',
};

test('the whole analysis lands in ONE step, and nothing shifts under the user afterwards', () => {
  const recs = coerceRecommendations({ fields: [
    rec('baseGenres', ['Thriller', 'Drama']), rec('tones', ['Grounded']),
    rec('settingEra', '1987'), rec('spine.want', 'to stop the launch'),
  ] }, OPTS);
  const { form, applied, skipped } = applyRecommendations(FORM, recs);
  assert.deepEqual(form.baseGenres, ['Thriller', 'Drama']);
  assert.deepEqual(form.tones, ['Grounded']);
  assert.equal(form.settingEra, '1987');
  assert.equal(form.spine.want, 'to stop the launch');
  assert.equal(form.spine.theme, '', 'an untouched sibling key survives the nested write');
  assert.equal(applied.length, 4);
  assert.deepEqual(skipped, []);
  assert.deepEqual((FORM as any).baseGenres, [], 'the input form is not mutated');
});

test('A FIELD THE USER HAS TOUCHED IS NEVER WRITTEN, even when they cleared it', () => {
  const recs = [rec('settingEra', '1987'), rec('baseGenres', ['Thriller'])] as Recommendation[];
  const { form, applied, skipped } = applyRecommendations(FORM, recs, ['settingEra']);
  assert.equal(form.settingEra, '', 'the user deliberately left this empty');
  assert.deepEqual(form.baseGenres, ['Thriller']);
  assert.deepEqual(applied.map((r) => r.field), ['baseGenres']);
  assert.deepEqual(skipped.map((r) => r.field), ['settingEra']);
});

test('a field that already holds a value is left alone — a resumed draft is not overwritten', () => {
  const started = { ...FORM, settingEra: 'my own words', baseGenres: ['Comedy'] };
  const recs = [rec('settingEra', '1987'), rec('baseGenres', ['Thriller'])] as Recommendation[];
  const { form, skipped } = applyRecommendations(started, recs);
  assert.equal(form.settingEra, 'my own words');
  assert.deepEqual(form.baseGenres, ['Comedy']);
  assert.equal(skipped.length, 2);
});

test('hasUserValue reads an empty string, an empty array and null as untouched', () => {
  assert.equal(hasUserValue({ a: '' }, 'a'), false);
  assert.equal(hasUserValue({ a: '   ' }, 'a'), false);
  assert.equal(hasUserValue({ a: [] }, 'a'), false);
  assert.equal(hasUserValue({ a: null }, 'a'), false);
  assert.equal(hasUserValue({}, 'a'), false);
  assert.equal(hasUserValue({ a: 'x' }, 'a'), true);
  assert.equal(hasUserValue({ a: ['x'] }, 'a'), true);
  assert.equal(hasUserValue({ a: 0 }, 'a'), true);
  assert.equal(hasUserValue({ a: true }, 'a'), false, 'a default checkbox is not a decision');
  assert.equal(hasUserValue({ s: { want: 'x' } }, 's.want'), true);
  assert.equal(hasUserValue({ s: {} }, 's.want'), false);
});

test('applyRecommendations is fail-safe and refuses a field outside the allow-list', () => {
  assert.deepEqual(applyRecommendations(FORM, null).applied, []);
  assert.deepEqual(applyRecommendations(FORM, [{ field: 'buildId', value: 'x', why: WHY }]).applied, []);
  const r = applyRecommendations(null as any, [rec('settingEra', '1987')] as Recommendation[]);
  assert.equal(r.form.settingEra, '1987');
});

// ---------------------------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------------------------

test('UNDO ALL clears exactly what the analysis wrote', () => {
  const recs = [rec('baseGenres', ['Thriller']), rec('settingEra', '1987'), rec('spine.want', 'to stop it')] as Recommendation[];
  const { form, applied } = applyRecommendations(FORM, recs);
  const back = undoRecommendations(form, applied);
  assert.deepEqual(back.baseGenres, []);
  assert.equal(back.settingEra, '');
  assert.equal(back.spine.want, '');
});

test('UNDO leaves anything the user has since edited alone — it is theirs now', () => {
  const recs = [rec('baseGenres', ['Thriller']), rec('settingEra', '1987')] as Recommendation[];
  const { form, applied } = applyRecommendations(FORM, recs);
  const edited = { ...form, settingEra: 'my own words' };
  const back = undoRecommendations(edited, applied);
  assert.equal(back.settingEra, 'my own words', 'the user rewrote this — undo must not take it');
  assert.deepEqual(back.baseGenres, []);
});

test('undoRecommendations is fail-safe', () => {
  assert.deepEqual(undoRecommendations(FORM, null), FORM);
  assert.deepEqual(undoRecommendations(FORM, [{ field: 'nope', value: 1, why: WHY }] as any).baseGenres, []);
});

test('the banner can explain every field it filled', () => {
  const lines = explainRecommendations([
    rec('baseGenres', ['Thriller', 'Drama'], 'a silo procedural with a two-hander at its centre'),
    rec('settingEra', '1987', 'the treatment dates the story to 1987'),
  ] as Recommendation[]);
  assert.deepEqual(lines, [
    'baseGenres = Thriller, Drama — a silo procedural with a two-hander at its centre',
    'settingEra = 1987 — the treatment dates the story to 1987',
  ]);
  assert.deepEqual(explainRecommendations(null), []);
});

// ---------------------------------------------------------------------------------------------
// The whole point, end to end
// ---------------------------------------------------------------------------------------------

test('END TO END: two attached files fill the Brief softly, and everything unevidenced stays empty', () => {
  const modelReply = { fields: [
    { field: 'genre', value: ['Thriller', 'Drama'], why: 'a missile-silo procedural with a two-hander' },
    { field: 'tone', value: ['Grounded'], why: 'the material is written flat and procedural' },
    { field: 'mood', value: ['Foreboding', 'Tense'], why: 'a countdown runs under every scene' },
    { field: 'settingEra', value: '1987', why: 'the treatment opens on a dated duty log' },
    { field: 'settingCountry', value: 'Montana, United States', why: 'the capsule is a Montana wing' },
    { field: 'rating', value: 'US film · R', why: 'sustained threat and on-page deaths' },
    { field: 'spine.want', value: 'to stop the launch order', why: 'stated as the protagonist goal' },
    { field: 'projectType', value: 'FEATURE', why: 'described as a feature film throughout' },
    { field: 'loreDensity', value: 'MAXIMUM', why: 'no mythic layer is present' },
    { field: 'comps', value: ['WarGames', 'Fail Safe'], why: 'both named in the notes as touchstones' },
    { field: 'cultureEra', value: 'cold war', why: '' },
  ] };
  const recs = coerceRecommendations(modelReply, OPTS);
  assert.deepEqual(recs.map((r) => r.field).sort(),
    ['baseGenres', 'comps', 'moods', 'rating', 'settingCountry', 'settingEra', 'spine.want', 'tones']);

  const { form, applied } = applyRecommendations({ ...FORM, comps: [], settingCountry: '' }, recs, ['rating']);
  assert.deepEqual(form.baseGenres, ['Thriller', 'Drama']);
  assert.deepEqual(form.tones, ['Grounded']);
  assert.deepEqual(form.moods, ['Foreboding', 'Tense']);
  assert.equal(form.settingEra, '1987');
  assert.equal((form as any).rating, '', 'the user had already touched the rating');
  assert.equal((form as any).cultureEra, '', 'unevidenced: left EMPTY for the user to choose');
  assert.equal(applied.length, 7);

  const back = undoRecommendations(form, applied);
  assert.deepEqual(back.baseGenres, []);
  assert.equal(back.settingEra, '');
});

// ---------------------------------------------------------------------------------------------
// CRAFT CHOICES — style, ending and sub-genre
// ---------------------------------------------------------------------------------------------

test('spine.ending is DERIVED and unwritable; the ids behind it are what gets filled', () => {
  // composeEnding() builds spine.ending from endingIds plus the custom note. Writing the composed
  // string would light up nothing and be overwritten — the genres/tone mistake a second time.
  assert.equal(FIELD_SPECS['spine.ending'], undefined, 'spine.ending is composed, not chosen');
  assert.ok(FIELD_SPECS['spine.endingIds'], 'the ids are what the picker stores');
  assert.equal(canonicalField('ending'), 'spine.endingIds');
  assert.equal(canonicalField('endings'), 'spine.endingIds');
});

test('style, ending and sub-genre land on the fields the pickers really bind to', () => {
  const out = coerceRecommendations({ fields: [
    rec('style', ['slow_burn', 'chamber']),
    rec('ending', ['bittersweet', 'ambiguous']),
    rec('subgenre', ['Military', 'Survival']),
  ] }, OPTS);
  const by = new Map(out.map((r) => [r.field, r.value]));
  assert.deepEqual(by.get('styles'), ['slow_burn', 'chamber']);
  assert.deepEqual(by.get('spine.endingIds'), ['bittersweet', 'ambiguous']);
  assert.deepEqual(by.get('subgenres'), ['Military', 'Survival']);
});

test('the pickers\' own caps are honoured — two styles, two endings, three base genres', () => {
  const out = coerceRecommendations({ fields: [
    rec('styles', ['fast_ensemble', 'slow_burn', 'mythic_quest', 'chamber']),
    rec('spine.endingIds', ['resolved', 'tragic', 'twist', 'ambiguous']),
    rec('baseGenres', ['Thriller', 'Drama', 'War', 'Crime']),
  ] }, OPTS);
  const by = new Map(out.map((r) => [r.field, r.value]));
  assert.equal((by.get('styles') as string[]).length, 2);
  assert.equal((by.get('spine.endingIds') as string[]).length, 2);
  assert.equal((by.get('baseGenres') as string[]).length, 3);
});

test('an id the form does not offer is refused, exactly like any other option', () => {
  const out = coerceRecommendations({ fields: [
    rec('styles', ['tarantino_mode']), rec('spine.endingIds', ['everyone_wins']),
    rec('subgenres', ['Zombie apocalypse']),
  ] }, OPTS);
  assert.deepEqual(out, []);
});

test('a craft choice applies and undoes through the nested path like any other field', () => {
  const form = { ...FORM, styles: [], spine: { want: '', theme: '', endingIds: [] } };
  const recs = [rec('styles', ['chamber']), rec('spine.endingIds', ['ambiguous'])] as Recommendation[];
  const { form: next, applied } = applyRecommendations(form, recs);
  assert.deepEqual((next as any).styles, ['chamber']);
  assert.deepEqual((next as any).spine.endingIds, ['ambiguous']);
  assert.equal((next as any).spine.want, '', 'the sibling key survives');
  const back = undoRecommendations(next, applied);
  assert.deepEqual((back as any).styles, []);
  assert.deepEqual((back as any).spine.endingIds, []);
});

// ---------------------------------------------------------------------------------------------
// RESEARCH SCOPE — the one field the analysis NARROWS instead of filling
// ---------------------------------------------------------------------------------------------

test('research scope keeps the lanes the story needs and switches the rest off', () => {
  const out = coerceRecommendations({ fields: [
    rec('researchScope', ['subject', 'legal'], 'a real 1987 silo alert and a real chain of command'),
  ] }, OPTS);
  assert.equal(out.length, 1);
  assert.equal(out[0].field, 'researchScope');
  // Every lane is answered explicitly. A partial object would leave the missing ones to whatever
  // the form happened to hold, which is the merge bug this shape exists to prevent.
  assert.deepEqual(out[0].value, {
    subject: true, craft: false, mythology: false, comps: false, legal: true, general: false,
  });
});

test('research scope also accepts the object shape a model may answer with', () => {
  const out = coerceRecommendations({ fields: [
    rec('researchScope', { subject: true, comps: false, craft: true }),
  ] }, OPTS);
  assert.deepEqual(out[0].value, {
    subject: true, craft: true, mythology: false, comps: false, legal: false, general: false,
  });
});

test('a lane the form does not offer cannot be invented, and cannot switch a real one on', () => {
  const out = coerceRecommendations({ fields: [
    rec('researchScope', ['astrology', 'subject']),
  ] }, OPTS);
  assert.deepEqual(out[0].value, {
    subject: true, craft: false, mythology: false, comps: false, legal: false, general: false,
  });
  assert.equal((out[0].value as any).astrology, undefined, 'no seventh lane exists');
});

test('switching EVERY lane off is refused — that is a disable, not a narrowing', () => {
  assert.deepEqual(coerceRecommendations({ fields: [rec('researchScope', [])] }, OPTS), []);
  assert.deepEqual(coerceRecommendations({ fields: [
    rec('researchScope', { subject: false, craft: false, mythology: false, comps: false, legal: false, general: false }),
  ] }, OPTS), []);
});

test('research scope still obeys the reason rule and the option list being sent at all', () => {
  assert.deepEqual(coerceRecommendations({ fields: [{ field: 'researchScope', value: ['subject'], why: '' }] }, OPTS), []);
  assert.deepEqual(coerceRecommendations({ fields: [rec('researchScope', ['subject'])] }, {}), [],
    'no list from the form, no narrowing');
});

test('the all-on default is not a user decision, so an analysis may narrow it', () => {
  // Every other field is protected by holding a value. This one ships full, so presence can never
  // protect it — otherwise the panel could never be narrowed by anything.
  assert.equal(hasUserValue({ researchScope: SCOPE_ALL_ON }, 'researchScope'), false);
  const form = { ...FORM, researchScope: { ...SCOPE_ALL_ON } };
  const recs = coerceRecommendations({ fields: [rec('researchScope', ['subject', 'craft'])] }, OPTS);
  const { form: next, applied } = applyRecommendations(form, recs);
  assert.equal(applied.length, 1);
  assert.deepEqual((next as any).researchScope, {
    subject: true, craft: true, mythology: false, comps: false, legal: false, general: false,
  });
});

test('a lane the user has clicked is theirs — touched still wins over the analysis', () => {
  const form = { ...FORM, researchScope: { ...SCOPE_ALL_ON, comps: false } };
  const recs = coerceRecommendations({ fields: [rec('researchScope', ['subject'])] }, OPTS);
  const { form: next, applied, skipped } = applyRecommendations(form, recs, ['researchScope']);
  assert.equal(applied.length, 0);
  assert.equal(skipped.length, 1);
  assert.deepEqual((next as any).researchScope, { ...SCOPE_ALL_ON, comps: false });
});

test('undoing a narrowed scope puts every lane back on, not an empty panel', () => {
  const form = { ...FORM, researchScope: { ...SCOPE_ALL_ON } };
  const recs = coerceRecommendations({ fields: [rec('researchScope', ['subject'])] }, OPTS);
  const { form: next, applied } = applyRecommendations(form, recs);
  const back = undoRecommendations(next, applied);
  assert.deepEqual((back as any).researchScope, SCOPE_ALL_ON,
    'undo restores the on-by-default state, never a story with no research at all');
});

test('undo leaves a scope the user has re-edited alone', () => {
  const form = { ...FORM, researchScope: { ...SCOPE_ALL_ON } };
  const recs = coerceRecommendations({ fields: [rec('researchScope', ['subject'])] }, OPTS);
  const { form: next, applied } = applyRecommendations(form, recs);
  const edited = { ...(next as any), researchScope: { ...(next as any).researchScope, comps: true } };
  const back = undoRecommendations(edited, applied);
  assert.equal((back as any).researchScope.comps, true, 'their click survives');
  assert.equal((back as any).researchScope.mythology, false);
});

test('subgenre SINGULAR is derived from subMix and must never be written', () => {
  // reDna() computes `subgenre` as Object.keys(subMix)[0]. The picker stores subMix; writing the
  // singular field fills a value the form recomputes on the user's very next click.
  assert.equal(FIELD_SPECS['subgenre'], undefined, 'the singular is derived');
  assert.equal(FIELD_SPECS['subMix'], undefined, 'the mix carries sliders the analysis has no basis for');
  assert.equal(canonicalField('subgenre'), 'subgenres', 'the model\'s word reaches the list the form can use');
});

test('cultureEra and settingPlace are DERIVED too — reDna rebuilds both from settingCountry', () => {
  // reDna(): cultureEra = [settingCountry, settingEra].join(' · '), settingPlace = [settingCountry].
  // These were the fourth and fifth derived fields found in this form. The pattern is always the
  // same — the analysis succeeds completely and the panel looks untouched.
  assert.equal(FIELD_SPECS['cultureEra'], undefined, 'cultureEra is composed, not entered');
  assert.equal(FIELD_SPECS['settingPlace'], undefined, 'settingPlace mirrors settingCountry');
  assert.equal(canonicalField('culture'), 'settingCountry', 'the word reaches the field that survives');
  assert.equal(canonicalField('place'), 'settingCountry');
  assert.equal(canonicalField('locations'), 'settingCountry');
  assert.ok(FIELD_SPECS['settingCountry'], 'the source field is real and writable');
  assert.ok(FIELD_SPECS['settingEra'], 'so is the era');
});

test('EVERY derived field in the form is refused, in one place', () => {
  // The list a future change has to keep true. Each of these is computed by reDna() or
  // composeEnding() from a field that IS in the table.
  for (const derived of ['genres', 'tone', 'spine.ending', 'subgenre', 'baseGenre', 'cultureEra', 'settingPlace']) {
    assert.equal(FIELD_SPECS[derived], undefined, derived + ' is derived and must never be written');
  }
});

// ---------------------------------------------------------------------------------------------
// SALVAGE — a reply cut off mid-row must not cost the rows that finished
// ---------------------------------------------------------------------------------------------

/** The shape of the 3 Sep failure: fourteen good rows, then the output budget ran out mid-word. */
const TRUNCATED = '{"fields":[\n'
  + '{"field":"baseGenres","value":["Action","Thriller","Crime"],"why":"A betrayed heir trained as an assassin dismantles a criminal empire"},\n'
  + '{"field":"tones","value":["Grounded"],"why":"hits, ambushes and a snitch network, played straight"},\n'
  + '{"field":"framework","value":"three_act","why":"The pitch already breaks cleanly into privileged life and betray';

test('THE TRUNCATION: complete rows survive a reply that was cut off mid-word', () => {
  // extractJson returns null for this text — first { to last } is a broken object — so before
  // salvage the whole analysis was discarded and the Brief opened empty.
  assert.equal((() => { try { return JSON.parse(TRUNCATED); } catch { return null; } })(), null,
    'the fixture really is unparseable, or this test proves nothing');
  const rows = salvageRows(TRUNCATED);
  assert.equal(rows.length, 2, 'the two finished rows are kept; the third was cut and is dropped');
  assert.equal(rows[0].field, 'baseGenres');
  assert.deepEqual(rows[0].value, ['Action', 'Thriller', 'Crime']);
  assert.equal(rows[1].field, 'tones');
});

test('salvaged rows go through every gate a parsed reply does', () => {
  const out = coerceRecommendations({ fields: salvageRows(TRUNCATED) }, OPTS);
  const by = new Map(out.map((r) => [r.field, r.value]));
  assert.deepEqual(by.get('baseGenres'), ['Action', 'Thriller', 'Crime']);
  assert.deepEqual(by.get('tones'), ['Grounded']);
  assert.equal(by.get('framework'), undefined, 'the truncated row never existed');
});

test('an UNBALANCED brace inside a reason does not destroy the row', () => {
  // A balanced "{sic}" proves nothing — the row still parses whole either way. Only a lone closer
  // inside a string separates a string-aware scanner from a naive one: it pops the row's own
  // opening brace, and everything after is misaligned.
  const rows = salvageRows('{"fields":[{"field":"tones","value":["Ironic"],"why":"the margin note ends with a } and no opener"}]}');
  assert.equal(rows.length, 1, 'a brace inside a reason is text, not structure');
  assert.equal(rows[0].why, 'the margin note ends with a } and no opener');
});

test('an escaped quote inside a reason does not end the string early', () => {
  // A PAIR of escaped quotes hides the defect — the second one closes what the first wrongly
  // opened and the count re-aligns by luck. It takes ONE escaped quote, with a brace after it, to
  // separate a scanner that understands escapes from one that does not: without the escape rule
  // that \" ends the string, and the following } then pops the row's own opening brace.
  const rows = salvageRows('{"fields":[{"field":"moods","value":["Tense"],"why":"the note ends with a \\" and then a }"}]}');
  assert.equal(rows.length, 1, 'an escaped quote is text inside the reason, not the end of it');
  assert.equal(rows[0].field, 'moods');
});

test('an INTACT reply salvages to exactly the rows it declares', () => {
  const rows = salvageRows('{"fields":[{"field":"tones","value":["Epic"],"why":"a"},{"field":"moods","value":["Warm"],"why":"b"}]}');
  assert.deepEqual(rows.map((r: any) => r.field), ['tones', 'moods']);
});

test('salvageRows is fail-safe on junk and never throws', () => {
  for (const junk of ['', '   ', 'no json here at all', '}}}{{{', '{"fields":', null, undefined]) {
    assert.deepEqual(salvageRows(junk as any), [], JSON.stringify(junk));
  }
});

test('every kind the field table uses is declared, so a seventh cannot arrive half-wired', () => {
  // Before the KINDS table, what a kind MEANT was spelled in five places - coercion, the presence
  // exemption, undo's equality, undo's restore, and undo's empty ternary - and `flags` was named in
  // four of them. Adding a kind meant editing four spots that had to stay isomorphic by hand, with
  // nothing to catch a miss. This is that catch: a kind used by any field must be fully declared.
  const used = new Set(Object.values(FIELD_SPECS).map((s: any) => s.kind));
  const declared = new Set(DECLARED_KINDS);
  const undeclared = [...used].filter((k) => !declared.has(k as any));
  assert.deepEqual(undeclared, [], 'a field uses a kind KINDS does not declare: ' + undeclared.join(', '));
  assert.ok(used.size >= 4, 'expected the field table to exercise several kinds');
});

test('an unrecognised kind DROPS rather than throwing, which is how __proto__ stays harmless', () => {
  // FIELD_SPECS['__proto__'] resolves to Object.prototype - truthy, with an undefined `kind`. The
  // old if/else chain fell through and left the value null; a bare table lookup threw instead. This
  // module never throws, so the lookup is guarded and the value is dropped.
  const out = coerceRecommendations({ fields: [rec('__proto__', 'x'), rec('baseGenres', ['Drama'])] }, OPTS);
  assert.deepEqual(out.map((r) => r.field), ['baseGenres']);
});
