import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { kindOf, extractText, fdxToText, htmlToText, uploadBasename, assembleCorpus, canReuseExtraction, kindFromContentType, MAX_REMOTE_BYTES } from './source-ingest.util';

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
  // Refusing loses the user's material. A genuine binary decoded this way is now detected and
  // reported (see "a real binary sent as an unrecognised type is reported, not folded into the
  // corpus as mojibake" below) — this case is ordinary readable text with no binary markers.
  const r = await extractText(Buffer.from('some notes', 'utf8'), 'notes.rtfd');
  assert.equal(r.kind, 'unknown');
  assert.equal(r.text, 'some notes');
});

test('I1: a real binary sent as an unrecognised type is reported, not folded into the corpus as mojibake', async () => {
  // PK\x03\x04 is the zip local-file-header magic (EPUB, and DOCX-as-zip, both start this way).
  // 0xFF is not a valid UTF-8 lead byte, so decoding this buffer as UTF-8 yields a wall of U+FFFD
  // replacement characters — exactly what a real EPUB produces when routed through the old
  // 'unknown' fallthrough with no binary check: chars > 0, note undefined, junk in the AI prompt.
  const bytes = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(200, 0xff)]);
  const r = await extractText(bytes, 'notes.epub');
  assert.equal(r.kind, 'unknown');
  assert.equal(r.chars, 0);
  assert.equal(r.note, 'this file is not readable as text');
});

test('I1: a single NUL byte marks a file binary even below the replacement-character density threshold', async () => {
  const bytes = Buffer.concat([Buffer.from('Plenty of perfectly ordinary readable text right here.', 'utf8'), Buffer.from([0x00])]);
  const r = await extractText(bytes, 'weird.dat');
  assert.equal(r.chars, 0);
  assert.equal(r.note, 'this file is not readable as text');
});

test('an empty buffer is reported, not thrown', async () => {
  const r = await extractText(Buffer.from('', 'utf8'), 'empty.txt');
  assert.equal(r.chars, 0);
  assert.match(String(r.note), /no readable text/i);
});

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

test('entity decoding does not cascade — a literal &lt; stays escaped, never becomes markup', () => {
  // &amp;lt; is the correct XML escaping for the literal text "&lt;". A chained, re-scanning
  // decode turns the '&' produced by decoding &amp; into a fresh entity when it hits the
  // following "lt;", synthesising markup out of legitimately escaped content.
  const out = fdxToText('<Paragraph><Text>&amp;lt;script&amp;gt;</Text></Paragraph>');
  assert.equal(out, '&lt;script&gt;');
});

test('a self-closing <Text/> is skipped as empty and does not leak the next opening tag', () => {
  const out = fdxToText('<Paragraph><Text>He </Text><Text/><Text>waits.</Text></Paragraph>');
  assert.equal(out, 'He waits.');
});

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

test('htmlToText does not cascade entity decoding either — an escaped &lt; stays escaped', () => {
  // Same defect as the FDX decoder, in the HTML branch: a chained sequence of .replace() calls
  // decoding &amp; before &lt;/&gt; turns "&amp;lt;script&amp;gt;" (correct escaping for the
  // literal text "&lt;script&gt;") into synthesised "<script>" markup.
  const html = '<html><body><p>&amp;lt;script&amp;gt;</p></body></html>';
  const r = htmlToText(html);
  assert.equal(r.text, '&lt;script&gt;');
});

test('I2: an HTML source file is not silently truncated at htmlToText\'s 40000-char web-page default', async () => {
  // The same content saved as .txt survives whole; as .html it used to lose everything past 40000
  // characters with no note, because extractText called htmlToText with its default max. A file the
  // user chose to keep is not a fetched web page — the html branch alone must not truncate there.
  const filler = 'x'.repeat(45000);
  const html = '<html><body><p>' + filler + '</p><p>TAIL-MARKER-PAST-40K</p></body></html>';
  const r = await extractText(Buffer.from(html, 'utf8'), 'manuscript.html');
  assert.equal(r.kind, 'html');
  assert.match(r.text, /TAIL-MARKER-PAST-40K/);
});

