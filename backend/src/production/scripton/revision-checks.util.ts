import { createHash } from 'node:crypto';

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

export type CheckState = 'FINDINGS' | 'CLEAN' | 'NOT_RUN';
/** What the sha256 was taken over. Only `revision.pageText` can go stale against a revision. */
export type CheckSubject = 'revision.pageText' | 'plan.tail' | 'none';

export interface CheckEntry {
  kind: string;
  state: CheckState;
  /** Why, in words. Required for NOT_RUN — an abstention with no reason is not better than a lie. */
  reason: string;
  at: string;
  sha256: string;
  subject: CheckSubject;
}

/** What a reader gets back: the stored entry, plus whether it still describes the text in hand. */
export interface CheckRead extends CheckEntry {
  stale: boolean;
  /** FINDINGS / CLEAN / NOT_RUN / STALE — what to SHOW. STALE outranks the stored state. */
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
  const e: CheckEntry = {
    kind: String(entry.kind || 'unknown'),
    state: (['FINDINGS', 'CLEAN', 'NOT_RUN'].indexOf(entry.state) >= 0 ? entry.state : 'NOT_RUN') as CheckState,
    reason: String(entry.reason || ''),
    at: String(entry.at || ''),
    sha256: String(entry.sha256 || ''),
    subject: (['revision.pageText', 'plan.tail', 'none'].indexOf(entry.subject) >= 0 ? entry.subject : 'none') as CheckSubject,
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
