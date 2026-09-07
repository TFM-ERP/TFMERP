/**
 * Set list — what a screenplay can honestly say about where it shoots.
 *
 * THE ONE THING THIS FILE REFUSES TO DO IS COUNT LOCATIONS, and that refusal is the feature.
 *
 * A location is a prep decision. It does not exist in a screenplay. Movie Magic Scheduling carries
 * `Set` and `Location` as SEPARATE breakdown fields and states outright that Location "does not
 * always have to align with the Set field"; one physical location holds several sets. So a tool
 * reading a script can propose a SET list. A producer turns sets into locations. Any number this
 * file emitted called "Locations: 47" would be a guess wearing a measurement's clothes.
 *
 * And the naive count — distinct sluglines — is not merely imprecise. It is WRONG IN BOTH
 * DIRECTIONS AT ONCE:
 *
 *   Over-counts. Mini-slugs have no governing rule; writers choose. The same house is one slugline
 *   plus five mini-slugs, or six full sluglines. A 6x swing between two formatting-equivalent drafts
 *   of an identical film.
 *
 *   Under-counts. What a character watches on a screen has to be shot somewhere. A window POV, a
 *   driving exterior, a montage — real shooting places that appear in no slugline at all.
 *
 * So this returns two counts and a refusal: PARENT SETS (the producer's "how many places"), SUB-SETS
 * (the art department's "how many rooms to dress"), and `locations: null`, which the UI renders as
 * "not yet assigned". The gap between the first two IS the consolidation opportunity.
 *
 * Time of day and interior/exterior are ATTRIBUTES of a set, never forks of it — again because that
 * is how the reference data model works: `Set`, `I/E` and `TOD` are separate scene-header fields.
 * INT. HOUSE - DAY and INT. HOUSE - NIGHT are one set with two time values.
 *
 * PURE, AND NEVER THROWS. It runs over rows that came out of a model and a database, so every field
 * is treated as hostile. A malformed heading yields a set named from whatever survived, never an
 * exception — a breakdown that 500s is worse than one with an odd row in it.
 *
 * PROVENANCE OF EACH RULE is recorded at its implementation: INDUSTRY CONVENTION where a
 * professional source prescribes it, OUR CHOICE where we invented it and are accountable for it.
 * Never auto-merge on fuzzy similarity (rule 10a): JOHN'S APARTMENT and JOHN'S APT are probably one
 * set; MOTEL ROOM and MOTEL ROOM 12 are probably two. No algorithm settles that, and being wrong is
 * worse than being verbose — so near-matches are SUGGESTED, never applied.
 */

/** A scene as the breakdown holds it. Everything is optional because everything can be missing. */
export interface SceneRow {
  sceneNumber?: string | number | null;
  slugline?: string | null;
  setName?: string | null;
  intExt?: string | null;
  dayNight?: string | null;
  pages?: number | null;
  characters?: string[] | string | null;
}

export interface SubSet {
  name: string;
  key: string;
  scenes: string[];
  pages: number;
}

export interface ParentSet {
  key: string;
  name: string;
  subSets: SubSet[];
  scenes: string[];
  sceneCount: number;
  pages: number;
  eighths: number;
  /** Both faces are recorded; neither forks the set (rule 3). */
  int: boolean;
  ext: boolean;
  hybrid: boolean;
  timesOfDay: string[];
  /** Set once any scene here inherited its time of day from the scene before (rule 2a). */
  timeInherited: boolean;
  cast: string[];
  /** A vehicle interior is a production-METHOD decision, not a place (rule 5). */
  vehicle: boolean;
  flags: string[];
  /** Every original heading, kept forever. The set key is a derived view, never a replacement. */
  sluglines: string[];
}

export interface MergeSuggestion { a: string; b: string; reason: string }

export interface SetListReport {
  parentSets: ParentSet[];
  parentCount: number;
  subSetCount: number;
  /** A labelled diagnostic so a reader can audit how much collapsing happened. NEVER the headline. */
  distinctSluglines: number;
  /** Always null. Locations are assigned by a person, from this list. */
  locations: null;
  pages: number;
  eighths: number;
  nightPages: number;
  extPages: number;
  /** Sets that need a production-method decision before they can be scheduled at all. */
  vehicleSets: string[];
  /** Offered for one click. Never applied. */
  suggestedMerges: MergeSuggestion[];
  /** What this report cannot see, stated to the reader rather than left implied. */
  caveats: string[];
}