/**
 * Build a small but genuinely valid PDF: a classic xref table with byte-accurate offsets, computed
 * here rather than hand-typed so there is no arithmetic to get wrong.
 *
 * PADDING, AND WHY IT'S HERE: a hand-written minimal PDF (correct offsets, proper xref table, no
 * different from this one apart from size) reliably threw "bad XRef entry" out of pdf-parse@1.1.1.
 * Tracing it down: pdf-parse vendors a ~2016 copy of pdf.js, and that vendored engine corrupts its
 * own internal re-buffering of small PDFs — reproducibly, below roughly 4KB — so every object it
 * fetches reads eight bytes short of where the xref table correctly says it is. This was confirmed
 * empirically, not guessed: the exact same structure, byte-for-byte, fails below ~4KB and succeeds
 * above it purely as a function of total file size, with correct offsets throughout in both cases.
 * It was ALSO confirmed that this is not inherited from the caller's buffer: the identical
 * corruption reproduces with an input buffer at byteOffset 0 and no pool slack at all, so passing
 * an unpooled buffer does not avoid it — don't waste time on that. The bug is inside pdf-parse/
 * pdf.js itself, not in the file or the caller, so the fix here is to pad the file past that size
 * with an ordinary PDF comment (legal anywhere outside a stream or string — PDF32000-1:2008
 * §7.2.4) rather than hand-adjusting a correct xref table to dodge a bug two library versions deep.
 */
function buildMinimalPdf(objBodies: string[], rootObjNum: number): Buffer {
  const PAD_COMMENT_LEN = 4300; // pushes the file safely past Node's ~4KB buffer-pooling cutoff
  let out = '%PDF-1.4\n%' + 'P'.repeat(PAD_COMMENT_LEN) + '\n';
  const offsets: number[] = [0];
  for (let i = 0; i < objBodies.length; i++) {
    const num = i + 1;
    offsets[num] = Buffer.byteLength(out, 'latin1');
    out += num + ' 0 obj\n' + objBodies[i] + '\nendobj\n';
  }
  const xrefOffset = Buffer.byteLength(out, 'latin1');
  const n = objBodies.length + 1;
  out += 'xref\n0 ' + n + '\n0000000000 65535 f \n';
  for (let num = 1; num < n; num++) out += String(offsets[num]).padStart(10, '0') + ' 00000 n \n';
  out += 'trailer\n<</Size ' + n + '/Root ' + rootObjNum + ' 0 R>>\nstartxref\n' + xrefOffset + '\n%%EOF';
  return Buffer.from(out, 'latin1');
}

