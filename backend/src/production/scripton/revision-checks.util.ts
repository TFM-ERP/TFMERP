import { createHash } from 'node:crypto';
// SLUG_RE / AR_SLUG_RE only: the scene boundaries a script declares, so a register quote can be
// placed on a page without importing a parser or duplicating the patterns.
import { SLUG_RE, AR_SLUG_RE } from './continuity.util';

/**
 * F10 — A VERDICT ABOUT A PROMOTED SCRIPT, WRITTEN DOWN.
 *
 * verifyEnding and verifyPlanEnding put their result in `genProgress`, an in-memory Map, and
 * failHeadlessDraft withholds a finished script while keeping the reason in the same Map. The user
 * is told no and the reason cannot be shown twice; restart the process and the row shows a revision
 * with pages and no record of why it was never activated. Measured from the writes: no code path
 * put an ending verdict into stage_versions.data or into any scriptRevision payload.
 *
 * TWO DEFECTS, AND THEY SHIP TOGETHER ON PURPOSE.
 *
 *   one   the verdict is never persisted
 *   two   the fail-open types an ABSTENTION as { complete: true }
 *
 * Fixing one without two would be worse than today. Today the lie dies with the process; persisted
 * untyped, a `complete: true` that was really "the check returned nothing I could parse" survives
 * and reads like evidence. So a fail-open is stored as NOT_RUN with its reason, and `CLEAN` is
 * reserved for a verdict that actually came back.
 *
 * THREE STATES, the same vocabulary the pre-spend gate already reads:
 *
 *   FINDINGS  the check ran and found something
 *   CLEAN     the check ran and found nothing
 *   NOT_RUN   no verdict — it threw, or returned nothing usable
 *
 * THE FINGERPRINT, AND WHY IT IS NOT DECORATION. dialectRepairDoc rewrites an active revision's
 * pageText IN PLACE (scripton.service.ts:720) — the only path that mutates a revision's content
 * instead of creating a new one. A verdict can therefore outlive the text it judged. Each entry
 * carries a sha256 of that text, and a reader finding a mismatch must report STALE rather than
 * CLEAN: a stale pass is the same class of durable false record as an untyped abstention.
 *
 * `subject` says WHAT was fingerprinted, because not every verdict judges the revision's text.
 * verifyEnding judges the script tail; verifyPlanEnding judges a scene PLAN that is never persisted
 * on the revision at all. Comparing a plan fingerprint against pageText would report STALE forever
 * and mean nothing, so a reader only staleness-checks entries whose subject is the revision text.
 *
 * Pure; never throws. No dependency beyond node:crypto.
 */

/** What either ending check returns. `failOpen` marks an ABSTENTION wearing `complete: true`. */
export interface EndingVerdict {
  complete: boolean;
  note?: string;
  missing?: string[];
  /** True when the check could not answer. It still does not block — but it is not a verdict. */
  failOpen?: boolean;
}

/**
 * ONLY A REAL PASS MAY OVERTURN A REAL FAILURE.
 *
 * Both feature paths take a second, wider look when the first read says the script stops short:
 * one long closing scene can push the resolution out of a 3,000-character tail, and a single false
 * "incomplete" would throw away a finished script. That is sound — but it was written as
 * `cov = wider.complete ? wider : …`, and a FAIL-OPEN also says `complete: true`.
 *
 * So an abstention on the second read silently overturned a real "incomplete" from the first: the
 * run filed DONE, the record said NOT_RUN, and the only genuine verdict either check produced was
 * discarded. The wider read is allowed to rescue a good script; it is not allowed to rescue one by
 * failing to look.
 *
 *   first REAL fail + wider REAL pass  -> the wider pass (the rescue this exists for)
 *   first REAL fail + wider ABSTENTION -> the first failure STANDS, with its own note
 *   first REAL fail + wider REAL fail  -> failure, keeping the wider note where it has one
 */
export function resolveSecondLook(
  first: EndingVerdict | null | undefined, wider: EndingVerdict | null | undefined,
): EndingVerdict & { note: string; missing: string[] } {
  const norm = (v: EndingVerdict): EndingVerdict & { note: string; missing: string[] } =>
    ({ ...v, note: String(v.note || ''), missing: Array.isArray(v.missing) ? v.missing : [] });
  const f: EndingVerdict = first || { complete: false };
  const w: EndingVerdict = wider || { complete: false };
  if (f.complete === true) return norm(f);                 // no second look was warranted
  if (w.complete === true && !w.failOpen) return norm(w);  // a REAL pass may overturn
  if (w.failOpen) {
    // The abstention is discarded, not recorded as the verdict: the first read actually looked.
    return { complete: false, note: f.note || '', missing: f.missing || [], failOpen: false };
  }
  return { complete: false, note: w.note || f.note || '', missing: w.missing || f.missing || [], failOpen: false };
}

