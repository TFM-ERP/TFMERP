/**
 * Sides — the pages an actor is handed the night before, and the one thing this file will not do.
 *
 * SIDES ARE CROPPED AND STRUCK, NEVER RE-SET. That is the whole rule, and it comes from how they are
 * physically made: a 2nd AD photocopies the actual master pages, circles the scene numbers shooting
 * that day, and draws a box with a diagonal through everything else on the page. A photocopy of page
 * 47 carries the printed 47 on it, necessarily. So the master page number, the master scene number
 * and the master layout all survive by construction, and a generator that re-flowed the text into
 * fresh pages would produce a document nobody in a room could use — an actor saying "page 12" to a
 * director holding a different page 12 is worse than no sides at all.
 *
 * So this returns a PAGE PLAN, not pages: which master pages the packet needs, in what order, and
 * which scenes on each of those pages are live versus struck. The renderer crops and strikes. It
 * never lays out.
 *
 * WHAT THIS CANNOT DO, AND SAYS SO. Real production sides are driven by the SCHEDULE — the day's
 * scenes in shooting order, which is not story order. ScriptON has no stripboard, so it cannot
 * produce them unassisted. Two modes, and the difference is stated rather than blurred:
 *
 *   'schedule'   the caller supplies the day's scene numbers, in shooting order. Real sides.
 *   'character'  every scene one performer appears in, in story order. NOT sides — a read-through
 *                or rehearsal packet. Useful, and available today, but a different document.
 *
 * Calling the second one "sides" on a call sheet would be a lie a 1st AD would catch immediately.
 *
 * AND AUDITION SIDES ARE A DIFFERENT THING sharing the name: scenes chosen by casting to show an
 * actor's range. Not this. Not derived from a schedule at all.
 *
 * A SCENE NUMBER IS A KEY, NOT A NUMBER, AND NOT A GLYPH. The number printed on an Arabic page
 * follows the project's locale - CLDR gives ar-AE Latin digits and ar-SA, ar-EG and the rest of the
 * Gulf and Levant Arabic-Indic - so one film's page says 14 and another's says the same scene in
 * different characters. But the schedule that drives this packet is typed by a coordinator on a
 * Latin keyboard, and the same number travels onto the stripboard, the call sheet and the DOOD.
 * Matching those as raw strings makes two spellings of one scene into two scenes, and the packet
 * then reports "Not in this script" while an actor stands on set without their pages.
 *
 * So the digits are FOLDED before comparison and never before display: `sceneKey` is what the
 * matcher compares, the script's own spelling is what the packet carries.
 *
 * PURE, AND NEVER THROWS.
 */

export interface SidesScene {
  sceneNumber?: string | number | null;
  slugline?: string | null;
  /** Length in pages (eighths as a decimal). The page span is derived from the running total. */
  pages?: number | null;
  characters?: string[] | string | null;
  /** If the breakdown already knows real page positions, they win over the derived ones. */
  pageStart?: number | null;
  pageEnd?: number | null;
}

export interface SidesSceneMark {
  sceneNumber: string;
  slugline: string;
  /** true = shooting, print it. false = on the page but not today: box it and strike it through. */
  live: boolean;
}

export interface SidesPage {
  /** The MASTER page number. Never reassigned, never sequential within the packet. */
  page: number;
  scenes: SidesSceneMark[];
  /** This page carries material that is not being shot, so it needs the box-and-diagonal. */
  hasStruck: boolean;
}

export interface SidesPacket {
  mode: 'schedule' | 'character';
  /** Scene numbers in ISSUE order — shooting order for a schedule, story order for a character. */
  order: string[];
  pages: SidesPage[];
  pageCount: number;
  /** Pages carrying both live and struck material. The ones a PA has to mark by hand. */
  sharedPages: number;
  /** Named so no caller has to wonder. Always true; there is no mode where it is false. */
  masterNumbersPreserved: true;
  warnings: string[];
}

