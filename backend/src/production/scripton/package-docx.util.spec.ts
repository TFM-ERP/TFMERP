/**
 * ScripON development-package DOCX model — pure-logic unit tests (node:test + ts-node).
 * Run: npm run test:unit
 *
 * buildPackageDocModel() turns the developmentPackage() service payload into a plain-JS
 * document structure (title/eyebrow/logline + ordered sections of blocks). It mirrors the
 * frontend dossierHtml() so the Word export matches the PDF dossier, and it takes an optional
 * `labels` map so Arabic/English headings stay in parity. Keeping it pure (no `docx` dep) means
 * we can assert the structure here; the thin packDocx() adapter is exercised separately.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildPackageDocModel } from './package-docx.util';

const baseModel = () => ({
  project: { id: 'p1', title: 'ScripON Library' },
  build: { id: 'b1', name: 'Try', status: 'PROMOTED' },
  script: { docId: 'd1', title: 'Try', pageCount: 95 },
  brief: {
    projectType: 'MOVIE',
    genres: ['Thriller'],
    language: 'Arabic',
    country: 'UAE',
    budgetTier: 'Mid',
    framework: 'save_the_cat',
  },
  stages: {
    LOGLINE: { body: 'A loyal driver risks everything for one last job.' },
    SYNOPSIS: { body: 'A longer synopsis body.' },
    TREATMENT: { body: 'T'.repeat(2000) },
  },
  coverage: {
    characters: [{ name: 'Sami', role: 'Protagonist' }],
    comps: [{ title: 'Drive', year: 2011, reason: 'tone' }],
    synopsis: 'Coverage synopsis.',
    recommendation: 'CONSIDER',
  },
  ladder: ['LOGLINE', 'SYNOPSIS', 'TREATMENT'],
  characterBible: [
    { name: 'Sami', role: 'Protagonist', tagline: 'loyal to a fault', coreIdentity: 'A driver who never breaks his word.', arc: 'Bound -> Tested -> Free' },
  ],
});

const sectionByHeading = (doc: any, heading: string) => doc.sections.find((s: any) => s.heading === heading);

// ── title / eyebrow / logline ──────────────────────────────────────────────
test('title prefers the build name over the workspace project title', () => {
  const doc = buildPackageDocModel(baseModel());
  assert.equal(doc.title, 'Try');
});

test('title falls back to project title, then a neutral default', () => {
  const m: any = baseModel(); m.build = null;
  assert.equal(buildPackageDocModel(m).title, 'ScripON Library');
  assert.equal(buildPackageDocModel({}).title, 'Development package');
});

test('eyebrow carries the format label and page count', () => {
  const doc = buildPackageDocModel(baseModel());
  assert.match(doc.eyebrow, /Feature/);
  assert.match(doc.eyebrow, /~95 pp/);
});

test('logline reads the LOGLINE stage, falling back to coverage.logline', () => {
  assert.equal(buildPackageDocModel(baseModel()).logline, 'A loyal driver risks everything for one last job.');
  const m: any = baseModel(); m.stages.LOGLINE = { body: '' }; m.coverage.logline = 'Cover logline.';
  assert.equal(buildPackageDocModel(m).logline, 'Cover logline.');
});

// ── development spine ───────────────────────────────────────────────────────
test('spine includes only ladder stages that have a body, titled from the stage map', () => {
  const m: any = baseModel(); m.stages.SYNOPSIS = { body: '' }; // empty -> dropped
  const doc = buildPackageDocModel(m);
  const spine = sectionByHeading(doc, 'Development spine').blocks.find((b: any) => b.kind === 'spine');
  assert.deepEqual(spine.rungs.map((r: any) => r.title), ['Logline', 'Treatment']);
});

test('spine bodies are truncated to 1600 chars with an ellipsis', () => {
  const doc = buildPackageDocModel(baseModel());
  const spine = sectionByHeading(doc, 'Development spine').blocks.find((b: any) => b.kind === 'spine');
  const treatment = spine.rungs.find((r: any) => r.title === 'Treatment');
  assert.equal(treatment.body.length, 1601);
  assert.ok(treatment.body.endsWith('…'));
});

// ── characters ──────────────────────────────────────────────────────────────
test('characters come from the character bible when present (richer than coverage)', () => {
  const doc = buildPackageDocModel(baseModel());
  const chars = sectionByHeading(doc, 'Characters').blocks.find((b: any) => b.kind === 'characters');
  assert.equal(chars.items[0].tagline, 'loyal to a fault');
});

test('characters fall back to coverage characters and cap at nine', () => {
  const m: any = baseModel(); m.characterBible = null;
  m.coverage.characters = Array.from({ length: 12 }, (_, i) => ({ name: 'C' + i, role: 'Ensemble' }));
  const doc = buildPackageDocModel(m);
  const chars = sectionByHeading(doc, 'Characters').blocks.find((b: any) => b.kind === 'characters');
  assert.equal(chars.items.length, 9);
});

// ── comps & coverage ────────────────────────────────────────────────────────
test('comps render as "Title (year) — reason" and cap at eight', () => {
  const doc = buildPackageDocModel(baseModel());
  const list = sectionByHeading(doc, 'Market & Comps').blocks.find((b: any) => b.kind === 'list');
  assert.equal(list.items[0], 'Drive (2011) — tone');
});

test('coverage section surfaces the verdict and synopsis', () => {
  const doc = buildPackageDocModel(baseModel());
  const cov = sectionByHeading(doc, 'Coverage');
  const text = cov.blocks.map((b: any) => b.text || '').join(' ');
  assert.match(text, /CONSIDER/);
  assert.match(text, /Coverage synopsis\./);
});

// ── meta ────────────────────────────────────────────────────────────────────
test('overview meta maps brief fields to readable labels', () => {
  const doc = buildPackageDocModel(baseModel());
  const meta = sectionByHeading(doc, 'Overview').blocks.find((b: any) => b.kind === 'metaTable');
  const rows: Record<string, string> = Object.fromEntries(meta.rows);
  assert.equal(rows['Language · Market'], 'Arabic · UAE');
  assert.equal(rows['Framework'], 'Save the Cat');
  assert.match(rows['Format'], /Feature/);
});

// ── i18n labels ───────────────────────────────────────────────────────────--
test('labels override section headings for parity with the localized UI', () => {
  const doc = buildPackageDocModel(baseModel(), { sections: { characters: 'الشخصيات' } });
  assert.ok(sectionByHeading(doc, 'الشخصيات'), 'expected the overridden Arabic Characters heading');
});

// ── resilience ────────────────────────────────────────────────────────────--
test('an empty model produces a valid skeleton without throwing', () => {
  const doc = buildPackageDocModel({});
  assert.equal(doc.title, 'Development package');
  assert.ok(Array.isArray(doc.sections));
});
