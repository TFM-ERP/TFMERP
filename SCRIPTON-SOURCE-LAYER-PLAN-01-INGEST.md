# ScriptON Source Layer — Subsystem ① INGEST — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make uploaded files and submitted URLs become readable text, so a build created with two PDFs and an empty paste box works instead of stalling.

**Architecture:** A new pure utility, `source-ingest.util.ts`, extracts text from a buffer by file type — no Nest, no Prisma, no AI, no I/O. The service gains `materialiseSources()`, which reads files off disk, calls the existing hardened `ingestUrl()` for URLs, folds the extracted text back into the **existing** `sources` Json column, and rebuilds `sourceText` as the full corpus. Every current consumer (`adapt`, the ladder, `sourceMat`, the canon extractor) then sees real material without being modified.

**Tech Stack:** TypeScript · NestJS · `node:test` · `pdf-parse` ^1.1.1 · `mammoth` ^1.8.0 (both already in `package.json`)

**Spec:** `SCRIPTON-SOURCE-LAYER-SPEC.md` §3
**Restore point:** tag `scripton-pre-source-layer` (commit `3b99318`)

## Global Constraints

- **DEPENDENCY FREEZE.** Do not add, upgrade or install any package. `pdf-parse` and `mammoth` are already dependencies. Nothing else is permitted.
- **NO EPUB.** No zip library exists. Out of scope by decision.
- **NO OCR.** A scanned PDF is reported as unreadable, never solved.
- **Ingestion failure is never fatal to a build.** A source that cannot be read is reported by name and skipped.
- **Files are read from disk, never fetched.** Uploads live at `resolve(join(process.cwd(), 'uploads'))`. No HTTP, therefore no SSRF surface.
- **NO SCHEMA MIGRATION.** `sources` and `sourceText` are existing columns in `ScripOnService.INTAKE_COLS` (`scripton.service.ts:1071`). Use them.
- **Tests are `node:test`.** Every spec file uses `import { test } from 'node:test'` and `import { strict as assert } from 'node:assert'` — the **named** `strict as assert` form. Run with `npm run test:unit`, never `npm test`.
- **Maximum 3 files altered per commit** (project working rule).
- Current suite: **499 passing**. It must never go down.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/production/scripton/source-ingest.util.ts` | **Create.** Pure extraction: bytes + filename → text. One responsibility, no I/O. |
| `backend/src/production/scripton/source-ingest.util.spec.ts` | **Create.** Unit tests, one fixture per format. |
| `backend/src/production/scripton/scripton.service.ts` | **Modify.** `materialiseSources()`, `saveIntake` wiring, `adapt()` gate, `htmlToText` delegation. |

---

### Task 1: The module, its types, and text-native formats

**Files:**
- Create: `backend/src/production/scripton/source-ingest.util.ts`
- Test: `backend/src/production/scripton/source-ingest.util.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type SourceKind`, `interface ExtractResult { kind, text, chars, note? }`, `function kindOf(filename: string): SourceKind`, `async function extractText(buf: Buffer, filename: string): Promise<ExtractResult>`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/production/scripton/source-ingest.util.spec.ts`:

