'use client';

import { useState, useEffect, useCallback } from 'react';
import { arrivalApi, transportApi } from '@/lib/api';
import { Plane, Plus, X, Loader2, Trash2, Clock, ChevronRight, CheckCircle2, User } from 'lucide-react';
import { PanelHeader, Btn, inputCls } from './ui';

const PIPELINE = ['SCHEDULED', 'LANDED', 'COLLECTED', 'CHECKED_IN', 'COMPLETED'];
const STATUS_CLS: Record<string, string> = { SCHEDULED: 'bg-slate-100 text-slate-600', LANDED: 'bg-amber-100 text-amber-700', COLLECTED: 'bg-blue-100 text-blue-700', CHECKED_IN: 'bg-violet-100 text-violet-700', COMPLETED: 'bg-emerald-100 text-emerald-700', NO_SHOW: 'bg-rose-100 text-rose-700', CANCELLED: 'bg-slate-100 text-slate-400' };
const fmt = (d?: string) => (d ? new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default function ArrivalsPanel({ projectId }: { projectId: string }) {
  const [board, setBoard] = useState<any>({ byStatus: {}, counts: {}, total: 0, inProgress: 0 });
  const [create, setCreate] = useState(false);

  const load = useCallback(() => { arrivalApi.dashboard(projectId).then((r) => setBoard(r.data || { byStatus: {}, counts: {} })).catch(() => {}); }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const advance = async (id: string) => { await arrivalApi.advance(id); load(); };
  const setStatus = async (id: string, status: string) => { await arrivalApi.update(id, { status }); load(); };
  const remove = async (id: string) => { await arrivalApi.remove(id); load(); };

  return (
    <div className="font-sans">
      <PanelHeader
        icon={Plane}
        title="Arrival operations"
        subtitle={`Meet & greet pipeline — ${board.total} arrival${board.total === 1 ? '' : 's'}, ${board.inProgress} in progress.`}
        actions={<Btn variant="primary" onClick={() => setCreate(true)}><Plus size={14} /> Schedule arrival</Btn>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {PIPELINE.map((s) => {
          const items = board.byStatus?.[s] || [];
          return (
            <div key={s} className="rounded-2xl border border-slate-200 bg-slate-50/40 p-2.5">
              <div className="flex items-center justify-between px-1 mb-2"><span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATUS_CLS[s]}`}>{s.replace('_', ' ')}</span><span className="text-xs text-slate-400">{items.length}</span></div>
              <div className="grid gap-2">
                {items.length === 0 ? <p className="text-[11px] text-slate-400 px-1 py-2">—</p> : items.map((a: any) => (
                  <div key={a.id} className="rounded-xl bg-white ring-1 ring-slate-200 p-2.5">
                    <div className="flex items-center gap-2">
                      {a.traveler?.photoUrl ? <img src={a.traveler.photoUrl} alt="" className="w-6 h-6 rounded-full object-cover" /> : <span className="w-6 h-6 rounded-full bg-slate-100 grid place-items-center"><User size={12} className="text-slate-400" /></span>}
                      <span className="text-sm font-medium text-slate-800 truncate flex-1">{a.traveler?.fullName}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">{[a.flightNumber, a.airport, a.terminal].filter(Boolean).join(' · ') || 'no flight'}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 inline-flex items-center gap-1"><Clock size={10} />{fmt(a.arrivalTime)}</div>
                    {(a.vehicle || a.transportDriver || a.meetGreetRep) && <div className="text-[11px] text-slate-500 mt-1">{[a.vehicle ? `${[a.vehicle.make, a.vehicle.model].filter(Boolean).join(' ') || a.vehicle.vehicleType}` : null, a.transportDriver?.fullName, a.meetGreetRep].filter(Boolean).join(' · ')}</div>}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      {s !== 'COMPLETED' ? <button onClick={() => advance(a.id)} className="text-[11px] inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-2 py-1">Advance <ChevronRight size={11} /></button> : <span className="text-[11px] text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 size={12} /> Done</span>}
                      <div className="flex items-center gap-1">
                        <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value)} className={`text-[10px] rounded-full px-1.5 py-0.5 border-0 ${STATUS_CLS[a.status]}`}>{[...PIPELINE, 'NO_SHOW', 'CANCELLED'].map((st) => <option key={st} value={st}>{st.replace('_', ' ')}</option>)}</select>
                        <button onClick={() => remove(a.id)} className="text-slate-300 hover:text-rose-600"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* off-pipeline */}
      {((board.byStatus?.NO_SHOW?.length || 0) + (board.byStatus?.CANCELLED?.length || 0)) > 0 && (
        <p className="text-[11px] text-slate-400 mt-3">{board.counts?.NO_SHOW || 0} no-show · {board.counts?.CANCELLED || 0} cancelled</p>
      )}

      {create && <ArrivalModal projectId={projectId} onClose={() => setCreate(false)} onDone={() => { setCreate(false); load(); }} />}
    </div>
  );
}

function ArrivalModal({ projectId, onClose, onDone }: any) {
  const [expected, setExpected] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [f, setF] = useState<any>({ travelerId: '', airport: 'AUH', flightNumber: '', arrivalTime: '', terminal: '', meetGreetRep: '', vehicleId: '', transportDriverId: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    arrivalApi.expected(projectId).then((r) => setExpected(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    transportApi.vehicles().then((r) => setVehicles(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    transportApi.drivers().then((r) => setDrivers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [projectId]);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const submit = async () => { if (!f.travelerId) return; setBusy(true); try { await arrivalApi.create({ ...f, projectId, arrivalTime: f.arrivalTime || undefined }); onDone(); } finally { setBusy(false); } };
  const inp = inputCls;
  const L = ({ label, children, full }: any) => <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>{children}</label>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold text-slate-900">Schedule arrival</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <L label="Person *" full><select className={inp} value={f.travelerId} onChange={(e) => set('travelerId', e.target.value)}><option value="">Select…</option>{expected.map((t) => <option key={t.id} value={t.id}>{t.fullName} ({t.personType})</option>)}</select></L>
          <L label="Airport"><input className={inp} value={f.airport} onChange={(e) => set('airport', e.target.value)} placeholder="AUH" /></L>
          <L label="Flight no."><input className={inp} value={f.flightNumber} onChange={(e) => set('flightNumber', e.target.value)} placeholder="EK0021" /></L>
          <L label="Arrival time"><input type="datetime-local" className={inp} value={f.arrivalTime} onChange={(e) => set('arrivalTime', e.target.value)} /></L>
          <L label="Terminal"><input className={inp} value={f.terminal} onChange={(e) => set('terminal', e.target.value)} /></L>
          <L label="Meet &amp; greet rep" full><input className={inp} value={f.meetGreetRep} onChange={(e) => set('meetGreetRep', e.target.value)} /></L>
          <L label="Vehicle"><select className={inp} value={f.vehicleId} onChange={(e) => set('vehicleId', e.target.value)}><option value="">—</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{[v.make, v.model].filter(Boolean).join(' ') || v.vehicleType}{v.plateNumber ? ` · ${v.plateNumber}` : ''}</option>)}</select></L>
          <L label="Driver"><select className={inp} value={f.transportDriverId} onChange={(e) => set('transportDriverId', e.target.value)}><option value="">—</option>{drivers.map((d) => <option key={d.id} value={d.id}>{d.fullName}</option>)}</select></L>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={busy || !f.travelerId}>{busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />} Schedule</Btn>
        </div>
      </div>
    </div>
  );
}
