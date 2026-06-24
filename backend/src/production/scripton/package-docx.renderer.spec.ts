/**
 * ScripON package DOCX renderer — integration test (node:test + ts-node).
 * Run: npm run test:unit
 *
 * packDocx() turns the pure doc model into a real .docx buffer via the `docx` library.
 * We verify it round-trips by extracting the text back out with `mammoth` (already a dep)
 * and asserting the dossier content survived the render.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as mammoth from 'mammoth';
import { buildPackageDocModel } from './package-docx.util';
import { packDocx } from './package-docx.renderer';

const model = {
  build: { id: 'b1', name: 'Try', status: 'PROMOTED' },
  project: { id: 'p1', title: 'ScripON Library' },
  script: { docId: 'd1', pageCount: 95 },
  brief: { projectType: 'MOVIE', language: 'Arabic', country: 'UAE', framework: 'save_the_cat' },
  stages: { LOGLINE: { body: 'A loyal driver risks everything.' }, TREATMENT: { body: 'The treatment body.' } },
  coverage: { comps: [{ title: 'Drive', year: 2011, reason: 'tone' }], synopsis: 'Coverage synopsis.', recommendation: 'CONSIDER' },
  ladder: ['LOGLINE', 'TREATMENT'],
  characterBible: [{ name: 'Sami', role: 'Protagonist', tagline: 'loyal to a fault', coreIdentity: 'A driver who never breaks his word.', arc: 'Bound -> Free' }],
};

test('packDocx produces a valid .docx container (zip signature)', async () => {
  const buf = await packDocx(buildPackageDocModel(model));
  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 0);
  assert.equal(buf.slice(0, 2).toString('latin1'), 'PK'); // ZIP/OOXML magic
});

test('the rendered document carries the dossier content', async () => {
  const buf = await packDocx(buildPackageDocModel(model));
  const { value: textRaw } = await mammoth.extractRawText({ buffer: buf });
  const text = textRaw.replace(/\s+/g, ' ');
  assert.match(text, /Try/);                       // title
  assert.match(text, /A loyal driver risks everything\./); // logline
  assert.match(text, /Development spine/);          // section heading
  assert.match(text, /Treatment/);                  // spine rung
  assert.match(text, /Sami/);                       // character
  assert.match(text, /Drive \(2011\)/);             // comp
  assert.match(text, /CONSIDER/);                   // coverage verdict
});

test('localized labels propagate into the rendered document', async () => {
  const doc = buildPackageDocModel(model, { sections: { characters: 'الشخصيات' } });
  const buf = await packDocx(doc);
  const { value: text } = await mammoth.extractRawText({ buffer: buf });
  assert.match(text, /الشخصيات/);
});
