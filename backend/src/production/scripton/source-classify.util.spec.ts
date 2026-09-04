import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  segmentPassages, batchPassages, applyVerdicts, quarantinedDocs, passageBody,
  buildSourceBible, canReuseClassification, residualPaste,
  PASSAGE_TARGET_CHARS, PASSAGE_MAX_CHARS, CLASSIFY_BATCH_CHARS, MAX_CLASSIFY_BATCHES,
  SourceDoc, Passage, StoredPassage,
} from './source-classify.util';

const para = (n: number, word: string) => Array.from({ length: n }, () => word).join(' ');

// ---------------------------------------------------------------------------------------------
// Segmentation
// ---------------------------------------------------------------------------------------------

test('a passage slices back to exactly the text it points at', () => {
  const text = 'First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.';
  const [p] = segmentPassages([{ id: 'd', name: 'd.txt', text }], 20, 200);
  assert.equal(text.slice(p.start, p.end), 'First paragraph here.');
  assert.equal(p.chars, p.end - p.start);
  assert.equal(p.id, 'd#0');
  assert.equal(p.docId, 'd');
});

test('segmentPassages loses no words — the passages reconstruct the document', () => {
  const text = [para(40, 'alpha'), para(40, 'beta'), para(120, 'gamma'), para(10, 'delta')].join('\n\n');
  const out = segmentPassages([{ id: 'd', name: 'd.txt', text }]);
  const rebuilt = out.map((p) => text.slice(p.start, p.end)).join(' ').replace(/\s+/g, ' ').trim();
  assert.equal(rebuilt, text.replace(/\s+/g, ' ').trim());
});

test('passages accrete to the target and never exceed the maximum', () => {
  const text = Array.from({ length: 30 }, (_, i) => para(30, 'word' + i)).join('\n\n');
  const out = segmentPassages([{ id: 'd', name: 'd.txt', text }]);
  assert.ok(out.length > 1, 'a long document must produce more than one passage');
  for (const p of out) assert.ok(p.chars <= PASSAGE_MAX_CHARS, 'passage ' + p.id + ' is ' + p.chars + ' chars');
  // Every passage but the last reached the target — that is what "accrete to the target" means.
  for (const p of out.slice(0, -1)) assert.ok(p.chars >= PASSAGE_TARGET_CHARS * 0.5, p.id + ' is only ' + p.chars);
});

test('a single paragraph far over the maximum is split, not truncated', () => {
  const text = para(2000, 'relentless');
  const out = segmentPassages([{ id: 'd', name: 'd.txt', text }]);
  assert.ok(out.length > 1);
  for (const p of out) assert.ok(p.chars <= PASSAGE_MAX_CHARS);
  const rebuilt = out.map((p) => text.slice(p.start, p.end)).join('').replace(/\s+/g, ' ').trim();
  assert.equal(rebuilt, text.replace(/\s+/g, ' ').trim());
});

test('a paragraph with no sentences and no spaces still splits without losing a character', () => {
  const text = 'x'.repeat(6000);
  const out = segmentPassages([{ id: 'd', name: 'd.txt', text }]);
  assert.ok(out.length >= 3);
  assert.equal(out.map((p) => text.slice(p.start, p.end)).join(''), text);
});

test('segmentPassages is fail-safe on every empty and junk shape', () => {
  assert.deepEqual(segmentPassages(null), []);
  assert.deepEqual(segmentPassages([]), []);
  assert.deepEqual(segmentPassages([{ id: '', name: '', text: 'body' } as SourceDoc]), []);
  assert.deepEqual(segmentPassages([{ id: 'd', name: 'd', text: '   \n\n  \n ' } as SourceDoc]), []);
  assert.deepEqual(segmentPassages([null as any, undefined as any]), []);
  assert.equal(segmentPassages([{ id: 'd', name: 'd', text: 'x' } as SourceDoc]).length, 1);
});

