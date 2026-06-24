'use client';

import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { Plus, Trash2, Clock, AlertTriangle, CheckSquare, Square, Save } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

/** TVC P3 — commercial controls: agency/brand, usage & buyout (holding-fee clock + alerts), PPM gate. */
export default function CommercialPanel({ projectId, project, currency = 'AED' }: { projectId: string; project?: any; currency?: string }) {
  const money = (n: any) => formatCurrency(Number(n) || 0, currency);
  const fd = (d: any) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
  const [parties, setParties] = useState({ agencyName: project?.agencyName || '', brandName: project?.brandName || '' });
  const [usage, setUsage] = useState<any[]>([]); const [alerts, setAlerts] = useState<any>(null); const [ppm, setPpm] = useState<any>(null);
  const [busy, setBusy] = useState(false); const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<any>({ kind: 'TALENT', title: '', territory: '', media: 'All', windowStart: '', windowEnd: '', fee: '', holdingFeeEveryWeeks: '13' });

  const load = useCallback(() => {
    productionApi.commercial.usage(projectId).then((r: any) => setUsage(Array.isArray(r.data) ? r.data : [])).catch(() => setUsage([]));
    productionApi.commercial.alerts(projectId).then((r: any) => setAlerts(r.data)).catch(() => setAlerts(null));
    productionApi.commercial.ppm(projectId).then((r: any) => setPpm(r.data)).catch(() => setPpm(null));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const saveParties = async () => { setBusy(true); try { await productionApi.commercial.setParties(projectId, parties); } catch { alert('Needs db:push + restart.'); } finally { setBusy(false); } };
  const addUsage = async () => { setBusy(true); try { await productionApi.commercial.createUsage(projectId, form); setAdding(false); setForm({ kind: 'TALENT', title: '', territory: '', media: 'All', windowStart: '', windowEnd: '', fee: '', holdingFeeEveryWeeks: '13' }); load(); } catch { alert('Needs db:push + restart.'); } finally { setBusy(false); } };
  const advance = async (id: string) => { await productionApi.commercial.advanceHolding(id); load(); };
  const release = async (id: string) => { await productionApi.commercial.setUsageStatus(id, 'RELEASED'); load(); };
  const delU = async (id: string) => { if (!confirm('Delete this usage right?')) return; await productionApi.commercial.removeUsage(id); load(); };
  const toggleItem = async (key: string) => { if (!ppm?.items) return; const items = ppm.items.map((it: any) => it.key === key ? { ...it, done: !it.done } : it); setPpm({ ...ppm, items }); await productionApi.commercial.updatePpm(projectId, { items }).catch(() => { }); };
  const approve = async (who: string, val: boolean) => { const body: any = who === 'agency' ? { agencyApproved: val } : { clientApproved: val }; try { const r = await productionApi.commercial.updatePpm(projectId, body); setPpm(r.data); } catch { /* */ } };

  return (
    <div className="space-y-4">
      <div className="card">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Agency &amp; brand</h4>
        <div className="flex items-end gap-2 flex-wrap">
          <label className="text-xs">Agency<input className="input text-sm h-9 w-52" value={parties.agencyName} onChange={e => setParties(p => ({ ...p, agencyName: e.target.value }))} /></label>
          <label className="text-xs">Brand / advertiser<input className="input text-sm h-9 w-52" value={parties.brandName} onChange={e => setParties(p => ({ ...p, brandName: e.target.value }))} /></label>
          <button onClick={saveParties} disabled={busy} className="btn btn-secondary text-xs py-1.5"><Save size={13} className="me-1" />Save</button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2"><h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Usage &amp; buyout</h4><button onClick={() => setAdding(a => !a)} className="btn btn-primary text-xs py-1.5"><Plus size={13} className="me-1" />Add</button></div>
        {alerts?.count > 0 && (
          <div className="space-y-1 mb-2">{alerts.items.slice(0, 6).map((a: any, i: number) => (<div key={i} className={cn('text-[11px] rounded px-2 py-1 flex items-center gap-1.5 border', a.severity === 'high' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200')}><AlertTriangle size={11} /> {a.message} · {fd(a.date)}</div>))}</div>
        )}
        {adding && (
          <div className="card bg-blue-50/40 border-blue-100 mb-2 grid grid-cols-2 md:grid-cols-3 gap-2">
            <label className="text-xs">Kind<select className="input text-sm h-8 w-full" value={form.kind} onChange={e => setForm((f: any) => ({ ...f, kind: e.target.value }))}>{['TALENT', 'MUSIC', 'STOCK', 'OTHER'].map(k => <option key={k} value={k}>{k}</option>)}</select></label>
            <label className="text-xs md:col-span-2">Title (talent / track / asset)<input className="input text-sm h-8 w-full" value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} /></label>
            <label className="text-xs">Territory<input className="input text-sm h-8 w-full" value={form.territory} onChange={e => setForm((f: any) => ({ ...f, territory: e.target.value }))} /></label>
            <label className="text-xs">Media<input className="input text-sm h-8 w-full" value={form.media} onChange={e => setForm((f: any) => ({ ...f, media: e.target.value }))} /></label>
            <label className="text-xs">Fee<input type="number" className="input text-sm h-8 w-full" value={form.fee} onChange={e => setForm((f: any) => ({ ...f, fee: e.target.value }))} /></label>
            <label className="text-xs">Window start<input type="date" className="input text-sm h-8 w-full" value={form.windowStart} onChange={e => setForm((f: any) => ({ ...f, windowStart: e.target.value }))} /></label>
            <label className="text-xs">Window end<input type="date" className="input text-sm h-8 w-full" value={form.windowEnd} onChange={e => setForm((f: any) => ({ ...f, windowEnd: e.target.value }))} /></label>
            <label className="text-xs">Holding every (weeks)<input type="number" className="input text-sm h-8 w-full" value={form.holdingFeeEveryWeeks} onChange={e => setForm((f: any) => ({ ...f, holdingFeeEveryWeeks: e.target.value }))} /></label>
            <div className="md:col-span-3 flex gap-2"><button onClick={addUsage} disabled={busy} className="btn btn-primary text-xs py-1.5">Add</button><button onClick={() => setAdding(false)} className="btn btn-secondary text-xs py-1.5">Cancel</button></div>
          </div>
        )}
        {usage.length === 0 ? <p className="text-xs text-gray-400">No usage rights yet. Track talent buyouts (SAG-AFTRA holding-fee clock), music &amp; stock licences here.</p> : (
          <div className="space-y-1">{usage.map(u => (
            <div key={u.id} className={cn('border rounded-lg px-2.5 py-1.5 text-xs', u.status === 'RELEASED' ? 'opacity-50 border-gray-100' : 'border-gray-100')}>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-gray-100 text-gray-600">{u.kind}</span>
                <span className="font-medium text-gray-800 flex-1 truncate">{u.title}</span>
                {u.fee != null && <span className="text-gray-500">{money(u.fee)}</span>}
                <button onClick={() => delU(u.id)} className="text-gray-300 hover:text-rose-500"><Trash2 size={12} /></button>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 flex-wrap">
                {u.territory && <span>{u.territory}</span>}{u.media && <span>· {u.media}</span>}
                {(u.windowStart || u.windowEnd) && <span>· {fd(u.windowStart)}–{fd(u.windowEnd)}</span>}
                {u.exclusivity && <span>· exclusive</span>}
                {u.holdingFeeEveryWeeks && <span className="inline-flex items-center gap-1 text-indigo-600"><Clock size={10} /> holding /{u.holdingFeeEveryWeeks}w · next {fd(u.nextHoldingFeeAt)} <button onClick={() => advance(u.id)} className="underline">advance</button></span>}
                {u.status !== 'RELEASED' && <button onClick={() => release(u.id)} className="underline ms-auto text-gray-400">release</button>}
              </div>
            </div>
          ))}</div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-2"><h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">PPM — pre-production meeting</h4>{ppm && <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded', ppm.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>{ppm.status || 'DRAFT'}</span>}</div>
        {!ppm ? <p className="text-xs text-gray-400">Unavailable — run db:push + restart.</p> : (
          <>
            <div className="space-y-1">{(ppm.items || []).map((it: any) => (<button key={it.key} onClick={() => toggleItem(it.key)} className="flex items-center gap-2 text-xs w-full text-start">{it.done ? <CheckSquare size={14} className="text-emerald-600" /> : <Square size={14} className="text-gray-300" />}<span className={it.done ? 'text-gray-700' : 'text-gray-500'}>{it.label}</span></button>))}</div>
            <div className="flex items-center gap-4 mt-3 pt-2 border-t border-gray-100">
              <label className="text-xs flex items-center gap-1.5"><input type="checkbox" checked={!!ppm.agencyApproved} onChange={e => approve('agency', e.target.checked)} /> Agency approved</label>
              <label className="text-xs flex items-center gap-1.5"><input type="checkbox" checked={!!ppm.clientApproved} onChange={e => approve('client', e.target.checked)} /> Client approved</label>
              <span className="text-[10px] text-gray-400 ms-auto">Both sign-offs lock the PPM (the pre-shoot gate).</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