/** INDUSTRY CONVENTION — the Fountain scene-heading prefixes, adopted exactly and not extended. */
const HEADING_PREFIX = /^\s*(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E\.?|INT\.?|EXT\.?|EST\.?)\s+/i;

/**
 * INDUSTRY CONVENTION — the standard time-of-day vocabulary. Removed from set identity because
 * `Set` and `TOD` are separate fields: a set accumulates times, it does not fork by them.
 */
const TIME_WORDS = [
  'CONTINUOUS', 'MOMENTS LATER', 'SAME TIME', 'MAGIC HOUR', 'LATER THAT NIGHT', 'LATER THAT DAY',
  'PRE-DAWN', 'SUNRISE', 'SUNSET', 'MORNING', 'AFTERNOON', 'EVENING', 'MIDNIGHT', 'MIDDAY',
  'LATER', 'NIGHT', 'DAWN', 'DUSK', 'NOON', 'SAME', 'DAY',
];

/**
 * OUR CHOICE — these carry no time-of-day information at all. Story Sense discourages CONTINUOUS
 * for exactly that reason. We inherit the previous scene's time and mark the set, so the reader can
 * see where the script left it ambiguous rather than us silently choosing DAY.
 */
const TIMELESS = new Set(['CONTINUOUS', 'SAME', 'SAME TIME', 'LATER', 'MOMENTS LATER', 'LATER THAT DAY', 'LATER THAT NIGHT']);

/** OUR CHOICE — stripped into flags. Final Draft says these do not belong in a heading; they are in one anyway. */
const QUALIFIERS = [
  'FLASH FORWARD', 'FLASHFORWARD', 'DREAM SEQUENCE', 'SERIES OF SHOTS', 'FLASHBACK',
  'INTERCUT', 'MONTAGE', 'DREAM', 'MEMORY', 'POV', 'PRESENT DAY',
];

/** INDUSTRY CONVENTION (the syntax) — a moving vehicle carries TRAVELING appended to the heading. */
const MOTION = ['IN MOTION', 'TRAVELLING', 'TRAVELING', 'MOVING', 'DRIVING', 'PARKED'];

/** OUR CHOICE — a set whose name is one of these is a vehicle even with no motion word on it. */
const VEHICLE_NOUNS = new Set([
  'CAR', 'TRUCK', 'VAN', 'TAXI', 'CAB', 'BUS', 'TRAIN', 'PLANE', 'AEROPLANE', 'AIRPLANE', 'JET',
  'HELICOPTER', 'CHOPPER', 'BOAT', 'SHIP', 'FERRY', 'YACHT', 'MOTORCYCLE', 'BIKE', 'AMBULANCE',
  'JEEP', 'SUV', 'LIMO', 'LIMOUSINE', 'PATROL CAR', 'SQUAD CAR', 'PICKUP', 'TAXI CAB',
]);

const str = (v: any): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: any): number => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);

/**
 * RULE 10 — normalise FOR MATCHING ONLY. Uppercase, collapse whitespace, drop terminal punctuation,
 * treat 'S and S as equivalent, ignore a leading article. The display name is never this string.
 */
