'use client';
/** Unified script-view paper — the single source of truth for how a screenplay looks ANYWHERE
 *  in TFM (ScriptON Library reader, Print/Download PDF, Develop, Studio). The "unify script view"
 *  standard: warm A4 stock, Courier Prime (Latin) / Amiri (Arabic manuscript), slug LEFT-aligned,
 *  bold CENTERED character cues, centered dialogue, italic parentheticals, right transitions.
 *
 *  Fixed (June 2026):
 *   • Arabic-aware parser — Arabic scene/cue/dialogue/action/transition are now classified
 *     correctly (the old parser only knew Latin UPPERCASE cues, so every Arabic line became "action").
 *   • Measured pagination — the on-screen sheets fill to the foot (no dead space at page bottom).
 *   • Continuous-flow print — buildScriptPrintHtml emits one A4 flow and lets the browser break
 *     pages, so every printed/PDF page is full except the last.
 *  Audio-only extras (karaoke highlight, coloured [emotion] tags) live in ScriptOnAudioPanel. */
import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';

// SSR-safe layout effect (Next renders this client component on the server too; useLayoutEffect there warns).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type Tok = { type: string; text: string; sceneNo?: string };

function escHtml(s: string): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Arabic structural vocabulary (RTL) ──────────────────────────────────────
const AR_IE: Array<[RegExp, string]> = [
  [/\bINT\.?\/EXT\.?/i, 'داخلي/خارجي'], [/\bEXT\.?\/INT\.?/i, 'خارجي/داخلي'], [/\bI\/E\b/i, 'داخلي/خارجي'],
  [/\bINT\.?/i, 'داخلي'], [/\bEXT\.?/i, 'خارجي'], [/\bEST\.?/i, 'تأسيسي'],
];
const AR_TOD: Array<[RegExp, string]> = [
  [/\bMIDDAY\b/i, 'ظهيرة'], [/\bNOON\b/i, 'ظهر'], [/\bAFTERNOON\b/i, 'بعد الظهر'], [/\bMIDNIGHT\b/i, 'منتصف الليل'],
  [/\bMORNING\b/i, 'صباح'], [/\bEVENING\b/i, 'مساء'], [/\bDAWN\b/i, 'فجر'], [/\bDUSK\b/i, 'غسق'],
  [/\bNIGHT\b/i, 'ليل'], [/\bDAY\b/i, 'نهار'], [/\bCONTINUOUS\b/i, 'متصل'], [/\bLATER\b/i, 'لاحقاً'], [/\bSAME\b/i, 'نفس الوقت'],
];
const AR_TRANS_OUT: Array<[RegExp, string]> = [
  [/^FADE IN:?$/i, 'ظهور تدريجي:'], [/^FADE OUT\.?$/i, 'اختفاء تدريجي.'], [/^FADE TO BLACK\.?$/i, 'اختفاء إلى السواد.'],
  [/^CUT TO:$/i, 'قطع إلى:'], [/^SMASH CUT(?: TO)?:$/i, 'قطع حاد إلى:'], [/^MATCH CUT(?: TO)?:$/i, 'قطع مطابق إلى:'],
  [/^JUMP CUT TO:$/i, 'قطع قافز إلى:'], [/^DISSOLVE TO:$/i, 'مزج إلى:'], [/^BACK TO:$/i, 'العودة إلى:'],
  [/^THE END\.?$/i, 'النهاية.'], [/^END\.?$/i, 'النهاية.'],
];
function arApply(text: string, table: Array<[RegExp, string]>): string { let s = text; for (const [re, v] of table) s = s.replace(re, v); return s; }
function arSlug(text: string): string { return arApply(arApply(text, AR_IE), AR_TOD); }
function arTrans(text: string): string { return arApply(text, AR_TRANS_OUT); }
function arToken(t: Tok, lang?: string): Tok {
  if (lang !== 'ar') return t;
  if (t.type === 'scene') return { ...t, text: arSlug(t.text) };
  if (t.type === 'trans' || t.type === 'fadein') return { ...t, text: arTrans(t.text) };
  return t;
}