/**
 * FOUR STATES. `INFO` is the fourth and it is not a verdict either way.
 *
 * `echo` reports phrases a draft returns to, and the sweep itself says what it is: logged at
 * log.log, not log.warn, as "motif or tic, the writer decides". A recurring line is as often the
 * point of a script as it is a defect in one, so echo may never render as FINDINGS and may never
 * be counted in a findings total — but it still has to be STORED, items and all, or it joins the
 * list of things this module exists to stop losing.
 */
export type CheckState = 'FINDINGS' | 'CLEAN' | 'INFO' | 'NOT_RUN';
/** What the sha256 was taken over. Only `revision.pageText` can go stale against a revision. */
export type CheckSubject = 'revision.pageText' | 'plan.tail' | 'plan' | 'none';

/**
 * ONE FINDING, LOCATED AND LEGIBLE. Counts locate; bodies decide.
 *
 * The register check once reached a reader as "2 of 105 lines contradicted … Line(s): 36, 52." and
 * nothing else — and that reader was the person being asked to waive it. `reason` is the sentence;
 * this is the part a person can actually weigh. `scene` is null rather than 0 or absent when a
 * finding cannot be placed: a guessed scene number is worse than an admitted gap.
 */
export interface CheckItem { scene: number | null; kind: string; detail: string }

export interface CheckEntry {
  kind: string;
  state: CheckState;
  /** Why, in words. Required for NOT_RUN — an abstention with no reason is not better than a lie. */
  reason: string;
  at: string;
  sha256: string;
  subject: CheckSubject;
  /** The bodies. Absent on the two ending checks, which have a note and nothing to enumerate. */
  items?: CheckItem[];
  /** Derived, and stored so a reader never has to re-derive it: only FINDINGS counts. */
  countsAsFinding?: boolean;
}

/** What a reader gets back: the stored entry, plus whether it still describes the text in hand. */
export interface CheckRead extends CheckEntry {
  stale: boolean;
  /** FINDINGS / CLEAN / INFO / NOT_RUN / STALE — what to SHOW. STALE outranks the stored state. */
  display: CheckState | 'STALE';
}

export const CHECKS_VERSION = 1;

export function fingerprint(text: any): string {
  return createHash('sha256').update(String(text == null ? '' : text), 'utf8').digest('hex');
}

/**
 * Build one entry. `text` is what the verdict actually judged — not what it is about in general.
 * An empty reason is refused for NOT_RUN by substituting an explicit one, so the row can never say
 * "no verdict" without saying why.
 */
export function checkEntry(
  kind: string, state: CheckState, reason: string, text: any, subject: CheckSubject = 'revision.pageText',
  now: Date = new Date(),
): CheckEntry {
  const why = String(reason || '').trim();
  return {
    kind: String(kind || 'unknown'),
    state,
    reason: why || (state === 'NOT_RUN' ? 'no verdict returned, and no reason was recorded' : ''),
    at: now.toISOString(),
    sha256: fingerprint(text),
    subject,
  };
}

/**
 * THE FAIL-OPEN, TYPED AT THE ONE PLACE IT IS PRODUCED.
 *
 * `complete` keeps the caller's existing control flow — a check that cannot answer must still not
 * block a finished script, which is the fail-open's whole purpose and is not what F10 disputes.
 * What changes is the RECORD: `state` says NOT_RUN, so nothing downstream can read the abstention
 * as a pass.
 */
export function endingEntry(
  kind: string, verdict: { complete?: boolean; note?: string; failOpen?: boolean } | null | undefined,
  text: any, subject: CheckSubject = 'revision.pageText', now: Date = new Date(),
): CheckEntry {
  const v = verdict || {};
  if (v.failOpen) {
    return checkEntry(kind, 'NOT_RUN', String(v.note || '') || 'the check returned no usable verdict (fail-open)', text, subject, now);
  }
  if (v.complete === true) return checkEntry(kind, 'CLEAN', String(v.note || 'the ending was reached'), text, subject, now);
  if (v.complete === false) return checkEntry(kind, 'FINDINGS', String(v.note || 'the draft does not reach the outline\'s ending'), text, subject, now);
  // Neither true nor false is not a pass.
  return checkEntry(kind, 'NOT_RUN', String(v.note || '') || 'the verdict was neither complete nor incomplete', text, subject, now);
}