test('a PDF with a text layer yields its text', async () => {
  // A minimal one-page PDF whose content stream draws a single line of text.
  const content = 'BT /F1 12 Tf 72 720 Td (Snow to every horizon.) Tj ET';
  const pdf = buildMinimalPdf(
    [
      '<</Type/Catalog/Pages 2 0 R>>',
      '<</Type/Pages/Kids[3 0 R]/Count 1>>',
      '<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 5 0 R>>>>/MediaBox[0 0 612 792]/Contents 4 0 R>>',
      '<</Length ' + Buffer.byteLength(content, 'latin1') + '>>\nstream\n' + content + '\nendstream',
      '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    ],
    1,
  );
  const r = await extractText(pdf, 'chapter.pdf');
  assert.equal(r.kind, 'pdf');
  assert.match(r.text, /Snow to every horizon/);
  // The fixture's content stream is uncompressed, so the phrase above sits verbatim in the raw
  // file bytes too — matching it alone can't tell "pdf-parse extracted this" apart from "nobody
  // parsed anything and this is just the raw file". Rule out the fallback explicitly, the same way
  // the FDX and HTML tests above prove their markup didn't survive: none of the surrounding PDF
  // syntax may appear in the output.
  for (const marker of ['%PDF', 'obj', 'endobj', 'stream', 'endstream', 'xref', 'trailer', '/Type', 'startxref']) {
    assert.equal(r.text.includes(marker), false, `PDF syntax "${marker}" must not survive extraction`);
  }
});

test('THE SCAN CASE: a PDF with no text layer is named, not silently dropped', async () => {
  // A valid page with no content stream at all stands in for a scan: readable file, nothing to read.
  const pdf = buildMinimalPdf(
    [
      '<</Type/Catalog/Pages 2 0 R>>',
      '<</Type/Pages/Kids[3 0 R]/Count 1>>',
      '<</Type/Page/Parent 2 0 R/Resources<<>>/MediaBox[0 0 612 792]>>',
    ],
    1,
  );
  const r = await extractText(pdf, 'contract-notes.pdf');
  assert.equal(r.chars, 0);
  assert.match(String(r.note), /no readable text/i);
});

test('a corrupt PDF is a note, never a throw — one bad upload must not kill a build', async () => {
  const r = await extractText(Buffer.from('not a pdf at all', 'utf8'), 'broken.pdf');
  assert.equal(r.kind, 'pdf');
  assert.equal(r.chars, 0);
  assert.ok(r.note, 'a failure must always carry a note');
});

test('a non-docx sent as .docx is a note, never a throw', async () => {
  const r = await extractText(Buffer.from('this is not a zip', 'utf8'), 'notes.docx');
  assert.equal(r.kind, 'docx');
  assert.equal(r.chars, 0);
  assert.ok(r.note, 'a failure must always carry a note');
  assert.equal(/no readable text|could not be read/i.test(String(r.note)), true);
});

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

test('C2/I5: assembleCorpus keeps the main paste box alongside a file source', () => {
  const out = assembleCorpus([{ text: 'FILE CONTENT FROM A PDF.' }], 'A typed synopsis the user wrote.');
  assert.match(out, /A typed synopsis the user wrote\./);
  assert.match(out, /FILE CONTENT FROM A PDF\./);
});

test('C2/I5: assembleCorpus does not duplicate a paste box already folded into a source', () => {
  // Re-saving an already-assembled corpus (the paste box text now sits inside out[0].text from a
  // prior save) must not prepend it again and double it.
  const pasted = 'Shared synopsis text.';
  const out = assembleCorpus([{ text: 'Prefix. ' + pasted + ' Suffix.' }], pasted);
  assert.equal((out.match(/Shared synopsis text\./g) || []).length, 1);
});

test('C2/I5: assembleCorpus keeps the MAIN paste box when extra paste boxes are the only sources', () => {
  // The exact payload ScriptOnIntake.begin() sends: `sourceText` is the aggregate of the main box
  // and every extra paste box, while the extra boxes ALSO arrive individually in `sources`. The
  // aggregate is the superset and must be what survives. Selecting `parts` here dropped the main
  // box entirely — a user who typed a synopsis and added one extra box lost the synopsis.
  const main = 'MAIN BOX: a trauma paramedic in a missile silo.';
  const extra = 'EXTRA BOX: the crew roster.';
  const out = assembleCorpus([{ text: extra }], [main, extra].join('\n\n'));
  assert.match(out, /MAIN BOX: a trauma paramedic in a missile silo\./);
  assert.match(out, /EXTRA BOX: the crew roster\./);
  assert.equal((out.match(/EXTRA BOX: the crew roster\./g) || []).length, 1);
});

test('C2/I5: assembleCorpus keeps main box, extra box and a file source together, each exactly once', () => {
  const main = 'MAIN BOX TEXT.';
  const extra = 'EXTRA BOX TEXT.';
  const file = 'FILE CONTENT FROM A PDF.';
  const out = assembleCorpus([{ text: extra }, { text: file }], [main, extra].join('\n\n'));
  for (const t of [main, extra, file]) {
    assert.equal((out.split(t).length - 1), 1, 'expected exactly one copy of: ' + t);
  }
});

test('C2/I5: assembleCorpus falls back to the paste text when there are no sources, or none with text', () => {
  assert.equal(assembleCorpus([], 'Only a synopsis, nothing uploaded.'), 'Only a synopsis, nothing uploaded.');
  assert.equal(assembleCorpus([{ text: '' }], 'Only a synopsis, nothing uploaded.'), 'Only a synopsis, nothing uploaded.');
});

test('C2/I5: assembleCorpus gives an empty string when there is no material at all', () => {
  assert.equal(assembleCorpus([], ''), '');
  assert.equal(assembleCorpus([{ text: '' }], null), '');
});

test('I3: canReuseExtraction reuses a file/url source whose value is unchanged and already carries text', () => {
  const incoming = { kind: 'file', value: '/api/v1/uploads/abc-123.pdf', text: 'Previously extracted text.' };
  const previous = { value: '/api/v1/uploads/abc-123.pdf' };
  assert.equal(canReuseExtraction(incoming, previous), true);
});

test('I3: canReuseExtraction re-extracts when the value has changed since the last save', () => {
  const incoming = { kind: 'url', value: 'https://example.com/new-page', text: 'Stale text from the old URL.' };
  const previous = { value: 'https://example.com/old-page' };
  assert.equal(canReuseExtraction(incoming, previous), false);
});

test('I3: canReuseExtraction re-extracts when there is no previous record to compare against', () => {
  assert.equal(canReuseExtraction({ kind: 'url', value: 'https://example.com', text: 'text' }, null), false);
});

test('I3: canReuseExtraction re-extracts when the incoming text is empty — when in doubt, re-extract', () => {
  assert.equal(canReuseExtraction({ kind: 'file', value: '/x.pdf', text: '' }, { value: '/x.pdf' }), false);
  assert.equal(canReuseExtraction({ kind: 'file', value: '/x.pdf', text: '   ' }, { value: '/x.pdf' }), false);
});

test('I3: canReuseExtraction never memoises a paste source — copying its value is cheap, always redo it', () => {
  assert.equal(canReuseExtraction({ kind: 'paste', value: 'same text', text: 'same text' }, { value: 'same text' }), false);
});

// ─── a URL pointing at a hosted document ────────────────────────────────────────────────────

test('a Content-Type names its extractor, and says so honestly when it cannot', () => {
  assert.equal(kindFromContentType('application/pdf'), 'pdf');
  assert.equal(kindFromContentType('application/pdf; charset=binary'), 'pdf');
  assert.equal(kindFromContentType('APPLICATION/PDF'), 'pdf');
  assert.equal(kindFromContentType('application/x-pdf'), 'pdf');
  assert.equal(kindFromContentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'docx');
  assert.equal(kindFromContentType('text/html; charset=utf-8'), 'html');
  assert.equal(kindFromContentType('application/xhtml+xml'), 'html');
  assert.equal(kindFromContentType('text/plain'), 'text');
  // Deliberately NOT mapped: a server saying octet-stream or xml tells us nothing, and guessing
  // Final Draft from every XML document would be an invention. The caller falls back to the URL.
  assert.equal(kindFromContentType('application/octet-stream'), 'unknown');
  assert.equal(kindFromContentType('application/xml'), 'unknown');
  assert.equal(kindFromContentType('image/png'), 'unknown');
  assert.equal(kindFromContentType(''), 'unknown');
  assert.equal(kindFromContentType(null), 'unknown');
});

test('a kind hint beats the filename, because a URL path rarely carries a useful extension', async () => {
  const fdx = '<Content><Paragraph Type="Action"><Text>He waits.</Text></Paragraph></Content>';
  // No extension at all — without the hint this would decode as raw XML.
  const hinted = await extractText(Buffer.from(fdx, 'utf8'), '/download/12345', 'fdx');
  assert.equal(hinted.kind, 'fdx');
  assert.equal(hinted.text, 'He waits.');
  const unhinted = await extractText(Buffer.from(fdx, 'utf8'), '/download/12345');
  assert.equal(unhinted.kind, 'unknown');
  assert.match(unhinted.text, /<Paragraph/, 'without a hint the XML survives — which is the point of the hint');
});

test("'unknown' is not a hint — it falls back to the filename rather than overriding it", async () => {
  const r = await extractText(Buffer.from('Snow to every horizon.', 'utf8'), 'notes.txt', 'unknown');
  assert.equal(r.kind, 'text');
  assert.equal(r.text, 'Snow to every horizon.');
});

test('the remote size cap is a real limit, not a placeholder', () => {
  assert.equal(MAX_REMOTE_BYTES, 20 * 1024 * 1024);
  assert.ok(MAX_REMOTE_BYTES > 5 * 1024 * 1024, 'a feature screenplay PDF must fit comfortably');
});
