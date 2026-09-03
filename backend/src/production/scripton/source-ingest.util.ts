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

/**
 * Ceiling on a document fetched from a URL. The textual path has always been capped at 2.5M chars
 * AFTER download; a binary needs a cap on the BYTES, because a link to a 400MB scan should be
 * refused rather than pulled into memory and handed to a parser.
 */
export const MAX_REMOTE_BYTES = 20 * 1024 * 1024;

/**
 * Which extractor a Content-Type header implies, or 'unknown' when it tells us nothing useful.
 *
 * Content-Type is the authority when it is specific. It is NOT the authority when a server says
 * application/octet-stream or application/xml, which is why the caller falls back to the URL's own
 * extension — a .fdx served as XML is the common case, and mapping every XML document to Final Draft
 * here would be a guess this function has no business making.
 */
export function kindFromContentType(ct: any): SourceKind {
  const t = String(ct == null ? '' : ct).toLowerCase().split(';')[0].trim();
  if (t === 'application/pdf' || t === 'application/x-pdf') return 'pdf';
  if (t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (t === 'text/html' || t === 'application/xhtml+xml' || t === 'application/xhtml') return 'html';
  if (t === 'text/plain' || t === 'text/markdown') return 'text';
  return 'unknown';
}

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

const XML_ENTITY_RE = /&(?:amp|lt|gt|quot|#39|apos|nbsp);/gi;

/**
 * Decode the handful of XML entities Final Draft emits in a SINGLE non-cascading pass: one regex,
 * one replacer, so the scan position only ever advances. A chained sequence of .replace() calls
 * over the same string re-scans text a prior replacement produced — an "&" decoded out of "&amp;"
 * combines with whatever follows and gets decoded again by a later .replace(), turning legitimately
 * escaped content (e.g. "&amp;lt;" — the escaping for the literal text "&lt;") into synthesised
 * markup. Doing it in one pass over the ORIGINAL string closes that hole.
 */
function decodeXmlEntities(s: string): string {
  return s.replace(XML_ENTITY_RE, (entity) => {
    switch (entity.toLowerCase()) {
      case '&amp;':
        return '&';
      case '&lt;':
        return '<';
      case '&gt;':
        return '>';
      case '&quot;':
        return '"';
      case '&#39;':
      case '&apos;':
        return "'";
      case '&nbsp;':
        return ' ';
      default:
        return entity;
    }
  });
}

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
    // A self-closing <Text/> (or <Text .../>) is an empty run, not an opener: match it first, as an
    // alternative with no capture group, so the lazy [\s\S]*? in the second branch never gets a
    // chance to swallow the '/' and reach past it for the NEXT <Text> tag's closer.
    const textRe = /<Text\b[^>]*\/>|<Text\b[^>]*>([\s\S]*?)<\/Text>/gi;
    let t: RegExpExecArray | null;
    while ((t = textRe.exec(inner)) !== null) {
      if (t[1] !== undefined) parts.push(t[1]);
    }
    const line = decodeXmlEntities(parts.join('')).trim();
    if (line) paras.push(line);
  }
  return paras.join('\n');
}

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
  // A single non-cascading pass — see decodeXmlEntities — not a chain of .replace() calls, which
  // re-scans text a prior replacement produced and turns "&amp;lt;" (the correct escaping for the
  // literal text "&lt;") into synthesised "<" markup.
  body = decodeXmlEntities(body);
  body = body.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  return { title, text: body.slice(0, max) };
}

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

/**
 * The stored file name inside a source URL, or null if it is not one we will open.
 *
 * The rule mirrors files.module.ts's own `safeName` guard: decode once, refuse anything containing a
 * null byte or a traversal segment, and accept only a plain basename. Path safety is decided HERE,
 * on a string, where it can be unit-tested — not at the call site next to a filesystem read.
 *
 * The `..` check runs on the RAW (still query-stripped, still un-decoded) path before the last
 * segment is even taken, and again on the decoded segment. A single check on the decoded basename
 * alone is not enough: '/api/v1/uploads/../../etc/passwd' has a perfectly clean final segment
 * ('passwd') once you `.split('/').pop()` it — the traversal lives in the segments BEFORE it, so it
 * has to be caught before they are discarded. Checking the raw string also catches percent-encoded
 * traversal ('..%2f..%2fetc%2fpasswd') without needing to decode first: the literal ".." substring
 * is visible either way, encoded slash or not.
 */
export function uploadBasename(url: any): string | null {
  const raw = String(url == null ? '' : url).trim();
  if (!raw) return null;
  const noQuery = raw.split('?')[0].split('#')[0];
  if (noQuery.includes('..')) return null;
  const last = noQuery.split('/').pop() || '';
  let decoded: string;
  try { decoded = decodeURIComponent(last); } catch { return null; }
  if (!decoded || decoded.includes('\0') || decoded.includes('..')) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(decoded)) return null;
  return decoded;
}