```ts
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { kindOf, extractText } from './source-ingest.util';

test('kindOf reads the extension, case-insensitively, and never throws', () => {
  assert.equal(kindOf('outline.PDF'), 'pdf');
  assert.equal(kindOf('notes.docx'), 'docx');
  assert.equal(kindOf('act-one.fountain'), 'fountain');
  assert.equal(kindOf('draft.fdx'), 'fdx');
  assert.equal(kindOf('page.html'), 'html');
  assert.equal(kindOf('page.htm'), 'html');
  assert.equal(kindOf('research.txt'), 'text');
  assert.equal(kindOf('research.md'), 'text');
  assert.equal(kindOf('mystery.xyz'), 'unknown');
  assert.equal(kindOf(''), 'unknown');
  assert.equal(kindOf(null as any), 'unknown');
});

test('a plain text source comes back whole, with its line structure intact', async () => {
  const body = 'INT. SILO - DAY\n\nCROSS waits.\n\nNothing happens.';
  const r = await extractText(Buffer.from(body, 'utf8'), 'scene.txt');
  assert.equal(r.kind, 'text');
  assert.equal(r.text, body);
  assert.equal(r.chars, body.length);
  assert.equal(r.note, undefined);
});

test('a fountain file is plain text — the format is already readable', async () => {
  const body = 'INT. CAPSULE - DAY\n\nCROSS\nNothing yet.';
  const r = await extractText(Buffer.from(body, 'utf8'), 'act-one.fountain');
  assert.equal(r.kind, 'fountain');
  assert.equal(r.text, body);
});

test('an unknown type is decoded as text rather than refused', async () => {
  // Refusing loses the user's material. Decoding a binary yields junk we can detect later.
  const r = await extractText(Buffer.from('some notes', 'utf8'), 'notes.rtfd');
  assert.equal(r.kind, 'unknown');
  assert.equal(r.text, 'some notes');
});

test('an empty buffer is reported, not thrown', async () => {
  const r = await extractText(Buffer.from('', 'utf8'), 'empty.txt');
  assert.equal(r.chars, 0);
  assert.match(String(r.note), /no readable text/i);
});
```

- [ ] **Step 2: Run it and confirm it fails**

```
cd C:\Projects\TFM-System\backend
```

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: FAIL — `Cannot find module './source-ingest.util'`.

- [ ] **Step 3: Write the module**

Create `backend/src/production/scripton/source-ingest.util.ts`:

```ts
/**
 * SOURCE INGESTION — bytes in, text out.
 *
 * Pure: no Nest, no Prisma, no AI, no filesystem, no network. Everything here is a function of its
 * arguments, which is what makes it testable and what keeps the I/O decisions in the service where
 * they can be reasoned about once.
 *
 * WHY THIS EXISTS. A build was created with two uploaded files and an empty paste box. It stalled,
 * and when pushed through it invented an Alaskan survival thriller for a missile-silo film — because
 * ScriptOnIntake built its aggregate from paste boxes only and nothing ever opened the files. The UI
 * had been promising "Accepts PDF, FDX, Fountain, Word, HTML" the whole time.
 */

export type SourceKind = 'pdf' | 'docx' | 'fountain' | 'fdx' | 'html' | 'text' | 'unknown';

export interface ExtractResult {
  kind: SourceKind;
  text: string;
  chars: number;
  /** Set ONLY when something is wrong the user should be told about, by name. */
  note?: string;
}

/** Below this a "document" has nothing in it worth calling source material. */
export const MIN_USEFUL_CHARS = 1;

/** Extension → kind. Never throws; anything unrecognised is 'unknown', never a refusal. */
export function kindOf(filename: any): SourceKind {
  const name = String(filename == null ? '' : filename).toLowerCase();
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1) : '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'fountain') return 'fountain';
  if (ext === 'fdx') return 'fdx';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'txt' || ext === 'md' || ext === 'markdown') return 'text';
  return 'unknown';
}

/** Trim trailing whitespace per line and collapse runs of blank lines, without touching structure. */
function tidy(raw: string): string {
  return String(raw || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function done(kind: SourceKind, text: string, note?: string): ExtractResult {
  const t = tidy(text);
  const out: ExtractResult = { kind, text: t, chars: t.length };
  if (note) out.note = note;
  else if (t.length < MIN_USEFUL_CHARS) out.note = 'no readable text in this file';
  return out;
}

/**
 * Extract text from a source file.
 *
 * NEVER THROWS. A source that cannot be read comes back with `chars: 0` and a `note` naming the
 * problem, because a build must not die because one of five uploads was a scan.
 */
export async function extractText(buf: Buffer, filename: string): Promise<ExtractResult> {
  const kind = kindOf(filename);
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf || ''), 'utf8');
  return done(kind, bytes.toString('utf8'));
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```
git add backend/src/production/scripton/source-ingest.util.ts backend/src/production/scripton/source-ingest.util.spec.ts
```

```
git commit -m "ScriptON: source-ingest util, text-native formats" -m "Pure extraction module: bytes + filename to text. Text, markdown and fountain are already readable and pass through. Never throws - an unreadable source returns chars 0 and a note naming the problem, because one bad upload must not kill a build." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Final Draft (.fdx)