test('CRLF paragraphs segment the same as LF ones', () => {
  const lf = 'One paragraph.\n\nTwo paragraph.';
  const crlf = 'One paragraph.\r\n\r\nTwo paragraph.';
  assert.equal(segmentPassages([{ id: 'd', name: 'd', text: lf }], 10, 100).length,
    segmentPassages([{ id: 'd', name: 'd', text: crlf }], 10, 100).length);
});

test('ids are stable and per document, so two documents never collide', () => {
  // Target 5 so every paragraph closes a passage on its own; the accretion rule is tested above.
  const out = segmentPassages([
    { id: '0', name: 'a.txt', text: 'Alpha one.\n\nAlpha two.' },
    { id: '1', name: 'b.txt', text: 'Beta one.\n\nBeta two.' },
  ], 5, 100);
  assert.deepEqual(out.map((p) => p.id), ['0#0', '0#1', '1#0', '1#1']);
  assert.deepEqual(out.map((p) => p.docId), ['0', '0', '1', '1']);
});

test('a paragraph under the target accretes with the next rather than standing alone', () => {
  // 'Beta one.' is nine characters against a ten-character target: it must NOT close a passage.
  const out = segmentPassages([{ id: '1', name: 'b.txt', text: 'Beta one.\n\nBeta two.' }], 10, 100);
  assert.equal(out.length, 1);
  assert.equal(out[0].chars, 20);
});

// ---------------------------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------------------------

const mkPassages = (docId: string, n: number, chars: number): Passage[] =>
  Array.from({ length: n }, (_, i) => ({ id: docId + '#' + i, docId, start: i * chars, end: (i + 1) * chars, chars }));

test('a batch never straddles documents — the document is a prior worth keeping', () => {
  const batches = batchPassages([...mkPassages('0', 2, 100), ...mkPassages('1', 2, 100)]);
  assert.equal(batches.length, 2);
  assert.deepEqual(batches[0].map((p) => p.docId), ['0', '0']);
  assert.deepEqual(batches[1].map((p) => p.docId), ['1', '1']);
});

test('a batch closes at the character budget', () => {
  const batches = batchPassages(mkPassages('0', 10, 1000), 2500);
  for (const b of batches) assert.ok(b.reduce((n, p) => n + p.chars, 0) <= 2500);
  assert.equal(batches.reduce((n, b) => n + b.length, 0), 10);
});

test('THE COST CAP: passages past the batch ceiling are dropped, never crammed in', () => {
  const batches = batchPassages(mkPassages('0', 100, 1000), 2000, 3);
  assert.equal(batches.length, 3);
  for (const b of batches) assert.ok(b.reduce((n, p) => n + p.chars, 0) <= 2000);
});

test('batchPassages is fail-safe', () => {
  assert.deepEqual(batchPassages(null), []);
  assert.deepEqual(batchPassages([]), []);
  assert.deepEqual(batchPassages([null as any, { id: '', docId: 'd', start: 0, end: 0, chars: 0 } as Passage]), []);
});

// ---------------------------------------------------------------------------------------------
// Verdict merge — the failure design
// ---------------------------------------------------------------------------------------------

const P: Passage[] = mkPassages('0', 3, 100);

test('a verdict lands on its passage, normalised', () => {
  const out = applyVerdicts(P, [{ id: '0#1', role: 'canon', subjects: [{ name: 'Elena Cross', kind: 'character' }], confidence: 0.8 }]);
  assert.equal(out[1].role, 'CANON');
  assert.deepEqual(out[1].subjects, [{ name: 'Elena Cross', kind: 'CHARACTER' }]);
  assert.equal(out[1].confidence, 0.8);
});

test('a passage the model did not answer for is UNCLASSIFIED, which behaves exactly as today', () => {
  const out = applyVerdicts(P, [{ id: '0#0', role: 'CANON', subjects: [], confidence: 1 }]);
  assert.equal(out[1].role, 'UNCLASSIFIED');
  assert.equal(out[2].role, 'UNCLASSIFIED');
  assert.deepEqual(out[2].subjects, []);
});

test('a role outside the four is refused rather than trusted', () => {
  const out = applyVerdicts(P, [{ id: '0#0', role: 'CANONICAL', subjects: [], confidence: 1 }]);
  assert.equal(out[0].role, 'UNCLASSIFIED');
});