const str = (v: any): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/**
 * Arabic-Indic (U+0660-0669) and Extended Arabic-Indic (U+06F0-06F9, the Persian/Urdu shapes) folded
 * onto ASCII. INDUSTRY CONVENTION: these are the two blocks Unicode assigns to Arabic-script digits,
 * and CLDR names them `arab` and `arabext` respectively - the same two an Arabic renderer can emit.
 *
 * ONLY DIGITS MOVE. A letter is never touched, so a heading that reads مشهد stays مشهد and a set
 * named in Arabic survives intact. Nothing else in this file has any opinion about language.
 */
export function foldDigits(v: any): string {
  const t = str(v);
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c >= 0x0660 && c <= 0x0669) out += String.fromCharCode(c - 0x0660 + 48);        // arab
    else if (c >= 0x06f0 && c <= 0x06f9) out += String.fromCharCode(c - 0x06f0 + 48);   // arabext
    else out += t[i];
  }
  return out;
}

/**
 * The comparison key for a scene number. Folded digits, ALL whitespace removed, upper case - so
 * `` 12a ``, `12 B` and `12B` are the scenes they obviously are. A letter suffix is how an inserted
 * scene is numbered; its case and any space before it are typing accidents, not part of the label.
 * No numbering scheme in production uses a space as a separator INSIDE one scene number, which is
 * what makes removing it transcription rather than a reading.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not strip a leading zero, and it does not strip a word
 * like SCENE or مشهد. Both would be interpretation: a scene number is an IDENTIFIER, not an integer
 * - A5, 12A and 04 are labels a production chose - and quietly deciding that 04 and 4 are the same
 * label is the class of guess this file exists to refuse. Digits and whitespace are transcription;
 * everything past that is a reading.
 */
export function sceneKey(v: any): string {
  return foldDigits(v).replace(/\s+/g, '').toUpperCase();
}
const num = (v: any): number => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);

const castOf = (row: SidesScene): string[] => {
  const c = row ? row.characters : null;
  const raw: string[] = Array.isArray(c) ? c.map(str) : str(c).split(/[,;]/);
  const out: string[] = [];
  for (const n of raw) { const t = n.trim().toUpperCase(); if (t && out.indexOf(t) < 0) out.push(t); }
  return out;
};

/**
 * Where each scene sits on the master pages.
 *
 * Derived from the running total of scene lengths, because that is the only continuous quantity a
 * breakdown reliably carries. A row that supplies its OWN pageStart/pageEnd overrides the derivation
 * — it came from a real pagination pass and knows better than arithmetic does.
 *
 * A zero-length scene still occupies the page it starts on. It has to: it is printed there.
 */
export function pageSpans(rows: SidesScene[] | null | undefined): Array<{ sceneNumber: string; slugline: string; first: number; last: number; cast: string[] }> {
  const scenes = Array.isArray(rows) ? rows : [];
  const out: Array<{ sceneNumber: string; slugline: string; first: number; last: number; cast: string[] }> = [];
  let running = 0;
  for (let i = 0; i < scenes.length; i++) {
    const row = scenes[i] || {};
    const len = num(row.pages);
    const startPos = running;
    const endPos = running + len;
    running = endPos;

    const given = num(row.pageStart);
    const givenEnd = num(row.pageEnd);
    // A breakdown that stamped every row pageStart:1 is not a pagination pass, it is a default.
    // Only trust supplied positions when they actually vary from the first row.
    const derivedFirst = Math.floor(startPos + 1e-9) + 1;
    const derivedLast = Math.max(derivedFirst, Math.ceil(endPos - 1e-9) || derivedFirst);
    const first = given >= 1 && givenEnd >= given && (given > 1 || i === 0) ? given : derivedFirst;
    const last = given >= 1 && givenEnd >= given && (given > 1 || i === 0) ? givenEnd : derivedLast;

    out.push({
      sceneNumber: str(row.sceneNumber) || String(i + 1),
      slugline: str(row.slugline),
      first, last, cast: castOf(row),
    });
  }
  return out;
}

/**
 * Build the packet.
 *
 * `sceneNumbers` is the day's schedule IN SHOOTING ORDER and its order is honoured exactly — it is
 * not sorted, because shooting order is a decision someone made and re-sorting it would silently
 * discard that decision. `character` selects every scene a performer appears in, in story order.
 * Supplying neither returns an empty packet with a warning rather than guessing a day.
 */
