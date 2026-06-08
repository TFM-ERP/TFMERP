'use client';

import { useState, useEffect, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { ClipboardCheck, Plus, Trash2, Loader2, CheckCircle2, MessageSquare } from 'lucide-react';
import { PanelHeader, StatRow, ClusterCard, Chip, Btn, EmptyState, DataTable, Tabs } from './ui';

const READY_TONE: Record<string, string> = { READY: 'money', OUTSTANDING: 'need', BLOCKED: 'risk' };
const SCR_TONE: Record<string, string> = { OPEN: 'risk', ACK: 'need', IN_PROGRESS: 'link', RESOLVED: 'money', REJECTED: 'slate' };
const PRIO_TONE: Record<string, string> = { LOW: 'slate', MEDIUM: 'need', HIGH: 'risk', URGENT: 'risk' };
const SCR_STATUSES = ['OPEN', 'ACK', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const inp = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-900 outline-none';

export default function ReadinessPanel({ projectId }: { projectId: string }) {
  const [inner, setInner] = useState('board');
  const [board, setBoard] = useState<any>(null);
  const [reqs, setReqs] = useState<any[]>([]);
  const [locs, setLocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<any>({ title: '', locationId: '', sceneRefs: '', detail: '', reason: '', department: '', priority: 'MEDIUM' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      productionApi.scriptReadiness.board(projectId),
      productionApi.scriptReadiness.requests(projectId),
      productionApi.locations.list(projectId),
    ])
      .then(([b, r, l]) => { setBoard(b.data); setReqs(Array.isArray(r.data) ? r.data : []); setLocs(Array.isArray(l.data) ? l.data : []); })
      .catch(() => setBoard(null))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!draft.title.trim()) return;
    await productionApi.scriptReadiness.createRequest(projectId, draft);
    setDraft({ title: '', locationId: '', sceneRefs: '', detail: '', reason: '', department: '', priority: 'MEDIUM' });
    setCreating(false); load();
  };
  const setReqField = async (id: string, data: any) => { await productionApi.scriptReadiness.updateRequest(id, data); load(); };
  const removeReq = async (id: string) => { if (!confirm('Delete this scene-change request?')) return; await productionApi.scriptReadiness.removeRequest(id); load(); };
  const locName = (id?: string) => locs.find((l) => l.id === id)?.name || '—';

  if (loading) return <p className="text-slate-400 text-sm py-10 text-center"><Loader2 className="animate-spin mx-auto" /></p>;

  const openReqs = reqs.filter((r) => r.status !== 'RESOLVED' && r.status !== 'REJECTED');

  return (
    <div className="font-sans">
      <PanelHeader
        icon={ClipboardCheck}
        title="Location readiness & script loop"
        subtitle="Producer's-eye view: which locations are shoot-ready, plus the scene-change requests raised from recces to fit the venues."
      />
      <Tabs active={inner} onChange={setInner} tabs={[['board', 'Readiness board'], ['changes', `Scene changes${openReqs.length ? ` (${openReqs.length})` : ''}`]]} />

      {inner === 'board' && (board && board.rows.length > 0 ? (
        <>
          <StatRow stats={[['Locations', board.summary.total], ['Ready', board.summary.ready], ['Outstanding', board.summary.outstanding], ['Blocked', board.summary.blocked]]} />
          <DataTable
            cols={['Location', 'Readiness', 'Recces', 'Blockers', 'Open actions', 'Sign-off', 'Permit', 'Scene changes']}
            align={{ 2: 'center', 3: 'center', 4: 'center', 7: 'center' }}
            rows={board.rows.map((r: any) => [
              <span className="font-medium text-slate-800">{r.name}{r.scenes ? <span className="block text-[11px] text-slate-400">Sc {r.scenes}</span> : null}</span>,
              <Chip tone={READY_TONE[r.readiness]}>{r.readiness}</Chip>,
              r.recceCount,
              r.blockers > 0 ? <span className="text-rose-600 font-semibold">{r.blockers}</span> : '0',
              r.openActions > 0 ? <span className="text-amber-600 font-semibold">{r.openActions}</span> : '0',
              r.signOff ? <Chip tone={r.signOff === 'APPROVED' ? 'money' : r.signOff === 'REJECTED' ? 'risk' : 'slate'}>{r.signOff}</Chip> : <span className="text-slate-300">—</span>,
              r.permitRequired ? <Chip tone={r.permitOk ? 'money' : 'risk'}>{r.permitStatus || 'NONE'}</Chip> : <span className="text-slate-300">n/a</span>,
              r.openChanges > 0 ? <span className="text-rose-600 font-semibold">{r.openChanges}</span> : '0',
            ])}
          />
        </>
      ) : <EmptyState icon={ClipboardCheck}>No project locations yet. Lock options in the Breakdown &amp; options tab to populate the readiness board.</EmptyState>)}

      {inner === 'changes' && (
        <>
          <div className="flex justify-end mb-3">
            <Btn variant="primary" onClick={() => setCreating((c) => !c)}><Plus size={13} /> Raise scene-change</Btn>
          </div>
          {creating && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 mb-3 space-y-2.5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <input className={inp} placeholder="Title (e.g. Rewrite Sc 14 — no stairs at venue)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                <select className={inp} value={draft.locationId} onChange={(e) => setDraft({ ...draft, locationId: e.target.value })}>
                  <option value="">— location (optional) —</option>
                  {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <input className={inp} placeholder="Affected scenes (e.g. 14, 15)" value={draft.sceneRefs} onChange={(e) => setDraft({ ...draft, sceneRefs: e.target.value })} />
                <input className={inp} placeholder="Department raising (e.g. DoP)" value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} />
                <select className={inp} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
              </div>
              <textarea className={`${inp} w-full`} rows={2} placeholder="What needs to change" value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} />
              <textarea className={`${inp} w-full`} rows={2} placeholder="Why (venue constraint)" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
              <div className="flex gap-2">
                <Btn variant="primary" onClick={create} disabled={!draft.title.trim()}>Raise request</Btn>
                <Btn variant="secondary" onClick={() => setCreating(false)}>Cancel</Btn>
              </div>
            </div>
          )}

          {reqs.length === 0 ? (
            <EmptyState icon={MessageSquare}>No scene-change requests. Raise one when a recce shows a scene needs rewriting to fit the venue.</EmptyState>
          ) : (
            <div className="space-y-2">
              {reqs.map((r) => (
                <ClusterCard
                  key={r.id}
                  defaultOpen={r.status !== 'RESOLVED' && r.status !== 'REJECTED'}
                  title={<span className="inline-flex items-center gap-2">{r.title} <Chip tone={SCR_TONE[r.status] || 'slate'}>{r.status.replace('_', ' ')}</Chip></span>}
                  badges={<Chip tone={PRIO_TONE[r.priority] || 'slate'}>{r.priority}</Chip>}
                  meta={<span>{r.locationId ? locName(r.locationId) : ''}{r.sceneRefs ? ` · Sc ${r.sceneRefs}` : ''}</span>}
                >
                  {r.detail && <p className="text-sm text-slate-700"><b className="text-slate-500 text-xs uppercase tracking-wide">Change:</b> {r.detail}</p>}
                  {r.reason && <p className="text-sm text-slate-600"><b className="text-slate-500 text-xs uppercase tracking-wide">Reason:</b> {r.reason}</p>}
                  {r.department && <p className="text-[11px] text-slate-400">Raised by {r.department}{r.raisedByName ? ` · ${r.raisedByName}` : ''}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <select className={inp} value={r.status} onChange={(e) => setReqField(r.id, { status: e.target.value })}>
                      {SCR_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <select className={inp} value={r.priority} onChange={(e) => setReqField(r.id, { priority: e.target.value })}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input className={`${inp} flex-1 min-w-[180px]`} defaultValue={r.resolution || ''} placeholder="Resolution / writer response" onBlur={(e) => e.target.value !== (r.resolution || '') && setReqField(r.id, { resolution: e.target.value })} />
                    <button onClick={() => removeReq(r.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                  </div>
                  {r.resolvedAt && <p className="text-[11px] text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 size={12} /> {r.status === 'REJECTED' ? 'Closed' : 'Resolved'} {new Date(r.resolvedAt).toLocaleDateString('en-GB')}</p>}
                </ClusterCard>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
