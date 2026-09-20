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

export type CheckState = 'FINDINGS' | 'CLEAN' | 'NOT_RUN';

export interface CheckRead {
  check: string;
  state: CheckState;
  /** Register-check line numbers, when it has them. */
  lines: number[];
  detail: string;
}

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
  const out = (state: CheckState, detail: string, lines: number[] = []): CheckRead => ({ check: name, state, lines, detail });
  if (value == null) return out('NOT_RUN', 'no ' + name + ' is stored on this version');

  if (name === 'registerCheck') {
    const items = arr(value.items);
    if (items.length) {
      const lines = items.map((i: any) => Number(i && i.line)).filter((n: number) => isFinite(n) && n > 0);
      return out('FINDINGS', String(value.summary || (items.length + ' contradiction(s)')), lines);
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
  if (state === 'FINDINGS' || state === 'MISSES') {
    const n = arr(value.findings).length || arr(value.items).length || Number(value.misses) || 0;
    return out('FINDINGS', String(value.summary || (n + ' ' + (state === 'MISSES' ? 'miss(es)' : 'finding(s)'))));
  }
  if (state === 'NO FINDINGS' || state === 'NO MISSES') return out('CLEAN', String(value.summary || 'nothing found'));
  // A stored object with no state we recognise has told us nothing.
  return out('NOT_RUN', 'the stored ' + name + ' has no recognisable verdict');
}

export const GATE_CHECKS = ['registerCheck', 'eraCheck', 'keepCheck'];

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
    reads.push({ kind, versionId, checks: checks.map((c) => readCheck(c, data ? data[c] : null)) });
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
 * THREE DIFFERENT RENDERINGS. If CLEAN and NOT_RUN read the same to a person, this module has
 * reproduced the defect it exists to end — so they use different verbs and NOT_RUN says outright
 * that it is not a pass.
 */
export function gateText(report: GateReport): string {
  if (!report.reads.length) return 'PRE-SPEND CHECK: nothing recorded as consumed, so there is nothing to read.';
  const out: string[] = [];
  out.push(report.stop
    ? 'PRE-SPEND CHECK — STOPPED. The versions this stage is about to be written from carry stored findings:'
    : 'PRE-SPEND CHECK — no stored findings on the versions about to be consumed:');
  for (const r of report.reads) {
    for (const c of r.checks) {
      if (c.state === 'FINDINGS') {
        out.push('  ' + r.kind + ' — ' + c.check + ': FINDINGS. ' + c.detail
          + (c.lines.length ? '  Line(s): ' + c.lines.join(', ') + '.' : ''));
      } else if (c.state === 'CLEAN') {
        out.push('  ' + r.kind + ' — ' + c.check + ': checked, clean. ' + brief(c.detail));
      } else {
        out.push('  ' + r.kind + ' — ' + c.check + ': NOT RUN — ' + brief(c.detail) + '. This is NOT a pass; nothing has been checked here.');
      }
    }
  }
  if (report.stop) {
    out.push('Amend the upstream stage, or re-run with the findings waived to proceed anyway.');
  } else if (report.notRun) {
    out.push('Nothing blocks this run, but ' + report.notRun + ' check(s) never ran — their silence is not evidence.');
  }
  return out.join('\n');
}