export function buildSides(
  rows: SidesScene[] | null | undefined,
  opts?: { sceneNumbers?: Array<string | number> | null; character?: string | null } | null,
): SidesPacket {
  const spans = pageSpans(rows);
  const wantScenes = opts && Array.isArray(opts.sceneNumbers) ? opts.sceneNumbers.map(str).map((s) => s.trim()).filter(Boolean) : [];
  const wantChar = opts && typeof opts.character === 'string' ? opts.character.trim().toUpperCase() : '';
  const mode: 'schedule' | 'character' = wantScenes.length ? 'schedule' : 'character';

  const packet: SidesPacket = {
    mode, order: [], pages: [], pageCount: 0, sharedPages: 0,
    masterNumbersPreserved: true, warnings: [],
  };
  if (!spans.length) { packet.warnings.push('No scenes to build from.'); return packet; }

  let live: typeof spans = [];
  if (mode === 'schedule') {
    // Honour the given order exactly. A scene number the script does not have is reported, not dropped
    // silently — a typo in a day's schedule is exactly the thing a packet must not hide.
    // Keyed on the FOLDED number so a schedule typed 14 finds a scene printed ١٤, and vice versa.
    const byNumber = new Map<string, typeof spans[number]>();
    const collided: string[] = [];
    for (const s of spans) {
      const k = sceneKey(s.sceneNumber);
      if (!k) continue;
      const prior = byNumber.get(k);
      // Two scenes in ONE script whose numbers are indistinguishable to the matcher. First wins, and
      // it is reported: silently issuing one of them would hand an actor the wrong pages, and the
      // draft itself is what needs correcting.
      if (prior) { if (collided.indexOf(k) < 0) collided.push(prior.sceneNumber + ' / ' + s.sceneNumber); continue; }
      byNumber.set(k, s);
    }
    if (collided.length) packet.warnings.push('This script numbers two scenes the same once digits are read alike: ' + collided.join('; ') + '. The first is used; fix the draft.');
    const missing: string[] = [];
    for (const n of wantScenes) {
      const hit = byNumber.get(sceneKey(n));
      // Reported back as the caller wrote it, not as the fold rewrote it - a coordinator has to
      // recognise the number they typed in order to find their own mistake.
      if (hit) live.push(hit); else missing.push(n);
    }
    if (missing.length) packet.warnings.push('Not in this script: scene ' + missing.join(', ') + '. Check the schedule against the current draft.');
  } else if (wantChar) {
    live = spans.filter((s) => s.cast.indexOf(wantChar) >= 0);
    if (!live.length) packet.warnings.push(wantChar + ' does not appear in any scene\'s cast list. Cast may not be recorded on these scenes.');
    packet.warnings.push('No schedule supplied, so this is every scene ' + wantChar + ' appears in, in story order — a read-through packet, not shooting sides. Real sides follow the day\'s schedule in shooting order.');
  } else {
    packet.warnings.push('Supply the day\'s scene numbers in shooting order, or a character name. Nothing here invents a shooting day.');
    return packet;
  }

  packet.order = live.map((s) => s.sceneNumber);

  // Every master page any live scene touches, in the order those scenes are issued. A page carrying
  // two live scenes appears once, at its first appearance — an actor is not handed it twice.
  const liveNumbers = new Set(live.map((s) => s.sceneNumber));
  const pageOrder: number[] = [];
  for (const s of live) {
    for (let p = s.first; p <= s.last; p++) if (pageOrder.indexOf(p) < 0) pageOrder.push(p);
  }

  for (const p of pageOrder) {
    const on = spans.filter((s) => s.first <= p && s.last >= p);
    const marks: SidesSceneMark[] = on.map((s) => ({
      sceneNumber: s.sceneNumber,
      slugline: s.slugline,
      live: liveNumbers.has(s.sceneNumber),
    }));
    const hasStruck = marks.some((m) => !m.live);
    if (hasStruck) packet.sharedPages++;
    packet.pages.push({ page: p, scenes: marks, hasStruck });
  }
  packet.pageCount = packet.pages.length;

  // The operational fact every practitioner account repeats: a packet is right at 2pm and wrong by 5.
  packet.warnings.push('A sides packet goes stale the moment the schedule moves. Build it at wrap, not in advance.');
  return packet;
}