export function setKeyOf(name: string): string {
  let s = str(name).toUpperCase().replace(/\s+/g, ' ').trim();
  s = s.replace(/[.,;:!?]+$/g, '').trim();
  s = s.replace(/^(THE|A|AN)\s+/, '');
  s = s.replace(/[’']S\b/g, 'S');
  return s.trim();
}

export interface ParsedHeading {
  isHeading: boolean;
  int: boolean;
  ext: boolean;
  hybrid: boolean;
  parent: string;
  subSet: string;
  timeOfDay: string;
  timeless: boolean;
  flags: string[];
  motion: boolean;
}

/**
 * Take a scene heading apart into a set and its attributes.
 *
 * ORDER MATTERS AND IS DELIBERATE: qualifiers and motion words come out first, then time of day,
 * and only what is left is the set. Doing time first would leave 'FLASHBACK' welded to a set name
 * and produce two sets for one room — the exact over-count this file exists to prevent.
 *
 * NEVER THROWS. A heading that is only 'INT.' returns a set named '' with isHeading true, and the
 * caller decides what to do with an unnamed set; that is more useful than an exception.
 */
export function parseHeading(raw: any): ParsedHeading {
  const out: ParsedHeading = {
    isHeading: false, int: false, ext: false, hybrid: false,
    parent: '', subSet: '', timeOfDay: '', timeless: false, flags: [], motion: false,
  };
  let s = str(raw).replace(/\s+/g, ' ').trim();
  if (!s) return out;
  // strip a leading scene number, which breakdown rows often carry: "27 INT. HOUSE - DAY"
  s = s.replace(/^#?\s*\d+[A-Z]?\.?\s*#?\s+/i, '');

  const m = HEADING_PREFIX.exec(s);
  if (m) {
    out.isHeading = true;
    const p = m[1].toUpperCase().replace(/\./g, '');
    if (p === 'INT/EXT' || p === 'EXT/INT' || p === 'I/E') { out.hybrid = true; out.int = true; out.ext = true; }
    else if (p === 'INT') out.int = true;
    else { out.ext = true; }                       // EXT and EST both read as exterior
    s = s.slice(m[0].length).trim();
  }

  const upper = () => s.toUpperCase();

  // RULE 9 — qualifiers out first, into flags.
  for (const q of QUALIFIERS) {
    const re = new RegExp('(?:^|[\\s\\-/(\\[])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[\\s\\-/)\\]]|$)', 'i');
    if (re.test(upper())) {
      if (out.flags.indexOf(q) < 0) out.flags.push(q);
      s = s.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), ' ');
    }
  }
  // dates and clock times are qualifiers too, and appear constantly despite the style guides
  if (/\b\d{1,2}:\d{2}\s*(A\.?M\.?|P\.?M\.?)?\b/i.test(s)) { out.flags.push('TIME STAMP'); s = s.replace(/\b\d{1,2}:\d{2}\s*(A\.?M\.?|P\.?M\.?)?\b/ig, ' '); }
  if (/\b(19|20)\d{2}\b/.test(s)) { out.flags.push('DATED'); s = s.replace(/\b(19|20)\d{2}\b/g, ' '); }

  // RULE 5 — motion out into a flag, not into identity.
  for (const w of MOTION) {
    const re = new RegExp('(?:^|[\\s\\-/(])' + w + '(?:[\\s\\-/)]|$)', 'i');
    if (re.test(s)) { out.motion = true; s = s.replace(new RegExp(w, 'ig'), ' '); }
  }

  // RULE 2 — time of day out into an attribute. Longest phrase first so 'MOMENTS LATER' beats 'LATER'.
  for (const t of TIME_WORDS) {
    const re = new RegExp('(?:^|[\\s\\-,(\\[/])' + t.replace(/[-]/g, '\\-') + '(?:[\\s\\-,)\\]/]|$)', 'i');
    if (re.test(s)) {
      out.timeOfDay = t;
      out.timeless = TIMELESS.has(t);
      s = s.replace(new RegExp(t.replace(/[-]/g, '\\-'), 'i'), ' ');
      break;
    }
  }

  // tidy the separators the removals left behind
  s = s.replace(/\s+/g, ' ').replace(/(?:\s-\s*)+$/g, '').replace(/^(?:\s*-\s)+/g, '').trim();
  s = s.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '').replace(/\s+/g, ' ').trim();
  s = s.replace(/[\-,/]+\s*$/g, '').trim();

  // RULE 4 — split on ' - ' or ' / '. First segment is the parent; the rest is the sub-set.
  // A bare hyphen is part of the name (SAINT-DENIS, DRIVE-IN), so the spaced form is required.
  const parts = s.split(/\s+[-/]\s+/).map((x) => x.trim()).filter(Boolean);
  out.parent = parts.length ? parts[0] : s;
  out.subSet = parts.length > 1 ? parts.slice(1).join(' - ') : '';
  return out;
}