/** Merge one entry into a stored blob without disturbing other kinds. */
export function mergeChecks(existing: any, entry: CheckEntry): Record<string, CheckEntry> {
  const base = (existing && typeof existing === 'object' && !Array.isArray(existing)) ? { ...existing } : {};
  base[entry.kind] = entry;
  return base as Record<string, CheckEntry>;
}

/**
 * Read one stored entry against the text as it stands NOW.
 *
 * A mismatch is STALE, never CLEAN. Entries whose subject is not the revision's text cannot be
 * compared and are returned unstaled — reporting STALE for something that was never fingerprinted
 * against pageText would be a false alarm forever.
 */
export function readCheckEntry(entry: any, currentText: any): CheckRead | null {
  if (!entry || typeof entry !== 'object') return null;
  const state = (['FINDINGS', 'CLEAN', 'INFO', 'NOT_RUN'].indexOf(entry.state) >= 0 ? entry.state : 'NOT_RUN') as CheckState;
  const e: CheckEntry = {
    kind: String(entry.kind || 'unknown'),
    state,
    reason: String(entry.reason || ''),
    at: String(entry.at || ''),
    sha256: String(entry.sha256 || ''),
    subject: (['revision.pageText', 'plan.tail', 'plan', 'none'].indexOf(entry.subject) >= 0 ? entry.subject : 'none') as CheckSubject,
    ...(Array.isArray(entry.items) ? { items: entry.items as CheckItem[] } : {}),
    countsAsFinding: state === 'FINDINGS',
  };
  const comparable = e.subject === 'revision.pageText' && !!e.sha256;
  const stale = comparable && fingerprint(currentText) !== e.sha256;
  return { ...e, stale, display: stale ? 'STALE' : e.state };
}

