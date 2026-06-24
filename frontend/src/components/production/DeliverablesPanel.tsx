'use client';

import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { Film, Plus, Trash2, Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const STAGES = ['PLANNED', 'OFFLINE', 'ONLINE', 'GRADE', 'MIX', 'DELIVERED'];
const STAGE_CLS: Record<string, string> = {
  PLANNED: 'bg-gray-100 text-gray-500', OFFLINE: 'bg-sky-100 text-sky-700', ONLINE: 'bg-indigo-100 text-indigo-700',
  GRADE: 'bg-violet-100 text-violet-700', MIX: 'bg-amber-100 text-amber-700', DELIVERED: 'bg-emerald-100 text-emerald-700',
};

/** TVC P2 — Deliverables & Versions: cutdown × aspect-ratio matrix with a post pipeline. */
export default function DeliverablesPanel({ projectId }: { projectId: string; currency?: string }) {
  const [list, setList] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false); const [form, setForm] = useState<any>({ durationSec: '30', aspectRatio: '16:9', name: '' });
  const load = useCallback(() => { setLoading(true); productionApi.deliverables.list(projectId).then((r: any) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => setList([])).finally(() => setLoading(false)); }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const gen = async () => { setBusy(true); try { const r = await productionApi.deliverables.generate(projectId); alert(`Generated ${r.data?.created ?? 0} deliverable(s) from the brief (${r.data?.durations}×${r.data?.ratios}).`); load(); } catch (e: any) { alert(e.response?.data?.message || 'Generate needs a brief + db:push + restart.'); } finally { setBusy(false); } };
  const add = async () => { setBusy(true); try { await productionApi.deliverables.create(projectId, { durationSec: Number(form.durationSec) || null, aspectRatio: form.aspectRatio, name: form.name || `${form.durationSec}s · ${form.aspectRatio}` }); setAdding(false); setForm({ durationSec: '30', aspectRatio: '16:9', name: '' }); load(); } catch { alert('Needs db:push + restart.'); } finally { setBusy(false); } };
  const setStatus = async (id: string, status: string) => { await productionApi.deliverables.setStatus(id, status); load(); };
  const del = async (id: string) => { if (!confirm('Delete this deliverable?')) return; await productionApi.deliverables.remove(id); load(); };

  const groups = Array.from(new Set(list.map(d => d.durationSec))).sort((a: any, b: any) => (b || 0) - (a || 0));
  const delivered = list.filter(d => d.pipelineStatus === 'DELIVERED').length;
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-start gap-2"><Film size={16} className="text-brand-600 mt-0.5" /><div><h4 className="text-sm font-semibold text-gray-700">Deliverables &amp; Versions</h4><p className="text-[11px] text-gray-400">Cutdowns × aspect ratios with a post pipeline. One shoot → many finished spots.</p></div></div>
        <div className="flex items-center gap-2">
          <button onClick={gen} disabled={busy} className="btn btn-secondary text-xs py-1.5"><Sparkles size={13} className="me-1" /> Generate from brief</button>
          <button onClick={() => setAdding(a => !a)} className="btn btn-primary text-xs py-1.5"><Plus size={13} className="me-1" /> Add</button>
          <button onClick={load} className="btn btn-secondary p-1.5"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>
      {adding && (
        <div className="card bg-blue-50/40 border-blue-100 mb-3 flex items-end gap-2 flex-wrap">
          <label className="text-xs">Duration (s)<input className="input text-sm h-9 w-24" value={form.durationSec} onChange={e => setForm((f: any) => ({ ...f, durationSec: e.target.value }))} /></label>
          <label className="text-xs">Aspect ratio<input className="input text-sm h-9 w-28" value={form.aspectRatio} onChange={e => setForm((f: any) => ({ ...f, aspectRatio: e.target.value }))} /></label>
          <label className="text-xs flex-1">Name (optional)<input className="input text-sm h-9 w-full" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></label>
          <button onClick={add} disabled={busy} className="btn btn-primary text-xs py-1.5">Add</button><button onClick={() => setAdding(false)} className="btn btn-secondary text-xs py-1.5">Cancel</button>
        </div>
      )}
      {loading ? <p className="text-xs text-gray-400 py-6 text-center">Loading…</p> : list.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">No deliverables yet. Click <b>Generate from brief</b> to build the cutdown × ratio matrix, or add one.</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-2 text-[11px]"><span className="px-2 py-0.5 rounded bg-gray-50 text-gray-600">{list.length} deliverables</span><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{delivered} delivered</span></div>
          <div className="space-y-3">
            {groups.map(dur => (
              <div key={String(dur)}>
                <div className="text-[11px] font-semibold text-gray-500 mb-1">{dur ? `${dur}s` : 'Unspecified'}</div>
                <div className="space-y-1">
                  {list.filter(d => d.durationSec === dur).map(d => (
                    <div key={d.id} className="flex items-center gap-2 border border-gray-100 rounded-lg px-2.5 py-1.5">
                      <span className="text-xs font-mono text-gray-500 w-16">{d.aspectRatio || '—'}</span>
                      <span className="text-xs text-gray-700 flex-1 truncate">{d.name}</span>
                      {d.dueDate && <span className="text-[10px] text-gray-400">{new Date(d.dueDate).toLocaleDateString('en-GB')}</span>}
                      <select value={d.pipelineStatus} onChange={e => setStatus(d.id, e.target.value)} className={cn('text-[10px] rounded px-1.5 py-1 border', STAGE_CLS[d.pipelineStatus] || 'bg-gray-100 text-gray-500')}>{STAGES.map(st => <option key={st} value={st}>{st}</option>)}</select>
                      <button onClick={() => del(d.id)} className="text-gray-300 hover:text-rose-500"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Pipeline: Planned → Offline → Online → Grade → Mix → Delivered. These map to the brief's durations &amp; ratios — the on-brief compass turns green as they're covered.</p>
        </>
      )}
    </div>
  );
}
