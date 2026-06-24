'use client';
import { useState, useRef } from 'react';
import { productionApi } from '@/lib/api';
import { DollarSign, X } from 'lucide-react';

const TYPE: any = { CONSOLIDATE: '#0ea5e9', CUT: '#dc2626', MERGE: '#8b5cf6', CONVERT: '#d97706', RECAST: '#16a34a', VFX: '#6366f1' };
const NUMS: [string, string, string][] = [['targetBudget', 'Target budget', 'e.g. 1200000'], ['days', 'Shoot days', 'e.g. 18'], ['maxLocations', 'Max locations', 'e.g. 6'], ['maxCast', 'Max cast', 'e.g. 6']];

export default function BudgetFitPanel({ projectId, revision, onClose }: { projectId: string; revision?: any; onClose?: () => void }) {
  const [form, setForm] = useState<any>({ targetBudget: '', currency: 'USD', days: '', maxLocations: '', maxCast: '', notes: '' });
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const progRef = useRef<any>(null);
  const [applyingIdx, setApplyingIdx] = useState<number>(-1);
  const [appliedMap, setAppliedMap] = useState<any>({});
  const sgn = (n: number) => (n > 0 ? '+' + n : String(n));
  const startProg = () => { setProg(6); clearInterval(progRef.current); progRef.current = setInterval(() => setProg((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 12)) : p)), 240); };
  const endProg = (ok: boolean) => { clearInterval(progRef.current); if (ok) { setProg(100); setTimeout(() => setProg(0), 700); } else setProg(0); };
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const run = async () => {
    setBusy(true); startProg();
    try {
      const body: any = { revisionId: revision?.id, currency: form.currency, notes: form.notes };
      for (const k of ['targetBudget', 'days', 'maxLocations', 'maxCast']) if (form[k] !== '' && !isNaN(Number(form[k]))) body[k] = Number(form[k]);
      const r = await productionApi.scripton.budgetFit(projectId, body); setRes(r.data); endProg(true);
    } catch (e: any) { endProg(false); alert((e?.response?.data?.message || (e?.response?.status ? 'Budget-fit failed (HTTP ' + e.response.status + ') — check the backend terminal' : 'Budget-fit failed — backend not reachable on :3001. Is `npm run start` running, and is the API proxy/CORS ok?'))); }
    finally { setBusy(false); }
  };

  const apply = async (v: any, i: number) => {
    setApplyingIdx(i);
    try { const r = await productionApi.scripton.applyBudgetFit(projectId, { revisionId: revision?.id, variant: v }); setAppliedMap((m: any) => ({ ...m, [i]: r.data })); }
    catch (e: any) { alert((e?.response?.data?.message || (e?.response?.status ? 'Apply failed (HTTP ' + e.response.status + ') — check the backend terminal' : 'Apply failed — backend not reachable on :3001. Is `npm run start` running, and is the API proxy/CORS ok?'))); }
    finally { setApplyingIdx(-1); }
  };

  const f = res?.facts || {};

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><DollarSign size={15} className="text-indigo-600" /><span className="text-sm font-semibold text-slate-800">Budget-fit rewrite</span></div>
        {onClose && <button onClick={onClose} className="text-slate-300 hover:text-slate-600"><X size={16} /></button>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        {NUMS.map(([k, label, ph]) => (
          <label key={k} className="text-[11px]"><span className="text-slate-400 block mb-0.5">{label}</span><input type="number" value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} className="input text-xs h-8 w-full" /></label>
        ))}
      </div>
      <div className="flex items-end gap-2 mb-3">
        <label className="text-[11px] w-24"><span className="text-slate-400 block mb-0.5">Currency</span><input value={form.currency} onChange={(e) => set('currency', e.target.value)} className="input text-xs h-8 w-full" /></label>
        <label className="text-[11px] flex-1"><span className="text-slate-400 block mb-0.5">Notes / must-keeps</span><input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="e.g. keep the rooftop finale" className="input text-xs h-8 w-full" /></label>
        <button onClick={run} disabled={busy} className="text-[11px] px-3 py-1.5 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200 disabled:opacity-50 whitespace-nowrap">{res ? 'Re-plan' : 'Suggest plan'}</button>
      </div>
      {prog > 0 && (<div className="mb-3"><div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${prog}%`, background: '#6366f1', transition: 'width .25s' }} /></div><div className="text-[10px] text-slate-400 mt-1">{prog < 100 ? `Costing the options… ${prog}%` : 'Done'}</div></div>)}
      {!res && prog === 0 && (<div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl p-6 text-center">Set a target (budget, days, locations, cast) and get labelled rewrite strategies — what to consolidate, cut, convert or recast — grounded in the script's real scene load.</div>)}
      {res && (
        <div className="space-y-3">
          <div className="text-[11px] text-slate-400">Now: {f.sceneCount || 0} scenes · {f.locations || 0} locations · {f.night || 0} night · {f.pages || 0} pp</div>
          {(res.variants || []).map((v: any, i: number) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[13px] font-semibold text-slate-800">{v.label || `Option ${i + 1}`}</span>
                {v.savingPct != null && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#16a34a22', color: '#16a34a' }}>~{v.savingPct}% saved</span>}
              </div>
              {v.approach && <p className="text-[12px] text-slate-600 mb-1.5">{v.approach}</p>}
              <div className="text-[10px] text-slate-400 mb-1.5">Projected: {v.projectedScenes ?? '—'} scenes · {v.projectedLocations ?? '—'} locations · {v.projectedNights ?? '—'} night</div>
              {Array.isArray(v.changes) && v.changes.length > 0 && (
                <div className="space-y-1 mb-1.5">
                  {v.changes.map((c: any, j: number) => (
                    <div key={j} className="flex items-start gap-2 text-[12px]">
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 mt-0.5" style={{ background: (TYPE[c.type] || '#94a3b8') + '22', color: TYPE[c.type] || '#64748b' }}>{c.type || '—'}</span>
                      <span className="text-slate-600">{c.target ? <b>{c.target}: </b> : null}{c.detail}</span>
                    </div>
                  ))}
                </div>
              )}
              {v.tradeoffs && <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">Trade-off: {v.tradeoffs}</div>}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button onClick={() => apply(v, i)} disabled={applyingIdx === i} className="text-[11px] px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200 disabled:opacity-50">{applyingIdx === i ? 'Applying…' : (appliedMap[i] ? 'Re-apply' : 'Apply → new revision')}</button>
                {appliedMap[i] && <span className="text-[11px] text-emerald-700">Branched “{appliedMap[i].label}” · {appliedMap[i].applied} scenes</span>}
              </div>
              {appliedMap[i] && (<div className="mt-1 text-[11px] text-slate-500">Δ scenes {sgn(appliedMap[i].delta.scenes)} · locations {sgn(appliedMap[i].delta.locations)} · night {sgn(appliedMap[i].delta.night)} · pages {sgn(appliedMap[i].delta.pages)}. <span className="text-slate-400">Activate it in the version list and run Sync-from-script to re-cost.</span></div>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