**Files:**
- Modify: `backend/src/production/scripton/source-ingest.util.ts`
- Test: `backend/src/production/scripton/source-ingest.util.spec.ts`

**Interfaces:**
- Consumes: `extractText`, `done()`, `tidy()` from Task 1.
- Produces: no new exports. `extractText` now handles `kind === 'fdx'`.

- [ ] **Step 1: Write the failing test**

Append to `source-ingest.util.spec.ts`:

```ts
test('a Final Draft file yields the screenplay, not its XML', async () => {
  const fdx = [
    '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>',
    '<FinalDraft DocumentType="Script" Template="No" Version="1">',
    '<Content>',
    '<Paragraph Type="Scene Heading"><Text>INT. ECHO-01 CAPSULE - DAY</Text></Paragraph>',
    '<Paragraph Type="Action"><Text>Two officers at the console.</Text></Paragraph>',
    '<Paragraph Type="Character"><Text>CROSS</Text></Paragraph>',
    '<Paragraph Type="Dialogue"><Text>Authenticate.</Text></Paragraph>',
    '</Content>',
    '</FinalDraft>',
  ].join('\n');
  const r = await extractText(Buffer.from(fdx, 'utf8'), 'draft.fdx');
  assert.equal(r.kind, 'fdx');
  assert.match(r.text, /INT\. ECHO-01 CAPSULE - DAY/);
  assert.match(r.text, /Two officers at the console\./);
  assert.match(r.text, /CROSS/);
  assert.match(r.text, /Authenticate\./);
  assert.equal(/FinalDraft|Paragraph|DocumentType|<Text>/.test(r.text), false, 'no XML may survive');
});

test('a run of Text nodes inside one paragraph joins without a gap', async () => {
  // Final Draft splits a styled line into several <Text> nodes. They are ONE line.
  const fdx = '<Content><Paragraph Type="Action"><Text>He </Text><Text>waits.</Text></Paragraph></Content>';
  const r = await extractText(Buffer.from(fdx, 'utf8'), 'a.fdx');
  assert.equal(r.text, 'He waits.');
});

test('an fdx with no Text nodes at all is reported, not silently empty', async () => {
  const r = await extractText(Buffer.from('<FinalDraft><Content/></FinalDraft>', 'utf8'), 'b.fdx');
  assert.equal(r.chars, 0);
  assert.match(String(r.note), /no readable text/i);
});
```

- [ ] **Step 2: Run and confirm failure**

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: FAIL — the fdx test sees raw XML in `r.text`.

- [ ] **Step 3: Implement**

In `source-ingest.util.ts`, add this function above `extractText`:

```ts
/**
 * Final Draft is XML. Every line of screenplay lives in a <Text> node inside a <Paragraph>, and a
 * styled line is SPLIT across several <Text> nodes — so nodes join within a paragraph and paragraphs
 * become lines. Reading it any other way welds dialogue to the cue above it.
 */
export function fdxToText(xml: string): string {
  const src = String(xml || '');
  const paras: string[] = [];
  const paraRe = /<Paragraph\b[^>]*>([\s\S]*?)<\/Paragraph>/gi;
  let m: RegExpExecArray | null;
  while ((m = paraRe.exec(src)) !== null) {
    const inner = m[1];
    const parts: string[] = [];
    const textRe = /<Text\b[^>]*>([\s\S]*?)<\/Text>/gi;
    let t: RegExpExecArray | null;
    while ((t = textRe.exec(inner)) !== null) parts.push(t[1]);
    const line = parts.join('')
      .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&apos;/gi, "'")
      .replace(/&nbsp;/gi, ' ')
      .trim();
    if (line) paras.push(line);
  }
  return paras.join('\n');
}
```

Then change `extractText`'s body to dispatch:

```ts
export async function extractText(buf: Buffer, filename: string): Promise<ExtractResult> {
  const kind = kindOf(filename);
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf || ''), 'utf8');
  if (kind === 'fdx') return done(kind, fdxToText(bytes.toString('utf8')));
  return done(kind, bytes.toString('utf8'));
}
```

