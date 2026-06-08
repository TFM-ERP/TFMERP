'use client';

import { useEffect, useState, useCallback } from 'react';
import { Gift, Plus, Trash2, RefreshCw, Info, ExternalLink } from 'lucide-react';
import { laborApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import AdRebateTracker from './AdRebateTracker';

const BASIS_LABEL: Record<string, string> = {
  TOTAL: 'Total budget', WAGES: 'All wages', BTL: 'Below-the-line', LABOR: 'Tagged labor', QUALIFIED: 'Qualified spend',
};

export default function IncentivesPanel({ projectId, currency, onNavigate }: { projectId: string; currency: string; onNavigate?: (tab: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const money = (n: any) => formatCurrency(n, currency);
  const pct = (n: any) => `${(Number(n) * 100).toFixed(1)}%`;

  const load = useCallback(() => {
    setLoading(true);
    laborApi.projectIncentives(projectId).then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const addProgram = async (programId: string) => {
    setBusy(true);
    try { await laborApi.addProjectIncentive(projectId, { programId }); load(); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!confirm('Remove this incentive from the estimate?')) return;
    await laborApi.removeProjectIncentive(id); load();
  };
  const setOverride = async (id: string, v: string) => {
    await laborApi.updateProjectIncentive(id, { qualifiedSpendOverride: v === '' ? null : Number(v) });
    load();
  };
  const setBasis = async (id: string, basis: string) => {
    await laborApi.updateProjectIncentive(id, { basis });
    load();
  };

  if (loading) return <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div>;
  if (!data) return <div className="card p-10 text-center text-gray-400 text-sm">No data.</div>;

  const savedIds = new Set((data.saved || []).map((s: any) => s.programId).filter(Boolean));
  const available = (data.applicable || []).filter((p: any) => !savedIds.has(p.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2">
          <Gift size={18} className="text-brand-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Incentives & Tax Credits</h3>
            <p className="text-xs text-gray-400">Estimated incentives for this project's jurisdiction, netted against the burdened budget.</p>
          </div>
        </div>
        <button onClick={load} className="btn btn-secondary text-xs"><RefreshCw size={12} className={cn('mr-1', loading && 'animate-spin')} /> Refresh</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card"><p className="text-xs text-gray-400">Gross Budget</p><p className="text-lg font-bold text-gray-900">{money(data.grossBudget)}</p></div>
        <div className="card"><p className="text-xs text-gray-400">Est. Incentives</p><p className="text-lg font-bold text-green-600">−{money(data.totalIncentive)}</p></div>
        <div className="card"><p className="text-xs text-gray-400">Net Budget</p><p className="text-lg font-bold text-gray-900">{money(data.netBudget)}</p></div>
      </div>

      {/* Selected incentives */}
      <div className="card">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Applied to this project</h4>
        {!data.saved?.length ? (
          <p className="text-xs text-gray-400">None selected yet. Add an applicable program below.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase border-b border-gray-100">
                <th className="py-2 text-left">Program</th>
                <th className="py-2 text-left">Basis</th>
                <th className="py-2 text-right">Qualified Spend</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Est. Incentive</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.saved.map((s: any) => (
                <tr key={s.id} className="border-b border-gray-50">
                  <td className="py-1.5">
                    <span className="text-gray-800">{s.name}</span>
                    {s.sourceUrl && <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="ml-1.5 text-brand-600 inline-flex"><ExternalLink size={10} /></a>}
                    <span className="block text-[10px] text-gray-400">{s.incentiveType?.replace('_', ' ')}{s.capped ? ' · capped' : ''}{s.belowThreshold ? ' · below min spend' : ''}</span>
                  </td>
                  <td className="py-1.5">
                    <select className="input text-xs py-0.5 h-7" value={s.basis} onChange={(e) => setBasis(s.id, e.target.value)}>
                      {Object.keys(BASIS_LABEL).map((b) => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}
                    </select>
                  </td>
                  <td className="py-1.5 text-right">
                    <input className="input text-xs py-0.5 h-7 w-28 text-right" defaultValue={s.qualifiedSpend}
                      onBlur={(e) => { if (Number(e.target.value) !== s.qualifiedSpend) setOverride(s.id, e.target.value); }} />
                  </td>
                  <td className="py-1.5 text-right text-gray-600">{pct(s.effectiveRate)}</td>
                  <td className="py-1.5 text-right font-semibold text-green-700">{money(s.estimate)}</td>
                  <td className="py-1.5 text-right"><button onClick={() => remove(s.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Available programs */}
      <div className="card">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Applicable programs (by jurisdiction)</h4>
        {!available.length ? (
          <p className="text-xs text-gray-400 flex items-center gap-1"><Info size={12} /> No applicable programs found. Set the project's location on the Labor & Union tab, or add programs in Setup → Labor & Fringe Master → Incentives.</p>
        ) : (
          <div className="space-y-1.5">
            {available.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-gray-50 py-1.5">
                <div>
                  <span className="text-gray-800">{p.name}</span>
                  {p.geoNode?.name && <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 rounded px-1">{p.geoNode.name}</span>}
                  {p.isEstimate && <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 rounded px-1">estimate</span>}
                  <span className="block text-[10px] text-gray-400">{pct(p.effectiveRate)} of {BASIS_LABEL[p.basis] || p.basis} · est. {money(p.estimate)}{p.belowThreshold ? ' (below min spend)' : ''}</span>
                </div>
                <button onClick={() => addProgram(p.id)} disabled={busy} className="btn btn-secondary text-xs"><Plus size={12} className="mr-1" /> Add</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rebate claim tracker — per filming country. The Abu Dhabi points/stages
          tracker renders for UAE projects; other jurisdictions show their official
          claim guidance from the applied programs above. */}
      {(!data.filmingCountry || data.filmingCountry.code === 'AE' || data.filmingCountry.name === 'United Arab Emirates') ? (
        <AdRebateTracker projectId={projectId} onNavigate={onNavigate} />
      ) : (
        <div className="card">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rebate claim — {data.filmingCountry.name}</h4>
          <p className="text-xs text-gray-400">
            This project films in <b>{data.filmingCountry.name}</b>. Application steps, deadlines, caps and audit
            requirements for its rebate are in the program notes above (open the program link for the official source).
            A dedicated step-by-step claim tracker for {data.filmingCountry.name} can be added like the Abu Dhabi one.
          </p>
        </div>
      )}

      <p className="text-[11px] text-gray-400 flex items-start gap-1">
        <Info size={12} className="mt-0.5" />
        Estimates only — not tax advice. Qualified-spend rules, caps, uplifts and minimums vary by program; confirm eligibility with the issuing authority and your tax advisor. Adjust the qualified-spend figure per program to match the official definition.
      </p>
    </div>
  );
}
