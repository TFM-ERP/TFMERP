'use client';

import { useEffect, useState, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { Link2, Lock, Check, AlertTriangle, RefreshCw, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

// WGA colour wheel
const WHEEL: { key: string; label: string; hex: string }[] = [
  { key: 'WHITE', label: 'White', hex: '#ffffff' },
  { key: 'BLUE', label: 'Blue', hex: '#9ec5ff' },
  { key: 'PINK', label: 'Pink', hex: '#ffc0cb' },
  { key: 'YELLOW', label: 'Yellow', hex: '#fff27a' },
  { key: 'GREEN', label: 'Green', hex: '#b6e7a0' },
  { key: 'GOLDENROD', label: 'Goldenrod', hex: '#e7c84e' },
  { key: 'BUFF', label: 'Buff', hex: '#f3e4c0' },
  { key: 'SALMON', label: 'Salmon', hex: '#ff9e80' },
  { key: 'CHERRY', label: 'Cherry', hex: '#d6444a' },
  { key: 'TAN', label: 'Tan', hex: '#d8c39a' },
];
const STATUS_CLS: Record<string, string> = {
  synced: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  drift: 'bg-amber-50 text-amber-700 border-amber-200',
  none: 'bg-gray-50 text-gray-400 border-gray-200',
};

/**
 * P0 — single-source-of-truth status strip for the Script hub landing.
 * Shows the active revision (colour wheel + lock) and how downstream modules
 * (breakdown, strips, budget, casting) line up with it. Read-only + reconcile.
 */
export default function ScriptProjectionsPanel({ projectId }: { projectId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [syncPrev, setSyncPrev] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [syncBusy, setSyncBusy] = useState(false);
  const [alsoDownstream, setAlsoDownstream] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setErr(false);
    productionApi.script.projectionStatus(projectId)
      .then((r: any) => setData(r.data)).catch(() => setErr(true)).finally(() => setLoading(false));
    productionApi.breakdown.projectionPreview(projectId).then((r: any) => setSyncPrev(r.data)).catch(() => setSyncPrev(null));
    productionApi.breakdown.projectionLogs(projectId).then((r: any) => setLogs(Array.isArray(r.data) ? r.data : [])).catch(() => setLogs([]));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const setMeta = async (body: any) => {
    if (!data?.revision?.id) return;
    setBusy(true);
    try { await productionApi.script.setRevisionMeta(data.revision.id, body); load(); }
    catch { alert('Colour/lock needs db:push — run it, then restart the backend.'); }
    finally { setBusy(false); }
  };
  const reconcile = async () => {
    setBusy(true);
    try { const r = await productionApi.scheduling.reconcileScriptStrips(projectId); alert(`Linked ${r.data?.newlyLinked ?? 0} scene(s) to strips.`); load(); }
    catch { alert('Reconcile failed — restart the backend.'); }
    finally { setBusy(false); }
  };
  const runBreakdown = async () => {
    if (!data?.revision?.id) return;
    if (!confirm("Run the AI breakdown on this revision's scenes? It tags once per scene — re-running only processes new scenes, and your manual tags are kept.")) return;
    setBusy(true);
    try { const r = await productionApi.breakdown.breakdownRevision(data.revision.id); alert(`Broke down ${r.data?.processed ?? 0} scene(s) → ${r.data?.elements ?? 0} elements.${r.data?.skipped ? ` (${r.data.skipped} already done)` : ''}`); load(); }
    catch { alert('AI breakdown needs db:push (scene-level elements), ANTHROPIC_API_KEY, and a backend restart.'); }
    finally { setBusy(false); }
  };
  const lockRev = async () => {
    if (!data?.revision?.id) return;
    const lock = !data.revision.isLocked;
    if (lock && !confirm('Lock this revision for production? Page numbering is frozen (later edits create A-pages). You can unlock again.')) return;
    setBusy(true);
    try { await productionApi.script.lockRevision(data.revision.id, lock); load(); }
    catch { alert('Lock needs db:push + a backend restart.'); }
    finally { setBusy(false); }
  };
  const applySync = async () => {
    if (!confirm('Apply the script → schedule sync now? Scheduled days and locked strips are protected; this is logged and can be undone.')) return;
    setSyncBusy(true);
    try { const r = await productionApi.breakdown.projectionApply(projectId, { createBudget: alsoDownstream, createCasting: alsoDownstream }); alert(`Synced — created ${r.data?.created ?? 0}, updated ${r.data?.updated ?? 0}, adopted ${r.data?.adopted ?? 0}, locked-skipped ${r.data?.skippedLocked ?? 0}.`); load(); }
    catch { alert('Sync needs db:push + a backend restart.'); }
    finally { setSyncBusy(false); }
  };
  const undo = async (logId: string) => {
    if (!confirm('Undo this sync? Created strips are deleted and updated strips restored to their previous content.')) return;
    setSyncBusy(true);
    try { const r = await productionApi.breakdown.projectionRollback(logId); alert(`Rolled back — deleted ${r.data?.deleted ?? 0}, restored ${r.data?.restored ?? 0}.`); load(); }
    catch { alert('Rollback failed.'); }
    finally { setSyncBusy(false); }
  };
  const linkScene = async (sceneId: string, stripId: string) => {
    if (!sceneId || !stripId) return;
    setSyncBusy(true);
    try { await productionApi.breakdown.projectionLink(sceneId, stripId); load(); }
    catch { alert('Link failed — needs a backend restart.'); }
    finally { setSyncBusy(false); }
  };

  if (loading) return <div className="son-card" style={{ padding: 14, marginBottom: 12 }}><span className="son-faint" style={{ fontSize: 12 }}>Checking projections…</span></div>;
  if (err || !data || !data.hasScript) return null; // silent until a script + ready backend exist

  const rev = data.revision;
  return (
    <div className="son-card" style={{ padding: 16, marginBottom: 14 }}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Link2 size={15} className="text-indigo-600" />
          <div>
            <div className="text-sm font-semibold text-slate-900">Source of truth</div>
            <div className="son-faint" style={{ fontSize: 11 }}>{data.document?.title} · breakdown, schedule, budget &amp; casting derive from the active revision</div>
          </div>
        </div>
        <button onClick={load} className="son-chip" title="Refresh"><RefreshCw size={12} className={cn(busy && 'animate-spin')} /></button>
      </div>

      {rev && (
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="son-faint" style={{ fontSize: 11 }}>Revision <b className="text-slate-700">{rev.label}</b>{rev.color ? ` · ${rev.color[0] + rev.color.slice(1).toLowerCase()}` : ''}{rev.round ? ' (Double)' : ''}</span>
          {(data.counts?.changed || 0) > 0 && <span className="text-[11px] text-amber-700" title="scenes changed vs the previous revision">✲ {data.counts.changed} changed</span>}
          {WHEEL.map((c) => (
            <button key={c.key} title={c.label} onClick={() => setMeta({ revisionColor: c.key })} disabled={busy}
              className="rounded-full" style={{ width: 18, height: 18, cursor: 'pointer', background: c.hex, border: rev.color === c.key ? '2px solid #111' : '1px solid rgba(0,0,0,.2)' }} />
          ))}
          <button onClick={lockRev} disabled={busy}
            className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border', rev.isLocked ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-white text-slate-500 border-slate-200')}>
            <Lock size={11} /> {rev.isLocked ? 'Locked · pages frozen' : 'Lock script'}
          </button>
          <button onClick={runBreakdown} disabled={busy} className="text-[11px] px-2.5 py-1 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-200" title="Run the AI script breakdown on this revision's scenes (tag once)">Run AI breakdown</button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(data.modules || []).map((m: any) => (
          <span key={m.key} className={cn('inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border', STATUS_CLS[m.status] || STATUS_CLS.none)}>
            {m.status === 'synced' ? <Check size={11} /> : m.status === 'drift' ? <AlertTriangle size={11} /> : null}
            {m.label}: <b>{m.count}{m.of != null ? `/${m.of}` : ''}</b>
          </span>
        ))}
      </div>

      {data.counts?.unlinked > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button onClick={reconcile} disabled={busy} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white" style={{ cursor: 'pointer' }}><Link2 size={12} /> Reconcile {data.counts.unlinked} scene(s) ↔ strips</button>
          <span className="son-faint" style={{ fontSize: 11 }}>links scenes to strips by id · P1 will sync the breakdown both ways</span>
        </div>
      )}

      {syncPrev?.hasScript && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <div className="text-xs font-semibold text-slate-700">Sync from script</div>
            <label className="son-faint inline-flex items-center gap-1" style={{ fontSize: 11 }}>
              <input type="checkbox" checked={alsoDownstream} onChange={(e) => setAlsoDownstream(e.target.checked)} /> also refresh budget &amp; casting
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {([['add', '+ add', 'bg-emerald-50 text-emerald-700 border-emerald-200'], ['update', '~ update', 'bg-amber-50 text-amber-700 border-amber-200'], ['adopt', 'adopt', 'bg-sky-50 text-sky-700 border-sky-200'], ['locked', 'locked', 'bg-rose-50 text-rose-700 border-rose-200'], ['orphan', 'orphan strips', 'bg-gray-50 text-gray-500 border-gray-200'], ['unchanged', 'in sync', 'bg-gray-50 text-gray-400 border-gray-200']] as any[]).map(([k, label, cls]: any) => (syncPrev.summary?.[k] > 0) ? <span key={k} className={cn('text-[11px] px-2 py-1 rounded-lg border', cls)}>{label}: <b>{syncPrev.summary[k]}</b></span> : null)}
          </div>
          {((syncPrev.summary?.add || 0) + (syncPrev.summary?.update || 0) + (syncPrev.summary?.adopt || 0)) > 0 ? (
            <button onClick={applySync} disabled={syncBusy} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white" style={{ cursor: 'pointer' }}><Play size={12} /> Apply sync ({(syncPrev.summary.add || 0) + (syncPrev.summary.update || 0) + (syncPrev.summary.adopt || 0)} change{((syncPrev.summary.add || 0) + (syncPrev.summary.update || 0) + (syncPrev.summary.adopt || 0)) === 1 ? '' : 's'})</button>
          ) : <span className="son-faint" style={{ fontSize: 11 }}>Schedule is in sync with the script.</span>}
          {(syncPrev.orphanStrips || []).length > 0 && (
            <div className="mt-2">
              {syncPrev.mmBaseline && <div className="text-[11px] text-sky-700 bg-sky-50 border border-sky-100 rounded px-2 py-1 mb-1.5">Movie Magic baseline detected — schedule{syncPrev.mmStrips ? ` (${syncPrev.mmStrips} strips)` : ''} &amp; budget come from MM; the script links onto it (budget won't be doubled).</div>}
              <div className="son-faint" style={{ fontSize: 11, marginBottom: 4 }}>Unmatched strips ({syncPrev.orphanStrips.length}) — match a scene to link (avoids duplicate strips):</div>
              <div className="space-y-1" style={{ maxHeight: 150, overflow: 'auto' }}>
                {syncPrev.orphanStrips.slice(0, 20).map((os: any) => (
                  <div key={os.id} className="flex items-center gap-2 text-[11px]">
                    {os.mm && <span className="px-1 rounded bg-sky-100 text-sky-700 font-semibold">MM</span>}
                    <span className="text-slate-600" style={{ minWidth: 96 }}>{os.shootDay ? `D${os.shootDay}` : 'U'} · {os.sceneNumber || '—'} · {os.setName || ''}</span>
                    <select className="son-input" style={{ fontSize: 11, padding: '2px 4px' }} defaultValue="" onChange={(e) => e.target.value && linkScene(e.target.value, os.id)} disabled={syncBusy}>
                      <option value="">link scene…</option>
                      {(syncPrev.changes || []).filter((c: any) => c.type === 'ADD').map((c: any) => <option key={c.sceneId} value={c.sceneId}>Sc {c.sceneNumber || '—'}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          {logs.length > 0 && (
            <div className="mt-2 space-y-1">
              {logs.slice(0, 4).map((l: any) => (
                <div key={l.id} className="flex items-center gap-2 text-[11px]">
                  <span className="son-faint">{new Date(l.appliedAt).toLocaleString('en-GB')}</span>
                  <span className="text-slate-600">{l.rolledBack ? <span className="text-slate-400">rolled back</span> : <>+{l.created} ~{l.updated} adopt {l.adopted}{l.skippedLocked ? ` · ${l.skippedLocked} locked` : ''}</>}</span>
                  {!l.rolledBack && <button onClick={() => undo(l.id)} className="inline-flex items-center gap-1 text-indigo-600" style={{ cursor: 'pointer' }}><RotateCcw size={11} /> undo</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