- [ ] **Step 4: Run and confirm pass**

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```
git add backend/src/production/scripton/source-ingest.util.ts backend/src/production/scripton/source-ingest.util.spec.ts
```

```
git commit -m "ScriptON: read Final Draft (.fdx) source files" -m "Text nodes join within a paragraph, paragraphs become lines. Final Draft splits a styled line across several Text nodes, so reading node-per-line would weld dialogue onto the character cue above it." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: HTML — move `htmlToText` out of the service

**Files:**
- Modify: `backend/src/production/scripton/source-ingest.util.ts`
- Modify: `backend/src/production/scripton/scripton.service.ts:3926-3936`
- Test: `backend/src/production/scripton/source-ingest.util.spec.ts`

**Interfaces:**
- Consumes: `done()` from Task 1.
- Produces: `function htmlToText(html: string, max?: number): { title: string; text: string }`. The service's private method becomes a one-line delegate to it. Two existing callers (`ingestHtml` at `scripton.service.ts:3937`, `ingestUrl` at `:3957`) keep working unchanged.

**Why move it:** it is a pure function sitting in a 350KB service, and `extractText` needs it. Copying it would violate the project's NO DUPLICATE CODE rule.

- [ ] **Step 1: Write the failing test**

Append to `source-ingest.util.spec.ts`:

```ts
import { htmlToText } from './source-ingest.util';

test('htmlToText keeps the readable body and drops script, style and comments', () => {
  const html = '<html><head><title>The Silo</title><style>b{}</style></head>'
    + '<body><script>x=1</script><!-- note --><h1>Chapter One</h1><p>Snow to every horizon.</p>'
    + '<p>Nothing moves.</p></body></html>';
  const r = htmlToText(html);
  assert.equal(r.title, 'The Silo');
  assert.match(r.text, /Chapter One/);
  assert.match(r.text, /Snow to every horizon\./);
  assert.equal(/x=1|b\{\}|note/.test(r.text), false, 'script, style and comments must not survive');
});

test('an HTML source file is read as its text', async () => {
  const html = '<html><body><p>He waits at the fence.</p></body></html>';
  const r = await extractText(Buffer.from(html, 'utf8'), 'chapter.html');
  assert.equal(r.kind, 'html');
  assert.equal(r.text, 'He waits at the fence.');
});
```

- [ ] **Step 2: Run and confirm failure**

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: FAIL — `htmlToText is not a function`.

- [ ] **Step 3a: Add `htmlToText` to the util**

In `source-ingest.util.ts`, add above `extractText` (this is the service's implementation moved verbatim, exported):

```ts
/**
 * HTML to readable text. MOVED HERE from ScripOnService, which held it as a private method — it is a
 * pure function and extractText needs it, and copying it would duplicate code the project forbids.
 * The service now delegates to this, so ingestHtml and ingestUrl are unchanged in behaviour.
 */
