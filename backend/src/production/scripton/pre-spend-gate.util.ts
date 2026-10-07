/**
 * C2 — READ THE CHECKS BEFORE SPENDING, NOT AFTER.
 *
 * On 20 Sep the register check found that STEP_OUTLINE step 13 placed Thomas's admission in Cape
 * Breton where the source places it in Boston, named it line 39, and stored the finding on the
 * version. Then 79 scenes were written on top of it. The result was sitting on the row the whole
 * time; nothing read it.
 *
 * This reads the checks already stored on the versions a stage is about to consume (C1's
 * data.consumed names them) and stops for a decision. It does not fix anything and does not
 * regenerate anything — amending is C3.
 *
 * THREE STATES, NEVER A MERGED VERDICT, and each check keeps its own:
 *
 *   FINDINGS  the check ran and found something. Name the lines.
 *   CLEAN     the check ran and found nothing.
 *   NOT_RUN   no result is stored, or the stored result has no verdict.
 *
 * AN ABSENT FIELD IS NOT_RUN. IT IS NEVER A PASS. That distinction is the entire point: this system
 * has now produced the same conflation four times — registerCheck's zero ("clean" and "nothing
 * testable" render identically), keepCheck absent on five of seven stages, verifyPlanEnding's
 * fail-open typing abstention as {complete:true}, and a task notification whose exit code 0 means
 * the server is down. A gate that renders CLEAN and NOT_RUN the same way would be the fifth.
 *
 * registerCheck is the one that needs deriving: unlike eraCheck and keepCheck it stores no `state`,
 * only `ok` / `contradicted` / `items`. A stored result with ok === false, or contradicted === null,
 * RAN AND FAILED — which is not a pass either, so it reads NOT_RUN.
 *
 * Pure; never throws.
 */

import { registerReplyCutOff } from './canon/register-check.util';

export type CheckState = 'FINDINGS' | 'CLEAN' | 'NOT_RUN';

export interface CheckRead {
  check: string;
  state: CheckState;
  /** Register-check line numbers, when it has them. */
  lines: number[];
  /** See CheckAdvice. Present only when this finding knows a better closing line than "amend". */
  advice?: CheckAdvice;
  /**
   * WHAT IS WRONG, NOT ONLY WHERE. A register finding reached the reader as "2 of 105 lines
   * contradicted … Line(s): 36, 52." and nothing more — and the reader is the person being asked
   * to waive it. A line number is not something anyone can weigh. Each stored item carries a
   * `why`; this is that, one entry per item, so the refusal says what the contradiction IS.
   */
  items: Array<{ line: number | null; why: string }>;
  detail: string;
}

/**
 * WHAT WOULD ACTUALLY HELP, when this finding is the only thing stopping the run.
 *
 * Every stop ends "Amend the upstream stage, or re-run with the findings waived to proceed anyway."
 * For an UNPROVEN keep check that is wrong twice over: nothing in the treatment is known to be
 * wrong, and amending it cannot change whether the checker quoted accurately. The reader's job there
 * is to read the quote against the draft — so the check that knows its own situation says what it is,
 * and gateText uses it when there is nothing else to amend.
 *
 * Set by readCheck. Absent on every other finding, which is how gateText knows to keep the default.
 */
export type CheckAdvice = string;

export interface ConsumedRead { kind: string; versionId: string; checks: CheckRead[] }

export interface GateReport {
  reads: ConsumedRead[];
  findings: number;
  notRun: number;
  clean: number;
  /** True when any consumed version has a stored finding. */
  stop: boolean;
  text: string;
}

const arr = (v: any): any[] => (Array.isArray(v) ? v : []);

/**
 * A REFUSAL HAS TO BE READABLE OR IT WILL BE SKIMMED PAST.
 *
 * Measured on Jason Quick V3.2: the era check's own summary explains its methodology in ~450
 * characters, and six stages x three checks put ~4 KB between a reader and the one line that
 * matters. FINDINGS keep their full detail — that is what the stop is about. Everything else is
 * trimmed to its first sentence, because "checked, clean" needs no argument.
 */
const brief = (s: string, max = 110): string => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' · '));
  return (stop > 40 ? cut.slice(0, stop) : cut).trim() + '…';
};