/**
 * I1: an unrecognised file is decoded as UTF-8 so it is never silently dropped, but a real binary
 * (an EPUB, a zip, an image) decodes into a wall of U+FFFD replacement characters — worse than the
 * old failure, because that garbage reads as "text" (chars > 0, note undefined) and gets folded
 * straight into the AI prompt with no note at all. Any NUL byte is decisive on its own; short of
 * that, a density of stray U+FFFD/NUL above 5% of the decoded string is treated as binary — a
 * threshold, not "any at all", so a handful of genuine mojibake characters in real text don't trip it.
 */
function looksBinary(bytes: Buffer, text: string): boolean {
  if (bytes.includes(0x00)) return true;
  if (!text) return false;
  let bad = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0xfffd) bad++;
  }
  return bad / text.length > 0.05;
}

/**
 * Extract text from a source file.
 *
 * NEVER THROWS. A source that cannot be read comes back with `chars: 0` and a `note` naming the
 * problem, because a build must not die because one of five uploads was a scan.
 */
export async function extractText(buf: Buffer, filename: string, kindHint?: SourceKind): Promise<ExtractResult> {
  // A hint wins over the extension, because a URL often has no useful extension while its
  // Content-Type is unambiguous. 'unknown' is not a hint — fall back to the name.
  const kind = kindHint && kindHint !== 'unknown' ? kindHint : kindOf(filename);
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf || ''), 'utf8');
  if (kind === 'fdx') return done(kind, fdxToText(bytes.toString('utf8')));
  // 40000 is htmlToText's web-page default; a saved .html source is content the user chose to keep,
  // not a fetched page, so silently losing everything past 40k here would violate the never-drop
  // discipline the rest of this module holds to. htmlToText's own default is untouched — two service
  // callers (ingestHtml, ingestUrl) depend on it staying 40000.
  if (kind === 'html') return done(kind, htmlToText(bytes.toString('utf8'), 2000000).text);
  if (kind === 'pdf') { const p = await pdfToText(bytes); return done(kind, p.text, p.note); }
  if (kind === 'docx') { const d = await docxToText(bytes); return done(kind, d.text, d.note); }
  if (kind === 'unknown') {
    const text = bytes.toString('utf8');
    if (looksBinary(bytes, text)) return done(kind, '', 'this file is not readable as text');
    return done(kind, text);
  }
  return done(kind, bytes.toString('utf8'));
}

/**
 * Assemble the source corpus. The main paste box is a separate field from the extra paste boxes,
 * so it must be folded in explicitly or a build with one file plus a typed synopsis silently keeps
 * only the file. Containment is checked BOTH ways so re-saving an already-assembled corpus does not
 * double it.
 */
export function assembleCorpus(sources: Array<{ text?: string }>, pasteText: any): string {
  const parts = (Array.isArray(sources) ? sources : [])
    .map((s) => String((s && s.text) || '')).filter((t) => t.trim());
  const pasted = String(pasteText == null ? '' : pasteText).trim();
  if (!pasted) return parts.join('\n\n');
  // Case 1 — the paste box already sits INSIDE one source's text. That is a re-save: a previous
  // assembly folded it into that source. The sources are the superset; return them untouched so the
  // text is not doubled.
  if (parts.some((t) => t.includes(pasted))) return parts.join('\n\n');
  // Case 2 — the paste box CONTAINS every source's text. This is the intake form's normal shape:
  // ScriptOnIntake sends `sourceText` as [mainBox, ...extraPasteBoxes].join('\n\n') while the extra
  // paste boxes ALSO arrive individually in `sources`. The aggregate is the superset, so IT is what
  // survives. Returning `parts` here silently discarded the main paste box — the one field no extra
  // box ever contains — whenever the user typed a synopsis and added at least one extra paste box
  // with no file or URL alongside it.
  if (parts.length > 0 && parts.every((t) => pasted.includes(t))) return pasted;
  // Case 3 — mixed. Some sources are inside the aggregate (the extra paste boxes), others are not
  // (files, URLs). Keep the aggregate once, then only the sources it does not already carry.
  return [pasted].concat(parts.filter((t) => !pasted.includes(t))).join('\n\n');
}

/**
 * I3: `saveIntake` used to re-parse every file and re-fetch every URL on EVERY save, serially,
 * through an 8s-per-source timeout — so editing an unrelated intake field with five sources attached
 * re-did five uploads' worth of work. A source is safe to reuse as-is only when the incoming payload
 * already carries its previously extracted text AND the thing it points at (`value` — the upload URL
 * or the web URL) has not changed since the copy already on record. Kept pure and exported so the
 * decision is unit-testable without Prisma. Deliberately conservative — a paste source is a plain
 * string copy with nothing expensive to save, so it is never memoised, and anything else uncertain
 * (no previous record, empty incoming text, a changed value) falls through to re-extraction.
 */
export function canReuseExtraction(
  incoming: { kind?: any; value?: any; text?: any } | null | undefined,
  previous: { value?: any } | null | undefined,
): boolean {
  const src = incoming || {};
  if (String(src.kind || '') === 'paste') return false;
  if (!previous) return false;
  if (!String(src.text == null ? '' : src.text).trim()) return false;
  const curValue = String(src.value == null ? '' : src.value);
  if (!curValue) return false;
  const prevValue = String(previous.value == null ? '' : previous.value);
  return curValue === prevValue;
}