export function htmlToText(html: string, max = 40000): { title: string; text: string } {
  const h = String(html || '');
  const tm = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = tm ? tm[1].replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  let body = h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  body = body.replace(/<(br|\/p|\/div|\/h[1-6]|\/li)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ');
  body = body.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
  body = body.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  return { title, text: body.slice(0, max) };
}
```

Add the `html` branch to `extractText`, immediately after the `fdx` branch:

```ts
  if (kind === 'html') return done(kind, htmlToText(bytes.toString('utf8')).text);
```

- [ ] **Step 3b: Make the service delegate**

In `backend/src/production/scripton/scripton.service.ts`, add `htmlToText as htmlToTextUtil` to the import from `./source-ingest.util` (create that import line beside the other `./…util` imports at the top of the file), then replace the whole private method at lines 3926–3936 with:

```ts
  /** Delegates to source-ingest.util. Kept as a method so ingestHtml and ingestUrl are untouched. */
  private htmlToText(html: string, max = 40000): { title: string; text: string } {
    return htmlToTextUtil(html, max);
  }
```

- [ ] **Step 4: Run the util tests, then the whole suite**

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: PASS, 10 tests.

```
npm run test:unit
```

Expected: **499 + 10 = 509 passing, 0 failing.**

- [ ] **Step 5: Commit**

```
git add backend/src/production/scripton/source-ingest.util.ts backend/src/production/scripton/source-ingest.util.spec.ts backend/src/production/scripton/scripton.service.ts
```

```
git commit -m "ScriptON: read HTML sources; move htmlToText into the ingest util" -m "htmlToText was a pure function living as a private method on a 350KB service, and extractText needs it. Moved and exported; the service delegates, so ingestHtml and ingestUrl are unchanged." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: PDF

**Files:**
- Modify: `backend/src/production/scripton/source-ingest.util.ts`
- Test: `backend/src/production/scripton/source-ingest.util.spec.ts`

**Interfaces:**
- Consumes: `done()`.
- Produces: no new exports. `extractText` handles `kind === 'pdf'`.

**Library note:** `pdf-parse` ^1.1.1 is CommonJS. Load it with `require('pdf-parse')` inside the function — the same inline-require pattern the service already uses for `require('dns').promises` at `scripton.service.ts:3946`. It returns a promise of `{ text, numpages, info }`.

- [ ] **Step 1: Write the failing test**

Append to `source-ingest.util.spec.ts`:

```ts
test('a PDF with a text layer yields its text', async () => {
  // A minimal one-page PDF whose content stream draws a single line of text.
  const body = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 5 0 R>>>>/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj',
    '4 0 obj<</Length 58>>stream',
    'BT /F1 12 Tf 72 720 Td (Snow to every horizon.) Tj ET',
    'endstream endobj',
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
    'trailer<</Root 1 0 R>>',
  ].join('\n');
  const r = await extractText(Buffer.from(body, 'latin1'), 'chapter.pdf');
  assert.equal(r.kind, 'pdf');
  assert.match(r.text, /Snow to every horizon/);
});

test('THE SCAN CASE: a PDF with no text layer is named, not silently dropped', async () => {
  // A PDF with no content stream at all stands in for a scan: valid file, nothing to read.
  const body = ['%PDF-1.4', '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj', 'trailer<</Root 1 0 R>>'].join('\n');
  const r = await extractText(Buffer.from(body, 'latin1'), 'contract-notes.pdf');
  assert.equal(r.chars, 0);
  assert.match(String(r.note), /no readable text/i);
});

test('a corrupt PDF is a note, never a throw — one bad upload must not kill a build', async () => {
  const r = await extractText(Buffer.from('not a pdf at all', 'utf8'), 'broken.pdf');
  assert.equal(r.kind, 'pdf');
  assert.equal(r.chars, 0);
  assert.ok(r.note, 'a failure must always carry a note');
});
```

- [ ] **Step 2: Run and confirm failure**

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: FAIL — the first PDF test finds raw `%PDF-1.4` in `r.text`.

- [ ] **Step 3: Implement**

Add to `source-ingest.util.ts` above `extractText`:

```ts
/**
 * PDF text extraction via pdf-parse (already a dependency; the freeze holds).
 *
 * A PDF with no text layer is a SCAN. There is no OCR here by decision, so the honest outcome is a
 * named report — "contract-notes.pdf, no readable text, looks like a scan" — rather than a silent
 * empty string the user never learns about.
 */
async function pdfToText(bytes: Buffer): Promise<{ text: string; note?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse: any = require('pdf-parse');
    const out: any = await pdfParse(bytes);
    const text = String((out && out.text) || '');
    if (!text.trim()) return { text: '', note: 'no readable text (this looks like a scan — there is no text layer to read)' };
    return { text };
  } catch (e: any) {
    return { text: '', note: 'could not be read as a PDF (' + String((e && e.message) || 'unknown error').slice(0, 120) + ')' };
  }
}
```

Add the branch to `extractText`, after the `html` branch:

```ts
  if (kind === 'pdf') { const p = await pdfToText(bytes); return done(kind, p.text, p.note); }
```

- [ ] **Step 4: Run and confirm pass**

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```
git add backend/src/production/scripton/source-ingest.util.ts backend/src/production/scripton/source-ingest.util.spec.ts
```

```
git commit -m "ScriptON: read PDF sources" -m "pdf-parse, already a dependency. A PDF with no text layer is a scan; with OCR out of scope the honest outcome is a note naming the file, not a silent empty string. A corrupt PDF returns a note and never throws." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Word (.docx)

**Files:**
- Modify: `backend/src/production/scripton/source-ingest.util.ts`
- Test: `backend/src/production/scripton/source-ingest.util.spec.ts`

**Interfaces:**
- Consumes: `done()`.
- Produces: no new exports. `extractText` handles `kind === 'docx'`.

**Library note:** `mammoth` ^1.8.0 is already a dependency. `mammoth.extractRawText({ buffer })` resolves to `{ value, messages }`. Use `extractRawText`, not `convertToHtml` — the text is what is wanted, and converting to HTML then back would be a pointless round trip.

- [ ] **Step 1: Write the failing test**

Append to `source-ingest.util.spec.ts`:

```ts
test('a non-docx sent as .docx is a note, never a throw', async () => {
  const r = await extractText(Buffer.from('this is not a zip', 'utf8'), 'notes.docx');
  assert.equal(r.kind, 'docx');
  assert.equal(r.chars, 0);
  assert.ok(r.note, 'a failure must always carry a note');
  assert.equal(/no readable text|could not be read/i.test(String(r.note)), true);
});
```

> **Note for the implementer:** a real `.docx` is a zip archive and cannot be written inline as a
> string literal. This task tests the failure path only. The success path is covered end-to-end in
> Task 6 by dropping a real `.docx` into `uploads/`, which is also the only way it is ever used.

- [ ] **Step 2: Run and confirm failure**

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: FAIL — `r.chars` is 17, because the bytes are currently decoded as plain text.

- [ ] **Step 3: Implement**

Add to `source-ingest.util.ts` above `extractText`:

```ts
/** Word text via mammoth (already a dependency). Raw text, not HTML — no pointless round trip. */
async function docxToText(bytes: Buffer): Promise<{ text: string; note?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth: any = require('mammoth');
    const out: any = await mammoth.extractRawText({ buffer: bytes });
    const text = String((out && out.value) || '');
    if (!text.trim()) return { text: '', note: 'no readable text in this Word file' };
    return { text };
  } catch (e: any) {
    return { text: '', note: 'could not be read as a Word document (' + String((e && e.message) || 'unknown error').slice(0, 120) + ')' };
  }
}
```

Add the branch to `extractText`, after the `pdf` branch:

```ts
  if (kind === 'docx') { const d = await docxToText(bytes); return done(kind, d.text, d.note); }