/** eraCheck / keepCheck publish their own state; registerCheck does not and is derived. */
export function readCheck(name: string, value: any): CheckRead {
  const out = (state: CheckState, detail: string, lines: number[] = [], items: CheckRead['items'] = [],
    advice?: CheckAdvice): CheckRead =>
    ({ check: name, state, lines, items, detail, ...(advice ? { advice } : {}) });
  if (value == null) return out('NOT_RUN', 'no ' + name + ' is stored on this version');

  if (name === 'registerCheck') {
    const items = arr(value.items);
    /**
     * THE SAME CUT-OFF RULE AS registerEntry, FROM THE SAME PREDICATE.
     *
     * This branch derives the state itself, because the stored registerCheck publishes none. Its
     * rule was: items -> FINDINGS, else ok === false || contradicted == null -> NOT_RUN, else CLEAN.
     * A reply truncated just after `"contradictions": [` stores ok: true, contradicted: 0, items: []
     * — byte-identical to a clean result in every field this branch reads — so it read CLEAN here,
     * on every ladder stage, and would clear a stage for spending on 193 rules nobody answered about.
     *
     * registerReplyCutOff is imported rather than re-expressed, so the row and the gate cannot
     * disagree about what "cut off" means. A control asserts they agree on every shape.
     */
    const cutOff = registerReplyCutOff(value);
    if (items.length) {
      const lines = items.map((i: any) => Number(i && i.line)).filter((n: number) => isFinite(n) && n > 0);
      // `why` is the stored reason. It falls back to `rule` rather than to nothing: a rule quoted
      // beside the line is still grounds a reader can judge, where a bare number is not. An item
      // with neither says so outright, because silence would read as "no reason to worry".
      const detailed = items.map((i: any) => {
        const n = Number(i && i.line);
        const why = String((i && (i.why || i.rule)) || '').replace(/\s+/g, ' ').trim();
        return { line: isFinite(n) && n > 0 ? n : null, why: why || 'no reason recorded on this item' };
      });
      // Cut off WITH contradictions is still a stop, and is never presented as the whole list:
      // NOT_RUN here would hide contradictions the checker did find.
      return out('FINDINGS', cutOff
        ? 'at least ' + items.length + ' contradiction' + (items.length === 1 ? '' : 's')
          + ' against ' + (value.checked ?? '?') + ' register line(s) — the reply was cut off, so the list is incomplete'
        : String(value.summary || (items.length + ' contradiction(s)')), lines, detailed);
    }
    if (cutOff) {
      return out('NOT_RUN', 'the register check\'s reply was cut off before it reported anything,'
        + ' so nothing is known either way');
    }
    // RAN AND FAILED IS NOT CLEAN. The error shape stores ok:false / contradicted:null with an
    // empty items array, which is byte-identical to a clean result everywhere except these fields.
    if (value.ok === false || value.contradicted == null) {
      return out('NOT_RUN', 'the register check did not return a verdict' + (value.error ? ' (' + String(value.error).slice(0, 120) + ')' : ''));
    }
    return out('CLEAN', String(value.summary || 'no contradictions against ' + (value.checked ?? '?') + ' line(s)'));
  }

  const state = String(value.state || '').toUpperCase();
  if (state === 'NOT RUN' || state === 'NOT_RUN') return out('NOT_RUN', String(value.reason || value.summary || 'recorded as NOT RUN'));
  /**
   * UNPROVEN STOPS, AND IT IS NOT "MISSING".
   *
   * The keep check's fourth state: the checker claimed a thing is in the draft and quoted words that
   * are not. Nothing has been shown either way, so it is not a pass — but it is not the draft
   * missing anything either, and the one time it was reported as such the refusal was waived twice
   * with a blanket boolean that cleared every other finding on those versions. The stored summary
   * already says "claimed but not shown"; the fallback here says it too, for a row written before
   * that wording existed.
   */
  if (state === 'UNPROVEN') {
    const n = arr(value.unproven).length;
    /**
     * WHICH CLOSING LINE IS TRUE DEPENDS ON THE ROW, NOT ON THE COMMIT.
     *
     * The plan had this commit ship the pre-re-ask sentence and 2B.2 replace it. But a keepCheck
     * stored before the re-ask existed has not been asked twice and never will be, so after 2B.2 the
     * gate would claim a second ask that never happened for every row already on disk. The record
     * says which is true: KeepReaskRecord is absent when nobody asked twice, and carries `failed`
     * when the second call did not land — and a failed second call settled nothing, so the first
     * sentence still holds there.
     */
    const reask = value.reask;
    const asked = !!reask && !reask.failed;
    const advice = asked
      ? 'The checker was asked again and still could not quote the words.'
        + ' Read the quote above against the draft, then waive to proceed.'
      : 'Nothing in the upstream stage is known to be wrong: the checker quoted words that are not'
        + ' in the draft, so its own evidence failed.'
        + ' Read the quote above against the draft, then waive to proceed.';
    return out('FINDINGS', String(value.summary
      || (n + ' thing(s) claimed but not shown — the checker quoted words that are not in the draft')),
      [], [], advice);
  }
  if (state === 'FINDINGS' || state === 'MISSES') {
    const n = arr(value.findings).length || arr(value.items).length || Number(value.misses) || 0;
    return out('FINDINGS', String(value.summary || (n + ' ' + (state === 'MISSES' ? 'miss(es)' : 'finding(s)'))));
  }
  if (state === 'NO FINDINGS' || state === 'NO MISSES') return out('CLEAN', String(value.summary || 'nothing found'));
  // A stored object with no state we recognise has told us nothing.
  return out('NOT_RUN', 'the stored ' + name + ' has no recognisable verdict');
}