/** Read a whole blob against the current text, newest question first: what should a reader SHOW? */
export function readChecks(checks: any, currentText: any): CheckRead[] {
  if (!checks || typeof checks !== 'object' || Array.isArray(checks)) return [];
  return Object.keys(checks)
    .map((k) => readCheckEntry({ ...(checks as any)[k], kind: (checks as any)[k]?.kind || k }, currentText))
    .filter((x): x is CheckRead => !!x);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// PLAN 01 TASK 1A — THE SHAPE FOR THE EIGHT END-OF-RUN SWEEPS
//
// WHY THIS IS HERE AND NOT IN A NEW FILE. The plan said "create revision-findings.util.ts". That
// was written before anyone looked: this module already owns the entry, the merge, the fingerprint
// and the per-subject staleness rule. A second module would have meant two CheckEntry shapes and
// two state unions — the "one EXPECTED_CHECKS in one file" rule broken one level up, by the commit
// that introduced the rule.
//
// WHAT THE RUN OF 2 OCT MEASURED. `recordRevisionCheck` is called for `ending` and `planEnding`
// and nothing else, so the revision's checks column held two entries. Eight sweeps ran after the
// script was written and reached a log only — and seven of the eight can finish SILENT when they
// find nothing: writtenDeaths, fixedAttributes and echo have no else branch at all, while clock
// speaks only above 8 time references, flashback only with a planned memory scene, and density
// only above 40 written scenes. Only `ledger` always says something. A finding whose single home
// is stdout is one restart from gone, and the stdout of the run before this one is already gone.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * THE ONE LIST. A kind that is not here gets no row, and a row that is not here cannot be shown —
 * so adding a sweep means adding it in exactly one place.
 *
 * `fixedAttributes` IS DELIBERATELY ABSENT. On its only measured run it reported 5 of 5 false, every
 * one a pronoun attributed to the wrong person. Storing that would put five false claims on the same
 * column that carries `ending: CLEAN`, and the next reader would have no way to tell which to trust.
 * A check that reports five defects in a draft containing none is worse than no check. Re-adding it
 * needs a fixture that shows a true positive, and the test on this constant is what makes that a
 * deliberate act rather than a one-line edit.
 */
export const EXPECTED_CHECKS: readonly string[] = [
  'ending', 'planEnding', 'planState',
  'nameDrift', 'ledger', 'writtenDeaths', 'clock', 'flashback', 'density', 'echo',
  'register',
];

/**
 * What each check's fingerprint is taken over. Not decoration: `readCheckEntry` only staleness-
 * checks `revision.pageText`, so a check listed against the wrong subject either never goes stale
 * when it should, or reads STALE on every revision ever written.
 */
export const SUBJECT_OF: Record<string, CheckSubject> = {
  ending: 'revision.pageText',
  planEnding: 'plan.tail',      // verifyPlanEnding is handed planTail; it never sees the page
  planState: 'plan',
  nameDrift: 'revision.pageText',
  ledger: 'revision.pageText',
  writtenDeaths: 'revision.pageText',
  clock: 'revision.pageText',
  flashback: 'revision.pageText',
  density: 'revision.pageText',
  echo: 'revision.pageText',
  register: 'revision.pageText',
};

/** Checks that report observations rather than verdicts. See the CheckState comment. */
export const INFO_CHECKS: ReadonlySet<string> = new Set(['echo']);

/**
 * A CLEAN FROM A DETECTOR THAT COULD NOT HAVE FIRED IS A FALSE ALL-CLEAR.
 *
 * `collectNameForms` matches names with /\b\p{Lu}[\p{Ll}\p{Lu}'’-]+…/gu. Arabic has no letter case,
 * so \p{Lu} matches nothing in it and the sweep returns [] on every Arabic script ever written.
 * Measured on a real 164-page Arabic draft: its cast IS recoverable — looksLikeCue accepts the
 * Arabic block and found 37 speakers, 36 of them yielding a key name — and collectNameForms still
 * returns 0 forms. The draft is readable; only its names are not. Read as CLEAN that is eight clean
 * sweeps over a script nothing checked.
 *
 * AND THE TEST IS A SHARE, NEVER THE PRESENCE OF A CHARACTER. Both naive rules fail on real drafts,
 * in opposite directions: that Arabic draft contains 2,404 Latin letters — (CONT'D), SUPER:,
 * transliterated names — so "contains Latin ⇒ readable" passes it at 1.6% Latin; and "contains
 * Arabic ⇒ unreadable" would blind the name check on an English page with one Arabic line in it.
 *
 * 0.5 is a starting value with margin on both sides, not a measurement: the two real scripts sit at
 * 1.6% and 100%, so the floor is nowhere near either.
 */
export const LATIN_SHARE_FLOOR = 0.5;

/** Latin letters as a share of ALL letters. No letters at all reads as 1: nothing to be blind to. */
export function latinShare(text: any): number {
  const s = String(text == null ? '' : text);
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (!letters) return 1;
  const latin = (s.match(/\p{Script=Latin}/gu) || []).length;
  return latin / letters;
}

const LATIN_ONLY = ['nameDrift', 'ledger', 'writtenDeaths', 'clock', 'flashback'];

/**
 * Could this detector have fired on this text? Keyed by check, because the answer is a property of
 * the detector and not of the script.
 *
 *   nameDrift      collectNameForms' RUN regex is \p{Lu}-anchored
 *   ledger         readScene's cue extraction is \p{Lu}-anchored
 *   writtenDeaths  English predicate and hedge regexes
 *   clock          CLOCK_WORD is English number words
 *   flashback      RECALLED_TIME_RE is Latin
 *   density        visual-line counting and heading keys — language-neutral (AR_SLUG_RE reads Arabic)
 *   echo           whitespace word repetition — language-neutral
 *
 * The two ending checks, planState and register are model calls and are not script-bound.
 */
export const CAN_DETECT: Record<string, (text: any) => boolean> = EXPECTED_CHECKS.reduce(
  (acc, kind) => {
    acc[kind] = LATIN_ONLY.indexOf(kind) >= 0
      ? (text: any) => latinShare(text) >= LATIN_SHARE_FLOOR
      : () => true;
    return acc;
  },
  {} as Record<string, (text: any) => boolean>,
);

/** What a blind detector says instead of nothing. One phrase per check, naming what it cannot read. */
const BLIND_REASON: Record<string, string> = {
  nameDrift: 'the name check cannot read names in this script — it matches capitalised runs, and this script has no letter case',
  ledger: 'the ledger cannot read speaker cues in this script — cue extraction matches capitalised runs',
  writtenDeaths: 'the written-death check cannot read death predicates in this script — its predicates are English',
  clock: 'the clock check cannot read spoken times in this script — its number words are English',
  flashback: 'the flashback check cannot read memory markers in this script — its markers are Latin',
};

/**
 * A number, or nothing. The explicit rejections are not defensive clutter — they are the bug this
 * function had: `Number(null)` is 0 and `Number('')` is 0, so a finding carrying `sceneIndex: null`
 * resolved to 0 and then to scene 1, pointing a reader at the first page of the script for a defect
 * that has no location at all. `Number(true)` is 1, with the same consequence.
 */
const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Where a finding sits, from whichever field the sweep that produced it happens to use.
 *
 *   scenes[]     ledger, echo         1-based scene numbers — the LATEST of them; see below
 *   sceneIndex   continuity, flashback, writtenDeaths   0-based -> +1
 *   from         density runs         already 1-based (findFragmentRuns emits start + 1)
 *
 * ClockRegression carries neither, so it resolves to null — which is the honest answer and the
 * reason `scene` is nullable rather than defaulted.
 *
 * A SPAN POINTS AT WHERE IT GOES WRONG, NOT WHERE IT STARTED. A REDISCOVERY over scenes [12, 40]
 * reads "WARD already learned this in scene 12": scene 12 is where the knowledge was legitimately
 * acquired and there is nothing to fix there. Scene 40 is the page that contradicts it. Sending a
 * reader to 12 sends them to the scene that is fine — so the latest scene in the span wins, by
 * maximum rather than by last element, because nothing guarantees the array is sorted.
 */
function sceneOf(f: any): number | null {
  if (!f || typeof f !== 'object') return null;
  if (Array.isArray(f.scenes) && f.scenes.length) {
    const ns = f.scenes.map(num).filter((n: number | null): n is number => n !== null);
    if (ns.length) return Math.max(...ns);
  }
  const idx = num(f.sceneIndex);
  if (idx !== null) return idx + 1;
  const from = num(f.from);
  if (from !== null) return from;
  return null;
}

/** A written death has no `detail` of its own, so one is composed from what it does carry. */
function detailOf(kind: string, f: any): string {
  const d = String((f && f.detail) || '').replace(/\s+/g, ' ').trim();
  if (d) return d;
  if (f && f.name) {
    const how = String(f.how || '').trim();
    const ev = String(f.evidence || '').trim();
    return String(f.name) + (how ? ' — ' + how : '') + (ev ? ' ("' + ev + '")' : '');
  }
  if (f && f.phrase) return '"' + String(f.phrase) + '"';
  return 'no detail was recorded on this ' + kind + ' finding';
}

/**
 * A register item is shaped unlike every other finding: { line, section, rule, draft, why }, where
 * `line` is a REGISTER line number and the only thing tying it to a page is `draft`, an exact
 * quote. Mapped generically it yields no location and no readable detail, so it is mapped here —
 * behind checkItems, so there is ONE door and findingsEntry cannot be called into the wrong one.
 */
export function registerItems(text: any, items: any): CheckItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((it: any) => {
    const line = num(it && it.line);
    const rule = String((it && it.rule) || '').replace(/\s+/g, ' ').trim();
    const why = String((it && it.why) || '').replace(/\s+/g, ' ').trim();
    return {
      scene: sceneOfQuote(text, it && it.draft),
      kind: 'REGISTER',
      detail: 'register line ' + (line === null ? '?' : line)
        + (rule ? ' ("' + rule + '")' : '') + (why ? ' — ' + why : ''),
    };
  });
}

