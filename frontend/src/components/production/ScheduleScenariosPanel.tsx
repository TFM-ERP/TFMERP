'use client';

import { useEffect, useState, useCallback } from 'react';
import { Camera, Sparkles, GitCompare, Trash2, Pencil, Check, Link2, AlertTriangle, RefreshCw, PlayCircle } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const KIND_CLS: Record<string, string> = {
  SNAPSHOT: 'bg-gray-100 text-gray-600', OPTIMIZED: 'bg-teal-100 text-teal-700',
  BASELINE: 'bg-amber-100 text-amber-700', LIVE: 'bg-brand-100 text-brand-700',
};
const pagesLabel = (p: number) => { const w = Math.floor(p); const e = Math.round((p - w) * 8); return (`${w || (e ? '' : '0')}${e ? ` ${e}/8` : ''}`).trim() || '0'; };
// metrics where lower is better (used to highlight the winning column in compare)
const LOWER = new Set(['companyMoves', 'castHoldDays', 'dayNightSwitches', 'multiLocationDays']);
const METRICS: { k: string; label: string }[] = [
  { k: 'shootDays', label: 'Shoot days' },
  { k: 'companyMoves', label: 'Company moves' },
  { k: 'castHoldDays', label: 'Cast hold days' },
  { k: 'dayNightSwitches', label: 'D/N switches' },
  { k: 'multiLocationDays', label: 'Multi-loc days' },
  { k: 'totalScenes', label: 'Scenes' },
];