/**
 * A WAIVER IS A BOOLEAN TRUE, NOTHING ELSE.
 *
 * Both gates tested `!opts?.waiveChecks`, and generate-async spreads the raw request body into
 * startStage — so waiveChecks of '0', 'false', 1, {} or [] all waived a gate whose entire purpose
 * is to be hard to pass. It lives here rather than inline in the two `if`s so the rule is one thing
 * with one test, instead of a condition repeated 4,000 lines apart and able to drift.
 */
export function isWaived(opts?: { waiveChecks?: unknown } | null): boolean {
  return !!opts && (opts as any).waiveChecks === true;
}

export const GATE_CHECKS = ['registerCheck', 'eraCheck', 'keepCheck'];

/**
 * THE KEEP CHECK IS WRITTEN ON TREATMENT AND NOWHERE ELSE.
 *
 * Run 2's refusal ran to fourteen lines. One was the finding. FIVE were "no keepCheck is stored on
 * this version", for LOGLINE, SYNOPSIS, BEATS, SCENES and STEP_OUTLINE — none of which ever stores
 * one, because generateStage runs the keep check on TREATMENT alone. Those five absences are a fact
 * about the pipeline, not about the material, and printing them as unran checks both buried the one
 * line that mattered and inflated notRun fivefold in a report whose whole job is to be read before
 * a waiver.
 *
 * Skipped, not defaulted to clean: a TREATMENT with no stored keepCheck still reads NOT RUN, because
 * there the absence IS the fact. One standing line replaces the five.
 */
export const KEEP_CHECK_STAGE = 'TREATMENT';

export function checksForStage(kind: string, checks: string[]): string[] {
  const k = String(kind || '').toUpperCase();
  return checks.filter((c) => c !== 'keepCheck' || k === KEEP_CHECK_STAGE);
}

export function preSpendGate(
  consumed: Record<string, string> | null | undefined,
  versions: Array<{ id: string; kind?: string; data?: any }>,
  opts?: { checks?: string[] },
): GateReport {
  const checks = (opts && opts.checks) || GATE_CHECKS;
  const reads: ConsumedRead[] = [];
  for (const kind of Object.keys(consumed || {})) {
    const versionId = String((consumed as any)[kind]);
    const row = (versions || []).find((v) => v && v.id === versionId);
    const data = (row && row.data) || null;
    reads.push({ kind, versionId, checks: checksForStage(kind, checks).map((c) => readCheck(c, data ? data[c] : null)) });
  }
  const all = reads.reduce<CheckRead[]>((a, r) => a.concat(r.checks), []);
  const findings = all.filter((c) => c.state === 'FINDINGS').length;
  const notRun = all.filter((c) => c.state === 'NOT_RUN').length;
  const clean = all.filter((c) => c.state === 'CLEAN').length;
  const report: GateReport = { reads, findings, notRun, clean, stop: findings > 0, text: '' };
  report.text = gateText(report);
  return report;
}

/**
 * THREE DIFFERENT RENDERINGS, WORST FIRST. If CLEAN and NOT_RUN read the same to a person, this
 * module has reproduced the defect it exists to end — so they use different verbs and NOT_RUN says
 * outright that it is not a pass.
 *
 * THE ORDER IS THE FIX. This used to walk the consumed versions in ladder order and print all three
 * states inline, so a refusal opened with LOGLINE's two clean lines. On Jason Quick (build
 * cmuqt6rki0007kn6r70s5ernv, 2 Oct) the writer saw 299 characters of it: the header, LOGLINE
 * registerCheck clean, LOGLINE eraCheck clean — and then it stopped. The finding that caused the
 * stop and the sentence saying what to do about it were both below the cut. A refusal whose reason
 * is off-screen is indistinguishable from a refusal with no reason.
 *
 * So: FINDINGS first, because that is what the stop is about. NOT RUN second, because silence is not
 * evidence and the reader has to decide about it. Clean last and as ONE COUNT LINE — "checked, clean"
 * needs no argument and, printed per check, it is what pushed everything else off the screen.
 */
