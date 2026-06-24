'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { productionApi } from '@/lib/api';
import { FileText, X } from 'lucide-react';

const GRADE_COLOR: any = { EXCELLENT: '#16a34a', GOOD: '#0ea5e9', FAIR: '#d97706', POOR: '#dc2626' };
const REC_COLOR: any = { RECOMMEND: '#16a34a', CONSIDER: '#d97706', PASS: '#dc2626' };
const COMMENT_KEYS = ['plot', 'characters', 'dialogue', 'theme', 'originality', 'marketability', 'production'];

export default function CoveragePanel({ projectId, revision, onClose }: { projectId: string; revision?: any; onClose?: () => void }) {
  const [cov, setCov] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const progRef = useRef<any>(null);
  const startProg = () => { setProg(6); clearInterval(progRef.current); progRef.current = setInterval(() => setProg((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 12)) : p)), 240); };
  const endProg = (ok: boolean) => { clearInterval(progRef.current); if (ok) { setProg(100); setTimeout(() => setProg(0), 700); } else setProg(0); };

  const load = useCallback(async () => { try { const r = await productionApi.scripton.latestCoverage(projectId); setCov(r.data || null); } catch { /* none yet */ } }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setBusy(true); startProg();
    try { const r = await productionApi.scripton.coverage(projectId, { revisionId: revision?.id }); setCov(r.data); endProg(true); }
    catch (e: any) { endProg(false); alert((e?.response?.data?.message || (e?.response?.status ? 'Coverage failed (HTTP ' + e.response.status + ') — check the backend terminal' : 'Coverage failed — backend not reachable on :3001. Is `npm run start` running, and is the API proxy/CORS ok?'))); }
    finally { setBusy(false); }
  };

  const f = cov?.facts || {};
  const comments = cov?.comments || {};

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><FileText size={15} className="text-indigo-600" /><span className="text-sm font-semibold text-slate-800">Coverage</span>{cov?.title && <span className="text-xs text-slate-400">· {cov.title}</span>}</div>
        <div className="flex items-center gap-2">
          <button onClick={generate} disabled={busy} className="text-[11px] px-2.5 py-1 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200 disabled:opacity-50">{cov ? 'Regenerate' : 'Generate coverage'}</button>
          {onClose && <button onClick={onClose} className="text-slate-300 hover:text-slate-600"><X size={16} /></button>}
        </div>
      </div>
      {prog > 0 && (<div className="mb-3"><div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}><div style={{ height: '100%', width: `${prog}%`, background: '#6366f1', transition: 'width .25s' }} /></div><div className="text-[10px] text-slate-400 mt-1">{prog < 100 ? `Reading the script… ${prog}%` : 'Done'}</div></div>)}
      {!cov && prog === 0 && (<div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl p-6 text-center">No coverage yet. Generate a data-grounded coverage report from the active script revision.</div>)}
      {cov && (
        <div className="space-y-4 text-[13px] text-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            {cov.recommendation && <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: (REC_COLOR[cov.recommendation] || '#64748b') + '22', color: REC_COLOR[cov.recommendation] || '#64748b' }}>{cov.recommendation}</span>}
            {cov.genre && <span className="text-[11px] px-2 py-1 rounded-full bg-slate-100 text-slate-600">{cov.genre}</span>}
            <span className="text-[11px] text-slate-400">{f.sceneCount || 0} scenes · {f.locations || 0} locations · INT {f.int || 0}/EXT {f.ext || 0} · DAY {f.day || 0}/NIGHT {f.night || 0}{f.pages ? ` · ${f.pages} pp` : ''}</span>
          </div>
          {cov.logline && <div><div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Logline</div><div className="italic">{cov.logline}</div></div>}
          {cov.synopsis && <div><div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">Synopsis</div><p className="whitespace-pre-wrap leading-relaxed">{cov.synopsis}</p></div>}
          <div className="grid sm:grid-cols-2 gap-2">
            {COMMENT_KEYS.filter((k) => comments[k]).map((k) => (<div key={k} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">{k}</div><div className="text-[12px] leading-snug">{comments[k]}</div></div>))}
          </div>
          {cov.grades && Object.keys(cov.grades).length > 0 && (<div className="flex flex-wrap gap-2">{Object.entries(cov.grades).map(([k, v]: any) => (<span key={k} className="text-[10px] px-2 py-1 rounded-md border" style={{ borderColor: GRADE_COLOR[String(v)] || '#cbd5e1', color: GRADE_COLOR[String(v)] || '#64748b' }}>{k}: {String(v)}</span>))}</div>)}
          {Array.isArray(cov.comps) && cov.comps.length > 0 && (<div><div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Comps</div><ul className="space-y-0.5">{cov.comps.map((c: any, i: number) => (<li key={i} className="text-[12px]"><b>{c.title}</b>{c.reason ? ` — ${c.reason}` : ''}</li>))}</ul></div>)}
          {Array.isArray(cov.characters) && cov.characters.length > 0 && (<div><div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Character breakdown</div><div className="overflow-x-auto"><table className="w-full text-[12px]"><thead><tr className="text-slate-400 text-[10px] uppercase"><th className="text-start py-1">Name</th><th className="text-start">Role</th><th className="text-end">Scenes</th></tr></thead><tbody>{cov.characters.map((c: any, i: number) => (<tr key={i} className="border-t border-slate-100"><td className="py-1 font-medium">{c.name}</td><td className="text-slate-500">{c.role}</td><td className="text-end tabular-nums">{c.scenesPct}% <span className="text-slate-300">({c.scenesCount})</span></td></tr>))}</tbody></table></div></div>)}
        </div>
      )}
    </div>
  );
}
