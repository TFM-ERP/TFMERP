'use client';

import { useEffect, useState } from 'react';
import { Database, Download, Trash2, RefreshCw, ShieldCheck, AlertTriangle, Plus, Clock, RotateCcw, X } from 'lucide-react';
import { backupsApi } from '@/lib/api';

function fmtSize(n: number) {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function BackupsPage() {
  const [status, setStatus] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [err, setErr] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<any>(null);
  const [restoring, setRestoring] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const [s, l] = await Promise.all([backupsApi.status(), backupsApi.list()]);
      setStatus(s.data); setList(l.data);
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Failed to load backups');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true); setErr('');
    try {
      await backupsApi.create(label.trim() || undefined);
      setLabel('');
      await load();
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Backup failed');
    } finally { setCreating(false); }
  };

  const download = async (id: string) => {
    try {
      const res = await backupsApi.download(id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `${id}.dump`; a.click();
      URL.revokeObjectURL(url);
    } catch { setErr('Download failed'); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this backup permanently?')) return;
    try { await backupsApi.remove(id); await load(); } catch { setErr('Delete failed'); }
  };

  const doRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true); setErr(''); setDoneMsg('');
    try {
      await backupsApi.restore(restoreTarget.id);
      setRestoreTarget(null);
      setDoneMsg('Restore complete. A "pre-restore" safety backup of your previous data was saved — restore it from the list to switch back. Reload the app to see the restored data.');
      await load();
    } catch (e: any) {
      setErr(e.response?.data?.message || 'Restore failed');
    } finally { setRestoring(false); }
  };

  const typeBadge = (t: string) => {
    const map: any = {
      manual: 'bg-blue-50 text-blue-700',
      auto: 'bg-gray-100 text-gray-600',
      'pre-restore': 'bg-amber-50 text-amber-700',
    };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[t] || map.manual}`}>{t === 'pre-restore' ? 'pre-restore' : t}</span>;
  };

  return (
    <div className="p-6 max-w-[1700px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Database size={18} className="text-brand-600" /></div>
          <div>
            <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Setup · Data</div>
            <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Backups</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Save and download snapshots of your database. Automatic daily backups run in the background.</p>
          </div>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {/* Status */}
      {status && (
        <div className={`card p-4 flex items-start gap-3 ${status.ready ? '' : 'border-amber-200 bg-amber-50/40'}`}>
          {status.ready
            ? <ShieldCheck size={18} className="text-green-600 mt-0.5" />
            : <AlertTriangle size={18} className="text-amber-500 mt-0.5" />}
          <div className="flex-1 text-sm">
            {status.ready ? (
              <>
                <p className="text-gray-800 font-medium">Backups are ready.</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {status.count} backup{status.count !== 1 ? 's' : ''} · last {status.lastBackupAt ? fmtDate(status.lastBackupAt) : 'never'} ·
                  auto-backup {status.lastAutoAt ? `last ran ${fmtDate(status.lastAutoAt)}` : 'will run within 24h'}
                </p>
                <p className="text-gray-400 text-[11px] mt-1 font-mono break-all">{status.dir}</p>
              </>
            ) : (
              <>
                <p className="text-amber-800 font-medium">PostgreSQL tools not found</p>
                <p className="text-amber-700 text-xs mt-0.5">{status.message}</p>
              </>
            )}
          </div>
        </div>
      )}

      {err && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{err}</div>}
      {doneMsg && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{doneMsg}</div>}

      {/* Create */}
      <div className="card p-4">
        <h2 className="font-semibold text-gray-800 text-sm mb-3">Create a backup now</h2>
        <div className="flex items-center gap-2">
          <input className="input flex-1" placeholder="Optional label (e.g. before price update)" value={label}
            onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create(); }} />
          <button onClick={create} disabled={creating || !status?.ready} className="btn-primary">
            {creating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
            {creating ? 'Backing up…' : 'Create backup'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-gray-800 text-sm">Backup history ({list.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : list.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Database size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No backups yet — create your first one above.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-2.5 text-start">Created</th>
                <th className="px-3 py-2.5 text-start">Label</th>
                <th className="px-3 py-2.5 text-start">Type</th>
                <th className="px-3 py-2.5 text-end">Size</th>
                <th className="px-5 py-2.5 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(b => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-5 py-3 text-gray-700"><div className="flex items-center gap-1.5"><Clock size={12} className="text-gray-400" /> {fmtDate(b.createdAt)}</div></td>
                  <td className="px-3 py-3 text-gray-600">{b.label || <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-3">{typeBadge(b.type)}</td>
                  <td className="px-3 py-3 text-end text-gray-500">{fmtSize(b.size)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setRestoreTarget(b)} title="Restore / switch to this backup" className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600"><RotateCcw size={15} /></button>
                      <button onClick={() => download(b.id)} title="Download" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-brand-600"><Download size={15} /></button>
                      <button onClick={() => remove(b.id)} title="Delete" className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Restoring loads that snapshot over your current data. A "pre-restore" safety backup is taken automatically first, so you can always switch back by restoring it.
      </p>

      {/* Restore confirmation modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !restoring && setRestoreTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 flex items-center gap-2"><RotateCcw size={16} className="text-amber-500" /> Restore backup</h2>
              <button onClick={() => !restoring && setRestoreTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
                This replaces <b>all current data</b> with the snapshot from <b>{fmtDate(restoreTarget.createdAt)}</b>{restoreTarget.label ? ` (“${restoreTarget.label}”)` : ''}.
              </div>
              <p className="text-gray-600">
                A safety backup of your current data is taken first, so you can switch back anytime by restoring the new <b>pre-restore</b> entry.
              </p>
              <p className="text-gray-400 text-xs">Tip: reload the app after restoring so all pages show the restored data.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setRestoreTarget(null)} disabled={restoring} className="btn-secondary flex-1">Cancel</button>
              <button onClick={doRestore} disabled={restoring} className="btn-primary flex-1" style={{ background: '#0f172a' }}>
                {restoring ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                {restoring ? 'Restoring…' : 'Restore now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
            