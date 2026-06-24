'use client';

/**
 * SYS-LOC V2 · Milestone 6 — Reports.
 * Location Report / Scene Lookbook / Storyboard (route to the existing report tooling) +
 * live producer-readiness (computed from the pipeline) + per-location budget. Closes the
 * six-surface set. Deeper budget-vs-actual rolls in with the foundation wiring (payments
 * aggregation + cost-report line).
 */
import { useEffect, useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { productionApi } from '@/lib/api';

const stageOf = (l: any) => { const s = l.pipelineStage || l.status; return (s === 'CONFIRMED' || l.status === 'CONFIRMED') ? 'confirmed' : (s === 'WRAPPED' || l.status === 'RELEASED') ? 'wrapped' : ['NOC_REQUESTED', 'AGREEMENT_SENT', 'PERMIT_APPLIED', 'INSURANCE_RECEIVED'].includes(s) ? 'clearing' : 'sourcing'; };
const readinessOf = (l: any) => { const p = String(l.permitStatus || '').toUpperCase(); if (p === 'REJECTED') return 'blocked'; const st = stageOf(l); if (st === 'confirmed' || st === 'wrapped') return 'ready'; return 'outstanding'; };

const STY = `
.lr-3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
.lr-rep{background:var(--surface-1);border:1px solid var(--border-1);border-radius:12px;padding:14px;cursor:pointer;display:flex;align-items:center;gap:11px;transition:all .15s}
.lr-rep:hover{border-color:var(--accent);transform:translateY(-1px)}
.lr-rep .ic{width:34px;height:34px;border-radius:9px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:17px}
.lr-rep b{display:block;font-size:13px}.lr-rep small{font-size:11px;color:var(--text-3)}
.lr-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.lr-card{background:var(--surface-1);border:1px solid var(--border-1);border-radius:12px;overflow:hidden}
.lr-card .hd{display:flex;align-items:center;gap:9px;padding:11px 14px;border-bottom:1px solid var(--border-1)}.lr-card .hd h3{font-size:13px;font-weight:700;flex:1}.lr-card .hd .more{color:var(--accent);font-size:11px;font-weight:600;cursor:pointer}
.lr-row{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border-1)}.lr-row:last-child{border-bottom:none}.lr-row .ic{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:13px;flex-shrink:0}.lr-row .m{flex:1;min-width:0}.lr-row .m b{display:block;font-size:12.5px;color:var(--text-1)}.lr-row .m small{font-size:10.5px;color:var(--text-3)}
.lr-bdg{display:inline-flex;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px}
.b-ok{background:var(--ok-soft);color:var(--ok)}.b-warn{background:var(--warn-soft);color:var(--warn)}.b-dn{background:var(--danger-soft);color:var(--danger)}.b-n{background:var(--surface-2);color:var(--text-3);border:1px solid var(--border-1)}
.lr-pad{padding:13px 14px}
.lr-bar{display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px}.lr-bars{height:7px;border-radius:999px;background:var(--surface-2);overflow:hidden;margin-bottom:10px}.lr-bars>i{display:block;height:100%}
.lr-empty{font-size:12px;color:var(--text-3);padding:14px;text-align:center}
@media(max-width:900px){.lr-3,.lr-grid{grid-template-columns:1fr}}
`;

import LocationReportPanel from './LocationReportPanel';

export default function LocationsReports({ projectId, locations = [], currency = 'AED', onNavigateInner }:
  { projectId: string; locations?: any[]; currency?: string; onNavigateInner?: (t: string) => void }) {
  const money = (n: number) => formatCurrency(n || 0, currency);
  const [view, setView] = useState<'overview' | 'report'>('overview');
  const [actuals, setActuals] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    const ids = locations.map((l: any) => l.id).filter(Boolean);
    Promise.allSettled(ids.map((id: string) => productionApi.locations.payments(id).then((r: any) => {
      const paid = (Array.isArray(r.data) ? r.data : []).filter((x: any) => String(x.status).toUpperCase() === 'PAID').reduce((a: number, x: any) => a + (Number(x.amount) || 0), 0);
      return [id, paid] as [string, number];
    }))).then((res: any) => { if (!alive) return; const m: Record<string, number> = {}; res.forEach((x: any) => { if (x.status === 'fulfilled') m[x.value[0]] = x.value[1]; }); setActuals(m); });
    return () => { alive = false; };
  }, [locations]);
  const totalActual = useMemo(() => Object.values(actuals).reduce((a, b) => a + b, 0), [actuals]);
  const ready = useMemo(() => { const g: any = { ready: [], outstanding: [], blocked: [] }; locations.forEach((l: any) => g[readinessOf(l)].push(l)); return g; }, [locations]);
  const feeTotal = useMemo(() => locations.reduce((a, l) => a + (Number(l.locationFeePerDay) || 0), 0), [locations]);
  const topFees = useMemo(() => [...locations].filter((l: any) => Number(l.locationFeePerDay) > 0).sort((a, b) => Number(b.locationFeePerDay) - Number(a.locationFeePerDay)).slice(0, 6), [locations]);
  const maxFee = topFees[0] ? Number(topFees[0].locationFeePerDay) : 1;

  return (
    <div>
      <style>{STY}</style>
      <div className="lw-ph"><div><div className="k">Locations · Insights</div><h2>Reports</h2><div className="s">Location report · lookbook · storyboard · readiness · budget</div></div></div>

      <div className="lw-sub">
        <div className={`lw-st ${view === 'overview' ? 'on' : ''}`} onClick={() => setView('overview')}>📊 Overview</div>
        <div className={`lw-st ${view === 'report' ? 'on' : ''}`} onClick={() => setView('report')}>📑 Report &amp; plates</div>
      </div>

      {view === 'report' && <LocationReportPanel projectId={projectId} />}
      {view === 'overview' && (<>
      <div className="lr-3">
        <div className="lr-rep" onClick={() => setView('report')}><div className="ic">📑</div><div><b>Location Report</b><small>Per-location, plate-tagged, branded PDF</small></div></div>
        <div className="lr-rep" onClick={() => setView('report')}><div className="ic">🖼</div><div><b>Scene Lookbook</b><small>Photos grouped by scene</small></div></div>
        <div className="lr-rep" onClick={() => setView('report')}><div className="ic">🎞</div><div><b>Storyboard / shots</b><small>Plate → shot reference</small></div></div>
      </div>

      <div className="lr-grid">
        <div className="lr-card"><div className="hd"><h3>✅ Producer readiness</h3><span className="more" onClick={() => onNavigateInner?.('readiness')}>Board →</span></div>
          {locations.length === 0 ? <div className="lr-empty">No locations yet.</div> : (<>
            {ready.blocked.slice(0, 3).map((l: any) => <div key={l.id} className="lr-row"><div className="ic" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>✗</div><div className="m"><b>{l.name}</b><small>permit/clearance blocked</small></div><span className="lr-bdg b-dn">Blocked</span></div>)}
            {ready.outstanding.slice(0, 3).map((l: any) => <div key={l.id} className="lr-row"><div className="ic" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}>!</div><div className="m"><b>{l.name}</b><small>{stageOf(l)} — clearance outstanding</small></div><span className="lr-bdg b-warn">Outstanding</span></div>)}
            {ready.ready.slice(0, 3).map((l: any) => <div key={l.id} className="lr-row"><div className="ic" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>✓</div><div className="m"><b>{l.name}</b><small>confirmed &amp; cleared</small></div><span className="lr-bdg b-ok">Ready</span></div>)}
            <div className="lr-row" style={{ background: 'var(--surface-2)' }}><div className="m"><b>{ready.ready.length} ready · {ready.outstanding.length} outstanding · {ready.blocked.length} blocked</b></div></div>
          </>)}
        </div>
        <div className="lr-card"><div className="hd"><h3>💷 Location budget</h3><span className="more">Cost report →</span></div>
          <div className="lr-pad">
            {topFees.length === 0 && totalActual === 0 ? <div className="lr-empty">No location fees or payments recorded.</div> : topFees.map((l: any) => (
              <div key={l.id}><div className="lr-bar"><span>{l.name}</span><b>{money(Number(l.locationFeePerDay))}/day · paid {money(actuals[l.id] || 0)}</b></div><div className="lr-bars"><i style={{ width: `${Math.round((Number(l.locationFeePerDay) / maxFee) * 100)}%`, background: 'var(--accent)' }} /></div></div>
            ))}
            <div className="lr-bar" style={{ marginTop: 6 }}><span>Total fees/day</span><b>{money(feeTotal)}</b></div>
            <div className="lr-bar"><span>Total paid (actual)</span><b style={{ color: 'var(--ok)' }}>{money(totalActual)}</b></div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>Actuals aggregate paid location payments. Permit + security commitments and the cost-report Locations line are now live in the project Cost Report.</p>
          </div>
        </div>
      </div>
      </>)}
    </div>
  );
}