```

- [ ] **Step 4: Run and confirm pass**

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```
git add backend/src/production/scripton/source-ingest.util.ts backend/src/production/scripton/source-ingest.util.spec.ts
```

```
git commit -m "ScriptON: read Word (.docx) sources" -m "mammoth extractRawText, already a dependency. Raw text rather than convertToHtml - the text is what is wanted and HTML would be a round trip. A file that is not a docx returns a note and never throws." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Wire it in — `materialiseSources`, `saveIntake`, and the `adapt()` gate

**Files:**
- Modify: `backend/src/production/scripton/scripton.service.ts`

**Interfaces:**
- Consumes: `extractText`, `kindOf`, `ExtractResult` from Tasks 1–5. Existing `ingestUrl(url)` at `scripton.service.ts:3940`.
- Produces: `private async materialiseSources(data: any): Promise<any>` — takes the intake payload, returns it with `sources[]` entries enriched (`text`, `chars`, `note`) and `sourceText` rebuilt as the full corpus.

**No schema migration.** `sources` and `sourceText` are already columns in `ScripOnService.INTAKE_COLS` (`scripton.service.ts:1071`). `sources` is Json, so per-source text rides inside it.

**Uploads live on disk.** `resolve(join(process.cwd(), 'uploads'))` — see `backend/src/files/files.module.ts:45`. A stored source URL looks like `/api/v1/uploads/<name>` and may carry a `?t=<token>` query. Take the last path segment, strip the query, validate the basename, and resolve inside the uploads directory. **Filesystem read, never a fetch.**

- [ ] **Step 1: Write the failing test**

Append to `source-ingest.util.spec.ts`:

```ts
import { uploadBasename } from './source-ingest.util';

test('the basename is recovered from every URL shape an upload can take', () => {
  assert.equal(uploadBasename('/api/v1/uploads/abc-123.pdf'), 'abc-123.pdf');
  assert.equal(uploadBasename('/api/v1/uploads/abc-123.pdf?t=xyz'), 'abc-123.pdf');
  assert.equal(uploadBasename('http://localhost:3001/api/v1/uploads/a.docx?t=1&x=2'), 'a.docx');
  assert.equal(uploadBasename('abc-123.pdf'), 'abc-123.pdf');
  assert.equal(uploadBasename('/api/v1/uploads/a%20b.pdf'), 'a b.pdf');
});

test('THE TRAVERSAL GUARD: nothing that could escape the uploads directory is returned', () => {
  assert.equal(uploadBasename('/api/v1/uploads/../../etc/passwd'), null);
  assert.equal(uploadBasename('..%2f..%2fetc%2fpasswd'), null);
  assert.equal(uploadBasename('/api/v1/uploads/a\0b.pdf'), null);
  assert.equal(uploadBasename(''), null);
  assert.equal(uploadBasename(null as any), null);
});
```

- [ ] **Step 2: Run and confirm failure**

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: FAIL — `uploadBasename is not a function`.

- [ ] **Step 3a: Add `uploadBasename` to the util**

Add to `source-ingest.util.ts`:

```ts
/**
 * The stored file name inside a source URL, or null if it is not one we will open.
 *
 * The rule mirrors files.module.ts's own `safeName` guard: decode once, refuse anything containing a
 * null byte or a traversal segment, and accept only a plain basename. Path safety is decided HERE,
 * on a string, where it can be unit-tested — not at the call site next to a filesystem read.
 */
export function uploadBasename(url: any): string | null {
  const raw = String(url == null ? '' : url).trim();
  if (!raw) return null;
  const noQuery = raw.split('?')[0].split('#')[0];
  const last = noQuery.split('/').pop() || '';
  let decoded: string;
  try { decoded = decodeURIComponent(last); } catch { return null; }
  if (!decoded || decoded.includes('\0') || decoded.includes('..')) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(decoded)) return null;
  return decoded;
}
```

- [ ] **Step 3b: Add `materialiseSources` to the service**

In `scripton.service.ts`, extend the import from `./source-ingest.util` to include `extractText, uploadBasename`, and add `import { readFile } from 'fs/promises';` plus `import { join, resolve, sep } from 'path';` if not already present. Then add this method immediately above `saveIntake` (`scripton.service.ts:1072`):

```ts
  /**
   * TURN EVERY SUBMITTED SOURCE INTO TEXT.
   *
   * The defect this fixes: ScriptOnIntake built its aggregate from paste boxes only
   * (`[f.sourceText].concat(pastes)`), so uploaded files and URLs were carried as URL strings that
   * nothing ever opened. A build with two PDFs and an empty paste box reached the adapt gate with an
   * empty source and was told to "paste a synopsis" — and when pushed through, invented a story.
   *
   * Runs at intake save, so every existing consumer (adapt, the ladder, sourceMat, the canon
   * extractor) sees real material without being changed.
   *
   * NEVER FATAL. A source that cannot be read is recorded with a note naming it, and the others go on.
   */
  private async materialiseSources(data: any): Promise<any> {
    if (!data || !Array.isArray(data.sources) || !data.sources.length) return data;
    const uploadsDir = resolve(join(process.cwd(), 'uploads'));
    const out: any[] = [];
    for (const s of data.sources) {
      const src: any = { ...(s || {}) };
      try {
        if (src.kind === 'paste') {
          src.text = String(src.value || '');
        } else if (src.kind === 'url') {
          const r: any = await this.ingestUrl(String(src.value || ''));
          src.text = String((r && r.text) || '');
          if (r && r.title && !src.name) src.name = r.title;
        } else if (src.kind === 'file') {
          const base = uploadBasename(src.value);
          const full = base ? resolve(join(uploadsDir, base)) : null;
          if (!full || (full !== uploadsDir && !full.startsWith(uploadsDir + sep))) {
            src.text = ''; src.note = 'this file could not be located';
          } else {
            const bytes = await readFile(full);
            const ex = await extractText(bytes, String(src.name || base));
            src.text = ex.text;
            if (ex.note) src.note = ex.note;
          }
        }
      } catch (e: any) {
        src.text = '';
        src.note = 'could not be read — ' + this.why(e);
      }
      src.chars = String(src.text || '').length;
      out.push(src);
    }
    const unreadable = out.filter((s) => s.note).map((s) => (s.name || s.kind) + ': ' + s.note);
    if (unreadable.length) this.log.warn('materialiseSources: ' + unreadable.length + ' source(s) could not be read — ' + unreadable.join(' · '));
    const corpus = out.map((s) => String(s.text || '')).filter((t) => t.trim()).join('\n\n');
    this.log.log('materialiseSources: ' + out.length + ' source(s), ' + corpus.length + ' chars of material.');
    return { ...data, sources: out, sourceText: corpus || String(data.sourceText || '') };
  }
```