test('ids the model invented are ignored', () => {
  const out = applyVerdicts(P, [{ id: '9#9', role: 'CANON', subjects: [], confidence: 1 }]);
  assert.equal(out.length, 3);
  for (const p of out) assert.equal(p.role, 'UNCLASSIFIED');
});

test('a subject kind the model made up degrades to OTHER; duplicates collapse', () => {
  const out = applyVerdicts(P, [{ id: '0#0', role: 'CANON', confidence: 0.5, subjects: [{ name: 'Silo', kind: 'LOCATION' }, { name: 'silo', kind: 'PLACE' }] }]);
  assert.deepEqual(out[0].subjects, [{ name: 'Silo', kind: 'OTHER' }]);
});

test('confidence is clamped and a missing one does not become NaN', () => {
  const out = applyVerdicts(P, [
    { id: '0#0', role: 'CANON', subjects: [], confidence: 5 },
    { id: '0#1', role: 'CANON', subjects: [], confidence: -2 },
    { id: '0#2', role: 'CANON', subjects: [] },
  ]);
  assert.equal(out[0].confidence, 1);
  assert.equal(out[1].confidence, 0);
  assert.equal(out[2].confidence, 0.5);
});

test('THE WHOLE FAILURE DESIGN: no verdicts at all leaves every passage exactly as it started', () => {
  for (const junk of [null, undefined, [], 'nonsense', {}, [null], [{}]]) {
    const out = applyVerdicts(P, junk as any);
    assert.equal(out.length, 3);
    for (const p of out) { assert.equal(p.role, 'UNCLASSIFIED'); assert.equal(p.confidence, 0); }
  }
});

// ---------------------------------------------------------------------------------------------
// THE QUARANTINE
// ---------------------------------------------------------------------------------------------

const TRUMAN = 'Truman walks the perfect street of Seahaven, waving at neighbours who are paid to wave back at him.';
const CANON_BODY = 'Elena Cross walks the long corridor of the silo, nodding at technicians who are paid to nod back at her.';

const QDOCS: SourceDoc[] = [
  { id: '0', name: 'treatment.pdf', text: CANON_BODY },
  { id: '1', name: 'truman-show.pdf', text: TRUMAN + '\n\n' + TRUMAN.replace('Truman', 'He') + '\n\n' + TRUMAN.replace('Truman', 'The man') },
];

const qPassages = (): StoredPassage[] => {
  const segs = segmentPassages(QDOCS, 10, 400);
  return segs.map((p) => ({
    ...p,
    // Document 1 is a comp screenplay: two REFERENCE and ONE STRAY CANON, the exact shape that
    // shipped. Document 0 is the real treatment.
    role: (p.docId === '0' ? 'CANON' : (p.id === '1#1' ? 'CANON' : 'REFERENCE')) as any,
    subjects: [{ name: p.docId === '0' ? 'ELENA CROSS' : 'TRUMAN', kind: 'CHARACTER' as any }],
    confidence: 0.9,
  }));
};

/** Every 8-word window of `body`, normalised — the unit a plagiarism check actually cares about. */
const windows8 = (body: string): string[] => {
  const w = body.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i + 8 <= w.length; i++) out.push(w.slice(i, i + 8).join(' '));
  return out;
};

test('THE QUARANTINE: no eight-word run of a reference body can appear anywhere in the bible', () => {
  const bible = buildSourceBible(QDOCS, qPassages());
  const haystack = [bible.brief, bible.full, bible.canonText, bible.instructions.join(' '),
    JSON.stringify(bible.research), JSON.stringify(bible.references)]
    .join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
  const runs = windows8(TRUMAN);
  assert.ok(runs.length >= 5, 'the fixture must be long enough to test');
  for (const run of runs) assert.ok(!haystack.includes(run), 'REFERENCE text leaked into the bible: ' + run);
});

