/**
 * Text out of a document: a PDF's own text layer when it has one, otherwise OCR
 * (tesseract.js, English + Arabic) — on this server; nothing is sent anywhere.
 *
 * Built from the working OCR in production/breakdown/script-import.service.ts
 * (same libraries, same dynamic imports so a missing optional package gives a clear
 * message instead of crashing the app). That service still has its own copy;
 * pointing it here is a separate tidy-up.
 *
 * Uses only packages already in backend/package.json: pdf-parse, pdfjs-dist,
 * canvas (optional, for scanned PDFs), tesseract.js.
 */
import { BadRequestException } from '@nestjs/common';

export type ExtractedText = { text: string; engine: 'text-layer' | 'ocr' };

const MAX_PDF_PAGES = 5; // a payment slip is one or two pages

export async function extractText(buf: Buffer, mime: string): Promise<ExtractedText> {
  const isPdf = mime === 'application/pdf' || buf.subarray(0, 5).toString('latin1') === '%PDF-';
  if (isPdf) {
    const layer = await pdfTextLayer(buf);
    if (layer.replace(/\s/g, '').length >= 20) return { text: layer, engine: 'text-layer' };
    return { text: await ocrPdf(buf), engine: 'ocr' };
  }
  if (/^image\//.test(mime) || /\.(png|jpe?g|webp|heic|tiff?|bmp)$/i.test(mime)) {
    return { text: await ocrImage(buf), engine: 'ocr' };
  }
  throw new BadRequestException('A slip must be a PDF or an image (PNG, JPG, WEBP).');
}

async function pdfTextLayer(buf: Buffer): Promise<string> {
  let pdfParse: any;
  try {
    // the lib file directly, to avoid pdf-parse's index.js debug-mode file read
    const mod: any = await import('pdf-parse/lib/pdf-parse.js');
    pdfParse = mod.default || mod;
  } catch {
    try { const mod: any = await import('pdf-parse'); pdfParse = mod.default || mod; }
    catch { return ''; } // fall through to OCR
  }
  const res = await pdfParse(buf).catch(() => ({ text: '' }));
  return String(res?.text || '');
}

export async function ocrImage(buf: Buffer): Promise<string> {
  const ts = 'tesseract.js';
  let T: any;
  try { T = await import(ts); } catch { throw new BadRequestException('OCR is not available on this server (tesseract.js not loaded).'); }
  try { const out: any = await T.recognize(buf, 'eng+ara'); return String(out?.data?.text || ''); }
  catch (e: any) { throw new BadRequestException('Reading the slip failed: ' + String(e?.message || e).slice(0, 160)); }
}

/** Scanned / image-only PDF: rasterise each page (pdfjs-dist + canvas), then OCR. */
export async function ocrPdf(buf: Buffer): Promise<string> {
  const p1 = 'pdfjs-dist/legacy/build/pdf.mjs', p2 = 'pdfjs-dist', cv = 'canvas', ts = 'tesseract.js';
  let pdfjs: any, canvasMod: any, T: any;
  try {
    try { pdfjs = await import(p1); } catch { pdfjs = await import(p2); }
    canvasMod = await import(cv);
    T = await import(ts);
  } catch {
    throw new BadRequestException('This PDF is a scan and cannot be read on this server. Upload the slip as an image (PNG or JPG) instead.');
  }
  try {
    const lib: any = pdfjs?.getDocument ? pdfjs : (pdfjs?.default || pdfjs);
    const createCanvas: any = canvasMod.createCanvas || (canvasMod.default && canvasMod.default.createCanvas);
    const doc: any = await lib.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, isEvalSupported: false }).promise;
    const pages = Math.min(doc.numPages || 0, MAX_PDF_PAGES);
    let out = '';
    for (let i = 1; i <= pages; i++) {
      const page: any = await doc.getPage(i);
      const vp: any = page.getViewport({ scale: 2 });
      const canvas: any = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const r: any = await T.recognize(canvas.toBuffer('image/png'), 'eng+ara');
      out += String(r?.data?.text || '') + '\n';
    }
    return out.trim();
  } catch (e: any) {
    throw new BadRequestException('Reading the scanned PDF failed: ' + String(e?.message || e).slice(0, 160) + '. Upload the slip as an image instead.');
  }
}