/** OUR CHOICE — a vehicle by motion word or by name. Surfaced separately, never counted as a place. */
function isVehicle(parentKey: string, motion: boolean): boolean {
  if (motion) return true;
  const k = parentKey.replace(/^(INSIDE|INSIDE OF)\s+/, '');
  if (VEHICLE_NOUNS.has(k)) return true;
  const words = k.split(' ');
  return words.length <= 3 && VEHICLE_NOUNS.has(words[words.length - 1]);
}

const pushUniq = (arr: string[], v: string) => { if (v && arr.indexOf(v) < 0) arr.push(v); };

function castOf(row: SceneRow): string[] {
  const c = row ? row.characters : null;
  const raw: string[] = Array.isArray(c) ? c.map(str) : str(c).split(/[,;]/);
  const out: string[] = [];
  for (const n of raw) { const t = n.trim().toUpperCase(); if (t) pushUniq(out, t); }
  return out;
}

/**
 * Build the set list.
 *
 * `locations` comes back null on every call, by construction. There is no argument, flag or option
 * that makes this function emit a location count, because there is no honest way to derive one from
 * a screenplay — see the header. If a caller needs locations, a person assigns them to these sets.
 */
export function buildSetList(rows: SceneRow[] | null | undefined): SetListReport {
  const report: SetListReport = {
    parentSets: [], parentCount: 0, subSetCount: 0, distinctSluglines: 0, locations: null,
    pages: 0, eighths: 0, nightPages: 0, extPages: 0, vehicleSets: [], suggestedMerges: [],
    caveats: [],
  };
  const scenes = Array.isArray(rows) ? rows : [];
  const byKey = new Map<string, ParentSet>();
  const seenSluglines = new Set<string>();
  let carriedTime = '';
  let unnamed = 0;
  let montages = 0;

  for (let i = 0; i < scenes.length; i++) {
    const row = scenes[i] || {};
    const headingText = str(row.slugline) || str(row.setName);
    const p = parseHeading(headingText);

    // The row's own columns win where the heading said nothing — they came from a parser that saw
    // the page, and a heading stored without its prefix is common in breakdown tables.
    const rowIE = str(row.intExt).toUpperCase();
    let int = p.int || /INT/.test(rowIE);
    let ext = p.ext || /EXT|EST/.test(rowIE);
    const hybrid = p.hybrid || (/INT/.test(rowIE) && /EXT/.test(rowIE));
    if (hybrid) { int = true; ext = true; }

    // RULE 2a — a timeless heading inherits the previous scene's time, and says so.
    let tod = p.timeOfDay;
    let inherited = false;
    if (!tod || p.timeless) {
      const fromRow = str(row.dayNight).toUpperCase().trim();
      if (fromRow && !TIMELESS.has(fromRow)) tod = fromRow;
      else if (carriedTime) { tod = carriedTime; inherited = true; }
    }
    if (tod && !TIMELESS.has(tod)) carriedTime = tod;

    let parentName = p.parent || str(row.setName).trim();
    if (!parentName) { unnamed++; parentName = 'UNNAMED SET'; }
    if (p.flags.indexOf('MONTAGE') >= 0 || p.flags.indexOf('SERIES OF SHOTS') >= 0) montages++;

    const key = setKeyOf(parentName);
    let set = byKey.get(key);
    if (!set) {
      set = {
        key, name: parentName.toUpperCase(), subSets: [], scenes: [], sceneCount: 0, pages: 0,
        eighths: 0, int: false, ext: false, hybrid: false, timesOfDay: [], timeInherited: false,
        cast: [], vehicle: isVehicle(key, p.motion), flags: [], sluglines: [],
      };
      byKey.set(key, set);
    }

    const sceneNo = str(row.sceneNumber) || String(i + 1);
    const pages = num(row.pages);
    set.scenes.push(sceneNo);
    set.sceneCount++;
    set.pages += pages;
    if (int) set.int = true;
    if (ext) set.ext = true;
    if (hybrid) set.hybrid = true;
    if (p.motion) set.vehicle = true;
    if (inherited) set.timeInherited = true;
    pushUniq(set.timesOfDay, tod);
    for (const f of p.flags) pushUniq(set.flags, f);
    if (headingText) { pushUniq(set.sluglines, headingText.trim()); seenSluglines.add(headingText.trim().toUpperCase()); }
    for (const c of castOf(row)) pushUniq(set.cast, c);

    if (p.subSet) {
      const subKey = setKeyOf(p.subSet);
      let sub = set.subSets.find((x) => x.key === subKey);
      if (!sub) { sub = { name: p.subSet.toUpperCase(), key: subKey, scenes: [], pages: 0 }; set.subSets.push(sub); }
      sub.scenes.push(sceneNo);
      sub.pages += pages;
    }

    report.pages += pages;
    if (/NIGHT|DUSK|MIDNIGHT/.test(tod)) report.nightPages += pages;
    if (ext) report.extPages += pages;
  }

  // Round to EIGHTHS, not to a decimal place. A page is measured in eighths on every breakdown
  // sheet in the industry, and 2.5 + 1.25 + 0.5 is exactly 4.25 pages / 34 eighths — rounding that
  // to one decimal reports 4.3 and quietly loses the unit the whole schedule is priced in.
  const round1 = (n: number) => Math.round(n * 8) / 8;
  for (const set of byKey.values()) {
    set.pages = round1(set.pages);
    set.eighths = Math.round(set.pages * 8);
    for (const sub of set.subSets) sub.pages = round1(sub.pages);
    set.subSets.sort((a, b) => b.pages - a.pages || a.name.localeCompare(b.name));
    report.subSetCount += set.subSets.length;
    if (set.vehicle) report.vehicleSets.push(set.name);
  }

  report.parentSets = Array.from(byKey.values()).sort((a, b) => b.pages - a.pages || b.sceneCount - a.sceneCount || a.name.localeCompare(b.name));
  report.parentCount = report.parentSets.length;
  report.distinctSluglines = seenSluglines.size;
  report.pages = round1(report.pages);
  report.eighths = Math.round(report.pages * 8);
  report.nightPages = round1(report.nightPages);
  report.extPages = round1(report.extPages);
  report.suggestedMerges = suggestMerges(report.parentSets);

  // RULE 11 — say what this cannot see, in the report, rather than leaving the reader to assume.
  report.caveats.push('A screenplay names SETS, not locations. Locations are assigned in prep; this report leaves that column empty on purpose.');
  report.caveats.push('Mini-slugs inside a scene body are not read here, so a set written as a mini-slug is missing from this list.');
  report.caveats.push('Hidden shooting places are not counted: anything a character watches on a screen, sees through a window, or drives past has to be shot somewhere and appears in no heading.');
  if (report.vehicleSets.length) report.caveats.push(report.vehicleSets.length + ' vehicle set(s) need a production-method decision (process trailer, low-loader or a real drive) before they can be scheduled.');
  if (montages) report.caveats.push(montages + ' montage/series-of-shots heading(s) found. A montage can hide several real places; check them by hand.');
  if (unnamed) report.caveats.push(unnamed + ' scene(s) had no readable set name and are grouped under UNNAMED SET.');
  return report;
}

