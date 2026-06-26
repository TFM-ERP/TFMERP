/**
 * Pure slugline parser — turns page text (one string per page) into ScriptScene
 * rows: scene number, slugline, INT/EXT, day/night, and page/char position.
 *
 * Handles BOTH English (INT./EXT.) AND Arabic (داخلي/خارجي) sluglines, so scripts
 * developed in Arabic (e.g. عنترة) materialise scenes too — not just imported
 * English PDFs. The Arabic branch is the exact inverse of ScriptonService.slugOf's
 * Arabic format `<ie> - <loc> - <dn>` (داخلي=INT, خارجي=EXT, combined=INT/EXT).
 *
 * Shared by the import path (ScriptService.addRevision) and the develop→ScriptScene
 * bridge (ScriptonService materialiseScenes at generation completion).
 */
export type ParsedScene = {
  sceneNumber: string | null;
  slugline: string;
  intExt: string; // INT | EXT | INT/EXT
  dayNight: string | null; // DAY | NIGHT | DAWN | DUSK | MORNING | EVENING | ...
  pageStart: number;
  pageEnd: number;
  charStart: number;
};

// English: optional scene number, INT./EXT./INT-EXT, then the rest.
const SLUG_RE = /^\s*(\d+[A-Z]?\.?\s+)?(INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)\s+(.+)$/i;
const EN_DN = /\b(DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|MIDDAY|NOON|AFTERNOON|NIGHT|DAY)\b/i;

// Arabic: optional scene number, داخلي/خارجي (interior/exterior), a dash separator,
// then "<location> - <day/night>". The location may itself contain Arabic commas
// (،) — but never the " - " separator — so anchoring on the FIRST token (intExt)
// and the trailing day/night word is robust.
const AR_SLUG_RE = /^\s*(\d+\s+)?(داخلي\s*\/\s*خارجي|خارجي\s*\/\s*داخلي|داخلي|خارجي)\s*[-–—]\s*(.+)$/u;
const AR_DN: [RegExp, string][] = [
  [/ليل/, 'NIGHT'],
  [/فجر/, 'DAWN'],
  [/غروب|مساء/, 'DUSK'],
  [/صباح/, 'MORNING'],
  [/ظهر|عصر|نهار/, 'DAY'],
];

const arIntExt = (marker: string): string => {
  const hasInt = /داخل/.test(marker);
  const hasExt = /خارج/.test(marker);
  return hasInt && hasExt ? 'INT/EXT' : hasExt ? 'EXT' : 'INT';
};
const arDayNight = (rest: string): string | null => {
  for (const [re, v] of AR_DN) if (re.test(rest)) return v;
  return null;
};

export function parseScenes(pages: string[]): ParsedScene[] {
  type Raw = Omit<ParsedScene, 'pageEnd'>;
  const raw: Raw[] = [];
  pages.forEach((pageText, idx) => {
    const lines = String(pageText || '').split('\n');
    let cursor = 0;
    for (const line of lines) {
      const en = line.match(SLUG_RE);
      if (en) {
        const intExt = en[2].toUpperCase().replace(/\./g, '').replace('I/E', 'INT/EXT');
        const rest = en[3].trim();
        const dn = rest.match(EN_DN);
        raw.push({
          sceneNumber: en[1] ? en[1].replace(/[.\s]/g, '') : null,
          slugline: `${intExt}. ${rest}`,
          intExt,
          dayNight: dn ? dn[1].toUpperCase() : null,
          pageStart: idx + 1,
          charStart: cursor,
        });
      } else {
        const ar = line.match(AR_SLUG_RE);
        if (ar) {
          const marker = ar[2].replace(/\s+/g, '');
          const rest = ar[3].trim();
          raw.push({
            sceneNumber: ar[1] ? ar[1].trim() : null,
            slugline: `${marker} - ${rest}`,
            intExt: arIntExt(marker),
            dayNight: arDayNight(rest),
            pageStart: idx + 1,
            charStart: cursor,
          });
        }
      }
      cursor += line.length + 1;
    }
  });
  // pageEnd = (next scene's start page) - 1, else the last page.
  return raw.map((s, i) => ({
    ...s,
    pageEnd: i + 1 < raw.length ? Math.max(s.pageStart, raw[i + 1].pageStart) : pages.length || s.pageStart,
  }));
}