test('THE QUARANTINE: a stray CANON tag inside a reference document leaks nothing', () => {
  const stored = qPassages();
  assert.ok(stored.some((p) => p.docId === '1' && p.role === 'CANON'), 'the fixture must contain the stray tag');
  const q = quarantinedDocs(stored);
  assert.ok(q.has('1'), 'the comp screenplay must be quarantined by plurality');
  assert.ok(!q.has('0'), 'the treatment must NOT be quarantined');
  const stray = stored.find((p) => p.docId === '1' && p.role === 'CANON') as StoredPassage;
  assert.equal(passageBody(QDOCS, stray, q), '', 'the stray CANON passage must still be unreadable');
  const bible = buildSourceBible(QDOCS, stored);
  assert.ok(!bible.canonText.toLowerCase().includes('seahaven'));
  assert.ok(bible.canonText.includes('Elena Cross'), 'real canon must survive the quarantine');
});

test('THE QUARANTINE: the ledger names the reference document without quoting a word of it', () => {
  const bible = buildSourceBible(QDOCS, qPassages());
  assert.deepEqual(bible.references, [{ doc: 'truman-show.pdf', why: 'cited as a reference; its text is never used' }]);
  assert.ok(bible.full.includes('truman-show.pdf'));
  assert.ok(!bible.full.toLowerCase().includes('seahaven'));
});

test('passageBody refuses a REFERENCE passage even in a document that is not quarantined', () => {
  const docs: SourceDoc[] = [{ id: '0', name: 'mixed.txt', text: 'Alpha body.\n\nBeta body.' }];
  const p = { docId: '0', start: 0, end: 11, role: 'REFERENCE' };
  assert.equal(passageBody(docs, p), '');
  assert.equal(passageBody(docs, { ...p, role: 'CANON' }), 'Alpha body.');
});

test('passageBody is fail-safe against junk offsets and missing documents', () => {
  const docs: SourceDoc[] = [{ id: '0', name: 'a.txt', text: 'Alpha body.' }];
  assert.equal(passageBody(docs, null), '');
  assert.equal(passageBody(null, { docId: '0', start: 0, end: 5, role: 'CANON' }), '');
  assert.equal(passageBody(docs, { docId: '9', start: 0, end: 5, role: 'CANON' }), '');
  assert.equal(passageBody(docs, { docId: '0', start: -50, end: 9999, role: 'CANON' }), 'Alpha body.');
  assert.equal(passageBody(docs, { docId: '0', start: 8, end: 2, role: 'CANON' }), '');
});

test('a tie between roles inside one document resolves to REFERENCE, the safe direction', () => {
  const stored: StoredPassage[] = [
    { id: '0#0', docId: '0', start: 0, end: 5, chars: 5, role: 'CANON', subjects: [], confidence: 1 },
    { id: '0#1', docId: '0', start: 5, end: 10, chars: 5, role: 'REFERENCE', subjects: [], confidence: 1 },
  ];
  assert.ok(quarantinedDocs(stored).has('0'));
});

test('UNCLASSIFIED passages never decide a document\'s plurality', () => {
  const stored: StoredPassage[] = [
    { id: '0#0', docId: '0', start: 0, end: 5, chars: 5, role: 'UNCLASSIFIED', subjects: [], confidence: 0 },
    { id: '0#1', docId: '0', start: 5, end: 10, chars: 5, role: 'UNCLASSIFIED', subjects: [], confidence: 0 },
    { id: '0#2', docId: '0', start: 10, end: 15, chars: 5, role: 'REFERENCE', subjects: [], confidence: 1 },
  ];
  assert.ok(quarantinedDocs(stored).has('0'));
  assert.deepEqual(Array.from(quarantinedDocs([])), []);
});

// ---------------------------------------------------------------------------------------------
// The distiller
// ---------------------------------------------------------------------------------------------

const BDOCS: SourceDoc[] = [
  { id: 'paste', name: 'Pasted text', text: 'Make the ending ambiguous.' },
  { id: '0', name: 'treatment.pdf', text: 'Elena Cross has run Echo-01 for eleven years.\n\nThe capsule sits sixty feet under Montana wheat.' },
  { id: '1', name: 'minuteman-history.pdf', text: 'The LGM-30G entered service in 1970.\n\nEach wing held fifty flights of ten silos.' },
  { id: '2', name: 'notes.txt', text: 'Make the ending ambiguous.' },
];