// ── Arabic line detection + structural matchers (for parsing Arabic-language scripts) ──
const AR_LETTER = /[؀-ۿݐ-ݿࢠ-ࣿ]/;
const hasArabic = (s: string) => AR_LETTER.test(s);
// Predominantly-Arabic detection → render RTL even when the UI locale is English (script language ≠ UI language).
function isArabicText(s: string): boolean { const str = String(s || ''); let a = 0, l = 0; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); if (c >= 0x0600 && c <= 0x06FF) a++; else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) l++; } return a > l; }
const AR_SCENE_LEAD = /^(?:مشهد|المشهد|لقطة)\b/;
const AR_IE_WORD = /(داخلي|خارجي|د\s*\/\s*خ|خ\s*\/\s*د)/;
const AR_TOD_WORD = /(ليل|نهار|صباح|مساء|فجر|ظهر|ظهيرة|غروب|شروق|الغسق|الفجر|متصل|لاحقاً|لاحقا|مستمر)/;
const AR_TRANS_LINE = /^(?:قطع(?:\s+حاد)?(?:\s+مطابق)?(?:\s+قافز)?(?:\s+إلى)?\s*:?|مزج\s+إلى\s*:?|اختفاء(?:\s+تدريجي)?(?:\s+إلى\s+السواد)?\.?|ظهور\s+تدريجي\s*:?|العودة\s+إلى\s*:?|النهاية\.?|انتقال\s*:?)$/;
const AR_SENT_END = /[\.!:؟؛،]$/;
const AR_NUM = /[#:]?\s*([0-9٠-٩]+)/;
const arDigitsToWestern = (s: string) => s.split('').map((ch) => { const c = ch.charCodeAt(0); return (c >= 0x0660 && c <= 0x0669) ? String(c - 0x0660) : ch; }).join('');

// Classify raw screenplay lines into typed elements. Latin and Arabic are handled per-line, so a
// diglossic Arabic script (MSA action + colloquial dialogue) parses just like an English one.
export function formatScreenplay(raw: string, _lang?: string): Tok[] {
  const lines = String(raw || '').replace(/\r/g, '').replace(/\t/g, ' ').split('\n');
  const TRANS = /^(FADE OUT\.?|FADE TO BLACK\.?|FADE TO:|CUT TO:|SMASH CUT(?: TO)?:|MATCH CUT(?: TO)?:|HARD CUT TO:|JUMP CUT TO:|DISSOLVE TO:|TIME CUT:|BACK TO:|INTERCUT.*|THE END\.?|END\.?)$/;
  const SCENE = /^(\d+[A-Z]?[.)]?\s+)?(INT|EXT|INT\.?\/EXT|I\/E|EST)[.\s]/i;
  const CUEEXT = /\((?:CONT'D|CONTD|V\.?O\.?|O\.?S\.?|O\.?C\.?|SUBTITLE|PRELAP|FILTERED|ON PHONE)\)/ig;
  const tokens: Tok[] = [];
  let inSpeech = false;
  // Consecutive source lines of the SAME element are ONE block, joined with a space.
  //
  // 'action' used to be missing from this list, so every source line became its own
  // <p class="uvp-action"> — and both the print CSS (margin:0 0 1em) and tokLines() below charge a
  // blank line per action BLOCK. The result was a blank line after every LINE instead of between
  // paragraphs: ~24 blocks on a page whose geometry holds 55 lines, which is what rendered a
  // 168-page script as a 303-page PDF.
  //
  // This cannot swallow a real paragraph break: a blank source line never reaches push() — it emits
  // its own 'gap' token at the top of the loop — so beats separated by a blank line stay separate.
  // What it does merge is a paragraph the model hard-wrapped mid-sentence, which is exactly right.
  const push = (type: string, text: string) => {
    const last = tokens[tokens.length - 1];
    if (last && last.type === type && (type === 'dialogue' || type === 'paren' || type === 'action')) last.text += ' ' + text;
    else tokens.push({ type, text });
  };
  const s = lines.map((l) => l.trim());
  for (let i = 0; i < s.length; i++) {
    const t = s[i];
    if (!t) { tokens.push({ type: 'gap', text: '' }); inSpeech = false; continue; }
    let nxt = ''; for (let j = i + 1; j < s.length; j++) { nxt = s[j]; break; }

    if (hasArabic(t)) {
      // ── Arabic line ──
      if (AR_SCENE_LEAD.test(t) || (AR_IE_WORD.test(t) && AR_TOD_WORD.test(t)) || SCENE.test(t)) {
        const m = t.match(AR_NUM); tokens.push({ type: 'scene', text: t, sceneNo: m ? arDigitsToWestern(m[1]) : undefined }); inSpeech = false; continue;
      }
      if (AR_TRANS_LINE.test(t)) { tokens.push({ type: 'trans', text: t }); inSpeech = false; continue; }
      if (t.charAt(0) === '(' || t.charAt(0) === '﴾') { push('paren', t); continue; }
      // inline "الاسم: الحوار" → split cue + dialogue
      const colon = t.match(/^([^:：]{1,28})[:：]\s*(\S.*)$/);
      if (!inSpeech && colon && colon[1].trim().split(/\s+/).length <= 5 && !AR_SENT_END.test(colon[1].trim())) {
        tokens.push({ type: 'cue', text: colon[1].trim() }); push('dialogue', colon[2].trim()); inSpeech = true; continue;
      }
      const wc = t.split(/\s+/).length;
      const cueLike = t.length <= 28 && wc <= 4 && !AR_SENT_END.test(t);
      if (!inSpeech && cueLike && nxt) { tokens.push({ type: 'cue', text: t.replace(/[:：]\s*$/, '') }); inSpeech = true; continue; }
      if (inSpeech) { push('dialogue', t); continue; }
      push('action', t); continue;
    }

    // ── Latin line (original rules, unchanged) ──
    if (/^FADE IN:?$/i.test(t)) { tokens.push({ type: 'fadein', text: t }); inSpeech = false; continue; }
    if (SCENE.test(t)) { const m = t.match(/^(\d+[A-Z]?)[.)]?\s+/); tokens.push({ type: 'scene', text: t, sceneNo: m ? m[1] : undefined }); inSpeech = false; continue; }
    const isUpper = t === t.toUpperCase() && /[A-Z]/.test(t);
    if (isUpper && TRANS.test(t)) { tokens.push({ type: 'trans', text: t }); inSpeech = false; continue; }
    const core = t.replace(CUEEXT, '').replace(/\(.*?\)/g, '').trim();
    const cueLike = core.length > 0 && core.length <= 38 && core.split(/\s+/).length <= 6
      && core === core.toUpperCase() && /[A-Z]/.test(core) && !/[.!?,:;"]$/.test(core);
    if (!inSpeech && cueLike && nxt) { tokens.push({ type: 'cue', text: t }); inSpeech = true; continue; }
    if (t.charAt(0) === '(') { push('paren', t); continue; }
    if (inSpeech) { push('dialogue', t); continue; }
    push('action', t);
  }
  const out: Tok[] = [];
  for (const tk of tokens) { if (tk.type === 'gap' && out.length && out[out.length - 1].type === 'gap') continue; out.push(tk); }
  while (out.length && out[0].type === 'gap') out.shift();
  while (out.length && out[out.length - 1].type === 'gap') out.pop();
  return out;
}

// Estimated vertical cost of a token (line-units) — SSR/first-paint fallback only; the on-screen
// view re-paginates by real measurement once mounted.
function tokLines(t: Tok): number {
  const len = (t.text || '').length;
  switch (t.type) {
    case 'scene': return Math.max(1, Math.ceil(len / 56)) + 1.6;
    case 'action': return Math.max(1, Math.ceil(len / 56)) + 1;
    case 'cue': return 1.6;
    case 'paren': return Math.max(1, Math.ceil(len / 24));
    case 'dialogue': return Math.max(1, Math.ceil(len / 36)) + 0.6;
    case 'trans': case 'fadein': return 1.8;
    // 0, not 0.85: the blank line after a paragraph is already charged by that paragraph's own
    // '+1' below. Counting it here too is the same double-count the print CSS had.
    case 'gap': return 0;
    default: return 1;
  }
}
const PAGE_BUDGET = 48;
export function paginateTokens(toks: Tok[], budget = PAGE_BUDGET): Tok[][] {
  const pages: Tok[][] = []; let cur: Tok[] = []; let used = 0;
  for (const t of toks) {
    const c = tokLines(t);
    if (t.type === 'scene' && used > budget - 5) { pages.push(cur); cur = []; used = 0; }
    if (used > 0 && used + c > budget) { pages.push(cur); cur = []; used = 0; if (t.type === 'gap') continue; }
    cur.push(t); used += c;
  }
  if (cur.length) pages.push(cur);
  return pages.length ? pages : [[]];
}

// ── Shared paper CSS (prefixed `uvp`). Reused by the React reader and the print/PDF document. ──
export const SCRIPT_PAPER_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap');
.uvp-stack{display:flex;flex-direction:column;align-items:center;gap:26px}
/* Screen sheet — measured from Figma node 7:14 (the Write paper). Courier Prime 12.5px, 22px line
   rhythm, cream #f7f4ec, fixed-indent cues/dialogue (industry standard — not centred), 6px radius. */
.uvp-a4{width:620px;min-height:802px;background:#f7f4ec;color:#23231f;font-family:"Courier Prime","Courier New",Courier,monospace;font-size:12.5px;line-height:15px;border:1px solid rgba(255,255,255,.12);border-radius:6px;box-shadow:0 30px 60px -18px rgba(0,0,0,.55);padding:40px 62px 48px 48px;box-sizing:border-box;position:relative}
.uvp-a4 .uvp-pageno{position:absolute;top:15px;right:48px;font-size:11px;color:#6b727d}
.uvp-el{white-space:pre-wrap;word-wrap:break-word}
.uvp-slug{display:flex;justify-content:space-between;gap:14px;font-weight:700;text-transform:uppercase;margin:0}
.uvp-a4 > .uvp-slug:first-child,.uvp-a4 > .uvp-pageno + .uvp-slug{margin-top:0}
.uvp-scene-gap{margin-top:15px}
.uvp-action{margin:0;max-width:510px}
.uvp-cue{margin:15px 0 0 19.6ch}
.uvp-paren{margin:0 0 0 16ch}
.uvp-parn{display:inline-block;max-width:30ch;font-style:italic;color:#3a3a36}
.uvp-dialogue{margin:0 0 15px 13.5ch}
.uvp-dlgt{display:inline-block;max-width:44ch;white-space:pre-wrap;word-wrap:break-word}
.uvp-trans{text-align:right;font-weight:700;margin:15px 0}
.uvp-fadein{font-weight:700;margin:0 0 15px}
.uvp-gap{height:15px}
.uvp-tp{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.uvp-tp .uvp-tt{font-size:17pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px}
.uvp-tp .uvp-tv{margin-top:.45em;font-size:12pt;font-weight:700;letter-spacing:.5px;color:#555}
.uvp-tp .uvp-ts{margin-top:.5em;font-size:12pt}
.uvp-tp .uvp-tl{margin-top:1.4em;max-width:5in;font-size:11pt;font-style:italic;line-height:1.5;color:#444}
.uvp-tp .uvp-tf{margin-top:2.4em;font-size:11pt;color:#555}
@media(max-width:840px){.uvp-a4{width:100%;min-height:0;padding:26px 18px 30px}.uvp-dlgt{max-width:82%}.uvp-parn{max-width:60%}}
/* Arabic manuscript mode (RTL): Amiri A4 manuscript — its own metrics (the 7:14 screen re-tune is
   LTR). Restores the A4 width/stock/centred cues so the LTR change above doesn't leak into Arabic. */
.uvp-ar{direction:rtl;width:210mm;min-height:297mm;background:#fdfdf9;color:#1d1d1b;font-family:'Amiri','Courier Prime',serif;font-size:13.5pt;line-height:1.55;border-radius:2px;padding:22mm 32mm 22mm 25.4mm}
.uvp-ar .uvp-pageno{right:auto;left:14mm;top:12mm;font-size:11pt;color:#3a3a36}
.uvp-ar .uvp-action{text-align:right;max-width:none}
.uvp-ar .uvp-cue{text-align:center;font-weight:700;margin:1em 0 0}
.uvp-ar .uvp-paren{text-align:center;margin:0}
.uvp-ar .uvp-dialogue{text-align:center;margin:0 0 1em}
.uvp-ar .uvp-trans{text-align:left;margin:1em 0}
.uvp-ar .uvp-scene-gap{margin-top:1.5em}
.uvp-ar .uvp-fadein{margin:0 0 1em}
.uvp-ar .uvp-dlgt{max-width:58%}
.uvp-ar .uvp-parn{max-width:52%}
.uvp-ar .uvp-slug,.uvp-ar.uvp-tp{direction:rtl}
@media(max-width:840px){.uvp-ar{padding:26px 18px 30px}}
`;

// Build a DOM node for one token (used by both the live sheets and the measurer).
function elNode(doc: Document, raw: Tok, lang: string | undefined, first: boolean): HTMLElement {
  const t = arToken(raw, lang);
  if (t.type === 'gap') { const g = doc.createElement('div'); g.className = 'uvp-gap'; return g; }
  if (t.type === 'scene') {
    const d = doc.createElement('div'); d.className = 'uvp-el uvp-slug' + (first ? '' : ' uvp-scene-gap');
    const a = doc.createElement('span'); a.textContent = t.text;
    const b = doc.createElement('span'); b.textContent = t.sceneNo || '';
    d.appendChild(a); d.appendChild(b); return d;
  }
  if (t.type === 'dialogue' || t.type === 'paren') {
    const d = doc.createElement('div'); d.className = 'uvp-el uvp-' + t.type;
    const sp = doc.createElement('span'); sp.className = t.type === 'dialogue' ? 'uvp-dlgt' : 'uvp-parn'; sp.textContent = t.text;
    d.appendChild(sp); return d;
  }
  const e = doc.createElement('div'); e.className = 'uvp-el uvp-' + t.type; e.textContent = t.text; return e;
}

// Measured pagination — fill each A4 sheet to the foot using real rendered heights. Browser-only.
function measurePages(host: HTMLElement, toks: Tok[], lang?: string): Tok[][] {
  const doc = host.ownerDocument;
  const probe = doc.createElement('div');
  probe.className = 'uvp-a4' + (lang === 'ar' ? ' uvp-ar' : '');
  probe.style.cssText = 'position:absolute;left:-99999px;top:0;min-height:0;visibility:hidden;box-shadow:none;border:0';
  host.appendChild(probe);
  const pn = doc.createElement('div'); pn.className = 'uvp-pageno'; pn.textContent = '0.'; probe.appendChild(pn);
  // A4 height in px at the element's own rendering scale: measure a full min-height sheet once.
  const ruler = doc.createElement('div'); ruler.className = 'uvp-a4' + (lang === 'ar' ? ' uvp-ar' : '');
  ruler.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
  host.appendChild(ruler); const pageGoal = ruler.offsetHeight || 1123; host.removeChild(ruler);

  const pages: Tok[][] = []; let cur: Tok[] = [];
  const rebuild = (arr: Tok[]) => { while (probe.childNodes.length > 1) probe.removeChild(probe.lastChild as Node); for (let k = 0; k < arr.length; k++) probe.appendChild(elNode(doc, arr[k], lang, k === 0)); };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (cur.length === 0 && t.type === 'gap') continue;
    cur.push(t); rebuild(cur);
    if (probe.offsetHeight > pageGoal) {
      if (cur.length === 1) { pages.push(cur); cur = []; continue; }
      cur.pop();
      const carry: Tok[] = [];
      while (cur.length) { const lt = cur[cur.length - 1]; if (lt.type === 'scene' || lt.type === 'cue') carry.unshift(cur.pop() as Tok); else break; }
      while (cur.length && cur[cur.length - 1].type === 'gap') cur.pop();
      pages.push(cur); cur = carry; i--;
    }
  }
  while (cur.length && cur[cur.length - 1].type === 'gap') cur.pop();
  if (cur.length) pages.push(cur);
  host.removeChild(probe);
  return pages.length ? pages : [[]];
}

function Sheet({ toks, pageNo, lang }: { toks: Tok[]; pageNo: number; lang?: string }) {
  return (
    <div className={'uvp-a4' + (lang === 'ar' ? ' uvp-ar' : '')} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="uvp-pageno">{pageNo}.</div>
      {toks.map((raw, i) => { const t = arToken(raw, lang); return t.type === 'gap'
        ? <div key={i} className="uvp-gap" />
        : t.type === 'scene'
          ? <div key={i} className={'uvp-el uvp-slug' + (i === 0 ? '' : ' uvp-scene-gap')}><span>{t.text}</span><span>{t.sceneNo || ''}</span></div>
          : (t.type === 'dialogue' || t.type === 'paren')
            ? <div key={i} className={'uvp-el uvp-' + t.type}><span className={t.type === 'dialogue' ? 'uvp-dlgt' : 'uvp-parn'}>{t.text}</span></div>
            : <div key={i} className={'uvp-el uvp-' + t.type}>{t.text}</div>; })}
    </div>
  );
}

/** The unified on-screen script — discrete A4 sheets that FILL to the foot (measured), with page
 *  numbers. `lang="ar"` renders the Arabic RTL manuscript. Falls back to the estimate on first paint
 *  and re-measures on mount + when webfonts finish loading. */
export function ScriptPaper({ text, startPage = 1, lang }: { text: string; startPage?: number; lang?: string }) {
  const effLang = (lang === 'ar' || isArabicText(text)) ? 'ar' : lang;   // script content decides RTL, not the UI locale
  const toks = useMemo(() => formatScreenplay(text, effLang), [text, effLang]);
  const [pages, setPages] = useState<Tok[][]>(() => paginateTokens(toks));
  const hostRef = useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const host = hostRef.current; if (!host) return;
    let cancelled = false;
    const run = () => { if (cancelled) return; try { setPages(measurePages(host, toks, effLang)); } catch { /* keep estimate */ } };
    run();
    const f: any = (typeof document !== 'undefined' && (document as any).fonts) ? (document as any).fonts : null;
    if (f && f.ready && typeof f.ready.then === 'function') f.ready.then(() => run());
    return () => { cancelled = true; };
  }, [toks, effLang]);

  return (
    <div className="uvp-stack">
      <style dangerouslySetInnerHTML={{ __html: SCRIPT_PAPER_CSS }} />
      <div ref={hostRef} aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} />
      {pages.map((pg, i) => <Sheet key={i} toks={pg} pageNo={startPage + i} lang={effLang} />)}
    </div>
  );
}

function tokHtml(t0: Tok, lang?: string, first?: boolean): string {
  const t = arToken(t0, lang);
  if (t.type === 'gap') return '<div class="uvp-gap"></div>';
  if (t.type === 'scene') return '<div class="uvp-el uvp-slug' + (first ? '' : ' uvp-scene-gap') + '"><span>' + escHtml(t.text) + '</span><span>' + escHtml(t.sceneNo || '') + '</span></div>';
  return '<div class="uvp-el uvp-' + t.type + '">' + escHtml(t.text) + '</div>';
}

/** The unified Print/Download document. One CONTINUOUS A4 flow (title page first) — the browser
 *  breaks pages itself, so every page is full to the foot except the last (no dead bottom space).
 *  Open in an off-screen iframe and call print(), or hand to a headless renderer for a real PDF. */
export function buildScriptPrintHtml(text: string, title: string, info?: any): string {
  const i: any = info || {};
  const ar = i.lang === 'ar' || isArabicText(text);
  const lang = ar ? 'ar' : 'en';
  const arCls = ar ? ' uvp-ar' : '';
  const toks = formatScreenplay(text, lang);
  const approxPages = Math.max(1, Math.round(toks.reduce((n, t) => n + tokLines(t), 0) / PAGE_BUDGET));
  const sub = [i.projectType, Array.isArray(i.genres) ? i.genres.join(', ') : i.genres].filter(Boolean).join('  ·  ');
  const foot = [i.revLabel, i.date].filter(Boolean).join('   ·   ');
  // The writer's own draft label, directly under the title. Distinct from `revLabel` in `foot`
  // below, which is the WGA revision colour — two builds of one film share a revision colour and
  // are told apart by THIS. Empty prints nothing at all, never an empty line.
  const ver = String(i.versionLabel || '').trim();
  const tp = '<section class="uvp-page uvp-tp' + arCls + '"><div class="uvp-tt">' + escHtml(title || 'Untitled') + '</div>'
    + (ver ? '<div class="uvp-tv">' + escHtml(ver) + '</div>' : '')
    + (sub ? '<div class="uvp-ts">' + escHtml(sub) + '</div>' : '')
    + (i.logline ? '<div class="uvp-tl">' + escHtml(i.logline) + '</div>' : '')
    + '<div class="uvp-tf">' + escHtml(foot) + '<br>' + escHtml(i.org || (ar ? 'FilmOS · سكريبت أون — الصُنّاع' : 'FilmOS · ScriptON — The Film Makers FZ LLC')) + '</div></section>';
  let body = ''; let first = true;
  for (const t of toks) { body += tokHtml(t, lang, first); if (t.type !== 'gap') first = false; }
  const flow = '<section class="uvp-flow' + arCls + '">' + body + '</section>';
  const arFont = '@import url("https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Amiri:ital,wght@0,400;0,700;1,400&display=swap");';
  /**
   * Print geometry: the flow paints continuously; @page provides the physical margin box.
   *
   * US LETTER, NOT A4, for Latin scripts. Every spec screenplay in the English-language market is
   * 8.5x11 with a 1.5in binding margin — an A4 page is 8mm narrower and 18mm taller, and a reader
   * who prints it gets reflowed line breaks and a page count that does not match the slug numbers.
   * An external coverage report on the 2 Sep draft listed "A4 rather than US Letter" among the
   * reasons the document would undermine professional confidence, and it was right.
   *
   * Arabic manuscripts keep A4, which IS the standard across the MENA market.
   *
   * NOTE FOR ANYONE CHANGING THIS AGAIN: the paper decides how many lines fit on a page, and
   * PAGE_BUDGET in feature-length.util.ts is that number. Letter at 12pt Courier with 1in top and
   * bottom margins holds 55 lines; A4 held 61. The two constants move together or the page target
   * silently means something else.
   */
  const printCss = arFont
    + (ar
        ? '@page{size:A4;margin:22mm 32mm 22mm 25.4mm}'
        : '@page{size:Letter;margin:1in 1in 1in 1.5in}')
    + 'html,body{margin:0;background:#fff;color:#1d1d1b}'
    + '.uvp-flow{font-family:' + (ar ? "'Amiri','Courier Prime',serif" : '"Courier Prime","Courier New",monospace') + ';font-size:' + (ar ? '13.5pt' : '12pt') + ';line-height:' + (ar ? '1.55' : '1.08') + ';direction:' + (ar ? 'rtl' : 'ltr') + '}'
    + '.uvp-el{white-space:pre-wrap;word-wrap:break-word}'
    + '.uvp-slug{display:flex;justify-content:space-between;gap:14px;font-weight:700;text-transform:uppercase;margin:0 0 1em;break-inside:avoid}'
    + '.uvp-scene-gap{margin-top:1.5em}'
    + '.uvp-action{margin:0 0 1em;' + (ar ? 'text-align:right' : '') + '}'
    // Dialogue is INDENTED, not centred. Screenplay dialogue sits in a fixed left-aligned column;
    // `text-align:center` + `margin:0 auto` produced the ragged centred blocks in the export and made
    // every dialogue row ~29 characters instead of 44 — which is why a page held 1,150 characters
    // where a real 12pt Courier page holds ~1,800. The ch values match this file's own SCREEN rules
    // (cue 19.6ch / dialogue 13.5ch+44ch / paren 16ch) so print and screen finally agree.
    + (ar
        ? '.uvp-cue{text-align:center;font-weight:700;letter-spacing:.04em;margin:1em 0 0;break-after:avoid}'
          + '.uvp-paren{text-align:center;font-style:italic;color:#3a3a36;max-width:52%;margin:0 auto;break-before:avoid}'
          + '.uvp-dialogue{text-align:center;max-width:58%;margin:0 auto 1em}'
        : '.uvp-cue{font-weight:700;letter-spacing:.04em;margin:1em 0 0 19.6ch;break-after:avoid}'
          + '.uvp-paren{font-style:italic;color:#3a3a36;max-width:25ch;margin:0 0 0 16ch;break-before:avoid}'
          + '.uvp-dialogue{max-width:44ch;margin:0 0 1em 13.5ch}')
    + '.uvp-trans{text-align:' + (ar ? 'left' : 'right') + ';font-weight:700;margin:1em 0}'
    + '.uvp-fadein{font-weight:700;margin:0 0 1em}'
    // A blank source line adds NO height of its own in print: every block already carries
    // `margin-bottom: 1em`, which IS the blank line between paragraphs. This spacer used to add a
    // second 1em on top — two blank lines where a screenplay uses one — and a real box between two
    // margined siblings also stops their margins collapsing. Measured on the MINUTEMEN export: ~2.02
    // lines per gap instead of 1, which is most of why a 144-page script rendered as 294 pages.
    + '.uvp-gap{height:0}'
    + '.uvp-page{break-after:page;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;min-height:calc(297mm - 44mm)}'
    + '.uvp-tt{font-size:17pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px}.uvp-tv{margin-top:.45em;font-size:12pt;font-weight:700;letter-spacing:.5px;color:#555}.uvp-ts{margin-top:.5em;font-size:12pt}.uvp-tl{margin-top:1.4em;max-width:5in;font-size:11pt;font-style:italic;line-height:1.5;color:#444}.uvp-tf{margin-top:2.4em;font-size:11pt;color:#555}';
  return '<!doctype html><html lang="' + lang + '" dir="' + (ar ? 'rtl' : 'ltr') + '"><head><meta charset="utf-8"><title>' + escHtml(i.docTitle || title || 'Script') + '</title>'
    + '<style>' + printCss + '</style></head><body>' + tp + flow
    + '<div hidden data-pages="' + approxPages + '"></div></body></html>';
}
