'use client';
/** Direct .pdf download for a screenplay — builds a real, vector, selectable A4 PDF in the browser
 *  and downloads it straight to disk (NO OS print dialog). Driven by the SAME formatScreenplay
 *  tokeniser as the on-screen paper, so the file matches the view.
 *
 *  Latin/English: fully supported here (Courier, embedded). Arabic: pdf-lib's standard fonts can't
 *  shape Arabic, so callers should fall back to the print document for Arabic until the server-side
 *  (headless Chromium) renderer lands — see isArabicScript(). */
import { formatScreenplay, type Tok } from './scriptPaper';

const AR_LETTER = /[؀-ۿݐ-ݿ]/;
export function isArabicScript(text: string): boolean {
  const s = String(text || '');
  let ar = 0, la = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c >= 0x0600 && c <= 0x06FF) ar++; else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) la++; }
  return ar > la; // predominantly Arabic
}

let _pdflib: any = null;
function loadPdfLib(): Promise<any> {
  if (_pdflib) return Promise.resolve(_pdflib);
  if (typeof window !== 'undefined' && (window as any).PDFLib) { _pdflib = (window as any).PDFLib; return Promise.resolve(_pdflib); }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
    s.async = true;
    s.onload = () => { _pdflib = (window as any).PDFLib; _pdflib ? resolve(_pdflib) : reject(new Error('pdf-lib unavailable')); };
    s.onerror = () => reject(new Error('pdf-lib failed to load (offline?)'));
    document.head.appendChild(s);
  });
}

function safeName(title: string, rev?: string): string {
  const base = String(title || 'Script').replace(/[^\w؀-ۿ \-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'Script';
  return base + (rev ? '_' + String(rev).replace(/[^\w]/g, '') : '') + '.pdf';
}

/** Generate + download the screenplay as a real PDF. Returns true on success. Throws 'ARABIC' so the
 *  caller can route Arabic to the print document instead. */
export async function downloadScriptPdf(text: string, title: string, info?: any): Promise<boolean> {
  if (isArabicScript(text) || (info && info.lang === 'ar')) { const e: any = new Error('ARABIC'); e.code = 'ARABIC'; throw e; }
  const PDFLib = await loadPdfLib();
  const toks: Tok[] = formatScreenplay(text);
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Courier);
  const bold = await doc.embedFont(PDFLib.StandardFonts.CourierBold);
  const obl = await doc.embedFont(PDFLib.StandardFonts.CourierOblique);

  const W = 595.28, H = 841.89, size = 12, lh = 13.5;
  const L = 90.7, R = 72, topY = H - 62.4, botY = 62.4;       // 32mm left, ~1in right, 22mm top/bottom
  const cw = W - L - R, centerX = W / 2;   // centre on the true page centre, not the binding-offset content box
  let page = doc.addPage([W, H]); let y = topY; let pageNo = 0;
  const stamp = () => { pageNo++; page.drawText(pageNo + '.', { x: W - R - 18, y: H - 50, size: 11, font }); };
  stamp();
  const need = (lines: number) => { if (y - lines * lh < botY) { page = doc.addPage([W, H]); y = topY; stamp(); } };
  const wrap = (txt: string, max: number, f: any) => {
    const words = String(txt).split(/\s+/); let line = ''; const out: string[] = [];
    for (const w of words) { const test = line ? line + ' ' + w : w; if (f.widthOfTextAtSize(test, size) > max && line) { out.push(line); line = w; } else line = test; }
    if (line) out.push(line); return out;
  };
  const left = (txt: string, f: any, max: number) => { for (const ln of wrap(txt, max, f)) { need(1); page.drawText(ln, { x: L, y, size, font: f }); y -= lh; } };
  const centre = (txt: string, f: any, max: number) => { for (const ln of wrap(txt, max, f)) { need(1); const wpt = f.widthOfTextAtSize(ln, size); page.drawText(ln, { x: centerX - wpt / 2, y, size, font: f }); y -= lh; } };

  // Title page
  const ttl = String(title || 'Untitled').toUpperCase();
  const sub = [info && info.projectType, info && (Array.isArray(info.genres) ? info.genres.join(', ') : info.genres)].filter(Boolean).join('   ·   ');
  let ty = H / 2 + 60; const tw = bold.widthOfTextAtSize(ttl, 20); page.drawText(ttl, { x: centerX - tw / 2, y: ty, size: 20, font: bold }); ty -= 28;
  if (sub) { const sw = font.widthOfTextAtSize(sub, 12); page.drawText(sub, { x: centerX - sw / 2, y: ty, size: 12, font }); ty -= 22; }
  const foot = [info && info.revLabel, info && info.date].filter(Boolean).join('   ·   ');
  if (foot) { const fw = font.widthOfTextAtSize(foot, 11); page.drawText(foot, { x: centerX - fw / 2, y: H / 2 - 80, size: 11, font, color: PDFLib.rgb(0.33, 0.33, 0.31) }); }
  page = doc.addPage([W, H]); y = topY; stamp();

  let prevWasScene = true;
  for (const t of toks) {
    if (t.type === 'gap') { y -= lh * 0.85; continue; }
    if (t.type === 'scene') { if (!prevWasScene) y -= lh * 0.5; need(2); left(t.text.toUpperCase(), bold, cw - 28);
      if (t.sceneNo) page.drawText(t.sceneNo, { x: W - R - bold.widthOfTextAtSize(t.sceneNo, size), y: y + lh, size, font: bold }); y -= lh * 0.4; prevWasScene = true; continue; }
    prevWasScene = false;
    if (t.type === 'fadein') { left(t.text.toUpperCase(), bold, cw); y -= lh * 0.4; continue; }
    if (t.type === 'trans') { need(1); const u = t.text.toUpperCase(); page.drawText(u, { x: W - R - font.widthOfTextAtSize(u, size), y, size, font: bold }); y -= lh * 1.4; continue; }
    if (t.type === 'cue') { y -= lh * 0.4; centre(t.text.toUpperCase(), bold, cw); continue; }
    if (t.type === 'paren') { centre(t.text, obl, cw * 0.5); continue; }
    if (t.type === 'dialogue') { centre(t.text, font, cw * 0.48); y -= lh * 0.4; continue; }
    left(t.text, font, cw); y -= lh * 0.4;
  }

  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = (info && info.fileName) ? String(info.fileName) : safeName(title, info && info.revLabel);
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  return true;
}