const bStored = (): StoredPassage[] => {
  const segs = segmentPassages(BDOCS, 10, 400);
  return segs.map((p) => {
    if (p.docId === 'paste' || p.docId === '2') return { ...p, role: 'INSTRUCTION' as any, subjects: [], confidence: 0.9 };
    if (p.docId === '0') return { ...p, role: 'CANON' as any, confidence: 0.9, subjects: [p.id === '0#0' ? { name: 'Elena Cross', kind: 'CHARACTER' as any } : { name: 'Echo-01', kind: 'PLACE' as any }] };
    return { ...p, role: 'RESEARCH' as any, confidence: 0.7, subjects: [{ name: 'Minuteman III', kind: 'EVENT' as any }] };
  });
};

test('the distiller is deterministic — the same inputs give byte-identical output', () => {
  const a = buildSourceBible(BDOCS, bStored());
  const b = buildSourceBible(BDOCS, bStored());
  assert.equal(a.full, b.full);
  assert.equal(a.brief, b.brief);
  assert.equal(a.canonText, b.canonText);
});

test('the instruction block is verbatim and deduplicated across the paste overlap', () => {
  const bible = buildSourceBible(BDOCS, bStored());
  assert.deepEqual(bible.instructions, ['Make the ending ambiguous.']);
  assert.equal((bible.full.match(/Make the ending ambiguous\./g) || []).length, 1);
});

test('the research index carries the subject and its documents, never the body', () => {
  const bible = buildSourceBible(BDOCS, bStored());
  assert.deepEqual(bible.research, [{ subject: 'MINUTEMAN III', passages: 2, docs: ['minuteman-history.pdf'] }]);
  assert.ok(bible.full.includes('MINUTEMAN III'));
  assert.ok(!bible.full.includes('LGM-30G'), 'a research BODY must not reach the bible');
});

test('canonText carries the canon bodies and nothing else', () => {
  const bible = buildSourceBible(BDOCS, bStored());
  assert.ok(bible.canonText.includes('Elena Cross has run Echo-01'));
  assert.ok(bible.canonText.includes('sixty feet under Montana wheat'));
  assert.ok(!bible.canonText.includes('LGM-30G'));
  assert.ok(!bible.canonText.includes('Make the ending ambiguous'));
});

test('canon subjects are bucketed by kind and carry a first sentence, not a paraphrase', () => {
  const bible = buildSourceBible(BDOCS, bStored());
  assert.ok(/CHARACTERS\n· ELENA CROSS — Elena Cross has run Echo-01 for eleven years\./.test(bible.full));
  assert.ok(/PLACES\n· ECHO-01 — The capsule sits sixty feet under Montana wheat\./.test(bible.full));
});

test('the brief rides on every scene prompt, so it is bounded and instructions come first', () => {
  const bible = buildSourceBible(BDOCS, bStored(), 300);
  assert.ok(bible.brief.length <= 300, 'brief was ' + bible.brief.length);
  assert.ok(bible.brief.indexOf('INSTRUCTION BLOCK') === 0);
  assert.ok(bible.brief.includes('Make the ending ambiguous.'));
});

test('counts report the EFFECTIVE roles, after quarantine escalation', () => {
  const bible = buildSourceBible(QDOCS, qPassages());
  assert.equal(bible.counts.REFERENCE, 3, 'the stray CANON must be counted as REFERENCE');
  assert.equal(bible.counts.CANON, 1);
});

test('an unclassified corpus produces an empty bible and blocks nothing', () => {
  const plain = applyVerdicts(segmentPassages(BDOCS), null);
  const bible = buildSourceBible(BDOCS, plain);
  assert.equal(bible.full, '');
  assert.equal(bible.brief, '');
  assert.equal(bible.canonText, '');
  assert.deepEqual(bible.instructions, []);
  assert.deepEqual(bible.references, []);
  assert.ok(bible.counts.UNCLASSIFIED > 0);
});

