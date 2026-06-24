'use client';
import { useState, useRef } from 'react';
import { productionApi } from '@/lib/api';
import { Activity, X } from 'lucide-react';

const VERDICT: any = { KEEP: '#16a34a', TIGHTEN: '#d97706', CUT: '#dc2626' };

export default function DiagnosticsPanel({ projectId, revision, onClose }: { projectId: string; revision?: any; onClose?: () => void }) {
  const [scenes, setScenes] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const progRef = useRef<any>(null);
  const startProg = () => { setProg(6); clearInterval(progRef.current); progRef.current = setInterval(() => setProg((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 12)) : p)), 240); };
  const endProg = (ok: boolean) => { clearInterval(progRef.current); if (ok) { setProg(100); setTimeout(() => setProg(0), 700); } else setProg(0); };

  const run = async () => {
    setBusy(true); startProg();
    try { const r = await productionApi.scripton.diagnostics(projectId, { revisionId: revision?.id }); setScenes(r.data?.scenes || []); endProg(true); }
    catch (e: any) { endProg(false); alert((e?.response?.data?.message || (e?.response?.status ? 'Diagnostics failed (HTTP ' + e.response.status + ') — check the backend terminal' : 'Diagnostics failed — backend not reachable on :3001. Is `npm run start` running, and is the API proxy/CORS ok?'))); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Activity size={15} className="text-indigo-600" /><span className="text-sm font-semibold text-slate-800">Scene diagnostics</span></div>
        <div className="flex items-center gap-2">
          <button onClick={run} disabled={busy} className="text-[11px] px-2.5 py-1 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200 disabled:opacity-50">{scenes ? 'Re-run' : 'Run diagnostics'}</button>
          {onClose && <button onClick={onClose} className="text-slate-300 hover:text-slate-600"><X size={16} /></button>}
        </div>
      </div>
      {prog > 0 && (<div className="mb-3"><div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${prog}%`, background: '#6366f1', transition: 'width .25s' }} /></div><div className="text-[10px] text-slate-400 mt-1">{prog < 100 ? `Diagnosing scenes… ${prog}%` : 'Done'}</div></div>)}
      {!scenes && prog === 0 && (<div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl p-6 text-center">Run the script-doctor diagnostics on the active revision: who-wants-what, the obstacle, the subtext, and whether the power shifts — scene by scene.</div>)}
      {scenes && scenes.length === 0 && (<div className="text-xs text-slate-400 p-4 text-center">No scenes returned.</div>)}
      {scenes && scenes.length > 0 && (
        <div className="space-y-2">
          {scenes.map((s: any, i: number) => (
            <div key={i} className="rounded-lg border border-slate-100 bg-white p-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[12px] font-semibold text-slate-700 truncate">{s.sceneNumber ? s.sceneNumber + '. ' : ''}{s.slugline || 'Scene'}</span>
                {s.verdict && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: (VERDICT[s.verdict] || '#64748b') + '22', color: VERDICT[s.verdict] || '#64748b' }}>{s.verdict}</span>}
              </div>
              <div className="grid sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[11.5px] text-slate-600">
                {s.objective && <div><span className="text-slate-400">Wants:</span> {s.objective}</div>}
                {s.obstacle && <div><span className="text-slate-400">Obstacle:</span> {s.obstacle}</div>}
                {s.subtext && <div><span className="text-slate-400">Subtext:</span> {s.subtext}</div>}
                {s.powerShift && <div><span className="text-slate-400">Power shift:</span> {s.powerShift}</div>}
              </div>
              {s.fix && <div className="mt-1.5 text-[11.5px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1"><span className="font-semibold">Fix:</span> {s.fix}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
