'use client';
import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { RefreshCw, FileText, Flame, Plus } from 'lucide-react';
export default function DprPanel({ projectId, currency = 'AED' }: { projectId: string; currency?: string }) {
  const money = (n: any) => formatCurrency(Number(n) || 0, currency);
  const [list, setList] = useState<any[]>([]); const [hot, setHot] = useState<any>(null); const [sheets, setSheets] = useState<any[]>([]); const [err, setErr] = useState(false); const [gen, setGen] = useState('');
  const load = useCallback(() => { productionApi.dpr.list(projectId).then(r => { setList(r.data || []); setErr(false); }).catch(() => setErr(true)); productionApi.dpr.hotCosts(projectId).then(r => setHot(r.data)).catch(() => { }); productionApi.callsheets.list(projectId).then(r => setSheets(r.data || [])).catch(() => { }); }, [projectId]);
  useEffect(() => { load(); }, [load]);
  const generate = async () => { if (!gen) return; try { await productionApi.dpr.generate(gen); setGen(''); load(); } catch (e: any) { alert(e?.response?.data?.message || 'Could not generate.'); } };
  const setShot = async (d: any, field: string, v: string) => { await productionApi.dpr.update(d.id, { [field]: v === '' ? null : Number(v) }); load(); };
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2"><h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5"><FileText size={12} /> Daily Production Reports</h4>
        <div className="flex gap-2 items-center"><select className="input text-sm h-9" value={gen} onChange={e => setGen(e.target.value)}><option value="">Generate from call sheet…</option>{sheets.map(c => <option key={c.id} value={c.id}>Day {c.dayNumber} · {new Date(c.shootDate).toLocaleDateString('en-GB')}</option>)}</select><button onClick={generate} disabled={!gen} className="btn btn-primary disabled:opacity-40"><Plus size={13} className="me-1" />Generate</button><button onClick={load} className="btn btn-secondary p-1.5"><RefreshCw size={13} /></button></div>
      </div>
      {err ? <p className="text-xs text-gray-400">Not active yet — run <code>npm run db:push</code> to enable.</p> : (<>
        {hot?.totals && <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 mb-3 flex items-center gap-4 text-sm flex-wrap"><span className="flex items-center gap-1.5 text-amber-700 font-semibold"><Flame size={14} /> Hot costs</span><span>{hot.totals.count} day(s)</span><span>cumulative <b>{money(hot.totals.estimated)}</b></span><span>OT {hot.totals.otHours || 0}h</span><span>meal penalties {hot.totals.mealPenalties || 0}</span></div>}
        {list.length === 0 ? <p className="text-xs text-gray-400">No DPRs yet. Generate one from a call sheet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-start py-1">Day</th><th className="text-start">Date</th><th className="text-end">Sc sched</th><th className="text-end">Sc shot</th><th className="text-end">Pg sched</th><th className="text-end">Pg shot</th><th className="text-start ps-2">Status</th></tr></thead>
            <tbody>{list.map(d => (<tr key={d.id} className="border-t border-gray-50">
              <td className="py-1.5 text-xs font-medium">Day {d.dayNumber}</td>
              <td className="py-1.5 text-xs text-gray-500">{d.reportDate ? new Date(d.reportDate).toLocaleDateString('en-GB') : ''}</td>
              <td className="py-1.5 text-end text-gray-500">{d.scenesScheduled ?? '—'}</td>
              <td className="py-1.5 text-end"><input className="input text-xs h-7 w-14 text-end" defaultValue={d.scenesShot ?? ''} onBlur={e => e.target.value !== String(d.scenesShot ?? '') && setShot(d, 'scenesShot', e.target.value)} /></td>
              <td className="py-1.5 text-end text-gray-500">{d.pagesScheduled ?? '—'}</td>
              <td className="py-1.5 text-end"><input className="input text-xs h-7 w-14 text-end" defaultValue={d.pagesShot ?? ''} onBlur={e => e.target.value !== String(d.pagesShot ?? '') && setShot(d, 'pagesShot', e.target.value)} /></td>
              <td className="py-1.5 ps-2"><span className={cn('badge text-[11px]', d.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>{d.status}</span></td>
            </tr>))}</tbody></table></div>
        )}
      </>)}
    </div>
  );
}