test('buildSourceBible is fail-safe on every junk shape', () => {
  for (const [d, p] of [[null, null], [[], []], [BDOCS, null], [null, bStored()]] as any[]) {
    const b = buildSourceBible(d, p);
    assert.equal(typeof b.full, 'string');
    assert.ok(Array.isArray(b.instructions));
  }
});

// ---------------------------------------------------------------------------------------------
// Reuse
// ---------------------------------------------------------------------------------------------

test('a classification is reused only when the source text is byte-identical', () => {
  const prev = { text: 'Body.', passages: [{ id: '0#0' }] };
  assert.equal(canReuseClassification({ text: 'Body.' }, prev), true);
  assert.equal(canReuseClassification({ text: 'Body!' }, prev), false);
  assert.equal(canReuseClassification({ text: '' }, prev), false);
  assert.equal(canReuseClassification({ text: 'Body.' }, { text: 'Body.', passages: [] }), false);
  assert.equal(canReuseClassification({ text: 'Body.' }, null), false);
  assert.equal(canReuseClassification(null, prev), false);
});

test('THE AGGREGATE LEAK: the paste document is the residue, not the whole corpus', () => {
  // After (1), sourceText is the assembled corpus — main box PLUS every source. Treating that as its
  // own document puts a copy of every comp screenplay inside a document the plurality rule will not
  // quarantine. The residue is the main box alone.
  const treatment = 'Elena Cross has run Echo-01 for eleven years.';
  const truman = 'Truman walks the perfect street of Seahaven.';
  const mainBox = 'A thriller set in a decommissioned silo.';
  const aggregate = [mainBox, treatment, truman].join('\n\n');
  const sources = [{ text: treatment }, { text: truman }];
  assert.equal(residualPaste(aggregate, sources), mainBox);
});

test('THE AGGREGATE LEAK: with the residue as the paste document, a quarantined body cannot reach canon', () => {
  const treatment = 'Elena Cross has run Echo-01 for eleven years.';
  const truman = 'Truman walks the perfect street of Seahaven, waving at neighbours paid to wave back.';
  const aggregate = [treatment, truman].join('\n\n');
  const sources = [{ text: treatment }, { text: truman }];
  const residue = residualPaste(aggregate, sources);
  assert.equal(residue, '', 'nothing is left once both sources are accounted for');
  const docs: SourceDoc[] = [
    { id: '0', name: 'treatment.pdf', text: treatment },
    { id: '1', name: 'truman-show.pdf', text: truman },
  ];
  const segs = segmentPassages(docs, 10, 400);
  const stored = applyVerdicts(segs, segs.map((p) => ({
    id: p.id, role: p.docId === '1' ? 'REFERENCE' : 'CANON', subjects: [], confidence: 0.9,
  })));
  const bible = buildSourceBible(docs, stored);
  assert.ok(!bible.canonText.includes('Seahaven'), 'the comp screenplay must not reach canon');
  assert.ok(bible.canonText.includes('Elena Cross'));
});

test('residualPaste refuses the residue rather than trust it when a source text survives removal', () => {
  // A shape assembleCorpus should never produce. Losing the main box is safe; keeping a reference is not.
  assert.equal(residualPaste('Body. Body.', [{ text: 'Body.' }]), '');
  assert.equal(residualPaste('Standalone note.', []), 'Standalone note.');
  assert.equal(residualPaste('', [{ text: 'x' }]), '');
  assert.equal(residualPaste(null, null), '');
});

test('residualPaste removes the longest source first so nested texts do not strand a remainder', () => {
  const long = 'The capsule sits sixty feet under Montana wheat.';
  const short = 'Montana';
  assert.equal(residualPaste(['Main box.', long].join('\n\n'), [{ text: short }, { text: long }]), 'Main box.');
});

test('the constants are the ones the spec fixed, not placeholders', () => {
  assert.equal(PASSAGE_TARGET_CHARS, 900);
  assert.equal(PASSAGE_MAX_CHARS, 2400);
  assert.equal(CLASSIFY_BATCH_CHARS, 24000);
  assert.equal(MAX_CLASSIFY_BATCHES, 12);
});
