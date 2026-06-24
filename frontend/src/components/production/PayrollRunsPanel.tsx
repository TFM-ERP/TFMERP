'use client';
import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { RefreshCw, Users, Play } from 'lucide-react';
export default function PayrollRunsPanel({ projectId, currency = 'AED' }: { projectId: string; currency?: string }) {
  const money = (n: any) => formatCurrency(Number(n) || 0, currency);
  const [runs, setRuns] = useState<any[]>([]); const [prev, setPrev] = useState<any>(null); const [err, setErr] = useState(false); const [label, setLabel] = useState('');
  const load = useCallback(() => { productionApi.payrollRuns.list(projectId).then(r => { setRuns(r.data || []); setErr(false); }).catch(() => setErr(true)); productionApi.payrollRuns.preview(projectId).then(r => setPrev(r.data)).catch(() => { }); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const post = async () => { if (!prev?.totals?.count) { alert('No eligible (APPROVED, unposted) timecards.'); return; } if (!confirm(`Post ${prev.totals.count} timecard(s) as a payroll run? This books ${money(prev.totals.total)} of burdened labor cost.`)) return; try { await productionApi.payrollRuns.post({ projectId, label: label || undefined }); setLabel(''); load(); } catch (e: any) { alert(e?.response?.data?.message || 'Could not post run.'); } };
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3"><h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><Users size={12} /> Payroll Runs (batch register)</h4><button onClick={load} className="btn btn-secondary p-1.5"><RefreshCw size={13} /></button></div>
      {err ? <p className="text-xs text-gray-400">Not active yet — run <code>npm run db:push</code> to enable.</p> : (<>
        <div className="rounded-xl border border-gray-100 p-3 mb-3 bg-gray-50/40">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-gray-600">Eligible to post: <b>{prev?.totals?.count || 0}</b> timecard(s) · gross {money(prev?.totals?.gross)} · fringe {money(prev?.totals?.fringe)} · <b>total {money(prev?.totals?.total)}</b></div>
            <div className="flex gap-2"><input className="input text-sm h-9" placeholder="Run label (optional)" value={label} onChange={e => setLabel(e.target.value)} /><button onClick={post} disabled={!prev?.totals?.count} className="btn btn-primary disabled:opacity-40"><Play size={13} className="me-1" />Post run</button></div>
          </div>
        </div>
        {runs.length === 0 ? <p className="text-xs text-gray-400">No payroll runs yet.</p> : (
          <table className="w-full text-sm"><thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-start py-1">Run</th><th className="text-end">Cards</th><th className="text-end">Gross</th><th className="text-end">Fringe</th><th className="text-end">Total</th><th className="text-start ps-3">Status</th></tr></thead>
            <tbody>{runs.map(r => (<tr key={r.id} className="border-t border-gray-50"><td className="py-1.5 text-xs text-gray-700">{r.label}</td><td className="py-1.5 text-end">{r.timecardCount}</td><td className="py-1.5 text-end text-gray-500">{money(r.grossTotal)}</td><td className="py-1.5 text-end text-gray-500">{money(r.fringeTotal)}</td><td className="py-1.5 text-end font-semibold">{money(r.total)}</td><td className="py-1.5 ps-3"><span className="badge bg-green-100 text-green-700 text-[11px]">{r.status}</span></td></tr>))}</tbody></table>
        )}
      </>)}
    </div>
  );
}
