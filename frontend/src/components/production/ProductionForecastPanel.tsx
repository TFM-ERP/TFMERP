'use client';
import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';

export default function ProductionForecastPanel({ projectId, currency = 'AED' }: { projectId: string; currency?: string }) {
  const money = (n: any) => formatCurrency(Number(n) || 0, currency);
  const [d, setD] = useState<any>(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState(false); const [warn, setWarn] = useState<any>(null);
  const load = useCallback(() => { setLoading(true); productionApi.costing.syncWarnings(projectId).then((r: any) => setWarn(r.data)).catch(() => { }); productionApi.costing.forecast(projectId).then(r => { setD(r.data); setErr(false); }).catch(() => setErr(true)).finally(() => setLoading(false)); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  if (loading) return <div className="card p-6 text-sm text-gray-400">Loading forecast…</div>;
  if (err || !d) return <div className="card p-6 text-sm text-gray-400">Forecast unavailable — restart the backend to enable.</div>;
  const sched = d.schedule || {}; const pct = sched.pctElapsed || 0; const over = (d.forecastVariance || 0) < 0;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><TrendingUp size={14} /> Forecast — Estimated Final Cost</h3>
          <p className="text-xs text-gray-400">Schedule/burn-driven projection · ETC tracks shoot-day progress · manual ETC overrides win.</p></div>
        <button onClick={load} className="btn btn-secondary p-1.5"><RefreshCw size={13} /></button>
      </div>
      {warn?.count > 0 && (
        <div className="space-y-1.5">
          {warn.warnings.map((w: any, i: number) => (
            <div key={i} className={cn('rounded-lg border px-3 py-2 text-xs flex items-start gap-2', w.severity === 'high' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /><span><b>{w.title}:</b> {w.message}</span>
            </div>
          ))}
        </div>
      )}
      <div className="card">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1"><span>Shoot progress</span><span>{sched.daysElapsed || 0} / {sched.totalDays || 0} days · {pct}%</span></div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden"><div className="h-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card"><p className="text-xs text-gray-400">Revised budget</p><p className="text-lg font-bold text-gray-900">{money(d.budget)}</p></div>
        <div className="card"><p className="text-xs text-gray-400">EFC (current)</p><p className="text-lg font-bold text-gray-700">{money(d.efc)}</p></div>
        <div className="card"><p className="text-xs text-gray-400">Forecast EFC</p><p className="text-lg font-bold text-amber-600">{money(d.forecastEfc)}</p></div>
        <div className={cn('card', over && 'ring-1 ring-red-200')}><p className="text-xs text-gray-400">Forecast variance</p><p className={cn('text-lg font-bold', over ? 'text-red-600' : 'text-green-600')}>{over ? '-' : ''}{money(Math.abs(d.forecastVariance || 0))}</p></div>
      </div>
      <div className="card">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5"><AlertTriangle size={12} className="text-amber-500" /> Lines projected to overspend ({(d.atRisk || []).length})</h4>
        {(d.atRisk || []).length === 0 ? <p className="text-xs text-gray-400">No lines projected over budget at the current burn rate.</p> : (
          <table className="w-full text-sm"><thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-start py-1">Cost center</th><th className="text-end">Revised</th><th className="text-end">Forecast EFC</th><th className="text-end">Over by</th></tr></thead>
            <tbody>{d.atRisk.map((a: any, i: number) => (<tr key={i} className="border-t border-gray-50"><td className="py-1.5 text-xs text-gray-700">{a.code} · {a.title} <span className="text-gray-400">· {a.section}</span></td><td className="py-1.5 text-end text-gray-500">{money(a.revisedBudget)}</td><td className="py-1.5 text-end text-amber-600">{money(a.forecastEfc)}</td><td className="py-1.5 text-end font-semibold text-red-600">{money(a.over)}</td></tr>))}</tbody></table>
        )}
      </div>
    </div>
  );
}