/** Normalise any sweep's findings into located, legible items. */
export function checkItems(kind: string, findings: any, text?: any): CheckItem[] {
  if (!Array.isArray(findings)) return [];
  if (String(kind) === 'register') return registerItems(text, findings);
  return findings.map((f) => ({
    scene: sceneOf(f),
    kind: String((f && f.kind) || kind).toUpperCase(),
    detail: detailOf(kind, f),
  }));
}

const plural = (n: number, one: string, many = one + 's') => n + ' ' + (n === 1 ? one : many);

/**
 * Build the entry for one end-of-run sweep.
 *
 * THE THREE DISTINCTIONS THIS EXISTS TO KEEP, in the order they bite:
 *
 *   null vs []        null means the sweep produced NO RESULT. [] means it ran and found nothing.
 *                     Collapsing them is how a sweep that never ran reads as a pass.
 *   blind vs clean    [] from a detector that could not have fired is NOT_RUN, never CLEAN.
 *   INFO vs FINDINGS  echo observes; it does not judge. It is stored, and it is never a finding.
 *
 * `canDetect` can be passed explicitly when the caller already knows (a sweep that threw, say);
 * otherwise it is asked of CAN_DETECT with the text in hand.
 */
export function findingsEntry(
  kind: string, findings: any, text: any,
  subject: CheckSubject = SUBJECT_OF[kind] || 'revision.pageText',
  opts?: { canDetect?: boolean } | null,
  now: Date = new Date(),
): CheckEntry {
  const k = String(kind || 'unknown');
  const isInfo = INFO_CHECKS.has(k);
  const build = (state: CheckState, reason: string, items: CheckItem[]): CheckEntry => ({
    ...checkEntry(k, state, reason, text, subject, now),
    items,
    countsAsFinding: state === 'FINDINGS',
  });

  // A sweep that produced no result at all. Not an empty result — no result.
  if (findings == null) {
    return build('NOT_RUN', 'the ' + k + ' sweep did not run, so nothing is known either way', []);
  }

  const items = checkItems(k, findings, text);

  if (items.length) {
    if (isInfo) {
      return build('INFO', plural(items.length, 'phrase') + ' the draft returns to — motif or tic, the writer decides', items);
    }
    return build('FINDINGS', plural(items.length, k + ' finding'), items);
  }

  // Nothing found. Whether that is CLEAN depends on whether anything COULD have been found.
  const canDetect = (opts && typeof opts.canDetect === 'boolean')
    ? opts.canDetect
    : (CAN_DETECT[k] ? CAN_DETECT[k](text) : true);
  if (!canDetect) {
    const share = Math.round(latinShare(text) * 1000) / 10;
    return build('NOT_RUN',
      (BLIND_REASON[k] || 'the ' + k + ' check cannot read this script') + ' (Latin letters are ' + share + '% of all letters)',
      []);
  }
  if (isInfo) return build('INFO', 'no phrase the draft returns to', []);
  return build('CLEAN', 'the ' + k + ' sweep ran and found nothing', []);
}