/**
 * RULE 10a — near-matches are SUGGESTED, never applied.
 *
 * The rule is deliberately narrow: one key contains the other as a whole-word prefix, or they differ
 * only by an abbreviation. Anything looser starts merging MOTEL ROOM with MOTEL ROOM 12, which are
 * two sets, and the cost of a wrong merge is a producer budgeting one room instead of two.
 */
export function suggestMerges(sets: ParentSet[] | null | undefined): MergeSuggestion[] {
  const list = Array.isArray(sets) ? sets : [];
  const out: MergeSuggestion[] = [];
  const ABBREV: Record<string, string> = {
    APT: 'APARTMENT', BLDG: 'BUILDING', HQ: 'HEADQUARTERS', RM: 'ROOM',
    ST: 'STREET', RD: 'ROAD', AVE: 'AVENUE', HOSP: 'HOSPITAL', OFC: 'OFFICE',
  };
  const expand = (k: string) => k.split(' ').map((w) => ABBREV[w] || w).join(' ');
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (!a || !b || a.key === b.key) continue;
      if (expand(a.key) === expand(b.key)) { out.push({ a: a.name, b: b.name, reason: 'same name once abbreviations are expanded' }); continue; }
      const [shortK, longK] = a.key.length <= b.key.length ? [a.key, b.key] : [b.key, a.key];
      // whole-word prefix only, and the remainder must not be a number — MOTEL ROOM vs MOTEL ROOM 12
      // are two rooms, not one set written twice.
      if (longK.startsWith(shortK + ' ')) {
        const rest = longK.slice(shortK.length + 1);
        if (!/\d/.test(rest)) out.push({ a: a.name, b: b.name, reason: '"' + shortK + '" may be the same place as "' + longK + '"' });
      }
    }
  }
  return out.slice(0, 40);
}

