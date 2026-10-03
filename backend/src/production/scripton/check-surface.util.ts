import {
  EXPECTED_CHECKS, fingerprint, readCheckEntry,
  type CheckEntry, type CheckItem, type CheckState, type CheckSubject,
} from './revision-checks.util';

/**
 * PLAN 01 TASK 2 — WHAT A READER IS SHOWN, INCLUDING ABOUT THE CHECKS THAT NEVER RAN.
 *
 * WHAT THE 2 OCT RUN MEASURED. The revision's `checks` column held exactly two entries:
 *
 *   ending     CLEAN,   at 13:01:51Z
 *   planEnding NOT_RUN, at 12:42:52Z, "no usable verdict returned by the plan-ending check"
 *
 * The STORAGE was right — the abstention was typed NOT_RUN rather than laundered into a pass, and
 * the reason is on the row. NOTHING SHOWED IT. No file under frontend/src/components/scripton
 * mentions `checks` at all. So a reader saw a finished 122-page script with no sign that one of its
 * two checks had abstained, in the same minute that a plan-state chunk was truncated.
 *
 * `readChecks` in revision-checks.util reads a stored blob, and it is not enough for this job: it
 * returns one row per entry that is PRESENT. A check nobody ever wired up and a check that ran
 * clean therefore produce the same thing — nothing. This walks EXPECTED_CHECKS instead, so the
 * absence is a row.
 *
 * SIX DISPLAY STATES, and the two that are new here are the ones the column cannot say by itself:
 *
 *   FINDINGS  it ran and found something
 *   CLEAN     it ran and found nothing
 *   INFO      it reports observations, not verdicts (echo). A pass, never a finding.
 *   NOT_RUN   it produced no result, and the row says why
 *   STALE     the verdict outlived the text it judged
 *   ABSENT    there is no entry at all — nothing ever wrote one
 *
 * ONLY CLEAN AND INFO ARE PASSES. If ABSENT read as a pass this module would have reproduced the
 * defect it exists to end, one layer further out.
 *
 * Pure; never throws.
 */

export type CheckDisplay = CheckState | 'STALE' | 'ABSENT';

/** Staleness is a third state, not a boolean: "not compared" is not "unchanged". */
export const UNCHECKED = 'UNCHECKED';
export type Staleness = 'FRESH' | 'STALE' | typeof UNCHECKED;

export interface CheckRow {
  kind: string;
  display: CheckDisplay;
  /** Why, in words — including for ABSENT, where the words are the only content there is. */
  reason: string;
  /** CLEAN and INFO only. ABSENT, NOT_RUN and STALE are not passes. */
  isPass: boolean;
  /** FINDINGS only. INFO is deliberately excluded; see revision-checks.util's CheckState comment. */
  countsAsFinding: boolean;
  staleness: Staleness;
  subject: CheckSubject | null;
  at: string | null;
  items: CheckItem[];
  /** True for a stored kind that is not on EXPECTED_CHECKS — shown anyway rather than dropped. */
  unexpected?: boolean;
}

/** The texts the entries claim to judge, by subject. Any may be omitted; omission is UNCHECKED. */
export type SubjectTexts = Partial<Record<CheckSubject, any>>;

const isObj = (v: any): boolean => !!v && typeof v === 'object' && !Array.isArray(v);

const absentRow = (kind: string): CheckRow => ({
  kind,
  display: 'ABSENT',
  reason: 'no result for this check was ever recorded on this revision',
  isPass: false,
  countsAsFinding: false,
  staleness: UNCHECKED,
  subject: null,
  at: null,
  items: [],
});

/**
 * One row from one stored entry.
 *
 * STALENESS IS JUDGED AGAINST THE ENTRY'S OWN SUBJECT, and this is the part that is easy to get
 * wrong in a way that trains a reader to ignore the word. `ending` is fingerprinted over the page
 * text; `planEnding` over the plan tail, which verifyPlanEnding is handed and which the page never
 * contains. Compare every entry against pageText and planEnding reads STALE on every revision ever
 * written. Compare only pageText entries and a plan that changed under a plan-side verdict goes
 * unreported. So: each subject is compared against its own text, when that text is supplied.
 *
 * A subject that was NOT supplied is UNCHECKED — not FRESH. Claiming a comparison nobody made is
 * the same class of false record as an untyped abstention.
 */