/**
 * A sweep that THREW. Every one of the eight is wrapped in a try/catch that logs "check skipped"
 * and moves on, which leaves the revision unable to tell a skipped sweep from a clean one.
 */
export function sweepFailed(kind: string, err: any, text: any,
  subject: CheckSubject = SUBJECT_OF[String(kind)] || 'revision.pageText', now: Date = new Date(),
): CheckEntry {
  const why = String((err && err.message) || err || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  // SAY IT ONCE. The caller's own reason already describes a failure ("the plan-state extraction
  // failed outright — …"), and this sentence used to prepend a second one, so the row read "the
  // planState sweep failed … — the plan-state extraction failed outright — …". The framing is this
  // function's job; the specifics are the caller's.
  return {
    ...checkEntry(String(kind || 'unknown'), 'NOT_RUN',
      'the ' + String(kind) + ' check produced no result, so nothing is known either way — ' + (why || 'no reason was reported'),
      text, subject, now),
    items: [],
    countsAsFinding: false,
  };
}

/**
 * SHOULD THE PLAN-ENDING CHECK BE ASKED AGAIN? Only when the first answer was not an answer.
 *
 * WHAT HAPPENED ON 2 OCT. planScenes checks the plan's ending inside a repair loop, breaks out as
 * soon as a verdict says complete — and then runs an unconditional "last check" on the final tail.
 * Two scripton.feature.coverage calls landed six seconds apart, both at ceiling 400:
 *
 *   12:42:39.881Z  out 310  stop end_turn    196 chars   A USABLE VERDICT
 *   12:42:45.868Z  out 400  stop max_tokens   33 chars   cut off — and this is the one that stored
 *
 * The full log carries exactly ONE "no usable verdict" line. So the first call answered and logged
 * nothing, because success on that path is silent, and the repeat replaced a real verdict with an
 * abstention. The record then said NOT_RUN about a plan that had in fact been checked and passed.
 *
 * THE CONDITION IS NARROW, DELIBERATELY. Skipping on any `complete: true` would make an abstention
 * permanent — a fail-open also says complete: true, which is the same conflation resolveSecondLook
 * exists to stop one function above this. So:
 *
 *   typed verdict, nothing repaired   -> do NOT ask again. The answer stands.
 *   ABSTENTION                        -> ask again. It never answered.
 *   anything repaired                 -> ask again. The plan is not the plan that was judged.
 *   no verdict at all                 -> ask again.
 */
export function shouldRecheckPlanEnding(
  verdict: { complete?: boolean; failOpen?: boolean } | null | undefined,
  opts?: { repaired?: number } | null,
): boolean {
  const repaired = Number((opts && opts.repaired) || 0) > 0;
  if (repaired) return true;
  const v = verdict || null;
  if (!v || typeof v.complete !== 'boolean') return true;
  if (v.failOpen) return true;
  return v.complete !== true;
}

/**
 * THE REGISTER CHECK, AS A ROW ON THE REVISION.
 *
 * WHY IT NEEDS ITS OWN ENTRY BUILDER. A register item is { line, section, rule, draft, why } and
 * `line` is a REGISTER line number — not a script line, not a scene. checkItems would read no
 * location from it at all and no detail worth printing, and the generic FINDINGS summary would say
 * "1 register finding" where the useful sentence is the rule it contradicts.
 *
 * THE SCENE IS FOUND, NOT DERIVED. The only thing tying a contradiction to a page is `draft`, an
 * exact quote the model lifted out of the script. So the quote is searched for, and the answer is
 * null when it is not there — a guessed scene number sends a reader to a page with nothing wrong
 * on it, which is worse than sending them nowhere, because they will look, find nothing, and
 * distrust the finding.
 *
 * NO BIBLE IS NOT CLEAN, AND NOT ABSENT. checkAgainstRegister returns null when there are no
 * register lines, and the stage call site is guarded by `if (registerFacts.length)` so the method
 * is not even entered — two separate silences. `opts.lines === 0` is the case, and it records
 * NOT_RUN naming the reason, because "no contradictions found" about a script checked against
 * nothing is the strongest possible false statement this column can carry.
 *
 * RAN AND FAILED IS NOT CLEAN EITHER. The error shape is ok:false / contradicted:null with an empty
 * items array — byte-identical to a clean result everywhere except those two fields.
 */
export function registerEntry(
  report: any, text: any, opts?: { lines?: number } | null, now: Date = new Date(),
): CheckEntry {
  const subject: CheckSubject = SUBJECT_OF.register || 'revision.pageText';
  const build = (state: CheckState, reason: string, items: CheckItem[] = []): CheckEntry => ({
    ...checkEntry('register', state, reason, text, subject, now),
    items,
    countsAsFinding: state === 'FINDINGS',
  });

  if (opts && Number(opts.lines) === 0) {
    return build('NOT_RUN',
      'no bible — there are no register lines to check against, so nothing about this script has been verified against a source');
  }
  if (report == null) {
    return build('NOT_RUN', 'the register check produced no result, so nothing is known either way');
  }
  if (report.ok === false || report.contradicted == null) {
    const err = String(report.error || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    return build('NOT_RUN', 'the register check ran and failed, so nothing is known either way'
      + (err ? ' — ' + err : ''));
  }

  const items = registerItems(text, report.items);

  if (!items.length) {
    return build('CLEAN', 'no contradictions against ' + (num(report.checked) ?? '?') + ' register line(s)');
  }
  return build('FINDINGS',
    items.length + ' of ' + (num(report.checked) ?? '?') + ' register line(s) contradicted by the script',
    items);
}

/**
 * Which scene contains this exact quote, 1-based, or null.
 *
 * Scenes are split on the slug lines the script itself carries, so this counts the same boundaries
 * paginate and parseScenes do without importing either — a quote in the body of scene 2 answers 2.
 * A quote that appears nowhere answers null, and an empty quote answers null rather than 1.
 */
export function sceneOfQuote(text: any, quote: any): number | null {
  const q = String(quote == null ? '' : quote).replace(/\s+/g, ' ').trim();
  if (!q) return null;
  const body = String(text == null ? '' : text);
  const flat = body.replace(/\s+/g, ' ');
  if (flat.indexOf(q) < 0) return null;
  const lines = body.split('\n');
  let scene = 0;
  let seen = '';
  for (const ln of lines) {
    if (SLUG_RE.test(ln.trim()) || AR_SLUG_RE.test(ln.trim())) {
      scene++;
      seen = '';
      continue;
    }
    seen = (seen + ' ' + ln).replace(/\s+/g, ' ');
    if (seen.indexOf(q) >= 0) return scene > 0 ? scene : null;
  }
  return null;
}
