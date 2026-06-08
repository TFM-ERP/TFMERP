'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, GitBranch, Lock, Send, CheckCircle, Undo2, History, Printer, Copy } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Chip, SectionLabel, Btn, inputCls } from './ui';

const vLabel = (v: any) => `${v.versionName}${v.status ? ` (${v.status.charAt(0)}${v.status.slice(1).toLowerCase()})` : ''}`;
const statusTone = (s: string) =>
  s === 'APPROVED' ? 'money' : s === 'LOCKED' ? 'risk' : s === 'REVIEW' ? 'link' : s === 'WORKING' ? 'need' : 'slate';

/**
 * Dual-column topsheet comparison: Locked Baseline vs Current Working, per section,
 * with variance — plus the budget lifecycle state machine (status transitions are
 * role-gated server-side: EP / Producer / Line Producer, or admin/finance).
 */
export default function TopsheetComparisonPanel({ projectId, currency = 'AED', onChanged }:
  { projectId: string; currency?: string; onChanged?: () => void }) {
  const money = (n: any) => formatCurrency(n || 0, currency);
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [baselineId, setBaselineId] = useState<string>('');
  const [workingId, setWorkingId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      productionApi.budget.topsheetComparison(projectId, baselineId || undefined, workingId || undefined),
      productionApi.budget.lifecycle(projectId),
    ]).then(([c, h]) => { setData(c.data); setHistory(h.data || []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [projectId, baselineId, workingId]);
  useEffect(() => { load(); }, [load]);

  const transition = async (versionId: string, toStatus: string, promptText: string) => {
    const notes = prompt(promptText + '\n\nNotes (reason for this change):', '');
    if (notes === null) return;
    setBusy(true);
    try {
      await productionApi.budget.transitionStatus(versionId, toStatus, notes || undefined);
      load(); onChanged?.();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Status change failed.');
    } finally { setBusy(false); }
  };

  const branchWorkingCopy = async (versionId: string) => {
    const name = prompt('Name for the working copy:', 'Working Copy');
    if (name === null) return;
    setBusy(true);
    try {
      const r = await productionApi.budget.cloneVersion(versionId, name || undefined);
      await productionApi.budget.activateVersion(r.data.id);
      load(); onChanged?.();
    } catch (e: any) { alert(e?.response?.data?.message || 'Could not create working copy.'); }
    finally { setBusy(false); }
  };

  if (loading && !data) return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-gray-400 text-sm">Loading topsheet…</div>;
  if (!data) return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-gray-400 text-sm">No budget versions yet.</div>;

  const grid: any[] = data.topsheetGrid || [];
  const gt = data.grandTotals || { baseline: 0, working: 0, variance: 0 };
  const versions: any[] = data.versions || [];
  const w = data.working, b = data.baseline;

  // Status-appropriate action buttons for the selected working version
  const actions: { label: string; icon: any; to?: string; branch?: boolean; cls: string; prompt: string }[] = [];
  if (w) {
    if (w.status === 'DRAFT' || w.status === 'WORKING') actions.push({ label: 'Submit for review', icon: Send, to: 'REVIEW', cls: 'btn-primary', prompt: 'Submit this budget for review? It will be numbered as the next version (V1, V2…).' });
    if (w.status === 'REVIEW') {
      actions.push({ label: 'Approve', icon: CheckCircle, to: 'APPROVED', cls: 'btn-primary', prompt: 'Approve this budget version?' });
      actions.push({ label: 'Send back to draft', icon: Undo2, to: 'DRAFT', cls: 'btn-secondary', prompt: 'Send this version back to draft for changes?' });
    }
    if (w.status === 'APPROVED') actions.push({ label: 'Lock as baseline', icon: Lock, to: 'LOCKED', cls: 'btn-primary', prompt: 'Lock this approved budget as the frozen baseline? It becomes read-only.' });
    if (w.status === 'LOCKED') actions.push({ label: 'Create working copy', icon: GitBranch, branch: true, cls: 'btn-primary', prompt: '' });
  }

  return (
    <div className="space-y-4">
      {/* Version pickers + actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label text-xs">Baseline version</label>
            <select className={cn(inputCls, 'min-w-[220px]')} value={baselineId || b?.id || ''} onChange={e => setBaselineId(e.target.value)}>
              {!b && <option value="">— No locked baseline yet —</option>}
              {versions.map(v => <option key={v.id} value={v.id}>{vLabel(v)}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Working copy</label>
            <select className={cn(inputCls, 'min-w-[220px]')} value={workingId || w?.id || ''} onChange={e => setWorkingId(e.target.value)}>
              {versions.map(v => <option key={v.id} value={v.id}>{vLabel(v)}</option>)}
            </select>
          </div>
          {w && <span className="mb-2"><Chip tone={w.status === 'APPROVED' ? 'money' : w.status === 'LOCKED' ? 'risk' : w.status === 'REVIEW' ? 'link' : w.status === 'WORKING' ? 'need' : 'slate'}>{w.status}</Chip></span>}
          <div className="flex-1" />
          <div className="flex gap-2 mb-0.5">
            {actions.map(a => (
              <button key={a.label} disabled={busy}
                onClick={() => a.branch ? branchWorkingCopy(w.id) : transition(w.id, a.to!, a.prompt)}
                className={cn('btn text-xs py-1.5 px-3 disabled:opacity-50', a.cls)}>
                <a.icon size={13} className="mr-1" /> {a.label}
              </button>
            ))}
            <Btn variant="secondary" onClick={() => w && window.open(`/print/topsheet/${w.id}`, '_blank')}><Printer size={12} /></Btn>
            <Btn variant="secondary" onClick={load}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></Btn>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">Lifecycle: Draft → Review (V1…Vn) → Approved → Locked → Working copy. Status changes need Executive Producer / Producer / Line Producer authority and are audit-logged below.</p>
      </div>

      {/* Dual-column grid */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
            <th className="px-4 py-2.5 text-left w-16">Code</th>
            <th className="px-3 py-2.5 text-left">Department / Section</th>
            <th className="px-3 py-2.5 text-right">Locked Baseline{b ? '' : ' (none)'}</th>
            <th className="px-3 py-2.5 text-right">Current Working</th>
            <th className="px-3 py-2.5 text-right">Variance</th>
          </tr></thead>
          <tbody>
            {grid.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-400 text-sm">No sections yet.</td></tr>
            ) : grid.map((r: any) => (
              <tr key={r.sectionCode} className={cn('border-b border-slate-100', r.variance < -0.01 && 'bg-red-50/40')}>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">{r.sectionCode}</td>
                <td className="px-3 py-2 text-gray-800">{r.sectionTitle}</td>
                <td className="px-3 py-2 text-right text-gray-600">{r.lockedBaseline ? money(r.lockedBaseline.total) : '—'}</td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">{r.currentWorking ? money(r.currentWorking.total) : '—'}</td>
                <td className={cn('px-3 py-2 text-right font-medium', r.variance < -0.01 ? 'text-red-600' : r.variance > 0.01 ? 'text-green-600' : 'text-gray-400')}>
                  {r.variance < 0 ? '-' : r.variance > 0 ? '+' : ''}{money(Math.abs(r.variance))}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-200">
              <td className="px-4 py-3" colSpan={2}>GRAND TOTALS</td>
              <td className="px-3 py-3 text-right">{money(gt.baseline)}</td>
              <td className="px-3 py-3 text-right">{money(gt.working)}</td>
              <td className={cn('px-3 py-3 text-right', gt.variance < -0.01 ? 'text-red-600' : gt.variance > 0.01 ? 'text-green-600' : 'text-gray-500')}>
                {gt.variance < 0 ? '-' : gt.variance > 0 ? '+' : ''}{money(Math.abs(gt.variance))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400">Variance = Baseline − Working. <span className="text-red-600">Red</span> = the working copy is over the locked baseline for that department.</p>

      {/* Change history */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <SectionLabel icon={History}>Change history &amp; status management</SectionLabel>
        {history.length === 0 ? <p className="text-xs text-gray-400">No lifecycle changes recorded yet.</p> : (
          <ul className="space-y-1">
            {history.map(h => (
              <li key={h.id} className="text-xs text-gray-600 flex flex-wrap items-center gap-1.5 border-b border-slate-100 py-1.5">
                <span className="text-gray-400 font-mono">{new Date(h.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                <Chip tone={statusTone(h.fromStatus)}>{h.fromStatus}</Chip>
                <span className="text-gray-300">→</span>
                <Chip tone={statusTone(h.toStatus)}>{h.toStatus}</Chip>
                <span className="font-medium text-gray-700">{h.versionNameSnap}</span>
                {h.changedByRole && <span className="text-gray-400">by {h.changedByRole.replace(/_/g, ' ').toLowerCase()}</span>}
                {h.notes && <span className="text-gray-400 italic">— {h.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