/**
 * One line of places, for a prompt that has to name where a film happens.
 *
 * THIS EXISTS SO THE COLLAPSE HAPPENS IN ONE PLACE. Every prompt that wants "the key locations"
 * reaches for the same shortcut — strip INT/EXT off the slugline and de-duplicate what is left —
 * and that shortcut is wrong twice over. It leaves the time of day attached, so HARBOUR - DAY and
 * HARBOUR - NIGHT arrive as two different places; and it then truncates, so a film that is really
 * eighteen sets is sent as thirty entries of which a third are the same harbour in different light.
 * A harbour is ONE LOCATION. Day and night are two lightings of it, and an art director wants to
 * know both about the one place, not to be handed the place twice.
 *
 * Ordered by PAGES DESCENDING, not by script order, because this string is capped: if something has
 * to be dropped it must be the set the film spends least time in, never whatever happens to fall in
 * the back half of the story. And a cap that fires SAYS SO — a silently shortened list reads as a
 * complete one, which is the failure this codebase keeps paying for.
 *
 * PURE, AND NEVER THROWS.
 */
export function setListBrief(report: SetListReport | null | undefined, opts?: { limit?: number } | null): string {
  const sets = report && Array.isArray(report.parentSets) ? report.parentSets.filter(Boolean) : [];
  if (!sets.length) return '';
  const rawLimit = opts && typeof opts.limit === 'number' && isFinite(opts.limit) ? Math.floor(opts.limit) : 30;
  const limit = rawLimit > 0 ? rawLimit : sets.length;

  // Sorted on a COPY. The report is the caller's, and reordering it under them would be a side
  // effect from a function whose whole contract is that it has none.
  const ranked = sets.slice().sort((a, b) => {
    const pa = typeof a.pages === 'number' && isFinite(a.pages) ? a.pages : 0;
    const pb = typeof b.pages === 'number' && isFinite(b.pages) ? b.pages : 0;
    if (pb !== pa) return pb - pa;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  const shown = ranked.slice(0, limit);
  const parts: string[] = [];
  for (const s of shown) {
    const name = String(s.name || '').trim();
    if (!name) continue;
    const attrs: string[] = [];
    // Both faces of one set, never two sets (rule 3). INT/EXT is how it is written on a breakdown.
    const face = s.int && s.ext ? 'INT/EXT' : s.int ? 'INT' : s.ext ? 'EXT' : '';
    if (face) attrs.push(face);
    const times = Array.isArray(s.timesOfDay) ? s.timesOfDay.map((t) => String(t || '').trim()).filter(Boolean) : [];
    // Joined with a slash, so DAY/NIGHT reads as one place seen twice rather than as two entries.
    if (times.length) attrs.push(times.join('/'));
    if (s.vehicle) attrs.push('vehicle');
    parts.push(attrs.length ? name + ' (' + attrs.join(', ') + ')' : name);
  }
  if (!parts.length) return '';

  const dropped = ranked.length - shown.length;
  // Named, not hidden. A reader who sees thirty sets and no note assumes there were thirty.
  if (dropped > 0) parts.push('and ' + dropped + ' more set' + (dropped === 1 ? '' : 's') + ' not listed');
  return parts.join('; ');
}