function rowFor(kind: string, entry: any, subjects: SubjectTexts, unexpected?: boolean): CheckRow {
  // readCheckEntry does the state whitelisting and the junk degradation; its own staleness check
  // only ever looks at revision.pageText, so the verdict here is computed instead of taken.
  const e = readCheckEntry({ ...(isObj(entry) ? entry : {}), kind }, undefined) as (CheckEntry & { state: CheckState }) | null;
  if (!e) return { ...absentRow(kind), ...(unexpected ? { unexpected } : {}) };

  const subject = e.subject;
  const have = Object.prototype.hasOwnProperty.call(subjects || {}, subject) && (subjects as any)[subject] !== undefined;
  // `none` declares that nothing was fingerprinted, so there is nothing to compare and never will be.
  const comparable = have && subject !== 'none' && !!e.sha256;
  const staleness: Staleness = comparable
    ? (fingerprint((subjects as any)[subject]) === e.sha256 ? 'FRESH' : 'STALE')
    : UNCHECKED;

  const display: CheckDisplay = staleness === 'STALE' ? 'STALE' : e.state;
  return {
    kind,
    display,
    reason: e.reason || '',
    isPass: display === 'CLEAN' || display === 'INFO',
    countsAsFinding: display === 'FINDINGS',
    staleness,
    subject,
    at: e.at || null,
    items: Array.isArray(e.items) ? e.items : [],
    ...(unexpected ? { unexpected } : {}),
  };
}

/**
 * One row per expected check, in EXPECTED_CHECKS order so a reader can place a finding in the run,
 * followed by any stored kind that is not expected — flagged, never dropped. A kind that was
 * removed from EXPECTED_CHECKS but is still on old revisions (fixedAttributes is exactly this)
 * must not disappear from the surface just because the list moved on.
 */
export function checkSurface(checks: any, subjects: SubjectTexts = {}): CheckRow[] {
  const blob = isObj(checks) ? checks : {};
  const rows = EXPECTED_CHECKS.map((kind) => (
    Object.prototype.hasOwnProperty.call(blob, kind) ? rowFor(kind, blob[kind], subjects) : absentRow(kind)
  ));
  for (const kind of Object.keys(blob)) {
    if (EXPECTED_CHECKS.indexOf(kind) < 0) rows.push(rowFor(kind, blob[kind], subjects, true));
  }
  return rows;
}

/** FINDINGS rows. INFO is not one of them. */
export function findingsCount(rows: CheckRow[]): number {
  return (rows || []).filter((r) => r && r.display === 'FINDINGS').length;
}

/**
 * Rows where nothing was checked: NOT_RUN, ABSENT and STALE.
 *
 * STALE belongs here and that is deliberate. A verdict whose text has since changed is not a
 * verdict about the script in front of the reader, so for the purpose of "has this been checked",
 * it has not been.
 */
export function notRunCount(rows: CheckRow[]): number {
  return (rows || []).filter((r) => r && (r.display === 'NOT_RUN' || r.display === 'ABSENT' || r.display === 'STALE')).length;
}

export interface SurfaceSummary {
  findings: number; notRun: number; clean: number; info: number; stale: number; absent: number;
  /** TRUE only when every expected check RAN and found nothing. Never true with an unchecked row. */
  allClear: boolean;
}

/**
 * The counts a one-line summary needs.
 *
 * `allClear` requires zero findings AND zero unchecked rows, because "0 findings" printed over two
 * checks that never ran is the `rental/logistics` "Alerts 0" defect — an all-clear asserted on an
 * unread board. A reader seeing no findings and six absences should be told about the absences
 * first.
 */
export function surfaceSummary(rows: CheckRow[]): SurfaceSummary {
  const list = rows || [];
  const n = (d: CheckDisplay) => list.filter((r) => r && r.display === d).length;
  const findings = findingsCount(list);
  const notRun = notRunCount(list);
  return {
    findings,
    notRun,
    clean: n('CLEAN'),
    info: n('INFO'),
    stale: n('STALE'),
    absent: n('ABSENT'),
    allClear: findings === 0 && notRun === 0 && list.length > 0,
  };
}