export default function ScheduleScenariosPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<any>(null);
  const [busyRecon, setBusyRecon] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [cmp, setCmp] = useState<any>(null);

  const load = useCallback(() => {
    setLoading(true);
    productionApi.scheduling.scenarios(projectId).then((r: any) => setList(r.data || [])).catch(() => setList([])).finally(() => setLoading(false));
    productionApi.scheduling.scriptStripStatus(projectId).then((r: any) => setStatus(r.data)).catch(() => setStatus(null));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const snapshot = async () => {
    const name = prompt('Name this snapshot of the current board:', `Snapshot ${new Date().toLocaleDateString('en-GB')}`);
    if (name === null) return;
    setBusy(true);
    try { await productionApi.scheduling.snapshotScenario(projectId, { name: name || undefined }); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Snapshot failed — run db:push & restart the backend to enable scenarios.'); }
    finally { setBusy(false); }
  };
  const optimized = async () => {
    const ppd = prompt('Generate an optimised variant (saved as a scenario, not applied). Target pages per day:', '5');
    if (ppd === null) return;
    setBusy(true);
    try { const r = await productionApi.scheduling.optimizedScenario(projectId, { pagesPerDay: Number(ppd) || 5 }); if (r.data?.ok === false) alert(r.data.message || 'Nothing to optimise.'); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Optimise failed — run db:push & restart the backend.'); }
    finally { setBusy(false); }
  };
  const apply = async (s: any) => {
    if (!confirm(`Apply "${s.name}" to the live board?\n\nThe current live board is auto-saved as a BASELINE scenario first, so you can roll back.`)) return;
    setBusy(true);
    try { const r = await productionApi.scheduling.applyScenario(s.id); alert(`Applied to ${r.data.applied} strips. A rollback baseline was saved.`); load(); }
    catch (e: any) { alert(e.response?.data?.message || 'Apply failed.'); }
    finally { setBusy(false); }
  };
  const rename = async (s: any) => { const name = prompt('Rename scenario:', s.name); if (name === null || name === s.name) return; await productionApi.scheduling.updateScenario(s.id, { name }); load(); };
  const remove = async (s: any) => { if (!confirm(`Delete scenario "${s.name}"?`)) return; await productionApi.scheduling.deleteScenario(s.id); setSel(p => { const n = new Set(p); n.delete(s.id); return n; }); load(); };
  const toggleSel = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const compare = async () => {
    setBusy(true);
    try { const r = await productionApi.scheduling.compareScenarios(projectId, [...sel]); setCmp(r.data); }
    catch (e: any) { alert(e.response?.data?.message || 'Compare failed.'); }
    finally { setBusy(false); }
  };
  const reconcile = async () => {
    if (!confirm('Link script scenes to production strips by scene number?\n\nThis populates each matched scene’s strip link (ScriptScene.productionStripId). Non-destructive.')) return;
    setBusyRecon(true);
    try { const r = await productionApi.scheduling.reconcileScriptStrips(projectId); setStatus(r.data); alert(`Linked ${r.data.newlyLinked} scene(s). Already linked: ${r.data.alreadyLinked}.`); }
    catch (e: any) { alert(e.response?.data?.message || 'Reconcile failed — restart the backend.'); }
    finally { setBusyRecon(false); }
  };

  const Chips = ({ m }: { m: any }) => !m ? <span className="text-[10px] text-gray-300">no metrics</span> : (
    <span className="flex flex-wrap gap-1 text-[10px]">
      <span className="px-1.5 py-0.5 rounded bg-gray-50 text-gray-600">{m.shootDays} days</span>
      <span className="px-1.5 py-0.5 rounded bg-gray-50 text-gray-600">{m.companyMoves} moves</span>
      <span className="px-1.5 py-0.5 rounded bg-gray-50 text-gray-600">{m.castHoldDays} hold</span>
      <span className="px-1.5 py-0.5 rounded bg-gray-50 text-gray-600">{m.dayNightSwitches} D/N</span>
      <span className="px-1.5 py-0.5 rounded bg-gray-50 text-gray-600">{pagesLabel(m.totalPages || 0)} pg</span>
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Script <-> Strip reconciliation */}
      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2"><Link2 size={15} className="text-brand-600" /><h4 className="text-sm font-semibold text-gray-700">Script ↔ Strip link</h4></div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn btn-secondary text-xs p-1.5" title="Refresh"><RefreshCw size={12} /></button>
            <button onClick={reconcile} disabled={busyRecon} className="btn btn-primary text-xs py-1.5"><Link2 size={12} className="me-1" />{busyRecon ? 'Linking…' : 'Reconcile now'}</button>
          </div>
        </div>
        {!status ? <p className="text-[11px] text-gray-400">No script linked yet — import a script on the Script tab, then reconcile.</p> : status.inSync ? (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 flex items-center gap-1.5"><Check size={13} /> In sync — {status.alreadyLinked} scene(s) linked to strips by ID.</div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-gray-50 text-gray-600">{status.scenes} scenes · {status.strips} strips</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{status.alreadyLinked} linked</span>
              {status.linkable > 0 && <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700">{status.linkable} linkable now</span>}
              {status.unmatchedScenes?.length > 0 && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700">{status.unmatchedScenes.length} scenes w/o strip</span>}
              {status.orphanStrips?.length > 0 && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700">{status.orphanStrips.length} strips w/o scene</span>}
              {status.conflicts?.length > 0 && <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 flex items-center gap-1"><AlertTriangle size={11} />{status.conflicts.length} conflicts</span>}
            </div>
            {status.unmatchedScenes?.length > 0 && <p className="text-[10px] text-gray-400">Scenes without a strip: {status.unmatchedScenes.slice(0, 12).map((s: any) => s.sceneNumber).join(', ')}{status.unmatchedScenes.length > 12 ? '…' : ''}</p>}
            {status.orphanStrips?.length > 0 && <p className="text-[10px] text-gray-400">Strips without a scene: {status.orphanStrips.slice(0, 12).map((s: any) => s.sceneNumber).join(', ')}{status.orphanStrips.length > 12 ? '…' : ''}</p>}
          </div>
        )}
      </div>

      {/* Scenarios */}
      <div className="card">
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-start gap-2"><GitCompare size={15} className="text-brand-600 mt-0.5" /><div><h4 className="text-sm font-semibold text-gray-700">What-if scenarios</h4><p className="text-[11px] text-gray-400">Snapshots of the board you can compare and apply. The live board is never changed until you Apply.</p></div></div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={snapshot} disabled={busy} className="btn btn-secondary text-xs py-1.5"><Camera size={13} className="me-1" /> Snapshot board</button>
            <button onClick={optimized} disabled={busy} className="btn btn-secondary text-xs py-1.5"><Sparkles size={13} className="me-1" /> Optimised variant</button>
            <button onClick={compare} disabled={busy || sel.size < 1} className="btn btn-primary text-xs py-1.5" title="Compare selected vs the live board"><GitCompare size={13} className="me-1" /> Compare ({sel.size})</button>
          </div>
        </div>

        {loading ? <div className="p-6 text-center text-gray-400 text-sm">Loading…</div> : list.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No scenarios yet. Snapshot the board or generate an optimised variant to compare options.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {list.map((s: any) => (
              <div key={s.id} className="py-2 flex items-center gap-3">
                <input type="checkbox" checked={sel.has(s.id)} onChange={() => toggleSel(s.id)} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-800 truncate">{s.name}</span>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded uppercase', KIND_CLS[s.kind] || 'bg-gray-100 text-gray-600')}>{s.kind}</span>
                    <span className="text-[10px] text-gray-300">{s.sceneCount} sc</span>
                  </div>
                  <div className="mt-1"><Chips m={s.metrics} /></div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => apply(s)} disabled={busy} className="btn btn-secondary text-xs py-1 px-2" title="Apply to live board (auto-baselines)"><PlayCircle size={12} className="me-1" />Apply</button>
                  <button onClick={() => rename(s)} className="text-gray-300 hover:text-gray-600 p-1" title="Rename"><Pencil size={12} /></button>
                  <button onClick={() => remove(s)} className="text-gray-300 hover:text-red-500 p-1" title="Delete"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {cmp?.columns?.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3 overflow-x-auto">
            <div className="text-xs font-semibold text-gray-600 mb-2">Comparison</div>
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-start px-2 py-1 text-[10px] text-gray-400 uppercase">Metric</th>
                  {cmp.columns.map((c: any) => <th key={c.id} className="px-3 py-1 text-end text-[10px] font-semibold text-gray-600 whitespace-nowrap">{c.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {METRICS.map(({ k, label }) => {
                  const vals = cmp.columns.map((c: any) => Number(c.metrics?.[k] ?? 0));
                  const best = LOWER.has(k) ? Math.min(...vals) : null;
                  return (
                    <tr key={k} className="border-t border-gray-50">
                      <td className="px-2 py-1 text-gray-500">{label}</td>
                      {cmp.columns.map((c: any, i: number) => (
                        <td key={c.id} className={cn('px-3 py-1 text-end tabular-nums', best !== null && vals[i] === best ? 'text-emerald-600 font-bold' : 'text-gray-700')}>{vals[i]}</td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="border-t border-gray-50">
                  <td className="px-2 py-1 text-gray-500">Pages</td>
                  {cmp.columns.map((c: any) => <td key={c.id} className="px-3 py-1 text-end text-gray-700 tabular-nums">{pagesLabel(c.metrics?.totalPages || 0)}</td>)}
                </tr>
              </tbody>
            </table>
            <p className="text-[10px] text-gray-400 mt-2">Green = best across compared options (fewer moves / hold days / switches is better).</p>
          </div>
        )}
      </div>
    </div>
  );
}
