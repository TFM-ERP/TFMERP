'use client';

import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { X, Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Loader2, Copy, Download, Sparkles, FileText, Tags, ClipboardList } from 'lucide-react';

/**
 * SYS-13b · P3 — Tagging & reports depth.
 * Custom tag categories (add/rename/recolour/reorder/hide), Auto-Tag Cast, an Element/Category
 * report (with CSV), and scene-level special tags (story day / synopsis / note).
 */
export default function TagToolsPanel({ projectId, revision, onChanged, onClose, inline }: {
  projectId: string; revision: any; onChanged?: () => void; onClose: () => void; inline?: boolean;
}) {
  const [tab, setTab] = useState<'cats' | 'auto' | 'report' | 'scenes'>('cats');
  const [cats, setCats] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [scenes, setScenes] = useState<any[]>(revision?.scenes || []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [newCat, setNewCat] = useState({ label: '', color: '#0ea5e9' });

  const loadCats = useCallback(() => {
    productionApi.scriptAnnotations.tagCategories(projectId).then((r) => setCats(r.data || [])).catch(() => {});
  }, [projectId]);
  useEffect(() => { loadCats(); }, [loadCats]);
  useEffect(() => { if (tab === 'report') productionApi.scriptAnnotations.tagReport(revision.id).then((r) => setReport(r.data)).catch(() => {}); }, [tab, revision.id]);

  const saveCat = async (id: string, data: any) => { await productionApi.scriptAnnotations.editTagCategory(id, data); loadCats(); };
  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...cats]; const j = idx + dir; if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]]; setCats(next);
    await productionApi.scriptAnnotations.reorderTagCategories(projectId, next.map((c) => c.id));
  };
  const addCat = async () => {
    if (!newCat.label.trim()) return;
    await productionApi.scriptAnnotations.addTagCategory(projectId, { ...newCat, sortOrder: cats.length });
    setNewCat({ label: '', color: '#0ea5e9' }); loadCats();
  };
  const delCat = async (id: string) => { if (confirm('Delete this category?')) { await productionApi.scriptAnnotations.removeTagCategory(id); loadCats(); } };

  const runAutoTag = async () => {
    setBusy(true); setMsg('');
    try { const r = await productionApi.scriptAnnotations.autoTagCast(revision.id); setMsg(`Tagged ${r.data.created} cast appearance(s) across ${r.data.scenes} scenes.`); onChanged?.(); }
    catch (e: any) { setMsg(e?.response?.data?.message || 'Auto-tag failed.'); }
    finally { setBusy(false); }
  };

  const csv = () => {
    if (!report) return '';
    const rows = [['Category', 'Element', 'Scenes', 'Count']];
    for (const c of report.categories) for (const e of c.elements) rows.push([c.category, e.name, e.scenes.join(' '), String(e.count)]);
    return rows.map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(',')).join('\n');
  };
  const copyCsv = () => navigator.clipboard?.writeText(csv()).then(() => setMsg('Report CSV copied.')).catch(() => {});
  const downloadCsv = () => { const b = new Blob([csv()], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `tag-report-${revision.revisionLabel}.csv`; a.click(); URL.revokeObjectURL(a.href); };

  const saveScene = async (id: string, data: any) => { await productionApi.scriptAnnotations.updateScene(id, data); };

  const TABS = [['cats', 'Categories', Tags], ['auto', 'Auto-tag', Sparkles], ['report', 'Report', FileText], ['scenes', 'Scene tags', ClipboardList]] as const;

  return (
    <div className={inline ? 'absolute inset-0' : 'fixed inset-0 z-[80] bg-slate-900/50 flex items-stretch'} onClick={inline ? undefined : onClose}>
      <div className={inline ? 'h-full w-full bg-white flex flex-col' : 'ml-auto h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col'} onClick={(e) => e.stopPropagation()}>
        {!inline && (
        <div className="flex items-center gap-2 px-4 h-12 border-b border-slate-200 shrink-0">
          <Tags size={16} className="text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-800">Tagging — {revision?.revisionLabel}</h3>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        )}
        <div className="flex border-b border-slate-100 text-xs shrink-0">
          {TABS.map(([k, lbl, Icon]) => (
            <button key={k} onClick={() => setTab(k as any)} className={`flex-1 py-2.5 inline-flex items-center justify-center gap-1.5 ${tab === k ? 'border-b-2 border-slate-900 text-slate-900 font-medium' : 'text-slate-500'}`}>
              <Icon size={13} /> {lbl}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Categories */}
          {tab === 'cats' && (
            <div className="space-y-2">
              {cats.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
                  <div className="flex flex-col">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-300 hover:text-slate-700 disabled:opacity-30"><ChevronUp size={12} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === cats.length - 1} className="text-slate-300 hover:text-slate-700 disabled:opacity-30"><ChevronDown size={12} /></button>
                  </div>
                  <input type="color" value={c.color || '#0ea5e9'} onChange={(e) => saveCat(c.id, { color: e.target.value })} className="w-7 h-7 rounded border border-slate-200 p-0.5" />
                  <input defaultValue={c.label} onBlur={(e) => e.target.value !== c.label && saveCat(c.id, { label: e.target.value })} className="flex-1 text-sm rounded border border-slate-200 px-2 py-1" />
                  <span className="text-[10px] text-slate-400 font-mono">{c.key}</span>
                  <button onClick={() => saveCat(c.id, { hidden: !c.hidden })} title={c.hidden ? 'Hidden' : 'Visible'} className={c.hidden ? 'text-slate-300' : 'text-slate-600'}>{c.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  <button onClick={() => delCat(c.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <input type="color" value={newCat.color} onChange={(e) => setNewCat((n) => ({ ...n, color: e.target.value }))} className="w-7 h-7 rounded border border-slate-200 p-0.5" />
                <input placeholder="New category name…" value={newCat.label} onChange={(e) => setNewCat((n) => ({ ...n, label: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addCat()} className="flex-1 text-sm rounded border border-slate-200 px-2 py-1.5" />
                <button onClick={addCat} disabled={!newCat.label.trim()} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white text-xs px-3 py-2 disabled:opacity-50"><Plus size={13} /> Add</button>
              </div>
              <p className="text-[11px] text-slate-400 pt-1">Categories drive the TAG tool palette and group the Element report. Reorder to keep favourites on top; hide ones you don't use.</p>
            </div>
          )}

          {/* Auto-tag */}
          {tab === 'auto' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Scan the active revision and tag every speaking character in every scene in one pass. Tags land on a shared <b>Cast</b> layer and feed the Element report below. Re-running won't duplicate existing cast tags.</p>
              <button onClick={runAutoTag} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 text-white text-sm px-4 py-2 disabled:opacity-50">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Auto-tag cast
              </button>
              {msg && <p className="text-xs text-emerald-700">{msg}</p>}
            </div>
          )}

          {/* Report */}
          {tab === 'report' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={copyCsv} className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:border-slate-900"><Copy size={13} /> Copy CSV</button>
                <button onClick={downloadCsv} className="text-xs inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:border-slate-900"><Download size={13} /> Download CSV</button>
                {report && <span className="text-[11px] text-slate-400">{report.totals.tags} tags · {report.totals.categories} categories</span>}
              </div>
              {!report && <p className="text-sm text-slate-400">Loading…</p>}
              {report && report.categories.length === 0 && <p className="text-sm text-slate-400">No tags yet. Tag elements on the script (or run Auto-tag cast).</p>}
              {report?.categories.map((c: any) => (
                <div key={c.category} className="rounded-xl border border-slate-200">
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50 rounded-t-xl">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: c.color || '#94a3b8' }} />
                    <span className="text-xs font-semibold text-slate-700">{c.category}</span>
                    <span className="text-[10px] text-slate-400">{c.elements.length} element(s)</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead><tr className="text-slate-400 text-[10px] uppercase"><th className="text-left px-3 py-1">Element</th><th className="text-left px-3 py-1">Scenes</th><th className="text-right px-3 py-1">Count</th></tr></thead>
                    <tbody>
                      {c.elements.map((e: any) => (
                        <tr key={e.name} className="border-t border-slate-50">
                          <td className="px-3 py-1 text-slate-700">{e.name}</td>
                          <td className="px-3 py-1 text-slate-500">{e.scenes.join(', ')}</td>
                          <td className="px-3 py-1 text-right text-slate-500">{e.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* Scene tags */}
          {tab === 'scenes' && (
            <div className="space-y-2">
              {scenes.length === 0 && <p className="text-sm text-slate-400">No scenes parsed on this revision.</p>}
              {scenes.map((s) => (
                <div key={s.id} className="rounded-xl border border-slate-200 p-2.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-bold text-slate-400">{s.sceneNumber || '•'}</span>
                    <span className="text-xs font-medium text-slate-700 truncate">{s.slugline || '—'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input defaultValue={s.storyDay || ''} placeholder="Story day" onBlur={(e) => saveScene(s.id, { storyDay: e.target.value })} className="text-xs rounded border border-slate-200 px-2 py-1" />
                    <input defaultValue={s.description || ''} placeholder="Synopsis" onBlur={(e) => saveScene(s.id, { description: e.target.value })} className="text-xs rounded border border-slate-200 px-2 py-1 col-span-2" />
                  </div>
                  <input defaultValue={s.tagNote || ''} placeholder="Scene note" onBlur={(e) => saveScene(s.id, { tagNote: e.target.value })} className="w-full text-xs rounded border border-slate-200 px-2 py-1 mt-1.5" />
                </div>
              ))}
              <p className="text-[11px] text-slate-400">Edits save when you click away from a field.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
