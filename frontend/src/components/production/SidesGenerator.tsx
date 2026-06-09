'use client';

import { useState, useEffect, useCallback } from 'react';
import { productionApi, assetUrl } from '@/lib/api';
import { Scissors, X, Loader2, Download, Mail, Trash2, FileText, Users } from 'lucide-react';
import { Btn, Chip } from './ui';

const inp = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-900 outline-none';

/**
 * SYS-13 · D5 — Sides Generator. Pick tomorrow's scenes, choose recipients, generate the pruned +
 * crossed-out + 2-up + per-recipient-watermarked sides, then download or email them.
 */
export default function SidesGenerator({ projectId, revision, onClose }: { projectId: string; revision: any; onClose: () => void }) {
  const scenes = revision?.scenes || [];
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [shootDate, setShootDate] = useState('');
  const [crew, setCrew] = useState<any[]>([]);
  const [recip, setRecip] = useState<Set<string>>(new Set()); // crew ids
  const [jobs, setJobs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const loadJobs = useCallback(() => { productionApi.sides.list(projectId).then((r) => setJobs(Array.isArray(r.data) ? r.data : [])); }, [projectId]);
  useEffect(() => {
    productionApi.crew.list(projectId).then((r) => setCrew((r.data || []).filter((c: any) => c.email || c.crewMember?.email)));
    loadJobs();
  }, [projectId, loadJobs]);

  const toggle = (set: Set<string>, v: string, setter: (s: Set<string>) => void) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n); };

  const generate = async () => {
    if (sel.size === 0) { alert('Select at least one scene.'); return; }
    setBusy(true);
    try {
      const recipients = crew.filter((c) => recip.has(c.id)).map((c) => ({ name: c.name, email: c.email || c.crewMember?.email, crewId: c.id }));
      await productionApi.sides.generate(revision.id, { scenes: Array.from(sel), shootDate: shootDate || null, recipients });
      loadJobs();
    } catch (e: any) { alert(e?.response?.data?.message || 'Sides generation failed.'); }
    finally { setBusy(false); }
  };
  const emailJob = async (id: string) => { await productionApi.sides.email(id).then((r) => alert(`Emailed ${r.data.sent} recipient(s).`)).catch((e) => alert(e?.response?.data?.message || 'Email failed.')); loadJobs(); };
  const removeJob = async (id: string) => { if (!confirm('Delete this sides job?')) return; await productionApi.sides.remove(id); loadJobs(); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-sm inline-flex items-center gap-2"><Scissors size={16} /> Sides Generator — {revision?.revisionLabel}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scenes */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Scenes for the day ({sel.size})</p>
              <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto p-1">
                {scenes.length === 0 ? <p className="text-xs text-slate-400 p-2">No parsed scenes.</p> : scenes.map((s: any) => (
                  <label key={s.id} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 rounded-lg cursor-pointer">
                    <input type="checkbox" checked={sel.has(String(s.sceneNumber))} onChange={() => toggle(sel, String(s.sceneNumber), setSel)} />
                    <span className="text-slate-400 w-8">{s.sceneNumber || '•'}</span>
                    <span className="flex-1 truncate text-slate-700">{s.slugline}</span>
                    <span className="text-slate-300">p.{s.pageStart}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Recipients + date */}
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Shoot date</p>
                <input type="date" className={`${inp} w-full`} value={shootDate} onChange={(e) => setShootDate(e.target.value)} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5 inline-flex items-center gap-1"><Users size={12} /> Recipients ({recip.size}) — each gets a watermarked copy</p>
                <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto p-1">
                  {crew.length === 0 ? <p className="text-xs text-slate-400 p-2">No crew with email addresses.</p> : crew.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={recip.has(c.id)} onChange={() => toggle(recip, c.id, setRecip)} />
                      <span className="flex-1 truncate text-slate-700">{c.name}</span>
                      <span className="text-slate-300 truncate">{c.email || c.crewMember?.email}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Btn variant="primary" onClick={generate} disabled={busy || sel.size === 0}>{busy ? <Loader2 size={13} className="animate-spin" /> : <Scissors size={13} />} Generate sides</Btn>
          </div>

          {/* Jobs history */}
          {jobs.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Generated sides</p>
              <div className="space-y-2">
                {jobs.map((j) => (
                  <div key={j.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <FileText size={15} className="text-slate-400" />
                      <span className="text-sm font-medium text-slate-800">{(j.scenes || []).length} scenes · {j.pageCount} pages</span>
                      {j.shootDate && <span className="text-[11px] text-slate-400">{new Date(j.shootDate).toLocaleDateString('en-GB')}</span>}
                      <Chip tone={j.status === 'SHARED' ? 'money' : 'slate'}>{j.status}</Chip>
                      <div className="ml-auto flex items-center gap-1.5">
                        {j.baseUrl && <a href={assetUrl(j.baseUrl)} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-900" title="Base sides"><Download size={14} /></a>}
                        <button onClick={() => emailJob(j.id)} className="text-slate-400 hover:text-slate-900" title="Email recipients"><Mail size={14} /></button>
                        <button onClick={() => removeJob(j.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(j.recipients || []).map((r: any, i: number) => (
                        <a key={i} href={assetUrl(r.outputUrl)} target="_blank" rel="noreferrer" className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-600 hover:border-slate-900 inline-flex items-center gap-1">
                          <Download size={11} /> {r.name}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
