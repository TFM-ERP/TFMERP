'use client';

import { useEffect, useState, useCallback, Fragment } from 'react';
import { Layers, RefreshCw, Play, Info, Printer, BookOpen } from 'lucide-react';
import { laborApi, accountingApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

const RATE_TYPE_LABEL: Record<string, string> = {
  PENSION: 'Pension', HEALTH: 'Health', PENSION_HEALTH: 'Pension & Health',
  PAYROLL_TAX: 'Payroll Tax', WORKERS_COMP: "Workers' Comp", UNEMPLOYMENT: 'Unemployment',
  VACATION_PAY: 'Vacation', HOLIDAY_PAY: 'Holiday', EMPLOYER_TAX: 'Employer Tax',
  UNION_DUES: 'Union Dues', GUILD_CONTRIB: 'Guild', STATUTORY_GRATUITY: 'Gratuity',
  HANDLING_FEE: 'Handling', OTHER: 'Other',
};

export default function FringeDetailPanel({ versionId, currency }: { versionId?: string; currency: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const money = (n: any) => formatCurrency(n, currency);

  const load = useCallback(() => {
    if (!versionId) return;
    setLoading(true);
    laborApi.fringeDetail(versionId).then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [versionId]);

  useEffect(() => { load(); }, [load]);

  const apply = async () => {
    if (!versionId) return;
    setBusy(true);
    try { const r = await laborApi.applyFringes(versionId); alert(`Recomputed fringes on ${r.data.linesTouched} classified line(s).`); load(); }
    finally { setBusy(false); }
  };

  const postBurden = async () => {
    if (!versionId) return;
    if (!confirm('Post employer-burden accrual journals to the General Ledger? This replaces any prior burden entry for this budget version (Dr burden expense / Cr employer liability).')) return;
    setBusy(true);
    try { const r = await accountingApi.postBurden(versionId); alert(`Posted labor burden accrual: ${r.data.totalBurden?.toLocaleString?.() ?? r.data.totalBurden}.`); }
    catch (e: any) { alert(e.response?.data?.message || 'Could not post burden — apply fringes first.'); }
    finally { setBusy(false); }
  };

  if (!versionId) return <div className="card p-10 text-center text-gray-400 text-sm">No active budget version.</div>;

  const types = data ? Object.keys(data.typeTotals || {}) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2">
          <Layers size={18} className="text-brand-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Fringe & Burden Detail</h3>
            <p className="text-xs text-gray-400">Employer burden per cost center, by type — driven by the project's frozen labor snapshot.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={apply} disabled={busy} className="btn btn-primary text-xs"><Play size={12} className="mr-1" /> {busy ? 'Applying…' : 'Apply fringes'}</button>
          <button onClick={postBurden} disabled={busy} className="btn btn-secondary text-xs"><BookOpen size={12} className="mr-1" /> Post burden to GL</button>
          <button onClick={() => versionId && window.open(`/print/fringe/${versionId}`, '_blank')} className="btn btn-secondary text-xs"><Printer size={12} className="mr-1" /> Print / PDF</button>
          <button onClick={load} className="btn btn-secondary text-xs"><RefreshCw size={12} className={cn('mr-1', loading && 'animate-spin')} /> Refresh</button>
        </div>
      </div>

      {!data ? (
        <div className="card p-10 text-center text-gray-400 text-sm">{loading ? 'Loading…' : 'No fringe data. Freeze a labor snapshot, tag budget lines with classification codes, then Apply fringes.'}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card"><p className="text-xs text-gray-400">Wages (straight time)</p><p className="text-lg font-bold text-gray-900">{money(data.grandWages)}</p></div>
            <div className="card"><p className="text-xs text-gray-400">Total Burden</p><p className="text-lg font-bold text-gray-900">{money(data.grandFringe)}</p></div>
            <div className="card"><p className="text-xs text-gray-400">Effective Burden %</p><p className="text-lg font-bold text-gray-900">{data.grandBurdenPct}%</p></div>
            <div className="card"><p className="text-xs text-gray-400">Burdened Labor</p><p className="text-lg font-bold text-gray-900">{money(data.grandWages + data.grandFringe)}</p></div>
          </div>

          {/* Burden by type */}
          {types.length > 0 && (
            <div className="card">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Burden by type</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {types.map((t) => (
                  <div key={t} className="flex justify-between text-sm border-b border-gray-50 py-1">
                    <span className="text-gray-600">{RATE_TYPE_LABEL[t] || t}</span>
                    <span className="font-medium text-gray-800">{money(data.typeTotals[t])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per cost center */}
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left">Cost Center</th>
                  <th className="px-3 py-2.5 text-right">Wages</th>
                  <th className="px-3 py-2.5 text-right">Burden</th>
                  <th className="px-3 py-2.5 text-right">Burden %</th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map((s: any) => (
                  <Fragment key={s.code}>
                    <tr className="bg-gray-50">
                      <td className="px-4 py-2 font-semibold text-gray-800">{s.code} — {s.title}</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">{money(s.fringeTotal)}</td>
                      <td className="px-3 py-2"></td>
                    </tr>
                    {s.accounts.map((a: any) => (
                      <tr key={a.code} className="border-b border-gray-50">
                        <td className="px-4 py-2 pl-8 text-gray-600 text-xs">
                          {a.code} · {a.title}
                          {a.anyEstimate && <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 rounded px-1">est</span>}
                          {Object.keys(a.burden || {}).length > 0 && (
                            <span className="ml-2 text-[10px] text-gray-400">
                              {Object.entries(a.burden).map(([k, v]: any) => `${RATE_TYPE_LABEL[k] || k} ${money(v)}`).join(' · ')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{money(a.wages)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{a.fringeTotal ? money(a.fringeTotal) : '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-500">{a.burdenPct ? `${a.burdenPct}%` : '—'}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td className="px-4 py-3 font-bold text-gray-900">TOTAL</td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900">{money(data.grandWages)}</td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900">{money(data.grandFringe)}</td>
                  <td className="px-3 py-3 text-right font-bold text-gray-900">{data.grandBurdenPct}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-gray-400 flex items-start gap-1">
            <Info size={12} className="mt-0.5" />
            Decision-support only — not legal or payroll advice. Estimates (flagged) approximate caps/wage-bases at line level; confirm with your payroll provider.
          </p>
        </>
      )}
    </div>
  );
}