- [ ] **Step 3c: Call it from `saveIntake`**

Replace `saveIntake` (`scripton.service.ts:1072-1075`) with:

```ts
  async saveIntake(projectId: string, data: any) {
    const materialised = await this.materialiseSources(data);
    const d: any = {}; for (const k of ScripOnService.INTAKE_COLS) { if (materialised && materialised[k] !== undefined) d[k] = materialised[k]; }
    return (this.prisma as any).intakeProfile.upsert({ where: { projectId }, create: { projectId, ...d }, update: d });
  }
```

- [ ] **Step 3d: Fix the `adapt()` gate**

Replace `scripton.service.ts:346-347` with:

```ts
    // The gate reads the MATERIALISED corpus. It used to read opts.sourceText alone, which was the
    // paste boxes only — so a build with two uploaded files failed here saying "paste a synopsis".
    const fromSources = Array.isArray(opts?.sources)
      ? opts.sources.map((s: any) => String((s && s.text) || '')).filter((t: string) => t.trim()).join('\n\n')
      : '';
    const source = String(opts?.sourceText || opts?.source || '') || fromSources;
    if (source.trim().length < 40) throw new BadRequestException('Add a synopsis, a file or a link to the source work (a few sentences minimum).');
```

- [ ] **Step 4: Run the util tests, then the whole suite, then build**

```
node --require ts-node/register --test src/production/scripton/source-ingest.util.spec.ts
```

Expected: PASS, 16 tests.

```
npm run test:unit
```

Expected: **515 passing, 0 failing.**

```
npm run build
```

Expected: clean.

- [ ] **Step 5: Verify against the real defect**

Restart the backend, then create a build with **an empty paste box and one PDF uploaded**. It must reach the Brief page instead of stalling at 75%. The backend log must show:

```
materialiseSources: 1 source(s), NNNNN chars of material.
```

If a scanned PDF is used instead, the log must name it:

```
materialiseSources: 1 source(s) could not be read — mydoc.pdf: no readable text (this looks like a scan…)
```

- [ ] **Step 6: Commit**

```
git add backend/src/production/scripton/source-ingest.util.ts backend/src/production/scripton/source-ingest.util.spec.ts backend/src/production/scripton/scripton.service.ts
```

```
git commit -m "ScriptON: uploaded files and URLs become source text" -m "materialiseSources runs at intake save and turns every submitted source into text, folding it into the existing sources Json column and rebuilding sourceText. No schema migration. Files are read from disk with a traversal guard mirroring files.module.ts; URLs go through the existing hardened ingestUrl. A source that cannot be read is named in the log and skipped - never fatal." -m "Fixes: a build created with two uploaded files and an empty paste box stalled at the adapt gate, and when pushed through invented a story unrelated to the source." -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## After this plan

Subsystem ① is shippable on its own and unblocks builds immediately. Two follow-ups belong to it but are not blocking:

1. **Remove EPUB from the intake's `Accepts …` line** (`ScriptOnIntake.tsx:361`) — no zip library, so it is a promise that cannot be kept. One-line frontend change.
2. **Show unreadable sources in the UI**, not only the backend log. The `note` field is already carried on each source; the intake needs to render it.

Subsystem ② (classify + distil) gets its own plan once ① is verified against a real build.
