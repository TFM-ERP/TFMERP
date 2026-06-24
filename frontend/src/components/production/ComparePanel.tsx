'use client';
import { useState, useRef } from 'react';
import { productionApi } from '@/lib/api';
import { ArrowLeftRight, X } from 'lucide-react';

const TYPE: any = { ADDED: '#16a34a', REMOVED: '#dc2626', MODIFIED: '#d97706' };
const sgn = (n: number) => (n > 0 ? '+' + n : String(n));
const DELTA_KEYS: [string, string][] = [['scenes', 'scenes'], ['locations', 'locations'], ['pages', 'pages'], ['int', 'INT'], ['ext', 'EXT'], ['day', 'DAY'], ['night', 'NIGHT']];

export default function ComparePanel({ projectId, revision, onClose }: { projectId: string; revision?: any; onClose?: () => void }) {
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const progRef = useRef<any>(null);
  const startProg = () => { setProg(6); clearInterval(progRef.current); progRef.current = setInterval(() => setProg((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 12)) : p)), 240); };
  const endProg = (ok: boolean) => { clearInterval(progRef.current); if (ok) { setProg(100); setTimeout(() => setProg(0), 700); } else setProg(0); };

  const run = async () => {
    setBusy(true); startProg();
    try { const r = await productionApi.scripton.compare(projectId, { toRevisionId: revision?.id }); setRes(r.data); endProg(true); }
    catch (e: any) { endProg(false); alert((e?.response?.data?.message || (e?.response?.status ? 'Compare failed (HTTP ' + e.response.status + ') — check the backend terminal' : 'Compare failed — backend not reachable on :3001. Is `npm run start` running, and is the API proxy/CORS ok?'))); }
    finally { setBusy(false); }
  };

  const d = res?.delta || {};
  const c = res?.counts || {};

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><ArrowLeftRight size={15} className="text-indigo-600" /><span className="text-sm font-semibold text-slate-800">Version compare</span>{res && <span className="text-xs text-slate-400">· {res.from?.label} → {res.to?.label}</span>}</div>
        <div className="flex items-center gap-2">
          <button onClick={run} disabled={busy} className="text-[11px] px-2.5 py-1 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200 disabled:opacity-50">{res ? 'Re-compare' : 'Compare latest two'}</button>
          {onClose && <button onClick={onClose} className="text-slate-300 hover:text-slate-600"><X size={16} /></button>}
        </div>
      </div>
      {prog > 0 && (<div className="mb-3"><div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${prog}%`, background: '#6366f1', transition: 'width .25s' }} /></div><div className="text-[10px] text-slate-400 mt-1">{prog < 100 ? `Comparing revisions… ${prog}%` : 'Done'}</div></div>)}
      {!res && prog === 0 && (<div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl p-6 text-center">Compare the active revision against the previous one — scenes added, cut and modified, the page/location delta, and a plain-language summary of the change.</div>)}
      {res && (
        <div className="space-y-3 text-[13px] text-slate-700">
          <div className="flex flex-wrap gap-2">
            <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: '#16a34a22', color: '#16a34a' }}>+{c.added || 0} added</span>
            <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: '#dc262622', color: '#dc2626' }}>−{c.removed || 0} removed</span>
            <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: '#d9770622', color: '#d97706' }}>~{c.modified || 0} modified</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DELTA_KEYS.filter(([k]) => Number(d[k]) !== 0).map(([k, label]) => (<span key={k} className="text-[10px] px-2 py-0.5 rounded-md border border-slate-200 text-slate-600 tabular-nums">{label} {sgn(d[k])}</span>))}
            {DELTA_KEYS.every(([k]) => Number(d[k]) === 0) && <span className="text-[11px] text-slate-400">No structural change in counts.</span>}
          </div>
          {res.narrative && <p className="text-[12px] leading-relaxed bg-slate-50 border border-slate-100 rounded-lg p-2.5">{res.narrative}</p>}
          {Array.isArray(res.changes) && res.changes.length > 0 && (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {res.changes.map((ch: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[12px]">
                  <span className="mt-1 shrink-0 w-2 h-2 rounded-full" style={{ background: TYPE[ch.type] || '#94a3b8' }} />
                  <span><span className="text-[10px] font-bold uppercase mr-1" style={{ color: TYPE[ch.type] || '#64748b' }}>{ch.type}</span>{ch.slugline || ch.key}{ch.was ? <span className="text-slate-400"> (was: {ch.was})</span> : null}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
