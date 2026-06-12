'use client';

import { useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';
import { X, BarChart3, Copy, Download, Loader2 } from 'lucide-react';

/**
 * SYS-13b · P6 — Analyze. Renders the local ($0, on-machine) script breakdown for a revision.
 * No external AI — heuristic over the captured page text + parsed scenes.
 */
export default function ScriptAnalyzePanel({ revision, onClose, inline }: { revision: any; onClose: () => void; inline?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    productionApi.script.analyze(revision.id).then((r) => setData(r.data)).catch((e) => setErr(e?.response?.data?.message || 'Analysis failed.'));
  }, [revision.id]);

  const csv = () => {
    if (!data) return '';
    const rows = [['Character', 'Cues', 'Scenes']];
    for (const c of data.characters) rows.push([c.name, String(c.cues), String(c.scenes)]);
    return rows.map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n');
  };
  const copyCsv = () => navigator.clipboard?.writeText(csv());
  const downloadCsv = () => { const b = new Blob([csv()], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `analyze-${revision.revisionLabel}.csv`; a.click(); URL.revokeObjectURL(a.href); };

  const Stat = ({ label, value }: any) => (
    <div className="rounded-xl border border-slate-200 p-3 text-center"><div className="text-[11px] text-slate-400">{label}</div><div className="text-xl font-semibold mt-0.5">{value}</div></div>
  );
  const Bar = ({ label, value, max, color }: any) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-slate-500 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color || '#0f172a' }} /></div>
      <span className="w-8 text-right text-slate-600">{value}</span>
    </div>
  );

  return (
    <div className={inline ? 'absolute inset-0' : 'fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4'} onClick={inline ? undefined : onClose}>
      <div className={inline ? 'bg-white h-full w-full overflow-y-auto' : 'bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto'} onClick={(e) => e.stopPropagation()}>
        {!inline && (
        <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between sticky top-0 glass-bar">
          <h2 className="font-semibold text-sm inline-flex items-center gap-2"><BarChart3 size={16} /> Analyze — {revision.revisionLabel}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        )}

        {err && <p className="p-5 text-sm text-rose-600">{err}</p>}
        {!data && !err && <p className="p-10 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" /></p>}

        {data && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
              <Stat label="Pages" value={data.totals.pages} />
              <Stat label="Scenes" value={data.totals.scenes} />
              <Stat label="Eighths" value={data.totals.eighths} />
              <Stat label="Speaking roles" value={data.totals.speakingRoles} />
              <Stat label="Locations" value={data.totals.locations} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Format</p>
                <div className="space-y-1.5">
                  {Object.entries(data.format).map(([k, v]: any) => <Bar key={k} label={k} value={v} max={data.totals.scenes} color="#0ea5e9" />)}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Day / Night</p>
                <div className="space-y-1.5">
                  {Object.entries(data.dayNight).map(([k, v]: any) => <Bar key={k} label={k} value={v} max={data.totals.scenes} color="#a855f7" />)}
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Dialogue / action mix</p>
              <Bar label="Dialogue" value={data.dialogueActionRatio.dialogue} max={data.dialogueActionRatio.dialogue + data.dialogueActionRatio.action} color="#22c55e" />
              <div className="mt-1"><Bar label="Action" value={data.dialogueActionRatio.action} max={data.dialogueActionRatio.dialogue + data.dialogueActionRatio.action} color="#f97316" /></div>
              <p className="text-[11px] text-slate-400 mt-1">{data.dialogueActionRatio.pctDialogue}% dialogue lines.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Speaking characters</p>
                  <div className="flex items-center gap-2">
                    <button onClick={copyCsv} className="text-[11px] inline-flex items-center gap-1 text-slate-500 hover:text-slate-900"><Copy size={12} /> Copy</button>
                    <button onClick={downloadCsv} className="text-[11px] inline-flex items-center gap-1 text-slate-500 hover:text-slate-900"><Download size={12} /> CSV</button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="text-slate-400 text-[10px] uppercase sticky top-0 glass-bar"><tr><th className="text-left px-3 py-1.5">Character</th><th className="text-right px-3 py-1.5">Cues</th><th className="text-right px-3 py-1.5">Scenes</th></tr></thead>
                    <tbody>
                      {data.characters.map((c: any) => (
                        <tr key={c.name} className="border-t border-slate-50"><td className="px-3 py-1 text-slate-700">{c.name}</td><td className="px-3 py-1 text-right text-slate-500">{c.cues}</td><td className="px-3 py-1 text-right text-slate-500">{c.scenes}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Largest scenes &amp; locations</p>
                <div className="space-y-1 mb-3">
                  {data.largestScenes.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs"><span className="text-slate-400 w-8">{s.sceneNumber || '•'}</span><span className="flex-1 truncate text-slate-600">{s.slugline}</span><span className="text-slate-400">{s.pages}p</span></div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.locations.slice(0, 16).map((l: any) => <span key={l.name} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{l.name} · {l.count}</span>)}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">{data.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}