export function gateText(report: GateReport): string {
  if (!report.reads.length) return 'PRE-SPEND CHECK: nothing recorded as consumed, so there is nothing to read.';
  const out: string[] = [];
  out.push(report.stop
    ? 'PRE-SPEND CHECK — STOPPED. The versions this stage is about to be written from carry stored findings:'
    : 'PRE-SPEND CHECK — no stored findings on the versions about to be consumed:');

  // Ladder order is kept WITHIN each state, so a reader can still place a finding in the ladder.
  const inState = (s: CheckState) =>
    report.reads.flatMap((r) => r.checks.filter((c) => c.state === s).map((c) => ({ kind: r.kind, c })));

  const findings = inState('FINDINGS');
  if (findings.length) {
    out.push('FINDINGS (' + findings.length + ') — this is the stop:');
    for (const { kind, c } of findings) {
      out.push('  ' + kind + ' — ' + c.check + ': ' + c.detail
        + (c.lines.length ? '  Line(s): ' + c.lines.join(', ') + '.' : ''));
      // One line per contradiction, under its stage. This is the part a person can actually weigh,
      // and it is what the summary line was standing in for.
      for (const it of c.items) out.push('      line ' + (it.line == null ? '?' : it.line) + ': ' + brief(it.why, 240));
    }
  }

  const notRun = inState('NOT_RUN');
  if (notRun.length) {
    // "NOT a pass" stays capitalised: an existing test pins that emphasis and it is the whole
    // reason this state is rendered separately at all.
    out.push('NOT RUN (' + notRun.length + ') — this is NOT a pass; nothing has been checked here:');
    for (const { kind, c } of notRun) out.push('  ' + kind + ' — ' + c.check + ': ' + brief(c.detail));
  }

  const clean = inState('CLEAN');
  if (clean.length) out.push(clean.length + ' other check(s): checked, clean.');

  // The five lines, as one. Printed only when a consumed stage actually had it skipped — with
  // TREATMENT the sole stage consumed, nothing was skipped and the note would be noise.
  if (report.reads.some((r) => String(r.kind || '').toUpperCase() !== KEEP_CHECK_STAGE)) {
    out.push('keepCheck: the keep check covers ' + KEEP_CHECK_STAGE + ' only.');
  }

  if (report.stop) {
    // ONLY when every finding knows a better line. One other finding and amending IS the remedy for
    // it, so the default returns — a mixed stop must not be softened by the one that is not a defect.
    const advised = findings.length && findings.every(({ c }) => !!c.advice) ? findings[0].c.advice : null;
    out.push(advised || 'Amend the upstream stage, or re-run with the findings waived to proceed anyway.');
  } else if (report.notRun) {
    out.push('Nothing blocks this run, but ' + report.notRun + ' check(s) never ran — their silence is not evidence.');
  }
  return out.join('\n');
}

/**
 * A GATE REFUSAL MUST REACH THE READER WHOLE — marked on the error, not sniffed from its text.
 *
 * startStage records a failure through why(), which caps at 300 characters AND collapses every run
 * of whitespace, so a gate refusal arrived truncated and with its line breaks gone. The cap is right
 * for an exception message; it is wrong for the one error whose entire purpose is to be read. This
 * flag lets that one path opt out without loosening anything else, and without matching on a string
 * prefix that a reworded header would silently break.
 */
export const PRE_SPEND_REFUSAL = '__preSpendRefusal';
export function markPreSpendRefusal<T>(e: T): T {
  try { (e as any)[PRE_SPEND_REFUSAL] = true; } catch { /* a frozen error is still throwable */ }
  return e;
}
export function isPreSpendRefusal(e: any): boolean {
  return !!(e && (e as any)[PRE_SPEND_REFUSAL] === true);
}

/**
 * What a stage job records for a failure. Lives here rather than inline in startStage's catch so
 * the choice itself is testable: a one-line ternary in the service would have been the only
 * untested part of this repair, and it is the part that decides whether the reader sees the
 * finding. `why` is passed in so the cap stays the service's own.
 */
export function errorTextForJob(e: any, why: (e: any) => string): string {
  return isPreSpendRefusal(e) ? String((e && e.message) || e) : why(e);
}
